const path = require("path");
const dotenv = require("dotenv");
const Model = require("./model");
const moment = require("moment");
const merchantOrderModel = require("../../models/merchantOrder");
const orderTransactionModel = require("../../models/order_transaction");
const helpers = require("../helper/general_helper");
const xml2js = require("xml2js");
let psp_url_credentials = require("../../config/credientials");
class TelrAutoCaptureClass {
    constructor() {
      this.sendToTelrCallCount = 0;
      this.successfulResponses = 0;
      this.processTransactionCallCount = 0;
    }
  
    async captureTelr(transactions) {
      this.captureTelrCallCount = 0;
      console.log(`captureTelr called with ${transactions.length} transactions`);
      const capturePromises = transactions.map(this.processTransaction.bind(this));
      return Promise.all(capturePromises);
    }
  
    async processTransaction(trans1) {
      this.processTransactionCallCount++;
      console.log(`processTransaction called ${this.processTransactionCallCount} times`);
      
      try {
        console.log("🚀 ~ Processing transaction:", trans1);
        const telrResponse = await this.sendToTelr(trans1);
        console.log("🚀 ~ Response from Telr:", telrResponse);
  
        const captureData = {
          ...telrResponse,
          order_id: trans1.order_id,
          currency: trans1.currency,
          amount: trans1.amount,
        };
  
        const updateResponse = await this.updateTelr(captureData);
        console.log("🚀 ~ Update response:", updateResponse);
  
        return updateResponse;
      } catch (error) {
        console.error("Error processing transaction:", trans1.order_id, error);
        return null;
      }
    }
  
    async updateTelr(captureData) {
      const generatePaymentId = await helpers.make_sequential_no("TST_TXN");
      const orderTxn = {
        order_id: captureData.order_id,
        type: "CAPTURE",
        txn: generatePaymentId,
        payment_id: captureData.tranref,
        status: captureData.status === "E" ? "FAILED" : "AUTHORISED",
        amount: captureData.amount,
        currency: captureData.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
  
      console.log(`Inserting transaction ${orderTxn.txn} with status ${orderTxn.status}`);
      await orderTransactionModel.add(orderTxn, "test_order_txn");
  
      const respDump = {
        order_id: captureData.order_id,
        type: "PAYMENT",
        status: captureData.status === "E" ? "FAILED" : "CAPTURED",
        dump: JSON.stringify(captureData),
      };
  
      console.log(`Inserting response dump for order ${respDump.order_id} with status ${respDump.status}`);
      await orderTransactionModel.addTestResDump(respDump);
  
      if (captureData.status !== "E") {
        const orderUpdate = { status: "CAPTURED" };
        await merchantOrderModel.updateDynamic(orderUpdate, { order_id: captureData.order_id }, "test_orders");
        return true;
      }
  
      return false;
    }
  
    async sendToTelr(terminalCred) {
      this.sendToTelrCallCount++;
      console.log(`sendToTelr has been called ${this.sendToTelrCallCount} times`);
  
      const data = `<?xml version="1.0" encoding="UTF-8"?>
        <remote>
          <store>${terminalCred.MID}</store>
          <key>${terminalCred.password}</key>
          <tran>
            <type>capture</type>
            <class>ecom</class>
            <currency>${terminalCred.currency}</currency>
            <amount>${terminalCred.amount}</amount>
            <ref>${terminalCred.txn_payment_id}</ref>
            <test>1</test>
          </tran>
        </remote>`;
  
      try {
        // const response = await superagent
        //   .post(psp_url_credentials.telr.checkout_url)
        //   .set('Content-Type', 'application/xml')
        //   .send(data);
  
        // this.successfulResponses++;
        // console.log(`sendToTelr has received a successful response ${this.successfulResponses} times`);
  
        // const parsedData = await xml2js.parseStringPromise(response.text);
        // console.log("🚀 ~ TelrAutoCaptureClass ~ sendToTelr ~ parsedData:", parsedData);
  
        // return this.parseTelrResponse(parsedData);
      } catch (error) {
        console.error("Error sending to Telr:", error);
        throw error;
      }
    }
  
    parseTelrResponse(parsedData) {
      const auth = parsedData.remote?.auth?.[0] || {};
      const payment = parsedData.remote?.payment?.[0] || {};
  
      return {
        status: auth.status?.[0] || "",
        auth_code: auth.code?.[0] || "",
        message: auth.message?.[0] || "",
        tranref: auth.tranref?.[0] || "",
        cvv: auth.cvv?.[0] || "",
        trace: auth.trace?.[0] || "",
        payment_code: payment.code?.[0] || "",
        description: payment.description?.[0] || "",
        card_end: payment.card_end?.[0] || "",
        card_bin: payment.card_bin?.[0] || "",
      };
    }
  
    async main() {
      try {
        const today = moment().format("YYYY-MM-DD");
        const selection = `
          ord.id, ord.order_id, ord.terminal_id, ord.psp, ord.action, ord.status,
          ord.amount, ord.currency, ord.payment_id as order_payment_id,
          txn.payment_id, txn.capture_no, txn.order_reference_id, txn.payment_id as txn_payment_id,
          ord.created_at, mid.autoCaptureWithinTime as capture_time, mid.MID, mid.password
        `;
        const condition = {
          "ord.status": "AUTHORISED",
          "txn.type": "AUTH",
          "txn.status": "AUTHORISED",
          "ord.capture_method": "AUTOMATIC",
          "DATE(txn.created_at)": today,
          psp: "TELR",
        };
  
        const transactions = await Model.fetchAllTest(selection, condition);
        console.log("🚀 ~ TelrAutoCaptureClass ~ main ~ transactions:", transactions);
        const transactionsToCapture = transactions.filter(this.isCaptureTime.bind(this));
  
        console.log("Transactions to capture:", transactionsToCapture.length);
        await this.captureTelr(transactionsToCapture);
      } catch (error) {
        console.error("Error in main process:", error);
      }
    }
  
    isCaptureTime(transaction) {
      const captureCalculated = moment(transaction.created_at).add(transaction.capture_time, "hours");
      return moment().isSameOrAfter(captureCalculated);
    }



    async telrCaptureRequest(){
      try {
        const axios = require('axios');
        const  config = {
          url : `${process.env.STATIC_URL}/api/v1/telr-auto-capture-test`,
          method: "POST",
        }
        const networkreq = await axios(config);
        console.log("🚀 ~ TelrAutoCaptureClass ~ telrCaptureRequest ~ networkreq:", networkreq.data)
      } catch (error) {
        console.log("🚀 ~ TelrAutoCaptureClass ~ telrCaptureRequest ~ error:", error)
      }
    }


  }
  
  const TelrAutoCapture = new TelrAutoCaptureClass();
  module.exports = TelrAutoCapture;
  