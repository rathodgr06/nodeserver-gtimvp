const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");
const orderTransactionModel = require("../models/order_transaction");
const merchantOrderModel = require("../models/merchantOrder");
const winston = require("../utilities/logmanager/winston");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const EventEmitter = require("events");
const ee = new EventEmitter();
const path = require("path");
require("dotenv").config({
  path: "../.env",
});
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const NI = require("./ni");
const telr_sale = require("./telr");
const credientials = require("../config/credientials");
const subscription_card_expired_model = require("../models/subscription_card_expired_model");
const ni = require("./ni");
let axios = require("axios");
const logs_model = require("../models/order_logs");
const { send_webhook_data } = require("./webhook_settings");
const fraudEngine = require("../utilities/fraud/index");
const SendMail = require("./cronjobs");
const invModel = require("../models/invoiceModel");
const declinedCardModel = require("../models/subscription_card_declined_model");
const PaymentRecurringController = {
  RecurringApi: async (req, res) => {
    try {
      const {
        action,
        transaction_id,
        amount: { currencyCode, value },
        reason,
      } = req.body;

      const query = `SELECT *  FROM ${config.table_prefix}mid WHERE submerchant_id = ${req.credentials.merchant_id} AND deleted = 0 AND status = 0 AND FIND_IN_SET('cauth',class)`;
      const checkCauthMId = await merchantOrderModel.selectDynamicONEMID(query);

      if (!checkCauthMId) {
        throw new Error("no mid found with class cauth!");
      }

      const TransactionDetails = await merchantOrderModel.selectDynamicONE(
        "*",
        { txn: transaction_id },
        "order_txn"
      );

      const order_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: TransactionDetails.order_id },
        "orders"
      );

      const val = helpers.get_current_data_by_orderID(
        TransactionDetails.order_id
      );

      const paid_data = await helpers.get_data_list1(
        "*",
        "subscription_recurring",
        {
          is_paid: 1,
          is_failed: 0,
          subscription_id: val?.subscription_id,
        }
      );

      const remaining_sucscription = await helpers.get_data_list1(
        "*",
        "subscription_recurring",
        {
          is_paid: 0,
          is_failed: 0,
          subscription_id: val?.subscription_id,
        }
      );

      if (remaining_sucscription.length === 0)
        throw new Error("All the recurring subscription has paid");

      let responseObj = {};
      responseObj.payment_ref_id = transaction_id;
      responseObj.current_entry = val;
      responseObj.order_details = order_details[0];
      responseObj.returnType = true;

      if (order_details && order_details.length > 0) {
        let psp = order_details[0]?.psp;

        switch (psp.toUpperCase()) {
          case "TELR":
            repoData = await telr_pay(responseObj, "live");
            break;
          case "NI":
            repoData = await ni_pay(responseObj, "live");
            break;
          case "PAYTABS":
            repoData = await paytabs_pay(responseObj, "live");
            break;
        }

        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(repoData, repoData.message));
      }

      throw new Error("Invalid Transaction Id");
    } catch (error) {
      console.log("🚀 ~ RecurringOpenApiTest: ~ error:", error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  RecurringApiTest: async (req, res) => {
    try {
      const {
        action,
        transaction_id,
        amount: { currencyCode, value },
        reason,
      } = req.body;

      const query = `SELECT *  FROM ${config.table_prefix}mid WHERE submerchant_id = ${req.credentials.merchant_id} AND deleted = 0 AND status = 0 AND FIND_IN_SET('cauth',class)`;
      const checkCauthMId = await merchantOrderModel.selectDynamicONEMID(query);

      if (!checkCauthMId) {
        throw new Error("no mid found with class cauth!");
      }

      const TransactionDetails = await merchantOrderModel.selectDynamicONE(
        "*",
        { txn: transaction_id },
        "test_order_txn"
      );

      const order_details = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: TransactionDetails.order_id },
        "test_orders"
      );

      const val = await helpers.get_current_data_test_by_orderID(
        TransactionDetails.order_id
      );

      const paid_data = await helpers.get_data_list1(
        "*",
        "subscription_recurring",
        {
          is_paid: 1,
          is_failed: 0,
          subscription_id: val?.subscription_id,
        }
      );

      let responseObj = {};

      responseObj.payment_ref_id = transaction_id;
      responseObj.telr_payment_ref_id = TransactionDetails?.payment_id;
      responseObj.token = TransactionDetails?.saved_card_for_recurring;
      responseObj.current_entry = val;
      responseObj.order_details = order_details;
      responseObj.returnType = true;
      responseObj.currency = currencyCode;
      responseObj.amount = value;

      let repoData = {};

      if (order_details) {
        let psp = order_details?.psp;
        switch (psp.toUpperCase()) {
          case "TELR":
            repoData = await telr_pay(responseObj, "test");
            break;
          case "NI":
            repoData = await ni_pay(responseObj, "test");
            break;
          case "PAYTABS":
            repoData = await paytabs_pay(responseObj, "test");
            break;
        }
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg(repoData, repoData.message));
      }
      throw new Error("Invalid Transaction Id");
    } catch (error) {
      console.log("🚀 ~ RecurringOpenApiTest: ~ error:", error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};
module.exports = PaymentRecurringController;

async function telr_pay(req, mode) {
  let order_table = "orders";
  let txn_table = "order_txn";
  if (mode == "test") {
    order_table = "test_orders";
    txn_table = "test_order_txn";
  }
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let payment_id = await helpers.make_sequential_no(
    mode == "test" ? "TST_TXN" : "TXN"
  );
  let order_id = await createOrder(req.order_details.order_id, order_table);

  const res_order_data = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );

  await merchantOrderModel.updateDynamic(
    { amount: parseFloat(req.amount).toFixed(2) },
    {
      order_id: order_id,
    },
    order_table
  );

  let payment_mode = res_order_data.payment_mode;
  let subscription_id = res_order_data.subscription_id;

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

    let table_name = mode == "test" ? "test_orders" : "orders";

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
    const result = await merchantOrderModel.updateDynamic(
      order_data,
      {
        order_id: order_id,
      },
      table_name
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : response received ${JSON.stringify(result)}`
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

    // const fraudRequest = {
    //   headers: {
    //     fp: "",
    //     os: "",
    //     useragent: "",
    //     browser: "",
    //     mobilebrand: "",
    //     ipcountry: "",
    //     ipcountryiso: "",
    //     ipstate: "",
    //     isp: "",
    //     ip: "",
    //   },
    //   body: {
    //     is_recuuring: 1,
    //     mid: _getmid?.MID,
    //     card_id: res_order_data?.card_id,
    //     card: "",
    //     payment_mode: "test",
    //     order_id: order_id,
    //   },
    //   card_details: {
    //     card_type: res_order_data?.cardType || "",
    //     currency_code: res_order_data?.currency,
    //     country_code3: res_order_data?.country_code3,
    //   },
    // };

    // const fraudData = await fraudEngine(fraudRequest, {}, {}, true);
    // if (fraudData) {
    //   const mode = "test";
    //   let updateRecurring = {
    //     is_paid: 0,
    //     payment_id: fraudData.new_res.transaction_id,
    //     response: "",
    //     response: JSON.stringify(fraudData),
    //     is_failed: 1,
    //     order_id: res_order_data.order_id,
    //   };
    //   let p_request_id = await helpers.make_sequential_no(
    //     mode == "test" ? "TST_REQ" : "REQ"
    //   );
    //   let order_req = {
    //     merchant_id: res_order_data.merchant_id,
    //     order_id: res_order_data.order_id,
    //     request_id: p_request_id,
    //     request: JSON.stringify(payload),
    //   };
    //   await helpers.common_add(
    //     order_req,
    //     mode == "test" ? "test_generate_request_id" : "generate_request_id"
    //   );
    //   logs.push(
    //     `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : add request}`
    //   );
    //   await orderTransactionModel.updateDynamic(
    //     updateRecurring,
    //     { id: req.current_entry.id },
    //     "subscription_recurring"
    //   );

    //   const logs_payload = {
    //     activity: JSON.stringify(logs),
    //     updated_at: updated_at,
    //   };
    //   if (mode == "test") {
    //     await logs_model.test_log_add(logs_payload);
    //   } else {
    //     await logs_model.add(logs_payload);
    //   }

    //   return true;
    // }

    let sale_payload = {
      type: res_order_data?.action.toLowerCase(),
      classValue: "cont",
      currency: req.currency,
      amount: parseFloat(req.amount).toFixed(2),
      tranref: req.telr_payment_ref_id,
    };
    console.log("🚀 ~ telr_pay ~ sale_payload:", sale_payload);

    const _terminalids = await merchantOrderModel.selectOne(
      "terminal_id",
      {
        order_id: order_id,
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
      throw new Error("No psp found!");
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
    console.log("🚀 ~ telr_pay ~ sale_api_res:", sale_api_res);

    let p_request_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );
    let order_req = {
      merchant_id: res_order_data.merchant_id,
      order_id: res_order_data.order_id,
      request_id: p_request_id,
      request: JSON.stringify(sale_payload),
    };

    await helpers.common_add(
      order_req,
      mode == "test" ? "test_generate_request_id" : "generate_request_id"
    );

    // if (sale_api_res.status !== "A") {
    //     update_current_entry.response =
    //         JSON.stringify(sale_api_res);
    // }

    let payment_status = sale_api_res.status === "A" ? "AUTHORISED" : "FAILED";
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
        currency: req.currency,
        amount: parseFloat(req.amount).toFixed(2),
        created_at: updated_at,
        order_reference_id: "",
        capture_no: "",
        subscription_id: req.current_entry.subscription_id,
      };

      await orderTransactionModel.add(
        order_txn,
        mode == "test" ? "test_order_txn" : "order_txn"
      );

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : orderTransactionModel.add with data ${JSON.stringify(order_txn)}`
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
        )} : orderTransactionModel.addResDump ${JSON.stringify(response_dump)}`
      );
      if (mode == "test") {
        await orderTransactionModel.addTestResDump(response_dump);
      } else {
        await orderTransactionModel.addResDump(response_dump);
      }

      // web  hook starting
      let hook_info = await helpers.get_data_list("*", "webhook_settings", {
        merchant_id: req.order_details.merchant_id,
      });

      let p_request_id = await helpers.make_sequential_no(
        mode == "test" ? "REQ" : "TST_REQ"
      );

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
        currency: req.currency,
        amount: parseFloat(req.amount).toFixed(2),
        m_customer_id: res_order_data.merchant_customer_id,
        psp: res_order_data1.psp,
        payment_method: res_order_data1.payment_mode,
        m_payment_token: res_order_data?.card_id ? res_order_data?.card_id : "",
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
          card_type: res_order_data?.cardType ? res_order_data?.cardType : "",
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
        currency: req.currency,
        amount: parseFloat(req.amount).toFixed(2),
        token: browser_token_enc || "",
        message: "Payment Successful",
        new_res: new_res,
      };
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

      let logs_payload = {
        activity: JSON.stringify(logs),
        updated_at: updated_at,
      };

      if (mode == "test") {
        await logs_model.test_log_add(logs_payload);
      } else {
        await logs_model.add(logs_payload);
      }
    } else {
      let status = "FAILED";
      let order_txn = {
        status: status,
        txn: payment_id,
        type: res_order_data.action,
        payment_id: sale_api_res?.tranref,
        order_id: res_order_data.order_id,
        currency: req.currency,
        amount: parseFloat(req.amount).toFixed(2),
        created_at: updated_at,
        order_reference_id: "",
        capture_no: "",
      };

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : orderTransactionModel.add with data ${JSON.stringify(order_txn)}`
      );

      await orderTransactionModel.add(
        order_txn,
        mode == "test" ? "test_order_txn" : "order_txn"
      );

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
        let subject = `Subscription Renewal Payment Failed - Action Required`;
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
        )} : orderTransactionModel.addResDump ${JSON.stringify(response_dump)}`
      );
      if (mode == "test") {
        await orderTransactionModel.addTestResDump(response_dump);
      } else {
        await orderTransactionModel.addResDump(response_dump);
      }

      let logs_payload = {
        activity: JSON.stringify(logs),
        updated_at: updated_at,
      };
      if (mode == "test") {
        await logs_model.test_log_add(logs_payload);
      } else {
        await logs_model.add(logs_payload);
      }
    }

    if (req?.returnType) {
      return {
        status: "SUCCESS",
        status_code: "00",
        message: "Transaction processed successfully",
        p_order_id: req.order_details.order_id,
        m_order_id: req.order_details.order_id,
        p_request_id: req.payment_ref_id,
        transaction_id: req.payment_ref_id,
      };
    }
    return true;
  } catch (error) {
    winston.error(error);

    throw error;
  }
}

async function ni_pay(req, mode) {
  try {
    let order_table = "orders";
    let txn_table = "order_txn";
    if (mode == "test") {
      order_table = "test_orders";
      txn_table = "test_order_txn";
    }
    let logs = [];
    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : Subscription recurring payment initiated by cron`
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : create new order for recurring}`
    );
    const order_id = await createOrder(req.order_details.order_id, order_table);
    const res_order_data = await merchantOrderModel.selectOne(
      "*",
      {
        order_id: order_id,
      },
      order_table
    );

    await merchantOrderModel.updateDynamic(
      { amount: parseFloat(req.amount).toFixed(2) },
      {
        order_id: order_id,
      },
      order_table
    );

    logs.push(
      `${moment().format(
        "DD/MM/YYYY HH:mm:ss.SSS"
      )} : Fetch new order details of order id ${order_id}}`
    );
    const _getmid = await merchantOrderModel.selectOne(
      "MID,password,psp_id",
      {
        terminal_id: res_order_data.terminal_id,
      },
      "mid"
    );
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Fetch terminal details}`
    );
    let payload = {
      action: "SALE",
      amount: {
        value: parseFloat(req.amount) * 100,
        currencyCode: req.currency,
      },
      emailAddress: res_order_data.customer_email,
      billingAddress: {
        firstName: res_order_data.customer_name,
        lastName: res_order_data.customer_name,
        address1: res_order_data.billing_address_line_1,
        city: res_order_data.billing_city,
        countryCode: res_order_data.billing_country,
      },
      merchantAttributes: {
        skip3DS: true,
      },
      redirectUrl: "",
      skipConfirmationPage: true,
    };
    _getmid.baseurl =
      mode == "test" ? credientials.ni.test_url : credientials.ni.base_url;
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Create NI Sale order}`
    );

    // const fraudRequest = {
    //   headers: {
    //     fp: "",
    //     os: "",
    //     useragent: "",
    //     browser: "",
    //     mobilebrand: "",
    //     ipcountry: "",
    //     ipcountryiso: "",
    //     ipstate: "",
    //     isp: "",
    //     ip: "",
    //   },
    //   body: {
    //     is_recuuring: 1,
    //     mid: _getmid?.MID,
    //     card_id: res_order_data?.card_id,
    //     card: "",
    //     payment_mode: "test",
    //     order_id: order_id,
    //   },
    //   card_details: {
    //     card_type: res_order_data?.cardType || "",
    //     currency_code: res_order_data?.currency,
    //     country_code3: res_order_data?.country_code3,
    //   },
    // };
    // const fraudData = await fraudEngine(fraudRequest, {}, {}, true);
    // if (fraudData) {
    //   const mode = "test";
    //   let updateRecurring = {
    //     is_paid: 0,
    //     payment_id: fraudData.new_res.transaction_id,
    //     response: "",
    //     response: JSON.stringify(fraudData),
    //     is_failed: 1,
    //     order_id: res_order_data.order_id,
    //   };
    //   let p_request_id = await helpers.make_sequential_no(
    //     mode == "test" ? "TST_REQ" : "REQ"
    //   );
    //   let order_req = {
    //     merchant_id: res_order_data.merchant_id,
    //     order_id: res_order_data.order_id,
    //     request_id: p_request_id,
    //     request: JSON.stringify(payload),
    //   };
    //   await helpers.common_add(
    //     order_req,
    //     mode == "test" ? "test_generate_request_id" : "generate_request_id"
    //   );
    //   logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : add request}`);
    //   await orderTransactionModel.updateDynamic(
    //     updateRecurring,
    //     { id: req.current_entry.id },
    //     "subscription_recurring"
    //   );
    //   return true;
    // }

    let createSaleOrderNI = await NI.recurringCaptureOrderCreate(
      _getmid,
      payload
    );
    let orderReferenceNo =
      createSaleOrderNI._embedded.payment[0]?.orderReference;
    let paymentNo = createSaleOrderNI._embedded.payment[0]?.reference;
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Recurring with NI}`
    );
    let paymentRecurringNi = await NI.captureRecurring(
      _getmid,
      orderReferenceNo,
      paymentNo,
      JSON.parse(res_order_data.saved_card_for_recurring)
    );
    let payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );

    let response_category = await helpers.get_error_category(
      paymentRecurringNi?.authResponse?.resultCode,
      "ni",
      paymentRecurringNi.state
    );

    let capture_link_to_array =
      paymentRecurringNi?._embedded?.[
        "cnp:capture"
      ][0]?._links?.self?.href.split("/");

    let capture_no = capture_link_to_array.reverse();
    const order_txn = {
      order_id: order_id,
      status: paymentRecurringNi.state == "CAPTURED" ? "AUTHORISED" : "FAILED",
      psp_code: paymentRecurringNi?.authResponse?.resultCode,
      paydart_category: response_category?.category,
      remark: response_category?.response_details,
      txn: payment_id,
      type:
        res_order_data.action.toUpperCase() == "SALE"
          ? "CAPTURE"
          : res_order_data.action.toUpperCase(),
      payment_id: paymentNo,
      order_reference_id: orderReferenceNo,
      capture_no: capture_no[0],
      amount: parseFloat(req.amount),
      currency: req.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    };

    logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update in txn}`);
    if (mode == "test") {
      await orderTransactionModel.test_txn_add(order_txn);
    } else {
      await orderTransactionModel.add(order_txn);
    }
    logs.push(
      `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update Recurring }`
    );

    const p_request_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );

    const order_req = {
      merchant_id: res_order_data.merchant_id,
      order_id: res_order_data.order_id,
      request_id: p_request_id,
      request: JSON.stringify(payload),
    };

    await helpers.common_add(
      order_req,
      mode == "test" ? "test_generate_request_id" : "generate_request_id"
    );

    logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : add request}`);

    if (req?.returnType) {
      return {
        status: "SUCCESS",
        status_code: "00",
        message: "Transaction processed successfully",
        p_order_id: orderReferenceNo,
        m_order_id: req.order_details.order_id,
        p_request_id: paymentRecurringNi.reference,
        transaction_id: req.payment_ref_id,
      };
    }
    return true;
  } catch (error) {
    winston.error(error);
    throw error;
  }
}
async function paytabs_pay(req, mode) {
  console.log(req);
  console.log(mode);
  let order_table = "orders";
  let txn_table = "order_txn";
  if (mode == "test") {
    order_table = "test_orders";
    txn_table = "test_order_txn";
  }
  let order_id = await createOrder(req.order_details.order_id, order_table);
  const res_order_data = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  const _getmid = await merchantOrderModel.selectOne(
    "MID,password,psp_id",
    {
      terminal_id: res_order_data.terminal_id,
    },
    "mid"
  );
  _getmid.baseurl = credientials.paytabs.base_url;

  const fraudRequest = {
    headers: {
      fp: "",
      os: "",
      useragent: "",
      browser: "",
      mobilebrand: "",
      ipcountry: "",
      ipcountryiso: "",
      ipstate: "",
      isp: "",
      ip: "",
    },
    body: {
      is_recuuring: 1,
      mid: _getmid?.MID,
      card_id: res_order_data?.card_id,
      card: "",
      payment_mode: "test",
      order_id: order_id,
    },
    card_details: {
      card_type: res_order_data?.cardType || "",
      currency_code: res_order_data?.currency,
      country_code3: res_order_data?.country_code3,
    },
  };

  // const fraudData = await fraudEngine(fraudRequest, {}, {}, true);
  // if (fraudData) {
  //   const mode = "test";
  //   let updateRecurring = {
  //     is_paid: 0,
  //     payment_id: fraudData.new_res.transaction_id,
  //     response: "",
  //     response: JSON.stringify(fraudData),
  //     is_failed: 1,
  //     order_id: res_order_data.order_id,
  //   };
  //   let p_request_id = await helpers.make_sequential_no(
  //     mode == "test" ? "TST_REQ" : "REQ"
  //   );
  //   let order_req = {
  //     merchant_id: res_order_data.merchant_id,
  //     order_id: res_order_data.order_id,
  //     request_id: p_request_id,
  //     request: JSON.stringify(payload),
  //   };
  //   await helpers.common_add(
  //     order_req,
  //     mode == "test" ? "test_generate_request_id" : "generate_request_id"
  //   );
  //   logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : add request}`);
  //   await orderTransactionModel.updateDynamic(
  //     updateRecurring,
  //     { id: req.current_entry.id },
  //     "subscription_recurring"
  //   );
  //   return true;
  // }

  let data = JSON.stringify({
    profile_id: _getmid.MID,
    tran_type: "sale",
    tran_class: "recurring",
    token: req.order_details.saved_card_for_recurring,
    tran_id: req.payment_ref_id,
    cart_id: order_id.toString(),
    cart_description:
      res_order_data.remark != "" ? res_order_data.remark : "Paytabs",
    cart_currency: req.currency,
    cart_amount: req.amount,
  });

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: _getmid.baseurl,
    headers: {
      Authorization: _getmid.password,
      "Content-Type": "application/json",
    },
    data: data,
  };

  let paytabs_res = await axios.request(config);
  paytabs_res = paytabs_res.data;
  let response_category = await helpers.get_error_category(
    paytabs_res.payment_result.response_status == "A" ? "0" : "1",
    "paytabs",
    paytabs_res.payment_result.response_status == "A" ? "AUTHORISED" : "FAILED"
  );
  let payment_id = await helpers.make_sequential_no(
    mode == "test" ? "TST_TXN" : "TXN"
  );
  let order_txn = {
    order_id: order_id,
    status:
      paytabs_res.payment_result.response_status == "A"
        ? "AUTHORISED"
        : "FAILED",
    psp_code: paytabs_res?.payment_result?.response_code,
    paydart_category: response_category?.category,
    remark: response_category?.response_details,
    txn: payment_id,
    type: "CAPTURE",
    payment_id: paytabs_res.tran_ref,
    order_reference_id: paytabs_res.trace,
    amount: req.amount,
    currency: req.currency,
    created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
  };
  if (mode == "test") {
    await orderTransactionModel.test_txn_add(order_txn);
  } else {
    await orderTransactionModel.add(order_txn);
  }

  let p_request_id = await helpers.make_sequential_no(
    mode == "test" ? "TST_REQ" : "REQ"
  );
  let order_req = {
    merchant_id: res_order_data.merchant_id,
    order_id: res_order_data.order_id,
    request_id: p_request_id,
    request: data,
  };
  await helpers.common_add(
    order_req,
    mode == "test" ? "test_generate_request_id" : "generate_request_id"
  );

  if (req?.returnType) {
    return {
      status: "SUCCESS",
      status_code: "00",
      message: "Transaction processed successfully",
      p_order_id: req.order_details.order_id,
      m_order_id: req.order_details.order_id,
      p_request_id: req.payment_ref_id,
      transaction_id: req.payment_ref_id,
    };
  }
  return true;
}

async function fraudfailedTransaction() {
  let paymentRecurringNi = await NI.captureRecurring(
    _getmid,
    orderReferenceNo,
    paymentNo,
    JSON.parse(res_order_data.saved_card_for_recurring)
  );
  let payment_id = await helpers.make_sequential_no(
    mode == "test" ? "TST_TXN" : "TXN"
  );
  console.log(JSON.stringify(paymentRecurringNi));

  let response_category = await helpers.get_error_category(
    paymentRecurringNi?.authResponse?.resultCode,
    "ni",
    paymentRecurringNi.state
  );
  let capture_link_to_array =
    paymentRecurringNi?._embedded?.["cnp:capture"][0]?._links?.self?.href.split(
      "/"
    );

  let capture_no = capture_link_to_array.reverse();
  let order_txn = {
    order_id: order_id,
    status: paymentRecurringNi.state == "CAPTURED" ? "AUTHORISED" : "FAILED",
    psp_code: paymentRecurringNi?.authResponse?.resultCode,
    paydart_category: response_category?.category,
    remark: response_category?.response_details,
    txn: payment_id,
    type:
      res_order_data.action.toUpperCase() == "SALE"
        ? "CAPTURE"
        : res_order_data.action.toUpperCase(),
    payment_id: paymentNo,
    order_reference_id: orderReferenceNo,
    capture_no: capture_no[0],
    amount: res_order_data.amount,
    currency: res_order_data.currency,
    created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
  };
  logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update in txn}`);
  if (mode == "test") {
    await orderTransactionModel.test_txn_add(order_txn);
  } else {
    await orderTransactionModel.add(order_txn);
  }
  logs.push(
    `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Update Recurring }`
  );
  let updateRecurring = {
    is_paid: paymentRecurringNi.state == "CAPTURED" ? 1 : 0,
    payment_id: paymentRecurringNi.reference,
    response: paymentRecurringNi.savedCard.cardToken,
    response: JSON.stringify(paymentRecurringNi),
    is_failed: paymentRecurringNi.state == "CAPTURED" ? 0 : 1,
    order_id: res_order_data.order_id,
  };
  let p_request_id = await helpers.make_sequential_no(
    mode == "test" ? "TST_REQ" : "REQ"
  );
  let order_req = {
    merchant_id: res_order_data.merchant_id,
    order_id: res_order_data.order_id,
    request_id: p_request_id,
    request: JSON.stringify(payload),
  };
  await helpers.common_add(
    order_req,
    mode == "test" ? "test_generate_request_id" : "generate_request_id"
  );
  logs.push(`${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : add request}`);
  await orderTransactionModel.updateDynamic(
    updateRecurring,
    { id: req.current_entry.id },
    "subscription_recurring"
  );
  return true;
}

async function createOrder(old_order_id, order_table) {
  let order_id = await helpers.make_sequential_no(
    order_table == "orders" ? "ORD" : "TST_ORD"
  );
  let current_date = moment().format("YYYY-MM-DD HH:mm");
  let query = `INSERT INTO pg_${order_table}(order_id,created_at, updated_at,merchant_id, merchant_order_id, payment_id, terminal_id, psp, action, status, origin, customer_name, merchant_customer_id, customer_email, customer_code, customer_mobile, billing_address_line_1, billing_address_line_2, billing_city, billing_pincode, billing_province, billing_country, shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_country, shipping_province, shipping_pincode, amount, currency, return_url, description, card_no, card_id, browser,browser_version, ip, os, ip_country,  super_merchant, cid, block_for_suspicious_ip, block_for_suspicious_email, high_risk_country, block_for_transaction_limit, high_risk_transaction, remark, payment_mode, sale_charge, sale_tax, buy_charge, buy_tax, mcc_category, mcc, psp_id, expiry, cardholderName, scheme, card_bin, cardType, cardCategory, card_country, pan, device_type, browser_fingerprint, amount_left, payment_token_id, success_url, cancel_url, failure_url, capture_method, capture_datetime, voidWithinDatetime, 3ds, 3ds2_url, is_one_click, issuer, issuer_website, issuer_phone_number, saved_card_for_recurring) SELECT  "${order_id}","${current_date}", "${current_date}",merchant_id, merchant_order_id, payment_id, terminal_id, psp, action, status, origin, customer_name, merchant_customer_id, customer_email, customer_code, customer_mobile, billing_address_line_1, billing_address_line_2, billing_city, billing_pincode, billing_province, billing_country, shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_country, shipping_province, shipping_pincode, amount, currency, return_url, description, card_no, card_id, browser, browser_version, ip, os, ip_country,  super_merchant, cid, block_for_suspicious_ip, block_for_suspicious_email, high_risk_country, block_for_transaction_limit, high_risk_transaction, remark, payment_mode, sale_charge, sale_tax, buy_charge, buy_tax, mcc_category, mcc, psp_id, expiry, cardholderName, scheme, card_bin, cardType, cardCategory, card_country, pan, device_type, browser_fingerprint, amount_left, payment_token_id, success_url, cancel_url, failure_url, capture_method, capture_datetime, voidWithinDatetime, 3ds, 3ds2_url, is_one_click, issuer, issuer_website, issuer_phone_number, saved_card_for_recurring FROM pg_${order_table} WHERE order_id="${old_order_id}"`;

  let qb = await pool.get_connection();
  try {
    let response = await qb.query(query);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return order_id;
}
