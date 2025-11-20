const { ellipse } = require("pdfkit");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const enc_dec = require("../utilities/decryptor/decryptor");
// const db_table = config.table_prefix + 'master_merchant';
// const super_merchant_table = config.table_prefix + 'master_super_merchant';
// const details_table = config.table_prefix +'master_merchant_details';
// const reset_table = config.table_prefix+'master_merchant_password_reset';
// const two_fa_table = config.table_prefix+'twofa_authenticator';
// const tc_accepted = config.table_prefix+'tc_accepted';
const psp_datatable = config.table_prefix + "psp";
const mcc_databale = config.table_prefix + "mcc_codes";
const currency_databale = config.table_prefix + "master_currency";
const payment_mode = config.table_prefix + "payment_mode";
const card_scheme = config.table_prefix + "card_scheme";
const charges_table = config.table_prefix + "charges_merchant_maintenance";
const db_table = config.table_prefix + "charges_transaction_setup";

const slab_table = config.table_prefix + "charges_transaction_slab";
const helpers = require("../utilities/helper/general_helper");
const logger = require('../config/logger');
var MerchantMaintenanceModel = {
  register: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(db_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_slab: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(slab_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getPSPName: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id,name").from(psp_datatable).get(data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = element.name;
    });
    return result;
  },
  getMCCName: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(mcc) as name from " +
          mcc_databale +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].name.split(",").join(", ");
  },

  getCurrencyCode: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(code) as name from " +
          currency_databale +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].name;
  },

  getPaymentMode: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(payment_mode) as name from " +
          payment_mode +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].name;
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
      response = await qb.get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  select_slab: async (limit) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage) {
      try {
        response = await qb
          .select("*")
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(db_table);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    } else {
      try {
        response = await qb.select("*").order_by("id", "desc").get(db_table);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
      } finally {
        qb.release();
      }
    }
    return response;
  },

  list_of_document: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(slab_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    let result = [];
    response.forEach((element) => {
      if (element.buy_min_charge_amount > 0) {
        result.push({
          id: enc_dec.cjs_encrypt(element.id),
          transaction_type: element.transaction_type,
          buy_from_amount: element.buy_from_amount,
          buy_to_amount: element.buy_to_amount,
          buy_per_charges: element.buy_per_charges,
          buy_fix_amount: element.buy_fix_amount,
          buy_min_charge_amount: element.buy_min_charge_amount,
          buy_max_charge_amount: element.buy_max_charge_amount,
          buy_tax: element.buy_tax,
          sell_from_amount: element.sell_from_amount,
          sell_to_amount: element.sell_to_amount,
          sell_per_charges: element.sell_per_charges,
          sell_fixed_amount: element.sell_fixed_amount,
          sell_min_charge_amount: element.sell_min_charge_amount,
          sell_max_charge_amount: element.sell_max_charge_amount,
          sell_tax: element.sell_tax,
        });
      }
    });
    return result;
  },

  list_of_sell: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(slab_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    let result = [];
    response.forEach((element) => {
      if (element.sell_min_charge_amount > 0) {
        result.push({
          id: enc_dec.cjs_encrypt(element.id),
          transaction_type: element.transaction_type,
          sell_from_amount: element.sell_from_amount,
          sell_to_amount: element.sell_to_amount,
          sell_per_charges: element.sell_per_charges,
          sell_fixed_amount: element.sell_fixed_amount,
          sell_min_charge_amount: element.sell_min_charge_amount,
          sell_max_charge_amount: element.sell_max_charge_amount,
          sell_tax: element.sell_tax,
        });
      }
    });
    return result;
  },
  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  updateSlab: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(slab_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  selectOne: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  // selectMCC: async (condition) => {
  //       let qb = await pool.get_connection();
  //       response = await qb
  //             .select("mcc")
  //             .where(condition)
  //             .get(db_table);
  //       qb.release();
  //
  //       return response;
  // },

  selectMCC: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("mcc, payment_mode, charges_type").where(condition);
      response = await qb.get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectCard: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("id, card_scheme"); //.where(condition);
      response = await qb.get(card_scheme);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  get_count: async () => {
    let qb = await pool.get_connection();
    // let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    try {
      response = await qb.query("select count('id') as count from " + db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_counts: async (like_conditions) => {
    let query = "select count('id') as count from " + db_table;

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
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  select_payment_mode: async (selection, limit, like_conditions) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select(selection).where({ deleted: 0 }).order_by("id", "desc");
      let i = 0;
      for (var key in like_conditions) {
        var value = like_conditions[key];
        if (i == 0) qb.like({ [key]: value });
        else qb.or_like({ [key]: value });
        i++;
      }

      qb.limit(limit.perpage, limit.start);

      response = await qb.get(payment_mode);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  get_counts_payment_mode: async (like_conditions) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query = "select count('id') as count from " + payment_mode;

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

      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  // list_of_buy_slab: async (condition) => {

  //       const qb = await pool.get_connection();
  //       response = await qb
  //             .select("*")
  //             .where(condition)
  //             .get(slab_table);
  //       qb.release();

  //       let result = {};
  //       // response.forEach(async(element) => {
  //
  //       //     result.push({
  //       //         "id":await enc_dec.cjs_encrypt(element.id),
  //       //     });

  //       // })

  //       response.forEach((element) => {
  //             result[element.id] = element.from;

  //       })

  //       return result;
  // },
};
module.exports = MerchantMaintenanceModel;
