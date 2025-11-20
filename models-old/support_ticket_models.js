require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "orders";
const dbtable2 = config.table_prefix + "charges_invoice";
const helpers = require("../utilities/helper/general_helper");

var support_ticket_model = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable2, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (and_condition, date_condition) => {
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
    let query = "select * from " + dbtable + final_cond + " order BY ID DESC ";
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

  select_list: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage) {
      try {
        if (Object.keys(condition).length !== 0) {
          qb.select("*");
          qb.where(condition).order_by("id", "asc");
          qb.limit(limit.perpage, limit.start);
          response = await qb.get(dbtable2);
        } else {
          qb.select("*");
          qb.order_by("id", "asc");
          qb.limit(limit.perpage, limit.start);
          response = await qb.get(dbtable2);
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    } else {
      try {
        if (condition) {
          qb.select("*");
          qb.where(condition).order_by("id", "asc");
          response = await qb.get(dbtable2);
        } else {
          qb.select("*");
          qb.order_by("id", "asc");
          response = await qb.get(dbtable2);
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    }
  },

  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable2);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = support_ticket_model;
