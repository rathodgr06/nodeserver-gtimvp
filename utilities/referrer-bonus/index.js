const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const helper = require('../helper/general_helper');
const moment = require('moment');
const calculateBonus = require('./calculate_bonus');
const orderTransactionModel = require("../../models/order_transaction");

const referrerCalculationModel = require('../../models/referrer_bonus_calculation_model');
const logger = require('../../config/logger');

module.exports = async (order_details) => {
    try {
        let result_supermerchant = await orderTransactionModel.selectDynamic(
            {
                id: order_details.merchant_id,
            },
            "super_merchant_id",
            "master_merchant"
        );

        let super_merchant_id = result_supermerchant[0]?.super_merchant_id;

        let super_merchant_ref_result = await orderTransactionModel.selectDynamic(
            {
                id: super_merchant_id,
            },
            "referral_code_used",
            "master_super_merchant"
        );

        const referrer_code = super_merchant_ref_result[0]?.referral_code_used;
        

        if (!referrer_code) {
            return true;
        }
        

        const merchant_wise_result = await referrerCalculationModel.selectExpiryData({
            super_merchant_id: super_merchant_id,
            referrer_code: referrer_code
        });

        const referrer_details = await referrerCalculationModel.getReferrerData({
            referral_code: referrer_code,
            // is_approved: 0,
            status: 0
        });
        
        let referrer_currency = await helper.get_referrer_currency_by_country(referrer_details.country);

        if (merchant_wise_result && Object.keys(merchant_wise_result).length > 0) {
            const validity = merchant_wise_result?.validity;
            let today = moment().format('YYYY-MM-DD');
            let ref_commission_validity_date = moment(validity);
            if (moment(today).isSameOrBefore(ref_commission_validity_date)) {
                await calculateBonus(order_details, referrer_details, referrer_currency, super_merchant_id);
            } else {
                //update the status of expiry date
                await referrerCalculationModel.updateExpiryDate({ status: 1 }, {
                    super_merchant_id: super_merchant_id,
                    referrer_code: referrer_code
                });
            }
        } else {
            await calculateBonus(order_details, referrer_details, referrer_currency, super_merchant_id);
            const days = parseInt(referrer_details.calculate_bonus_till);
            let validity = moment().add(days, 'days').format('YYYY-MM-DD');
            let data = {
                super_merchant_id: super_merchant_id,
                referrer_code: referrer_code,
                validity: validity,
                validity_days: days,
            }
            //add the date expiry date
            await referrerCalculationModel.insertExpiryDate(data);

        }

        
        return true;

    } catch (error) {
        logger.error(500,{message: error,stack: error?.stack});
        return true;
        
    }
}
