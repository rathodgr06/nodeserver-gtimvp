const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (id, user_id, table_name) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("*")
      .where("id", id)
      .where("user_id", user_id)
      .get(config.table_prefix + table_name);
  } catch (error) {
    logger.error(400,{message: error,stack: error?.stack});
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    return true;
  } else {
    return false;
  }
};
