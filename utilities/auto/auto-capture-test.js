const path = require('path');
const dotenv = require('dotenv');
const Model = require('./model');
const moment = require('moment');
const merchantOrderModel = require('../../models/merchantOrder')
const orderTransactionModel = require("../../models/order_transaction");
const helpers = require('../helper/general_helper');
const axios = require('axios')
const xml2js = require('xml2js')
let psp_url_credentials = require('../../config/credientials')
var isd = 1;
var isd2 = 1;
async function captureTelr(transactionToCaptureTelr1) {
    let captureResponse = [];
    //for (let trans1 of transactionToCaptureTelr1) {
    for (let i=0; i<transactionToCaptureTelr1.length; i++) {
        let trans1 = transactionToCaptureTelr1[i];
        console.log("🚀 ~ trans1:", trans1)
        let temp2 = await SendToTelr(trans1);
        console.log("🚀 ~ temp2:", temp2)
        temp2.order_id = trans1.order_id;
        temp2.currency = trans1.currency;
        temp2.amount = trans1.amount;
        let update_resp = await updateTelr(temp2);
        captureResponse.push([]);
        console.log("close telr")
    }
    return captureResponse;
}


async function captureNI(transactionToCaptureTelr2) {
    let captureResponse = [];
    for (let trans2 of transactionToCaptureTelr2) {
        trans2.order_no = trans2.order_reference_id;
        trans2.payment_no= trans2.payment_id;
        let temp = await SendToNI(trans2);
        captureResponse.push(await updateNI(temp,trans2))
    }
    return captureResponse;
}
async function capturePaytabs(transactionToCapturePaytabs) {
    console.log(transactionToCapturePaytabs);
    let captureResponse = [];
    for (let transaction of transactionToCapturePaytabs) {
        transaction.order_no = transaction.order_reference_id;
        transaction.payment_no= transaction.payment_id;
        transaction.txn =await helpers.make_sequential_no("TST_TXN");
        let temp = await SendToPaytabs(transaction);
        captureResponse.push(await updatePaytabs(temp,transaction))
    }
    return captureResponse;
}
async function SendToTelr(_terminalcred) {
    let data = `<?xml version="1.0" encoding="UTF-8"?>
    <remote>
        <store>${_terminalcred.MID}</store>
        <key>${_terminalcred.password}</key>
        <tran>
            <type>capture</type>
            <class>ecom</class>
            <currency>${_terminalcred.currency}</currency>
            <amount>${_terminalcred.amount}</amount>
            <ref>${_terminalcred.txn_payment_id}</ref>
            <test>1</test>
        </tran>
    </remote>`;
    let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: psp_url_credentials.telr.checkout_url,
        headers: {
            "Content-Type": "application/xml",
        },
        data: data,
    };
    const response = await axios.request(config);
    const parsedData = await xml2js.parseStringPromise(response.data);
    let telr_void_res = {
        status: parsedData.remote.auth[0]?.status
            ? parsedData.remote.auth[0]?.status[0]
            : "",
        auth_code: parsedData.remote.auth[0]?.code
            ? parsedData.remote.auth[0]?.code[0]
            : "",
        message: parsedData.remote.auth[0]?.message
            ? parsedData.remote.auth[0]?.message[0]
            : "",
        tranref: parsedData.remote.auth[0]?.tranref
            ? parsedData.remote.auth[0]?.tranref[0]
            : "",
        cvv: parsedData.remote.auth[0]?.cvv
            ? parsedData.remote.auth[0]?.cvv[0]
            : "",
        trace: parsedData.remote.auth[0]?.trace
            ? parsedData.remote.auth[0]?.trace[0]
            : "",
        payment_code: parsedData.remote.payment[0]?.code
            ? parsedData.remote.payment[0]?.code[0]
            : "",
        description: parsedData.remote.payment[0]?.description
            ? parsedData.remote.payment[0]?.description[0]
            : "",
        card_end: parsedData.remote.payment[0]?.card_end
            ? parsedData.remote.payment[0]?.card_end[0]
            : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
            ? parsedData.remote.payment[0]?.card_bin[0]
            : "",
    };

    return telr_void_res;
}
async function SendToNI(_terminalcred) {
    const resp = await createNIToken(_terminalcred);
    var support_config = {
        method: "POST",
        url: `${psp_url_credentials.ni.test_url}/transactions/outlets/${_terminalcred.MID}/orders/${_terminalcred.order_no}/payments/${_terminalcred.payment_no}/captures`,
        headers: {
            accept: "application/vnd.ni-payment.v2+json",
            "Content-Type": "application/vnd.ni-payment.v2+json",
            Authorization: `Bearer ${resp.access_token}`,
        },
        data: {
            amount: {
                currencyCode: _terminalcred.currency,
                value: parseFloat(_terminalcred.amount) * 100,
            },
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
}
async function SendToPaytabs(_terminalcred){
    const body_data = {
        profile_id: _terminalcred.MID,
        tran_type: "capture",
        tran_class: "ecom",
        tran_ref: _terminalcred.order_no,
        cart_id: _terminalcred.txn.toString(),
        cart_description: 'Auto Capture',
        cart_currency: _terminalcred.currency,
        cart_amount:_terminalcred.amount,
      };
      const config = {
        method: "post",
        url: psp_url_credentials.paytabs.base_url,
        headers: {
          authorization: _terminalcred.password,
        },
        data: body_data,
      };

      let result = await axios(config);
      return result;
}

async function updateTelr(telr_capture) {
    if (telr_capture.status === "E") {
        
        let generate_payment_id = await helpers.make_sequential_no("TST_TXN");
        let order_txn = {
            order_id: telr_capture.order_id,
            type: "CAPTURE",
            txn: generate_payment_id,
            payment_id: telr_capture.tranref,
            status: "FAILED",
            amount: telr_capture.amount,
            currency: telr_capture.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss")
        };
        let ret_id = await orderTransactionModel.add(order_txn,'test_order_txn');
        
        let resp_dump = {
            order_id: telr_capture.order_id,
            type: "PAYMENT",
            status: "FAILED",
            dump: JSON.stringify(telr_capture),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        return false;
    } else {
        
        let order_update = {
            status: "CAPTURED",
        };
        await merchantOrderModel.updateDynamic(
            order_update,
            {
                order_id: telr_capture.order_id,
            },
            "test_orders"
        );

        let generate_payment_id = await helpers.make_sequential_no("TST_TXN");
        let order_txn = {
            order_id: telr_capture.order_id,
            type: "CAPTURE",
            txn: generate_payment_id,
            payment_id: telr_capture.tranref,
            status: "AUTHORISED",
            amount: telr_capture.amount,
            currency: telr_capture.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss")
        };
        let last_ins = await orderTransactionModel.add(order_txn,'test_order_txn');
        
        let resp_dump = {
            order_id: telr_capture.order_id,
            type: "PAYMENT",
            status: "CAPTURED",
            dump: JSON.stringify(telr_capture),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        return true;
    }
}
async function updateNI(ni_capture,transaction){
     let order_update = {
        status: ni_capture.state,
      };
      await merchantOrderModel.updateDynamic(
        order_update,
        {
          order_id: transaction.order_id,
        },
        "test_orders"
      );
      let capture_no = "";
      if (
        ni_capture.state === "CAPTURED" ||
        ni_capture.state === "PARTIALLY_CAPTURED"
      ) {
        let old_capture_no = await orderTransactionModel.selectOneDecremental(
          "capture_no",
          {
            order_id: transaction.order_id,
            type: "CAPTURE",
            status: "AUTHORISED",
          },
          "test_order_txn"
        );
        capture_no =
          ni_capture?._embedded["cnp:capture"][0]._links?.self?.href.split(
            "/captures/"
          )[1] || old_capture_no.capture_no;
      }
      let txn_type = "CAPTURE";
      let generate_payment_id = await helpers.make_sequential_no("TST_TXN");
      let order_txn = {
        status:ni_capture.state === "CAPTURED"? "AUTHORISED": "FAILED",
        txn: generate_payment_id,
        type: txn_type,
        payment_id: ni_capture.reference,
        order_reference_id: ni_capture.orderReference,
        capture_no: capture_no,
        order_id: transaction.order_id,
        amount: transaction.amount,
        currency: transaction.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await orderTransactionModel.add(order_txn,'test_order_txn');

      let resp_dump = {
        order_id: transaction.order_id,
        type: "CAPTURE",
        status:
          ni_capture.state === "CAPTURED" ||
          ni_capture.state === "PARTIALLY_CAPTURED"
            ? "AUTHORISED"
            : "FAILED",
        dump: JSON.stringify(ni_capture),
      };
      await orderTransactionModel.addTestResDump(resp_dump);
      if(ni_capture.state=='CAPTURED'){
        return true;
      }else{
        return false;
      }
}
async function updatePaytabs(result,transaction){
    const response = result.data;
      if (response.payment_result.response_status == "A") {
        let order_update = {
          status: "CAPTURED",
        };
        await merchantOrderModel.updateDynamic(
          order_update,
          { order_id: transaction.order_id },
          "test_orders"
        );
        const order_txn = {
          order_id: transaction.order_id,
          type: 'CAPTURE',
          txn: transaction.txn,
          status: "AUTHORISED",
          amount: transaction.amount,
          currency: transaction.currency,
          remark: '',
          payment_id: response.tran_ref,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await orderTransactionModel.add(order_txn,'test_order_txn');
        const resp_dump = {
          order_id: transaction.order_id,
          type: 'CAPTURE',
          status: "APPROVED",
          dump: JSON.stringify(response),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        return true; 
      } else {
        const txn = transaction.txn;
        const order_txn = {
          order_id: transaction.order_id,
          type: 'CAPTUE',
          txn: txn,
          status: "FAILED",
          amount: transaction.amount,
          currency: transaction.currency,
          remark: '',
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await orderTransactionModel.add(order_txn,'test_order_txn');
        const resp_dump = {
          order_id: transaction.order_id,
          type: 'CAPTURE',
          status: "FAILED",
          dump: JSON.stringify(response),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        return false;
        
      }
}
const createNIToken = async (_terminalcred) => {
    var support_config = {
        method: "POST",
        url: `https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token`,
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
                reject(error.message);
            });
    });
};


module.exports = async () => {
    console.log("auto capture initiated")

    try {
        let today = moment().format('YYYY-MM-DD')
        let selection = 'ord.id,ord.order_id,ord.terminal_id,ord.psp,ord.action,ord.status,ord.amount,ord.currency,ord.payment_id as order_payment_id,txn.payment_id,txn.capture_no,txn.order_reference_id,txn.payment_id as txn_payment_id,ord.created_at,mid.autoCaptureWithinTime as capture_time,mid.MID,mid.password';
        let condition = { 
            'ord.status': 'AUTHORISED', 
            'txn.type': "AUTH", 
            'txn.status': 'AUTHORISED',
            'ord.capture_method':"AUTOMATIC", 
            'DATE(txn.created_at)': today 
        };
        let remainingToCapture = await Model.fetchAllTest(selection, condition);
        let transactionToCaptureTelr = [];
        let transactionToCaptureNI = [];
        let transactionToCapturePaytabs = [];
        //for (let txn of remainingToCapture) {
        for (let i=0; i<remainingToCapture.length; i++) {
            let txn = remainingToCapture[i];
            let capture_calculated = moment(txn.created_at).add(txn.capture_time, 'hours');
            let capture_time = moment(capture_calculated).format('YYYY-MM-DD HH:mm');
            let now = moment().format('YYYY-MM-DD HH:mm');
            console.log(`now ${now}`,`capture time ${capture_time}`)
            console.log(`is same or after ${moment(now).isSameOrAfter(capture_time)}`);
            if (moment(now).isSameOrAfter(capture_time)) {
    
                switch (txn.psp) {
                    case 'TELR':
                        transactionToCaptureTelr.push(txn);
                        break;
                    case 'NI':
                        transactionToCaptureNI.push(txn);
                        break;
                    case 'PAYTABS':
                        transactionToCapturePaytabs.push(txn);
                        break;
                }
            }
    
        }
        let [capturedDetails_Telr, captureDatails_NI,capturedDetails_Paytabs] = await Promise.all(
            [
                captureTelr(transactionToCaptureTelr), 
                captureNI(transactionToCaptureNI),
                capturePaytabs(transactionToCapturePaytabs)
            ]);
        return [capturedDetails_Telr, captureDatails_NI,capturedDetails_Paytabs];
        
    } catch (error) {
        return error;
    }
   


}

