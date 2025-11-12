const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
async function planDetails(conditions, table_name) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("*")
      .where(conditions)
      .get(config.table_prefix + table_name);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  return response[0];
}

async function startDate(ref_no) {
  let current_date = moment().format("YYYY-MM-DD HH:mm");
  let sql = `SELECT id
                FROM ${config.table_prefix}subs_plans
                WHERE DATE_FORMAT(start_date,'%Y-%m-%d %H:%i') <= "${current_date}" 
                AND ref_no='${ref_no}'
                AND deleted =0
                AND status=0`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response;
}

async function expiryDate(ref_no) {
  let current_date = moment().format("YYYY-MM-DD HH:mm");
  let sql = `SELECT id,
                        CASE
                        WHEN DATE_FORMAT(expiry_date,'%Y-%m-%d %H:%i') <=  "${current_date}"  THEN 'YES'
                        ELSE 'NO'
                        END AS calculated_expiry_date
                    FROM pg_subs_plans
                    WHERE  ref_no = '${ref_no}'
                        AND deleted = 0
                        AND status = 0`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response;
}

async function is_plan_expired(ref_no) {
  let current_date = moment().format("YYYY-MM-DD HH:mm");
  let sql = `SELECT id,
                        CASE
                        WHEN DATE_FORMAT(expiry_date,'%Y-%m-%d %H:%i') <=  "${current_date}"  THEN 'YES'
                        ELSE 'NO'
                        END AS calculated_expiry_date
                    FROM pg_subs_plans
                    WHERE  id = '${ref_no}'
                        AND deleted = 0`;

  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response;
}
module.exports = {
  planDetails,
  startDate,
  expiryDate,
  is_plan_expired,
};
