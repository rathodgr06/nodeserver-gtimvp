const axios = require('axios');
const creds = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const orderTransactionModel = require('../../models/order_transaction');
const { send_webhook_data } = require("../../controller/webhook_settings");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');



const myf_refund = async (req, res) => {
  let txn_id = req.bodyString("txn_id");
  const order_id = req.body.order_id;
  let mode = req?.credentials?.type || req?.body?.mode;
  const order_details = await orderTransactionModel.selectOne(
    "*",
    { order_id: order_id },
    mode == 'test' ? "test_orders" : "orders"
  );

  let captured_data = await orderTransactionModel.selectOneWithTwoOfOneStatus(
    "capture_no,amount,currency,payment_id,status,type,order_reference_id",
    {
      txn: txn_id,
      status: "AUTHORISED"
    },
    mode == 'test' ? 'test_order_txn' : "order_txn"
  );

  if (captured_data &&
    (captured_data.type == "CAPTURE"
      || captured_data.type == "SALE"
      || captured_data.type == "PARTIALLY_CAPTURE")
    && captured_data.status == "AUTHORISED"
  ) {
    try {
      let total_refunded_details =
        await orderTransactionModel.selectRefundedAmount(
          "*",
          { order_id: req.bodyString("order_id") },
          mode == 'test' ? 'test_order_txn' : "order_txn"
        );

      let check_amount = 0.0;
      let total_amount_refunded = parseInt(total_refunded_details.amount);
      let amount_to_refund = parseInt(req.body.amount.value);
      let total = total_amount_refunded + amount_to_refund;
      let amount_captured = captured_data.amount;
      check_amount = amount_captured - total;
      let order_status = "REFUNDED";
      let txn_type = "REFUND";
      if (check_amount > 0) {
        order_status = "PARTIALLY_REFUNDED";
        txn_type = "PARTIALLY_REFUND";
      }
   
      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: order_id,
        },
        mode == 'test' ? "test_orders" : "orders"
      );
      const mid_details = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        {
          terminal_id: _terminalids.terminal_id,
        },
        "mid"
      );

      if (!mid_details) {
        res
          .status(statusCode.badRequest)
          .send(Server_response.errormsg("No Terminal Available"));
      }
      const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
          id: mid_details.psp_id,
        },
        "psp"
      );
      if (!_pspid) {
        res
          .status(statusCode.badRequest)
          .send(Server_response.errormsg("No Psp Available"));
      }
      const username = `merchant.${mid_details.MID}`;
      const password = mid_details.password;
      let generate_payment_id = await helpers.make_sequential_no(mode == 'live' ? "TXN" : "TST_TXN");
      let data = JSON.stringify({
        "Key": captured_data.payment_id,
        "KeyType": "PaymentId",
        "ServiceChargeOnCustomer": false,
        "Amount": amount_to_refund,
        "Comment": amount_captured == amount_to_refund ? "refund to the customer" : "partial refund to the customer",
        "AmountDeductedFromSupplier": 0
      });

      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: mode=="test"?`${creds.myf.test_url}MakeRefund`:`${creds.myf.base_url}MakeRefund`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + password
        },
        data: data
      };
      console.log(`here is config`)
      console.log(config);
      const response = await axios.request(config);
      console.log(`response refund`);
      console.log(response);
      if (response) {
        let order_update = {
          status: order_status,
        };
        await merchantOrderModel.updateDynamic(
          order_update,
          {
            order_id: order_id,
          },
          mode == 'test' ? "test_orders" : "orders"
        );
        let order_txn = {
          order_id: order_id,
          type: txn_type,
          txn: generate_payment_id,
          status: (order_status === "REFUNDED" ||
            order_status === "PARTIALLY_REFUNDED")
            ? "AUTHORISED"
            : "FAILED",
          amount: req.body.amount.value,
          currency: req.body.amount.currencyCode,
          remark: req.body.remark || "",
          txn_ref_id: txn_id,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          payment_id: response.data.Data.RefundReference
        };
        const insert_to_tnx_table = mode === 'live' ? orderTransactionModel.add : orderTransactionModel.test_txn_add;
        insert_to_tnx_table(order_txn);

        let resp_dump = {
          order_id: order_id,
          type: txn_type,
          status: "APPROVED",
          dump: JSON.stringify(response.data),
        };
        const addResDumpFunc = mode == 'live' ? orderTransactionModel.addResDump : orderTransactionModel.addTestResDump
        addResDumpFunc(resp_dump);

        let res_obj = {
          order_status: order_status,
          payment_id: order_txn.txn,
          order_id: order_txn.order_id,
          amount: order_txn.amount,
          currency: order_txn.currency,
        };

        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
          merchant_id: req.user.merchant_id || req.credentials.merchant_id,
        });

        if (hook_info[0]) {
          if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
              url,
              res_obj,
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
        res
          .status(statusCode.ok)
          .send(Server_response.successansmsg(res_obj, "Refunded Successfully."));
      } else {
        res
          .status(statusCode.ok)
          .send(Server_response.errormsg("Unable to initiate refund."));
      }
    } catch (error) {
      console.log(`here 11`)
      console.log(error);
      let resp_dump = {
        order_id: order_id,
        type: "REFUND",
        status: "FAILED",
        dump: JSON.stringify(error?.response?.data),
      };
      if (mode == 'test') {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
      }
      res
        .status(statusCode.ok)
        .send(Server_response.errormsg(error?.response?.data?.Message));
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        Server_response.errormsg("Invalid TXN ID or transaction is not captured yet.")
      );
  }
}


module.exports = myf_refund;