const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_referral_bonus";
const invoice_table = config.table_prefix + "referral_bonus_monthly_invoice";
const helpers = require("../utilities/helper/general_helper");

const dbModel = {
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
  selectSome: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (condition, limit, search) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        qb.select("*");
        qb.where(condition).order_by("id", "asc");
        // if (search != '') {
        //     qb.like({ settlement_date: search }, null, 'before', 'after');
        //     qb.or_like({ currency: search }, null, 'before', 'after');
        //     // qb.or_like({ email: search }, null, 'before', 'after');
        // }
        qb.limit(limit.perpage, limit.start);
        response = await qb.get(dbtable);
      } else {
        qb.select("*");
        qb.where(condition).order_by("id", "asc");
        // if (search != '') {
        //     qb.like({ settlement_date: search }, null, 'before', 'after');
        //     qb.or_like({ currency: search }, null, 'before', 'after');
        //     // qb.or_like({ email: search }, null, 'before', 'after');
        // }
        response = await qb.get(dbtable);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  selectSpecificDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(dbtable);
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
        .order_by("currency", "asc")
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
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);

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
  select_invoice_data: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(invoice_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
};

module.exports = dbModel;
