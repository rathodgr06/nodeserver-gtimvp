const axios = require("axios");
const credentials = require("../config/credientials");
const helpers = require("../utilities/helper/general_helper");
const { v4: uuidv4 } = require("uuid");
const logger = require('../config/logger');

const mtnService = {
  token: async (username, password, mode) => {
    try {
      let url =
        mode == "live"
          ? credentials["alpay"].base_url
          : credentials["alpay"].test_url;
      const config1 = {
        method: "post",
        url: url + `Authentication/Login`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          username: username,
          password: password,
        },
      };
      const response = await axios(config1);
      const token = response.data.token;
      return token;
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
        console.log(error);
      return false;
    }
  },
  verify: async (data,token,mode) => {
    try {
      let url =
        mode == "live"
          ? credentials["alpay"].base_url
          : credentials["alpay"].test_url;
      let config = {
        method: "post",
        url: `${url}NameEnquiry/NameEnquiryService`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: {
          accountNumber: `${data.paymentMethod.wallet_details.mobileCode}${data.paymentMethod.wallet_details.msisdn}`,
          channel: "MNO",
          institutionCode: helpers.getCodeByName(
            data.paymentMethod.wallet_details.walletType
          ),
          transactionId: uuidv4(),
        },
      };
      console.log(`config we are sending to verify alpay`);
      console.log(JSON.stringify(config));
      const final_response = await axios(config);
      console.log(`the response is here`);
      console.log(JSON.stringify(final_response.data));
      let verification_data = {
        name: final_response.data.data.accountName,
        transaction_id: final_response.data.data.transactionId,
        account_number: final_response.data.data.accountNumber,
      };
      return verification_data;
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      return false;
    }

  },
  pay: async (verification_data,order_details, data, mode, token,debitNarration) => {
    try{
          let url =
        mode == "live"
          ? credentials["alpay"].base_url
          : credentials["alpay"].test_url;
         let x_ref_id = uuidv4();
         let payload = {
           accountName: verification_data.name,
           accountNumber:verification_data.account_number,
           amount: order_details.amount,
           channel: "MNO",
           institutionCode: helpers.getCodeByName(
            data.paymentMethod.wallet_details.walletType
          ),
           currency: order_details.currency,
           transactionId: x_ref_id,
           debitNarration:debitNarration,
         };
         let headers = {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         };
         let formData = JSON.stringify(payload);
         let config = {
           method: "post",
           url: `${url}DebitMoney/DebitMoneyService`,
           headers: headers,
           data: formData,
         };
         const final_response = await axios(config);
         return final_response;

    }catch(error){
      logger.error(400,{message: error,stack: error?.stack});
        console.log(error);
        return false;
    }
  },
  confirm: async (token, data_set, primary_key, username, password, mode) => {},
};
module.exports = mtnService;