const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "rule_documents";
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
  select: async (limit) => {
    let qb = await pool.get_connection();
    let response;

    try {
      if (limit.perpage > 0) {
        response = await qb
          .select("*")
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(dbtable);
      } else {
        response = await qb.select("*").order_by("id", "desc").get(dbtable);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  // selectSpecific: async (selection, condition) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .select(selection)
  //         .where(condition)
  //         .get(dbtable);
  //     qb.release();
  //     return response;
  // },
  selectOne: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "desc")
        .get(dbtable);
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
  // selectUserDetails: async (condition) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .select(selection)
  //         .where(condition)
  //         .get(dbtable);
  //     qb.release();
  //     return response?.[0];
  // },
  // updateDetails: async (condition,data) => {
  //     let qb = await pool.get_connection();
  //     let response = await qb
  //         .set(data)
  //         .where(condition)
  //         .update(dbtable);
  //     qb.release();
  //     return response;
  // },
  get_count: async () => {
    let qb = await pool.get_connection();

    let response;
    try {
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
