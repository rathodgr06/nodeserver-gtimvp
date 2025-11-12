const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const helper = require('../helper/general_helper');
const moment = require('moment');

const referrerCalculationModel = require('../../models/referrer_bonus_calculation_model');

module.exports = async (order_details = null, referrer_details = null, referrer_currency = null,super_merchant_id=null) => {
    if (Object.keys(referrer_details).length == 0) {
        return true;
    }
    
    if (referrer_currency.toUpperCase() === order_details.currency.toUpperCase()) {
        let amount = 0;
        let total_fix_amount = referrer_details.fix_amount;
        let total_per_amount = order_details.amount * (referrer_details.per_amount / 100);
        let fixe_amount = null;
        if (referrer_details.apply_greater === 1) {
            if (total_fix_amount > total_per_amount) {
                amount = total_fix_amount;
            } else {
                amount = total_per_amount;
            }
        } else {
            amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
            fixe_amount = total_fix_amount
        }

        let tax = referrer_details.tax_per / 100 * amount;
        let amount_to_settle = amount - tax;
        let bonusData = {
            referrer_id: referrer_details.id,
            currency: referrer_currency,
            amount: amount,
            tax: tax,
            amount_to_settle: amount_to_settle,
            order_id: order_details.order_id,
            order_status: order_details.order_status,
            txn_id: order_details.payment_id,
            txn_type: order_details.txn_type,
            remark: `Benefit for transaction of ${order_details.order_id}`,
            ref_no: await helper.make_referral_txn_ref_no(),
            earned_fixed: fixe_amount,
            earn_percentage: total_per_amount,
            bonus_percentage: referrer_details.per_amount,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            void_status: 'CREDIT',
            super_merchant_id:super_merchant_id,
            submerchant_id:order_details.merchant_id
        }
        await referrerCalculationModel.addBonusData(bonusData);
    }
    return true;
}