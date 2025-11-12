require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
var axios = require("axios");
const order_logs = require("../models/order_logs");
const merchantOrderModel = require("../models/merchantOrder");
const orderTransactionModel = require("../models/order_transaction");
const moment = require("moment");
let outlet = "";
const credientials = require("../config/credientials");
const helpers = require("../utilities/helper/general_helper");
const { send_webhook_data } = require("./webhook_settings");
const winston = require('../utilities/logmanager/winston');
const fraudEngine = require("../utilities/fraud/index.js");

const createOrder = async (order_data, _terminalcred) => {
  var support_config = {
    method: "POST",
    url: `${credientials.paytabs.base_url}`,
    headers: {
      Authorization: _terminalcred.password,
    },
    data: order_data,

    //data: {"action": req.body.action,"amount": { "currencyCode": req.body.amount.currencyCode, "value": req.body.amount.value }}
  };
  return new Promise((resolve, reject) => {
    axios(support_config)
      .then(function (result) {
        
        resolve(result.data);
      })
      .catch(function (error) {
        winston.error(error);
        reject(error.message);
      });
  });
};

var paytabs_apple_pay = {
  pay: async (req, res, next) => {
    // Fetch Order details
    try {
      let mode = req.bodyString('mode')
      let logs = mode=='test'?await order_logs.get_test_log_data(req.bodyString("order_id")):await order_logs.get_log_data(req.bodyString("order_id"));
      
      
      let order_id = req.bodyString("order_id");
      let order_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: order_id },
        mode=='test'?"test_orders":"orders"
      );
      
      if (order_details) {
        if (order_details.status == "PENDING") {
          let getMid = await merchantOrderModel.selectMIDNI(
            "mid.id,mid.terminal_id,mid.MID,mid.password,mid.currency_id,mid.payment_methods,mid.payment_schemes,mid.minTxnAmount,mid.maxTxnAmount,mid.psp_id",
            {
              "mid.submerchant_id": order_details.merchant_id,
              "psp.credentials_key": "paytabs",
              "mid.env":'mode',
              "mid.deleted":0
            }
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Fetch the MID details.`
          );
          if (getMid) {
            
            let filteredApplePay = getMid.filter(function (element) {
              return element.payment_methods.toUpperCase().includes("APPLE PAY");
            });
            if (filteredApplePay.length > 0) {
              
              let mid_details = filteredApplePay[0];

              req.body.digital_wallet = 'apple_pay';
              req.body.mid = mid_details?.MID
              if(req.body.mode && (req.body.mode == 'test' || req.body.mode == 'live')){
                req.body.payment_mode = req.body.mode;
              }

              const fraudData  = await fraudEngine(req,res,next,true);
              if(fraudData){
                return res.status(statusCode.ok).send(response.errorMsgWithData("Transaction Failed.", fraudData));
              }
              
              let order_data = {
                "profile_id": mid_details.MID,
                "tran_type": "sale",
                "tran_class": "ecom",
                "cart_id": order_details.order_id,
                "cart_description": "Sample Payment", //order_details.remark,
                "cart_currency": order_details.currency,
                "cart_amount": order_details.amount,
                "return": "none",
                "customer_details": {
                  "name": order_details.customer_name,
                  "email": order_details.customer_email,
                  "street1": order_details.billing_address_line_1,
                  "city": order_details.billing_city,
                  "country": order_details.billing_country,
                  "phone":
                    order_details.customer_code + order_details.customer_mobile,
                  "ip":
                    (req.headers["x-forwarded-for"] || "")
                      .split(",")
                      .pop()
                      .trim() || req.socket.remoteAddress,
                },
                "apple_pay_token": req.body.apple_pay_token,
              };
              let order_response_paytabs = await createOrder(
                order_data,
                mid_details
              );
              console.log(`order response from paytabs using apple pay`)
              console.log(order_response_paytabs)
              if (
                order_response_paytabs?.payment_result?.response_status == "A"
              ) {
                let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
                var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Update order.`
                );
                let order_update = {
                  terminal_id: mid_details.terminal_id,
                  psp: "PAYTABS",
                  updated_at: updated_at,
                  status:
                    order_response_paytabs?.tran_type == "Sale"
                      ? "CAPTURED"
                      : "AUTHORISED",
                  payment_mode:
                  'APPLE_PAY',
                  scheme: order_response_paytabs?.payment_info?.card_scheme,
                  psp_id: mid_details.psp_id,
                  capture_datetime: updated_at,
                  payment_id: payment_id,
                };
                let order_update_res = await merchantOrderModel.updateDynamic(
                  order_update,
                  { order_id: order_id },
                  mode=='test'?"test_orders":"orders"
                );
                let capture_no = order_response_paytabs.tran_ref;
                let order_txn = {
                  status:
                    order_response_paytabs.payment_result.response_message ==
                    "CAPTURED"
                      ? "AUTHORISED"
                      : order_response_paytabs.payment_result.response_message.toUpperCase(),
                  psp_code: "00",
                  remark: "",
                  txn: payment_id,
                  type:
                    order_details.action.toUpperCase() == "SALE" &&
                    order_response_paytabs.payment_result.response_message.toUpperCase() ==
                      "CAPTURED"
                      ? "CAPTURE"
                      : order_response_paytabs.payment_result.response_message.toUpperCase(),
                  capture_no: capture_no,
                  order_id: order_details.order_id,
                  amount: order_details.amount,
                  currency: order_details.currency,
                  payment_id:order_response_paytabs.tran_ref,
                  created_at: updated_at,
                };
                await orderTransactionModel.add(order_txn,mode=='test'?'test_order_txn':'order_txn');
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Insert data into order transaction.`
                );
                let p_request_id = await helpers.make_sequential_no(mode=='test'?"TST_REQ":"REQ");
                let order_req = {
                  merchant_id: order_details.merchant_id,
                  order_id: order_id,
                  request_id: p_request_id,
                  request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req,mode=='test'?"test_generate_request_id":"generate_request_id");

                let new_res = {
                  m_order_id: order_details.merchant_order_id
                    ? order_details.merchant_order_id
                    : "",
                  p_order_id: order_details.order_id
                    ? order_details.order_id
                    : "",
                  p_request_id: p_request_id,
                  psp_ref_id: order_response_paytabs.tran_ref,
                  psp_txn_id: capture_no,
                  transaction_id: payment_id,
                  status:
                    order_response_paytabs.payment_result.response_message.toUpperCase(),
                  status_code:'00',
                  remark:
                    order_response_paytabs.payment_result.response_message,
                  paydart_category: "Success",
                  currency: order_details.currency,
                  return_url:process.env.DEFAULT_SUCCESS_URL,
                  transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                  amount: Number(order_details.amount).toFixed(2),
                  m_customer_id: order_details.merchant_customer_id
                    ? order_details.merchant_customer_id
                    : "",
                  psp: "PSP",
                  payment_method:'APPLE_PAY',
                  m_payment_token: order_details.card_id,
                  payment_method_data: {
                    scheme: order_response_paytabs.payment_info.card_scheme,
                    card_country: order_details.card_country,
                    card_type: order_response_paytabs.payment_info.card_type,
                    mask_card_number:
                      order_response_paytabs.payment_info.payment_description,
                  },
                  apm_name: "APPLE_PAY",
                  apm_identifier: "",
                  sub_merchant_identifier: order_details?.merchant_id
                    ? await helpers.formatNumber(order_details?.merchant_id)
                    : "",
                };
                let res_obj = {
                  order_status:
                    order_response_paytabs.payment_result.response_message.toUpperCase(),
                  payment_id: payment_id,
                  order_id: order_details?.order_id,
                  amount: Number(order_details?.amount).toFixed(2),
                  currency: order_details?.currency,
                  token: req.body.browserFP || "",
                  return_url: order_details.success_url,
                  message: "",
                  new_res: new_res,
                };
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Send Response.`
                );
                let logs_payload = {
                  activity: JSON.stringify(logs),
                  updated_at: updated_at,
                };
                
                let log_is = mode=='test'?await order_logs.update_test_logs_data(
                  {
                    order_id: order_details.order_id,
                  },
                  logs_payload
                ):await order_logs.update_logs_data(
                  {
                    order_id: order_details.order_id,
                  },
                  logs_payload
                );

                
                let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                    merchant_id: order_details.merchant_id,
                  }
                );

                const web_hook_res = Object.assign({}, res_obj);

                if (hook_info[0]) {
                  if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
                    let url = hook_info[0].notification_url;
                    let webhook_res = await send_webhook_data(
                      url,
                      web_hook_res,
                      hook_info[0].notification_secret
                    );
                  }
                }
                return res
                  .status(statusCode.ok)
                  .send(
                    response.successansmsg(
                      res_obj,
                      "Transaction successfully Captured."
                    )
                  );
              } else {
                let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
                var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Update order.`
                );
                let order_update = {
                  terminal_id: mid_details.terminal_id,
                  psp: "PAYTABS",
                  updated_at: updated_at,
                  status:
                    order_response_paytabs?.tran_type.toUpperCase() == "SALE"
                      ? "CAPTURED"
                      : "AUTHORISED",
                  payment_mode:
                  'APPLE_PAY',
                  scheme: order_response_paytabs?.payment_info?.card_scheme,
                  psp_id: mid_details.psp_id,
                  capture_datetime: updated_at,
                  payment_id: payment_id,
                };
                let order_update_res = await merchantOrderModel.updateDynamic(
                  order_update,
                  { order_id: order_id },
                  mode=='test'?"test_orders":"orders"
                );
                let capture_no = order_response_paytabs.tran_ref;
                let order_txn = {
                  status:
                    order_response_paytabs.payment_result.response_message ==
                    "CAPTURED"
                      ? "AUTHORISED"
                      : order_response_paytabs.payment_result.response_message.toUpperCase(),
                  psp_code: "00",
                  remark: "",
                  txn: payment_id,
                  type:
                    order_details.action.toUpperCase() == "SALE" &&
                    order_response_paytabs.payment_result.response_message.toUpperCase() ==
                      "CAPTURED"
                      ? "CAPTURE"
                      : order_response_paytabs.payment_result.response_message.toUpperCase(),
                  capture_no: capture_no,
                  order_id: order_details.order_id,
                  amount: order_details.amount,
                  currency: order_details.currency,
                  payment_id:order_response_paytabs.tran_ref,
                  created_at: updated_at,
                };
                await orderTransactionModel.add(order_txn,mode=='test'?'test_order_txn':'order_txn');
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Insert data into order transaction.`
                );
                let p_request_id = await helpers.make_sequential_no(mode=='test'?"TST_REQ":"REQ");
                let order_req = {
                  merchant_id: order_details.merchant_id,
                  order_id: order_id,
                  request_id: p_request_id,
                  request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req,mode=='test'?"test_generate_request_id":"generate_request_id");

                let new_res = {
                  m_order_id: order_details.merchant_order_id
                    ? order_details.merchant_order_id
                    : "",
                  p_order_id: order_details.order_id
                    ? order_details.order_id
                    : "",
                  p_request_id: p_request_id,
                  psp_ref_id: order_response_paytabs.tran_ref,
                  psp_txn_id: capture_no,
                  transaction_id: payment_id,
                  status:
                    order_response_paytabs.payment_result.response_message.toUpperCase(),
                  status_code:'00',
                  remark:
                    order_response_paytabs.payment_result.response_message,
                  paydart_category: "Success",
                  currency: order_details.currency,
                  return_url: process.env.DEFAULT_FAILED_URL,
                  transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                  amount: Number(order_details.amount).toFixed(2),
                  m_customer_id: order_details.merchant_customer_id
                    ? order_details.merchant_customer_id
                    : "",
                  psp: "PSP",
                  payment_method:'APPLE_PAY',
                  m_payment_token: order_details.card_id,
                  payment_method_data: {
                    scheme: order_response_paytabs.payment_info.card_scheme,
                    card_country: order_details.card_country,
                    card_type: order_response_paytabs.payment_info.card_type,
                    mask_card_number:
                      order_response_paytabs.payment_info.payment_description,
                  },
                  apm_name: "APPLE_PAY",
                  apm_identifier: "",
                  sub_merchant_identifier: order_details?.merchant_id
                    ? await helpers.formatNumber(order_details?.merchant_id)
                    : "",
                };
                let res_obj = {
                  order_status:
                    order_response_paytabs.payment_result.response_message.toUpperCase(),
                  payment_id: payment_id,
                  order_id: order_details?.order_id,
                  amount: Number(order_details?.amount).toFixed(2),
                  currency: order_details?.currency,
                  token: req.body.browserFP || "",
                  return_url: order_details.success_url,
                  message: "",
                  new_res: new_res,
                };
                logs.push(
                  `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                  )} : Send Response.`
                );
                let logs_payload = {
                  activity: JSON.stringify(logs),
                  updated_at: updated_at,
                };
                
                let log_is = mode=='test'?await order_logs.update_test_logs_data(
                  {
                    order_id: order_details.order_id,
                  },
                  logs_payload
                ):await order_logs.update_logs_data(
                  {
                    order_id: order_details.order_id,
                  },
                  logs_payload
                );

                
                let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                    merchant_id: order_details.merchant_id,
                  }
                );

                const web_hook_res = Object.assign({}, res_obj);

                if (hook_info[0]) {
                  if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
                    let url = hook_info[0].notification_url;
                    let webhook_res = await send_webhook_data(
                      url,
                      web_hook_res,
                      hook_info[0].notification_secret
                    );
                  }
                }
                return res
                  .status(statusCode.ok)
                  .send(
                    response.errorMsgWithData(
                      "Unable to pay using Apple Pay.",
                      res_obj,
                    )
                  );
                
              }
            } else {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.validationResponse(
                    "APPLE Pay is not supported by this merchant."
                  )
                );
            }
          } else {
            return res
              .status(statusCode.badRequest)
              .send(
                response.validationResponse("MID NOT found for the merchant")
              );
          }
        } else {
          return res
            .status(statusCode.badRequest)
            .send(response.validationResponse("Order already processed!"));
        }
      } else {
        return res
          .status(statusCode.badRequest)
          .send(response.validationResponse("Order does not exit!"));
      }
    } catch (error) {
      console.log(error);
      winston.error(error);
      return res
        .status(statusCode.badRequest)
        .send(response.validationResponse(error));
    }
  },
};

module.exports = paytabs_apple_pay;
