const StatusCode = require("../statuscode/index");
const ServerResponse = require("../response/ServerResponse");
const path = require("path");
require("dotenv").config({ path: "../../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (req, res, next) => {
  const authHeader = req.headers;
  let merchant_key = authHeader.merchant_key;
  let merchant_secret = authHeader.merchant_secret;
  if (!merchant_secret && !merchant_key) {
    res
      .status(StatusCode.badRequest)
      .send(ServerResponse.validationResponse("Unauthorized request", "E0001"));
  } else {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mk.merchant_id,mk.type,md.super_merchant_id,mcc.id as mcc_id,mcc_cat.id as mcc_cat_id"
        )
        .from(config.table_prefix + "master_merchant_key_and_secret mk")
        .join(
          config.table_prefix + "master_merchant md",
          "mk.merchant_id=md.id",
          "inner"
        )
        .join(
          config.table_prefix + "master_merchant_details mde",
          "mk.merchant_id=mde.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mcc",
          "mde.mcc_codes=mcc.id",
          "left"
        )
        .join(
          config.table_prefix + "master_mcc_category mcc_cat",
          "mcc.category=mcc_cat.id",
          "left"
        )
        .where({
          "mk.merchant_key": merchant_key,
          "mk.merchant_secret": merchant_secret,
        })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error?.stack});
    } finally {
      qb.release();
    }

    let merchant_details = response[0];
    req.credentials = merchant_details;
    if (response[0]?.type == "test") {
      next();
    } else if (response[0]?.type == "live") {
      res
        .status(StatusCode.badRequest)
        .send(
          ServerResponse.validationResponse(
            "Please use test merchant key and secret",
            "E0001"
          )
        );
    } else {
      res
        .status(StatusCode.badRequest)
        .send(
          ServerResponse.validationResponse(
            "Invalid merchant key and secret",
            "E0001"
          )
        );
    }
  }
};
