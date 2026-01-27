const axios = require("axios");
const credentials = require("../../config/credientials");
const helpers = require("../../utilities/helper/general_helper");
const merchantOrderModel = require("../../models/merchantOrder");
const statusCode = require("../../utilities/statuscode");
const ServerResponse = require("../../utilities/response/ServerResponse");
const logger = require("../../config/logger");

const Verify = async (req, res) => {
  try {
    // ─── SAFE REQUEST READS ───────────────────────────────
    const orderId = req?.body?.order_id;
    const mode = req?.body?.mode;
    const psp = req?.bodyString?.("psp");
    const mobile = req?.bodyString?.("mobile_no");
    const country = req?.bodyString?.("country");

    if (!orderId || !mode || !psp || !mobile || !country) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("Missing required parameters"));
    }

    const orderTable = mode === "live" ? "orders" : "test_orders";

    // ─── PSP VALIDATION ───────────────────────────────────
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

    // ─── ORDER VALIDATION ─────────────────────────────────
    const orderDetails = await merchantOrderModel.selectOne(
      "merchant_id",
      { order_id: orderId },
      orderTable
    );

    if (!orderDetails) {
      return res
        .status(statusCode.badRequest)
        .send(ServerResponse.errormsg("Invalid order"));
    }

    // ─── MID VALIDATION ───────────────────────────────────
    const midDetails = await merchantOrderModel.selectOne(
      "MID,password,psp_id,primary_key",
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
      logger.error("PSP credentials missing", { psp });
      return res
        .status(statusCode.internalError)
        .send(ServerResponse.errormsg("Configuration error"));
    }

    // ─── AUTH TOKEN ───────────────────────────────────────
    const basicAuthToken = await helpers.createBasicAuthToken(
      midDetails.MID,
      midDetails.password
    );

    const baseUrl =
      mode === "live"
        ? credentials[psp].base_url
        : credentials[psp].test_url;

    // ─── FETCH ACCESS TOKEN ───────────────────────────────
    const tokenResponse = await axios.post(
      `${baseUrl}collection/token/`,
      {},
      {
        headers: {
          Authorization: basicAuthToken,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": midDetails.primary_key
        },
        timeout: 10000
      }
    );

    const token = tokenResponse?.data?.access_token;

    if (!token) {
      logger.error("Token not received from PSP", { psp });
      return res
        .status(statusCode.badGateway)
        .send(ServerResponse.errormsg("PSP authentication failed"));
    }

    // ─── VERIFY MSISDN ────────────────────────────────────
    const verifyResponse = await axios.get(
      `${baseUrl}collection/v1_0/accountholder/msisdn/${country}${mobile}/basicuserinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": midDetails.primary_key,
          "X-Target-Environment": mode === "test" ? "sandbox" : "mtnliberia"
        },
        timeout: 10000
      }
    );

    return res.status(statusCode.ok).send({
      data: verifyResponse.data,
      status: "success"
    });

  } catch (error) {
    logger.error("MTN verify failed", {
      message: error.message,
      stack: error.stack
    });

    return res
      .status(statusCode.ok)
      .send(ServerResponse.errorMsgWithData("Unable to verify", []));
  }
};

module.exports = Verify;
