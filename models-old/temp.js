const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const db_table = config.table_prefix + "merchant_qr_codes";
const db_collection = config.table_prefix + "qr_payment";
const merchant_table = config.table_prefix + "master_merchant_details";
const merchant_deta = config.table_prefix + "master_merchant";
const pay_mail = config.table_prefix + "payment_mail";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");

const qr_module = {
  add: async (data) => {
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
  add_collection: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(db_collection, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  update_collection: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_collection);
    } catch (error) {
      console.error("Database query failed:", error);
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
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectOneMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language"
        )
        .where(condition)
        .get(merchant_deta);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  get_company_name: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_id,company_name")
        .from(merchant_table)
        .get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.merchant_id] = element.company_name;
    });
    return result;
  },

  selectOne_collection: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(merchant_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectOne_payment: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(db_collection);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectOne_type: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(db_table);
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
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (selection, condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select(selection).order_by("id", "desc").where(condition);
      qb.limit(limit.perpage, limit.start);
      response = await qb.get(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select_qr_list: async (
    condition_obj,
    limit,
    like_condition,
    date_condition
  ) => {
    // let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      if (limit.perpage) {
        // if (Object.keys(filter).length) {
        //       response = await qb
        //             .query("select * from " + db_table + " where " + condition + " and LIMIT " + limit.perpage + limit.start);
        // } else {

        response = await qb
          .select("*")
          .where(condition)
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(db_table);
      } else {
        // if (Object.keys(filter).length) {
        //       response = await qb
        //             .query("select * from " + db_table + " where " + condition + " and");
        // } else {
        response = await qb
          .select("*")
          .where(condition)
          .like(like_condition)
          .order_by("id", "desc")
          .get(db_table);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  select_payment_list: async (condition_obj, limit) => {
    // let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);

    let response;
    let qb = await pool.get_connection();
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(db_collection);
      } else {
        response = await qb
          .select("*")
          .where(condition)
          .order_by("id", "desc")
          .get(db_collection);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  get_counts: async () => {
    let query =
      "select count('id') as count from " +
      db_table +
      " where 'is_reseted' = 0 and is_expired =0";
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

  getMerchantName: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_id,company_name")
        .from(merchant_table)
        .get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.merchant_id] = element.company_name;
    });
    return result;
  },
  getMerchantcode: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id,code").from(merchant_deta).get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = "+" + element.code;
    });
    return result;
  },
  getMerchantmobile: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id,mobile_no").from(merchant_deta).get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = element.mobile_no;
    });
    return result;
  },
  getMerchantlogo: async (data) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id,logo").from(merchant_deta).get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = element.logo;
    });
    return result;
  },

  get_count_search: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    // let search_text = await helpers.get_conditional_or_like_string(filter);
    // if(Object.keys(filter).length){
    //     response = await qb
    //     .query("select count('id') as count from "+dbtable+" where "+condition +"and (" + search_text + ")");
    // }else{

    let query =
      "select count('id') as count from " + db_table + " where " + condition;

    // }
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

  get_count_payment: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let query =
      "select count('id') as count from " +
      db_collection +
      " where " +
      condition;

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
  get_count_payment_without_condition: async () => {
    // let condition = await helpers.get_conditional_string(condition_obj);
    let query = "select count('id') as count from " + db_collection;
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

  get_count_payment_with_exp: async (condition_obj, ext) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let query =
      "select count('id') as count from " +
      db_collection +
      " where " +
      condition +
      " and transaction_date <= " +
      "'" +
      ext +
      "'";

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

  get_count_payment_for_today: async (condition_obj, ext) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let query =
      "select count('id') as count from " +
      db_collection +
      " where " +
      condition +
      " and transaction_date = " +
      "'" +
      ext +
      "'";

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

  list_of_payment: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(db_collection);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    let result = [];
    response.forEach(async (element) => {
      result.push({
        qr_order_id: enc_dec.cjs_encrypt(element.id),
        order_no: element.order_no,
        payment_id:
          element.payment_id == "" ? "not available" : element.payment_id,
        name: element.name,
        email: element.email,
        amount: element.amount,
        currency: element.currency,
        payment_status: element.payment_status,
      });
    });
    return result;
  },
  selectDynamic: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  per_day_quantity: async (condition_obj, date, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);

    let query =
      "SELECT count(id) as total FROM " +
      table +
      " where payment_status = 'Completed' and " +
      condition +
      " and DATE(added_date)=" +
      date;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total : 0;
  },
  per_month_quantity: async (condition_obj, date, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);

    let query =
      "SELECT count(id) as total FROM " +
      table +
      " where payment_status = 'Completed' and " +
      condition +
      " and Month(added_date)=" +
      date;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total : 0;
  },

  until_expiry_quantity: async (condition_obj, date, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);

    let query =
      "SELECT count(id) as total FROM " +
      table +
      " where payment_status = 'Completed' and " +
      condition +
      " and DATE(added_date)<=" +
      date;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total : 0;
  },

  addpayMail: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(pay_mail, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectTransactions: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "qr.order_no,qr.amount,qr.payment_status,qr.currency,qr.email,qr.mobile,qr.code,qr.transaction_date,ord.payment_id"
        )
        .from(config.table_prefix + "qr_payment" + " qr")
        .join(
          config.table_prefix + "orders ord",
          "ord.order_id=qr.order_no",
          "left"
        )
        .where(condition)
        .limit(20)
        .order_by("qr.transaction_date", "desc")
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  dump_data: async (condition, selection, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
};

module.exports = qr_module;
