const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");

var merchantOrderModel = {
  add: async (data, mode) => {
    let db_table = "";
    let response;
    let qb = await pool.get_connection();
    try {
      if (mode == "test") {
        db_table = config.table_prefix + "test_orders";
      } else {
        db_table = config.table_prefix + "orders";
      }

      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne: async (selection, condition, table) => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table);
        console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectDynamic: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("recent_used", "desc")
        .get(config.table_prefix + table);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectAllDynamic: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamicONE: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table);
        console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  addDynamic: async (data, table_name) => {
    let response;
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    try {
      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addCustomerCards: async (data) => {
    let db_table = config.table_prefix + "customers_cards";
    let query = await helpers.buildInsertQuery(db_table, data);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  updateDynamic: async (data, condition, table_name) => {
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectSubsData: async (paymentlink_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "sp.id,sm.emails,s.subscription_id,sp.plan_name,sp.payment_interval,sp.plan_billing_frequency,sp.plan_billing_amount,sp.plan_description,sp.terms,sp.final_payment_amount,sp.initial_payment_amount,sp.start_date,sp.plan_currency,md.super_merchant_id,md.id as merchant_id,mcc.id as mcc_id,mcc_cat.id as mcc_cat_id"
        )
        .from(config.table_prefix + "subs_plan_mail sm")
        .join(
          config.table_prefix + "subs_plans sp",
          "sm.plan_id=sp.id",
          "inner"
        )
        .join(
          config.table_prefix + "subscription s",
          "sm.token=s.payment_id",
          "inner"
        )
        .join(
          config.table_prefix + "master_merchant md",
          "sm.merchant_id=md.super_merchant_id",
          "inner"
        )
        .join(
          config.table_prefix + "master_merchant_details mde",
          "sm.id=mde.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mcc",
          "mde.mcc_codes=mcc.id",
          "left"
        )
        .join(
          config.table_prefix + "master_mcc_category mcc_cat",
          "mcc.category=mcc_cat.id",
          "left"
        )
        .where({ "sm.token": paymentlink_id, "sp.deleted": 0, "s.status": 0 })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectData: async (paymentlink_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mk.id,mk.sub_merchant_id,mk.type_of_qr_code,mk.quantity,mk.amount,mk.currency,md.super_merchant_id,mcc.id as mcc_id,mcc_cat.id as mcc_cat_id,mk.mode"
        )
        .from(config.table_prefix + "merchant_qr_codes mk")
        .join(
          config.table_prefix + "master_merchant md",
          "mk.sub_merchant_id=md.id",
          "inner"
        )
        .join(
          config.table_prefix + "master_merchant_details mde",
          "mk.sub_merchant_id=mde.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mcc",
          "mde.mcc_codes=mcc.id",
          "left"
        )
        .join(
          config.table_prefix + "master_mcc_category mcc_cat",
          "mcc.category=mcc_cat.id",
          "left"
        )
        .where({ "mk.qr_id": paymentlink_id, "mk.status": 0 })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectMerchantIdByQrCode: async (payment_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mk.sub_merchant_id  as merchant_id")
        .from(config.table_prefix + "merchant_qr_codes mk")
        .where({ "mk.qr_id": payment_id })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_count: async (condition_obj, table_name) => {
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + db_table + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  selectSummary: async (limit, filter, customer_name, date_condition) => {
    let query = "";
    let final_cond = "  ";
    if (Object.keys(filter).length) {
      let condition = await helpers.get_and_conditional_string(filter);
      final_cond = final_cond + " AND " + condition;
    }
    if (customer_name != "") {
      final_cond += ' AND customer_name LIKE "%' + customer_name + '%"';
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }
    if (limit.perpage > 0) {
      query =
        "SELECT card_id,customer_name,card_no,count(id) as attempts,created_at as last_attempt, SUM(CASE WHEN t.status IN ('CAPTURED') THEN 1 ELSE 0 END) AS successfull, SUM(CASE WHEN t.status IN ('FAILED') THEN 1 ELSE 0 END) AS failed FROM " +
        config.table_prefix +
        "orders t WHERE card_id <> '' AND t.status IN ('FAILED','CAPTURED','CANCELLED') " +
        final_cond +
        " GROUP BY card_id ORDER BY id desc LIMIT " +
        limit.page +
        ", " +
        limit.perpage;
    } else {
      query =
        "SELECT card_id,customer_name,card_no,count(id) as attempts,created_at as last_attempt, SUM(CASE WHEN t.status IN ('CAPTURED') THEN 1 ELSE 0 END) AS successfull, SUM(CASE WHEN t.status IN ('FAILED') THEN 1 ELSE 0 END) AS failed FROM " +
        config.table_prefix +
        "orders t WHERE card_id <> '' AND t.status IN ('FAILED','CAPTURED','CANCELLED') " +
        final_cond +
        " GROUP BY card_id ORDER BY id desc";
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectTokenSummary: async (limit, filter, customer_name, date_condition) => {
    let query = "";
    let final_cond = "  ";
    if (Object.keys(filter).length) {
      let condition = await helpers.get_and_conditional_string(filter);
      final_cond = final_cond + " AND " + condition;
    }
    if (customer_name != "") {
      final_cond += ' AND customer_name LIKE "%' + customer_name + '%"';
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }
    if (limit.perpage > 0) {
      query =
        "SELECT id,browser_token,cid,recent_used FROM " +
        config.table_prefix +
        "customers_cards t WHERE deleted = 0  GROUP BY browser_token ORDER BY id desc LIMIT " +
        limit.page +
        ", " +
        limit.perpage;
    } else {
      query =
        "SELECT id,browser_token,cid,recent_used FROM " +
        config.table_prefix +
        "customers_cards t WHERE deleted = 0  GROUP BY browser_token ORDER BY id desc";
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  summaryCount: async (filter, customer_name, date_condition) => {
    let final_cond = " ";
    if (Object.keys(filter).length) {
      let condition = await helpers.get_and_conditional_string(filter);
      final_cond = final_cond + " AND " + condition;
    }
    if (customer_name != "") {
      final_cond += ' AND customer_name LIKE "%' + customer_name + '%"';
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    // let query = "SELECT count(id) as total FROM " + config.table_prefix + "orders t WHERE card_id <> '' AND status IN ('CAPTURED','FAILED','CANCELLED') " + final_cond + " GROUP BY card_id";

    // query2 =
    //     "SELECT card_id, customer_name, card_no, count(id) as attempts, created_at as last_attempt, SUM(CASE WHEN t.status IN ('CAPTURED') THEN 1 ELSE 0 END) AS successful, SUM(CASE WHEN t.status IN ('FAILED') THEN 1 ELSE 0 END) AS failed FROM " +
    //     config.table_prefix +
    //     "orders WHERE card_id <> '' AND status IN ('FAILED','CAPTURED','CANCELLED')" +
    //     final_cond +
    //     " GROUP BY card_id) AS subquery;";

    query2 = `SELECT COUNT(*) AS total_entries
                    FROM (
                        SELECT card_id, customer_name, card_no, count(id) as attempts, created_at as last_attempt,
                            SUM(CASE WHEN pg_orders.status IN ('CAPTURED') THEN 1 ELSE 0 END) AS successful,
                            SUM(CASE WHEN pg_orders.status IN ('FAILED') THEN 1 ELSE 0 END) AS failed
                        FROM pg_orders
                        WHERE card_id <> '' AND status IN ('FAILED', 'CAPTURED', 'CANCELLED')
                            ${final_cond}
                        GROUP BY card_id
                    ) AS subquery;`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0]?.total_entries;
  },
  tokenSummaryCount: async (filter, customer_name, date_condition) => {
    let final_cond = " ";
    if (Object.keys(filter).length) {
      let condition = await helpers.get_and_conditional_string(filter);
      final_cond = final_cond + " AND " + condition;
    }
    if (customer_name != "") {
      final_cond += ' AND customer_name LIKE "%' + customer_name + '%"';
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    // let query = "SELECT count(id) as total FROM " + config.table_prefix + "orders t WHERE card_id <> '' AND status IN ('CAPTURED','FAILED','CANCELLED') " + final_cond + " GROUP BY card_id";

    // query2 =
    //     "SELECT card_id, customer_name, card_no, count(id) as attempts, created_at as last_attempt, SUM(CASE WHEN t.status IN ('CAPTURED') THEN 1 ELSE 0 END) AS successful, SUM(CASE WHEN t.status IN ('FAILED') THEN 1 ELSE 0 END) AS failed FROM " +
    //     config.table_prefix +
    //     "orders WHERE card_id <> '' AND status IN ('FAILED','CAPTURED','CANCELLED')" +
    //     final_cond +
    //     " GROUP BY card_id) AS subquery;";

    query2 = `SELECT COUNT(*) AS total_entries
                    from ${
                      config.table_prefix + "customers_cards"
                    } GROUP BY browser_token;`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0]?.total_entries;
  },
  subscription_count: async (condition_obj, table_name) => {
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(db_table)
        .where(condition_obj)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response) {
      return response.length;
    } else {
      return 0;
    }
  },
  selectOneLatest: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .limit(1)
        .order_by("id", "desc")
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  order_query: async (query) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  genratetxn: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query("SELECT MAX(id) as max_id FROM pg_order_txn");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    let str = 0;
    if (response?.[0].max_id) {
      str = 100001000 + parseInt(response?.[0].max_id) + 1;
    } else {
      str = 100000001;
    }
    return str;
  },
  selectMIDNI: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + "mid mid")
        .join(config.table_prefix + "psp psp", "mid.psp_id=psp.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response.length > 0 ? response : false;
  },
  selectMinMaxTxnAmount: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let dcc_enabled = await helpers.fetchDccStatus();
      
      if(dcc_enabled){
      let queryStr = `SELECT MIN(minTxnAmount) AS minTxnAmount, MAX(maxTxnAmount) AS maxTxnAmount FROM pg_mid mid WHERE submerchant_id = ${condition.submerchant_id} AND(currency_id = ${condition.currency_id} OR FIND_IN_SET('${condition.currency}',supported_currency)>0) AND deleted = 0`;
      console.log(queryStr);
      response = await qb.query(queryStr);
      }else{
        response = await qb.select_min("minTxnAmount")
        .select_max("maxTxnAmount")
        .from(config.table_prefix + "mid mid")
        .where(condition)
        .get();
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.length > 0 ? response?.[0] : false;
  },
  selectApplePayPSP: async (merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("p.credentials_key")
        .from(config.table_prefix + "mid m")
        .join(config.table_prefix + "psp p", "m.psp_id=p.id", "inner")
        .like("m.payment_methods", "Apple Pay")
        .where({
          "m.submerchant_id": merchant_id,
          "m.deleted": 0,
          "m.status": 0,
        })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.length > 0 ? response?.[0].credentials_key : "NA";
  },

  selectDynamicONEMID: async (query) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    //console.log(qb.last_query());
    return response?.[0];
  },
  selectOneWithJoin:async(selection,condition,first_table,second_table,join_on)=>{
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).from(config.table_prefix+first_table).join(config.table_prefix+second_table,join_on,'INNER').where(condition).get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    console.log(qb.last_query());
    return response?.[0];
  },
  selectFirstSuccessfullRecurringTranasaction: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select('payment_id as card_token')
        .where(condition)
        .from(config.table_prefix + 'subscription_recurring')
        .order_by('id','asc')
        .limit(1)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
 checkOrderExits:async(condition)=> {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("id")
      .from(`${config.table_prefix}transaction_charges`)
      .where(condition)
      .get();
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }

  return response?.[0]?.id || 0;
}
};
module.exports = merchantOrderModel;
