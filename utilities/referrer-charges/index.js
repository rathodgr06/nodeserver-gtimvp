const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const helper = require("../helper/general_helper");
const moment = require("moment");
const logger = require('../../config/logger');

module.exports = async (order_details, referrer_code) => {
  let condition = {
    referral_code: referrer_code,
    is_approved: 1,
    status: 0,
  };
  let qb = await pool.get_connection();
  let referrer_result;
  try {
    referrer_result = await qb
      .select(
        "id,ref_validity,fix_amount,per_amount,apply_greater,country,tax_per"
      )
      .where(condition)
      .get(config.table_prefix + "referrers");
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  let referrer_details = referrer_result[0];

  if (referrer_result[0] && referrer_details) {
    let referrer_currency = await helper.get_referrer_currency_by_country(
      referrer_details.country
    );
    let today = moment().format("YYYY-MM-DD");
    let ref_commission_validity_date = moment(referrer_details.ref_validity);

    if (
      referrer_currency == order_details.currency &&
      moment(today).isSameOrBefore(ref_commission_validity_date)
    ) {
      let amount = 0;
      let total_fix_amount = referrer_details.fix_amount;
      let total_per_amount =
        order_details.amount * (referrer_details.per_amount / 100);
      if (referrer_details.apply_greater === 1) {
        amount =
          total_fix_amount > total_per_amount
            ? total_fix_amount
            : total_per_amount;
      } else {
        amount = parseInt(total_fix_amount) + parseInt(total_per_amount);
      }
      let tax = (referrer_details.tax_per / 100) * amount;
      let amount_to_settle = amount - tax;
      let bonusData = {
        referrer_id: referrer_details.id,
        currency: referrer_currency,
        amount: amount,
        tax: tax,
        amount_to_settle: amount_to_settle,
        order_id: order_details.order_id,
        remark: `Benefit for transaction of ${order_details.order_id}`,
        ref_no: await helper.make_referral_txn_ref_no(),
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      let qb = await pool.get_connection();
      try {
        await qb
          .returning("id")
          .insert(config.table_prefix + "referral_bonus", bonusData);
      } catch (error) {
        console.error("Database query failed:", error);
        logger.error(500,{message: error,stack: error?.stack});
      } finally {
        qb.release();
      }
    }
  }
};
