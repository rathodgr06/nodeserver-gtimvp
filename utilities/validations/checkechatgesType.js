const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (
  condition,
  column,
  value,
  column1,
  value1,
  column2,
  value2,
  table_name
) => {
  let qb = await pool.get_connection();

  // select * from pg_charges_transaction_setup where psp =1 AND charges_type ='Slab' AND mcc IN(3) AND payment_mode IN ('Scan Card1') AND id != 5

  let query =
    "select * from " +
    config.table_prefix +
    table_name +
    " where id != " +
    condition +
    " and " +
    column +
    " IN" +
    "(" +
    "'" +
    value +
    "'" +
    ")" +
    " and " +
    column1 +
    " IN" +
    "(" +
    "'" +
    value1 +
    "'" +
    ")" +
    " and " +
    column2 +
    " = " +
    value2;
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
