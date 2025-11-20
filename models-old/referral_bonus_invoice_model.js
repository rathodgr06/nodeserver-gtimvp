require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "referral_bonus";
const dbtable3 = config.table_prefix + "referrers";
const dbtable2 = config.table_prefix + "referral_bonus_monthly_invoice";
const dbtable4 = config.table_prefix + "master_super_merchant";
const merchant_table = config.table_prefix + "master_merchant";
const merchant_details = config.table_prefix + "master_merchant_details";
const order_table = config.table_prefix + "orders";
const helpers = require("../utilities/helper/general_helper");
const mid_dbtable = config.table_prefix + "mid";
var dbModel = {
  addInvoice: async (data) => {
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
    let qb = await pool.get_connection();
    let response;
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
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_one: async (condition) => {
    let qb = await pool.get_connection();
    qb.select("*");
    qb.where(condition).order_by("id", "asc");
    let response;
    try {
      response = await qb.get(dbtable2);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  select_list: async (search, limit, date_condition) => {
    let qb = await pool.get_connection();
    let response;
    let final_cond = " where ";

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "payout_date"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    if (Object.keys(search).length) {
      let date_search_str = await helpers.get_and_conditional_string(search);
      if (final_cond == " where ") {
        final_cond = final_cond + date_search_str;
      } else {
        final_cond = final_cond + " and " + date_search_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    try {
      if (limit.perpage > 0) {
        let query =
          "select * from " +
          dbtable2 +
          final_cond +
          " order BY ID DESC limit " +
          limit.start +
          "," +
          limit.perpage;
        response = await qb.query(query);
      } else {
        let query =
          "select * from " + dbtable2 + final_cond + " order BY ID DESC ";
        response = await qb.query(query);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_list_: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage) {
      let response;
      try {
        if (Object.keys(condition).length !== 0) {
          qb.select("*");
          qb.where(condition).order_by("id", "desc");
          qb.limit(limit.perpage, limit.start);
          response = await qb.get(dbtable2);
        } else {
          qb.select("*");
          qb.order_by("id", "desc");
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
          qb.where(condition).order_by("id", "desc");
          response = await qb.get(dbtable2);
        } else {
          qb.select("*");
          qb.order_by("id", "desc");
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
  update: async (condition, data) => {
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
  get_count: async (condition_obj, date_condition) => {
    let qb = await pool.get_connection();
    var output_string = "";
    for (var key in condition_obj) {
      if (condition_obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + condition_obj[key] + " ";
      }
    }
    let final_cond = "";
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "payout_date"
      );

      final_cond = " and " + date_condition_str;
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    try {
      if (output_string != "") {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable2 +
            " where " +
            output_string1 +
            final_cond
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable2 + final_cond
        );
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  select_referral_list: async (date_condition, limit, search, like_search) => {
    let qb = await pool.get_connection();
    let response;
    let final_cond = " where ";

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

    if (Object.keys(search).length) {
      let date_search_str = await helpers.get_and_conditional_string(search);
      if (final_cond == " where ") {
        final_cond = final_cond + date_search_str;
      } else {
        final_cond = final_cond + " and " + date_search_str;
      }
    }

    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_like_string(
        like_search
      );
      // if (final_cond == " where ") {
      final_cond = final_cond + date_like_search_str;
      // } else {
      //     final_cond = final_cond + " and " + date_like_search_str;
      // }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    try {
      if (limit.perpage > 0) {
        let query =
          "select * from " +
          dbtable3 +
          final_cond +
          " order BY ID DESC limit " +
          limit.start +
          "," +
          limit.perpage;
        response = await qb.query(query);
      } else {
        let query =
          "select * from " + dbtable3 + final_cond + " order BY ID DESC ";
        response = await qb.query(query);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_referral_details: async (condition, date_condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    let final_cond = " where referral_code_used !=''";

    if (Object.keys(condition).length) {
      let data_str = await helpers.get_and_conditional_string(condition);
      if (final_cond == " where ") {
        final_cond = final_cond + data_str;
      } else {
        final_cond = final_cond + " and " + data_str;
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

    try {
      if (limit.perpage > 0) {
        let query =
          "select * from " +
          dbtable4 +
          final_cond +
          " order BY ID DESC limit " +
          limit.start +
          "," +
          limit.perpage;
        response = await qb.query(query);
      } else {
        let query =
          "select * from " +
          dbtable4 +
          " where referral_code_used = '" +
          condition.referral_code_used +
          "' order BY ID DESC ";
        response = await qb.query(query);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  get_referral_earning_count: async (date_condition, search, like_search) => {
    let qb = await pool.get_connection();
    // let query = "Select count('id') as count from pg_referrers where ";
    let response;
    let final_cond = " where ";

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

    if (Object.keys(search).length) {
      let date_search_str = await helpers.get_and_conditional_string(search);
      if (final_cond == " where ") {
        final_cond = final_cond + date_search_str;
      } else {
        final_cond = final_cond + " and " + date_search_str;
      }
    }

    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_like_string(
        like_search
      );
      // if (final_cond == " where ") {
      final_cond = final_cond + date_like_search_str;
      // } else {
      //     final_cond = final_cond + " and " + date_like_search_str;
      // }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    try {
      let query = "select count('id') as count from " + dbtable3 + final_cond;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  total_details_count: async (condition, date_condition) => {
    // let query = "Select count('id') as count from pg_referrers where ";
    let query_str = "";
    let response;
    let final_cond = " where referral_code_used!='' ";

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

    if (date_condition.from_date) {
      query_str = "select count('id') as count from " + dbtable4 + final_cond;
    } else {
      query_str = "select count('id') as count from " + dbtable4 + final_cond;
    }

    // let query =
    //     "select count('id') as count from " +
    //     dbtable4 +
    //     final_cond +
    //     " where referral_code_used = '" +
    //     condition.referral_code_used +
    //     "'";
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query_str);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_name: async (table, value) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where({ id: value })
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  merchant_invoice_list: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "n.status,n.id,n.referrer_id,r.full_name,n.no_of_successful_referral,n.bonus_earned_from_successful_referral,n.total_tax,n.total_bonus,n.created_at, n.payout_date"
        )
        .from(dbtable2 + " n")
        .join(dbtable3 + " r", "n.referrer_id=r.id", "inner")
        .where(condition)
        .limit(limit.perpage, limit.start)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  merchant_invoice_count: async (and_condition) => {
    let condition = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = condition_ob;
    }
    query =
      `SELECT count(n.id) as count FROM ` +
      dbtable2 +
      ` as n inner JOIN ` +
      dbtable3 +
      ` as r  ON n.referrer_id = r.id where ` +
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
    return response?.[0] ? response?.[0].count : 0;
  },
  get_merchant_referral_list: async (condition, search, limit) => {
    let final_cond = " where mm.referral_code !='' and s.mobile_no_verified=0 ";

    if (Object.keys(condition).length) {
      let data_str = await helpers.get_and_conditional_string(condition);
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
    let response;

    if (limit.perpage > 0) {
      let query =
        "select s.id,s.legal_business_name,s.email,s.code,s.mobile_no,s.referral_code_used,s.name from " +
        dbtable4 +
        " as s inner join " +
        merchant_table +
        " as mm on s.referral_code_used=mm.referral_code" +
        final_cond +
        " order BY s.id DESC limit " +
        limit.start +
        "," +
        limit.perpage;
      try {
        response = await qb.query(query);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    } else {
      let query =
        "select * from " +
        dbtable4 +
        " as s inner join " +
        merchant_table +
        " as mm on s.referral_code_used=mm.referral_code" +
        final_cond +
        " order BY s.id DESC limit ";
      try {
        response = await qb.query(query);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    }
  },
  merchant_referral_count: async (and_condition, search) => {
    let condition = " ";
    let search_cond = " ";
    if (Object.keys(and_condition).length) {
      condition_ob = await helpers.get_and_conditional_string(and_condition);
      condition = " and " + condition_ob;
    }

    if (Object.keys(search).length) {
      let data_str = await helpers.get_conditional_or_like_string(search);

      search_cond = " and ( " + data_str + " )";
    }
    query =
      `SELECT count(s.id) as count FROM ` +
      dbtable4 +
      ` as s inner JOIN ` +
      merchant_table +
      ` as mm  ON s.referral_code_used = mm.referral_code where mm.referral_code !='' and s.mobile_no_verified=0 ` +
      condition +
      search_cond;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0] ? response?.[0].count : 0;
  },
  selectMID: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(mid_dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  main_merchant_id: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id as merchant_id")
        .from(config.table_prefix + "master_merchant")
        .where(condition)
        .order_by("id", "asc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].merchant_id;
  },
  get_merchant_referral_bonus: async (
    condition,
    date_condition,
    limit,
    like_search
  ) => {
    let final_cond = " where sm.email_verified=1";

    if (Object.keys(condition).length) {
      let data_str = await helpers.get_and_conditional_string(condition);
      if (final_cond == " where ") {
        final_cond = final_cond + data_str;
      } else {
        final_cond = final_cond + " and " + data_str;
      }
    }
    if (Object.keys(like_search).length) {
      let like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );
      if (final_cond == " where ") {
        final_cond = final_cond + like_search_str;
      } else {
        final_cond = final_cond + " and ( " + like_search_str + " )";
      }
    }

    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "m.register_at"
      );
      let date_condition_sm = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sm.register_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond =
          final_cond +
          " and ( " +
          date_condition_str +
          " or " +
          date_condition_sm +
          " )";
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let qb = await pool.get_connection();
    let response;

    if (limit.perpage > 0) {
      let query =
        "select m.id,sm.id as supermerchant_id,m.register_at,sm.register_at as super_merchant_register_date,sm.email,mm.merchant_id,mm.legal_person_email,mm.home_phone_code,mm.home_phone_number,mm.company_name,ref.referral_code,m.super_merchant_id,sm.legal_business_name from " +
        dbtable3 +
        " as ref  inner join " +
        dbtable4 +
        "  as sm on sm.referral_code_used=ref.referral_code left join  " +
        merchant_table +
        " as m on m.super_merchant_id=sm.id left join " +
        merchant_details +
        "  as mm on mm.merchant_id=m.id" +
        final_cond +
        " order BY sm.id DESC limit " +
        limit.start +
        "," +
        limit.perpage;

      try {
        response = await qb.query(query);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    } else {
      let query =
        "select m.id,ref.id as referrer_id,m.register_at,mm.merchant_id,mm.legal_person_email,mm.home_phone_code,mm.home_phone_number,mm.company_name,ref.referral_code,m.super_merchant_id,sm.legal_business_name from " +
        dbtable3 +
        " as ref  left join " +
        dbtable4 +
        "  as sm on sm.referral_code_used=ref.referral_code left join  " +
        merchant_table +
        " as m on m.super_merchant_id=sm.id left join " +
        merchant_details +
        "  as mm on mm.merchant_id=m.id " +
        final_cond;
      try {
        response = await qb.query(query);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
      return response;
    }
  },
  get_merchant_referral_bonus_count: async (
    condition,
    date_condition,
    like_search
  ) => {
    let final_cond = " where  sm.email_verified=1";

    if (Object.keys(condition).length) {
      let data_str = await helpers.get_and_conditional_string(
        condition,
        date_condition,
        like_search
      );
      if (final_cond == " where ") {
        final_cond = final_cond + data_str;
      } else {
        final_cond = final_cond + " and " + data_str;
      }
    }

    if (Object.keys(like_search).length) {
      let like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );
      if (final_cond == " where ") {
        final_cond = final_cond + like_search_str;
      } else {
        final_cond = final_cond + " and ( " + like_search_str + " )";
      }
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "m.register_at"
      );
      let date_condition_sm = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "sm.register_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond =
          final_cond +
          " and ( " +
          date_condition_str +
          " or " +
          date_condition_sm +
          " )";
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count(m.id)  as count from " +
      dbtable3 +
      " as ref  left join " +
      dbtable4 +
      "  as sm on sm.referral_code_used=ref.referral_code left join  " +
      merchant_table +
      " as m on m.super_merchant_id=sm.id left join " +
      merchant_details +
      "  as mm on mm.merchant_id=m.id" +
      final_cond;

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
};

module.exports = dbModel;
