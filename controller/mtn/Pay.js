const axios = require("axios");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const merchantOrderModel = require("../../models/merchantOrder");
const order_transactionModel = require("../../models/order_transaction");
const helpers = require("../../utilities/helper/general_helper");
const credentials = require("../../config/credientials");
const statusCode = require("../../utilities/statuscode");
const ServerResponse = require("../../utilities/response/ServerResponse");
const logger = require("../../config/logger");
const { send_webhook_data } = require("../webhook_settings");

const Pay = async (req, res, is_internal = true) => {
  let payment_id = null;
  const mode = req?.body?.mode;
  let generate_request_id_table =
    mode === "live" ? "generate_request_id" : "test_generate_request_id";
  try {
    /* ───────── SAFE INPUT READS ───────── */
    const orderId = req?.body?.order_id;
  
    const psp = req?.bodyString?.("psp");
    const countryCode = req?.bodyString?.("country_code");
    const mobileNo = req?.bodyString?.("mobile_no");

    if (!orderId || !mode || !psp || !countryCode || !mobileNo) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("Missing required parameters"));
    }

    const orderTable = mode === "live" ? "orders" : "test_orders";
    const txnTable = mode === "live" ? "order_txn" : "test_order_txn";

    /* ───────── PSP VALIDATION ───────── */
    const pspDetails = await merchantOrderModel.selectOne(
      "id,name",
      { credentials_key: psp, deleted: 0 },
      "psp"
    );

    if (!pspDetails) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("No PSP available"));
    }

    /* ───────── ORDER VALIDATION ───────── */
    const orderDetails = await merchantOrderModel.selectOne(
      "*",
      { order_id: orderId },
      orderTable
    );

    if (!orderDetails) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("Invalid order"));
    }

    /* ───────── MID VALIDATION ───────── */
    const midDetails = await merchantOrderModel.selectOne(
      "MID,password,terminal_id,primary_key,statementDescriptor,shortenedDescriptor",
      {
        psp_id: pspDetails.id,
        submerchant_id: orderDetails.merchant_id,
        deleted: 0,
        env: mode
      },
      "mid"
    );

    if (!midDetails) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("No terminal available"));
    }

    if (!credentials?.[psp]) {
      logger.error("PSP config missing", { psp });
      return res
        .status(statusCode.internalError)
        .send(ServerResponse.errormsg("Configuration error"));
    }

    /* ───────── UPDATE ORDER META ───────── */
    await merchantOrderModel.updateDynamic(
      {
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        psp: pspDetails.name,
        terminal_id: midDetails.terminal_id,
        payment_mode: "Mobile Wallet"
      },
      { order_id: orderId },
      orderTable
    );

    /* ───────── AUTH TOKEN ───────── */
    const basicAuthToken = await helpers.createBasicAuthToken(
      midDetails.MID,
      midDetails.password
    );

    const baseUrl =
      mode === "live"
        ? credentials[psp].base_url
        : credentials[psp].test_url;

    const tokenRes = await axios.post(
      `${baseUrl}collection/token/`,
      {},
      {
        headers: {
          Authorization: basicAuthToken,
          "Ocp-Apim-Subscription-Key": midDetails.primary_key
        },
        timeout: 10000
      }
    );

    const token = tokenRes?.data?.access_token;
    if (!token) {
      throw new Error("Token generation failed");
    }

    /* ───────── PAYMENT REQUEST ───────── */
    payment_id = await helpers.make_sequential_no(
      mode === "test" ? "TST_TXN" : "TXN"
    );

    const xRefId = uuidv4();

    const payload = {
      amount: orderDetails.amount,
      currency: orderDetails.currency,
      externalId: orderId,
      payer: {
        partyIdType: "MSISDN",
        partyId: `${countryCode}${mobileNo}`
      },
      payerMessage: midDetails.statementDescriptor,
      payeeNote: midDetails.shortenedDescriptor
    };

    await axios.post(
      `${baseUrl}collection/v1_0/requesttopay`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": midDetails.primary_key,
          "X-Target-Environment": mode === "test" ? "sandbox" : "mtnliberia",
          "X-Reference-Id": xRefId
        },
        timeout: 10000
      }
    );

    /* ───────── TXN INSERT ───────── */
    const insertTxn =
      mode === "live"
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;

    await insertTxn({
      order_id: orderId,
      txn: payment_id.toString(),
      type: orderDetails.action.toUpperCase(),
      status: "PENDING",
      amount: orderDetails.amount,
      currency: orderDetails.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      payment_id: xRefId
    });
    /* ───────── Store request details ───────── */
    let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
    let order_req = {
      merchant_id: orderDetails.merchant_id,
      order_id: orderDetails?.order_id,
      request_id: paydart_req_id,
      request: JSON.stringify(req.body),
    };
    await helpers.common_add(order_req, generate_request_id_table);

    return res.status(statusCode.ok).send({
      data: {
        transaction_ref_id: xRefId,
        order_id: orderId,
        transaction_id: payment_id.toString(),
        mode
      },
      status: "success"
    });

  } catch (err) {
    logger.error("MTN Pay failed", {
      message: err.message,
      stack: err.stack,
      payment_id
    });

    // Best-effort failure logging (no crash)
    try {
      if (payment_id) {
        const insertTxn =
          mode === "live"
            ? order_transactionModel.add
            : order_transactionModel.test_txn_add;

        await insertTxn({
          order_id: req?.body?.order_id,
          txn: payment_id.toString(),
          status: "FAILED",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        });
        /* ───────── Store request details ───────── */
        let paydart_req_id = await helpers.make_sequential_no(
          mode == "test" ? "TST_REQ" : "REQ",
        );
        let order_req = {
          merchant_id: orderDetails.merchant_id,
          order_id: orderDetails?.order_id,
          request_id: paydart_req_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, generate_request_id_table);
      }
    } catch (e) {
      logger.error("Failed to log failed txn", e);
    }

    return res
      .status(statusCode.internalError)
      .send(ServerResponse.errorMsgWithData("Transaction failed", []));
  }
};

module.exports = Pay;
