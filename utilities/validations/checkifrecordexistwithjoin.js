const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (
  conditions,
  table_name1,
  table_name2,
  field_1,
  field_2
) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("t1.id")
      .where(conditions)
      .from(config.table_prefix + table_name1 + " t1")
      .join(
        config.table_prefix + table_name2 + " t2",
        "t1." + field_1 + "=t2." + field_2,
        "inner"
      )
      .get();
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
