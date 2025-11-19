const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const path = require('path')
require('dotenv').config({ path: "../.env" });
const env = process.env.ENVIRONMENT
const config = require('../../config/config.json')[env];
const pool = require('../../config/database');
const axios = require('axios');
const helpers = require("../helper/general_helper");
const moment = require('moment');
const merchantOrderModel = require('../../models/merchantOrder');
const enc_dec = require('../../utilities/decryptor/decryptor')
const orderTransactionModel = require('../../models/order_transaction');
const order_logs = require("../../models/order_logs");
const logger = require('../../config/logger');
module.exports = async (req, res, next, redirectTrue = false) => {
  let url = process.env.FRAUD_ENGINE_URL;
  let data = req.body;
  data.browser_fingerprint = req.headers.fp
  data.operating_system = req.headers.os
  data.user_agent = req.headers.useragent
  data.browser = req.headers.browser
  data.device = req.headers.mobilebrand != "" ? "mobile" : "desktop"
  data.ip_country = req.headers.ipcountry
  data.ip_country_iso = req.headers.ipcountryiso
  data.ip_state = req.headers.ipstate
  data.isp = req.headers.isp?req.headers.isp.toLowerCase():''
  data.ip = req.headers.ip
  data.card_funding = req.card_details?req.card_details?.card_type.toLowerCase():''
  data.card_fingerprint = req.body.card_id
  data.card_scheme = req.card_details?.card_brand?req.card_details?.card_brand.toLowerCase():''
  data.card_currency = req.card_details?.currency_code?req.card_details?.currency_code.toLowerCase():''
  data.card_country = req.card_details?.country_code3?req.card_details?.country_code3:''
  data.payment_method = req.card_details?.card_type?(req.card_details?.card_type + " CARD").toLowerCase():''

  // console.log("req.card_details", req.card_details);

  let card_proxy = await getCardProxyByCardIdOrCardNo(req.body.card_id, req.body.card);
  let versionDetails = await helpers.check3dsVersion({ card_proxy: card_proxy });
  if (versionDetails && versionDetails?.version > 0) {
    data.is_3d_secure = true;
  } else if (versionDetails && versionDetails?.version == 0) {
    data.is_3d_secure = false
  } else {
    data.is_3d_secure = "na";
  }

  if(data.is_recuuring && data.is_recuuring == 1){
    delete(data.is_3d_secure);
  }


  //console.log(data);
  try {
    const config = {
      method: 'post',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'xusername': '074E1F9E8KF87HJDF8DF09DDD3A377760',
        'xpassword': '54607074E1F9E8KF87HJDF8DF09DDD'
      },
      data: data
    };
    const  response = await axios.request(config);
    console.log("🚀 ~ module.exports= ~ response:", response.data)

    if (req.body.payment_mode == 'test') {
      logs = await order_logs.get_test_log_data(req.body.order_id);
    } else {
      logs = await order_logs.get_log_data(req.body.order_id);
    }

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : Fraud check initiated`
    );

    let req_data_fraud =  Object.assign({}, req.body);
    if(req_data_fraud.card){
      req_data_fraud.card = "XXXX XXXX XXXX"+req_data_fraud.card.slice(-4);
    }

    if(req_data_fraud.cvv){
      delete(req_data_fraud.cvv);
    }
    
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req_data_fraud)}`
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : response from fraud check ${JSON.stringify(response.data)}`
    );

    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let logs_payload = {
      activity: JSON.stringify(logs),
      updated_at: updated_at,
    };
    let log_is = await order_logs.update_logs_data(
      {
        order_id: req.body.order_id,
      },
      logs_payload,
      req.body.payment_mode
    )


    const fraud_3ds_pending =  response?.data?.fraud_3ds_pending || 0
    if (response.data.status == 'fail') {
      const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
      const status = "FAILED";
      const mode = req.body.payment_mode;
      const table_name = mode === 'test' ? 'test_orders' : 'orders';
      const txn = await helpers.make_sequential_no(mode === 'test' ? 'TST_TXN' : 'TXN');
      const fraudRequestId = enc_dec.cjs_decrypt(response.data.request_id);

      const res_order_data = await merchantOrderModel.selectOne("*", { order_id: req.body.order_id }, table_name);
      const order_data = {
        status: status,
        updated_at: updated_at,
        fraud_request_id: fraudRequestId,
        fraud_request_type: response.data.status,
        fraud_3ds_pending : fraud_3ds_pending
      };

      await Promise.all([
        merchantOrderModel.updateDynamic(order_data, { order_id: req.body.order_id}, table_name),
        updatePaymentStatus("qr_payment", status, updated_at, req.body.order_id),
        updatePaymentStatus("subs_payment", status, updated_at, req.body.order_id),
        addOrderTransaction(txn, res_order_data, status, response.data.message, mode),
        addOrderRequest(req.body.order_id, mode),
      ]);

      const new_res = {
        m_order_id: res_order_data.merchant_order_id,
        p_order_id: res_order_data.order_id,
        p_request_id: await helpers.make_sequential_no(mode === 'test' ? "TST_REQ" : "REQ"),
        psp_ref_id: "",
        psp_txn_id: "",
        transaction_id: txn,
        status: "FAILED",
        status_code: "143",
        remark: response.data.message,
        paydart_category: "Decline",
        currency: res_order_data.currency,
        amount: res_order_data?.amount || "",
        m_customer_id: res_order_data.merchant_customer_id,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        return_url: res_order_data.return_url || process.env.DEFAULT_FAILED_URL,
        payment_method_data: {
          scheme: req.card_details?.card_brand,
          card_country: req.card_details?.country_code,
          card_type: req.card_details?.card_type,
          mask_card_number: req.card_details?.card?maskify(req.card_details.card):'',
        },
        sub_merchant_identifier: res_order_data?.merchant_id ? await helpers.formatNumber(res_order_data?.merchant_id) : "",
      };

  
      if (redirectTrue) {
          return { type: "risk_decline", new_res: new_res };
      } else {
        return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("Transaction Failed.", { type: "risk_decline", new_res: new_res }));
      }


      async function updatePaymentStatus(tableName, status, updated_at, order_id) {
        const payment = await merchantOrderModel.selectOne("id", { order_no: order_id }, tableName);
        if (payment) {
          const data = { payment_status: status, transaction_date: updated_at };
          await merchantOrderModel.updateDynamic(data, { id: payment.id }, tableName);
        }
      }

      async function addOrderTransaction(txn, res_order_data, status, message, mode) {
        const order_txn = {
          status: status,
          txn: txn,
          type: res_order_data?.action.toUpperCase(),
          payment_id: txn,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: updated_at,
          order_reference_id: "",
          capture_no: "",
          remark: message,
        };

        if (mode === 'test') {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }
      }

      async function addOrderRequest(order_id, mode) {
        const p_request_id = await helpers.make_sequential_no(mode === 'test' ? "TST_REQ" : "REQ");
        const order_req = { merchant_id: res_order_data?.merchant_id, order_id: order_id, request_id: p_request_id, request: "FAILED" };
        await helpers.common_add(order_req, "generate_request_id");
      }

    
  } else if (response.data.status == 'review') {
    let mode = req.body.payment_mode;
    const table_name = mode == 'test' ? 'test_orders' : "orders";
    // console.log(mode)
    // console.log(table_name)
    // console.log(req.body.order_id)
    let fraudRequestId = enc_dec.cjs_decrypt(response.data.request_id);
    //console.log(fraudRequestId,"fraudRequestId");

    let currentDate = moment();
    let newDateTime = currentDate.add(12, "hours");
    let capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");
    let order_data = {
      action: "AUTH",
      fraud_request_id: fraudRequestId,
      fraud_request_type: response.data.status,
      capture_datetime: capture_datetime,
      fraud_3ds_pending : fraud_3ds_pending
    }
    let updateRes = await merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.body.order_id,
        },
        table_name
      );

    if (redirectTrue) {
      return false;
    }
    next();

  } else {
    let mode = req.body.payment_mode;
    const table_name = mode == 'test' ? 'test_orders' : "orders";
    let fraudRequestId = enc_dec.cjs_decrypt(response.data.request_id);
    let order_data = {
      fraud_request_id: fraudRequestId,
      fraud_request_type: response.data.status,
      fraud_3ds_pending : fraud_3ds_pending
    }
    let updateRes = await merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.body.order_id,
        },
        table_name
      );

    if (redirectTrue) {
      return false;
    }

    next();
  }

} catch (error) {
  console.log(error);
  logger.error(500,{message: error,stack: error?.stack});
}
}


function maskify(creditCard) {
  if (creditCard.length < 6) return creditCard;
  const last4Characters = creditCard.substr(-4);
  const firstCharacter = creditCard.substr(0, 6);
  const maskingCharacters = creditCard
    .substr(-4, creditCard.length - 5)
    .replace(/\d/g, "x");
  return `${firstCharacter}${maskingCharacters}${last4Characters}`;
}

async function getCardProxyByCardIdOrCardNo(card_id, card_no) {
  if (card_id == '') {
    let card_proxy = enc_dec.encrypt_card(card_no);
    return card_proxy;
  } else {
    let card_details = await merchantOrderModel.selectOne(
      "*",
      {
        id: card_id,
      },
      "customers_cards"
    );
    let full_card_no = await enc_dec.dynamic_decryption(
      card_details?.card_number,
      card_details?.cipher_id
    );
    let card_proxy = ""
    if (full_card_no != "") {
      card_proxy = enc_dec.encrypt_card(full_card_no);
    } else {
      card_proxy = "msms"
    }

    return card_proxy;
  }
}