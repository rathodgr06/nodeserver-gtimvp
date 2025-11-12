const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

module.exports = async (conditions, table_name) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("*")
      .where(conditions)
      .get(`${config.table_prefix}${table_name}`);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  return response[0];
};
