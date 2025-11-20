const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");
const dbtable = config.table_prefix + "bus_reg_country_master";
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
  select: async (condition, filter, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("country_code", "asc")
          .limit(limit.perpage, limit.start)
          .get(dbtable);
        if (filter.country_name != "") {
          response = await qb
            .select("*")
            .where(condition)
            .like(filter)
            .order_by("country_code", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        }
      } else {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("country_code", "asc")
          .get(dbtable);
        if (filter.country_name != "") {
          response = await qb
            .select("*")
            .where(condition)
            .like(filter)
            .order_by("country_code", "asc")
            .get(dbtable);
        }
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
    return response[0];
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
    return response[0];
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
  get_count: async (condition_obj) => {
    let qb = await pool.get_connection();
    if (condition_obj.country_name != "") {
      try {
        let condition = await helpers.get_conditional_like_string(
          condition_obj
        );
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where deleted = 0 " +
            condition
        );
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    } else {
      try {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where deleted = 0 "
        );
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    }

    return response?.[0].count;
  },
  getIos: async (selection, condition) => {
    let qb = await pool.get_connection();
    try {
      response = await qb.select(selection).like(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].iso2;
  },
};
module.exports = dbModel;
