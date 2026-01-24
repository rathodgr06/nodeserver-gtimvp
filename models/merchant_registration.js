const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const db_table = config.table_prefix + "master_merchant";
const super_merchant_table = config.table_prefix + "master_super_merchant";
const details_table = config.table_prefix + "master_merchant_details";
const reset_table = config.table_prefix + "master_merchant_password_reset";
const two_fa_table = config.table_prefix + "twofa_authenticator";
const tc_accepted = config.table_prefix + "tc_accepted";
const referrer = config.table_prefix + "referrers";
const helpers = require("../utilities/helper/general_helper");
const { selectOneDynamic } = require("./subs_plan_model");
const meeting_table = config.table_prefix + "merchant_meetings";
const moment = require("moment");
var MerchantRegistrationModel = {
  register: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(super_merchant_table, data);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addDetails: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(details_table, data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addTC: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(tc_accepted, data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addResetPassword: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(reset_table, data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_id")
        .where(condition)
        .get(reset_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectWithSelection: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(super_merchant_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  countMerchant: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "SELECT count(id) as count FROM `pg_master_merchant` WHERE `super_merchant_id` = " +
          id +
          " ",
      );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  update: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  updateReferrer: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(referrer);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  update_super_merchant: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(super_merchant_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  updateResetPassword: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(reset_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  add_two_fa: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(two_fa_table, data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
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
        .select("t.merchant_id,t.secret,m.email")
        .from(two_fa_table + " t")
        .join(super_merchant_table + " m", "t.merchant_id=m.id", "inner")
        .where(condition)
        .get();
      // console.log("Query Ran: " + qb.last_query());
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  update2fa: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(two_fa_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  select_merchant_user: async (condition_obj, or_cond, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let search = await helpers.get_conditional_or_string(or_cond);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      try {
        if (Object.keys(filter).length) {
          if (search == "") {
            response = await qb.query(
              "select * from " +
                super_merchant_table +
                " where " +
                condition +
                "and (" +
                search_text +
                ") order by id desc LIMIT " +
                limit.perpage +
                limit.start,
            );
          } else {
            response = await qb.query(
              "select * from " +
                super_merchant_table +
                " where " +
                condition +
                "and (" +
                search +
                ") and (" +
                search_text +
                ") order by id desc LIMIT " +
                limit.perpage +
                limit.start,
            );
          }
        } else {
          if (search == "") {
            response = await qb.query(
              "select * from " +
                super_merchant_table +
                " where " +
                condition +
                "order by id desc LIMIT " +
                limit.perpage +
                limit.start,
            );
          } else {
            response = await qb.query(
              "select * from " +
                super_merchant_table +
                " where " +
                condition +
                "and (" +
                search +
                ") order by id desc LIMIT " +
                limit.perpage +
                limit.start,
            );
          }
        }
      } catch (error) {
        logger.error(500, { message: error, stack: error.stack });
      } finally {
        qb.release();
      }
    } else {
      try {
        if (Object.keys(filter).length) {
          response = await qb.query(
            "select * from " +
              super_merchant_table +
              " where " +
              condition +
              " and (" +
              search +
              ")  and (" +
              search_text +
              ") order by id desc",
          );
        } else {
          response = await qb.query(
            "select * from " +
              super_merchant_table +
              " where " +
              condition +
              " and (" +
              search +
              ") order by id desc ",
          );
        }
      } catch (error) {
        logger.error(500, { message: error, stack: error.stack });
      } finally {
        qb.release();
      }
    }

    return response;
  },
  get_count: async (condition_obj, or_cond, filter) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let search = await helpers.get_conditional_or_string(or_cond);
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let qb = await pool.get_connection();
    try {
      if (Object.keys(filter).length) {
        if (search == "") {
          response = await qb.query(
            "select count('id') as count from " +
              super_merchant_table +
              " where " +
              condition +
              "and (" +
              search_text +
              ")",
          );
        } else {
          response = await qb.query(
            "select count('id') as count from " +
              super_merchant_table +
              " where " +
              condition +
              "and (" +
              search_text +
              ") and (" +
              search +
              ")",
          );
        }
      } else {
        if (search == "") {
          response = await qb.query(
            "select count('id') as count from " +
              super_merchant_table +
              " where " +
              condition,
          );
        } else {
          response = await qb.query(
            "select count('id') as count from " +
              super_merchant_table +
              " where " +
              condition +
              "and (" +
              search +
              ")",
          );
        }
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  selectSome: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(super_merchant_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
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
        .order_by("id", "desc")
        .get(super_merchant_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(super_merchant_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  insertMerchantDetails: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(details_table, data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  insertMerchantPaymentMethods: async (merchant_id) => {
    let defaultPaymentMethod = [
      "card_payment",
      "amex_card",
      "bank_transfer",
      "apple_pay",
      "samsung_pay",
      "htc_pay",
      "google_pay",
      "paypal",
      "stored_card",
      "pay_vault",
    ];
    let merchantPaymentMethodData = [];
    let i = 1;
    for (let method of defaultPaymentMethod) {
      let temp = {
        sub_merchant_id: merchant_id,
        methods: method,
        sequence: i,
        is_visible: 1,
      };
      merchantPaymentMethodData.push(temp);
      i++;
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(
          config.table_prefix + "merchant_payment_methods",
          merchantPaymentMethodData,
        );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  updateMeeting: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(meeting_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  updateallMeeting: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(meeting_table);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_meetings: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " +
          meeting_table +
          " where " +
          condition +
          " and status=0  and deleted=0",
      );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  insertMerchantPaymentMethodsForOnboardedMerchant: async (merchant_id) => {
    let defaultPaymentMethod = [
      "card_payment",
      "apple_pay",
      "stored_card",
      "pay_vault",
      "mobile_wallet",
    ];
    let merchantPaymentMethodData = [];
    let i = 1;
    for (let method of defaultPaymentMethod) {
      let temp = {
        sub_merchant_id: merchant_id,
        methods: method,
        sequence: i,
        is_visible: 1,
        mode: "test",
      };
      merchantPaymentMethodData.push(temp);
      i++;
    }
    i = 1;
    for (let method of defaultPaymentMethod) {
      let temp = {
        sub_merchant_id: merchant_id,
        methods: method,
        sequence: i,
        is_visible: 1,
        mode: "live",
      };
      merchantPaymentMethodData.push(temp);
      i++;
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(
          config.table_prefix + "merchant_payment_methods",
          merchantPaymentMethodData,
        );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  selectSuperMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id")
        .where(condition)
        .order_by("id", "desc")
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.super_merchant_id;
  },
  addDefaultDraft: async (merchant_id) => {
    let data = {
      submerchant_id: merchant_id,
      brand_color: "#FFFFFF",
      accent_color: "#4c64e6",
      language: 1,
      payment_methods: "",
      icon: "",
      font_name: "Proxima Nova Regular",
    };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "master_merchant_draft", data);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addDefaultDraftInherited: async (merchant_id, immediate_sub_merchant_id) => {
    const qb = await pool.get_connection();
    try {
      // 1️⃣ Read source draft
      const rows = await qb
        .select(
          "brand_color",
          "accent_color",
          "language",
          "payment_methods",
          "card_show",
          "font_name",
          "card_payment",
          "stored_card",
          "test_card_payment_scheme",
          "test_stored_card_scheme",
        )
        .where({ submerchant_id: immediate_sub_merchant_id })
        .get("pg_master_merchant_draft");

      if (!rows || rows.length === 0) {
        return null;
      }

      // 2️⃣ Insert cloned draft
      const row = rows[0];

      const insertData = {
        submerchant_id: merchant_id,
        brand_color: row.brand_color,
        accent_color: row.accent_color,
        language: row.language,
        payment_methods: row.payment_methods,
        card_show: row.card_show,
        font_name: row.font_name,
        card_payment: row.card_payment,
        stored_card: row.stored_card,
        test_card_payment_scheme: row.test_card_payment_scheme,
        test_stored_card_scheme: row.test_stored_card_scheme,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      return await qb.insert("pg_master_merchant_draft", insertData);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },
  get_receiver_details: async (sub_merchant_id) => {
    let condition = {
      merchant_id: sub_merchant_id,
    };
    let data = {
      merchant_id: sub_merchant_id,
    };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select([
          "pg_master_merchant.super_merchant_id",
          "pg_master_merchant_details.merchant_id",
          "pg_master_merchant_details.iban",
          "pg_master_merchant_details.address",
          "pg_master_merchant_details.register_business_country",
          "pg_master_merchant_details.company_name",
          "pg_country.country_code",
          "pg_city.city_name",
        ])
        .join(
          "pg_master_merchant_details",
          "pg_master_merchant.id = pg_master_merchant_details.merchant_id",
        )
        .join(
          "pg_country",
          "pg_country.id = pg_master_merchant_details.register_business_country",
        )
        .join(
          "pg_city",
          "pg_city.ref_state = pg_master_merchant_details.province",
        )
        .where(condition)
        .order_by("pg_master_merchant.id", "desc")
        .get("pg_master_merchant");
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_receivers_details_by_filters: async (req) => {
    var fullResponse = null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.per_page) || 10;
    const offset = (page - 1) * limit;

    let condition = { "pg_master_merchant.deleted": 0 };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select([
          "pg_master_merchant.super_merchant_id",
          "pg_master_merchant_details.merchant_id",
          "pg_master_merchant_details.name_on_the_bank_account",
          "pg_master_merchant_details.iban",
          "pg_master_merchant_details.msisdn",
          "pg_master_merchant_details.msisdn_country",
          "pg_master_merchant_details.bank_account_no",
          "pg_master_merchant_details.address",
          "pg_master_merchant_details.register_business_country",
          "pg_master_merchant_details.company_name",
          "pg_country.country_code",
          "pg_country.country_name",
          "pg_country.currency",
          "pg_country.currency_name",
          "pg_city.city_name",
        ])
        .join(
          "pg_master_merchant_details",
          "pg_master_merchant.id = pg_master_merchant_details.merchant_id",
        )
        .join(
          "pg_country",
          "pg_country.id = pg_master_merchant_details.register_business_country",
        )
        .join("pg_city", "pg_city.id = pg_master_merchant_details.city")
        .where(condition)
        .order_by("pg_master_merchant.id", "desc")
        .limit(limit)
        .offset(offset)
        .get("pg_master_merchant");
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }

    qb = await pool.get_connection();
    let totalRows;
    try {
      const countResult = await qb
        .select("COUNT(*) as total", false) // <-- this disables escaping
        .join(
          "pg_master_merchant_details",
          "pg_master_merchant.id = pg_master_merchant_details.merchant_id",
        )
        .join(
          "pg_country",
          "pg_country.id = pg_master_merchant_details.register_business_country",
        )
        .join(
          "pg_city",
          "pg_city.ref_state = pg_master_merchant_details.province",
        )
        .where({ "pg_master_merchant.deleted": 0 })
        .get("pg_master_merchant");

      totalRows = countResult[0]?.total || 0;
    } catch (error) {
      console.error("Failed to fetch total count:", error);
      totalRows = 0;
    }

    fullResponse = {
      data: response,
      page: page,
      per_page: limit,
      total_records: totalRows || 0,
      total_pages: Math.ceil((totalRows || 0) / limit),
    };
    return fullResponse;
  },
  addDefaultDraftsBatch: async (merchantIds) => {
    if (!merchantIds || merchantIds.length === 0) {
      return null;
    }

    try {
      // Assuming default draft structure - adjust based on your actual table schema
      const placeholders = merchantIds
        .map(() => "(?, ?, NOW(), NOW())")
        .join(", ");
      const values = [];

      merchantIds.forEach((merchantId) => {
        values.push(
          merchantId,
          "default", // or whatever your default draft status/type is
        );
      });

      const query = `
                INSERT INTO merchant_drafts 
                (submerchant_id, status, created_at, updated_at) 
                VALUES ${placeholders}
            `;

      const result = await db.query(query, values);
      console.log(`Batch inserted ${merchantIds.length} default drafts`);
      return result;
    } catch (error) {
      console.error("Error in addDefaultDraftsBatch:", error);
      throw error;
    }
  },
  get_submerchant_details: async (merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      const query = `SELECT sm.merchant_id as sub_merchant_id, mm.super_merchant_id, sm.company_name, con.country_name, con.country_code as register_business_country, mm.email, mm.code, mm.mobile_no, mm.referral_code FROM ${details_table} sm JOIN pg_master_merchant mm ON mm.id = sm.merchant_id JOIN pg_country con ON sm.register_business_country = con.id WHERE sm.merchant_id = ${merchant_id}`;
      response = await qb.query(query);
    } catch (error) {
      console.error("Error in addDefaultDraftsBatch:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectOneDyn: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table_name);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectAllDyn: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + table_name);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addProfileHistory: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "merchant_profile_history", data);
      console.log(response);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  updateDyn: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = MerchantRegistrationModel;
