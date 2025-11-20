const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const moment = require("moment");
const helpers = require("../utilities/helper/general_helper");

async function addDynamic(data, table_name) {
  let db_table = config.table_prefix + table_name;
  let query = await helpers.buildInsertQuery(db_table, data);
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(query);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  return response;
}

async function getCustomerCard(order_id) {
  let sql = `SELECT
                    cc.*
                FROM
                    ${config.table_prefix}orders o
                LEFT JOIN ${config.table_prefix}customers_cards cc on o.cid = cc.cid
                WHERE o.order_id = '${order_id}'
                LIMIT 1`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  return response?.[0];
}

async function getSubscription(order_no) {
  let sql = `SELECT subscription_id FROM ${config.table_prefix}subs_payment WHERE order_no='${order_no}' limit 1`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response ? response?.[0] : {};
}

async function checkCard({ cid, last_4_digit }) {
  let sql = `SELECT cid FROM ${config.table_prefix}declined_cards WHERE deleted=0 AND cid='${cid}' AND last_4_digit='${last_4_digit}' limit 1`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    return true;
  } else {
    return false;
  }
}

async function store(order_id, sale_api_res) {
  const customer_card = await getCustomerCard(order_id);
  if (!customer_card) {
    return true;
  }

  let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let subscription_result = await getSubscription(order_id);

  let card = {
    name_on_card: customer_card.name_on_card,
    email: customer_card.email,
    card_number: customer_card.card_number,
    card_expiry: customer_card.card_expiry,
    card_nw: customer_card.card_nw,
    last_4_digit: customer_card.last_4_digit,
    browser_token: customer_card.browser_token,
    cid: customer_card.cid,
    created_at: created_at,
    updated_at: updated_at,
    card_proxy: customer_card.card_proxy,
    cipher_id: customer_card.cipher_id,
    is_subscription: 1,
    subscription_id: subscription_result?.subscription_id,
    remark: sale_api_res.message,
    auth_code: sale_api_res.auth_code,
  };

  let cardResult = await checkCard(customer_card);
  if (!cardResult) {
    await addDynamic(card, "declined_cards");
  }

  return true;
}

module.exports = {
  addDynamic,
  store,
};
