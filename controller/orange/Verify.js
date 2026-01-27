const axios = require("axios");
const credentials = require("../../config/credientials");
const helpers = require("../../utilities/helper/general_helper");
const merchantOrderModel = require("../../models/merchantOrder");
const statusCode = require("../../utilities/statuscode");
const Server_response = require("../../utilities/response/ServerResponse");
const https = require("https");
const logger = require("../../config/logger");

const Verify = async (req, res) => {
  try {
    /* ───── SAFE INPUTS ───── */
    const order_id = req?.body?.order_id;
    const mode = req?.body?.mode;
    const psp = req?.bodyString?.("psp");
    const mobile = req?.bodyString?.("mobile_no");
    const country = req?.bodyString?.("country");

    if (!order_id || !mode || !psp || !mobile) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("Missing required parameters"));
    }

    const order_table = mode === "live" ? "orders" : "test_orders";

    /* ───── FETCH PSP ───── */
    const psp_details = await merchantOrderModel.selectOne(
      "id,name",
      { credentials_key: psp, deleted: 0 },
      "psp"
    );

    if (!psp_details) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("No PSP Available"));
    }

    /* ───── FETCH ORDER ───── */
    const order_details = await merchantOrderModel.selectOne(
      "merchant_id",
      { order_id },
      order_table
    );

    if (!order_details) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("Invalid order"));
    }

    /* ───── FETCH MID ───── */
    const mid_details = await merchantOrderModel.selectOne(
      "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,terminal_id,statementDescriptor,shortenedDescriptor",
      {
        psp_id: psp_details.id,
        submerchant_id: order_details.merchant_id,
        deleted: 0,
        env: mode
      },
      "mid"
    );

    if (!mid_details) {
      return res
        .status(statusCode.badRequest)
        .send(Server_response.errormsg("No Terminal Available"));
    }

    /* ───── BASIC AUTH ───── */
    const username = mid_details.MID;
    const password = mid_details.password;
    const basicAuthToken = await helpers.createBasicAuthToken(username, password);

    /* ───── HTTPS AGENT (DEV ONLY) ───── */
    const agent =
      process.env.NODE_ENV === "production"
        ? undefined
        : new https.Agent({ rejectUnauthorized: false });

    /* ───── PSP CONFIG ───── */
    if (!credentials?.[psp]) {
      logger.error("PSP credentials missing", { psp });
      return res
        .status(statusCode.internalError)
        .send(Server_response.errormsg("Configuration error"));
    }

    const baseUrl =
      mode === "live"
        ? credentials[psp].base_url
        : credentials[psp].test_url;

    /* ───── AXIOS CONFIG (FIXED: data instead of body) ───── */
    const config1 = {
      method: "post",
      url: `${baseUrl}Subscriber/Detail/Identification`,
      headers: {
        "Content-Type": "application/json"
      },
      httpsAgent: agent,
      data: {
        auth: {
          user: username,
          pwd: password
        },
        param: {
          msisdn: mobile
        }
      },
      timeout: 10000
    };

    const response = await axios(config1);

    return res.status(statusCode.ok).send({
      data: response.data,
      status: "success"
    });

  } catch (error) {
    logger.error("Orange verify failed", {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data
    });

    return res
      .status(statusCode.ok)
      .send(
        Server_response.errorMsgWithData("Unable to verify", [])
      );
  }
};

module.exports = Verify;
