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
const createSession = async (req, res) => {
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
    expiry: expiry
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
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime",
    {
      terminal_id: order_details.terminal_id,
    },
    "mid"
  );
  const getpsp = await PspModel.selectOne("*", {
    id: mid_details.psp_id,
  });
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

  let mpgs_req = {
    action: order_details.action,
    value: order_details.amount,
    order_id: req.body.order_id,
    card_no: req.body.card,
    expiry_date: req.body.expiry_date.split("/").reverse().join("-"),
    cvv: req.body.cvv,
    cardholderName: req.body.name,
    currency: order_details.currency,
  };

  if (req.bodyString("card_id")) {
    mpgs_req.card_no = await enc_dec.dynamic_decryption(
      card_details.card_number,
      card_details.cipher_id
    );
    mpgs_req.expiry_date = card_details.card_expiry
      .split("/")
      .reverse()
      .join("-");
    mpgs_req.cardholderName = card_details.name_on_card;
  }
  let masked_data = {
    ...mpgs_req,
  };
  masked_data.cvv = "****";
  masked_data.card_no = `**** **** **** ${mpgs_req.card_no.slice(-4)}`;

  // save card details for retry pay
  let card_req = {
    order_id: req.body.order_id,
    request: JSON.stringify(req.body),
    card_country: req.card_details.country,
    card_country_code: req.card_details.country_code,
    card_brand: req.card_details.card_brand,
    card_type: req.card_details.card_type,
    scheme: req.card_details.card_brand,
    card_number: `${req.body.card.substring(0, 6)}****${req.body.card.substring(
      req.body.card.length - 4
    )}`,
  };
  await helpers.common_add(card_req, "order_paycard_details");

  const username = `merchant.${mid_details.MID}`;
  const password = mid_details.password;
  const basicAuthToken = await helpers.createBasicAuthToken(username, password);
  const data1 = {
    correlationId: uuidv4(),
    session: {
      authenticationLimit: 5,
    },
  };

  try {
    let url = mode=="live"?credentials[getpsp.credentials_key].base_url:credentials[getpsp.credentials_key].test_url;
    const config1 = {
      method: "post",
      url: url + `merchant/${mid_details.MID}/session`,
      headers: {
        Authorization: basicAuthToken,
        "Content-Type": "application/json",
      },
      maxBodyLength: Infinity,
      data: data1,
      maxRedirects: 10,
      timeout: 0,
    };
    const response = await axios(config1);
    const sessionId = response.data.session.id;
    console.log("Session ID:", sessionId);
    //update the session in table
    const session = { session: sessionId };
    const condition = {
      order_id: order_id,
    };

    const session_update = await merchantOrderModel.updateDynamic(
      session,
      condition,
      order_table
    );
    if (!session_update) {
      res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("Session update failed"));
    }
    payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    const pay_request_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );

    const [year, month] = mpgs_req.expiry_date.split("-");
    let payload = {
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: mpgs_req.card_no,
            expiry: {
              month: month,
              year: year.slice(-2),
            },
            securityCode: mpgs_req.cvv,
            storedOnFile: "NOT_STORED",
          },
        },
      },
      transaction: {
        id: uuidv4(),
      },
      order: {
        amount: order_details.amount,
        currency: order_details.currency,
        id: order_id,
      },
      authentication: {
        channel: "PAYER_BROWSER",
        redirectResponseUrl:
          process.env.PAYMENT_URL +
          "/status-mpgs/" +
          mode +
          "?page_language=" +
          page_language,
      },
    };
    if (order_details.origin == "SUBSCRIPTION") {
      console.log(`inside if condition of`);
      console.log(order_details);
      let subscriptiondetails = await order_transactionModel.selectSubsData(
        order_id
      );
      payload["agreement"] = {
        id: subscriptiondetails.subscription_id,
        paymentFrequency: "AD_HOC",
        type: "OTHER",
      };
      payload["sourceOfFunds"]['provided']['card']['storedOnFile'] = "TO_BE_STORED";
    }
    let data = JSON.stringify(payload);
    console.log(`data is here`);
    console.log(data);
    let config = {
      method: "put",
      maxBodyLength: Infinity,
      url: `${url}merchant/${mid_details.MID}/session/${sessionId}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthToken,
      },
      data: data,
    };
    const final_response = await axios(config);
    console.log(`the response is here 123`);
    console.log(JSON.stringify(final_response.data));
    // Call updateDynamic to store sessionId in the database
    await merchantOrderModel.updateDynamic(
      { payment_id: payment_id, psp: _pspid.name },
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
      payment_id: payment_id.toString(),
    });
    if (!insert_to_txn_table) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Transaction insertion failed"));
    }

    let billingCountryIso3 = countryToAlpha3(order_details.billing_country);
    let b_token = {
      os: req.headers?.os,
      browser: req.headers?.browser,
      browser_fingerprint: req.headers?.fp,
    };
    return res.json({
      data: {
        mpgs_url: url, // from config file
        session_id: sessionId, // from meps api
        order_id: order_id, // paydart order id
        transaction_id: payment_id.toString(), //paydart txn id, make an entry in txn table with AUTH/SALE,depending upon MID action
        mid: mid_details.MID, // From routing,
        billing_address: order_details.billing_address_line_1,
        city: order_details.billing_city,
        billing_country: billingCountryIso3,
        token: enc_dec.cjs_encrypt(JSON.stringify(b_token)),
      },
      status: "success",
    });
  } catch (error) {
    console.log(error?.response?.data);
    let invalidMid = false;
    if (error?.response?.status == "401") {
      invalidMid = true;
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
      psp: _pspid.name,
      status_code: "01",
      description: invalidMid ? 'Invalid credentials' : "",
      activity: `Transaction FAILED with MPGS`,
      status: 1,
      mode: mode,
      card_holder_name: order_details.cardholderName || '',
      card: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
        full_card_no.length - 4
      )}`,
      expiry: expiry,
      cipher_id: "",
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
      token: browser_token_enc,
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
        remark: invalidMid ? 'Access Denied' : 'Transaction Failed',
        paydart_category: 'FAILED',
        currency: order_details?.currency,
        return_url: order_details?.failure_url,//process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.m_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        payment_method_data: {
          scheme: order_details?.scheme || "",
          card_country: order_details?.card_country || "",
          card_type: order_details.cardType || "",
          mask_card_number: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
            full_card_no.length - 4
          )}`,
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
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
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

module.exports = createSession;
