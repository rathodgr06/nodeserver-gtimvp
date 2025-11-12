const merchantOrder = require("../models/merchantOrder");
const invModel = require("../models/invoiceModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const { custom } = require("joi");
var uuid = require("uuid");
const shortid = require("shortid");
const subs_plan_model = require("../models/subs_plan_model");
const accessToken = require("../utilities/tokenmanager/token");
const merchantOrderModel = require("../models/merchantOrder");
const ReferralBonusModel = require("../models/referral_bonusModel");
const orderTransactionModel = require("../models/order_transaction");
const axios = require("axios");
const countryModel = require("../models/country");
const rejectNon3DS = require("../controller/rejectTransaction");
let autoCaptureTest = require("../utilities/auto/auto-capture-test.js");
let autoCapture = require("../utilities/auto/auto-capture.js");

const myf_capture = require("./myf/capture.js");
const myf_void = require("./myf/void.js");
const {
  successdatamsg,
  successmsg,
} = require("../utilities/response/ServerResponse");
const SequenceUUID = require("sequential-uuid");
const e = require("express");
const credentials = require("../config/credientials.js");
require("dotenv").config({
  path: "../.env",
});
const moment = require("moment");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const return_url = process.env.RETURN_URL;
const ShortUniqueId = require("short-unique-id");
const {
  pay_with_vault,
} = require("../utilities/validations/merchantOrderValidator");
const currency = require("./currency");
const EventEmitter = require("events");
const ee = new EventEmitter();
const path = require("path");
require("dotenv").config({
  path: "../.env",
});
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const mailSender = require("../utilities/mail/mailsender");
const ni_sale = require("./ni");
const telr_sale = require("./telr");
const { orderCancel, orderRefund, authCancel } = require("./ni");
const mobile_activity_logger = require("../utilities/activity-logger/mobile_activity_logger");
const TransactionsModel = require("../models/transactions");
const cipherModel = require("../models/cipher_models");
const order_logs = require("../models/order_logs");
const { send_webhook_data } = require("./webhook_settings");
const PayTabsController = require("./PaytabsController");
const calculateAndStoreReferrerCommission = require("./../utilities/referrer-bonus/index");
const refundReferrerBonus = require("./../utilities/referrer-bonus-refund/index");
const manageSubscription = require("../utilities/subscription/index");
const subscription_check = require("../utilities/validations/subscription_check");
const credientials = require("../config/credientials");
const SubmerchantModel = require("../models/submerchantmodel");
const SendMail = require("./cronjobs");
const declinedCardModel = require("../models/subscription_card_declined_model");
const subscription_card_expired_model = require("../models/subscription_card_expired_model");
const calculateTransactionCharges = require("../utilities/charges/transaction-charges/index");
const calculateFeatureCharges = require("../utilities/charges/feature-charges/index");
const winston = require("../utilities/logmanager/winston");
const { mode } = require("crypto-js");
const fraudService = require("../service/fraudService");
const TelrAutoCapture = require("../utilities/auto/telrAutoCapture.js");
const RecurringController = require("./recurringController.js");
const PaymentRecurringController = require("./PaymentrecurringController.js");
const charges_invoice_models = require("../models/charges_invoice_models");
const mpgs_capture = require("./mpgs/capture.js");
const mpgs_refund = require("./mpgs/refund.js");
const mpgs_void = require("./mpgs/void.js");
const myf_refund = require("./myf/refund.js");
const fiserv_capture = require("./fiserv/capture.js");
const fiserv_refund = require("./fiserv/refund.js");
const fiserv_void = require("./fiserv/void.js");
const SendTransactionMailAction = require("./SendTransactionMail.js");
const https = require("https");
const { send } = require("process");
const ni_capture_func = async (req, res) => {
  let order_id = req.bodyString("p_order_id");

  let captured_data = await orderTransactionModel.selectOneDecremental(
    "order_reference_id,payment_id,amount,currency",
    {
      order_id: order_id.toString(),
      status: "AUTHORISED",
    },
    "order_txn"
  );

  try {
    let capture_data = {
      order_no: captured_data?.order_reference_id,
      payment_no: captured_data?.payment_id,
      currency: req.body.amount.currencyCode,
      amount: req.body.amount.value,
    };

    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id,merchant_order_id,created_at",
      {
        order_id: req.bodyString("p_order_id"),
      },
      "orders"
    );

    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id",
      {
        terminal_id: _terminalids.terminal_id,
      },
      "mid"
    );

    if (!_getmid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Terminal Available"));
    }
    const _pspid = await merchantOrderModel.selectOne(
      "*",
      {
        id: _getmid.psp_id,
      },
      "psp"
    );
    if (!_pspid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Psp Available"));
    }

    const _terminalcred = {
      MID: _getmid.MID,
      password: _getmid.password,
      baseurl: credientials[_pspid.credentials_key].base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };

    var ni_capture = await ni_sale.orderCapture(capture_data, _terminalcred);

    if (ni_capture) {
      let order_update = {
        status: ni_capture.state,
      };
      await merchantOrderModel.updateDynamic(
        order_update,
        {
          order_id: req.bodyString("p_order_id"),
        },
        "orders"
      );

      let capture_no = "";

      if (
        ni_capture.state === "CAPTURED" ||
        ni_capture.state === "PARTIALLY_CAPTURED"
      ) {
        let old_capture_no = await orderTransactionModel.selectOneDecremental(
          "capture_no",
          {
            order_id: req.body.p_order_id,
            type: "CAPTURE",
            status: "AUTHORISED",
          },
          "order_txn"
        );
        capture_no =
          ni_capture?._embedded["cnp:capture"][0]._links?.self?.href.split(
            "/captures/"
          )[1] || old_capture_no.capture_no;
      }
      let txn_type = "CAPTURE";
      if (ni_capture.state === "PARTIALLY_CAPTURED") {
        txn_type = "PARTIALLY_CAPTURE";
      }

      let generate_payment_id = await helpers.make_sequential_no("TXN");
      let order_txn = {
        status:
          ni_capture.state === "CAPTURED" ||
          ni_capture.state === "PARTIALLY_CAPTURED"
            ? "AUTHORISED"
            : "FAILED",
        txn: generate_payment_id,
        type: txn_type,
        payment_id: ni_capture.reference,
        order_reference_id: ni_capture.orderReference,
        capture_no: capture_no,
        order_id: req.bodyString("p_order_id"),
        amount: req.body.amount.value,
        currency: req.body.amount.currencyCode,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await orderTransactionModel.add(order_txn);

      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "CAPTURE",
        status:
          ni_capture.state === "CAPTURED" ||
          ni_capture.state === "PARTIALLY_CAPTURED"
            ? "AUTHORISED"
            : "FAILED",
        dump: JSON.stringify(ni_capture),
      };
      await orderTransactionModel.addResDump(resp_dump);

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

      let res_obj = {
        status: ni_capture.state,
        // status_code:
        // reference: ni_capture.reference,
        // order_reference: ni_capture.orderReference,
        p_request_id: generate_payment_id,
        p_order_id: req.bodyString("p_order_id"),
        m_order_id: _terminalids.merchant_order_id,
        p_ref_id: _getmid.psp_id,
        amount: req.body.amount.value,
        currency: req.body.amount.currencyCode,
        date: moment(order_txn.created_at).format("DD/MM/YYYY"),
        // psp_txn_id:
        transaction_id: generate_payment_id,
        // token: browser_token_enc,
        // "3ds": ni_capture["3ds"],
      };
      let order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: req.bodyString("p_order_id") },
        "orders"
      );
      let web_hook_res = {
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: generate_payment_id,
        psp_ref_id: ni_capture.orderReference,
        psp_txn_id: ni_capture.reference,
        transaction_id: "",
        status: "SUCCESS",
        status_code: ni_capture.state,
        currency: order_details.currency,
        transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        amount: req.body.amount.value,
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
        merchant_id: req.user.merchant_id,
      });

      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
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
          response.successansmsg(res_obj, "Transaction successfully Captured.")
        );
    } else {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to initiate Transaction Captured."));
    }
  } catch (error) {
    winston.error(error);
    let resp_dump = {
      order_id: req.bodyString("p_order_id"),
      type: "CAPTURE",
      status: "FAILED",
      dump: JSON.stringify(error?.response?.data),
    };
    await orderTransactionModel.addResDump(resp_dump);
    res
      .status(statusCode.ok)
      .send(response.errormsg(error.response?.data.errors[0].message));
  }
};
const ni_open_capture_func = async (req, res) => {
  let transaction_id = req.bodyString("transaction_id");
  let mode = req?.credentials?.type || req?.body?.mode;
  let captured_data = await orderTransactionModel.selectOne(
    "order_reference_id,payment_id,amount,currency,order_id",
    {
      txn: transaction_id,
      status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );
  let order_id = captured_data.order_id;
  try {
    let capture_data = {
      order_no: captured_data?.order_reference_id,
      payment_no: captured_data?.payment_id,
      currency: req.body.amount.currencyCode,
      amount: req.body.amount.value,
    };

    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id,merchant_order_id,created_at",
      {
        order_id: req.bodyString("p_order_id"),
      },
      mode == "test" ? "test_orders" : "orders"
    );

    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id",
      {
        terminal_id: _terminalids.terminal_id,
      },
      "mid"
    );

    if (!_getmid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Terminal Available"));
    }
    const _pspid = await merchantOrderModel.selectOne(
      "*",
      {
        id: _getmid.psp_id,
      },
      "psp"
    );
    if (!_pspid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Psp Available"));
    }

    const _terminalcred = {
      MID: _getmid.MID,
      password: _getmid.password,
      baseurl:
        mode == "test"
          ? credientials[_pspid.credentials_key].test_url
          : credientials[_pspid.credentials_key].base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };

    var ni_capture = await ni_sale.orderCapture(capture_data, _terminalcred);

    if (ni_capture) {
      let order_update = {
        status: ni_capture.state,
      };
      await merchantOrderModel.updateDynamic(
        order_update,
        {
          order_id: order_id,
        },
        mode == "test" ? "test_orders" : "orders"
      );

      let capture_no = "";

      if (
        ni_capture.state === "CAPTURED" ||
        ni_capture.state === "PARTIALLY_CAPTURED"
      ) {
        let old_capture_no = await orderTransactionModel.selectOne(
          "capture_no",
          {
            order_id: order_id,
            type: "CAPTURE",
            status: "AUTHORISED",
          },
          mode == "test" ? "test_order_txn" : "order_txn"
        );
        capture_no =
          ni_capture?._embedded["cnp:capture"][0]._links?.self?.href.split(
            "/captures/"
          )[1] || old_capture_no.capture_no;
      }
      let txn_type = "CAPTURE";
      if (ni_capture.state === "PARTIALLY_CAPTURED") {
        txn_type = "PARTIALLY_CAPTURE";
      }

      let generate_payment_id = await helpers.make_sequential_no(
        mode == "live" ? "TXN" : "TST_TXN"
      );
      let order_txn = {
        status:
          ni_capture.state === "CAPTURED" ||
          ni_capture.state === "PARTIALLY_CAPTURED"
            ? "AUTHORISED"
            : "FAILED",
        txn: generate_payment_id,
        type: txn_type,
        payment_id: ni_capture.reference,
        order_reference_id: ni_capture.orderReference,
        capture_no: capture_no,
        order_id: order_id,
        amount: req.body.amount.value,
        currency: req.body.amount.currencyCode,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      if (mode == "live") {
        await orderTransactionModel.add(order_txn);
      } else {
        await orderTransactionModel.test_txn_add(order_txn);
      }

      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "CAPTURE",
        status:
          ni_capture.state === "CAPTURED" ||
          ni_capture.state === "PARTIALLY_CAPTURED"
            ? "AUTHORISED"
            : "FAILED",
        dump: JSON.stringify(ni_capture),
      };
      if (mode == "test") {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
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

      let res_obj = {
        status: ni_capture.state,
        // status_code:
        // reference: ni_capture.reference,
        // order_reference: ni_capture.orderReference,
        p_request_id: generate_payment_id,
        p_order_id: req.bodyString("p_order_id"),
        m_order_id: _terminalids.merchant_order_id,
        p_ref_id: _getmid.psp_id,
        amount: req.body.amount.value,
        currency: req.body.amount.currencyCode,
        date: moment(order_txn.created_at).format("DD/MM/YYYY"),
        // psp_txn_id:
        transaction_id: generate_payment_id,
        // token: browser_token_enc,
        // "3ds": ni_capture["3ds"],
      };
      let order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: req.bodyString("p_order_id") },
        mode == "test" ? "test_orders" : "orders"
      );
      let web_hook_res = {
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: generate_payment_id,
        psp_ref_id: ni_capture.orderReference,
        psp_txn_id: ni_capture.reference,
        transaction_id: "",
        status: "SUCCESS",
        status_code: ni_capture.state,
        currency: order_details.currency,
        transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        amount: req.body.amount.value,
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
        merchant_id: req.credentials.merchant_id,
      });

      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
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
          response.successansmsg(res_obj, "Transaction successfully Captured.")
        );
    } else {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to initiate Transaction Captured."));
    }
  } catch (error) {
    console.log(error);
    winston.error(error);
    let resp_dump = {
      order_id: req.bodyString("p_order_id"),
      type: "CAPTURE",
      status: "FAILED",
      dump: JSON.stringify(error?.response?.data),
    };
    if (req.credentials.type == "test") {
      await orderTransactionModel.addTestResDump(resp_dump);
    } else {
      await orderTransactionModel.addResDump(resp_dump);
    }
    res
      .status(statusCode.ok)
      .send(response.errormsg(error.response?.data.errors[0].message));
  }
};

const telr_capture_func = async (req, res) => {
  let mode = req.credentials.type;
  let order_detail = await orderTransactionModel.selectOne(
    "*",
    { order_id: req.bodyString("p_order_id") },
    mode == "test" ? "test_orders" : "orders"
  );
  let captured_data = await orderTransactionModel.selectOne(
    "amount,currency,payment_id",
    {
      order_id: req.bodyString("p_order_id"),
      status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );

  let get_order_amount = await orderTransactionModel.selectOne(
    "amount_left,merchant_order_id,psp_id,amount",
    {
      order_id: req.bodyString("p_order_id"),
      status: ["AUTHORISED", "PARTIALLY_CAPTURED", "VOID"],
    },
    mode == "test" ? "test_orders" : "orders"
  );

  let get_partial_order_amount =
    await orderTransactionModel.selectCaptureAmountSum(
      "*",
      {
        order_id: req.bodyString("p_order_id"),
      },
      mode == "live" ? "order_txn" : "test_order_txn"
    );
  let check_amount = 0.0;

  check_amount =
    parseFloat(get_order_amount.amount) -
    (parseFloat(get_partial_order_amount.amount) +
      parseFloat(req.body.amount.value));
  let status = "CAPTURED";
  let txn_type = "CAPTURE";

  if (check_amount > 0) {
    status = "PARTIALLY_CAPTURED";
    txn_type = "PARTIALLY_CAPTURE";
  }

  try {
    let payload = {
      type: "capture",
      class: "ecom",
      currency: req.body.amount.currencyCode,
      amount: req.body.amount.value,
      tranref: captured_data.payment_id,
    };
    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id",
      {
        order_id: req.bodyString("p_order_id"),
      },
      mode == "test" ? "test_orders" : "orders"
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id,autoCaptureWithinTime",
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
      baseurl: credientials[_pspid.credentials_key].base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };
    let telr_capture = await telr_sale.makeCaptureRequest(
      payload,
      _terminalcred
    );

    if (telr_capture) {
      if (telr_capture.status === "E") {
        res
          .status(statusCode.ok)
          .send(response.errormsg(telr_capture?.message));
      } else {
        let order_update = {
          status: status,
        };

        if (check_amount > 0) {
          order_update.amount_left = check_amount;
          order_update.status = "PARTIALLY_CAPTURED";
        }

        await merchantOrderModel.updateDynamic(
          order_update,
          {
            order_id: req.bodyString("p_order_id"),
          },
          mode == "test" ? "test_orders" : "orders"
        );

        let generate_payment_id = await helpers.make_sequential_no(
          mode == "test" ? "TST_TXN" : "TXN"
        );
        let order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: txn_type,
          txn: generate_payment_id,
          payment_id: telr_capture.tranref,
          // status: "CAPTURED",
          status: "AUTHORISED",
          amount: req.body.amount.value,
          currency: req.body.amount.currencyCode,
          // amount: captured_data.amount,
          // currency: captured_data.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        let resp_dump = {
          order_id: req.bodyString("p_order_id"),
          type: "PAYMENT",
          status: status,
          // status: "CAPTURED",
          dump: JSON.stringify(telr_capture),
        };
        if (mode == "test") {
          await orderTransactionModel.addTestResDump(resp_dump);
        } else {
          await orderTransactionModel.addResDump(resp_dump);
        }

        let browser_token_enc = req.browser_fingerprint;
        if (!browser_token_enc) {
          let browser_token = {
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
          status: status,
          m_order_id: order_detail.merchant_order_id,
          p_order_id: order_txn.order_id,
          p_request_id: order_txn.txn,
          p_ref_id: telr_capture.tranref,
          amount: Number(req.body.amount.value).toFixed(2),
          currency: req.body.amount.currencyCode,
          date: moment(order_txn.created_at).format("DD/MM/YYYY"),
          // psp_txn_id:
          transaction_id: generate_payment_id,
          // reference: "",
          // order_reference: "",
          // token: browser_token_enc,
          // "3ds": {
          //     eci: "",
          //     eciDescription: "",
          //     summaryText: "",
          // },
          // status: ni_capture.state,
          // status_code:
          // reference: ni_capture.reference,
          // order_reference: ni_capture.orderReference,
          // p_request_id: generate_payment_id,
          // p_order_id: req.bodyString("order_id"),
          // m_order_id: _terminalids.merchant_order_id,
          // p_ref_id: enc_dec.cjs_encrypt(_getmid.psp_id),
          // amount: req.body.amount.value,
          // currency: req.body.amount.currencyCode,
        };

        let order_details = await orderTransactionModel.selectOne(
          "*",
          { order_id: req.bodyString("p_order_id") },
          mode == "test" ? "test_orders" : "orders"
        );

        let web_hook_res = {
          m_order_id: order_details.merchant_order_id,
          p_order_id: order_details.order_id,
          p_request_id: generate_payment_id,
          psp_ref_id: "",
          psp_txn_id: telr_capture.tranref,
          transaction_id: "",
          status: "SUCCESS",
          status_code: check_amount > 0 ? "PARTIALLY_CAPTURE" : "CAPTURE",
          currency: order_details.currency,
          transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          amount: Number(req.body.amount.value).toFixed(2),
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
          merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
        });

        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
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
      }
    } else {
      res.status(statusCode.ok).send(response.errormsg("Unable to capture."));
    }
  } catch (error) {
    winston.error(error);
    console.log(error);
    let resp_dump = {
      order_id: req.bodyString("p_order_id"),
      type: "CAPTURED",
      status: "FAILED",
      dump: JSON.stringify(error?.response?.data),
    };
    if (req.credentials.env == "mode") {
      await orderTransactionModel.addTestResDump(resp_dump);
    } else {
      await orderTransactionModel.addResDump(resp_dump);
    }

    if (error instanceof axios.AxiosError) {
      // Axios error occurred
      if (
        error.response &&
        error.response.data &&
        error.response.data.errors &&
        error.response.data.errors.length > 0
      ) {
        // The request was made and the server responded with an error status code
        const errorMessage = error.response.data.errors[0].message;
        res.status(statusCode.ok).send(response.errormsg(errorMessage));
      } else if (!error.response) {
        // No response received from the server
        res
          .status(statusCode.ok)
          .send(response.errormsg("No response received from the server"));
      } else {
        // Error occurred while setting up the request
        res
          .status(statusCode.ok)
          .send(response.errormsg("Error occurred while sending the request"));
      }
    } else {
      // Other types of errors
      res
        .status(statusCode.ok)
        .send(
          response.errormsg("Webhook unable to handle response or request")
        );
    }
  }
};

const telr_void_func = async (req, res) => {
  let mode = req?.credentials?.type || req?.body?.mode;
  let captured_data = await orderTransactionModel.selectOne(
    "capture_no,amount,currency,payment_id",
    {
      order_id: req.bodyString("p_order_id"),
      txn: req.bodyString("txn_id"),
      // type: "CAPTURE",
      // status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );

  order_details = await orderTransactionModel.selectOne(
    "*",
    { order_id: req.bodyString("p_order_id") },
    mode == "test" ? "test_orders" : "orders"
  );
  try {
    const amount = captured_data?.amount;
    let payload = {
      type: "void",
      class: "ecom",
      currency: captured_data?.currency,
      amount: amount,
      tranref: captured_data.payment_id,
    };
    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id",
      {
        order_id: req.bodyString("p_order_id"),
      },
      mode == "test" ? "test_orders" : "orders"
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id,autoCaptureWithinTime",
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
      baseurl: credientials[_pspid.credentials_key].base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };
    let telr_void = await telr_sale.makeVoidRequest(payload, _terminalcred);

    let remark = "";
    let void_status = "";
    let order_status = "VOID";
    let txn_type = "VOID";

    const txnVoidingDetails = await merchantOrderModel.selectOne(
      "type,status",
      {
        txn: req.bodyString("txn_id"),
      },
      mode == "test" ? "test_order_txn" : "order_txn"
    );

    if (
      (order_details.status == "CAPTURED" ||
        order_details.status == "PARTIALLY_CAPTURED") &&
      order_details.action == "SALE"
    ) {
      void_status = "DEBIT";
      remark = "Captured Reversal";
    } else if (
      order_details.status == "REFUNDED" ||
      order_details.status == "PARTIALLY_REFUNDED"
    ) {
      remark = "Refund Reversal";
      void_status = "CREDIT";
    } else if (
      order_details.status == "VOID" &&
      txnVoidingDetails.status == "AUTHORISED" &&
      (txnVoidingDetails.type == "REFUND" ||
        txnVoidingDetails.type == "PARTIAL_REFUND")
    ) {
      remark = "Refund Reversal";
      void_status = "CREDIT";
    } else if (
      order_details.status == "VOID" &&
      txnVoidingDetails.status == "AUTHORISED" &&
      (txnVoidingDetails.type == "CAPTURE" ||
        txnVoidingDetails.type == "PARTIAL_CAPTURE")
    ) {
      remark = "Captured Reversal";
      void_status = "CREDIT";
    } else {
      void_status = "DEBIT";
      remark = "AUTH Reversal";
    }
    let generate_payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );

    //let telr_void = { status: 'A' };
    if (telr_void.status == "A") {
      /* refundReferrerBonus({
         amount: amount,
         currency: order_details?.currency,
         order_id: order_details?.order_id,
         merchant_id: order_details?.merchant_id,
         payment_id: generate_payment_id,
         order_status: order_status,
         txn_type: txn_type,
         void_status: void_status,
       }); */
      // return res.status(statusCode.ok).send(
      //     response.successansmsg({}, "Refunded Successfully.")
      // );
    }

    if (telr_void.status == "A") {
      let order_update = {
        status: order_status,
      };
      await merchantOrderModel.updateDynamic(
        order_update,
        {
          order_id: req.bodyString("order_id"),
        },
        mode == "test" ? "test_orders" : "orders"
      );

      const uid = new ShortUniqueId({
        length: 10,
      });

      let txn_update = await merchantOrderModel.updateDynamic(
        { is_voided: 1 },
        { txn: req.bodyString("txn_id") },
        mode == "test" ? "test_order_txn" : "order_txn"
      );
      let order_txn = {
        order_id: req.bodyString("p_order_id"),
        type: txn_type,
        txn: generate_payment_id,
        status: "AUTHORISED",
        amount: captured_data.amount,
        currency: captured_data.currency,
        payment_id: telr_void.tranref,
        remark: remark,
        is_voided: 1,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        txn_ref_id: req.bodyString("txn_id"),
      };
      if (mode == "test") {
        await orderTransactionModel.test_txn_add(order_txn);
      } else {
        await orderTransactionModel.add(order_txn);
      }

      // transaction charge
      /*  calculateTransactionCharges({
          amount: order_details?.amount,
          currency: order_details?.currency,
          order_id: order_details?.order_id,
          merchant_id: order_details?.merchant_id,
          payment_id: generate_payment_id,
          order_status: order_status,
          txn_status: txn_type,
          txn_id: generate_payment_id,
          card_country: order_details?.card_country,
          payment_method: order_details?.payment_mode,
          scheme: order_details?.scheme,
          psp_id: order_details?.psp_id,
          terminal_id: order_details?.terminal_id,
        }); */

      let resp_dump = {
        order_id: req.bodyString("order_id"),
        type: txn_type,
        status: order_status,
        dump: JSON.stringify(telr_void),
      };
      if (mode == "test") {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
      }

      let res_obj = {
        status: order_status,
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: order_txn.txn,
        p_ref_id: telr_void.tranref,
        transaction_id: generate_payment_id,
        amount: order_txn.amount.toFixed(2),
        currency: order_txn.currency,
        // "3ds": {
        //     acsUrl: "",
        //     acsPaReq: "",
        //     acsMd: "",
        // },
        // p_request_id: order_txn.txn,
        // amount: req.body.amount.value,
        // currency: req.body.amount.currencyCode,
        date: moment(order_txn.created_at).format("DD/MM/YYYY HH:mm:ss"),
        // psp_txn_id:
      };

      let web_hook_res = {
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: generate_payment_id,
        psp_ref_id: telr_void.tranref,
        psp_txn_id: "",
        transaction_id: "",
        status: "SUCCESS",
        status_code: remark,
        currency: order_details.currency,
        transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        amount: Number(req.body.amount.value).toFixed(2),
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
        merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
      });

      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
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
          response.successansmsg(res_obj, "Transaction successfully void.")
        );
    } else {
      res.status(statusCode.ok).send(response.errormsg(telr_void.message));
    }
  } catch (error) {
    console.log(error);
    winston.error(error);

    let resp_dump = {
      order_id: req.bodyString("order_id"),
      type: "VOID",
      status: "FAILED",
      dump: JSON.stringify(error?.response?.data),
    };
    if (req.credentials.type == "test") {
      await orderTransactionModel.addTestResDump(resp_dump);
    } else {
      await orderTransactionModel.addResDump(resp_dump);
    }

    let errorMessage = "An error occurred while processing the webhook request";

    if (error.message.includes("Request failed with status code")) {
      errorMessage = error.message;
    } else if (error.message === "No response received from the server") {
      errorMessage = "Webhook server unable to receive or handle requests";
    }

    res
      .status(statusCode.ok)
      .send(
        response.errormsg(
          error.response.data.errors[0].message
            ? error.response.data.errors[0].message
            : errorMessage
        )
      );
  }
};

const ni_void_func = async (req, res) => {
  let mode = req?.credentials?.type || req?.body?.mode;
  order_details = await orderTransactionModel.selectOne(
    "*",
    { order_id: req.bodyString("p_order_id") },
    mode == "test" ? "test_orders" : "orders"
  );
  let captured_data = await orderTransactionModel.selectOneDecremental(
    "capture_no,amount,currency",
    {
      txn: req.bodyString("txn_id"),
      status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );

  let await_3ds_data = await orderTransactionModel.selectOne(
    "type,payment_id,order_reference_id,capture_no",
    {
      txn: req.bodyString("txn_id"),
      status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );
  try {
    let capture_data = {
      orderNo: await_3ds_data?.order_reference_id,
      payment_id: await_3ds_data?.payment_id,
      capture_no: captured_data?.capture_no,
    };

    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id",
      {
        order_id: req.bodyString("p_order_id"),
      },
      mode == "test" ? "test_orders" : "orders"
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id",
      {
        terminal_id: _terminalids.terminal_id,
      },
      "mid"
    );
    if (!_getmid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Terminal Available"));
    }
    const _pspid = await merchantOrderModel.selectOne(
      "*",
      {
        id: _getmid.psp_id,
      },
      "psp"
    );
    if (!_pspid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Psp Available"));
    }

    const _terminalcred = {
      MID: _getmid.MID,
      password: _getmid.password,
      baseurl:
        mode == "test"
          ? credientials[_pspid.credentials_key].test_url
          : credientials[_pspid.credentials_key].base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };
    if (await_3ds_data.type == "AUTH") {
      var ni_capture = await authCancel(capture_data, _terminalcred);
    } else {
      var ni_capture = await orderCancel(capture_data, _terminalcred);
    }

    if (ni_capture) {
      const uid = new ShortUniqueId({ length: 10 });
      let generate_payment_id =
        mode == "live"
          ? await helpers.make_sequential_no("TXN")
          : await helpers.make_sequential_no("TST_TXN");
      let order_txn = {};
      let remark = "";
      if (
        order_details.status == "CAPTURED" ||
        order_details.status == "PARTIALLY_CAPTURED"
      ) {
        remark = "Captured Reversal";
      } else if (
        order_details.status == "REFUNDED" ||
        order_details.status == "PARTIALLY_REFUNDED"
      ) {
        remark = "Refund Reversal";
      } else {
        remark = "AUTH Reversal";
      }

      if (ni_capture.state == "AUTHORISED" || ni_capture.state == "REVERSED") {
        order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: "VOID",
          is_voided: 1,
          txn: generate_payment_id,
          status:
            ni_capture?.state == "REVERSED" || ni_capture.state == "AUTHORISED"
              ? "AUTHORISED"
              : "FAILED",
          amount: captured_data?.amount,
          currency: captured_data?.currency,
          payment_id: ni_capture.reference,
          remark: remark,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          txn_ref_id: req.bodyString("txn_id"),
        };
      } else {
        order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: "VOID",
          txn: generate_payment_id,
          status: "FAILED",
          amount: captured_data?.amount,
          currency: captured_data?.currency,
          payment_id: ni_capture.reference,
          remark: remark,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          txn_ref_id: req.bodyString("txn_id"),
        };
        /*
                if (ni_capture?._embedded["cnp:capture"][0].state == "VOID") {
                  await calculateTransactionCharges({
                    amount: order_details?.amount,
                    currency: order_details?.currency,
                    order_id: order_details?.order_id,
                    merchant_id: order_details?.merchant_id,
                    payment_id: generate_payment_id,
                    order_status: "VOID",
                    txn_status: "VOID",
                    txn_id: generate_payment_id,
                    card_country: order_details?.card_country,
                    payment_method: order_details?.payment_mode,
                    scheme: order_details?.scheme,
                    psp_id: order_details?.psp_id,
                    terminal_id: order_details?.terminal_id,
                  });
                } */
      }

      if (mode == "live") {
        await orderTransactionModel.add(order_txn);
      } else {
        await orderTransactionModel.test_txn_add(order_txn);
      }

      let txn_update = await merchantOrderModel.updateDynamic(
        { is_voided: 1 },
        { txn: req.bodyString("txn_id") },
        mode == "test" ? "test_order_txn" : "order_txn"
      );

      if (ni_capture.state == "REVERSED" || ni_capture.state == "AUTHORISED") {
        let order_update = {
          status: "VOID",
        };
        await merchantOrderModel.updateDynamic(
          order_update,
          {
            order_id: req.bodyString("p_order_id"),
          },
          mode == "test" ? "test_orders" : "orders"
        );
      }
      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "VOID",
        status: "APPROVED",
        dump: JSON.stringify(ni_capture),
      };
      if (mode == "live") {
        await orderTransactionModel.addResDump(resp_dump);
      } else {
        await orderTransactionModel.addTestResDump(resp_dump);
      }

      let res_obj = {};
      if (ni_capture.state == "REVERSED" || ni_capture.state == "AUTHORISED") {
        res_obj = {
          status: "VOID",
          p_order_id: order_txn.order_id,
          p_request_id: order_txn.txn,
          p_ref_id: ni_capture.reference,
          transaction_id: generate_payment_id,
          amount: order_txn.amount.toFixed(2),
          currency: order_txn.currency,
          date: moment(order_txn.created_at).format("DD/MM/YYYY"),
          // "3ds": ni_capture["3ds"],
        };
      } else {
        res_obj = {
          status: ni_capture._embedded["cnp:capture"][0].state,
          p_order_id: order_txn.order_id,
          p_request_id: order_txn.txn,
          p_ref_id: ni_capture.reference,
          transaction_id: generate_payment_id,
          amount: order_txn.amount.toFixed(2),
          currency: order_txn.currency,
          date: moment(order_txn.created_at).format("DD/MM/YYYY"),
          // "3ds": ni_capture["3ds"],
        };
      }

      let web_hook_res = {
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: generate_payment_id,
        psp_ref_id: ni_capture.orderReference,
        psp_txn_id: ni_capture.reference,
        transaction_id: generate_payment_id,
        status: "SUCCESS",
        status_code: remark,
        currency: order_details.currency,
        transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        amount: Number(req.body.amount.value).toFixed(2),
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
        merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
      });

      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
          let url = hook_info[0].notification_url;
          let webhook_res = await send_webhook_data(
            url,
            web_hook_res,
            hook_info[0].notification_secret
          );
        }
      }
      if (ni_capture.state == "REVERSED" || ni_capture.state == "AUTHORISED") {
        res
          .status(statusCode.ok)
          .send(
            response.successansmsg(res_obj, "Transaction successfully void.")
          );
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to initiate refund."));
      }
    } else {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to initiate refund."));
    }
  } catch (error) {
    console.log(error);
    winston.error(error);

    let resp_dump = {
      order_id: req.bodyString("order_id"),
      type: "VOID",
      status: "FAILED",
      dump: JSON.stringify(error.response.data),
    };
    if (mode == "live") {
      await orderTransactionModel.addResDump(resp_dump);
    } else {
      await orderTransactionModel.addTestResDump(resp_dump);
    }

    res
      .status(statusCode.ok)
      .send(response.errormsg(error.response.data.errors[0].message));
  }
};

const telr_refund_func = async (req, res) => {
  let txn_id = req.bodyString("txn_id");
  let mode = req?.credentials?.type || req?.body?.mode;
  console.log(req?.credentials?.type);
  console.log(req?.body?.mode);
  let txn_mode = mode == "live" ? 0 : 1;

  let txn_details = await orderTransactionModel.selectOneWithTwoOfOneStatus(
    "capture_no,amount,currency,payment_id,status,type,txn",
    { txn: txn_id },
    mode == "live" ? "order_txn" : "test_order_txn"
  );
  console.log("txn_details", txn_details);

  // return;

  if (
    txn_details &&
    (txn_details.type == "CAPTURE" ||
      txn_details.type == "SALE" ||
      txn_details.type == "PARTIALLY_CAPTURE") &&
    txn_details.status == "AUTHORISED"
  ) {
    let order_details = await orderTransactionModel.selectOne(
      "*",
      { order_id: req.bodyString("p_order_id") },
      mode == "live" ? "orders" : "test_orders"
    );
    let total_refunded_details =
      await orderTransactionModel.selectRefundedAmount(
        "*",
        { order_id: req.bodyString("p_order_id") },
        mode == "live" ? "order_txn" : "test_order_txn"
      );

    let check_amount = 0.0;
    let total_amount_refunded = total_refunded_details.amount;
    try {
      let req_amount = req.body.amount.value;

      let stringWithoutCommasAndDecimal = Number(
        req_amount.toString().split(",").join("")
      ).toFixed(2);
      req_amount = stringWithoutCommasAndDecimal;
      let amount_to_refund = req_amount;

      let total =
        parseFloat(total_amount_refunded) + parseFloat(amount_to_refund);
      let amount_captured = txn_details.amount;
      check_amount = amount_captured - total;
      let order_status = "REFUNDED";
      let txn_type = "REFUND";
      if (check_amount > 0) {
        order_status = "PARTIALLY_REFUNDED";
        txn_type = "PARTIALLY_REFUND";
      }

      let payload = {
        currency: txn_details.currency,
        amount: req_amount,
        tranref: txn_details.payment_id,
        type: "refund",
        classValue: "ecom",
        mode: txn_mode,
      };
      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("p_order_id"),
        },
        mode == "live" ? "orders" : "test_orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime",
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
        baseurl: credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      let telr_refund = await telr_sale.makeRefundRequest(
        payload,
        _terminalcred
      );

      let generate_payment_id = await helpers.make_sequential_no(
        mode == "live" ? "TXN" : "TST_TXN"
      );

      //code for calculate bonus on refund
      //let telr_refund = { status: 'A' };
      if (telr_refund.status === "A") {
        /*  refundReferrerBonus({
            amount: req_amount,
            currency: order_details?.currency,
            order_id: order_details?.order_id,
            merchant_id: order_details?.merchant_id,
            payment_id: generate_payment_id,
            order_status: order_status,
            txn_type: txn_type,
            void_status: "DEBIT",
          }); */
        // return res.status(statusCode.ok).send(
        //     response.successansmsg({}, "Refunded Successfully.")
        // );
      }

      if (telr_refund.status == "A") {
        let order_update = {
          status: order_status,
        };
        await merchantOrderModel.updateDynamic(
          order_update,
          {
            order_id: req.bodyString("p_order_id"),
          },
          mode == "live" ? "orders" : "test_orders"
        );

        let order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: txn_type,
          txn: generate_payment_id,
          status: "AUTHORISED",
          amount: req_amount,
          currency: txn_details.currency,
          payment_id: telr_refund.tranref,
          remark: req.bodyString("remark"),
          txn_ref_id: req.bodyString("txn_id"),
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "live") {
          await orderTransactionModel.add(order_txn);
        } else {
          await orderTransactionModel.test_txn_add(order_txn);
        }

        // transaction charge
        /*calculateTransactionCharges({
          amount: req_amount,
          currency: order_details?.currency,
          order_id: order_details?.order_id,
          merchant_id: order_details?.merchant_id,
          payment_id: generate_payment_id,
          order_status: order_status,
          txn_status: txn_type,
          transaction_id: generate_payment_id,
          card_country: order_details?.card_country,
          payment_method: order_details?.payment_mode,
          scheme: order_details?.scheme,
          psp_id: order_details?.psp_id,
          terminal_id: order_details?.terminal_id,
        }); */

        let resp_dump = {
          order_id: req.bodyString("p_order_id"),
          type: "REFUND",
          status: "AUTHORISED",
          dump: JSON.stringify(telr_refund),
        };
        if (mode == "test") {
          await orderTransactionModel.addTestResDump(resp_dump);
        } else {
          await orderTransactionModel.addResDump(resp_dump);
        }
        let res_obj = {
          order_status: "REFUNDED",
          p_order_id: order_txn.order_id,
          p_request_id: order_txn.txn,
          p_ref_id: enc_dec.cjs_encrypt(order_details.psp_id),
          txn_id: generate_payment_id,
          amount: req_amount,
          currency: txn_details.currency,
          date: moment(order_txn.created_at).format("DD/MM/YYYY"),
          // "3ds": {
          //     acsUrl: "",
          //     acsPaReq: "",
          //     acsMd: "",
          // },
        };

        let web_hook_res = {
          m_order_id: order_details.merchant_order_id,
          p_order_id: order_details.order_id,
          p_request_id: generate_payment_id,
          psp_ref_id: "",
          psp_txn_id: telr_refund.tranref,
          transaction_id: "",
          status: "SUCCESS",
          status_code: txn_type,
          currency: order_details.currency,
          transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          amount: req_amount,
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
          merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
        });

        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              web_hook_res,
              hook_info[0].notification_secret
            );
          }
        }
        if (order_details.origin == "PAYMENT LINK") {
          if (txn_type == "REFUND") {
            let updateQrPayment = await orderTransactionModel.updateDynamic(
              { payment_status: "REFUNDED" },
              { order_no: order_details.order_id },
              "qr_payment"
            );
          } else {
            let updateQrPayment =
              await orderTransactionModel.updateWithRawQuery(
                req_amount,
                order_details.order_id
              );
          }
        }
        res
          .status(statusCode.ok)
          .send(response.successansmsg(res_obj, "Refunded Successfully."));
      } else {
        let generate_payment_id = await helpers.make_sequential_no(
          mode == "live" ? "TXN" : "TST_TXN"
        );
        let order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: txn_type,
          txn: generate_payment_id,
          status: "FAILED",
          amount: req_amount,
          currency: txn_details.currency,
          remark: req.bodyString("remark"),
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        let resp_dump = {
          order_id: req.bodyString("p_order_id"),
          type: "REFUND",
          status: "FAILED",
          dump: JSON.stringify(telr_refund),
        };
        if (mode == "test") {
          await orderTransactionModel.addTestResDump(resp_dump);
        } else {
          await orderTransactionModel.addResDump(resp_dump);
        }
        res.status(statusCode.ok).send(response.errormsg(telr_refund.message));
      }
    } catch (error) {
      console.log(error);
      winston.error(error);

      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "REFUND",
        status: "FAILED",
        dump: JSON.stringify(error?.response?.data),
      };
      if (req.credentials.env == "test") {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
      }

      let errorMessage =
        "An error occurred while processing the webhook request";

      if (error.message.includes("Request failed with status code")) {
        errorMessage = error.message;
      } else if (error.message === "No response received from the server") {
        errorMessage = "Webhook server unable to receive or handle requests";
      }
      res
        .status(statusCode.ok)
        .send(
          response.errormsg(
            error.response.data.errors[0].message
              ? error.response.data.errors[0].message
              : errorMessage
          )
        );
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        response.errormsg("Invalid TXN ID or transaction is not captured yet.")
      );
  }
};

const ni_refund_func = async (req, res) => {
  let txn_id = req.bodyString("txn_id");
  let mode = req?.credentials?.type || req?.body?.mode;
  order_details = await orderTransactionModel.selectOne(
    "*",
    { order_id: req.bodyString("p_order_id") },
    mode == "test" ? "test_orders" : "orders"
  );

  console.log("mode", mode);

  let captured_data = await orderTransactionModel.selectOneWithTwoOfOneStatus(
    "capture_no,amount,currency,payment_id,status,type,order_reference_id",
    {
      txn: req.bodyString("txn_id"),
      status: "AUTHORISED",
    },
    mode == "test" ? "test_order_txn" : "order_txn"
  );

  console.log("captured_data", captured_data);

  if (
    captured_data &&
    (captured_data.type == "CAPTURE" ||
      captured_data.type == "SALE" ||
      captured_data.type == "PARTIALLY_CAPTURE") &&
    captured_data.status == "AUTHORISED"
  ) {
    try {
      let total_refunded_details =
        await orderTransactionModel.selectRefundedAmount(
          "*",
          { order_id: req.bodyString("p_order_id") },
          mode == "test" ? "test_order_txn" : "order_txn"
        );

      let check_amount = 0.0;
      let total_amount_refunded = parseInt(total_refunded_details.amount);
      let amount_to_refund = parseInt(req.body.amount.value);
      let total = total_amount_refunded + amount_to_refund;
      let amount_captured = captured_data.amount;
      check_amount = amount_captured - total;
      let order_status = "REFUNDED";
      let txn_type = "REFUND";
      if (check_amount > 0) {
        order_status = "PARTIALLY_REFUNDED";
        txn_type = "PARTIALLY_REFUND";
      }
      let capture_data = {
        orderNo: captured_data.order_reference_id,
        payment_id: captured_data.payment_id,
        capture_no: captured_data.capture_no,
        currency: req.body.amount.currencyCode,
        amount: parseFloat(req.body.amount.value),
      };

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("p_order_id"),
        },
        mode == "test" ? "test_orders" : "orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );

      if (!_getmid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Terminal Available"));
      }
      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }

      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl:
          mode == "test"
            ? credientials[_pspid.credentials_key].test_url
            : credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };

      var ni_capture = await orderRefund(capture_data, _terminalcred);
      if (ni_capture) {
        let order_update = {
          status: order_status,
        };
        await merchantOrderModel.updateDynamic(
          order_update,
          {
            order_id: req.bodyString("p_order_id"),
          },
          mode == "test" ? "test_orders" : "orders"
        );
        const uid = new ShortUniqueId({
          length: 10,
        });
        let generate_payment_id =
          mode == "test"
            ? await helpers.make_sequential_no("TST_TXN")
            : await helpers.make_sequential_no("TXN");
        let order_txn = {
          order_id: req.bodyString("p_order_id"),
          type: txn_type,
          txn: generate_payment_id,
          status:
            ni_capture._embedded["cnp:capture"][0].state == "SUCCESS"
              ? "AUTHORISED"
              : "FAILED",
          amount: req.body.amount.value,
          currency: req.body.amount.currencyCode,
          remark: req.bodyString("remark"),
          txn_ref_id: req.bodyString("transaction_id"),
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        // transaction charge
        /* calculateTransactionCharges({
           amount: amount_to_refund,
           currency: order_details?.currency,
           order_id: order_details?.order_id,
           merchant_id: order_details?.merchant_id,
           payment_id: generate_payment_id,
           order_status: order_status,
           txn_status: txn_type,
           transaction_id: generate_payment_id,
           card_country: order_details?.card_country,
           payment_method: order_details?.payment_mode,
           scheme: order_details?.scheme,
           psp_id: order_details?.psp_id,
           terminal_id: order_details?.terminal_id,
         }); */

        let resp_dump = {
          order_id: req.bodyString("p_order_id"),
          type: txn_type,
          status: "APPROVED",
          dump: JSON.stringify(ni_capture),
        };
        if (mode == "test") {
          await orderTransactionModel.addTestResDump(resp_dump);
        } else {
          await orderTransactionModel.addResDump(resp_dump);
        }

        let res_obj = {
          order_status: ni_capture._embedded["cnp:capture"][0].state,
          payment_id: order_txn.txn,
          order_id: order_txn.order_id,
          amount: order_txn.amount,
          currency: order_txn.currency,
          // "3ds": ni_capture["3ds"],
        };

        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: req.user.merchant_id || req.credentials.merchant_id,
        });

        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              res_obj,
              hook_info[0].notification_secret
            );
          }
        }
        if (order_details.origin == "PAYMENT LINK" && txn_type == "REFUND") {
          let updateQrPayment = await orderTransactionModel.updateDynamic(
            { payment_status: "REFUNDED" },
            { order_no: order_details.order_id },
            "qr_payment"
          );
        }
        res
          .status(statusCode.ok)
          .send(response.successansmsg(res_obj, "Refunded Successfully."));
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to initiate refund."));
      }
    } catch (error) {
      winston.error(error);
      console.log(error);
      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "REFUND",
        status: "FAILED",
        dump: JSON.stringify(error.response.data),
      };
      if (mode == "test") {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
      }

      res
        .status(statusCode.ok)
        .send(response.errormsg(error.response.data.errors[0].message));
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        response.errormsg("Invalid TXN ID or transaction is not captured yet.")
      );
  }
};

const telr_update_3ds_func = async () => {
  let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let telr_sale_request = req.body;
  let res_order_data = await orderTransactionModel.selectWithJoin(
    "t1.status,t1.order_id,t1.currency,t1.amount",
    {
      order_reference_id: req.bodyString("orderReference"),
    },
    "orders",
    "order_txn",
    "t1.order_id=t2.order_id"
  );
  if (res_order_data && res_order_data.status == "AWAIT_3DS") {
    let browser_token_enc = req.browser_fingerprint;
    if (!browser_token_enc) {
      let browser_token = {
        os: req.headers.os,
        browser: req.headers.browser,
        browser_version: req.headers["x-browser-version"],
        browser_fingerprint: req.headers.fp ? req.headers.fp : "",
        email: req.bodyString("email") ? req.bodyString("email") : "",
      };
      browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
    }

    const uid = new ShortUniqueId({
      length: 10,
    });
    let generate_payment_id = uid();
    let payment_id = await helpers.make_sequential_no("TXN");
    let order_txn_update = {
      txn: payment_id,
      order_id: res_order_data.order_id,
      currency: res_order_data.currency,
      amount: res_order_data.amount,
      type: res_order_data.action,
      status: telr_sale_request.state,
      created_at: updated_at,
    };
    await orderTransactionModel.add(order_txn_update);
    let order_update = {
      status: telr_sale_request.state,
      cardholderName: telr_sale_request.paymentMethod.cardholderName,
      expiry: telr_sale_request.paymentMethod.expiry,
      scheme: telr_sale_request.paymentMethod.name,
      cardType: telr_sale_request.paymentMethod.cardType,
      cardCategory: telr_sale_request.paymentMethod.cardCategory,
      pan: telr_sale_request.paymentMethod.pan,
      updated_at: updated_at,
    };
    await merchantOrderModel
      .updateDynamic(
        order_update,
        {
          order_id: res_order_data.order_id,
        },
        "orders"
      )
      .then((result) => {
        let res_obj = {
          order_status: telr_sale_request.state,
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc,
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(res_obj, "Successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  } else {
    res
      .status(statusCode.ok)
      .send(response.errormsg("Invalid order reference or already processed"));
  }
};

const ni_update_3ds_func = async (req, res) => {
  let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let ni_sale_request = req.body;
  let res_order_data = await orderTransactionModel.selectWithJoin(
    "t1.status,t1.order_id,t1.currency,t1.amount",
    {
      order_reference_id: req.bodyString("orderReference"),
    },
    "orders",
    "order_txn",
    "t1.order_id=t2.order_id"
  );
  if (res_order_data && res_order_data.status == "AWAIT_3DS") {
    let browser_token_enc = req.browser_fingerprint;
    if (!browser_token_enc) {
      let browser_token = {
        os: req.headers.os,
        browser: req.headers.browser,
        browser_version: req.headers["x-browser-version"],
        browser_fingerprint: req.headers.fp ? req.headers.fp : "",
        email: req.bodyString("email") ? req.bodyString("email") : "",
      };
      browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
    }
    let capture_no = "";
    if (ni_sale_request.state == "CAPTURED") {
      capture_no =
        ni_sale_request._embedded["cnp:capture"][0]._links.self.href.split(
          "/captures/"
        )[1];
    }

    const uid = new ShortUniqueId({
      length: 10,
    });
    let generate_payment_id = uid();
    let payment_id = await helpers.make_sequential_no("TXN");
    let order_txn_update = {
      txn: payment_id,
      order_id: res_order_data.order_id,
      currency: res_order_data.currency,
      amount: res_order_data.amount,
      type: "PAYMENT",
      status: ni_sale_request.state,
      capture_no: capture_no,
      created_at: updated_at,
    };
    await orderTransactionModel.add(order_txn_update);
    let order_update = {
      status: ni_sale_request.state,
      cardholderName: ni_sale_request.paymentMethod.cardholderName,
      expiry: ni_sale_request.paymentMethod.expiry,
      scheme: ni_sale_request.paymentMethod.name,
      cardType: ni_sale_request.paymentMethod.cardType,
      cardCategory: ni_sale_request.paymentMethod.cardCategory,
      pan: ni_sale_request.paymentMethod.pan,
      updated_at: updated_at,
    };
    await merchantOrderModel
      .updateDynamic(
        order_update,
        {
          order_id: res_order_data.order_id,
        },
        "orders"
      )
      .then((result) => {
        let res_obj = {
          order_status: ni_sale_request.state,
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc,
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(res_obj, "Successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  } else {
    res
      .status(statusCode.ok)
      .send(response.errormsg("Invalid order reference or already processed"));
  }
};

const capture = async (req, res, next) => {
  let mode = req?.credentials?.type || req?.body?.mode;
  let condition = {
    order_id: req.bodyString("p_order_id"),
  };

  let checkStatus = await orderTransactionModel.selectOne(
    "status,psp",
    condition,
    mode == "test" ? "test_orders" : "orders"
  );
  let checkPSP = checkStatus;

  // let checkTxnStatus = await orderTransactionModel.selectOne(
  //     "status",
  //     condition,
  //     "orders"
  // );
  if (checkStatus.status === "CAPTURED") {
    res
      .status(statusCode.ok)
      .send(response.errormsg("Order is already Captured."));
  } else {
    console.log(checkPSP);
    if (checkPSP) {
      switch (checkPSP.psp) {
        case "TELR":
          await telr_capture_func(req, res);
          break;
        case "NI":
          await ni_open_capture_func(req, res);
          break;
        case "PAYTABS":
          await PayTabsController.paytabs_capture(req, res);
          break;
        case "MPGS":
        case "MPGS-MEPSPAY":
        case "MPGS-PAYSHIFT":
        case "MPGS-GTI":
        case "MPGS-ADIB":
          await mpgs_capture(req, res);
          break;
        case "My Fatoorah":
          await myf_capture(req, res);
          break;
        case "fiserv":
          await fiserv_capture(req, res);
          break;
        default:
          res
            .status(statusCode.ok)
            .send(
              response.errormsg("Unable to capture transaction - Invalid PSP")
            );
      }
    } else {
      res
        .status(statusCode.ok)
        .send(
          response.errormsg(
            "Unable to capture transaction - Invalid PSP or Order id"
          )
        );
    }
  }
};

const order_telr_cancel = async (req, res, next) => {
  let mode = req?.credentials?.type || req?.body?.mode;
  let checkStatus = await orderTransactionModel.selectOne(
    "status,psp",
    {
      order_id: req.bodyString("p_order_id"),
    },
    mode == "test" ? "test_orders" : "orders"
  );
  // if (checkStatus?.status !== "CAPTURED" && checkStatus?.status!=='AUTHORISED' && checkStatus?.status!=='REFUNDED' && checkStatus?.status!=='PARTIALLY_REFUNDED') {
  //     res.status(statusCode.ok).send(
  //         response.errormsg("Order is not captured yet.")
  //     );
  // } else {
  if (checkStatus) {
    switch (checkStatus.psp) {
      case "TELR":
        await telr_void_func(req, res);
        break;
      case "NI":
        await ni_void_func(req, res);
        break;
      case "PAYTABS":
        await PayTabsController.paytabs_void(req, res);
        break;
      case "MPGS":
      case "MPGS-MEPSPAY":
      case "MPGS-PAYSHIFT":
      case "MPGS-GTI":
      case "MPGS-ADIB":
        await mpgs_void(req, res);
        break;
      case "My Fatoorah":
        await myf_void(req, res);
        break;
      case "fiserv":
        await fiserv_void(req, res);
        break;
      default:
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to void transaction - Invalid PSP"));
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        response.errormsg(
          "Unable to void transaction - Invalid PSP or Order Id"
        )
      );
  }
  // }
};

const open_telr_refund = async (req, res) => {
  let mode = req?.credentials?.type || req.body.mode;
  let checkStatus = await orderTransactionModel.selectOne(
    "status,psp",
    {
      order_id: req.bodyString("p_order_id"),
    },
    mode == "test" ? "test_orders" : "orders"
  );

  // if (checkStatus.status === "REFUNDED") {
  //     res.status(statusCode.ok).send(
  //         response.errormsg("Order is already Refunded.")
  //     );
  // } else {
  if (checkStatus) {
    console.log(`check status`);
    console.log(checkStatus.psp);
    switch (checkStatus.psp) {
      case "TELR":
        await telr_refund_func(req, res);
        break;
      case "NI":
        await ni_refund_func(req, res);
        break;
      case "PAYTABS":
        await PayTabsController.paytabs_refund(req, res);
        break;
      case "MPGS":
      case "MPGS-GTI":
      case "MPGS-ADIB":
      case "MPGS-PAYSHIFT":
      case "MPGS-MEPSPAY":
        await mpgs_refund(req, res);
        break;
      case "My Fatoorah":
        console.log(`inside the switch`);
        await myf_refund(req, res);
        break;
      case "fiserv":
        await fiserv_refund(req, res);
        break;
      default:
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to void transaction - Invalid PSP"));
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        response.errormsg(
          "Unable to void transaction - Invalid PSP or Order id"
        )
      );
  }
  // }
};

var MerchantOrder = {
  create: async (req, res) => {
    const logs = [];
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create initiated`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );

    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
      browser_version: req.headers["x-browser-version"],
    };
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    let billing_details = req.body.data.billing_details;
    let shipping_details = req.body.data.shipping_details;
    let urls = req.body?.data.urls;
    let mid_data = await helpers.get_mid_by_merchant_id(
      req?.credentials?.merchant_id
    );
    const uid = new ShortUniqueId({
      length: 10,
    });
    let order_id = await helpers.make_sequential_no("ORD");

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : helpers.make_sequential_no ${order_id}`
    );

    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      env: req.credentials.type,
      merchant_id: req.credentials.merchant_id,
      email: customer_details.email,
    };
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "live";
    } else {
      mode = "live";
    }
    let token = accessToken(token_payload);

    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : accessToken ${token}`
    );

    let ins_body = {
      merchant_id: req.credentials.merchant_id,
      mcc: req.credentials.mcc_id,
      mcc_category: req.credentials.mcc_cat_id,
      super_merchant: req.credentials.super_merchant_id,
      customer_name: customer_details.name,
      customer_email: customer_details.email,
      customer_code: customer_details.code,
      customer_mobile: customer_details.mobile,
      billing_address_line_1: billing_details.address_line1
        ? billing_details.address_line1
        : "",
      billing_address_line_2: billing_details.address_line2
        ? billing_details.address_line2
        : "",
      billing_city: billing_details.city ? billing_details.city : "",
      billing_pincode: billing_details.pin ? billing_details.pin : "",
      billing_province: billing_details.province
        ? billing_details.province
        : "",
      billing_country: billing_details.country ? billing_details.country : "",
      shipping_address_line_1: shipping_details.address_line1
        ? shipping_details.address_line1
        : "",
      shipping_address_line_2: shipping_details.address_line2
        ? shipping_details.address_line2
        : "",
      shipping_city: shipping_details.city ? shipping_details.city : "",
      shipping_country: shipping_details.country
        ? shipping_details.country
        : "",
      shipping_province: shipping_details.province
        ? shipping_details.province
        : "",
      shipping_pincode: shipping_details.pin ? shipping_details.pin : "",
      amount: order_details.amount,
      amount_left: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      description: order_details?.description ? order_details?.description : "",
      other_description: order_details?.description
        ? order_details?.description
        : "",
      status: status,
      origin: "API",
      order_id: order_id,
      browser: client.browser,
      browser_version: client.browser_version,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
      action: req.body.data.action,
      merchant_order_id: order_details?.m_order_id
        ? order_details?.m_order_id
        : "",
      success_url: urls?.success ? urls?.success : mid_data[0]?.success_url,
      cancel_url: urls?.cancel ? urls?.cancel : mid_data[0]?.cancel_url,
      failure_url: urls?.failure ? urls?.failure : mid_data[0]?.failure_url,
    };
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : initiate mode ${mode}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add with data ${JSON.stringify(
        ins_body
      )}`
    );

    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        let res_order_details = {
          status: status,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount: order_details.currency + " " + order_details.amount,
          payment_link:
            process.env.PAYMENT_URL + "initiate/" + order_id + "/" + token,
          iframe_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "?origin=iframe",
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(res_order_details)}`
        );
        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };

        let log_is = await order_logs.update_logs_data(
          {
            order_id: order_details.order_id,
          },
          logs_payload
        );
        res.status(statusCode.ok).send(res_order_details);
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });

    let logs_payload = {
      order_id: order_id,
      activity: JSON.stringify(logs),
    };
    let log_is = await order_logs
      .add(logs_payload, "order_logs")
      .then((result) => {})
      .catch((err) => {
        winston.error(err);
      });
  },
  open_create: async (req, res) => {
    let classType = req.body.data.class;
    if (classType == "cont") {
      return createContineousOrder(req, res);
    }

    const logs = [];
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create initiated`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );

    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
      browser_version: req.headers["x-browser-version"],
    };
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    let billing_details = req.body.data.billing_details;
    let shipping_details = req.body.data.shipping_details;
    const uid = new ShortUniqueId({
      length: 10,
    });
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "test";
    } else {
      mode = "live";
    }
    let order_id = await helpers.make_sequential_no(
      mode == "live" ? "ORD" : "TST_ORD"
    );
    let payment_token = req.body.data.payment_token;
    let urls = req.body.data.urls;
    let mid_data = await helpers.get_mid_by_merchant_id(
      req?.credentials?.merchant_id,
      order_details.currency,
      mode
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : helpers.make_sequential_no ${order_id}`
    );

    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      env: req.credentials.type,
      merchant_id: req.credentials.merchant_id,
      email: customer_details.email,
    };

    let token = accessToken(token_payload);

    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : accessToken ${token}`
    );

    let ins_body = {
      merchant_id: req.credentials.merchant_id,
      mcc: req.credentials.mcc_id,
      mcc_category: req.credentials.mcc_cat_id,
      super_merchant: req.credentials.super_merchant_id,
      customer_name: customer_details.name,
      customer_email: customer_details.email,
      customer_code: customer_details.code,
      customer_mobile: customer_details.mobile,
      billing_address_line_1: billing_details.address_line1
        ? billing_details.address_line1
        : "",
      billing_address_line_2: billing_details.address_line2
        ? billing_details.address_line2
        : "",
      billing_city: billing_details.city ? billing_details.city : "",
      billing_pincode: billing_details.pin ? billing_details.pin : "",
      billing_province: billing_details.province
        ? billing_details.province
        : "",
      billing_country: billing_details.country ? billing_details.country : "",
      shipping_address_line_1: shipping_details.address_line1
        ? shipping_details.address_line1
        : "",
      shipping_address_line_2: shipping_details.address_line2
        ? shipping_details.address_line2
        : "",
      shipping_city: shipping_details.city ? shipping_details.city : "",
      shipping_country: shipping_details.country
        ? shipping_details.country
        : "",
      shipping_province: shipping_details.province
        ? shipping_details.province
        : "",
      shipping_pincode: shipping_details.pin ? shipping_details.pin : "",
      amount: order_details.amount,
      amount_left: order_details.amount,
      currency: order_details.currency,
      order_amount:order_details.amount,
      order_currency:order_details.currency,
      // return_url: order_details.return_url,
      description: order_details?.description,
      other_description: order_details?.description,
      status: status,
      origin: "REMOTE",
      order_id: order_id,
      browser: client.browser,
      ip: client.ip,
      os: client.os,
      browser_version: client.browser_version,
      created_at: created_at,
      updated_at: updated_at,
      action: req.body.data.action,
      capture_method: req.body.data.capture_method
        ? req.body.data.capture_method
        : "MANUAL",
      merchant_order_id: order_details.m_order_id,
      payment_token_id: payment_token,
      success_url: urls?.success ? urls?.success : mid_data[0]?.success_url,
      cancel_url: urls?.cancel ? urls?.cancel : mid_data[0]?.cancel_url,
      failure_url: urls?.failure ? urls?.failure : mid_data[0]?.failure_url,
      merchant_customer_id: customer_details.m_customer_id,
    };

    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : initiate mode ${mode}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add with data ${JSON.stringify(
        ins_body
      )}`
    );
    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        let p_request_id = await helpers.make_sequential_no("REQ");
        let order_req = {
          merchant_id: req.credentials.merchant_id,
          order_id: order_id,
          request_id: p_request_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, "generate_request_id");

        let res_order_details = {
          status: "SUCCESS",
          status_code: "00",
          message: "Order created",
          // token: token,
          p_order_id: order_id,
          m_order_id: order_details.m_order_id,
          p_request_id: p_request_id,
          order_creation_date: moment(created_at).format("DD/MM/YYYY HH:mm:ss"),
          amount: order_details.currency + " " + order_details.amount,
          payment_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "/" +
            mode,
          iframe_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "/" +
            mode +
            "?origin=iframe",
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(res_order_details)}`
        );
        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs.add(logs_payload, "order_logs");
        res.status(statusCode.ok).send(res_order_details);
      })
      .catch(async (error) => {
        winston.error(error);

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs.add(logs_payload, "order_logs");
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  createOrderAuth: async (req, res) => {
    let ni_auth = await ni_sale.orderAuth(req.body);
    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
    };

    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    const uid = new ShortUniqueId({
      length: 10,
    });
    let order_id = await helpers.make_sequential_no("ORD");
    let generate_payment_id = uid();
    let payment_id = await helpers.make_sequential_no("TXN");
    let status = "Created";
    let token_payload = {
      order_id: order_id,
      amount: ni_auth.amount.value,
      currency: ni_auth.amount.currencyCode,
      return_url: "https://www.localhost/",
      //return_url: order_details.return_url ? order_details.return_url: "https://www.localhost/" ,
      env: req.credentials.type,
      merchant_id: req.credentials.merchant_id,
    };
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "live";
    } else {
      mode = "live";
    }
    let token = accessToken(token_payload);
    let ins_body = {
      merchant_id: req.credentials.merchant_id,
      mcc: req.credentials.mcc_id,
      mcc_category: req.credentials.mcc_cat_id,
      super_merchant: req.credentials.super_merchant_id,
      return_url: "https://www.localhost/",
      status: ni_auth.state,
      order_id: order_id,
      browser: client.browser,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
    };
    merchantOrderModel
      .add(ins_body, mode)
      .then((result) => {
        if (ni_auth) {
          let order_txn = {
            status: ni_auth.state,
            txn: payment_id,
            payment_id: ni_auth.reference,
            order_reference_id: ni_auth.orderReference,
            order_id: order_id,
            amount: ni_auth.amount.value,
            currency: ni_auth.amount.currencyCode,
            created_at: created_at,
          };
          orderTransactionModel.add(order_txn);
        }
        let res_order_details = {
          status: ni_auth.state,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount: ni_auth.amount.currencyCode + " " + ni_auth.amount.value,
          payment_link:
            process.env.PAYMENT_URL + "initiate/" + order_id + "/" + token,
          iframe_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "?origin=iframe",
          "3ds": ni_auth["3ds"],
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(res_order_details, "Auth successfully."));
        //res.status(statusCode.ok).send(res_order_details);
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  get: async (req, res) => {
    const data = {
      merchant_details: {},
      order_details: {},
      prefer_lang: "",
    };
    const mode = req.bodyString("mode");
    let table_name_ord = mode === "test" ? "test_orders" : "orders";
    let merchant = await merchantOrderModel.selectOne(
      "merchant_id",
      {
        order_id: req.bodyString("order_id"),
      },
      table_name_ord
    );
    let merchant_id = merchant.merchant_id;
    let table_name = "master_merchant";
    let selection =
      "theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language,font_name";
    merchantOrderModel
      .selectOne(
        selection,
        {
          id: merchant_id,
        },
        table_name
      )
      .then(async (result) => {
        let psp_apple_pay = await merchantOrderModel.selectApplePayPSP(
          merchant_id
        );
        let mer_details = await merchantOrderModel.selectOne(
          "company_name,link_tc,register_business_country",
          {
            merchant_id: merchant_id,
          },
          "master_merchant_details"
        );
        let paymentMethod = await SubmerchantModel.selectPaymentMethod(
          merchant_id,
          mode
        );
        let availableMobileWallet =
          await SubmerchantModel.selectAvailableMobileWallet(
            merchant.merchant_id,
            mode
          );
        let pspCountry = await helpers.getMTNMOMOCountry();
        if(result?.icon){
           result.icon = process.env.STATIC_URL + "/static/files/" + result?.icon;
        }else{
           result.icon = ``;
        }
         if(result?.logo){
           result.logo = process.env.STATIC_URL + "/static/files/" + result?.icon;
        }else{
           result.logo = ``;
        }
        result.we_accept_image =
          process.env.STATIC_URL + "/static/files/" + result?.we_accept_image;
        result.merchant_name = mer_details ? mer_details.company_name : "";
        result.use_logo_instead_icon = result.use_logo;
        result.branding_language = enc_dec.cjs_encrypt(
          result.branding_language,
          (result.tc_link = mer_details?.link_tc ? mer_details.link_tc : "")
        );
        result.mode = mode;
        result.payment_method = paymentMethod;
        result.register_business_country = pspCountry
          ? enc_dec.cjs_encrypt(pspCountry)
          : "";
        data.merchant_details = result;
        data.availableMobileWallet = availableMobileWallet;

        if (req.body?.retry == 1) {
          let payload = {};
          let fetchLastTryData = await helpers.fetchLastTryData({
            order_id: req.bodyString("order_id"),
            mode: req.bodyString("mode"),
          });

          payload.card = await enc_dec.dynamic_decryption(
            fetchLastTryData.card,
            fetchLastTryData.cipher_id
          );
          payload.expiry_month = fetchLastTryData.expiry.split("/")[0];
          payload.expiry_year = fetchLastTryData.expiry.split("/")[1];
          payload.card_holder_name = fetchLastTryData.card_holder_name;
          data.retry_card = payload;
        }
        result.apple_pay_psp = psp_apple_pay;
        let table_name = "orders";
        if (req.bodyString("browserFP") == "") {
          data.pay_with_vault = 0;
        }
        let image_path = server_addr + ":4008/static/images/";
        let company_details = await helpers.company_details({
          id: 1,
        });
        let tc = await helpers.get_terms_and_condition();
        let title = await helpers.get_title();
        result.company_details = {
          fav_icon: image_path + company_details.fav_icon,
          logo: image_path + company_details.company_logo,
          letter_head: image_path + company_details.letter_head,
          footer_banner: image_path + company_details.footer_banner,
          title: title,
          terms_and_condition: tc,
        };

        let selection =
          "order_id,customer_name as name,customer_email as email,customer_mobile as mobile,customer_code as code,amount,currency,status,return_url,payment_token_id as payment_token,created_at";
        merchantOrderModel
          .selectOne(
            selection,
            {
              order_id: req.bodyString("order_id"),
            },
            table_name_ord
          )
          .then(async (result_1) => {
            // result_1.env = req.order.env;
            data.order_details = result_1;

            const query = `SELECT created_at FROM pg_test_orders WHERE order_id = '${result_1?.order_id}' and created_at > NOW() - INTERVAL 20 MINUTE;`;
            console.log("🚀 ~ .then ~ query:", query);
            const checktime20min = await merchantOrderModel.order_query(query);
            data.order_details["is20minExceed"] =
              checktime20min.length === 0 ? 1 : 0;

            let card_details = {
              card_expiry: "",
              last_4_digit: "",
              card_nw: "",
            };
            if (
              result_1.payment_token != "" &&
              result_1.payment_token != null
            ) {
              card_details =
                (await merchantOrder.selectOne(
                  "card_expiry,last_4_digit,card_nw",
                  {
                    id: enc_dec.cjs_decrypt(result_1.payment_token),
                  },
                  "customers_cards"
                )) || card_details;
            }
            data.card_details = card_details;
            let customer_email = result_1.email;
            let fcm_fetch = await merchantOrderModel.selectOne(
              "fcm_id",
              {
                email: customer_email,
              },
              "customers"
            );

            if (
              typeof fcm_fetch?.fcm_id == "undefined" ||
              fcm_fetch?.fcm_id == ""
            ) {
              data.pay_with_vault = 0;
            } else {
              data.pay_with_vault = 1;
            }
            if (customer_email == "") {
              data.prefer_lang = enc_dec.cjs_encrypt("1");
            } else {
              let table_name = "customers";
              let selection = "prefer_lang";
              let lang_resp = await merchantOrderModel.selectOne(
                selection,
                {
                  email: customer_email,
                },
                table_name
              );
              if (lang_resp)
                data.prefer_lang = enc_dec.cjs_encrypt(lang_resp.prefer_lang);
              else data.prefer_lang = enc_dec.cjs_encrypt("1");
            }

            res
              .status(statusCode.ok)
              .send(successdatamsg(data, "Details fetch successfully."));
          })
          .catch((error) => {
            console.log("error in order details", error);
            winston.error(error);

            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((error) => {
        console.log("error in order details22", error);
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  get_details: async (req, res) => {
    console.log(req.body);
    let data = {
      merchant_details: {},
      order_details: {},
      prefer_lang: "",
    };
    let table_name_ord = "orders";
    if (req.body.mode == "test") {
      table_name_ord = "test_orders";
    }
    let order_data = await merchantOrderModel.selectOne(
      "merchant_id",
      {
        order_id: req.bodyString("order_id"),
      },
      table_name_ord
    );

    let merchant_id = order_data.merchant_id;
    let table_name = "master_merchant";
    let selection =
      "id,theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language,font_name";
    merchantOrderModel
      .selectOne(
        selection,
        {
          id: merchant_id,
        },
        table_name
      )
      .then(async (result) => {
        let mer_details = await merchantOrderModel.selectOne(
          "company_name,link_tc",
          {
            merchant_id: merchant_id,
          },
          "master_merchant_details"
        );
        let paymentMethod = await SubmerchantModel.selectPaymentMethod(
          merchant_id
        );
        result.merchant_id = enc_dec.cjs_encrypt(result.id);
        result.icon = process.env.STATIC_URL + "/static/files/" + result?.icon;
        result.logo = process.env.STATIC_URL + "/static/files/" + result?.logo;
        result.we_accept_image =
          process.env.STATIC_URL + "/static/files/" + result?.we_accept_image;
        result.merchant_name = mer_details ? mer_details.company_name : "";
        result.use_logo_instead_icon = result.use_logo;
        result.branding_language = enc_dec.cjs_encrypt(
          result.branding_language,
          (result.tc_link = mer_details?.link_tc ? mer_details.link_tc : "")
        );
        result.payment_method = paymentMethod;
        data.merchant_details = result;
        let table_name = "orders";
        if (req.bodyString("browserFP") == "") {
          data.pay_with_vault = 0;
        }
        let image_path = server_addr + "/static/images/";
        let company_details = await helpers.company_details({
          id: 1,
        });
        let tc = await helpers.get_terms_and_condition();
        let title = await helpers.get_title();
        result.company_details = {
          fav_icon: image_path + company_details.fav_icon,
          logo: image_path + company_details.company_logo,
          letter_head: image_path + company_details.letter_head,
          footer_banner: image_path + company_details.footer_banner,
          title: title,
          terms_and_condition: tc,
        };

        let selection =
          "order_id,order_id as p_order_id,customer_name as name,customer_email as email,customer_mobile as mobile,,customer_code as code,amount,currency,status,return_url,payment_token_id as payment_token";
        merchantOrderModel
          .selectOne(
            selection,
            {
              order_id: req.bodyString("order_id"),
            },
            table_name_ord
          )
          .then(async (result_1) => {
            result_1.env = "live";
            data.order_details = result_1;
            let card_details = {
              card_expiry: "",
              last_4_digit: "",
              card_nw: "",
            };
            if (
              result_1.payment_token != "" &&
              result_1.payment_token != null
            ) {
              card_details =
                (await merchantOrder.selectOne(
                  "card_expiry,last_4_digit,card_nw",
                  {
                    id: enc_dec.cjs_decrypt(result_1.payment_token),
                  },
                  "customers_cards"
                )) || card_details;
            }
            data.card_details = card_details;
            let customer_email = result_1.email;
            let fcm_fetch = await merchantOrderModel.selectOne(
              "fcm_id",
              {
                email: customer_email,
              },
              "customers"
            );

            if (
              typeof fcm_fetch?.fcm_id == "undefined" ||
              fcm_fetch?.fcm_id == ""
            ) {
              data.pay_with_vault = 0;
            } else {
              data.pay_with_vault = 1;
            }
            //Date:17/01/2025
            // if (customer_email == "") {
            //   data.prefer_lang = enc_dec.cjs_encrypt("1");
            // } else {
            //   let table_name = "customers";
            //   let selection = "prefer_lang";
            //   let lang_resp = await merchantOrderModel.selectOne(
            //     selection,
            //     {
            //       email: customer_email,
            //     },
            //     table_name
            //   );
            //   if (lang_resp)
            //     data.prefer_lang = enc_dec.cjs_encrypt(lang_resp.prefer_lang);
            //   else data.prefer_lang = enc_dec.cjs_encrypt("1");
            // }
            data.page_language = req.bodyString("page_language");
            res
              .status(statusCode.ok)
              .send(successdatamsg(data, "Details fetch successfully."));
          })
          .catch((error) => {
            winston.error(error);

            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  support_orderDetails: async (req, res) => {
    const { order_id } = req.body;
    // if (!order_id) {
    //     return res
    //         .status(statusCode.internalError)
    //         .send(response.errormsg(`Order Id Required`));
    // }
    try {
      merchantOrder
        .selectOne(
          "*",
          {
            order_id: order_id,
          },
          "orders"
        )
        .then(async (result) => {
          let order_txn = await TransactionsModel.selectSpecificDynamic(
            "order_id, txn, type,payment_id, status, res_dump, amount, currency, created_at",
            { order_id: order_id },
            "order_txn"
          );

          let send_res = [];
          // let update_order_txn = [];
          // if(order_txn.length > 0){
          //     for (let element of order_txn) {
          //         element?.created_at = moment(
          //             element?.created_at
          //         ).format("DD-MM-YYYY HH:mm");
          //         update_order_txn.push(element);
          //     }
          // }

          let val = result;

          let trans_history = [];
          let data_created = {
            order_id: val?.order_id ? val?.order_id : "",
            txn: "-",
            status: "CREATED",
            type: "",
            currency: val?.currency ? val?.currency : "",
            amount: val?.amount ? val?.amount.toFixed(2) : "",
            created_at: moment(result?.created_at).format("DD-MM-YYYY hh:mm"),
          };
          trans_history.push(data_created);
          let amount_capture = 0;
          if (order_txn.length > 0) {
            for (let val of order_txn) {
              let temp = {
                order_id: val?.order_id ? val?.order_id : "",
                txn: val?.txn ? val?.txn : "",
                type: val?.type ? val?.type : "",
                status: val?.status ? val?.status : "",
                currency: val?.currency ? val?.currency : "",
                amount: val?.amount ? val?.amount.toFixed(2) : "",
                created_at: val?.created_at ? val?.created_at : "",
              };
              trans_history.push(temp);
              if (temp.type == "CAPTURE" || temp.type == "PARTIALLY_CAPTURE") {
                amount_capture =
                  parseFloat(amount_capture) + parseFloat(temp.amount);
              }
            }
          }
          const filteredData = trans_history.filter(
            (item) => item.status !== "AWAIT_3DS"
          );

          let trans_data = await helpers.get_trans_data(order_id);
          let new_res = {
            data_id: result?.id ? enc_dec.cjs_encrypt(result?.id) : "",
            m_order_id: result?.merchant_order_id
              ? result?.merchant_order_id
              : "",
            p_order_id: result?.order_id ? result?.order_id : "",
            p_request_id: trans_data[0]?.last_request_id
              ? trans_data[0]?.last_request_id
              : "",
            psp_ref_id: trans_data[0]?.last_psp_ref_id
              ? trans_data[0]?.last_psp_ref_id
              : "",
            transaction_id: result?.payment_id ? result?.payment_id : "",
            psp_txn_id: trans_data[0]?.last_psp_txn_id
              ? trans_data[0]?.last_psp_txn_id
              : "",
            transaction_date: result?.updated_at
              ? moment(result?.updated_at).format("DD-MM-YYYY hh:mm:ss")
              : "",
            transaction_status: result?.status ? result?.status : "",
            status_code: result?.status ? result?.status : "",
            status: result?.status == "FAILED" ? "FAILED" : "SUCCESS",
            currency: result?.currency ? result?.currency : "",
            amount: result?.amount ? result?.amount.toFixed(2) : "",
            psp: result?.psp ? result?.psp : "",
            payment_method: result?.payment_mode ? result?.payment_mode : "",
            payment_method_id: result?.pan ? result?.pan : "",
            is_oneclick: "", // missing field
            is_retry: "", // missing field
            is_cascade: "", // missing field
            m_customer_id: result?.merchant_customer_id
              ? enc_dec.cjs_encrypt(result?.merchant_customer_id)
              : "",
            customer_email: result?.customer_email
              ? result?.customer_email
              : "",
            customer_mobile_code: result?.customer_code
              ? result?.customer_code
              : "",
            customer_mobile: result?.customer_mobile
              ? result?.customer_mobile
              : "",
            customer_country: result?.billing_country
              ? result?.billing_country
              : "",
            m_payment_token: result?.card_id ? result?.card_id : "",
            payment_method_data: {
              scheme: result?.scheme ? result?.scheme : "",
              card_country: result?.card_country ? result?.card_country : "",
              card_type: result?.cardType ? result?.cardType : "",
              masked_pan: result?.pan ? result?.pan : "",
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: result?.merchant_id
              ? await helpers.formatNumber(result?.merchant_id)
              : "",

            transaction_history: filteredData,
            amount_remaining_for_capture: result.amount - amount_capture,
          };

          let merchant_name = await helpers.get_sub_merchant_name_by_id(
            result?.merchant_id
          );
          let merchant_email = await helpers.get_sub_merchant_email_by_id(
            result?.merchant_id
          );
          let format_merchant_id = await helpers.formatNumber(
            result?.merchant_id
          );
          let super_merchant = await helpers.get_super_merchant_id(
            result?.merchant_id
          );
          result.merchant_name = merchant_name ? merchant_name : "";
          result.merchant_email = merchant_email ? merchant_email : "";
          result.de_merchant_id = format_merchant_id ? format_merchant_id : "";
          result.super_merchant_id = super_merchant ? super_merchant : "";
          result.new_res = new_res;

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                result,
                "Details details fetched successfully."
              )
            );
        });
    } catch (error) {
      winston.error(error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  open_get: async (req, res) => {
    let new_data = {
      customer_details: "",
      billing_details: "",
      shipping_details: "",
      order_details: "",
    };

    let table_name =
      req?.credentials?.type == "test" ? "test_orders" : "orders";

    let selection = "*";
    merchantOrderModel
      .selectOne(
        selection,
        {
          order_id: req.bodyString("order_id"),
          merchant_id: req.credentials.merchant_id,
        },
        table_name
      )
      .then(async (result_1) => {
        let shipping_details = {
          address_line_1: result_1?.shipping_address_line_1
            ? result_1?.shipping_address_line_1
            : "",
          address_line_2: result_1?.shipping_address_line_2
            ? result_1?.shipping_address_line_2
            : "",
          city: result_1?.shipping_city ? result_1?.shipping_city : "",
          country: result_1?.shipping_country ? result_1?.shipping_country : "",
          province: result_1?.shipping_province
            ? result_1?.shipping_province
            : "",
          pincode: result_1?.shipping_pincode ? result_1?.shipping_pincode : "",
        };
        let billing_details = {
          address_line_1: result_1?.billing_address_line_1
            ? result_1?.billing_address_line_1
            : "",
          address_line_2: result_1?.billing_address_line_2
            ? result_1?.billing_address_line_2
            : "",
          city: result_1?.billing_city ? result_1?.billing_city : "",
          country: result_1?.billing_country ? result_1?.billing_country : "",
          province: result_1?.billing_province
            ? result_1?.billing_province
            : "",
          pincode: result_1?.billing_pincode ? result_1?.billing_pincode : "",
        };
        let order_details = {
          order_id: result_1?.order_id ? result_1?.order_id : "",
          merchant_order_id: result_1?.merchant_order_id
            ? result_1?.merchant_order_id
            : "",
          amount: result_1?.amount ? result_1?.amount : "",
          currency: result_1?.currency ? result_1?.currency : "",
          return_url: result_1?.return_url ? result_1?.return_url : "",
          status: result_1?.status ? result_1?.status : "",
        };

        let customer_details = {
          name: result_1?.customer_name ? result_1?.customer_name : "",
          email: result_1?.customer_email ? result_1?.customer_email : "",
          code: result_1?.customer_code ? result_1?.customer_code : "",
          mobile: result_1?.customer_mobile ? result_1?.customer_mobile : "",
        };

        new_data.billing_details = billing_details;
        new_data.shipping_details = shipping_details;
        new_data.order_details = order_details;
        new_data.customer_details = customer_details;

        try {
          let charges_result = await charges_invoice_models.get_order_charges(
            req.bodyString("order_id")
          );
          console.log("🚀 ~ .then ~ charges_result:", charges_result);
          let charges = {
            fee: 0.0,
            tax: 0.0,
            calculated_fee: 0.0,
            applied_fee: 0.0,
            applied_tax: 0.0,
            net_amount: 0.0,
          };
          if (charges_result?.length > 0) {
            let changesObj = charges_result[0];
            charges = {
              fee:
                parseFloat(changesObj.sale_rate_fix_charge) +
                parseFloat(changesObj.sale_rate_percent_charge),
              tax: changesObj.sale_rate_tax,
              calculated_fee: changesObj.calculated_fee.toFixed(2),
              applied_fee: changesObj.applied_fee.toFixed(2),
              applied_tax: changesObj.applied_tax.toFixed(2),
              net_amount: parseFloat(
                changesObj.amount -
                  (parseFloat(changesObj.sale_rate_fix_charge) +
                    parseFloat(changesObj.sale_rate_percent_charge) +
                    parseFloat(changesObj.sale_rate_tax))
              ),
            };
          }
          new_data.transaction_chargers = charges;
        } catch (error) {
          console.log("🚀 ~ .then ~ error:", error);
        }

        res
          .status(statusCode.ok)
          .send(successdatamsg(new_data, "Details fetch successfully."));
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  pay: async (req, res) => {
    let logs;
    let order_table = "orders";
    let txn_table = "order_txn";
    let txn_response_dump = "txn_response_dump";
    let transaction_mode = req.bodyString("env");
    if (transaction_mode == "test") {
      order_table = "test_orders";
      txn_table = "test_order_txn";
      txn_response_dump = "test_txn_response_dump";
      logs = await order_logs.get_test_log_data(req.bodyString("order_id"));
    } else {
      logs = await order_logs.get_log_data(req.bodyString("order_id"));
    }

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
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
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

    var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    const uid = new ShortUniqueId({
      length: 10,
    });
    let generate_payment_id = uid();
    let payment_id = await helpers.make_sequential_no(
      transaction_mode == "test" ? "TST_TXN" : "TXN"
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : helpers.make_sequential_no ${payment_id}`
    );

    let status = "CAPTURED";
    let card_no = "";
    let enc_customer_id = "";
    let card_details;
    let full_card_no = "";
    let name_on_card = "";
    let expiry_date = "";
    if (req.bodyString("card_id") != "") {
      let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
      card_details = await merchantOrderModel.selectOne(
        "*",
        {
          id: card_id,
        },
        "customers_cards"
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : fetch card_details of id = ${req.bodyString("card_id")}`
      );

      card_no = card_details.last_4_digit;
      enc_customer_id = card_details.cid;
      full_card_no = await enc_dec.dynamic_decryption(
        card_details.card_number,
        card_details.cipher_id
      );
      name_on_card = card_details.name_on_card;
      expiry_date = card_details.card_expiry.split("/").reverse().join("-");
    } else {
      full_card_no = req.bodyString("card");
      card_no = req.bodyString("card").slice(-4);

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : get card no : **** **** **** ${card_no}`
      );

      // enc_customer_id = req.customer_id
      //     ? enc_dec.cjs_encrypt(req.customer_id)
      //     : "";
      enc_customer_id = req.customer_id;
      name_on_card = req.body.form_name;
      expiry_date = req.body.expiry_date.split("/").reverse().join("-");
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

      console.log("browser_token", browser_token);

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
      ip: req.headers.ip,
      ip_country: req.headers.ipcountry,
      card_no: card_no,
      cid: enc_customer_id,
      card_id: card_id,
      browser_fingerprint: browser_token_enc,
      updated_at: updated_at,
      // payment_mode: req.card_details.card_type,
      card_country: req.card_details.country,
      cardType: req.card_details.card_type,
      scheme: req.card_details.card_brand,
      pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
        full_card_no.length - 4
      )}`,
      cardholderName: name_on_card,
      expiry: expiry_date,
    };

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.updateDynamic with data ${JSON.stringify(
        order_data
      )}`
    );

    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        order_table
      )
      .then(async (result) => {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(result)}`
        );

        let res_order_data = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: req.bodyString("order_id"),
          },
          order_table
        );

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : merchantOrderModel.selectOne ${JSON.stringify(res_order_data)}`
        );
        // request id table entry
        let p_request_id = await helpers.make_sequential_no(
          transaction_mode == "live" ? "REQ" : "TST_REQ"
        );
        let merchant_id = await helpers.get_data_list(
          "merchant_id",
          order_table,
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
          transaction_mode == "test"
            ? "test_generate_request_id"
            : "generate_request_id"
        );
        // getting action from db
        let action = await order_logs.get_order_action(
          req.bodyString("order_id"),
          order_table
        );

        let ni_sale_req = {
          action: action,
          value: res_order_data.amount,
          order_id: req.body.order_id,
          card_no: req.body.card,
          expiry_date: req.body.expiry_date.split("/").reverse().join("-"),
          cvv: req.body.cvv,
          cardholderName: req.body.name,
          currency: res_order_data.currency,
        };
        if (req.bodyString("card_id")) {
          ni_sale_req.card_no = await enc_dec.dynamic_decryption(
            card_details.card_number,
            card_details.cipher_id
          );
          ni_sale_req.expiry_date = card_details.card_expiry
            .split("/")
            .reverse()
            .join("-");
          ni_sale_req.cardholderName = card_details.name_on_card;
        }

        let masked_data = {
          ...ni_sale_req,
        };
        masked_data.cvv = "****";
        masked_data.card_no = `**** **** **** ${ni_sale_req.card_no.slice(-4)}`;
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : ni_sale.orderSale with data ${JSON.stringify(masked_data)}`
        );

        const _terminalids = await merchantOrderModel.selectOne(
          "terminal_id",
          {
            order_id: req.bodyString("order_id"),
          },
          order_table
        );
        const _getmid = await merchantOrderModel.selectOne(
          "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime",
          {
            terminal_id: _terminalids.terminal_id,
          },
          "mid"
        );

        if (!_getmid) {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("No Terminal Available"));
        }

        const autoCaptureHours = parseInt(_getmid.autoCaptureWithinTime);
        // Get the current date and time using moment.
        const currentDate = moment();
        // Add autoCaptureHours to the current date to get the new date and time.
        const newDateTime = currentDate.add(autoCaptureHours, "hours");
        // Format the newDateTime as "YYYY-MM-DD HH:mm"
        const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

        let voidWithinDatetime = "";

        if (_getmid.allowVoid == 1) {
          const voidWithinTimeHours = parseInt(_getmid?.voidWithinTime);
          const newVoidDateTime = currentDate.add(voidWithinTimeHours, "hours");
          // Format the newDateTime as "YYYY-MM-DD HH:mm"
          voidWithinDatetime = newVoidDateTime.format("YYYY-MM-DD HH:mm");
        }

        const _pspid = await merchantOrderModel.selectOne(
          "*",
          {
            id: _getmid.psp_id,
          },
          "psp"
        );
        if (!_pspid) {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("No Psp Available"));
        }

        const _terminalcred = {
          MID: _getmid.MID,
          password: _getmid.password,
          baseurl:
            transaction_mode == "test"
              ? credientials.ni.test_url
              : credientials.ni.base_url,
          psp_id: _getmid.psp_id,
          name: _pspid.name,
        };

        // save card details for retry pay
        let card_req = {
          order_id: req.body.order_id,
          request: JSON.stringify(req.body),
          card_country: req.card_details.country,
          card_country_code: req.card_details.country_code,
          card_brand: req.card_details.card_brand,
          card_type: req.card_details.card_type,
          scheme: req.card_details.card_brand,
          card_number: `${req.body.card.substring(
            0,
            6
          )}****${req.body.card.substring(req.body.card.length - 4)}`,
        };
        await helpers.common_add(card_req, "order_paycard_details");
        let ni_order_sale;
        try {
          let card_proxy = enc_dec.encrypt_card(ni_sale_req.card_no);
          let checkForCardProxyInSystem = await helpers.fetchLastTryData({
            card_proxy: card_proxy,
          });

          // let checkForHardBlock = await helpers.checkIfHardDeclined({status_code:['51'],card_proxy:card_proxy});
          // if(checkForHardBlock){
          //   throw('Transaction is declined');
          // }
          if (
            _getmid.is3DS == 1 &&
            checkForCardProxyInSystem?.["3ds_version"] == 0
          ) {
            throw "card is non 3ds and non 3ds card are not allowed";
          }
          ni_order_sale = await ni_sale.orderSale(ni_sale_req, _terminalcred);
          console.log("ni_order_sale", ni_order_sale);
        } catch (error) {
          // console.log(error);
          winston.error(error);

          let order_update_failed = {
            cardholderName: ni_sale_req.cardholderName,
            status: "FAILED",
            psp: "NI",
            payment_id: payment_id,
          };
          await merchantOrderModel.updateDynamic(
            order_update_failed,
            {
              order_id: req.bodyString("order_id"),
            },
            order_table
          );
          let response_category_failed;
          if (error == "card is non 3ds and non 3ds card are not allowed") {
            response_category_failed = await helpers.get_error_category(
              "144",
              "paydart",
              "FAILED"
            );
          } else {
            response_category_failed = await helpers.get_error_category(
              "01",
              "ni",
              "FAILED"
            );
          }
          //  console.log("error_message",error?.response?.data?.errors?.[0]?.message);

          helpers.updateOrderCycle(res_order_data?.order_id, transaction_mode);

          let order_txn = {
            status: "FAILED",
            psp_code: response_category_failed?.response_code,
            paydart_category: response_category_failed?.category,
            remark:
              error?.response?.data?.errors?.[0]?.message != undefined
                ? error?.response?.data?.errors?.[0]?.message
                : response_category_failed?.response_details,
            txn: payment_id,
            type: res_order_data.action.toUpperCase(),
            payment_id: "",
            order_reference_id: "",
            capture_no: "",
            order_id: res_order_data.order_id,
            amount: res_order_data.amount,
            currency: res_order_data.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          if (transaction_mode == "live") {
            await orderTransactionModel.add(order_txn);
          } else {
            await orderTransactionModel.test_txn_add(order_txn);
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
            remark: error?.response?.data?.errors?.[0]?.message,
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
          // let txnFailedLog = {
          //   order_id:res_order_data.order_id,
          //   activity:'Transaction failed using NI',
          //   status:1,
          //   mode:transaction_mode
          // }
          // await helpers.addTransactionFailedLogs(txnFailedLog);
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: res_order_data.order_id,
            mode: transaction_mode,
          });

          let txnFailedLog = {
            order_id: res_order_data.order_id,
            terminal: res_order_data?.terminal_id,
            req: JSON.stringify(req.body),
            res: JSON.stringify({}),
            psp: "NI",
            status_code: response_category_failed?.response_code,
            description: response_category_failed?.response_details,
            activity: "Transaction failed with NI",
            status: 1,
            mode: transaction_mode,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "0",
            txn: payment_id,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };

          await helpers.addTransactionFailedLogs(txnFailedLog);
          if (logs) {
            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let logs_payload = {
              activity: JSON.stringify(logs),
              updated_at: updated_at,
            };
            let log_is = await order_logs.update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload,
              transaction_mode
            );
          }
          return res
            .status(statusCode.ok)
            .send(response.errorMsgWithData("Transaction failed.", res_obj));
        }

        let fraudStatus = false;
        // if (
        //   ni_order_sale.state == "AUTHORISED" ||
        //   ni_order_sale.state == "CAPTURED"
        // ) {
        //   // Add 3DS code here
        //   const fraudCheckBody = {
        //     fraudRequestId: res_order_data.fraud_request_id,
        //     order_id: res_order_data.order_id,
        //     is3ds: 0,
        //   };
        //   const fraudServiceRequest = await fraudService.make3dsFraudCheck(
        //     fraudCheckBody
        //   );
        //   console.log("fraudServiceRequest", fraudServiceRequest);
        //   fraudStatus = fraudServiceRequest.status === "fail" ? true : false;
        //   fraudResponse = fraudServiceRequest;
        // }

        if (
          _getmid.is3DS == 1 &&
          (ni_order_sale.state == "AUTHORISED" ||
            ni_order_sale.state == "CAPTURED")
        ) {
          res_order_data.psp = "NI";
          let reject_obj = await rejectNon3DS(
            res_order_data,
            ni_order_sale,
            req.body,
            browser_token_enc,
            transaction_mode
          );
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: res_order_data.order_id,
            mode: transaction_mode,
          });
          let txnFailedLog = {
            order_id: res_order_data.order_id,
            terminal: res_order_data?.terminal_id,
            req: JSON.stringify(req.body),
            res: JSON.stringify(ni_order_sale),
            psp: "NI",
            status_code: reject_obj.new_res.status_code,
            description: reject_obj.new_res.remark,
            activity: "Transaction failed with NI",
            status: 1,
            mode: transaction_mode,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "0",
            txn: payment_id,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          await helpers.addTransactionFailedLogs(txnFailedLog);
          res
            .status(statusCode.ok)
            .send(successdatamsg(reject_obj, "Transaction Rejected."));
        } else {
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : ni_sale response ${JSON.stringify(ni_order_sale)}`
          );

          if (ni_order_sale && ni_order_sale.state != "FAILED") {
            let capture_no = "";
            // let payment_no = "";
            let payment_id_txn = "";
            // let order_no = "";
            let order_reference_id = "";
            if (
              ni_order_sale.state != "AWAIT_3DS" &&
              ni_order_sale.state != "AUTHORISED"
            ) {
              capture_no =
                ni_order_sale?._embedded[
                  "cnp:capture"
                ][0]._links?.self?.href.split("/captures/")[1];
            }

            if (ni_order_sale.state === "AUTHORISED") {
              payment_id_txn = await ni_order_sale.reference;
              order_reference_id = await ni_order_sale.orderReference;
            }
            let response_category = await helpers.get_error_category(
              "00",
              "ni",
              ni_order_sale.state == "CAPTURED"
                ? "AUTHORISED"
                : ni_order_sale.state
            );
            let order_txn = {
              status:
                ni_order_sale.state == "CAPTURED"
                  ? "AUTHORISED"
                  : ni_order_sale.state,
              psp_code: "00",
              paydart_category: response_category?.category,
              remark: "",
              txn: payment_id,
              type: res_order_data.action.toUpperCase(),
              payment_id: ni_order_sale.reference,
              order_reference_id: ni_order_sale.orderReference,
              capture_no: capture_no,
              order_id: res_order_data.order_id,
              amount: res_order_data.amount,
              currency: res_order_data.currency,
              created_at: updated_at,
            };

            if (transaction_mode == "live") {
              await orderTransactionModel.add(order_txn);
            } else {
              await orderTransactionModel.test_txn_add(order_txn);
            }
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: res_order_data.order_id,
              mode: transaction_mode,
            });

            if (ni_order_sale?.state != "AWAIT_3DS") {
              let txnFailedLog = {
                order_id: res_order_data.order_id,
                terminal: res_order_data?.terminal_id,
                req: JSON.stringify(req.body),
                res: JSON.stringify(ni_order_sale),
                psp: "NI",
                status_code: "",
                description: "",
                activity: "Transaction Successful with NI",
                status: 0,
                mode: transaction_mode,
                card_holder_name: temp_card_details.card_holder_name,
                card: temp_card_details.card,
                expiry: temp_card_details.expiry,
                cipher_id: temp_card_details.cipher_id,
                card_proxy: temp_card_details.card_proxy,
                "3ds_version": "0",
                txn: payment_id,
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              };
              await helpers.addTransactionFailedLogs(txnFailedLog);
            }

            if (ni_order_sale?.state === "CAPTURED") {
              let _nistatus = ni_order_sale?.state;
              let txn_type = res_order_data.action.toUpperCase();
              // check if Subscription Payment
              await manageSubscription(
                res_order_data,
                _nistatus,
                updated_at,
                ni_order_sale?.orderReference,
                ni_order_sale?.savedCard?.cardToken,
                req.body.env
              );
              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.updateDynamic`
              );
              // subscription code end

              if (_nistatus !== "FAILED" && _nistatus === "CAPTURED") {
                /*Referrer commission started*/
                calculateAndStoreReferrerCommission({
                  amount: res_order_data?.amount,
                  currency: res_order_data?.currency,
                  order_id: res_order_data?.order_id,
                  merchant_id: res_order_data?.merchant_id,
                  payment_id: payment_id,
                  order_status: _nistatus,
                  txn_status: txn_type,
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
                  //change param
                  payment_id: payment_id,
                  order_status: _nistatus,
                  txn_status: txn_type,
                  txn_id: payment_id,
                };
                // transaction charge
                // calculateTransactionCharges(transaction_and_feature_data);

                // transaction feature charges
                // calculateFeatureCharges(transaction_and_feature_data);
              }
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : orderTransactionModel.add with data ${JSON.stringify(
                order_txn
              )}`
            );

            let orderupdate = {
              status: ni_order_sale?.state,
              psp: "NI",
              payment_id: payment_id,
              expiry: ni_order_sale?.savedCard?.expiry,
              saved_card_for_recurring: JSON.stringify(
                ni_order_sale?.savedCard
              ),
              "3ds": "0",
              "3ds_status": ni_order_sale?.["3ds"]?.["eciDescription"],
              // payment_mode: req.bodyString("payment_mode"),
            };

            console.log("orderupdate");
            console.log(orderupdate);

            if (ni_order_sale.state === "AUTHORISED") {
              orderupdate.capture_datetime = capture_datetime;
            }
            if (_getmid.allowVoid == 1) {
              orderupdate.voidWithinDatetime = voidWithinDatetime;
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
              order_table
            );
          }
          let res_order_data1 = await merchantOrderModel.selectOne(
            "psp,payment_mode,pan",
            {
              order_id: req.bodyString("order_id"),
            },
            order_table
          );
          let res_obj = {};
          let new_res = {};
          if (
            ni_order_sale.state === "AUTHORISED" ||
            ni_order_sale.state == "CAPTURED"
          ) {
            let response_category = await helpers.get_error_category(
              "00",
              "ni",
              ni_order_sale.state
            );
            new_res = {
              m_order_id: res_order_data.merchant_order_id,
              p_order_id: res_order_data.order_id,
              p_request_id: p_request_id,
              psp_ref_id: ni_order_sale.orderReference,
              psp_txn_id: ni_order_sale.reference,
              transaction_id: payment_id,
              status: ni_order_sale.state === "FAILED" ? "FAILED" : "SUCCESS",
              status_code: "00",
              remark: "",
              paydart_category: response_category.category,
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
                ni_order_sale.state === "FAILED"
                  ? res_order_data.failure_url
                  : res_order_data.success_url,
              payment_method_data: {
                scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
                card_country: res_order_data?.card_country
                  ? res_order_data?.card_country
                  : "",
                card_type: res_order_data?.cardType
                  ? res_order_data?.cardType
                  : "",
                mask_card_number: res_order_data1?.pan
                  ? res_order_data1?.pan
                  : "",
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: res_order_data?.merchant_id
                ? await helpers.formatNumber(res_order_data?.merchant_id)
                : "",
            };
            res_obj = {
              order_status: ni_order_sale.state,
              reference: ni_order_sale.reference,
              order_reference: ni_order_sale.orderReference,
              payment_id: payment_id,
              order_id: res_order_data.order_id,
              amount: res_order_data.amount,
              currency: res_order_data.currency,
              token: browser_token_enc,
              "3ds": ni_order_sale["3ds"] ? ni_order_sale["3ds"] : [],
              new_res: new_res,
            };
            /* Channel Payment Start */
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
                payment_status: "CAPTURED",
                transaction_date: updated_at,
              };

              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
                  qr_data
                )}`
              );

              await merchantOrderModel.updateDynamic(
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

            if (invoice_payment) {
              let inv_data = {
                status: "Closed",
                payment_date: updated_at,
              };

              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : invModel.updateDynamic with data ${JSON.stringify(
                  inv_data
                )}`
              );

              invModel.updateDynamic(
                inv_data,
                {
                  id: invoice_payment.id,
                },
                "inv_invoice_master"
              );
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.selectOne`
            );

            // check if Subscription Payment
            // manageSubscription(
            //   res_order_data,
            //   ni_order_sale.state,
            //   updated_at,
            //   payment_id
            // );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.updateDynamic`
            );
            // subscription code end

            /*Referrer commission started*/
            // if (ni_order_sale.state !== "FAILED") {
            //   calculateAndStoreReferrerCommission({
            //     amount: res_order_data?.amount,
            //     currency: res_order_data?.currency,
            //     order_id: res_order_data?.order_id,
            //     merchant_id: res_order_data?.merchant_id,
            //     payment_id: payment_id,
            //   });
            // }
            /*Referrer commission ends*/

            // let subs_payment = await merchantOrderModel.selectOne(
            //     "id",
            //     {
            //         order_no: req.bodyString("order_id"),
            //     },
            //     "subs_payment"
            // );
            // if (subs_payment) {
            //     let subs_data = {
            //         payment_status: status,
            //         transaction_date: updated_at,
            //     };

            //     logs.push(
            //         `${moment().format(
            //             "DD/MM/YYYY HH:mm:ss.SSS"
            //         )} : merchantOrderModel.updateDynamic`
            //     );

            //     await merchantOrderModel
            //         .updateDynamic(
            //             subs_data,
            //             {
            //                 id: subs_payment.id,
            //             },
            //             "subs_payment"
            //         )
            //         .then(async (result) => {
            //             let subscription_id =
            //                 await helpers.get_data_list(
            //                     "subscription_id",
            //                     "subs_payment",
            //                     {
            //                         id: subs_payment.id,
            //                     }
            //                 );

            //             let subs_id =
            //                 subscription_id[0].subscription_id;

            //             // update code for the subscription
            //             if (ni_order_sale.state !== "FAILED") {
            //                 await merchantOrderModel
            //                     .updateDynamic({ status: 1 }, { subscription_id: subs_id }, "subscription")

            //                 let subs_data = await helpers.get_data_list(
            //                     "*",
            //                     "subscription",
            //                     {
            //                         subscription_id: subs_id,
            //                     }
            //                 );

            //                 const currentDate =
            //                     moment().format("YYYY-MM-DD");
            //                 let payload = subs_data[0];

            //                 let next_data = await helpers.generateTable(
            //                     currentDate,
            //                     payload?.payment_interval,
            //                     payload?.plan_billing_frequency,
            //                     payload?.terms,
            //                     payload?.subscription_id,
            //                     payload?.email,
            //                     payment_id,
            //                     payload?.initial_payment_amount,
            //                     payload?.final_payment_amount,
            //                     payload?.plan_billing_amount
            //                 );

            //                 for (let val of next_data) {
            //                     val.order_id =
            //                         req.bodyString("order_id");
            //                     await merchantOrderModel
            //                         .addDynamic(
            //                             val,
            //                             "subscription_recurring"
            //                         )
            //                         .then((result) => { })
            //                         .catch((error) => {
            //                         });
            //                 }
            //             }
            //         })
            //         .catch((error) => {
            //         });
            // }
            /* Channel Payment Update End */
          } else {
            let is3ds = false;
            let result_3ds_obj;
            if (ni_order_sale?.["3ds2"]) {
              let three_ds2_url =
                ni_order_sale?._links?.["cnp:3ds2-authentication"]?.href ||
                ni_order_sale?._links?.["cnp:3ds2-challenge-response"]?.href;
              let request_data_3ds2 = {
                deviceChannel: "BRW",
                threeDSCompInd: "Y",
                notificationURL:
                  process.env.PAYMENT_URL +
                  "result/ni_3ds?order_no=" +
                  res_order_data.order_id +
                  "&mode=" +
                  transaction_mode,
                browserInfo: {
                  browserAcceptHeader: "application/json",
                  browserJavaEnabled: true,
                  browserLanguage: "en",
                  browserTZ: "0",
                  browserUserAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36",
                  browserColorDepth: "30",
                  browserScreenHeight: "1055",
                  browserScreenWidth: "1680",
                  browserJavascriptEnabled: true,
                  browserIP: "106.213.81.149",
                  challengeWindowSize: "05",
                },
              };
              let ds_3_data = await ni_sale.get_3ds2_details(
                three_ds2_url,
                request_data_3ds2,
                _terminalcred
              );
              console.log(`ds_3_data`);
              console.log(ds_3_data);
              if (ds_3_data.state == "CAPTURED") {
                await manageSubscription(
                  res_order_data,
                  ds_3_data.state,
                  updated_at,
                  ds_3_data?.reference,
                  ds_3_data?.savedCard?.cardToken,
                  transaction_mode
                );
              }

              if (
                ds_3_data.state == "CAPTURED" ||
                ds_3_data.state == "AUTHORISED" ||
                ds_3_data.state == "PURCHASED"
              ) {
                is3ds = false;
                /* START */
                let p_request_id = await helpers.make_sequential_no(
                  transaction_mode == "live" ? "REQ" : "TST_REQ"
                );
                let merchant_id = await helpers.get_data_list(
                  "merchant_id",
                  order_table,
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
                  transaction_mode == "test"
                    ? "test_generate_request_id"
                    : "generate_request_id"
                );

                let capture_no = "";
                // let payment_no = "";
                let payment_id_txn = "";
                // let order_no = "";
                let order_reference_id = "";
                if (
                  ds_3_data.state != "AWAIT_3DS" &&
                  ds_3_data.state != "AUTHORISED"
                ) {
                  capture_no =
                    ds_3_data?._embedded[
                      "cnp:capture"
                    ][0]._links?.self?.href.split("/captures/")[1];
                }

                if (ds_3_data.state === "AUTHORISED") {
                  payment_id_txn = await ds_3_data.reference;
                  order_reference_id = await ds_3_data.orderReference;
                }
                let response_category = await helpers.get_error_category(
                  "00",
                  "ni",
                  ds_3_data.state == "CAPTURED" ? "AUTHORISED" : ds_3_data.state
                );
                let order_txn = {
                  status:
                    ds_3_data.state == "CAPTURED"
                      ? "AUTHORISED"
                      : ds_3_data.state,
                  psp_code: "00",
                  paydart_category: response_category?.category,
                  remark: "",
                  txn: payment_id,
                  type: res_order_data.action.toUpperCase(),
                  payment_id: ds_3_data.reference,
                  order_reference_id: ds_3_data.orderReference,
                  capture_no: capture_no,
                  order_id: res_order_data.order_id,
                  amount: res_order_data.amount,
                  currency: res_order_data.currency,
                  created_at: updated_at,
                };

                if (transaction_mode == "live") {
                  await orderTransactionModel.add(order_txn);
                } else {
                  await orderTransactionModel.test_txn_add(order_txn);
                }

                let orderupdate = {
                  status: ds_3_data?.state,
                  psp: "NI",
                  payment_id: payment_id,
                  expiry: ds_3_data?.savedCard?.expiry,
                  "3ds": 0,
                  "3ds_status": ds_3_data?.authResponse?.resultMessage,
                  // payment_mode: req.bodyString("payment_mode"),
                };

                if (ds_3_data.state === "AUTHORISED") {
                  orderupdate.capture_datetime = capture_datetime;
                }
                if (_getmid.allowVoid == 1) {
                  orderupdate.voidWithinDatetime = voidWithinDatetime;
                }

                await merchantOrderModel.updateDynamic(
                  orderupdate,
                  {
                    order_id: req.bodyString("order_id"),
                  },
                  order_table
                );
                /* END */
              }
              if (ds_3_data.state == "FAILED") {
                console.log(`ds 3 data and ni sale request`);
                console.log(ds_3_data);
                console.log(ni_order_sale);
                let response_category1 = await helpers.get_error_category(
                  ni_order_sale?.authResponse?.resultCode
                    ? ni_order_sale?.authResponse?.resultCode
                    : "01",
                  "ni",
                  ds_3_data.state
                );
                console.log(response_category1);
                new_res = {
                  m_order_id: res_order_data.merchant_order_id,
                  p_order_id: res_order_data.order_id,
                  p_request_id: p_request_id,
                  psp_ref_id: ds_3_data.orderReference,
                  psp_txn_id: "",
                  transaction_id: payment_id,
                  status: ds_3_data.state === "FAILED" ? "FAILED" : "SUCCESS",
                  status_code: ni_order_sale?.authResponse?.resultCode
                    ? ni_order_sale?.authResponse?.resultCode
                    : "01",
                  remark: response_category1?.response_details,
                  paydart_category: response_category1?.category,
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
                    ni_order_sale.state === "FAILED"
                      ? res_order_data.failure_url
                      : res_order_data.success_url,
                  payment_method_data: {
                    scheme: res_order_data?.scheme
                      ? res_order_data?.scheme
                      : "",
                    card_country: res_order_data?.card_country
                      ? res_order_data?.card_country
                      : "",
                    card_type: res_order_data?.cardType
                      ? res_order_data?.cardType
                      : "",
                    mask_card_number: res_order_data1?.pan
                      ? res_order_data1?.pan
                      : "",
                  },
                  apm_name: "",
                  apm_identifier: "",
                  sub_merchant_identifier: res_order_data?.merchant_id
                    ? await helpers.formatNumber(res_order_data?.merchant_id)
                    : "",
                };

                res_obj = {
                  order_status: ds_3_data.state,
                  reference: ds_3_data.reference,
                  order_reference: ds_3_data.orderReference,
                  payment_id: payment_id,
                  order_id: res_order_data.order_id,
                  amount: res_order_data.amount,
                  currency: res_order_data.currency,
                  token: browser_token_enc,
                  new_res: new_res,
                  "3ds": is3ds
                    ? result_3ds_obj
                    : ni_order_sale["3ds"]
                    ? ni_order_sale["3ds"]
                    : "",
                  three_ds_2_enabled: is3ds,
                };
                let orderupdate = {
                  status: "FAILED",
                  psp: "NI",
                  payment_id: payment_id,
                  "3ds": 0,
                  "3ds_status": "Not Authenticated / Unavailable",
                  // payment_mode: req.bodyString("payment_mode"),
                };
                await merchantOrderModel.updateDynamic(
                  orderupdate,
                  { order_id: res_order_data?.order_id },
                  order_table
                );
                let txn_status = res_order_data?.action.toUpperCase();

                const order_txn_update = {
                  txn: payment_id,
                  order_id: res_order_data?.order_id || "",
                  currency: res_order_data?.currency || "",
                  amount: res_order_data?.amount || "",
                  type: txn_status,
                  status: "FAILED",
                  psp_code: "",
                  paydart_category: response_category1.category,
                  remark: response_category1.response_details,
                  capture_no: "",
                  created_at: updated_at,
                  payment_id: ds_3_data?.reference || "",
                  order_reference_id: ds_3_data?.orderReference || "",
                };
                if (transaction_mode == "live") {
                  await merchantOrder.addDynamic(order_txn_update, "order_txn");
                } else {
                  await merchantOrder.addDynamic(
                    order_txn_update,
                    "test_order_txn"
                  );
                }

                let temp_card_details = await helpers.fetchTempLastCard({
                  order_id: res_order_data.order_id,
                  mode: transaction_mode,
                });

                let txnFailedLog = {
                  order_id: res_order_data.order_id,
                  terminal: res_order_data?.terminal_id,
                  req: JSON.stringify(req.body),
                  res: JSON.stringify(ds_3_data),
                  psp: "NI",
                  status_code: "",
                  description: "",
                  activity: "Transaction failed with NI",
                  status: 1,
                  mode: transaction_mode,
                  card_holder_name: temp_card_details.card_holder_name,
                  card: temp_card_details.card,
                  expiry: temp_card_details.expiry,
                  cipher_id: temp_card_details.cipher_id,
                  txn: payment_id,
                  card_proxy: temp_card_details.card_proxy,
                  created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                };

                await helpers.addTransactionFailedLogs(txnFailedLog);

                // add webhook and email logic here starts
                console.log(`before email sending`);
                ee.once("ping", async (arguments) => {
                  // Sending mail to customers and merchants about transaction

                  let order_id = req.bodyString("order_id");
                  let qb = await pool.get_connection();
                  let merchant_and_customer_transaction_response;
                  try {
                    merchant_and_customer_transaction_response = await qb
                      .select(
                        "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                      )
                      .from(config.table_prefix + order_table + " o")
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
                    console.log(qb.last_query());
                  } catch (error) {
                    console.error("Database query failed:", error);
                  } finally {
                    qb.release();
                  }

                  let mail_details =
                    merchant_and_customer_transaction_response[0];
                  console.log(`mail details`);
                  console.log(mail_details);
                  mail_details.logo = mail_details?.logo
                    ? process.env.STATIC_URL +
                      "/static/files/" +
                      mail_details?.logo
                    : "";
                  let transaction_date_time = new Date(
                    mail_details?.updated_at
                  );
                  mail_details.updated_at = moment(
                    transaction_date_time
                  ).format("DD-MM-YYYY HH:mm");
                  let mail_response = await mailSender.CustomerTransactionMail(
                    mail_details
                  );
                  let merchant_mail_response =
                    await mailSender.MerchantTransactionMail(mail_details);
                });
                ee.emit("ping", {
                  message: "hello",
                });
                // web  hook starting
                let hook_info = await helpers.get_data_list(
                  "*",
                  "webhook_settings",
                  {
                    merchant_id: res_order_data.merchant_id,
                  }
                );
                let web_hook_res = Object.assign({}, res_obj.new_res);
                delete web_hook_res?.return_url;
                delete web_hook_res?.paydart_category;
                if (hook_info[0]) {
                  if (
                    hook_info[0].enabled === 0 &&
                    hook_info[0].notification_url != ""
                  ) {
                    let url = hook_info[0].notification_url;
                    let webhook_res = await send_webhook_data(
                      url,
                      web_hook_res,
                      hook_info[0].notification_secret
                    );
                  }
                }
                // end of webhook and email logic here

                // add in generate request id table

                // add in generate request id ends here

                // add generate request id ends here

                // add 3ds version update details

                // add 3ds versiond update details end here

                return res
                  .status(statusCode.ok)
                  .send(
                    response.errorMsgWithData("Transaction failed.", res_obj)
                  );
              }
              if (ds_3_data.state == "AWAIT_3DS") {
                result_3ds_obj = ds_3_data?.["3ds2"];
                is3ds = true;
                let update_order_3ds_url =
                  await merchantOrderModel.updateDynamic(
                    {
                      "3ds2_url":
                        ni_order_sale?._links?.["cnp:3ds2-challenge-response"]
                          ?.href ||
                        ni_order_sale?._links?.["cnp:3ds2-challenge-response"]
                          ?.href,
                    },
                    { order_id: res_order_data.order_id },
                    order_table
                  );
              }
            }

            let response_category = await helpers.get_error_category(
              ni_order_sale?.authResponse?.resultCode,
              "ni",
              ni_order_sale.state || ds_3_data.state
            );

            new_res = {
              m_order_id: res_order_data.merchant_order_id,
              p_order_id: res_order_data.order_id,
              p_request_id: p_request_id,
              psp_ref_id: ni_order_sale.orderReference,
              psp_txn_id: "",
              transaction_id: payment_id,
              status: ni_order_sale.state === "FAILED" ? "FAILED" : "SUCCESS",
              // status_code: ni_order_sale?.authResponse?.resultCode ? ni_order_sale?.authResponse?.resultCode : "",
              status_code: ni_order_sale?.authResponse?.resultCode
                ? ni_order_sale?.authResponse?.resultCode
                : "",
              remark: response_category?.response_details,
              paydart_category: response_category?.category,
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
                ni_order_sale.state === "FAILED"
                  ? res_order_data.failure_url
                  : res_order_data.success_url,
              payment_method_data: {
                scheme: res_order_data?.scheme ? res_order_data?.scheme : "",
                card_country: res_order_data?.card_country
                  ? res_order_data?.card_country
                  : "",
                card_type: res_order_data?.cardType
                  ? res_order_data?.cardType
                  : "",
                mask_card_number: res_order_data1?.pan
                  ? res_order_data1?.pan
                  : "",
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: res_order_data?.merchant_id
                ? await helpers.formatNumber(res_order_data?.merchant_id)
                : "",
            };

            res_obj = {
              order_status: ni_order_sale.state,
              reference: ni_order_sale.reference,
              order_reference: ni_order_sale.orderReference,
              payment_id: payment_id,
              order_id: res_order_data.order_id,
              amount: res_order_data.amount,
              currency: res_order_data.currency,
              token: browser_token_enc,
              new_res: new_res,
              "3ds": is3ds
                ? result_3ds_obj
                : ni_order_sale["3ds"]
                ? ni_order_sale["3ds"]
                : "",
              three_ds_2_enabled: is3ds,
            };
          }

          let response_dump = {
            order_id: res_order_data.order_id,
            type: res_order_data.action.toUpperCase(),
            status: ni_order_sale.state,
            dump: JSON.stringify(ni_order_sale),
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump ${JSON.stringify(
              response_dump
            )}`
          );
          if (transaction_mode == "live") {
            await orderTransactionModel.addResDump(response_dump);
          } else {
            await orderTransactionModel.addTestResDump(response_dump);
          }

          // Adding event base charges update in payment

          ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            if (
              ni_order_sale.state == "AUTHORISED" ||
              ni_order_sale.state == "CAPTURED"
            ) {
              let order_id = req.bodyString("order_id");
              let qb = await pool.get_connection();
              let merchant_and_customer_transaction_response;
              try {
                merchant_and_customer_transaction_response = await qb
                  .select(
                    "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                  )
                  .from(config.table_prefix + order_table + " o")
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
                console.log(`mail query`);
                console.log(qb.last_query());
              } catch (error) {
                console.error("Database query failed:", error);
              } finally {
                qb.release();
              }

              let mail_details = merchant_and_customer_transaction_response[0];
              console.log("mail_details");
              console.log(mail_details);
              mail_details.logo = mail_details?.logo
                ? process.env.STATIC_URL + "/static/files/" + mail_details?.logo
                : "";
              let transaction_date_time = new Date(mail_details?.updated_at);
              mail_details.updated_at = moment(transaction_date_time).format(
                "DD-MM-YYYY HH:mm"
              );
              let mail_response = await mailSender.CustomerTransactionMail(
                mail_details
              );
              let merchant_mail_response =
                await mailSender.MerchantTransactionMail(mail_details);
            }
          });
          ee.emit("ping", {
            message: "hello",
          });

          // event base charges update end
          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload,
              transaction_mode
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          if (
            ni_order_sale.state == "AUTHORISED" ||
            ni_order_sale.state == "CAPTURED"
          ) {
            // web  hook starting
            let hook_info = await helpers.get_data_list(
              "*",
              "webhook_settings",
              {
                merchant_id: merchant_id[0].merchant_id,
              }
            );
            let web_hook_res = Object.assign({}, res_obj.new_res);
            delete web_hook_res?.return_url;
            delete web_hook_res?.paydart_category;
            if (hook_info[0]) {
              if (
                hook_info[0].enabled === 0 &&
                hook_info[0].notification_url != ""
              ) {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                  url,
                  web_hook_res,
                  hook_info[0].notification_secret
                );
              }
            }
          }
          // Web hook end
          //console.log(ni_order_sale);

          if (
            (ni_order_sale.state == "AUTHORISED" ||
              ni_order_sale.state == "CAPTURED") &&
            fraudStatus == true
          ) {
            let res_obj = await voidNi(
              req,
              ni_order_sale,
              res_order_data,
              payment_id,
              transaction_mode,
              fraudStatus,
              browser_token_enc,
              p_request_id
            );
            return res
              .status(statusCode.badRequest)
              .send(response.errorMsgWithData(res_obj.message, res_obj));
          }
          let txnFailedLog = {
            order_id: res_order_data.order_id,
            terminal: res_order_data?.terminal_id,
            req: JSON.stringify(req.body),
            res: JSON.stringify(ni_order_sale),
            psp: "NI",
            status_code: ni_order_sale?.authResponse?.resultCode,
            description: ni_order_sale?.authResponse?.resultMessage,
            activity: "Transaction success with NI",
            status: 1,
            mode: transaction_mode,
            txn: payment_id,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };

          await helpers.addTransactionFailedLogs(txnFailedLog);
          if (
            ni_order_sale.state == "AUTHORISED" ||
            ni_order_sale.state == "CAPTURED" ||
            ni_order_sale.state == "AWAIT_3DS"
          ) {
            res
              .status(statusCode.ok)
              .send(successdatamsg(res_obj, "Paid successfully."));
          } else {
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: res_order_data.order_id,
              mode: transaction_mode,
            });

            let orderupdate = {
              status: "FAILED",
              psp: "NI",
              payment_id: payment_id,
              // payment_mode: req.bodyString("payment_mode"),
            };
            await merchantOrderModel.updateDynamic(
              orderupdate,
              { order_id: res_order_data?.order_id },
              order_table
            );

            let order_txn_update = {
              txn: payment_id,
              order_id: res_order_data?.order_id || "",
              currency: res_order_data?.currency || "",
              amount: res_order_data?.amount || "",
              type: res_order_data?.action.toUpperCase(),
              status: "FAILED",
              psp_code: "",
              paydart_category: ni_order_sale?.authResponse?.resultCode,
              remark: ni_order_sale?.authResponse?.resultMessage,
              capture_no: "",
              created_at: updated_at,
              payment_id: ni_order_sale?.reference || "",
              order_reference_id: ni_order_sale?.orderReference || "",
            };
            if (transaction_mode == "live") {
              await merchantOrder.addDynamic(order_txn_update, "order_txn");
            } else {
              await merchantOrder.addDynamic(
                order_txn_update,
                "test_order_txn"
              );
            }

            let txnFailedLog = {
              order_id: res_order_data.order_id,
              terminal: res_order_data?.terminal_id,
              req: JSON.stringify(req.body),
              res: JSON.stringify(ni_order_sale),
              psp: "NI",
              status_code: ni_order_sale?.authResponse?.resultCode,
              description: ni_order_sale?.authResponse?.resultMessage,
              activity: "Transaction failed with NI",
              status: 1,
              mode: transaction_mode,
              card_holder_name: temp_card_details.card_holder_name,
              card: temp_card_details.card,
              expiry: temp_card_details.expiry,
              cipher_id: temp_card_details.cipher_id,
              card_proxy: temp_card_details.card_proxy,
              "3ds_version": "0",
              txn: payment_id,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };

            await helpers.addTransactionFailedLogs(txnFailedLog);
            res
              .status(statusCode.ok)
              .send(response.errorMsgWithData("Transaction failed.", res_obj));
          }
        }
      })
      .catch(async (error) => {
        console.log("error_ni", error);
        winston.error(error);

        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred`
        );
        let response_dump = {
          order_id: req?.body?.order_id,
          type: "Payment",
          status: "FAILED",
          dump: JSON.stringify(
            error?.response?.data ? error?.response?.data : error
          ),
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : error orderTransactionModel.addResDump ${JSON.stringify(
            response_dump
          )}`
        );
        await orderTransactionModel.addResDump(response_dump);

        if (
          error?.response?.data?.code === 422 ||
          error?.response?.data?.code === 400 ||
          error?.response?.data?.code === 403
        ) {
          logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error ${
              error?.response?.data?.errors[0]?.message +
              "." +
              error?.response?.data?.errors[0]?.localizedMessage
            }`
          );
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error?.response?.data?.errors[0]?.message));
        } else {
          logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error ${
              error?.message ? error?.message : error
            }`
          );
          // res.status(statusCode.internalError).send(
          //     response.errormsg(
          //         error?.message ? error?.message : error
          //     )
          // );
        }

        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };
        let log_is = await order_logs.update_logs_data(
          {
            order_id: req.bodyString("order_id"),
          },
          logs_payload,
          transaction_mode
        );
      });
  },

  telr_pay: async (req, res) => {
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
        ip: req.headers.ip,
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
      let payload = {
        currency: res_order_data.currency,
        amount: res_order_data.amount,
        order_id: req.body.order_id,
        cvv: req.body.cvv,
        description: res_order_data?.description,
        type: res_order_data?.action.toLowerCase(),
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
      let telr_session;
      telr_session = await telr_sale.createSession(
        payload,
        _terminalcred,
        req.body.env
      );

      if (
        telr_session?.enrolled != "Y" &&
        telr_session?.enrolled != "N" &&
        telr_session?.enrolled != "U" &&
        telr_session?.enrolled != ""
      ) {
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
        let txnFailedLog = {
          order_id: res_order_data.order_id,
          activity: "Order failed with Telr",
          mode: req.body.env,
          status: 1,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        return res
          .status(statusCode.ok)
          .send(response.errorMsgWithData("Transaction failed.", res_obj));
      }
      let sale_api_res;
      let acsUrl = "";
      let acsPaReq = "";
      let acsMd = "";
      let redirect_url = "";
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : telr_session with data ${JSON.stringify(telr_session)}`
      );

      // getting action from db
      let action = await order_logs.get_order_action(
        req.bodyString("order_id"),
        table_name
      );

      if (
        telr_session.enrolled == "N" ||
        (telr_session.enrolled == "Y" && telr_session.level == 2) ||
        telr_session.enrolled == ""
      ) {
        status = "PENDING";
        const getCountryIso = await countryModel.getIos("iso2", {
          country_name: res_order_data?.billing_country,
        });

        let sale_payload = {
          // type: "sale",
          type: res_order_data?.action.toLowerCase(),
          classValue: "ecom",
          currency: res_order_data.currency,
          amount: res_order_data.amount,
          description: res_order_data?.description,
          cvv: req.body.cvv,
          session: telr_session?.session,
          billingNameFirst: res_order_data?.customer_name.split(" ")[0],
          billingNameLast: res_order_data?.customer_name.split(" ")[1],
          billingLine1: res_order_data.billing_address_line_1,
          billingLine2: res_order_data.billing_address_line_2,
          billingCity: res_order_data.billing_city,
          billingRegion: res_order_data.billing_province,
          billingCountry: res_order_data.billing_country,
          billingZip: res_order_data.billing_pincode,
          email: req.body.email,
          ip: req.headers.ip,
          order_id: req.body.order_id,
        };

        if (req.bodyString("card_id")) {
          sale_payload.card = await enc_dec.dynamic_decryption(
            card_details.card_number,
            card_details.cipher_id
          );
          sale_payload.expiry_month = card_details.card_expiry.split("/")[0];
          sale_payload.expiry_year = card_details.card_expiry.split("/")[1];
        } else {
          sale_payload.card = req.body.card;
          sale_payload.expiry_month = req.body.expiry_date.split("/")[0];
          sale_payload.expiry_year = req.body.expiry_date.split("/")[1];
        }

        const _terminalids = await merchantOrderModel.selectOne(
          "terminal_id",
          {
            order_id: req.bodyString("order_id"),
          },
          table_name
        );
        const _getmid = await merchantOrderModel.selectOne(
          "MID,password,psp_id,is3DS",
          {
            terminal_id: _terminalids.terminal_id,
          },
          "mid"
        );
        if (!_getmid) {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("No Routes  Available for Transection"));
        }
        const _pspid = await merchantOrderModel.selectOne(
          "*",
          {
            id: _getmid.psp_id,
          },
          "psp"
        );
        if (!_pspid) {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("No Psp Available"));
        }
        const _terminalcred = {
          MID: _getmid.MID,
          password: _getmid.password,
          baseurl: credientials.telr.checkout_url,
          psp_id: _getmid.psp_id,
          name: _pspid.name,
        };

        sale_api_res = await telr_sale.makeSaleRequest(
          sale_payload,
          _terminalcred,
          req.body.env
        );
        if (_getmid.is3DS == 1) {
          res_order_data.psp = "Telr";
          let reject_obj = await rejectNon3DS(
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
            req: JSON.stringify(sale_payload),
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

          await helpers.addTransactionFailedLogs(txnFailedLog);
          res
            .status(statusCode.ok)
            .send(successdatamsg(reject_obj, "Transaction Rejected."));
        } else {
          let req_data = {
            request: JSON.stringify(sale_payload),
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
          // let subs_payment =
          //     await merchantOrderModel.selectOne(
          //         "id",
          //         {
          //             order_no: req.bodyString("order_id"),
          //         },
          //         "subs_payment"
          //     );
          // if (subs_payment) {
          //     let subs_data = {
          //         payment_status:
          //             sale_api_res.status === "A"
          //                 ? "CAPTURED"
          //                 : "FAILED",
          //         transaction_date: updated_at,
          //     };

          //     logs.push(
          //         `${moment().format(
          //             "DD/MM/YYYY HH:mm:ss.SSS"
          //         )} : merchantOrderModel.updateDynamic`
          //     );

          //     await merchantOrderModel
          //         .updateDynamic(
          //             subs_data,
          //             {
          //                 id: subs_payment.id,
          //             },
          //             "subs_payment"
          //         )
          //         .then(async (result) => {
          //             let subscription_id =
          //                 await helpers.get_data_list(
          //                     "subscription_id",
          //                     "subs_payment",
          //                     {
          //                         id: subs_payment.id,
          //                     }
          //                 );
          //             let subs_id =
          //                 subscription_id[0].subscription_id;

          //             let subs_data =
          //                 await helpers.get_data_list(
          //                     "*",
          //                     "subscription",
          //                     {
          //                         subscription_id: subs_id,
          //                     }
          //                 );
          //             const currentDate =
          //                 moment().format("YYYY-MM-DD");
          //             let payload = subs_data[0];

          //             let next_data =
          //                 await helpers.generateTable(
          //                     currentDate,
          //                     payload?.payment_interval,
          //                     payload?.plan_billing_frequency,
          //                     payload?.terms,
          //                     payload?.subscription_id,
          //                     payload?.email,
          //                     sale_api_res?.tranref,
          //                     payload?.initial_payment_amount,
          //                     payload?.final_payment_amount,
          //                     payload?.plan_billing_amount,
          //                     payload?.plan_id
          //                 );
          //             if (sale_api_res.status === "A") {
          //                 for (let val of next_data) {
          //                     val.order_id =
          //                         req.bodyString("order_id");
          //                     await merchantOrderModel
          //                         .addDynamic(
          //                             val,
          //                             "subscription_recurring"
          //                         )
          //                         .then((result) => { })
          //                         .catch((error) => {
          //                         });
          //                 }
          //             }
          //         })
          //         .catch((error) => {
          //         });
          // }

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
                // calculateTransactionCharges(transaction_and_feature_data);

                // transaction feature charges
                // calculateFeatureCharges(transaction_and_feature_data);
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
                mask_card_number: res_order_data?.pan
                  ? res_order_data?.pan
                  : "",
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
                    "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
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
            let hook_info = await helpers.get_data_list(
              "*",
              "webhook_settings",
              {
                merchant_id: merchant_id[0].merchant_id,
              }
            );
            let web_hook_res = Object.assign({}, res_obj.new_res);
            delete web_hook_res?.return_url;
            delete web_hook_res?.paydart_category;
            if (hook_info[0]) {
              if (
                hook_info[0].enabled === 0 &&
                hook_info[0].notification_url != ""
              ) {
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
              req: JSON.stringify(sale_payload),
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

            await helpers.addTransactionFailedLogs(txnFailedLog);
            return res
              .status(statusCode.ok)
              .send(successdatamsg(res_obj, "Paid successfully."));
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
              p_order_id: res_order_data.order_id
                ? res_order_data.order_id
                : "",
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
              req: JSON.stringify(sale_payload),
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

            await helpers.addTransactionFailedLogs(txnFailedLog);

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
      } else {
        status = "AWAIT_3DS";
        acsUrl = telr_session?.acsurl;
        acsPaReq = telr_session?.pareq;
        acsMd = telr_session?.acsMd;
        redirect_url = telr_session?.redirecthtml;
        let orderupdate = {
          status: status,
          psp: "TELR",
        };
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: req.bodyString("order_id"),
          },
          table_name
        );

        let res_obj = {
          order_status: status,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc || "",
          telr_session: telr_session?.session,
          "3ds": {
            acsUrl,
            acsPaReq,
            acsMd: acsMd || "",
            redirect_url: redirect_url,
          },
        };

        let order_txn = {
          status: status,
          txn: payment_id,
          type: res_order_data.action,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: updated_at,
        };
        if (req.body.env == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        let response_dump = {
          order_id: res_order_data.order_id,
          type: res_order_data.action,
          status: status,
          dump: JSON.stringify(telr_session),
        };
        if (req.body.env == "test") {
          await orderTransactionModel.addTestResDump(response_dump);
        } else {
          await orderTransactionModel.addResDump(response_dump);
        }

        /* Code copied from */
        let sale_payload = {
          // type: "sale",
          type: action?.action,
          classValue: "ecom",
          currency: res_order_data.currency,
          amount: res_order_data.amount,
          description: res_order_data?.description,
          cvv: req.body.cvv,
          session: telr_session?.session,
          billingNameFirst: req.body.name.split(" ")[0],
          billingNameLast: req.body.name.split(" ")[1],
          billingLine1: res_order_data.billing_address_line_1,
          billingLine2: res_order_data.billing_address_line_2,
          billingCity: res_order_data.billing_city,
          billingRegion: res_order_data.billing_province,
          billingCountry: res_order_data.billing_country,
          billingZip: res_order_data.billing_pincode,
          email: req.body.email,
          ip: req.headers.ip,
          order_id: req.body.order_id,
        };

        if (req.bodyString("card_id")) {
          sale_payload.card = await enc_dec.dynamic_decryption(
            card_details.card_number,
            card_details.cipher_id
          );
          sale_payload.expiry_month = card_details.card_expiry.split("/")[0];
          sale_payload.expiry_year = card_details.card_expiry.split("/")[1];
        } else {
          sale_payload.card = req.body.card;
          sale_payload.expiry_month = req.body.expiry_date.split("/")[0];
          sale_payload.expiry_year = req.body.expiry_date.split("/")[1];
        }
        const orderdata = await merchantOrderModel.selectOne(
          "merchant_id",
          {
            order_id: req.bodyString("order_id"),
          },
          table_name
        );
        let req_data = {
          request: JSON.stringify(sale_payload),
          merchant_id: orderdata.merchant_id,
          order_id: req.bodyString("order_id"),
        };
        if (req.body.env == "test") {
          await helpers.common_add(req_data, "test_order_request");
        } else {
          await helpers.common_add(req_data, "order_request");
        }

        return res.status(statusCode.ok).send(response.successansmsg(res_obj));
      }
    } catch (error) {
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

  addOrUpdateCustomer: async (req, res, next) => {
    console.log("add customer");
    let order_table = "orders";
    if (req.bodyString("env") == "test") {
      order_table = "test_orders";
    }
    if (req.bodyString("card_id") == "") {
      let email = req.bodyString("email");

      // if (req.bodyString("browserFP") != "") {
      //     let browserFP = JSON.parse(
      //         enc_dec.cjs_decrypt(req.bodyString("browserFP"))
      //     );
      //     if (browserFP.email != email) {
      //         email = browserFP.email;
      //     } else {
      //         email = req.bodyString("email");
      //     }
      // }
      merchantOrderModel
        .selectOne(
          "*",
          {
            email: email,
          },
          "customers"
        )
        .then(async (result) => {
          let customer_id = "";
          let enc_customer_id = "";
          let order_details = await merchantOrderModel.selectOne(
            "customer_name",
            { order_id: req.bodyString("order_id") },
            order_table
          );

          if (result) {
            customer_id = result.id;
            enc_customer_id = enc_dec.cjs_encrypt(customer_id);
            /** Update Customer*/
            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let customer = {
              email: req.bodyString("email"),
              name: order_details.customer_name,
              dial_code: req.bodyString("dial_code"),
              mobile_no: req.bodyString("mobile_no"),
              prefer_lang: enc_dec.cjs_decrypt(req.bodyString("prefer_lang")),
              updated_at: updated_at,
            };
            merchantOrderModel
              .updateDynamic(
                customer,
                {
                  id: result.id,
                },
                "customers"
              )
              .then((update_result) => {
                req.customer_id = enc_customer_id;
                next();
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else {
            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let customer = {
              name: req.bodyString("name"),
              email: req.bodyString("email"),
              dial_code: req.bodyString("dial_code"),
              mobile_no: req.bodyString("mobile_no"),
              prefer_lang: enc_dec.cjs_decrypt(req.bodyString("prefer_lang")),
              created_at: created_at,
              updated_at: updated_at,
            };
            merchantOrderModel
              .addDynamic(customer, "customers")
              .then(async (result) => {
                req.customer_id = await enc_dec.cjs_encrypt(result.insertId);
                next();
              })
              .catch((error) => {
                console.log("add_custoner", error);
                winston.error(error);

                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          }
        })
        .catch((error) => {
          console.log("add_custoner", error);
          winston.error(error);

          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else {
      next();
    }
  },
  addOrUpdateCustomerOpenCreate: async (req, res, next) => {
    let classType = req.body.data.class;
    if (classType == "cont") {
      next();
    } else {
      let customer_details = req.body.data.customer_details;
      let email = customer_details.email;
      merchantOrderModel
        .selectOne(
          "*",
          {
            email: email,
            merchant_id: req.credentials.super_merchant_id,
            sub_merchant_id: req.credentials.merchant_id,
          },
          "customers"
        )
        .then(async (result) => {
          let customer_id = "";
          let enc_customer_id = "";
          if (result) {
            customer_id = result.id;
            enc_customer_id = enc_dec.cjs_encrypt(customer_id);

            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let customer = {
              email: email,
              name: customer_details.name,
              dial_code: customer_details.code,
              mobile_no: customer_details.mobile,
              updated_at: updated_at,
              merchant_id: req.credentials.super_merchant_id,
              sub_merchant_id: req.credentials.merchant_id,
            };
            merchantOrderModel
              .updateDynamic(
                customer,
                {
                  id: result.id,
                },
                "customers"
              )
              .then((update_result) => {
                req.customer_id = enc_customer_id;
                next();
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else {
            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let customer = {
              email: email,
              name: customer_details.name,
              dial_code: customer_details.code,
              mobile_no: customer_details.mobile,
              updated_at: updated_at,
              merchant_id: req.credentials.super_merchant_id,
              sub_merchant_id: req.credentials.merchant_id,
              created_at: created_at,
              updated_at: updated_at,
            };
            merchantOrderModel
              .addDynamic(customer, "customers")
              .then(async (result) => {
                req.customer_id = await enc_dec.cjs_encrypt(result.insertId);
                next();
              })
              .catch((error) => {
                winston.error(error);

                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          }
        })
        .catch((error) => {
          winston.error(error);

          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    }
  },
  saveCard: async (req, res, next) => {
    console.log("saveCard");

    let browser_token = {
      os: req.headers.os,
      browser: req.headers.browser,
      browser_version: req.headers["x-browser-version"],
      browser_fingerprint: req.headers.fp,
    };

    console.log(browser_token);

    let browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));

    let card_exits = await helpers.checkCardExistByCardNoAndCID(
      {
        browser_token: browser_token_enc,
        email: req.bodyString("email"),
        deleted: 0,
      },
      req.bodyString("card")
    );

    if (req.bodyString("card_id") == "") {
      let save_card = req.bodyString("save_card");

      if (!card_exits) {
        let secret_key = await cipherModel.selectOne("id", {
          ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
          is_active: 1,
        });
        let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let card_number = await enc_dec.dynamic_encryption(
          req.bodyString("card"),
          secret_key.id,
          ""
        );
        let cvv = await enc_dec.dynamic_encryption(
          req.body.cvv,
          secret_key.id,
          ""
        );
        let card_proxy = enc_dec.encrypt_card(req.bodyString("card"));
        let card = {
          name_on_card: req.bodyString("name"),
          email: req.bodyString("email"),
          card_number: card_number,
          card_expiry: req.bodyString("expiry_date"),
          card_nw: req.card_details.card_brand,
          last_4_digit: req.bodyString("card").slice(-4),
          browser_token: browser_token_enc,
          cid: req.customer_id,
          created_at: created_at,
          updated_at: updated_at,
          card_proxy: card_proxy,
          cipher_id: secret_key.id,
          is_save: save_card == "1" ? 1 : 0,
        };
        let temp_card_storage_data = {
          order_id: req.bodyString("order_id"),
          mode: req.bodyString("env"),
          card: card_number,
          expiry: req.bodyString("expiry_date"),
          card_holder_name: req.bodyString("name"),
          cipher_id: secret_key.id,
          card_proxy: card_proxy,
          cvv: cvv,
        };

        let addTempCardRes = await helpers.addTempCard(temp_card_storage_data);

        req.browser_fingerprint = browser_token_enc;
        merchantOrderModel
          .addCustomerCards(card)
          .then((result) => {
            req.card_id = enc_dec.cjs_encrypt(result.insertId);
            next();
          })
          .catch((error) => {
            winston.error(error);

            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        if (card_exits) {
          let is_save = save_card == "1" ? 1 : 0;
          merchantOrderModel.updateDynamic(
            { is_save: is_save },
            { id: card_exits.id },
            "customers_cards"
          );
          let secret_key = await cipherModel.selectOne("id", {
            ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
            is_active: 1,
          });
          let cvv = await enc_dec.dynamic_encryption(
            req.body.cvv,
            secret_key.id,
            ""
          );
          let temp_card_storage_data = {
            order_id: req.bodyString("order_id"),
            mode: req.bodyString("env"),
            card: card_exits.card_number,
            expiry: card_exits.card_expiry,
            card_holder_name: card_exits.name_on_card,
            cipher_id: card_exits.cipher_id,
            card_proxy: card_exits.card_proxy,
            cvv: cvv,
          };

          let addTempCardRes = await helpers.addTempCard(
            temp_card_storage_data
          );
          req.card_id = enc_dec.cjs_encrypt(card_exits.id);
        }

        next();
      }
    } else {
      let card_id = enc_dec.cjs_decrypt(req.body.card_id);
      req.card_id = req.body.card_id;
      let card_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { id: card_id },
        "customers_cards"
      );
      let secret_key = await cipherModel.selectOne("id", {
        ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
        is_active: 1,
      });
      let cvv = await enc_dec.dynamic_encryption(
        req.body.cvv,
        secret_key.id,
        ""
      );
      let temp_card_storage_data = {
        order_id: req.bodyString("order_id"),
        mode: req.bodyString("env"),
        card: card_details.card_number,
        expiry: card_details.card_expiry,
        card_holder_name: card_details.name_on_card,
        cipher_id: card_details.cipher_id,
        card_proxy: card_details.card_proxy,
        cvv: cvv,
      };

      let addTempCardRes = await helpers.addTempCard(temp_card_storage_data);
      next();
    }
  },

  bin_saveCard: async (req, res, next) => {
    console.log("bin_saveCard");
    let browser_token = {
      os: req.headers.os,
      browser: req.headers.browser,
      browser_version: req.headers["x-browser-version"],
      browser_fingerprint: req.headers.fp,
    };
    let browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
    let card_exits = await helpers.checkCardExistByCardNoAndCID(
      {
        browser_token: browser_token_enc,
        email: req.bodyString("email"),
        deleted: 0,
      },
      req.bodyString("card")
    );

    if (req.bodyString("card_id") == "") {
      let save_card = req.bodyString("save_card");
      if (save_card == "1" && !card_exits) {
        const secret_key = await cipherModel.selectOne("id", {
          ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
          is_active: 1,
        });
        const created_at = moment().format("YYYY-MM-DD HH:mm:ss");
        const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
        const recent_used = moment().format("YYYY-MM-DD HH:mm:ss");
        let card = {
          name_on_card: req.bodyString("name"),
          email: req.bodyString("email"),
          card_number: await enc_dec.dynamic_encryption(
            req.bodyString("card"),
            secret_key.id,
            ""
          ),
          card_expiry: req.bodyString("expiry_date"),
          card_nw: req?.card_details?.card_brand,
          last_4_digit: req.bodyString("card").slice(-4),
          browser_token: browser_token_enc,
          cid: req.customer_id,
          created_at: created_at,
          updated_at: updated_at,
          card_proxy: enc_dec.encrypt_card(req.bodyString("card")),
          cipher_id: secret_key.id,
          recent_used: recent_used,
        };
        req.browser_fingerprint = browser_token_enc;
        merchantOrderModel
          .addCustomerCards(card)
          .then((result) => {
            req.card_id = enc_dec.cjs_encrypt(result.insertId);
            next();
          })
          .catch((error) => {
            console.log(error);
            winston.error(error);

            return res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        if (card_exits) {
          const _cardid = enc_dec.cjs_encrypt(card_exits.id);
          req.card_id = _cardid;
          const recent_used = moment().format("YYYY-MM-DD HH:mm:ss");
          await merchantOrderModel.updateDynamic(
            {
              recent_used: recent_used,
            },
            {
              id: recent_used,
            },
            "customers_cards"
          );
        }
        next();
      }
    } else {
      next();
    }
  },

  cardList: async (req, res, next) => {
    let dec_token = req.bodyString("token");
    if (dec_token) {
      // let customer_data = JSON.parse(dec_token);
      // let email = customer_data.email;
      // let customer = await merchantOrderModel.selectOne('*', { email: email }, 'customers')
      let customer_cards = await merchantOrderModel.selectDynamic(
        "*",
        {
          browser_token: dec_token,
          deleted: 0,
          is_save: 1,
          email: req.bodyString("email"),
        },
        "customers_cards"
      );
      if (customer_cards[0]) {
        let cards = [];
        for (let card of customer_cards) {
          let card_obj = {
            card_id: enc_dec.cjs_encrypt(card.id),
            Name: card.name_on_card,
            ExpiryDate: card.card_expiry,
            CardNetwork: card.card_nw,
            Card: card.last_4_digit,
            Image: server_addr + "/static/images/visa-image.png",
          };
          cards.push(card_obj);
        }
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(cards, "List fetched successfully."));
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.successdatamsg([], "No card found."));
      }
    } else {
      res
        .status(statusCode.ok)
        .send(response.successdatamsg([], "No card found."));
    }
  },
  cancel: async (req, res) => {
    const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    const status = "CANCELLED";
    let mode = req.body.mode;
    const table_name = mode == "test" ? "test_orders" : "orders";
    const txn = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );

    const res_order_data = await merchantOrderModel.selectOne(
      "*",
      {
        order_id: req.bodyString("order_id"),
      },
      table_name
    );
    let order_data = {
      status: status,
      updated_at: updated_at,
    };
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let qr_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: req.bodyString("order_id"),
          },
          "qr_payment"
        );
        if (qr_payment) {
          let qr_data = {
            payment_status: status,
            transaction_date: updated_at,
          };
          merchantOrderModel.updateDynamic(
            qr_data,
            {
              id: qr_payment.id,
            },
            "qr_payment"
          );
        }
        let subs_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: req.bodyString("order_id"),
          },
          "subs_payment"
        );
        if (subs_payment) {
          let subs_data = {
            payment_status: status,
            transaction_date: updated_at,
          };
          merchantOrderModel.updateDynamic(
            subs_data,
            {
              id: subs_payment.id,
            },
            "subs_payment"
          );
        }
        let order_txn = {
          status: status,
          txn: txn,
          type: "",
          payment_id: "",
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: updated_at,
          order_reference_id: "",
          capture_no: "",
          remark: "Cancelled by user",
        };
        if (mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        let p_request_id = await helpers.make_sequential_no("REQ");

        let order_req = {
          merchant_id: res_order_data?.merchant_id,
          order_id: req.body.order_id,
          request_id: p_request_id,
          request: "CANCELLED",
        };
        await helpers.common_add(order_req, "generate_request_id");

        new_res = {
          m_order_id: res_order_data.merchant_order_id,
          p_order_id: res_order_data.order_id,
          p_request_id: p_request_id,
          psp_ref_id: "",
          psp_txn_id: "",
          transaction_id: txn,
          status: "CANCELLED",
          // status_code: ni_order_sale?.authResponse?.resultCode ? ni_order_sale?.authResponse?.resultCode : "",
          status_code: "00",
          remark: "Cancelled by user",
          paydart_category: "",
          currency: res_order_data.currency,
          amount: res_order_data?.amount ? res_order_data?.amount : "",
          m_customer_id: res_order_data.merchant_customer_id,
          psp: "",
          payment_method: "",
          m_payment_token: "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          return_url:
            res_order_data.cancel_url || process.env.DEFAULT_CANCEL_URL,
          payment_method_data: {
            scheme: "",
            card_country: "",
            card_type: "",
            mask_card_number: "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: res_order_data?.merchant_id
            ? await helpers.formatNumber(res_order_data?.merchant_id)
            : "",
        };
        res_obj = {
          new_res: new_res,
        };
        var res_web = {
          new_res: new_res,
        };
        // web  hook starting
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: res_order_data?.merchant_id,
        });

        const web_hook_res = Object.assign({}, res_web.new_res);
        delete web_hook_res.return_url;
        delete web_hook_res.paydart_category;
        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
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
          .send(successdatamsg(res_obj, "Cancelled successfully."));
      })
      .catch((error) => {
        console.log(error);
        winston.error(error);
        return res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  mobile_cancel: async (req, res) => {
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let status = "CANCELLED";
    let table_name = "orders";

    let order_data = {
      status: status,
      updated_at: updated_at,
      cid: enc_dec.cjs_encrypt(req.user.id),
    };
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let order_res = {
          order_status: status,
          order_id: req.bodyString("order_id"),
          amount: req.order.amount,
          currency: req.order.currency,
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(order_res, "Cancelled successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  failed: async (req, res) => {
    var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let status = "FAILED";
    let table_name =
      req.bodyString("mode") == "test" ? "test_orders" : "orders";

    let order_data = {
      status: status,
      updated_at: updated_at,
    };
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let qr_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: req.bodyString("order_id"),
          },
          "qr_payment"
        );
        if (qr_payment) {
          let qr_data = {
            payment_status: status,
            transaction_date: updated_at,
          };
          merchantOrderModel.updateDynamic(
            qr_data,
            {
              id: qr_payment.id,
            },
            "qr_payment"
          );
        }
        let subs_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: req.bodyString("order_id"),
          },
          "subs_payment"
        );
        if (subs_payment) {
          let subs_data = {
            payment_status: status,
            transaction_date: updated_at,
          };
          merchantOrderModel.updateDynamic(
            subs_data,
            {
              id: subs_payment.id,
            },
            "subs_payment"
          );
        }
        let order = await merchantOrderModel.selectDynamicONE(
          "*",
          { order_id: req.bodyString("order_id") },
          table_name
        );
        let order_res = {
          order_id: order?.order_id,
          payment_id: order?.payment_id,
          amount: order?.amount,
          currency: order?.currency,
          order_status: order?.status,
          new_res: {
            return_url: order?.failure_url,
            m_order_id: order?.merchant_order_id,
            p_order_id: order?.order_id,
            transaction_id: order?.payment_id,
            status: order?.status,
            status_code: "01",
            payment_method_data: {
              card_type: order?.cardType,
              mask_card_number: order?.pan,
            },
            transaction_time: moment().format("DD-MM-YYYY HH:mm:ss"),
            amount: order?.amount,
          },
        };
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: order.merchant_id,
        });
        let web_hook_res = Object.assign({}, order_res);
        delete web_hook_res?.return_url;
        delete web_hook_res?.paydart_category;
        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
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
          .send(successdatamsg(order_res, "Order failed."));
      })
      .catch((error) => {
        winston.error(error);
        console.log(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  mobile_failed: async (req, res) => {
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let status = "Failed";
    let table_name = "orders";

    let order_data = {
      status: status,
      updated_at: updated_at,
      cid: enc_dec.cjs_encrypt(req.user.id),
    };
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let order_res = {
          order_status: status,
          order_id: req.bodyString("order_id"),
          amount: req.order.amount,
          currency: req.order.currency,
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(order_res, "Order failed."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  remove_card: async (req, res) => {
    let table_name = "customers_cards";
    let card_data = {
      deleted: 1,
    };
    let condition = {
      id: enc_dec.cjs_decrypt(req.bodyString("card_id")),
    };
    merchantOrderModel
      .updateDynamic(card_data, condition, table_name)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(successmsg("Card deleted successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  send_notification_for_pay_with_vault: async (req, res) => {
    let customer_and_order = await merchantOrder.selectOne(
      "customer_email",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    let fcm_fetch = await merchantOrderModel.selectOne(
      "fcm_id,name",
      {
        email: customer_and_order.customer_email,
        deleted: 0,
      },
      "customers"
    );

    if (typeof fcm_fetch == "undefined") {
      res
        .status(statusCode.badRequest)
        .send(response.validationResponse("Invalid browser fingerprint"));
    } else {
      let order_details = await merchantOrderModel.selectOne(
        "amount,currency,return_url,merchant_id",
        {
          order_id: req.bodyString("order_id"),
        },
        "orders"
      );
      let token_payload = {
        order_id: req.bodyString("order_id"),
        amount: order_details?.amount,
        currency: order_details?.currency,
        return_url: order_details?.return_url,
        env: "live",
        merchant_id: order_details.merchant_id,
      };
      let token = accessToken(token_payload);
      let result = await helpers.pushNotification(
        fcm_fetch.fcm_id,
        (title = "Make Payment"),
        (message =
          "Pay with vault for order id #" + req.bodyString("order_id")),
        (url_ = "testing url"),
        (type = "Payment"),
        (payload = {
          token: token, //req.bodyString("token"),
          order_id: req.bodyString("order_id"),
        }),
        (user = fcm_fetch.name)
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Notification send successfully."));
    }
  },
  pay_with_vault: async (req, res) => {
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");

    let payment_id = await helpers.make_sequential_no("TXN");
    let status = "CAPTURED";
    let card_no = "";
    let enc_customer_id = "";
    let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
    let card_details = await merchantOrderModel.selectOne(
      "card_number,card_expiry,card_nw,last_4_digit,cid",
      {
        id: card_id,
      },
      "customers_cards"
    );
    let secret_key = await cipherModel.selectOne("id", {
      ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
      is_active: 1,
    });
    card_no = card_details.last_4_digit;
    enc_customer_id = card_details.cid;
    let table_name = "orders";
    let pan = maskify(
      await enc_dec.dynamic_decryption(
        card_details.card_number,
        secret_key.id,
        ""
      )
    );

    let order_data = {
      payment_id: payment_id,
      status: status,
      card_no: card_no,
      updated_at: updated_at,
      cid: enc_customer_id,
      pan: pan,
      cardType: "CREDIT",
      payment_mode: "CREDIT CARD",
      psp: "NI",
      MCC: 1,
      psp_id: 1,
      mcc_category: 24,
      expiry: card_details.card_expiry,
    };
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let res_order_data = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: req.bodyString("order_id"),
          },
          table_name
        );
        let order_txn = {
          status: "AUTHORISED",
          txn: payment_id,
          type: "CAPTURE",
          order_id: req.bodyString("order_id"),
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: updated_at,
          paydart_category: "Success",
          psp_code: "00",
        };
        await orderTransactionModel.add(order_txn);
        let res_obj = {
          order_status: status,
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(res_obj, "Paid successfully."));
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  status: async (req, res) => {
    let table_name = "orders";

    let selection = "*";
    merchantOrderModel
      .selectOne(
        selection,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      )
      .then(async (result) => {
        let trans_data = await helpers.get_trans_data(result?.order_id);
        var url = result.failure_url;
        if (result.status == "CANCELLED") {
          url = result.cancel_url;
        } else if (result.status == "AUTHORISED") {
          url = result.success_url;
        }
        let new_res = {
          m_order_id: result?.merchant_order_id
            ? result?.merchant_order_id
            : "",
          p_order_id: result?.order_id ? result?.order_id : "",
          p_request_id: trans_data[0]?.last_request_id
            ? trans_data[0]?.last_request_id
            : "",
          psp_ref_id: trans_data[0]?.last_psp_ref_id
            ? trans_data[0]?.last_psp_ref_id
            : "",
          transaction_id: result?.payment_id ? result?.payment_id : "",
          psp_txn_id: trans_data[0]?.last_psp_txn_id
            ? trans_data[0]?.last_psp_txn_id
            : "",
          transaction_date: result?.updated_at
            ? moment(result?.updated_at).format("DD-MM-YYYY hh:mm:ss")
            : "",
          return_url: url,
          paydart_category: trans_data[0]?.paydart_category
            ? trans_data[0]?.paydart_category
            : "",
          status_code: trans_data[0]?.psp_code ? trans_data[0]?.psp_code : "",
          status: result?.status ? result?.status : "",
          currency: result?.currency ? result?.currency : "",
          amount: result?.amount ? result?.amount.toFixed(2) : "",
          psp: result?.psp ? result?.psp : "",
          payment_method: result?.payment_mode ? result?.payment_mode : "",
          m_payment_token: result?.card_id ? result?.card_id : "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          payment_method_data: {
            scheme: result?.scheme ? result?.scheme : "",
            card_country: result?.card_country ? result?.card_country : "",
            card_type: result?.cardType ? result?.cardType : "",
            masked_pan: result?.pan ? result?.pan : "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: result?.merchant_id
            ? await helpers.formatNumber(result?.merchant_id)
            : "",
        };
        res
          .status(statusCode.ok)
          .send(successdatamsg(new_res, "Details fetch successfully."));
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  order_details_for_mobile: async (req, res) => {
    let table = "orders";

    TransactionsModel.selectOne(
      "*",
      {
        order_id: req.bodyString("order_id"),
      },
      table
    )
      .then(async (result) => {
        let order_txn = await TransactionsModel.selectSpecificDynamic(
          "order_id, txn, type, status, res_dump, amount, currency, created_at",
          {
            order_id: result.order_id,
          },
          "order_txn"
        );
        let send_res = [];
        let update_order_txn = [];
        for (let element of order_txn) {
          element.created_at = moment(element.created_at).format(
            "DD-MM-YYYY HH:mm"
          );
          update_order_txn.push(element);
        }
        let val = result;
        let res1 = {
          transactions_id: await enc_dec.cjs_encrypt(val.id),
          merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
          order_id: val.order_id,
          payment_id: val.payment_id,
          payment_mode: val.payment_mode,
          merchant_name: await helpers.get_merchantdetails_name_by_id(
            val.merchant_id
          ),
          customer_name: val.customer_name,
          customer_email: val.customer_email,
          customer_mobile: val.customer_mobile,
          order_amount: val.amount.toFixed(2),
          order_currency: val.currency,
          status: val.status,
          billing_address_1: val.billing_address_line_1,
          billing_address_2: val.billing_address_line_2,
          billing_city: val.billing_city,
          billing_pincode: val.billing_pincode,
          billing_province: val.billing_province,
          billing_country: val.billing_country,
          shipping_address_1: val.shipping_address_line_1,
          shipping_address_2: val.shipping_address_line_2,
          shipping_city: val.shipping_city,
          shipping_province: val.shipping_province,
          shipping_country: val.shipping_country,
          shipping_pincode: val.shipping_pincode,
          card_no: val.card_no,
          card_token: val.card_id,
          browser_fingerprint:
            val.card_id != ""
              ? await helpers.fetch_browser_fingerprint(val.card_id)
              : "",
          block_for_suspicious_ip: val.block_for_suspicious_ip,
          block_for_suspicious_email: val.block_for_suspicious_email,
          high_risk_country: val.high_risk_country,
          block_for_transaction_limit: val.block_for_transaction_limit,
          high_risk_transaction: val.high_risk_transaction,
          remark: val.remark ? val.remark : "-",
          transaction_date: moment(val.created_at).format("DD-MM-YYYY H:mm:ss"),
          url: val.return_url,
          browser: val.browser,
          browser_version: val.browser_version,
          os: val.os,
          ip: val.ip,
          ip_country: val.ip_country,
          device_type: val.device_type,
          origin: val?.origin ? val?.origin : "",
          psp: val?.psp ? val?.psp : "",
          expiry: val?.expiry ? val?.expiry : "",
          cardholderName: val?.cardholderName ? val?.cardholderName : "",
          scheme: val?.scheme ? val?.scheme : "",
          cardType: val?.cardType ? val?.cardType : "",
          cardCategory: val?.cardCategory ? val?.cardCategory : "",
          pan: val?.pan ? val?.pan : "",
          updated_at: moment(val.updated_at).format("DD-MM-YYYY H:mm:ss"),
          order_txn: update_order_txn,
        };
        send_res = res1;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Transaction details fetched successfully."
            )
          );
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  create_qr_order: async (req, res) => {
    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
      browser_version: req.headers["x-browser-version"],
    };

    const logs = [];
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create_qr_order initiated`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    let headers = req.headers;
    delete headers.xusername;
    delete headers.xpassword;
    delete headers.merchant_key;
    delete headers.merchant_secret;
    delete headers.merchant_secret;
    delete headers.agent;
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );

    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    let billing_details = req.body.data.billing_details;
    let shipping_details = req.body.data.shipping_details;
    let qr_order_data = await merchantOrderModel.selectData(
      req.body.data.order_details.paymentlink_id
    );
    const uid = new ShortUniqueId({
      length: 10,
    });
    let mode = qr_order_data?.mode;
    let order_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_ORD" : "ORD"
    );
    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: order_details?.amount,
      currency: order_details?.currency,
      return_url: order_details?.return_url,
      env: mode,
      merchant_id: qr_order_data?.sub_merchant_id,
    };
    let amount = req.body.data.order_details.amount
      ? req.body.data.order_details.amount
      : 0;
    let quantity = req.body.data.order_details.quantity
      ? req.body.data.order_details.quantity
      : 1;
    let total_amount = amount;
    let token = accessToken(token_payload);
    let ins_body = {
      action: "",
      capture_method: req.body.data.capture_method,
      merchant_id: qr_order_data?.sub_merchant_id,
      payment_id: "",
      mcc: qr_order_data?.mcc_id ? qr_order_data.mcc_id : 0,
      mcc_category: qr_order_data?.mcc_cat_id ? qr_order_data.mcc_cat_id : 0,
      super_merchant: qr_order_data?.super_merchant_id
        ? qr_order_data.super_merchant_id
        : 0,
      customer_name: customer_details.name ? customer_details.name : "",
      customer_email: customer_details.email,
      customer_code: customer_details.code,
      customer_mobile: customer_details.mobile,
      billing_address_line_1: billing_details.address_line1,
      billing_address_line_2: billing_details.address_line2,
      billing_city: billing_details.city,
      billing_pincode: billing_details.pin,
      billing_province: billing_details.province,
      billing_country: billing_details.country,
      shipping_address_line_1: shipping_details.address_line1,
      shipping_address_line_2: shipping_details.address_line2,
      shipping_city: shipping_details.city,
      shipping_country: shipping_details.country,
      shipping_province: shipping_details.province,
      shipping_pincode: shipping_details.pin,
      amount: total_amount,
      currency: order_details?.currency,
      return_url: order_details?.return_url,
      description:
        order_details?.description == ""
          ? "Payment of " + order_details?.currency + " " + total_amount
          : order_details?.description,
      other_description: order_details?.description,
      success_url: req.body.data?.urls?.success,
      failure_url: req.body.data?.urls?.failure,
      cancel_url: req.body.data?.urls?.cancel,
      status: status,
      origin:
        qr_order_data?.type_of_qr_code == "Static_QR" ? "QR" : "PAYMENT LINK",
      order_id: order_id,
      browser: client.browser,
      browser_version: client.browser_version,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
    };
    let qr_ins_body = {
      merchant_qr_id: qr_order_data?.id,
      merchant_id: qr_order_data?.sub_merchant_id,
      order_no: order_id,
      payment_id: req.body.data.order_details.paymentlink_id,
      name: customer_details.name ? customer_details.name : "",
      email: customer_details.email,
      code: customer_details.code,
      mobile: customer_details.mobile,
      type_of_qr_code: qr_order_data.type_of_qr_code,
      amount: order_details.amount,
      currency: order_details.currency,
      quantity: order_details.quantity,
      total_amount: total_amount,
      mode_of_payment: "",
      payment_status: status,
      remark: "",
      mcc: qr_order_data.mcc_id ? qr_order_data.mcc_id : 0,
      mcc_category: qr_order_data.mcc_cat_id ? qr_order_data.mcc_cat_id : 0,
      super_merchant: qr_order_data.super_merchant_id
        ? qr_order_data.super_merchant_id
        : 0,
      added_date: created_at,
      transaction_date: created_at,
      refunded_amount: 0,
    };
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : merchantOrderModel.addDynamic ${JSON.stringify(qr_ins_body)}`
    );
    let add_qr_data = await merchantOrderModel.addDynamic(
      qr_ins_body,
      "qr_payment"
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : merchantOrderModel.add ${JSON.stringify(ins_body)}`
    );
    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        /*  logs.push(
           `${moment().format(
             "DD/MM/YYYY HH:mm:ss.SSS"
           )} : response received ${JSON.stringify(result)}`
         ); */
        let payment_link =
          mode == "test"
            ? process.env.PAYMENT_URL +
              "initiate/" +
              order_id +
              "/" +
              token +
              "/test"
            : process.env.PAYMENT_URL +
              "initiate/" +
              order_id +
              "/" +
              token +
              "/live";
        let res_order_details = {
          status: status,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount: order_details.currency + " " + order_details.amount,
          payment_link: payment_link,
        };
        let log_table = mode == "test" ? "test_order_logs" : "order_logs";

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, log_table)
          .then((result) => {})
          .catch((err) => {
            console.log(err);
            winston.error(err);
          });

        res.status(statusCode.ok).send(res_order_details);
      })
      .catch(async (error) => {
        console.log(error);
        winston.error(error);
        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : response error ${
            error.message
          }`
        );

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, "order_logs")
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  create_invoice_order: async (req, res) => {
    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
      browser_version: req.headers["x-browser-version"],
    };
    const logs = [];
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create_invoice_order initiated`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let record_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
    console.log(`record id is here`);
    console.log(record_id);
    let inv_order_data = await invModel.selectOneInvData({
      id: record_id,
    });
    const uid = new ShortUniqueId({
      length: 10,
    });
    let mode = inv_order_data.mode;
    let order_id = await helpers.make_sequential_no(
      mode == "live" ? "ORD" : "TST_ORD"
    );

    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: inv_order_data.amount,
      currency: inv_order_data.currency,
      return_url: "",
      env: mode,
      merchant_id: inv_order_data.sub_merchant_id,
    };
    let token = accessToken(token_payload);
    let ins_body = {
      merchant_id: inv_order_data.sub_merchant_id,
      cid: inv_order_data.cid ? enc_dec.cjs_encrypt(inv_order_data.cid) : "",
      mcc: inv_order_data.mcc_id ? inv_order_data.mcc_id : 0,
      mcc_category: inv_order_data.mcc_cat_id ? inv_order_data.mcc_cat_id : 0,
      super_merchant: inv_order_data.merchant_id
        ? inv_order_data.merchant_id
        : 0,
      customer_name: inv_order_data.name ? inv_order_data.name : "",
      customer_email: inv_order_data.email,
      customer_code: inv_order_data.code,
      customer_mobile: inv_order_data.mobile,
      billing_address_line_1: inv_order_data.bill_address,
      billing_address_line_2: inv_order_data.bill_address,
      billing_city: await helpers.get_city_name_by_id(inv_order_data.bill_city),
      billing_pincode: inv_order_data.bill_zip_code
        ? inv_order_data.bill_zip_code
        : "",
      billing_province: await helpers.get_state_name_by_id(
        inv_order_data.bill_state
      ),
      billing_country: await helpers.get_country_iso2_by_id(
        inv_order_data.bill_country
      ),
      shipping_address_line_1: inv_order_data.ship_address,
      shipping_address_line_2: inv_order_data.ship_address,
      shipping_city: await helpers.get_city_name_by_id(
        inv_order_data.ship_city
      ),
      shipping_country: await helpers.get_country_iso2_by_id(
        inv_order_data.ship_country
      ),
      shipping_province: await helpers.get_state_name_by_id(
        inv_order_data.ship_state
      ),
      description: inv_order_data.description
        ? inv_order_data.description
        : "NA",
      other_description: inv_order_data.description
        ? inv_order_data.description
        : "NA",
      shipping_pincode: inv_order_data.ship_zip_code
        ? inv_order_data.ship_zip_code
        : "",
      amount: inv_order_data.total_amount,
      currency: inv_order_data.currency,
      // return_url: process.env.PAYMENT_URL + "status",
      // success_url: process.env.PAYMENT_URL + "status",
      // failure_url: process.env.PAYMENT_URL + "status",
      // cancel_url: process.env.PAYMENT_URL + "status",
      origin: "INVOICE",
      status: status,
      order_id: order_id,
      browser: client.browser,
      browser_version: client.browser_version,
      ip: client.ip,
      os: client.os,
      action: "AUTH",
      created_at: created_at,
      updated_at: updated_at,
    };
    let invoice_body = {
      order_id: order_id,
    };
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : invModel.updateDynamic for id = ${record_id}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : invModel.updateDynamic with data ${JSON.stringify(invoice_body)}`
    );
    let update_invoice_data = await invModel.updateDynamic(
      invoice_body,
      {
        id: record_id,
      },
      "inv_invoice_master"
    );
    logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : mode ${mode}`);
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : merchantOrderModel.add with data ${JSON.stringify(ins_body)}`
    );
    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(result)}`
        );
        let res_order_details = {
          status: status,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount: inv_order_data.currency + " " + inv_order_data.total_amount,
          payment_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            +order_id +
            "/" +
            token +
            "/" +
            mode,
        };

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, "order_logs")
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res.status(statusCode.ok).send(res_order_details);
      })
      .catch(async (error) => {
        winston.error(error);
        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred ${
            error.message
          }`
        );

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, "order_logs")
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  add_subscription: async (req, res) => {
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let record_id = req.bodyString("token");
    let subs_order_data = await merchantOrderModel.selectDynamicONE(
      "*",
      {
        ref_no: record_id,
        deleted: 0,
        status: 0,
      },
      "subs_plans"
    );
    let get_count = await merchantOrderModel.subscription_count(
      {
        payment_id: record_id.toString(),
        status: 0,
      },
      "subscription"
    );

    if (get_count == 0) {
      let qr_ins_body = {
        subscription_id: await helpers.make_sequential_no("SUB"),
        plan_id: subs_order_data.id,
        payment_id: record_id,
        plan_name: subs_order_data.plan_name,
        plan_description: subs_order_data.plan_description,
        plan_billing_frequency: subs_order_data.plan_billing_frequency,
        plan_currency: subs_order_data.plan_currency,
        plan_billing_amount: subs_order_data.plan_billing_amount,
        payment_interval: subs_order_data.payment_interval,
        initial_payment_amount: subs_order_data.initial_payment_amount,
        final_payment_amount: subs_order_data.final_payment_amount,
        start_date: moment(subs_order_data.start_date).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        terms: subs_order_data.terms,
        status: 1,
        super_merchant: subs_order_data.merchant_id
          ? subs_order_data.merchant_id
          : 0,
        added_date: created_at,
      };

      merchantOrderModel
        .addDynamic(qr_ins_body, "subscription")
        .then((result) => {
          let res_order_details = {
            status: subs_order_data.status,
          };
          res.status(statusCode.ok).send({
            status: "success",
          });
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else {
      res.status(statusCode.ok).send({
        status: "success",
      });
    }
  },

  create_subs_order: async (req, res) => {
    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
    };
    const logs = [];
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create_subs_order initiated`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let record_id = req.bodyString("token");
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : subs_plan_model.selectOneDynamic of id = ${record_id}`
    );
    let find = await subs_plan_model.selectOneDynamic(
      "*",
      {
        ref_no: record_id,
      },
      "subs_plans"
    );

    const uid = new ShortUniqueId({
      length: 10,
    });
    let mode = find.mode == 1 ? "live" : "test";
    let order_id = await helpers.make_sequential_no(
      mode == "live" ? "ORD" : "TST_ORD"
    );
    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: find.initial_payment_amount,
      currency: find.plan_currency,
      return_url: process.env.PAYMENT_URL + "status",
      env: mode,
      merchant_id: find.submerchant_id,
    };
    let token = accessToken(token_payload);
    let ins_body = {
      action: "SALE",
      merchant_id: find.submerchant_id,
      payment_id: "",
      super_merchant: find.merchant_id,
      customer_name: req.bodyString("name"),
      customer_email: req.bodyString("email"),
      customer_code: req.bodyString("mobile_code"),
      customer_mobile: req.bodyString("mobile_no"),
      billing_address_line_1: req.bodyString("address"),
      billing_address_line_2: "",
      billing_city: req.bodyString("city"),
      billing_pincode: "",
      billing_province: "",
      billing_country: req.bodyString("country"),
      shipping_address_line_1: "",
      shipping_address_line_2: "",
      shipping_city: "",
      shipping_country: "",
      shipping_province: "",
      shipping_pincode: "",
      description: find.plan_description,
      other_description: find.plan_description,
      // amount: find.plan_billing_amount,
      amount: find.initial_payment_amount,
      currency: find.plan_currency,
      // return_url: process.env.PAYMENT_URL + "status",
      // success_url: process.env.PAYMENT_URL + "status",
      //  failure_url: process.env.PAYMENT_URL + "status",
      //  cancel_url: process.env.PAYMENT_URL + "status",
      status: status,
      origin: "SUBSCRIPTION",
      order_id: order_id,
      browser: client.browser,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
    };
    logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : mode ${mode}`);

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : subs_plan_model.selectOneDynamic ${JSON.stringify({
        email: req.bodyString("email"),
        plan_id: find.id,
      })}`
    );

    // Subscription condition logic for payment
    let update_subscription = {
      name: req.bodyString("name"),
      email: req.bodyString("email"),
      mobile_no: req.bodyString("mobile_no"),
      mobile_code: req.bodyString("mobile_code"),
      //subscription_id: await helpers.make_sequential_no("SUB"),
      plan_id: find.id,
      payment_id: record_id,
      plan_name: find.plan_name,
      plan_description: find.plan_description,
      plan_billing_frequency: find.plan_billing_frequency,
      plan_currency: find.plan_currency,
      plan_billing_amount: find.plan_billing_amount,
      payment_interval: find.payment_interval,
      initial_payment_amount: find.initial_payment_amount,
      final_payment_amount: find.final_payment_amount,
      start_date: moment(find.start_date).format("YYYY-MM-DD HH:mm:ss"),
      terms: find.terms,
      status: 1,
      merchant_id: find.submerchant_id ? find.submerchant_id : 0,
      super_merchant: find.merchant_id ? find.merchant_id : 0,
      added_date: created_at,
    };
    let qr_ins_body = {
      merchant_id: find.submerchant_id,
      order_no: order_id,
      payment_status: status,
      subs_email: req.bodyString("email"),
      mode_of_payment: "",
      remark: "",
      super_merchant: find.merchant_id,
      added_date: created_at,
      transaction_date: created_at,
      plan_id: find.id,
    };
    const subscription_reuslt = await subscription_check.getSubscription(
      req.bodyString("email"),
      find.id
    );

    if (subscription_reuslt === undefined) {
      //create new subscription
      update_subscription.subscription_id = await helpers.make_sequential_no(
        "SUB"
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : already_subscribe is false`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : subs_plan_model.addDynamic with data ${JSON.stringify(
          update_subscription
        )}`
      );
      // Added new subscription
      await subs_plan_model.addDynamic(update_subscription, "subscription");
      qr_ins_body.subscription_id = update_subscription.subscription_id;
    } else {
      const { subscription_id } = subscription_reuslt;
      const { unpaid_recurring } =
        await subscription_check.checkForSubscriptionRecurring(subscription_id);
      if (subscription_id && unpaid_recurring === 0) {
        //create new subscription if user old subscription is end
        update_subscription.subscription_id = await helpers.make_sequential_no(
          "SUB"
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : already_subscribe is false`
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : subs_plan_model.addDynamic with data ${JSON.stringify(
            update_subscription
          )}`
        );

        // Added new subscription
        await subs_plan_model.addDynamic(update_subscription, "subscription");
        qr_ins_body.subscription_id = update_subscription.subscription_id;
      } else {
        //subscription is already
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : already_subscribe is true`
        );
        qr_ins_body.subscription_id = subscription_id;
      }
    }
    //return res.status(statusCode.ok).send('res_order_details');
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : merchantOrderModel.addDynamic with data ${JSON.stringify(
        qr_ins_body
      )}`
    );

    let add_qr_data = await merchantOrderModel.addDynamic(
      qr_ins_body,
      "subs_payment"
    );
    // Subscription condition logic for payment end
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : merchantOrderModel.add with data ${JSON.stringify(ins_body)}`
    );
    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(result)}`
        );
        let res_order_details = {
          status: status,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount:
            find.plan_currency + " " + find.plan_billing_amount.toFixed(2),
          // find.initial_payment_amount.toFixed(2),
          payment_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "/" +
            mode,
        };

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, "order_logs")
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res.status(statusCode.ok).send(res_order_details);
      })
      .catch(async (error) => {
        winston.error(error);
        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : received error ${
            error.message
          }`
        );

        let logs_payload = {
          order_id: order_id,
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .add(logs_payload, "order_logs")
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  order_cancel: async (req, res, next) => {
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    // var updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiated MerchantOrder.order_cancel`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : captured_data orderTransactionModel.selectOne`
    );

    let captured_data = await orderTransactionModel.selectOne(
      "capture_no,amount,currency",
      {
        order_id: req.bodyString("order_id"),
        status: "CAPTURED",
      },
      "order_txn"
    );

    let await_3ds_data = await orderTransactionModel.selectOne(
      "payment_id,order_reference_id,capture_no",
      {
        order_id: req.bodyString("order_id"),
        status: "AWAIT_3DS",
      },
      "order_txn"
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiated await_3ds_data orderTransactionModel.selectOne`
    );

    if (captured_data && await_3ds_data) {
      try {
        let capture_data = {
          orderNo: await_3ds_data.order_reference_id,
          payment_id: await_3ds_data.payment_id,
          capture_no: captured_data.capture_no,
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : initiated ni_capture orderCancel with data ${JSON.stringify(
            capture_data
          )}`
        );
        var ni_capture = await orderCancel(capture_data);

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(ni_capture)}`
        );

        if (ni_capture) {
          let order_update = {
            status: "VOID",
          };
          await merchantOrderModel.updateDynamic(
            order_update,
            {
              order_id: req.bodyString("order_id"),
            },
            "orders"
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic ${JSON.stringify(
              order_update
            )}`
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic ${req.bodyString("order_id")}`
          );
          const uid = new ShortUniqueId({
            length: 10,
          });
          let generate_payment_id = await helpers.make_sequential_no("TXN");
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : generate_payment_id helpers.make_sequential_no ${generate_payment_id}`
          );
          let order_txn = {
            order_id: req.bodyString("order_id"),
            type: "VOID",
            txn: generate_payment_id,
            status: ni_capture._embedded["cnp:capture"][0].state,
            amount: captured_data.amount,
            currency: captured_data.currency,
            remark: req.bodyString("remark"),
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          await orderTransactionModel.add(order_txn);
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.add ${JSON.stringify(order_txn)}`
          );
          let resp_dump = {
            order_id: req.bodyString("order_id"),
            type: "VOID",
            status: "APPROVED",
            dump: JSON.stringify(ni_capture),
          };
          await orderTransactionModel.addResDump(resp_dump);
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump ${JSON.stringify(resp_dump)}`
          );
          let res_obj = {
            order_status: ni_capture._embedded["cnp:capture"][0].state,
            payment_id: order_txn.txn,
            order_id: order_txn.order_id,
            amount: order_txn.amount,
            currency: order_txn.currency,
            "3ds": ni_capture["3ds"],
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : response object ${JSON.stringify(res_obj)}`
          );
          let logs_payload = {
            order_id: req.bodyString("order_id"),
            activity: JSON.stringify(logs),
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          res
            .status(statusCode.ok)
            .send(
              response.successansmsg(res_obj, "Transaction successfully void.")
            );
        } else {
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Unable to initiate refund.`
          );
          let logs_payload = {
            order_id: req.bodyString("order_id"),
            activity: JSON.stringify(logs),
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          res
            .status(statusCode.ok)
            .send(response.errormsg("Unable to initiate refund."));
        }
      } catch (error) {
        winston.error(error);
        let resp_dump = {
          order_id: req.bodyString("order_id"),
          type: "VOID",
          status: "FAILED",
          dump: JSON.stringify(error.response.data),
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : error orderTransactionModel.addResDump ${JSON.stringify(
            resp_dump
          )}`
        );
        await orderTransactionModel.addResDump(resp_dump);

        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred ${
            error.response.data.errors[0].message
          }`
        );
        let logs_payload = {
          order_id: req.bodyString("order_id"),
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .update_logs_data(
            {
              order_id: req.bodyString("order_id"),
            },
            logs_payload
          )
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.ok)
          .send(response.errormsg(error.response.data.errors[0].message));
      }
    } else {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Unable to void transaction`
      );
      let logs_payload = {
        order_id: req.bodyString("order_id"),
        activity: JSON.stringify(logs),
      };
      let log_is = await order_logs
        .update_logs_data(
          {
            order_id: req.bodyString("order_id"),
          },
          logs_payload
        )
        .then((result) => {})
        .catch((err) => {
          winston.error(err);
        });
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to void transaction"));
    }
  },

  order_refund: async (req, res, next) => {
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    // var updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiated MerchantOrder.order_refund`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    let captured_data = await orderTransactionModel.selectOne(
      "*",
      {
        order_id: req.bodyString("order_id"),
        status: "CAPTURED",
      },
      "order_txn"
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : orderTransactionModel.selectOne ${req.bodyString("order_id")}`
    );
    if (captured_data) {
      try {
        let capture_data = {
          orderNo: captured_data?.order_reference_id,
          payment_id: captured_data?.payment_id,
          capture_no: captured_data?.capture_no,
          currency: req.body.amount?.currencyCode,
          amount: parseFloat(req.body?.amount.value),
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : initiate ni_capture orderRefund ${JSON.stringify(capture_data)}`
        );
        var ni_capture = await orderRefund(capture_data);
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(ni_capture)}`
        );

        if (ni_capture) {
          let order_update = {
            status: "REFUNDED",
          };
          await merchantOrderModel.updateDynamic(
            order_update,
            {
              order_id: req.bodyString("order_id"),
            },
            "orders"
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic ${req.bodyString("order_id")}`
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
              order_update
            )}`
          );
          const uid = new ShortUniqueId({
            length: 10,
          });
          let generate_payment_id = uid();
          let order_txn = {
            order_id: req.bodyString("order_id"),
            type: "REFUND",
            txn: "TXN" + generate_payment_id.toUpperCase(),
            status: ni_capture._embedded["cnp:capture"][0].state,
            amount: req.body.amount.value,
            currency: req.body.amount.currencyCode,
            remark: req.bodyString("remark"),
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          await orderTransactionModel.add(order_txn);
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.add with data ${JSON.stringify(
              order_txn
            )}`
          );
          let resp_dump = {
            order_id: req.bodyString("order_id"),
            type: "REFUND",
            status: "APPROVED",
            dump: JSON.stringify(ni_capture),
          };
          await orderTransactionModel.addResDump(resp_dump);
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump ${JSON.stringify(resp_dump)}`
          );
          let res_obj = {
            order_status: ni_capture._embedded["cnp:capture"][0].state,
            payment_id: order_txn.txn,
            order_id: order_txn.order_id,
            amount: order_txn.amount,
            currency: order_txn.currency,
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : response object Refunded Successfully. ${JSON.stringify(
              res_obj
            )}`
          );
          let logs_payload = {
            order_id: req.bodyString("order_id"),
            activity: JSON.stringify(logs),
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          res
            .status(statusCode.ok)
            .send(response.successansmsg(res_obj, "Refunded Successfully."));
        } else {
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : response Order is not at captured state!`
          );
          let logs_payload = {
            order_id: req.bodyString("order_id"),
            activity: JSON.stringify(logs),
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: req.bodyString("order_id"),
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          res
            .status(statusCode.ok)
            .send(response.errormsg("Order is not at captured state!"));
        }
      } catch (error) {
        winston.error(error);
        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred ${
            error.response.data.errors[0].message
          }`
        );
        let resp_dump = {
          order_id: req.bodyString("order_id"),
          type: "REFUND",
          status: "FAILED",
          dump: JSON.stringify(error.response.data),
        };
        await orderTransactionModel.addResDump(resp_dump);
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : error orderTransactionModel.addResDump ${JSON.stringify(
            resp_dump
          )}`
        );

        let logs_payload = {
          order_id: req.bodyString("order_id"),
          activity: JSON.stringify(logs),
        };
        let log_is = await order_logs
          .update_logs_data(
            {
              order_id: req.bodyString("order_id"),
            },
            logs_payload
          )
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.ok)
          .send(response.errormsg(error.response.data.errors[0].message));
      }
    } else {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Transaction is not in Capture State or Already Refunded.`
      );
      let logs_payload = {
        order_id: req.bodyString("order_id"),
        activity: JSON.stringify(logs),
      };
      let log_is = await order_logs
        .update_logs_data(
          {
            order_id: req.bodyString("order_id"),
          },
          logs_payload
        )
        .then((result) => {})
        .catch((err) => {
          winston.error(err);
        });
      res
        .status(statusCode.ok)
        .send(
          response.errormsg(
            "Transaction is not in Capture State or Already Refunded."
          )
        );
    }
  },

  order_telr_cancel: async (req, res, next) => {
    let checkPSP = await orderTransactionModel.selectOne(
      "psp",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    let checkStatus = await orderTransactionModel.selectOne(
      "status",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    if (checkStatus?.status === "VOID") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is already Void."));
    } else if (checkStatus?.status !== "CAPTURED") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is not captured yet."));
    } else {
      if (checkPSP) {
        switch (checkPSP.psp) {
          case "TELR":
            await telr_void_func(req, res);
            break;
          case "NI":
            await ni_void_func(req, res);
            break;
          default:
            res
              .status(statusCode.ok)
              .send(
                response.errormsg("Unable to void transaction - Invalid PSP")
              );
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Unable to void transaction - Invalid PSP or Order Id"
            )
          );
      }
    }
  },

  order_void_case: async (req, res, next) => {
    let checkPSP = await orderTransactionModel.selectOne(
      "psp,merchant_id",
      {
        order_id: req.bodyString("order_id"),
        super_merchant: req.user.id,
      },
      "orders"
    );
    let checkStatus = await orderTransactionModel.selectOne(
      "status,voidWithinDatetime",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    const voidWithinDatetime = checkStatus?.voidWithinDatetime;

    if (voidWithinDatetime) {
      const currentMoment = moment();
      const voidMoment = moment(voidWithinDatetime);

      if (voidMoment.isAfter(currentMoment)) {
        // voidWithinDatetime is greater than the current date and time
        return res
          .status(statusCode.ok)
          .send(response.errormsg("Cannot VOID this order now"));
      }
    } else {
      return res
        .status(statusCode.ok)
        .send(response.errormsg("Cannot VOID this order"));
    }

    if (checkStatus?.status === "VOID") {
      return res
        .status(statusCode.ok)
        .send(response.errormsg("Order is already Void."));
    }
    if (checkPSP) {
      switch (checkPSP.psp) {
        case "TELR":
          await telr_void_func(req, res);
          break;
        case "NI":
          await ni_void_func(req, res);
          break;
        case "PAYTABS":
          await PayTabsController.paytabs_void(req, res);
          break;
        default:
          res
            .status(statusCode.ok)
            .send(
              response.errormsg("Unable to void transaction - Invalid PSP")
            );
      }
    } else {
      res
        .status(statusCode.ok)
        .send(
          response.errormsg(
            "Unable to void transaction - Invalid PSP or Order Id"
          )
        );
    }
  },

  open_telr_refund: async (req, res) => {
    let checkPSP = await orderTransactionModel.selectOne(
      "psp",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    let checkStatus = await orderTransactionModel.selectOne(
      "status",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    if (checkStatus.status === "REFUNDED") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is already Refunded."));
    } else if (checkStatus?.status !== "CAPTURED") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is not captured yet."));
    } else {
      if (checkPSP) {
        switch (checkPSP.psp) {
          case "TELR":
            await telr_refund_func(req, res);
            break;
          case "NI":
            await ni_refund_func(req, res);
            break;
          default:
            res
              .status(statusCode.ok)
              .send(
                response.errormsg("Unable to void transaction - Invalid PSP")
              );
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Unable to void transaction - Invalid PSP or Order id"
            )
          );
      }
    }
  },

  order_refund_case: async (req, res) => {
    let checkPSP = await orderTransactionModel.selectOne(
      "psp,merchant_id",
      {
        order_id: req.bodyString("order_id"),
        super_merchant: req.user.id,
      },
      "orders"
    );
    let checkStatus = await orderTransactionModel.selectOne(
      "status",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id,allowRefunds",
      {
        terminal_id: _terminalids.terminal_id,
      },
      "mid"
    );

    if (!_getmid) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("No Terminal Available"));
    }
    if (_getmid?.allowRefunds == 0) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Cannot refund this Order"));
    }

    if (checkStatus.status === "REFUNDED") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is already Refunded."));
    } else {
      if (checkPSP) {
        switch (checkPSP.psp) {
          case "TELR":
            await telr_refund_func(req, res);
            break;
          case "NI":
            await ni_refund_func(req, res);
            break;
          case "PAYTABS":
            await PayTabsController.paytabs_refund(req, res);
            break;
          default:
            return res
              .status(statusCode.ok)
              .send(
                response.errormsg("Unable to void transaction - Invalid PSP")
              );
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Unable to void transaction - Invalid PSP or Order id"
            )
          );
      }
    }
  },

  // order_telr_refund: async (req, res, next) => {
  //     const {} = req.body;
  //     let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
  //     let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
  //     let telr_sale_request = req.body;
  //     let res_order_data = await orderTransactionModel.selectWithJoin(
  //         "t1.status,t1.order_id,t1.currency,t1.amount",
  //         { order_id: req.bodyString("order_id") },
  //         "orders",
  //         "order_txn",
  //         "t1.order_id=t2.order_id"
  //     );
  //     if (res_order_data && res_order_data.status == "AWAIT_3DS") {
  //         let browser_token_enc = req.browser_fingerprint;
  //         if (!browser_token_enc) {
  //             let browser_token = {
  //                 os: req.headers.os,
  //                 browser: req.headers.browser,
  //                 browser_version: req.headers['x-browser-version'],
  //                 browser_fingerprint: req.headers.fp ? req.headers.fp : "",
  //                 email: req.bodyString("email")
  //                     ? req.bodyString("email")
  //                     : "",
  //             };
  //             browser_token_enc = enc_dec.cjs_encrypt(
  //                 JSON.stringify(browser_token)
  //             );
  //         }

  //         const uid = new ShortUniqueId({ length: 10 });
  //         let generate_payment_id = uid();
  //         let payment_id = await helpers.make_sequential_no("TXN");
  //         let order_txn_update = {
  //             txn: payment_id,
  //             order_id: res_order_data.order_id,
  //             currency: res_order_data.currency,
  //             amount: res_order_data.amount,
  //             type: "PAYMENT",
  //             status: telr_sale_request.state,
  //             created_at: updated_at,
  //         };
  //         await orderTransactionModel.add(order_txn_update);
  //         let order_update = {
  //             status: telr_sale_request.state,
  //             cardholderName: telr_sale_request.paymentMethod.cardholderName,
  //             expiry: telr_sale_request.paymentMethod.expiry,
  //             scheme: telr_sale_request.paymentMethod.name,
  //             cardType: telr_sale_request.paymentMethod.cardType,
  //             cardCategory: telr_sale_request.paymentMethod.cardCategory,
  //             pan: telr_sale_request.paymentMethod.pan,
  //             updated_at: updated_at,
  //         };
  //         await merchantOrderModel
  //             .updateDynamic(
  //                 order_update,
  //                 { order_id: res_order_data.order_id },
  //                 "orders"
  //             )
  //             .then((result) => {
  //                 let res_obj = {
  //                     order_status: telr_sale_request.state,
  //                     payment_id: payment_id,
  //                     order_id: res_order_data.order_id,
  //                     amount: res_order_data.amount,
  //                     currency: res_order_data.currency,
  //                     token: browser_token_enc,
  //                 };
  //                 res.status(statusCode.ok).send(
  //                     successdatamsg(res_obj, "Successfully.")
  //                 );
  //             })
  //             .catch((error) => {
  //                 res.status(statusCode.internalError).send(
  //                     response.errormsg(error.message)
  //                 );
  //             });
  //     } else {
  //         res.status(statusCode.ok).send(
  //             response.errormsg(
  //                 "Invalid order reference or already processed"
  //             )
  //         );
  //     }
  // },

  // telr_update_3ds: async (req, res, next) => {
  //     try {
  //         const order_details = await orderTransactionModel.selectOne(
  //             "*",
  //             { order_id: req.body.order_id },
  //             "orders"
  //         );
  //         if (!order_details) {
  //             return res
  //                 .status(statusCode.badRequest)
  //                 .send(response.errormsg("Invalid Order Id"));
  //         }
  //         const status = "CAPTURED";
  //         let sale_payload = {
  //             type: "sale",
  //             classValue: "ecom",
  //             currency: order_details?.currency,
  //             amount: order_details?.amount,
  //             description: req.body.description,
  //             cvv: req.body.cvv,
  //             session: req.body?.telr_session,
  //             billingNameFirst: req.body.name.split(" ")[0],
  //             billingNameLast: req.body.name.split(" ")[1],
  //             billingLine1: order_details?.billing_address_line_1,
  //             billingLine2: order_details?.billing_address_line_2,
  //             billingCity: order_details?.billing_city,
  //             billingRegion: order_details?.billing_province,
  //             billingCountry: order_details?.billing_country,
  //             billingZip: order_details?.billing_pincode,
  //             email: req.body.email,
  //             ip: req.headers.ip,
  //             order_id: req.body?.order_id,
  //         };

  //         if (req.bodyString("card_id")) {
  //             sale_payload.card = await enc_dec.dynamic_decryption(
  //                 card_details.card_number,
  //                 card_details.cipher_id
  //             );
  //             sale_payload.expiry_month =
  //                 card_details.card_expiry.split("/")[0];
  //             sale_payload.expiry_year =
  //                 card_details.card_expiry.split("/")[1];
  //         } else {
  //             sale_payload.card = req.body.card;
  //             sale_payload.expiry_month = req.body.expiry_date.split("/")[0];
  //             sale_payload.expiry_year = req.body.expiry_date.split("/")[1];
  //         }
  //         sale_api_res = await telr_sale.makeSaleRequest(sale_payload);
  //     } catch (error) {
  //         res.status(statusCode.ok).send(response.errormsg(error?.message));
  //     }
  // },

  telr_update_3ds: async (req, res, next) => {
    let logs = await order_logs.get_log_data(req.bodyString("order_id"));
    try {
      const order_details = await orderTransactionModel.selectOne(
        "*",
        {
          order_id: req.body.order_id,
        },
        "orders"
      );
      if (!order_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid Order Id"));
      }

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

      let sale_payload = {
        type: "sale",
        classValue: "ecom",
        currency: order_details?.currency,
        amount: order_details?.amount,
        description: order_details?.description,
        cvv: req.body.cvv,
        session: req.body?.telr_session,
        pareq: req.body?.telr_pareq,
        billingNameFirst: order_details?.customer_name.split(" ")[0] || "",
        billingNameLast: order_details?.customer_name.split(" ")[1] || "",
        billingLine1: order_details?.billing_address_line_1,
        billingLine2: order_details?.billing_address_line_2,
        billingCity: order_details?.billing_city,
        billingRegion: order_details?.billing_province,
        billingCountry: order_details?.billing_country,
        billingZip: order_details?.billing_pincode,
        email: order_details?.email,
        ip: req.headers.ip,
        order_id: req.body?.order_id,
      };

      if (req.bodyString("card_id")) {
        sale_payload.card = await enc_dec.dynamic_decryption(
          card_details.card_number,
          card_details.cipher_id
        );
        sale_payload.expiry_month = card_details?.card_expiry.split("/")[0];
        sale_payload.expiry_year = card_details?.card_expiry?.split("/")[1];
      } else {
        sale_payload.card = req.body.card;
        sale_payload.expiry_month = req.body?.expiry_date?.split("/")[0];
        sale_payload.expiry_year = req.body?.expiry_date?.split("/")[1];
      }

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : make 3ds payment initilize`
      );

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.bodyString("order_id"),
        },
        "orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );
      if (!_getmid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Routes  Available for Transection"));
      }
      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].checkout_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      const sale_api_res = await telr_sale.make3DSSaleRequest(
        sale_payload,
        _terminalcred
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : telr_sale.make3DSSaleRequest with data ${JSON.stringify(
          sale_api_res
        )}`
      );
      if (sale_api_res.status === "A") {
        let order_txn = {
          status: "CAPTURED",
          txn: order_details?.payment_id,
          type: order_details?.action,
          payment_id: sale_api_res?.tranref,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          order_reference_id: "",
          capture_no: "",
        };
        await orderTransactionModel.add(order_txn);
        let orderupdate = {
          status: "CAPTURED",
          psp: "TELR",
        };
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: req.bodyString("order_id"),
          },
          "orders"
        );

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : updated transection with data  ${JSON.stringify(
            order_txn
          )}, ${JSON.stringify(orderupdate)}`
        );
        let res_obj = {
          order_status: "CAPTURED",
          payment_id: order_details?.payment_id,
          order_id: req.body.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          token: req.body.browserFP || "",
        };
        // adding dump entry
        let response_dump = {
          order_id: res_order_data.order_id,
          type: "Payment",
          status: "APPROVED",
          dump: JSON.stringify(sale_api_res),
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : data into dump  with data  ${JSON.stringify(response_dump)}`
        );
        await orderTransactionModel.addResDump(response_dump);
        // Adding event base charges update in payment
        ee.once("ping", async (arguments) => {
          // Sending mail to customers and merchants about transaction
          let order_id = req.bodyString("order_id");
          let qb = await pool.get_connection();
          let merchant_and_customer_transaction_response;
          try {
            merchant_and_customer_transaction_response = await qb
              .select(
                "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
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
          try {
            let charges = {
              sell_charges: 0.0,
              buy_charges: 0.0,
              sell_tax: 0.0,
              buy_tax: 0.0,
            };
            let response = await qb
              .select("transaction_setup_id,super_merchant_id")
              .where({
                id: req.order.merchant_id,
              })
              .get(config.table_prefix + "master_merchant");
            let transaction_setup_id = response[0].transaction_setup_id;
            let payment_amount = req.order.amount;

            // referral bonus codes here

            let super_merchant_id = response[0].super_merchant_id;

            let referral_code_used = await qb
              .select("referral_code_used")
              .where({
                id: super_merchant_id,
              })
              .get(config.table_prefix + "master_super_merchant");

            if (referral_code_used[0]) {
              let referrer = await qb
                .select("currency, id")
                .where({
                  referral_code: referral_code_used[0]["referral_code_used"],
                })
                .get(config.table_prefix + "referrers");
              if (referrer[0]) {
                let referral_bonus_data = await qb
                  .select("fix_amount,per_amount,apply_greater")
                  .where({
                    currency: referrer[0]["currency"],
                  })
                  .get(config.table_prefix + "master_referral_bonus");

                // amount calculation
                let amount = 0;
                let total_fix_amount = referral_bonus_data[0].fix_amount;
                let total_per_amount =
                  payment_amount * (referral_bonus_data[0].per_amount / 100);

                if (referral_bonus_data[0].apply_greater === 1) {
                  amount =
                    total_fix_amount > total_per_amount
                      ? total_fix_amount
                      : total_per_amount;
                } else {
                  amount =
                    total_fix_amount < total_per_amount
                      ? total_fix_amount
                      : total_per_amount;
                }

                // record data
                let bonusData = {
                  referrer_id: referrer[0].id,
                  currency: referrer[0].currency,
                  amount: amount,
                  remark: `Benefit for transaction of ${order_id}`,
                  ref_no: await helpers.make_reference_number("REF", 7),
                  created_at: moment("YYYY-MM-DD"),
                };

                // adding record to database
                await ReferralBonusModel.addBonus(bonusData)
                  .then((result) => {})
                  .catch((error) => {
                    winston.error(error);
                  });
              }

              // referral bonus codes here

              let selection =
                "cmm.currency,cmm.charges_type,cmm.payment_mode,cts.buy_per_charges,cts.buy_fix_amount,buy_min_charge_amount,cts.buy_max_charge_amount,cts.buy_tax,cts.sell_per_charges,cts.sell_min_charge_amount,cts.sell_max_charge_amount,cts.sell_fixed_amount,cts.sell_tax";
              let transaction_slab_response = await qb
                .select(selection)
                .from(config.table_prefix + "charges_transaction_setup cmm")
                .join(
                  config.table_prefix + "charges_transaction_slab cts",
                  "cmm.id=cts.transaction_setup_id",
                  "inner"
                )
                .where({
                  "cmm.id": transaction_setup_id,
                })
                .where({
                  "cts.buy_from_amount <=": payment_amount,
                })
                .where({
                  "cts.buy_to_amount >=": payment_amount,
                })
                .get();
              // meta part
              let charges_data = transaction_slab_response[0];

              if (charges_data) {
                let allowed_currency = charges_data.currency;
                let allowed_payment_mode = charges_data.payment_mode.replace(
                  /'/g,
                  ""
                );
                let charges_type = charges_data.charges_type;
                let payment_currency = req.order.currency;
                let payment_mode_array = allowed_payment_mode.split(",");
                let currency_array = allowed_currency.split(",");
                let payment_mode = req.bodyString("payment_mode");
                // amounts part
                if (charges_type != "Volume_Base") {
                  if (
                    currency_array.includes(payment_currency) &&
                    payment_mode_array.includes(payment_mode)
                  ) {
                    // sell charges
                    let sell_charge_per = charges_data.sell_per_charges;
                    let sell_fix_amount = charges_data.sell_fixed_amount;
                    let sell_min_charge = charges_data.sell_min_charge;
                    let sell_max_charge_amount =
                      charges_data.sell_max_charge_amount;
                    let sell_charge_tax = charges_data.sell_tax;
                    // sell charge by percentage
                    let sell_charge = (sell_charge_per / 100) * payment_amount;
                    //add fix amount to it
                    sell_charge = sell_charge + sell_fix_amount;
                    //check if its less than min
                    if (sell_charge <= sell_min_charge) {
                      sell_charge = sell_min_charge;
                    }
                    //check if its greater than max
                    if (sell_charge >= sell_max_charge_amount) {
                      sell_charge = sell_max_charge_amount;
                    }
                    //calculate tax

                    let sell_tax = (sell_charge_tax / 100) * sell_charge;

                    //Buy Charges
                    let buy_charge_per = charges_data.buy_per_charges;
                    let buy_fix_amount = charges_data.buy_fix_amount;
                    let buy_min_charge = charges_data.buy_min_charge_amount;
                    let buy_max_charge_amount =
                      charges_data.buy_max_charge_amount;
                    let buy_charge_tax = charges_data.buy_tax;
                    // sell charge by percentage
                    let buy_charge = (buy_charge_per / 100) * payment_amount;
                    //add fix amount to it
                    buy_charge = buy_charge_per + buy_fix_amount;
                    //check if its less than min
                    if (buy_charge <= buy_min_charge) {
                      buy_charge = buy_min_charge;
                    }
                    //check if its greater than max
                    if (buy_charge >= buy_max_charge_amount) {
                      buy_charge = buy_max_charge_amount;
                    }
                    //calculate tax
                    let buy_tax = (buy_charge_tax / 100) * buy_charge;
                    charges.sell_charges = sell_charge;
                    charges.buy_charges = buy_charge;
                    charges.sell_tax = sell_tax;
                    charges.buy_tax = buy_tax;
                    let updateCharges = {
                      sale_charge: charges.sell_charges,
                      sale_tax: charges.sell_tax,
                      buy_charge: charges.buy_charges,
                      buy_tax: charges.buy_tax,
                    };
                    await merchantOrderModel.updateDynamic(
                      updateCharges,
                      {
                        order_id: req.bodyString("order_id"),
                      },
                      table_name
                    );
                  } else {
                    let updateCharges = {
                      sale_charge: charges.sell_charges,
                      sale_tax: charges.sell_tax,
                      buy_charge: charges.buy_charges,
                      buy_tax: charges.buy_tax,
                    };
                    await merchantOrderModel.updateDynamic(
                      updateCharges,
                      {
                        order_id: req.bodyString("order_id"),
                      },
                      table_name
                    );
                  }
                } else {
                  let updateCharges = {
                    sale_charge: charges.sell_charges,
                    sale_tax: charges.sell_tax,
                    buy_charge: charges.buy_charges,
                    buy_tax: charges.buy_tax,
                  };
                  await merchantOrderModel.updateDynamic(
                    updateCharges,
                    {
                      order_id: req.bodyString("order_id"),
                    },
                    table_name
                  );
                }
              } else {
                let updateCharges = {
                  sale_charge: charges.sell_charges,
                  sale_tax: charges.sell_tax,
                  buy_charge: charges.buy_charges,
                  buy_tax: charges.buy_tax,
                };
                await merchantOrderModel.updateDynamic(
                  updateCharges,
                  {
                    order_id: req.bodyString("order_id"),
                  },
                  table_name
                );
              }
            }
          } catch (error) {
            winston.error(error);
            return error.response;
          }
        });
        ee.emit("ping", {
          message: "hello",
        });
        // event base charges update end

        /* added logs into database*/
        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await order_logs
          .update_logs_data(
            {
              order_id: req.bodyString("order_id"),
            },
            logs_payload
          )
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        return res
          .status(statusCode.ok)
          .send(successdatamsg(res_obj, "Paid successfully."));
      } else {
        const status = "FAILED";
        let order_txn = {
          status: status,
          txn: order_details?.payment_id,
          type: "PAYMENT",
          payment_id: sale_api_res?.tranref,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          order_reference_id: "",
          capture_no: "",
        };
        await orderTransactionModel.add(order_txn);

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} :order txn  with data  ${JSON.stringify(order_txn)}`
        );
        let orderupdate = {
          status: status,
          psp: "TELR",
        };
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: req.bodyString("order_id"),
          },
          "orders"
        );

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} :order update  with data  ${JSON.stringify(orderupdate)}`
        );

        // adding dump entry
        let response_dump = {
          order_id: req.body?.order_id,
          type: "Payment",
          status: status,
          dump: JSON.stringify(sale_api_res),
        };
        await orderTransactionModel.addResDump(response_dump);

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} :response_dump - ${JSON.stringify(response_dump)}`
        );

        let res_obj = {
          order_status: status,
          payment_id: order_details?.payment_id,
          order_id: req.body?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          token: req.body.browserFP || "",
        };

        /* added logs into database*/
        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await order_logs
          .update_logs_data(
            {
              order_id: req.bodyString("order_id"),
            },
            logs_payload
          )
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        return res
          .status(statusCode.ok)
          .send(response.errorMsgWithData(sale_api_res.message, res_obj));
      }
    } catch (error) {
      winston.error(error);
      return res.status(statusCode.ok).send(response.errormsg(error?.message));
    }
  },

  update_3ds: async (req, res, next) => {
    const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let order_table = "orders";
    let txn_table = "order_txn";
    let txn_response_dump = "txn_response_dump";
    let transaction_mode = req.bodyString("env");
    let logs;
    if (transaction_mode == "test") {
      order_table = "test_orders";
      txn_table = "test_order_txn";
      txn_response_dump = "test_txn_response_dump";
      // logs = await order_logs.get_test_log_data(req.bodyString("order_id"));
    } else {
      // logs = await order_logs.get_log_data(req.bodyString("order_id"));
    }

    const res_order_data = await orderTransactionModel.selectWithJoin(
      "t1.currency,t1.merchant_id, t1.status,t1.order_id,t1.currency,t1.amount,t1.action,t1.cid, t1.scheme,t1.payment_mode,t1.card_country,t1.psp_id,t1.terminal_id,t1.origin",
      {
        order_reference_id: req.bodyString("order_reference_no"),
      },
      order_table,
      txn_table,
      "t1.order_id=t2.order_id"
    );

    let order_data = await helpers.get_data_list(
      "order_id as p_order_id,merchant_order_id as m_order_id,amount,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan,terminal_id",
      order_table,
      {
        order_id: res_order_data?.order_id,
      }
    );
    let _terminalcred = await fetchTerminalCred(res_order_data.terminal_id);
    let url = credientials.ni.base_url;
    if (transaction_mode == "test") {
      url = credientials.ni.test_url;
    }
    const ni_sale_request = await ni_sale.updatePayment(
      url,
      req.body,
      _terminalcred
    );
    console.log(`ni sale request at 3ds`);
    console.log(ni_sale_request);
    const _nistatus =
      ni_sale_request.state === "CAPTURED"
        ? "CAPTURED"
        : ni_sale_request.state === "AUTHORISED"
        ? "AUTHORISED"
        : "FAILED";

    if (transaction_mode == "test") {
      logs = await order_logs.get_test_log_data(res_order_data?.order_id);
    } else {
      logs = await order_logs.get_log_data(res_order_data?.order_id);
    }

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiated MerchantOrder.update_3ds`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : ni_sale_request with body ${JSON.stringify(req.body)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : orderTransactionModel.selectWithJoin ${JSON.stringify(req.body)}`
    );

    if (res_order_data && res_order_data?.status == "AWAIT_3DS") {
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : res_order_data true`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : res_order_data.status = AWAIT_3DS`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : browser_token_enc = ${JSON.stringify(req.browser_fingerprint)}`
      );
      let browser_token_enc = req.browser_fingerprint;
      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp ? req.headers.fp : "",
          email: req.bodyString("email") ? req.bodyString("email") : "",
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : enc_dec.cjs_encrypt = ${JSON.stringify(browser_token)}`
        );
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
      }
      let capture_no = "";
      if (ni_sale_request.state == "CAPTURED") {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : ni_sale_request.state = CAPTURED`
        );
        capture_no =
          ni_sale_request._embedded["cnp:capture"][0]._links.self.href.split(
            "/captures/"
          )[1];
      }

      let payment_id = await helpers.make_sequential_no(
        transaction_mode == "test" ? "TST_TXN" : "TXN"
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : helpers.make_sequential_no = ${payment_id}`
      );

      let response_category = await helpers.get_error_category(
        ni_sale_request?.authResponse?.resultCode,
        "ni",
        ni_sale_request.state
      );

      let txn_status = res_order_data?.action.toUpperCase();

      const order_txn_update = {
        txn: payment_id,
        order_id: res_order_data?.order_id || "",
        currency: res_order_data?.currency || "",
        amount: res_order_data?.amount || "",
        type: txn_status,
        status:
          res_order_data?.action.toUpperCase() == "SALE" &&
          (ni_sale_request.state == "CAPTURED" ||
            ni_sale_request == "AUTHORISED")
            ? "AUTHORISED"
            : _nistatus,
        psp_code: ni_sale_request?.authResponse?.resultCode,
        paydart_category: response_category.category,
        remark: response_category.response_details,
        capture_no: capture_no || "",
        created_at: updated_at || "",
        payment_id: ni_sale_request?.reference || "",
        order_reference_id: ni_sale_request?.orderReference || "",
      };
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : orderTransactionModel.add with data ${JSON.stringify(
          order_txn_update
        )}`
      );
      if (transaction_mode == "live") {
        await orderTransactionModel.add(order_txn_update);
      } else {
        await orderTransactionModel.test_txn_add(order_txn_update);
      }

      let response_dump = {
        order_id: res_order_data.order_id,
        type: res_order_data?.action.toUpperCase(),
        status: _nistatus,
        dump: JSON.stringify(ni_sale_request),
      };
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : orderTransactionModel.addResDump with data ${response_dump}`
      );
      if (transaction_mode == "test") {
        await orderTransactionModel.addTestResDump(response_dump);
      } else {
        await orderTransactionModel.addResDump(response_dump);
      }

      let order_update = {
        status: _nistatus,
        cardholderName: ni_sale_request.paymentMethod.cardholderName,
        expiry: ni_sale_request.paymentMethod.expiry,
        scheme: ni_sale_request.paymentMethod.name,
        // cardType: ni_sale_request.paymentMethod.cardType,
        // cardCategory: ni_sale_request.paymentMethod.cardCategory,
        pan: ni_sale_request.paymentMethod.pan,
        updated_at: updated_at,
        saved_card_for_recurring: JSON.stringify(ni_sale_request?.savedCard),
        "3ds": "1",
        "3ds_status":
          ni_sale_request?.authResponse?.resultMessage ||
          ni_sale_request?.["3ds"]?.eciDescription,
      };
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : merchantOrderModel.updateDynamic for id = ${
          res_order_data.order_id
        }`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : order txn update with data ${JSON.stringify(order_txn_update)}`
      );
      await merchantOrderModel
        .updateDynamic(
          order_update,
          {
            order_id: res_order_data.order_id,
          },
          order_table
        )
        .then(async (result) => {
          // request id table entry
          let p_request_id = await helpers.make_sequential_no(
            transaction_mode == "test" ? "TST_REQ" : "REQ"
          );
          let merchant_id = await helpers.get_data_list(
            "merchant_id",
            order_table,
            { order_id: res_order_data.order_id }
          );

          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: res_order_data.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(
            order_req,
            transaction_mode == "test"
              ? "test_generate_request_id"
              : "generate_request_id"
          );

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : received response ${JSON.stringify(result)}`
          );
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.selectOne with id = ${
              res_order_data.order_id
            }`
          );
          // check if QR Payment
          let qr_payment = await merchantOrderModel.selectOne(
            "id",
            {
              order_no: res_order_data.order_id,
            },
            "qr_payment"
          );

          if (qr_payment) {
            let qr_data = {
              payment_status: _nistatus,
              transaction_date: updated_at,
            };
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : qr_payment data exists`
            );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.updateDynamic with data = ${qr_data}`
            );
            await merchantOrderModel.updateDynamic(
              qr_data,
              {
                order_no: res_order_data.order_id,
              },
              "qr_payment"
            );
          }

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.selectOneLatest with id = ${
              res_order_data.order_id
            }`
          );

          const live = "live";
          if (_nistatus === "CAPTURED") {
            // check if Subscription Payment
            await manageSubscription(
              res_order_data,
              _nistatus,
              updated_at,
              ni_sale_request?.orderReference,
              ni_sale_request?.savedCard?.cardToken,
              req.body.env
            );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.updateDynamic`
            );
            // subscription code end

            if (_nistatus !== "FAILED") {
              /*Referrer commission started*/
              calculateAndStoreReferrerCommission({
                amount: res_order_data?.amount,
                currency: res_order_data?.currency,
                order_id: res_order_data?.order_id,
                merchant_id: res_order_data?.merchant_id,
                payment_id: payment_id,
                order_status: _nistatus,
                txn_status: txn_status,
              });
              /*Referrer commission ends*/
              const transaction_and_feature_data = {
                amount: res_order_data?.amount,
                currency: res_order_data?.currency,
                order_id: res_order_data?.order_id,
                merchant_id: res_order_data?.merchant_id,
                payment_id: payment_id,
                order_status: _nistatus,
                txn_status: txn_status,
                txn_id: payment_id,
                card_country: res_order_data?.card_country,
                payment_method: res_order_data?.payment_mode,
                scheme: res_order_data?.scheme,
                psp_id: res_order_data?.psp_id,
                terminal_id: res_order_data?.terminal_id,
                origin: res_order_data?.origin,
              };
              // transaction charge
              // calculateTransactionCharges(transaction_and_feature_data);

              // transaction feature charges
              // calculateFeatureCharges(transaction_and_feature_data);
            }
          }

          // check if invoice payment
          let invoice_payment = await invModel.selectDynamic(
            "id",
            {
              order_id: res_order_data.order_id,
            },
            "inv_invoice_master"
          );

          if (
            invoice_payment &&
            (_nistatus == "AUTHORISED" || _nistatus == "CAPTURED")
          ) {
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

          let new_res = {
            m_order_id: order_data[0]?.m_order_id
              ? order_data[0]?.m_order_id
              : "",
            p_order_id: order_data[0]?.p_order_id
              ? order_data[0]?.p_order_id
              : "",
            p_request_id: p_request_id,
            psp_ref_id: req.body?.orderReference
              ? req.body?.orderReference
              : "",
            psp_txn_id: req.body?.reference ? req.body?.reference : "",
            transaction_id: payment_id,
            status: _nistatus === "FAILED" ? "FAILED" : "SUCCESS",
            status_code: ni_sale_request?.authResponse?.resultCode
              ? ni_sale_request?.authResponse?.resultCode
              : "",
            remark:
              _nistatus == "FAILED" ? response_category.response_details : "",
            paydart_category: response_category.category,
            currency: res_order_data.currency,
            return_url:
              _nistatus === "FAILED"
                ? order_data[0].failure_url
                : order_data[0].success_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_data[0]?.amount
              ? order_data[0]?.amount.toFixed(2)
              : "",
            m_customer_id: order_data[0]?.m_customer_id
              ? order_data[0]?.m_customer_id
              : "",
            psp: order_data[0]?.psp ? order_data[0]?.psp : "",
            payment_method: order_data[0]?.payment_mode
              ? order_data[0]?.payment_mode
              : "",
            m_payment_token: order_data[0]?.m_payment_token
              ? order_data[0]?.m_payment_token
              : "",
            payment_method_data: {
              scheme: order_data[0]?.scheme ? order_data[0]?.scheme : "",
              card_country: order_data[0]?.card_country
                ? order_data[0]?.card_country
                : "",
              card_type: order_data[0]?.card_type
                ? order_data[0]?.card_type
                : "",
              mask_card_number: ni_sale_request.paymentMethod.pan,
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: order_data[0]?.merchant_id
              ? await helpers.formatNumber(order_data[0]?.merchant_id)
              : "",
          };

          const res_obj = {
            message:
              ni_sale_request.state === "CAPTURED" ||
              ni_sale_request.state === "AUTHORISED"
                ? "Transaction Successful"
                : "Transaction Failed",
            order_status: _nistatus,
            payment_id: payment_id,
            order_id: res_order_data.order_id,
            amount: res_order_data.amount,
            currency: res_order_data.currency,
            token: browser_token_enc,
            new_res: new_res,
          };
          if (ni_sale_request.state == "FAILED") {
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: res_order_data.order_id,
              mode: transaction_mode,
            });

            let txnFailedLog = {
              order_id: res_order_data.order_id,
              terminal: res_order_data?.terminal_id,
              req: JSON.stringify(req.body),
              res: JSON.stringify(ni_sale_request),
              psp: "NI",
              status_code: ni_sale_request?.authResponse?.resultCode,
              description: ni_sale_request?.authResponse?.resultMessage,
              activity: "Transaction failed with NI",
              status: 1,
              mode: transaction_mode,
              card_holder_name: temp_card_details.card_holder_name,
              card: temp_card_details.card,
              expiry: temp_card_details.expiry,
              cipher_id: temp_card_details.cipher_id,
              txn: payment_id,
              card_proxy: temp_card_details.card_proxy,
              "3ds_version": "1",
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };

            await helpers.addTransactionFailedLogs(txnFailedLog);
          } else {
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: res_order_data.order_id,
              mode: transaction_mode,
            });

            let txnFailedLog = {
              order_id: res_order_data.order_id,
              terminal: res_order_data?.terminal_id,
              req: JSON.stringify(req.body),
              res: JSON.stringify(ni_sale_request),
              psp: "NI",
              status_code: ni_sale_request?.authResponse?.resultCode,
              description: ni_sale_request?.authResponse?.resultMessage,
              activity: "Transaction success with NI",
              status: 0,
              mode: transaction_mode,
              card_holder_name: temp_card_details.card_holder_name,
              card: temp_card_details.card,
              expiry: temp_card_details.expiry,
              cipher_id: temp_card_details.cipher_id,
              txn: payment_id,
              card_proxy: temp_card_details.card_proxy,
              "3ds_version": "1",
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };

            await helpers.addTransactionFailedLogs(txnFailedLog);
          }

          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: res_order_data.order_id,
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });

          // web  hook starting
          let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: order_data[0]?.merchant_id,
          });

          const web_hook_res = Object.assign({}, res_obj.new_res);
          delete web_hook_res.return_url;
          delete web_hook_res.paydart_category;
          if (hook_info[0]) {
            if (
              hook_info[0].enabled === 0 &&
              hook_info[0].notification_url != ""
            ) {
              let url = hook_info[0].notification_url;
              let webhook_res = await send_webhook_data(
                url,
                web_hook_res,
                hook_info[0].notification_secret
              );
            }
          }
          // webhook ended
          ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            let order_id = res_order_data.order_id;
            let qb = await pool.get_connection();
            let merchant_and_customer_transaction_response;
            try {
              merchant_and_customer_transaction_response = await qb
                .select(
                  "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                )
                .from(config.table_prefix + order_table + " o")
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
            mail_details.logo = mail_details?.logo
              ? process.env.STATIC_URL + "/static/files/" + mail_details?.logo
              : "";
            let transaction_date_time = new Date(mail_details?.updated_at);
            mail_details.updated_at = moment(transaction_date_time).format(
              "DD-MM-YYYY HH:mm"
            );
            let mail_response = await mailSender.CustomerTransactionMail(
              mail_details
            );
            let merchant_mail_response =
              await mailSender.MerchantTransactionMail(mail_details);
          });
          ee.emit("ping", {
            message: "hello",
          });

          res
            .status(statusCode.ok)
            .send(successdatamsg(res_obj, res_obj.message));
        })
        .catch(async (error) => {
          winston.error(error);
          logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred ${
              error.message
            }`
          );

          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          let log_is = await order_logs
            .update_logs_data(
              {
                order_id: res_order_data.order_id,
              },
              logs_payload
            )
            .then((result) => {})
            .catch((err) => {
              winston.error(err);
            });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else {
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : error occurred 'Invalid order reference or already processed'`
      );

      let logs_payload = {
        activity: JSON.stringify(logs),
        updated_at: updated_at,
      };
      let log_is = await order_logs
        .update_logs_data(
          {
            order_id: res_order_data.order_id,
          },
          logs_payload
        )
        .then((result) => {})
        .catch((err) => {
          winston.error(err);
        });
      res
        .status(statusCode.ok)
        .send(
          response.errormsg("Invalid order reference or already processed")
        );
    }
  },
  update_3ds2: async (req, res, next) => {
    let order_id = req.bodyString("order_no");
    let order_table = "orders";
    if (req.body.mode == "test") {
      order_table = "test_orders";
    }
    let order_details = await merchantOrderModel.selectOne(
      "3ds2_url,terminal_id",
      { order_id: order_id },
      order_table
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime",
      {
        terminal_id: order_details.terminal_id,
      },
      "mid"
    );
    const _pspid = await merchantOrderModel.selectOne(
      "*",
      {
        id: _getmid.psp_id,
      },
      "psp"
    );
    const _terminalcred = {
      MID: _getmid.MID,
      password: _getmid.password,
      baseurl:
        req.body.mode == "test"
          ? credientials.ni.test_url
          : credientials.ni.base_url,
      psp_id: _getmid.psp_id,
      name: _pspid.name,
    };
    if (order_details?.["3ds2_url"]) {
      let ni_order_sale = await ni_sale.update3ds2_challenge(
        order_details?.["3ds2_url"],
        { cres: req.bodyString("cres") },
        _terminalcred
      );

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            ni_order_sale,
            "3DS challege updated successfully."
          )
        );
    }
  },
  update_3ds2_ni: async (req, res, next) => {
    try {
      //1. if 3ds pending check fraud (api end point is different) //requiest id, order_id, is_3ds = true/false
      //2. ni catch res
      //3. fraud catch res
      //4. if(ni_authorized && fraud_status = failed/block) void
      //5. if(ni_authorized && fraud_status = review) keep as it is and update flag review (do not change txn type like SALE to AUTH or AUTH to SALE)
      //6. if(ni_failed) keep as it is
      //7. update fraud_3ds_pending =0
      //8. if vaoid send response as like fraud failed (point ref. 4)

      const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
      const ni_sale_request = req.body.ni_request;

      /// delete ni_sale_request?.savedCard;

      console.log("ni_sale_request");
      console.log(ni_sale_request);

      let order_table = "orders";
      let txn_table = "order_txn";
      let txn_response_dump = "txn_response_dump";
      const transaction_mode = req.bodyString("mode");

      if (transaction_mode === "test") {
        order_table = "test_orders";
        txn_table = "test_order_txn";
        txn_response_dump = "test_txn_response_dump";
      }

      const order_id = req.bodyString("order_no");

      const res_order_data = await orderTransactionModel.selectWithJoin(
        "t1.currency,t1.merchant_id, t1.status,t1.order_id,t1.currency,t1.amount,t1.action,t1.cid, t1.scheme,t1.payment_mode,t1.card_country,t1.psp_id,t1.terminal_id,t1.origin,t1.fraud_3ds_pending,t1.fraud_request_id,t1.fraud_request_type",
        {
          "t1.order_id": req.bodyString("order_no"),
        },
        order_table,
        txn_table,
        "t1.order_id=t2.order_id"
      );

      let _nistatus =
        ni_sale_request.state === "CAPTURED"
          ? "CAPTURED"
          : ni_sale_request.state === "AUTHORISED"
          ? "AUTHORISED"
          : "FAILED";

      let response_category = await helpers.get_error_category(
        ni_sale_request?.authResponse?.resultCode,
        "ni",
        ni_sale_request.state
      );

      let fraudStatus = false;
      let fraudResponse = {};
      const orderTable = transaction_mode === "test" ? "order_txn" : "order";

      if (res_order_data.fraud_3ds_pending === 1) {
        const fraudCheckBody = {
          fraudRequestId: res_order_data.fraud_request_id,
          order_id: order_id,
          is3ds: 1,
        };

        const fraudServiceRequest = await fraudService.make3dsFraudCheck(
          fraudCheckBody
        );
        fraudStatus = fraudServiceRequest.status === "fail" ? true : false;
        fraudResponse = fraudServiceRequest;
      }

      let order_data = await helpers.get_data_list(
        "order_id as p_order_id,merchant_order_id as m_order_id,amount,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan",
        order_table,
        {
          order_id: order_id,
        }
      );

      let logs =
        transaction_mode == "test"
          ? await order_logs.get_test_log_data(res_order_data?.order_id)
          : await order_logs.get_log_data(res_order_data?.order_id);
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : initiated MerchantOrder.update_3ds`
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
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : ni_sale_request with body ${JSON.stringify(req.body)}`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : orderTransactionModel.selectWithJoin ${JSON.stringify(req.body)}`
      );
      if (res_order_data && res_order_data?.status == "AWAIT_3DS") {
        logs.push(
          `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : res_order_data true`
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : res_order_data.status = AWAIT_3DS`
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : browser_token_enc = ${JSON.stringify(req.browser_fingerprint)}`
        );
        let browser_token_enc = req.browser_fingerprint;
        if (!browser_token_enc) {
          let browser_token = {
            os: req.headers.os,
            browser: req.headers.browser,
            browser_version: req.headers["x-browser-version"],
            browser_fingerprint: req.headers.fp ? req.headers.fp : "",
            email: req.bodyString("email") ? req.bodyString("email") : "",
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : enc_dec.cjs_encrypt = ${JSON.stringify(browser_token)}`
          );
          browser_token_enc = enc_dec.cjs_encrypt(
            JSON.stringify(browser_token)
          );
        }
        let capture_no = "";
        if (ni_sale_request.state == "CAPTURED") {
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : ni_sale_request.state = CAPTURED`
          );
          capture_no =
            ni_sale_request._embedded["cnp:capture"][0]._links.self.href.split(
              "/captures/"
            )[1];
        }

        let payment_id = await helpers.make_sequential_no(
          transaction_mode == "test" ? "TST_TXN" : "TXN"
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : helpers.make_sequential_no = ${payment_id}`
        );

        let txn_status = res_order_data?.action.toUpperCase();

        const order_txn_update = {
          txn: payment_id,
          order_id: res_order_data?.order_id || "",
          currency: res_order_data?.currency || "",
          amount: res_order_data?.amount || "",
          type: res_order_data?.action.toUpperCase(),
          status:
            res_order_data?.action.toUpperCase() == "SALE" &&
            (ni_sale_request.state == "CAPTURED" ||
              ni_sale_request == "AUTHORISED")
              ? "AUTHORISED"
              : _nistatus,
          psp_code: ni_sale_request?.authResponse?.resultCode,
          paydart_category: response_category.category,
          remark: response_category.response_details,
          capture_no: capture_no || "",
          created_at: updated_at || "",
          payment_id: ni_sale_request?.reference || "",
          order_reference_id: ni_sale_request?.orderReference || "",
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : orderTransactionModel.add with data ${JSON.stringify(
            order_txn_update
          )}`
        );
        if (transaction_mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn_update);
        } else {
          await orderTransactionModel.add(order_txn_update);
        }

        let response_dump = {
          order_id: res_order_data.order_id,
          type: res_order_data?.action.toUpperCase(),
          status: _nistatus,
          dump: JSON.stringify(ni_sale_request),
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : orderTransactionModel.addResDump with data ${response_dump}`
        );
        if (transaction_mode == "test") {
          await orderTransactionModel.addTestResDump(response_dump);
        } else {
          await orderTransactionModel.addResDump(response_dump);
        }

        let order_update = {
          status: _nistatus,
          cardholderName: ni_sale_request.paymentMethod.cardholderName,
          expiry: ni_sale_request.paymentMethod.expiry,
          scheme: ni_sale_request.paymentMethod.name,
          "3ds": 1,
          "3ds_status": ni_sale_request?.authResponse?.resultMessage
            ? ni_sale_request?.authResponse?.resultMessage
            : "Not Authenticated / Unvailable",
          // cardType: ni_sale_request.paymentMethod.cardType,
          // cardCategory: ni_sale_request.paymentMethod.cardCategory,

          pan: ni_sale_request.paymentMethod.pan,
          updated_at: updated_at,
          saved_card_for_recurring: JSON.stringify(ni_sale_request?.savedCard),
        };

        console.log("order_update_after_3ds", order_update);

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : merchantOrderModel.updateDynamic for id = ${
            res_order_data.order_id
          }`
        );
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : order txn update with data ${JSON.stringify(order_txn_update)}`
        );
        await merchantOrderModel
          .updateDynamic(
            order_update,
            {
              order_id: res_order_data?.order_id,
            },
            order_table
          )
          .then(async (result) => {
            // request id table entry
            let p_request_id = await helpers.make_sequential_no("REQ");
            let merchant_id = await helpers.get_data_list(
              "merchant_id",
              order_table,
              { order_id: res_order_data.order_id }
            );

            let order_req = {
              merchant_id: merchant_id[0].merchant_id,
              order_id: res_order_data.order_id,
              request_id: p_request_id,
              request: JSON.stringify(req.body),
            };
            await helpers.common_add(
              order_req,
              mode == "test"
                ? "test_generate_request_id	"
                : "generate_request_id"
            );

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : received response ${JSON.stringify(result)}`
            );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.selectOne with id = ${
                res_order_data.order_id
              }`
            );
            // check if QR Payment
            let qr_payment = await merchantOrderModel.selectOne(
              "id",
              {
                order_no: res_order_data.order_id,
              },
              "qr_payment"
            );

            if (qr_payment) {
              let qr_data = {
                payment_status: _nistatus,
                transaction_date: updated_at,
              };
              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : qr_payment data exists`
              );
              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.updateDynamic with data = ${qr_data}`
              );
              await merchantOrderModel.updateDynamic(
                qr_data,
                {
                  order_no: res_order_data.order_id,
                },
                "qr_payment"
              );
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.selectOneLatest with id = ${
                res_order_data.order_id
              }`
            );

            if (_nistatus === "CAPTURED") {
              // check if Subscription Payment
              await manageSubscription(
                res_order_data,
                _nistatus,
                updated_at,
                ni_sale_request?.orderReference,
                ni_sale_request?.savedCard?.cardToken,
                transaction_mode
              );
              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.updateDynamic`
              );
              // subscription code end

              if (_nistatus !== "FAILED") {
                /*Referrer commission started*/
                calculateAndStoreReferrerCommission({
                  amount: res_order_data?.amount,
                  currency: res_order_data?.currency,
                  order_id: res_order_data?.order_id,
                  merchant_id: res_order_data?.merchant_id,
                  payment_id: payment_id,
                  order_status: _nistatus,
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
                  //change param
                  payment_id: payment_id,
                  order_status: _nistatus,
                  txn_status: txn_status,
                  txn_id: payment_id,
                  mode: transaction_mode,
                };
                // transaction charge
                // calculateTransactionCharges(transaction_and_feature_data);

                // transaction feature charges
                // calculateFeatureCharges(transaction_and_feature_data);
              }
            }

            // check if invoice payment
            let invoice_payment = await invModel.selectDynamic(
              "id",
              {
                order_id: res_order_data.order_id,
              },
              "inv_invoice_master"
            );

            if (
              invoice_payment &&
              (_nistatus == "AUTHORISED" || _nistatus == "CAPTURED")
            ) {
              let inv_data = {
                status: "Closed",
                payment_date: updated_at,
              };

              logs.push(
                `${moment().format(
                  "DD/MM/YYYY HH:mm:ss.SSS"
                )} : invModel.updateDynamic with data ${JSON.stringify(
                  inv_data
                )}`
              );

              invModel.updateDynamic(
                inv_data,
                {
                  id: invoice_payment.id,
                },
                "inv_invoice_master"
              );
            }

            const new_res = {
              m_order_id: order_data[0]?.m_order_id
                ? order_data[0]?.m_order_id
                : "",
              p_order_id: order_data[0]?.p_order_id
                ? order_data[0]?.p_order_id
                : "",
              p_request_id: p_request_id,
              psp_ref_id: req.body?.orderReference
                ? req.body?.orderReference
                : "",
              psp_txn_id: req.body?.reference ? req.body?.reference : "",
              transaction_id: payment_id,
              status: _nistatus === "FAILED" ? "FAILED" : "SUCCESS",
              status_code: ni_sale_request?.authResponse?.resultCode
                ? ni_sale_request?.authResponse?.resultCode
                : "",
              remark:
                _nistatus == "FAILED" ? response_category.response_details : "",
              paydart_category: response_category.category,
              currency: res_order_data.currency,
              return_url:
                _nistatus === "FAILED"
                  ? order_data[0].failure_url
                  : order_data[0].success_url,
              transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
              amount: order_data[0]?.amount
                ? order_data[0]?.amount.toFixed(2)
                : "",
              m_customer_id: order_data[0]?.m_customer_id
                ? order_data[0]?.m_customer_id
                : "",
              psp: order_data[0]?.psp ? order_data[0]?.psp : "",
              payment_method: order_data[0]?.payment_mode
                ? order_data[0]?.payment_mode
                : "",
              m_payment_token: order_data[0]?.m_payment_token
                ? order_data[0]?.m_payment_token
                : "",
              payment_method_data: {
                scheme: order_data[0]?.scheme ? order_data[0]?.scheme : "",
                card_country: order_data[0]?.card_country
                  ? order_data[0]?.card_country
                  : "",
                card_type: order_data[0]?.card_type
                  ? order_data[0]?.card_type
                  : "",
                mask_card_number: ni_sale_request.paymentMethod.pan,
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: order_data[0]?.merchant_id
                ? await helpers.formatNumber(order_data[0]?.merchant_id)
                : "",
            };

            let res_obj = {
              message:
                ni_sale_request.state === "CAPTURED" ||
                ni_sale_request.state === "AUTHORISED"
                  ? "Transaction Successful"
                  : "Transaction Failed",
              order_status: _nistatus,
              payment_id: payment_id,
              order_id: res_order_data.order_id,
              amount: res_order_data.amount,
              currency: res_order_data.currency,
              token: browser_token_enc,
              new_res: new_res,
            };

            if (ni_sale_request.state == "FAILED") {
              let temp_card_details = await helpers.fetchTempLastCard({
                order_id: res_order_data.order_id,
                mode: transaction_mode,
              });

              let txnFailedLog = {
                order_id: res_order_data.order_id,
                terminal: res_order_data?.terminal_id,
                req: JSON.stringify(req.body),
                res: JSON.stringify(ni_sale_request),
                psp: "NI",
                status_code: ni_sale_request?.authResponse?.resultCode,
                description: ni_sale_request?.authResponse?.resultMessage,
                activity: "Transaction failed with NI",
                status: 1,
                mode: transaction_mode,
                card_holder_name: temp_card_details.card_holder_name,
                card: temp_card_details.card,
                expiry: temp_card_details.expiry,
                cipher_id: temp_card_details.cipher_id,
                txn: payment_id,
                card_proxy: temp_card_details.card_proxy,
                "3ds_version": "1",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              };

              await helpers.addTransactionFailedLogs(txnFailedLog);
            } else {
              let temp_card_details = await helpers.fetchTempLastCard({
                order_id: res_order_data.order_id,
                mode: transaction_mode,
              });
              let txnFailedLog = {
                order_id: res_order_data.order_id,
                terminal: res_order_data?.terminal_id,
                req: JSON.stringify(req.body),
                res: JSON.stringify(ni_sale_request),
                psp: "NI",
                status_code: ni_sale_request?.authResponse?.resultCode,
                description: ni_sale_request?.authResponse?.resultMessage,
                activity: "Transaction success with NI",
                status: 0,
                mode: transaction_mode,
                card_holder_name: temp_card_details.card_holder_name,
                card: temp_card_details.card,
                expiry: temp_card_details.expiry,
                cipher_id: temp_card_details.cipher_id,
                txn: payment_id,
                card_proxy: temp_card_details.card_proxy,
                "3ds_version": "1",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              };
              await helpers.addTransactionFailedLogs(txnFailedLog);
            }

            let logs_payload = {
              activity: JSON.stringify(logs),
              updated_at: updated_at,
            };
            await order_logs.update_logs_data(
              { order_id: res_order_data.order_id },
              logs_payload
            );
            // web  hook starting
            let hook_info = await helpers.get_data_list(
              "*",
              "webhook_settings",
              {
                merchant_id: res_order_data?.merchant_id,
              }
            );

            const web_hook_res = Object.assign({}, res_obj.new_res);
            delete web_hook_res.return_url;
            delete web_hook_res.paydart_category;
            if (hook_info[0]) {
              if (
                hook_info[0].enabled === 0 &&
                hook_info[0].notification_url != ""
              ) {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                  url,
                  web_hook_res,
                  hook_info[0].notification_secret
                );
              }
            }

            let void_transaction = false;
            let void_remark = "";
            let void_message = fraudResponse.message;
            let status_code = "";
            ///Void if token not generated
            if (
              (_nistatus == "AUTHORISED" || _nistatus == "CAPTURED") &&
              res_order_data.origin == "SUBSCRIPTION" &&
              (ni_sale_request?.savedCard == "" ||
                ni_sale_request?.savedCard == undefined)
            ) {
              response_category = await helpers.get_error_category(
                "156",
                "paydart",
                "FAILED"
              );
              void_transaction = true;
              void_remark = response_category.response_details;
              void_message = response_category.response_details;
              status_code = "156";
            }
            ///

            if (
              (_nistatus == "AUTHORISED" || _nistatus == "CAPTURED") &&
              fraudStatus === true &&
              void_transaction == false
            ) {
              response_category = await helpers.get_error_category(
                "143",
                "paydart",
                "FAILED"
              );
              void_remark = "Blocked by PayDart";
              void_transaction = true;
              status_code = "143";
            }

            if (void_transaction) {
              const VoidTransactionPayload = {
                order_id: res_order_data.order_id.toString(),
                txn_id: payment_id.toString(),
                action: "VOID",
                mode: transaction_mode,
              };
              const voidTransaction = await fraudService.voidTransaction(
                VoidTransactionPayload
              );

              console.log(voidTransaction);
              if (voidTransaction.status === "success") {
                // const payment_id = await helpers.make_sequential_no(transaction_mode == 'test' ? 'TST_TXN' : "TXN");
                const order_txn_update = {
                  txn: payment_id,
                  order_id: res_order_data?.order_id || "",
                  currency: res_order_data?.currency || "",
                  amount: res_order_data?.amount || "",
                  type: res_order_data?.action.toUpperCase(),
                  status: "FAILED",
                  psp_code: "",
                  paydart_category: response_category.category,
                  remark: void_remark,
                  capture_no: "",
                  created_at: updated_at || "",
                  payment_id: payment_id || "",
                  order_reference_id: ni_sale_request?.orderReference || "",
                };

                if (transaction_mode == "test") {
                  //await orderTransactionModel.test_txn_add(order_txn_update);
                } else {
                  //await orderTransactionModel.add(order_txn_update);
                }

                console.log(
                  "🚀 ~ update_3ds2_ni: ~ fraudResponse:",
                  fraudResponse
                );

                res_obj = {
                  message: "Transaction Failed",
                  order_status: "FAILED",
                  payment_id: payment_id,
                  order_id: res_order_data.order_id,
                  amount: res_order_data.amount,
                  currency: res_order_data.currency,
                  token: browser_token_enc,
                  remark: void_remark,
                  new_res: {
                    m_order_id: order_data[0]?.m_order_id || "",
                    p_order_id: order_data[0]?.p_order_id || "",
                    p_request_id: p_request_id,
                    psp_ref_id: req.body?.orderReference || "",
                    psp_txn_id: req.body?.reference || "",
                    transaction_id: payment_id,
                    status: "FAILED",
                    status_code: status_code,
                    remark: void_message,
                    paydart_category: void_message,
                    currency: res_order_data.currency,
                    return_url: order_data[0].failure_url,
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    amount: order_data[0]?.amount.toFixed(2) || "",
                    m_customer_id: order_data[0]?.m_customer_id || "",
                    psp: order_data[0]?.psp || "",
                    payment_method: order_data[0]?.payment_mode || "",
                    m_payment_token: order_data[0]?.m_payment_token || "",
                    payment_method_data: {
                      scheme: order_data[0]?.scheme || "",
                      card_country: order_data[0]?.card_country || "",
                      card_type: order_data[0]?.card_type || "",
                      mask_card_number: ni_sale_request.paymentMethod.pan,
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: order_data[0]?.merchant_id
                      ? await helpers.formatNumber(order_data[0]?.merchant_id)
                      : "",
                  },
                };

                console.log("response_category", response_category);
                console.log("order_id", order_id);
                console.log("payment_id", voidTransaction.data.transaction_id);

                await merchantOrderModel.updateDynamic(
                  {
                    paydart_category: response_category.category,
                    psp_code: response_category.response_code,
                    remark: response_category.response_details,
                  },
                  {
                    order_id: order_id,
                    txn: voidTransaction.data.transaction_id,
                  },
                  txn_table
                );

                await merchantOrderModel.updateDynamic(
                  {
                    // type: res_order_data?.action.toUpperCase(),
                    updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                    status: "VOID",
                  },
                  { order_id: order_id },
                  order_table
                );
                return res
                  .status(statusCode.badRequest)
                  .send(response.errorMsgWithData(res_obj.message, res_obj));
              }
            }

            // webhook ended
            ee.once("ping", async (arguments) => {
              // Sending mail to customers and merchants about transaction
              let order_id = res_order_data.order_id;
              let qb = await pool.get_connection();
              let merchant_and_customer_transaction_response;
              try {
                merchant_and_customer_transaction_response = await qb
                  .select(
                    "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                  )
                  .from(config.table_prefix + order_table + " o")
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
              mail_details.logo = mail_details?.logo
                ? process.env.STATIC_URL + "/static/files/" + mail_details?.logo
                : "";
              let transaction_date_time = new Date(mail_details?.updated_at);
              mail_details.updated_at = moment(transaction_date_time).format(
                "DD-MM-YYYY HH:mm"
              );
              let mail_response = await mailSender.CustomerTransactionMail(
                mail_details
              );
              let merchant_mail_response =
                await mailSender.MerchantTransactionMail(mail_details);
            });
            ee.emit("ping", {
              message: "hello",
            });
            return res
              .status(statusCode.ok)
              .send(successdatamsg(res_obj, res_obj.message));
          })
          .catch(async (error) => {
            console.log(error);
            winston.error(error);
            logs.push(
              `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : error occurred ${
                error.message
              }`
            );

            let txnFailedLog = {
              order_id: req.bodyString("order_no"),
              status: 1,
              activity: "Failed With NI",
              mode: transaction_mode,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await helpers.addTransactionFailedLogs(txnFailedLog);
            let logs_payload = {
              activity: JSON.stringify(logs),
              updated_at: updated_at,
            };
            let log_is = await order_logs
              .update_logs_data(
                {
                  order_id: res_order_data.order_id,
                },
                logs_payload
              )
              .then((result) => {})
              .catch((err) => {
                winston.error(err);
              });
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : error occurred 'Invalid order reference or already processed'`
        );

        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };
        let log_is = await order_logs
          .update_logs_data(
            {
              order_id: res_order_data.order_id,
            },
            logs_payload
          )
          .then((result) => {})
          .catch((err) => {
            winston.error(err);
          });
        res
          .status(statusCode.ok)
          .send(
            response.errormsg("Invalid order reference or already processed")
          );
      }
    } catch (error) {
      console.log(error);
    }
  },
  capture: async (req, res, next) => {
    let checkPSP = await orderTransactionModel.selectOne(
      "psp",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    let checkStatus = await orderTransactionModel.selectOne(
      "status",
      {
        order_id: req.bodyString("order_id"),
      },
      "orders"
    );

    if (checkStatus.status === "CAPTURED") {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Order is already Captured."));
    } else {
      if (checkPSP) {
        switch (checkPSP.psp) {
          case "TELR":
            await telr_capture_func(req, res);
            break;
          case "NI":
            await ni_capture_func(req, res);
            break;
          default:
            res
              .status(statusCode.ok)
              .send(
                response.errormsg("Unable to capture transaction - Invalid PSP")
              );
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Unable to capture transaction - Invalid PSP or Order id"
            )
          );
      }
    }
  },

  summary: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let and_filter_obj = {};
    let date_condition = {};

    let customer_name = "";
    if (req.bodyString("card_id")) {
      and_filter_obj.card_id = req.bodyString("card_id");
    }
    if (req.bodyString("name")) {
      customer_name = req.bodyString("name");
    }
    if (req.bodyString("card_no")) {
      and_filter_obj.card_no = req.bodyString("card_no");
    }
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    merchantOrderModel
      .selectSummary(limit, and_filter_obj, customer_name, date_condition)
      .then(async (result) => {
        let send_res = [];
        for (let row of result) {
          row.last_failed =
            parseInt(row.failed) > 0
              ? moment(
                  await helpers.last_transactions(row.card_id, "FAILED")
                ).format("DD-MM-YYYY HH:mm")
              : "";
          row.last_successfull =
            parseInt(row.successfull) > 0
              ? moment(
                  await helpers.last_transactions(row.card_id, "CAPTURED")
                ).format("DD-MM-YYYY HH:mm")
              : "";
          row.last_attempt = row.last_attempt
            ? moment(row.last_attempt).format("DD-MM-YYYY HH:mm")
            : "";
          row.card_no = "XXXX-" + row.card_no;
          send_res.push(row);
        }
        let total_records = await merchantOrderModel.summaryCount(
          and_filter_obj,
          customer_name,
          date_condition
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Transactions and card summary fetch successfully.",
              total_records
            )
          );
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to fetch transactions summary."));
      });
  },
  tokenSummary: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let and_filter_obj = {};
    let date_condition = {};

    let customer_name = "";
    if (req.bodyString("card_id")) {
      and_filter_obj.card_id = req.bodyString("card_id");
    }
    if (req.bodyString("name")) {
      customer_name = req.bodyString("name");
    }
    if (req.bodyString("card_no")) {
      and_filter_obj.card_no = req.bodyString("card_no");
    }
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    merchantOrderModel
      .selectTokenSummary(limit, and_filter_obj, customer_name, date_condition)
      .then(async (result) => {
        console.log(result);
        let send_res = [];
        for (let row of result) {
          let decoded_token = row.browser_token
            ? JSON.parse(enc_dec.cjs_decrypt(row.browser_token))
            : "";
          let customer_id = enc_dec.cjs_decrypt(row.cid);
          let last_failed_test_transaction =
            await helpers.last_transactions_using_token(
              row.browser_token,
              "FAILED",
              "test_orders"
            );
          let last_failed_live_transaction =
            await helpers.last_transactions_using_token(
              row.browser_token,
              "FAILED",
              "orders"
            );
          let last_successfull_test_transaction =
            await helpers.last_transactions_using_token(
              row.browser_token,
              ["CAPTURED", "AUTHORISED", "REFUNEDED"],
              "test_orders"
            );
          let last_successfull_live_transaction =
            await helpers.last_transactions_using_token(
              row.browser_token,
              ["CAPTURED", "AUTHORISED", "REFUNEDED"],
              "orders"
            );
          let attempts_live = await helpers.get_orders_count(
            row.browser_token,
            "orders"
          );
          let attempts_test = await helpers.get_orders_count(
            row.browser_token,
            "test_orders"
          );
          let temp = {
            browser_token: row.browser_token,
            browser_fingerprint: decoded_token.browser_fingerprint,
            browser: decoded_token.browser,
            os: decoded_token.os,
            customer_details: await merchantOrderModel.selectDynamicONE(
              "name,email,dial_code,mobile_no",
              { id: customer_id },
              "customers"
            ),
            last_failed_live_transaction: last_failed_live_transaction
              ? moment(last_failed_live_transaction).format("DD-MM-YYYY HH:mm")
              : "NA",
            last_failed_test_transaction: last_failed_test_transaction
              ? moment(last_failed_test_transaction).format("DD-MM-YYYY HH:mm")
              : "NA",
            last_successfull_live_transaction: last_successfull_live_transaction
              ? moment(last_successfull_live_transaction).format(
                  "DD-MM-YYYY HH:mm"
                )
              : "NA",
            last_successfull_test_transaction: last_successfull_test_transaction
              ? moment(last_successfull_test_transaction).format(
                  "DD-MM-YYYY HH:mm"
                )
              : "NA",
            last_attempt: row.recent_used
              ? moment(row.recent_used).format("DD-MM-YYYY HH:mm")
              : "NA",
            attempts_live: attempts_live,
            attempts_test: attempts_test,
          };
          // row.last_failed =
          //   parseInt(row.failed) > 0
          //     ? moment(
          //         await helpers.last_transactions(row.card_id, "FAILED")
          //       ).format("DD-MM-YYYY HH:mm")
          //     : "";
          // row.last_successfull =
          //   parseInt(row.successfull) > 0
          //     ? moment(
          //         await helpers.last_transactions(row.card_id, "CAPTURED")
          //       ).format("DD-MM-YYYY HH:mm")
          //     : "";
          // row.last_attempt = row.last_attempt
          //   ? moment(row.last_attempt).format("DD-MM-YYYY HH:mm")
          //   : "";
          // row.card_no = "XXXX-" + row.card_no;
          send_res.push(temp);
        }
        let total_records = await merchantOrderModel.tokenSummaryCount(
          and_filter_obj,
          customer_name,
          date_condition
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Transactions and card summary fetch successfully.",
              total_records
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        console.log(error);
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to fetch transactions summary."));
      });
  },
  cardsByToken: async (req, res) => {
    let browser_token = req.body.browser_token;
    let results = await merchantOrderModel.selectDynamic(
      "name_on_card,card_expiry,card_nw,last_4_digit,recent_used,email",
      { browser_token: browser_token, deleted: 0 },
      "customers_cards"
    );
    res
      .status(statusCode.ok)
      .send(
        response.successdatamsg(
          results,
          "Transactions and card summary fetch successfully."
        )
      );
  },

  all_transactions: async (req, res) => {
    let limit = {
      perpage: 10,
      start: 0,
      page: 1,
    };

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    let and_filter_obj = {};
    let date_condition = {};

    let table_name = "orders";

    if (req.bodyString("card_id")) {
      and_filter_obj.card_id = req.bodyString("card_id");
    }

    let in_condition = "";
    TransactionsModel.select(
      and_filter_obj,
      date_condition,
      limit,
      table_name,
      in_condition
    )
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let today = moment().format("YYYY-MM-DD");
          let order_date = moment(val.created_at).format("YYYY-MM-DD");
          let res = {
            // transactions_id: await enc_dec.cjs_encrypt(val.id),
            // merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
            order_id: val?.order_id ? val?.order_id : "",
            payment_id: val?.payment_id ? val?.payment_id : "",
            merchant_name: await helpers.get_merchantdetails_name_by_id(
              val.merchant_id
            ),
            order_amount: val.amount.toFixed(2),
            order_currency: val.currency,
            customer_name: val.customer_name,
            customer_email: val.customer_email,
            customer_mobile: val.customer_mobile,
            channel: val.origin,
            status: val.status,
            high_risk_country: val.high_risk_country
              ? val.high_risk_country
              : 0,
            high_risk_transaction: val.high_risk_transaction
              ? val.high_risk_transaction
              : 0,
            block_for_suspicious_ip: val.block_for_suspicious_ip
              ? val.block_for_suspicious_ip
              : 0,
            block_for_suspicious_email: val.block_for_suspicious_email
              ? val.block_for_suspicious_email
              : 0,
            block_for_transaction_limit: val.block_for_transaction_limit
              ? val.block_for_transaction_limit
              : 0,
            can_be_voided: moment(order_date).isSame(today) ? "1" : "0",
            transaction_date: moment(val.created_at).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          send_res.push(res);
        }
        total_count = await TransactionsModel.get_count_list(
          and_filter_obj,
          date_condition,
          table_name,
          in_condition
        );

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "List fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  get_request: async (req, res) => {
    try {
      // let merchant_id = enc_dec.cjs_decrypt(
      //     req.bodyString("merchant_id")
      // );
      let order_id = req.bodyString("order_id");

      let request_data = await helpers.common_fetch(
        {
          order_id: order_id,
        },
        "order_request"
      );

      let res1 = JSON.parse(request_data.request);
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(res1, "Order request fetched successfully.")
        );
    } catch (error) {
      winston.error(error);

      res
        .status(statusCode.ok)
        .send(response.errormsg("Failed to fetch order request."));
    }
  },
  telr_update_3ds_updated: async (req, res, next) => {
    //console.log("req.body.mode", req.body.mode);

    const orderTable = req.body.mode === "test" ? "order_txn" : "order";

    let orderupdate = {
      data_3ds: JSON.stringify(req.body),
    };

    let table_name = "orders";
    let order_request_table = "order_request";
    if (req.body.mode == "test") {
      table_name = "test_orders";
      order_request_table = "test_order_request";
    }

    await merchantOrderModel.updateDynamic(
      orderupdate,
      {
        order_id: req.body.MD,
      },
      table_name
    );

    const updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let logs = "";
    if (req.body.mode == "test") {
      logs = await order_logs.get_test_log_data(req.body.MD);
    } else {
      logs = await order_logs.get_log_data(req.body.MD);
    }

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiated MerchantOrder.update_3ds`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : telr_update_3ds_updated with body ${JSON.stringify(req.body)}`
    );
    try {
      const txn = await helpers.make_sequential_no(
        req.body.mode == "test" ? "TST_TXN" : "TXN"
      );

      const order_details = await orderTransactionModel.selectOne(
        "*",
        {
          order_id: req.body.MD,
        },
        table_name
      );
      // console.log("order_details", order_details)

      if (!order_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid Order Id"));
      }
      let action = await order_logs.get_order_request_details(
        req.body.MD,
        order_request_table
      );

      let fraudStatus = false;
      let fraudResponse = {};
      if (order_details.fraud_3ds_pending === 1) {
        const fraudCheckBody = {
          fraudRequestId: order_details.fraud_request_id,
          order_id: order_details.order_id,
          is3ds: 1,
        };
        const fraudServiceRequest = await fraudService.make3dsFraudCheck(
          fraudCheckBody
        );
        fraudStatus = fraudServiceRequest.status === "fail" ? true : false;
        fraudResponse = fraudServiceRequest;
      }

      const getCountryIso = await countryModel.getIos("iso2", {
        country_name: order_details?.billing_country,
      });
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : getCountryIso  ${JSON.stringify(getCountryIso)}`
      );

      let request_action = JSON.parse(action.request);
      let sale_payload = {
        type: order_details?.action.toLowerCase(),
        classValue: "ecom",
        currency: order_details?.currency,
        amount: order_details?.amount,
        description: order_details?.description,
        cvv: request_action.cvv,
        session: request_action.session,
        pareq: req.body?.PaRes,
        billingNameFirst: order_details?.customer_name.split(" ")[0] || "",
        billingNameLast: order_details?.customer_name.split(" ")[1] || "",
        billingLine1: order_details?.billing_address_line_1,
        billingLine2: order_details?.billing_address_line_2,
        billingCity: order_details?.billing_city,
        billingRegion: order_details?.billing_province,
        billingCountry: order_details.billing_country,
        billingZip: order_details?.billing_pincode,
        email: request_action.email,
        ip: req.headers.ip, //'183.177.126.44',//req.headers.ip,
        order_id: req.body.MD,
        card: request_action.card,
        expiry_month: request_action.expiry_month,
        expiry_year: request_action.expiry_year,
      };

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Initialized 3ds with data   ${JSON.stringify(sale_payload)}`
      );

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: req.body.MD,
        },
        table_name
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );
      if (!_getmid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Routes  Available for Transection"));
      }
      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: _getmid.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].checkout_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };

      const sale_api_res = await telr_sale.make3DSSaleRequest(
        sale_payload,
        _terminalcred,
        req.body.mode
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} :  3ds Respone with data   ${JSON.stringify(sale_api_res)}`
      );

      // console.log(logs);

      /* Update The payment status for various payment channel like qr, subscription and invoice */
      let qr_payment_status =
        sale_api_res.status === "A" ? "CAPTURED" : "FAILED";
      let qr_payment = await merchantOrderModel.selectOne(
        "id",
        {
          order_no: req.body.MD,
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
      let invoice_payment = await invModel.selectDynamic(
        "id",
        {
          order_id: req.body.MD,
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

      let payment_status = sale_api_res.status === "A" ? "CAPTURED" : "FAILED";
      let txn_type =
        order_details?.action.toLowerCase() === "auth" ? "AUTH" : "SALE";
      const order_status =
        order_details?.action.toLowerCase() == "auth"
          ? "AUTHORISED"
          : "CAPTURED";

      // let subs_payment = await merchantOrderModel.selectOne(
      //     "id",
      //     {
      //         order_no: req.body.MD,
      //     },
      //     "subs_payment"
      // );
      // if (subs_payment) {
      //     let subs_data = {
      //         payment_status:
      //             sale_api_res.status === "A" ? "CAPTURED" : "FAILED",
      //         transaction_date: updated_at,
      //     };

      //     logs.push(
      //         `${moment().format(
      //             "DD/MM/YYYY HH:mm:ss.SSS"
      //         )} : merchantOrderModel.updateDynamic`
      //     );

      //     await merchantOrderModel
      //         .updateDynamic(
      //             subs_data,
      //             {
      //                 id: subs_payment.id,
      //             },
      //             "subs_payment"
      //         )
      //         .then(async (result) => {
      //             let subscription_id = await helpers.get_data_list(
      //                 "subscription_id",
      //                 "subs_payment",
      //                 {
      //                     id: subs_payment.id,
      //                 }
      //             );
      //             let subs_id = subscription_id[0].subscription_id;

      //             let subs_data = await helpers.get_data_list(
      //                 "*",
      //                 "subscription",
      //                 {
      //                     subscription_id: subs_id,
      //                 }
      //             );
      //             const currentDate = moment().format("YYYY-MM-DD");
      //             let payload = subs_data[0];

      //             let next_data = await helpers.generateTable(
      //                 currentDate,
      //                 payload?.payment_interval,
      //                 payload?.plan_billing_frequency,
      //                 payload?.terms,
      //                 payload?.subscription_id,
      //                 payload?.email,
      //                 sale_api_res?.tranref,
      //                 payload?.initial_payment_amount,
      //                 payload?.final_payment_amount,
      //                 payload?.plan_billing_amount,
      //                 payload?.plan_id
      //             );
      //             if (sale_api_res.status === "A") {
      //                 for (let val of next_data) {
      //                     val.order_id = req.body.MD;
      //                     await merchantOrderModel
      //                         .addDynamic(val, "subscription_recurring")
      //                         .then((result) => { })
      //                         .catch((error) => {
      //                         });
      //                 }
      //             }
      //         })
      //         .catch((error) => {
      //         });
      // }

      /* Update the payment status for various payment channel end */

      if (sale_api_res.status === "A") {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : helpers.make_sequential_no = ${txn}`
        );
        let response_category = await helpers.get_error_category(
          "00",
          "telr",
          order_status
        );
        let order_txn = {
          status: "AUTHORISED",
          psp_code: "00",
          paydart_category: response_category?.category,
          remark: response_category?.response_details,
          txn: txn,
          type: order_details?.action.toUpperCase(),
          payment_id: sale_api_res?.tranref,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          order_reference_id: "",
          capture_no: "",
        };
        if (req.body.mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        // transaction charge

        if (order_status === "CAPTURED") {
          // check if Subscription Payment
          await manageSubscription(
            order_details,
            payment_status,
            updated_at,
            sale_api_res?.tranref,
            sale_api_res?.tranref,
            req.body.mode
          );
          // subscription code end
          if (payment_status !== "FAILED") {
            /*Referrer commission started*/
            calculateAndStoreReferrerCommission({
              amount: order_details?.amount,
              currency: order_details?.currency,
              order_id: order_details?.order_id,
              merchant_id: order_details?.merchant_id,
              payment_id: txn,
              order_status: order_status,
              txn_type: txn_type,
            });
            /*Referrer commission ends*/

            const transaction_and_feature_data = {
              amount: order_details?.amount,
              currency: order_details?.currency,
              order_id: order_details?.order_id,
              merchant_id: order_details?.merchant_id,
              card_country: order_details?.card_country,
              payment_method: order_details?.payment_mode,
              scheme: order_details?.scheme,
              psp_id: order_details?.psp_id,
              terminal_id: order_details?.terminal_id,
              origin: order_details?.origin,
              //change param
              payment_id: txn,
              order_status: order_status,
              txn_status: txn_type,
              txn_id: txn,
            };
            // transaction charge
            // calculateTransactionCharges(transaction_and_feature_data);

            // transaction feature charges
            // calculateFeatureCharges(transaction_and_feature_data);
          }
        }

        let orderupdate = {
          status: order_status,
          psp: "TELR",
          saved_card_for_recurring: sale_api_res?.tranref,
        };

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : orderTransactionModel.add with data ${JSON.stringify(order_txn)}`
        );
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: order_details?.order_id,
          },
          table_name
        );

        let p_request_id = await helpers.make_sequential_no(
          req.body.mode == "test" ? "TST_REQ" : "REQ"
        );
        let merchant_id = await helpers.get_data_list(
          "merchant_id",
          table_name,
          {
            order_id: order_details.order_id,
          }
        );

        let order_req = {
          merchant_id: merchant_id[0].merchant_id,
          order_id: order_details.order_id,
          request_id: p_request_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(
          order_req,
          req.body.mode == "test"
            ? "test_generate_request_id"
            : "generate_request_id"
        );

        let new_res = {
          m_order_id: order_details.merchant_order_id
            ? order_details.merchant_order_id
            : "",
          p_order_id: order_details.order_id ? order_details.order_id : "",
          p_request_id: p_request_id,
          psp_ref_id: sale_api_res.tranref ? sale_api_res.tranref : "",
          psp_txn_id: sale_api_res.tranref ? sale_api_res.tranref : "",
          transaction_id: txn,
          status: "SUCCESS",
          status_code: "00",
          remark: response_category?.response_details,
          paydart_category: response_category?.category,
          currency: order_details.currency,
          return_url: order_details.success_url,
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          amount: order_details.amount.toFixed(2),
          m_customer_id: order_details.merchant_customer_id
            ? order_details.merchant_customer_id
            : "",
          psp: order_details.psp,
          payment_method: order_details.payment_mode,
          m_payment_token: order_details.card_id,
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

        let res_obj = {
          order_status: order_status,
          payment_id: order_details?.payment_id,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          return_url: order_details?.return_url,
          token: req.body.browserFP || "",
          message: "Payment Successful",
          new_res: new_res,
        };
        // adding dump entry
        let response_dump = {
          order_id: req.body.MD,
          type: order_details?.action.toUpperCase(),
          status: "APPROVED",
          dump: JSON.stringify(sale_api_res),
        };

        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: order_details?.order_id,
          mode: req.body.mode,
        });
        let txnFailedLog = {
          order_id: order_details.order_id,
          terminal: order_details?.terminal_id,
          req: JSON.stringify(sale_payload),
          res: JSON.stringify(sale_api_res),
          psp: "TELR",
          status_code: "00",
          description: sale_api_res?.message,
          activity: "Transaction success with Telr",
          status: 0,
          mode: req.body.mode,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: txn,
          card_proxy: temp_card_details.card_proxy,
          "3ds_version": "1",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        await helpers.addTransactionFailedLogs(txnFailedLog);

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : orderTransactionModel.addResDump with data ${JSON.stringify(
            response_dump
          )}`
        );

        // console.log("logs", logs)

        if (req.body.mode == "test") {
          await orderTransactionModel.addTestResDump(response_dump);
        } else {
          await orderTransactionModel.addResDump(response_dump);
        }

        if (fraudStatus === true) {
          const response_category_fraud = await helpers.get_error_category(
            "143",
            "paydart",
            "FAILED"
          );
          const VoidTransactionPayload = {
            order_id: order_details.order_id.toString(),
            txn_id: txn.toString(),
            action: "VOID",
            mode: req.body.mode,
          };
          const voidTransaction = await fraudService.voidTransaction(
            VoidTransactionPayload
          );
          if (voidTransaction.status === "success") {
            const payment_id = await helpers.make_sequential_no(
              req.body.mode == "test" ? "TST_TXN" : "TXN"
            );
            const order_txn_update = {
              txn: payment_id,
              order_id: order_details?.order_id || "",
              currency: order_details?.currency || "",
              amount: order_details?.amount || "",
              type: order_details?.action.toUpperCase(),
              status: "FAILED",
              psp_code: "",
              paydart_category: response_category_fraud.category,
              remark: "Blocked by PayDart",
              capture_no: "",
              created_at: updated_at || "",
              payment_id: payment_id || "",
              order_reference_id: order_details?.orderReference || "",
            };

            if (transaction_mode == "test") {
              await orderTransactionModel.test_txn_add(order_txn_update);
            } else {
              await orderTransactionModel.add(order_txn_update);
            }

            console.log("🚀 ~ update_3ds2_ni: ~ fraudResponse:", fraudResponse);
            const new_res = {
              m_order_id: order_details.merchant_order_id || "",
              p_order_id: order_details.order_id || "",
              p_request_id: p_request_id,
              psp_ref_id: sale_api_res.tranref || "",
              psp_txn_id: sale_api_res.tranref || "",
              transaction_id: txn,
              status: "FAILED",
              status_code: "143",
              remark: fraudResponse?.message,
              paydart_category: response_category_fraud?.category,
              currency: order_details.currency,
              return_url: order_details.failure_url,
              transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
              amount: order_details.amount.toFixed(2),
              m_customer_id: order_details.merchant_customer_id || "",
              psp: order_details.psp,
              payment_method: order_details.payment_mode,
              m_payment_token: order_details.card_id,
              payment_method_data: {
                scheme: order_details.scheme,
                card_country: order_details.card_country,
                card_type: order_details.cardType,
                mask_card_number: order_details.pan,
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: order_details?.merchant_id || "",
            };

            res_obj = {
              order_status: order_status,
              payment_id: order_details?.payment_id,
              order_id: order_details?.order_id,
              amount: order_details?.amount,
              currency: order_details?.currency,
              return_url: order_details?.return_url,
              token: req.body.browserFP || "",
              message: "Payment Failed",
              new_res: new_res,
            };

            await merchantOrderModel.updateDynamic(
              {
                //type : res_order_data?.action.toUpperCase(),
                status: "FAILED",
              },
              { order_id: order_details?.order_id },
              table_name
            );
          }
        }

        // Adding event base charges update in payment
        ee.once("ping", async (arguments) => {
          // Sending mail to customers and merchants about transaction

          let order_id = req.bodyString("MD");
          let qb = await pool.get_connection();
          let merchant_and_customer_transaction_response;
          try {
            merchant_and_customer_transaction_response = await qb
              .select(
                "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
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
          let merchant_mail_response = await mailSender.MerchantTransactionMail(
            mail_details
          );
        });
        ee.emit("ping", {
          message: "hello",
        });
        // event base charges update end

        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: updated_at,
        };
        await order_logs.update_logs_data(
          {
            order_id: order_details.order_id,
          },
          logs_payload,
          req.body.mode
        );

        if (fraudStatus === true) {
          const VoidTransactionPayload = {
            order_id: order_details.order_id,
            txn_id: order_details?.payment_id,
            action: "VOID",
            mode: "test",
          };
          const voidTransaction = await fraudService.voidTransaction(
            VoidTransactionPayload
          );
        }

        // web  hook starting
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: merchant_id[0].merchant_id,
        });
        let web_hook_res = Object.assign({}, res_obj.new_res);
        delete web_hook_res?.return_url;
        delete web_hook_res?.paydart_category;
        if (hook_info[0]) {
          if (
            hook_info[0].enabled === 0 &&
            hook_info[0].notification_url != ""
          ) {
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
          .send(successdatamsg(res_obj, "Paid successfully."));
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
          txn: txn,
          type: order_details.action.toUpperCase(),
          payment_id: sale_api_res?.tranref,
          psp_code: sale_api_res?.code,
          remark: response_category?.response_details,
          paydart_category: response_category?.category,
          payment_id: sale_api_res?.tranref,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          order_reference_id: "",
          capture_no: "",
        };
        if (req.body.mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }

        let orderupdate = {
          status: status,
          psp: "TELR",
        };
        await merchantOrderModel.updateDynamic(
          orderupdate,
          {
            order_id: order_details?.order_id,
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
        if (req.body.mode == "test") {
          await orderTransactionModel.addTestResDump(response_dump);
        } else {
          await orderTransactionModel.addResDump(response_dump);
        }
        let p_request_id = await helpers.make_sequential_no("REQ");
        let merchant_id = await helpers.get_data_list(
          "merchant_id",
          table_name,
          {
            order_id: order_details.order_id,
          }
        );

        let order_req = {
          merchant_id: merchant_id[0].merchant_id,
          order_id: order_details.order_id,
          request_id: p_request_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, "generate_request_id");
        let new_res = {
          m_order_id: order_details.merchant_order_id
            ? order_details.merchant_order_id
            : "",
          p_order_id: order_details.order_id ? order_details.order_id : "",
          p_request_id: p_request_id,
          psp_ref_id: sale_api_res.tranref ? sale_api_res.tranref : "",
          psp_txn_id: sale_api_res.tranref ? sale_api_res.tranref : "",
          transaction_id: txn,
          status: "FAILED",
          status_code: sale_api_res?.code,
          remark: response_category?.response_details,
          paydart_category: response_category?.category,
          currency: order_details.currency,
          return_url: order_details.failure_url,
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          amount: order_details.amount.toFixed(2),
          m_customer_id: order_details.merchant_customer_id
            ? order_details.merchant_customer_id
            : "",
          psp: order_details.psp,
          payment_method: order_details.payment_mode,
          m_payment_token: order_details.card_id,
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
        let res_obj = {
          order_status: status,
          payment_id: txn,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          token: req.body.browserFP || "",
          return_url: order_details.return_url,
          message: sale_api_res.message,
          new_res: new_res,
        };

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : orderTransactionModel.addResDump  = ${response_dump}`
        );
        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: req.body.MD,
          mode: req.body.mode,
        });
        let txnFailedLog = {
          order_id: req.body.MD,
          terminal: order_details?.terminal_id,
          req: JSON.stringify(sale_payload),
          res: JSON.stringify(sale_api_res),
          psp: "TELR",
          status_code: sale_api_res?.code,
          description: sale_api_res?.message,
          activity: "Transaction failed with Telr",
          status: 1,
          mode: req.body.mode,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: txn,
          card_proxy: temp_card_details.card_proxy,
          "3ds_version": "1",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        await helpers.addTransactionFailedLogs(txnFailedLog);

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
            req.body.mode
          )
          .then((result) => {})
          .catch((err) => {
            console.log(err);
            winston.error(err);
          });

        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(res_obj, sale_api_res.message));
      }
    } catch (error) {
      winston.error(error);

      console.log(error);

      let orderupdate = {
        data_3ds: JSON.stringify(error),
      };

      let table_name = "orders";
      let order_request_table = "order_request";
      if (req.body.mode == "test") {
        table_name = "test_orders";
        order_request_table = "test_order_request";
      }

      await merchantOrderModel.updateDynamic(
        orderupdate,
        {
          order_id: req.body.MD,
        },
        table_name
      );

      return res.status(statusCode.ok).send(response.errormsg(error?.message));
    }
  },

  transaction: async (req, res) => {
    try {
      let action = req.bodyString("action");
      req.body.txn_id = req.bodyString("transaction_id");
      const mode = req?.credentials?.type || req?.body?.mode;

      let order = await orderTransactionModel.selectOne(
        "order_id",
        { txn: req.bodyString("transaction_id") },
        mode == "test" ? "test_order_txn" : "order_txn"
      );

      req.body.p_order_id = order.order_id;

      // let txn_details
      // if (req.bodyString('p_order_id')) {
      //     txn_details = await orderTransactionModel.selectOne('order_id,txn', {payment_id: req.bodyString('p_order_id')}, 'order_txn')
      // }

      if (order) {
        switch (action) {
          case "CAPTURE": {
            await capture(req, res);
            break;
          }
          case "VOID": {
            await order_telr_cancel(req, res);
            break;
          }
          case "REFUND": {
            await open_telr_refund(req, res);
            break;
          }
          case "RECURRING": {
            if (mode === "test") {
              await PaymentRecurringController.RecurringApiTest(req, res);
            } else {
              await PaymentRecurringController.RecurringApi(req, res);
            }

            break;
          }

          default:
            return;
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Order does not exist/not prcessed yet/already proccessed"
            )
          );
      }
    } catch (err) {
      winston.error(err);
      res.status(statusCode.internalError).send(response.errormsg(err.message));
    }
  },

  transaction_details: async (req, res) => {
    try {
      let mode = req.credentials.type;
      let and_condition = {};
      //req.bodyString("m_order_id") == ''
      if (req.query.p_order_id == "") {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Please provide p_order_id"));
      }
      if (req.bodyString("m_order_id")) {
        and_condition.merchant_order_id = req.bodyString("m_order_id");
      }
      if (req.query.p_order_id) {
        and_condition.order_id = req.query.p_order_id;
      }
      // if (req.bodyString("txn_id")) {
      //     and_condition.payment_id = req.bodyString("txn_id");
      // }

      // if (req.bodyString("psp_txn_id")) {
      //     and_condition.order_id = req.bodyString("psp_txn_id");
      // }

      let result = await orderTransactionModel.selectOne(
        "*",
        and_condition,
        mode == "test" ? "test_orders" : "orders"
      );

      if (result) {
        let transaction_condition = {
          order_id: req.query.p_order_id,
        };
        let transaction = await orderTransactionModel.selectDynamic(
          transaction_condition,
          "*",
          mode == "test" ? "test_order_txn" : "order_txn"
        );
        let trans_history = [];
        for (let val of transaction) {
          let temp = {
            order_id: val?.order_id ? val?.order_id : "",
            transaction_id: val?.txn ? val?.txn : "",
            type: val.type,
            status: val?.status ? val?.status : "",
            created_at: val?.created_at ? val?.created_at : "",
          };
          trans_history.push(temp);
        }

        let trans_data = await helpers.get_trans_data(result?.order_id);
        let amount_caputred =
          await orderTransactionModel.selectCaptureAmountSum(
            "*",
            { order_id: result?.order_id },
            mode == "test" ? "test_order_txn" : "order_txn"
          );
        let new_res = {
          m_order_id: result?.merchant_order_id
            ? result?.merchant_order_id
            : "",
          p_order_id: result?.order_id ? result?.order_id : "",
          p_request_id: trans_data[0]?.last_request_id
            ? trans_data[0]?.last_request_id
            : "",
          psp_ref_id: trans_data[0]?.last_psp_ref_id
            ? trans_data[0]?.last_psp_ref_id
            : "",
          transaction_id: result?.payment_id ? result?.payment_id : "",
          psp_txn_id: trans_data[0]?.last_psp_txn_id
            ? trans_data[0]?.last_psp_txn_id
            : "",
          transaction_date:
            result && result.updated_at
              ? moment(result.updated_at).format("DD-MM-YYYY hh:mm:ss")
              : "",
          // transaction_status: result?.status ? result?.status : "",
          status: result?.status ? result?.status : "",
          currency: result?.currency ? result?.currency : "",
          amount: result?.amount ? result?.amount.toFixed(2) : "",
          amount_caputred: amount_caputred.amount.toFixed(2),
          psp: result?.psp ? result?.psp : "",
          payment_method: result?.payment_mode ? result?.payment_mode : "",
          //  payment_method_id: result?.pan, // missing field
          //  is_oneclick: "", // missing field
          // is_retry: "", // missing field
          //  is_cascade: "", // missing field
          m_customer_id: result?.merchant_customer_id,
          // customer_email: result?.customer_email
          //     ? result?.customer_email
          //     : "",
          // customer_mobile_code: result?.customer_code
          //     ? result?.customer_code
          //     : "",
          // customer_mobile: result?.customer_mobile
          //     ? result?.customer_mobile
          //     : "",
          // customer_country: result?.billing_country
          //     ? result?.billing_country
          //     : "",
          m_payment_token: result?.card_id ? result?.card_id : "",
          payment_method_data: {
            scheme: result?.scheme ? result?.scheme : "",
            card_country: result?.card_country ? result?.card_country : "",
            card_type: result?.cardType ? result?.cardType : "",
            masked_pan: result?.pan ? result?.pan : "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: result?.merchant_id
            ? await helpers.formatNumber(result?.merchant_id)
            : "",
          transaction_history: trans_history,
          channel: result.channel ? result.channel : "",
        };

        try {
          let charges_result = await charges_invoice_models.get_order_charges(
            req?.query?.p_order_id
          );
          console.log("🚀 ~ .then ~ charges_result:", charges_result);
          let charges = {
            fee: 0.0,
            tax: 0.0,
            calculated_fee: 0.0,
            applied_fee: 0.0,
            applied_tax: 0.0,
            net_amount: 0.0,
          };
          if (charges_result?.length > 0) {
            let changesObj = charges_result[0];
            charges = {
              gross_amount: changesObj.amount.toFixed(2),
              // fee:
              //   parseFloat(changesObj.sale_rate_fix_charge) +
              //   parseFloat(changesObj.sale_rate_percent_charge),
              // tax: changesObj.sale_rate_tax,
              // calculated_fee: changesObj.calculated_fee.toFixed(2),
              applied_fee: changesObj.applied_fee.toFixed(2),
              applied_tax: changesObj.applied_tax.toFixed(2),
              total_fee: changesObj.sell_rate_total_charge.toFixed(2),
              net_amount: parseFloat(
                changesObj.amount -
                  (parseFloat(changesObj.sale_rate_fix_charge) +
                    parseFloat(changesObj.sale_rate_percent_charge) +
                    parseFloat(changesObj.sale_rate_tax))
              ).toFixed(2),
            };
          }
          new_res.transaction_charges = charges;
        } catch (error) {
          console.log("🚀 ~ .then ~ error:", error);
        }

        // let resp_data = {
        //     data_id: enc_dec.cjs_encrypt(result.id),
        //     m_order_id: result.merchant_order_id,
        //     p_order_id: transaction[1].payment_id,
        //     // p_request_id:
        //     psp_ref_id: enc_dec.cjs_encrypt(result.psp_id),
        //     transaction_id: transaction[1].txn_id,
        //     // psp_txn_id:
        //     status: result.status,
        //     // statusCode:
        //     amount: result.amount,
        //     m_customer_id: enc_dec.cjs_encrypt(result.merchant_id),
        //     psp: result.psp,
        //     payment_method: result.origin,
        //     payment_token: result.payment_token_id,
        //     payment_method_data: {
        //         scheme: result.scheme,
        //         // card_country: ,
        //         card_type: result.cardType,
        //         masked_pan: result.pan,
        //     },
        //     // apm_name:
        //     // apm_identifier: result
        //     // submerchant:
        // };

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              new_res,
              "Successfully fetched transaction details"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid p_order_id"));
      }
    } catch (err) {
      winston.error(err);
      res.status(statusCode.internalError).send(response.errormsg(err.message));
    }
  },

  // transaction_details: async (req, res) => {
  //     try {
  //         let condition = {
  //             order_id: req.bodyString("order_id"),
  //         };

  //         if (req.bodyString("m_order_id")) {
  //             condition.merchant_order_id = req.bodyString("m_order_id");
  //         }

  //         if (req.bodyString("txn_id")) {
  //         }

  //         let transaction_condition = {
  //             order_id: req.bodyString("order_id"),
  //         };
  //         let result = await orderTransactionModel.selectOne(
  //             "*",
  //             condition,
  //             "orders"
  //         );
  //         let transaction = await orderTransactionModel.selectDynamic(
  //             transaction_condition,
  //             "*",
  //             "order_txn"
  //         );

  //         let resp_data = {
  //             data_id: enc_dec.cjs_encrypt(result.id),
  //             m_order_id: result.merchant_order_id,
  //             p_order_id: transaction[1].payment_id,
  //             // p_request_id:
  //             psp_ref_id: enc_dec.cjs_encrypt(result.psp_id),
  //             transaction_id: transaction[1].txn_id,
  //             // psp_txn_id:
  //             status: result.status,
  //             // statusCode:
  //             amount: result.amount,
  //             m_customer_id: enc_dec.cjs_encrypt(result.merchant_id),
  //             psp: result.psp,
  //             payment_method: result.origin,
  //             payment_token: result.payment_token_id,
  //             payment_method_data: {
  //                 scheme: result.scheme,
  //                 // card_country: ,
  //                 card_type: result.cardType,
  //                 masked_pan: result.pan,
  //             },
  //             // apm_name:
  //             // apm_identifier: result
  //             // submerchant:
  //         };

  //         res.status(statusCode.ok).send(
  //             response.successdatamsg(
  //                 resp_data,
  //                 "Successfully fetched transaction details"
  //             )
  //         );
  //     } catch (err) {
  //         res.status(statusCode.internalError).send(
  //             response.errormsg(err.message)
  //         );
  //     }
  // },
 transaction_list: async (req, res) => {
    try {
      let limit = {
        perpage: 0,
        page: 0,
      };

      if (req.query.perpage && req.query.page) {
        perpage = req.query.perpage;
        start = req.query.page;
        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      let and_filter_obj = {};
      let date_condition = {};
      let amount_condition = {};
      let like_condition = {};
      let trans_date = {};

      let table_name = "";
      if (req.credentials.type == "test") {
        table_name = "test_orders";
      } else {
        table_name = "orders";
      }

      // if (req?.user?.merchant_id) {
        and_filter_obj.merchant_id = req?.user?.merchant_id || req.credentials.merchant_id;
      // }
      if (req.credentials.super_merchant_id) {
        and_filter_obj.super_merchant = req.credentials.super_merchant_id;
      }

      // all filters
      if (req.query.p_order_id) {
        and_filter_obj.order_id = req.query.p_order_id;
      }
      if (req.query.transaction_id) {
        and_filter_obj.payment_id = req.query.transaction_id;
      }
      // if (req.query.transaction_date) {
      //     trans_date.updated_at =req.query.transaction_date;
      // }
      // if (req.query.status_code) {
      //     and_filter_obj.status =req.query.status_code;
      // }
      if (req.query.status) {
        and_filter_obj.status = req.query.status;
      }
      if (req.query.payment_method_id) {
        and_filter_obj.pan = req.query.payment_method_id; // missing field
      }
      if (req.query.payment_method) {
        and_filter_obj.payment_mode = req.query.payment_method;
      }
      // if (req.bodyString("payment_mode")) {
      //     and_filter_obj.origin = req.bodyString("payment_mode");
      // }
      if (req.query.m_payment_token) {
        and_filter_obj.payment_token_id = req.query.m_payment_token;
      }
      if (req.query.card_bin) {
        like_condition.pan = req.query.card_bin;
      }
      if (req.query.processor) {
        and_filter_obj.psp = req.query.processor;
      }
      // if (req.query.mid) {
      //     and_filter_obj.terminal_id = req.bodyString("mid");
      // }
      if (req.query.currency_code) {
        and_filter_obj.currency = req.query.currency_code;
      }
      if (req.query.from_date) {
        let from_date_check = moment(req.query.from_date).format("YYYY-MM-DD");
        if (from_date_check != "Invalid date") {
          date_condition.from_date = from_date_check;
        }
      }

      if (req.query.to_date) {
        let to_date_check = moment(req.query.to_date).format("YYYY-MM-DD");
        if (to_date_check != "Invalid date") {
          date_condition.to_date = to_date_check;
        }
      }
      if (req.query.min_amount) {
        amount_condition.min_amount = req.query.min_amount;
      }
      if (req.query.max_amount) {
        amount_condition.max_amount = req.query.max_amount;
      }
      if (req.query.m_customer_id) {
        and_filter_obj.merchant_customer_id = enc_dec.cjs_decrypt(
          req.query.m_customer_id
        );
      }
      if (req.query.customer_email) {
        and_filter_obj.customer_email = req.query.customer_email;
      }
      if (req.query.customer_mobile) {
        and_filter_obj.customer_mobile = req.query.customer_mobile;
      }
      if (req.query.customer_country) {
        and_filter_obj.billing_country = req.query.customer_country;
      }
      // if (req.bodyString("apm_identifier")) {
      //     // and_filter_obj.apm_identifier = req.bodyString("apm_identifier"); // missing field
      // }
      // if (req.bodyString("is_oneclick")) {
      //     // and_filter_obj.is_oneclick = req.bodyString("is_oneclick"); // missing field
      // }
      // if (req.bodyString("is_retry")) {
      //     // and_filter_obj.is_retry = req.bodyString("is_retry"); // missing field
      // }
      // if (req.bodyString("is_cascade")) {
      //     // and_filter_obj.is_cascade = req.bodyString("is_cascade"); // missing field
      // }

      let result = await TransactionsModel.open_trans_select(
        and_filter_obj,
        date_condition,
        amount_condition,
        like_condition,
        limit,
        table_name,
        trans_date,
        req.credentials.type
      );
      let resp_data = [];
      if (result.length > 0) {
        for (let val of result) {
          let trans_data = await helpers.get_trans_data(
            val?.order_id,
            req.credentials.type
          );
          let amount_caputred =
            await orderTransactionModel.selectCaptureAmountSum(
              "*",
              { order_id: val.order_id },
              req.credentials.type == "test" ? "test_order_txn" : "order_txn"
            );

          let new_res = {
            m_order_id: val?.merchant_order_id ? val?.merchant_order_id : "",
            p_order_id: val?.order_id ? val?.order_id : "",
            p_request_id: trans_data[0]?.last_request_id
              ? trans_data[0]?.last_request_id
              : "",
            psp_ref_id: trans_data[0]?.last_psp_ref_id
              ? trans_data[0]?.last_psp_ref_id
              : "",
            transaction_id: val?.payment_id ? val?.payment_id : "",
            psp_txn_id: trans_data[0]?.last_psp_txn_id
              ? trans_data[0]?.last_psp_txn_id
              : "",
            transaction_date:
              val && val.updated_at
                ? moment(val.updated_at).format("DD-MM-YYYY hh:mm:ss")
                : "",
            // transaction_status: val?.status ? val?.status : "",
            status: val?.status ? val?.status : "",
            currency: val?.currency ? val?.currency : "",
            amount: val?.amount ? val?.amount.toFixed(2) : "",
            amount_captured: amount_caputred.amount.toFixed(2),
            psp: val?.psp ? val?.psp : "",
            payment_method: val?.payment_mode ? val?.payment_mode : "",
            // payment_method_id: "", // missing field
            // is_oneclick: "", // missing field
            // is_retry: "", // missing field
            // is_cascade: "", // missing field
            m_customer_id: val?.merchant_customer_id,
            // customer_email: val?.customer_email
            //     ? val?.customer_email
            //     : "",
            // customer_mobile_code: val?.customer_code
            //     ? val?.customer_code
            //     : "",
            // customer_mobile: val?.customer_mobile
            //     ? val?.customer_mobile
            //     : "",
            // customer_country: val?.billing_country
            //     ? val?.billing_country
            //     : "",
            m_payment_token: val?.card_id ? val?.card_id : "",
            payment_method_data: {
              scheme: val?.scheme ? val?.scheme : "",
              card_country: val?.card_country ? val?.card_country : "",
              card_type: val?.cardType ? val?.cardType : "",
              masked_pan: val?.pan ? val?.pan : "",
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: val?.merchant_id
              ? await helpers.formatNumber(val?.merchant_id)
              : "",
            channel: result.channel ? result.channel : "",
          };

          // let data = {
          //     data_id: enc_dec.cjs_encrypt(item.id),
          //     m_order_id: item.merchant_order_id,
          //     p_order_id: item.order_id,
          //     p_request_id: item.payment_id,
          //     psp_ref_id: item.psp_id
          //         ? enc_dec.cjs_encrypt(item.psp_id)
          //         : "",
          //     psp: item.psp,
          //     status: item.status,
          //     amount: item.amount,
          //     m_customer_id: item.mechant_customer_id
          //         ? enc_dec.cjs_encrypt(item.merchant_customer_id)
          //         : "",
          //     // paymeny_method: item.card
          //     m_payment_token: item.payment_token_id
          //         ? item.payment_token_id
          //         : "",
          //     payment_method_data: {
          //         scheme: item.scheme ? item.scheme : "",
          //         // card_country:
          //         card_type: item.cardType ? item.cardType : "",
          //         masked_pan: item.pan ? item.pan : "",
          //     },
          // };

          resp_data.push(new_res);
        }
      }
      total_count = await TransactionsModel.open_trans_get_count(
        and_filter_obj,
        date_condition,
        amount_condition,
        like_condition,
        table_name,
        trans_date
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            resp_data,
            "Successfully fetched list",
            total_count
          )
        );
    } catch (err) {
      console.log(err);
      winston.error(err);
      res.status(statusCode.internalError).send(response.errormsg(err.message));
    }
  },
  create_qr_order_updated: async (req, res) => {
    const logs = [];
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
        req.protocol
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url}`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Request content-type = ${
        req.headers["content-type"]
      }`
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
        req.headers["content-length"]
      }`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : MerchantOrder.create initiated`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : request with data ${JSON.stringify(req.body)}`
    );

    let client = {
      os: req.headers.os,
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
    };
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    let billing_details = req.body.data.billing_details;
    let shipping_details = req.body.data.shipping_details;
    let qr_order_data = await merchantOrderModel.selectData(
      req.body.data.order_details.paymentlink_id
    );
    const uid = new ShortUniqueId({
      length: 10,
    });
    let order_id = await helpers.make_sequential_no("ORD");
    let payment_token = req.body.data.payment_token;
    let urls = req.body.data.urls;
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : helpers.make_sequential_no ${order_id}`
    );

    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      env: req.credentials.type,
      merchant_id: req.credentials.merchant_id,
      email: customer_details.email,
    };
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "live";
    } else {
      mode = "live";
    }
    let token = accessToken(token_payload);

    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : accessToken ${token}`
    );

    let ins_body = {
      merchant_id: req.credentials.merchant_id,
      mcc: req.credentials.mcc_id,
      mcc_category: req.credentials.mcc_cat_id,
      super_merchant: req.credentials.super_merchant_id,
      customer_name: customer_details.name,
      customer_email: customer_details.email,
      customer_code: customer_details.code,
      customer_mobile: customer_details.mobile,
      billing_address_line_1: billing_details.address_line1
        ? billing_details.address_line1
        : "",
      billing_address_line_2: billing_details.address_line2
        ? billing_details.address_line2
        : "",
      billing_city: billing_details.city ? billing_details.city : "",
      billing_pincode: billing_details.pin ? billing_details.pin : "",
      billing_province: billing_details.province
        ? billing_details.province
        : "",
      billing_country: billing_details.country ? billing_details.country : "",
      shipping_address_line_1: shipping_details.address_line1
        ? shipping_details.address_line1
        : "",
      shipping_address_line_2: shipping_details.address_line2
        ? shipping_details.address_line2
        : "",
      shipping_city: shipping_details.city ? shipping_details.city : "",
      shipping_country: shipping_details.country
        ? shipping_details.country
        : "",
      shipping_province: shipping_details.province
        ? shipping_details.province
        : "",
      shipping_pincode: shipping_details.pin ? shipping_details.pin : "",
      amount: order_details.amount,
      amount_left: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      description: order_details?.description,
      status: status,
      origin: "REMOTE",
      order_id: order_id,
      browser: client.browser,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
      action: req.body.data.action,
      capture_method: req.body.data.capture_method
        ? req.body.data.capture_method
        : "MANUAL",
      merchant_order_id: order_details.m_order_id,
      payment_token_id: payment_token,
      success_url: urls.success,
      cancel_url: urls.cancel,
      failure_url: urls.failure,
      merchant_customer_id: customer_details.m_customer_id,
    };
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : initiate mode ${mode}`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add`
    );
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.add with data ${JSON.stringify(
        ins_body
      )}`
    );

    merchantOrderModel
      .add(ins_body, mode)
      .then(async (result) => {
        let p_request_id = await helpers.make_sequential_no("REQ");
        let order_req = {
          merchant_id: req.credentials.merchant_id,
          order_id: order_id,
          request_id: p_request_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, "generate_request_id");

        let res_order_details = {
          status: "SUCCESS",
          status_code: "PENDING",
          message: "Order created",
          token: token,
          p_order_id: order_id,
          m_order_id: order_details.m_order_id,
          p_request_id: p_request_id,
          order_creation_date: moment(created_at).format("DD/MM/YYYY HH:mm:ss"),
          amount: order_details.currency + " " + order_details.amount,
          payment_link:
            process.env.PAYMENT_URL + "initiate/" + order_id + "/" + token,
          iframe_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "?origin=iframe",
        };
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(res_order_details)}`
        );

        res.status(statusCode.ok).send(res_order_details);
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });

    let logs_payload = {
      order_id: order_id,
      activity: JSON.stringify(logs),
    };
    let log_is = await order_logs
      .add(logs_payload, "order_logs")
      .then((result) => {})
      .catch((err) => {
        winston.error(err);
      });
  },
  transaction_new: async (req, res) => {
    try {
      let conditionOrder = {};
      if (req.body.order_id) {
        conditionOrder.order_id = req.body.order_id;
      } else {
        conditionOrder.id = enc_dec.cjs_decrypt(req.body.id);
      }
      let order_table = "orders";
      let txn_mode = 0;
      let mode = req?.body?.mode || req?.credentials?.type;
      if (mode == "test") {
        order_table = "test_orders";
        txn_mode = 1;
      }
      let order_new_details = await orderTransactionModel.selectOne(
        "order_id,currency,merchant_id,amount",
        conditionOrder,
        order_table
      );
      if (req.body?.amount) {
        req.body.amount = {
          value: req.body.amount,
          currencyCode: order_new_details.currency,
        };
      } else {
        req.body.amount = {
          value: order_new_details.amount,
          currencyCode: order_new_details.currency,
        };
      }
      req.body.p_order_id = order_new_details.order_id;

      req.body.reason = req.body.reason ? req.body.reason : "";
      if (req.body.action) {
        req.body.action = req.body.action;
      } else {
        req.body.action = "CAPTURE";
      }
      let order_id = req.bodyString("p_order_id");
      let condition = {
        order_id: order_id,
        // status: "AUTHORISED"
      };

      if (req.bodyString("m_order_id")) {
        condition.merchant_order_id = req.bodyString("m_order_id");
      }

      // if (req.bodyString("txn_id")) {
      //     condition.payment_id = req.bodyString("txn_id");
      // }

      let order = await orderTransactionModel.selectOne(
        "id",
        condition,
        order_table
      );
      req.user = {
        merchant_id: order_new_details?.merchant_id,
      };
      let action = req.body.action;
      // let txn_details
      // if (req.bodyString('p_order_id')) {
      //     txn_details = await orderTransactionModel.selectOne('order_id,txn', {payment_id: req.bodyString('p_order_id')}, 'order_txn')
      // }

      if (order) {
        switch (action) {
          case "CAPTURE": {
            await capture(req, res);
            break;
          }
          case "VOID": {
            await order_telr_cancel(req, res);
            break;
          }
          case "REFUND": {
            await open_telr_refund(req, res);
            break;
          }
          default:
            return;
        }
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Order does not exist/not prcessed yet/already proccessed"
            )
          );
      }
    } catch (err) {
      console.log(err);
      winston.error(err);
      res.status(statusCode.internalError).send(response.errormsg(err.message));
    }
  },
  check_card_expiry: async (req, res) => {
    try {
      let expired_card_list = await helpers.get_expired_list();
      for (let val of expired_card_list) {
        await mailSender
          .CardExpiryMail({
            mail_to: val.customer_email,
          })
          .then((res) => {})
          .catch((error) => {
            winston.error(error);
          });
      }

      res
        .status(statusCode.ok)
        .send(response.successansmsg("All email were sent."));
    } catch (error) {
      winston.error(error);

      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  auto_capture: async (req, res) => {
    try {
      let capture_order_data = await helpers.get_current_order_data();

      if (capture_order_data.length > 0) {
        for (let val of capture_order_data) {
          req.body.p_order_id = val.order_id;
          let condition = {
            order_id: val.order_id,
          };
          let checkPSP = await orderTransactionModel.selectOne(
            "psp",
            condition,
            "orders"
          );

          let checkStatus = await orderTransactionModel.selectOne(
            "status",
            condition,
            "orders"
          );

          req.body.amount = {
            currencyCode: val.currency,
            value: val.amount,
          };

          req.body.reason = val.description;

          if (checkStatus.status === "CAPTURED") {
            // res.status(statusCode.ok).send(
            //     response.errormsg("Order is already Captured.")
            // );
          } else {
            if (checkPSP) {
              switch (checkPSP.psp) {
                case "TELR":
                  await telr_capture_func(req, res);
                  break;
                case "NI":
                  await ni_capture_func(req, res);
                  break;
                case "PAYTABS":
                  await PayTabsController.paytabs_capture(req, res);
                  break;
                default:
                  return;
                // res.status(statusCode.ok).send(
                //     response.errormsg(
                //         "Unable to capture transaction - Invalid PSP"
                //     )
                // );
              }
            } else {
              // res.status(statusCode.ok).send(
              //     response.errormsg(
              //         "Unable to capture transaction - Invalid PSP or Order id"
              //     )
              // );
            }
          }
        }
        res
          .status(statusCode.ok)
          .send(response.successansmsg("All authorised payments captured"));
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No authorised payment to capture"));
      }
    } catch (error) {
      winston.error(error);

      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  autoCaptureTest: async (req, res) => {
    let autoCaptureTestres = autoCaptureTest();
    res
      .status(statusCode.ok)
      .send(
        response.successansmsg(
          autoCaptureTestres,
          "All authorised payments captured (mode-test)"
        )
      );
  },
  autoCaptureLive: async (req, res) => {
    let autoCaptureLiveres = autoCapture();
    res
      .status(statusCode.ok)
      .send(
        response.successansmsg(
          autoCaptureLiveres,
          "All authorised live payments captured (mode-live)"
        )
      );
  },

  TelrautoCaptureTest: async (req, res) => {
    let autoCaptureTestres = await TelrAutoCapture.main();
    res
      .status(statusCode.ok)
      .send(
        response.successansmsg(
          autoCaptureTestres,
          "All authorised payments captured"
        )
      );
  },

  auto_subscription_payCron: async () => {
    await auto_subscription_pay();
    return true;
  },
  auto_subscription_payRequest: async (req, res) => {
    const result = await auto_subscription_pay();
    return res.status(200).send(result);
  },
  auto_subscription_payRequestNew: async (req, res) => {
    const result = await auto_subscription_pay();
    return res.status(200).send(result);
  },
  set_order_expired: async (req, res) => {
    const { order_id, env_mode } = req.body;
    let table_name = env_mode == "test" ? "test_orders" : "orders";
    let order_details_psp = await merchantOrderModel.selectDynamicONE(
      "psp,terminal_id,status as order_status",
      { order_id: order_id },
      table_name
    );
    let response;
    if (order_details_psp?.order_status == "PENDING") {
      response = await merchantOrderModel.updateDynamic(
        {
          status: "EXPIRED",
        },
        { order_id: order_id },
        env_mode === "test" ? "test_orders" : "orders"
      );
    }

    return res.status(200).send(response);
  },
  confirm_wallet_payment: async (req, res) => {
    console.log(`the credentials are here`);
    console.log(req.credentials);
    console.log(`the user details are below`);
    console.log(req.user);
    console.log(req.body);

    let order_id = req.bodyString("order_id");
    let mode = "";
    let invoke_type = "";
    let sub_merchant_id = "";
    if (req.credentials) {
      mode = req.credentials.type;
      invoke_type = "API";
      sub_merchant_id = req.credentials.merchant_id;
      order_id = req.bodyString("p_order_id");
    }
    if (req.user) {
      if (req.user.type == "admin") {
        invoke_type = "Admin-Portal";
        mode = "live";
      }
      if (req.user.type == "merchant") {
        invoke_type = "Merchant-Portal";
        sub_merchant_id = req.user.id;
        mode = req.bodyString("mode");
      }
    }

    try {
      let table_name = mode == "test" ? "test_orders" : "orders";
      let order_details_psp = "";
      if (invoke_type == "Admin-Portal" || invoke_type == "Merchant-Portal") {
        order_details_psp = await merchantOrderModel.selectDynamicONE(
          "psp,terminal_id,status as order_status",
          { order_id: order_id },
          table_name
        );
      } else {
        order_details_psp = await merchantOrderModel.selectDynamicONE(
          "psp,terminal_id,status as order_status",
          { order_id: order_id, merchant_id: sub_merchant_id },
          table_name
        );
      }
      console.log(`calling from Admin Portal`);
      let psp = order_details_psp?.psp;
      console.log(`order_details_psp is ${JSON.stringify(order_details_psp)}`);
      console.log(`psp is ${psp}`);
      if (psp == "" && order_details_psp.order_status == "EXPIRED") {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Transaction is expired"));
      }
      if (order_details_psp) {
        if (
          order_details_psp?.order_status == "PENDING" ||
          order_details_psp?.order_status == "EXPIRED"
        ) {
          switch (psp) {
            case "MTN-MOMO":
              let mtn_res = await confirmMTN(order_id, mode);
              res
                .status(statusCode.ok)
                .send(
                  response.successansmsg(
                    mtn_res.data,
                    mtn_res.message,
                    "SUCCESS"
                  )
                );
              break;
            case "Orange Money":
              let orange_res = await confirmOrange(order_id, mode);
              res
                .status(statusCode.ok)
                .send(
                  response.successansmsg(
                    orange_res.data,
                    orange_res.message,
                    "SUCCESS"
                  )
                );
              break;
            case "ALPAY":
              let alpay_response = await confirmALPAY(order_id, mode);
              res
                .status(statusCode.ok)
                .send(
                  response.successansmsg(
                    alpay_response.data,
                    alpay_response.message,
                    "SUCCESS"
                  )
                );
              break;
            case "":
              res
                .status(statusCode.ok)
                .send(response.errormsg("Transaction not initiated"));
              break;
            default:
              res
                .status(statusCode.ok)
                .send(response.errormsg("Transaction expired"));
              break;
          }
        } else {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("Order is already processed"));
        }
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid order id or mode"));
      }
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  updateStatusOfExpiredOrder: async (order_id, mode) => {
    try {
      let table_name = mode == "test" ? "test_orders" : "orders";
      let order_details_psp = await merchantOrderModel.selectDynamicONE(
        "psp,terminal_id,status as order_status",
        { order_id: order_id },
        table_name
      );
      let psp = order_details_psp?.psp;
      console.log(`order_details_psp is ${JSON.stringify(order_details_psp)}`);
      console.log(`psp is ${psp}`);
      if (order_details_psp) {
        if (
          order_details_psp?.order_status == "PENDING" ||
          order_details_psp?.order_status == "EXPIRED"
        ) {
          switch (psp) {
            case "MTN-MOMO":
              let mtn_res = await confirmMTN(order_id, mode);
              break;
            case "Orange Money":
              console.log(`request body is at our orange confirm page`);
              let orange_res = await confirmOrange(order_id, mode);
              break;
          }
          return true;
        } else {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  },
  fetchOrderDetails: async (req, res) => {
    let order_id = req.bodyString("order_id");
    let mode = req.bodyString("mode");
    if (!order_id || !mode) {
      return res
        .status(statusCode.badRequest)
        .send(response.errormsg("Missing Parameters"));
    }
    try {
      let order_table = mode == "test" ? "test_orders" : "orders";
      let order_txn_table = mode == "test" ? "test_order_txn" : "order_txn";
      let order_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: order_id },
        order_table
      );
      let txn_data = await merchantOrderModel.selectOneLatest(
        "*",
        { order_id: order_id },
        order_txn_table
      );
      if (!order_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid order id or mode"));
      }
      console.log(`order details`);
      console.log(order_details);
      console.log(`txn details`);
      console.log(txn_data);
      const res_obj = {
        message: txn_data?.remark,
        order_status: order_details.status,
        psp_ref_id: txn_data?.payment_id,
        p_order_id: order_details.order_id,
        amount: order_details.amount,
        currency: order_details.currency,
        remark: "",
        new_res: {
          m_order_id: order_details?.m_order_id || "",
          p_order_id: order_details?.order_id || "",
          p_request_id: "",
          psp_ref_id: txn_data?.payment_id || "",
          psp_txn_id: "",
          transaction_id: txn_data?.txn,
          status: txn_data?.paydart_category,
          status_code: txn_data?.psp_code,
          remark: "",
          paydart_category: "",
          currency: order_details?.currency,
          return_url: process.env.PAYMENT_URL + "/status", //process.env.PAYMENT_URL + "/status",
          transaction_time: txn_data?.created_at
            ? moment(txn_data.created_at).format("DD-MM-YYYY hh:mm:ss")
            : moment(order_details?.created_at).format("DD-MM-YYYY hh:mm:ss"),
          amount: order_details?.amount.toFixed(2) || "",
          m_customer_id: order_details?.m_customer_id || "",
          psp: order_details?.psp || "",
          payment_method: order_details?.payment_mode || "",
          m_payment_token: order_details?.m_payment_token || "",
          mobile_no: order_details.pan,
          payment_method_data: {
            scheme: "",
            card_country: "",
            card_type: "Mobile Wallet",
            mask_card_number: "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: order_details?.merchant_id
            ? await helpers.formatNumber(order_details.merchant_id)
            : "",
        },
      };
      res
        .status(statusCode.ok)
        .send(
          response.successansmsg(
            res_obj,
            "Order details fetch successfully.",
            "SUCCESS"
          )
        );
    } catch (error) {
      console.log(error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    }
  },
};

async function telr_pay(req) {
  console.log("yesys");
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let payment_id = await helpers.make_sequential_no("TXN");
  let order_id = req.order_details.order_id;
  let payment_mode = req.order_details.payment_mode;
  let subscription_id = req.current_entry.subscription_id;

  //let logs = await order_logs.get_log_data(order_id);
  let logs = [];

  try {
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : Subscription recurring payment initiated by cron`
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : helpers.make_sequential_no ${payment_id}`
    );

    //check if already sub entry in order txn
    let checkTransaction = await orderTransactionModel.getDueDateTransaction(
      order_id,
      subscription_id
    );
    if (checkTransaction) {
      return true;
    }

    let table_name = "orders";

    let order_data = {
      payment_id: payment_id,
      payment_mode: payment_mode,
      updated_at: updated_at,
    };

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : initiate merchantOrderModel.updateDynamic with data ${JSON.stringify(
        order_data
      )}`
    );

    let status = "PENDING";
    merchantOrderModel
      .updateDynamic(
        order_data,
        {
          order_id: order_id,
        },
        table_name
      )
      .then(async (result) => {
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : response received ${JSON.stringify(result)}`
        );
        const res_order_data = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
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

        let sale_api_res;

        let sale_payload = {
          type: res_order_data?.action.toLowerCase(),
          classValue: "cont",
          currency: res_order_data.currency,
          amount: req.current_entry.amount,
          tranref: req.payment_ref_id,
        };

        const _terminalids = await merchantOrderModel.selectOne(
          "terminal_id",
          {
            order_id: order_id,
          },
          "orders"
        );
        const _getmid = await merchantOrderModel.selectOne(
          "MID,password,psp_id",
          {
            terminal_id: _terminalids.terminal_id,
          },
          "mid"
        );
        if (!_getmid) {
          // res.status(statusCode.badRequest).send(
          //     response.errormsg(
          //         "No Routes  Available for Transection"
          //     )
          // );
        }
        const _pspid = await merchantOrderModel.selectOne(
          "*",
          {
            id: _getmid.psp_id,
          },
          "psp"
        );
        if (!_pspid) {
          // res.status(statusCode.badRequest).send(
          //     response.errormsg("No Psp Available")
          // );
        }
        const _terminalcred = {
          MID: _getmid.MID,
          password: _getmid.password,
          baseurl: credientials[_pspid.credentials_key].checkout_url,
          psp_id: _getmid.psp_id,
          name: _pspid.name,
        };

        sale_api_res = await telr_sale.makeRecurringRequest(
          sale_payload,
          _terminalcred
        );

        let req_data = {
          request: JSON.stringify(sale_payload),
          merchant_id: req.order_details.merchant_id,
          order_id: order_id,
        };
        await helpers.common_add(req_data, "order_request");

        let update_current_entry = {
          payment_id: sale_api_res?.tranref ? sale_api_res?.tranref : "",
          is_paid: sale_api_res.status === "A" ? 1 : 0,
          is_failed: sale_api_res.status === "A" ? 0 : 1,
          response:
            sale_api_res.status === "A" ? null : JSON.stringify(sale_api_res),
        };

        // if (sale_api_res.status !== "A") {
        //     update_current_entry.response =
        //         JSON.stringify(sale_api_res);
        // }

        await merchantOrderModel.updateDynamic(
          update_current_entry,
          {
            id: req.current_entry.id,
          },
          "subscription_recurring"
        );

        let payment_status =
          sale_api_res.status === "A" ? "AUTHORISED" : "FAILED";
        await subscription_card_expired_model.lastSubscriptionPayment(
          subscription_id,
          payment_status
        );
        /* Update the payment status for various payment channel end */
        if (sale_api_res.status === "A") {
          let status = "AUTHORISED";
          //adding entry to pg_order_txn table
          let order_txn = {
            status: status,
            txn: payment_id,
            type: res_order_data?.action,
            payment_id: sale_api_res?.tranref,
            order_id: res_order_data.order_id,
            amount: req.current_entry.amount,
            currency: res_order_data.currency,
            created_at: updated_at,
            order_reference_id: "",
            capture_no: "",
            subscription_id: req.current_entry.subscription_id,
          };

          await orderTransactionModel.add(order_txn);

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.add with data ${JSON.stringify(
              order_txn
            )}`
          );

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

          // Adding event base charges update in payment
          ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            let order_id = req.order_details.order_id;
            let qb = await pool.get_connection();
            let merchant_and_customer_transaction_response;
            try {
              merchant_and_customer_transaction_response = await qb
                .select(
                  "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
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
          });
          ee.emit("ping", {
            message: "hello",
          });
          // event base charges update end

          // web  hook starting
          let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: req.order_details.merchant_id,
          });
          let acsUrl = "";
          let acsPaReq = "";
          let acsMd = "";
          let browser_token_enc = "";
          let p_request_id = await helpers.make_sequential_no("REQ");

          let res_order_data1 = await merchantOrderModel.selectOne(
            "psp,payment_mode",
            {
              order_id: req.order_details.order_id,
            },
            table_name
          );
          let response_category = await helpers.get_error_category(
            "00",
            "telr",
            status
          );
          let new_res = {
            m_order_id: res_order_data.merchant_order_id,
            p_order_id: res_order_data.order_id,
            p_request_id: p_request_id,
            psp_ref_id: sale_api_res?.tranref,
            psp_txn_id: sale_api_res?.tranref,
            transaction_id: payment_id,
            status: sale_api_res.status === "A" ? "SUCCESS" : "FAILED",
            status_code: "00",
            remark: sale_api_res?.message,
            paydart_category: response_category.category,
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
              sale_api_res.status === "A"
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
          let web_hook_res = Object.assign({}, res_obj.new_res);
          delete web_hook_res?.return_url;
          delete web_hook_res?.paydart_category;
          if (hook_info[0]) {
            if (
              hook_info[0].enabled === 0 &&
              hook_info[0].notification_url != ""
            ) {
              let url = hook_info[0].notification_url;
              let webhook_res = await send_webhook_data(
                url,
                web_hook_res,
                hook_info[0].notification_secret
              );
            }
          }
        } else {
          let status = "FAILED";
          let order_txn = {
            status: status,
            txn: payment_id,
            type: res_order_data.action,
            payment_id: sale_api_res?.tranref,
            order_id: res_order_data.order_id,
            amount: req.current_entry.amount,
            currency: res_order_data.currency,
            created_at: updated_at,
            order_reference_id: "",
            capture_no: "",
            subscription_id: req.current_entry.subscription_id,
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.add with data ${JSON.stringify(
              order_txn
            )}`
          );

          await orderTransactionModel.add(order_txn);

          // adding dump entry
          let response_dump = {
            order_id: res_order_data.order_id,
            type: res_order_data.action,
            status: status,
            dump: JSON.stringify(sale_api_res),
          };

          // E, D, C, X
          const arr_error_status = ["E", "D", "C", "X"];
          if (arr_error_status.includes(sale_api_res.status)) {
            let subject = `Subscription Renewal Payment Failed - Action Required Merchant order`;
            let [mail_response_1, mail_response_2, decline_card_response] =
              await Promise.all([
                SendMail.sendBlockCardEmail(res_order_data.order_id, subject),
                SendMail.sendBlockCardEmailToMerchant(
                  res_order_data.order_id,
                  subject
                ),
                declinedCardModel.store(res_order_data.order_id, sale_api_res),
              ]);
          }

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : orderTransactionModel.addResDump ${JSON.stringify(
              response_dump
            )}`
          );
          await orderTransactionModel.addResDump(response_dump);

          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
          };
          await order_logs.update_logs_data(
            { order_id: order_id },
            logs_payload
          );
        }
      })
      .catch(async (error) => {
        winston.error(error);
      });
    return true;
  } catch (error) {
    winston.error(error);

    throw error;
  }
}

async function auto_subscription_pay() {
  console.log("merchantOrder.auto_subscription_pay");
  try {
    let current_payments = await helpers.get_current_data();

    if (current_payments.length > 0) {
      let promise_arr = current_payments.map(async (val) => {
        let response = {};
        let paid_data = await helpers.get_data_list1(
          "*",
          "subscription_recurring",
          {
            is_paid: 1,
            is_failed: 0,
            subscription_id: val?.subscription_id,
          }
        );

        let order_details = await helpers.get_data_list1("*", "orders", {
          order_id: paid_data[0]?.order_id,
        });

        response.payment_ref_id = paid_data[0]?.payment_id;
        response.current_entry = val;
        response.order_details = order_details[0];

        if (order_details && order_details.length > 0) {
          let psp = order_details[0]?.psp;

          if (psp.toUpperCase() === "TELR") {
            await telr_pay(response);
          }
        } else {
        }
      });

      await Promise.all(promise_arr);

      return "All recurring payment captured";
    } else {
      return "No recurring payment";
    }
  } catch (error) {
    winston.error(error);

    return "Something went wrong";
  }
}

module.exports = MerchantOrder;

function maskify(creditCard) {
  if (creditCard.length < 6) return creditCard;
  const last4Characters = creditCard.substr(-4);
  const firstCharacter = creditCard.substr(0, 6);
  const maskingCharacters = creditCard
    .substr(-4, creditCard.length - 5)
    .replace(/\d/g, "x");
  return `${firstCharacter}${maskingCharacters}${last4Characters}`;
}
async function createContineousOrder(req, res) {
  let transaction_id = req.body.data.transaction_id;
}

async function fetchTerminalCred(terminal_id) {
  let termial_cred = await merchantOrderModel.selectDynamicONE(
    "MID,password",
    { terminal_id: terminal_id },
    "mid"
  );
  return termial_cred;
}

let voidNi = async (
  req,
  ni_order_sale,
  res_order_data,
  payment_id,
  transaction_mode,
  fraudStatus,
  browser_token_enc,
  p_request_id
) => {
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  if (
    (ni_order_sale.state == "AUTHORISED" ||
      ni_order_sale.state == "CAPTURED") &&
    fraudStatus === true
  ) {
    let order_table = "orders";
    let order_txn_table = "order_txn";
    if (transaction_mode == "test") {
      order_table = "test_orders";
      order_txn_table = "test_order_txn";
    }

    let order_data = await helpers.get_data_list(
      "order_id as p_order_id,merchant_order_id as m_order_id,amount,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan",
      order_table,
      {
        order_id: res_order_data.order_id.toString(),
      }
    );
    const response_category = await helpers.get_error_category(
      "143",
      "paydart",
      "FAILED"
    );
    const VoidTransactionPayload = {
      order_id: res_order_data.order_id.toString(),
      txn_id: payment_id.toString(),
      action: "VOID",
      mode: transaction_mode,
    };

    const voidTransaction = await fraudService.voidTransaction(
      VoidTransactionPayload
    );

    if (voidTransaction.status === "success") {
      const payment_id = await helpers.make_sequential_no(
        transaction_mode == "test" ? "TST_TXN" : "TXN"
      );
      const order_txn_update = {
        txn: payment_id,
        order_id: res_order_data?.order_id || "",
        currency: res_order_data?.currency || "",
        amount: res_order_data?.amount || "",
        type: res_order_data?.action.toUpperCase(),
        status: "FAILED",
        psp_code: "",
        paydart_category: response_category.category,
        remark: "Blocked by PayDart",
        capture_no: "",
        created_at: updated_at || "",
        payment_id: payment_id || "",
        order_reference_id: ni_order_sale?.orderReference || "",
      };

      if (transaction_mode == "test") {
        await orderTransactionModel.test_txn_add(order_txn_update);
      } else {
        await orderTransactionModel.add(order_txn_update);
      }

      res_obj = {
        message: "Transaction Failed",
        order_status: "FAILED",
        fraud: true,
        payment_id: payment_id,
        order_id: res_order_data.order_id,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        token: browser_token_enc,
        remark: "Blocked by PayDart",
        new_res: {
          m_order_id: order_data[0]?.m_order_id || "",
          p_order_id: order_data[0]?.p_order_id || "",
          p_request_id: p_request_id,
          psp_ref_id: req.body?.orderReference || "",
          psp_txn_id: req.body?.reference || "",
          transaction_id: payment_id,
          status: "FAILED",
          status_code: "143",
          remark: fraudResponse.message,
          paydart_category: fraudResponse.message,
          currency: res_order_data.currency,
          return_url: order_data[0].failure_url,
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          amount: order_data[0]?.amount.toFixed(2) || "",
          m_customer_id: order_data[0]?.m_customer_id || "",
          psp: order_data[0]?.psp || "",
          payment_method: order_data[0]?.payment_mode || "",
          m_payment_token: order_data[0]?.m_payment_token || "",
          payment_method_data: {
            scheme: order_data[0]?.scheme || "",
            card_country: order_data[0]?.card_country || "",
            card_type: order_data[0]?.card_type || "",
            mask_card_number: ni_order_sale.paymentMethod.pan, //ssss
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: order_data[0]?.merchant_id
            ? await helpers.formatNumber(order_data[0]?.merchant_id)
            : "",
        },
      };

      await merchantOrderModel.updateDynamic(
        {
          status: "FAILED",
        },
        { order_id: res_order_data.order_id },
        order_table
      );

      return res_obj;
    }
  }
};

async function confirmMTN(order_id, mode) {
  let order_table;
  let generate_request_id_table;
  let order_details;
  let mid_details;
  let psp_details;
  let transaction_id;
  let paydart_req_id;
  let order_data;
  let fetch_card_details;
  let final_response;

  order_id = order_id;
  mode = mode;

  console.log(`order id is here`);
  console.log(order_id);
  order_table = mode === "live" ? "orders" : "test_orders";
  generate_request_id_table =
    mode === "live" ? "generate_request_id" : "test_generate_request_id";
  let order_txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode,statementDescriptor,primary_key",
    {
      terminal_id: order_details?.terminal_id,
      deleted: 0,
      env: mode,
    },
    "mid"
  );
  psp_details = await merchantOrderModel.selectOne(
    "*",
    {
      id: mid_details.psp_id,
    },
    "psp"
  );
  let order_txn_details = await merchantOrderModel.selectOne(
    "*",
    { order_id: order_id },
    order_txn_table
  );
  // mtn momo confirm
  try {
    const username = `${mid_details.MID}`;
    const password = mid_details.password;
    const basicAuthToken = await helpers.createBasicAuthToken(
      username,
      password
    );

    transaction_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    // generate token
    let url_token =
      mode == "live"
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;
    const config1 = {
      method: "post",
      url: url_token + `collection/token/`,
      headers: {
        Authorization: basicAuthToken,
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": mid_details.primary_key,
      },
    };
    const response_token = await axios(config1);
    const token = response_token.data.access_token;

    // fetch transaction details
    let url =
      mode == "live"
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;
    console.log(`${url}`);

    let config = {
      method: "get",
      url: `${url}collection/v1_0/requesttopay/${order_txn_details.payment_id}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": mode == "test" ? "sandbox" : "mtnliberia",
        "Ocp-Apim-Subscription-Key": mid_details.primary_key,
      },
    };
    let final_response = await axios.request(config);
    console.log(`final response is here`);
    console.log(final_response.data);
    let mtnTxnStatus = helpers.fetchPaydartStatusByPSPStatus(
      final_response.data.status,
      "MTN-MOMO"
    );
    console.log(`mtn response status code`);
    console.log(mtnTxnStatus);
    const status = {
      status: mtnTxnStatus.order_status,
      "3ds": 0,
      "3ds_status": "NA",
    };
    const condition = { order_id: order_id };

    await merchantOrderModel.updateDynamic(status, condition, order_table);

    const order_txn = {
      txn: transaction_id.toString(),
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: "CAPTURE",
      status: mtnTxnStatus.txn_status,
      psp_code: mtnTxnStatus.status_code,
      paydart_category: mtnTxnStatus.status,
      remark: "",
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id: final_response.data.financialTransactionId || "",
    };
    const insert_to_txn_table =
      mode == "live"
        ? await orderTransactionModel.add(order_txn)
        : orderTransactionModel.test_txn_add(order_txn);
    let paydart_req_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );
    let order_req = {
      merchant_id: order_details.merchant_id,
      order_id: order_id,
      request_id: paydart_req_id,
      request: "",
    };
    await helpers.common_add(order_req, generate_request_id_table);

    const res_obj = {
      message: mtnTxnStatus.remark,
      order_status: mtnTxnStatus.order_status,
      psp_ref_id: final_response.data.financialTransactionId,
      p_order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      remark: "",
      new_res: {
        m_order_id: order_details?.m_order_id || "",
        p_order_id: order_details?.order_id || "",
        p_request_id: paydart_req_id.toString(),
        psp_ref_id: final_response.data.financialTransactionId || "",
        psp_txn_id: "",
        transaction_id: transaction_id.toString(),
        status: mtnTxnStatus.status,
        status_code: mtnTxnStatus.status_code,
        remark: "",
        paydart_category: mtnTxnStatus.status,
        currency: order_details.currency,
        return_url: process.env.PAYMENT_URL + "/status", //process.env.PAYMENT_URL + "/status",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.m_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        mobile_no: final_response.data?.payer?.partyId,
        payment_method_data: {
          scheme: "",
          card_country: "",
          card_type: "Mobile Wallet",
          mask_card_number: "",
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
          ? await helpers.formatNumber(order_details.merchant_id)
          : "",
      },
    };

    let txnFailedLog = {
      order_id: order_details.order_id,
      terminal: order_details?.terminal_id,
      req: "",
      res: "",
      psp: psp_details.name,
      status_code: final_response.data.status == "SUCCESSFUL" ? "00" : "01",
      description: "",
      activity: `Transaction ${
        mtnTxnStatus === "SUCCESSFUL" ? "SUCCESS" : "FAILED"
      } with MTN MOMO`,
      status: final_response.data.status === "SUCCESSFUL" ? 1 : 0,
      mode: mode,
      card_holder_name: "",
      card: "",
      expiry: "",
      cipher_id: 0,
      txn: transaction_id.toString(),
      card_proxy: "",
      "3ds_version": "0",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
    await helpers.addTransactionFailedLogs(txnFailedLog);

    // web  hook starting
    if (
      final_response.data.status == "SUCCESSFUL" ||
      final_response.data.status == "FAILED"
    ) {
      let hook_info = await helpers.get_data_list("*", "webhook_settings", {
        merchant_id: order_details.merchant_id,
      });
      let web_hook_res = Object.assign({}, res_obj.new_res);
      delete web_hook_res?.return_url;
      delete web_hook_res?.paydart_category;
      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
          let url = hook_info[0].notification_url;
          let webhook_res = await send_webhook_data(
            url,
            web_hook_res,
            hook_info[0].notification_secret
          );
        }
      }
    }
    if (final_response.data.status == "SUCCESSFUL") {
      ee.once("ping", async (arguments) => {
        // Sending mail to customers and merchants about transaction
        await SendTransactionMailAction(arguments);
      });
      ee.emit("ping", {
        order_table: order_table,
        order_id: order_details.order_id,
      });
    }
    if (
      final_response.data.status == "SUCCESSFUL" &&
      mode == process.env.CHARGES_MODE
    ) {
      const transaction_and_feature_data = {
        amount: order_details.amount,
        currency: order_details?.currency,
        order_id: order_details?.order_id,
        merchant_id: order_details?.merchant_id,
        card_country: order_details?.card_country,
        payment_method: "mobile_wallet",
        scheme: "mobile_wallet",
        psp_id: order_details?.psp_id,
        terminal_id: order_details?.terminal_id,
        origin: order_details?.origin,
        //every time change param
        payment_id: final_response.data.financialTransactionId || "",
        order_status: "CAPTURED",
        txn_status:
          final_response.data.status == "SUCCESSFUL" ? "AUTHORISED" : "FAILED",
        txn_id: transaction_id.toString(),
        mode: mode,
        is_mobile_wallet: true,
      };
      await calculateTransactionCharges(transaction_and_feature_data);
    }
    return {
      message: res_obj.message,
      data: res_obj,
      status: "SUCCESS",
    };
  } catch (error) {
    console.log(`error is here`);
    console.log(error);
    await merchantOrderModel.updateDynamic(
      { status: "FAILED" },
      { order_id: order_id },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? orderTransactionModel.add
        : orderTransactionModel.test_txn_add;
    const order_txn_update = {
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: order_details?.action.toUpperCase(),
      status: "FAILED",
      psp_code: "01",
      paydart_category: "Transaction FAILED",
      remark: "Transaction Failed",
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id:
        final_response?.data?.transaction?.acquirer?.transactionId || "",
      order_reference_id: final_response?.data?.transaction?.receipt || "",
    };
    console.log(order_txn_update);
    await insertFunction(order_txn_update);
    const res_obj = {
      message: "Transaction FAILED",
      order_status: "FAILED",
      psp_ref_id: "",
      p_order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      token: "",
      remark: error.response ? error?.response?.data : "",
      new_res: {
        m_order_id: order_data?.[0]?.m_order_id || "",
        p_order_id: order_data?.[0]?.p_order_id || "",
        p_request_id: "",
        psp_ref_id: final_response?.data?.transaction.receipt?.toString() || "",
        psp_txn_id:
          final_response?.data?.transaction.acquirer.transactionId?.toString() ||
          "",
        transaction_id: transaction_id.toString(),
        status: "FAILED",
        status_code: "01",
        remark: "Transaction Failed",
        paydart_category: "FAILED",
        currency: order_details?.currency,
        return_url: process.env.PAYMENT_URL + "/status", //order_data?.[0]?.failure_url,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_data?.[0]?.amount.toFixed(2) || "",
        m_customer_id: order_data?.[0]?.m_customer_id || "",
        psp: order_data?.[0]?.psp || "",
        payment_method: order_data?.[0]?.payment_mode || "",
        m_payment_token: order_data?.[0]?.m_payment_token || "",
        payment_method_data: {
          scheme: order_data?.[0]?.scheme || "",
          card_country: order_data?.[0]?.card_country || "",
          card_type: "Mobile Wallet",
          mask_card_number: order_data?.[0]?.mask_card_number,
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_data?.[0]?.merchant_id
          ? await helpers.formatNumber(order_data?.[0]?.merchant_id)
          : "",
      },
    };
    console.log(res_obj);
    let txnFailedLog = {
      order_id: order_details?.order_id,
      terminal: order_details?.terminal_id,
      req: "",
      res: "",
      psp: psp_details.name,
      status_code: final_response?.data?.transaction?.authorizationCode || "",
      description:
        final_response?.data?.transaction?.authenticationStatus || "",
      activity: "Transaction FAILED with MTN MOMO",
      status: 0,
      mode: mode,
      card_holder_name: fetch_card_details?.card_holder_name || "",
      card: fetch_card_details?.card,
      expiry: fetch_card_details?.expiry,
      cipher_id: fetch_card_details?.cipher_id,
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      card_proxy: fetch_card_details?.card_proxy,
      "3ds_version": "1",
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
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(
          url,
          web_hook_res,
          hook_info[0].notification_secret
        );
      }
    }
    return {
      mesaage: res_obj.message,
      data: res_obj,
      status: "FAILED",
    };
  }
}
async function confirmOrange(order_id, mode) {
  let order_table;
  let generate_request_id_table;
  let order_details;
  let mid_details;
  let psp_details;
  let transaction_id;
  let paydart_req_id;
  let order_data;
  let fetch_card_details;
  let final_response;

  order_id = order_id;
  mode = mode;

  console.log(`order id is here`);
  console.log(order_id);
  order_table = mode === "live" ? "orders" : "test_orders";
  generate_request_id_table =
    mode === "live" ? "generate_request_id" : "test_generate_request_id";
  let order_txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode,statementDescriptor,primary_key",
    {
      terminal_id: order_details?.terminal_id,
      deleted: 0,
      env: mode,
    },
    "mid"
  );
  psp_details = await merchantOrderModel.selectOne(
    "*",
    {
      id: mid_details.psp_id,
    },
    "psp"
  );
  let order_txn_details = await merchantOrderModel.selectOne(
    "*",
    { order_id: order_id },
    order_txn_table
  );
  try {
    const username = `${mid_details.MID}`;
    const password = mid_details.password;

    transaction_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    // fetch transaction details
    let url =
      mode == "live"
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;
    console.log(`${url}`);
    const agent = new https.Agent({
      rejectUnauthorized: false, // ⚠️ Ignore SSL cert errors (only use in dev)
    });
    let payload = {
      auth: {
        user: username,
        pwd: password,
      },
      param: {
        TXNID: order_txn_details?.payment_id,
        Currency: order_txn_details?.currency,
      },
    };
    let config = {
      method: "get",
      url: `${url}OM/Transaction/Status`,
      headers: {
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: payload,
    };
    let final_response = await axios.request(config);
    console.log(`the final response is here at confirmation`);
    console.log(final_response.data);
    let orangeTxnStatus = helpers.fetchPaydartStatusByPSPStatus(
      final_response.data.resultset.TXNSTATUS,
      "Orange Money"
    );
    const status = {
      status: orangeTxnStatus.order_status,
      "3ds": 0,
      "3ds_status": "NA",
    };
    const condition = { order_id: order_id };

    await merchantOrderModel.updateDynamic(status, condition, order_table);

    const order_txn = {
      txn: transaction_id.toString(),
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: "CAPTURE",
      status: orangeTxnStatus.txn_status,
      psp_code: orangeTxnStatus.status_code,
      paydart_category: orangeTxnStatus.status,
      remark: orangeTxnStatus.remark,
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id: order_txn_details?.payment_id,
    };
    const insert_to_txn_table =
      mode == "live"
        ? await orderTransactionModel.add(order_txn)
        : orderTransactionModel.test_txn_add(order_txn);
    let paydart_req_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );
    let order_req = {
      merchant_id: order_details.merchant_id,
      order_id: order_id,
      request_id: paydart_req_id,
      request: "",
    };
    await helpers.common_add(order_req, generate_request_id_table);

    const res_obj = {
      message: orangeTxnStatus.remark,
      order_status: orangeTxnStatus.order_status,
      psp_ref_id: order_txn_details?.payment_id,
      p_order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      remark: "",
      new_res: {
        m_order_id: order_details?.m_order_id || "",
        p_order_id: order_details?.order_id || "",
        p_request_id: paydart_req_id.toString(),
        psp_ref_id: order_txn_details?.payment_id || "",
        psp_txn_id: "",
        transaction_id: transaction_id.toString(),
        status: orangeTxnStatus.status,
        status_code: orangeTxnStatus.status_code,
        remark: "",
        paydart_category: orangeTxnStatus.status,
        currency: order_details.currency,
        return_url: process.env.PAYMENT_URL + "/status", //process.env.PAYMENT_URL + "/status",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.m_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        mobile_no: order_details.pan,
        payment_method_data: {
          scheme: "",
          card_country: "",
          card_type: "Mobile Wallet",
          mask_card_number: "",
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
          ? await helpers.formatNumber(order_details.merchant_id)
          : "",
      },
    };

    let txnFailedLog = {
      order_id: order_details.order_id,
      terminal: order_details?.terminal_id,
      req: "",
      res: "",
      psp: psp_details.name,
      status_code: orangeTxnStatus.status_code,
      description: "",
      activity: `Transaction ${orangeTxnStatus.order_status} with Orange Money`,
      status: 0,
      mode: mode,
      card_holder_name: "",
      card: "",
      expiry: "",
      cipher_id: 0,
      txn: transaction_id.toString(),
      card_proxy: "",
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
    console.log(`hook info`);
    console.log(hook_info);
    if (
      final_response.data.resultset.TXNSTATUS == "TF" ||
      final_response.data.resultset.TXNSTATUS == "TS"
    ) {
      if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
          let url = hook_info[0].notification_url;
          let web_res = await send_webhook_data(
            url,
            web_hook_res,
            hook_info[0].notification_secret
          );
          console.log(`web hook res`);
          console.log(web_res);
        }
      }
    }
    console.log(`before sending the webhook`);
    console.log(final_response.data.resultset.TXNSTATUS);
    if (
      final_response.data.resultset.TXNSTATUS == "TF" ||
      final_response.data.resultset.TXNSTATUS == "TS"
    ) {
      ee.once("ping", async (arguments) => {
        // Sending mail to customers and merchants about transaction
        await SendTransactionMailAction(arguments);
      });
      ee.emit("ping", {
        order_table: order_table,
        order_id: order_details.order_id,
      });
    }
    if (
      final_response.data.resultset.TXNSTATUS == "TS" &&
      mode == process.env.CHARGES_MODE
    ) {
      const transaction_and_feature_data = {
        amount: order_details.amount,
        currency: order_details?.currency,
        order_id: order_details?.order_id,
        merchant_id: order_details?.merchant_id,
        card_country: order_details?.card_country,
        payment_method: "mobile_wallet",
        scheme: "mobile_wallet",
        psp_id: order_details?.psp_id,
        terminal_id: order_details?.terminal_id,
        origin: order_details?.origin,
        //every time change param
        payment_id: final_response.data.financialTransactionId || "",
        order_status: "CAPTURED",
        txn_status:
          final_response.data.status == "SUCCESSFUL" ? "AUTHORISED" : "FAILED",
        txn_id: transaction_id.toString(),
        mode: mode,
        is_mobile_wallet: true,
      };
      await calculateTransactionCharges(transaction_and_feature_data);
    }
    const responseStatus =
      final_response.data.resultset.TXNSTATUS === "TS"
        ? statusCode.ok
        : statusCode.badRequest;

    return {
      message: res_obj.message,
      data: res_obj,
      status:
        final_response.data.resultset.TXNSTATUS === "TS" ? "SUCCESS" : "FAILED",
    };
  } catch (error) {
    console.log(`error is here`);
    console.log(error);
    await merchantOrderModel.updateDynamic(
      { status: "FAILED" },
      { order_id: order_id },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? orderTransactionModel.add
        : orderTransactionModel.test_txn_add;
    const order_txn_update = {
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: order_details?.action.toUpperCase(),
      status: "FAILED",
      psp_code: "01",
      paydart_category: "Transaction FAILED",
      remark: "Transaction Failed",
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id:
        final_response?.data?.transaction?.acquirer?.transactionId || "",
      order_reference_id: final_response?.data?.transaction?.receipt || "",
    };
    console.log(order_txn_update);
    await insertFunction(order_txn_update);
    const res_obj = {
      message: "Transaction FAILED",
      order_status: "FAILED",
      psp_ref_id: order_txn_details.payment_id,
      p_order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      token: "",
      remark: error.response ? error?.response?.data : "",
      new_res: {
        m_order_id: order_data?.[0]?.m_order_id || "",
        p_order_id: order_data?.[0]?.p_order_id || "",
        p_request_id: "",
        psp_ref_id: order_txn_details.payment_id,
        psp_txn_id:
          final_response?.data?.transaction.acquirer.transactionId?.toString() ||
          "",
        transaction_id: transaction_id.toString(),
        status: "FAILED",
        status_code: 143,
        remark: "Transaction Failed",
        paydart_category: "FAILED",
        currency: order_details?.currency,
        return_url: process.env.PAYMENT_URL + "/status", //order_data?.[0]?.failure_url,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_data?.[0]?.amount.toFixed(2) || "",
        m_customer_id: order_data?.[0]?.m_customer_id || "",
        psp: order_data?.[0]?.psp || "",
        payment_method: order_data?.[0]?.payment_mode || "",
        m_payment_token: order_data?.[0]?.m_payment_token || "",
        payment_method_data: {
          scheme: order_data?.[0]?.scheme || "",
          card_country: order_data?.[0]?.card_country || "",
          card_type: "Mobile Wallet",
          mask_card_number: order_data?.[0]?.mask_card_number,
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_data?.[0]?.merchant_id
          ? await helpers.formatNumber(order_data?.[0]?.merchant_id)
          : "",
      },
    };
    console.log(res_obj);
    let txnFailedLog = {
      order_id: order_details?.order_id,
      terminal: order_details?.terminal_id,
      req: "",
      res: "",
      psp: psp_details.name,
      status_code: final_response?.data?.transaction?.authorizationCode || "",
      description:
        final_response?.data?.transaction?.authenticationStatus || "",
      activity: "Transaction FAILED with Orange Money",
      status: 0,
      mode: mode,
      card_holder_name: fetch_card_details?.card_holder_name || "",
      card: fetch_card_details?.card,
      expiry: fetch_card_details?.expiry,
      cipher_id: 0,
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      card_proxy: fetch_card_details?.card_proxy,
      "3ds_version": "1",
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
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(
          url,
          web_hook_res,
          hook_info[0].notification_secret
        );
        console.log(web_hook_res);
      }
    }
    return { mesaage: "Transaction Failed", data: res_obj, status: "FAILED" };
  }
}
async function confirmALPAY(order_id, mode) {
  let order_table;
  let generate_request_id_table;
  let order_details;
  let mid_details;
  let psp_details;
  let transaction_id;
  let paydart_req_id;
  let order_data;
  let fetch_card_details;
  let final_response;
  order_table = mode === "live" ? "orders" : "test_orders";
  generate_request_id_table =
    mode === "live" ? "generate_request_id" : "test_generate_request_id";
  let order_txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode,statementDescriptor,primary_key",
    {
      terminal_id: order_details?.terminal_id,
      deleted: 0,
      env: mode,
    },
    "mid"
  );
  psp_details = await merchantOrderModel.selectOne(
    "*",
    {
      id: mid_details.psp_id,
    },
    "psp"
  );
  let order_txn_details = await merchantOrderModel.selectOne(
    "*",
    { order_id: order_id },
    order_txn_table
  );
  try {
    const username = `${mid_details.MID}`;
    const password = mid_details.password;
    const basicAuthToken = await helpers.createBasicAuthToken(
      username,
      password
    );

    transaction_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    // generate token
    let url1 =
      mode == "live"
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;
    const config1 = {
      method: "post",
      url: url1 + `Authentication/Login`,
      headers: {
        // Authorization: basicAuthToken,
        "Content-Type": "application/json",
      },
      data: {
        username: username,
        password: password,
      },
    };
    const response = await axios(config1);
    const token = response.data.token;

    // fetch transaction details
    let url =
      mode == "live"
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;
    console.log(`${url}`);

    let config = {
      method: "post",
      url: `${url}TransactionStatus/TransactionStatusService`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: {
        transactionId: order_txn_details.payment_id,
        transactionType: "DEBIT",
      },
    };
    let final_response = await axios.request(config);
    console.log(final_response.data);
    let mtnTxnStatus = helpers.fetchPaydartStatusByPSPStatus(
      final_response.data.data.status,
      "ALPAY"
    );
    const status = {
      status: mtnTxnStatus.order_status,
      payment_id: transaction_id.toString(),
      "3ds": 0,
      "3ds_status": "NA",
    };
    const condition = { order_id: order_id };

    await merchantOrderModel.updateDynamic(status, condition, order_table);

    const order_txn = {
      txn: transaction_id.toString(),
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: "CAPTURE",
      status: mtnTxnStatus.txn_status,
      psp_code: mtnTxnStatus.status_code,
      paydart_category: mtnTxnStatus.status,
      remark: "",
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id: final_response.data.data.externalTransactionId || "",
    };
    const insert_to_txn_table =
      mode == "live"
        ? await orderTransactionModel.add(order_txn)
        : await orderTransactionModel.test_txn_add(order_txn);
    let paydart_req_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );
    let order_req = {
      merchant_id: order_details.merchant_id,
      order_id: order_id,
      request_id: paydart_req_id,
      request: JSON.stringify({}),
    };
    await helpers.common_add(order_req, generate_request_id_table);

    const res_obj = {
      message: mtnTxnStatus.remark,
      order_status: mtnTxnStatus.order_status,
      payment_id: final_response.data.data.externalTransactionId,
      order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      remark: "",
      new_res: {
        m_order_id: order_details?.m_order_id || "",
        p_order_id: order_details?.order_id || "",
        p_request_id: paydart_req_id.toString(),
        psp_ref_id: final_response.data.data.externalTransactionId || "",
        psp_txn_id: final_response.data.data.transactionId || "",
        transaction_id: transaction_id.toString(),
        status: mtnTxnStatus.status,
        status_code: mtnTxnStatus.status_code,
        paydart_category: mtnTxnStatus.status,
        remark: "",
        currency: order_details.currency,
        return_url: process.env.PAYMENT_URL + "/status", //process.env.PAYMENT_URL + "/status",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_details?.amount.toFixed(2) || "",
        m_customer_id: order_details?.m_customer_id || "",
        psp: order_details?.psp || "",
        payment_method: order_details?.payment_mode || "",
        m_payment_token: order_details?.m_payment_token || "",
        mobile_no: final_response.data?.data?.accountNumber,
        payment_method_data: {
          scheme: "",
          card_country: "",
          card_type: "Mobile Wallet",
          mask_card_number: "",
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
          ? await helpers.formatNumber(order_details.merchant_id)
          : "",
      },
    };

    let txnFailedLog = {
      order_id: order_details.order_id,
      terminal: order_details?.terminal_id,
      req: JSON.stringify({}),
      res: "",
      psp: psp_details.name,
      status_code:
        final_response.data.data.status == "SUCCESSFUL" ? "00" : "01",
      description: "",
      activity: `Transaction ${
        final_response.data.data.status === "SUCCESSFUL" ? "SUCCESS" : "FAILED"
      } with ALPAY`,
      status: final_response.data.data.status === "SUCCESSFUL" ? 1 : 0,
      mode: mode,
      card_holder_name: "",
      card: "",
      expiry: "",
      cipher_id: 0,
      txn: transaction_id.toString(),
      card_proxy: "",
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
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(
          url,
          web_hook_res,
          hook_info[0].notification_secret
        );
      }
    }
    if (final_response.data.data.status == "SUCCESSFUL") {
      ee.once("ping", async (arguments) => {
        // Sending mail to customers and merchants about transaction
        await SendTransactionMailAction(arguments);
      });
      ee.emit("ping", {
        order_table: order_table,
        order_id: order_details.order_id,
      });
    }
    if (
      final_response.data.data.status == "SUCCESSFUL" &&
      mode == process.env.CHARGES_MODE
    ) {
      const transaction_and_feature_data = {
        amount: order_details.amount,
        currency: order_details?.currency,
        order_id: order_details?.order_id,
        merchant_id: order_details?.merchant_id,
        card_country: order_details?.card_country,
        payment_method: "mobile_wallet",
        scheme: "mobile_wallet",
        psp_id: order_details?.psp_id,
        terminal_id: order_details?.terminal_id,
        origin: order_details?.origin,
        //every time change param
        payment_id: final_response.data.data.externalTransactionId || "",
        order_status: "CAPTURED",
        txn_status:
          final_response.data.data.status == "SUCCESSFUL"
            ? "AUTHORISED"
            : "FAILED",
        txn_id: transaction_id.toString(),
        mode: mode,
        is_mobile_wallet: true,
      };
      await calculateTransactionCharges(transaction_and_feature_data);
    }
    const responseStatus =
      final_response?.data?.data.status == "SUCCESSFUL"
        ? statusCode.ok
        : statusCode.badRequest;
     return {
      message: res_obj.message,
      data: res_obj,
      status:
        final_response?.data?.data.status == "SUCCESSFUL"? "SUCCESS" : "FAILED",
    };    
  } catch (error) {
    console.log(`error is here`);
    console.log(error);
    await merchantOrderModel.updateDynamic(
      { status: "FAILED" },
      { order_id: order_id },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? orderTransactionModel.add
        : orderTransactionModel.test_txn_add;
    const order_txn_update = {
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      order_id: order_details?.order_id || "",
      currency: order_details?.currency || "",
      amount: order_details?.amount || "",
      type: order_details?.action.toUpperCase(),
      status: "FAILED",
      psp_code: "01",
      paydart_category: "Transaction FAILED",
      remark: "Transaction Failed",
      capture_no: "",
      created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
      payment_id:
        final_response?.data?.transaction?.acquirer?.transactionId || "",
      order_reference_id: final_response?.data?.transaction?.receipt || "",
    };
    console.log(order_txn_update);
    await insertFunction(order_txn_update);
    const res_obj = {
      message: "Transaction FAILED",
      order_status: "FAILED",
      payment_id: "",
      order_id: order_details.order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      token:  "",
      remark: error.response ? error?.response?.data : "",
      new_res: {
        m_order_id: order_data?.[0]?.m_order_id || "",
        p_order_id: order_data?.[0]?.p_order_id || "",
        p_request_id: "",
        psp_ref_id: final_response?.data?.transaction.receipt?.toString() || "",
        psp_txn_id:
          final_response?.data?.transaction.acquirer.transactionId?.toString() ||
          "",
        transaction_id: transaction_id.toString(),
        status: "FAILED",
        status_code: 143,
        remark: "Transaction Failed",
        paydart_category: "FAILED",
        currency: order_details?.currency,
        return_url: process.env.PAYMENT_URL + "/status", //order_data?.[0]?.failure_url,
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        amount: order_data?.[0]?.amount.toFixed(2) || "",
        m_customer_id: order_data?.[0]?.m_customer_id || "",
        psp: order_data?.[0]?.psp || "",
        payment_method: order_data?.[0]?.payment_mode || "",
        m_payment_token: order_data?.[0]?.m_payment_token || "",
        payment_method_data: {
          scheme: order_data?.[0]?.scheme || "",
          card_country: order_data?.[0]?.card_country || "",
          card_type: "Mobile Wallet",
          mask_card_number: order_data?.[0]?.mask_card_number,
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_data?.[0]?.merchant_id
          ? await helpers.formatNumber(order_data?.[0]?.merchant_id)
          : "",
      },
    };
    console.log(res_obj);
    let txnFailedLog = {
      order_id: order_details?.order_id,
      terminal: order_details?.terminal_id,
      req: JSON.stringify({}),
      res: "",
      psp: psp_details.name,
      status_code: final_response?.data?.transaction?.authorizationCode || "",
      description:
        final_response?.data?.transaction?.authenticationStatus || "",
      activity: "Transaction FAILED with MPGS",
      status: 0,
      mode: mode,
      card_holder_name: fetch_card_details?.card_holder_name || "",
      card: fetch_card_details?.card,
      expiry: fetch_card_details?.expiry,
      cipher_id: fetch_card_details?.cipher_id,
      txn: transaction_id.toString() ? transaction_id.toString() : "",
      card_proxy: fetch_card_details?.card_proxy,
      "3ds_version": "1",
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
      if (hook_info[0].enabled === 0 && hook_info[0].notification_url != "") {
        let url = hook_info[0].notification_url;
        let webhook_res = await send_webhook_data(
          url,
          web_hook_res,
          hook_info[0].notification_secret
        );
      }
    }
    return { mesaage: "Transaction Failed", data: res_obj, status: "FAILED" };
  }
}
