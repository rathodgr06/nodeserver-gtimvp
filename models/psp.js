const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const mcc_dbtable = config.table_prefix + "mcc_codes";
const mcc_cate_dbtable = config.table_prefix + "master_mcc_category";
const psp_table = config.table_prefix + "psp";
const buyrate_master_table = config.table_prefix + "master_buyrate";
const sellrate_master_table = config.table_prefix + "master_mid_sellrate";
const buyrate_table = config.table_prefix + "psp_buyrate";
const sellrate_table = config.table_prefix + "mid_sellrate";
const buyrate_promo_table = config.table_prefix + "psp_promo_buyrate";
const sellrate_promo_table = config.table_prefix + "mid_promo_sellrate";
const salerate_table = config.table_prefix + "master_psp_salerate";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");

var PspModel = {
  selectAll: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(mcc_dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(psp_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_buyrate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(buyrate_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_sellrate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(sellrate_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_promo_buyrate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(buyrate_promo_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_promo_sellrate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(sellrate_promo_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_master_buy_rate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(buyrate_master_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_master_sell_rate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(sellrate_master_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_salerate: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(salerate_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_buyrate_details: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_master_buyrate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(buyrate_master_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_master_sellrate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(sellrate_master_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_promo_buyrate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(buyrate_promo_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_promo_sellrate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(sellrate_promo_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_salerate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(salerate_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (
    selection,
    limit,
    and_conditions,
    and_or_condtions,
    like_conditions
  ) => {
    let limitCon = "";
    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }
    let qb = await pool.get_connection();
    let response;
    try {
      if (
        Object.keys(like_conditions).length &&
        Object.keys(and_or_condtions).length
      ) {
        let condition = await helpers.get_and_conditional_string(
          and_conditions
        );
        let search_text = await helpers.get_conditional_or_like_string(
          like_conditions
        );
        let psp = await helpers.get_conditional_like_string(and_or_condtions);

        response = await qb.query(
          "select " +
            selection +
            " from " +
            psp_table +
            " where " +
            condition +
            psp +
            " and (" +
            search_text +
            ")" +
            " order BY ID DESC " +
            limitCon
        );
        //   console.log(qb.last_query());
      } else if (Object.keys(like_conditions).length) {
        let condition = await helpers.get_and_conditional_string(
          and_conditions
        );
        let search_text = await helpers.get_conditional_or_like_string(
          like_conditions
        );
        response = await qb.query(
          "select " +
            selection +
            " from " +
            psp_table +
            " where " +
            condition +
            " and (" +
            search_text +
            ")" +
            " order BY ID DESC " +
            limitCon
        );

        // qb.select(selection)
        // if(Object.keys(and_conditions).length ){
        //     qb.where(and_conditions)
        // }
        // let j =0;
        // for (var key in and_or_condtions) {
        //     var value = and_or_condtions[key];
        //     qb.like('mcc','%'+value+'%');
        // }
        // let i =0;
        // for (var key in like_conditions) {
        //     var value = like_conditions[key];
        //     if(i==0)
        //     qb.like({[key]:value})
        //     else
        //     qb.or_like({[key]:value});
        //     i++;
        // }

        // qb.limit(limit.perpage, limit.start)
        // var response = await qb.get(psp_table);
        //
        // qb.release();
      } else if (Object.keys(and_or_condtions).length) {
        let condition = await helpers.get_and_conditional_string(
          and_conditions
        );
        let search_text = await helpers.get_conditional_or_like_string(
          like_conditions
        );
        let psp = await helpers.get_conditional_like_string(and_or_condtions);

        response = await qb.query(
          "select " +
            selection +
            " from " +
            psp_table +
            " where " +
            condition +
            psp +
            " order BY ID DESC " +
            limitCon
        );
      } else {
        let condition = await helpers.get_and_conditional_string(
          and_conditions
        );
        let search_text = await helpers.get_conditional_or_like_string(
          like_conditions
        );
        let psp = await helpers.get_conditional_like_string(and_or_condtions);

        response = await qb.query(
          "select " +
            selection +
            " from " +
            psp_table +
            " where " +
            condition +
            " order BY ID DESC " +
            limitCon
        );
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  master_buyrate_list: async (
    limit,
    selection,
    and_conditions,
    like_condition,
    table
  ) => {
    let limitCon = "";

    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }
    let final_cond = " where ";
    let like_str = "";
    if (like_condition.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ( ${currencyQuery} )`;
    }

    if (Object.keys(and_conditions).length) {
      let date_condition_str = await helpers.get_and_conditional_string(
        and_conditions
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
      "select " +
      selection +
      " from " +
      config.table_prefix +
      table +
      final_cond +
      like_str +
      " ORDER BY id DESC" +
      limitCon;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  master_buyrate: async (
    limit,
    selection,
    and_conditions,
    like_condition,
    table
  ) => {
    let limitCon = "";

    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }
    let final_cond = " where ";
    let like_str = "";
    if (like_condition.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ${currencyQuery}`;
    }

    if (Object.keys(and_conditions).length) {
      let date_condition_str = await helpers.get_and_conditional_string(
        and_conditions
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
      "select " +
      selection +
      " from " +
      config.table_prefix +
      table +
      final_cond +
      like_str +
      " ORDER BY id ASC" +
      limitCon;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  total_count: async (and_conditions, table, like_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_conditions).length) {
      let date_condition_str = await helpers.get_and_conditional_string(
        and_conditions
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }

    let like_str = "";
    if (like_condition?.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ( ${currencyQuery} )`;
    }
    // let like_str = "";
    // if (like_condition) {
    //     like_str = await helpers.get_conditional_like_string(
    //         like_condition
    //     );
    // }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select count('id') as count from " +
      config.table_prefix +
      table +
      final_cond +
      like_str;

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

  list_salerate: async (selection, and_conditions) => {
    let final_cond = " where ";

    if (Object.keys(and_conditions).length) {
      let date_condition_str = await helpers.get_and_conditional_string(
        and_conditions
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
      "select " +
      selection +
      " from " +
      salerate_table +
      final_cond +
      " ORDER BY id DESC";

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

  selectOne: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(psp_table);
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
      response = await qb.set(data).where(condition).update(psp_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_psp: async () => {
    let query =
      "select count('id') as count from " +
      psp_table +
      " where deleted=0 and status=0";
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

  get_count: async (and_conditions, and_or_condtions, like_conditions) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "select count('id') as count from " + psp_table + " where deleted=0";
      let j = 0;
      for (var key in and_or_condtions) {
        var value = and_or_condtions[key];
        query += " and " + key + ' like "%' + value + '%" ';
      }
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
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_psp_by_merchant: async (condition) => {
    let query =
      "select psp.name from " +
      config.table_prefix +
      "merchant_psp_status mps INNER JOIN " +
      config.table_prefix +
      "psp  psp on mps.psp_id= psp.id  where   " +
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
    return response;
  },
  get_psp_by_merchant_admin: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .from(config.table_prefix + "psp")
        .where({ deleted: 0, status: 0 })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  getMccName: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(description) as name from " +
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

  getEncMCC: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push(enc_dec.cjs_encrypt(i));
    }
    return new_mcc_codes_array.join(",");
  },
  get_mcc_cat_name: async (mcc_codes) => {
    let mcc_codes_array = mcc_codes.split(",");
    let new_mcc_codes_array = [];
    for (i of mcc_codes_array) {
      new_mcc_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(mcc_category) as name from " +
          mcc_cate_dbtable +
          " where id in (" +
          new_mcc_codes_array.join(",") +
          ") order by mcc_category asc"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].name;
  },
  getPspName: async (psp_codes) => {
    let psp_codes_array = psp_codes.split(",");
    let new_psp_codes_array = [];
    for (i of psp_codes_array) {
      new_psp_codes_array.push('"' + i + '"');
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select GROUP_CONCAT(name) as name from " +
          psp_table +
          " where id in (" +
          new_psp_codes_array.join(",") +
          ")"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0]?.name;
  },
  getPspCount: async (merchant_id) => {
    let table = config.table_prefix + "merchant_psp_onboard";
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as psp_count  from " +
          table +
          " where merchant_id=" +
          merchant_id
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.psp_count;
  },
  getSuperMerchantSubMerchantPspCount: async (super_merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "SELECT count(subquery.count) AS total_count FROM ( SELECT count(psp_id) AS count FROM pg_merchant_psp_onboard LEFT JOIN pg_master_merchant ON pg_master_merchant.id = pg_merchant_psp_onboard.merchant_id WHERE pg_master_merchant.super_merchant_id  = " +
          super_merchant_id +
          " GROUP BY psp_id, pg_master_merchant.super_merchant_id) AS subquery"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.total_count;
  },
};
module.exports = PspModel;
