require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_pricing_plan";
const sellrate_table = config.table_prefix + "master_subm_sellrate";
const psp_table = config.table_prefix + "psp";
const buyrate_table = config.table_prefix + "master_psp_buyrate";
const salerate_table = config.table_prefix + "master_psp_salerate";
const mid_sell_table = config.table_prefix + "master_mid_sellrate";
const master_subm_sellrate = config.table_prefix + "master_subm_sellrate";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");

var pricing_model = {
  add: async (data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + table, data);
        console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  updateDetails: async (condition, data, table) => {
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
  update_buyrate_details: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(buyrate_table);
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
  select_detilas: async (condition) => {
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
  select_plan_mid: async (condition, table, mid_cond) => {
    let qb = await pool.get_connection();

    let response;
    try {
      if (table === "master_pricing_plan") {
        response = await qb
          .select("*")
          .where(condition)
          .get(config.table_prefix + table);
      } else {
        response = await qb
          .select("*")
          .where(mid_cond)
          .get(config.table_prefix + table);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_buy_rate: async (condition, table) => {
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
  select_master_mid_sellrate: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .get(config.table_prefix + "master_mid_sellrate");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select_mid_promo: async (condition, table, mid_cond) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = "";
      if (table == "mid_promo_sellrate") {
        response = await qb
          .select("*")
          .where(mid_cond)
          .get(config.table_prefix + table);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  select_mid_txn: async (condition, table, mid_cond) => {
    let qb = await pool.get_connection();

    let response;
    try {
      if (table === "mid_sellrate" || table === "subm_sellrate") {
        response = await qb
          .select("*")
          .where(mid_cond)
          .get(config.table_prefix + table);
      } else {
        // let query = "SELECT id, master_pricing_plan_id, currency, dom_int, GROUP_CONCAT(DISTINCT payment_methods) as payment_methods, GROUP_CONCAT(DISTINCT payment_schemes) as payment_schemes, sale_rate_fix, sale_rate_per, tax, paydart_rate_fix, deleted, created_at, paydart_rate_per FROM pg_pricing_plan_txn_rate WHERE master_pricing_plan_id="+condition.master_pricing_plan_id+" AND deleted=0 GROUP BY dom_int";
        console.log(`mid conditionis here`);
        console.log(mid_cond);
        let query =
          "SELECT id,master_pricing_plan_id,currency,psp,dom_int,CASE WHEN payment_methods IN ('credit card', 'debit card') THEN 'Credit Card,Debit Card' ELSE payment_methods END AS payment_methods,GROUP_CONCAT(DISTINCT payment_schemes) AS payment_schemes,sale_rate_fix,sale_rate_per,tax,paydart_rate_fix,deleted,created_at,paydart_rate_per FROM pg_pricing_plan_txn_rate WHERE master_pricing_plan_id = " +
          condition.master_pricing_plan_id +
          " AND deleted = '0' GROUP BY dom_int,sale_rate_fix,sale_rate_per,CASE WHEN payment_methods  IN ('credit card', 'debit card') THEN 'credit card' END ORDER BY id ASC;";
        response = await qb.query(query);
        console.log(qb.last_query());
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  select_pricing: async (condition, table) => {
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
  select_mid_wise_pricing: async (
    master_id,
    methods,
    scheme,
    dom_in,
    table,
    user_type
  ) => {
    let qb = await pool.get_connection();
    let response = "";
    try {
      if (user_type == "merchant") {
        response = await qb.query(
          "select * from " +
            config.table_prefix +
            table +
            " where deleted=0 and master_mid_sellrate_id=" +
            master_id +
            " and payment_methods IN (" +
            methods +
            ") and (payment_schemes IN (" +
            scheme +
            ") or payment_schemes IS NULL )and dom_int IN (" +
            dom_in +
            ")"
        );
      } else {
        response = await qb.query(
          "SELECT m.id, m.master_mid_sellrate_id, m.currency, m.dom_int, CASE WHEN m.payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card, Debit Card' ELSE m.payment_methods END AS payment_methods, GROUP_CONCAT(DISTINCT m.payment_schemes) AS payment_schemes, m.sell_rate_fix, m.sell_rate_per, m.tax, m.paydart_rate_fix, m.deleted, m.created_at, m.paydart_rate_per, p.psp, s.name FROM pg_mid_sellrate m JOIN pg_pricing_plan_txn_rate p ON p.master_pricing_plan_id = m.master_mid_sellrate_id AND p.currency = m.currency AND p.dom_int = m.dom_int AND p.payment_methods = m.payment_methods JOIN pg_psp s ON s.id = p.psp WHERE m.master_mid_sellrate_id = "+master_id+" AND m.deleted = '0' GROUP BY m.dom_int, m.sell_rate_fix, m.sell_rate_per, m.currency, CASE WHEN m.payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card' END ORDER BY m.id ASC;"
        );

        // response = await qb.query(
        //   "SELECT id, master_mid_sellrate_id, currency, dom_int, CASE WHEN payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card, Debit Card' ELSE payment_methods END AS payment_methods, GROUP_CONCAT(DISTINCT payment_schemes) AS payment_schemes, sell_rate_fix, sell_rate_per, tax, paydart_rate_fix, deleted, created_at, paydart_rate_per FROM pg_mid_sellrate WHERE master_mid_sellrate_id = " +
        //     master_id +
        //     " AND deleted = '0' GROUP BY dom_int, sell_rate_fix, sell_rate_per, currency, CASE WHEN payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card' END ORDER BY id ASC;"
        // );

        // console.log( "SELECT id, master_mid_sellrate_id, currency, dom_int, CASE WHEN payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card, Debit Card' ELSE payment_methods END AS payment_methods, GROUP_CONCAT(DISTINCT payment_schemes) AS payment_schemes, sell_rate_fix, sell_rate_per, tax, paydart_rate_fix, deleted, created_at, paydart_rate_per FROM pg_mid_sellrate WHERE master_mid_sellrate_id = " +
        //     master_id +
        //     " AND deleted = '0' GROUP BY dom_int, sell_rate_fix, sell_rate_per, CASE WHEN payment_methods IN ('Credit Card', 'Debit Card') THEN 'Credit Card' END ORDER BY id ASC;"
        // );
            
        // response = await qb.query(
        //   "select * from " +
        //     config.table_prefix +
        //     table +
        //     " where  deleted=0 and  master_mid_sellrate_id=" +
        //     master_id
        // );
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  details_by_currency: async (currency, and_conditions) => {
    let like_str = "";
    let psp_cond = "";
    if (currency) {
      const currencyArray = currency.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ${currencyQuery}`;
    }
    if (Object.keys(and_conditions).length) {
      let condition = await helpers.get_and_conditional_string(and_conditions);
      psp_cond = ` AND ` + condition;
    }

    let query = `select * from ${dbtable} where deleted = 0 ${like_str} ${psp_cond}`;

    console.log("🚀 ~ details_by_currency: ~ query:", query);
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
  details_by_country: async (country_id) => {
    let query = `select * from ${dbtable} where deleted = 0 AND country_id = ${country_id}`;

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
  details_by_country_currency_psp: async (country_id, currency, psp) => {
    // let query = `SELECT * FROM pg_master_pricing_plan AS mpp LEFT JOIN pg_pricing_plan_txn_rate AS pp_txn ON mpp.id = pp_txn.master_pricing_plan_id WHERE pp_txn.psp = '${psp}' AND pp_txn.currency = '${currency}' AND mpp.country_id = '${country_id}'`;
    let query = `WITH ranked_plans AS ( SELECT
          mpp.*,
          pp_txn.id AS txn_id,
          ROW_NUMBER() OVER (
            PARTITION BY mpp.plan_name
            ORDER BY pp_txn.id DESC
          ) AS row_num
        FROM 
          pg_master_pricing_plan AS mpp
        LEFT JOIN 
          pg_pricing_plan_txn_rate AS pp_txn
            ON mpp.id = pp_txn.master_pricing_plan_id
        WHERE 
          pp_txn.psp = '${psp}'
          AND pp_txn.currency = '${currency}'
          AND mpp.country_id = '${country_id}'
          AND mpp.is_default=0
          AND mpp.deleted=0
      )
      SELECT *
      FROM ranked_plans
      WHERE row_num = 1;`;
    console.log("🚀 ~ details_by_country_currency_psp: ~ query:", query);

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

  select_sellrate_detilas: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(sellrate_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (limit, and_conditions, like_condition) => {
    let limitCon = "";
    let final_cond = " where ";

    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }

    if (Object.keys(and_conditions).length) {
      let condition = await helpers.get_and_conditional_string(and_conditions);
      final_cond = final_cond + condition;
    }

    let like_str = "";
    if (like_condition.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ${currencyQuery}`;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select * from " +
      dbtable +
      final_cond +
      like_str +
      " order BY ID ASC" +
      limitCon;

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
  select_pricing_list: async (limit, and_conditions, like_condition) => {
    let limitCon = "";
    let final_cond = " where ";

    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }

    if (Object.keys(and_conditions).length) {
      let condition = await helpers.get_and_conditional_string(and_conditions);
      final_cond = final_cond + condition;
    }

    let like_str = "";
    if (like_condition.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ${currencyQuery}`;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select * from " +
      dbtable +
      final_cond +
      like_str +
      " order BY ID DESC" +
      limitCon;

    console.log("Database query:", query);
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

  select_sellrate: async (limit, and_conditions) => {
    let limitCon = "";
    let final_cond = " where ";

    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }

    if (Object.keys(and_conditions).length) {
      let condition = await helpers.get_and_conditional_string(and_conditions);
      final_cond = final_cond + condition;
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      "select * from " +
      sellrate_table +
      final_cond +
      " order BY ID DESC" +
      limitCon;

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

  list_buyrate: async (selection, and_conditions) => {
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
      buyrate_table +
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

  list_rates: async (selection, and_conditions, table) => {
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
      "SELECT id,master_pricing_plan_id,psp,currency,dom_int,CASE WHEN payment_methods IN ('credit card', 'debit card') THEN 'Credit Card,Debit Card' ELSE payment_methods END AS payment_methods,GROUP_CONCAT(DISTINCT payment_schemes) AS payment_schemes,sale_rate_fix,sale_rate_per,tax,paydart_rate_fix,deleted,created_at,paydart_rate_per,min_amount,max_amount FROM pg_pricing_plan_txn_rate WHERE master_pricing_plan_id = " + and_conditions.master_pricing_plan_id +
      " AND deleted = '0' GROUP BY dom_int,psp,currency,CASE WHEN payment_methods  IN ('credit card', 'debit card') THEN 'credit card' END ORDER BY id ASC;";
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

  get_psp: async () => {
    let query =
      "select count('id') as count from " +
      psp_table +
      " where deleted=0 and status=0";
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
  get_count: async (and_conditions, and_or_condtions, like_conditions) => {
    let query =
      "select count('id') as count from " + psp_table + " where deleted=0";
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

  get_total_count: async (and_conditions, like_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_conditions).length) {
      let condition = await helpers.get_and_conditional_string(and_conditions);
      final_cond = final_cond + condition;
    }
    let like_str = "";
    if (like_condition.currency) {
      const currencyArray = like_condition.currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND ${currencyQuery}`;
    }
    // let like_str = "";
    // if (like_condition) {
    //     like_str = await helpers.get_conditional_like_string(
    //         like_condition
    //     );
    // }

    let query =
      "select count('id') as count from " + dbtable + final_cond + like_str;

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
  get_total_sellrate_count: async () => {
    let query =
      "select count('id') as count from " +
      sellrate_table +
      " where deleted = '0' ";

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
  get_psp_by_merchant_admin: async () => {
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
    return response?.[0].name;
  },
  remove_master_buyrate: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(config.table_prefix + "master_buyrate", {
        id: id,
      });
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_currency_code: async (psp) => {
    let query =
      `select currency from ` +
      config.table_prefix +
      `master_buyrate where deleted = 0 and psp=` +
      psp;

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
  get_psp_buy_rate_currency: async (code) => {
    let cond = "";
    if (code != "") {
      cond = " and code NOT IN (" + code + ") ";
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select * from " +
          config.table_prefix +
          "master_currency where deleted=0 and status=0" +
          cond
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_psp_buy_rate_currency_count: async (code) => {
    let cond = "";
    if (code != "") {
      cond = " and code NOT IN (" + code + ") ";
    }
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count(id) as count from " +
          config.table_prefix +
          "master_currency where deleted=0 and status=0" +
          cond
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count_mid_sell_rate: async (id, mid) => {
    let mid_cond = "";
    if (mid) {
      mid_cond = " and mid=" + mid;
    }
    let query =
      "select count('id') as count from " +
      mid_sell_table +
      " where deleted=0 and plan_id=" +
      id +
      mid_cond;

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
  get_count_merchant_sell_rate: async (id, sub_merchant_id) => {
    let merchant_condition = "";
    if (sub_merchant_id) {
      merchant_condition = " and submerchant_id=" + sub_merchant_id;
    }
    let query =
      "select count('id') as count from " +
      master_subm_sellrate +
      " where deleted=0 and plan_id=" +
      id +
      merchant_condition;

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
  removeTransactionCharges: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(
        config.table_prefix + "pricing_plan_txn_rate",
        condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectOneDynamic: async (selection, condition, table) => {
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
    return response?.[0]?.card_scheme;
  },
  fetchPlanDetailsByMid:async(condition)=>{
     let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select('p.id,p.plan_name,p.country_name,p.is_default,p.created_at,p.updated_at')
        .from(config.table_prefix +'master_mid_sellrate mms')
        .join(config.table_prefix +'master_pricing_plan p','mms.plan_id=p.id','left')
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
   fetchPSP:async(condition,table)=>{
     let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select('psp.id,psp.name')
        .from(config.table_prefix + 'mid m')
        .join(config.table_prefix + 'psp psp','m.psp_id=psp.id','left')
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  fetchTransactionBasedRate:async(condition)=>{
      let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(`SELECT pp.id, pp.master_pricing_plan_id, pp.psp, pp.currency, pp.dom_int, GROUP_CONCAT(DISTINCT pp.payment_methods ORDER BY pp.payment_methods SEPARATOR ', ') AS payment_methods_list, GROUP_CONCAT(DISTINCT pp.payment_schemes ORDER BY pp.payment_schemes SEPARATOR ', ') AS payment_schemes_list, pp.sale_rate_fix, pp.sale_rate_per, pp.tax, pp.paydart_rate_fix, pp.paydart_rate_per, pp.min_amount, pp.max_amount, pp.deleted, pp.created_at FROM pg_pricing_plan_txn_rate pp WHERE pp.psp = ${condition.psp} AND pp.master_pricing_plan_id = ${condition.master_pricing_plan_id} AND pp.deleted = 0 GROUP BY pp.dom_int;
`)
  
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  }
};

module.exports = pricing_model;
