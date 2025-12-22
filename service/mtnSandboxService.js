const axios = require("axios");
const credentials = require("../config/credientials");
const helpers = require("../utilities/helper/general_helper");
const { v4: uuidv4 } = require("uuid");
const logger = require('../config/logger');

const mtnService = {
    token:async(primary_key,username,password,mode)=>{
        try {
          const basicAuthToken = await helpers.createBasicAuthToken(
            username,
            password
          );
          let url =
            mode == "live"
              ? credentials["mtn"].base_url
              : credentials["mtn"].test_url;
          const config = {
            method: "post",
            url: url + `momo-sandbox/token/`,
            headers: {
              Authorization: basicAuthToken,
              "Content-Type": "application/json",
              "Ocp-Apim-Subscription-Key": primary_key,
            },
          };
          const response = await axios(config);
          const token = response.data.access_token;
          return token;
        } catch (error) {
          console.log(error);
          logger.error(400,{message: error,stack: error?.stack});
          return false;
        }
    },
    pay:async(order_details,data,mid_details,mode,token)=>{
        try {
          let url =
            mode == "live"
              ? credentials["mtn"].base_url
              : credentials["mtn"].test_url;
          let x_ref_id = uuidv4();
          let payload = {
            amount: order_details.amount,
            currency: order_details.currency,
            externalId: order_details.order_id,
            payer: {
              partyIdType: "MSISDN",
              partyId: `${data.paymentMethod.wallet_details.mobileCode}${data.paymentMethod.wallet_details.msisdn}`,
            },
            payerMessage: mid_details.statementDescriptor,
            payeeNote: mid_details.shortenedDescriptor,
          };
          let headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": mid_details.primary_key,
            "X-Target-Environment": mode == "test" ? "sandbox" : "mtnliberia",
            "X-Reference-Id": x_ref_id,
          };
          let formData = JSON.stringify(payload);
          let config = {
            method: "post",
            url: `${url}momo-sandbox/v1_0/requesttopay`,
            headers: headers,
            data: formData,
          };
          const final_response = await axios(config);
          return x_ref_id;
        } catch (error) {
          logger.error(400,{message: error,stack: error?.stack});
            console.log(error);
          return false;
        }
    },
    confirm:async(token,data_set,primary_key,username,password,mode)=>{
        
    }

}
module.exports = mtnService;