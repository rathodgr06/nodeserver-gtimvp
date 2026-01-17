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
const EventEmitter = require("events");
const ee = new EventEmitter();
const SendTransactionMailAction = require('../SendTransactionMail');
const { send_webhook_data } = require("../webhook_settings");
const PspModel = require("../../models/psp");
const calculateTransactionCharges = require("../../utilities/charges/transaction-charges/index");
const https = require('https');
const logger = require('../../config/logger');
const confirm_payment = async (req, res) => {
    console.log(`request body is at our orange confirm page`);
    console.log(req.body);
   let order_id;
    let mode;
    let order_table;
    let generate_request_id_table;
    let order_details;
    let mid_details;
    let psp_details;
    let transaction_id;
    let paydart_req_id;
    let order_data;
    let fetch_card_details;
    let final_response;

    order_id = req.body.p_order_id || req.body.order_id;
    mode = req.body.mode;

    console.log(`order id is here`);
    console.log(order_id);
    order_table = mode === 'live' ? 'orders' : 'test_orders';
    generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
    let order_txn_table = mode == 'live' ? 'order_txn' : 'test_order_txn';
    order_details = await merchantOrderModel.selectOne(
        "*",
        {
            order_id: order_id,
        },
        order_table
    );
    mid_details = await merchantOrderModel.selectOne(
        "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,mode,statementDescriptor",
        {
            terminal_id: order_details?.terminal_id,
            deleted: 0,
            env:mode
        },
        "mid"
    );
    psp_details = await merchantOrderModel.selectOne(
        "*",
        {
            id: mid_details.psp_id,
        },
        "psp"
    );
    let order_txn_details = await merchantOrderModel.selectOne('*', { order_id: order_id }, order_txn_table);
    console.log(order_txn_details);
    try {
        const username = `${mid_details.MID}`;
        const password = mid_details.password;

        transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
        // fetch transaction details
        let url = mode == "live" ? credentials[psp_details.credentials_key].base_url : credentials[psp_details.credentials_key].test_url;
        console.log(`${url}`);
         const agent = new https.Agent({
          rejectUnauthorized: false  // ⚠️ Ignore SSL cert errors (only use in dev)
        });
        let payload = {
            "auth":{
                "user":username,
                "pwd":password
            },
            "param":{
                "TXNID":order_txn_details?.payment_id,
                "Currency":order_txn_details?.currency
            }
        }
        let config = {
            method: 'get',
            url: `${url}OM/Transaction/Status`,
            headers: {
                'Content-Type': 'application/json',
            },
             httpsAgent: agent,
            data: payload,
        };
        let final_response = await axios.request(config);
        console.log(`the final response is here at confirmation`);
        console.log(final_response.data);
        let orangeTxnStatus = helpers.fetchPaydartStatusByPSPStatus(final_response.data.resultset.TXNSTATUS,'Orange Money');
            
        const status = {
            status: orangeTxnStatus.order_status,
            '3ds': 0,
            '3ds_status': 'NA',
        };
        const condition = { order_id: order_id };

        await merchantOrderModel.updateDynamic(status, condition, order_table);

        const order_txn = {
            txn: transaction_id.toString(),
            order_id: order_details?.order_id || "",
            currency: order_details?.currency || "",
            amount: order_details?.amount || "",
            type: 'CAPTURE',
            status: orangeTxnStatus.txn_status,
            psp_code: orangeTxnStatus.status_code,
            paydart_category: orangeTxnStatus.status,
            remark: orangeTxnStatus.remark,
            capture_no: "",
            created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
            payment_id: order_details.session,
        };
        const insert_to_txn_table = mode == "live" ? await order_transactionModel.add(order_txn) : order_transactionModel.test_txn_add(order_txn);
        let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
        let order_req = {
            merchant_id: order_details.merchant_id,
            order_id: order_id,
            request_id: paydart_req_id,
            request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, generate_request_id_table);

        const res_obj = {
            message:orangeTxnStatus.remark,
            order_status: orangeTxnStatus.order_status,
            payment_id: order_txn_details?.payment_id,
            order_id: order_details.order_id,
            amount: order_details.amount,
            currency: order_details.currency,
            remark: '',
            new_res: {
                m_order_id: order_details?.m_order_id || "",
                p_order_id: order_details?.order_id || "",
                p_request_id: paydart_req_id.toString(),
                psp_ref_id: order_txn_details?.payment_id|| "",
                psp_txn_id: "",
                transaction_id: transaction_id.toString(),
                status: orangeTxnStatus.status,
                status_code: orangeTxnStatus.status_code,
                remark: orangeTxnStatus.remark,
                paydart_category: orangeTxnStatus.status,
                currency: order_details.currency,
                return_url: process.env.PAYMENT_URL + "/status", //process.env.PAYMENT_URL + "/status",
                transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                amount: order_details?.amount.toFixed(2) || "",
                m_customer_id: order_details?.merchant_customer_id || "",
                psp: order_details?.psp || "",
                payment_method: order_details?.payment_mode || "",
                m_payment_token: order_details?.m_payment_token || "",
                mobile_no: order_details.pan,
                payment_method_data: {
                    scheme: "",
                    card_country: "",
                    card_type: "Mobile Wallet",
                    mask_card_number: ""
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: order_details?.merchant_id
                    ? await helpers.formatNumber(order_details.merchant_id)
                    : "",
            }
        };

        let txnFailedLog = {
            order_id: order_details.order_id,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(req.body),
            res: '',
            psp: psp_details.name,
            status_code: orangeTxnStatus.status_code,
            description: "",
            activity: `Transaction ${orangeTxnStatus.order_status} with Orange money`,
            status: 0,
            mode: mode,
            card_holder_name: '',
            card: "",
            expiry: "",
            cipher_id: 0,
            txn: transaction_id.toString(),
            card_proxy: "",
            "3ds_version": "0",
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
        console.log(`hook info`);
        console.log(hook_info);
        if (hook_info[0]) {
            if (hook_info[0].enabled === 0 && hook_info[0].notification_url != '') {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                    url,
                    web_hook_res,
                    hook_info[0].notification_secret
                );
                console.log(`web hook res`);
                console.log(web_hook_res);
            }
        }
        console.log(`before sending the webhook`);
        console.log(final_response.data.resultset.TXNSTATUS)
        if (final_response.data.resultset.TXNSTATUS == 'TF' || final_response.data.resultset.TXNSTATUS == 'TS' ) {
            ee.once("ping", async (arguments) => {
                // Sending mail to customers and merchants about transaction
                await SendTransactionMailAction(arguments)

            });
            ee.emit("ping", {
                order_table: order_table,
                order_id: order_details.order_id,
            });
        }
        if (final_response.data.resultset.TXNSTATUS =='TS'  && mode==process.env.CHARGES_MODE) {
            const transaction_and_feature_data = {
                amount: order_details.amount,
                currency: order_details?.currency,
                order_id: order_details?.order_id,
                merchant_id: order_details?.merchant_id,
                card_country: order_details?.card_country,
                payment_method: "mobile_wallet",
                scheme:"mobile_wallet",
                psp_id: order_details?.psp_id,
                terminal_id: order_details?.terminal_id,
                origin: order_details?.origin,
                //every time change param
                payment_id: final_response.data.financialTransactionId || "",
                order_status: 'CAPTURED',
                txn_status: (final_response.data.resultset.TXNSTATUS =='TS') ? "AUTHORISED" : "FAILED",
                txn_id:transaction_id.toString(),
                mode:mode,
                is_mobile_wallet:true
            };
           await calculateTransactionCharges(transaction_and_feature_data);
        }
        const responseStatus = final_response.data.resultset.TXNSTATUS === 'TS' ? statusCode.ok : statusCode.badRequest;
        return res.status(responseStatus).send(
            final_response.data.resultset.TXNSTATUS === 'TS'
                ? Server_response.successdatamsg(res_obj, res_obj.message)
                : Server_response.errorMsgWithData(res_obj.message, res_obj, responseStatus)
        );
    }
    catch (error) {
       logger.error(500,{message: error,stack: error.stack}); 
        await merchantOrderModel.updateDynamic({ status: "FAILED" }, { order_id: order_id }, order_table);
        const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
        const order_txn_update = {
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            order_id: order_details?.order_id || "",
            currency: order_details?.currency || "",
            amount: order_details?.amount || "",
            type: order_details?.action.toUpperCase(),
            status: "FAILED",
            psp_code: "01",
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
            remark: error.response ? error?.response?.data : "",
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
                    card_type: "Mobile Wallet",
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
            psp: psp_details.name,
            status_code: final_response?.data?.transaction?.authorizationCode || "",
            description: final_response?.data?.transaction?.authenticationStatus || "",
            activity: "Transaction FAILED with Orange Money",
            status: 0,
            mode: mode,
            card_holder_name: fetch_card_details?.card_holder_name || '',
            card: fetch_card_details?.card,
            expiry: fetch_card_details?.expiry,
            cipher_id: 0,
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            card_proxy: fetch_card_details?.card_proxy,
            "3ds_version": "1",
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
            if (hook_info[0].enabled === 0 && hook_info[0].notification_url != '') {
                let url = hook_info[0].notification_url;
                let webhook_res = await send_webhook_data(
                    url,
                    web_hook_res,
                    hook_info[0].notification_secret
                );
                console.log(web_hook_res)
            }
        }
        return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
        );
    } 
}


module.exports = confirm_payment;