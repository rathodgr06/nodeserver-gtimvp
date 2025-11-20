const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
// const db_table = config.table_prefix + 'master_merchant';
// const super_merchant_table = config.table_prefix + 'master_super_merchant';
// const details_table = config.table_prefix +'master_merchant_details';
// const reset_table = config.table_prefix+'master_merchant_password_reset';
// const two_fa_table = config.table_prefix+'twofa_authenticator';
// const tc_accepted = config.table_prefix+'tc_accepted';
const mcc_dbtable = config.table_prefix + "master_features";
const currency_dbtable = config.table_prefix + "master_currency";
const charges_table = config.table_prefix + "charges_merchant_maintenance";
const features_table = config.table_prefix + "master_features";
const db_table = config.table_prefix + "charges_merchant_maintenance";
const helpers = require("../utilities/helper/general_helper");
var MerchantMaintenanceModel = {
  register: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  getfeaturesName: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select GROUP_CONCAT(feature) as name from " +
          mcc_dbtable +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].name;
  },

  getcurrencyName1: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select GROUP_CONCAT(code) as name from " +
          currency_dbtable +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].name;
  },

  getcurrencyName: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id,code").from(currency_dbtable).get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = element.code;
    });
    return result;
  },

  select: async (selection, limit, like_conditions) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select(selection).order_by("id", "desc");
      let i = 0;
      for (var key in like_conditions) {
        var value = like_conditions[key];
        if (i == 0) qb.like({ [key]: value });
        else qb.or_like({ [key]: value });
        i++;
      }

      qb.limit(limit.perpage, limit.start);
      response = await qb.get(charges_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  select_features: async (selection, limit, like_conditions) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select(selection).order_by("id", "asc");
      let i = 0;
      for (var key in like_conditions) {
        var value = like_conditions[key];
        if (i == 0) qb.like({ [key]: value });
        else qb.or_like({ [key]: value });
        i++;
      }

      qb.limit(limit.perpage, limit.start);
      response = await qb.get(features_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
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
      response = await qb.select(selection).where(condition).get(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  get_count: async () => {
    let qb = await pool.get_connection();
    // let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    try {
      response = await qb.query("select count('id') as count from " + db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_counts: async (like_conditions) => {
    let query = "select count('id') as count from " + charges_table;

    let i = 0;
    for (var key in like_conditions) {
      var value = like_conditions[key];
      if (i == 0) {
        query += " and " + key + ' like "%' + value + '%" ';
      } else {
        query += " or " + key + ' like "%' + value + '%" ';
      }
      i++;
    }
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_counts_features: async (like_conditions) => {
    let query = "select count('id') as count from " + features_table;

    let i = 0;
    for (var key in like_conditions) {
      var value = like_conditions[key];
      if (i == 0) {
        query += " and " + key + ' like "%' + value + '%" ';
      } else {
        query += " or " + key + ' like "%' + value + '%" ';
      }
      i++;
    }
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
};
module.exports = MerchantMaintenanceModel;
