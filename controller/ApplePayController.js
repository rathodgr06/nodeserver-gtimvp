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
const applePay = require("./applePay");
const applePayPaymentToken = require("apple-pay-token-decrypt")
const fs = require("fs")
const path = require("path");
const winston = require('../utilities/logmanager/winston');

var ApplePay = {

    decrypt: async (req, res) => {
        const requestToken = {
            "data": req.body.data,
            "version": req.body.version,
            "signature": req.body.signature,
            "header": {
                "ephemeralPublicKey": req.body.header.ephemeralPublicKey,
                "publicKeyHash": req.body.header.publicKeyHash,
                "transactionId": req.body.header.transactionId
            }
        }
        const publicCert = fs.readFileSync(path.join(__dirname, '../public/apple_pay.pem'), 'utf8')// Apple pay certificate 
        const privateKey = fs.readFileSync(path.join(__dirname, '../public/privatePem.pem'), 'utf8')// 

        const token = new applePayPaymentToken(requestToken)
        const decryptedToken = token.decrypt(publicCert, privateKey)
        decryptedToken.then(ret => {
            res.status(StatusCode.internalError).send(
                ServerResponse.successansmsg(ret)
            );
        }).catch(err => {
            winston.error(err);
            res.status(StatusCode.internalError).send(
                ServerResponse.errormsg(err)
            );
        })
    },
    pay: async (req, res) => {
        var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let table_name = "orders";
        let apple_token = req.body.apple_token;
        let payment_id = await helpers.make_sequential_no("TXN");

        let browser_token_enc = req.browser_fingerprint;

        if (!browser_token_enc) {
            let browser_token = {
                os: req.headers?.os,
                browser: req.headers?.browser,
                browser_version: req.headers?.browser_version,
                browser_fingerprint: req.headers?.fp,
            };
            browser_token_enc = enc_dec.cjs_encrypt(
                JSON.stringify(browser_token)
            );

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : new browser token ${browser_token_enc}`
            );

        }

        let order_data = {
            browser: req.headers?.browser,
            browser_version: req.headers?.browser_version,
            os: req.headers?.os,
            ip: req.headers?.ip,
            ip_country: req.headers?.ipcountry,
            browser_fingerprint: browser_token_enc,
            updated_at: updated_at,
        };
        merchantOrderModel
            .updateDynamic(
                order_data,
                {
                    order_id: req.bodyString("order_id"),
                },
                table_name
            )
            .then(async (result) => {
                let res_order_data = await merchantOrderModel.selectOne(
                    "*",
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    table_name
                );
                

                // getting action from db
                let action = await order_logs.get_order_action(
                    req.bodyString("order_id"),
                    "orders"
                );

                const _terminalids = await merchantOrderModel.selectOne(
                    "terminal_id",
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    "orders"
                );

                const _getmid = await merchantOrderModel.selectOne(
                    "MID,password,psp_id,autoCaptureWithinTime,allowVoid,voidWithinTime",
                    {
                        terminal_id: _terminalids.terminal_id,
                    },
                    "mid"
                );
                

                if (!_getmid) {
                    res.status(StatusCode.badRequest).send(
                        response.errormsg("No Terminal Available")
                    );
                }

                const autoCaptureHours = parseInt(
                    _getmid.autoCaptureWithinTime
                );
                // Get the current date and time using moment.
                const currentDate = moment();
                // Add autoCaptureHours to the current date to get the new date and time.
                const newDateTime = currentDate.add(autoCaptureHours, "hours");
                // Format the newDateTime as "YYYY-MM-DD HH:mm"
                const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");
                let voidWithinDatetime = "";

                if (_getmid.allowVoid == 1) {
                    const voidWithinTimeHours = parseInt(
                        _getmid?.voidWithinTime
                    );
                    const newVoidDateTime = currentDate.add(
                        voidWithinTimeHours,
                        "hours"
                    );
                    // Format the newDateTime as "YYYY-MM-DD HH:mm"
                    voidWithinDatetime =
                        newVoidDateTime.format("YYYY-MM-DD HH:mm");
                }

                const _pspid = await merchantOrderModel.selectOne(
                    "*",
                    {
                        id: _getmid.psp_id,
                    },
                    "psp"
                );
                if (!_pspid) {
                    res.status(statusCode.badRequest).send(
                        response.errormsg("No Psp Available")
                    );
                }

                const _terminalcred = {
                    MID: _getmid.MID,
                    password: _getmid.password,
                    baseurl: credientials[_pspid.credentials_key].base_url,
                    psp_id: _getmid.psp_id,
                    name: _pspid.name,
                };

                let ni_sale_req = {
                    action: action.action,
                    amount: {
                        currencyCode: res_order_data.currency,
                        value: res_order_data.amount,
                    },
                    emailAddress: res_order_data.customer_email,
                    billingAddress: {
                        firstName: res_order_data.customer_name.split(" ")[0],
                        lastName: res_order_data.customer_name.split(" ")[1],
                    },
                };

                let get_reference = await applePay.orderSale(
                    ni_sale_req,
                    _terminalcred
                );
                let orderReference =
                    get_reference._embedded.payment[0].orderReference;

                let reference = get_reference._embedded.payment[0].reference;

                let ni_order_sale = await applePay.checkout(
                    orderReference,
                    reference,
                    apple_token
                );

                let order_txn = {
                    status:
                        ni_order_sale.state == "CAPTURED"
                            ? "AUTHORISED"
                            : ni_order_sale.state,
                    txn: payment_id,
                    type:
                        res_order_data.action.toUpperCase() == "SALE" &&
                            ni_order_sale.state == "CAPTURED"
                            ? "CAPTURE"
                            : res_order_data.action.toUpperCase(),
                    payment_id: ni_order_sale.reference,
                    order_reference_id: ni_order_sale.orderReference,
                    capture_no: "",
                    order_id: res_order_data.order_id,
                    amount: res_order_data.amount,
                    currency: res_order_data.currency,
                    created_at: updated_at,
                };
                await orderTransactionModel.add(order_txn);

                let orderupdate = {
                    status: ni_order_sale?.state,
                    psp: "NI",
                    payment_id: payment_id,
                    payment_mode: ni_order_sale?.paymentMethod?.name,
                    scheme: ni_order_sale?.paymentMethod?.cardScheme,
                };

                await merchantOrderModel.updateDynamic(
                    orderupdate,
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    "orders"
                );

                // request id table entry
                let p_request_id = await helpers.make_sequential_no("REQ");
                let merchant_id = await helpers.get_data_list(
                    "merchant_id",
                    "orders",
                    { order_id: req.body.order_id }
                );
                let order_req = {
                    merchant_id: merchant_id[0].merchant_id,
                    order_id: req.body.order_id,
                    request_id: p_request_id,
                    request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req, "generate_request_id");

                let res_order_data1 = await merchantOrderModel.selectOne(
                    "psp,payment_mode,pan",
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    table_name
                );
                let res_obj = {};
                if (ni_order_sale.state == "CAPTURED") {
                    let new_res = {
                        m_order_id: res_order_data.merchant_order_id,
                        p_order_id: res_order_data.order_id,
                        p_request_id: p_request_id,
                        psp_ref_id: ni_order_sale.orderReference,
                        psp_txn_id: ni_order_sale.reference,
                        transaction_id: payment_id,
                        status:
                            ni_order_sale.state === "FAILED"
                                ? "FAILED"
                                : "SUCCESS",
                        status_code: ni_order_sale.state,
                        currency: res_order_data.currency,
                        amount: res_order_data?.amount
                            ? res_order_data?.amount
                            : "",
                        m_customer_id: res_order_data.merchant_customer_id,
                        psp: res_order_data1.psp,
                        payment_method: res_order_data1.payment_mode,
                        m_payment_token: res_order_data?.card_id
                            ? res_order_data?.card_id
                            : "",
                        transaction_time: moment().format(
                            "DD-MM-YYYY hh:mm:ss"
                        ),
                        return_url:
                            ni_order_sale.state === "FAILED"
                                ? res_order_data.failure_url
                                : res_order_data.success_url,
                        payment_method_data: {
                            scheme: res_order_data?.scheme
                                ? res_order_data?.scheme
                                : "",
                            card_country: res_order_data?.card_country
                                ? res_order_data?.card_country
                                : "",
                            card_type: res_order_data?.cardType
                                ? res_order_data?.cardType
                                : "",
                            mask_card_number: res_order_data1?.pan
                                ? res_order_data1?.pan
                                : "",
                        },
                        apm_name: "",
                        apm_identifier: "",
                        sub_merchant_identifier: res_order_data?.merchant_id
                            ? await enc_dec.cjs_encrypt(
                                res_order_data?.merchant_id
                            )
                            : "",
                    };
                    res_obj = {
                        order_status: ni_order_sale.state,
                        reference: ni_order_sale.reference,
                        order_reference: ni_order_sale.orderReference,
                        payment_id: payment_id,
                        order_id: res_order_data.order_id,
                        amount: res_order_data.amount,
                        currency: res_order_data.currency,
                        token: "",
                        "3ds": ni_order_sale["3ds"] ? ni_order_sale["3ds"] : "",
                        new_res: new_res,
                    };
                    /* Channel Payment Start */
                    let qr_payment = await merchantOrderModel.selectOne(
                        "id",
                        {
                            order_no: req.bodyString("order_id"),
                        },
                        "qr_payment"
                    );

                    if (qr_payment) {
                        let qr_data = {
                            payment_status: "CAPTURED",
                            transaction_date: updated_at,
                        };

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
                            order_id: req.bodyString("order_id"),
                        },
                        "inv_invoice_master"
                    );

                    if (invoice_payment) {
                        let inv_data = {
                            status: "Paid",
                            payment_date: updated_at,
                        };

                        invModel.updateDynamic(
                            inv_data,
                            {
                                id: invoice_payment.id,
                            },
                            "inv_invoice_master"
                        );
                    }

                    let subs_payment = await merchantOrderModel.selectOne(
                        "id",
                        {
                            order_no: req.bodyString("order_id"),
                        },
                        "subs_payment"
                    );
                    if (subs_payment) {
                        let subs_data = {
                            payment_status: status,
                            transaction_date: updated_at,
                        };

                        await merchantOrderModel
                            .updateDynamic(
                                subs_data,
                                {
                                    id: subs_payment.id,
                                },
                                "subs_payment"
                            )
                            .then(async (result) => {
                                let subscription_id =
                                    await helpers.get_data_list(
                                        "subscription_id",
                                        "subs_payment",
                                        {
                                            id: subs_payment.id,
                                        }
                                    );
                                let subs_id =
                                    subscription_id[0].subscription_id;

                                let subs_data = await helpers.get_data_list(
                                    "*",
                                    "subscription",
                                    {
                                        subscription_id: subs_id,
                                    }
                                );
                                const currentDate =
                                    moment().format("YYYY-MM-DD");
                                let payload = subs_data[0];

                                let next_data = await helpers.generateTable(
                                    currentDate,
                                    payload?.payment_interval,
                                    payload?.plan_billing_frequency,
                                    payload?.terms,
                                    payload?.subscription_id,
                                    payload?.email,
                                    payment_id,
                                    payload?.initial_payment_amount,
                                    payload?.final_payment_amount,
                                    payload?.plan_billing_amount
                                );

                                for (let val of next_data) {
                                    val.order_id = req.bodyString("order_id");
                                    await merchantOrderModel
                                        .addDynamic(
                                            val,
                                            "subscription_recurring"
                                        )
                                        .then((result) => { })
                                        .catch((error) => {
                                            winston.error(error);
                                        });
                                }
                            })
                            .catch((error) => {
                                winston.error(error);
                            });
                    }
                    /* Channel Payment Update End */
                } else {
                    res_obj = {
                        order_status: ni_order_sale.state,
                        reference: ni_order_sale.reference,
                        order_reference: ni_order_sale.orderReference,
                        payment_id: payment_id,
                        order_id: res_order_data.order_id,
                        amount: res_order_data.amount,
                        currency: res_order_data.currency,
                        token: browser_token_enc,
                        "3ds": ni_order_sale["3ds"] ? ni_order_sale["3ds"] : "",
                    };
                }

                let response_dump = {
                    order_id: res_order_data.order_id,
                    type: "Payment",
                    status: ni_order_sale.state,
                    dump: JSON.stringify(ni_order_sale),
                };
                await orderTransactionModel.addResDump(response_dump);
                // Adding event base charges update in payment
                res.status(StatusCode.ok).send(
                    ServerResponse.successdatamsg(res_obj, "Paid successfully.")
                );
            })
            .catch(async (error) => {
                winston.error(error);
                res.status(StatusCode.internalError).send(
                    ServerResponse.errorMsg(error?.response?.data?.message)
                );
            });
    },
};

module.exports = ApplePay;
