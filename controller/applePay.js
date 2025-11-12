require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
var axios = require("axios");
const order_logs = require("../models/order_logs");
const moment = require("moment");
const winston = require("../utilities/logmanager/winston");

const createToken = async (_terminalcred) => {
  var support_config = {
    method: "POST",
    url: `https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token`,
    headers: {
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Authorization: `Basic OGQ5OWE5MjQtMzA5Ni00YzhmLTg2YjYtNDRiMzhhNzE2ZWE1OmYzZWFmMjc3LWY0OTgtNDZjYi1iMzY2LTJjZmE1Yjg0YWU2ZQ==`,
    },
  };
  return new Promise((resolve, reject) => {
    axios(support_config)
      .then(function (result) {
        resolve(result.data);
      })
      .catch(function (error) {
        winston.error(error);
        reject(error.message);
      });
  });
};

var applePay = {
  orderSale: async (ni_sale_req, _terminalcred) => {
    const resp = await createToken().catch((errors) => {
      // return resp
    });
    var support_config = {
      method: "POST",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp?.access_token}`,
      },
      data: ni_sale_req,
    };

    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(async (result) => {
          resolve(result.data);
        })
        .catch(async (error) => {
          winston.error(error);
          reject(error);
        });
    });
  },

  checkout: async (orderReference, reference, apple_token) => {
    const resp = await createToken().catch((errors) => {
      // return resp
    });
    var support_config = {
      method: "PUT",
      url: `https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/256c04c4-2da4-404a-8ac3-8f1e5563d19f/orders/${orderReference}/payments/${reference}/apple-pay`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp?.access_token}`,
      },
      data: apple_token,
    };

    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(async (result) => {
          resolve(result.data);
        })
        .catch(async (error) => {
          winston.error(error);
          reject(error);
        });
    });
  },
};

module.exports = applePay;
