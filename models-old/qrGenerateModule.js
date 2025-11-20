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
const logs_table = config.table_prefix + "merchant_qr_codes_logs";
const moment = require("moment");
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
          "theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language,font_name"
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
    let response;
    const qb = await pool.get_connection();
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
    date_condition,
    status_condition,
    amount_condition
  ) => {
    let day = moment().format("YYYY-MM-DD");

    let response;

    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "end_date"
      );

      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
        // final_cond = final_cond + date_condition_str + " and is_expiry=1";
      } else {
        final_cond = final_cond + " and " + date_condition_str;
        // final_cond = final_cond + " and " + date_condition_str + " and is_expiry=1";
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "";

    let status_query =
      status_condition.status === "Expired"
        ? ` AND status = 0 AND end_date < '${day}' AND is_expiry = 1 `
        : status_condition.status === "Active"
        ? ` AND status = 0 AND (DATE(end_date) > '${day}' OR is_expiry = 0) `
        : status_condition.status === "Deactivated"
        ? ` AND status = 1 `
        : "";

    // let amount_query = Object.keys(amount_condition).length
    //     ? ` AND amount ${amount_condition.condition} ${amount_condition.amount} `
    //     : "";

    let amount_query2 = Object.keys(amount_condition).length
      ? " AND amount " +
        amount_condition.condition +
        " " +
        amount_condition.amount
      : "";

    let like_str = "";

    if (like_condition.description) {
      like_str =
        like_str +
        " AND `description` LIKE '%" +
        like_condition.description +
        "%'";
    }

    // "select * from " +
    //     db_table +
    //     final_cond +
    //     amount_query +
    //     status_query +
    //     " AND `description` LIKE '%" +
    //     like_condition.description +
    //     "%'" +
    //     " order BY ID DESC limit " +
    //     limit.start +
    //     "," +
    //     limit.perpage;

    if (limit.perpage) {
      query =
        "select * from " +
        db_table +
        final_cond +
        amount_query2 +
        status_query +
        like_str +
        " order BY ID DESC limit " +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query =
        "select * from " +
        db_table +
        final_cond +
        amount_query2 +
        status_query +
        like_str +
        " order BY ID DESC";
    }

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
      console.log(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_deactivated_qr_list: async (condition_obj) => {
    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }
    if (final_cond == " where ") {
      final_cond = final_cond + " is_reseted=1";
    } else {
      final_cond += " and is_reseted=1";
    }
    let query = "select * from " + db_table + final_cond + " order BY ID DESC";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
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
      response = await qb.select("id,logo,icon").from(merchant_deta).get(data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    const result = {};
    response.forEach((element) => {
      result[element.id] = element.icon;
    });

    return result;
  },
  getSubMerchantlogo: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("logo").where({ id: data }).get(merchant_deta);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].logo;
    } else {
      return "";
    }
  },

  get_merchant_data: async (id) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,logo,icon,mobile_no,code")
        .where({ id: id })
        .get(merchant_deta);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  get_merchant_name: async (id) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("company_name")
        .where({ merchant_id: id })
        .get(merchant_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
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

  get_count_all_conditions: async (
    condition_obj,
    like_condition,
    date_condition,
    status_condition,
    amount_condition
  ) => {
    let day = moment().format("YYYY-MM-DD");

    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "end_date"
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

    let status_query =
      status_condition.status === "Expired"
        ? ` AND status = 0 AND end_date < '${day}' AND is_expiry = 1 `
        : status_condition.status === "Active"
        ? ` AND status = 0 AND (end_date > '${day}' OR is_expiry = 0) `
        : status_condition.status === "Deactivated"
        ? ` AND status = 1 `
        : "";

    let amount_query = Object.keys(amount_condition).length
      ? ` AND amount ${amount_condition.condition} ${amount_condition.amount} `
      : "";

    let like_str = "";
    if (like_condition.description) {
      like_str =
        like_str +
        " AND `description` LIKE '%" +
        like_condition.description +
        "%'";
    }

    let query =
      "select count('id') as count from " +
      db_table +
      final_cond +
      amount_query +
      status_query +
      like_str;

    let qb = await pool.get_connection();
    let response;
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
  list_of_paymentLinks: async (condition, type) => {
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
      let trans_data = await helpers.get_trans_data(element?.order_no, type);
      console.log(trans_data[0]);
      result.push({
        order_no: element.order_no,
        name: element.name,
        email: element.email,
        amount: element.amount,
        currency: element.currency,
        payment_status: element.payment_status,
        psp_payment_id: trans_data[0]?.last_psp_txn_id
          ? trans_data[0]?.last_psp_txn_id
          : "",
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
  per_day_quantity_sum: async (condition_obj, date, db_table) => {
    let table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      let query =
        "SELECT SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and DATE(qp.added_date)=" +
        date;

      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.total ? response?.[0]?.total : 0;
  },
  per_day_quantity: async (condition_obj, date, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and DATE(qp.added_date)=" +
        date;

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
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and Month(qp.added_date)=" +
        date;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total : 0;
  },
  per_month_quantity_sum: async (condition_obj, date, db_table) => {
    let table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and Month(added_date)=" +
        date;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.total ? response?.[0]?.total : 0;
  },

  until_expiry_quantity: async (condition_obj, date, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and DATE(added_date)<=" +
        date;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.total ? response?.[0]?.total : 0;
  },
  until_expiry_quantity_sum: async (condition_obj, date, db_table) => {
    let table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT  SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition +
        " and DATE(added_date)<=" +
        date;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].total ? response?.[0].total : 0;
  },
  over_all_quantity_sum: async (condition_obj, db_table) => {
    table = config.table_prefix + db_table;
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT  SUM(quantity) as total FROM " +
        table +
        " qp INNER JOIN " +
        config.table_prefix +
        "orders o ON qp.order_no=o.order_id " +
        " where (qp.payment_status = 'CAPTURED'  OR qp.payment_status = 'AUTHORISED' OR qp.payment_status = 'APPROVED') AND o.status<>'VOID' and " +
        condition;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.total ? response?.[0]?.total : 0;
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
    //
    let response;
    try {
      response = await qb
        .select(
          "qr.order_no,qr.amount,qr.payment_status,qr.currency,qr.email,qr.mobile,qr.code,qr.transaction_date,ord.payment_id,ord.payment_mode,ord.card_no"
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
  checkIfStaticQrExits: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    if (response?.length > 0) {
      return false;
    } else {
      return true;
    }
  },
  add_logs: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(logs_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_counts_qr_payments: async (qr_id) => {
    let query =
      "select count('id') as count from " +
      db_collection +
      " where payment_id='" +
      qr_id +
      "' AND payment_status='CAPTURED'";
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
  select_qr_logs: async (
    condition_obj,
    limit,
    like_condition,
    date_condition,
    status_condition,
    amount_condition
  ) => {
    let day = moment().format("YYYY-MM-DD");

    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
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

    let query = "";

    let status_query =
      status_condition.status === "Expired"
        ? ` AND status = 0 AND end_date < '${day}' AND is_expiry = 1 `
        : status_condition.status === "Active"
        ? ` AND status = 0 AND (DATE(end_date) > '${day}' OR is_expiry = 0) `
        : status_condition.status === "Deactivated"
        ? ` AND status = 1 `
        : "";

    // let amount_query = Object.keys(amount_condition).length
    //     ? ` AND amount ${amount_condition.condition} ${amount_condition.amount} `
    //     : "";

    let amount_query2 = Object.keys(amount_condition).length
      ? " AND amount " +
        amount_condition.condition +
        " " +
        amount_condition.amount
      : "";

    let like_str = "";

    if (like_condition.description) {
      like_str =
        like_str +
        " AND `description` LIKE '%" +
        like_condition.description +
        "%'";
    }
    if (limit.perpage) {
      query =
        "select * from " +
        logs_table +
        final_cond +
        amount_query2 +
        status_query +
        like_str +
        " order BY ID DESC limit " +
        limit.start +
        "," +
        limit.perpage;
    } else {
      query =
        "select * from " +
        logs_table +
        final_cond +
        amount_query2 +
        status_query +
        like_str +
        " order BY ID DESC";
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
      console.log(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_all_logs_conditions: async (
    condition_obj,
    like_condition,
    date_condition,
    status_condition,
    amount_condition
  ) => {
    let day = moment().format("YYYY-MM-DD");

    let final_cond = " where ";
    if (Object.keys(condition_obj).length) {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "end_date"
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

    let status_query =
      status_condition.status === "Expired"
        ? ` AND status = 0 AND end_date < '${day}' AND is_expiry = 1 `
        : status_condition.status === "Active"
        ? ` AND status = 0 AND (end_date > '${day}' OR is_expiry = 0) `
        : status_condition.status === "Deactivated"
        ? ` AND status = 1 `
        : "";

    let amount_query = Object.keys(amount_condition).length
      ? ` AND amount ${amount_condition.condition} ${amount_condition.amount} `
      : "";

    let like_str = "";
    if (like_condition.description) {
      like_str =
        like_str +
        " AND `description` LIKE '%" +
        like_condition.description +
        "%'";
    }

    let query =
      "select count('id') as count from " +
      logs_table +
      final_cond +
      amount_query +
      status_query +
      like_str;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  selectOpenStaticQR: async (condition, table,join_tablle) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("qr.qr_id")
        .from(config.table_prefix + table+' qr')
        .join(config.table_prefix+join_tablle+' mid','qr.mid_id=mid.id','inner')
        .where(condition)
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = qr_module;
