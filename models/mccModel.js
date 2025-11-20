const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "mcc_codes";
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
  select_all: async (condition_obj, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      try {
        if (Object.keys(filter).length) {
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
            .order_by("id", "desc")
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
        if (Object.keys(filter).length) {
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
            .order_by("id", "desc")
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

  select: async (limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("mcc", "asc")
          .limit(limit.perpage, limit.start)
          .get(dbtable);
      } else {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("mcc", "asc")
          .get(dbtable);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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

  selectOnecategory: async (selection, condition) => {
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
  get_count_mcc: async (condition_obj, filter) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    // response = await qb.query("select count('id') as count from " + dbtable);
    try {
      if (Object.keys(filter).length) {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where " +
            condition +
            " and (" +
            search_text +
            ")"
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where " + condition
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string();
      response = await qb.query("select count('id') as count from " + dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
};

module.exports = dbModel;
