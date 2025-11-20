require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const logger = require('../config/logger');
//tables
const referrer_invoice_payout_table =
  config.table_prefix + "referrer_invoice_payout";

async function addPayout(data) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .returning("id")
      .insert(referrer_invoice_payout_table, data);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  return response;
}

async function updatePayout(data, condition) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .set(data)
      .where(condition)
      .update(referrer_invoice_payout_table);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }

  return response;
}

async function selectPayout(condition) {
  let qb = await pool.get_connection();

  let response;
  try {
    response = await qb
      .select("*")
      .from(referrer_invoice_payout_table)
      .where(condition)
      .get();
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }

  return response;
}

async function selectPayoutReferrer(date) {
  let sql = `SELECT
                    r.id, r.is_approved
                FROM
                    ${referrer_invoice_payout_table} rip
                LEFT JOIN pg_referrers r ON
                    r.id = rip.referrer_id
                WHERE
                    rip.payout_date = '${date}' AND rip.status = 0  GROUP BY r.id, rip.payout_date`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  return response;
}

module.exports = {
  addPayout,
  updatePayout,
  selectPayout,
  selectPayoutReferrer,
};
