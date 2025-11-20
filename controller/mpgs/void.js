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

const mpgs_void = async (req, res) => {
    console.log("mpgs void starts........");
    let mode = req?.credentials?.type || req?.body?.mode;

    const txn_id = req.body.txn_id;
    let captured_data = await orderTransactionModel.selectOneDecremental(
        "*",
        {
            txn: txn_id,
            status: "AUTHORISED",
        },
        mode == 'test' ? 'test_order_txn' : "order_txn"
    );
    const order_id = captured_data.order_id;
    const order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: order_id },
        mode == 'test' ? 'test_orders' : "orders"
    );
    let walletDetails = await orderTransactionModel.selectWalletBalanceTotal(order_details.merchant_id,order_details.currency);
    let totalBalance = walletDetails.wallet_balance;
    console.log("total balance is: " + totalBalance);
    console.log("captured amount is: ");
    console.log(captured_data);
    console.log("order id is: " + order_id);
    if (totalBalance < captured_data.amount && (captured_data.type=="CAPTURE" || captured_data.type=="PARTIALLY_CAPTURE")) {
    return  res
        .status(statusCode.ok)
        .send(
          Server_response.errormsg("Unable to void transaction insufficient funds.")
        );
    }
    try {
        const _terminalids = await merchantOrderModel.selectOne(
            "terminal_id",
            {
                order_id: order_id,
            },
            mode == 'test' ? 'test_orders' : "orders"
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
        const generate_payment_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : 'TXN');
        const username = `merchant.${mid_details.MID}`;
        const password = mid_details.password;
        const basicAuthToken = await helpers.createBasicAuthToken(username, password);
        let data = JSON.stringify({
            "apiOperation": "VOID",
            "transaction": {
                "targetTransactionId": txn_id,
                "reference": uuidv4()
            }
        });
        let url = mode == "live" ? creds[_pspid.credentials_key].base_url : creds[_pspid.credentials_key].test_url;
        let config = {
            method: 'put',
            maxBodyLength: Infinity,
            url: `${url}merchant/${mid_details.MID}/order/${order_id}/transaction/${generate_payment_id}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': basicAuthToken
            },
            data: data
        };
        console.log("void url is: " + config.url);
        console.log("void data is : " + config.data);
        const response = await axios.request(config);
        let remark = "";
        if (
            order_details.status == "CAPTURED" ||
            order_details.status == "PARTIALLY_CAPTURED"
        ) {
            remark = "Captured Reversal";
        } else if (
            order_details.status == "REFUNDED" ||
            order_details.status == "PARTIALLY_REFUNDED"
        ) {
            remark = "Refund Reversal";
        } else {
            remark = "AUTH Reversal";
        }
        const order_txn = {
            order_id: order_id,
            type: response.data.result == "SUCCESS" ? "VOID" : "FAILED",
            is_voided: response.data.result == "SUCCESS" ? 1 : 0,
            txn: generate_payment_id,
            status: response.data.result == "SUCCESS" ? "AUTHORISED" : "FAILED",
            amount: captured_data?.amount,
            currency: captured_data?.currency,
            payment_id: response.data.transaction.reference,
            remark: remark,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            txn_ref_id: txn_id,
        };
        const insert_to_tnx_table = mode === 'live' ? orderTransactionModel.add : orderTransactionModel.test_txn_add;
        insert_to_tnx_table(order_txn);
        let txn_update = await merchantOrderModel.updateDynamic(
            { is_voided: 1 },
            { txn: txn_id },
            mode == 'test' ? 'test_order_txn' : "order_txn"
        );

        if (response.data.result == "SUCCESS") {
            let order_update = {
                status: "VOID",
            };
            await merchantOrderModel.updateDynamic(
                order_update,
                {
                    order_id: order_id,
                },
                mode == 'test' ? 'test_orders' : "orders"
            );

        }
        let resp_dump = {
            order_id: order_id,
            type: "VOID",
            status: "APPROVED",
            dump: JSON.stringify(response.data)
        };
        const addResDumpFunc = mode == 'live' ? orderTransactionModel.addResDump : orderTransactionModel.addTestResDump
        addResDumpFunc(resp_dump);

        const res_obj = {
            status: response.data.result == "SUCCESS" ? "VOID" : "FAILED",
            p_order_id: order_txn.order_id,
            p_request_id: order_txn.txn,
            p_ref_id: response.data.transaction.receipt,
            transaction_id: generate_payment_id,
            amount: order_txn.amount.toFixed(2),
            currency: order_txn.currency,
            date: moment(order_txn.created_at).format("DD/MM/YYYY"),
        };

        let web_hook_res = {
            m_order_id: order_details.merchant_order_id,
            p_order_id: order_details.order_id,
            p_request_id: generate_payment_id,
            psp_ref_id: response.data.transaction.receipt,
            psp_txn_id: response.data.transaction.acquirer.transactionId,
            transaction_id: generate_payment_id,
            status: "SUCCESS",
            status_code: remark,
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
            sub_merchant_identifier: order_details?.merchant_id
                ? await helpers.formatNumber(order_details?.merchant_id)
                : "",
        };
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: req?.user?.merchant_id || req?.credentials?.merchant_id,
        });

        if (hook_info[0]) {
            if (hook_info[0].enabled === 0 && hook_info[0].notification_url != '') {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                    url,
                    web_hook_res,
                    hook_info[0].notification_secret
                );
            }
        }
        /* Add check for refund or partially refund or capture or partially capture is voiding*/
        if (response.data.result == "SUCCESS"  && mode==process.env.CHARGES_MODE) {
            console.log(`debugging captured data for void charges`);
            console.log(captured_data.type);
            if (captured_data.type == "PARTIALLY_REFUND" || captured_data.type == "CAPTURE" || captured_data.type == "PARTIALLY_CAPTURE" || captured_data.type == "REFUND") {
                let chargesDetails = {};
                switch (captured_data.type) {
                    case 'PARTIALLY_REFUND':
                    case 'REFUND':
                        chargesDetails = {
                            amount: captured_data.amount,
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
                            order_status: 'REFUND-REVERSAL',
                            txn_status:"AUTHORISED",
                            txn_id: generate_payment_id.toString(),
                            txn_ref_id:txn_id

                        };
                         calculateTransactionCharges(chargesDetails);
                        break;
                    case 'CAPTURE':
                    case 'PARTIALLY_CAPTURE':
                        chargesDetails = {
                            amount: captured_data.amount,
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
                            order_status: 'CAPTURE-REVERSAL',
                            txn_status:"AUTHORISED",
                            txn_id: generate_payment_id.toString(),
                            txn_ref_id:txn_id
                        };
                        console.log(`inside the capture reversal charges`);
                         calculateTransactionCharges(chargesDetails);
                        break;
                }
                await merchantOrderModel.updateDynamic({is_voided:1},{transaction_id:txn_id},'transaction_charges');
            }
        }


        /* check ends for voiding */
        res
            .status(statusCode.ok)
            .send(
                Server_response.successansmsg(res_obj, "Transaction successfully void.")
            );
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        let resp_dump = {
            order_id: order_id,
            type: "VOID",
            status: "FAILED",
            dump: JSON.stringify(error?.response?.data || error.message),
        };
        if (req?.body?.mode == 'live') {
            await orderTransactionModel.addResDump(resp_dump);
        } else {
            await orderTransactionModel.addTestResDump(resp_dump);
        }
        res
            .status(statusCode.ok)
            .send(Server_response.errormsg(error?.response?.data?.error?.explanation));
    }
}


module.exports = mpgs_void;