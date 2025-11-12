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
const RequestMaker = require("./ReuqestMaker");
const headers = require("../../utilities/tokenmanager/headers");
const EventEmitter = require("events");
const ee = new EventEmitter();
const SendTransactionMailAction = require('../SendTransactionMail');
const manageSub = require('../../utilities/subscription/index');
const pay = async (req, res) => {
  let payment_id;
  const order_id = req.body.order_id;
  const mode = req.body.payment_mode;
  const page_language = req.body.page_language;
  let order_table = mode == "live" ? "orders" : "test_orders";
  let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  let txn_response_dump =
    mode == "live" ? "txn_response_dump" : "test_txn_response_dump";
  let body_date = {
    ...req.body,
  };
  body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
  body_date.cvv = "****";
  var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let card_no = "";
  let enc_customer_id = "";
  let card_details;
  let full_card_no = "";
  let name_on_card = "";
  let expiry = "";
  let generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
  if (req.bodyString("card_id") != "") {
    let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
    card_details = await merchantOrderModel.selectOne(
      "*",
      {
        id: card_id,
      },
      "customers_cards"
    );

    card_no = card_details.last_4_digit;
    enc_customer_id = card_details.cid;
    full_card_no = await enc_dec.dynamic_decryption(
      card_details.card_number,
      card_details.cipher_id
    );
    name_on_card = card_details.name_on_card;
    expiry = card_details.card_expiry.split("/").reverse().join("-");
  } else {
    full_card_no = req.bodyString("card");
    card_no = req.bodyString("card").slice(-4);
    enc_customer_id = req.customer_id;
    name_on_card = req.bodyString('name');
    expiry = req.body.expiry_date.split("/").reverse().join("-");
  }
  let browser_token_enc = req.browser_fingerprint;
  if (!browser_token_enc) {
    let browser_token = {
      os: req.headers.os,
      browser: req.headers.browser,
      browser_version: req.headers["x-browser-version"],
      browser_fingerprint: req.headers.fp,
    };
    browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
  }
  if (req.bodyString("card_id") != "") {
    card_id = req.bodyString("card_id");
  } else if (req.card_id) {
    card_id = req.card_id;
  } else {
    card_id = "";
  }
  let order_data = {
    browser: req.headers.browser,
    browser_version: req.headers["x-browser-version"],
    os: req.headers.os,
    ip: req.headers.ip,
    ip_country: req.headers.ipcountry,
    card_no: card_no,
    cid: enc_customer_id,
    card_id: card_id,
    browser_fingerprint: browser_token_enc,
    updated_at: updated_at,
    card_country: req.card_details.country,
    cardType: req.card_details.card_type,
    scheme: req.card_details.card_brand,
    pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
      full_card_no.length - 4
    )}`,
    cardholderName: name_on_card,
    expiry: expiry,
    psp: "fiserv"
  };
  const order_date_update = await merchantOrderModel.updateDynamic(
    order_data,
    {
      order_id: order_id,
    },
    order_table
  );

  const order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  const mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode",
    {
      terminal_id: order_details.terminal_id,
    },
    "mid"
  );
  if (!mid_details) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Terminal Available"));
  }

  const autoCaptureHours = parseInt(mid_details.autoCaptureWithinTime);
  // Get the current date and time using moment.
  const currentDate = moment();
  // Add autoCaptureHours to the current date to get the new date and time.
  const newDateTime = currentDate.add(autoCaptureHours, "hours");
  // Format the newDateTime as "YYYY-MM-DD HH:mm"
  const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

  let voidWithinDatetime = "";

  if (mid_details.allowVoid == 1) {
    const voidWithinTimeHours = parseInt(mid_details?.voidWithinTime);
    const newVoidDateTime = currentDate.add(voidWithinTimeHours, "hours");
    // Format the newDateTime as "YYYY-MM-DD HH:mm"
    voidWithinDatetime = newVoidDateTime.format("YYYY-MM-DD HH:mm");
  }

  const _pspid = await merchantOrderModel.selectOne(
    "*",
    {
      id: mid_details.psp_id,
    },
    "psp"
  );
  if (!_pspid) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Psp Available"));
  }
  console.log(`full card no and expiry`);
  let card_expiry_details = expiry.split('-');
  let expiry_year = card_expiry_details[0].substring(2);
  let expiry_month = card_expiry_details[1];
  console.log(order_details.origin);
  let finserv_request = {};
  let url = mode == "test" ? credentials['fiserv']['test_url'] + 'payments' : credentials['fiserv']['base_url'] + 'payments';
  let subscriptionDetails = {};
  if (order_details.origin == "SUBSCRIPTION") {
    let subscriptionIdDetails = await order_transactionModel.selectSubsData(
      order_id
    );
    console.log(subscriptionIdDetails);
    subscriptionDetails = await merchantOrderModel.selectOneWithJoin('s.plan_id,s.plan_name,s.plan_description,s.plan_billing_frequency,s.payment_interval,s.plan_currency,s.plan_billing_amount,s.terms,mm.company_name', { 's.id': subscriptionIdDetails.plan_id }, 'subs_plans s', 'master_merchant_details mm', 's.merchant_id=mm.merchant_id');
    console.log(subscriptionDetails);
    finserv_request = {
      "requestType": "PaymentMethodPaymentSchedulesRequest",
      "startDate": moment().format('YYYY-MM-DD'),
      "numberOfPayments": subscriptionDetails.terms,
      "maximumFailures": 1,
      "invoiceNumber": subscriptionIdDetails.subscription_id,
      "purchaseOrderNumber": order_id,
      "transactionOrigin": "ECOM",
      "dynamicMerchantName": subscriptionDetails.company_name,
      "frequency": {
        "every": subscriptionDetails.payment_interval,
        "unit": helpers.getSubscriptionFrequencyMap(subscriptionDetails.plan_billing_frequency)
      },
      "paymentMethod": {
        "paymentCard": {
          "number": full_card_no,
          "expiryDate": {
            "month": expiry_month,
            "year": expiry_year
          },
          "securityCode": req.bodyString('cvv')
        }
      },
      "transactionAmount": {
        "total": subscriptionDetails.plan_billing_amount,
        "currency": subscriptionDetails.plan_currency
      }
    };
    url = mode == "test" ? credentials['fiserv']['test_url'] + 'payment-schedules' : credentials['fiserv']['base_url'] + 'payment-schedules';
  } else {
    let action="";
    if(order_details.origin=="REMOTE"){
      action = order_details.action;
    }else{
      action = mid_details.mode;
    }
    finserv_request = {
      "requestType":action == "SALE" ? "PaymentCardSaleTransaction" : "PaymentCardPreAuthTransaction",
      "transactionAmount": {
        "total": order_details.amount,
        "currency": order_details.currency
      },
      "paymentMethod": {
        "paymentCard": {
          "number": full_card_no,
          "securityCode": req.bodyString('cvv'),
          "expiryDate": {
            "month": expiry_month,
            "year": expiry_year
          }
        }
      },
      "authenticationRequest": {
        "authenticationType": "Secure3D21AuthenticationRequest",
        "termURL": process.env.PAYMENT_URL + 'status-fiserv?order_id=' + order_id + '&mode=' + mode,
        "challengeIndicator": "04",
        "challengeWindowSize": "05"
      }
    }
  }


  let encoded_request = RequestMaker('POST', url, finserv_request, mid_details.MID, mid_details.password);
  let response_data;
  try {
    let fiserv_response = await axios.post(encoded_request.url, encoded_request.body, {
      headers: encoded_request.headers
    });
    response_data = fiserv_response.data;
    console.log(`response data`);
    console.log(response_data);
    let response = '';
    let type = "";
    if (order_details.origin == "SUBSCRIPTION") {
      console.log(response_data);
      let cardDetails = {
        cardNumber: full_card_no,
        expiryMonth: expiry_month,
        expiryYear: expiry_year,
        cvv: req.bodyString('cvv')
      }
      let addSubsPayment = await addSubscriptionPayment(order_details, response_data, mode, req, subscriptionDetails, mid_details, cardDetails);
       response = await non3dsApproved(order_details,response_data.transactionResponse,mode,req);
       type="non-3ds";
    } else {
      switch (response_data.transactionStatus) {
        case 'APPROVED':
          response = await non3dsApproved(order_details, response_data, mode, req);
          type = "non-3ds";
          break;
        case 'WAITING':
          response = await threeDSWaiting(order_details, response_data, mode);
          type = response.type;
          break;

      }
    }

    let b_token = {
      os: req.headers?.os,
      browser: req.headers?.browser,
      browser_fingerprint: req.headers?.fp,
    };
    response.token = enc_dec.cjs_encrypt(JSON.stringify(b_token));
    response.type = type
    return res.json({
      data: response,
      status: "success",
    });
  } catch (error) {
    console.log(error);
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

    // console.log(`inside the catch block`);
    // console.log(error);
    // console.log(`error is here`);
    // console.log(error.response.data.error);
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
      remark: "Transaction Failed",
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
        status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
        remark: response_category?.response_details,//final_response.data.response.acquirerMessage,
        paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
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
      psp: _pspid.name,
      status_code: "01" || "",
      description: response_data?.error?.message || "",
      activity: "Transaction FAILED with FISERV",
      status: 0,
      mode: mode,
      card_holder_name: name_on_card || '',
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
};

module.exports = pay;

async function non3dsApproved(order_details, response_data, mode, req) {
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
      return_url: response_data.transactionStatus === 'APPROVED'?order_details?.success_url:order_details?.failure_url,//process.env.PAYMENT_URL + "/status",
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
    status: response_data.transactionStatus === 'APPROVED' ? 1 : 0,
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

async function threeDSWaiting(order_details, response_data, mode) {
  try {
    console.log(`inside 3ds waiting`);
    let transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
    let order_table = mode == "test" ? "test_orders" : "orders";
    const insertFunction =
      mode === "live"
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;
    const insert_to_txn_table = await insertFunction({
      order_id: order_details.order_id,
      txn: transaction_id.toString(),
      type: order_details.action.toUpperCase(),
      status: "AWAIT_3DS",
      amount: order_details.amount,
      currency: order_details.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      payment_id: response_data.ipgTransactionId,
    });
    if (!insert_to_txn_table) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Transaction insertion failed"));
    }
    const order_date_update = await merchantOrderModel.updateDynamic(
      { session: response_data.ipgTransactionId },
      {
        order_id: order_details.order_id,
      },
      order_table
    );
    console.log(`response data test for external url`)
    console.log(response_data.authenticationResponse.secure3dMethod);
    if (response_data.authenticationResponse.secure3dMethod) {
      // code for iframe 3ds
      return {
        iframecode: response_data?.authenticationResponse?.secure3dMethod?.methodForm,
        transaction_id: response_data?.ipgTransactionId,
        type: "iframe",

      };
    } else {
      // code for external 3ds
      return {
        acs_url: response_data?.authenticationResponse?.params?.acsURL,
        transaction_id: response_data?.ipgTransactionId,
        creq: response_data?.authenticationResponse?.params?.cReq,
        type: "external-3ds",

      };
    }
  } catch (error) {
    console.log(error);
  }
}

async function addSubscriptionPayment(order_details, response_data, mode, req, subscrion_details, mid_details, card_details) {
  console.log(`inside the subscription updatation`);
  console.log(order_details, response_data, mode, req.body, subscrion_details, mid_details, card_details);
  let url = mode == 'test' ? credentials['fiserv']['test_url'] + 'payment-tokens' : credentials['fiserv']['base_url'] + 'payment-tokens';
  let rawRequest = {
    "requestType": "PaymentCardPaymentTokenizationRequest",
    "paymentCard": {
      "number": card_details.cardNumber,
      "expiryDate": {
        "month": card_details.expiryMonth,
        "year": card_details.expiryYear
      },
      "securityCode": card_details.cvv
    },
    "createToken": {
      "reusable": true,
      "declineDuplicates": false
    },
    "accountVerification": false
  }
  let fiservRequest = RequestMaker('POST', url, rawRequest, mid_details.MID, mid_details.password);
  let tokenResponse = await axios.post(fiservRequest.url, fiservRequest.body, {
    headers: fiservRequest.headers
  });
  let subscriptionRes = await manageSub(order_details, response_data.requestStatus == 'SUCCESS' ? 'CAPTURED' : "FAILED", moment().format('YYYY-MM-DD HH:mm:ss'),response_data.transactionResponse.ipgTransactionId, '', mode);
  let orderDetailsToUpdate = {
    payment_token_id:  tokenResponse.data.paymentToken.value
  }
  await merchantOrderModel.updateDynamic(orderDetailsToUpdate,{order_id:order_details.order_id},mode=="test"?"test_orders":"orders");

}