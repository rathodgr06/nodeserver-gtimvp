const StatusCode = require("../statuscode/index");
const ServerResponse = require("../response/ServerResponse");
const path = require("path");
require("dotenv").config({ path: "../../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const jwt = require('jsonwebtoken');
const encrypt_decrypt = require('../decryptor/encrypt_decrypt');
module.exports = async (req, res, next) => {
  console.log(`at this API`);
  let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
  let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
  try {
    if (!merchant_secret && !merchant_key) {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];
      if (token == null) {
        res
          .status(StatusCode.expired)
          .send(ServerResponse.errormsg("Invalid access token", "E0060"));
      } else {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
          if (err) {
            if (err.message == "jwt expired") {
              res
                .status(StatusCode.expired)
                .send(ServerResponse.errormsg("Token Expired", "E0059"));
            } else {
              res
                .status(StatusCode.expired)
                .send(
                  ServerResponse.errormsg("Unable To Validate Token", "E0060")
                );
            }
          } else {
            let decrypted_payload = encrypt_decrypt(
              "descrypt",
              payload.payload
            );
            req.user = JSON.parse(decrypted_payload);
            next();
          }
        });
      }
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
      } finally {
        qb.release();
      }

      if (response[0]) {
        let merchant_details = response[0];
        req.credentials = merchant_details;
        next();
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
  } catch (error) {
    console.log(error);
  }
};
