const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../../config/config.json")[env];
const pool = require("../../../config/database");
const momentFormat = require("../../date_formatter");
const helper = require("../../helper/general_helper");
const logger = require('../../../config/logger');

const midTable = `${config.table_prefix}mid`;
const master_sellrate = `${config.table_prefix}master_mid_sellrate`;
const master_buyrate = `${config.table_prefix}master_buyrate`;

async function getMerchantBuyRate({
  submerchant_id,
  terminal_id,
  psp_id,
  country_id,
  currency_id,
}) {
  //const currency = await helper.get_currency_name_by_id(currency_id);
  let sql = `SELECT
                    master_buyrate.*
                FROM
                    ${midTable} mid
                JOIN ${master_buyrate} master_buyrate ON
                    mid.psp_id = master_buyrate.psp
                WHERE
                    mid.submerchant_id = ${submerchant_id}
                    AND mid.deleted = 0 
                    AND mid.terminal_id = ${terminal_id}
                    AND master_buyrate.psp = ${psp_id}
                    AND master_buyrate.country_id = ${country_id}
                    `;
  //AND master_buyrate.currency = '${currency}'

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  }
  const { setup_fees, mid_active_fees } = response?.[0];
  return {
    setup_fees,
    mid_active_fees,
  };
}

async function getMerchantSellRate({ sub_merchant_id, terminal_id, psp_id }) {
  let sql = `SELECT
                    mater_buyrate.*
                FROM
                    ${midTable} mid
                JOIN ${master_sellrate} mater_sellrate ON
                    mid.psp_id = mater_sellrate.psp
                WHERE
                    mid.submerchant_id = ${sub_merchant_id}
                    AND mid.deleted = 0 
                    AND mid.terminal_id = ${terminal_id}
                    AND master_sellrate.psp = ${psp_id}`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  }
  const { setup_fees, mid_active_fees } = response?.[0];
  return {
    setup_fees,
    mid_active_fees,
  };
}

async function getMerchantData({ submerchant_id, psp_id, country_id }) {
  const sql = `SELECT * FROM ${config.table_prefix}master_subm_sellrate WHERE submerchant_id = ${submerchant_id} AND country_id =${country_id}`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (response || response.length === 0) {
    return response?.[0];
  } else {
    return {};
  }
}

async function checkSetupFee({
  submerchant_id,
  psp_id,
  country_id,
  terminal_id,
}) {
  let sql = `SELECT * FROM ${config.table_prefix}feature_charges 
                    WHERE submerchant_id = ${submerchant_id}
                    AND country_id =${country_id}
                    AND terminal_id=${terminal_id}`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  }
  return response?.[0];
}

async function storeSetupFee(data) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .returning("id")
      .insert(`${config.table_prefix}feature_charges`, data);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  return response;
}

async function getMerchantMidFee({ mid_id, psp_id, country_id, currency }) {
  const sql = `SELECT * FROM ${config.table_prefix}master_mid_sellrate 
        WHERE mid =${mid_id} AND  deleted =0;`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  }
  return response?.[0];
}

async function getMerchantTotalMid(merchant_id) {
  const sql = `SELECT COUNT(m.id) AS total_mid FROM ${config.table_prefix}mid m JOIN ${config.table_prefix}master_mid_sellrate ms on m.id = ms.mid WHERE m.submerchant_id = ${merchant_id} AND m.deleted = 0;`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  }
  return response?.[0].total_mid;
}

async function getMerchantMidData(mid_id) {
  const sql = `SELECT * FROM ${config.table_prefix}mid WHERE id = ${mid_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }

  if (!response || response.length === 0) {
    return {};
  }
  return response?.[0];
}

module.exports = {
  getMerchantSellRate,
  getMerchantBuyRate,
  storeSetupFee,
  checkSetupFee,
  getMerchantData,
  getMerchantMidFee,
  getMerchantTotalMid,
  getMerchantMidData,
};
