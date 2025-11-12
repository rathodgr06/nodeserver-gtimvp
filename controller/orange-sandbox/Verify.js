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
const https = require('https');
const Verify = async (req, res) => {
  const order_id = req.body.order_id;
  const mode = req.body.mode;
  let psp = req.bodyString('psp');
  let order_table = mode == "live" ? "orders" : "test_orders";
  let mobile = req.bodyString("mobile_no");
  let country = req.bodyString("country");
  const psp_details = await merchantOrderModel.selectOne(
    "id,name",
    {
      credentials_key: psp,
      deleted:0
    },
    "psp"
  );
  console.log(`here is psp detials`);
  console.log(psp_details);
  if (!psp_details) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Psp Available"));
  }
  // fetch order details
  const order_details = await merchantOrderModel.selectOne(
    "merchant_id",
    {
      order_id: order_id,
    },
    order_table
  );
  // fetch mid details 
  const mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,terminal_id,statementDescriptor,shortenedDescriptor",
    {
      psp_id: psp_details.id,
      submerchant_id: order_details.merchant_id,
      deleted:0,
      env:mode
    },
    "mid"
  );
  if (!mid_details) {
    res
      .status(statusCode.badRequest)
      .send(Server_response.errormsg("No Terminal Available"));
  }
  const username = mid_details.MID;
  const password = mid_details.password;
  // const basicAuthToken = await helpers.createBasicAuthToken(username, password);
  try {
    console.log(psp)
    console.log(credentials['orange-money']);
     const agent = new https.Agent({
      rejectUnauthorized: false  // ⚠️ Ignore SSL cert errors (only use in dev)
    });
     let url = mode == "live" ? credentials['orange'].base_url : credentials['orange'].test_url;

   const config1 = {
     method: "get",
     url: url + `orange/CRM/Subscriber/Detail/Identification`,
     headers: {
       "Content-Type": "application/json",
     },
     httpsAgent: agent,
     params: {
       // ✅ use params instead of body
       auth: JSON.stringify({
         user: username,
         pwd: password,
       }),
       param: JSON.stringify({
         msisdn: req.bodyString("mobile_no"),
       }),
     },
   };
   const response = await axios(config1);
    console.log(`the response is here`);
    console.log(JSON.stringify(response.data));
    return res.json({
      data: response.data,
      status: "success",
    });
  } catch (error) {
    console.log(error);
    return res.status(statusCode.ok).send(Server_response.errorMsgWithData('Unable to verify', []));
  } 
};

module.exports = Verify;
