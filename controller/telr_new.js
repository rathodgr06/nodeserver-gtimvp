const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const merchantOrderModel = require("../models/merchantOrder");
const orderTransactionModel = require("../models/order_transaction");
const moment = require("moment");
const env = process.env.ENVIRONMENT;
const telr_sale = require("./telr");
const config = require("../config/config.json")[env];
const order_logs = require("../models/order_logs");
const credientials = require("../config/credientials");
const telrPaymentService = require("../service/telrPaymentService");
const rejectNon3DS = require("../controller/rejectTransaction");
const calculateTransactionCharges = require("../utilities/charges/transaction-charges/index");
const invModel = require("../models/invoiceModel");
const EventEmitter = require("events");
const pool = require("../config/database");
const ee = new EventEmitter();
const mailSender = require("../utilities/mail/mailsender");
const manageSubscription = require("../utilities/subscription/index");
const calculateAndStoreReferrerCommission = require("./../utilities/referrer-bonus/index");
const calculateFeatureCharges = require("../utilities/charges/feature-charges/index");
const xml2js = require("xml2js");
const { send_webhook_data } = require("./webhook_settings");
const fraudEngine = require("../utilities/fraud/index.js");
const fraudService = require("../service/fraudService");

var MerchantOrder = {
  setup: async (req, res) => {
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    let payment_id = await helpers.make_sequential_no(
      req.body.env == "test" ? "TST_TXN" : "TXN"
    );
    let table_name = "orders";
    let txn_table = "order_txn";
    if (req.body.env == "test") {
      table_name = "test_orders";
      txn_table = "test_order_txn";
    }
    try {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : MerchantOrder.pay initiated`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
          req.protocol
        }`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
          req.method
        }`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
          req.url
        }`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Request content-type = ${req.headers["content-type"]}`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
          req.headers["content-length"]
        }`
      );
      let body_date = {
        ...req.body,
      };
      body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
      body_date.cvv = "****";
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(body_date)}`
      );

      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : helpers.make_sequential_no ${payment_id}`
      );
      let card_no = "";
      let enc_customer_id = "";
      let card_details;
      let full_card_no = "";
      let expiry = "";
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
        expiry = card_details.card_expiry;
      } else {
        card_no = req.bodyString("card").slice(-4);
        enc_customer_id = req.customer_id;
        full_card_no = req.bodyString("card");
        expiry = req.bodyString("expiry_date");
      }

      let browser_token_enc = req.browser_fingerprint;

      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : browser_token_enc ${
          req.browser_fingerprint
        }`
      );
      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : new browser token ${browser_token_enc}`
        );
      }

      let card_id = "";
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
        // ip: req.headers.ip,
        ip_country: req.headers.ipcountry,
        payment_id: payment_id,
        // payment_mode: req.bodyString("payment_mode"),
        card_no: card_no,
        updated_at: updated_at,
        cid: enc_customer_id ? enc_customer_id : "",
        card_id: card_id,
        browser_fingerprint: browser_token_enc ? browser_token_enc : "",
        card_country: req.card_details.country,
        cardholderName: req?.body?.name || card_details?.name_on_card,
        cardType: req.card_details.card_type,
        scheme: req.card_details.card_brand,
        pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
          full_card_no.length - 4
        )}`,
        expiry: expiry,
      };

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : initiate merchantOrderModel.updateDynamic with data ${JSON.stringify(
          order_data
        )}`
      );

      let status = "PENDING";
      let result = await merchantOrderModel.updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : response received ${JSON.stringify(result)}`
      );
      const res_order_data = await merchantOrderModel.selectOne(
        "*",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne ${JSON.stringify(res_order_data)}`
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne`
      );

      // telr payload for session non 3ds card auth
      const payload = {
        type: res_order_data?.action.toLowerCase(),
        classValue: "ecom",
        currency: res_order_data.currency,
        amount: res_order_data.amount,
        description: res_order_data?.description,
        cvv: req.body.cvv,
        session: req?.body?.session_id,
        billingNameFirst: res_order_data?.customer_name.split(" ")[0],
        billingNameLast: res_order_data?.customer_name.split(" ")[1],
        billingLine1: res_order_data.billing_address_line_1,
        billingLine2: res_order_data.billing_address_line_2,
        billingCity: res_order_data.billing_city,
        billingRegion: res_order_data.billing_province,
        billingCountry: res_order_data.billing_country,
        billingZip: res_order_data.billing_pincode,
        ip: res_order_data.ip,
        email: req?.body?.email,
        order_id: req.bodyString("order_id"),
        agent: req?.body?.agent,
        height: req?.body?.height,
        width: req?.body?.width,
        return_url: res_order_data?.return_url,
      };

      if (req.bodyString("card_id")) {
        payload.card = await enc_dec.dynamic_decryption(
          card_details.card_number,
          card_details.cipher_id
        );
        payload.expiry_month = card_details.card_expiry.split("/")[0];
        payload.expiry_year = card_details.card_expiry.split("/")[1];
      } else {
        payload.card = req.body.card;
        payload.expiry_month = req.body.expiry_date.split("/")[0];
        payload.expiry_year = req.body.expiry_date.split("/")[1];
      }

      console.log("payload", payload);

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );
      if (!_getmid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Routes  Available for Transaction"));
      }

      // Get the autoCaptureWithinTime in hours from _getmid (assuming it's a number).
      const autoCaptureHours = parseInt(_getmid?.autoCaptureWithinTime);
      // Get the current date and time using moment.
      const currentDate = moment();
      // Add autoCaptureHours to the current date to get the new date and time.
      const newDateTime = currentDate.add(autoCaptureHours, "hours");
      // Format the newDateTime as "YYYY-MM-DD HH:mm"
      const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }

      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl:
          req.body.env == "test"
            ? credientials.telr.test_url
            : credientials.telr.base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      let card_proxy = enc_dec.encrypt_card(payload.card);
      let checkForCardProxyInSystem = await helpers.fetchLastTryData({
        card_proxy: card_proxy,
      });
      if (
        _getmid.is3DS == 1 &&
        checkForCardProxyInSystem?.["3ds_version"] == 0
      ) {
        throw "card is non 3ds and non 3ds card are not allowed";
      }
      const telr_session = await telr_sale.createSession(
        payload,
        _terminalcred,
        req.body.env
      );
      payload.session = telr_session.session;
      payload.card = full_card_no;
      let req_data = {
        request: JSON.stringify(payload),
        merchant_id: res_order_data.merchant_id,
        order_id: req.bodyString("order_id"),
      };
      if (req.body.env == "test") {
        await helpers.common_add(req_data, "test_order_request");
      } else {
        await helpers.common_add(req_data, "order_request");
      }

      telr_session.order_status = "Wait";
      telr_session.token = browser_token_enc;

      if (telr_session.action == "wait") {
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(telr_session, "Collect device info"));
      } else {
        const authsetupBody = { ...req.body, session_id: telr_session.session };
        const paymentRequest = await telrPaymentService.authenticationSetup(
          authsetupBody
        );

        paymentRequest.data.token = browser_token_enc;
        return res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              paymentRequest?.data,
              paymentRequest?.message || "challenge"
            )
          );
      }
    } catch (error) {
      console.log("🚀 ~ setup: ~ error:", error);

      helpers.updateOrderCycle(req.bodyString("order_id"), req.body.env);

      let res_order_data = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: req.bodyString("order_id") },
        table_name
      );
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

      try {
        let order_update_failed = {
          status: "FAILED",
          psp: "TELR",
          payment_id: payment_id,
        };
        await merchantOrderModel.updateDynamic(
          order_update_failed,
          {
            order_id: req.bodyString("order_id"),
          },
          table_name
        );
        let response_category_failed = await helpers.get_error_category(
          "01",
          "telr",
          "FAILED"
        );
        if (error == "card is non 3ds and non 3ds card are not allowed") {
          console.log("error", error);
          response_category_failed = await helpers.get_error_category(
            "144",
            "paydart",
            "FAILED"
          );
        } else {
          response_category_failed = await helpers.get_error_category(
            "01",
            "telr",
            "FAILED"
          );
        }

        let order_txn = {
          status: "FAILED",
          psp_code: response_category_failed?.response_code,
          paydart_category: response_category_failed?.category,
          remark: response_category_failed?.response_details,
          txn: payment_id,
          type: res_order_data?.action.toUpperCase(),
          payment_id: "",
          order_reference_id: "",
          capture_no: "",
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (req.body.env == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        const new_res = {
          m_order_id: res_order_data.merchant_order_id,
          p_order_id: req.bodyString("order_id"),
          p_request_id: "",
          psp_ref_id: "",
          psp_txn_id: "",
          transaction_id: payment_id,
          status: "FAILED",
          status_code: "01",
          remark: "Invalid Request",
          paydart_category: response_category_failed.category,
          currency: res_order_data.currency,
          amount: res_order_data?.amount ? res_order_data?.amount : "",
          m_customer_id: res_order_data.merchant_customer_id,
          psp: res_order_data.psp,
          payment_method: res_order_data.payment_mode,
          m_payment_token: res_order_data?.card_id
            ? res_order_data?.card_id
            : "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          return_url: res_order_data.failure_url,
          payment_method_data: {
            scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
            card_country: res_order_data?.card_country
              ? res_order_data?.card_country
              : "",
            card_type: res_order_data?.cardType ? res_order_data?.cardType : "",
            mask_card_number: res_order_data?.pan ? res_order_data?.pan : "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: res_order_data?.merchant_id
            ? await helpers.formatNumber(res_order_data?.merchant_id)
            : "",
        };
        const res_obj = {
          order_status: "FAILED",
          reference: "",
          order_reference: "",
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          new_res: new_res,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc,
          "3ds": "",
        };
        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: res_order_data?.order_id,
          mode: req.body.env,
        });
        let txnFailedLog = {
          order_id: res_order_data.order_id,
          terminal: res_order_data?.terminal_id,
          req: JSON.stringify(req.body),
          res: JSON.stringify(error),
          psp: "TELR",
          status_code: response_category_failed.response_code,
          description: "",
          activity: "Transaction failed with Telr",
          status: 1,
          mode: req.body.env,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: payment_id,
          card_proxy: temp_card_details.card_proxy,
          "3ds_version": "0",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(res_obj, "Transaction Failed"));
      } catch (error) {
        console.log(error);
      }
    }
  },
  authentication: async (req, res) => {
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    let payment_id = await helpers.make_sequential_no(
      req.body.env == "test" ? "TST_TXN" : "TXN"
    );
    let table_name = "orders";
    let txn_table = "order_txn";
    if (req.body.env == "test") {
      table_name = "test_orders";
      txn_table = "test_order_txn";
    }
    try {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : telr.authentication initiated`
      );

      let body_date = {
        ...req.body,
      };
      body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
      body_date.cvv = "****";
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(body_date)}`
      );

      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : helpers.make_sequential_no ${payment_id}`
      );
      let card_no = "";
      let enc_customer_id = "";
      let card_details;
      let full_card_no = "";
      let expiry = "";
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
        expiry = card_details.card_expiry;
      } else {
        card_no = req.bodyString("card").slice(-4);
        enc_customer_id = req.customer_id;
        full_card_no = req.bodyString("card");
        expiry = req.bodyString("expiry_date");
      }

      let browser_token_enc = req.browser_fingerprint;

      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : browser_token_enc ${
          req.browser_fingerprint
        }`
      );
      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : new browser token ${browser_token_enc}`
        );
      }

      let card_id = "";
      if (req.bodyString("card_id") != "") {
        card_id = req.bodyString("card_id");
      } else if (req.card_id) {
        card_id = req.card_id;
      } else {
        card_id = "";
      }

      const res_order_data = await merchantOrderModel.selectOne(
        "*",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne ${JSON.stringify(res_order_data)}`
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne`
      );

      const payload = {
        type: res_order_data?.action.toLowerCase(),
        classValue: "ecom",
        currency: res_order_data.currency,
        amount: res_order_data.amount,
        description: res_order_data?.description,
        cvv: req.body.cvv,
        session: req?.body?.session_id,
        billingNameFirst: res_order_data?.customer_name.split(" ")[0],
        billingNameLast: res_order_data?.customer_name.split(" ")[1],
        billingLine1: res_order_data.billing_address_line_1,
        billingLine2: res_order_data.billing_address_line_2,
        billingCity: res_order_data.billing_city,
        billingRegion: res_order_data.billing_province,
        billingCountry: res_order_data.billing_country,
        billingZip: res_order_data.billing_pincode,
        ip: res_order_data.ip,
        email: req?.body?.email,
        order_id: req.bodyString("order_id"),
        agent: req?.body?.agent,
        height: req?.body?.height,
        width: req?.body?.width,
        return_url: res_order_data?.return_url,
      };

      if (req.bodyString("card_id")) {
        payload.card = await enc_dec.dynamic_decryption(
          card_details.card_number,
          card_details.cipher_id
        );
        payload.expiry_month = card_details.card_expiry.split("/")[0];
        payload.expiry_year = card_details.card_expiry.split("/")[1];
      } else {
        payload.card = req.body.card;
        payload.expiry_month = req.body.expiry_date.split("/")[0];
        payload.expiry_year = req.body.expiry_date.split("/")[1];
      }
      console.log("payload_auth", payload);

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );
      if (!_getmid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Routes  Available for Transaction"));
      }

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }

      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl:
          req.body.env == "test"
            ? credientials.telr.test_url
            : credientials.telr.base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };

      const telr_session = await telr_sale.createAuth(
        payload,
        _terminalcred,
        req.body.env,
        req.body.session_id
      );

      const parser = new xml2js.Parser();
      const responseObj = await parser.parseStringPromise(telr_session.data);

      if (responseObj?.remote.error) {
        throw new Error(responseObj?.remote.error[0]);
      }

      if (logs) {
        let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };

        await order_logs.update_logs_data(
          {
            order_id: req.body.order_id,
          },
          logs_payload,
          req.body.env
        );
      }
      if (responseObj?.remote.mpi[0]?.action[0] == "challenge") {
        let orderupdate = {
          status: "AWAIT_3DS",
        };
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: req.body.order_id,
          },
          table_name
        );
        const session = responseObj?.remote?.mpi[0]?.session[0];
        const scheme = responseObj?.remote?.mpi[0]?.scheme[0];
        const acsurl = responseObj?.remote?.mpi[0]?.acsurl
          ? responseObj?.remote?.mpi[0]?.acsurl[0]
          : "";
        const pareq = responseObj?.remote?.mpi[0]?.pareq
          ? responseObj?.remote?.mpi[0]?.pareq[0]
          : "";
        const level = responseObj?.remote?.mpi[0]?.level
          ? responseObj?.remote?.mpi[0]?.level[0]
          : "";
        const trace = responseObj?.remote?.mpi[0]?.trace[0];
        const redirecthtml = responseObj?.remote.mpi[0]?.redirecthtml?.[0];
        const action = responseObj?.remote.mpi[0]?.action?.[0];
        const telr_res = {
          session,
          scheme,
          level,
          trace,
          acsurl,
          pareq,
          redirecthtml,
          action,
        };
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(telr_res, "Collect device info"));
      } else {
        let fraudStatus = false;
        let fraudServiceRequest;
        if (res_order_data.fraud_3ds_pending === 1) {
          const fraudCheckBody = {
            fraudRequestId: res_order_data.fraud_request_id,
            order_id: req.bodyString("order_id"),
            is3ds: false,
          };

          fraudServiceRequest = await fraudService.make3dsFraudCheck(
            fraudCheckBody
          );
          fraudStatus = fraudServiceRequest.status === "fail" ? true : false;
        }

        if (fraudStatus) {
          let response_fraud = fraudServiceRequest;
          const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
          const status = "FAILED";
          const mode = req.body.env;
          const table_name = mode === "test" ? "test_orders" : "orders";
          const txn = await helpers.make_sequential_no(
            mode === "test" ? "TST_TXN" : "TXN"
          );
          const fraudRequestId = enc_dec.cjs_decrypt(response_fraud.request_id);

          const res_order_data = await merchantOrderModel.selectOne(
            "*",
            { order_id: req.body.order_id },
            table_name
          );

          const order_data = {
            status: status,
            updated_at: updated_at,
            fraud_request_id: fraudRequestId,
            fraud_request_type: response_fraud.data.type,
            fraud_3ds_pending: 0,
          };

          await Promise.all([
            merchantOrderModel.updateDynamic(
              order_data,
              { order_id: req.body.order_id },
              table_name
            ),
            updatePaymentStatus(
              "qr_payment",
              status,
              updated_at,
              req.body.order_id
            ),
            updatePaymentStatus(
              "subs_payment",
              status,
              updated_at,
              req.body.order_id
            ),
            addOrderTransaction(
              txn,
              res_order_data,
              status,
              response_fraud.message,
              mode
            ),
            addOrderRequest(req.body.order_id, mode),
          ]);

          const new_res = {
            m_order_id: res_order_data.merchant_order_id,
            p_order_id: res_order_data.order_id,
            p_request_id: await helpers.make_sequential_no(
              mode === "test" ? "TST_REQ" : "REQ"
            ),
            psp_ref_id: "",
            psp_txn_id: payment_id,
            transaction_id: txn ? txn : "",
            status: "FAILED",
            status_code: "143",
            remark: response_fraud?.message ? response_fraud.message : "",
            paydart_category: "Decline",
            currency: res_order_data.currency,
            amount: res_order_data?.amount || "",
            m_customer_id: res_order_data.merchant_customer_id,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            return_url:
              res_order_data.return_url || process.env.DEFAULT_FAILED_URL,
            payment_method_data: {
              scheme: payload?.card_brand,
              card_country: payload?.country_code,
              card_type: payload?.card_nw,
              mask_card_number: payload.card ? maskify(payload.card) : "",
            },
            sub_merchant_identifier: res_order_data?.merchant_id
              ? await helpers.formatNumber(res_order_data?.merchant_id)
              : "",
          };

          let browser_token_enc = req.browser_fingerprint;

          if (!browser_token_enc) {
            const browser_token = {
              os: req.headers.os,
              browser: req.headers.browser,
              browser_version: req.headers["x-browser-version"],
              browser_fingerprint: req.headers.fp,
            };
            browser_token_enc = enc_dec.cjs_encrypt(
              JSON.stringify(browser_token)
            );
          }

          let res_obj = {
            order_status: "FAILED",
            reference: "",
            order_reference: "",
            payment_id: payment_id,
            order_id: res_order_data.order_id,
            new_res: new_res,
            payment_method_data: new_res.payment_method_data,
            amount: res_order_data.amount,
            currency: res_order_data.currency,
            token: browser_token_enc,
            fraud: true,
          };

          return res
            .status(statusCode.ok)
            .send(response.errorMsgWithData("Transaction Failed", res_obj, ""));

          async function updatePaymentStatus(
            tableName,
            status,
            updated_at,
            order_id
          ) {
            const payment = await merchantOrderModel.selectOne(
              "id",
              { order_no: order_id },
              tableName
            );
            if (payment) {
              const data = {
                payment_status: status,
                transaction_date: updated_at,
              };
              await merchantOrderModel.updateDynamic(
                data,
                { id: payment.id },
                tableName
              );
            }
          }

          async function addOrderTransaction(
            txn,
            res_order_data,
            status,
            message,
            mode
          ) {
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

            if (mode === "test") {
              await orderTransactionModel.test_txn_add(order_txn);
            } else {
              await orderTransactionModel.add(order_txn);
            }
          }

          async function addOrderRequest(order_id, mode) {
            const p_request_id = await helpers.make_sequential_no(
              mode === "test" ? "TST_REQ" : "REQ"
            );
            const order_req = {
              merchant_id: res_order_data?.merchant_id,
              order_id: order_id,
              request_id: p_request_id,
              request: "FAILED",
            };
            await helpers.common_add(order_req, "generate_request_id");
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
        }

        req.telr_session = telr_session;
        const authsetupBody = { ...req.body, session_id: req.body.session_id };
        const authorizationRequest =
          await telrPaymentService.authorizationSetup(authsetupBody);

        return res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              authorizationRequest?.data,
              "Payment completed"
            )
          );
      }
    } catch (error) {
      console.log(error);

      const res_order_data = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: req.bodyString("order_id") },
        table_name
      );
      let browser_token_enc = req.browser_fingerprint;

      if (!browser_token_enc) {
        const browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
      }

      const order_update_failed = {
        status: "FAILED",
        psp: "TELR",
        payment_id: payment_id,
      };
      await merchantOrderModel.updateDynamic(
        order_update_failed,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );
      let response_category_failed = await helpers.get_error_category(
        "01",
        "telr",
        "FAILED"
      );
      if (error == "card is non 3ds and non 3ds card are not allowed") {
        response_category_failed = await helpers.get_error_category(
          "47",
          "paydart",
          "FAILED"
        );
      } else {
        response_category_failed = await helpers.get_error_category(
          "01",
          "telr",
          "FAILED"
        );
      }

      let order_txn = {
        status: "FAILED",
        psp_code: "01",
        paydart_category: response_category_failed?.category,
        remark: "Invalid Request",
        txn: payment_id,
        type: res_order_data?.action.toUpperCase(),
        payment_id: "",
        order_reference_id: "",
        capture_no: "",
        order_id: res_order_data.order_id,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      if (req.body.env == "test") {
        await orderTransactionModel.test_txn_add(order_txn);
      } else {
        await orderTransactionModel.add(order_txn);
      }

      const new_res = {
        m_order_id: res_order_data.merchant_order_id,
        p_order_id: req.bodyString("order_id"),
        p_request_id: "",
        psp_ref_id: "",
        psp_txn_id: "",
        transaction_id: payment_id,
        status: "FAILED",
        status_code: "01",
        remark: "Invalid Request",
        paydart_category: response_category_failed.category,
        currency: res_order_data.currency,
        amount: res_order_data?.amount ? res_order_data?.amount : "",
        m_customer_id: res_order_data.merchant_customer_id,
        psp: res_order_data.psp,
        payment_method: res_order_data.payment_mode,
        m_payment_token: res_order_data?.card_id ? res_order_data?.card_id : "",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        return_url: res_order_data.failure_url,
        payment_method_data: {
          scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
          card_country: res_order_data?.card_country
            ? res_order_data?.card_country
            : "",
          card_type: res_order_data?.cardType ? res_order_data?.cardType : "",
          mask_card_number: res_order_data?.pan ? res_order_data?.pan : "",
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: res_order_data?.merchant_id
          ? await helpers.formatNumber(res_order_data?.merchant_id)
          : "",
      };
      res_obj = {
        order_status: "FAILED",
        reference: "",
        order_reference: "",
        payment_id: payment_id,
        order_id: res_order_data.order_id,
        new_res: new_res,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        token: browser_token_enc,
        "3ds": "",
      };
      let temp_card_details = await helpers.fetchTempLastCard({
        order_id: res_order_data?.order_id,
        mode: req.body.env,
      });
      let txnFailedLog = {
        order_id: res_order_data.order_id,
        terminal: res_order_data?.terminal_id,
        req: JSON.stringify(req.body),
        res: JSON.stringify(error),
        psp: "TELR",
        status_code: response_category_failed.response_code,
        description: "",
        activity: "Transaction failed with Telr",
        status: 1,
        mode: req.body.env,
        card_holder_name: temp_card_details.card_holder_name,
        card: temp_card_details.card,
        expiry: temp_card_details.expiry,
        cipher_id: temp_card_details.cipher_id,
        txn: payment_id,
        card_proxy: temp_card_details.card_proxy,
        "3ds_version": "0",
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await helpers.addTransactionFailedLogs(txnFailedLog);

      if (logs) {
        let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };

        await order_logs.update_logs_data(
          {
            order_id: req.body.order_id,
          },
          logs_payload,
          req.body.env
        );
      }
      return res
        .status(statusCode.ok)
        .send(response.successdatamsg(res_obj, "Transaction Failed"));
    }
  },

  authorization: async (req, res) => {
    let acsUrl = "";
    let acsPaReq = "";
    let acsMd = "";
    let redirect_url = "";
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    let payment_id = await helpers.make_sequential_no(
      req.body.env == "test" ? "TST_TXN" : "TXN"
    );
    let table_name = "orders";
    let txn_table = "order_txn";
    if (req.body.env == "test") {
      table_name = "test_orders";
      txn_table = "test_order_txn";
    }
    try {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : telr.authentication initiated`
      );

      let body_date = {
        ...req.body,
      };
      body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
      body_date.cvv = "****";
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(body_date)}`
      );

      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : helpers.make_sequential_no ${payment_id}`
      );
      let card_no = "";
      let enc_customer_id = "";
      let card_details;
      let full_card_no = "";
      let expiry = "";

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
        expiry = card_details.card_expiry;
      } else {
        card_no = req.bodyString("card").slice(-4);
        enc_customer_id = req.customer_id;
        full_card_no = req.bodyString("card");
        expiry = req.bodyString("expiry_date");
      }

      let browser_token_enc = req.browser_fingerprint;

      //console.log("browser_token_enc1", browser_token_enc)

      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : browser_token_enc ${
          req.browser_fingerprint
        }`
      );
      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : new browser token ${browser_token_enc}`
        );
      }
      //console.log("browser_token_enc2", browser_token_enc)

      let card_id = "";
      if (req.bodyString("card_id") != "") {
        card_id = req.bodyString("card_id");
      } else if (req.card_id) {
        card_id = req.card_id;
      } else {
        card_id = "";
      }

      const res_order_data = await merchantOrderModel.selectOne(
        "*",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne ${JSON.stringify(res_order_data)}`
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.selectOne`
      );

      // telr payload for session non 3ds card auth
      let payload = {
        type: res_order_data?.action.toLowerCase(),
        classValue: "ecom",
        currency: res_order_data.currency,
        amount: res_order_data.amount,
        description: res_order_data?.description || "Payment request Telr",
        cvv: req.body.cvv,
        session: req?.body?.session_id,
        billingNameFirst: res_order_data?.customer_name.split(" ")[0],
        billingNameLast: res_order_data?.customer_name.split(" ")[1],
        billingLine1: res_order_data.billing_address_line_1,
        billingLine2: res_order_data.billing_address_line_2,
        billingCity: res_order_data.billing_city,
        billingRegion: res_order_data.billing_province,
        billingCountry: res_order_data.billing_country,
        billingZip: res_order_data.billing_pincode,
        email: req?.body?.email,
        ip: res_order_data.ip,
        order_id: req.bodyString("order_id"),
      };

      if (req.bodyString("card_id")) {
        payload.card = await enc_dec.dynamic_decryption(
          card_details.card_number,
          card_details.cipher_id
        );
        payload.expiry_month = card_details.card_expiry.split("/")[0];
        payload.expiry_year = card_details.card_expiry.split("/")[1];
      } else {
        payload.card = req.body.card;
        payload.expiry_month = req.body.expiry_date.split("/")[0];
        payload.expiry_year = req.body.expiry_date.split("/")[1];
      }

      console.log("Payload_after_3ds", payload);

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );
      if (!_getmid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Routes  Available for Transaction"));
      }

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }

      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl:
          req.body.env == "test"
            ? credientials.telr.checkout_url
            : credientials.telr.checkout_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };

      const sale_api_res = await telr_sale.makeSaleRequest(
        payload,
        _terminalcred,
        req.body.env
      );

      if (_getmid.is3DS == 1) {
        res_order_data.psp = "Telr";
        const reject_obj = await rejectNon3DS(
          res_order_data,
          sale_api_res,
          req.body,
          browser_token_enc,
          req.body.env
        );

        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: res_order_data?.order_id,
          mode: req.body.env,
        });
        let txnFailedLog = {
          order_id: res_order_data.order_id,
          terminal: res_order_data?.terminal_id,
          req: JSON.stringify(payload),
          res: JSON.stringify(sale_api_res),
          psp: "TELR",
          status_code: reject_obj.new_res.status_code,
          description: reject_obj.new_res.remark,
          activity: "Transaction failed with Telr",
          status: 1,
          mode: req.body.env,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: payment_id,
          card_proxy: temp_card_details.card_proxy,
          "3ds_version": "0",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        console.log(`TXN FAILED LOG`);
        console.log(txnFailedLog);
        await helpers.addTransactionFailedLogs(txnFailedLog);
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(reject_obj, "Transaction Rejected."));
      } else {
        let req_data = {
          request: JSON.stringify(payload),
          merchant_id: res_order_data.merchant_id,
          order_id: req.bodyString("order_id"),
        };
        await helpers.common_add(req_data, "order_request");
        // nbaSBABABHDBASBDABDMNAS
        /* Update The payment status for various payment channel like qr, subscription and invoice */
        let qr_payment_status =
          sale_api_res.status === "A" ? "CAPTURED" : "FAILED";
        let qr_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: req.bodyString("order_id"),
          },
          "qr_payment"
        );

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : merchantOrderModel.selectOne ${JSON.stringify(qr_payment)}`
        );
        if (qr_payment) {
          let qr_data = {
            payment_status: qr_payment_status,
            transaction_date: updated_at,
          };

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
              qr_data
            )}`
          );

          let updated_qr_payment = await merchantOrderModel.updateDynamic(
            qr_data,
            {
              id: qr_payment.id,
            },
            "qr_payment"
          );
        }
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : invModel.selectDynamic`
        );
        let invoice_payment = await invModel.selectDynamic(
          "id",
          {
            order_id: req.bodyString("order_id"),
          },
          "inv_invoice_master"
        );

        if (invoice_payment && sale_api_res.status === "A") {
          let inv_data = {
            status: "Closed",
            payment_date: updated_at,
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : invModel.updateDynamic with data ${JSON.stringify(inv_data)}`
          );

          invModel.updateDynamic(
            inv_data,
            {
              id: invoice_payment.id,
            },
            "inv_invoice_master"
          );
        }

        let payment_status =
          sale_api_res.status === "A" || sale_api_res.status === "H"
            ? "CAPTURED"
            : "FAILED";
        let txn_status = res_order_data?.action;
        let order_status =
          res_order_data?.action.toUpperCase() == "SALE"
            ? "CAPTURED"
            : "AUTHORISED";

        /* Update the payment status for various payment channel end */
        if (sale_api_res.status === "A" || sale_api_res.status === "H") {
          let status = "AUTHORISED";
          let response_category = await helpers.get_error_category(
            "00",
            "telr",
            status
          );
          // adding entry to pg_order_txn table
          let order_txn = {
            status: status,
            txn: payment_id,
            psp_code: "00",
            paydart_category: response_category.category,
            remark: "",
            // type: res_order_data?.action.toUpperCase()=='SALE'?'CAPTURE':res_order_data?.action.toUpperCase(),
            type: res_order_data?.action.toUpperCase(),
            payment_id: sale_api_res?.tranref,
            order_id: res_order_data.order_id,
            amount: res_order_data.amount,
            currency: res_order_data.currency,
            created_at: updated_at,
            order_reference_id: "",
            capture_no: "",
          };
          if (req.body.env == "test") {
            const txn_result = await orderTransactionModel.test_txn_add(
              order_txn
            );
          } else {
            const txn_result = await orderTransactionModel.add(order_txn);
          }
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.add with data ${JSON.stringify(
              order_txn
            )}`
          );

          if (order_status === "CAPTURED" && payment_status !== "FAILED") {
            // check if Subscription Payment
            await manageSubscription(
              res_order_data,
              payment_status,
              updated_at,
              sale_api_res?.tranref,
              sale_api_res?.tranref,
              req.body.env
            );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.updateDynamic`
            );
            // subscription code end
            if (payment_status !== "FAILED") {
              /*Referrer commission started*/
              calculateAndStoreReferrerCommission({
                amount: res_order_data?.amount,
                currency: res_order_data?.currency,
                order_id: res_order_data?.order_id,
                merchant_id: res_order_data?.merchant_id,
                payment_id: payment_id,
                order_status: order_status,
                txn_status: txn_status,
              });
              /*Referrer commission ends*/

              const transaction_and_feature_data = {
                amount: res_order_data?.amount,
                currency: res_order_data?.currency,
                order_id: res_order_data?.order_id,
                merchant_id: res_order_data?.merchant_id,
                card_country: res_order_data?.card_country,
                payment_method: res_order_data?.payment_mode,
                scheme: res_order_data?.scheme,
                psp_id: res_order_data?.psp_id,
                terminal_id: res_order_data?.terminal_id,
                origin: res_order_data?.origin,
                //every time change param
                payment_id: payment_id,
                order_status: order_status,
                txn_status: txn_status,
                txn_id: payment_id,
              };
              // transaction charge
              calculateTransactionCharges(transaction_and_feature_data);

              // transaction feature charges
              calculateFeatureCharges(transaction_and_feature_data);
            }
          }

          let orderupdate = {
            status: order_status,
            psp: "TELR",
            saved_card_for_recurring: sale_api_res?.tranref,
          };

          if (
            (sale_api_res.status === "A" || sale_api_res.status === "H") &&
            res_order_data?.action.toUpperCase() !== "SALE"
          ) {
            const capture_datetime = moment().format("YYYY-MM-DD HH:mm");
            orderupdate.capture_datetime = capture_datetime;
          }

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
              orderupdate
            )}`
          );
          await merchantOrderModel.updateDynamic(
            orderupdate,
            {
              order_id: req.bodyString("order_id"),
            },
            table_name
          );
          let p_request_id = await helpers.make_sequential_no(
            req.body.env == "test" ? "TST_REQ" : "REQ"
          );
          let merchant_id = await helpers.get_data_list(
            "merchant_id",
            table_name,
            { order_id: req.body.order_id }
          );

          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: req.body.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(
            order_req,
            req.body.env == "test"
              ? "test_generate_request_id"
              : "generate_request_id"
          );
          let res_order_data1 = await merchantOrderModel.selectOne(
            "psp,payment_mode",
            {
              order_id: req.bodyString("order_id"),
            },
            table_name
          );
          let new_res = {
            m_order_id: res_order_data.merchant_order_id,
            p_order_id: res_order_data.order_id,
            p_request_id: p_request_id,
            psp_ref_id: sale_api_res?.tranref,
            psp_txn_id: sale_api_res?.tranref,
            transaction_id: payment_id,
            status:
              sale_api_res.status === "A" || sale_api_res.status === "H"
                ? "SUCCESS"
                : "FAILED",
            status_code: "00",
            remark: sale_api_res?.message,
            paydart_category: response_category,
            currency: res_order_data.currency,
            amount: res_order_data?.amount ? res_order_data?.amount : "",
            m_customer_id: res_order_data.merchant_customer_id,
            psp: res_order_data1.psp,
            payment_method: res_order_data1.payment_mode,
            m_payment_token: res_order_data?.card_id
              ? res_order_data?.card_id
              : "",
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            return_url:
              sale_api_res.status === "A" || sale_api_res.status === "H"
                ? res_order_data.success_url
                : res_order_data.failure_url,
            payment_method_data: {
              scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
              card_country: res_order_data?.card_country
                ? res_order_data?.card_country
                : "",
              card_type: res_order_data?.cardType
                ? res_order_data?.cardType
                : "",
              mask_card_number: res_order_data?.pan ? res_order_data?.pan : "",
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: res_order_data?.merchant_id
              ? await helpers.formatNumber(res_order_data?.merchant_id)
              : "",
          };
          let res_obj = {
            order_status: status,
            reference: "",
            order_reference: "",
            "3ds": {
              acsUrl: acsUrl,
              acsPaReq: acsPaReq,
              acsMd: "",
            },
            payment_id: payment_id,
            order_id: res_order_data.order_id,
            amount: res_order_data.amount,
            currency: res_order_data.currency,
            token: browser_token_enc || "",
            message: "Payment Successful",
            new_res: new_res,
          };
          // adding dump entry
          let response_dump = {
            order_id: res_order_data.order_id,
            type: res_order_data.action,
            status: status,
            dump: JSON.stringify(sale_api_res),
          };

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump ${JSON.stringify(
              response_dump
            )}`
          );

          await orderTransactionModel.addResDump(response_dump);
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.selectOne`
          );

          // Adding event base charges update in payment
          ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            let order_id = req.bodyString("order_id");
            let qb = await pool.get_connection();
            let merchant_and_customer_transaction_response;
            try {
              merchant_and_customer_transaction_response = await qb
                .select(
                  "md.company_name,md.co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                )
                .from(config.table_prefix + table_name + " o")
                .join(
                  config.table_prefix + "master_merchant_details md",
                  "o.merchant_id=md.merchant_id",
                  "inner"
                )
                .join(
                  config.table_prefix + "master_merchant mm",
                  "o.merchant_id=mm.id",
                  "inner"
                )
                .where({
                  "o.order_id": order_id,
                })
                .get();
            } catch (error) {
              console.error("Database query failed:", error);
            } finally {
              qb.release();
            }

            let mail_details = merchant_and_customer_transaction_response[0];
            mail_details.logo = mail_details.logo
              ? process.env.STATIC_URL + "/static/files/" + mail_details.logo
              : "";
            let transaction_date_time = new Date(mail_details.updated_at);
            mail_details.updated_at = moment(transaction_date_time).format(
              "DD-MM-YYYY HH:mm"
            );
            let mail_response = await mailSender.CustomerTransactionMail(
              mail_details
            );
            let merchant_mail_response =
              await mailSender.MerchantTransactionMail(mail_details);

            // charges calculation start from here
          });
          ee.emit("ping", {
            message: "hello",
          });
          // event base charges update end

          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload,
              req.body.env
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          // web  hook starting
          let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: merchant_id[0].merchant_id,
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
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: res_order_data?.order_id,
            mode: req.body.env,
          });
          let txnFailedLog = {
            order_id: res_order_data.order_id,
            terminal: res_order_data?.terminal_id,
            req: JSON.stringify(payload),
            res: JSON.stringify(sale_api_res),
            psp: "TELR",
            status_code: "00",
            description: sale_api_res?.message,
            activity: "Transaction success with Telr",
            status: 0,
            mode: req.body.env,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            txn: payment_id,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "0",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          console.log(`TXN FAILED LOG`);
          console.log(txnFailedLog);
          await helpers.addTransactionFailedLogs(txnFailedLog);
          return res
            .status(statusCode.ok)
            .send(response.successdatamsg(res_obj, "Paid successfully."));
        } else {
          const status = "FAILED";
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Transection status FAILED`
          );
          let response_category = await helpers.get_error_category(
            sale_api_res?.code,
            "telr",
            status
          );
          let order_txn = {
            status: status,
            txn: payment_id,
            type: res_order_data.action.toUpperCase(),
            payment_id: sale_api_res?.tranref,
            psp_code: sale_api_res?.code,
            remark: response_category?.response_details,
            paydart_category: response_category?.category,
            payment_id: sale_api_res?.tranref,
            order_id: res_order_data?.order_id,
            amount: res_order_data?.amount,
            currency: res_order_data?.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            order_reference_id: "",
            capture_no: "",
          };
          if (req.body.env == "test") {
            await orderTransactionModel.test_txn_add(order_txn);
          } else {
            await orderTransactionModel.add(order_txn);
          }

          let orderupdate = {
            status: status,
            cardholderName: req?.body?.name,
            psp: "TELR",
          };
          await merchantOrderModel.updateDynamic(
            orderupdate,
            {
              order_id: res_order_data?.order_id,
            },
            table_name
          );

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : order txn update with data ${JSON.stringify(order_txn)}`
          );
          // adding dump entry
          let response_dump = {
            order_id: req.body?.order_id,
            type: "Payment",
            status: status,
            dump: JSON.stringify(sale_api_res),
          };
          if (req.body.env == "test") {
            await orderTransactionModel.addTestResDump(response_dump);
          } else {
            await orderTransactionModel.addResDump(response_dump);
          }

          let p_request_id = await helpers.make_sequential_no("REQ");
          let merchant_id = await helpers.get_data_list(
            "merchant_id",
            table_name,
            { order_id: res_order_data.order_id }
          );

          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: res_order_data.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(order_req, "generate_request_id");
          let new_res = {
            m_order_id: res_order_data.merchant_order_id
              ? res_order_data.merchant_order_id
              : "",
            p_order_id: res_order_data.order_id ? res_order_data.order_id : "",
            p_request_id: p_request_id,
            psp_ref_id: sale_api_res.tranref ? sale_api_res.tranref : "",
            psp_txn_id: sale_api_res.tranref ? sale_api_res.tranref : "",
            transaction_id: payment_id,
            status: "FAILED",
            status_code: sale_api_res?.code,
            remark: sale_api_res?.message,
            paydart_category: response_category,
            currency: res_order_data.currency,
            return_url: res_order_data.failure_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: res_order_data.amount.toFixed(2),
            m_customer_id: res_order_data.merchant_customer_id
              ? res_order_data.merchant_customer_id
              : "",
            psp: res_order_data.psp,
            payment_method: res_order_data.payment_mode,
            m_payment_token: res_order_data.card_id,
            payment_method_data: {
              scheme: res_order_data.scheme,
              card_country: res_order_data.card_country,
              card_type: res_order_data.cardType,
              mask_card_number: res_order_data.pan,
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: res_order_data?.merchant_id
              ? await helpers.formatNumber(res_order_data?.merchant_id)
              : "",
          };
          let res_obj = {
            order_status: status,
            payment_id: payment_id,
            order_id: res_order_data?.order_id,
            amount: res_order_data?.amount,
            currency: res_order_data?.currency,
            token: req.body.browserFP || "",
            return_url: res_order_data.return_url,
            message: sale_api_res.message,
            new_res: new_res,
          };
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: res_order_data?.order_id,
            mode: req.body.env,
          });
          let txnFailedLog = {
            order_id: res_order_data.order_id,
            terminal: res_order_data?.terminal_id,
            req: JSON.stringify(payload),
            res: JSON.stringify(sale_api_res),
            psp: "TELR",
            status_code: sale_api_res?.code,
            description: sale_api_res?.message,
            activity: "Transaction failed with Telr",
            status: 1,
            mode: req.body.env,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            txn: payment_id,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "0",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          console.log(`TXN FAILED LOG`);
          console.log(txnFailedLog);
          await helpers.addTransactionFailedLogs(txnFailedLog);

          let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: merchant_id[0].merchant_id,
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

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump  = ${response_dump}`
          );

          const logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.body.MD,
              },
              logs_payload,
              req.body.env
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });

          return res
            .status(statusCode.ok)
            .send(response.errorMsgWithData(sale_api_res.message, res_obj));
        }
      }
    } catch (error) {
      console.log("🚀 ~ authorization: ~ error:", error);
      let res_order_data = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: req.bodyString("order_id") },
        table_name
      );
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

      try {
        const order_update_failed = {
          status: "FAILED",
          psp: "TELR",
          payment_id: payment_id,
        };
        await merchantOrderModel.updateDynamic(
          order_update_failed,
          { order_id: req.bodyString("order_id") },
          table_name
        );
        let response_category_failed = await helpers.get_error_category(
          "01",
          "telr",
          "FAILED"
        );
        if (error == "card is non 3ds and non 3ds card are not allowed") {
          response_category_failed = await helpers.get_error_category(
            "47",
            "paydart",
            "FAILED"
          );
        } else {
          response_category_failed = await helpers.get_error_category(
            "01",
            "telr",
            "FAILED"
          );
        }

        let order_txn = {
          status: "FAILED",
          psp_code: "01",
          paydart_category: response_category_failed?.category,
          remark: "Invalid Request",
          txn: payment_id,
          type: res_order_data?.action.toUpperCase(),
          payment_id: "",
          order_reference_id: "",
          capture_no: "",
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (req.body.env == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        new_res = {
          m_order_id: res_order_data.merchant_order_id,
          p_order_id: req.bodyString("order_id"),
          p_request_id: "",
          psp_ref_id: "",
          psp_txn_id: "",
          transaction_id: payment_id,
          status: "FAILED",
          status_code: "01",
          remark: error,
          paydart_category: response_category_failed.category,
          currency: res_order_data.currency,
          amount: res_order_data?.amount ? res_order_data?.amount : "",
          m_customer_id: res_order_data.merchant_customer_id,
          psp: res_order_data.psp,
          payment_method: res_order_data.payment_mode,
          m_payment_token: res_order_data?.card_id
            ? res_order_data?.card_id
            : "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          return_url: res_order_data.failure_url,
          payment_method_data: {
            scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
            card_country: res_order_data?.card_country
              ? res_order_data?.card_country
              : "",
            card_type: res_order_data?.cardType ? res_order_data?.cardType : "",
            mask_card_number: res_order_data?.pan ? res_order_data?.pan : "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: res_order_data?.merchant_id
            ? await helpers.formatNumber(res_order_data?.merchant_id)
            : "",
        };
        res_obj = {
          order_status: "FAILED",
          reference: "",
          order_reference: "",
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          new_res: new_res,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc,
          "3ds": "",
        };
        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: res_order_data?.order_id,
          mode: req.body.env,
        });
        let txnFailedLog = {
          order_id: res_order_data.order_id,
          terminal: res_order_data?.terminal_id,
          req: JSON.stringify(req.body),
          res: JSON.stringify(error),
          psp: "TELR",
          status_code: response_category_failed.response_code,
          description: "",
          activity: "Transaction failed with Telr",
          status: 1,
          mode: req.body.env,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: payment_id,
          card_proxy: temp_card_details.card_proxy,
          "3ds_version": "0",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(res_obj, "Transaction Failed"));
      } catch (error) {
        console.log(error);
      }
    }
  },
};

module.exports = MerchantOrder;
