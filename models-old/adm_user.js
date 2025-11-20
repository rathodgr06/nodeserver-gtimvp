const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "adm_user";
const passwordLogs = config.table_prefix + "password_logs";
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
  add_two_fa: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_2fa", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select2fa: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("t.admin_id,t.secret,a.email")
        .from(config.table_prefix + "admin_2fa" + " t")
        .join(dbtable + " a", "t.admin_id=a.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response[0];
  },
  select: async (condition_obj, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      if (filter.name != "") {
        try {
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
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }
      } else {
        try {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("id", "desc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }
      }
    } else {
      if (filter.name != "") {
        try {
          response = await qb.query(
            "select * from " +
              dbtable +
              " where " +
              condition +
              " and (" +
              search_text +
              ")"
          );
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }
      } else {
        try {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("id", "desc")
            .get(dbtable);
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }
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
  get_count: async (condition_obj, filter) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let qb = await pool.get_connection();
    if (filter.name != "") {
      try {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable +
            " where " +
            condition +
            "and (" +
            search_text +
            ")"
        );
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    } else {
      try {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where " + condition
        );
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    }
    return response?.[0].count;
  },
  add_token_check: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "password_token_check", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  delete_token: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(
        config.table_prefix + "password_token_check",
        data
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update2fa: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + "admin_2fa");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select2falogin: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("t.admin_id,a.two_fa_secret as secret,a.email")
        .from(config.table_prefix + "admin_2fa" + " t")
        .join(dbtable + " a", "t.admin_id=a.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response[0];
  },
  selectPasswordLogs: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .limit(1)
        .order_by("id", "desc")
        .get(passwordLogs);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response[0];
  },
  addPasswordLogs: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(passwordLogs, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = dbModel;
