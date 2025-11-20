const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "referrers";
const onboard = config.table_prefix + "master_super_merchant";
const merchant_table = config.table_prefix + "master_merchant";
const reset_table = config.table_prefix + "master_referrer_password_reset";
const helpers = require("../utilities/helper/general_helper");
const { date } = require("joi");
const two_fa_table = config.table_prefix + "twofa_referrer";
const referral_bonus = config.table_prefix + "referral_bonus";
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectSome: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response;
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
        .select("t.referrer_id,t.secret,m.email")
        .from(two_fa_table + " t")
        .join(dbtable + " m", "t.referrer_id=m.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectWithSelection: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  addResetPassword: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(reset_table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select_referrer_id: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("referrer_id")
        .where(condition)
        .get(reset_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  select: async (condition_ob, limit, search) => {
    let response;
    let final_cond = " where ";
    if (Object.keys(condition_ob).length) {
      let data_str = await helpers.get_and_conditional_string(condition_ob);
      if (final_cond == " where ") {
        final_cond = final_cond + data_str;
      } else {
        final_cond = final_cond + " and " + data_str;
      }
    }
    if (Object.keys(search).length) {
      let data_str = await helpers.get_conditional_or_like_string(search);
      if (final_cond == " where ") {
        final_cond = final_cond + " ( " + data_str + " )";
      } else {
        final_cond = final_cond + " and ( " + data_str + " )";
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let qb = await pool.get_connection();
    try {
      if (limit.perpage) {
        let query =
          "select * from " +
          dbtable +
          final_cond +
          " order BY id DESC limit " +
          limit.start +
          "," +
          limit.perpage;

        response = await qb.query(query);
      } else {
        let query =
          "select * from " + dbtable + final_cond + " order BY id DESC limit ";

        response = await qb.query(query);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getTotalAmount: async ({ referrer_id, from_date, to_date }) => {
    let sql = `SELECT
                            SUM(referring_amount) AS total_referred_amount,
                            SUM(captured_amount) AS total_captured_amount,
                            SUM(void_credit_amount) AS total_void_credit_amount,
                            SUM(void_debit_amount) AS total_void_debit_amount,
                            SUM(refund_amount) AS total_refund_amount
                        FROM
                            (
                            SELECT
                                SUM(
                                    CASE WHEN txn_type IS NULL AND order_status IS NULL THEN amount_to_settle ELSE 0
                                END
                        ) AS referring_amount,
                        SUM(
                            CASE WHEN txn_type = 'CAPTURE' THEN amount_to_settle ELSE 0
                        END
                        ) AS captured_amount,
                        SUM(
                            CASE WHEN txn_type = 'VOID' AND void_status = 'CREDIT' THEN amount_to_settle ELSE 0
                        END
                        ) AS void_credit_amount,
                        SUM(
                            CASE WHEN txn_type = 'VOID' AND void_status = 'DEBIT' THEN amount_to_settle ELSE 0
                        END
                        ) AS void_debit_amount,
                        SUM(
                            CASE WHEN txn_type = 'PARTIAL_REFUND' || txn_type = 'REFUND' THEN amount_to_settle ELSE 0
                        END
                        ) AS refund_amount
                        FROM
                            ${config.table_prefix}referral_bonus
                        WHERE
                            referrer_id = ${referrer_id} AND DATE(created_at) BETWEEN '${from_date}' AND '${to_date}'
                        GROUP BY
                            order_status,
                            txn_id
                        ) subquery;`;
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getBonusData: async (cur_month_earning_result) => {
    let total_count = 0;
    let total_amount = 0.0;
    let total_tax = 0.0;
    let total_bonus = 0.0;

    const {
      total_referred_amount,
      total_captured_amount,
      total_void_credit_amount,
      total_void_debit_amount,
      total_refund_amount,
    } = cur_month_earning_result[0];

    total_amount = total_bonus =
      total_referred_amount +
      total_captured_amount +
      total_void_credit_amount -
      (total_void_debit_amount + total_refund_amount);

    let inv_data = {
      no_of_successful_referral: total_count,
      bonus_earned_from_successful_referral: total_amount.toFixed(2),
      total_tax: total_tax.toFixed(2),
      total_bonus: total_bonus.toFixed(2),
    };

    return inv_data;
  },
  selectSpecific: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
      logger.error(500,{message: error,stack: error.stack}); 
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
      response = await qb.set(data).where(condition).update(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  update_referral_bonus: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(referral_bonus);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj, search) => {
    let search_str = "";

    if (Object.keys(search).length) {
      let data_str = await helpers.get_conditional_or_like_string(search);

      search_str = " and ( " + data_str + " )";
    }
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_and_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " +
          dbtable +
          " where " +
          condition +
          search_str
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_count_onboarding: async () => {
    let qb = await pool.get_connection();
    // let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    try {
      response = await qb.query("select count('id') as count from " + onboard);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  add_two_fa: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "twofa_referrer", data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
        .select("t.referrer_id,t.secret,r.email")
        .from(config.table_prefix + "twofa_referrer" + " t")
        .join(dbtable + " r", "t.referrer_id=r.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  update2fa: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + "twofa_referrer");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select_referrer: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  select2falogin: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("t.referrer_id,r.two_fa_secret as secret,r.email")
        .from(config.table_prefix + "twofa_referrer" + " t")
        .join(dbtable + " r", "t.referrer_id=r.id", "inner")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },

  onboarding_list: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.where(condition).get(onboard);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_data_referrer: async (referral, live) => {
    let qb = await pool.get_connection();

    let response;

    let select = "count(m.id) as total";

    try {
      response = await qb.query(
        "select " +
          select +
          " from " +
          merchant_table +
          " as m left join " +
          onboard +
          " as s on m.super_merchant_id=s.id where s.live=" +
          live +
          " and s.email_verified=1 and m.referral_code_used=" +
          `'${referral}'`
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].total;
  },
  onboarding_select: async (
    and_condition,
    filter,
    date_condition,
    limit,
    search_by_id
  ) => {
    let response;
    let final_cond =
      " where sm.password IS NOT NULL AND sm.password <> '' AND sm.mobile_no_verified = 0 and sm.email_verified=1 AND ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    if (Object.keys(filter).length) {
      let search_text = await helpers.get_conditional_or_like_string(filter);
      if (final_cond == " where ") {
        final_cond = final_cond + "(" + search_text + ")";
      } else {
        final_cond = final_cond + " and (" + search_text + ")";
      }
    }
    if (Object.keys(search_by_id).length) {
      final_cond =
        final_cond +
        " and (m.id = " +
        search_by_id.id +
        " or sm.id=" +
        search_by_id.id +
        " )";
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sm.register_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (
      final_cond ==
      " where sm.password IS NOT NULL AND password <> '' AND sm.email_verified = 1 and sm.mobile_no_verified = 0 AND "
    ) {
      final_cond =
        " where sm.password IS NOT NULL AND password <> '' AND sm.email_verified = 1 and sm.mobile_no_verified = 0 ";
    }

    let query =
      "select sm.legal_business_name,sm.mobile_no,sm.email,sm.code,sm.id,m.id as submerchant_id,sm.register_at,sm.updated_at,sm.email_verified,sm.mobile_no_verified,sm.password,sm.live,sm.referral_code_used,m.onboarding_done,m.ekyc_required,m.ekyc_done from " +
      onboard +
      " as sm left join " +
      merchant_table +
      " as m on m.email=sm.email" +
      final_cond +
      " order BY ID DESC limit " +
      limit.start +
      "," +
      limit.perpage;

    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  get_count_data_referrer_: async (referral, live) => {
    let select = "count(m.id) as total";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select " +
          select +
          " from " +
          merchant_table +
          " as m left join " +
          onboard +
          " as s on m.super_merchant_id=s.id where  s.email_verified=1 and m.referral_code_used=" +
          `'${referral}'`
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].total;
  },
  get_count_data: async (condition_obj) => {
    let condition = await helpers.get_and_conditional_string(condition_obj);

    let select = "count(id) as total";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select " + select + " from " + merchant_table + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].total;
  },
  get_count_merchant_modified: async (
    and_condition,
    filter,
    date_condition,
    search_by_id
  ) => {
    let final_cond =
      " where sm.password IS NOT NULL AND sm.password <> '' AND sm.email_verified = 1 and sm.mobile_no_verified = 0 AND ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(filter).length) {
      let search_text = await helpers.get_conditional_or_like_string(filter);
      if (final_cond == " where ") {
        final_cond = final_cond + "(" + search_text + ")";
      } else {
        final_cond = final_cond + " and (" + search_text + ")";
      }
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sm.register_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (Object.keys(search_by_id).length) {
      final_cond =
        final_cond +
        " and (m.id = " +
        search_by_id.id +
        " or sm.id=" +
        search_by_id.id +
        " )";
    }
    if (
      final_cond ==
      " where sm.password IS NOT NULL AND sm.password <> '' AND sm.email_verified = 1 and sm.mobile_no_verified = 0 AND "
    ) {
      final_cond =
        " where sm.password IS NOT NULL AND sm.password <> '' AND sm.email_verified = 1 and sm.mobile_no_verified = 0 ";
    }

    let query =
      "select count('sm.id') as count from " +
      onboard +
      " as sm left join " +
      merchant_table +
      " as m on m.email=sm.email" +
      final_cond;

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
  get_count_merchant: async (and_condition, filter, date_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }

    if (Object.keys(filter).length) {
      let search_text = await helpers.get_conditional_or_like_string(filter);
      if (final_cond == " where ") {
        final_cond = final_cond + "(" + search_text + ")";
      } else {
        final_cond = final_cond + " and (" + search_text + ")";
      }
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "register_at"
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

    let query = "select count('id') as count from " + onboard + final_cond;

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

  select_rewards: async (
    condition,
    limit,
    search,
    date_condition,
    search_by_id
  ) => {
    let final_cond = " where ";

    if (Object.keys(condition).length) {
      let condition_str = await helpers.get_and_conditional_string(condition);
      final_cond = final_cond + condition_str;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "rb.created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (Object.keys(search).length) {
      let searchcondition = await helpers.get_conditional_or_like_string(
        search
      );
      final_cond = final_cond + " AND (" + searchcondition + ")";
    }
    if (Object.keys(search_by_id).length) {
      if (search_by_id.name) {
        let str = await helpers.get_merchant_id_by_name_from_details(
          "submerchant_id",
          search_by_id.name
        );
        if (str) {
          final_cond =
            final_cond === " where "
              ? (final_cond = final_cond + str)
              : (final_cond = final_cond + " and " + str);
        }
      }
      if (search_by_id.super_merchant_name) {
        let str = await helpers.get_supermerchant_id_by_name(
          "super_merchant_id",
          search_by_id.super_merchant_name
        );
        if (str) {
          final_cond =
            final_cond === " where "
              ? (final_cond = final_cond + str)
              : (final_cond = final_cond + " and " + str);
        }
      }
      if (search_by_id.id) {
        final_cond =
          final_cond +
          " and (rb.super_merchant_id = " +
          search_by_id.id +
          " or rb.submerchant_id=" +
          search_by_id.id +
          " )";
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "";
    if (limit.perpage > 0) {
      //query = `SELECT rb.*, o.status FROM ${referral_bonus} as rb
      //       LEFT JOIN pg_orders o ON rb.order_id = o.order_id ${final_cond}  ORDER BY id DESC LIMIT ${limit.perpage} OFFSET ${limit.start}`;
      query = `SELECT rb.* FROM ${referral_bonus} as rb  ${final_cond}  ORDER BY id DESC LIMIT ${limit.perpage} OFFSET ${limit.start}`;
    } else {
      // query = `SELECT rb*, o.status FROM ${referral_bonus} as rb
      //         LEFT JOIN pg_orders o ON rb.order_id = o.order_id
      //         ${final_cond} ORDER BY id DESC`;
      query = `SELECT rb* FROM ${referral_bonus} as rb
                    ${final_cond} ORDER BY id DESC`;
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

    return response;
  },

  // select_rewards: async (condition, limit, search,date_condition) => {

  //     let qb = await pool.get_connection();
  //     let response;
  //     if (limit.perpage) {
  //         qb.select("*");
  //         qb.where(condition).order_by("id", "desc");
  //         if(date_condition.from_date && date_condition.to_date){
  //             qb.where('created_at >=',date_condition.from_date);
  //             qb.where('created_at <=',date_condition.to_date);
  //         }
  //         // if (Object.keys(search).length) {

  //         // }

  //         if (search != "") {
  //             qb.like(
  //                 { ref_no: search.ref_no },
  //                 "ref_no",
  //                 "%" + search.ref_no,
  //                 true,
  //                 null
  //             );
  //             qb.or_like(
  //                 { remark: search.remark },
  //                 "remark",
  //                 "%" + search.remark,
  //                 true,
  //                 null
  //             );
  //         }
  //         // if (search != "") {
  //         //     qb.like({ ref_no: search }, null, "before", "after");
  //         //     qb.or_like({ remark: search }, null, "before", "after");
  //         // }

  //         qb.limit(limit.perpage, limit.start);
  //         response = await qb.get(referral_bonus);

  //         qb.release();
  //         return response;
  //     } else {
  //         qb.select("*");
  //         qb.where(condition).order_by("id", "desc");
  //         if(date_condition.from_date && date_condition.to_date){
  //             qb.where('created_at >=',date_condition.from_date);
  //             qb.where('created_at <=',date_condition.to_date);
  //         }

  //         if (search != "") {
  //             qb.like({ ref_no: search }, null, "before", "after");
  //             qb.or_like({ remark: search }, null, "before", "after");
  //         }
  //         response = await qb.get(referral_bonus);

  //         qb.release();

  //         return response;
  //     }
  // },

  get_reward_count: async (condition, search, date_condition, search_by_id) => {
    let final_cond = " where ";

    if (Object.keys(condition).length) {
      let condition_str = await helpers.get_and_conditional_string(condition);
      final_cond = final_cond + condition_str;
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "rb.created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (Object.keys(search).length) {
      let searchcondition = await helpers.get_conditional_or_like_string(
        search
      );
      final_cond = final_cond + " AND (" + searchcondition + ")";
    }
    if (Object.keys(search_by_id).length) {
      if (search_by_id.name) {
        let str = await helpers.get_merchant_id_by_name_from_details(
          "submerchant_id",
          search_by_id.name
        );
        if (str) {
          final_cond =
            final_cond === " where "
              ? (final_cond = final_cond + str)
              : (final_cond = final_cond + " and " + str);
        }
      }
      if (search_by_id.super_merchant_name) {
        let str = await helpers.get_supermerchant_id_by_name(
          "super_merchant_id",
          search_by_id.super_merchant_name
        );
        if (str) {
          final_cond =
            final_cond === " where "
              ? (final_cond = final_cond + str)
              : (final_cond = final_cond + " and " + str);
        }
      }
      if (search_by_id.id) {
        final_cond =
          final_cond +
          " and (rb.super_merchant_id = " +
          search_by_id.id +
          " or rb.submerchant_id=" +
          search_by_id.id +
          " )";
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count('rb.id') as count FROM " +
      referral_bonus +
      " as rb LEFT JOIN pg_orders  o ON rb.order_id = o.order_id " +
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
    return response?.[0].count;
  },
  merchant_bonus_list: async () => {},
  getReferrerBonus: async (db_condition_parm) => {
    const {
      limit,
      merchant_id,
      date_range,
      search,
      selected_merchant,
      all_referrer_result,
      search_by_id,
      condition,
    } = db_condition_parm;
    let limitCon = "";
    let date_condition = "";
    let search_condition = "";
    let final_cond = "";
    let condition_obj = "";

    if (limit.perpage > 0) {
      limitCon = "limit " + limit.start + "," + limit.perpage;
    }

    if (date_range.start_date && date_range.end_date) {
      const { start_date, end_date } = date_range;
      if (start_date === end_date) {
        date_condition = `AND date(rb.created_at) = '${start_date}' `;
      } else {
        date_condition = `AND date(rb.created_at) BETWEEN '${start_date}' AND '${end_date}' `;
      }
    }

    if (search) {
      search_condition = `AND (rb.ref_no LIKE '%${search}%' OR  rb.remark LIKE '%${search}%')`;
    }
    if (Object.keys(condition).length) {
      let condition_str = await helpers.get_and_conditional_string(condition);
      condition_obj = ` and ` + condition_str;
    }

    if (Object.keys(search_by_id).length) {
      if (search_by_id.name) {
        let str = await helpers.get_merchant_id_by_name_from_details(
          "rb.submerchant_id",
          search_by_id.name
        );
        if (str) {
          final_cond = " and " + str;
        }
      }
      if (search_by_id.super_merchant_name) {
        let str = await helpers.get_supermerchant_id_by_name(
          "rb.super_merchant_id",
          search_by_id.super_merchant_name
        );
        if (str) {
          final_cond = " and " + str;
        }
      }
      if (search_by_id.id) {
        final_cond =
          " and (rb.super_merchant_id = " +
          search_by_id.id +
          " or rb.submerchant_id=" +
          search_by_id.id +
          " )";
      }
    }
    const payment_status = "CAPTURED";

    let sql = `SELECT
                    order_status,
                    md.company_name,
                    rb.*
                    FROM ${config.table_prefix}referral_bonus rb 
                    LEFT JOIN ${config.table_prefix}orders o on rb.order_id = o.order_id
                    LEFT JOIN ${config.table_prefix}referrers ref on ref.id = rb.referrer_id
                    LEFT JOIN ${config.table_prefix}master_merchant_details md on o.merchant_id = md.merchant_id
                    WHERE rb.referrer_id in (${all_referrer_result.referrer_id_str})   
                    ${date_condition}  
                    ${search_condition}
                    ${condition_obj}
                    ${final_cond}
                    ORDER BY id desc
                    ${limitCon}
                    `;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  getAllReferrer: async (merchant_id, selected_merchant = null) => {
    let ids_str = "";
    if (selected_merchant) {
      ids_str = await getSelectedReferrerOfSubMerchant(selected_merchant);
      return ids_str;
    } else {
      let ids_sub_merchant_str = await getAllSubMerchantOfSuperMerchant(
        merchant_id
      );
      ids_str = await getSelectedReferrerOfSubMerchant(
        ids_sub_merchant_str.sub_merchant_id_str
      );
      return ids_str;
    }
  },
  get_bonus_count: async (merchant_id) => {
    let sql = `SELECT
                        count(rb.id) as total
                    FROM
                        ${config.table_prefix}referrers rf
                        LEFT JOIN ${config.table_prefix}referral_bonus rb on rb.referrer_id = rf.id
                        LEFT JOIN ${config.table_prefix}master_super_merchant mm on rf.referral_code = mm.referral_code
                        LEFT JOIN ${config.table_prefix}orders o on rb.order_id = o.order_id
                        LEFT JOIN ${config.table_prefix}master_merchant_details md on o.merchant_id = md.merchant_id 
                        WHERE mm.id = ${merchant_id} AND(
                            o.status = 'CAPTURED' OR rb.order_id = '' OR rb.order_id IS NULL
                        )
                    `;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return response?.[0].total;
    }
  },
  main_merchant_details: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "id as merchant_id,super_merchant_id,onboarding_done,ekyc_required,ekyc_done,mode"
        )
        .from(config.table_prefix + "master_merchant")
        .where(condition)
        .order_by("id", "asc")
        .limit(1)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_due_referral_amount: async (and_condition, date_condition) => {
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

    let query =
      "select amount_to_settle,void_status,order_status,currency from " +
      referral_bonus +
      final_cond;

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
};

async function getSelectedReferrerOfSubMerchant(sub_merchant_id) {
  let sql = `SELECT
                    GROUP_CONCAT(rf.id SEPARATOR ',') AS referrer_id_str
                FROM
                    ${config.table_prefix}referrers rf
                LEFT JOIN ${config.table_prefix}master_merchant msm ON
                    msm.referral_code = rf.referral_code
                WHERE
                    msm.id in (${sub_merchant_id})`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }

  return response?.[0];
}
async function getAllSubMerchantOfSuperMerchant(sup_merchant_id) {
  let sql = `SELECT
                    GROUP_CONCAT(mm.id SEPARATOR ',') AS sub_merchant_id_str
                FROM ${config.table_prefix}master_merchant mm 
                WHERE
                    mm.super_merchant_id = ${sup_merchant_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
  } finally {
    qb.release();
  }

  return response?.[0];
}

module.exports = dbModel;
