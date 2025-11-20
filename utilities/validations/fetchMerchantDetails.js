const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const logger = require('../../config/logger');

module.exports = async (req, res, next) => {
  let qb = await pool.get_connection();
  let merchant_id = encrypt_decrypt("decrypt", req.bodyString("merchant_id"));
  let response;
  try {
    response = await qb
      .select("id,name,email")
      .where({ id: merchant_id })
      .get(config.table_prefix + "master_merchant");
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    req.user = response[0];
    next();
  } else {
    return false;
  }
};
