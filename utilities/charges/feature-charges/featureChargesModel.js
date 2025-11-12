const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../../config/config.json")[env];
const pool = require("../../../config/database");
const momentFormat = require("../../date_formatter");

const feature_type = {
  invoice: 1,
  subscription: 2,
  qr: 3,
  "payment link": 4,
};

async function getFeature(type) {
  let key = feature_type[type];
  let sql = `SELECT * FROM ${config.table_prefix}master_features WHERE id = '${key}'`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  if (!response || response.length === 0) {
    return {};
  } else {
    return response?.[0];
  }
}

async function getMerchantFeatureSellRate(order_detail) {
  let key = order_detail.origin.trim().toLowerCase();

  // const feature_detail = await getFeature(key);

  // if (Object.keys(feature_detail).length === 0) {
  //     return {};
  // }
  let id = feature_type[key];
  let sql = `SELECT  *
                FROM
                    pg_master_subm_sellrate ms
                JOIN pg_subm_sellrate ss ON
                    ms.id = ss.master_subm_sellrate_id
                WHERE
                    ss.features = ${id} 
                    AND ss.deleted = 0 
                    AND ms.submerchant_id = ${order_detail.merchant_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  if (!response || response.length === 0) {
    return {};
  } else {
    return response?.[0];
  }
}

async function storeFeatureCharges(data) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .returning("id")
      .insert(`${config.table_prefix}feature_charges`, data);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response;
}

module.exports = {
  getMerchantFeatureSellRate,
  storeFeatureCharges,
};
