const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const tctable = config.table_prefix + "tc";
const helpers = require("../utilities/helper/general_helper");
var dbModel = {
  addtc: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(tctable, data);
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
          .get(tctable);
      } else {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("id", "asc")
          .get(tctable);
      }
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
      response = await qb.select(selection).where(condition).get(tctable);
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
        .get(tctable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectOneLatest: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "DESC")
        .get(tctable);
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
      response = await qb.select(selection).where(condition).get(tctable);
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
      response = await qb.set(data).where(condition).update(tctable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + tctable + " where " + condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
};
module.exports = dbModel;
