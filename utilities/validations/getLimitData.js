const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (selection, condition, table_name, orderBy, limit) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select(selection)
      .where(condition)
      .limit(limit)
      .order_by(orderBy, "desc")
      .get(config.table_prefix + table_name);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  return response;
};
