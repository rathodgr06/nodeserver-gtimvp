const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "customers";
const logstable = config.table_prefix + "customer_logs";
const temtable = config.table_prefix + "customer_temp";
const otptable = config.table_prefix + "email_otp_sent";
const mobileotptable = config.table_prefix + "mobile_otp";
const securitytable = config.table_prefix + "customers_answer";
const transactiontable = config.table_prefix + "orders";
const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(otptable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addMobileOTP: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(mobileotptable, data);
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
  addLogs: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(logstable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_customer_tem: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(temtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_customer: async (data) => {
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
  select: async (limit, filter, user_type, id, table_name) => {
    let search_text = await helpers.get_conditional_like_string(filter);
    let response;
    let qb = await pool.get_connection();
    if (user_type == "admin") {
      if (limit.perpage) {
        try {
          if (Object.keys(filter).length) {
            response = await qb.query(
              "select * from " +
                dbtable +
                " where id!='' " +
                search_text +
                "  LIMIT " +
                limit.start +
                "," +
                limit.perpage +
                ""
            );
          } else {
            response = await qb.query(
              "select * from " +
                dbtable +
                " where id !='' LIMIT " +
                limit.start +
                "," +
                limit.perpage +
                ""
            );
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          if (Object.keys(filter).length) {
            response = await qb.query(
              "select * from " + dbtable + " where id!='' " + search_text + ""
            );
          } else {
            response = await qb.query(
              "select * from " + dbtable + " where id!=''"
            );
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    } else {
      if (limit.perpage) {
        try {
          if (Object.keys(filter).length) {
            response = await qb.query(
              "select c.* , o.billing_country  from " +
                config.table_prefix +
                table_name +
                " o INNER JOIN " +
                config.table_prefix +
                "customers c ON o.customer_email=c.email  " +
                " where o.super_merchant=" +
                id +
                " " +
                search_text +
                " group by c.id LIMIT " +
                limit.start +
                "," +
                limit.perpage +
                ""
            );
          } else {
            response = await qb.query(
              "select c.* , o.billing_country from " +
                config.table_prefix +
                table_name +
                " o INNER JOIN " +
                config.table_prefix +
                "customers c   ON o.customer_email=c.email  " +
                " where o.super_merchant=" +
                id +
                " group by c.id LIMIT " +
                limit.start +
                "," +
                limit.perpage +
                ""
            );
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          if (Object.keys(filter).length) {
            response = await qb.query(
              "select c.* , o.billing_country from " +
                config.table_prefix +
                table_name +
                " o JOIN " +
                config.table_prefix +
                "customers c  ON o.customer_email=c.email " +
                " where o.super_merchant=" +
                id +
                " AND " +
                search_text +
                " group by c.id"
            );
          } else {
            response = await qb.query(
              "select c.*, o.billing_country from " +
                config.table_prefix +
                table_name +
                " o JOIN " +
                config.table_prefix +
                "customers c ON o.customer_email=c.email " +
                " where o.super_merchant=" +
                id +
                " group by c.id"
            );
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    }
    return response;
  },
  selectTransaction: async (and_condition, date_condition, limit) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
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
      "select * from " +
      transactiontable +
      final_cond +
      " order BY ID DESC  limit " +
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
  // selectTransaction: async (selection,condition) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .select(selection)
  //         .where(condition)
  //         .get(transactiontable);
  //     qb.release();
  //     return response;
  // },
  selectAnswer: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(securitytable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  select1: async (condition_obj, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      try {
        if (filter.name != "") {
          response = await qb.query(
            "select * from " +
              dbtable +
              " where " +
              condition +
              " and (" +
              search_text +
              ") LIMIT " +
              limit.perpage +
              limit.start
          );
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("name", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        }
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    } else {
      try {
        if (filter.name != "") {
          response = await qb.query(
            "select * from " +
              dbtable +
              " where " +
              condition +
              " and (" +
              search_text +
              ")"
          );
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("name", "asc")
            .get(dbtable);
        }
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    }
    return response;
  },
  selectOtpDAta: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(otptable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectMobileOtpDAta: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(mobileotptable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectCustomerDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id")
        .get(temtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectActualCustomerDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id")
        .get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectCustomer: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    //
    return response?.[0];
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
  updateCustomerTempToken: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(temtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
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
  updateDynamic: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  get_count1: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
          dbtable +
          " where id!=" +
          condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count_logs: async (id, condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as count from " +
          logstable +
          " where id!=" +
          id +
          " and  " +
          condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  selectDynamic: async (selection, condition, table) => {
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
    //
    return response;
  },
  selectDynamicCard: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("primary_card", "desc")
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
          securitytable +
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
  add_token_check: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "password_token_check", data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  delete_token: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(
        config.table_prefix + "password_token_check",
        data
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_customer_count: async (condition_obj) => {
    let condition = await helpers.get_conditional_like_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      if (Object.keys(condition_obj).length) {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where id!='' " +
            condition +
            ""
        );
      } else {
        response = await qb.query(
          "select count('id')  as count from " + dbtable + " where id!=''"
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_merchant_customer_count: async (condition_obj, id, table_name) => {
    let condition = await helpers.get_conditional_like_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      if (Object.keys(condition_obj).length) {
        response = await qb.query(
          "select count('ord.id') as count from " +
            config.table_prefix +
            table_name +
            " ord INNER JOIN " +
            config.table_prefix +
            "customers c ON c.id=ord.cid  where ord.super_merchant= " +
            id +
            " " +
            condition +
            ""
        );
      } else {
        response = await qb.query(
          "select count('c.id') as count from " +
            config.table_prefix +
            table_name +
            " o JOIN " +
            config.table_prefix +
            "customers c ON o.customer_email=c.email  where o.super_merchant= " +
            id
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  selectCustomerTransaction: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + "orders");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamicTransaction: async (and_condition, date_condition, table) => {
    const table_name = config.table_prefix + table;

    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
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
      "select * from " + table_name + final_cond + " group BY mcc_category";

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
  get_dynamic_count: async (and_condition, date_condition, dbtable) => {
    dbtable = config.table_prefix + dbtable;

    let final_cond = " where status='CAPTURED' ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + "and " + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
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
      "select count('id') as count from " + dbtable + "  " + final_cond;

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
  get_volume_dynamic: async (and_condition, date_condition, dbtable) => {
    dbtable = config.table_prefix + dbtable;

    let final_cond = " where status='CAPTURED' ";

    if (Object.keys(and_condition).length) {
      final_cond =
        final_cond +
        " and " +
        (await helpers.get_and_conditional_string(and_condition));
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    let query =
      "select currency,SUM(amount) as total from " + dbtable + final_cond;

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
  select_txn_date: async (condition, order) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .order_by("id", order)
        .get(config.table_prefix + "orders");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    // response = await qb.query(query);
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
  get_customer_country: async (code, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select country_code from " +
          config.table_prefix +
          table_name +
          " where iso2 = '" +
          code +
          "' order by id asc limit 1"
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].country_code;
    } else {
      return "";
    }
  },
};
module.exports = dbModel;
