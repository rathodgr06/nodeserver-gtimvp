const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

const check_expiry_safe = async (referral_code) => {
  const qb = await pool.get_connection();
  try {
    const today = moment().format("YYYY-MM-DD");

    const result = await qb
      .select("*")
      .where({
        referral_code,
        deleted: 0,
      })
      .where(`expiry_date IS NOT NULL`)
      .where(`expiry_date < '${today}'`)
      .get(config.table_prefix + "referrers");

    return result.length > 0;
  } finally {
    qb.release();
  }
};
