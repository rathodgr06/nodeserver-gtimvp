const path = require("path");
const dotenv = require("dotenv");
const momentDatePicker = require('../../date_formatter');
const featureChargesModel = require('./featureChargesModel');
const transactionChargesModel = require('../transaction-charges/transactionChargesModel');
const helper = require('../../helper/general_helper');
//config file
dotenv.config({ path: "../.env" });
const winston = require('../../logmanager/winston');

module.exports = async (order_detail) => {
    try {
        
        // const mid_data = await transactionChargesModel.getMidData(order_detail);
        // console.log('feature mid_result', mid_data);
        // if (mid_data.env === 'test') {
        //     return true;
        // }

        const merchant_data = await calculateRate(featureChargesModel.getMerchantFeatureSellRate, order_detail);
        await storeSetUpData(order_detail, merchant_data);

    } catch (error) {
        winston.error(err);
        //console.log('feature error', error);
        return true;
    }
    
    return true;
};

async function calculateRate(getRateFunction, order_details) {
    const rateResult = await getRateFunction(order_details);
    
    if (Object.keys(rateResult).length === 0) {
        
        return {};
    }

    const { sell_rate_per, sell_rate_fix, tax, features } = rateResult;
    const rate = {
        fix_amount: sell_rate_fix,
        percent_amount: (sell_rate_per ? (order_details.amount * (sell_rate_per / 100)) : 0),
        total_amount: 0,
        total_tax_amount: 0,
        total_charges: 0,
        feature_id: features,
    };

    if (sell_rate_fix) rate.total_amount += rate.fix_amount;
    if (sell_rate_per) rate.total_amount += rate.percent_amount;
    if (tax) rate.total_tax_amount = (tax ? (rate.total_amount * (tax / 100)) : 0);
    rate.total_charges = rate.total_tax_amount + rate.total_amount;
    return rate;
}

async function storeSetUpData(order_detail, merchant_data) {
    
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        submerchant_id: order_detail.merchant_id,
        terminal_id: order_detail.terminal_id,
        psp_id: order_detail.psp_id,
        //country: order_detail.card_country,
        //country_id: country_id,
        order_id: order_detail.order_id,
        order_amount: order_detail?.amount || null,
        currency: order_detail.currency,
        order_status: order_detail.order_status,
        txn_id: order_detail.txn_id,
        txn_status: order_detail.txn_status,
        sale_rate_fix: merchant_data.fix_amount,
        sell_rate_per: merchant_data.percent_amount,
        sell_rate_tax: merchant_data.total_tax_amount,
        feature_id: merchant_data.feature_id,
        sell_rate_total_fee: merchant_data.total_charges,
        is_setup_fee: 0,
        created_at: created_date,
        updated_at: created_date,
    };
    await featureChargesModel.storeFeatureCharges(insert_data);
}