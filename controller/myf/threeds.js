const axios = require('axios');
const credentials = require('../../config/credientials');
const merchantOrderModel = require('../../models/merchantOrder');
const helpers = require('../../utilities/helper/general_helper');
const moment = require('moment');
const order_transactionModel = require('../../models/order_transaction');
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const enc_dec = require("../../utilities/decryptor/decryptor");
const cipherModel = require("../../models/cipher_models");
const { writeFileAsync } = require('xlsx');
const { v4: uuidv4 } = require('uuid')
const manageSub = require('../../utilities/subscription/index');
const { send_webhook_data } = require("../webhook_settings");
const myf_threeds = async (req, res) => {
    console.log(`request body is at our 3ds pages mpgs`);
    console.log(req.body);
    let order_id;
    let mode;
    let order_table;
    let generate_request_id_table;
    let order_details;
    let mid_details;
    let _pspid;
    let transaction_id;
    let paydart_req_id;
    let order_data;
    let fetch_card_details;
    let final_response;
    let payment_id = req.body.payment_id;
    order_id = req.body.order_id;
    mode = req.body.mode;
    console.log(`order id is here`);
    console.log(order_id);
    order_table = mode === 'live' ? 'orders' : 'test_orders';
    order_data = await helpers.get_data_list(
        "order_id as p_order_id,merchant_order_id as m_order_id,amount,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan",
        order_table,
        {
            order_id: order_id,
        }
    );
    console.log(`order data is here`);
    console.log(order_data)
    try {
        console.log("threeds api starts...........");


        generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
        order_details = await merchantOrderModel.selectOne(
            "*",
            {
                order_id: order_id,
            },
            order_table
        );
        mid_details = await merchantOrderModel.selectOne(
            "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode",
            {
                terminal_id: order_details?.terminal_id,
            },
            "mid"
        );
        console.log(mid_details);
        if (!mid_details) {
            res
                .status(statusCode.badRequest)
                .send(Server_response.errormsg("No Terminal Available"));
        }
        _pspid = await merchantOrderModel.selectOne(
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
        transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");



        let merchant_id = await helpers.get_data_list(
            "merchant_id",
            order_table,
            { order_id: order_details.order_id }
        );
        let payload = {
            "Key": payment_id,
            "KeyType": "PaymentId"
        };
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: mode == 'test' ? `${credentials.myf.test_url}/GetPaymentStatus` : `${credentials.myf.base_url}/GetPaymentStatus`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + password
            },
            data: payload
        };
        axios.request(config).then(async (final_response) => {
            console.log(`final response at line no 158`);
            console.log(JSON.stringify(final_response.data));
            let browser_token_enc = req.browser_fingerprint;
            if (!browser_token_enc) {
                let browser_token = {
                    os: req.headers.os,
                    browser: req.headers.browser,
                    browser_version: req.headers["x-browser-version"],
                    browser_fingerprint: req.headers.fp ? req.headers.fp : "",
                    email: order_details.customer_email ? order_details.customer_email : "",
                };
                browser_token_enc = enc_dec.cjs_encrypt(JSON.stringify(browser_token));
            }
            let txn_myf_status = final_response.data.Data.InvoiceTransactions?.[0]?.TransactionStatus == 'Authorize' || final_response.data.Data.InvoiceTransactions?.[0]?.TransactionStatus=='Succss';
            console.log(`txn myf status`);
            console.log(txn_myf_status);
            const status = {
                status: (final_response.data.IsSuccess && txn_myf_status) ? (mid_details.mode == 'SALE' ? "CAPTURED" : "AUTHORISED") : "FAILED",
                '3ds': final_response.data.Data.InvoiceTransactions[0]?.ECI ? 1 : 0,
                '3ds_status': txn_myf_status ? 'AUTHENTICATE_SUCCESSFULLY' :final_response.data.Data.InvoiceTransactions[0]?.Error,
                'payment_token_id': payment_id
            };
            const condition = { order_id: order_id };
          

            await merchantOrderModel.updateDynamic(status, condition, order_table);

            const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
            const order_txn_update = {
                txn: transaction_id.toString(),
                order_id: order_details?.order_id || "",
                currency: order_details?.currency || "",
                amount: order_details?.amount || "",
                type: mid_details.mode == 'SALE' ? 'CAPTURE' : 'AUTH',
                status: (final_response.data.IsSuccess && txn_myf_status)
                    ? "AUTHORISED"
                    : "FAILED",
                psp_code: final_response.data.Data.InvoiceTransactions?.[0]?.AuthorizationId,
                paydart_category:
                    (final_response.data.IsSuccess && txn_myf_status) ? "Success" : "FAILED",
                remark:
                    (final_response.data.IsSuccess && txn_myf_status) ? "Transaction Approved" : "Transaction Failed",
                capture_no: "",
                created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
                payment_id: payment_id,
                order_reference_id: final_response.data.Data.CustomerReference || "",
            };
            const insert_to_txn_table = await insertFunction(order_txn_update);
            let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
            let order_req = {
                merchant_id: merchant_id[0].merchant_id,
                order_id: order_id,
                request_id: paydart_req_id,
                request: JSON.stringify(req.body),
            };
            await helpers.common_add(order_req, generate_request_id_table);
          
            let response_category = await helpers.get_error_category(

                (final_response.data.IsSuccess && txn_myf_status)?0 : 1,
                "myf",
                final_response.data.result
            );
            const res_obj = {
                message:
                    (final_response.data.IsSuccess &&  txn_myf_status) ? "Transaction Successful" : "Transaction FAILED",
                order_status: status.status,
                payment_id: payment_id,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                token: browser_token_enc,
                remark: '',
                new_res: {
                    m_order_id: order_data[0]?.m_order_id || "",
                    p_order_id: order_data[0]?.p_order_id || "",
                    p_request_id: paydart_req_id.toString(),
                    psp_ref_id: final_response.data.Data.InvoiceReference?.toString() || "",
                    psp_txn_id: final_response.data.Data.InvoiceId?.toString() || "",
                    transaction_id: transaction_id.toString(),
                    status: 
                    (final_response.data.IsSuccess &&  txn_myf_status) ? 'Success' : 'Failed',
                    status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
                    remark: response_category?.response_details,//final_response.data.response.acquirerMessage,
                    paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                    currency: order_details.currency,
                    return_url:  (final_response.data.IsSuccess &&  txn_myf_status)?order_details?.success_url:order_details?.failure_url,//process.env.PAYMENT_URL + "/status",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    amount: order_data[0]?.amount.toFixed(2) || "",
                    m_customer_id: order_data[0]?.m_customer_id || "",
                    psp: order_data[0]?.psp || "",
                    payment_method: order_data[0]?.payment_mode || "",
                    m_payment_token: order_data[0]?.m_payment_token || "",
                    payment_method_data: {
                        scheme: order_data[0]?.scheme || "",
                        card_country: order_data[0]?.card_country || "",
                        card_type: order_data[0]?.card_type || "",
                        mask_card_number: order_data[0]?.mask_card_number,
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: order_data[0]?.merchant_id
                        ? await helpers.formatNumber(order_data[0].merchant_id)
                        : "",
                }
            };
            let txnFailedLog = {
                order_id: order_details?.order_id,
                terminal: order_details?.terminal_id,
                req: JSON.stringify(req.body),
                res: '',
                psp: _pspid.name,
                status_code: final_response?.data?.transaction?.authorizationCode || "",
                description: final_response?.data?.transaction?.authenticationStatus || "",
                activity: (final_response.data.IsSuccess && txn_myf_status)?"Transaction success with MYF":"Transaction failed with MYF",
                status: 0,
                mode: mode,
                card_holder_name: fetch_card_details?.card_holder_name || '',
                card: fetch_card_details?.card,
                expiry: fetch_card_details?.expiry,
                cipher_id: fetch_card_details?.cipher_id,
                txn: transaction_id.toString() ? transaction_id.toString() : "",
                card_proxy: fetch_card_details?.card_proxy,
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await helpers.addTransactionFailedLogs(txnFailedLog);
            // web  hook starting
            let hook_info = await helpers.get_data_list("*", "webhook_settings", {
                merchant_id: order_details.merchant_id,
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
            const responseStatus = final_response.data.IsSuccess ? statusCode.ok : statusCode.badRequest;
            
            return res.status(responseStatus).send(
                final_response.data.IsSuccess
                    ? Server_response.successdatamsg(res_obj, res_obj.message)
                    : Server_response.errorMsgWithData(res_obj.message, res_obj, responseStatus)
            );
        }).catch(async (error) => {
            console.log(`error is here in then catch`);
            console.log(error);

            let response_category = await helpers.get_error_category(
                '01',
                "myf",
                final_response?.data?.result
            );

            // console.log(`inside the catch block`);
            // console.log(error);
            // console.log(`error is here`);
            await merchantOrderModel.updateDynamic({ status: "FAILED" }, { order_id: order_id }, order_table);
            const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
            const order_txn_update = {
                txn: transaction_id.toString() ? transaction_id.toString() : "",
                order_id: order_details?.order_id || "",
                currency: order_details?.currency || "",
                amount: order_details?.amount || "",
                type: order_details?.action.toUpperCase(),
                status: "FAILED",
                psp_code: final_response?.data?.transaction?.authorizationCode || "",
                paydart_category: "Transaction FAILED",
                remark: "Transaction Failed",
                capture_no: "",
                created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
                payment_id: final_response?.data?.transaction?.acquirer?.transactionId || "",
                order_reference_id: final_response?.data?.transaction?.receipt || "",
            };
            console.log(order_txn_update);
            await insertFunction(order_txn_update);
            let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
            let order_req = {
                merchant_id: merchant_id[0].merchant_id,
                order_id: order_id,
                request_id: paydart_req_id,
                request: JSON.stringify(req.body),
            };
            console.log(`order request id`);
            console.log(order_req);
            await helpers.common_add(order_req, generate_request_id_table);
            const res_obj = {
                message: "Transaction FAILED",
                order_status: "FAILED",
                payment_id: "",
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                token: req.browser_fingerprint ? req.browser_fingerprint : "",
                remark: error.response ? error.response.data : "",
                new_res: {
                    m_order_id: order_data?.[0]?.m_order_id || "",
                    p_order_id: order_data?.[0]?.p_order_id || "",
                    p_request_id: "",
                    psp_ref_id: final_response?.data?.transaction.receipt?.toString() || "",
                    psp_txn_id: final_response?.data?.transaction.acquirer.transactionId?.toString() || "",
                    transaction_id: transaction_id.toString(),
                    status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
                    remark: response_category?.response_details,//final_response.data.response.acquirerMessage,
                    paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                    currency: order_details?.currency,
                    return_url: order_details?.failure_url,//process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    amount: order_data?.[0]?.amount.toFixed(2) || "",
                    m_customer_id: order_data?.[0]?.m_customer_id || "",
                    psp: order_data?.[0]?.psp || "",
                    payment_method: order_data?.[0]?.payment_mode || "",
                    m_payment_token: order_data?.[0]?.m_payment_token || "",
                    payment_method_data: {
                        scheme: order_data?.[0]?.scheme || "",
                        card_country: order_data?.[0]?.card_country || "",
                        card_type: order_data?.[0]?.card_type || "",
                        mask_card_number: order_data?.[0]?.mask_card_number,
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: order_data?.[0]?.merchant_id
                        ? await helpers.formatNumber(order_data?.[0]?.merchant_id)
                        : "",
                }
            };
            let txnFailedLog = {
                order_id: order_details?.order_id,
                terminal: order_details?.terminal_id,
                req: JSON.stringify(req.body),
                res: '',
                psp: _pspid.name,
                status_code: final_response?.data?.transaction?.authorizationCode || "",
                description: final_response?.data?.transaction?.authenticationStatus || "",
                activity: "Transaction success with MYF",
                status: 0,
                mode: mode,
                card_holder_name: fetch_card_details?.card_holder_name || '',
                card: fetch_card_details?.card,
                expiry: fetch_card_details?.expiry,
                cipher_id: fetch_card_details?.cipher_id,
                txn: transaction_id.toString() ? transaction_id.toString() : "",
                card_proxy: fetch_card_details?.card_proxy,
                "3ds_version": "1",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            console.log(txnFailedLog)
            await helpers.addTransactionFailedLogs(txnFailedLog);
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
            return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
            );
        })

    }
    catch (error) {
        console.log(`error is catch block here`);
        console.log(error);
        await merchantOrderModel.updateDynamic({ status: "FAILED" }, { order_id: order_id }, order_table);
        const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
        const order_txn_update = {
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            order_id: order_details?.order_id || "",
            currency: order_details?.currency || "",
            amount: order_details?.amount || "",
            type: order_details?.action.toUpperCase(),
            status: "FAILED",
            psp_code: final_response?.data?.transaction?.authorizationCode || "",
            paydart_category: "Transaction FAILED",
            remark: "Transaction Failed",
            capture_no: "",
            created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
            payment_id: final_response?.data?.transaction?.acquirer?.transactionId || "",
            order_reference_id: final_response?.data?.transaction?.receipt || "",
        };
        console.log(order_txn_update);
        await insertFunction(order_txn_update);
        const res_obj = {
            message: "Transaction FAILED",
            order_status: "FAILED",
            payment_id: "",
            order_id: order_details.order_id,
            amount: order_details.amount,
            currency: order_details.currency,
            token: req.browser_fingerprint ? req.browser_fingerprint : "",
            remark: error.response ? error.response.data : "",
            new_res: {
                m_order_id: order_data?.[0]?.m_order_id || "",
                p_order_id: order_data?.[0]?.p_order_id || "",
                p_request_id: "",
                psp_ref_id: final_response?.data?.transaction.receipt?.toString() || "",
                psp_txn_id: final_response?.data?.transaction.acquirer.transactionId?.toString() || "",
                transaction_id: transaction_id.toString(),
                status: "FAILED",
                status_code: 143,
                remark: 'Transaction Failed',
                paydart_category: 'FAILED',
                currency: order_details?.currency,
                return_url: process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
                transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                amount: order_data?.[0]?.amount.toFixed(2) || "",
                m_customer_id: order_data?.[0]?.m_customer_id || "",
                psp: order_data?.[0]?.psp || "",
                payment_method: order_data?.[0]?.payment_mode || "",
                m_payment_token: order_data?.[0]?.m_payment_token || "",
                payment_method_data: {
                    scheme: order_data?.[0]?.scheme || "",
                    card_country: order_data?.[0]?.card_country || "",
                    card_type: order_data?.[0]?.card_type || "",
                    mask_card_number: order_data?.[0]?.mask_card_number,
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: order_data?.[0]?.merchant_id
                    ? await helpers.formatNumber(order_data?.[0]?.merchant_id)
                    : "",
            }
        };
        console.log(res_obj);
        let txnFailedLog = {
            order_id: order_details?.order_id,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(req.body),
            res: '',
            psp: _pspid.name,
            status_code: final_response?.data?.transaction?.authorizationCode || "",
            description: final_response?.data?.transaction?.authenticationStatus || "",
            activity: "Transaction FAILED with MPGS",
            status: 0,
            mode: mode,
            card_holder_name: fetch_card_details?.card_holder_name || '',
            card: fetch_card_details?.card,
            expiry: fetch_card_details?.expiry,
            cipher_id: fetch_card_details?.cipher_id,
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            card_proxy: fetch_card_details?.card_proxy,
            "3ds_version": "1",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
        );
    }
}


module.exports = myf_threeds;