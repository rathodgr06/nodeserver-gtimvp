const merchantOrderModel = require("../../models/merchantOrder");
const invModel = require("../../models/invoiceModel");
const subs_plan_model = require("../../models/subs_plan_model");
const helpers = require("../../utilities/helper/general_helper");
const ServerResponse = require("../../utilities/response/ServerResponse");
const StatusCode = require("../../utilities/statuscode/index");
const enc_dec = require("../../utilities/decryptor/decryptor");
const logger = require('../../config/logger');
module.exports = async (req, res, next) => {
  try {
    
    
    let order_amount = 0.0;
    let order_currency_code = "";
    if (req.originalUrl == "/api/v1/orders/qr/create") {
      let qr_order_data = await merchantOrderModel.selectData(
        req.body.data.order_details.paymentlink_id
      );
      if (qr_order_data.type_of_qr_code == "Static_QR") {
        order_amount = req.body.data.order_details.amount;
        order_currency =req.body.data.order_details.currency;
        submerchant_id = qr_order_data.sub_merchant_id;
      } else {
        order_amount = qr_order_data.amount;
        order_currency = qr_order_data.currency;
        submerchant_id = qr_order_data.sub_merchant_id;
      }
    } else if (req.originalUrl == "/api/v1/orders/invoice/create") {
      let record_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
      let inv_order_data = await invModel.selectOneInvData({
        id: record_id,
      });
      order_amount = inv_order_data.total_amount;
      order_currency = inv_order_data.currency;
      submerchant_id = inv_order_data.sub_merchant_id;
    } else if (req.originalUrl == "/api/v1/subs_plans/order-create") {
      
      let record_id = req.bodyString("token");
      let plan_order_data = await subs_plan_model.selectOneDynamic(
        "plan_billing_amount,plan_currency,submerchant_id",
        {
          ref_no: record_id,
        },
        "subs_plans"
      );
      order_amount = plan_order_data.plan_billing_amount;
      order_currency = plan_order_data.plan_currency;
      submerchant_id = plan_order_data.submerchant_id;
    } else if(req.originalUrl.replace(/\/{2,}/g, '/') == "/api/v1/execute-payment"){
      let classType = req.body.class;
      if(classType=='cont'){
        order_amount = req.body.data.amount;
        order_currency = req.body.data.currency;
        submerchant_id = req.credentials.merchant_id;
      }else{
        order_amount = req.body.order_details.amount;
        order_currency = req.body.order_details.currency;
        submerchant_id = req.credentials.merchant_id;
      }
    } else {
      let classType = req.body.data.class;
      if(classType=='cont'){
        order_amount = req.body.data.amount;
        order_currency = req.body.data.currency;
        submerchant_id = req.credentials.merchant_id;
      }else{
        order_amount = req.body.data.order_details.amount;
        order_currency = req.body.data.order_details.currency;
        submerchant_id = req.credentials.merchant_id;
      }
    }
    let currency_id = await helpers.get_currency_id_by_name(order_currency);
    if (currency_id != "") {
      let transactionLimitDetails =
        await merchantOrderModel.selectMinMaxTxnAmount({
          submerchant_id: submerchant_id,
          currency_id: currency_id,
          deleted: 0,
        });
      
      
      if (transactionLimitDetails) {
        
        if (
          parseInt(transactionLimitDetails.minTxnAmount) <=
            parseInt(order_amount) &&
          parseInt(transactionLimitDetails.maxTxnAmount) >=
            parseInt(order_amount)
        ) {
          next();
        } else {
          if (
            parseInt(order_amount) >
            parseInt(transactionLimitDetails.maxTxnAmount)
          ) {
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Block because of maximum transaction limit"
                )
              );
          } else {
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Block because of minimum transaction limit"
                )
              );
          }
        }
      } else {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "No terminal found for currency " +
                req.body.data.order_details.currency +
                "."
            )
          );
      }
    } else {
      return res
        .status(StatusCode.badRequest)
        .send(
          ServerResponse.errormsg(
            "No terminal found for currency " +
              req.body.data.order_details.currency +
              "."
          )
        );
    }
  } catch (error) {
    logger.error(500,{message: error,stack: error?.stack});
    return res
      .status(StatusCode.internalError)
      .send(ServerResponse.errormsg(error?.message));
  }
};
