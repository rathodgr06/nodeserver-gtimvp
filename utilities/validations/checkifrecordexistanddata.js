const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (selection, conditions, table_name) => {
  let qb = await pool.get_connection();

  let response;
  try {
    response = await qb
      .select(selection)
      .where(conditions)
      .get(config.table_prefix + table_name);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    return response[0];
  } else {
    return false;
  }
};
