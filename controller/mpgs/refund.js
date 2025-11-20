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
const calculateTransactionCharges = require("../../utilities/charges/transaction-charges/index");
const logger = require('../../config/logger');

const mpgs_refund = async (req, res) => {
  let txn_id = req.bodyString("txn_id");
  let mode = req?.credentials?.type || req?.body?.mode;
  let captured_data = await orderTransactionModel.selectOneWithTwoOfOneStatus(
    "order_id,capture_no,amount,currency,payment_id,status,type,order_reference_id",
    {
      txn: txn_id,
      status: "AUTHORISED"
    },
    mode == 'test' ? 'test_order_txn' : "order_txn"
  );
  const order_id = captured_data.order_id;

  const order_details = await orderTransactionModel.selectOne(
    "*",
    { order_id: order_id },
    mode == 'test' ? "test_orders" : "orders"
  );
  let walletDetails = await orderTransactionModel.selectWalletBalanceTotal(order_details.merchant_id,order_details.currency);
  let totalBalance = walletDetails.wallet_balance;
  if (totalBalance < req.body.amount.value) {
  return  res
      .status(statusCode.ok)
      .send(
        Server_response.errormsg("Insufficient funds.")
      );
  }

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
      console.log(order_id);
      const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
          order_id: order_id,
        },
        mode == 'test' ? "test_orders" : "orders"
      );
      console.log(`terminal id is here`);
      console.log(_terminalids);
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
      const basicAuthToken = await helpers.createBasicAuthToken(username, password);
      let generate_payment_id = await helpers.make_sequential_no(mode == 'live' ? "TXN" : "TST_TXN");
      let data = JSON.stringify({
        "apiOperation": "REFUND",
        "transaction": {
          "amount": amount_to_refund,
          "currency": captured_data.currency,
          "reference": uuidv4()
        }
      });
      let url = mode == "live" ? creds[_pspid.credentials_key].base_url : creds[_pspid.credentials_key].test_url;
      let config = {
        method: 'put',
        maxBodyLength: Infinity,
        url: `${url}/merchant/${mid_details.MID}/order/${order_id}/transaction/${generate_payment_id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': basicAuthToken
        },
        data: data
      };
      const response = await axios.request(config);

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
          payment_id: response.data.transaction.reference
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
          merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
        });

        if (hook_info[0]) {
          if (hook_info[0].enabled === 0 && hook_info[0].notification_url != '') {
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
        if ((order_status === "REFUNDED" ||
          order_status === "PARTIALLY_REFUNDED")  && mode==process.env.CHARGES_MODE) {
          const transaction_and_feature_data = {
            amount: req.body.amount.value,
            currency: order_details?.currency,
            order_id: order_details?.order_id,
            merchant_id: order_details?.merchant_id,
            card_country: order_details?.card_country,
            payment_method: order_details?.payment_mode,
            scheme: order_details?.scheme,
            psp_id: order_details?.psp_id,
            terminal_id: order_details?.terminal_id,
            origin: order_details?.origin,
            //every time change param
            payment_id: response.data.transaction.acquirer.transactionId,
            order_status: 'REFUNDED',
            txn_status: (response?.data.result === 'SUCCESS') ? "AUTHORISED" : "FAILED",
            txn_id: generate_payment_id.toString(),
            txn_ref_id:txn_id
          
          };

          // transaction charge
          calculateTransactionCharges(transaction_and_feature_data);
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
      logger.error(500,{message: error,stack: error.stack}); 
      let resp_dump = {
        order_id: order_id,
        type: "REFUND",
        status: "FAILED",
        dump: JSON.stringify(error.response.data),
      };
      if (mode == 'test') {
        await orderTransactionModel.addTestResDump(resp_dump);
      } else {
        await orderTransactionModel.addResDump(resp_dump);
      }
      res
        .status(statusCode.ok)
        .send(Server_response.errormsg(error.message));
    }
  } else {
    res
      .status(statusCode.ok)
      .send(
        Server_response.errormsg("Invalid TXN ID or transaction is not captured yet.")
      );
  }
}


module.exports = mpgs_refund;