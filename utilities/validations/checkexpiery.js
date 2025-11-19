const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
const logger = require('../../config/logger');

module.exports = async (condition, type, table_name) => {
  let date = moment().format("YYYY-MM-DD");
  let qb = await pool.get_connection();
  let query =
    "select * from " +
    config.table_prefix +
    table_name +
    " where id =" +
    condition +
    " and end_date >= " +
    "'" +
    date +
    "'" +
    " and type_of_qr_code =" +
    "'" +
    type +
    "'";
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
