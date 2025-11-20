const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "fonts";
var dbModel = {
  select: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").order_by("name", "asc").get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = dbModel;
