const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");

//all models table
const referrer_table = config.table_prefix + "referrers";
const merchant_wise_bonus_expiry_table =
  config.table_prefix + "merchant_wise_bonus_expiry";
const referral_bonus_table = config.table_prefix + "referral_bonus";

var dbModel = {
  selectExpiryData: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id, validity")
        .where(condition)
        .get(merchant_wise_bonus_expiry_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateExpiryDate: async (data, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(merchant_wise_bonus_expiry_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  insertExpiryDate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(merchant_wise_bonus_expiry_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getReferrerData: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "id,ref_validity,fix_amount,per_amount,apply_greater,country,tax_per, calculate_bonus_till"
        )
        .where(condition)
        .get(referrer_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  addBonusData: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(referral_bonus_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getSuperMerchant: async (sub_merchant_id) => {
    let sql = `SELECT sm.referral_code_used, sm.id as super_merchant_id FROM 
                   pg_master_merchant mm 
                   LEFT JOIN pg_master_super_merchant sm on mm.super_merchant_id = sm.id
                   WHERE mm.id = ${sub_merchant_id}`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getBonus: async (referrer_id, order_id, txn_id) => {
    let sql = `SELECT *  FROM ${config.table_prefix}referral_bonus WHERE referrer_id = ${referrer_id} AND order_id='${order_id}' AND txn_id = '${txn_id}'`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getFirstPartiallyRefundedData: async (order_id, referrer_id) => {
    const txn_type = "PARTIAL_REFUND";
    let sql = `SELECT count(id) as partial_refund_count FROM ${config.table_prefix}referral_bonus WHERE referrer_id = ${referrer_id} AND order_id='${order_id}' AND txn_type='${txn_type}' AND earned_fixed IS NOT NULL ORDER BY id desc LIMIT 1`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return response?.[0]?.partial_refund_count;
    } else {
      return 0;
    }
  },
  getFirstVoidCreditedData: async (order_id, referrer_id) => {
    const txn_type = "VOID";
    let sql = `SELECT count(id) as void_credit_count FROM ${config.table_prefix}referral_bonus WHERE referrer_id = ${referrer_id} AND order_id='${order_id}' AND txn_type='${txn_type}' AND void_status='CREDIT'`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return response?.[0]?.void_credit_count;
    } else {
      return 0;
    }
  },
};

module.exports = dbModel;
