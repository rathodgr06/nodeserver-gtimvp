require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
var axios = require("axios");
const order_logs = require("../models/order_logs");
const moment = require("moment");
const winston = require('../utilities/logmanager/winston');


let outlet = "";
const createToken = async (_terminalcred) => {
  
  var support_config = {
    method: "POST",
    url: `${_terminalcred.baseurl}/identity/auth/access-token`,
    headers: {
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Authorization: `Basic ${_terminalcred.password}`,
    },
  };
  
  return new Promise((resolve, reject) => {
    axios(support_config)
      .then(function (result) {
        resolve(result.data);
      })
      .catch(function (error) {
        reject(error);
      });
  });
};

var ni = {

  orderSale: async (req, _terminalcred) => {
    const resp = await createToken(_terminalcred).catch((errors) => {
      // return resp
      winston.error(errors);
    });
    var support_config = {
      method: "POST",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/payment/card`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp?.access_token}`,
      },
      data: {
        merchantOrderReference: `ODR_${req.order_id}`,
        order: {
          // action: "SALE",
          action: req?.action?.action,
          amount: {
            currencyCode: req?.currency,
            value: (req?.value * 100).toFixed(0),
          },
        },
        payment: {
          pan: req.card_no,
          expiry: req.expiry_date,
          cvv: req.cvv,
          cardholderName: req.cardholderName,
        },
      },
    };
    console.log(`support config data is here`);
    console.log(support_config.data);

    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(async (result) => {
          resolve(result.data);
        })
        .catch(async (error) => {
          console.log(error);
          winston.error(error);
          reject(error);
        });
    });
  },

  orderCancel: async (req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    var support_config = {
      method: "DELETE",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${req.orderNo}/payments/${req.payment_id}/captures/${req.capture_no}`,
      //url: `${ni_credentials.base_url}/transactions/outlets/${ni_credentials.outlet}/orders/${req.orderNo}`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
    };
    console.log(`SUPPORT CONFIG`);
    console.log(support_config);
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          resolve(result.data);
        })
        .catch(function (error) {
          reject(error);
        });
    });
  },
  orderRefund: async (req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    
    var support_config = {
      method: "POST",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${req.orderNo}/payments/${req.payment_id}/captures/${req.capture_no}/refund`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
      data: {
        amount: {
          currencyCode: req.currency,
          value: parseFloat(req.amount) * 100,
        },
      },
    };
    
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          resolve(result.data);
        })
        .catch(function (error) {
          winston.error(error);
          reject(error);
        });
    });
  },

  orderCapture: async (req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    
    var support_config = {
      method: "POST",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${req.order_no}/payments/${req.payment_no}/captures`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
      data: {
        amount: {
          currencyCode: req.currency,
          value: parseFloat(req.amount) * 100,
        },
      },
    };
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          resolve(result.data);
        })
        .catch(function (error) {
          winston.error(error);
          reject(error);
        });
    });
  },
  authCancel: async (req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    var support_config = {
      method: "PUT",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${req.orderNo}/payments/${req.payment_id}/cancel`,
      //url: `${ni_credentials.base_url}/transactions/outlets/${ni_credentials.outlet}/orders/${req.orderNo}`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
    };
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          
          
          resolve(result.data);
        })
        .catch(function (error) {
          winston.error(error);
          reject(error);
        });
    });
  },
  get_3ds2_details: async (url, req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    
    var support_config = {
      method: "POST",
      url: url,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
      data: req,
    };
    console.log(`support config is here`);
    console.log(support_config);
   return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          console.log("get_3ds2_details");
          console.log(result.data);
          resolve(result.data);
        })
        .catch(function (error) {
          winston.error(error);
          reject(error);
        });
    }); 
  },
  update3ds2_challenge: async (url, req, _terminalcred) => {
    const resp = await createToken(_terminalcred);
    
    var support_config = {
      method: "POST",
      url: url,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
      data: req,
    };
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          
          resolve(result.data);
        })
        .catch(function (error) {
          console.log(error);
          winston.error(error);
          reject(error);
        });
    });
  },
  updatePayment:async(url,req,_terminalcred)=>{
    _terminalcred.baseurl=url;
    const resp = await createToken(_terminalcred);
    
    var support_config = {
      method: "POST",
      url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${req.order_reference_no}/payments/${req.payment_no}/card/3ds`,
      headers: {
        accept: "application/vnd.ni-payment.v2+json",
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Authorization: `Bearer ${resp.access_token}`,
      },
      data: {
        PaRes:req.PaRes
      },
    };
    return new Promise((resolve, reject) => {
      axios(support_config)
        .then(function (result) {
          resolve(result.data);
        })
        .catch(function (error) {
          winston.error(error);
          reject(error);
        });
    });
  },
  recurringCaptureOrderCreate:async(_terminalcred,req)=>{
   let resp = await createToken(_terminalcred);
    // if(resp.status != 200){
    //   return resp
    // }

   var support_config = {
    method: "POST",
    url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders`,
    headers: {
      accept: "application/vnd.ni-payment.v2+json",
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Authorization: `Bearer ${resp.access_token}`,
    },
    data: req,
  };
  return new Promise((resolve, reject) => {
    axios(support_config)
      .then(function (result) {
        resolve(result.data);
      })
      .catch(function (error) {
        winston.error(error);
        reject(error);
      });
  });

  },
  captureRecurring:async(_terminalcred,order_ref_no,payment_no,req)=>{
   let resp = await createToken(_terminalcred);
   var support_config = {
    method: "PUT",
    url: `${_terminalcred.baseurl}/transactions/outlets/${_terminalcred.MID}/orders/${order_ref_no}/payments/${payment_no}/saved-card`,
    headers: {
      accept: "application/vnd.ni-payment.v2+json",
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Authorization: `Bearer ${resp.access_token}`,
    },
    data: req,
  };

  console.log(support_config,"support_config")
  return new Promise((resolve, reject) => {
    axios(support_config)
      .then(function (result) {
        resolve(result.data);
      })
      .catch(function (error) {
        //console.log(error)
        winston.error(error);
        reject(error);
      });
  });

  },
};

module.exports = ni;
