const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const orderModel = require('../models/merchantOrder');
const helper = require('../utilities/helper/general_helper');
const credentials = require('../config/credientials');
const axios = require('axios');
const { orderDetails } = require("./ni");
const moment = require('moment');
const winston = require('../utilities/logmanager/winston');

let DapiController = {
    login: async (req, res) => {
        try {
            let order_id = req.body.order_id;
            let order_table = req.body.mode == 'test' ? 'test_orders' : 'orders';
            let order_details = await orderModel.selectDynamicONE('*', { order_id: order_id }, order_table);
            let currency_id = await helper.get_currency_id_by_name(order_details.currency);
            let Dapi_credentials = await orderModel.selectDynamicONE('*', { psp_id: 4, submerchant_id: order_details.merchant_id, currency_id: currency_id }, 'mid');

          let redirect_url = {
            success: '',
            failure: '',
            cancel: ''
          }
          let order_urls = {
            success: order_details.success_url,
            failure: order_details.failure_url,
            cancel: order_details.cancel_url
          }

          if (order_urls.success != '' && order_urls.success != null && order_urls.success != 'undefined') {
            redirect_url.success = order_urls.success
          } else if (Dapi_credentials?.success_url != '' && Dapi_credentials?.success_url != null && Dapi_credentials?.success_url != 'undefined') {
            redirect_url.success = Dapi_credentials?.success_url
          } else {
            redirect_url.success = process.env.DEFAULT_SUCCESS_URL
          }
          if (order_urls.failure != '' && order_urls.failure != null && order_urls.failure != 'undefined') {
            redirect_url.failure = order_urls.failure
          } else if (Dapi_credentials?.failure_url != '' && Dapi_credentials?.failure_url != null && Dapi_credentials?.failure_url != 'undefined') {
            redirect_url.failure = Dapi_credentials?.failure_url
          } else {
            redirect_url.failure = process.env.DEFAULT_FAILED_URL
          }
          if (order_urls.cancel != '' && order_urls.cancel != null && order_urls.cancel != 'undefined') {
            redirect_url.cancel = order_urls.cancel
          } else if (Dapi_credentials?.cancel_url != '' && Dapi_credentials?.cancel_url != null && Dapi_credentials?.cancel_url != 'undefined') {
            redirect_url.cancel = Dapi_credentials?.cancel_url
          } else {
            redirect_url.cancel = process.env.DEFAULT_CANCEL_URL
          }

          let UpdateOrderData={
            terminal_id: Dapi_credentials.terminal_id,
            success_url: redirect_url.success,
            cancel_url: redirect_url.cancel,
            failure_url: redirect_url.failure
          }

          await orderModel.updateDynamic(UpdateOrderData, { order_id: order_id }, order_table);
            let result = await loginToDappi({ appSecret: Dapi_credentials.password, accessCode: req.body.accessCode, connectionID: req.body.connectionID });
            if (!result) {
                res.status(statusCode.ok).send(response.errormsg('Unable to fetch accounts'));
            } else {
                let accountResult = await getAccounts({ appSecret: Dapi_credentials.password, userSecret: req.body.userSecret, operationID: req.body.operationID, userInputs: req.body.userInputs }, result.accessToken);
                if (accountResult && accountResult.hasOwnProperty('accounts')) {
                    let tempAccount = [];
                    for (let account of accountResult.accounts) {
                        let temp = account;
                        temp.number = 'XXXX-' + temp.number.substr(temp.number.length - 4);
                        temp.balance = await getAccountBalance({ appSecret: Dapi_credentials.password, userSecret: req.body.userSecret, accountID: account.id }, result.accessToken)
                        tempAccount.push(temp);
                    }
                    delete accountResult.accounts;
                    accountResult.accounts = tempAccount;
                    accountResult.access_token = result.accessToken
                    res.status(statusCode.ok).send(response.successdatamsg(accountResult));
                } else if (accountResult && accountResult.hasOwnProperty('userInputs')) {
                    accountResult.access_token = result.accessToken
                    res.status(statusCode.ok).send(response.successdatamsg(accountResult));
                } else {
                    res.status(statusCode.ok).send(response.errormsg('Unable to fetch accounts'));
                }
            }
        } catch (error) {
            winston.error(error);
            console.log(error);
            res.status(statusCode.ok).send(response.errormsg('Unable to fetch accounts'));
        }

    },
  transfer: async (req, res) => {
    try {
      let order_id = req.body.order_id;
      let order_table = req.body.mode == 'test' ? 'test_orders' : 'orders';
      let order_details = await orderModel.selectDynamicONE('*', { order_id: order_id }, order_table);
      let currency_id = await helper.get_currency_id_by_name(order_details.currency);
      let beneficiary_details = await orderModel.selectDynamicONE('iban,bank_name,ifsc,bic_swift,branch_name,bank_account_no,country as country_id', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
      let Dapi_credentials = await orderModel.selectDynamicONE('*', { psp_id: 4, submerchant_id: order_details.merchant_id, currency_id: currency_id }, 'mid');
      let country_details = await orderModel.selectDynamicONE('iso2', { id: beneficiary_details.country_id }, 'country');
      let userInput
        if (req.body.userInputs && req.body.userInputs[0]) {
            userInput = req.body.userInputs;

            for (let i = 0; i < userInput.length; i++) {
                userInput[i].index = Number(userInput[i].index);
            }
        }
      let transferPayload = {
        appSecret: Dapi_credentials.password,
        userSecret: req.body.userSecret,
        senderID: req.body.senderId,
        amount: order_details.amount,
        beneficiary: {
          name: beneficiary_details.bank_name,
          accountNumber: beneficiary_details.bank_account_no,
          iban: beneficiary_details.iban,
          swiftCode: beneficiary_details.bic_swift,
          type: "",
          address: {
            line1: "",
            line2: "",
            line3: ""
          },
         country: country_details?.iso2 || "AE",
          branchAddress: "",
          branchName: beneficiary_details.branch_name
        },
        operationID:req.body.operationID,
        hlAPIStep:req.body.hlAPIStep
      }
        if (userInput)
        transferPayload.userInputs = userInput;

      let result = await transferAmount(transferPayload, req.body.accessToken);
      console.log(result);
      if(result && result.hasOwnProperty('reference')){
        let txn = await updateOrderAndTxn(req.body,result,order_details);
        let responseObj = await getResponseToSend(txn,req.body,result,order_details);
        res.status(statusCode.ok).send(response.successdatamsg(responseObj));
      }else if (result && result.hasOwnProperty('userInputs')) {
        res.status(statusCode.ok).send(response.successdatamsg(result));
      } else {
        res.status(statusCode.ok).send(response.errormsg('Unable to initiate transfer'));
      }
      
    } catch (error) {
      winston.error(error);
      console.log(error);
      res.status(statusCode.ok).send(response.errormsg('Unable to initiate transfer'));
    }


  },
  getAccounts: async (req, res) => {
    try {
      let order_id = req.body.order_id;
      let order_table = req.body.mode == 'test' ? 'test_orders' : 'orders';
      let order_details = await orderModel.selectDynamicONE('*', { order_id: order_id }, order_table);
      let currency_id = await helper.get_currency_id_by_name(order_details.currency);
      let Dapi_credentials = await orderModel.selectDynamicONE('*', { psp_id: 4, submerchant_id: order_details.merchant_id, currency_id: currency_id }, 'mid');
        let accountResult = await getAccounts({ appSecret: Dapi_credentials.password, userSecret: req.body.userSecret,operationID:req.body.operationID,userInputs:req.body.userInputs }, req.body.accessToken);
        
        if (accountResult && accountResult.hasOwnProperty('accounts')) {
          let tempAccount = [];
          for (let account of accountResult.accounts) {
            let temp = account;
            temp.number = 'XXXX-' + temp.number.substr(temp.number.length - 4);
            temp.balance = await getAccountBalance({ appSecret: Dapi_credentials.password, userSecret: req.body.userSecret, accountID: account.id }, req.body.accessToken)
            tempAccount.push(temp);
          }
          delete accountResult.accounts;
          accountResult.accounts = tempAccount;
          res.status(statusCode.ok).send(response.successdatamsg(accountResult));
        } else if (accountResult && accountResult.hasOwnProperty('userInputs')) {
          res.status(statusCode.ok).send(response.successdatamsg(accountResult));
        } else {
          res.status(statusCode.ok).send(response.errormsg('Unable to fetch accounts'));
        }
    } catch (error) {
      winston.error(error);
      console.log(error);
      res.status(statusCode.ok).send(response.errormsg('Unable to fetch accounts'));
    }

  },
}
async function loginToDappi(data) {
  let base_url = credentials.dapi.base_url;
  let config = {
    method: "post",
    url: base_url + 'auth/ExchangeToken',
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };
  try {
    let result = await axios(config);
    return result.data;
  } catch (error) {
    winston.error(error);
    console.log(error);
    return false;
  }
}
async function getAccounts(data, access_token) {
  let base_url = credentials.dapi.base_url;
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: base_url + 'data/accounts/get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    data: data
  };
  try {
    let result = await axios(config);
    return result.data;
  } catch (error) {
    winston.error(error);
    console.log(error);
    return false;
  }

}
async function getAccountBalance(data, access_token) {
  let base_url = credentials.dapi.base_url;
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: base_url + 'data/balance/get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    data: data
  };
  try {
    let result = await axios(config);
    return result.data.balance.amount;
  } catch (error) {
    winston.error(error);
    console.log(error);
    return false;
  }

}
async function transferAmount(data, access_token) {
  let base_url = credentials.dapi.base_url;
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: base_url + 'payment/transfer/autoflow',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    data: data
  };
  try {
    let result = await axios(config);
    return result.data;
  } catch (error) {
    winston.error(error);
    console.log(error);
    return false;
  }
}
async function updateOrderAndTxn(requestData,paymentResponse,orderDetails){
  let orderUpdate = {
    status:"CAPTURED",
    psp:"DAPI",
    payment_id:paymentResponse.reference,
    scheme:requestData.bank_name,
    pan:requestData.mask_account_no,
    payment_mode: "BANK TRANSFER",
    bt_iban: requestData.iban,
    bt_id: requestData.senderId,
    bt_name: requestData.user_name,
    bt_type: requestData.type,
    bt_number: requestData.mask_account_no
    
  }
  const txn = await orderModel.genratetxn();
  
  let order_txn = {
    status: "AUTHORISED",
    psp_code: "00",
    paydart_category: 'SUCCESS',
    remark: '',
    txn: txn,
    type:"CAPTURE",
    payment_id: paymentResponse.reference,
    order_id: orderDetails.order_id,
    amount: orderDetails.amount,
    currency: orderDetails.currency,
    created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
  };
  let orderTable = requestData.mode=='test'?"test_orders":"orders";
  let txnTable = requestData.mode=='test'?'test_order_txn':"order_txn";
  await orderModel.updateDynamic(orderUpdate,{order_id:orderDetails.order_id},orderTable);
  await orderModel.addDynamic(order_txn,txnTable);
  return txn;
}
async function getResponseToSend(txn,requestData,paymentResponse){
  let orderDetails = await orderModel.selectDynamicONE('*',{order_id:requestData.order_id},requestData.mode=='test'?'test_orders':"orders");
  let new_res = {
    m_order_id: orderDetails.merchant_order_id
      ? orderDetails.merchant_order_id
      : "",
    p_order_id: orderDetails.order_id ? orderDetails.order_id : "",
    psp_ref_id: paymentResponse.reference ? paymentResponse.paymentResponse : "",
    transaction_id: txn,
    status: "SUCCESS",
    status_code: "00",
    currency: orderDetails.currency,
    return_url: orderDetails.success_url,
    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
    amount: orderDetails.amount.toFixed(2),
    m_customer_id: orderDetails.merchant_customer_id
      ? orderDetails.merchant_customer_id
      : "",
    psp:orderDetails.psp,
    payment_method: orderDetails.payment_mode,
    payment_method_data: {
      bank_name: orderDetails.scheme,
      account_number: orderDetails.pan,
    },
    apm_name: "",
    apm_identifier: "",
  };

  let resObj = {
    order_status: orderDetails.status,
    payment_id: orderDetails?.payment_id,
    order_id: orderDetails?.order_id,
    amount: Number(orderDetails?.amount).toFixed(2),
    currency: orderDetails?.currency,
    return_url: orderDetails?.return_url,
    token: "",
    new_res: new_res,
  };
  return resObj;
}
module.exports = DapiController;