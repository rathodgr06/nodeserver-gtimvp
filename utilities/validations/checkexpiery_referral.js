const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
const logger = require('../../config/logger');

module.exports = async (condition, table_name) => {
  let date = moment().format("YYYY-MM-DD");
  let qb = await pool.get_connection();
  let query =
    "select * from " +
    config.table_prefix +
    table_name +
    " where referral_code ='" +
    condition +
    "' and  deleted=0 and expiry_date < '" +
    date +
    "' and expiry_date is not NULL ";
  let response;
  try {
    response = await qb.query(query);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }

  if (response.length > 0) {
    return true;
  } else {
    return false;
  }
};
