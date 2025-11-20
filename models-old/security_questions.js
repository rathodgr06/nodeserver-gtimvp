const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_security_questions";
const customers_answer = config.table_prefix + "customers_answer";
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
  select: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("id", "asc")
          .limit(limit.perpage, limit.start)
          .get(dbtable);
      } else {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("master_security_questions", "asc")
          .get(dbtable);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectActive: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "asc")
        .get(dbtable);
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
  selectOne: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "asc")
        .get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
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
  get_count: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as count from " + dbtable + " where " + condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  add_answer: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(customers_answer, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateAnswer: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(customers_answer);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = dbModel;
