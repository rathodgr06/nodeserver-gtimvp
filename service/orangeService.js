const axios = require("axios");
const credentials = require("../config/credientials");
const helpers = require("../utilities/helper/general_helper");
const { v4: uuidv4 } = require("uuid");
const https = require('https');
const orangeService = {
    pay:async(order_details,data,mid_details,mode)=>{
        try {
           let url = mode == "live" ? credentials['orange-money'].base_url : credentials['orange-money'].test_url;
           let x_ref_id = uuidv4();
              let payload = {
              "auth": {
                  "user": mid_details?.MID,
                  "pwd": mid_details?.password
              },
              "param": {
                //   "msisdn":`${data.paymentMethod.wallet_details.mobileCode}${data.paymentMethod.wallet_details.msisdn}`,
                  "msisdn":`${data.paymentMethod.wallet_details.msisdn}`,
                  "Amount": order_details.amount,
                  "Currency": order_details.currency,
                  "ExternalID": order_details.order_id
              },
              "callback": {
                  "url": process.env.STATIC_URL+"/api/v1/mobile-payment/update-status"
              }
              }
             const agent = new https.Agent({
            rejectUnauthorized: false  // ⚠️ Ignore SSL cert errors (only use in dev)
          });
              let formData = JSON.stringify(payload);
              let config = {
                method: "post",
                url: `${url}Subscriber/Billers/OM/PayStart`,
                headers: {
              "Content-Type": "application/json"
            },
            httpsAgent: agent,
                data: formData,
              };
         const final_response = await axios(config);
         console.log(`logging final response in orange money service`)
         console.log(final_response.data);
         return final_response;
        } catch (error) {
         return false;
        }
    },
    confirm:async(token,data_set,primary_key,username,password,mode)=>{
        
    }

}
module.exports = orangeService;