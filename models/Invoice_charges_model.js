const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");

//all table
const transaction_table = `${config.table_prefix}transaction_charges`;
const feature_table = `${config.table_prefix}feature_charges`;
const invoice_to_merchant_table = `${config.table_prefix}invoice_to_merchant`;

async function getFeatureMerchant() {
  let sql = `SELECT GROUP_CONCAT(DISTINCT submerchant_id) as sub_merchant FROM ${feature_table} WHERE status = 0`;
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
}

async function getTransactionMerchant() {
  let sql = `SELECT GROUP_CONCAT(DISTINCT sub_merchant_id) as sub_merchant FROM ${transaction_table} WHERE status = 0`;
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
}

function getArrayFromString(str) {
  if (str) {
    return str.split(",");
  }
  return [];
}

async function getAllMerchant() {
  const feature_result = await getFeatureMerchant();
  const transaction_result = await getTransactionMerchant();
  const feature_merchant = getArrayFromString(feature_result.sub_merchant);
  const transaction_merchant = getArrayFromString(
    transaction_result.sub_merchant
  );

  return {
    feature_merchant,
    transaction_merchant,
  };
}

async function getTransactionData(sub_merchant_id) {
  let sql = `SELECT SUM(sell_rate_total_charge) total FROM ${transaction_table} WHERE sub_merchant_id = ${sub_merchant_id} AND status=0`;
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
}

async function getTransactionPayDartChargesData(sub_merchant_id) {
  let sql = `SELECT SUM(sale_rate_paydart_percent_charge) + SUM(sale_rate_paydart_fix_charge) AS total_fee FROM ${transaction_table} WHERE sub_merchant_id = ${sub_merchant_id} AND status = 0`;
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
    return response?.[0];
  } else {
    return {};
  }
}

async function getSubMerchantData(sub_merchant_id, created_at) {
  let sql = `SELECT * FROM ${config.table_prefix}master_subm_sellrate WHERE submerchant_id = ${sub_merchant_id}`;
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
}

async function getFeatureData(sub_merchant_id) {
  let sql = `SELECT
                    SUM(CASE WHEN is_setup_fee = 1 THEN sell_rate_set_up_fee ELSE 0 END) AS total_set_up_fee,
                    SUM(CASE WHEN is_setup_fee = 1 THEN sell_rate_mid_fee ELSE 0 END) AS total_mid_fee,
                    SUM(CASE WHEN is_setup_fee = 0 THEN sell_rate_total_fee ELSE 0 END) AS total_feature_fee
                FROM
                    ${config.table_prefix}feature_charges
                WHERE
                    submerchant_id = ${sub_merchant_id} AND
                    STATUS = 0`;
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
}

async function getFeatureBuyData(sub_merchant_id) {
  let sql = `SELECT
                    SUM(CASE WHEN is_setup_fee = 1 THEN buy_rate_set_up_fee ELSE 0 END) AS total_set_up_fee,
                    SUM(CASE WHEN is_setup_fee = 1 THEN buy_rate_mid_fee ELSE 0 END) AS total_mid_fee
                FROM
                    ${config.table_prefix}feature_charges
                WHERE
                    submerchant_id = ${sub_merchant_id} AND
                    STATUS = 0`;
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
}

async function create_invoice(data, table_name) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .returning("id")
      .insert(`${config.table_prefix}${table_name}`, data);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  return response;
}

async function update_transaction_status(merchant_id) {
  let sql = `UPDATE ${transaction_table} SET status=1 WHERE sub_merchant_id = ${merchant_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
}

async function update_feature_status(merchant_id) {
  let sql = `UPDATE ${feature_table} SET status=1 WHERE submerchant_id = ${merchant_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
}

// invoice_to_merchant table query
async function getInvoiceToMerchant(sub_merchant_id, created_at) {
  let sql = `SELECT * FROM ${invoice_to_merchant_table} WHERE sub_merchant_id = ${sub_merchant_id} AND status = 0 AND date(created_at) = '${created_at}'`;
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
    return response?.[0];
  } else {
    return {};
  }
}

// async function getInvoiceToMerchant(sub_merchant_id, created_at) {
//     let sql = `SELECT * FROM ${invoice_to_merchant_table} WHERE sub_merchant_id = ${sub_merchant_id} AND status = 0 AND created_at = '${created_at}'`;
//     let qb = await pool.get_connection();
//     let response = await qb.query(sql)
//     qb.release();
//     return response?.[0];
// }
async function checkInvoiceToMerchant(sub_merchant_id, type) {
  let sql = `SELECT * FROM ${invoice_to_merchant_table} WHERE sub_merchant_id = ${sub_merchant_id} AND account_fee_type = '${type}' ORDER BY id desc LIMIT 1`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  if (response) {
    return response?.[0];
  } else {
    return {};
  }
}
// invoice_to_merchant table query end

//submercahnt_invoice_charges table query
async function sub_merchantInvoice(sub_merchant_id, created_at) {
  let sql = `SELECT * FROM ${config.table_prefix}submercahnt_invoice_charges WHERE submerchant_id = ${sub_merchant_id} AND status = 0 AND date(created_at) = '${created_at}'`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  if (response) {
    return response?.[0];
  } else {
    return {};
  }
}
// submercahnt_invoice_charges end

//invoice to psp query
async function getInvoiceToPsp(sub_merchant_id, created_at) {
  let sql = `SELECT * FROM ${config.table_prefix}invoice_to_psp WHERE sub_merchant_id = ${sub_merchant_id} AND status = 0 AND date(created_at) = '${created_at}'`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }
  if (response) {
    return response?.[0];
  } else {
    return {};
  }
}

async function checkInvoiceToPsp(sub_merchant_id, type) {
  let sql = `SELECT * FROM ${config.table_prefix}invoice_to_psp WHERE sub_merchant_id = ${sub_merchant_id} AND buy_account_fee_type = '${type}' order by id desc limit 1`;
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
    return response?.[0];
  } else {
    return {};
  }
}

async function getTransactionBuyRateAndSellRateDiff(sub_merchant_id) {
  let sql = `SELECT
                    (SUM(sale_rate_fix_charge) + SUM(sale_rate_percent_charge) + SUM(sale_rate_tax)) -
                    (SUM(buy_rate_fix_chareg) + SUM(buy_rate_percent_charge) + SUM(buy_rate_tax)) as txn_total_difference,
                    (SUM(sale_rate_paydart_charge) - SUM(buy_rate_percent_charge)) as total_refund_difference
                FROM
                    ${transaction_table} 
                WHERE
                    sub_merchant_id = ${sub_merchant_id} AND
                STATUS = 0`;
  console.log("sql", sql);
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
    return response?.[0];
  } else {
    return {};
  }
}

// invoice to psp query end
module.exports = {
  create_invoice,
  getAllMerchant,
  getTransactionData,
  getFeatureData,
  update_transaction_status,
  update_feature_status,
  getTransactionPayDartChargesData,
  getInvoiceToMerchant,
  getSubMerchantData,
  checkInvoiceToMerchant,
  sub_merchantInvoice,
  getInvoiceToPsp,
  getTransactionBuyRateAndSellRateDiff,
  checkInvoiceToPsp,
  getFeatureBuyData,
};
