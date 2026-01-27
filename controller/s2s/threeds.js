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
    const logger = require('../../config/logger');
    const s2s_3ds = async (req, res) => {
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
        order_id = req.body['order.id'];
        mode = req.body.mode;
        console.log(`order id is here`);
        console.log(order_id);
        order_table = mode === 'live' ? 'orders' : 'test_orders';
        order_data = await helpers.get_data_list(
            "order_id as p_order_id,merchant_order_id as m_order_id,amount,order_amount,order_currency,psp,payment_mode,scheme,cardType,pan as mask_card_number,merchant_customer_id as m_customer_id,card_id as m_payment_token,cardType as card_type,card_country,merchant_id,success_url,failure_url,pan,description",
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
            fetch_card_details = await helpers.fetchTempLastCard({ order_id: order_id, mode: mode });
            console.log(fetch_card_details);
            const card_number = await enc_dec.dynamic_decryption(
                fetch_card_details.card,
                secret_key.id
            );
            console.log(`card no ------------>`)
            console.log(card_number);
            const cvv = await enc_dec.dynamic_decryption(
                fetch_card_details.cvv, secret_key.id
            );
            const username = `merchant.${mid_details.MID}`;
            const password = mid_details.password;
            const basicAuthToken = await helpers.createBasicAuthToken(username, password);

            transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
            let exp = fetch_card_details.expiry.split('/');
        
            let payload = {
                "apiOperation": order_details.action.toUpperCase() === 'AUTH' ? 'AUTHORIZE' : 'PAY',
                "authentication": {
                    "transactionId": req.body['transaction.id']
                },

                "sourceOfFunds": {
                    "type": "CARD",
                    "provided": {
                        "card": {
                            "number":card_number,
                            "expiry": {
                                "month": exp[0],
                                "year": exp[1].slice(-2)
                            },
                            "securityCode": cvv,
                            "storedOnFile": "NOT_STORED"
                        }
                    }
                },
                "transaction": {
                    "reference": uuidv4(),
                    "source":"INTERNET"
                },
                "order": {
                    "amount": order_details.amount,
                    "currency": order_details.currency,
                    "statementDescriptor": {},
                    "reference": uuidv4()
                },


            };
            
        
            let merchant_id = await helpers.get_data_list(
                "merchant_id",
                order_table,
                { order_id: order_details.order_id }
            );
            let checkIfAllowDescriptor = await helpers.checkAllowDescriptorOnMerchant(order_details?.merchant_id);
            if (checkIfAllowDescriptor == 0) {
              if (order_details.description != "") {
                payload.order.statementDescriptor.name =
                  helpers.sanitizeDescriptor(order_details.description);
              } 
            }
            if (checkIfAllowDescriptor == 1 && mid_details.statementDescriptor != "") {
                console.log(`this is statement descriptor`)
                console.log(mid_details.statementDescriptor);
              payload.order.statementDescriptor.name =
                helpers.sanitizeDescriptor(mid_details.statementDescriptor);
            }
            let final_data = JSON.stringify(payload);
            console.log(final_data);
            let url = mode=="live"?credentials[getpsp.credentials_key].base_url:credentials[getpsp.credentials_key].test_url;
            console.log( `${url}/merchant/${mid_details.MID}/order/${order_id}/transaction/${transaction_id}`);

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
            console.log(`here is the payload we are sending`)
            console.log(JSON.stringify(config));
           axios
            .request(config)
            .then(async (final_response) => {
                console.log(final_response.data);
                console.log(final_response.data?.risk?.response?.rule);
                console.log(final_response.data?.risk?.response?.review);
                const status = {
                status:
                    final_response.data.result === "SUCCESS"
                    ? order_details.action.toUpperCase() === "SALE"
                        ? "CAPTURED"
                        : "AUTHORISED"
                    : "FAILED",
                "3ds": final_response.data.authentication?.version ? 1 : 0,
                "3ds_status":
                    final_response.data.transaction?.authenticationStatus,
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

                await merchantOrderModel.updateDynamic(
                status,
                { order_id: order_id },
                order_table
                );
                const order_txn = {
                txn: transaction_id.toString(),
                order_id: order_details?.order_id || "",
                currency: order_details?.currency || "",
                amount: order_details?.amount || "",
                type:
                    order_details.action.toUpperCase() === "SALE"
                    ? "CAPTURE"
                    : "AUTH", // mid_details.mode == 'SALE' ? 'CAPTURE' : "AUTH",
                status:
                    final_response?.data.result === "SUCCESS"
                    ? "AUTHORISED"
                    : "FAILED",
                psp_code: final_response.data.transaction.authorizationCode,
                paydart_category:
                    final_response.data.result === "SUCCESS" ? "Success" : "FAILED",
                remark:
                    final_response.data.result === "SUCCESS"
                    ? "Transaction Approved"
                    : "Transaction Failed",
                capture_no: "",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss") || "",
                payment_id: final_response.data.transaction.reference || "",
                order_reference_id: final_response.data.order.reference || "",
                };
                const insert_to_txn_table =
                mode == "live"
                    ? await order_transactionModel.add(order_txn)
                    : order_transactionModel.test_txn_add(order_txn);
                let paydart_req_id = await helpers.make_sequential_no(
                mode == "test" ? "TST_REQ" : "REQ"
                );
                let order_req = {
                merchant_id: merchant_id[0].merchant_id,
                order_id: order_id,
                request_id: paydart_req_id,
                request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req, generate_request_id_table);

                let response_category = await helpers.get_error_category(
                final_response.data.result == "FAILURE"
                    ? "1"
                    : final_response.data.response.acquirerCode,
                "mpgs",
                final_response.data.result
                );

                let res_obj = {
                message:
                    final_response.data.result === "SUCCESS"
                    ? "Transaction Successful"
                    : "Transaction FAILED",
                order_status: status.status,
                payment_id:
                    final_response.data.transaction.acquirer.transactionId,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                remark: "",
                new_res: {
                    m_order_id: order_data[0]?.m_order_id || "",
                    p_order_id: order_data[0]?.p_order_id || "",
                    p_request_id: paydart_req_id.toString(),
                    psp_ref_id:
                    final_response.data.transaction.receipt?.toString() || "",
                    psp_txn_id:
                    final_response.data.transaction.acquirer.transactionId?.toString() ||
                    "",
                    transaction_id: transaction_id.toString(),
                    status: final_response.data.result,
                    status_code: response_category?.response_code, //final_response.data.response.acquirerCode,
                    remark:
                    final_response?.data?.order?.authenticationStatus +
                    "/" +
                    final_response?.data?.response?.acquirerCode +
                    "/" +
                    final_response?.data?.response?.acquirerMessage +
                    "/" +
                    final_response?.data?.response?.gatewayCode +
                    "/" +
                    final_response?.data?.response?.gatewayRecommendation, //response_category?.response_details,//final_response.data.response.acquirerMessage,
                    paydart_category: response_category?.category, //final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                    currency: order_details.currency,
                    return_url: process.env.PAYMENT_URL + "/status",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    amount: order_data[0]?.amount.toFixed(2) || "",
                    order_amount: order_data[0]?.order_amount.toFixed(2) || "",
                    order_currency: order_data[0]?.order_currency,
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
                },
                };
                if (final_response?.data?.response?.cardSecurityCode?.gatewayCode) {
                res_obj.new_res.remark =
                    res_obj.new_res.remark +
                    "/" +
                    final_response?.data?.response?.cardSecurityCode?.gatewayCode;
                }

                let txnFailedLog = {
                order_id: order_details.order_id,
                terminal: order_details?.terminal_id,
                req: JSON.stringify(req.body),
                res: "",
                psp: _pspid.name,
                status_code: final_response.data.transaction.authorizationCode,
                description: final_response.data.transaction.authenticationStatus,
                activity: `Transaction ${
                    final_response.data.result === "SUCCESS" ? "SUCCESS" : "FAILED"
                } with MPGS`,
                status: final_response.data.result === "SUCCESS" ? 1 : 0,
                mode: mode,
                card_holder_name: fetch_card_details?.card_holder_name || "",
                card: fetch_card_details?.card,
                expiry: fetch_card_details?.expiry,
                cipher_id: fetch_card_details?.cipher_id,
                txn: transaction_id.toString(),
                card_proxy: fetch_card_details?.card_proxy,
                "3ds_version": "1",
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                };
                await helpers.addTransactionFailedLogs(txnFailedLog);

                // web  hook starting

                let web_hook_res = Object.assign({}, res_obj.new_res);
                delete web_hook_res?.return_url;
                delete web_hook_res?.paydart_category;
                if (order_details.success_url) {
                let url = order_details.success_url;
                let webhook_res = await send_webhook_data(url, web_hook_res, "");
                }
                if (
                status.status == "CAPTURED" &&
                mode == process.env.CHARGES_MODE
                ) {
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
                    payment_id:
                    final_response.data.transaction.acquirer.transactionId,
                    order_status: status.status,
                    txn_status:
                    final_response?.data.result === "SUCCESS"
                        ? "AUTHORISED"
                        : "FAILED",
                    txn_id: transaction_id.toString(),
                };

                // transaction charge
                await calculateTransactionCharges(transaction_and_feature_data);
                }

                let redirectUrl =
                process.env.PAYMENT_URL +
                "/result/status/" +
                order_id +
                "/" +
                mode;
                if (order_details.success_url != "") {
                redirectUrl = order_details?.success_url;
                }
                const inputFields = buildFormFields(res_obj);
                let formHtml = `
                    <html>
                            <body onload="document.forms[0].submit()">
                            <form action="${redirectUrl}" method="post">
                                    ${inputFields}
                            </form>
                            </body>
                    </html>
                `;

                res.send(formHtml);
            })
            .catch(async (error) => {
                console.log(`inside internal error catch`);
                console.log(error);
                console.log(error?.response?.data);

                try {
                const failed_time = moment().format("DD-MM-YYYY hh:mm:ss");
                const txn_id =
                    transaction_id?.toString() || helpers.randomTxnId();

                // --- 1️⃣ Update Order Status as FAILED ---
                const status = {
                    status: "FAILED",
                    "3ds": 0,
                    "3ds_status": "N/A",
                };
                await merchantOrderModel.updateDynamic(
                    status,
                    { order_id: order_id },
                    order_table
                );

                // --- 2️⃣ Insert into order_transaction table ---
                const order_txn = {
                    txn: txn_id,
                    order_id: order_details?.order_id || "",
                    currency: order_details?.currency || "",
                    amount: order_details?.amount || "",
                    type: mid_details.mode == "SALE" ? "CAPTURE" : "AUTH",
                    status: "FAILED",
                    psp_code: "",
                    paydart_category: "FAILED",
                    remark: "Transaction Failed",
                    capture_no: "",
                    created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                    payment_id: "",
                    order_reference_id: "",
                };
                const insert_to_txn_table =
                    mode == "live"
                    ? await order_transactionModel.add(order_txn)
                    : await order_transactionModel.test_txn_add(order_txn);

                // --- 3️⃣ Log request ---
                let paydart_req_id = await helpers.make_sequential_no(
                    mode == "test" ? "TST_REQ" : "REQ"
                );
                let order_req = {
                    merchant_id: merchant_id[0]?.merchant_id || "",
                    order_id: order_id,
                    request_id: paydart_req_id,
                    request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req, generate_request_id_table);

                // --- 4️⃣ Response structure for frontend / webhook ---
                const res_obj = {
                    message:
                    error?.response?.data?.error?.cause || "Transaction FAILED",
                    order_status: "FAILED",
                    payment_id: "",
                    order_id: order_details?.order_id || "",
                    amount: order_details?.amount || "",
                    currency: order_details?.currency || "",
                    remark:
                    error?.response?.data?.explanation || "Transaction FAILED",
                    new_res: {
                    m_order_id: order_data?.[0]?.m_order_id || "",
                    p_order_id: order_data?.[0]?.p_order_id || "",
                    p_request_id: paydart_req_id.toString(),
                    psp_ref_id: "",
                    psp_txn_id: "",
                    transaction_id: txn_id,
                    status: "FAILED",
                    status_code: "500",
                    remark:
                        error?.response?.data?.error?.explanation ||
                        "Transaction FAILED",
                    paydart_category: "FAILED",
                    currency: order_details?.currency || "",
                    return_url: process.env.PAYMENT_URL + "/status",
                    transaction_time: failed_time,
                    amount: order_data?.[0]?.amount?.toFixed(2) || "",
                    m_customer_id: order_data?.[0]?.m_customer_id || "",
                    psp: order_data?.[0]?.psp || "",
                    payment_method: order_data?.[0]?.payment_mode || "",
                    m_payment_token: order_data?.[0]?.m_payment_token || "",
                    payment_method_data: {
                        scheme: order_data?.[0]?.scheme || "",
                        card_country: order_data?.[0]?.card_country || "",
                        card_type: order_data?.[0]?.card_type || "",
                        mask_card_number: order_data?.[0]?.mask_card_number || "",
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: order_data?.[0]?.merchant_id
                        ? await helpers.formatNumber(order_data[0].merchant_id)
                        : "",
                    },
                };

                // --- 5️⃣ Log failed transaction ---
                let txnFailedLog = {
                    order_id: order_details?.order_id || "",
                    terminal: order_details?.terminal_id || "",
                    req: JSON.stringify(req.body),
                    res: JSON.stringify(error?.response?.data || {}),
                    psp: _pspid?.name || "mpgs",
                    status_code: "500",
                    description: error?.message || "Internal Error",
                    activity: "Transaction FAILED with MPGS (Catch Block)",
                    status: 0,
                    mode: mode,
                    card_holder_name: fetch_card_details?.card_holder_name || "",
                    card: fetch_card_details?.card || "",
                    expiry: fetch_card_details?.expiry || "",
                    cipher_id: fetch_card_details?.cipher_id || "",
                    txn: txn_id,
                    card_proxy: fetch_card_details?.card_proxy || "",
                    "3ds_version": "1",
                    created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                };
                await helpers.addTransactionFailedLogs(txnFailedLog);

                // --- 6️⃣ Webhook Trigger ---
                let web_hook_res = Object.assign({}, res_obj.new_res);
                delete web_hook_res?.return_url;
                delete web_hook_res?.paydart_category;

                if (order_details?.failed_url || order_details?.success_url) {
                    let url = order_details.failed_url || order_details.success_url;
                    await send_webhook_data(url, web_hook_res, "");
                }

                // --- 7️⃣ Build redirect form for frontend ---

                let redirectUrl =
                    process.env.PAYMENT_URL +
                    "/result/status/" +
                    order_id +
                    "/" +
                    mode;
                if (order_details.success_url != "") {
                    redirectUrl = order_details?.success_url;
                }
                const inputFields = buildFormFields(res_obj);
                let formHtml = `
                <html>
                    <body onload="document.forms[0].submit()">
                        <form action="${redirectUrl}" method="post">
                            ${inputFields}
                        </form>
                    </body>
                </html>
            `;

                res.send(formHtml);
                } catch (innerErr) {
                console.error("Error inside catch block handling:", innerErr);
                res.status(500).json({
                    message:
                    "Critical Failure: Unable to process transaction failure response",
                    error: innerErr.message,
                });
                }
            }); 
            // res.send("OKAY")
        }catch(error){
        logger.error(500,{message: error,stack: error.stack}); 
        }
    }

    function buildFormFields(obj, parentKey = '') {
    const fields = [];

    for (const [key, value] of Object.entries(obj)) {
        const fieldName = parentKey ? `${parentKey}[${key}]` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
        fields.push(...buildFormFields(value, fieldName));
        } else {
        const safeValue = value !== undefined && value !== null ? value : '';
        fields.push(`<input type="hidden" name="${fieldName}" value="${safeValue}">`);
        }
    }

    return fields;
    }
    module.exports = s2s_3ds;