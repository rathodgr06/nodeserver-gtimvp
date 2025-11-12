const axios = require('axios');
const credentials = require('../../config/credientials');
const merchantOrderModel = require('../../models/merchantOrder');
const helpers = require('../../utilities/helper/general_helper');
const moment = require('moment');
const order_transactionModel = require('../../models/order_transaction');
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const enc_dec = require("../../utilities/decryptor/decryptor");
const cipherModel = require("../../models/cipher_models");
const { writeFileAsync } = require('xlsx');
const { v4: uuidv4 } = require('uuid')
const tokenCreate = require('./token');
const manageSub = require('../../utilities/subscription/index');
const EventEmitter = require("events");
const ee = new EventEmitter();
const SendTransactionMailAction = require('../SendTransactionMail');
const { send_webhook_data } = require("../webhook_settings");
const RequestMaker = require("./ReuqestMaker");


const fiserv3ds = async (req, res) => {
    let order_table = req.bodyString('mode')=="test"?"test_orders":"orders";
    let order_id = req.bodyString('order_id');
    let mode = req.bodyString('mode');
    let generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
    let order_details = await merchantOrderModel.selectDynamicONE('*',{order_id:order_id},order_table);
    let mid_details = await merchantOrderModel.selectDynamicONE('*',{terminal_id:order_details.terminal_id},'mid');
    let b_token = {
        os: req.headers?.os,
        browser: req.headers?.browser,
        browser_fingerprint: req.headers?.fp,
      };
     let browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(b_token));

    const key = mid_details.MID; //API Key goes here
    const secret = mid_details.password;
    let url = mode=="test"?credentials['fiserv']['test_url'] + 'payments/' + req.bodyString('transaction_id'):credentials['fiserv']['base_url'] + 'payments/' + req.bodyString('transaction_id');
    let body = {
        authenticationType: "Secure3D21AuthenticationUpdateRequest",
        methodNotificationStatus: "RECEIVED" // This is what we update
      };
    let fiserv_request = RequestMaker('PATCH', url, body, key, secret);
    console.log(fiserv_request);
    try{
    let response = await axios.patch(fiserv_request.url, fiserv_request.body, { headers: fiserv_request.headers });
    let response_data = response.data;
    let transactionStatus =response_data.transactionStatus;
    let send_res ={}; 
    let type ="";
    if(transactionStatus=="APPROVED"){
        send_res = await non3dsApproved(order_details, response_data, mode,req);
        type="non-3ds";
    }else{
        send_res = response_data;
        type="3ds";
    }
    send_res.type =type;
    return res.status(statusCode.ok).send(Server_response.successdatamsg(send_res,'','success'));
    }catch(error){
        console.log(`this come inside error block`);
        console.log(error.response.data);
        let response_data = error?.response?.data;
        let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
        let transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
        let order_req = {
          merchant_id: order_details.merchant_id,
          order_id: order_details?.order_id,
          request_id: paydart_req_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, generate_request_id_table);
        let response_category = await helpers.get_error_category(
          '01',
          "fiserv",
          "FAILED"
        );
        await merchantOrderModel.updateDynamic({ status: "FAILED" }, { order_id: order_id }, order_table);
        const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
        const order_txn_update = {
          txn: transaction_id.toString() ? transaction_id.toString() : "",
          order_id: order_details?.order_id || "",
          currency: order_details?.currency || "",
          amount: order_details?.amount || "",
          type: order_details?.action.toUpperCase(),
          status: "FAILED",
          psp_code: response_data?.error?.code || "",
          paydart_category: "Transaction FAILED",
          remark: response_data?.error?.message || "",
          capture_no: "",
          created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
          payment_id: response_data?.ipgTransactionId || "",
          order_reference_id: response_data?.orderId || "",
        };
        await insertFunction(order_txn_update);
        const res_obj = {
          message: "Transaction FAILED",
          order_status: "FAILED",
          payment_id: "",
          order_id: order_details.order_id,
          amount: order_details.amount,
          currency: order_details.currency,
          token: browser_token_enc,
          remark: response_data?.error?.message ? response_data?.error?.message : "",
          new_res: {
            m_order_id: order_details.merchant_order_id || "",
            p_order_id: order_details.order_id || "",
            p_request_id: paydart_req_id,
            psp_ref_id: response_data?.ipgTransactionId || "",
            psp_txn_id: response_data?.orderId || "",
            transaction_id: transaction_id.toString(),
            status: 'FAILED',
            status_code: response_data?.processor?.responseCode,
            remark: response_data?.processor?.responseMessage,
            paydart_category: 'FAILED',
            currency: order_details?.currency,
            return_url: order_details?.failure_url,//process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_details?.amount.toFixed(2) || "",
            m_customer_id: order_details?.merchant_customer_id || "",
            psp: order_details?.psp || "",
            payment_method: order_details?.payment_mode || "",
            payment_method_data: {
              scheme: order_details?.scheme || "",
              card_country: order_details?.card_country || "",
              card_type: order_details?.cardType || "",
              mask_card_number: order_details?.pan,
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: order_details?.merchant_id
              ? await helpers.formatNumber(order_details?.merchant_id)
              : "",
          }
        };
        let txnFailedLog = {
          order_id: order_details?.order_id,
          terminal: order_details?.terminal_id,
          req: JSON.stringify(req.body),
          res: '',
          psp: 'fiserv',
          status_code: "01" || "",
          description: response_data?.error?.message || "",
          activity: "Transaction FAILED with FISERV",
          status: 0,
          mode: mode,
          card_holder_name: order_details?.cardholderName || '',
          card: order_details?.pan,
          expiry: order_details?.expiry,
          cipher_id: "",
          txn: transaction_id.toString() ? transaction_id.toString() : "",
          card_proxy: "",
          "3ds_version": "",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        // web  hook starting
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: order_details.merchant_id,
        });
        let web_hook_res = Object.assign({}, res_obj.new_res);
        delete web_hook_res?.return_url;
        delete web_hook_res?.paydart_category;
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
        return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
        );
    }
}


module.exports = fiserv3ds;

async function non3dsApproved(order_details, response_data, mode,req) {
    console.log(order_details, response_data, mode);
    let generate_request_id_table;
    let order_table = mode == "test" ? "test_orders" : "orders"
    generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
    let transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
    const status = {
      status: response_data.transactionType == 'SALE' ? "CAPTURED" : "AUTHORISED",
      '3ds': 0,
      '3ds_status': 'NA'
    };
    await merchantOrderModel.updateDynamic(status, { order_id: order_details.order_id }, order_table);
    const order_txn = {
      txn: transaction_id.toString(),
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: response_data.transactionType == 'SALE' ? 'CAPTURE' : "AUTH",
      status: "AUTHORISED",
      psp_code: response_data.processor.authorizationCode,
      paydart_category: "Success",
      remark: "Transaction Approved",
      capture_no: "",
      created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
      payment_id: response_data?.ipgTransactionId || "",
      order_reference_id: response_data?.orderId || "",
    };
    const insert_to_txn_table = mode == "live" ? await order_transactionModel.add(order_txn) : order_transactionModel.test_txn_add(order_txn);
    let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
    let order_req = {
      merchant_id: order_details.merchant_id,
      order_id: order_details.order_id,
      request_id: paydart_req_id,
      request: JSON.stringify(req.body),
    };
    await helpers.common_add(order_req, generate_request_id_table);
  
    if (!insert_to_txn_table) {
      return res.status(statusCode.badRequest).send(Server_response.errormsg("Transaction insertion failed"));
    }
    let response_category = await helpers.get_error_category(
      response_data.transactionStatus == 'APPROVED' ? '0' : response_data.processor.responseCode,
      "fiserv",
      ""
    );
    console.log(`here the response category`);
    console.log(response_category);
    const res_obj = {
      message: response_data.transactionStatus === 'APPROVED' ? "Transaction Successful" : "Transaction FAILED",
      order_status: status.status,
      payment_id: response_data.ipgTransactionId,
      order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      token: "",
      remark: '',
      new_res: {
        m_order_id: order_details?.merchant_order_id || "",
        p_order_id: order_details?.order_id || "",
        p_request_id: paydart_req_id.toString(),
        psp_ref_id: response_data?.orderId || "",
        psp_txn_id: response_data?.ipgTransactionId || "",
        transaction_id: transaction_id.toString(),
        status: "SUCCESS",
        status_code: response_data?.processor?.responseCode,//final_response.data.response.acquirerCode,
        remark: response_data?.processor?.responseMessage,//final_response.data.response.acquirerMessage,
        paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
        currency: order_details.currency,
        return_url:response_data.transactionStatus === 'APPROVED'?order_details?.success_url:order_details?.failure_url, //process.env.PAYMENT_URL + "/status",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.merchant_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        payment_method_data: {
          scheme: order_details?.scheme || "",
          card_country: order_details?.card_country || "",
          card_type: order_details?.cardType || "",
          mask_card_number: order_details?.pan,
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
          ? await helpers.formatNumber(order_details?.merchant_id)
          : "",
      }
    };
  
    let txnFailedLog = {
      order_id: order_details.order_id,
      terminal: order_details?.terminal_id,
      req: JSON.stringify(req.body),
      res: '',
      psp: order_details.psp,
      status_code: response_data.processor.responseCode,
      description: response_data.processor.responseMessage,
      activity: `Transaction ${response_data.transactionStatus === 'APPROVED' ? 'SUCCESS' : 'FAILED'} with FISERV`,
      status: response_data.transactionStatus === 'APPROVED'  ? 1 : 0,
      mode: mode,
      card_holder_name: order_details?.cardholderName || '',
      card: order_details?.pan,
      expiry: order_details?.expiry,
      cipher_id: "",
      txn: transaction_id.toString(),
      card_proxy: order_details?.card_id,
      "3ds_version": "0",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
    await helpers.addTransactionFailedLogs(txnFailedLog);
    if (order_details.origin == 'SUBSCRIPTION') {
      subscriptionRes = await manageSub(order_details, final_response.data.result == 'SUCCESS' ? 'CAPTURED' : "FAILED", moment().format('YYYY-MM-DD HH:mm:ss'), payment_token_id, '', mode);
    }
    // web  hook starting
    let hook_info = await helpers.get_data_list("*", "webhook_settings", {
      merchant_id: order_details.merchant_id,
    });
    let web_hook_res = Object.assign({}, res_obj.new_res);
    delete web_hook_res?.return_url;
    delete web_hook_res?.paydart_category;
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
    if (response_data.transactionStatus == 'APPROVED') {
      ee.once("ping", async (arguments) => {
        // Sending mail to customers and merchants about transaction
        await SendTransactionMailAction(arguments)
  
      });
      ee.emit("ping", {
        order_table: order_table,
        order_id: order_details.order_id,
      });
    }
    return res_obj;
  }