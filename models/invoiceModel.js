const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const db_table = config.table_prefix + "inv_customer";
const inv_table = config.table_prefix + "inv_invoice_master";
const item_table = config.table_prefix + "inv_invoice_items";
const master_item_table = config.table_prefix + "master_items";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const moment = require("moment");
const qbModel = {
  add: async (data) => {
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
  select: async (limit, condition) => {
    let qb = await pool.get_connection();
    let response;

    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .where(condition)
          .get(db_table);
      } else {
        response = await qb
          .select("*")
          .order_by("id", "desc")
          .where(condition)
          .get(db_table);
      }
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

  get_count: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let final_cond = await helpers.get_and_conditional_string(condition);
      if (final_cond != "") {
        response = await qb.query(
          "select count('id') as count from " +
            db_table +
            "  where " +
            final_cond
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + db_table
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  add_inv: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(inv_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  add_inv_items: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert(item_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  selectInv: async (
    and_condition,
    limit,
    date_condition,
    like_search,
    expiry_date
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str =
        await helpers.modified_get_date_between_condition(
          date_condition.from_date,
          date_condition.to_date,
          "expiry_date"
        );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (Object.keys(expiry_date).length) {
      let exp_condition_str = inv_table + ".expiry_date" + expiry_date;
      if (final_cond == " where ") {
        final_cond = final_cond + exp_condition_str;
      } else {
        final_cond = final_cond + " and " + exp_condition_str;
      }
    }
    if (Object.keys(like_search).length) {
      let date_like_search_str =
        await helpers.get_conditional_like_string_modified(like_search);

      if (final_cond == " where ") {
        final_cond = final_cond + date_like_search_str;
      } else {
        final_cond = final_cond + " and ( " + date_like_search_str + ")";
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    // let query = "select * from " + inv_table + final_cond + " order BY ID DESC limit " + limit.start + "," + limit.perpage
    let query =
      "SELECT " +
      inv_table +
      ".*, " +
      db_table +
      ".email, " +
      db_table +
      ".mobile, " +
      db_table +
      ".code, " +
      db_table +
      ".prefix, " +
      db_table +
      ".bill_country, " +
      db_table +
      ".name FROM " +
      inv_table +
      " INNER JOIN " +
      db_table +
      " ON " +
      inv_table +
      ".customer_id = " +
      db_table +
      ".id" +
      final_cond +
      " order BY ID DESC limit " +
      limit.start +
      "," +
      limit.perpage;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  selectOneInv: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "inv.id, inv.sub_merchant_id, inv.customer_id, inv.merchant_id, inv.currency, inv.issue_date, inv.expiry_date, inv.invoice_no,inv.merchant_invoice_no, inv.total_amount, inv.total_tax, inv.total_discount, inv.description, inv.special_note,inv.merchant_full_name, inv.payment_terms, inv.status, c.prefix,c.name,c.email,c.logo,c.code,c.mobile,c.shipping_address,c.ship_address,c.ship_country, c.ship_state, c.ship_city, c.ship_zip_code, c.billing_address, c.bill_address, c.bill_country, c.bill_state, c.bill_city, c.bill_zip_code,cur.symbol,inv.order_id"
        )
        .from(config.table_prefix + "inv_invoice_master inv")
        .join(
          config.table_prefix + "inv_customer c",
          "inv.customer_id=c.id",
          "inner"
        )
        .join(
          config.table_prefix + "master_currency cur",
          "inv.currency=cur.code",
          "left"
        )
        .where({ "inv.id": condition.id })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  updateDetailsInv: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(inv_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  get_countInv: async (
    and_condition,
    date_condition,
    like_search,
    expiry_date
  ) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "expiry_date"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_like_search_str;
      } else {
        final_cond = final_cond + " and ( " + date_like_search_str + ")";
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    // let query = "select * from " + inv_table + final_cond + " order BY ID DESC limit " + limit.start + "," + limit.perpage
    let query =
      "SELECT COUNT(*) as total FROM ( SELECT " +
      inv_table +
      ".*, " +
      db_table +
      ".email, " +
      db_table +
      ".mobile, " +
      db_table +
      ".name FROM " +
      inv_table +
      " INNER JOIN " +
      db_table +
      " ON " +
      inv_table +
      ".customer_id = " +
      db_table +
      ".id" +
      final_cond +
      ") AS count_query";

    // let query =
    //     "select count('id') as count from " + inv_table + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].total;
  },

  add_item: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(item_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  select_item: async (limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(item_table);
      } else {
        response = await qb.select("*").order_by("id", "desc").get(item_table);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne_item: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(item_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  list_of_item: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(item_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    let result = [];
    response.forEach(async (element) => {
      result.push({
        item_id: enc_dec.cjs_encrypt(element.id),
        item_rate: element.item_rate,
        quantity: element.quantity,
        tax_per: element.tax_per,
        discount_per: element.discount_per,
        total_amount: element.total_amount,
      });
    });
    return result;
  },

  update_item: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(item_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  item_master_add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(master_item_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  item_master_list: async (limit, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select(
            "id,item_name,item_rate,item_description,status,created_at,updated_at,submerchant_id"
          )
          .where(condition)
          .order_by("id", "desc")
          .limit(limit.perpage, limit.start)
          .get(master_item_table);
      } else {
        response = await qb
          .select("id,item_name,item_rate,item_description")
          .where(condition)
          .order_by("id", "desc")
          .get(master_item_table);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  item_master_count: async (and_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    let query =
      "select count('id') as count from " + master_item_table + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  selectOneItem: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,item_rate,item_name,item_description,status,submerchant_id")
        .where(condition)
        .get(master_item_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  getMerchantDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "md.company_name,md.address_line1,md.co_email,md.poc_email,md.co_mobile_code,md.co_mobile,c.country_name,s.state_name,mm.logo,mm.icon"
        )
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "inner"
        )
        .join(
          config.table_prefix + "country c",
          "md.register_business_country=c.id",
          "left"
        )
        .join(config.table_prefix + "states s", "md.province=s.id", "left")
        .where({ "mm.id": condition.merchant_id })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  getInvoiceItems: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "i.item_id,i.item_rate,i.quantity,i.tax_per,i.discount_per,i.total_amount,p.item_name,p.item_description"
        )
        .from(config.table_prefix + "inv_invoice_items i")
        .join(config.table_prefix + "master_items p", "i.item_id=p.id", "inner")
        .where({ "i.invoice_master_id": id })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  removeItemsOfInvoice: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(config.table_prefix + "inv_invoice_items", {
        invoice_master_id: id,
      });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  itemMasterUpdate: async (data, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(master_item_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  FetchExpiryAndStatus: async (id, db_table) => {
    let table = config.table_prefix + db_table;
    let query =
      "SELECT status,expiry_date,invoice_no,sub_merchant_id,currency,mode,total_amount as amount   FROM " +
      table +
      " where id =" +
      id;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectOneInvData: async (condition) => {
    let response;
    console.log(`condition is here`);
    console.log(condition);
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select(
          "inv.id, inv.sub_merchant_id, inv.customer_id, inv.merchant_id, inv.currency, inv.issue_date, inv.expiry_date, inv.invoice_no, inv.total_amount, inv.total_discount, inv.description, inv.special_note, inv.payment_terms, inv.status,inv.mode, c.prefix,c.id as cid,c.name,c.email,c.logo,c.code,c.mobile,c.shipping_address,c.ship_address,c.ship_country, c.ship_state, c.ship_city, c.ship_zip_code, c.billing_address, c.bill_address, c.bill_country, c.bill_state, c.bill_city, c.bill_zip_code,cur.symbol,mcc.id as mcc_id,mcc_cat.id as mcc_cat_id"
        )
        .from(config.table_prefix + "inv_invoice_master inv")
        .join(
          config.table_prefix + "inv_customer c",
          "inv.customer_id=c.id",
          "inner"
        )
        .join(
          config.table_prefix + "master_currency cur",
          "inv.currency=cur.code",
          "left"
        )
        .join(
          config.table_prefix + "master_merchant_details mde",
          "inv.sub_merchant_id=mde.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mcc",
          "mde.mcc_codes=mcc.id",
          "left"
        )
        .join(
          config.table_prefix + "master_mcc_category mcc_cat",
          "mcc.category=mcc_cat.id",
          "left"
        )
        .where({ "inv.id": condition.id })
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateDynamic: async (data, condition, table_name) => {
    let db_table = config.table_prefix + table_name;
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
  selectDynamic: async (selection, condition, table) => {
    let db_table = config.table_prefix + table;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  add_sharing_logs: async (data) => {
    let db_table = config.table_prefix + "invoice_sharing_logs";
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
  select_txn_date: async (id, order) => {
    let order_id = await helpers.get_inv_order_by_cust_id(id);
    let cond = "";
    if (order_id) {
      cond = " and order_id=" + order_id;
    }
    let query =
      "SELECT inv.created_at FROM " +
      inv_table +
      " as inv inner join " +
      config.table_prefix +
      "orders as ord on inv.order_id=ord.order_id where inv.customer_id =" +
      id +
      " and ( ord.status='AUTHORISED' or ord.status='CAPTURED' ) order by created_at " +
      order +
      " LIMIT 1";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY HH:mm:ss");
    } else {
      return "-";
    }
  },
  selectCustomer: async (and_condition, limit, date_condition, like_search) => {
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

    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );

      if (final_cond == " where ") {
        final_cond = final_cond + date_like_search_str;
      } else {
        final_cond = final_cond + " and ( " + date_like_search_str + ")";
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    // let query = "select * from " + inv_table + final_cond + " order BY ID DESC limit " + limit.start + "," + limit.perpage
    if (limit.perpage) {
      var query =
        "SELECT *  FROM " +
        db_table +
        final_cond +
        " order BY ID DESC limit " +
        limit.start +
        "," +
        limit.perpage;
    } else {
      var query =
        "SELECT *  FROM " + db_table + final_cond + " order BY ID DESC ";
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  get_count_cust: async (and_condition, date_condition, like_search) => {
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
    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );

      if (final_cond == " where ") {
        final_cond = final_cond + date_like_search_str;
      } else {
        final_cond = final_cond + " and ( " + date_like_search_str + ")";
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }
    let query = "SELECT COUNT(*) as total FROM " + db_table + final_cond + "";
    console.log(query);

    let qb = await pool.get_connection();
    let response;

    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].total;
  },
  get_count_mid: async (table, condition) => {
    let final_cond = " where ";
    if (Object.keys(condition).length) {
      let condition_str = await helpers.get_and_conditional_string(condition);
      final_cond = final_cond + condition_str;
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count(*) as total from " +
      config.table_prefix +
      table +
      final_cond;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.total;
  },
  list_of_payment: async (condition, mode) => {
    if (mode == "test") {
      table = "test_orders o";
      txn_table = "test_order_txn txn";
    } else {
      table = "orders o";
      txn_table = "order_txn txn";
    }
    let response;
    const qb = await pool.get_connection();

    try {
      response = await qb
        .select(
          "txn.payment_id,o.currency,o.amount,o.customer_name,o.customer_email,o.status,o.order_id"
        )
        .from(config.table_prefix + table)
        .join(
          config.table_prefix + txn_table,
          "o.order_id=txn.order_id",
          "left"
        )
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    let result = [];
    response.forEach(async (element) => {
      result.push({
        order_id: element.order_id,
        payment_id:
          element.payment_id == "" ? "not available" : element.payment_id,
        name: element.customer_name,
        email: element.customer_email,
        amount: element.amount,
        currency: element.currency,
        payment_status: element.status,
      });
    });
    return result;
  },
  select_open_txn_date: async (id, order, mode) => {
    let order_id = await helpers.get_inv_order_by_cust_id(id);
    let cond = "";
    if (order_id) {
      cond = " and order_id=" + order_id;
    }
    if (mode == "test") {
      table = "test_orders as ord";
    } else {
      table = "orders as ord";
    }
    let query =
      "SELECT inv.created_at FROM " +
      inv_table +
      " as inv inner join " +
      config.table_prefix +
      table +
      " on inv.order_id=ord.order_id where inv.customer_id =" +
      id +
      " and ( ord.status='AUTHORISED' or ord.status='CAPTURED' ) order by created_at " +
      order +
      " LIMIT 1";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY HH:mm:ss");
    } else {
      return "-";
    }
  },
};
module.exports = qbModel;
