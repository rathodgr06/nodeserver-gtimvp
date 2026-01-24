const axios = require('axios');
const credentials = require('../../config/credientials');
const merchantOrderModel = require('../../models/merchantOrder');
const helpers = require('../../utilities/helper/general_helper');
const moment = require('moment');
const order_transactionModel = require('../../models/order_transaction');
const statusCode = require("../../utilities/statuscode");
const Server_response = require("../../utilities/response/ServerResponse");
const { v4: uuidv4 } = require('uuid');
const { send_webhook_data } = require("../webhook_settings");
const logger = require('../../config/logger');
const calculateTransactionCharges = require("../../utilities/charges/transaction-charges");



/* ───────── CONTROLLER ───────── */
const confirm_payment = async (req, res) => {
  let transaction_id = null;
  let final_response = null;

  try {
    /* ───── INPUTS ───── */
    const order_id = helpers.body(req, 'p_order_id') || helpers.body(req, 'order_id');
    const mode = helpers.body(req, 'mode');

    if (!order_id || !mode) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("Invalid request"));
    }

    const order_table = mode === 'live' ? 'orders' : 'test_orders';
    const txn_table = mode === 'live' ? 'order_txn' : 'test_order_txn';

    /* ───── ORDER ───── */
    const order_details = await merchantOrderModel.selectOne(
      '*',
      { order_id },
      order_table
    );

    if (!order_details) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("Order not found"));
    }

    /* ───── MID ───── */
    const mid_details = await merchantOrderModel.selectOne(
      'MID,password,psp_id,statementDescriptor,primary_key,terminal_id',
      { terminal_id: order_details.terminal_id, deleted: 0, env: mode },
      'mid'
    );

    if (!mid_details) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("No terminal available"));
    }

    /* ───── PSP ───── */
    const psp_details = await merchantOrderModel.selectOne(
      '*',
      { id: mid_details.psp_id },
      'psp'
    );

    if (!psp_details || !credentials?.[psp_details.credentials_key]) {
      return res
        .status(statusCode.internalError)
        .send(Server_response.errormsg("PSP configuration missing"));
    }

    /* ───── TOKEN ───── */
    const basicAuthToken = await helpers.createBasicAuthToken(
      mid_details.MID,
      mid_details.password
    );

    const baseUrl =
      mode === 'live'
        ? credentials[psp_details.credentials_key].base_url
        : credentials[psp_details.credentials_key].test_url;

    const tokenRes = await axios.post(
      `${baseUrl}collection/token/`,
      {},
      {
        headers: {
          Authorization: basicAuthToken,
          "Ocp-Apim-Subscription-Key": mid_details.primary_key
        },
        timeout: 10000
      }
    );

    const token = tokenRes?.data?.access_token;
    if (!token) throw new Error("Token generation failed");

    /* ───── FETCH TXN STATUS ───── */
    const order_txn = await merchantOrderModel.selectOne(
      '*',
      { order_id },
      txn_table
    );

    final_response = await axios.get(
      `${baseUrl}collection/v1_0/requesttopay/${order_txn.payment_id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": mid_details.primary_key,
          "X-Target-Environment": mode === 'test' ? 'sandbox' : 'mtnliberia'
        },
        timeout: 10000
      }
    );

    const mtnStatus = helpers.fetchPaydartStatusByPSPStatus(
      final_response.data.status,
      "MTN-MOMO"
    );

    /* ───── UPDATE ORDER ───── */
    await merchantOrderModel.updateDynamic(
      { status: mtnStatus.order_status, '3ds_status': 'NA' },
      { order_id },
      order_table
    );

    /* ───── INSERT TXN ───── */
    transaction_id = await helpers.make_sequential_no(
      mode === 'test' ? 'TST_TXN' : 'TXN'
    );

    const insertTxn =
      mode === 'live'
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;

    await insertTxn({
      txn: transaction_id.toString(),
      order_id,
      currency: order_details.currency,
      amount: order_details.amount,
      type: 'CAPTURE',
      status: mtnStatus.txn_status,
      psp_code: mtnStatus.status_code,
      paydart_category: mtnStatus.status,
      created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      payment_id: final_response.data.financialTransactionId || ""
    });

    /* ───── RESPONSE OBJECT ───── */
    const statusObj = {
      status: mtnStatus.status,
      status_code: mtnStatus.status_code,
      remark: mtnStatus.remark
    };

    const new_res = helpers.buildNewRes({
      order_details,
      transaction_id,
      final_response,
      statusObj
    });

    const res_obj = {
      message: mtnStatus.remark,
      order_status: mtnStatus.order_status,
      payment_id: final_response.data.financialTransactionId || "",
      order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      remark: "",
      new_res
    };

    /* ───── WEBHOOK ───── */
    const hook_info = await helpers.get_data_list("*", "webhook_settings", {
      merchant_id: order_details.merchant_id
    });

    if (hook_info?.[0]?.enabled === 0 && hook_info[0].notification_url) {
      const hookPayload = { ...new_res };
      delete hookPayload.return_url;
      delete hookPayload.paydart_category;

      await send_webhook_data(
        hook_info[0].notification_url,
        hookPayload,
        hook_info[0].notification_secret
      );
    }

    /* ───── CHARGES ───── */
    if (final_response.data.status === 'SUCCESSFUL' && mode === process.env.CHARGES_MODE) {
      await calculateTransactionCharges({
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
      });
    }

    return res.status(
      final_response.data.status === 'SUCCESSFUL'
        ? statusCode.ok
        : statusCode.badRequest
    ).send(
      final_response.data.status === 'SUCCESSFUL'
        ? Server_response.successdatamsg(res_obj, res_obj.message)
        : Server_response.errorMsgWithData(res_obj.message, res_obj)
    );

  } catch (error) {
    logger.error("confirm_payment failed", {
      message: error.message,
      stack: error.stack
    });

    const statusObj = {
      status: "FAILED",
      status_code: "01",
      remark: "Transaction Failed"
    };

    const new_res = helpers.buildNewRes({
      order_details: {},
      transaction_id,
      final_response,
      statusObj
    });

    const res_obj = {
      message: "Transaction FAILED",
      order_status: "FAILED",
      payment_id: "",
      order_id: helpers.body(req, 'order_id'),
      amount: "",
      currency: "",
      remark: "",
      new_res
    };

    return res
      .status(statusCode.ok)
      .send(Server_response.errorMsgWithData(res_obj.message, res_obj));
  }
};

module.exports = confirm_payment;
