const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const mcc_dbtable = config.table_prefix + "mcc_codes";
const psp_table = config.table_prefix + "psp";
const log_table = config.table_prefix + "order_logs";
const test_log_table = config.table_prefix + "test_order_logs";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");

var order_logs = {
  add: async (data, log_table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + log_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  test_log_add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(test_log_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  get_log_data: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("activity")
        .where({ order_id: order_id })
        .get(log_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      response = JSON.parse(response?.[0].activity);
    }
    return response;
  },
  get_test_log_data: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("activity")
        .where({ order_id: order_id })
        .get(test_log_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      response = JSON.parse(response?.[0].activity);
    }

    return response;
  },

  get_order_action: async (order_id, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("action")
        .where({ order_id: order_id })
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  get_order_request_details: async (order_id, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("request")
        .where({ order_id: order_id })
        .order_by("id", "desc")
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  update_logs_data: async (condition, data, mode) => {
    let table = mode == "test" ? test_log_table : log_table;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.set(data).where(condition).update(table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  update_test_logs_data: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(test_log_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (filter, limit, mode) => {
    let limitCon = "";
    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }
    let condition = filter?.order_id
      ? ` where order_id = ${filter.order_id} `
      : "";
    let query = "";
    if (mode === "test") {
      query =
        "SELECT * from " +
        test_log_table +
        condition +
        " order by id desc " +
        limitCon;
    } else {
      query =
        "SELECT * from " +
        log_table +
        condition +
        " order by id desc " +
        limitCon;
    }

    let response;
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

  // selectAll: async (selection, condition) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .select(selection)
  //         .where(condition)
  //         .get(mcc_dbtable);
  //     qb.release();
  //     return response;
  // },
  // selectOne: async (selection, condition) => {
  //     let qb = await pool.get_connection();
  //     response = await qb.select(selection).where(condition).get(psp_table);
  //     qb.release();
  //     return response?.[0];
  // },
  // get_psp: async () => {
  //     let qb = await pool.get_connection();
  //     let query =
  //         "select count('id') as count from " +
  //         psp_table +
  //         " where deleted=0 and status=0";
  //     response = await qb.query(query);
  //     qb.release();
  //     return response?.[0].count;
  // },
  get_count: async (filter) => {
    let condition = filter?.order_id
      ? ` where order_id = ${filter.order_id} `
      : "";
    let query = "SELECT count(*) as count from " + log_table + condition;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  // get_psp_by_merchant: async (condition) => {
  //     let qb = await pool.get_connection();
  //     let query =
  //         "select psp.name from " +
  //         config.table_prefix +
  //         "merchant_psp_status mps INNER JOIN " +
  //         config.table_prefix +
  //         "psp  psp on mps.psp_id= psp.id  where   " +
  //         condition;

  //     response = await qb.query(query);
  //     qb.release();
  //     return response;
  // },
  // get_psp_by_merchant_admin: async (condition) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .select("name")
  //         .from(config.table_prefix + "psp")
  //         .where({ deleted: 0, status: 0 })
  //         .get();
  //     qb.release();
  //     return response;
  // },
  // getMccName: async (mcc_codes) => {
  //     let mcc_codes_array = mcc_codes.split(",");
  //     let new_mcc_codes_array = [];
  //     for (i of mcc_codes_array) {
  //         new_mcc_codes_array.push('"' + i + '"');
  //     }
  //     let qb = await pool.get_connection();
  //     response = await qb.query(
  //         "select GROUP_CONCAT(description) as name from " +
  //             mcc_dbtable +
  //             " where id in (" +
  //             new_mcc_codes_array.join(",") +
  //             ")"
  //     );
  //     qb.release();
  //     return response?.[0].name;
  // },
  // getEncMCC: async (mcc_codes) => {
  //     let mcc_codes_array = mcc_codes.split(",");
  //     let new_mcc_codes_array = [];
  //     for (i of mcc_codes_array) {
  //         new_mcc_codes_array.push(enc_dec.cjs_encrypt(i));
  //     }
  //
  //     return new_mcc_codes_array.join(",");
  // },
  // getPspName: async (psp_codes) => {
  //     let psp_codes_array = psp_codes.split(",");
  //     let new_psp_codes_array = [];
  //     for (i of psp_codes_array) {
  //         new_psp_codes_array.push('"' + i + '"');
  //     }
  //     let qb = await pool.get_connection();
  //     response = await qb.query(
  //         "select GROUP_CONCAT(name) as name from " +
  //             psp_table +
  //             " where id in (" +
  //             new_psp_codes_array.join(",") +
  //             ")"
  //     );
  //     qb.release();

  //     return response?.[0].name;
  // },
};

module.exports = order_logs;
