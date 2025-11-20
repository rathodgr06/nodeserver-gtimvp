var validateIP = require("validate-ip-node");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
var ip = require("ip");
var geoip = require("geoip-country");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require("moment");
const logger = require('../../config/logger');

module.exports = async (req, res, next) => {
  // let ip = req.headers.ip;

  let ip = req.ip;
  if (validateIP(ip)) {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("suspicious_emails,suspicious_ips")
        .where({ id: 1 })
        .get(config.table_prefix + "fraud_detections");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error?.stack});
    } finally {
      qb.release();
    }

    var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let suspicious = response[0];
    let order_email = req.bodyString("email");
    let suspicious_ip = suspicious.suspicious_ips.split(",");
    let suspicious_email = suspicious.suspicious_emails.split(",");
    //table on basis of environment
    let order_table = "";
    if (req.body.env == "test") {
      order_table = "test_orders";
    } else {
      order_table = "orders";
    }

    // for suspicious emails
    if (suspicious_email.includes(order_email)) {
      let result = await updateOrderDetails(
        req.bodyString("order_id"),
        {
          status: "Failed",
          block_for_suspicious_email: 1,
          remark: "Payment block transaction from suspicious email",
        },
        order_table
      );
      let qr_payment = await merchantOrderModel.selectOne(
        "id",
        { order_no: req.bodyString("order_id") },
        "qr_payment"
      );
      if (qr_payment) {
        let qr_data = {
          payment_status: "Failed",
          transaction_date: updated_at,
        };
        merchantOrderModel.updateDynamic(
          qr_data,
          { id: qr_payment.id },
          "qr_payment"
        );
      }
      res.status(StatusCode.badRequest).send(
        ServerResponse.fraudDetectionResponse(
          "Payment block transaction from suspicious email",
          {
            order_id: req.bodyString("order_id"),
            order_status: "Failed",
            amount: req.order.amount,
            currency: req.order.currency,
          }
        )
      );
      return true;
    }
    //for suspicious ip
    if (suspicious_ip.includes(ip)) {
      let result = await updateOrderDetails(
        req.bodyString("order_id"),
        {
          status: "Failed",
          block_for_suspicious_ip: 1,
          remark: "Block because of suspicious ip found",
        },
        order_table
      );
      let qr_payment = await merchantOrderModel.selectOne(
        "id",
        { order_no: req.bodyString("order_id") },
        "qr_payment"
      );
      if (qr_payment) {
        let qr_data = {
          payment_status: "Failed",
          transaction_date: updated_at,
        };
        merchantOrderModel.updateDynamic(
          qr_data,
          { id: qr_payment.id },
          "qr_payment"
        );
      }
      res.status(StatusCode.badRequest).send(
        ServerResponse.fraudDetectionResponse(
          `Payment block transaction from suspicious ip`,
          {
            order_id: req.bodyString("order_id"),
            order_status: "Failed",
            amount: req.order.amount,
            currency: req.order.currency,
          }
        )
      );
      return true;
    }

    // for high risk country
    let high_risk_country_iso2 = await selectDetails(
      "iso2",
      { is_high_risk: 1 },
      "country"
    );

    let country_iso = geoip.lookup(ip);
    if (country_iso) {
      let is_high_risk_country = high_risk_country_iso2.find(
        (country) => country.iso2 === country_iso.country
      );
      if (is_high_risk_country) {
        let result = await updateOrderDetails(
          req.bodyString("order_id"),
          { high_risk_country: 1 },
          order_table
        );
      }
    }
    const order_details = await merchantOrderModel.selectOne(
      "merchant_id",
      {
        order_id: req.body.order_id,
      },
      order_table
    );

    //for transaction limit and risk transaction
    let type_of_business_result = await selectDetails(
      "mcc_codes as type_of_business",
      { merchant_id: order_details?.merchant_id },
      "master_merchant_details"
    );

    if (typeof type_of_business_result[0] != "undefined") {
      if (type_of_business_result[0].type_of_business > 0) {
        let transaction_limit = await selectDetails(
          "currency,max_limit,high_risk_limit",
          { mcc: type_of_business_result[0].type_of_business, deleted: 0 },
          "transaction_limit"
        );

        if (transaction_limit.length > 0) {
          let mcc_transaction_limit = transaction_limit[0];

          if (mcc_transaction_limit.currency === order_details.currency) {
            if (
              parseInt(mcc_transaction_limit.max_limit) <=
              parseInt(order_details.amount)
            ) {
              let result = await updateOrderDetails(
                req.bodyString("order_id"),
                {
                  status: "Failed",
                  block_for_transaction_limit: 1,
                  remark: "Block because of higher transaction limit",
                },
                order_table
              );
              res.status(StatusCode.badRequest).send(
                ServerResponse.fraudDetectionResponse(
                  `Payment block transaction limit exceed`,
                  {
                    order_id: req.bodyString("order_id"),
                    order_status: "Failed",
                    amount: order_details.amount,
                    currency: order_details.currency,
                  }
                )
              );
              return true;
            }
            if (
              parseInt(order_details.amount) >
              parseInt(mcc_transaction_limit.high_risk_limit)
            ) {
              let result = await updateOrderDetails(
                req.bodyString("order_id"),
                {
                  high_risk_transaction: 1,
                  remark: "Amount is above high risk",
                },
                order_table
              );
            }
          }
        }
      }
    } else {
      next();
    }
    next();
  } else {
    res
      .status(StatusCode.badRequest)
      .send(ServerResponse.fraudDetectionResponse(`Invalid IP address`));
  }
};

updateOrderDetails = async (order_id, payload, order_table) => {
  let db_table = config.table_prefix + order_table;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .set(payload)
      .where({ order_id: order_id })
      .update(order_table);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }

  return response;
};
selectDetails = async (selection, condition, table_name) => {
  table_name = config.table_prefix + table_name;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.select(selection).where(condition).get(table_name);
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  return response;
};
