const axios = require('axios');
const creds = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const orderTransactionModel = require('../../models/order_transaction');
const { send_webhook_data } = require("../webhook_settings");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require('moment');
const enc_dec = require("../../utilities/decryptor/decryptor");
const { v4: uuidv4 } = require('uuid');
const myf_void = async (req, res) => {
    let mode = req?.credentials?.type || req?.body?.mode;
    const order_id = req.body.order_id;
    const txn_id = req.body.txn_id;
    const order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: order_id },
        mode=='test'?'test_orders':"orders"
    );
    let captured_data = await orderTransactionModel.selectOneDecremental(
        "*",
        {
        txn: txn_id,
        status: "AUTHORISED",
        },
        mode=='test'?'test_order_txn' :"order_txn"
    );
    try {
       
        const txn_id = req.body.txn_id;
        
       

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
        const password = mid_details.password;
        let generate_payment_id = await helpers.make_sequential_no(mode == 'live' ? "TXN" : "TST_TXN");
        let data = JSON.stringify({
            "Operation": 'Release',
            "Amount": captured_data.amount,
            "Key": captured_data.payment_id,
            "KeyType": "PaymentId"
        });
        console.log(data);
        let config = {
            method: 'post',
            url: mode=='test'?`${creds.myf.test_url}UpdatePaymentStatus`:`${creds.myf.base_url}UpdatePaymentStatus`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + password
            },
            data: data
        };
        const response = await axios.request(config);
        if (response.data.IsSuccess) {
            let status = 'VOID'
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
            let length = response.data.Data.InvoiceTransactions.length;
            let psp_payment_id = response.data.Data.InvoiceTransactions[length - 1]['PaymentId'];
            let psp_reference_id = response.data.Data.InvoiceTransactions[length - 1]['ReferenceId'];
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
            let order_txn = {
                status: "AUTHORISED",
                txn: generate_payment_id,
                type: 'VOID',
                payment_id: psp_payment_id,
                order_reference_id: psp_reference_id,
                capture_no: '',
                order_id: order_id,
                amount: captured_data.amount,
                currency: captured_data.currency,
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            const insert_to_tnx_table = mode === 'live' ? orderTransactionModel.add : orderTransactionModel.test_txn_add;
            insert_to_tnx_table(order_txn);
            let txn_update = await merchantOrderModel.updateDynamic(
                { is_voided: 1 },
                { txn: txn_id },
                mode == 'test' ? 'test_order_txn' : "order_txn"
            );
            let order_data = {
                status: "VOID",
            };
            await merchantOrderModel.updateDynamic(
                order_data,
                {
                order_id: order_id,
                },
                mode=='test'?'test_orders':"orders"
            );
            let resp_dump = {
                order_id: req.bodyString("p_order_id"),
                type: "VOID",
                status: "AUTHORISED",
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
                amount: captured_data.amount,
                currency: captured_data.currency,
                date: moment(order_txn.created_at).format("DD/MM/YYYY"),
                transaction_id: generate_payment_id,
            };
           
            let web_hook_res = {
                m_order_id: order_details.merchant_order_id,
                p_order_id: order_details.order_id,
                p_request_id: generate_payment_id,
                psp_ref_id: psp_reference_id,
                psp_txn_id: psp_payment_id,
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
                merchant_id: req?.user?.merchant_id ||req?.credentials?.merchant_id, 
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
            res
                .status(statusCode.ok)
                .send(
                    Server_response.successansmsg(res_obj, "Transaction successfully void.")
                );
        }
        else {
            res
                .status(statusCode.ok)
                .send(Server_response.errormsg("Unable to initiate Transaction void."));
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
            .send(Server_response.errormsg(error?.response?.data?.Message));
    }
}

module.exports = myf_void;
