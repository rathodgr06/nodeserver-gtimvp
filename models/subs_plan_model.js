const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "subs_plans";
const mailtable = config.table_prefix + "subs_plan_mail";
const paytable = config.table_prefix + "subs_payment";
const subscriptiontable = config.table_prefix + "subscription";
const merchant_table = config.table_prefix + "master_merchant_details";
const merchant_deta = config.table_prefix + "master_merchant";
const logs_table = config.table_prefix + "subs_plans_logs";
const setuptable = config.table_prefix + "subscription_setup";
const termstable = config.table_prefix + "plan_terms";
const customers = config.table_prefix + "customers";
const subscription_recurring_table =
  config.table_prefix + "subscription_recurring";
const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_logs: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(logs_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_setup: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(setuptable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_terms: async (data) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.insert(termstable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  remove_terms: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(termstable, { plan_id: id });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectSome: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select_terms: async (condition, limit = "") => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("*");
      qb.where(condition);
      if (limit != "") {
        qb.limit(limit);
      }
      response = await qb.get(termstable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (
    and_condition,
    date_condition,
    limit,
    like_condition,
    expiry_date
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = "";
      if (date_condition.from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.from_date,
          date_condition.to_date,
          "created_at"
        );
      }
      if (date_condition.modified_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.modified_from_date,
          date_condition.modified_to_date,
          "updated_at"
        );
      }
      if (date_condition.subscribe_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.subscribe_from_date,
          date_condition.subscribe_to_date,
          "last_subscribe_date"
        );
      }
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select * from " + dbtable + final_cond;

    if (like_condition.plan) {
      query +=
        " AND ( plan_name LIKE '%" +
        like_condition.plan +
        "%' or plan_id LIKE '%" +
        like_condition.plan +
        "%' ) ";
    }
    if (expiry_date != "") {
      query += expiry_date;
    }
    if (limit.perpage) {
      query += " order BY id DESC limit " + limit.start + "," + limit.perpage;
    } else {
      query += " order BY id DESC ";
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
  select_: async (condition, limit, search) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage > 0) {
      qb.select("*");
      qb.where(condition).order_by("id", "desc");
      if (search != "") {
        qb.like({ plan_name: search }, null, "before", "after");
        qb.or_like({ plan_billing_frequency: search }, null, "before", "after");
        qb.or_like({ plan_currency: search }, null, "before", "after");
      }
      qb.limit(limit.perpage, limit.start);
      try {
        response = await qb.get(dbtable);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
      return response;
    } else {
      qb.select("*");
      qb.where(condition).order_by("id", "desc");
      if (search != "") {
        qb.like({ plan_name: search }, null, "before", "after");
        qb.or_like({ plan_billing_frequency: search }, null, "before", "after");
        qb.or_like({ plan_currency: search }, null, "before", "after");
      }
      try {
        response = await qb.get(dbtable);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
      return response;
    }
  },
  selectSpecific: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectMail: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(mailtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectUserDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  updateSetup: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(setuptable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (
    and_condition,
    date_condition,
    like_condition,
    expiry_date
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = "";
      if (date_condition.from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.from_date,
          date_condition.to_date,
          "created_at"
        );
      }
      if (date_condition.modified_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.modified_from_date,
          date_condition.modified_to_date,
          "updated_at"
        );
      }
      if (date_condition.subscribe_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.subscribe_from_date,
          date_condition.subscribe_to_date,
          "last_subscribe_date"
        );
      }
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select count(id) as total from " + dbtable + final_cond;
    if (expiry_date != "") {
      query += expiry_date;
    }
    if (like_condition.plan) {
      query +=
        " AND ( plan_name LIKE '%" +
        like_condition.plan +
        "%' or plan_id LIKE '%" +
        like_condition.plan +
        "%' ) ";
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
    return response?.[0].total;
  },
  get_count_terms: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + termstable + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count_pay: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);

      response = await qb.query(
        "select count('id') as count from " +
          subscriptiontable +
          " where " +
          condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count_all_conditions: async (
    condition_obj,
    like_condition,
    date_condition
  ) => {
    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "added_date"
      );
      if (date_condition.payment_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.payment_from_date,
          date_condition.payment_to_date,
          "last_payment_date"
        );
      }
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count('id') as count from " +
      subscriptiontable +
      final_cond +
      "  AND (email LIKE '%" +
      like_condition.email +
      "%' or mobile_no LIKE '%" +
      like_condition.email +
      "%') AND plan_name LIKE '%" +
      like_condition.plan_name +
      "%'" +
      " order BY ID DESC";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_count_subscribers: async (
    condition_obj,
    like_condition,
    date_condition,
    join_condition
  ) => {
    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count('s.id') as count from " +
      subscriptiontable +
      " as s" +
      final_cond +
      join_condition;
    if (like_condition.email) {
      query +=
        " AND (s.email LIKE '%" +
        like_condition.email +
        "%' or s.mobile_no LIKE '%" +
        like_condition.email +
        "%')";
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

    return response?.[0].count;
  },
  getMerchantName: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_id,company_name")
        .from(merchant_table)
        .get(data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.merchant_id] = element.company_name;
    });
    return result;
  },
  getMerchantlogo: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("icon")
        .from(merchant_deta)
        .limit(1)
        .where(data)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].icon;
  },
  addMail: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(mailtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  selectOneMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "id,theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language"
        )
        .where(condition)
        .get(merchant_deta);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  get_company_name: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_id,company_name")
        .from(merchant_table)
        .get(data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.merchant_id] = element.company_name;
    });
    return result;
  },

  select_pay: async (and_condition, date_condition, limit, like_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );
      if (date_condition.payment_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.payment_from_date,
          date_condition.payment_to_date,
          "s.last_payment_date"
        );
      }

      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select s.* from " +
      subscriptiontable +
      " as s inner join " +
      paytable +
      " as sp on s.subscription_id=sp.subscription_id " +
      final_cond;
    if (like_condition.email) {
      query +=
        " AND (s.email LIKE '%" +
        like_condition.email +
        "%' or s.mobile_no LIKE '%" +
        like_condition.email +
        "%')";
    }

    if (like_condition.plan_name) {
      query += " AND s.plan_name LIKE '%" + like_condition.email + "%'";
    }

    query +=
      " group by s.id order BY s.id DESC limit " +
      limit.start +
      "," +
      limit.perpage;

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
  select_subscribers_list: async (
    and_condition,
    date_condition,
    limit,
    like_condition
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sp.added_date"
      );
      if (date_condition.payment_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.payment_from_date,
          date_condition.payment_to_date,
          "s.last_payment_date"
        );
      }

      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select s.id, s.email,s.mode,sp.mobile_no,sp.dial_code,s.status,s.super_merchant,s.added_date,s.name,sp.id,s.id as subscriber_id,s.plan_id from " +
      customers +
      " as sp inner join " +
      subscriptiontable +
      " as s on s.email=sp.email " +
      final_cond;
    if (like_condition.email) {
      query +=
        " AND (s.email LIKE '%" +
        like_condition.email +
        "%' or sp.mobile_no LIKE '%" +
        like_condition.email +
        "%')";
    }
    query +=
      " group by s.email order BY s.id asc limit " +
      limit.start +
      "," +
      limit.perpage;

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
  select_subscribers_list_count: async (
    and_condition,
    date_condition,
    limit,
    like_condition
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sp.added_date"
      );
      if (date_condition.payment_from_date) {
        date_condition_str = await helpers.get_date_between_condition(
          date_condition.payment_from_date,
          date_condition.payment_to_date,
          "s.last_payment_date"
        );
      }

      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "";
    // "select count(sp.id) as count from " + customers + " as sp inner join " + subscriptiontable + " as s on s.email=sp.email " + final_cond;
    let like_condition1 = "";
    if (like_condition.email) {
      like_condition1 =
        " AND (s.email LIKE '%" +
        like_condition.email +
        "%' or sp.mobile_no LIKE '%" +
        like_condition.email +
        "%')";
    }

    query = `
            SELECT
                count(total_records) as count
            FROM
                (SELECT
                    COUNT(*) AS total_records
                FROM
                    ${customers} AS sp
                INNER JOIN
                    ${subscriptiontable} AS s ON s.email = sp.email
                ${final_cond}
                ${like_condition1}
                GROUP BY
                    s.email) AS total
        `;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  selectSubscriberCust: async (and_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    let query =
      "select s.email,s.mode,sp.mobile_no,sp.dial_code,s.subscription_id,s.status,s.super_merchant,s.added_date,s.name,sp.id,s.id as subscriber_id from " +
      customers +
      " as sp inner join " +
      subscriptiontable +
      " as s on s.email=sp.email " +
      final_cond;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectSubscriber: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("added_date", "asc")
        .get(subscriptiontable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectSubsPay: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("added_date", "asc")
        .get(paytable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  updateDynamic: async (condition, data, table_name) => {
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

  get_needed_info: async (subs_id) => {
    let response;

    let query = `SELECT  s.subscription_id,sp.payment_status,o.card_no, o.scheme as card_nw,o.amount AS last_payment_amount, o.updated_at AS last_payment_date, COUNT(o.order_id) AS last_payment_term FROM  pg_subscription AS s INNER JOIN pg_subs_payment AS sp ON s.subscription_id = sp.subscription_id INNER JOIN pg_orders AS o ON sp.order_no = o.order_id WHERE s.subscription_id = '${subs_id}' and sp.payment_status="CAPTURED" GROUP BY s.subscription_id ORDER BY o.updated_at DESC LIMIT 1;`;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select_merchant_details: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mm.icon,mm.logo,mm.email,mm.code,mm.mobile_no,md.company_name")
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "INNER"
        )
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  add_order: async (data, mode) => {
    let db_table = "";
    if (mode == "test") {
      db_table = config.table_prefix + "test_orders";
    } else {
      db_table = config.table_prefix + "orders";
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  addDynamic: async (data, table_name) => {
    let db_table = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  selectData: async (paymentlink_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mk.id,mk.submerchant_id,mk.plan_name,mk.plan_currency,mk.plan_billing_amount,md.super_merchant_id,mcc.id as mcc_id,mcc_cat.id as mcc_cat_id"
        )
        .from(config.table_prefix + "subs_plans mk")
        .join(
          config.table_prefix + "master_merchant md",
          "mk.submerchant_id=md.id",
          "inner"
        )
        .join(
          config.table_prefix + "master_super_merchant mde",
          "mk.merchant_id=mde.id",
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
        .where({ "mk.ref_no": paymentlink_id, "mk.status": 0 })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectOneDynamic: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectExpiredCards: async (
    and_condition,
    limit,
    is_expired,
    search_terms,
    date_condition
  ) => {
    let condition = " ";
    let date_con = " ";
    let expire_con = " ";
    let search_con = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      search_con = " and " + `(${like_str})`;
    }

    if (is_expired == "yes") {
      expire_con = `and  STR_TO_DATE(CONCAT(SUBSTRING(card_expiry, 1, 2),'/01/',SUBSTRING(card_expiry, 4, 4)
            ),'%m/%d/%Y') < DATE_FORMAT(NOW(), '%Y-%m-01')`;
    } else {
      expire_con = `and CONCAT(
            SUBSTRING(card_expiry, 1, 2),
            '/',
            SUBSTRING(card_expiry, 4, 4)
        ) = DATE_FORMAT(NOW(), '%m/%Y') `;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );

      date_con = " and " + date_condition_str;
    }
    let response;
    if (limit.perpage > 0) {
      query =
        `
         SELECT
             sp.order_no,o.card_no,s.added_date,
             s.id as subs_id,psp.plan_currency,
             s.status,mmd.company_name,
             mm.email as merchant_email,
             o.card_id,
             o.customer_name,
             o.customer_email,
             o.cid,
             psp.plan_name,psp.plan_id,
             cc.card_expiry,sp.subscription_id
         FROM
             pg_subs_payment sp
         LEFT JOIN pg_master_merchant mm ON
             sp.merchant_id = mm.id
         LEFT JOIN pg_master_merchant_details mmd  ON
             sp.merchant_id = mmd.merchant_id
     
         LEFT JOIN pg_orders o ON
             sp.order_no = o.order_id
         LEFT JOIN pg_subs_plans psp ON
             sp.plan_id = psp.id
             LEFT JOIN pg_subscription s ON
             sp.subscription_id = s.subscription_id
             LEFT JOIN pg_customers_cards cc ON
             o.card_no = cc.last_4_digit
            where s.status=1 and cc.status = 0 and cc.deleted=0 ` +
        expire_con +
        condition +
        search_con +
        date_con +
        `  
            GROUP BY
            sp.plan_id,
            sp.subscription_id,
            cc.last_4_digit
         ORDER BY
             sp.id
         DESC limit 
     ` +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query =
        `
            SELECT
                sp.order_no,o.card_no,
                mmd.company_name,
                mm.email as merchant_email,
                o.card_id,
                o.customer_name,
                o.customer_email,
                o.cid,
                psp.plan_name,
                cc.card_expiry
            FROM
                pg_subs_payment sp
                LEFT JOIN pg_master_merchant mm ON
                sp.merchant_id = mm.id
            LEFT JOIN pg_master_merchant_details mmd  ON
                sp.merchant_id = mmd.merchant_id
        
            LEFT JOIN pg_orders o ON
                sp.order_no = o.order_id
            LEFT JOIN pg_subs_plans psp ON
                sp.plan_id = psp.id
                LEFT JOIN pg_subscription s ON
                sp.subscription_id = s.subscription_id
                LEFT JOIN pg_customers_cards cc ON
                o.card_no = cc.last_4_digit
                where s.status=1 and cc.status = 0 and cc.deleted=0 ` +
        expire_con +
        condition +
        search_con +
        date_con +
        `  
                GROUP BY
                sp.plan_id,
                sp.subscription_id,
                cc.last_4_digit
            ORDER BY
                sp.id
            DESC 
        `;
    }

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectExpiredCardsCount: async (
    and_condition,
    search_terms,
    date_condition,
    is_expired,
    subs_ids
  ) => {
    let condition = " ";
    let search_con = "";
    let expire_con = "";
    let date_con = "";
    if (is_expired == "yes") {
      expire_con = `and  STR_TO_DATE(CONCAT(SUBSTRING(card_expiry, 1, 2),'/01/',SUBSTRING(card_expiry, 4, 4)
                ),'%m/%d/%Y') < DATE_FORMAT(NOW(), '%Y-%m-01')`;
    } else {
      expire_con = `and CONCAT(
                SUBSTRING(card_expiry, 1, 2),
                '/',
                SUBSTRING(card_expiry, 4, 4)
            ) = DATE_FORMAT(NOW(), '%m/%Y') `;
    }
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      search_con = " and " + `(${like_str})`;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );

      date_con = " and " + date_condition_str;
    }
    let response;

    query =
      `
         SELECT
             count(sp.id) as count
         FROM
             pg_subs_payment sp
             LEFT JOIN pg_master_merchant mm ON
             sp.merchant_id = mm.id
         LEFT JOIN pg_master_merchant_details mmd  ON
             sp.merchant_id = mmd.merchant_id
     
         LEFT JOIN pg_orders o ON
             sp.order_no = o.order_id
         LEFT JOIN pg_subs_plans psp ON
             sp.plan_id = psp.id
             LEFT JOIN pg_subscription s ON
             sp.subscription_id = s.subscription_id
             LEFT JOIN pg_customers_cards cc ON
             o.card_no = cc.last_4_digit
             where s.status=1 and cc.status = 0 and cc.deleted=0 ` +
      expire_con +
      condition +
      search_con +
      date_con +
      subs_ids +
      `  
           
         ORDER BY
             sp.id
         DESC  
     `;

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0] ? response?.[0].count : 0;
  },
  select_logs: async (condition, limit, search) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage > 0) {
      try {
        qb.select("*");
        qb.where(condition).order_by("id", "desc");
        if (search != "") {
          qb.like({ plan_name: search }, null, "before", "after");
          qb.or_like(
            { plan_billing_frequency: search },
            null,
            "before",
            "after"
          );
          qb.or_like({ plan_currency: search }, null, "before", "after");
        }
        qb.limit(limit.perpage, limit.start);
        response = await qb.get(logs_table);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
      return response;
    } else {
      try {
        qb.select("*");
        qb.where(condition).order_by("id", "desc");
        if (search != "") {
          qb.like({ plan_name: search }, null, "before", "after");
          qb.or_like(
            { plan_billing_frequency: search },
            null,
            "before",
            "after"
          );
          qb.or_like({ plan_currency: search }, null, "before", "after");
        }
        response = await qb.get(logs_table);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
      return response;
    }
  },
  get_count_logs: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + logs_table + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  selectCardsDetails: async (and_condition, mode = "") => {
    let table = "pg_orders";
    if (mode == "test") {
      table = "pg_test_orders";
    }
    let condition = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = condition_ob;
    }
    query =
      `
            SELECT
            o.card_no,o.cardholderName as name_on_card,
            o.scheme as card_nw,
            o.card_id,
            o.customer_email as email,
            o.customer_name,
            o.cid,
            o.payment_mode,
            o.expiry as card_expiry
        FROM
            pg_subs_payment sp
        LEFT JOIN ` +
      table +
      ` o ON
            sp.order_no = o.order_id
            where  ` +
      condition;
    //+ ` order by o.id desc`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    // console.log(`query is here`);
    // console.log(query);
    return response?.[0] ? response?.[0] : "";
  },
  select_setup_one: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("added_date", "asc")
        .get(setuptable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectSubscriptionSetup: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage > 0) {
        qb.select("*");
        qb.where(condition).order_by("id", "desc");
        qb.limit(limit.perpage, limit.start);
        response = await qb.get(setuptable);
      } else {
        qb.select("*");
        qb.where(condition).order_by("id", "desc");

        response = await qb.get(setuptable);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  get_count_setup: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + setuptable + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  getCard: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = qb
        .select("*")
        .where(condition)
        .get(`${config.table_prefix}${table}`);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectOneSetup: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(setuptable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectDeclinedCards: async (
    and_condition,
    limit,
    search_terms,
    date_condition
  ) => {
    let condition = " ";
    let date_con = " ";
    let search_con = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      search_con = " and " + `(${like_str})`;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );

      date_con = " and " + date_condition_str;
    }
    let response;
    if (limit.perpage > 0) {
      query =
        `
         SELECT
             sp.order_no,cc.last_4_digit as card_no,s.added_date,
             s.id as subs_id,psp.plan_currency,cc.card_nw,
             s.status,mmd.company_name,
             mm.email as merchant_email,
             o.card_id,
             cc.name_on_card as customer_name,
             cc.email as customer_email,
             o.cid,
             psp.plan_name,psp.plan_id,
             cc.card_expiry,
             cc.remark,sp.subscription_id
         FROM
             pg_subs_payment sp
         LEFT JOIN pg_master_merchant mm ON
             sp.merchant_id = mm.id
         LEFT JOIN pg_master_merchant_details mmd  ON
             sp.merchant_id = mmd.merchant_id
     
         LEFT JOIN pg_orders o ON
             sp.order_no = o.order_id
         LEFT JOIN pg_subs_plans psp ON
             sp.plan_id = psp.id
             LEFT JOIN pg_subscription s ON
             sp.subscription_id = s.subscription_id
             LEFT JOIN pg_declined_cards cc ON
             sp.subscription_id = cc.subscription_id
            where s.status=1 and s.is_customer_subscribed=1 
            and cc.status = 0 
            and cc.deleted=0  
            and cc.is_subscription=1 ` +
        condition +
        search_con +
        date_con +
        `  
            GROUP BY
            cc.last_4_digit
         ORDER BY
             sp.id
         DESC limit 
     ` +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query =
        `
            SELECT
            sp.order_no,cc.last_4_digit as card_no,s.added_date,
            s.id as subs_id,cc.card_nw,
            s.status,mmd.company_name,
            mm.email as merchant_email,
            o.card_id,
            cc.name_on_card as customer_name,
            cc.email as customer_email,
            o.cid,
            psp.plan_name,psp.plan_id,
            cc.card_expiry,
            cc.remark,sp.subscription_id
            FROM
                pg_subs_payment sp
                LEFT JOIN pg_master_merchant mm ON
                sp.merchant_id = mm.id
            LEFT JOIN pg_master_merchant_details mmd  ON
                sp.merchant_id = mmd.merchant_id
            LEFT JOIN pg_orders o ON
                sp.order_no = o.order_id
            LEFT JOIN pg_subs_plans psp ON
                sp.plan_id = psp.id
                LEFT JOIN pg_subscription s ON
                sp.subscription_id = s.subscription_id
                LEFT JOIN pg_declined_cards cc ON
                sp.subscription_id = cc.subscription_id
                where s.status=1 
                and s.is_customer_subscribed=1 
                and cc.status = 0 
                and cc.deleted=0  
                and cc.is_subscription=1  ` +
        condition +
        search_con +
        date_con +
        `  
                GROUP BY
                cc.last_4_digit
            ORDER BY
                sp.id
            DESC 
        `;
    }

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDeclinedCardsCount: async (
    and_condition,
    search_terms,
    date_condition,
    subs_ids
  ) => {
    let condition = " ";
    let search_con = "";

    let date_con = "";

    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      search_con = " and " + `(${like_str})`;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "s.added_date"
      );

      date_con = " and " + date_condition_str;
    }
    let response;

    query =
      `
         SELECT
             count(DISTINCT sp.id) as count
         FROM
             pg_subs_payment sp
             LEFT JOIN pg_master_merchant mm ON
             sp.merchant_id = mm.id
         LEFT JOIN pg_master_merchant_details mmd  ON
             sp.merchant_id = mmd.merchant_id
     
         LEFT JOIN pg_orders o ON
             sp.order_no = o.order_id
         LEFT JOIN pg_subs_plans psp ON
             sp.plan_id = psp.id
             LEFT JOIN pg_subscription s ON
             sp.subscription_id = s.subscription_id
             LEFT JOIN pg_declined_cards cc ON
             sp.subscription_id = cc.subscription_id
             where s.status=1 and s.is_customer_subscribed=1 and cc.status = 0 and cc.deleted=0  and cc.is_subscription=1 and STR_TO_DATE(CONCAT(SUBSTRING(card_expiry, 1, 2),'/01/',SUBSTRING(card_expiry, 4, 4)
             ),'%m/%d/%Y') > DATE_FORMAT(NOW(), '%Y-%m-01')  ` +
      condition +
      search_con +
      date_con +
      subs_ids +
      `  
         ORDER BY
             sp.id
         DESC  
     `;

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0] ? response?.[0].count : 0;
  },
  checkForSubscriptionRecurring: async (subscription_id) => {
    let sql = `SELECT
                    COUNT(id) as unpaid_recurring
                FROM
                    ${subscription_recurring_table}
                WHERE subscription_id = ${subscription_id}
                AND ( is_paid = 0 or is_paid=2 )`;

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
  GetDeclinedCards: async (and_condition) => {
    let condition = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }

    let response;

    query =
      `
        SELECT
        sp.order_no,cc.last_4_digit as card_no,cc.card_nw,
        o.card_id,
        cc.name_on_card as customer_name,
        cc.email as customer_email,
        o.cid,
        cc.card_expiry,
        cc.remark,sp.subscription_id
        FROM
            pg_subs_payment sp
        LEFT JOIN pg_orders o ON
            sp.order_no = o.order_id
            LEFT JOIN pg_declined_cards cc ON
            sp.subscription_id = cc.subscription_id
            where  cc.status = 0 and cc.deleted=0  and cc.is_subscription=1 ` +
      condition +
      `  
            GROUP BY
            cc.last_4_digit
        ORDER BY
            sp.id
        DESC 
    `;

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  get_recurring_by_subscription_list: async (condition, limit = "") => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("*");
      qb.where(condition);
      if (limit != "") {
        qb.limit(limit);
      }
      response = await qb.get(subscription_recurring_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getDueAmount: async (subscription_id) => {
    let sql = `SELECT
                    sub1.amount,
                    sub2.failed_amount
                FROM
                    (
                    SELECT
                        subscription_id,
                        amount
                    FROM
                        ${config.table_prefix}subscription_recurring
                    WHERE
                        is_paid = 0 AND is_failed = 0 AND subscription_id = '${subscription_id}'
                    ORDER BY
                        id ASC
                    LIMIT 1
                ) AS sub1
                LEFT JOIN(
                    SELECT subscription_id,
                        SUM(amount) AS failed_amount
                    FROM
                        ${config.table_prefix}subscription_recurring
                    WHERE
                        is_paid = 0 AND is_failed = 1  AND subscription_id = '${subscription_id}'
                    GROUP by subscription_id    
                ) AS sub2
                ON
                    sub1.subscription_id = sub2.subscription_id`;

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
  },
  selectCustomerTransaction: async (selection, condition, table) => {
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
  select_txn_date: async (condition, order) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .order_by("id", order)
        .limit(1)
        .get(config.table_prefix + "orders");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY HH:mm:ss");
    } else {
      return "-";
    }
  },
  select_cust_data: async (select, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(select)
        .where(condition)
        .get(config.table_prefix + "orders");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    // response = await qb.query(query);

    if (response?.[0]) {
      return response?.[0];
    } else {
      return "-";
    }
  },
  select_open_txn_date: async (condition, order, mode) => {
    if (mode == "test") {
      table = "test_orders";
    } else {
      table = "orders";
    }
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .order_by("id", order)
        .limit(1)
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY HH:mm:ss");
    } else {
      return "-";
    }
  },
  selectOpenCustomerTransaction: async (selection, condition, mode) => {
    if (mode == "test") {
      table = "test_orders";
    } else {
      table = "orders";
    }
    let response;
    let qb = await pool.get_connection();
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
  count_plan_customers: async (
    filter,
    super_merchant_id,
    merchant_id,
    mode
  ) => {
    if (mode == "test") {
      table_name = "test_orders";
    } else {
      table_name = "orders";
    }

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select o.id from " +
          config.table_prefix +
          table_name +
          " o JOIN " +
          config.table_prefix +
          "customers c  ON o.customer_email=c.email " +
          " where o.super_merchant=" +
          super_merchant_id +
          " AND o.merchant_id=" +
          merchant_id +
          " AND c.email IN (" +
          filter +
          ")" +
          " group by c.id"
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return true;
    } else {
      return false;
    }
  },
};

module.exports = dbModel;
