const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const response = require("../routes/api/v1");
const dbtable = config.table_prefix + "transaction_limit";
const mid_dbtable = config.table_prefix + "mid";
const merchant_details = config.table_prefix + "master_merchant_details";
const merchant_psp = config.table_prefix + "merchant_psp_status";
const merchant_key_and_secret =
  config.table_prefix + "master_merchant_key_and_secret";
const helpers = require("../utilities/helper/general_helper");

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
  update: async (condition, data) => {
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
  delete: async (data_id, submerchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "delete from " + dbtable + " where id=" + data_id
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (selection) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where({ deleted: 0 }).get(dbtable);
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
  selectdata: async (condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = qb
        .where({ "s.id": condition, "s.deleted": 0, "m.deleted": 0 })
        .select("m.id,m.submerchant_id,m.currency_id,m.psp_id,m.MID")
        .from(dbtable + " s")
        .join(mid_dbtable + " m", "s.id=m.submerchant_id")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj, data_id) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
          dbtable +
          " where id !=" +
          data_id +
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
  selectDynamic: async (selection, table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where({ deleted: 0 })
        .get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_dynamic_count: async (condition_obj, data_id, table_name) => {
    table_name = config.table_prefix + table_name;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
          table_name +
          " where id !=" +
          data_id +
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
  update_dynamic: async (condition, data, table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_dynamic: async (data, table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert(table_name, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  delete_all: async (table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  selectOneByTableAndCondition: async (selection, condition, table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.select(selection).where(condition).get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  updateDynamic: async (condition, data, table_name) => {
    table_name = config.table_prefix + table_name;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_check: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id").where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response ? response.length : 0;
  },
};
module.exports = dbModel;
