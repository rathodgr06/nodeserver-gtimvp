const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

let AutoCaptureModel = {
  fetchAll: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + "orders ord")
        .join(
          config.table_prefix + "order_txn txn",
          "ord.order_id=txn.order_id",
          "inner"
        )
        .join(
          config.table_prefix + "mid mid",
          "ord.terminal_id=mid.terminal_id",
          "inner"
        )
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    return response;
  },
  fetchAllTest: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + "test_orders ord")
        .join(
          config.table_prefix + "test_order_txn txn",
          "ord.order_id=txn.order_id",
          "inner"
        )
        .join(
          config.table_prefix + "mid mid",
          "ord.terminal_id=mid.terminal_id",
          "inner"
        )
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    console.log(qb.last_query(), "test query");
    return response;
  },
};

module.exports = AutoCaptureModel;
