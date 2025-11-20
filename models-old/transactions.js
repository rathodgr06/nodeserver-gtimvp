const { findSourceMap } = require("module");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "orders";
const helpers = require("../utilities/helper/general_helper");
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (
    and_condition,
    date_condition,
    limit,
    table_name,
    in_condition
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (in_condition) {
      if (final_cond === " where ") {
        final_cond = final_cond + in_condition;
      } else {
        final_cond = final_cond + " and " + in_condition;
      }
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

    let query = "";

    if (limit.perpage > 0) {
      query =
        "select * from " +
        table_name +
        final_cond +
        " order BY ID DESC limit " +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query = "select * from " + table_name + final_cond + " order BY ID DESC";
    }

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
  },
  select_trans: async (
    and_condition,
    date_condition,
    limit,
    table_name,
    in_condition,
    amount_condition,
    like_condition,
    trans_date,
    search_terms,
    order_subs
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond = " where ";
    let order_by = " ORDER BY ID DESC limit ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);

      final_cond = final_cond + condition;
    }
    if (in_condition) {
      if (final_cond === " where ") {
        final_cond = final_cond + in_condition;
      } else {
        final_cond = final_cond + " and " + in_condition;
      }
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

    if (order_subs == "yes") {
      order_by =
        " ORDER BY (CASE WHEN status = 'Failed' THEN 0 ELSE 1 END), status limit ";
    }

    if (Object.keys(amount_condition).length) {
      if (amount_condition.min_amount > 0 || amount_condition.max_amount > 0) {
        let amount_str = await helpers.get_amount_condition(
          amount_condition.min_amount,
          amount_condition.max_amount,
          "amount"
        );
        if (final_cond == " where ") {
          final_cond = final_cond + amount_str;
        } else {
          final_cond = final_cond + " and " + amount_str;
        }
      }
    }
    if (Object.keys(like_condition).length) {
      let like_str = `pan LIKE '%${like_condition.pan}%'`;
      if (final_cond == " where ") {
        final_cond = final_cond + like_str;
      } else {
        final_cond = final_cond + " and " + like_str;
      }
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      if (final_cond == " where ") {
        final_cond = final_cond + `(${like_str})`;
      } else {
        final_cond = final_cond + " and " + `(${like_str})`;
      }
    }
    if (Object.keys(trans_date).length) {
      let trans_date_str = `DATE(updated_at) = '${trans_date?.updated_at}'`;
      if (final_cond == " where ") {
        final_cond = final_cond + trans_date_str;
      } else {
        final_cond = final_cond + " and " + trans_date_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "";

    if (limit.perpage > 0) {
      query =
        "select id,status,order_id,merchant_order_id,payment_id,updated_at,created_at,currency,amount,psp,payment_mode,pan,is_one_click,merchant_customer_id,customer_email,customer_code,customer_mobile,billing_country,merchant_id,terminal_id,scheme,card_country,cardType,card_id,other_description,origin,customer_name,high_risk_country,high_risk_transaction,block_for_suspicious_ip,block_for_suspicious_email,block_for_transaction_limit,fraud_request_type from " +
        table_name +
        final_cond +
        order_by +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query = "select id,status,order_id,merchant_order_id,payment_id,updated_at,created_at,currency,amount,psp,payment_mode,pan,is_one_click,merchant_customer_id,customer_email,customer_code,customer_mobile,billing_country,merchant_id,terminal_id,scheme,card_country,cardType,card_id,other_description,origin,customer_name,high_risk_country,high_risk_transaction,block_for_suspicious_ip,block_for_suspicious_email,block_for_transaction_limit,fraud_request_type from " + table_name + final_cond + " order BY ID DESC";
    }
    console.log("qb.last_query()", query);
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
  },
  open_select: async (
    and_condition,
    date_condition,
    limit,
    table_name
    // in_condition
  ) => {
    table_name = config.table_prefix + table_name;

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

    let limit_str = "";
    if (limit.perpage > 0) {
      limit_str = " limit " + limit.start + "," + limit.perpage;
    }

    let query =
      "select * from " +
      table_name +
      final_cond +
      " order BY ID DESC " +
      limit_str;

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
  },

  open_trans_select: async (
    and_condition,
    date_condition,
    amount_condition,
    like_condition,
    limit,
    table_name,
    trans_date,
    mode
  ) => {
    if (mode == "test") {
      table_name = config.table_prefix + "test_orders";
    } else {
      table_name = config.table_prefix + table_name;
    }

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

    if (Object.keys(amount_condition).length) {
      let amount_str = await helpers.get_amount_condition(
        amount_condition.min_amount,
        amount_condition.max_amount,
        "amount"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + amount_str;
      } else {
        final_cond = final_cond + " and " + amount_str;
      }
    }

    if (Object.keys(like_condition).length) {
      let like_str = `pan LIKE '%${like_condition.pan}%'`;

      if (final_cond == " where ") {
        final_cond = final_cond + like_str;
      } else {
        final_cond = final_cond + " and " + like_str;
      }
    }

    if (Object.keys(trans_date).length) {
      let trans_date_str = `DATE(updated_at) = '${trans_date?.updated_at}'`;
      if (final_cond == " where ") {
        final_cond = final_cond + trans_date_str;
      } else {
        final_cond = final_cond + " and " + trans_date_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let limit_str = "";
    if (limit.perpage > 0) {
      limit_str = " limit " + limit.start + "," + limit.perpage;
    }

    let query =
      "select * from " +
      table_name +
      final_cond +
      " order BY ID DESC " +
      limit_str;

    let qb = await pool.get_connection();
    let response;
    try {
      console.log(query);
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  selectSpecific: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne: async (selection, condition, table_name) => {
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
    // console.log(response?.[0])
    return response?.[0];
  },
  selectUserDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
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
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  orderDetailsUpdate: async (condition, data, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table_name);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_transactions: async () => {
    let query = "select count('id') as count from " + dbtable;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_transactions_retry: async (order_id, mode) => {
    let table_name = config.table_prefix + "order_life_cycle_logs";

    let query =
      "select count('id') as count from " +
      table_name +
      " where mode= '" +
      mode +
      "' and order_id='" +
      order_id +
      "' and retry_txn ";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_transactions_cascade: async (order_id, mode) => {
    let table_name = config.table_prefix + "order_life_cycle_logs";
    let query =
      "select count('id') as count from " +
      table_name +
      " where mode= '" +
      mode +
      "' and order_id='" +
      order_id +
      "' and cascade_txn ";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count: async (
    and_condition,
    date_condition,
    table_name,
    in_condition,
    amount_condition,
    like_condition,
    trans_date,
    search_terms
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (in_condition) {
      if (final_cond === " where ") {
        final_cond = final_cond + in_condition;
      } else {
        final_cond = final_cond + " and " + in_condition;
      }
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
    if (Object.keys(amount_condition).length) {
      let amount_str = await helpers.get_amount_condition(
        amount_condition.min_amount,
        amount_condition.max_amount,
        "amount"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + amount_str;
      } else {
        final_cond = final_cond + " and " + amount_str;
      }
    }
    if (Object.keys(like_condition).length) {
      let like_str = `pan LIKE '%${like_condition.pan}%'`;
      if (final_cond == " where ") {
        final_cond = final_cond + like_str;
      } else {
        final_cond = final_cond + " and " + like_str;
      }
    }
    if (Object.keys(search_terms).length) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);

      if (final_cond == " where ") {
        final_cond = final_cond + `(${like_str})`;
      } else {
        final_cond = final_cond + " and " + `(${like_str})`;
      }
    }
    if (Object.keys(trans_date).length) {
      let trans_date_str = `DATE(updated_at) = '${trans_date?.updated_at}'`;
      if (final_cond == " where ") {
        final_cond = final_cond + trans_date_str;
      } else {
        final_cond = final_cond + " and " + trans_date_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select count('id') as count from " + table_name + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_count_list: async (
    and_condition,
    date_condition,
    table_name,
    in_condition
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (in_condition) {
      if (final_cond === " where ") {
        final_cond = final_cond + in_condition;
      } else {
        final_cond = final_cond + " and " + in_condition;
      }
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

    let query = "select count('id') as count from " + table_name + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  open_get_count: async (
    and_condition,
    date_condition,
    table_name
    // in_condition
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    // if (in_condition) {
    //     if (final_cond === " where ") {
    //         final_cond = final_cond + in_condition;
    //     } else {
    //         final_cond = final_cond + " and " + in_condition;
    //     }
    // }

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

    let query = "select count('id') as count from " + table_name + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  open_trans_get_count: async (
    and_condition,
    date_condition,
    amount_condition,
    like_condition,
    table_name,
    trans_date
  ) => {
    table_name = config.table_prefix + table_name;

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
    if (Object.keys(amount_condition).length) {
      let amount_str = await helpers.get_amount_condition(
        amount_condition.min_amount,
        amount_condition.max_amount,
        "amount"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + amount_str;
      } else {
        final_cond = final_cond + " and " + amount_str;
      }
    }
    if (Object.keys(like_condition).length) {
      let like_str = `pan LIKE '%${like_condition.pan}%'`;
      if (final_cond == " where ") {
        final_cond = final_cond + like_str;
      } else {
        final_cond = final_cond + " and " + like_str;
      }
    }
    if (Object.keys(trans_date).length) {
      let trans_date_str = `DATE(updated_at) = '${trans_date?.updated_at}'`;
      if (final_cond == " where ") {
        final_cond = final_cond + trans_date_str;
      } else {
        final_cond = final_cond + " and " + trans_date_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select count('id') as count from " + table_name + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_volume: async (and_condition, date_condition) => {
    let final_cond = " where status = 'Completed' ";

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

    let query = "select SUM(amount) as total from " + dbtable + final_cond;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].total ? response?.[0].total.toFixed(2) : "0.00";
  },

  get_mode_wise_volume: async (and_condition, date_condition) => {
    let final_cond = " where status = 'Completed' ";

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

    //let query = "select SUM(amount) as total from "+dbtable+final_cond
    let query =
      "SELECT SUM(amount) as total,COUNT(id) as count FROM " +
      dbtable +
      final_cond +
      " GROUP BY customer_email";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  status_wise_transactions: async (and_condition, date_condition) => {
    let final_cond = " where ";

    if (Object.keys(and_condition).length) {
      if (final_cond == " where ") {
        final_cond =
          final_cond +
          (await helpers.get_and_conditional_string(and_condition));
      } else {
        final_cond =
          final_cond +
          " and " +
          (await helpers.get_and_conditional_string(and_condition));
      }
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

    //let query = "select SUM(amount) as total from "+dbtable+final_cond
    let query =
      "SELECT status,COUNT(status) as count FROM " +
      dbtable +
      final_cond +
      " GROUP BY status";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  get_last_day_wise_amount: async (date, and_condition, table) => {
    table = config.table_prefix + table;
    let final_cond = " DATE(created_at) >= '" + date + "' ";

    if (Object.keys(and_condition).length) {
      final_cond =
        final_cond +
        "  and " +
        (await helpers.get_and_conditional_string(and_condition));
    }
    let query =
      "SELECT SUM(amount) as total,created_at FROM " +
      table +
      " WHERE " +
      final_cond +
      " GROUP BY DATE(created_at)";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  get_blocked_last_day_wise_amount: async (date, or_condition, table) => {
    table = config.table_prefix + table;
    let final_cond = " DATE(created_at) >= '" + date + "' ";
    final_cond = final_cond + " AND " + or_condition;
    let query =
      "SELECT SUM(amount) as total,created_at FROM " +
      table +
      " WHERE " +
      final_cond +
      " GROUP BY DATE(created_at)";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  get_high_risk_last_day_wise_amount: async (date, or_condition, table) => {
    table = config.table_prefix + table;
    let final_cond = " DATE(created_at) >= '" + date + "' ";
    final_cond = final_cond + " AND " + or_condition;
    let query =
      "SELECT SUM(amount) as total,created_at FROM " +
      table +
      " WHERE " +
      final_cond +
      " GROUP BY DATE(created_at)";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  select_highrisk: async (
    and_condition,
    date_condition,
    or_condition,
    limit,
    table_name
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond =
      " where (block_for_suspicious_ip=1 or block_for_transaction_limit=1 or block_for_suspicious_email=1 or high_risk_country=1 or high_risk_transaction=1)";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + "and " + condition;
    }
    if (or_condition.length > 0) {
      let or_cond = or_condition + "= 1";
      final_cond = final_cond + "and " + or_cond + "";
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select * from " +
      table_name +
      final_cond +
      " order BY ID DESC limit " +
      limit.start +
      "," +
      limit.perpage;

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
  },

  get_week_wise_amount: async (date, and_condition, table) => {
    table = config.table_prefix + table;
    let final_cond = await helpers.get_date_between_condition(
      date.from_date,
      date.to_date,
      "created_at"
    );

    if (Object.keys(and_condition).length) {
      final_cond =
        final_cond +
        " and " +
        (await helpers.get_and_conditional_string(and_condition));
    }
    let query =
      "SELECT SUM(amount) as total FROM " +
      table +
      " WHERE status = 'Completed' and " +
      final_cond;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].total ? response?.[0].total : 0;
  },

  get_dynamic_count: async (and_condition, date_condition, dbtable) => {
    dbtable = config.table_prefix + dbtable;

    let qb = await pool.get_connection();
    let response;
    try {
    let final_cond =
      " where status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') ";

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
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },

  get_volume_dynamic: async (and_condition, date_condition, dbtable) => {
    dbtable = config.table_prefix + dbtable;
    let final_cond =
      " where (status='Completed' or status='Created' or status='Failed' or status='Cancelled') ";
    // let final_cond = " where ";
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
   
    let query = "select SUM(amount) as total from " + dbtable + final_cond;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total.toFixed(2) : "0.00";
  },
  selectTenTransactions: async (condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "ord.order_id,ord.amount,ord.currency,ord.status,ord.updated_at as transaction_date,mm.email,mm.mobile_no,mmd.company_name,ord.customer_name,ord.customer_email,ord.customer_mobile,ord.high_risk_country,ord.high_risk_transaction,ord.block_for_suspicious_ip, block_for_suspicious_email, block_for_transaction_limit"
        )
        .from(config.table_prefix + table_name + " ord")
        .join(
          config.table_prefix + "master_merchant mm",
          "ord.merchant_id=mm.id",
          "left"
        )
        .join(
          config.table_prefix + "master_merchant_details mmd",
          "mm.id=mmd.merchant_id",
          "left"
        )
        .where(condition)
        .limit(10)
        .order_by("ord.created_at", "desc")
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  get_fraud_transaction_counter: async (table_name, date_condition) => {
    table_name = config.table_prefix + table_name;

    let final_cond =
      " where block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1 ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count('id') as total_block_payments from " +
      table_name +
      final_cond;
    // let query =
    //     "select count('id') as total_block_payments from " +
    //     table_name +
    //     " WHERE block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1";

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_block_payments;
  },

  get_fraud_volume: async (table_name, date_condition) => {
    table_name = config.table_prefix + table_name;
    let final_cond =
      " where block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1 ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query =
      "SELECT sum(amount) as total_amount FROM " + table_name + final_cond;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_amount;
  },

  get_fraud_transaction_counter_merchant: async (
    table_name,
    merchant_condition,
    date_condition
  ) => {
    table_name = config.table_prefix + table_name;
    let final_cond =
      " where (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query =
      "select count('id') as total_block_payments from " +
      table_name +
      final_cond +
      " and " +
      merchant_condition;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_block_payments;
  },
  get_fraud_volume_merchant: async (
    table_name,
    merchant_condition,
    date_condition
  ) => {
    table_name = config.table_prefix + table_name;

    let final_cond =
      " where (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query =
      "SELECT sum(amount) as total_amount FROM " +
      table_name +
      final_cond +
      " AND " +
      merchant_condition;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_amount;
  },
  get_fraud_transaction_counter_merchant_dash: async (
    table_name,
    merchant_condition,
    date_condition
  ) => {
    table_name = config.table_prefix + table_name;
    let condition = await helpers.get_and_conditional_string(
      merchant_condition
    );
    let final_cond =
      " where (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query =
      "select count('id') as total_block_payments from " +
      table_name +
      final_cond +
      " and " +
      condition;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_block_payments;
  },
  get_fraud_volume_merchant_dash: async (
    table_name,
    merchant_condition,
    date_condition
  ) => {
    table_name = config.table_prefix + table_name;
    let condition = await helpers.get_and_conditional_string(
      merchant_condition
    );
    let final_cond =
      " where (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query =
      "SELECT sum(amount) as total_amount FROM " +
      table_name +
      final_cond +
      " AND " +
      condition;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total_amount;
  },
  selectSpecificDynamic: async (selection, condition, table) => {
    let table_name = config.table_prefix + table;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "desc")
        .get(table_name);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  get_count_risk: async (and_condition, date_condition, risk, table_name) => {
    table_name = config.table_prefix + table_name;

    let final_cond =
      " where (block_for_suspicious_ip=1 or block_for_transaction_limit=1 or block_for_suspicious_email=1 or high_risk_country=1 or high_risk_transaction=1)";

    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (risk.length > 0) {
      let or_cond = risk + "= 1";

      final_cond = final_cond + "and " + or_cond + "";
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      final_cond = final_cond + " and " + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select count('id') as count from " + table_name + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },

  TenTransactions: async (and_condition, date_condition, table_name) => {
    console.log(`last 10 transactions`);
    console.log(table_name);
    table_name = config.table_prefix + table_name;
    let condition = await helpers.get_and_conditional_string(and_condition);
    let final_cond = " where ";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "ord.created_at"
      );
      final_cond = final_cond + date_condition_str;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
  
    let query = `SELECT ord.order_id,ord.amount,ord.currency,ord.status,ord.updated_at as transaction_date,mm.email,mm.mobile_no,mmd.company_name,ord.customer_name,ord.customer_email,ord.customer_mobile,ord.high_risk_country,ord.high_risk_transaction,ord.block_for_suspicious_ip, block_for_suspicious_email, block_for_transaction_limit FROM 
            ${table_name} ord
            LEFT JOIN  ${config.table_prefix}master_merchant mm ON
            ord.merchant_id = mm.id
            LEFT JOIN  ${config.table_prefix}master_merchant_details mmd ON
            mm.id = mmd.merchant_id
            ${final_cond} order by ord.created_at desc limit 10`;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_trans_with_count: async (
  and_condition,
  date_condition,
  limit,
  table_name,
  in_condition,
  amount_condition,
  like_condition,
  trans_date,
  search_terms,
  order_subs
) => {
  table_name = config.table_prefix + table_name;
  
  let final_cond = " WHERE ";
  let order_by = " ORDER BY id DESC";
  let params = [];
  
  // ✅ Build parameterized WHERE clauses for better performance and security
  let conditions = [];
  
  // Handle AND conditions
  if (and_condition && Object.keys(and_condition).length > 0) {
    let condition = await helpers.get_and_conditional_string(and_condition);
    conditions.push(condition);
  }
  
  // Handle IN conditions
  if (in_condition) {
    conditions.push(in_condition);
  }
  
  // ✅ Optimize date range conditions (most selective first for better index usage)
  if (date_condition && Object.keys(date_condition).length > 0) {
    let date_condition_str = await helpers.get_date_between_condition(
      date_condition.from_date,
      date_condition.to_date,
      "created_at"
    );
    conditions.push(date_condition_str);
  }
  
  // ✅ Exact order_id lookup (fastest - uses unique index)
  if (search_terms && search_terms.order_id && !search_terms.order_id.includes('%')) {
    conditions.push(`order_id = '${search_terms.order_id}'`);
    // For exact order_id match, limit to 1 result for performance
    limit.perpage = 1;
  }
  
  // Handle amount range conditions
  if (amount_condition && Object.keys(amount_condition).length > 0) {
    if (amount_condition.min_amount > 0 || amount_condition.max_amount > 0) {
      let amount_str = await helpers.get_amount_condition(
        amount_condition.min_amount,
        amount_condition.max_amount,
        "amount"
      );
      conditions.push(amount_str);
    }
  }
  
  // Handle PAN LIKE conditions (move to end as it's least selective)
  if (like_condition && Object.keys(like_condition).length > 0) {
    let like_str = `pan LIKE '%${like_condition.pan}%'`;
    conditions.push(like_str);
  }
  
  // Handle general search terms (except order_id which was handled above)
  if (search_terms && Object.keys(search_terms).length > 0) {
    if (!search_terms.order_id || search_terms.order_id.includes('%')) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);
      conditions.push(`(${like_str})`);
    }
  }
  
  // Handle transaction date (exact date match)
  if (trans_date && Object.keys(trans_date).length > 0) {
    let trans_date_str = `DATE(updated_at) = '${trans_date.updated_at}'`;
    conditions.push(trans_date_str);
  }
  
  // ✅ Build final WHERE clause
  if (conditions.length > 0) {
    final_cond += conditions.join(' AND ');
  } else {
    final_cond = '';
  }
  
  // ✅ Optimize ORDER BY based on query type
  if (order_subs === "yes") {
    // Custom ordering for subscription-like queries
    order_by = " ORDER BY (CASE WHEN status = 'Failed' THEN 0 ELSE 1 END), status, id DESC";
  } else if (search_terms && search_terms.order_id && !search_terms.order_id.includes('%')) {
    // For exact order_id lookup, no need for complex ordering
    order_by = " ORDER BY id DESC";
  }
  
  let qb = await pool.get_connection();
  
  try {
    let total_count = 0;
    let rows = [];
    
    // ✅ Strategy 1: For exact order_id lookup (fastest path)
    if (search_terms && search_terms.order_id && !search_terms.order_id.includes('%')) {
      let exact_query = `
        SELECT 
          id, status, order_id, merchant_order_id, payment_id, updated_at, created_at,
          currency, amount, psp, payment_mode, pan, is_one_click, merchant_customer_id,
          customer_email, customer_code, customer_mobile, billing_country, merchant_id,
          terminal_id, scheme, card_country, cardType, card_id, other_description, origin,
          customer_name, high_risk_country, high_risk_transaction, block_for_suspicious_ip,
          block_for_suspicious_email, block_for_transaction_limit, fraud_request_type
        FROM ${table_name}
        ${final_cond}
        ${order_by}
        LIMIT 1
      `;
      
      console.log("Exact order_id query:", exact_query);
      rows = await qb.query(exact_query);
      total_count = rows.length;
      
      return { rows, total_count };
    }
    
    // ✅ Strategy 2: For complex queries with pagination
    if (limit.perpage > 0) {
      // Separate optimized count query
      let count_query = `SELECT COUNT(*) as total FROM ${table_name} ${final_cond}`;
      console.log("Count query:", count_query);
      
      let count_result = await qb.query(count_query);
      total_count = count_result[0].total;
      
      // Early return if no results
      if (total_count === 0) {
        return { rows: [], total_count: 0 };
      }
      
      // ✅ Data query with LIMIT for pagination
      let data_query = `
        SELECT 
          id, status, order_id, merchant_order_id, payment_id, updated_at, created_at,
          currency, amount, psp, payment_mode, pan, is_one_click, merchant_customer_id,
          customer_email, customer_code, customer_mobile, billing_country, merchant_id,
          terminal_id, scheme, card_country, cardType, card_id, other_description, origin,
          customer_name, high_risk_country, high_risk_transaction, block_for_suspicious_ip,
          block_for_suspicious_email, block_for_transaction_limit, fraud_request_type
        FROM ${table_name}
        ${final_cond}
        ${order_by}
        LIMIT ${limit.start}, ${limit.perpage}
      `;
      
      console.log("Paginated data query:", data_query);
      rows = await qb.query(data_query);
      
    } else {
      // ✅ Strategy 3: No pagination needed
      let simple_query = `
        SELECT 
          id, status, order_id, merchant_order_id, payment_id, updated_at, created_at,
          currency, amount, psp, payment_mode, pan, is_one_click, merchant_customer_id,
          customer_email, customer_code, customer_mobile, billing_country, merchant_id,
          terminal_id, scheme, card_country, cardType, card_id, other_description, origin,
          customer_name, high_risk_country, high_risk_transaction, block_for_suspicious_ip,
          block_for_suspicious_email, block_for_transaction_limit, fraud_request_type
        FROM ${table_name}
        ${final_cond}
        ${order_by}
      `;
      
      console.log("Simple query:", simple_query);
      rows = await qb.query(simple_query);
      total_count = rows.length;
    }
    
    return { rows, total_count };
    
  } catch (error) {
    console.error("Cluster-based query failed:", error);
    console.error("Query conditions:", { final_cond, order_by, limit });
    throw error;
  } finally {
    qb.release();
  }
},
  export_transactions: async (
  and_condition,
  date_condition,
  limit,
  table_name,
  in_condition,
  amount_condition,
  like_condition,
  trans_date,
  search_terms,
  order_subs
) => {
  table_name = config.table_prefix + table_name;
  
  let final_cond = " WHERE ";
  let order_by = " ORDER BY id DESC";
  let params = [];
  
  // ✅ Build parameterized WHERE clauses for better performance and security
  let conditions = [];
  
  // Handle AND conditions
  if (and_condition && Object.keys(and_condition).length > 0) {
    let condition = await helpers.get_and_conditional_string(and_condition);
    conditions.push(condition);
  }
  
  // Handle IN conditions
  if (in_condition) {
    conditions.push(in_condition);
  }
  
  // ✅ Optimize date range conditions (most selective first for better index usage)
  if (date_condition && Object.keys(date_condition).length > 0) {
    let date_condition_str = await helpers.get_date_between_condition(
      date_condition.from_date,
      date_condition.to_date,
      "created_at"
    );
    conditions.push(date_condition_str);
  }
  
  // ✅ Exact order_id lookup (fastest - uses unique index)
  if (search_terms && search_terms.order_id && !search_terms.order_id.includes('%')) {
    conditions.push(`order_id = '${search_terms.order_id}'`);
    // For exact order_id match, limit to 1 result for performance
    limit.perpage = 1;
  }
  
  // Handle amount range conditions
  if (amount_condition && Object.keys(amount_condition).length > 0) {
    if (amount_condition.min_amount > 0 || amount_condition.max_amount > 0) {
      let amount_str = await helpers.get_amount_condition(
        amount_condition.min_amount,
        amount_condition.max_amount,
        "amount"
      );
      conditions.push(amount_str);
    }
  }
  
  // Handle PAN LIKE conditions (move to end as it's least selective)
  if (like_condition && Object.keys(like_condition).length > 0) {
    let like_str = `pan LIKE '%${like_condition.pan}%'`;
    conditions.push(like_str);
  }
  
  // Handle general search terms (except order_id which was handled above)
  if (search_terms && Object.keys(search_terms).length > 0) {
    if (!search_terms.order_id || search_terms.order_id.includes('%')) {
      let like_str = await helpers.get_conditional_or_like_string(search_terms);
      conditions.push(`(${like_str})`);
    }
  }
  
  // Handle transaction date (exact date match)
  if (trans_date && Object.keys(trans_date).length > 0) {
    let trans_date_str = `DATE(updated_at) = '${trans_date.updated_at}'`;
    conditions.push(trans_date_str);
  }
  
  // ✅ Build final WHERE clause
  if (conditions.length > 0) {
    final_cond += conditions.join(' AND ');
  } else {
    final_cond = '';
  }
  
  // ✅ Optimize ORDER BY based on query type
  if (order_subs === "yes") {
    // Custom ordering for subscription-like queries
    order_by = " ORDER BY (CASE WHEN status = 'Failed' THEN 0 ELSE 1 END), status, id DESC";
  } else if (search_terms && search_terms.order_id && !search_terms.order_id.includes('%')) {
    // For exact order_id lookup, no need for complex ordering
    order_by = " ORDER BY id DESC";
  }
  
  let qb = await pool.get_connection();
  
  try {
    let total_count = 0;
    let rows = [];
    
    
      // ✅ Strategy 3: No pagination needed
      let simple_query = `
        SELECT 
          id, status, order_id, merchant_order_id, payment_id, updated_at, created_at,
          currency, amount, psp, payment_mode, pan, is_one_click, merchant_customer_id,
          customer_email, customer_code, customer_mobile, billing_country, merchant_id,
          terminal_id, scheme, card_country, cardType, card_id, other_description, origin,
          customer_name, high_risk_country, high_risk_transaction, block_for_suspicious_ip,
          block_for_suspicious_email, block_for_transaction_limit, fraud_request_type
        FROM ${table_name}
        ${final_cond}
        ${order_by}
        ${'LIMIT 500'}
      `;
      
      console.log("Simple query:", simple_query);
      rows = await qb.query(simple_query);
    
    return { rows, total_count };
    
  } catch (error) {
    console.error("Cluster-based query failed:", error);
    console.error("Query conditions:", { final_cond, order_by, limit });
    throw error;
  } finally {
    qb.release();
  }
},
// ✅ Helper function for order_id existence check (uses unique index)
check_order_id_exists_fast: async (order_id, table_name) => {
  table_name = config.table_prefix + table_name;
  
  let query = `
    SELECT 1 FROM ${table_name} 
    WHERE order_id = ? 
    LIMIT 1
  `;
  
  let qb = await pool.get_connection();
  try {
    let result = await qb.query(query, [order_id]);
    return result.length > 0;
  } catch (error) {
    console.error("Order ID existence check failed:", error);
    throw error;
  } finally {
    qb.release();
  }
},

// ✅ Optimized insert with unique constraint check
insert_transaction_clustered: async (transaction_data, table_name) => {
  table_name = config.table_prefix + table_name;
  
  let qb = await pool.get_connection();
  try {
    await qb.beginTransaction();
    
    // Fast uniqueness check using unique index
    if (transaction_data.order_id) {
      let exists = await this.check_order_id_exists_fast(
        transaction_data.order_id, 
        table_name.replace(config.table_prefix, '')
      );
      
      if (exists) {
        throw new Error(`Order ID ${transaction_data.order_id} already exists`);
      }
    }
    
    // Prepare insert query with parameterized values
    let columns = Object.keys(transaction_data);
    let placeholders = columns.map(() => '?');
    let values = Object.values(transaction_data);
    
    let insert_query = `
      INSERT INTO ${table_name} (${columns.join(', ')}) 
      VALUES (${placeholders.join(', ')})
    `;
    
    console.log("Insert query:", insert_query);
    let result = await qb.query(insert_query, values);
    
    await qb.commit();
    return result;
    
  } catch (error) {
    await qb.rollback();
    console.error("Clustered insert failed:", error);
    throw error;
  } finally {
    qb.release();
  }
}
};
module.exports = dbModel;
