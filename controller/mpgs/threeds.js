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
const tokenCreate = require('./token');
const manageSub = require('../../utilities/subscription/index');
const EventEmitter = require("events");
const ee = new EventEmitter();
const SendTransactionMailAction = require('../SendTransactionMail');
const { send_webhook_data } = require("../webhook_settings");
const PspModel = require("../../models/psp");
const calculateTransactionCharges = require("../../utilities/charges/transaction-charges/index");
const logger = require('../../config/logger');
const threeds = async (req, res) => {
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
    order_id = req.body.p_order_id || req.body.order_id;
    mode = req.body.mode;
    console.log(`order id is here`);
    console.log(order_id);
    order_table = mode === 'live' ? 'orders' : 'test_orders';
    order_data = await helpers.get_data_list(
        "order_id as p_order_id,merchant_order_id as m_order_id,amount,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan,order_amount,order_currency,description",
        order_table,
        {
            order_id: order_id,
        }
    );
    console.log(`order data is here`);
    console.log(order_data)
    try {


        generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
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
            },
            "mid"
        );
        const getpsp = await PspModel.selectOne("*", {
            id: mid_details.psp_id,
        });
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

        const secret_key = await cipherModel.selectOne("id", {
            ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
            is_active: 1,
        });
        console.log(secret_key);
        fetch_card_details = await helpers.fetchTempLastCard({ order_id: order_id, mode: mode });
        console.log(`fetchc card details`);
        console.log(fetch_card_details);
        
        const card_number = await enc_dec.dynamic_decryption(
            fetch_card_details.card,
            fetch_card_details.cipher_id
        );
        console.log(`card no ------------>`)
        console.log(card_number);
        const cvv = await enc_dec.dynamic_decryption(
            fetch_card_details.cvv, secret_key.id
        );
        console.log(cvv)
        const [month, year] = fetch_card_details.expiry.split('/');
        const sessionID = order_details.session;
        console.log(sessionID);
        const username = `merchant.${mid_details.MID}`;
        const password = mid_details.password;
        const basicAuthToken = await helpers.createBasicAuthToken(username, password);

        transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");

        let payload = {
            "apiOperation": order_details.action.toUpperCase() === 'AUTH' ? 'AUTHORIZE' : 'PAY',
            "authentication": {
                "transactionId": req.body.transaction_id
            },

            "sourceOfFunds": {
                "type": "CARD",
                "provided": {
                    "card": {
                        "number": card_number,
                        "expiry": {
                            "month": month,
                            "year": year.slice(-2)
                        },
                        "securityCode": cvv,
                        "storedOnFile": "NOT_STORED"
                    }
                }
            },
            "transaction": {
                "reference": uuidv4(),
                "source": "INTERNET"
            },
            "order": {
                "amount": order_details.amount,
                "currency": order_details.currency,
                "statementDescriptor": {},
                "reference": uuidv4()
            },


        };
        let payment_token_id = '';
         let checkIfAllowDescriptor =
           await helpers.checkAllowDescriptorOnMerchant(
             order_details?.merchant_id
           );
         if (checkIfAllowDescriptor == 0) {
            console.log(`type of order_details.description`)
            console.log(order_details.description);
           if (
             typeof order_details?.description === "string" &&
             order_details.description.trim() !== "" &&
             order_details.description !== "NULL"
           ) {
             payload.order.statementDescriptor.name =
               helpers.sanitizeDescriptor(order_details.description);
           }
         }
         if (
           checkIfAllowDescriptor == 1 &&
           typeof mid_details?.statementDescriptor === "string" &&
           mid_details.statementDescriptor.trim() !== "" &&
           mid_details.statementDescriptor !== "NULL"
         ) {
           console.log(`this is statement descriptor`);
           console.log(mid_details.statementDescriptor);
           payload.order.statementDescriptor.name = helpers.sanitizeDescriptor(
             mid_details.statementDescriptor
           );
         }
        if (order_details.origin == 'SUBSCRIPTION') {
            console.log(`----------------------------------------->`)
            let subscriptiondetails = await order_transactionModel.selectSubsData(order_id)
            payload['agreement'] = {
                "id": subscriptiondetails.subscription_id,
                "paymentFrequency": "AD_HOC",
                "type": "OTHER"
            }
            payload["sourceOfFunds"]['provided']['card']['storedOnFile'] = "TO_BE_STORED";
            let tokenInput = {
                "mid": mid_details.MID,
                "authToken": basicAuthToken,
                "number": card_number,
                "expiry": {
                    "month": month,
                    "year": year.slice(-2)
                }
            };
            payment_token_id = await tokenCreate(tokenInput);

        }
        let final_data = JSON.stringify(payload);
        console.log(`mpgs after 3ds payload`);
        console.log(final_data);

        let merchant_id = await helpers.get_data_list(
            "merchant_id",
            order_table,
            { order_id: order_details.order_id }
        );

        console.log(final_data);
        let url = mode == "live" ? credentials[getpsp.credentials_key].base_url : credentials[getpsp.credentials_key].test_url;
        console.log(`${url}/merchant/${mid_details.MID}/order/${order_id}/transaction/${transaction_id}`);

        let config = {
            method: 'put',
            maxBodyLength: Infinity,
            url: `${url}/merchant/${mid_details.MID}/order/${order_id}/transaction/${transaction_id}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': basicAuthToken
            },
            data: final_data
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

            const status = {
                status: (final_response.data.result === 'SUCCESS') ? (mid_details.mode == 'SALE' ? "CAPTURED" : "AUTHORISED") : "FAILED",
                '3ds': final_response.data.authentication?.version ? 1 : 0,
                '3ds_status': final_response.data.transaction?.authenticationStatus,
                'payment_token_id': payment_token_id,
                 remark:
                    final_response?.data?.order?.authenticationStatus +
                    "/" +
                    final_response?.data?.response?.acquirerCode +
                    "/" +
                    final_response?.data?.response?.acquirerMessage +
                    "/" +
                    final_response?.data?.response?.gatewayCode +
                    "/" +
                    final_response?.data?.response?.gatewayRecommendation,
                other_description:
                    final_response?.data?.order?.authenticationStatus,
            };
            const condition = { order_id: order_id };
            console.log(`status at success to updated dynamic`);
            console.log(status);

            await merchantOrderModel.updateDynamic(status, condition, order_table);
            const order_txn = {
                txn: transaction_id.toString(),
                order_id: order_details?.order_id || "",
                currency: order_details?.currency || "",
                amount: order_details?.amount || "",
                type: mid_details.mode == 'SALE' ? 'CAPTURE' : "AUTH",
                status: (final_response?.data.result === 'SUCCESS')
                    ? "AUTHORISED"
                    : "FAILED",
                psp_code: final_response.data.transaction.authorizationCode,
                paydart_category: final_response.data.result === 'SUCCESS' ? "Success" : "FAILED",
                remark: final_response.data.result === 'SUCCESS' ? "Transaction Approved" : "Transaction Failed",
                capture_no: "",
                created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
                payment_id: final_response.data.transaction.reference || "",
                order_reference_id: final_response.data.order.reference || "",
            };
            const insert_to_txn_table = mode == "live" ? await order_transactionModel.add(order_txn) : order_transactionModel.test_txn_add(order_txn);
            let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
            let order_req = {
                merchant_id: merchant_id[0].merchant_id,
                order_id: order_id,
                request_id: paydart_req_id,
                request: JSON.stringify(req.body),
            };
            await helpers.common_add(order_req, generate_request_id_table);

            if (!insert_to_txn_table) {
                return res.status(statusCode.badRequest).send(Server_response.errormsg("Transaction insertion failed"));
            }
            let response_category = await helpers.get_error_category(
                final_response.data.result == 'FAILURE' ? '1' : final_response.data.response.acquirerCode,
                "mpgs",
                final_response.data.result
            );

            const res_obj = {
                message: final_response.data.result === 'SUCCESS' ? "Transaction Successful" : "Transaction FAILED",
                order_status: status.status,
                payment_id: final_response.data.transaction.acquirer.transactionId,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                token: browser_token_enc,
                remark: '',
                new_res: {
                    m_order_id: order_data[0]?.m_order_id || "",
                    p_order_id: order_data[0]?.p_order_id || "",
                    p_request_id: paydart_req_id.toString(),
                    psp_ref_id: final_response.data.transaction.receipt?.toString() || "",
                    psp_txn_id: final_response.data.transaction.acquirer.transactionId?.toString() || "",
                    transaction_id: transaction_id.toString(),
                    status: final_response.data.result=="SUCCESS"?"SUCCESS":"FAILED",
                    status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
                    remark: response_category?.response_details,//final_response.data.response.acquirerMessage,
                    paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                    currency: order_details.currency,
                    return_url: final_response.data.result === 'SUCCESS'?order_details.success_url:order_details.failure_url, //process.env.PAYMENT_URL + "/status",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    amount: order_data[0]?.amount.toFixed(2) || "",
                    order_amount:order_details.order_amount?order_details.order_amount:order_details.amount,
                    order_currency:order_details.order_currency?order_details.order_currency:order_details.currency,
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
                order_id: order_details.order_id,
                terminal: order_details?.terminal_id,
                req: JSON.stringify(req.body),
                res: '',
                psp: _pspid.name,
                status_code: final_response.data.transaction.authorizationCode,
                description: final_response.data.transaction.authenticationStatus,
                activity: `Transaction ${final_response.data.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED'} with MPGS`,
                status: final_response.data.result === 'SUCCESS' ? 1 : 0,
                mode: mode,
                card_holder_name: fetch_card_details?.card_holder_name || '',
                card: fetch_card_details?.card,
                expiry: fetch_card_details?.expiry,
                cipher_id: fetch_card_details?.cipher_id,
                txn: transaction_id.toString(),
                card_proxy: fetch_card_details?.card_proxy,
                "3ds_version": "1",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await helpers.addTransactionFailedLogs(txnFailedLog);
            if (order_details.origin == 'SUBSCRIPTION') {
                subscriptionRes = await manageSub(order_details, final_response.data.result == 'SUCCESS' ? 'CAPTURED' : "FAILED", moment().format('YYYY-MM-DD HH:mm:ss'), payment_token_id, '', mode);
            }
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
                }
            }
            if (final_response.data.result == 'SUCCESS') {
                ee.once("ping", async (arguments) => {
                    // Sending mail to customers and merchants about transaction
                    await SendTransactionMailAction(arguments)

                });
                ee.emit("ping", {
                    order_table: order_table,
                    order_id: order_details.order_id,
                });
            }
            if (status.status == "CAPTURED"  && mode==process.env.CHARGES_MODE) {
                const transaction_and_feature_data = {
                    amount: order_details?.amount,
                    currency: order_details?.currency,
                    order_id: order_details?.order_id,
                    merchant_id: order_details?.merchant_id,
                    card_country: order_details?.card_country,
                    payment_method: order_details?.payment_mode,
                    scheme: order_details?.scheme,
                    psp_id: order_details?.psp_id,
                    terminal_id: order_details?.terminal_id,
                    origin: order_details?.origin,
                    mode: mode,
                    //every time change param
                    payment_id: final_response.data.transaction.acquirer.transactionId,
                    order_status: status.status,
                    txn_status: (final_response?.data.result === 'SUCCESS') ? "AUTHORISED" : "FAILED",
                    txn_id: transaction_id.toString(),
                };

                // transaction charge
               await calculateTransactionCharges(transaction_and_feature_data);
            }


            const responseStatus = final_response.data.result === 'SUCCESS' ? statusCode.ok : statusCode.badRequest;
            return res.status(responseStatus).send(
                final_response.data.result === 'SUCCESS'
                    ? Server_response.successdatamsg(res_obj, res_obj.message)
                    : Server_response.errorMsgWithData(res_obj.message, res_obj, responseStatus)
            );

        }).catch(async (error) => {
            console.log(`error is here`);
            console.log(error);
            let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
            let order_req = {
                merchant_id: order_details.merchant_id,
                order_id: order_details?.order_id,
                request_id: paydart_req_id,
                request: JSON.stringify(req.body),
            };
            await helpers.common_add(order_req, generate_request_id_table);
            let response_category = await helpers.get_error_category(
                '01',
                "mpgs",
                final_response?.data?.result
            );

            // console.log(`inside the catch block`);
            // console.log(error);
            console.log(`error is here`);
            console.log(error.response.data.error);
            await merchantOrderModel.updateDynamic({
                status: "FAILED",
                remark:error?.response?.data?.error?.cause+'/'+error?.response?.data?.error?.validationType+'/'+error?.response?.data?.error?.field+'/'+error?.response?.data?.error?.explanation
             }, { order_id: order_id }, order_table);
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
                    status: 'FAILED',
                    status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
                    remark: response_category?.response_details,//final_response.data.response.acquirerMessage,
                    paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                    currency: order_details?.currency,
                    return_url:order_details?.failure_url,// process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
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
                }
            }
            ee.once("ping", async (arguments) => {
                // Sending mail to customers and merchants about transaction
                await SendTransactionMailAction(arguments)

            });
            ee.emit("ping", {
                order_table: order_table,
                order_id: order_details.order_id,
            });
            return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
            );
        })

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
                return_url:order_details?.failure_url, //process.env.PAYMENT_URL + '/status',//order_data?.[0]?.failure_url,
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
        ee.once("ping", async (arguments) => {
            // Sending mail to customers and merchants about transaction
            await SendTransactionMailAction(arguments)

        });
        ee.emit("ping", {
            order_table: order_table,
            order_id: order_details.order_id,
        });
        return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
        );
    }
}


module.exports = threeds;