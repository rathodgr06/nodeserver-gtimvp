const axios = require("axios");
const credentials = require("../../config/credientials");
const helpers = require("../../utilities/helper/general_helper");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require("moment");
const order_transactionModel = require("../../models/order_transaction");
const enc_dec = require("../../utilities/decryptor/decryptor");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const { v4: uuidv4 } = require("uuid");
const { countryToAlpha3 } = require("country-to-iso");
const { send_webhook_data } = require("../webhook_settings");
const PspModel = require("../../models/psp");
const credientials = require("../../config/credientials");
const https = require('https');
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}
const Pay = async (req, res) => {
  console.log(`inside orange money pay`)
  let payment_id;
  const order_id = req.body.order_id;
  const mode = req.body.mode;
  let psp = req.bodyString('psp');
  let order_table = mode == "live" ? "orders" : "test_orders";
  let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  let txn_response_dump =
    mode == "live" ? "txn_response_dump" : "test_txn_response_dump";

  var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let card_no = "";
  let enc_customer_id = "";
  let card_details;
  let full_card_no = "";
  let name_on_card = "";
  let expiry = "";
  let generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';

  // fetch psp id
  const psp_details = await merchantOrderModel.selectOne(
    "id,name",
    {
      credentials_key: psp,
       deleted:0
    },
    "psp"
  );
  if (!psp_details) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Psp Available"));
  }
  // fetch order details
  const order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  // fetch mid details 
  const mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,terminal_id,statementDescriptor,shortenedDescriptor",
    {
      psp_id: psp_details.id,
      submerchant_id: order_details.merchant_id,
      deleted:0,
      env:mode
    },
    "mid"
  );
  if (!mid_details) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Terminal Available"));
  }



  let order_data = {
    browser: req.headers.browser,
    psp_id: psp_details.id,
    browser_version: req.headers["x-browser-version"],
    os: req.headers.os,
    ip: req.headers.ip,
    ip_country: req.headers.ipcountry,
    card_no: '',
    cid: enc_customer_id,
    card_id: "",
    updated_at: updated_at,
    card_country: 'NA',
    cardType: 'NA',
    scheme: '',
    pan: `${req.bodyString("country_code")}${req.bodyString("mobile_no")}`,
    cardholderName: 'NA',
    expiry: 'NA',
    psp: psp_details.name,
    terminal_id: mid_details.terminal_id,
    payment_mode: 'Mobile Wallet'
  };
  const order_date_update = await merchantOrderModel.updateDynamic(
    order_data,
    {
      order_id: order_id,
    },
    order_table
  );
  const username = mid_details.MID;
  const password = mid_details.password;
  // const basicAuthToken = await helpers.createBasicAuthToken(username, password);


  try {
    console.log(psp)
    console.log(credentials['orange-money']);
    let url = mode == "live" ? credentials[psp].base_url : credentials[psp].test_url;
    
    payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    const pay_request_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );
    let x_ref_id = uuidv4();
    let payload = {
    "auth": {
        "user": username,
        "pwd": password
    },
    "param": {
        "msisdn":`${req.bodyString("country_code")}${req.bodyString("mobile_no")}`,
        "Amount": order_details.amount,
        "Currency": order_details.currency,
        "ExternalID": order_id
    },
    "callback": {
        "url": process.env.STATIC_URL+"/api/v1/mobile-payment/update-status"
    }
    }
   const agent = new https.Agent({
  rejectUnauthorized: false  // ⚠️ Ignore SSL cert errors (only use in dev)
});
    let data = JSON.stringify(payload);
    let config = {
      method: "post",
      url: `${url}orange/Subscriber/Billers/OM/PayStart`,
      headers: {
    "Content-Type": "application/json"
  },
  httpsAgent: agent,
      data: data,
    };
    const final_response = await axios(config);
    if(!final_response.data?.resultset?.TXNID){
        throw new Error(final_response.data?.resultset?.ExecTxt);
    }
    console.log(`the response is here`);
    console.log(JSON.stringify(final_response.data));
    // Call updateDynamic to store sessionId in the database
    await merchantOrderModel.updateDynamic(
      { payment_id: payment_id,pan:`${req.bodyString("country_code")}${req.bodyString("mobile_no")}` },
      { order_id: order_id },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;
    const insert_to_txn_table = await insertFunction({
      order_id: order_id,
      txn: payment_id.toString(),
      type: order_details.action.toUpperCase(),
      status: "AWAIT_3DS",
      amount: order_details.amount,
      currency: order_details.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      payment_id: final_response.data?.resultset?.TXNID,
    });
    if (!insert_to_txn_table) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Transaction insertion failed"));
    }

    
    return res.json({
      data: {
        transaction_ref_id: final_response.data?.resultset?.TXNID, // from meps api
        order_id: order_id, // paydart order id
        transaction_id: payment_id.toString(), //paydart txn id, make an entry in txn table with AUTH/SALE,depending upon MID action
       mode:mode
      },
      status: "success",
    });
  } catch (error) {
    console.log(error.Error);
    let remark;
    let invalidMid = false;
    if (error?.response?.status == "401") {
      invalidMid = true;
    }
    
    if(!invalidMid){
      remark = error?.message;
    }
    await merchantOrderModel.updateDynamic(
      { status: "FAILED", "3ds_status": "NA" },
      { order_id: order_id },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;
    payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    await insertFunction({
      order_id: order_id,
      txn: payment_id.toString(),
      type: order_details.action.toUpperCase(),
      status: "FAILED",
      amount: order_details.amount,
      currency: order_details.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      payment_id: "",
    });
    let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
    let order_req = {
      merchant_id: order_details.merchant_id,
      order_id: order_details?.order_id,
      request_id: paydart_req_id,
      request: JSON.stringify(req.body),
    };
    await helpers.common_add(order_req, generate_request_id_table);

    let txnFailedLog = {
      order_id: order_details.order_id,
      terminal: order_details?.terminal_id,
      req: JSON.stringify(req.body),
      res: '',
      psp: psp_details.name,
      status_code: "01",
      description: invalidMid ? 'Invalid credentials' : "",
      activity: `Transaction FAILED with Orange Money`,
      status: 1,
      mode: mode,
      card_holder_name: order_details.cardholderName || '',
      card: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
        full_card_no.length - 4
      )}`,
      expiry: expiry,
      cipher_id: 0,
      txn: payment_id.toString(),
      card_proxy: "",
      "3ds_version": "0",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
    await helpers.addTransactionFailedLogs(txnFailedLog);
    const res_obj = {
      message: "Transaction FAILED",
      order_status: "FAILED",
      payment_id: "",
      order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      remark: error.response ? error.response.data : "",
      new_res: {
        m_order_id: order_details?.merchant_order_id || "",
        p_order_id: order_details?.order_id || "",
        p_request_id: "",
        psp_ref_id: "",
        psp_txn_id: payment_id || "",
        transaction_id: payment_id.toString() || "",
        status: "FAILED",
        status_code: "01",
        remark: invalidMid ? 'Access Denied' : remark||'Transaction Failed',
        paydart_category: 'FAILED',
        currency: order_details?.currency,
        return_url:process.env.PAYMENT_URL + '/status', //order_details?.failure_url,//process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.m_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        mobile_no:`${req.bodyString("country_code")}${req.bodyString("mobile_no")}`,
        payment_method_data: {
          scheme: order_details?.scheme || "",
          card_country: order_details?.card_country || "",
          card_type: "Mobile Wallet",
          mask_card_number: `NA`,
          
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
          ? await helpers.formatNumber(order_details?.merchant_id)
          : "",
      }
    };
    // web  hook starting
    let hook_info = await helpers.get_data_list("*", "webhook_settings", {
      merchant_id: order_details.merchant_id,
    });
    let web_hook_res = Object.assign({}, res_obj.new_res);
    delete web_hook_res?.return_url;
    delete web_hook_res?.paydart_category;
    if (hook_info[0]) {
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url != '') {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(
          url,
          web_hook_res,
          hook_info[0].notification_secret
        );
      }
    }
    return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj));
  } 
};

module.exports = Pay;
