require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
var axios = require("axios");
const order_logs = require("../models/order_logs");
const moment = require("moment");
const winston = require('../utilities/logmanager/winston');

let outlet = '';

const createToken = async (_terminalcred) =>  {
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
                winston.error(error);
                reject(error.message);
            });
    });
};


var ni = {
  
    orderSale: async (req,_terminalcred) => {
        const resp = await createToken(_terminalcred).catch(errors=>{
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
                        value: req?.value * 100,
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

  
    orderCancel: async (req, _terminalcred) => {
        
        
        const resp = await createToken(_terminalcred);
        
        var support_config = {
            method: "DELETE",
            url: `${ni_credentials.base_url}/transactions/outlets/${ni_credentials.outlet}/orders/${req.orderNo}/payments/${req.payment_id}/captures/${req.capture_no}`,
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
    orderRefund: async (req,_terminalcred) => {
        const resp = await createToken(_terminalcred);
        
        var support_config = {
            method: "POST",
            url: `${ni_credentials.base_url}/transactions/outlets/${_terminalcred.MID}/orders/${req.orderNo}/payments/${req.payment_id}/captures/${req.capture_no}/refund`,
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
            url: `${ni_credentials.base_url}/transactions/outlets/${_terminalcred.MID}/orders/${req.order_no}/payments/${req.payment_no}/captures`,
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
            url: `${ni_credentials.base_url}/transactions/outlets/${_terminalcred.MID}/orders/${req.orderNo}/payments/${req.payment_id}/cancel`,
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
 
};

module.exports = ni;
