const axios = require('axios');
const creds = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const orderTransactionModel = require('../../models/order_transaction');
const { send_webhook_data } = require("../../controller/webhook_settings");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require('moment');
const enc_dec = require("../../utilities/decryptor/decryptor");
const { v4: uuidv4 } = require('uuid');
const calculateTransactionCharges = require("../../utilities/charges/transaction-charges/index");
const mpgs_capture = async (req, res) => {
    try {
        let transaction_id = req.bodyString("transaction_id");
        let mode = req?.credentials?.type || req?.body?.mode;
        let captured_data = await orderTransactionModel.selectOne(
            "order_reference_id,payment_id,amount,currency,order_id",
            {
                txn: transaction_id,
                status: "AUTHORISED",
            },
            mode == 'test' ? "test_order_txn" : "order_txn"
        );
        let order_id = captured_data?.order_id
        let capture_data = {
            order_no: captured_data?.order_reference_id,
            payment_no: captured_data?.payment_id,
            currency: req.body.amount.currencyCode,
            amount: req.body.amount.value,
        };

        const _terminalids = await merchantOrderModel.selectOne(
            "terminal_id,merchant_order_id,created_at",
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
        const username = `merchant.${mid_details.MID}`;
        const password = mid_details.password;
        const basicAuthToken = await helpers.createBasicAuthToken(username, password);
        let generate_payment_id = await helpers.make_sequential_no(mode == 'live' ? "TXN" : "TST_TXN");
        let data = JSON.stringify({
            "apiOperation": "CAPTURE",
            "transaction": {
                "amount": capture_data.amount,
                "currency": capture_data.currency,
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
        const response = await axios.request(config);
        if (response.data.result == "SUCCESS") {
            let status = response.data.order.status;
            let order_update = { status: status };
            await merchantOrderModel.updateDynamic(
                order_update,
                {
                    order_id: order_id,
                },
                mode == 'test' ? 'test_orders' : "orders"
            );
            let txn_type = "CAPTURE";
            if (status === "PARTIALLY_CAPTURED") {
                txn_type = "PARTIALLY_CAPTURE";
            }
            let order_txn = {
                status:
                    (status === "CAPTURED" ||
                        status === "PARTIALLY_CAPTURED")
                        ? "AUTHORISED"
                        : "FAILED",
                txn: generate_payment_id,
                type: txn_type,
                payment_id: response.data.transaction.acquirer.transactionId,
                order_reference_id: response.data.transaction.receipt,
                capture_no: '',
                order_id: order_id,
                amount: capture_data.amount,
                currency: capture_data.currency,
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                payment_id: response.data.transaction.reference
            };
            const insert_to_tnx_table = mode === 'live' ? orderTransactionModel.add : orderTransactionModel.test_txn_add;
            insert_to_tnx_table(order_txn);

            let resp_dump = {
                order_id: req.bodyString("p_order_id"),
                type: "CAPTURE",
                status:
                    (status === "CAPTURED" ||
                        status === "PARTIALLY_CAPTURED")
                        ? "AUTHORISED"
                        : "FAILED",
                dump: JSON.stringify(response.data),
            };
            const addResDumpFunc = mode == 'live' ? orderTransactionModel.addResDump : orderTransactionModel.addTestResDump
            addResDumpFunc(resp_dump);
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
            let res_obj = {
                status: status,
                p_request_id: generate_payment_id,
                p_order_id: req.bodyString("p_order_id"),
                m_order_id: _terminalids.merchant_order_id,
                p_ref_id: mid_details.psp_id,
                amount: capture_data.amount,
                currency: capture_data.currency,
                date: moment(order_txn.created_at).format("DD/MM/YYYY"),
                transaction_id: generate_payment_id,
            };
            let order_details = await orderTransactionModel.selectOne(
                "*",
                { order_id: order_id },
                mode == 'test' ? 'test_orders' : "orders"
            );
            let web_hook_res = {
                m_order_id: order_details.merchant_order_id,
                p_order_id: order_details.order_id,
                p_request_id: generate_payment_id,
                psp_ref_id: response.data.order.reference,
                psp_txn_id: response.data.transaction.acquirer.transactionId,
                transaction_id: "",
                status: "SUCCESS",
                status_code: '',
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
                sub_merchant_identifier: order_details?.merchant_id
                    ? await helpers.formatNumber(order_details?.merchant_id)
                    : "",
            };
            let hook_info = await helpers.get_data_list("*", "webhook_settings", {
                merchant_id: req.credentials.merchant_id,
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
            if (response?.data.result === 'SUCCESS'  && mode==process.env.CHARGES_MODE) {
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
                    order_status: 'CAPTURED',
                    txn_status: (response?.data.result === 'SUCCESS') ? "AUTHORISED" : "FAILED",
                    txn_id: generate_payment_id.toString(),
                };
                calculateTransactionCharges(transaction_and_feature_data);
            }

            // transaction charge


            res
                .status(statusCode.ok)
                .send(
                    Server_response.successansmsg(res_obj, "Transaction successfully Captured.")
                );
        }
        else {
            res
                .status(statusCode.ok)
                .send(Server_response.errormsg("Unable to initiate Transaction Captured."));
        }
    }
    catch (error) {
        console.error("Error during capture:", error);
        let resp_dump = {
            order_id: req.bodyString("p_order_id"),
            type: "CAPTURE",
            status: "FAILED",
            dump: JSON.stringify(error?.response?.data),
        };
        if (req?.body?.mode == 'test') {
            await orderTransactionModel.addTestResDump(resp_dump);
        } else {
            await orderTransactionModel.addResDump(resp_dump);
        }
        res
            .status(statusCode.ok)
            .send(Server_response.errormsg(error.message));
    }
}

module.exports = mpgs_capture;
