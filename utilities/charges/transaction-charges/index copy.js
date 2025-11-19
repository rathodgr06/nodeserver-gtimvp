const path = require("path");
const transactionChargesModel = require("./transactionChargesModel");
const merchantOrderModel = require("../../../models/merchantOrder");
const dotenv = require("dotenv");
const helper = require('../../helper/general_helper');
const momentDatePicker = require('../../date_formatter/index');
const logger = require('../../../config/logger');

dotenv.config({ path: "../.env" });

const constantOrderStatus = {
    captured: 'CAPTURED',
    partially_captured: 'PARTIALLY_CAPTURED',
    refunded: 'REFUNDED',
    partially_refunded: 'PARTIALLY_REFUNDED',
    void: 'VOID',
};

const constantTXNStatus = {
    capture: 'CAPTURE',
    void: 'VOID',
    refund: 'REFUND',
    partial_refund: 'PARTIAL_REFUND',
};

module.exports = async (order_details) => {
  
    try {
        console.log(`order details mode ${order_details}`)
        // if (order_details.mode == 'test') {
        //     return true;
        // }
        const mid_data = await transactionChargesModel.getMidData(order_details);
        console.log('transaction mid_result', mid_data);
        if (mid_data?.country_id) {
            order_details.country_id = mid_data?.country_id;
        }
        
        let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
        let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');

        const is_domestic_international = checkCountry(order_details.card_country, country_details.country_code);
        switch(order_details.order_status){
            case 'CAPTURED':
                const { sellRate } = await calculateRates(order_details, is_domestic_international);
                await storeTransactionData(order_details, sellRate, is_domestic_international);
            break;
            case 'REFUNDED':
                await storeRefundData(order_details,is_domestic_international);
            break;
            case 'CAPTURE-REVERSAL':
                await storeCaptureReversalData(order_details,is_domestic_international);
            break;
            case 'REFUND-REVERSAL':
                await storeRefundReversalData(order_details,is_domestic_international);
            break;                
        }
       /* if (order_details.order_status == "CAPTURED") {
          
            const { sellRate } = await calculateRates(order_details, is_domestic_international);
            await storeTransactionData(order_details, sellRate, is_domestic_international);

            return true;
        } else {
            await storeRefundData(order_details,is_domestic_international);
        } */
    } catch (error) {
        console.log('transaction error', error);
        logger.error(500,{message: error,stack: error?.stack});
        return true;
    }

};

function checkCountry(card_country, merchant_business_country) {
    const country_code = helper.get_country_code_by_name(card_country);
    return (merchant_business_country === country_code) ? 'Domestic' : 'International';
}

async function calculateRates(order_details, is_domestic_international) {
    const { amount, order_status, txn_status } = order_details;
    let sellRate = await calculateRate(transactionChargesModel.getMerchantSellRate, order_details, is_domestic_international);
    console.log("🚀 ~ calculateRates ~ sellRate-111:", sellRate)
    const allZero = Object.values(sellRate).every(value => value === 0);
    console.log(`allZero`)
    console.log(allZero);
    if (allZero) {
        sellRate = await calculateRate(transactionChargesModel.getMerchantDefaultSellRate, order_details, is_domestic_international);
    }

    
    // console.log(`this is sell rate`);
    // console.log(sellRate);
    // const buyRate = await calculateRate(transactionChargesModel.getMerchantByRate, order_details, is_domestic_international);
    // if (order_status === constantOrderStatus.void && txn_status === constantTXNStatus.void) {
    //     negateRateValues(sellRate);
    //     negateRateValues(buyRate);
    // }
    // if ((order_status === constantOrderStatus.partially_refunded || order_status === constantOrderStatus.refunded) &&
    //     (txn_status === constantTXNStatus.partial_refund || txn_status === constantTXNStatus.refund)) {
    //     negateRateValues(sellRate);
    //     negateRateValues(buyRate);
    //     await setPaydartCharges(amount, sellRate);
    //     await setPaydartCharges(amount, buyRate);

    // }
    return { sellRate };
}

async function calculateRate(getRateFunction, order_details, is_domestic_international) {
    const rateResult = await getRateFunction(order_details, is_domestic_international);
    console.log("🚀 ~ calculateRate ~ rateResult:", rateResult)
    if (Object.keys(rateResult).length === 0) {

        return {};
    }
    const { rate_fix, rate_per, tax, refund_fees_per, refund_fees_fix, paydart_rate_fix, paydart_rate_per } = rateResult;
    const rate = {
        fix_amount: rate_fix,
        percent_amount: (rate_per ? (order_details.amount * (rate_per / 100)) : 0),
        paydart_fix_amount: paydart_rate_fix,
        paydart_percent_amount: (paydart_rate_per ? (order_details.amount * (paydart_rate_per / 100)) : 0),
        total_amount: 0,
        total_tax_amount: 0,
        total_charges: 0,
        paydart_charge: 0,
        refund_fees_per: refund_fees_per,
        refund_fees_fix: refund_fees_fix
    };

    //rate sell rate
    if (rate.fix_amount) rate.total_amount += rate.fix_amount;
    if (rate_per) rate.total_amount += rate.percent_amount;

    //paydart charge
    if (rate.paydart_fix_amount) rate.total_amount += rate.paydart_fix_amount;
    if (paydart_rate_per) rate.total_amount += rate.paydart_percent_amount;

    //calculate tax
    if (tax) rate.total_tax_amount = (tax ? (rate.total_amount * (tax / 100)) : 0);

    rate.total_charges = rate.total_tax_amount + rate.total_amount;
    return rate;
}

function negateRateValues(rate) {
    rate.fix_amount = rate.fix_amount * (-1);
    rate.percent_amount = rate.percent_amount * (-1);
    rate.paydart_fix_amount = rate.paydart_fix_amount * (-1);
    rate.paydart_percent_amount = rate.paydart_percent_amount * (-1);
    rate.total_amount = rate.total_amount * (-1);
    rate.total_tax_amount = rate.total_tax_amount * (-1);
    rate.total_charges = rate.total_charges * (-1);
}

async function setPaydartCharges(amount, rate) {
    if (rate.refund_fees_per && rate.refund_fees_fix) {
        rate.paydart_charge = (amount * (rate.refund_fees_per / 100)) + rate.refund_fees_fix;
    }
    if (rate.refund_fees_per && !rate.refund_fees_fix) {
        rate.paydart_charge = amount * (rate.refund_fees_per / 100);
    }
    if (rate.refund_fees_fix && !rate.refund_fees_per) {
        rate.paydart_charge = rate.refund_fees_fix;
    }
    rate.total_charges += rate.paydart_charge;
}

async function storeTransactionData(order_details, sellRate/*, buyRate */, is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: sellRate.fix_amount,
        sale_rate_percent_charge: sellRate.percent_amount,
        sale_rate_tax: sellRate.total_tax_amount,
        sale_rate_paydart_charge: sellRate.paydart_charge,
        sale_rate_paydart_fix_charge: sellRate.paydart_fix_amount,
        sale_rate_paydart_percent_charge: sellRate.paydart_percent_amount,
        sell_rate_total_charge: sellRate.total_charges,
        txn_type: "CAPTURE",
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        created_at: created_date,
        updated_at: created_date,
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeRefundData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: -order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeRefundReversalData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeCaptureReversalData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: -order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
