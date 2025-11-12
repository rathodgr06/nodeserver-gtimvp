const path = require("path");
const dotenv = require("dotenv");
const momentDatePicker = require('../../date_formatter/index');
const setUpModel = require('./setUpModel');
const helper = require('../../helper/general_helper')
//config file
dotenv.config({ path: "../.env" });


module.exports = async (setup_detail) => {
    
    

    //get required details from the mid table
    const mid_detail = await setUpModel.getMerchantMidData(setup_detail.mid);
    console.log('mid_detail', mid_detail);
    if (Object.keys(mid_detail).length === 0) {
        return true;
    }

    if (mid_detail.env === 'test') {
        return true;
    }

    const mid_count = await setUpModel.getMerchantTotalMid(mid_detail.submerchant_id);

    const setup_param = {
        submerchant_id: mid_detail.submerchant_id,
        psp_id: mid_detail.psp_id,
        country_id: mid_detail.country_id,
        currency_id: mid_detail.currency_id,
        terminal_id: mid_detail.terminal_id,
        mid_count,
        mid_id: mid_detail.id
    }

    const merchant_data = await calculateRate(setUpModel.getMerchantData, setup_param);

    if (merchant_data) {
        await storeSetUpData(setup_param, merchant_data);
    }
    
    
    return true;
};

async function calculateRate(getRateFunction, setup_detail) {

    const rateResult = await getRateFunction(setup_detail);
    
    if (Object.keys(rateResult).length === 0) {
        return false;
    }
    
    let buy_rate_total_fee = 0;
    let buy_rate_mid_active_fee = 0;
    let buy_rate_setup_fee = 0;
    let mid_active_fee = 0;

    const mid_result = await setUpModel.getMerchantMidFee(setup_detail);
    
    mid_active_fee = mid_result.mid_activation_fee;

    const buy_rateResult = await setUpModel.getMerchantBuyRate(setup_detail);
    
    if (Object.keys(buy_rateResult).length != 0) {
        buy_rate_mid_active_fee = buy_rateResult?.mid_active_fees
        buy_rate_setup_fee = buy_rateResult?.setup_fees
    } 

    const { setup_fee, num_of_free_mid, buy_setup_fee } = rateResult;
    
    if (num_of_free_mid >= setup_detail.mid_count) {
        return false;
    }
    
    if (buy_setup_fee || buy_setup_fee === 0) {
        buy_rate_total_fee = buy_setup_fee + buy_rate_mid_active_fee;
    } else {
        buy_rate_total_fee = buy_rate_setup_fee + buy_rate_mid_active_fee;
        rateResult.buy_setup_fee = buy_rate_setup_fee;
    }
    rateResult.buy_mid_fee = buy_rate_mid_active_fee;
    rateResult.mid_active_fee = mid_active_fee;


    const rate = {
        sale_rate_total_fee: (mid_active_fee + setup_fee),
        buy_rate_total_fee: buy_rate_total_fee,
        mid_active_fees: buy_rateResult.mid_active_fees
    };

    return {
        ...rateResult,
        ...rate
    }
}

async function storeSetUpData(setup_detail, merchant_data) {
    const result = await setUpModel.checkSetupFee(setup_detail);
    
    if (Object.keys(result).length === 0) {
        const created_date = await momentDatePicker.created_date_time();
        const country_name = await helper.get_country_name_by_id(setup_detail.country_id)
        const insert_data = {
            submerchant_id: setup_detail.submerchant_id,
            terminal_id: setup_detail.terminal_id,
            psp_id: setup_detail.psp_id,
            country: country_name ?? null,
            country_id: setup_detail?.country_id,
            buy_rate_set_up_fee: merchant_data.buy_setup_fee,
            buy_rate_mid_fee: merchant_data?.buy_mid_fee || null,
            buy_rate_total_fee: merchant_data.buy_rate_total_fee,
            sell_rate_set_up_fee: merchant_data.setup_fee,
            sell_rate_mid_fee: merchant_data.mid_active_fee,
            sell_rate_total_fee: merchant_data.sale_rate_total_fee,
            is_setup_fee:1,
            created_at: created_date,
            updated_at: created_date,
        };
        await setUpModel.storeSetupFee(insert_data);
    }
}