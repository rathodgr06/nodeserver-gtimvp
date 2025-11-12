const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const helper = require('../helper/general_helper');
const moment = require('moment');
const calculateBonus = require('./calculate_bonus_refund');

const referrerCalculationModel = require('../../models/referrer_bonus_calculation_model');

module.exports = async (order_details, txn_details) => {
    
    let sub_merchant_id = order_details.merchant_id;

    const super_merchant_result = await referrerCalculationModel.getSuperMerchant(sub_merchant_id);

    const { referral_code_used, super_merchant_id } = super_merchant_result;

    

    if (!referral_code_used) {
        
        return true;
    }

    const merchant_wise_result = await referrerCalculationModel.selectExpiryData({
        super_merchant_id: super_merchant_id,
        referrer_code: referral_code_used
    });

    const referrer_details = await referrerCalculationModel.getReferrerData({
        referral_code: referral_code_used,
        // is_approved: 0,
        status: 0
    });

    
    let referrer_currency = await helper.get_referrer_currency_by_country(referrer_details.country);

    if (merchant_wise_result && Object.keys(merchant_wise_result).length > 0) {
        const validity = merchant_wise_result?.validity;
        let today = moment().format('YYYY-MM-DD');
        let ref_commission_validity_date = moment(validity);
        if (moment(today).isSameOrBefore(ref_commission_validity_date)) {
            await calculateBonus(order_details, referrer_details, referrer_currency,super_merchant_id);
        }
    }

    
    return true;
}
