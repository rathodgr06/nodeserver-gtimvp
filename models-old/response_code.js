const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const response_code_table = config.table_prefix + "response_code";
const helpers = require("../utilities/helper/general_helper");
const psp_table = config.table_prefix + "psp";

var responseCodeModel = {
  select: async (selection, limit, psp, like_search) => {
    let final_cond = " where psp_name != 'paydard'";
    if (psp) {
      final_cond += ` and psp_name = '${psp}'`;
    }

    if (Object.keys(like_search).length) {
      let date_like_search_str = await helpers.get_conditional_or_like_string(
        like_search
      );
      final_cond += " and ( " + date_like_search_str + ")";
    }

    let sql = `select id,${selection.join(",")} from  ${response_code_table}`;

    if (final_cond != " where ") {
      sql += ` ${final_cond}`;
    }

    let limitCon = "";
    if (limit.perpage > 0) {
      limitCon = " limit " + limit.start + "," + limit.perpage;
    }
    sql += ` ${limitCon}`;

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (psp) => {
    let sql = `select count(response_code) as count from  ${response_code_table}`;
    if (psp) {
      sql += ` where psp_name = '${psp}'`;
    }

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response[0].count;
  },
  response_types: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        `SELECT response_type FROM ${response_code_table} GROUP BY response_type  ORDER BY response_type ASC`
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_psp: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        `SELECT name, credentials_key FROM ${psp_table} WHERE deleted = 0 and status=0 and credentials_key!='paydart' GROUP BY name ORDER by name`
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  response_code_detail: async (response_code_id, selection_fields) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        `SELECT ${selection_fields.join(
          ","
        )} FROM ${response_code_table} WHERE id=${response_code_id}`
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response[0];
  },
  response_code_store: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(response_code_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  categories: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        `SELECT id, category FROM pg_response_categories ORDER BY category ASC`
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = responseCodeModel;
