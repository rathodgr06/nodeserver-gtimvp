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
const logger = require('../../config/logger');
const Verify = async (req, res) => {
  const order_id = req.body.order_id;
  const mode = req.body.mode;
  let psp = req.bodyString('psp');
  let order_table = mode == "live" ? "orders" : "test_orders";
  let mobile = req.bodyString("mobile_no");
  let country = req.bodyString("country");
  let mno = req.bodyString('mno');
  const psp_details = await merchantOrderModel.selectOne(
    "id,name",
    {
      credentials_key: psp,
      deleted:0
    },
    "psp"
  );
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
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,terminal_id,statementDescriptor,shortenedDescriptor,primary_key",
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
  const basicAuthToken = await helpers.createBasicAuthToken(username, password);
  try {
    
    let url = mode == "live" ? credentials[psp].base_url : credentials[psp].test_url;
    const config1 = {
      method: "post",
      url: url + `Authentication/Login`,
      headers: {
        // Authorization: basicAuthToken,
        "Content-Type": "application/json",
      },
      data:{
        username:username,
        password:password
      }
    };
    const response = await axios(config1);
    const token = response.data.token;
    let config = {
      method: "post",
      url: `${url}NameEnquiry/NameEnquiryService`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data:{
        "accountNumber":`${country}${mobile}`,
        "channel":"MNO",
        "institutionCode":helpers.getCodeByName(mno),
        "transactionId":uuidv4()
      }
    };
    console.log(`config we are sending to verify alpay`);
    console.log(JSON.stringify(config));
    const final_response = await axios(config);
    console.log(`the response is here`);
    console.log(JSON.stringify(final_response.data));
    let verification_data = {
      name:final_response.data.data.accountName,
      transaction_id:final_response.data.data.transactionId,
      account_number:final_response.data.data.accountNumber
    }
    return res.json({
      data: verification_data,
      status: "success",
    });
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
    return res.status(statusCode.ok).send(Server_response.errorMsgWithData('Unable to verify', []));
  } 
};

module.exports = Verify;
