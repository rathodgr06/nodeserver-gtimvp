const merchantOrderModel = require("../models/merchantOrder");
const ServerResponse = require("../utilities/response/ServerResponse");
const StatusCode = require("../utilities/statuscode/index");
const CountryModel = require("../models/country");
const { default: axios } = require("axios");
const moment = require("moment");
const order_transactionModel = require("../models/order_transaction");
const EventEmitter = require("events");
const { default: ShortUniqueId } = require("short-unique-id");
const helpers = require("../utilities/helper/general_helper");
const { send_webhook_data } = require("./webhook_settings");
const ee = new EventEmitter();
const crypto = require("crypto");
const order_logs = require("../models/order_logs");
const credientials = require("../config/credientials");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const pool = require("../config/database");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const enc_dec = require("../utilities/decryptor/decryptor");
const invModel = require("../models/invoiceModel");
const orderTransactionModel = require("../models/order_transaction");
const mailSender = require("../utilities/mail/mailsender");
const rejectNon3DS = require("../controller/rejectTransaction");
const winston = require("../utilities/logmanager/winston");
const manageSubscription = require("../utilities/subscription/index");
const fraudService = require("../service/fraudService");
class PayTabsControllerClass {
  checkout = async (req, res) => {
    //console.log(`inside paytabs checkout`)
    //console.log(req.card_id);
    let {
      card_id,
      order_id,
      name,
      email,
      dial_code,
      mobile_no,
      card,
      expiry_date,
      cvv,
      env,
    } = req.body;
    let mode = env;
    let order_table = "orders";
    let order_txn_table = "order_txn";
    let order_logs_table = "order_logs";
    if (mode == "test") {
      order_table = "test_orders";
      order_txn_table = "test_order_txn";
      order_logs_table = "test_order_logs";
    }
    //console.log(`mode and env is here`)
    //console.log(env,mode);
    let logs =
      mode == "live"
        ? await order_logs.get_log_data(req.bodyString("order_id"))
        : await order_logs.get_test_log_data(req.bodyString("order_id"));

    try {
      let card_details;
      if (card_id != "") {
        card_details = await merchantOrderModel.selectDynamicONE(
          "card_number,card_expiry,cipher_id,name_on_card",
          { id: enc_dec.cjs_decrypt(card_id) },
          "customers_cards"
        );
        card = await enc_dec.dynamic_decryption(
          card_details.card_number,
          card_details.cipher_id
        );
        expiry_date = card_details.card_expiry;
        name = card_details.name_on_card;
      }

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : MerchantOrder.pay initiated`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${req.protocol
        }`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method
        }`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url
        }`
      );
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Request content-type = ${req.headers["content-type"]}`
      );
      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${req.headers["content-length"]
        }`
      );
      let body_date = { ...req.body };
      body_date.card = "**** **** **** " + card.slice(-4);
      body_date.cvv = "****";
      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(body_date)}`
      );

      let order_details = await merchantOrderModel.selectOne(
        "*",
        { order_id: order_id },
        order_table
      );

      let res_order_data = order_details;
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        { terminal_id: order_details.terminal_id },
        "mid"
      );
      if (!_getmid) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg("No Routes  Available for Transaction")
          );
      }
      // Get the autoCaptureWithinTime in hours from _getmid (assuming it's a number).
      const autoCaptureHours = parseInt(_getmid?.autoCaptureWithinTime);
      // Get the current date and time using moment.
      const currentDate = moment();
      // Add autoCaptureHours to the current date to get the new date and time.
      const newDateTime = currentDate.add(autoCaptureHours, "hours");
      // Format the newDateTime as "YYYY-MM-DD HH:mm"
      const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        { id: _getmid.psp_id },
        "psp"
      );
      if (!_pspid) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      let card_proxy = enc_dec.encrypt_card(card);
      let checkForCardProxyInSystem = await helpers.fetchLastTryData({
        card_proxy: card_proxy,
      });
      //console.log(checkForCardProxyInSystem);
      if (
        _getmid.is3DS == 1 &&
        checkForCardProxyInSystem?.["3ds_version"] == 0
      ) {
        throw "card is non 3ds and non 3ds card are not allowed";
      }
      //console.log(`Paytabs terminal credetials in checkout`);
      //console.log(_terminalcred);
      let clientIp = getClientIP(req);
      console.log(`got data from clientIp`);
      console.log(clientIp);
      console.log(`all headers`);
      console.log(req.headers);
      const body_data = {
        profile_id: _terminalcred.MID,
        tran_type: order_details.action.toLowerCase(),
        tran_class: "ecom",
        cart_description: order_details?.description
          ? order_details?.description
          : "Payment of " +
          order_details?.currency +
          " " +
          order_details?.amount,
        tokenise: "2",
        cart_id: order_id,
        cart_currency: order_details?.currency,
        cart_amount: order_details?.amount,
        callback: process.env.PAYTABS_RETURN_URL + "?mode=" + mode,
        return: process.env.PAYTABS_RETURN_URL + "?mode=" + mode,
        card_details: {
          pan: card,
          expiry_month: parseInt(expiry_date.split("/")[0]),
          expiry_year: parseInt(expiry_date.split("/")[1]),
          cvv: cvv,
        },
        customer_details: {
          name: order_details?.customer_name || name,
          email: order_details?.customer_email || email,
          phone: order_details?.customer_mobile || mobile_no,
          street1:
            order_details?.billing_address_line_1 +
            order_details?.billing_address_line_2,
          city: order_details?.billing_city,
          state: order_details?.billing_province,
          country: order_details?.billing_country,
          // "ip": "183.177.126.44"
          ip: req.headers['ip'] || getClientIP()
        },
      };
      console.log(`this is payload`);
      console.log(body_data);
      let modified_data = JSON.parse(JSON.stringify(body_data));
      modified_data.card_details.pan = "**** **** **** " + card.slice(-4);
      modified_data.card_details.cvv = "****";

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : 3ds initialize with  ${JSON.stringify(modified_data)}`
      );

      var config_paytab = {
        method: "post",
        url: _terminalcred.baseurl,
        headers: {
          authorization: _terminalcred.password,
        },
        data: body_data,
      };
      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
      let payment_id = await helpers.make_sequential_no(
        mode == "test" ? "TST_TXN" : "TXN"
      );
      let browser_token_enc = req.browser_fingerprint;

      logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : browser_token_enc ${req.browser_fingerprint
        }`
      );
      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        //console.log("browser_token", browser_token)
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
        //console.log("browser_token_enc", browser_token_enc)
        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : new browser token ${browser_token_enc}`
        );
      }
      let response;
      try {
        response = await axios(config_paytab);
        //console.log(`response from paytabs`);
        //console.log(response.data);
      } catch (error) {
        //console.log(`here is error`)
        console.log(error);
        winston.error(error);
        let order_update_failed = {
          status: "FAILED",
          psp: "PAYTABS",
          payment_id: payment_id,
          expiry: expiry_date,
          cardholderName: name,
          card_country: req.card_details.country,
          scheme: req.card_details.card_brand,
          cardType: req.card_details.card_type,
          pan: maskify(card),
        };
        await merchantOrderModel.updateDynamic(
          order_update_failed,
          {
            order_id: req.bodyString("order_id"),
          },
          order_table
        );
        let response_category_failed = await helpers.get_error_category(
          "01",
          "paytabs",
          "FAILED"
        );
        let order_txn = {
          status: "FAILED",
          psp_code: "01",
          paydart_category: response_category_failed?.category,
          remark: "Invalid Request",
          txn: payment_id,
          type: res_order_data.action.toUpperCase(),
          payment_id: "",
          order_reference_id: "",
          capture_no: "",
          order_id: res_order_data.order_id,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await orderTransactionModel.test_txn_add(order_txn);
        } else {
          await orderTransactionModel.add(order_txn);
        }
        let new_res = {
          m_order_id: res_order_data.merchant_order_id,
          p_order_id: req.bodyString("order_id"),
          p_request_id: "",
          psp_ref_id: "",
          psp_txn_id: "",
          transaction_id: payment_id,
          status: "FAILED",
          status_code: "01",
          remark: "Invalid Request",
          paydart_category: response_category_failed.category,
          currency: res_order_data.currency,
          amount: res_order_data?.amount ? res_order_data?.amount : "",
          m_customer_id: res_order_data.merchant_customer_id,
          psp: res_order_data.psp,
          payment_method: res_order_data.payment_mode,
          m_payment_token: res_order_data?.card_id
            ? res_order_data?.card_id
            : "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          return_url: res_order_data.failure_url,
          payment_method_data: {
            scheme: req.card_details.card_brand,
            card_country: req.card_details.country,
            card_type: req.card_details.card_type,
            mask_card_number: maskify(card),
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: res_order_data?.merchant_id
            ? await helpers.formatNumber(res_order_data?.merchant_id)
            : "",
        };
        let res_obj = {
          order_status: "FAILED",
          reference: "",
          order_reference: "",
          payment_id: payment_id,
          order_id: res_order_data.order_id,
          new_res: new_res,
          amount: res_order_data.amount,
          currency: res_order_data.currency,
          token: browser_token_enc,
          "3ds": "",
        };
        let temp_card_details = await helpers.fetchTempLastCard({
          order_id: order_id,
          mode: mode,
        });
        //console.log(temp_card_details);
        let txnFailedLog = {
          order_id: res_order_data.order_id,
          terminal: res_order_data?.terminal_id,
          req: JSON.stringify(req.body),
          res: JSON.stringify(error),
          psp: "PAYTABS",
          status_code: response_category_failed.response_code,
          description: response_category_failed.response_details,
          activity: "Transaction failed with Paytabs",
          status: 1,
          mode: mode,
          card_holder_name: temp_card_details.card_holder_name,
          card: temp_card_details.card,
          expiry: temp_card_details.expiry,
          cipher_id: temp_card_details.cipher_id,
          txn: payment_id,
          card_proxy: temp_card_details.card_proxy,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        //console.log(`TXN FAILED LOG 1`);
        //console.log(txnFailedLog)
        await helpers.addTransactionFailedLogs(txnFailedLog);

        let logs_payload = {
          activity: JSON.stringify(logs),
          updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await order_logs.update_logs_data(
          { order_id: req.bodyString("order_id") },
          logs_payload,
          mode
        );

        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.errorMsgWithData("Transaction failed.", res_obj)
          );
      }

      logs.push(
        `${moment().format(
          "DD/MM/YYYY HH:mm:ss.SSS"
        )} : 3ds response data  ${JSON.stringify(response.data)}`
      );
      const data = response.data;
      //console.log(`Logging Data from coming from paytabs response`);
      //console.log(data);
      // adding data to generate request
      let p_request_id = await helpers.make_sequential_no(
        req.body.env == "test" ? "TST_REQ" : "REQ"
      );
      let order_req = {
        merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        request_id: p_request_id,
        request: JSON.stringify(req.body),
      };
      await helpers.common_add(
        order_req,
        req.body.env == "test"
          ? "test_generate_request_id"
          : "generate_request_id"
      );
      if (data.redirect_url) {
        // update order
        let update_order = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers.browser_version,
          browser_fingerprint: req.headers.fp,
          psp: "PAYTABS",
          status: "AWAIT_3DS",
          // payment_mode: req.card_details.card_type,
          card_country: req.card_details.country,
          card_id: req.card_id,
          cardType: req.card_details.card_type,
          scheme: req.card_details.card_brand,
          pan: `${card.substring(0, 6)}****${card.slice(-4)}`,
          "3ds": 0,
          "3ds_status": "NA"
        };
        await merchantOrderModel.updateDynamic(
          update_order,
          { order_id: order_details?.order_id },
          order_table
        );
        const senddata = response.data;
        delete senddata.payment_info;
        delete senddata.customer_details;
        let browser_token = {
          os: req.headers?.os,
          browser: req.headers?.browser,
          browser_version: req.headers?.browser_version,
          browser_fingerprint: req.headers?.fp,
        };
        senddata.token = browser_token_enc;

        return res
          .status(StatusCode.ok)
          .send(ServerResponse.successdatamsg(senddata));
      } else {
        if (_getmid.is3DS == 1 && data.payment_result.response_status === "A") {
          order_details.payment_mode = req.card_details.card_type;
          order_details.card_country = req.card_details.country;
          order_details.cardType = req.card_details.card_type;
          order_details.scheme = req.card_details.card_brand;
          order_details.pan = `${card.substring(0, 6)}****${card.substring(
            card.length - 4
          )}`;
          order_details.psp = "Paytabs";
          let b_token = {
            os: req.headers?.os,
            browser: req.headers?.browser,
            browser_version: req.headers?.browser_version,
            browser_fingerprint: req.headers?.fp,
          };
          let reject_obj = await rejectNon3DS(
            order_details,
            data,
            req.body,
            enc_dec.cjs_encrypt(JSON.stringify(b_token)),
            mode
          );
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: order_details.order_id,
            mode: mode,
          });
          //console.log(temp_card_details);
          let txnFailedLog = {
            order_id: order_details.order_id,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(config_paytab),
            res: JSON.stringify(data),
            psp: "PAYTABS",
            status_code: reject_obj.new_res.status_code,
            description: reject_obj.new_res.remark,
            activity: "Transaction failed with Paytabs",
            status: 1,
            mode: mode,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            txn: reject_obj.new_res.payment_id,
            card_proxy: temp_card_details.card_proxy,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          //console.log(`TXN FAILED LOG 2`);
          //console.log(txnFailedLog)
          await helpers.addTransactionFailedLogs(txnFailedLog);

          let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          await order_logs.update_logs_data(
            { order_id: req.bodyString("order_id") },
            logs_payload,
            mode
          );

          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.successdatamsg(reject_obj, "Transaction Rejected.")
            );
        } else {
          /* Update The payment status for various payment channel like qr, subscription and invoice */
          let qr_payment_status =
            data.payment_result.response_status == "A" ? "CAPTURED" : "FAILED";
          let qr_payment = await merchantOrderModel.selectOne(
            "id",
            {
              order_no: order_details?.order_id,
            },
            "qr_payment"
          );

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.selectOne ${JSON.stringify(qr_payment)}`
          );

          if (qr_payment) {
            let qr_data = {
              payment_status: qr_payment_status,
              transaction_date: moment().format("DD-MM-YYYY hh:mm:ss"),
            };

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
                qr_data
              )}`
            );

            await merchantOrderModel.updateDynamic(
              qr_data,
              {
                id: qr_payment.id,
              },
              "qr_payment"
            );
          }

          let invoice_payment = await invModel.selectDynamic(
            "id",
            {
              order_id: order_details?.order_id,
            },
            "inv_invoice_master"
          );

          if (invoice_payment && data.payment_result.response_status === "A") {
            let inv_data = {
              status: "Closed",
              payment_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : invModel.updateDynamic with data ${JSON.stringify(inv_data)}`
            );

            invModel.updateDynamic(
              inv_data,
              {
                id: invoice_payment.id,
              },
              "inv_invoice_master"
            );
          }

          /* Update the payment status for various payment channel end */
          if (data.payment_result.response_status == "A") {
            if (order_details?.action.toUpperCase() == "SALE") {
              await manageSubscription(
                order_details,
                "CAPTURED",
                moment().format("YYYY-MM-DD HH:mm:ss"),
                data?.tran_ref,
                data?.token,
                mode
              );
            }
            const status =
              order_details?.action.toLowerCase() == "auth"
                ? "AUTHORISED"
                : "CAPTURED";

            const txn = await helpers.make_sequential_no(
              mode == "test" ? "TST_TXN" : "TXN"
            );
            let response_category = await helpers.get_error_category(
              data.payment_result.response_code,
              "paytabs",
              order_details?.action.toUpperCase() == "SALE"
                ? "AUTHORISED"
                : status
            );
            const order_txn = {
              status:
                order_details?.action.toUpperCase() == "SALE"
                  ? "AUTHORISED"
                  : status,
              psp_code: "00",
              paydart_category: response_category.category,
              remark: data.payment_result.response_message,
              txn: txn,
              type: order_details?.action.toUpperCase(),
              payment_id: data?.tran_ref,
              order_id: order_details?.order_id,
              amount: order_details?.amount,
              currency: order_details?.currency,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              order_reference_id: data?.tran_ref,
              capture_no: "",
            };
            if (mode == "test") {
              await order_transactionModel.test_txn_add(order_txn);
            } else {
              await order_transactionModel.add(order_txn);
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : order_txn added data  ${JSON.stringify(order_txn)}`
            );
            let update_order = {
              os: req.headers.os,
              browser: req.headers.browser,
              browser_version: req.headers.browser_version,
              browser_fingerprint: req.headers.fp,
              payment_id: txn,
              status: status,
              psp: "PAYTABS",
              // payment_mode: req.card_details.card_type,
              card_country: req.card_details.country,
              cardType: req.card_details.card_type,
              scheme: req.card_details.card_brand,
              card_id: req.card_id,
              pan: `${card.substring(0, 6)}****${card.substring(
                card.length - 4
              )}`,
              capture_datetime: capture_datetime,
              saved_card_for_recurring: data?.token,
              "3ds":"0",
              "3ds_status":"Authentication not available"
            };

            await merchantOrderModel.updateDynamic(
              update_order,
              { order_id: order_details?.order_id },
              order_table
            );
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} : update order data  ${JSON.stringify(update_order)}`
            );

            const browser_token = {
              os: req.headers?.os,
              browser: req.headers?.browser,
              browser_version: req.headers?.browser_version,
              browser_fingerprint: req.headers?.fp,
            };
            let p_request_id = await helpers.make_sequential_no("REQ");
            let merchant_id = await helpers.get_data_list(
              "merchant_id",
              order_table,
              { order_id: order_details.order_id }
            );

            let modified_req_data = JSON.parse(JSON.stringify(req.body));
            modified_req_data.card = "**** **** **** " + card.slice(-4);
            modified_req_data.cvv = "****";

            let order_req = {
              merchant_id: merchant_id[0].merchant_id,
              order_id: order_details.order_id,
              request_id: p_request_id,
              request: JSON.stringify(modified_req_data),
            };

            await helpers.common_add(order_req, "generate_request_id");
            let new_order_details = await order_transactionModel.selectOne(
              "*",
              { order_id: order_details.order_id },
              order_table
            );
            let new_res = {
              m_order_id: order_details.merchant_order_id
                ? order_details.merchant_order_id
                : "",
              p_order_id: order_details.order_id ? order_details.order_id : "",
              p_request_id: p_request_id,
              psp_ref_id: data?.tran_ref,
              psp_txn_id: "",
              transaction_id: txn,
              status: "SUCCESS",
              status_code: "00",
              remark: "",
              paydart_category: response_category?.category,
              currency: order_details.currency,
              return_url: order_details.success_url,
              transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
              amount: order_details.amount.toFixed(2),
              m_customer_id: order_details.merchant_customer_id,
              psp: "PAYTABS",
              payment_method: new_order_details.cardType,
              m_payment_token: order_details.card_id,
              payment_method_data: {
                scheme: new_order_details.scheme,
                card_country: new_order_details.card_country,
                card_type: new_order_details.cardType,
                mask_card_number: new_order_details.pan,
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: enc_dec.cjs_encrypt(
                order_details.merchant_id
              ),
            };
            const res_obj = {
              order_status: status,
              payment_id: txn,
              order_id: order_details?.order_id,
              amount: order_details?.amount,
              currency: order_details?.currency,
              return_url: order_details?.return_url,
              token: browser_token_enc,
              message: "Transaction Successful",
              new_res: new_res,
            };
            let response_dump = {
              order_id: order_id,
              type: order_details?.action.toUpperCase(),
              status: "APPROVED",
              dump: JSON.stringify(data),
            };
            if (mode == "test") {
              await order_transactionModel.addTestResDump(response_dump);
            } else {
              await order_transactionModel.addResDump(response_dump);
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} :response dump data  ${JSON.stringify(response_dump)}`
            );

            ee.once("ping", async () => {
              // Sending mail to customers and merchants about transaction
              const table_name = "orders";
              let order_id = order_details.order_id;
              let qb = await pool.get_connection();
              let merchant_and_customer_transaction_response;
              try {
                merchant_and_customer_transaction_response = await qb
                  .select(
                    "md.company_name,md.co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
                  )
                  .from(config.table_prefix + order_table + " o")
                  .join(
                    config.table_prefix + "master_merchant_details md",
                    "o.merchant_id=md.merchant_id",
                    "inner"
                  )
                  .join(
                    config.table_prefix + "master_merchant mm",
                    "o.merchant_id=mm.id",
                    "inner"
                  )
                  .where({
                    "o.order_id": order_id,
                  })
                  .get();
              } catch (error) {
                console.error("Database query failed:", error);
              } finally {
                qb.release();
              }

              let mail_details = merchant_and_customer_transaction_response[0];
              mail_details.logo = mail_details.logo
                ? process.env.STATIC_URL + "/static/files/" + mail_details.logo
                : "";
              let transaction_date_time = new Date(mail_details.updated_at);
              mail_details.updated_at = moment(transaction_date_time).format(
                "DD-MM-YYYY HH:mm"
              );
              let mail_response = await mailSender.CustomerTransactionMail(
                mail_details
              );
              let merchant_mail_response =
                await mailSender.MerchantTransactionMail(mail_details);
            });

            ee.emit("ping", {
              message: "hello",
            });
            // event base charges update end
            // web  hook starting
            let hook_info = await helpers.get_data_list(
              "*",
              "webhook_settings",
              {
                merchant_id: merchant_id[0].merchant_id,
              }
            );
            let web_hook_res = Object.assign({}, res_obj.new_res);
            delete web_hook_res?.return_url;
            delete web_hook_res?.paydart_category;
            if (hook_info[0]) {
              if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                  url,
                  web_hook_res,
                  hook_info[0].notification_secret
                );
              }
            }
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: order_details.order_id,
              mode: mode,
            });
            //console.log(temp_card_details);
            let txnFailedLog = {
              order_id: order_details.order_id,
              terminal: order_details?.terminal_id,
              req: JSON.stringify(config_paytab),
              res: JSON.stringify(data),
              psp: "PAYTABS",
              status_code: data.payment_result.response_code,
              description: data.payment_result.response_message,
              activity: "Transaction success with Paytabs",
              status: 0,
              mode: mode,
              card_holder_name: temp_card_details.card_holder_name,
              card: temp_card_details.card,
              expiry: temp_card_details.expiry,
              cipher_id: temp_card_details.cipher_id,
              txn: txn,
              card_proxy: temp_card_details.card_proxy,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            //console.log(`TXN FAILED LOG 3`);
            //console.log(txnFailedLog)
            await helpers.addTransactionFailedLogs(txnFailedLog);
            let logs_payload = {
              activity: JSON.stringify(logs),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await order_logs.update_logs_data(
              { order_id: req.bodyString("order_id") },
              logs_payload,
              mode
            );

            return res
              .status(StatusCode.ok)
              .send(
                ServerResponse.successdatamsg(res_obj, "Paid successfully.")
              );
          } else {
            const status = "FAILED";
            const txn = await helpers.make_sequential_no(
              mode == "test" ? "TST_TXN" : "TXN"
            );
            let response_category = await helpers.get_error_category(
              data.payment_result.response_code,
              "paytabs",
              order_details?.action.toUpperCase() == "SALE"
                ? "AUTHORISED"
                : status
            );
            let order_txn = {
              status: status,
              psp_code: data.payment_result.response_code,
              paydart_category: response_category?.category,
              remark: response_category?.response_details,
              txn: txn,
              type: order_details?.action.toUpperCase(),
              payment_id: data?.tran_ref,
              order_id: order_details?.order_id,
              amount: order_details?.amount,
              currency: order_details?.currency,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              order_reference_id: "",
              capture_no: "",
            };
            if (mode == "test") {
              await order_transactionModel.test_txn_add(order_txn);
            } else {
              await order_transactionModel.add(order_txn);
            }

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} :order txn   data  ${JSON.stringify(order_txn)}`
            );
            let update_order = {
              os: req.headers.os,
              browser: req.headers.browser,
              browser_version: req.headers.browser_version,
              browser_fingerprint: req.headers.fp,
              payment_id: txn,
              status: status,
              psp: "PAYTABS",
              // payment_mode: req.card_details.card_type,
              card_id: req.card_id,
              card_country: req.card_details.country,
              cardType: req.card_details.card_type,
              scheme: req.card_details.card_brand,
              pan: `${card.substring(0, 6)}****${card.substring(
                card.length - 4
              )}`,
            };
            await merchantOrderModel.updateDynamic(
              update_order,
              {
                order_id: order_details?.order_id,
              },
              order_table
            );

            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} :order update  data  ${JSON.stringify(update_order)}`
            );

            // adding dump entry
            let response_dump = {
              order_id: order_id,
              type: order_details?.action.toUpperCase(),
              status: status,
              dump: JSON.stringify(data),
            };
            if (mode == "test") {
              await order_transactionModel.addTestResDump(response_dump);
            } else {
              await order_transactionModel.addResDump(response_dump);
            }

            const browser_token = {
              os: req.headers?.os,
              browser: req.headers?.browser,
              browser_version: req.headers?.browser_version,
              browser_fingerprint: req.headers?.fp,
            };
            let p_request_id = await helpers.make_sequential_no("REQ");
            let merchant_id = await helpers.get_data_list(
              "merchant_id",
              order_table,
              { order_id: order_details.order_id }
            );

            let modified_req_data = JSON.parse(JSON.stringify(req.body));
            modified_req_data.card = "**** **** **** " + card.slice(-4);
            modified_req_data.cvv = "****";

            let order_req = {
              merchant_id: merchant_id[0].merchant_id,
              order_id: order_details.order_id,
              request_id: p_request_id,
              request: JSON.stringify(modified_req_data),
            };
            await helpers.common_add(order_req, "generate_request_id");
            let new_order_details = await order_transactionModel.selectOne(
              "*",
              { order_id: order_details?.order_id },
              order_table
            );

            let new_res = {
              m_order_id: new_order_details.merchant_order_id
                ? new_order_details.merchant_order_id
                : "",
              p_order_id: new_order_details.order_id
                ? new_order_details.order_id
                : "",
              p_request_id: p_request_id,
              psp_ref_id: data?.tran_ref,
              psp_txn_id: "",
              transaction_id: txn,
              status: "FAILED",
              status_code: data.payment_result.response_code,
              remark: data.payment_result.response_message,
              paydart_category: response_category,
              currency: new_order_details.currency,
              return_url: new_order_details.failure_url,
              transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
              amount: new_order_details.amount.toFixed(2),
              m_customer_id: new_order_details.merchant_customer_id,
              psp: "PAYTABS",
              payment_method: new_order_details.payment_mode,
              m_payment_token: new_order_details.card_id,
              payment_method_data: {
                scheme: new_order_details.scheme,
                card_country: new_order_details.card_country,
                card_type: new_order_details.cardType,
                mask_card_number: new_order_details.pan,
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: enc_dec.cjs_encrypt(
                order_details.merchant_id
              ),
            };

            //console.log(" enc_dec.cjs_encrypt(JSON.stringify(browser_token))", browser_token_enc)

            const res_obj = {
              order_status: status,
              payment_id: txn || order_details?.payment_id,
              order_id: order_details?.order_id,
              amount: order_details?.amount,
              currency: order_details?.currency,
              token: browser_token_enc,
              return_url: order_details.return_url,
              message:
                data?.payment_result?.response_message || "Transaction Failed",
              new_res: new_res,
            };
            logs.push(
              `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
              )} :order response dump  data  ${JSON.stringify(response_dump)}`
            );
            let temp_card_details = await helpers.fetchTempLastCard({
              order_id: order_details.order_id,
              mode: mode,
            });
            //console.log(temp_card_details);
            let txnFailedLog = {
              order_id: order_details.order_id,
              terminal: order_details?.terminal_id,
              req: JSON.stringify(config_paytab),
              res: JSON.stringify(data),
              psp: "PAYTABS",
              status_code: data.payment_result.response_code,
              description: data.payment_result.response_message,
              activity: "Transaction failed with Paytabs",
              status: 1,
              mode: mode,
              card_holder_name: temp_card_details.card_holder_name,
              card: temp_card_details.card,
              expiry: temp_card_details.expiry,
              cipher_id: temp_card_details.cipher_id,
              txn: txn,
              card_proxy: temp_card_details.card_proxy,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            //console.log(`TXN FAILED LOG 4`);
            //console.log(txnFailedLog)
            await helpers.addTransactionFailedLogs(txnFailedLog);

            let logs_payload = {
              activity: JSON.stringify(logs),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await order_logs.update_logs_data(
              { order_id: req.bodyString("order_id") },
              logs_payload,
              mode
            );
            return res
              .status(StatusCode.ok)
              .send(ServerResponse.errorMsgWithData(data?.message, res_obj));
          }
        }
      }

      let logs_payload = {
        activity: JSON.stringify(logs),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await order_logs
        .update_logs_data(
          { order_id: req.bodyString("order_id") },
          logs_payload,
          mode
        )
        .then((result) => { })
        .catch((err) => {
          winston.error(err);
        });
    } catch (error) {
      winston.error(error);
      console.log(error);

      helpers.updateOrderCycle(req.bodyString("order_id"), mode);

      let payment_id = await helpers.make_sequential_no(
        mode == "test" ? "TST_TXN" : "TXN"
      );
      let browser_token_enc = req.browser_fingerprint;

      if (!browser_token_enc) {
        let browser_token = {
          os: req.headers.os,
          browser: req.headers.browser,
          browser_version: req.headers["x-browser-version"],
          browser_fingerprint: req.headers.fp,
        };
        browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
      }
      let res_order_data = await merchantOrderModel.selectDynamicONE(
        "*",
        { order_id: order_id },
        order_table
      );
      let order_update_failed = {
        status: "FAILED",
        psp: "PAYTABS",
        payment_id: payment_id,
        expiry: expiry_date,
        cardholderName: name,
        card_country: req.card_details.country,
        scheme: req.card_details.card_brand,
        cardType: req.card_details.card_type,
        pan: maskify(card),
      };
      await merchantOrderModel.updateDynamic(
        order_update_failed,
        {
          order_id: req.bodyString("order_id"),
        },
        order_table
      );
      let response_category_failed;
      if (error == "card is non 3ds and non 3ds card are not allowed") {
        response_category_failed = await helpers.get_error_category(
          "144",
          "paydart",
          "FAILED"
        );
      } else {
        response_category_failed = await helpers.get_error_category(
          "01",
          "paytabs",
          "FAILED"
        );
      }
      let order_txn = {
        status: "FAILED",
        psp_code: response_category_failed?.response_code,
        paydart_category: response_category_failed?.category,
        remark: response_category_failed?.response_details,
        txn: payment_id,
        type: res_order_data.action.toUpperCase(),
        payment_id: "",
        order_reference_id: "",
        capture_no: "",
        order_id: res_order_data.order_id,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      if (mode == "test") {
        await orderTransactionModel.test_txn_add(order_txn);
      } else {
        await orderTransactionModel.add(order_txn);
      }
      let new_res = {
        m_order_id: res_order_data.merchant_order_id,
        p_order_id: req.bodyString("order_id"),
        p_request_id: "",
        psp_ref_id: "",
        psp_txn_id: "",
        transaction_id: payment_id,
        status: "FAILED",
        status_code: response_category_failed.response_code,
        remark: response_category_failed?.response_code,
        paydart_category: response_category_failed.category,
        currency: res_order_data.currency,
        amount: res_order_data?.amount ? res_order_data?.amount : "",
        m_customer_id: res_order_data.merchant_customer_id,
        psp: res_order_data.psp,
        payment_method: res_order_data.payment_mode,
        m_payment_token: res_order_data?.card_id ? res_order_data?.card_id : "",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        return_url: res_order_data.failure_url,
        payment_method_data: {
          scheme: req.card_details.card_brand,
          card_country: req.card_details.country,
          card_type: req.card_details.card_type,
          mask_card_number: maskify(card),
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: res_order_data?.merchant_id
          ? await helpers.formatNumber(res_order_data?.merchant_id)
          : "",
      };
      let res_obj = {
        order_status: "FAILED",
        reference: "",
        order_reference: "",
        payment_id: payment_id,
        order_id: res_order_data.order_id,
        new_res: new_res,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        token: browser_token_enc,
        "3ds": "",
      };
      let temp_card_details = await helpers.fetchTempLastCard({
        order_id: order_id,
        mode: mode,
      });
      //console.log(temp_card_details);
      let txnFailedLog = {
        order_id: res_order_data.order_id,
        terminal: res_order_data?.terminal_id,
        req: JSON.stringify(req.body),
        res: JSON.stringify({}),
        psp: "PAYTABS",
        status_code: response_category_failed.response_code,
        description: response_category_failed.response_details,
        activity: "Transaction failed with Paytabs",
        status: 1,
        mode: mode,
        card_holder_name: temp_card_details.card_holder_name,
        card: temp_card_details.card,
        expiry: temp_card_details.expiry,
        cipher_id: temp_card_details.cipher_id,
        txn: payment_id,
        card_proxy: temp_card_details.card_proxy,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      // console.log(`TXN FAILED LOG 5`);
      // console.log(txnFailedLog)
      await helpers.addTransactionFailedLogs(txnFailedLog);

      let logs_payload = {
        activity: JSON.stringify(logs),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await order_logs.update_logs_data(
        { order_id: req.bodyString("order_id") },
        logs_payload,
        mode
      );

      if (error?.response?.data) {
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.successdatamsg(
              res_obj,
              error?.response?.data?.message
            )
          );
      }
      return res
        .status(StatusCode.ok)
        .send(ServerResponse.successdatamsg(res_obj, error?.message));
    }
  };

  pay3ds = async (req, res) => {
    try {
      const { respStatus, respMessage, cartId, tranRef, respCode, token } =
        req.body;
      const mode = req.query.mode;
      let logs =
        mode == "test"
          ? await order_logs.get_test_log_data(cartId)
          : await order_logs.get_log_data(cartId);
      let order_table = "orders";
      if (mode == "test") {
        order_table = "test_orders";
      }
      const order_details = await merchantOrderModel.selectOne(
        "*",
        { order_id: cartId },
        order_table
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        { terminal_id: order_details.terminal_id },
        "mid"
      );
      if (!_getmid) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errorMsg("No Routes  Available for Transaction")
          );
      }

      let fraudStatus = false;
      let fraudResponse = {};

      // if(order_details.fraud_3ds_pending === 1){
      //   const fraudCheckBody  = {
      //     fraudRequestId : order_details.fraud_request_id,
      //     order_id : cartId,
      //     is3ds : 1
      //   }
      //   console.log("🚀 ~ update_3ds2_ni: ~ fraudCheckBody:", fraudCheckBody)

      //   const fraudServiceRequest  = await fraudService.make3dsFraudCheck(fraudCheckBody);
      //   console.log("🚀 ~ PayTabsControllerClass ~ pay3ds= ~ fraudServiceRequest:", fraudServiceRequest)
      //   fraudStatus = fraudServiceRequest.status === 'fail' ? true : false;
      //   fraudResponse = fraudServiceRequest
      // }

      const serverKey = _getmid.password;
      const signatureFields = req.body;
      const requestSignature = signatureFields.signature;
      delete signatureFields.signature;
      const filteredFields = Object.fromEntries(
        Object.entries(signatureFields).filter(([_, value]) => value !== "")
      );
      const sortedFields = Object.keys(filteredFields)
        .sort()
        .reduce((obj, key) => {
          obj[key] = filteredFields[key];
          return obj;
        }, {});
      const query = new URLSearchParams(sortedFields).toString();
      const signature = crypto
        .createHmac("sha256", serverKey)
        .update(query)
        .digest("hex");
      if (
        crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(requestSignature)
        )
      ) {
        /* Update The payment status for various payment channel like qr, subscription and invoice */
        let qr_payment_status = respStatus == "A" ? "CAPTURED" : "FAILED";

        let qr_payment = await merchantOrderModel.selectOne(
          "id",
          {
            order_no: order_details.order_id,
          },
          "qr_payment"
        );

        logs.push(
          `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
          )} : merchantOrderModel.selectOne ${JSON.stringify(qr_payment)}`
        );
        if (qr_payment) {
          let qr_data = {
            payment_status: qr_payment_status,
            transaction_date: moment().format("DD-MM-YYYY hh:mm:ss"),
          };

          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
              qr_data
            )}`
          );

          let updated_qr_payment = await merchantOrderModel.updateDynamic(
            qr_data,
            {
              id: qr_payment.id,
            },
            "qr_payment"
          );
        }
        let invoice_payment = await invModel.selectDynamic(
          "id",
          {
            order_id: order_details.order_id,
          },
          "inv_invoice_master"
        );

        if (invoice_payment && respStatus === "A") {
          let inv_data = {
            status: "Closed",
            payment_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          logs.push(
            `${moment().format(
              "DD/MM/YYYY HH:mm:ss.SSS"
            )} : invModel.updateDynamic with data ${JSON.stringify(inv_data)}`
          );

          invModel.updateDynamic(
            inv_data,
            {
              id: invoice_payment.id,
            },
            "inv_invoice_master"
          );
        }

        /* Update the payment status for various payment channel end */
        if (respStatus == "A") {
          if (order_details.action.toUpperCase() === "SALE") {
            await manageSubscription(
              order_details,
              "CAPTURED",
              moment().format("YYYY-MM-DD HH:mm:ss"),
              tranRef,
              token,
              mode
            );
          }
          const status =
            order_details?.action.toLowerCase() == "auth"
              ? "AUTHORISED"
              : "CAPTURED";
          const txn = await helpers.make_sequential_no(
            mode == "test" ? "TST_TXN" : "TXN"
          );
          let response_category = await helpers.get_error_category(
            respCode,
            "paytabs",
            "AUTHORISED"
          );
          const order_txn = {
            status: "AUTHORISED",
            psp_code: respCode ? respCode : "",
            paydart_category: response_category?.category,
            remark: respMessage ? respMessage : "",
            txn: txn,
            type: order_details?.action.toUpperCase(),
            payment_id: tranRef,
            order_id: cartId,
            amount: order_details?.amount,
            currency: order_details?.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            order_reference_id: tranRef,
            capture_no: "",
          };
          if (mode == "test") {
            await order_transactionModel.test_txn_add(order_txn);
          } else {
            await order_transactionModel.add(order_txn);
          }
          const browser_token = {
            os: req.headers?.os,
            browser: req.headers?.browser,
            browser_version: req.headers?.browser_version,
            browser_fingerprint: req.headers?.fp,
          };
          let update_order = {
            os: req.headers.os,
            browser: req.headers.browser,
            browser_version: req.headers.browser_version,
            browser_fingerprint:
              encrypt_decrypt("encrypt", JSON.stringify(browser_token)) || "",
            payment_id: txn,
            status: status,
            psp: "PAYTABS",
            saved_card_for_recurring: token,
            "3ds": "1",
            "3ds_status": "Authentication Successfull"
          };
          await merchantOrderModel.updateDynamic(
            update_order,
            { order_id: order_details?.order_id },
            order_table
          );

          let p_request_id = await helpers.make_sequential_no("REQ");
          let merchant_id = await helpers.get_data_list(
            "merchant_id",
            order_table,
            { order_id: order_details.order_id }
          );
          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: order_details.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(order_req, "generate_request_id");
          let new_res = {
            m_order_id: order_details.merchant_order_id
              ? order_details.merchant_order_id
              : "",
            p_order_id: order_details.order_id ? order_details.order_id : "",
            p_request_id: p_request_id,
            psp_ref_id: tranRef,
            psp_txn_id: "",
            transaction_id: txn,
            status: "SUCCESS",
            status_code: "00",
            remark: "",
            paydart_category: response_category?.category?.response_details,
            currency: order_details.currency,
            return_url: order_details.success_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_details.amount.toFixed(2),
            m_customer_id: order_details.merchant_customer_id,
            psp: "PAYTABS",
            payment_method: order_details.cardType,
            m_payment_token: order_details.card_id,
            payment_method_data: {
              scheme: order_details.scheme,
              card_country: order_details.card_country,
              card_type: order_details.cardType,
              mask_card_number: order_details.pan,
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: enc_dec.cjs_encrypt(
              order_details.merchant_id
            ),
          };
          const res_obj = {
            order_status: status,
            payment_id: txn,
            order_id: order_details?.order_id,
            amount: order_details?.amount,
            currency: order_details?.currency,
            return_url: order_details?.return_url,
            token:
              encrypt_decrypt("encrypt", JSON.stringify(browser_token)) || "",
            message: "Transaction Successful",
            new_res: new_res,
          };
          let response_dump = {
            order_id: order_details.order_id,
            type: order_details?.action.toUpperCase(),
            status: "APPROVED",
            dump: JSON.stringify(req.body),
          };
          if (mode == "test") {
            await order_transactionModel.addTestResDump(response_dump);
          } else {
            await order_transactionModel.addResDump(response_dump);
          }

          ee.once("ping", async () => {
            // Sending mail to customers and merchants about transaction

            const table_name = "orders";
            let order_id = order_details.order_id;
            let qb = await pool.get_connection();
            let merchant_and_customer_transaction_response;
            try {
              merchant_and_customer_transaction_response = await qb
                .select(
                  "md.company_name,md.co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at,o.pan"
                )
                .from(config.table_prefix + order_table + " o")
                .join(
                  config.table_prefix + "master_merchant_details md",
                  "o.merchant_id=md.merchant_id",
                  "inner"
                )
                .join(
                  config.table_prefix + "master_merchant mm",
                  "o.merchant_id=mm.id",
                  "inner"
                )
                .where({
                  "o.order_id": order_id,
                })
                .get();
            } catch (error) {
              console.error("Database query failed:", error);
            } finally {
              qb.release();
            }

            let mail_details = merchant_and_customer_transaction_response[0];
            mail_details.logo = mail_details.logo
              ? process.env.STATIC_URL + "/static/files/" + mail_details.logo
              : "";
            let transaction_date_time = new Date(mail_details.updated_at);
            mail_details.updated_at = moment(transaction_date_time).format(
              "DD-MM-YYYY HH:mm"
            );
            let mail_response = await mailSender.CustomerTransactionMail(
              mail_details
            );
            let merchant_mail_response =
              await mailSender.MerchantTransactionMail(mail_details);
          });

          ee.emit("ping", {
            message: "hello",
          });

          //console.log(" PayTabsControllerClass ~ pay3ds= ~ fraudStatus === true:", fraudStatus === true)

          if (fraudStatus === true) {
            const response_category_fraud = await helpers.get_error_category(
              "143",
              "paydart",
              "FAILED"
            );
            //console.log(" PayTabsControllerClass ~ pay3ds= ~ response_category_fraud:", response_category_fraud)
            const VoidTransactionPayload = {
              order_id: order_details.order_id.toString(),
              txn_id: txn.toString(),
              action: "VOID",
              mode: mode,
            };
            //console.log("PayTabsControllerClass ~ pay3ds= ~ VoidTransactionPayload:", VoidTransactionPayload)
            const voidTransaction = await fraudService.voidTransaction(
              VoidTransactionPayload
            );
            //console.log("PayTabsControllerClass ~ pay3ds= ~ voidTransaction:", voidTransaction)
            if (voidTransaction.status === "success") {
              const payment_id = await helpers.make_sequential_no(
                mode == "test" ? "TST_TXN" : "TXN"
              );
              //console.log("PayTabsControllerClass ~ pay3ds= ~ payment_id:", payment_id)
              const order_txn_update = {
                txn: payment_id,
                order_id: order_details?.order_id || "",
                currency: order_details?.currency || "",
                amount: order_details?.amount || "",
                type: order_details?.action.toUpperCase(),
                status: "FAILED",
                psp_code: "",
                paydart_category: response_category_fraud.category,
                remark: "Blocked by PayDart",
                capture_no: "",
                created_at: updated_at || "",
                payment_id: payment_id || "",
                order_reference_id: order_details?.orderReference || "",
              };

              if (transaction_mode == "test") {
                await orderTransactionModel.test_txn_add(order_txn_update);
              } else {
                await orderTransactionModel.add(order_txn_update);
              }

              //console.log("update_3ds2_ni: ~ fraudResponse:", fraudResponse)
              const new_res = {
                m_order_id: order_details.merchant_order_id || "",
                p_order_id: order_details.order_id || "",
                p_request_id: p_request_id,
                psp_ref_id: tranRef,
                psp_txn_id: "",
                transaction_id: txn,
                status: "FAILED",
                status_code: "143",
                remark: fraudResponse?.message,
                paydart_category: response_category_fraud?.category,
                currency: order_details.currency,
                return_url: order_details.failure_url,
                transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                amount: order_details.amount.toFixed(2),
                m_customer_id: order_details.merchant_customer_id || "",
                psp: order_details.psp,
                payment_method: order_details.payment_mode,
                m_payment_token: order_details.card_id,
                payment_method_data: {
                  scheme: order_details.scheme,
                  card_country: order_details.card_country,
                  card_type: order_details.cardType,
                  mask_card_number: order_details.pan,
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: order_details?.merchant_id || "",
              };

              res_obj = {
                order_status: "FAILED",
                payment_id: order_details?.payment_id,
                order_id: order_details?.order_id,
                amount: order_details?.amount,
                currency: order_details?.currency,
                return_url: order_details?.return_url,
                token: req.body.browserFP || "",
                message: "Payment Failed",
                new_res: new_res,
              };

              await merchantOrderModel.updateDynamic(
                {
                  type: res_order_data?.action.toUpperCase(),
                  status: "FAILED",
                },
                { order_id: cartId },
                order_table
              );
            }
          }

          // event base charges update end
          // web  hook starting
          let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: merchant_id[0].merchant_id,
          });
          let web_hook_res = Object.assign({}, res_obj.new_res);
          delete web_hook_res?.return_url;
          delete web_hook_res?.paydart_category;
          if (hook_info[0]) {
            if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
              let url = hook_info[0].notification_url;
              let webhook_res = await send_webhook_data(
                url,
                web_hook_res,
                hook_info[0].notification_secret
              );
            }
          }
          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: cartId,
            mode: mode,
          });
          //console.log(temp_card_details);
          let txnFailedLog = {
            order_id: cartId,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(req.body),
            res: JSON.stringify(req.body),
            psp: order_details?.psp,
            status_code: respCode,
            description: respMessage,
            activity: "Transaction success with Paytabs",
            status: 0,
            mode: mode,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            txn: txn,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "1",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          //console.log(`TXN LIFE CYCLE LOG`);
          //console.log(txnFailedLog)
          await helpers.addTransactionFailedLogs(txnFailedLog);
          return res
            .status(StatusCode.ok)
            .send(ServerResponse.successdatamsg(res_obj, "Paid successfully."));
        } else {
          const status = "FAILED";
          const txn = await helpers.make_sequential_no(
            mode == "test" ? "TST_TXN" : "TXN"
          );
          let response_category = await helpers.get_error_category(
            respCode,
            "paytabs",
            "FAILED"
          );
          let order_txn = {
            status: status,
            psp_code: respCode ? respCode : "",
            paydart_category: response_category.category,
            remark: response_category.response_details,
            txn: txn,
            type: order_details?.action.toUpperCase(),
            payment_id: tranRef,
            order_id: cartId,
            amount: order_details?.amount,
            currency: order_details?.currency,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            order_reference_id: "",
            capture_no: "",
          };
          if (mode == "test") {
            await order_transactionModel.test_txn_add(order_txn);
          } else {
            await order_transactionModel.add(order_txn);
          }
          let orderupdate = {
            os: req.headers.os,
            browser: req.headers.browser,
            browser_version: req.headers.browser_version,
            browser_fingerprint: req.headers.fp,
            payment_id: txn,
            psp: "PAYTABS",
            status: status,
            "3ds": "1",
            "3ds_status": "Authentication Failed"
          };
          await merchantOrderModel.updateDynamic(
            orderupdate,
            {
              order_id: order_details?.order_id,
            },
            order_table
          );
          // adding dump entry
          let response_dump = {
            order_id: cartId,
            type: order_details?.action.toUpperCase(),
            status: status,
            dump: JSON.stringify(req.body),
          };
          if (mode == "test") {
            await order_transactionModel.addTestResDump(response_dump);
          } else {
            await order_transactionModel.addResDump(response_dump);
          }
          const browser_token = {
            os: req.headers?.os,
            browser: req.headers?.browser,
            browser_version: req.headers?.browser_version,
            browser_fingerprint: req.headers?.fp,
          };
          let p_request_id = await helpers.make_sequential_no("REQ");
          let order_req = {
            // merchant_id: req.credentials.merchant_id,
            order_id: order_details.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          let new_res = {
            m_order_id: order_details.merchant_order_id
              ? order_details.merchant_order_id
              : "",
            p_order_id: order_details.order_id ? order_details.order_id : "",
            p_request_id: p_request_id,
            psp_ref_id: tranRef,
            psp_txn_id: "",
            transaction_id: txn,
            status: "FAILED",
            status_code: respCode,
            remark: response_category?.response_details
              ? response_category?.response_details
              : "",
            paydart_category: response_category?.category,
            currency: order_details.currency,
            return_url: order_details.failure_url,
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            amount: order_details.amount.toFixed(2),
            m_customer_id: order_details.merchant_customer_id,
            psp: "PAYTABS",
            payment_method: order_details.cardType,
            m_payment_token: order_details.card_id,
            payment_method_data: {
              scheme: order_details.scheme,
              card_country: order_details.card_country,
              card_type: order_details.cardType,
              mask_card_number: order_details.pan,
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: enc_dec.cjs_encrypt(
              order_details.merchant_id
            ),
          };
          const res_obj = {
            order_status: status,
            payment_id: txn,
            order_id: cartId,
            amount: order_details?.amount,
            currency: order_details?.currency,
            token:
              encrypt_decrypt("encrypt", JSON.stringify(browser_token)) || "",
            return_url: order_details.return_url,
            message: respMessage,
            new_res: new_res,
          };

          let temp_card_details = await helpers.fetchTempLastCard({
            order_id: cartId,
            mode: mode,
          });
          //console.log(temp_card_details);
          let txnFailedLog = {
            order_id: cartId,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(req.body),
            res: JSON.stringify(req.body),
            psp: order_details?.psp,
            status_code: respCode,
            description: respMessage,
            activity: "Transaction failed with Paytabs",
            status: 1,
            mode: mode,
            card_holder_name: temp_card_details.card_holder_name,
            card: temp_card_details.card,
            expiry: temp_card_details.expiry,
            cipher_id: temp_card_details.cipher_id,
            txn: txn,
            card_proxy: temp_card_details.card_proxy,
            "3ds_version": "1",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          //console.log(`TXN FAILED LOG 6`);
          //console.log(txnFailedLog)
          await helpers.addTransactionFailedLogs(txnFailedLog);
          return res
            .status(StatusCode.ok)
            .send(ServerResponse.errorMsgWithData(respMessage, res_obj));
        }
      } else {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg("INVALID Signature"));
      }
    } catch (error) {
      winston.error(error);

      return res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(error?.message));
    }
  };

  paytabs_refund = async (req, res) => {
    try {
      const {
        p_order_id,
        amount: { currencyCode, value },
        txn_id,
      } = req.body;
      let order_id = p_order_id;
      let mode = req?.credentails?.type || req?.body?.mode;
      const order_details = await merchantOrderModel.selectOne(
        "*",
        { order_id: order_id },
        mode == "test" ? "test_orders" : "orders"
      );
      // const _Paytabs = JSON.parse(process.env.PAYTABS);
      const get_paymentid = await merchantOrderModel.selectOne(
        "payment_id,amount",
        { order_id: order_id, txn: txn_id },
        mode == "test" ? "test_order_txn" : "order_txn"
      );
      if (!get_paymentid) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Transaction is not Completed !! Can not void /refund"
            )
          );
      }
      let total_refunded_details =
        await orderTransactionModel.selectRefundedAmount(
          "*",
          { order_id: req.bodyString("p_order_id") },
          mode == "test" ? "test_order_txn" : "order_txn"
        );
      let check_amount = 0.0;
      let total_amount_refunded = parseInt(total_refunded_details.amount);
      let amount_to_refund = parseInt(req.body.amount.value);
      let total = total_amount_refunded + amount_to_refund;
      let amount_captured = order_details.amount;
      check_amount = amount_captured - total;
      let order_status = "REFUNDED";
      let txn_type = "REFUND";
      if (check_amount > 0) {
        order_status = "PARTIALLY_REFUNDED";
        txn_type = "PARTIALLY_REFUND";
      }
      const txn = await helpers.make_sequential_no(
        mode == "test" ? "TST_TXN" : "TXN"
      );

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        { order_id: req.bodyString("p_order_id") },
        mode == "test" ? "test_orders" : "orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        { terminal_id: _terminalids.terminal_id },
        "mid"
      );
      if (!_getmid) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg("No Routes  Available for Transaction")
          );
      }

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        { id: _getmid.psp_id },
        "psp"
      );
      if (!_pspid) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      const body_data = {
        profile_id: _terminalcred.MID,
        tran_type: "refund",
        cart_description: order_details?.description,
        tran_ref: get_paymentid?.payment_id,
        cart_id: txn.toString(),
        cart_currency: currencyCode,
        cart_amount: parseFloat(value).toFixed(2),
        tran_class: "ecom",
      };
      const config = {
        method: "post",
        url: credientials[_pspid.credentials_key].base_url,
        headers: {
          authorization: _terminalcred.password,
        },
        data: body_data,
      };

      let result = await axios(config);

      const response = result.data;
      if (response.payment_result.response_status == "A") {
        let order_update = {
          status: order_status,
        };

        await merchantOrderModel.updateDynamic(
          order_update,
          { order_id: order_id },
          mode == "test" ? "test_orders" : "orders"
        );
        const uid = new ShortUniqueId({ length: 10 });
        let generate_payment_id = uid();

        const order_txn = {
          order_id: order_id,
          type: txn_type,
          txn: txn,
          status: "AUTHORISED",
          amount: req.body.amount.value,
          currency: req.body.amount.currencyCode,
          remark: req.bodyString("remark"),
          payment_id: response.tran_ref,
          txn_ref_id: req.bodyString("txn_id"),
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await order_transactionModel.test_txn_add(order_txn);
        } else {
          await order_transactionModel.add(order_txn);
        }

        const resp_dump = {
          order_id: order_id,
          type: "REFUND",
          status: "AUTHORISED",
          dump: JSON.stringify(response),
        };

        if (mode == "test") {
          await order_transactionModel.addTestResDump(resp_dump);
        } else {
          await order_transactionModel.addResDump(resp_dump);
        }
        const res_obj = {
          order_status: "REFUND",
          payment_id: txn,
          order_id: order_id,
          amount: order_details.amount,
          currency: order_details.currency,
        };

        let web_hook_res = {
          m_order_id: order_details.merchant_order_id,
          p_order_id: order_details.order_id,
          p_request_id: generate_payment_id,
          psp_ref_id: "",
          psp_txn_id: response.tran_ref,
          transaction_id: "",
          status: "SUCCESS",
          status_code: txn_type,
          currency: order_details.currency,
          transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          amount: req.body.amount.value,
          m_customer_id: order_details.merchant_customer_id
            ? order_details.merchant_customer_id
            : "",
          psp: order_details.psp,
          payment_method: order_details.payment_mode,
          m_payment_token: "",
          payment_method_data: {
            scheme: order_details.scheme,
            card_country: order_details.card_country,
            card_type: order_details.cardType,
            mask_card_number: order_details.pan,
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: enc_dec.cjs_encrypt(
            order_details.merchant_id
          ),
        };
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: req?.user?.merchant_id || req?.credentails?.merchant_id,
        });

        if (hook_info[0]) {
          if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              web_hook_res,
              hook_info[0].notification_secret
            );
          }
        }
        if (order_details.origin == "PAYMENT LINK" && txn_type == "REFUND") {
          let updateQrPayment = await orderTransactionModel.updateDynamic(
            { payment_status: "REFUNDED" },
            { order_no: order_details.order_id },
            "qr_payment"
          );
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.successansmsg(res_obj, "Refunded Successfully.")
          );
      } else {
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.errormsg(response.payment_result.response_message)
          );
      }
    } catch (error) {
      console.log(error);
      winston.error(error);

      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(error?.response?.data?.message || ""));
    }
  };

  paytabs_void = async (req, res) => {
    try {
      let mode = req?.credentails?.type || req?.body?.mode;
      const {
        p_order_id,
        amount: { currencyCode, value },
        txn_id,
      } = req.body;

      let order_id = p_order_id;
      const order_details = await merchantOrderModel.selectOne(
        "*",
        { order_id: order_id },
        mode == "test" ? "test_orders" : "orders"
      );
      // const _Paytabs = JSON.parse(process.env.PAYTABS);
      const get_paymentid = await merchantOrderModel.selectOne(
        "payment_id",
        { order_id: order_id, txn: txn_id },
        mode == "test" ? "test_order_txn" : "order_txn"
      );
      if (!get_paymentid) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Transaction is not Completed !! Can not void /refund"
            )
          );
      }

      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        { order_id: req.bodyString("p_order_id") },
        mode == "test" ? "test_orders" : "orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        { terminal_id: _terminalids.terminal_id },
        "mid"
      );
      if (!_getmid) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg("No Routes  Available for Transaction")
          );
      }

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        { id: _getmid.psp_id },
        "psp"
      );
      if (!_pspid) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      const body_data = {
        profile_id: _terminalcred.MID,
        tran_type: "void",
        cart_description: order_details?.description,
        tran_ref: get_paymentid?.payment_id,
        cart_id: order_id,
        cart_currency: currencyCode,
        cart_amount: parseFloat(value).toFixed(2),
        tran_class: "ecom",
      };
      const config = {
        method: "post",
        url: credientials[_pspid.credentials_key].base_url,
        headers: {
          authorization: _terminalcred.password,
        },
        data: body_data,
      };
      await axios(config)
        .then(async (result) => {
          //console.log(`in then of paytabs void`)
          //console.log(result.data);
          const response = result.data;

          if (response.payment_result.response_status == "A") {
            let order_update = {
              status: "VOID",
            };
            await merchantOrderModel.updateDynamic(
              order_update,
              { order_id: order_id },
              mode == "test" ? "test_orders" : "orders"
            );
            const uid = new ShortUniqueId({ length: 10 });
            let generate_payment_id = uid();
            const txn = await helpers.make_sequential_no(
              mode == "test" ? "TST_TXN" : "TXN"
            );
            let remark = "";
            if (
              order_details.status == "CAPTURED" ||
              order_details.status == "PARTIALLY_CAPTURED"
            ) {
              remark = "Captured Reversal";
            } else if (
              order_details.status == "REFUNDED" ||
              order_details.status == "PARTIALLY_REFUNED"
            ) {
              remark = "Refund Reversal";
            } else {
              remark = "AUTH Reversal";
            }
            const order_txn = {
              order_id: order_id,
              type: "VOID",
              txn: txn,
              status: "AUTHORISED",
              is_voided: 1,
              amount: req.body.amount.value,
              currency: req.body.amount.currencyCode,
              remark: remark,
              payment_id: response.tran_ref,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              txn_ref_id: req.bodyString("txn_id"),
            };
            if (mode == "test") {
              await order_transactionModel.test_txn_add(order_txn);
            } else {
              await order_transactionModel.add(order_txn);
            }

            let txn_update = await merchantOrderModel.updateDynamic(
              { is_voided: 1 },
              { txn: req.bodyString("txn_id") },
              mode == "test" ? "test_order_txn" : "order_txn"
            );
            const resp_dump = {
              order_id: order_id,
              type: "VOID",
              status: "APPROVED",
              dump: JSON.stringify(response),
            };
            if (mode == "test") {
              await order_transactionModel.addTestResDump(resp_dump);
            } else {
              await order_transactionModel.addResDump(resp_dump);
            }
            const res_obj = {
              order_status: "VOID",
              payment_id: txn,
              order_id: order_id,
              amount: order_details.amount,
              currency: order_details.currency,
            };

            let web_hook_res = {
              m_order_id: order_details.merchant_order_id,
              p_order_id: order_details.order_id,
              p_request_id: generate_payment_id,
              psp_ref_id: response.tran_ref,
              psp_txn_id: "",
              transaction_id: "",
              status: "SUCCESS",
              status_code: remark,
              currency: order_details.currency,
              transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              amount: req.body.amount.value,
              m_customer_id: order_details.merchant_customer_id
                ? order_details.merchant_customer_id
                : "",
              psp: order_details.psp,
              payment_method: order_details.payment_mode,
              m_payment_token: "",
              payment_method_data: {
                scheme: order_details.scheme,
                card_country: order_details.card_country,
                card_type: order_details.cardType,
                mask_card_number: order_details.pan,
              },
              apm_name: "",
              apm_identifier: "",
              sub_merchant_identifier: enc_dec.cjs_encrypt(
                order_details.merchant_id
              ),
            };
            let hook_info = await helpers.get_data_list(
              "*",
              "webhook_settings",
              {
                merchant_id:
                  req?.user?.merchant_id || req?.credentails?.merchant_id,
              }
            );

            if (hook_info[0]) {
              if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                  url,
                  web_hook_res,
                  hook_info[0].notification_secret
                );
              }
            }
            return res
              .status(StatusCode.ok)
              .send(
                ServerResponse.successansmsg(res_obj, "Void Successfully.")
              );
          } else {
            return res
              .status(StatusCode.ok)
              .send(ServerResponse.errormsg("Unable to initiate Void."));
          }
        })
        .catch((error) => {
          //console.log(`in error of paytabs void`)
          console.log(error);
          winston.error(error);

          if (error?.response?.data) {
            return res
              .status(StatusCode.ok)
              .send(ServerResponse.errormsg(error?.response?.data?.message));
          }
          return res
            .status(StatusCode.ok)
            .send(ServerResponse.errormsg("Unable to initiate Void."));
        });
    } catch (error) {
      winston.error(error);
      console.log(error);
      res.status(StatusCode.ok).send(ServerResponse.errormsg(error?.message));
    }
  };
  paytabs_capture = async (req, res) => {
    let mode = req?.credentails?.type || req?.body?.mode;
    if (req.bodyString("reason") == "") {
      req.body.reason = "Paytabs";
      // res.status(StatusCode.ok).send(
      //     ServerResponse.errormsg(
      //         "Reason required"
      //     )
      // );
    }

    // const _Paytabs = credientials.paytabs.base_url;
    let order_id = req.bodyString("p_order_id");

    let captured_data = await order_transactionModel.selectOne(
      "order_reference_id,payment_id,amount,currency",
      {
        order_id: order_id.toString(),
        status: "AUTHORISED",
      },
      mode == "live" ? "order_txn" : "test_order_txn"
    );

    let order_details = await order_transactionModel.selectOne(
      "*",
      {
        order_id: order_id.toString(),
      },
      mode == "live" ? "orders" : "test_orders"
    );

    try {
      let get_order_amount = await order_transactionModel.selectOne(
        "amount_left,merchant_order_id,psp_id,amount",
        {
          order_id: order_id.toString(),
          //status: "AUTHORISED",
        },
        mode == "live" ? "orders" : "test_orders"
      );

      let get_partial_order_amount =
        await order_transactionModel.selectCaptureAmountSum(
          "*",
          {
            order_id: req.bodyString("p_order_id"),
          },
          mode == "live" ? "order_txn" : "test_order_txn"
        );

      let check_amount = 0.0;
      check_amount =
        parseFloat(get_order_amount.amount) -
        (parseFloat(get_partial_order_amount.amount) +
          parseFloat(req.body.amount.value));
      let status = "CAPTURED";
      let txn_type = "CAPTURE";
      if (check_amount > 0) {
        status = "PARTIALLY_CAPTURED";
        txn_type = "PARTIALLY_CAPTURE";
      }
      const txn = await helpers.make_sequential_no(
        mode == "test" ? "TST_TXN" : "TXN"
      );
      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        { order_id: req.bodyString("p_order_id") },
        mode == "live" ? "orders" : "test_orders"
      );
      const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id,autoCaptureWithinTime,is3DS",
        { terminal_id: _terminalids.terminal_id },
        "mid"
      );
      if (!_getmid) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg("No Routes  Available for Transaction")
          );
      }

      const _pspid = await merchantOrderModel.selectOne(
        "*",
        { id: _getmid.psp_id },
        "psp"
      );
      if (!_pspid) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg("No Psp Available"));
      }
      const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: credientials[_pspid.credentials_key].base_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
      };
      const body_data = {
        profile_id: _terminalcred.MID,
        tran_type: "capture",
        tran_class: "ecom",
        tran_ref: captured_data.order_reference_id,
        cart_id: txn.toString(),
        cart_description: req.body.reason,
        cart_currency: req.body.amount.currencyCode,
        cart_amount: req.body.amount.value,
      };
      const config = {
        method: "post",
        url: credientials[_pspid.credentials_key].base_url,
        headers: {
          authorization: _terminalcred.password,
        },
        data: body_data,
      };
      //console.log(`config of partial capture`)
      //console.log(config)
      let result = await axios(config);
      const response = result.data;
      //console.log(JSON.stringify(response));
      if (response.payment_result.response_status == "A") {
        let order_update = {
          status: "CAPTURED",
        };

        if (check_amount > 0) {
          order_update.amount_left = check_amount;
          order_update.status = "PARTIALLY_CAPTURED";
        }
        await merchantOrderModel.updateDynamic(
          order_update,
          { order_id: order_id },
          mode == "live" ? "orders" : "test_orders"
        );
        const uid = new ShortUniqueId({ length: 10 });
        let generate_payment_id = await helpers.make_sequential_no(
          mode == "test" ? "TST_TXN" : "TXN"
        );

        const order_txn = {
          order_id: order_id,
          type: txn_type,
          txn: txn,
          status: "AUTHORISED",
          amount: req.body.amount.value,
          currency: req.body.amount.currencyCode,
          remark: req.bodyString("reason"),
          payment_id: response.tran_ref,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await order_transactionModel.test_txn_add(order_txn);
        } else {
          await order_transactionModel.add(order_txn);
        }
        const resp_dump = {
          order_id: order_id,
          type: status,
          status: "APPROVED",
          dump: JSON.stringify(response),
        };
        if (mode == "test") {
          await order_transactionModel.addTestResDump(resp_dump);
        } else {
          await order_transactionModel.addResDump(resp_dump);
        }

        const res_obj = {
          status: check_amount > 0 ? "PARTIALLY_CAPTURE" : "CAPTURE",
          m_order_id: order_details.merchant_order_id,
          p_order_id: order_details.order_id,
          p_request_id: generate_payment_id,
          psp_txn_id: response.tran_ref,
          transaction_id: txn,
          amount: Number(req.body.amount.value).toFixed(2),
          currency: order_details.currency,
        };

        let web_hook_res = {
          m_order_id: order_details.merchant_order_id,
          p_order_id: order_details.order_id,
          p_request_id: generate_payment_id,
          psp_ref_id: "",
          psp_txn_id: response.tran_ref,
          transaction_id: "",
          status: "SUCCESS",
          status_code: check_amount > 0 ? "PARTIALLY_CAPTURE" : "CAPTURE",
          currency: order_details.currency,
          transaction_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          amount: Number(req.body.amount.value).toFixed(2),
          m_customer_id: order_details.merchant_customer_id
            ? order_details.merchant_customer_id
            : "",
          psp: order_details.psp,
          payment_method: order_details.payment_mode,
          m_payment_token: "",
          payment_method_data: {
            scheme: order_details.scheme,
            card_country: order_details.card_country,
            card_type: order_details.cardType,
            mask_card_number: order_details.pan,
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: enc_dec.cjs_encrypt(
            order_details.merchant_id
          ),
        };
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: req?.user?.merchant_id || req?.credentails?.merchant_id,
        });

        if (hook_info[0]) {
          if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              web_hook_res,
              hook_info[0].notification_secret
            );
          }
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.successansmsg(res_obj, "Captured Successfully.")
          );
      } else {
        const uid = new ShortUniqueId({ length: 10 });
        const txn = await helpers.make_sequential_no(
          mode == "test" ? "TST_TXN" : "TXN"
        );
        const order_txn = {
          order_id: order_id,
          type: status,
          txn: txn,
          status: "FAILED",
          amount: Number(req.body.amount.value).toFixed(2),
          currency: req.body.amount.currencyCode,
          remark: req.bodyString("reason"),
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        if (mode == "test") {
          await order_transactionModel.test_txn_add(order_txn);
        } else {
          await order_transactionModel.add(order_txn);
        }

        const resp_dump = {
          order_id: order_id,
          type: status,
          status: "FAILED",
          dump: JSON.stringify(response),
        };
        if (mode == "test") {
          await order_transactionModel.addTestResDump(resp_dump);
        } else {
          await order_transactionModel.addResDump(resp_dump);
        }

        const res_obj = {
          order_status: "FAILED",
          payment_id: txn,
          order_id: order_id,
          amount: Number(req.body.amount.value).toFixed(2),
          currency: order_details.currency,
        };
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.errorMsgWithData(
              response.payment_result.response_message,
              res_obj
            )
          );
      }
    } catch (error) {
      winston.error(error);
      console.log(error);
      let resp_dump = {
        order_id: req.bodyString("p_order_id"),
        type: "CAPTURED",
        status: "FAILED",
        dump: JSON.stringify(error?.response?.data),
      };
      if (mode == "test") {
        await order_transactionModel.addTestResDump(resp_dump);
      } else {
        await order_transactionModel.addResDump(resp_dump);
      }

      if (error instanceof axios.AxiosError) {
        // Axios error occurred
        if (
          error.response &&
          error.response.data &&
          error.response.data.errors &&
          error.response.data.errors.length > 0
        ) {
          // The request was made and the server responded with an error status code
          const errorMessage = error.response.data.errors[0].message;
          res.status(StatusCode.ok).send(ServerResponse.errorMsg(errorMessage));
        } else if (!error.response) {
          // No response received from the server
          res
            .status(StatusCode.ok)
            .send(
              ServerResponse.errorMsg("No response received from the server")
            );
        } else {
          // Error occurred while setting up the request
          res
            .status(StatusCode.ok)
            .send(
              ServerResponse.errormsg(
                "Error occurred while sending the request"
              )
            );
        }
      } else {
        // Other types of errors
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.errorMsg(
              "Webhook unable to handle response or request"
            )
          );
      }
    }
  };
}

const PayTabsController = new PayTabsControllerClass();
module.exports = PayTabsController;
function maskify(creditCard) {
  if (creditCard.length < 6) return creditCard;
  const last4Characters = creditCard.substr(-4);
  const firstCharacter = creditCard.substr(0, 6);
  const maskingCharacters = creditCard
    .substr(-4, creditCard.length - 5)
    .replace(/\d/g, "x");
  return `${firstCharacter}${maskingCharacters}${last4Characters}`;
}
function getClientIP(req) {
  try {
    const xForwardedFor = req.headers['x-forwarded-for'];
    console.log(`here we got xForwarded for`);
    console.log(xForwardedFor);
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',');
      if (ips.length > 0) {
        return ips[0].trim(); // Use the first IP in the list
      }
    }
    return req.socket.remoteAddress; // Fallback to remoteAddress
  } catch (error) {
    console.error('Error retrieving client IP:', error);
    return 'Unknown IP'; // Default value or handling
  }
}