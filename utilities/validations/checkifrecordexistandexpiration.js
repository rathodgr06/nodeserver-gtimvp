const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
const e = require("express");
const logger = require('../../config/logger');

module.exports = async (conditions, table_name) => {
  let qb = await pool.get_connection();

  let response;
  try {
    response = await qb
      .select("id,created_at")
      .where(conditions)
      .get(config.table_prefix + table_name);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    let now = moment(new Date().toJSON().substring(0, 19).replace("T", " "));
    let created_at = moment(response[0].created_at);
    let difference = created_at.diff(now, "seconds");
    if (difference > 86400) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
};
