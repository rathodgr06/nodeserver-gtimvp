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

var telr_apple_pay = {
    pay: async (req, res,next) => {
      // Fetch Order details
      let mode = req.bodyString('mode');
        let logs =mode=='test'?await order_logs.get_test_log_data(req.bodyString("order_id")):await order_logs.get_log_data(req.bodyString("order_id"));
        
        
        let order_id = req.bodyString("order_id");
        let order_details = await merchantOrderModel.selectDynamicONE(
          "*",
          { order_id: order_id },
          mode=='test'?'test_orders':"orders"
        );
      try {
        
        if (order_details && order_details.status == "PENDING") {
          let getMid = await merchantOrderModel.selectMIDNI(
            "mid.id,mid.terminal_id,mid.MID,mid.password,mid.v2_telr_key,mid.currency_id,mid.payment_methods,mid.payment_schemes,mid.minTxnAmount,mid.maxTxnAmount,mid.psp_id",
            {
              "mid.submerchant_id": order_details.merchant_id,
              "mid.deleted":0,
              "psp.credentials_key": "telr",
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
              
              // //console.log(fraudData);
              if(fraudData){
                return res.status(statusCode.ok).send(response.errorMsgWithData("Transaction Failed.", fraudData));
              }
              
              const axios = require('axios');
              const qs = require('qs');
              let data = qs.stringify({
                'ivp_method': 'applepay',
                'ivp_store': mid_details.MID,
                'ivp_authkey': mid_details.v2_telr_key,
                'ivp_amount': order_details.amount,
                'ivp_currency': order_details.currency,
                'ivp_test': '0',
                'ivp_desc': order_details.remark,
                'return_auth': order_details.success_url,
                'return_decl': order_details.failed_url,
                'return_can': order_details.canel_url,
                'bill_fname': order_details.customer_name,
                'bill_sname': '',
                'bill_addr1': order_details.billing_address_line_1+' '+order_details.billing_address_line_2,
                'bill_city': order_details.billing_city,
                'bill_region': order_details.billing_province,
                'bill_country': order_details.billing_country,
                'bill_zip': order_details.billing_pincode,
                'bill_email': order_details.customer_email,
                'ivp_lang': 'en',
                'ivp_applepay': '1',
                'ivp_cart': order_details.order_id,
                'ivp_trantype': 'Sale',
                'ivp_tranclass': 'ecom',
                'delv_addr1':order_details.shipping_address_line_1,
                'delv_addr2':order_details.shipping_address_line_2,
                'delv_addr3': '',
                'delv_city': order_details.shipping_city,
                'delv_region': order_details.shipping_province,
                'delv_country':order_details.shipping_country,
                'applepay_enc_version': req.body.apple_pay_token.paymentData.version,
                'applepay_enc_paydata': req.body.apple_pay_token.paymentData.data,
                'applepay_enc_paysig': req.body.apple_pay_token.paymentData.signature,
                'applepay_enc_pubkey':req.body.apple_pay_token.paymentData.header.ephemeralPublicKey,
                'applepay_enc_keyhash': req.body.apple_pay_token.paymentData.header.publicKeyHash,
                'applepay_tran_id': req.body.apple_pay_token.paymentData.header.transactionId,
                'applepay_card_desc': req.body.apple_pay_token.paymentMethod.type,
                'applepay_card_scheme':req.body.apple_pay_token.paymentMethod.displayName,
                'applepay_card_type': req.body.apple_pay_token.paymentMethod.network,
                'applepay_tran_id2':req.body.apple_pay_token.transactionIdentifier,
                
              });

              let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://secure.telr.com/gateway/remote.json',
                headers: { 
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                data : data
              };

            let telr_response = await  axios.request(config);
            console.log(telr_response);
            console.log(typeof telr_response?.data?.error=='object')
             if(typeof telr_response?.data?.error=='object'){
              throw telr_response.data;
             }
              
              logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Paid using APPLE PAY.`);
              var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
              let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
              
              if (telr_response.data.transaction.status == "A") {
                logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update order.`);
                let order_update = {
                  terminal_id: mid_details.terminal_id,
                  psp: "TELR",
                  updated_at: updated_at,
                  status: "CAPTURED",
                  payment_mode: 'APPLE_PAY',
                  scheme: req.body.apple_pay_token.paymentMethod.network,
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
                  status:"AUTHORISED",
                  psp_code: telr_response.data.transaction.code,
                  remark: telr_response.data.transaction.message,
                  txn: payment_id,
                  type:order_details.action.toUpperCase(),
                  payment_id: telr_response.data.transaction.ref,
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
                  telr_response.data.transaction.code,
                    "ni",
                    telr_response.data.transaction.status=='A'?'SUCCESS':'FAILED'
                );
                let new_res = {
                  m_order_id: order_details.merchant_order_id
                      ? order_details.merchant_order_id
                      : "",
                  p_order_id: order_details.order_id
                      ? order_details.order_id
                      : "",
                  p_request_id: p_request_id,
                  psp_ref_id: telr_response.data.transaction.ref,
                  psp_txn_id: '',
                  transaction_id: telr_response.data.transaction.ref,
                  status: telr_response.data.transaction.status=='A'?'SUCCESS':"FAILED",
                  status_code:telr_response.data.transaction.code,
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
                  psp: "TELR",
                  payment_method:  'APPLE_PAY',
                  m_payment_token: order_details.card_id,
                  payment_method_data: {
                      scheme: req.body.apple_pay_token.paymentMethod.network,
                      card_country:
                      order_details.card_country,
                      card_type: req.body.apple_pay_token.paymentMethod.type,
                      mask_card_number: req.body.apple_pay_token.paymentMethod.displayName,
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
                  order_status: telr_response.data.transaction.status=='A'?'CAPTURED':'FAILED',
                  payment_id: payment_id,
                  order_id: order_details?.order_id,
                  amount: Number(order_details?.amount).toFixed(2),
                  currency: order_details?.currency,
                  token: req.body.browserFP || "",
                  return_url: order_details.success_url,
                  message: telr_response.data.transaction.message,
                  new_res: new_res,
              };
                logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Send Response.`);
                   
                 
                   
                  
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
                  psp: "TELR",
                  updated_at: updated_at,
                  status: "FAILED",
                  payment_mode: 'APPLE_PAY',
                  scheme: req.body.apple_pay_token.paymentMethod.network,
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
                  status:"FAILED",
                  psp_code: telr_response.data.transaction.code,
                  remark: telr_response.data.transaction.message,
                  txn: payment_id,
                  type:order_details.action.toUpperCase(),
                  payment_id: telr_response.data.transaction.ref,
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
                  telr_response.data.transaction.code,
                    "telr",
                    telr_response.data.transaction.status=='A'?'SUCCESS':'FAILED'
                );
                let new_res = {
                  m_order_id: order_details.merchant_order_id
                      ? order_details.merchant_order_id
                      : "",
                  p_order_id: order_details.order_id
                      ? order_details.order_id
                      : "",
                  p_request_id: p_request_id,
                  psp_ref_id: telr_response.data.transaction.ref,
                  psp_txn_id: '',
                  transaction_id: telr_response.data.transaction.ref,
                  status: telr_response.data.transaction.status=='A'?'SUCCESS':"FAILED",
                  status_code:telr_response.data.transaction.code,
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
                  psp: "TELR",
                  payment_method:  'APPLE_PAY',
                  m_payment_token: order_details.card_id,
                  payment_method_data: {
                      scheme: req.body.apple_pay_token.paymentMethod.network,
                      card_country:
                      order_details.card_country,
                      card_type: req.body.apple_pay_token.paymentMethod.type,
                      mask_card_number: req.body.apple_pay_token.paymentMethod.displayName,
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
                  order_status: telr_response.data.transaction.status=='A'?'CAPTURED':'FAILED',
                  payment_id: payment_id,
                  order_id: order_details?.order_id,
                  amount: Number(order_details?.amount).toFixed(2),
                  currency: order_details?.currency,
                  token: req.body.browserFP || "",
                  return_url: order_details.success_url,
                  message: telr_response.data.transaction.message,
                  new_res: new_res,
              };
                logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Send Response.`);
                   
                   let logs_payload = {
                    activity: JSON.stringify(logs),
                    updated_at: updated_at,
                };
                
                   
                  
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
        //console.log(error);
        console.log(`inside the catch of error`);
        let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
        logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update order.`);
                let order_update = {
                  psp: "TELR",
                  updated_at: updated_at,
                  status: 'FAILED',
                  payment_mode: 'APPLE_PAY',
                  scheme: '',
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
                  remark: error.error.message,
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
                    "telr",
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
                  return_url: 'http://localhost/ganesh_pay/checkout/checkout/status',//process.env.DEFAULT_FAILED_URL,
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
  
  module.exports = telr_apple_pay;