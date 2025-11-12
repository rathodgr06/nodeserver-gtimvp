const helpers = require("../../utilities/helper/general_helper");
const { v4: uuidv4 } = require("uuid");
var uuid = require("uuid");
const merchantOrderModel = require("../../models/merchantOrder");
const orderTransactionModel = require('../../models/order_transaction');
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const routingModel = require("../../models/routingModel");
const { send_webhook_data } = require("../../controller/webhook_settings");
const moment = require('moment');
const order_transactionModel = require('../../models/order_transaction');
const manageSub = require('../../utilities/subscription/index');
const EventEmitter = require("events");
const ee = new EventEmitter();
const SendTransactionMailAction = require('../SendTransactionMail');

const PaymentToken = require("@madskunker/apple-pay-decrypt");
const fs = require("fs");

var MpgsPayment = {
  pay: async (req, res) => {
    let final_response;
    const { paymentToken, amount, currency, order_id, mode } = req.body;
    console.log("🚀 ~ pay: ~ req.body:", paymentToken);

    //------------------------------------------------------------------

    var paymentTokenParsed = JSON.parse(paymentToken);

    const certPem = fs.readFileSync("./config/decrpt/certPem.pem", "utf8");
    const privatePem = fs.readFileSync(
      "./config/decrpt/privatePem.pem",
      "utf8"
    );

    const token = new PaymentToken(paymentTokenParsed);

    const decryptedToken = token.decrypt(certPem, privatePem);
    console.log("🚀 ~ pay: ~ decryptedToken:", decryptedToken);

    //------------------------ DB Tabes ------------------------------

    let order_table = mode === "live" ? "orders" : "test_orders";
    let generate_request_id_table =
      mode === "live" ? "generate_request_id" : "test_generate_request_id";

    //----------------------------------------------------------------

    //------------------------ Routing -------------------------------

    var routingData = await MpgsPayment.check(mode, order_id);
    console.log("🚀 ~ pay: ~ routingData:", routingData);

    //----------------------------------------------------------------

    const mid_details = await merchantOrderModel.selectOne(
      "MID,password,psp_id,mode",
      {
        terminal_id: routingData.terminal_id,
      },
      "mid"
    );

    if (!mid_details) {
      res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("No Terminal Available"));
    }

    //----------------------------------------------------------------

    const MERCHANT_ID = mid_details.MID;
    const username = `merchant.${MERCHANT_ID}`;
    const password = mid_details.password;
    const basicAuthToken = Buffer.from(`${username}:${password}`).toString(
      "base64"
    );
    console.log("🚀 ~ pay: ~ basicAuthToken:", basicAuthToken);

    //-----------------------------------------------------------------

    const _pspId = await merchantOrderModel.selectOne(
      "*",
      {
        id: mid_details.psp_id,
      },
      "psp"
    );
    if (!_pspId) {
      res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("No Psp Available"));
    }

    console.log("🚀 ~ pay: ~ PSP:", basicAuthToken);

    //------------------------------------------------------------------

    let order_details = await merchantOrderModel.selectOne(
      "*",
      {
        order_id: order_id,
      },
      order_table
    );

    //-------------------------------------------------------------------

    let ORDER_ID = order_id;
    let TXN_ID = await helpers.make_sequential_no(
      mode == "live" ? "TXN" : "TST_TXN"
    );

    const PAY_URL =
      "https://test-gateway.mastercard.com/api/rest/version/100/merchant/" +
      MERCHANT_ID +
      "/order/" +
      ORDER_ID +
      "/transaction/" +
      TXN_ID;
    console.log("🚀 ~ pay: ~ PAY_URL:", PAY_URL);

    const axios = require("axios");
    let data = JSON.stringify({
      apiOperation: "PAY",
      order: {
        amount: amount,
        currency: currency,
        walletProvider: "APPLE_PAY",
        reference: uuidv4(),
      },
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: decryptedToken.applicationPrimaryAccountNumber,
            expiry: {
              year: decryptedToken.applicationExpirationDate.substring(0, 2),
              month: decryptedToken.applicationExpirationDate.substring(2, 4),
            },
            devicePayment: {
              cryptogramFormat: decryptedToken.paymentDataType.toUpperCase(), //"3DSECURE",
              onlinePaymentCryptogram:
                decryptedToken.paymentData.onlinePaymentCryptogram,
              eciIndicator: decryptedToken.paymentData.eciIndicator,
            },
          },
        },
      },
      transaction: {
        source: "INTERNET",
      },
    });
    

    let config = {
      method: "put",
      maxBodyLength: Infinity,
      url: PAY_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuthToken}`,
      },
      data: data,
    };

    //------------------------------------------------------------------------

    //API Call
    axios
      .request(config)
      .then(async (final_response) => {
        console.log("🚀 ~ .then ~ final_response:", final_response);
        final_response = final_response;
        // Process MPGS response

        //-------- Update order table with status, 3ds, 3ds_status -------------

        const status = {
          status:
            final_response.data.result === "SUCCESS"
              ? mid_details.mode == "SALE"
                ? "CAPTURED"
                : "AUTHORISED"
              : "FAILED",
          "3ds": 0,
          psp: "MPGS",
          "3ds_status": final_response.data.transaction?.authenticationStatus,
          payment_token_id: "",
        };
        const condition = { order_id: order_id };
        console.log("<< updateDynamic-condition >>", condition);
        console.log("<< updateDynamic-payload >>", status);

        await merchantOrderModel.updateDynamic(status, condition, order_table);

        //-----------------------------------------------------------------------

        //------------ Insert To Transaction Table ------------------------------

        const order_txn = {
          txn: TXN_ID.toString(),
          order_id: order_id,
          currency: currency,
          amount: amount,
          type: mid_details.mode == "SALE" ? "CAPTURE" : "AUTH",
          status:
            final_response?.data?.result === "SUCCESS"
              ? "AUTHORISED"
              : "FAILED",
          psp_code: mid_details?.psp_id,
          paydart_category:
            final_response?.data?.result === "SUCCESS" ? "Success" : "FAILED",
          remark:
            final_response?.data?.result === "SUCCESS"
              ? "Transaction Approved"
              : "Transaction Failed",
          capture_no: "",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
          payment_id: final_response?.data?.transaction?.transactionId || "",
          order_reference_id: final_response?.data?.order?.reference || "",
        };

        
        const insert_to_txn_table =
          mode == "live"
            ? await order_transactionModel.add(order_txn)
            : await order_transactionModel.test_txn_add(order_txn);

        console.log("<< insert-Txn-payload >>", order_txn);
        console.log("<< updateDynamic-result >>", insert_to_txn_table);

        let paydart_req_id = await helpers.make_sequential_no(
          mode == "test" ? "TST_REQ" : "REQ"
        );

        let order_req = {
          merchant_id: MERCHANT_ID,
          order_id: order_id,
          request_id: paydart_req_id,
          request: JSON.stringify(req.body),
        };

        console.log("<< generate_request_id_table-payload >>", order_req);
        await helpers.common_add(order_req, generate_request_id_table);

        if (!insert_to_txn_table) {
          return res
            .status(statusCode.badRequest)
            .send(Server_response.errormsg("Transaction insertion failed"));
        }

        //-----------------------------------------------------------------------

        //-----------------------------------------------------------------------

        let response_category = await helpers.get_error_category(
          final_response?.data?.result == "FAILED"
            ? "1"
            : final_response?.data?.response?.acquirerCode,
          "mpgs",
          final_response?.data?.result
        );

        console.log("<< response_category-result >>", response_category);

        const res_obj = {
          message:
            final_response?.data?.result === "SUCCESS"
              ? "Transaction Successful"
              : "Transaction FAILED",
          order_status: status.status,
          payment_id:
            final_response?.data?.transaction?.acquirer?.transactionId,
          order_id: order_details?.order_id,
          amount: order_details?.amount,
          currency: order_details?.currency,
          token: "",
          remark: "",
          new_res: {
            m_order_id: order_details?.merchant_order_id || "",
            p_order_id: order_details?.order_id || "",
            p_request_id: paydart_req_id.toString(),
            psp_ref_id:
              final_response?.data?.transaction?.receipt?.toString() || "",
            psp_txn_id:
              final_response?.data?.transaction?.acquirer?.transactionId?.toString() ||
              "",
            transaction_id: TXN_ID.toString(),
            status: final_response?.data?.result,
            status_code: response_category?.response_code, //final_response?.data?.response.acquirerCode,
            remark: response_category?.response_details, //final_response?.data?.response.acquirerMessage,
            paydart_category: response_category?.category, //final_response?.data?.result === 'SUCCESS' ? '' : 'FAILED',
            currency: order_details?.currency,
            return_url: process.env.PAYMENT_URL + "/status",
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_details?.amount.toFixed(2) || "",
            m_customer_id: order_details?.merchant_customer_id || "",
            psp: order_details?.psp || "",
            payment_method: order_details?.payment_mode || "",
            m_payment_token: order_details?.card_id || "",
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
          },
        };

        console.log("<< res_obj-payload >>", res_obj);

        let txnFailedLog = {
          order_id: order_details?.order_id,
          terminal: order_details?.terminal_id,
          req: JSON.stringify(req.body),
          res: "",
          psp: _pspId.name,
          status_code: final_response?.data?.transaction?.authorizationCode,
          description: final_response?.data?.transaction?.authenticationStatus,
          activity: `Transaction ${
            final_response?.data?.result === "SUCCESS" ? "SUCCESS" : "FAILED"
          } with MPGS`,
          status: final_response?.data?.result === "SUCCESS" ? 1 : 0,
          mode: mode,
          card_holder_name:
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.card_holder_name || "",
          card: final_response?.data?.sourceOfFunds?.provided?.card
            ?.deviceSpecificNumber,
          expiry:
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.deviceSpecificExpiry?.month +
            "7" +
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.deviceSpecificExpiry?.year,
          cipher_id:
            final_response?.data?.sourceOfFunds?.provided?.card?.cipher_id ||
            "",
          txn: TXN_ID.toString(),
          "3ds_version": "0",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        console.log("<< addTransactionFailedLogs-payload >>", txnFailedLog);
        await helpers.addTransactionFailedLogs(txnFailedLog);

        //-----------------------------------------------------------------------
        // if (order_details?.origin == "SUBSCRIPTION") {
        //   subscriptionRes = await manageSub(
        //     order_details,
        //     final_response?.data?.result == "SUCCESS" ? "CAPTURED" : "FAILED",
        //     moment().format("YYYY-MM-DD HH:mm:ss"),
        //     "", //payment_token_id
        //     "",
        //     mode
        //   );
        // }
        //-----------------------------------------------------------------------

        // web  hook starting
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: order_details?.merchant_id,
        });
        let web_hook_res = Object.assign({}, res_obj.new_res);
        delete web_hook_res?.return_url;
        if (hook_info[0]) {
          if (hook_info[0].enabled === 0) {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              web_hook_res,
              hook_info[0].notification_secret
            );
          }
        }
        if (final_response?.data?.result == "SUCCESS") {
          ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            await SendTransactionMailAction(arguments);
          });
          ee.emit("ping", {
            order_table: order_table,
            order_id: order_details.order_id,
          });
        }

        const responseStatus =
          final_response?.data?.result === "SUCCESS"
            ? statusCode.ok
            : statusCode.badRequest;
        return res
          .status(responseStatus)
          .send(
            final_response?.data?.result === "SUCCESS"
              ? Server_response.successdatamsg(res_obj, res_obj.message)
              : Server_response.errorMsgWithData(
                  res_obj.message,
                  res_obj,
                  responseStatus
                )
          );
        //-----------------------------------------------------------------------
      })
      .catch(async (error) => {
        console.log(`error is here`);
        console.log(error);
        let paydart_req_id = await helpers.make_sequential_no(
          mode == "test" ? "TST_REQ" : "REQ"
        );
        let order_req = {
          merchant_id: order_details.merchant_id,
          order_id: order_details?.order_id,
          request_id: paydart_req_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, generate_request_id_table);
        let response_category = await helpers.get_error_category(
          "01",
          "mpgs",
          final_response?.data?.result
        );

        // console.log(`inside the catch block`);
        // console.log(error);
        // console.log(`error is here`);
        // console.log(error.response.data.error);
        await merchantOrderModel.updateDynamic(
          { status: "FAILED" },
          { order_id: order_id },
          order_table
        );
        const insertFunction =
          mode === "live"
            ? order_transactionModel.add
            : order_transactionModel.test_txn_add;
        const order_txn_update = {
          txn: TXN_ID.toString() ? TXN_ID.toString() : "",
          order_id: order_details?.order_id || "",
          currency: order_details?.currency || "",
          amount: order_details?.amount || "",
          type: order_details?.action.toUpperCase(),
          status: "FAILED",
          psp_code: final_response?.data?.transaction?.authorizationCode || "",
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
          token: "", //req.browser_fingerprint
          remark: error.response ? error.response.data : "",
          new_res: {
            m_order_id: order_details?.merchant_order_id || "",
            p_order_id: order_details?.order_id || "",
            p_request_id: "",
            psp_ref_id:
              final_response?.data?.transaction.receipt?.toString() || "",
            psp_txn_id:
              final_response?.data?.transaction.acquirer.transactionId?.toString() ||
              "",
            transaction_id: TXN_ID.toString(),
            status: "FAILED",
            status_code: response_category?.response_code, //final_response.data.response.acquirerCode,
            remark: response_category?.response_details, //final_response.data.response.acquirerMessage,
            paydart_category: response_category?.category, //final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
            currency: order_details?.currency,
            return_url: process.env.PAYMENT_URL + "/status", //order_details?.failure_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_details?.amount.toFixed(2) || "",
            m_customer_id: order_details?.merchant_customer_id || "",
            psp: order_details?.psp || "",
            payment_method: order_details?.payment_mode || "",
            m_payment_token: order_details?.card_id || "",
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
          },
        };
        console.log(res_obj);
        let txnFailedLog = {
          order_id: order_details?.order_id,
          terminal: order_details?.terminal_id,
          req: JSON.stringify(req.body),
          res: "",
          psp: _pspId.name,
          status_code:
            final_response?.data?.transaction?.authorizationCode || "",
          description:
            final_response?.data?.transaction?.authenticationStatus || "",
          activity: "Transaction FAILED with MPGS",
          status: 0,
          mode: mode,
          card_holder_name:
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.card_holder_name || "",
          card: final_response?.data?.sourceOfFunds?.provided?.card
            ?.deviceSpecificNumber,
          expiry:
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.deviceSpecificExpiry?.month +
            "7" +
            final_response?.data?.sourceOfFunds?.provided?.card
              ?.deviceSpecificExpiry?.year,
          cipher_id:
            final_response?.data?.sourceOfFunds?.provided?.card?.cipher_id ||
            "",
          txn: TXN_ID.toString(),
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
          if (hook_info[0].enabled === 0) {
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
            Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
          );
      });
  },
  check: async (env, order_id) => {
    let payment_mode = env;
    let table_name = "orders";
    if (payment_mode == "test") {
      table_name = "test_orders";
    }
    const order_details = await merchantOrderModel.selectOne(
      "merchant_id,currency",
      { order_id: order_id },
      table_name
    );
    const routing_order_ap = await routingModel.get(
      {
        sub_merchant_id: order_details.merchant_id,
        payment_method: "apple_pay",
        mode: payment_mode,
      },
      "routing_order"
    );
    let data_response = { psp: "", terminal_id: "" };

    if (routing_order_ap.length > 0) {
      const mid_data = await merchantOrderModel.selectOne(
        "psp_id,terminal_id,id",
        { id: routing_order_ap[0].mid_id },
        "mid"
      );
      data_response.psp = await helpers.get_psp_key_by_id(mid_data.psp_id);
      data_response.terminal_id = mid_data.terminal_id;
      data_response.mid = mid_data.id;
    } else {
      let mid_data = await helpers.get_apple_mid_by_merchant_id(
        order_details?.merchant_id,
        order_details.currency,
        payment_mode
      );
      mid_data.forEach((element) => {
        if (element.payment_methods.includes("Apple Pay")) {
          data_response.psp = element.psp;
          data_response.terminal_id = element.terminal_id;
          data_response.mid_id = element.midId;
        }
      });
    }
    return data_response;
  },
};
module.exports = MpgsPayment;
