const axios = require("axios");
const credentials = require("../config/credientials");
const helpers = require("../utilities/helper/general_helper");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const dccService = {
    fetchRate:async(mode,order_id,mid_currency,currency,amount)=>{
        try {
        const payload = {
          order_id: order_id,
          mode: mode,
          currency: currency,
          mid_currency: mid_currency,
          amount: amount,
        };
        console.log(`payload is here`);
        console.log(payload);
         const method = "POST";
         const urlPath = "/api/v1/fetch-rate";
         const timestamp = Math.floor(Date.now() / 1000).toString();
         const bodyString = JSON.stringify(payload);
         const signature = generateHmacSignature(method, urlPath, bodyString, timestamp);

        const response = await axios.post(process.env.DCC_SERVER+urlPath, payload, {
          headers: {
            "Content-Type": "application/json",
            "x-hmac-signature": signature,
            "x-timestamp": timestamp,
          },
        });
        return response.data;
        } catch (error) {
          console.log(error);
          return false;
        }
    },
}
function generateHmacSignature(method, urlPath, body, timestamp) {
  const secretKey = process.env.DCC_SECRET; //
  const message = `${method}${urlPath}${body}${timestamp}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("hex");
}

module.exports = dccService;
