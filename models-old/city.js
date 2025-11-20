const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "city";
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
  select: async (condition, filter, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        if (filter.city_name != "") {
          response = await qb
            .select("*")
            .where(condition)
            .like(filter)
            .order_by("city_name", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("city_name", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        }
      } else {
        if (filter.city_name != "") {
          response = await qb
            .select("*")
            .where(condition)
            .like(filter)
            .order_by("city_name", "asc")
            .get(dbtable);
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("city_name", "asc")
            .get(dbtable);
        }
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
  get_count: async (condition_obj, search_city) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      if (search_city.city_name != "") {
        let city_condition = await helpers.get_conditional_like_string(
          search_city
        );
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where " +
            condition +
            city_condition
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where " + condition
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
