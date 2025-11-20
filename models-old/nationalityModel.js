const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");
const dbtable = config.table_prefix + "nationality";

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

  select: async (condition_obj, filter, limit) => {
    let qb = await pool.get_connection();
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_and_conditional_string(condition_obj);
    let response;

    let select = "*";

    if (limit.perpage) {
      try {
        if (Object.keys(filter).length) {
          response = await qb.query(
            "select " +
              select +
              " from " +
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
          response = qb
            .where(condition)
            .select(select)
            .from(dbtable)
            .limit(limit.perpage, limit.start)
            .get();
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    } else {
      try {
        if (Object.keys(filter).length) {
          response = await qb.query(
            "select " +
              select +
              " from " +
              dbtable +
              " where " +
              condition +
              " and (" +
              search_text +
              ")"
          );
        } else {
          response = qb.where(condition).select(select).from(dbtable).get();
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
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
      response = await qb.select(selection).where(condition).get(dbtable);
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
    let qb = await pool.get_connection();
    try {
      if (condition_obj.search != "") {
        let condition = await helpers.get_conditional_like_string(
          condition_obj
        );
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where deleted = 0 " +
            condition
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where deleted = 0 "
        );
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
};
module.exports = dbModel;
