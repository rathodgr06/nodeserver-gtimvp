const axios = require('axios');
const creds = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const orderTransactionModel = require('../../models/order_transaction');
const { send_webhook_data } = require("../../controller/webhook_settings");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const RequestMaker = require('./ReuqestMaker');
const fiserv_void = async(req,res)=>{
 try {
    // select capture details
    let transaction_id = req.bodyString("txn_id");
    let mode = req?.credentials?.type || req?.body?.mode;
    let transactionDetails = await orderTransactionModel.selectOne("order_reference_id,payment_id,amount,currency,order_id,type", { txn: transaction_id, status: "AUTHORISED", }, mode == 'test' ? "test_order_txn" : "order_txn");
    // select mid details
    let order_id = transactionDetails?.order_id
   
    const _terminalids = await merchantOrderModel.selectOne("*", { order_id: order_id, }, mode == 'test' ? 'test_orders' : "orders");
    let order_details = _terminalids;

    const mid_details = await merchantOrderModel.selectOne("MID,password,psp_id", { terminal_id: _terminalids.terminal_id, }, "mid");
    // raw request
    let url = mode == "test" ? creds['fiserv']['test_url'] + 'payments/' + transactionDetails.payment_id : creds['fiserv']['base_url'] + 'payments/' + transactionDetails.payment_id;
    let rawRequest = {
      "requestType": transactionDetails.type=="AUTH"?"VoidPreAuthTransactions":"VoidTransaction"
    }

    // make hmac
    const key = mid_details.MID; //API Key goes here
    const secret = mid_details.password;
    let fiserv_request = RequestMaker('POST', url, rawRequest, key, secret);
    // send request to fiserv
    let response = await axios.post(fiserv_request.url, fiserv_request.body, { headers: fiserv_request.headers });
    let response_data = response.data;
    let generate_payment_id = await helpers.make_sequential_no(mode == 'live' ? "TXN" : "TST_TXN");
    let order_txn = {};
    let order_status = "VOIDED";
    
    if (response_data.transactionStatus == "APPROVED") {
      // check partially or fully capture

      let txn_type = "VOID";
      order_txn = {
        status:"AUTHORISED",
        txn: generate_payment_id,
        type: txn_type,
        payment_id: response_data.ipgTransactionId,
        order_reference_id: response_data.orderId,
        capture_no: response_data.ipgTransactionId,
        order_id: order_id,
        amount: transactionDetails.amount,
        currency: transactionDetails.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };
      // if transaction is approved then only update order status
      let order_update = { status: order_status };
      let update_order = await merchantOrderModel.updateDynamic(order_update, { order_id: order_id, }, mode == 'test' ? 'test_orders' : "orders");
      let updateOldTxn = await merchantOrderModel.updateDynamic({is_voided:1},{txn:req.bodyString('txn_id')},mode=="test"?"test_order_txn":"order_txn")

    } else {
      order_txn = {
        status: "FAILED",
        txn: generate_payment_id,
        type: txn_type,
        payment_id: response_data.ipgTransactionId,
        order_reference_id: response_data.orderId,
        order_id: order_id,
        amount: transactionDetails.amount,
        currency: transactionDetails.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };
    }
    // update the details
    const insert_to_tnx_table = mode === 'live' ? orderTransactionModel.add : orderTransactionModel.test_txn_add;
    insert_to_tnx_table(order_txn);
    let resp_dump = {
      order_id: req.bodyString("p_order_id"),
      type: "VOID",
      status: response_data.transactionStatus == "APPROVED" ? "AUTHORISED" : "FAILED",
      dump: JSON.stringify(response_data),
    };
    const addResDumpFunc = mode == 'live' ? orderTransactionModel.addResDump : orderTransactionModel.addTestResDump
    addResDumpFunc(resp_dump);

    // prepare the response
    let res_obj = {
      status: order_status,
      p_request_id: generate_payment_id,
      p_order_id: req.bodyString("p_order_id"),
      m_order_id: _terminalids.merchant_order_id,
      p_ref_id: mid_details.psp_id,
      amount: transactionDetails.amount,
      currency: transactionDetails.currency,
      date: moment(order_txn.created_at).format("DD/MM/YYYY"),
      transaction_id: response_data.ipgTransactionId,
    };
    // call the webhook
    let web_hook_res = {
      m_order_id: order_details.merchant_order_id,
      p_order_id: order_details.order_id,
      p_request_id: generate_payment_id,
      psp_ref_id: response_data?.orderId,
      psp_txn_id: response_data?.ipgTransactionId,
      transaction_id: "",
      status: response_data?.transactionStatus == "APPROVED" ? "SUCCESS" : "FAILED",
      status_code: '',
      currency: order_details.currency,
      transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      amount: order_details.amount,
      m_customer_id: order_details.merchant_customer_id
        ? order_details.merchant_customer_id
        : "",
      psp: order_details.psp,
      payment_method: order_details.payment_mode,
      m_payment_token: "",
      payment_method_data: {
        scheme: order_details.scheme,
        card_country: order_details.card_country,
        card_type: order_details.cardType,
        mask_card_number: order_details.pan,
      },
      apm_name: "",
      apm_identifier: "",
      sub_merchant_identifier: order_details?.merchant_id
        ? await helpers.formatNumber(order_details?.merchant_id)
        : "",
    };
    let hook_info = await helpers.get_data_list("*", "webhook_settings", {
      merchant_id: order_details.merchant_id,
    });
    if (hook_info[0]) {
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(url, web_hook_res, hook_info[0].notification_secret);
      }
    }
    res.status(statusCode.ok).send(Server_response.successansmsg(res_obj, "Transaction successfully VOIDED."));
  }
  catch (error) {
    console.log(error);
    res.status(statusCode.ok).send(Server_response.errormsg(error?.message));
  }
}


module.exports = fiserv_void;