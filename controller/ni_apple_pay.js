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

const createToken = async (_terminalcred,mode) => {
  let url = mode=='test'?credientials.ni.test_url:credientials.ni.base_url;
  var support_config = {
    method: "POST",
    url: `${url}/identity/auth/access-token`,
    headers: {
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Authorization: `Basic ${_terminalcred.password}`,
    },
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
const createOrder = async (order_data, _terminalcred, access_token,mode) => {
  let url = mode=='test'?credientials.ni.test_url:credientials.ni.base_url;
  var support_config = {
    method: "POST",
    url: `${url}/transactions/outlets/${_terminalcred.MID}/orders`,
    headers: {
      accept: "application/vnd.ni-payment.v2+json",
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Authorization: `Bearer ${access_token}`,
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
const postDataToNiApplePay = async (url, body, access_token) => {
  var support_config = {
    method: "PUT",
    url: url,
    headers: {
      accept: "application/vnd.ni-payment.v2+json",
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Authorization: `Bearer ${access_token}`,
    },
    data: body,
    validateStatus: false,
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
var ni_apple_pay = {
  pay: async (req, res, next) => {
    // Fetch Order details
    let mode = req.bodyString('mode');
      let logs =mode=='test'?await order_logs.get_test_log_data(req.bodyString("order_no")):await order_logs.get_log_data(req.bodyString("order_no"));
      
      
      let order_id = req.bodyString("order_no");
      let order_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: order_id },
        mode=='test'?'test_orders':"orders"
      );
    try {
      
      if (order_details && order_details.status == "PENDING") {
        let getMid = await merchantOrderModel.selectMIDNI(
          "mid.id,mid.terminal_id,mid.MID,mid.password,mid.currency_id,mid.payment_methods,mid.payment_schemes,mid.minTxnAmount,mid.maxTxnAmount,mid.psp_id",
          {
            "mid.submerchant_id": order_details.merchant_id,
            "mid.deleted":0,
            "psp.credentials_key": "ni",
            "mid.env":mode
          }
        );
        logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Fetch the MID details.`);
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

            let createTokenResponse = await createToken(mid_details,mode);
            logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Created NI token.`);
            let access_token = createTokenResponse.access_token;
            let order_data = {
              action: "SALE",
              amount: {
                currencyCode: order_details.currency,
                value: order_details.amount*100,
              },
              emailAddress: order_details.customer_email,
              billingAddress: {
                firstName: order_details.customer_name,
                lastName: "",
              },
            };
            let order_response_ni = await createOrder(
              order_data,
              mid_details,
              access_token,
              mode
            );
            
            logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : NI order created.`);
            let apple_pay_url =
              order_response_ni._embedded.payment[0]._links["payment:apple_pay"]
                .href;
            let apple_pay_body = req.body;
            delete apple_pay_body.order_no;
            logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Get APPLE PAY url.`);
            let apple_payment_response = await postDataToNiApplePay(
              apple_pay_url,
              apple_pay_body,
              access_token
            );
            
            logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Paid using APPLE PAY.`);
            var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
            
            if (apple_payment_response.state == "CAPTURED") {
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update order.`);
              let order_update = {
                terminal_id: mid_details.terminal_id,
                psp: "NI",
                updated_at: updated_at,
                status: "CAPTURED",
                payment_mode: apple_payment_response.paymentMethod.name,
                scheme: apple_payment_response.paymentMethod.cardScheme,
                psp_id: mid_details.psp_id,
                capture_datetime: updated_at,
                payment_id:payment_id
              };
              let order_update_res = await merchantOrderModel.updateDynamic(
                order_update,
                { order_id: order_id },
                mode=='test'?'test_orders':"orders"
              );
              let capture_no =
                apple_payment_response?._embedded[
                  "cnp:capture"
                ][0]._links?.self?.href.split("/captures/")[1];
              let order_txn = {
                status:
                  apple_payment_response.state == "CAPTURED"
                    ? "AUTHORISED"
                    : apple_payment_response.state,
                psp_code: "00",
                remark: "",
                txn: payment_id,
                type:
                  order_details.action.toUpperCase() == "SALE" &&
                  apple_payment_response.state == "CAPTURED"
                    ? "CAPTURE"
                    : order_details.action.toUpperCase(),
                payment_id: apple_payment_response.reference,
                order_reference_id: apple_payment_response.orderReference,
                capture_no: capture_no,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                created_at: updated_at,
              };
              await orderTransactionModel.add(order_txn,mode=='test'?'test_order_txn':'order_txn');
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Insert data into order transaction.`);
              let p_request_id =
              await helpers.make_sequential_no(mode=='test'?'TST_REQ':"REQ");
              let order_req = {
                  merchant_id: order_details.merchant_id,
                  order_id: order_id,
                  request_id: p_request_id,
                  request: JSON.stringify(req.body),
              };
              await helpers.common_add(order_req, mode=='test'?'test_generate_request_id':"generate_request_id");
              let response_category =
              await helpers.get_error_category(
                apple_payment_response?.authResponse?.resultCode,
                  "ni",
                  apple_payment_response.state
              );
              /* New Response*/ 
              let new_res = {
                m_order_id: order_details.merchant_order_id
                    ? order_details.merchant_order_id
                    : "",
                p_order_id: order_details.order_id
                    ? order_details.order_id
                    : "",
                p_request_id: p_request_id,
                psp_ref_id: apple_payment_response.reference,
                psp_txn_id: capture_no,
                transaction_id: payment_id.orderReference,
                status: apple_payment_response.state,
                status_code:apple_payment_response.authResponse.resultCode,
                remark: response_category.response_details,
                paydart_category: response_category.category,
                currency: order_details.currency,
                return_url: process.env.DEFAULT_SUCCESS_URL,
                transaction_time: moment().format(
                    "DD-MM-YYYY hh:mm:ss"
                ),
                amount: Number(order_details.amount).toFixed(2),
                m_customer_id:
                order_details.merchant_customer_id
                        ? order_details.merchant_customer_id
                        : "",
                psp: "NI",
                payment_method:  apple_payment_response.paymentMethod.name,
                m_payment_token: order_details.card_id,
                payment_method_data: {
                    scheme: apple_payment_response.paymentMethod.cardScheme,
                    card_country:
                    order_details.card_country,
                    card_type: '',
                    mask_card_number: '',
                },
                apm_name: "APPLE_PAY",
                apm_identifier: "",
                sub_merchant_identifier:
                order_details?.merchant_id
                        ? await helpers.formatNumber(
                          order_details?.merchant_id
                        )
                        : "",
            };
            let res_obj = {
                order_status: apple_payment_response.state,
                payment_id: payment_id,
                order_id: order_details?.order_id,
                amount: Number(order_details?.amount).toFixed(2),
                currency: order_details?.currency,
                token: req.body.browserFP || "",
                return_url: order_details.success_url,
                message: apple_payment_response.message,
                new_res: new_res,
            };
              /* New Response End*/ 
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Send Response.`);
                 
                 let logs_payload = {
                  activity: JSON.stringify(logs),
                  updated_at: updated_at,
              };
              
              let log_is = mode=='test'?await order_logs
              .update_test_logs_data(
                  {
                      order_id: order_details.order_id,
                  },
                  logs_payload
              ):await order_logs
                  .update_logs_data(
                      {
                          order_id: order_details.order_id,
                      },
                      logs_payload
                  );
                 
                
              // web  hook starting
              let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                      merchant_id: order_details.merchant_id,
                  }
              );

              const web_hook_res = Object.assign({}, res_obj);
              // delete web_hook_res.return_url;
              // delete web_hook_res.paydart_category;
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
              res
                .status(statusCode.ok)
                .send(
                  response.successansmsg(
                    res_obj,
                    "Transaction successfully Captured."
                  )
                ); 
            } else {
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update order.`);
              let order_update = {
                terminal_id: mid_details.terminal_id,
                psp: "NI",
                updated_at: updated_at,
                status: apple_payment_response.state,
                payment_mode: apple_payment_response.paymentMethod.name,
                scheme: apple_payment_response.paymentMethod.cardScheme,
                psp_id: mid_details.psp_id,
                capture_datetime: updated_at,
                payment_id:payment_id
              };
              let order_update_res = await merchantOrderModel.updateDynamic(
                order_update,
                { order_id: order_id },
                mode=='test'?'test_orders':"orders"
              );
             
              let order_txn = {
                status:apple_payment_response.state,
                psp_code: apple_payment_response.authResponse.resultCode,
                remark: apple_payment_response.authResponse.resultMessage,
                txn: payment_id,
                type:
                  order_details.action.toUpperCase() == "SALE" &&
                  apple_payment_response.state == "CAPTURED"
                    ? "CAPTURE"
                    : order_details.action.toUpperCase(),
                payment_id: apple_payment_response.reference,
                order_reference_id: apple_payment_response.orderReference,
                capture_no: '',
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                created_at: updated_at,
              };
              await orderTransactionModel.add(order_txn,mode=='test'?'test_order_txn':'order_txn');
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Insert data into order transaction.`);
              let p_request_id =
              await helpers.make_sequential_no(mode=='test'?'TST_REQ':"REQ");
              let order_req = {
                  merchant_id: order_details.merchant_id,
                  order_id: order_id,
                  request_id: p_request_id,
                  request: JSON.stringify(req.body),
              };
              await helpers.common_add(order_req, mode=='test'?'test_generate_request_id':"generate_request_id");
              let response_category =
              await helpers.get_error_category(
                apple_payment_response?.authResponse?.resultCode,
                  "ni",
                  apple_payment_response.state
              );
              /* New Response*/ 
              let new_res = {
                m_order_id: order_details.merchant_order_id
                    ? order_details.merchant_order_id
                    : "",
                p_order_id: order_details.order_id
                    ? order_details.order_id
                    : "",
                p_request_id: p_request_id,
                psp_ref_id: apple_payment_response.reference,
                psp_txn_id: '',
                transaction_id: payment_id.orderReference,
                status: apple_payment_response.state,
                status_code:apple_payment_response.authResponse.resultCode,
                remark: response_category.response_details,
                paydart_category: response_category.category,
                currency: order_details.currency,
                return_url: process.env.DEFAULT_FAILED_URL,
                transaction_time: moment().format(
                    "DD-MM-YYYY hh:mm:ss"
                ),
                amount: Number(order_details.amount).toFixed(2),
                m_customer_id:
                order_details.merchant_customer_id
                        ? order_details.merchant_customer_id
                        : "",
                psp: "NI",
                payment_method:  apple_payment_response.paymentMethod.name,
                m_payment_token: order_details.card_id,
                payment_method_data: {
                    scheme: apple_payment_response.paymentMethod.cardScheme,
                    card_country:
                    order_details.card_country,
                    card_type: '',
                    mask_card_number: '',
                },
                apm_name: "APPLE_PAY",
                apm_identifier: "",
                sub_merchant_identifier:
                order_details?.merchant_id
                        ? await helpers.formatNumber(
                          order_details?.merchant_id
                        )
                        : "",
            };
            let res_obj = {
                order_status: apple_payment_response.state,
                payment_id: payment_id,
                order_id: order_details?.order_id,
                amount: Number(order_details?.amount).toFixed(2),
                currency: order_details?.currency,
                token: req.body.browserFP || "",
                return_url: order_details.success_url,
                message: apple_payment_response.message,
                new_res: new_res,
            };
              /* New Response End*/ 
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Send Response.`);
                 
                 let logs_payload = {
                  activity: JSON.stringify(logs),
                  updated_at: updated_at,
              };
              
              let log_is = mode=='test'?await order_logs
              .update_test_logs_data(
                  {
                      order_id: order_details.order_id,
                  },
                  logs_payload
              ): await order_logs
                  .update_logs_data(
                      {
                          order_id: order_details.order_id,
                      },
                      logs_payload
                  );
                 
                
              // web  hook starting
              let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                      merchant_id: order_details.merchant_id,
                  }
              );

              const web_hook_res = Object.assign({}, res_obj);
              // delete web_hook_res.return_url;
              // delete web_hook_res.paydart_category;
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
                  "Unable to pay with APPLE Pay.",res_obj
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
          .send(response.validationResponse("Order Already Processed!!"));
      }
    } catch (error) {
      console.log(error);
      winston.error(error);
      let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
      logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update order.`);
              let order_update = {
                psp: "NI",
                updated_at: updated_at,
                status: 'FAILED',
                payment_mode: 'APPLE_PAY',
                scheme: '',
                psp_id: '',
                capture_datetime: updated_at,
                payment_id:payment_id
              };
              let order_update_res = await merchantOrderModel.updateDynamic(
                order_update,
                { order_id: order_id },
                mode=='test'?'test_orders':"orders"
              );
             
              let order_txn = {
                status:'FAILED',
                psp_code: '',
                remark: error.message,
                txn: payment_id,
                type:
                  order_details.action.toUpperCase(),
                payment_id: '',
                order_reference_id: '',
                capture_no: '',
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                created_at: updated_at,
              };
              await orderTransactionModel.add(order_txn,mode=='test'?'test_order_txn':'order_txn');
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Insert data into order transaction.`);
              let p_request_id =
              await helpers.make_sequential_no(mode=='test'?'TST_REQ':"REQ");
              let order_req = {
                  merchant_id: order_details.merchant_id,
                  order_id: order_id,
                  request_id: p_request_id,
                  request: JSON.stringify(req.body),
              };
              await helpers.common_add(order_req, mode=='test'?'test_generate_request_id':"generate_request_id");
              let response_category =
              await helpers.get_error_category(
              '01',
                  "ni",
                 'FAILED'
              );
              /* New Response*/ 
              let new_res = {
                m_order_id: order_details.merchant_order_id
                    ? order_details.merchant_order_id
                    : "",
                p_order_id: order_details.order_id
                    ? order_details.order_id
                    : "",
                p_request_id: p_request_id,
                psp_ref_id: '',
                psp_txn_id: '',
                transaction_id: payment_id.orderReference,
                status: 'FAILED',
                status_code:'01',
                remark: response_category.response_details,
                paydart_category: response_category.category,
                currency: order_details.currency,
                return_url: process.env.DEFAULT_FAILED_URL,
                transaction_time: moment().format(
                    "DD-MM-YYYY hh:mm:ss"
                ),
                amount: Number(order_details.amount).toFixed(2),
                m_customer_id:
                order_details.merchant_customer_id
                        ? order_details.merchant_customer_id
                        : "",
                psp: "NI",
                payment_method:  'APPLE_PAY',
                m_payment_token: order_details.card_id,
                payment_method_data: {
                    scheme: '',
                    card_country:
                    order_details.card_country,
                    card_type: '',
                    mask_card_number: '',
                },
                apm_name: "APPLE_PAY",
                apm_identifier: "",
                sub_merchant_identifier:
                order_details?.merchant_id
                        ? await helpers.formatNumber(
                          order_details?.merchant_id
                        )
                        : "",
            };
            let res_obj = {
                order_status: 'FAILED',
                payment_id: payment_id,
                order_id: order_details?.order_id,
                amount: Number(order_details?.amount).toFixed(2),
                currency: order_details?.currency,
                token: req.body.browserFP || "",
                return_url: order_details.success_url,
                message: error.message,
                new_res: new_res,
            };
              /* New Response End*/ 
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Send Response.`);
                 
                 let logs_payload = {
                  activity: JSON.stringify(logs),
                  updated_at: updated_at,
              };
              
              let log_is = mode=='test'?await order_logs
              .update_test_logs_data(
                  {
                      order_id: order_details.order_id,
                  },
                  logs_payload
              ): await order_logs
                  .update_logs_data(
                      {
                          order_id: order_details.order_id,
                      },
                      logs_payload
                  );
                 
                
              // web  hook starting
              let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                      merchant_id: order_details.merchant_id,
                  }
              );

              const web_hook_res = Object.assign({}, res_obj);
              // delete web_hook_res.return_url;
              // delete web_hook_res.paydart_category;
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
                  "Unable to pay with APPLE Pay.",res_obj
                )
              );
     
    }
  },
};

module.exports = ni_apple_pay;
