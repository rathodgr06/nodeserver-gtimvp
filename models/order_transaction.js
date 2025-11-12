const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
let order_txn_table = config.table_prefix + "order_txn";
const test_order_txn_table = config.table_prefix + "test_order_txn";
const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");

var order_transactionModel = {
  add: async (data, txn_table = "order_txn") => {
    let order_txn_table = config.table_prefix + txn_table;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert(order_txn_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  test_txn_add: async (data, txn_table = "test_order_txn") => {
    let test_order_txn_table = config.table_prefix + txn_table;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(test_order_txn_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateDynamic: async (data, condition, table_name) => {
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectWithJoin: async (selection, condition, t1, t2, join_condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + t1 + " t1")
        .join(config.table_prefix + t2 + " t2", join_condition, "inner")
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  addResDump: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "txn_response_dump", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  addTestResDump: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "test_txn_response_dump", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamic: async (condition, selection, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table_name);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  selectOneWithTwoOfOneStatus: async (selection, condition, table) => {
    let type = ["PARTIALLY_CAPTURE", "CAPTURE", "SALE"];
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .where_in("type", type)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectOneWithTwoOfOneStatusOrders: async (selection, condition, table) => {
    let type = ["PARTIALLY_CAPTURE", "CAPTURE"];
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .where_in("status", type)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectRefundedAmount: async (selection, condition, table = "order_txn") => {
    let query =
      "SELECT IFNULL(SUM(amount),0) as amount FROM " +
      config.table_prefix +
      table +
      " WHERE type IN ('REFUND','PARTIALLY_REFUND') AND order_id='" +
      condition.order_id +
      "' AND status='AUTHORISED'";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectCaptureAmountSum: async (selection, condition, table = "order_txn") => {
    let query =
      "SELECT IFNULL(SUM(amount),0) as amount FROM " +
      config.table_prefix +
      table +
      " WHERE type IN ('CAPTURE','PARTIALLY_CAPTURE') AND order_id='" +
      condition.order_id +
      "' AND status='AUTHORISED'";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectOneDecremental: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "asc")
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  updateWithRawQuery: async (amount, order_no) => {
    let query =
      "UPDATE " +
      config.table_prefix +
      "qr_payment SET refunded_amount = refunded_amount+" +
      amount +
      ' WHERE order_no="' +
      order_no +
      '"';
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
      return response?.[0];
    }
  },
  getDueDateTransaction: async (order_id, subscription_id) => {
    const current_date = moment().format("YYYY-MM-DD");
    let sql = `SELECT * FROM  ${config.table_prefix}order_txn WHERE order_id = '${order_id}' AND subscription_id='${subscription_id}' AND DATE(created_at) = "${current_date}" ORDER BY  id DESC LIMIT 1`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  selectSubsData: async (order_no) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT s.subscription_id,s.plan_id FROM " +
        config.table_prefix +
        "subs_payment sp INNER JOIN " +
        config.table_prefix +
        "subscription s ON sp.plan_id=s.plan_id WHERE sp.order_no=" +
        order_no +
        " order by s.subscription_id desc limit 1";
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectWalletBalanceTotal:async(merchant_id,currency)=>{
    let qb = await pool.get_connection();
    let response;
    try {
      let query =`SELECT SUM(tc.net_amount) - COALESCE(ppt.amount, 0) AS wallet_balance FROM pg_transaction_charges tc LEFT JOIN (SELECT sub_merchant_id, currency, SUM(amount) AS amount FROM pg_payout_pending_transactions WHERE status = 0 AND order_status = 'PENDING' GROUP BY sub_merchant_id, currency) ppt ON tc.sub_merchant_id = ppt.sub_merchant_id AND tc.currency = ppt.currency WHERE tc.currency = '${currency}' AND tc.sub_merchant_id = ${merchant_id} AND tc.status = 0;`;
      response = await qb.query(query);
      console.log(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  }
};

module.exports = order_transactionModel;
