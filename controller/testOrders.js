const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const accessToken = require("../utilities/tokenmanager/token");
const merchantOrderModel = require("../models/merchantOrder");
const SubmerchantModel = require("../models/submerchantmodel");
const TransactionsModel = require("../models/transactions.js");
const orderTransactionModel = require("../models/order_transaction");
const { successdatamsg } = require("../utilities/response/ServerResponse");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
require("dotenv").config({
    path: "../.env",
});
const path = require("path");
require("dotenv").config({
    path: "../.env",
});
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const moment = require("moment");
const order_logs = require("../models/order_logs");
const winston = require('../utilities/logmanager/winston');

var MerchantOrder = {
    test_order_create: async (req, res) => {
        try {
            const logs = [];
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : protocol type ${req.protocol}`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
                    req.method
                }`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
                    req.url
                }`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : Request content-type = ${req.headers["content-type"]}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : Content length = ${req.headers["content-length"]}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : MerchantOrder.create initiated`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with headers ${JSON.stringify(req.headers)}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with data ${JSON.stringify(req.body)}`
            );

            let client = {
                os: req.headers.os,
                browser: req.headers.browser ? req.headers.browser : "",
                ip: req.ip ? req.ip : "",
            };

            let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
            let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
            let customer_details = req.body.data.customer_details;
            let order_details = req.body.data.order_details;
            let billing_details = req.body.data.billing_details;
            let shipping_details = req.body.data.shipping_details;

            let order_id = await helpers.make_sequential_no("TST_ORD");

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : helpers.make_sequential_no ${order_id}`
            );

            let status = "PENDING";
            let token_payload = {
                order_id: order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                return_url: order_details.return_url,
                env: req.credentials.type,
                merchant_id: req.credentials.merchant_id,
                email: customer_details.email,
            };
            let mode = "test";
            let token = accessToken(token_payload);

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : accessToken ${token}`
            );

            let ins_body = {
                merchant_id: req.credentials?.merchant_id,
                mcc: req.credentials?.mcc_id,
                mcc_category: req.credentials?.mcc_cat_id,
                super_merchant: req.credentials?.super_merchant_id,
                customer_name: customer_details?.name,
                customer_email: customer_details?.email,
                customer_code: customer_details?.code,
                customer_mobile: customer_details?.mobile,
                billing_address_line_1: billing_details?.address_line1
                    ? billing_details?.address_line1
                    : "",
                billing_address_line_2: billing_details?.address_line2
                    ? billing_details?.address_line2
                    : "",
                billing_city: billing_details?.city
                    ? billing_details?.city
                    : "",
                billing_pincode: billing_details?.pin
                    ? billing_details?.pin
                    : "",
                billing_province: billing_details?.province
                    ? billing_details?.province
                    : "",
                billing_country: billing_details?.country
                    ? billing_details?.country
                    : "",
                shipping_address_line_1: shipping_details?.address_line1
                    ? shipping_details?.address_line1
                    : "",
                shipping_address_line_2: shipping_details?.address_line2
                    ? shipping_details?.address_line2
                    : "",
                shipping_city: shipping_details?.city
                    ? shipping_details?.city
                    : "",
                shipping_country: shipping_details?.country
                    ? shipping_details?.country
                    : "",
                shipping_province: shipping_details?.province
                    ? shipping_details?.province
                    : "",
                shipping_pincode: shipping_details?.pin
                    ? shipping_details?.pin
                    : "",
                amount: order_details?.amount,
                amount_left: order_details?.amount,
                currency: order_details?.currency,
                return_url: order_details?.return_url,
                description: order_details?.description,
                status: status,
                origin: "API",
                order_id: order_id,
                browser: client.browser,
                ip: client.ip,
                os: client.os,
                created_at: created_at,
                updated_at: updated_at,
                action: req.body.data.action,
                merchant_order_id: order_details.m_order_id,
                failure_url: req.body.data?.urls?.failure,
                cancel_url: req.body.data?.urls?.cancel,
                success_url: req.body.data?.urls?.success,
            };
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate mode ${mode}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate merchantOrderModel.add`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate merchantOrderModel.add with data ${JSON.stringify(
                    ins_body
                )}`
            );

            merchantOrderModel
                .add(ins_body, mode)
                .then(async (result) => {
                    let p_request_id = await helpers.make_sequential_no(
                        "TST_REQ"
                    );
                    let order_req = {
                        merchant_id: req.credentials.merchant_id,
                        order_id: order_id,
                        request_id: p_request_id,
                        request: JSON.stringify(req.body),
                    };
                    await helpers.common_add(
                        order_req,
                        "test_generate_request_id"
                    );

                    let res_order_details = {
                        status: status,
                        message: "Order created",
                        token: token,
                        p_order_id: order_id,
                        m_order_id: order_details.m_order_id,
                        p_request_id: p_request_id,
                        order_creation_date: moment(created_at).format(
                            "DD/MM/YYYY HH:mm:ss"
                        ),
                        amount:
                            order_details.currency + " " + order_details.amount,
                        payment_link:
                            // "http://localhost/paydart-payment-console/payment-initiate/" +
                            process.env.PAYMENT_URL +
                            "payment-initiate/" +
                            order_id +
                            "/" +
                            token,
                        iframe_link:
                            process.env.PAYMENT_URL +
                            "initiate/" +
                            order_id +
                            "/" +
                            token +
                            "?origin=iframe",
                    };
                    logs.push(
                        `${moment().format(
                            "DD/MM/YYYY HH:mm:ss.SSS"
                        )} : response received ${JSON.stringify(
                            res_order_details
                        )}`
                    );

                    // adding logs
                    let logs_payload = {
                        order_id: order_id,
                        activity: JSON.stringify(logs),
                    };
                    let log_is = await order_logs
                        .test_log_add(logs_payload)
                        .then((result) => {
                            
                        })
                        .catch((err) => {
                            winston.error(err);
                        });

                    res.status(statusCode.ok).send(res_order_details);
                })
                .catch((error) => {
                    winston.error(error);
                });
        } catch (error) {
            winston.error(error);
            
            
            // adding logs
            let logs_payload = {
                order_id: order_id,
                activity: JSON.stringify(logs),
            };
            let log_is = await order_logs
                .add(logs_payload, "test_order_logs")
                .then((result) => {
                    
                })
                .catch((err) => {
                            winston.error(err);
                    
                });
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    test_demo_order_create: async (req, res) => {
        try {
            const logs = [];
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : protocol type ${req.protocol}`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
                    req.method
                }`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
                    req.url
                }`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : Request content-type = ${req.headers["content-type"]}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : Content length = ${req.headers["content-length"]}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : MerchantOrder.create initiated`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with headers ${JSON.stringify(req.headers)}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with data ${JSON.stringify(req.body)}`
            );

            let client = {
                os: req.headers.os,
                browser: req.headers.browser ? req.headers.browser : "",
                ip: req.ip ? req.ip : "",
            };

            let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
            let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
            req.body = {
                data: {
                    action: "SALE",
                    capture_method: "MANUAL",
                    payment_token: "",
                    customer_details: {
                        m_customer_id: "0000000001",
                        name: "Pawan Kushwaha",
                        email: "pawankushwaha@ulistechnology.com",
                        code: "91",
                        mobile: "9234567892",
                    },
                    billing_details: {
                        address_line1:
                            "9 Yusuf Building, 2 Nd Floor Abdul Rehman Street, Mandvi",
                        address_line2: "",
                        country: "India",
                        city: "Mumbai",
                        pin: "400003",
                        province: "Maharashtra",
                    },
                    shipping_details: {
                        address_line1:
                            "9 Yusuf Building, 2 Nd Floor Abdul Rehman Street, Mandvi",
                        address_line2: "",
                        country: "India",
                        city: "Mumbai",
                        pin: "400003",
                        province: "Maharashtra",
                    },
                    order_details: {
                        m_order_id: "ORD10000001",
                        amount: "199.99",
                        currency: "AED",
                        return_url: "https://dev.paydart.pay.ulis.live/status",
                        description:
                            "This is a api generated test order description.",
                    },
                    urls: {
                        success: "https://dev.paydart.pay.ulis.live/status",
                        cancel: "https://dev.paydart.pay.ulis.live/status",
                        failure: "https://dev.paydart.pay.ulis.live/status",
                    },
                },
            };
            let customer_details = req.body.data.customer_details;
            let order_details = req.body.data.order_details;
            let billing_details = req.body.data.billing_details;
            let shipping_details = req.body.data.shipping_details;

            let order_id = await helpers.make_sequential_no("TST_ORD");

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : helpers.make_sequential_no ${order_id}`
            );

            let status = "PENDING";
            let token_payload = {
                order_id: order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                return_url: order_details.return_url,
                env: req.credentials.type,
                merchant_id: req.credentials.merchant_id,
                email: customer_details.email,
            };
            let mode = "test";
            let token = accessToken(token_payload);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : accessToken ${token}`
            );

            let ins_body = {
                merchant_id: req.credentials?.merchant_id,
                mcc: req.credentials?.mcc_id,
                mcc_category: req.credentials?.mcc_cat_id,
                super_merchant: req.credentials?.super_merchant_id,
                customer_name: customer_details?.name,
                customer_email: customer_details?.email,
                customer_code: customer_details?.code,
                customer_mobile: customer_details?.mobile,
                billing_address_line_1: billing_details?.address_line1
                    ? billing_details?.address_line1
                    : "",
                billing_address_line_2: billing_details?.address_line2
                    ? billing_details?.address_line2
                    : "",
                billing_city: billing_details?.city
                    ? billing_details?.city
                    : "",
                billing_pincode: billing_details?.pin
                    ? billing_details?.pin
                    : "",
                billing_province: billing_details?.province
                    ? billing_details?.province
                    : "",
                billing_country: billing_details?.country
                    ? billing_details?.country
                    : "",
                shipping_address_line_1: shipping_details?.address_line1
                    ? shipping_details?.address_line1
                    : "",
                shipping_address_line_2: shipping_details?.address_line2
                    ? shipping_details?.address_line2
                    : "",
                shipping_city: shipping_details?.city
                    ? shipping_details?.city
                    : "",
                shipping_country: shipping_details?.country
                    ? shipping_details?.country
                    : "",
                shipping_province: shipping_details?.province
                    ? shipping_details?.province
                    : "",
                shipping_pincode: shipping_details?.pin
                    ? shipping_details?.pin
                    : "",
                amount: order_details?.amount,
                amount_left: order_details?.amount,
                currency: order_details?.currency,
                return_url: order_details?.return_url,
                description: order_details?.description,
                other_description: order_details?.description,
                status: status,
                origin: "API",
                order_id: order_id,
                browser: client.browser,
                ip: client?.ip,
                os: client?.os,
                created_at: created_at,
                updated_at: updated_at,
                action: req.body?.data?.action,
                merchant_order_id: order_details?.m_order_id,
                failure_url: req.body.data?.urls?.failure,
                cancel_url: req.body.data?.urls?.cancel,
                success_url: req.body.data?.urls?.success,
            };
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate mode ${mode}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate merchantOrderModel.add`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : initiate merchantOrderModel.add with data ${JSON.stringify(
                    ins_body
                )}`
            );

            merchantOrderModel
                .add(ins_body, mode)
                .then(async (result) => {
                    let res_order_details = {
                        status: status,
                        message: "Order created",
                        token: token,
                        order_id: order_id,
                        amount:
                            order_details.currency + " " + order_details.amount,
                        payment_link: "initiate/" + order_id + "/" + token,
                        iframe_link:
                            process.env.PAYMENT_URL +
                            "initiate/" +
                            order_id +
                            "/" +
                            token +
                            "?origin=iframe",
                    };
                    logs.push(
                        `${moment().format(
                            "DD/MM/YYYY HH:mm:ss.SSS"
                        )} : response received ${JSON.stringify(
                            res_order_details
                        )}`
                    );

                    // adding logs
                    let logs_payload = {
                        order_id: order_id,
                        activity: JSON.stringify(logs),
                    };
                    let log_is = await order_logs
                        .test_log_add(logs_payload)
                        .then((result) => {
                            
                        })
                        .catch((err) => {
                            winston.error(err);
                            
                        });

                    res.status(statusCode.ok).send(res_order_details);
                })
                .catch((error) => {
                    winston.error(error);
                    
                });
        } catch (error) {
            winston.error(error);

            
            
            // adding logs
            let logs_payload = {
                order_id: order_id,
                activity: JSON.stringify(logs),
            };
            let log_is = await order_logs
                .add(logs_payload, "test_order_logs")
                .then((result) => {
                    
                })
                .catch((err) => {
                            winston.error(err);
                    
                });
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    test_pay: async (req, res) => {
        let table_name = "test_orders";
        let test_card_arr = [
            {
                card_no: "5123450000000008",
                id_3d_secure: true,
                country: "UNITED ARAB EMIRATES",
                country_code: "AE",
                card_brand: "MASTERCARD",
                bin_number: "512345",
                issuer: "MASHREQ BANK",
                issuer_website: "http://www.mashreqbank.com/",
                valid: true,
                card_type: "CREDIT",
                card_category: "STANDARD",
                currency_code: "AED",
                country_code3: "ARE",
            },

            {
                card_no: "5111111111111118",
                id_3d_secure: false,
                country: "UNITED STATES",
                country_code: "US",
                card_brand: "MASTERCARD",
                bin_number: "511111",
                issuer: "FISERV SOLUTIONS, LLC",
                issuer_website: "https://www.fiserv.com",
                valid: true,
                card_type: "DEBIT",
                card_category: "STANDARD",
                currency_code: "USD",
                country_code3: "USA",
            },
            {
                card_no: "4508750015741019",
                id_3d_secure: true,
                country: "UNITED KINGDOM",
                country_code: "GB",
                card_brand: "VISA",
                bin_number: "450875",
                issuer: "THE CO-OPERATIVE BANK PLC",
                issuer_website: "",
                valid: true,
                card_type: "DEBIT",
                card_category: "CLASSIC",
                currency_code: "GBP",
                country_code3: "GBR",
            },
            {
                card_no: "4012000033330026",
                id_3d_secure: false,
                country: "RUSSIAN FEDERATION",
                country_code: "RU",
                card_brand: "VISA",
                bin_number: "401200",
                issuer: "",
                issuer_website: "",
                valid: true,
                card_type: "CREDIT",
                card_category: "CLASSIC",
                currency_code: "RUB",
                country_code3: "RUS",
            },
            {
                card_no: "345678901234564",
                id_3d_secure: true,
                country: "SPAIN",
                country_code: "ES",
                card_brand: "AMERICAN EXPRESS",
                bin_number: "345678",
                issuer: "",
                issuer_website: "",
                valid: true,
                card_type: "CREDIT",
                card_category: "STANDARD",
                currency_code: "EUR",
                country_code3: "ESP",
            },
            {
                card_no: "371449635398431",
                id_3d_secure: false,
                country: "UNITED STATES",
                country_code: "US",
                card_brand: "AMERICAN EXPRESS",
                bin_number: "371449",
                issuer: "AMERICAN EXPRESS US CONSUMER",
                issuer_website: "https://www.americanexpress.com",
                valid: true,
                card_type: "CREDIT",
                card_category: "PERSONAL",
                issuer_phone: "1 (800) 528-4800",
                currency_code: "USD",
                country_code3: "USA",
            },
        ];
        let is_card = false;
        for (let val of test_card_arr) {
            if (val?.card_no == req.body.card) {
                req.card_details = val;
                is_card = true;
            }
        }
        
        if (!is_card) {
            res.status(statusCode.badRequest).send(
                response.errormsg("Invalid card details. Try again!")
            );
        }

        let logs = await order_logs.get_test_log_data(
            req.bodyString("order_id")
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : MerchantOrder.pay initiated`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
                req.protocol
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
                req.method
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
                req.url
            }`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Request content-type = ${req.headers["content-type"]}`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
                req.headers["content-length"]
            }`
        );
        let body_date = {
            ...req.body,
        };
        body_date.card = `${req.bodyString("card").substring(0, 6)}****${req
            .bodyString("card")
            .substring(req.bodyString("card").length - 4)}`;
        // body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
        body_date.cvv = "****";
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : request with data ${JSON.stringify(body_date)}`
        );
        var updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
        let payment_id = await helpers.make_sequential_no("TST_TXN");
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : helpers.make_sequential_no ${payment_id}`
        );

        let card_no = "";
        let enc_customer_id = "";
        let card_details;
        let full_card_no = "";
        if (req.bodyString("card_id") != "") {
            let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
            card_details = await merchantOrderModel.selectOne(
                "*",
                {
                    id: card_id,
                },
                "customers_cards"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : fetch card_details of if = ${req.bodyString("card_id")}`
            );
            card_no = card_details.last_4_digit;
            enc_customer_id = card_details.cid;
            full_card_no = await enc_dec.dynamic_decryption(
                card_details.card_number,
                card_details.cipher_id
            );
        } else {
            full_card_no = req.bodyString("card");
            card_no = req.bodyString("card").slice(-4);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : get card no : **** **** **** ${card_no}`
            );
            enc_customer_id = req?.customer_id
                ? enc_dec.cjs_encrypt(req?.customer_id)
                : "";
        }
        let browser_token_enc = req?.browser_fingerprint;
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : browser_token_enc ${req?.browser_fingerprint}`
        );
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
        

        let card_id = "";
        if (req.bodyString("card_id") != "") {
            card_id = req.bodyString("card_id");
        } else if (req?.card_id) {
            card_id = req?.card_id;
        } else {
            card_id = "";
        }

        let order_data = {
            os: req.headers?.os,
            browser_fingerprint: browser_token_enc,
            browser: req.headers?.browser,
            browser_version: req.headers?.browser_version,
            ip: req?.ip,
            device_type: req.headers.ismobile == 1 ? "Mobile" : "Desktop",
            ip_country: req.headers?.ipcountry,
            cid: enc_customer_id, // encrypted customer id
            card_id: card_id,
            card_country: req.card_details?.country,
            card_bank: req.card_details?.issuer,
            cardType: req.card_details?.card_type,
            cardCategory: req.card_details?.card_category,
            scheme: req.card_details?.card_brand,
            pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
                full_card_no.length - 4
            )}`,
            card_no: card_no,
            expiry: req.bodyString("expiry_date"),
            payment_mode: req.card_details?.card_type,
            updated_at: updated_at,
        };
        
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : initiate merchantOrderModel.updateDynamic with data ${JSON.stringify(
                order_data
            )}`
        );
        merchantOrderModel
            .updateDynamic(
                order_data,
                {
                    order_id: req.bodyString("order_id"),
                },
                table_name
            )
            .then(async (result) => {
                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : response received ${JSON.stringify(result)}`
                );

                // request id table entry
                let p_request_id = await helpers.make_sequential_no("TST_REQ");
                let merchant_id = await helpers.get_data_list(
                    "merchant_id",
                    table_name,
                    { order_id: req.body.order_id }
                );
                

                let order_req = {
                    merchant_id: merchant_id[0].merchant_id,
                    order_id: req.body.order_id,
                    request_id: p_request_id,
                    request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req, "test_generate_request_id");
                let order_action = await merchantOrderModel.selectOne(
                    "action",
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    table_name
                );
                let status = req.card_details.id_3d_secure
                    ? "AWAIT_3DS"
                    : "CAPTURED";

                if (order_action.action == "AUTH") {
                    status = "AUTHORISED";
                }

                let orderupdate = {
                    status: status,
                    psp: "NI",
                    payment_id: payment_id,
                };
                
                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : merchantOrderModel.updateDynamic with data ${JSON.stringify(
                        orderupdate
                    )}`
                );
                await merchantOrderModel.updateDynamic(
                    orderupdate,
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    table_name
                );

                let res_order_data = await merchantOrderModel.selectOne(
                    "*",
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    table_name
                );
                let order_txn = {};
                let payment_ref_id = await helpers.generateRandomString();
                let order_reference_id = await helpers.generateRandomString();
                let capture_id = await helpers.generateRandomString();
                if (status === "CAPTURED") {
                    order_txn = {
                        status: "AUTHORISED",
                        txn: payment_id,
                        type: "CAPTURE",
                        payment_id: payment_ref_id,
                        order_reference_id: order_reference_id,
                        capture_no: capture_id,
                        order_id: res_order_data.order_id,
                        amount: res_order_data.amount,
                        currency: res_order_data.currency,
                        created_at: updated_at,
                    };
                } else if (status === "AWAIT_3DS") {
                    order_txn = {
                        status: "AWAIT_3DS",
                        txn: payment_id,
                        type: res_order_data.action,
                        payment_id: payment_ref_id,
                        order_reference_id: order_reference_id,
                        capture_no: capture_id,
                        order_id: res_order_data.order_id,
                        amount: res_order_data.amount,
                        currency: res_order_data.currency,
                        created_at: updated_at,
                    };
                } else if (status === "AUTHORISED") {
                    order_txn = {
                        status: "AUTHORISED",
                        txn: payment_id,
                        type: res_order_data.action,
                        payment_id: payment_ref_id,
                        order_reference_id: order_reference_id,
                        capture_no: capture_id,
                        order_id: res_order_data.order_id,
                        amount: res_order_data.amount,
                        currency: res_order_data.currency,
                        created_at: updated_at,
                    };
                }

                // if (!req.card_details.id_3d_secure) {
                //     order_txn = {
                //         status: "AUTHORISED",
                //         txn: payment_id,
                //         type: "CAPTURE",
                //         payment_id: payment_ref_id,
                //         order_reference_id: order_reference_id,
                //         capture_no: capture_id,
                //         order_id: res_order_data.order_id,
                //         amount: res_order_data.amount,
                //         currency: res_order_data.currency,
                //         created_at: updated_at,
                //     };
                // } else {
                //     order_txn = {
                //         status: status,
                //         txn: payment_id,
                //         type: res_order_data.action,
                //         payment_id: payment_ref_id,
                //         order_reference_id: order_reference_id,
                //         capture_no: "",
                //         order_id: res_order_data.order_id,
                //         amount: res_order_data.amount,
                //         currency: res_order_data.currency,
                //         created_at: updated_at,
                //     };
                // }

                await orderTransactionModel.test_txn_add(order_txn);
                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : orderTransactionModel.add with data ${JSON.stringify(
                        order_txn
                    )}`
                );
                let new_res = {};
                if (res_order_data.status === "CAPTURED") {
                    new_res = {
                        m_order_id: res_order_data.merchant_order_id,
                        p_order_id: req.order?.order_id,
                        p_request_id: p_request_id,
                        psp_ref_id: payment_ref_id,
                        psp_txn_id: order_reference_id,
                        transaction_id: payment_id,
                        status:
                            res_order_data.status === "FAILED"
                                ? "FAILED"
                                : "SUCCESS",
                        status_code: res_order_data.status,
                        currency: req.order?.currency,
                        amount: req.order?.amount,
                        m_customer_id: res_order_data.merchant_customer_id,
                        psp: res_order_data.psp,
                        payment_method: res_order_data.payment_mode,
                        m_payment_token: res_order_data?.card_id
                            ? res_order_data?.card_id
                            : "",
                        transaction_time: moment().format(
                            "DD-MM-YYYY hh:mm:ss"
                        ),
                        return_url: res_order_data.success_url,
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
                            mask_card_number: res_order_data?.pan
                                ? res_order_data?.pan
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
                } else {
                    new_res = {
                        m_order_id: res_order_data.merchant_order_id,
                        p_order_id: req.order?.order_id,
                        p_request_id: p_request_id,
                        psp_ref_id: payment_ref_id,
                        psp_txn_id: order_reference_id,
                        transaction_id: payment_id,
                        status:
                            res_order_data.status === "FAILED"
                                ? "FAILED"
                                : "SUCCESS",
                        status_code: res_order_data.status,
                        currency: req.order?.currency,
                        amount: req.order?.amount,
                        m_customer_id: res_order_data.merchant_customer_id,
                        psp: res_order_data.psp,
                        payment_method: res_order_data.payment_mode,
                        m_payment_token: res_order_data?.card_id
                            ? res_order_data?.card_id
                            : "",
                        transaction_time: moment().format(
                            "DD-MM-YYYY hh:mm:ss"
                        ),
                        return_url: res_order_data.success_url,
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
                            mask_card_number: res_order_data?.pan
                                ? res_order_data?.pan
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
                }

                let response_dump = {
                    order_id: req.order.order_id,
                    type: "PAYMENT",
                    status: res_order_data.status,
                    dump: JSON.stringify(new_res),
                };
                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : orderTransactionModel.addResDump ${JSON.stringify(
                        response_dump
                    )}`
                );
                await orderTransactionModel.addTestResDump(response_dump);

                let logs_payload = {
                    activity: JSON.stringify(logs),
                    updated_at: updated_at,
                };
                await order_logs
                    .update_test_logs_data(
                        {
                            order_id: req.bodyString("order_id"),
                        },
                        logs_payload
                    )
                    .then((result) => {
                        
                    })
                    .catch((err) => {
                            winston.error(err);
                        
                    });
                res.status(statusCode.ok).send(
                    successdatamsg(new_res, "Paid successfully.")
                );
            })
            .catch(async (error) => {
                winston.error(error);

                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : error occurred`
                );
                let response_dump = {
                    order_id: req?.body?.order_id,
                    type: "PAYMENT",
                    status: "FAILED",
                    dump: JSON.stringify(error),
                };
                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : error orderTransactionModel.addResDump ${JSON.stringify(
                        response_dump
                    )}`
                );
                await orderTransactionModel.addTestResDump(response_dump);

                logs.push(
                    `${moment().format(
                        "DD/MM/YYYY HH:mm:ss.SSS"
                    )} : error ${error}`
                );
                let logs_payload = {
                    activity: JSON.stringify(logs),
                    updated_at: updated_at,
                };
                await order_logs
                    .update_test_logs_data(
                        {
                            order_id: req.bodyString("order_id"),
                        },
                        logs_payload
                    )
                    .then((result) => {
                        
                        res.status(statusCode.internalError).send(
                            response.errormsg("Unable to pay, Internal error!")
                        );
                    })
                    .catch((err) => {
                            winston.error(err);
                        
                    });
            });
    },

    test_update_3ds: async (req, res) => {
        try {
            let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
            let table_name = "test_orders";
            let status = req.body.status;
            let order_id = req.bodyString("order_id");
            let update_data = {
                status: status == "true" ? "CAPTURED" : "FAILED",
            };
            await merchantOrderModel.updateDynamic(
                update_data,
                {
                    order_id: order_id,
                },
                table_name
            );
            let res_order_data = await merchantOrderModel.selectOne(
                "*",
                {
                    order_id: order_id,
                },
                table_name
            );
            let request_id = await helpers.get_data_list(
                "request_id",
                "test_generate_request_id",
                { order_id: req.bodyString("order_id") }
            );
            let p_request_id = request_id[request_id.length - 1]?.request_id;
            let order_txn = {};

            let txn_data = await helpers.get_data_list("*", "test_order_txn", {
                order_id: req.bodyString("order_id"),
                status: "AWAIT_3DS",
            });

            let pay_ref_id = txn_data[0]?.payment_id;
            let order_ref_id = txn_data[0]?.order_reference_id;
            let capture_id = await helpers.generateRandomString();
            if (status == "true") {
                order_txn = {
                    status: "AUTHORISED",
                    txn: res_order_data.payment_id,
                    type: "CAPTURE",
                    payment_id: pay_ref_id,
                    order_reference_id: order_ref_id,
                    capture_no: capture_id,
                    order_id: res_order_data.order_id,
                    amount: res_order_data.amount,
                    currency: res_order_data.currency,
                    created_at: updated_at,
                };
            } else {
                order_txn = {
                    status: "FAILED",
                    txn: res_order_data.payment_id,
                    type: "CAPTURE",
                    payment_id: pay_ref_id,
                    order_reference_id: order_ref_id,
                    capture_no: "",
                    order_id: res_order_data.order_id,
                    amount: res_order_data.amount,
                    currency: res_order_data.currency,
                    created_at: updated_at,
                };
            }
            await orderTransactionModel.test_txn_add(order_txn);
            let new_res = {};
            

            if (res_order_data.status === "CAPTURED") {
                new_res = {
                    m_order_id: res_order_data.merchant_order_id,
                    p_order_id: res_order_data?.order_id,
                    p_request_id: p_request_id,
                    psp_ref_id: pay_ref_id,
                    psp_txn_id: order_ref_id,
                    transaction_id: res_order_data.payment_id,
                    status: "SUCCESS",
                    status_code: res_order_data.status,
                    currency: res_order_data?.currency,
                    amount: res_order_data?.amount,
                    m_customer_id: res_order_data.merchant_customer_id,
                    psp: res_order_data.psp,
                    payment_method: res_order_data.payment_mode,
                    m_payment_token: res_order_data?.card_id
                        ? res_order_data?.card_id
                        : "",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    return_url: res_order_data.success_url,
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
                        mask_card_number: res_order_data?.pan
                            ? res_order_data?.pan
                            : "",
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: res_order_data?.merchant_id
                        ? await enc_dec.cjs_encrypt(res_order_data?.merchant_id)
                        : "",
                };
            } else {
                new_res = {
                    m_order_id: res_order_data.merchant_order_id,
                    p_order_id: res_order_data?.order_id,
                    p_request_id: p_request_id,
                    psp_ref_id: pay_ref_id,
                    psp_txn_id: order_ref_id,
                    transaction_id: res_order_data?.payment_id,
                    status: "FAILED",
                    status_code: res_order_data.status,
                    currency: res_order_data?.currency,
                    amount: res_order_data?.amount,
                    m_customer_id: res_order_data.merchant_customer_id,
                    psp: res_order_data.psp,
                    payment_method: res_order_data.payment_mode,
                    m_payment_token: res_order_data?.card_id
                        ? res_order_data?.card_id
                        : "",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    return_url: res_order_data.failure_url,
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
                        mask_card_number: res_order_data?.pan
                            ? res_order_data?.pan
                            : "",
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: res_order_data?.merchant_id
                        ? await enc_dec.cjs_encrypt(res_order_data?.merchant_id)
                        : "",
                };
            }

            let response_dump = {
                order_id: order_id,
                type: "Payment",
                status: status == "true" ? "CAPTURED" : "FAILED",
                dump: JSON.stringify(new_res),
            };
            await orderTransactionModel.addTestResDump(response_dump);

            if (status == "true") {
                res.status(statusCode.ok).send(
                    successdatamsg(new_res, "Payment was successful.")
                );
            } else {
                res.status(statusCode.ok).send(
                    successdatamsg(new_res, "Payment was declined.")
                );
            }
        } catch (error) {
            winston.error(error);
            
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    test_bin: async (req, res) => {
        try {
            let bin_number = req.bodyString("bin_number");
            let test_card_arr = [
                {
                    card_no: "5123450000000008",
                    id_3d_secure: true,
                    country: "UNITED ARAB EMIRATES",
                    country_code: "AE",
                    card_brand: "MASTERCARD",
                    bin_number: "512345",
                    issuer: "MASHREQ BANK",
                    issuer_website: "http://www.mashreqbank.com/",
                    valid: true,
                    card_type: "CREDIT",
                    card_category: "STANDARD",
                    currency_code: "AED",
                    country_code3: "ARE",
                },
                {
                    card_no: "5111111111111118",
                    id_3d_secure: false,
                    country: "UNITED STATES",
                    country_code: "US",
                    card_brand: "MASTERCARD",
                    bin_number: "511111",
                    issuer: "FISERV SOLUTIONS, LLC",
                    issuer_website: "https://www.fiserv.com",
                    valid: true,
                    card_type: "DEBIT",
                    card_category: "STANDARD",
                    currency_code: "USD",
                    country_code3: "USA",
                },
                {
                    card_no: "4508750015741019",
                    id_3d_secure: true,
                    country: "UNITED KINGDOM",
                    country_code: "GB",
                    card_brand: "VISA",
                    bin_number: "450875",
                    issuer: "THE CO-OPERATIVE BANK PLC",
                    issuer_website: "",
                    valid: true,
                    card_type: "DEBIT",
                    card_category: "CLASSIC",
                    currency_code: "GBP",
                    country_code3: "GBR",
                },
                {
                    card_no: "4012000033330026",
                    id_3d_secure: false,
                    country: "RUSSIAN FEDERATION",
                    country_code: "RU",
                    card_brand: "VISA",
                    bin_number: "401200",
                    issuer: "",
                    issuer_website: "",
                    valid: true,
                    card_type: "CREDIT",
                    card_category: "CLASSIC",
                    currency_code: "RUB",
                    country_code3: "RUS",
                },
                {
                    card_no: "345678901234564",
                    id_3d_secure: true,
                    country: "SPAIN",
                    country_code: "ES",
                    card_brand: "AMERICAN EXPRESS",
                    bin_number: "345678",
                    issuer: "",
                    issuer_website: "",
                    valid: true,
                    card_type: "CREDIT",
                    card_category: "STANDARD",
                    currency_code: "EUR",
                    country_code3: "ESP",
                },
                {
                    card_no: "371449635398431",
                    id_3d_secure: false,
                    country: "UNITED STATES",
                    country_code: "US",
                    card_brand: "AMERICAN EXPRESS",
                    bin_number: "371449",
                    issuer: "AMERICAN EXPRESS US CONSUMER",
                    issuer_website: "https://www.americanexpress.com",
                    valid: true,
                    card_type: "CREDIT",
                    card_category: "PERSONAL",
                    issuer_phone: "1 (800) 528-4800",
                    currency_code: "USD",
                    country_code3: "USA",
                },
            ];
            let is_card = false;
            for (let val of test_card_arr) {
                if (val?.bin_number === bin_number) {
                    req.card_details = val;
                    is_card = true;
                }
            }
            
            if (!is_card) {
                res.status(statusCode.badRequest).send(
                    response.errormsg("Invalid card details. Try again!")
                );
            } else {
                res.status(statusCode.ok).send(
                    successdatamsg(
                        req.card_details,
                        "Card details fetched successfully."
                    )
                );
            }
        } catch (error) {
            winston.error(error);
            
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    test_order_details: async (req, res) => {
        let data = {
            merchant_details: {},
            order_details: {},
            prefer_lang: "",
        };

        let merchant_id = req.order.merchant_id;
        let table_name = "master_merchant";
        let selection =
            "theme,icon,logo, use_logo,we_accept_image, brand_color, accent_color,branding_language";
        merchantOrderModel
            .selectOne(
                selection,
                {
                    id: merchant_id,
                },
                table_name
            )
            .then(async (result) => {
                
                let mer_details = await merchantOrderModel.selectOne(
                    "company_name,link_tc",
                    {
                        merchant_id: merchant_id,
                    },
                    "master_merchant_details"
                );
                let paymentMethod = await SubmerchantModel.selectPaymentMethod(
                    merchant_id
                );
                result.icon =
                    process.env.STATIC_URL + "/static/files/" + result?.icon;
                result.logo =
                    process.env.STATIC_URL + "/static/files/" + result?.logo;
                result.we_accept_image =
                    process.env.STATIC_URL +
                    "/static/files/" +
                    result?.we_accept_image;
                result.merchant_name = mer_details
                    ? mer_details.company_name
                    : "";
                result.use_logo_instead_icon = result.use_logo;
                result.branding_language = enc_dec.cjs_encrypt(
                    result.branding_language,
                    (result.tc_link = mer_details?.link_tc
                        ? mer_details.link_tc
                        : "")
                );
                result.payment_method = paymentMethod;
                data.merchant_details = result;
                if (req.bodyString("browserFP") == "") {
                    data.pay_with_vault = 0;
                }
                let image_path = server_addr  + "/static/images/";
                let company_details = await helpers.company_details({
                    id: 1,
                });
                let tc = await helpers.get_terms_and_condition();
                let title = await helpers.get_title();
                result.company_details = {
                    fav_icon: image_path + company_details.fav_icon,
                    logo: image_path + company_details.company_logo,
                    letter_head: image_path + company_details.letter_head,
                    footer_banner: image_path + company_details.footer_banner,
                    title: title,
                    terms_and_condition: tc,
                };

                let selection =
                    "order_id,customer_name as name,customer_email as email,customer_mobile as mobile,amount,currency,status,return_url,payment_token_id as payment_token";
                merchantOrderModel
                    .selectOne(
                        selection,
                        {
                            order_id: req.bodyString("order_id"),
                        },
                        "test_orders"
                    )
                    .then(async (result_1) => {
                        result_1.env = req.order.env;
                        data.order_details = result_1;
                        let customer_email = result_1.email;
                        let fcm_fetch = await merchantOrderModel.selectOne(
                            "fcm_id",
                            {
                                email: customer_email,
                            },
                            "customers"
                        );
                        
                        
                        
                        if (
                            typeof fcm_fetch?.fcm_id == "undefined" ||
                            fcm_fetch?.fcm_id == ""
                        ) {
                            data.pay_with_vault = 0;
                        } else {
                            data.pay_with_vault = 1;
                        }
                        if (customer_email == "") {
                            data.prefer_lang = enc_dec.cjs_encrypt("1");
                        } else {
                            let table_name = "customers";
                            let selection = "prefer_lang";
                            let lang_resp = await merchantOrderModel.selectOne(
                                selection,
                                {
                                    email: customer_email,
                                },
                                table_name
                            );
                            if (lang_resp)
                                data.prefer_lang = enc_dec.cjs_encrypt(
                                    lang_resp.prefer_lang
                                );
                            else data.prefer_lang = enc_dec.cjs_encrypt("1");
                        }
                        res.status(statusCode.ok).send(
                            successdatamsg(data, "Details fetch successfully.")
                        );
                    })
                    .catch((error) => {
                    winston.error(error);
                        
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });
            })
            .catch((error) => {
                    winston.error(error);
                
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    test_void_func: async (req, res) => {
        let logs = await order_logs.get_test_log_data(
            req.bodyString("order_id")
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
                req.protocol
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
                req.method
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
                req.url
            }`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Request content-type = ${req.headers["content-type"]}`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
                req.headers["content-length"]
            }`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : TestOrder.test_void_func`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : request with headers ${JSON.stringify(req.headers)}`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : request with data ${JSON.stringify(req.body)}`
        );

        order_details = await orderTransactionModel.selectOne(
            "*",
            { order_id: req.bodyString("order_id") },
            "test_orders"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched order details`
        );

        let captured_data = await orderTransactionModel.selectOne(
            "capture_no,amount,currency",
            {
                order_id: req.bodyString("order_id"),
                type: "CAPTURE",
                status: "AUTHORISED",
            },
            "test_order_txn"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched capture details`
        );

        let await_3ds_data = await orderTransactionModel.selectOne(
            "payment_id,order_reference_id,capture_no",
            {
                order_id: req.bodyString("order_id"),
                status: "AWAIT_3DS",
            },
            "test_order_txn"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched await_3ds details`
        );

        try {
            let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

            let order_update = {
                status: "VOID",
                updated_at: updated_at,
            };
            await merchantOrderModel.updateDynamic(
                order_update,
                {
                    order_id: req.bodyString("order_id"),
                },
                "test_orders"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : updated order details with data ${JSON.stringify(
                    order_update
                )}`
            );

            let generate_payment_id = await helpers.make_sequential_no(
                "TST_TXN"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : generated txn id ${generate_payment_id}`
            );
            let order_txn = {
                order_id: req.bodyString("order_id"),
                type: "VOID",
                txn: generate_payment_id,
                status: "AUTHORISED",
                amount: captured_data?.amount,
                currency: captured_data?.currency,
                payment_id: await_3ds_data?.payment_id,
                order_reference_id: await_3ds_data?.order_reference_id,
                capture_no: "",
                created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            };
            await orderTransactionModel.test_txn_add(order_txn);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : order txn added with data ${JSON.stringify(order_txn)}`
            );

            let res_obj = {
                status: "VOID",
                p_order_id: order_txn.order_id,
                p_request_id: order_txn.txn,
                p_ref_id: order_details?.psp_id
                    ? enc_dec.cjs_encrypt(order_details?.psp_id)
                    : "",
                txn_id: generate_payment_id,
                amount: order_txn.amount,
                currency: order_txn.currency,
                date: moment(order_txn.created_at).format("DD/MM/YYYY"),
            };

            let resp_dump = {
                order_id: req.bodyString("order_id"),
                type: "VOID",
                status: "APPROVED",
                dump: JSON.stringify(order_txn),
            };
            await orderTransactionModel.addTestResDump(resp_dump);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : transaction dump added with data ${JSON.stringify(
                    resp_dump
                )}`
            );

            // let hook_info = await helpers.get_data_list(
            //     "*",
            //     "webhook_settings",
            //     {
            //         merchant_id: req.user.merchant_id,
            //     }
            // );
            
            // if (hook_info[0]) {
            //     if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            //         let url = hook_info[0].notification_url;
            //         let webhook_res = await send_webhook_data(
            //             url,
            //             res_obj,
            //             hook_info[0].notification_secret
            //         );
            //         
            //     }
            // }

            let logs_payload = {
                activity: JSON.stringify(logs),
                updated_at: updated_at,
            };
            await order_logs
                .update_test_logs_data(
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    logs_payload
                )
                .then((result) => {
                    
                })
                .catch((err) => {
                            winston.error(err);
                    
                });

            res.status(statusCode.ok).send(
                response.successansmsg(
                    res_obj,
                    "Transaction successfully void."
                )
            );
        } catch (error) {
            winston.error(error);
            
            let resp_dump = {
                order_id: req.bodyString("order_id"),
                type: "VOID",
                status: "FAILED",
                dump: JSON.stringify(error),
            };
            await orderTransactionModel.addTestResDump(resp_dump);
            res.status(statusCode.ok).send(response.errormsg(error));
        }
    },

    test_refund_func: async (req, res) => {
        let logs = await order_logs.get_test_log_data(
            req.bodyString("order_id")
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
                req.protocol
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
                req.method
            }`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
                req.url
            }`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : Request content-type = ${req.headers["content-type"]}`
        );
        logs.push(
            `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
                req.headers["content-length"]
            }`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : TestOrder.test_void_func`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : request with headers ${JSON.stringify(req.headers)}`
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : request with data ${JSON.stringify(req.body)}`
        );

        order_details = await orderTransactionModel.selectOne(
            "*",
            { order_id: req.bodyString("order_id") },
            "test_orders"
        );
        
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched order details`
        );

        let captured_data =
            await orderTransactionModel.selectOneWithTwoOfOneStatus(
                "capture_no,amount,currency",
                {
                    order_id: req.bodyString("order_id"),
                    status: "AUTHORISED",
                    type: "CAPTURE",
                },
                "test_order_txn"
            );
        
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched capture details`
        );

        let await_3ds_data = await orderTransactionModel.selectOne(
            "payment_id,order_reference_id,capture_no",
            {
                order_id: req.bodyString("order_id"),
                status: "AWAIT_3DS",
            },
            "test_order_txn"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : fetched await_3ds details`
        );

        try {
            let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

            let order_update = {
                status: "REFUNDED",
                updated_at: updated_at,
            };
            await merchantOrderModel.updateDynamic(
                order_update,
                {
                    order_id: req.bodyString("order_id"),
                },
                "test_orders"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : updated order details with data ${JSON.stringify(
                    order_update
                )}`
            );

            let generate_payment_id = await helpers.make_sequential_no(
                "TST_TXN"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : generated txn id ${generate_payment_id}`
            );

            let order_txn = {
                order_id: req.bodyString("order_id"),
                type: "REFUND",
                txn: generate_payment_id,
                status: "AUTHORISED",
                amount: req.bodyString("amount"),
                currency: captured_data?.currency,
                payment_id: await_3ds_data?.payment_id,
                order_reference_id: await_3ds_data?.order_reference_id,
                capture_no: "",
                created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            };
            await orderTransactionModel.test_txn_add(order_txn);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : order txn added with data ${JSON.stringify(order_txn)}`
            );
            let res_obj = {
                order_status: "REFUNDED",
                payment_id: order_txn.txn,
                order_id: order_txn.order_id,
                amount: req.bodyString("amount"),
                currency: captured_data?.currency
                    ? captured_data?.currency
                    : "",
                date: moment(order_txn.created_at).format("DD/MM/YYYY"),
            };
            let resp_dump = {
                order_id: req.bodyString("order_id"),
                type: "REFUND",
                status: "APPROVED",
                dump: JSON.stringify(order_txn),
            };
            await orderTransactionModel.addTestResDump(resp_dump);
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : transaction dump added with data ${JSON.stringify(
                    resp_dump
                )}`
            );

            // let hook_info = await helpers.get_data_list(
            //     "*",
            //     "webhook_settings",
            //     {
            //         merchant_id: req.user.merchant_id,
            //     }
            // );
            
            // if (hook_info[0]) {
            //     if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            //         let url = hook_info[0].notification_url;
            //         let webhook_res = await send_webhook_data(
            //             url,
            //             res_obj,
            //             hook_info[0].notification_secret
            //         );
            //         
            //     }
            // }

            let logs_payload = {
                activity: JSON.stringify(logs),
                updated_at: updated_at,
            };
            await order_logs
                .update_test_logs_data(
                    {
                        order_id: req.bodyString("order_id"),
                    },
                    logs_payload
                )
                .then((result) => {
                    
                })
                .catch((err) => {
                            winston.error(err);
                    
                });

            res.status(statusCode.ok).send(
                response.successansmsg(res_obj, "Refunded Successfully.")
            );
        } catch (error) {
            winston.error(error);
            
            let resp_dump = {
                order_id: req.bodyString("order_id"),
                type: "REFUND",
                status: "FAILED",
                dump: JSON.stringify(error),
            };
            await orderTransactionModel.addTestResDump(resp_dump);
            res.status(statusCode.ok).send(
                response.errormsg(error.response.data.errors[0].message)
            );
        }
    },

    cancel: async (req, res) => {
        const updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
        const status = "CANCELLED";
        const table_name = "test_orders";
        const txn = await merchantOrderModel.genratetxn();

        const res_order_data = await merchantOrderModel.selectOne(
            "*",
            {
                order_id: req.bodyString("order_id"),
            },
            table_name
        );
        let order_data = {
            status: status,
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
                let order_txn = {
                    status: status,
                    txn: txn,
                    // type: "PAYMENT",
                    order_id: res_order_data.order_id,
                    amount: res_order_data.amount,
                    currency: res_order_data.currency,
                    created_at: updated_at,
                    payment_id: "",
                    order_reference_id: "",
                    capture_no: "",
                };
                await orderTransactionModel.test_txn_add(order_txn);

                const browser_token = {
                    os: req.headers.os,
                    browser: req.headers.browser,
                    browser_version: req.headers.browser_version,
                    browser_fingerprint: req.headers.fp ? req.headers.fp : "",
                };

                const order_res = {
                    order_status: status,
                    payment_id: "",
                    order_id: req.bodyString("order_id"),
                    amount: req.order.amount,
                    currency: req.order.currency,
                    token:
                        enc_dec.cjs_encrypt(JSON.stringify(browser_token)) ||
                        "",
                    message: "Payment Cancelled by user",
                    date: moment(updated_at).format("DD-MM-YYYY HH:mm"),
                };
                return res
                    .status(statusCode.ok)
                    .send(successdatamsg(order_res, "Cancelled successfully."));
            })
            .catch((error) => {
                    winston.error(error);
                
                return res
                    .status(statusCode.internalError)
                    .send(response.errormsg(error.message));
            });
    },

    test_capture: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString("id"));
        let order_id = await helpers.get_data_list("order_id", "test_orders", {
            id: id,
        });

        let order_status = await helpers.get_data_list(
            "status",
            "test_orders",
            { order_id: order_id[0].order_id }
        );
        
        
        

        if (
            order_status[0]?.status === "AUTHORISED" ||
            order_status[0]?.status === "PARTIALLY_CAPTURED"
        ) {
            let captured_data = await orderTransactionModel.selectOne(
                "order_reference_id,payment_id,amount,currency",
                {
                    order_id: order_id[0].order_id,
                    status: "AUTHORISED",
                },
                "test_order_txn"
            );

            try {
                let order_update = {
                    status: "CAPTURED",
                };

                let get_order_amount = await orderTransactionModel.selectOne(
                    "amount_left",
                    {
                        order_id: order_id[0].order_id,
                        status: "AUTHORISED",
                    },
                    "test_orders"
                );
                

                let get_partial_order_amount =
                    await orderTransactionModel.selectOne(
                        "amount_left",
                        {
                            order_id: order_id[0].order_id,
                            status: "PARTIALLY_CAPTURED",
                        },
                        "test_orders"
                    );
                

                let check_amount = 0;
                if (get_order_amount) {
                    check_amount =
                        get_order_amount.amount_left - req.body.amount;
                } else if (get_partial_order_amount) {
                    check_amount =
                        get_partial_order_amount.amount_left - req.body.amount;
                }

                if (check_amount > 0) {
                    order_update.status = "PARTIALLY_CAPTURED";
                }
                order_update.amount_left = check_amount;

                await merchantOrderModel.updateDynamic(
                    order_update,
                    {
                        order_id: order_id[0].order_id,
                    },
                    "test_orders"
                );

                let res_order_data = await merchantOrderModel.selectOne(
                    "*",
                    {
                        order_id: order_id[0].order_id,
                    },
                    "test_orders"
                );

                // request id table entry
                let p_request_id = await helpers.make_sequential_no("TST_REQ");
                let merchant_id = await helpers.get_data_list(
                    "merchant_id",
                    "test_orders",
                    { order_id: order_id[0].order_id }
                );

                let order_req = {
                    merchant_id: merchant_id[0].merchant_id,
                    order_id: order_id[0].order_id,
                    request_id: p_request_id,
                    request: JSON.stringify(req.body),
                };
                await helpers.common_add(order_req, "test_generate_request_id");

                let capture_no = await helpers.generateRandomString();
                let generate_payment_id = await helpers.make_sequential_no(
                    "TST_TXN"
                );
                let order_txn = {
                    status: "AUTHORISED",
                    txn: generate_payment_id,
                    type: "CAPTURE",
                    payment_id: captured_data?.payment_id,
                    order_reference_id: captured_data?.order_reference_id,
                    capture_no: capture_no,
                    order_id: order_id[0].order_id,
                    amount: req.body.amount,
                    currency: res_order_data?.currency,
                    created_at:moment().format('YYYY-MM-DD HH:mm:ss'),
                };
                await orderTransactionModel.test_txn_add(order_txn);

                let new_res = {
                    m_order_id: res_order_data.merchant_order_id,
                    p_order_id: res_order_data?.order_id,
                    p_request_id: p_request_id,
                    psp_ref_id: captured_data?.payment_id,
                    psp_txn_id: captured_data?.order_reference_id,
                    transaction_id: generate_payment_id,
                    status:
                        res_order_data.status === "FAILED"
                            ? "FAILED"
                            : "SUCCESS",
                    status_code: res_order_data?.status,
                    currency: res_order_data?.currency,
                    amount: req.body.amount,
                    m_customer_id: res_order_data?.merchant_customer_id,
                    psp: res_order_data?.psp,
                    payment_method: res_order_data?.payment_mode,
                    m_payment_token: res_order_data?.card_id
                        ? res_order_data?.card_id
                        : "",
                    transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                    return_url: res_order_data?.success_url,
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
                        mask_card_number: res_order_data?.pan
                            ? res_order_data?.pan
                            : "",
                    },
                    apm_name: "",
                    apm_identifier: "",
                    sub_merchant_identifier: res_order_data?.merchant_id
                        ? await enc_dec.cjs_encrypt(res_order_data?.merchant_id)
                        : "",
                };

                let resp_dump = {
                    order_id: res_order_data?.order_id,
                    type: "CAPTURE",
                    status: "SUCCESS",
                    dump: JSON.stringify(new_res),
                };
                await orderTransactionModel.addTestResDump(resp_dump);

                res.status(statusCode.ok).send(
                    response.successansmsg(
                        new_res,
                        "Transaction successfully Captured."
                    )
                );
            } catch (error) {
            winston.error(error);
                
                let resp_dump = {
                    order_id: order_id[0].order_id,
                    type: "CAPTURE",
                    status: "FAILED",
                    dump: JSON.stringify(error),
                };
                await orderTransactionModel.addTestResDump(resp_dump);
                res.status(statusCode.ok).send(
                    response.errormsg("Unable to capture transaction")
                );
            }
        } else {
            res.status(statusCode.badRequest).send(
                response.errormsg("Order Already Processed!!")
            );
        }
    },

    test_list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        };

        if (req.bodyString("perpage") && req.bodyString("page")) {
            perpage = parseInt(req.bodyString("perpage"));
            start = parseInt(req.bodyString("page"));
            limit.perpage = perpage;
            limit.start = (start - 1) * perpage;
        }

        let and_filter_obj = {};
        let date_condition = {};

        let table_name = "test_orders";

        if (req?.user?.merchant_id) {
            and_filter_obj.merchant_id = req.user.merchant_id;
        }
        if (req?.user?.sub_merchant_id) {
            and_filter_obj.super_merchant = req.user.sub_merchant_id;
        }

        if (req.bodyString("from_date")) {
            date_condition.from_date = req.bodyString("from_date");
        }

        if (req.bodyString("to_date")) {
            date_condition.to_date = req.bodyString("to_date");
        }

        TransactionsModel.open_select(
            and_filter_obj,
            date_condition,
            limit,
            table_name
        )
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let today = moment().format("YYYY-MM-DD");
                    let order_date = moment(val.created_at).format(
                        "YYYY-MM-DD"
                    );
                    let res = {
                        // transactions_id: await enc_dec.cjs_encrypt(val.id),
                        // merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
                        order_id: val?.order_id ? val?.order_id : "",
                        payment_id: val?.payment_id ? val?.payment_id : "",
                        merchant_name: val?.merchant_id
                            ? await helpers.get_merchantdetails_name_by_id(
                                  val?.merchant_id
                              )
                            : "",
                        merchant_order_id: val?.merchant_order_id
                            ? val?.merchant_order_id
                            : "",
                        order_amount: val?.amount ? val.amount.toFixed(2) : "",
                        order_currency: val?.currency ? val?.currency : "",
                        customer_name: val?.customer_name
                            ? val?.customer_name
                            : "",
                        customer_email: val?.customer_email
                            ? val?.customer_email
                            : "",
                        customer_mobile: val?.customer_mobile
                            ? val?.customer_mobile
                            : "",
                        channel: val?.origin ? val?.origin : "",
                        status: val?.status ? val?.status : "",
                        high_risk_country: val.high_risk_country
                            ? val.high_risk_country
                            : 0,
                        high_risk_transaction: val.high_risk_transaction
                            ? val.high_risk_transaction
                            : 0,
                        block_for_suspicious_ip: val.block_for_suspicious_ip
                            ? val.block_for_suspicious_ip
                            : 0,
                        block_for_suspicious_email:
                            val.block_for_suspicious_email
                                ? val.block_for_suspicious_email
                                : 0,
                        block_for_transaction_limit:
                            val.block_for_transaction_limit
                                ? val.block_for_transaction_limit
                                : 0,
                        can_be_voided: moment(order_date).isSame(today)
                            ? "1"
                            : "0",
                        transaction_date: moment(val.created_at).format(
                            "DD-MM-YYYY H:mm:ss"
                        ),
                    };
                    send_res.push(res);
                }
                total_count = await TransactionsModel.open_get_count(
                    and_filter_obj,
                    date_condition,
                    table_name
                );

                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "List fetched successfully.",
                        total_count
                    )
                );
            })
            .catch((error) => {
                    winston.error(error);
                
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    transaction_details: async (req, res) => {
        try {
            let and_condition = {};

            if (req.bodyString("m_order_id")) {
                and_condition.merchant_order_id = req.bodyString("m_order_id");
            }
            if (req.bodyString("p_order_id")) {
                and_condition.order_id = req.bodyString("p_order_id");
            }
            if (req.bodyString("txn_id")) {
                and_condition.payment_id = req.bodyString("txn_id");
            }

            let result = await orderTransactionModel.selectOne(
                "*",
                and_condition,
                "test_orders"
            );
            

            let transaction_condition = {
                order_id: req.bodyString("p_order_id"),
            };
            let transaction = await orderTransactionModel.selectDynamic(
                transaction_condition,
                "*",
                "test_order_txn"
            );
            
            let trans_history = [];
            for (let val of transaction) {
                let temp = {
                    order_id: val?.order_id ? val?.order_id : "",
                    txn: val?.txn ? val?.txn : "",
                    status: val?.status ? val?.status : "",
                    created_at: val?.created_at ? val?.created_at : "",
                };
                trans_history.push(temp);
            }

            let trans_data = await helpers.get_trans_data(result?.order_id);

            let new_res = {
                data_id: enc_dec.cjs_encrypt(result?.id),
                m_order_id: result?.merchant_order_id
                    ? result?.merchant_order_id
                    : "",
                p_order_id: result?.order_id ? result?.order_id : "",
                p_request_id: trans_data[0]?.last_request_id
                    ? trans_data[0]?.last_request_id
                    : "",
                psp_ref_id: trans_data[0]?.last_psp_ref_id
                    ? trans_data[0]?.last_psp_ref_id
                    : "",
                transaction_id: result?.payment_id ? result?.payment_id : "",
                psp_txn_id: trans_data[0]?.last_psp_txn_id
                    ? trans_data[0]?.last_psp_txn_id
                    : "",
                transaction_date:
                    result && result.updated_at
                        ? moment(result.updated_at).format(
                              "DD-MM-YYYY hh:mm:ss"
                          )
                        : "",
                transaction_status: result?.status ? result?.status : "",
                status_code: result?.status ? result?.status : "",
                status: "",
                currency: result?.currency ? result?.currency : "",
                amount: result?.amount ? result?.amount.toFixed(2) : "",
                psp: result?.psp ? result?.psp : "",
                payment_method: result?.payment_mode
                    ? result?.payment_mode
                    : "",
                payment_method_id: "", // missing field
                is_oneclick: "", // missing field
                is_retry: "", // missing field
                is_cascade: "", // missing field
                m_customer_id: result?.merchant_customer_id
                    ? enc_dec.cjs_encrypt(result?.merchant_customer_id)
                    : "",
                customer_email: result?.customer_email
                    ? result?.customer_email
                    : "",
                customer_mobile_code: result?.customer_code
                    ? result?.customer_code
                    : "",
                customer_mobile: result?.customer_mobile
                    ? result?.customer_mobile
                    : "",
                customer_country: result?.billing_country
                    ? result?.billing_country
                    : "",
                m_payment_token: result?.card_id ? result?.card_id : "",
                payment_method_data: {
                    scheme: result?.scheme ? result?.scheme : "",
                    card_country: result?.card_country
                        ? result?.card_country
                        : "",
                    card_type: result?.cardType ? result?.cardType : "",
                    masked_pan: result?.pan ? result?.pan : "",
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: result?.merchant_id
                    ? await enc_dec.cjs_encrypt(result?.merchant_id)
                    : "",
                transaction_history: trans_history,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    new_res,
                    "Successfully fetched transaction details"
                )
            );
        } catch (err) {
            winston.error(err);
            res.status(statusCode.internalError).send(
                response.errormsg(err.message)
            );
        }
    },

    transaction_list: async (req, res) => {
        try {
            let limit = {
                perpage: 0,
                page: 0,
            };

            if (req.bodyString("perpage") && req.bodyString("page")) {
                perpage = parseInt(req.bodyString("perpage"));
                start = parseInt(req.bodyString("page"));
                limit.perpage = perpage;
                limit.start = (start - 1) * perpage;
            }

            let and_filter_obj = {};
            let date_condition = {};
            let amount_condition = {};
            let like_condition = {};
            let trans_date = {};

            let table_name = "test_orders";

            if (req?.user?.merchant_id) {
                and_filter_obj.merchant_id = req.user.merchant_id;
            }
            if (req?.user?.sub_merchant_id) {
                and_filter_obj.super_merchant = req.user.sub_merchant_id;
            }

            // all filters
            if (req.bodyString("p_order_id")) {
                and_filter_obj.order_id = req.bodyString("p_order_id");
            }
            if (req.bodyString("transaction_id")) {
                and_filter_obj.payment_id = req.bodyString("transaction_id");
            }
            if (req.bodyString("transaction_date")) {
                trans_date.updated_at = req.bodyString("transaction_date");
            }
            if (req.bodyString("status_code")) {
                and_filter_obj.status = req.bodyString("status_code");
            }
            if (req.bodyString("status")) {
                // and_filter_obj.status = req.bodyString("status"); // missing field
            }
            if (req.bodyString("payment_method_id")) {
                // and_filter_obj.payment_method_id = req.bodyString("payment_method_id"); // missing field
            }
            if (req.bodyString("payment_method")) {
                and_filter_obj.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("payment_mode")) {
                and_filter_obj.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("m_payment_token")) {
                and_filter_obj.card_id = req.bodyString("m_payment_token");
            }
            if (req.bodyString("card_bin")) {
                like_condition.pan = req.bodyString("card_bin");
            }
            if (req.bodyString("processor")) {
                and_filter_obj.psp = req.bodyString("processor");
            }
            if (req.bodyString("mid")) {
                and_filter_obj.terminal_id = req.bodyString("mid");
            }
            if (req.bodyString("currency_code")) {
                and_filter_obj.currency = req.bodyString("currency_code");
            }
            if (req.bodyString("from_date")) {
                date_condition.from_date = req.bodyString("from_date");
            }
            if (req.bodyString("to_date")) {
                date_condition.to_date = req.bodyString("to_date");
            }
            if (req.bodyString("min_amount")) {
                amount_condition.min_amount = req.bodyString("min_amount");
            }
            if (req.bodyString("max_amount")) {
                amount_condition.max_amount = req.bodyString("max_amount");
            }
            if (req.bodyString("m_customer_id")) {
                and_filter_obj.merchant_customer_id = await enc_dec.cjs_decrypt(
                    req.bodyString("m_customer_id")
                );
            }
            if (req.bodyString("customer_email")) {
                and_filter_obj.customer_email =
                    req.bodyString("customer_email");
            }
            if (req.bodyString("customer_mobile")) {
                and_filter_obj.customer_mobile =
                    req.bodyString("customer_mobile");
            }
            if (req.bodyString("customer_country")) {
                and_filter_obj.billing_country =
                    req.bodyString("customer_country");
            }
            if (req.bodyString("apm_identifier")) {
                // and_filter_obj.apm_identifier = req.bodyString("apm_identifier"); // missing field
            }
            if (req.bodyString("is_oneclick")) {
                // and_filter_obj.is_oneclick = req.bodyString("is_oneclick"); // missing field
            }
            if (req.bodyString("is_retry")) {
                // and_filter_obj.is_retry = req.bodyString("is_retry"); // missing field
            }
            if (req.bodyString("is_cascade")) {
                // and_filter_obj.is_cascade = req.bodyString("is_cascade"); // missing field
            }

            let result = await TransactionsModel.open_trans_select(
                and_filter_obj,
                date_condition,
                amount_condition,
                like_condition,
                limit,
                table_name,
                trans_date
            );
            let resp_data = [];
            if (result.length > 0) {
                for (let val of result) {
                    let trans_data = await helpers.get_trans_data(
                        val?.order_id
                    );
                    

                    let new_res = {
                        data_id: enc_dec.cjs_encrypt(val?.id),
                        m_order_id: val?.merchant_order_id
                            ? val?.merchant_order_id
                            : "",
                        p_order_id: val?.order_id ? val?.order_id : "",
                        p_request_id: trans_data[0]?.last_request_id
                            ? trans_data[0]?.last_request_id
                            : "",
                        psp_ref_id: trans_data[0]?.last_psp_ref_id
                            ? trans_data[0]?.last_psp_ref_id
                            : "",
                        transaction_id: val?.payment_id ? val?.payment_id : "",
                        psp_txn_id: trans_data[0]?.last_psp_txn_id
                            ? trans_data[0]?.last_psp_txn_id
                            : "",
                        transaction_date:
                            val && val.updated_at
                                ? moment(val.updated_at).format(
                                      "DD-MM-YYYY hh:mm:ss"
                                  )
                                : "",
                        transaction_status: val?.status ? val?.status : "",
                        status_code: val?.status ? val?.status : "",
                        status: "",
                        currency: val?.currency ? val?.currency : "",
                        amount: val?.amount ? val?.amount.toFixed(2) : "",
                        psp: val?.psp ? val?.psp : "",
                        payment_method: val?.payment_mode
                            ? val?.payment_mode
                            : "",
                        payment_method_id: "", // missing field
                        is_oneclick: "", // missing field
                        is_retry: "", // missing field
                        is_cascade: "", // missing field
                        m_customer_id: val?.merchant_customer_id
                            ? enc_dec.cjs_encrypt(val?.merchant_customer_id)
                            : "",
                        customer_email: val?.customer_email
                            ? val?.customer_email
                            : "",
                        customer_mobile_code: val?.customer_code
                            ? val?.customer_code
                            : "",
                        customer_mobile: val?.customer_mobile
                            ? val?.customer_mobile
                            : "",
                        customer_country: val?.billing_country
                            ? val?.billing_country
                            : "",
                        m_payment_token: val?.card_id ? val?.card_id : "",
                        payment_method_data: {
                            scheme: val?.scheme ? val?.scheme : "",
                            card_country: val?.card_country
                                ? val?.card_country
                                : "",
                            card_type: val?.cardType ? val?.cardType : "",
                            masked_pan: val?.pan ? val?.pan : "",
                        },
                        apm_name: "",
                        apm_identifier: "",
                        sub_merchant_identifier: val?.merchant_id
                            ? await enc_dec.cjs_encrypt(val?.merchant_id)
                            : "",
                    };

                    resp_data.push(new_res);
                }
            }
            total_count = await TransactionsModel.open_trans_get_count(
                and_filter_obj,
                date_condition,
                amount_condition,
                like_condition,
                table_name,
                trans_date
            );
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    resp_data,
                    "Successfully fetched list",
                    total_count
                )
            );
        } catch (err) {
            winston.error(err);
            res.status(statusCode.internalError).send(
                response.errormsg(err.message)
            );
        }
    },

    transaction: async (req, res) => {
        try {
            let action = req.bodyString("action");
            let order_id = req.bodyString("p_order_id");
            let condition = {
                order_id: order_id,
                // status: "AUTHORISED"
            };

            if (req.bodyString("m_order_id")) {
                condition.merchant_order_id = req.bodyString("m_order_id");
            }

            if (req.bodyString("txn_id")) {
                condition.payment_id = req.bodyString("txn_id");
            }

            let order = await orderTransactionModel.selectOne(
                "id",
                condition,
                "orders"
            );
            

            // let txn_details
            // if (req.bodyString('p_order_id')) {
            //     txn_details = await orderTransactionModel.selectOne('order_id,txn', {payment_id: req.bodyString('p_order_id')}, 'order_txn')
            // }

            
            if (order) {
                switch (action) {
                    case "CAPTURE": {
                        await test_capture(req, res);
                        break;
                    }
                    case "VOID": {
                        await test_void_func(req, res);
                        break;
                    }
                    case "REFUND": {
                        await test_refund_func(req, res);
                        break;
                    }
                    default:
                        return;
                }
            } else {
                res.status(statusCode.ok).send(
                    response.errormsg(
                        "Order does not exist/not prcessed yet/already proccessed"
                    )
                );
            }
        } catch (err) {
            winston.error(err);
            res.status(statusCode.internalError).send(
                response.errormsg(err.message)
            );
        }
    },
};

const test_refund_func = async (req, res) => {
    let logs = await order_logs.get_test_log_data(req.bodyString("p_order_id"));
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
            req.protocol
        }`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
            req.method
        }`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
            req.url
        }`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Request content-type = ${req.headers["content-type"]}`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
            req.headers["content-length"]
        }`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : TestOrder.test_void_func`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(req.body)}`
    );

    order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: req.bodyString("p_order_id") },
        "test_orders"
    );
    
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : fetched order details`
    );

    let captured_data = await orderTransactionModel.selectOneWithTwoOfOneStatus(
        "capture_no,amount,currency",
        {
            order_id: req.bodyString("p_order_id"),
            status: "AUTHORISED",
            type: "CAPTURE",
        },
        "test_order_txn"
    );
    
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : fetched capture details`
    );

    let await_3ds_data = await orderTransactionModel.selectOne(
        "payment_id,order_reference_id,capture_no",
        {
            order_id: req.bodyString("p_order_id"),
            status: "AWAIT_3DS",
        },
        "test_order_txn"
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : fetched await_3ds details`
    );

    try {
        let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

        let order_update = {
            status: "REFUNDED",
            updated_at: updated_at,
        };
        await merchantOrderModel.updateDynamic(
            order_update,
            {
                order_id: req.bodyString("p_order_id"),
            },
            "test_orders"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : updated order details with data ${JSON.stringify(
                order_update
            )}`
        );

        let generate_payment_id = await helpers.make_sequential_no("TST_TXN");
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : generated txn id ${generate_payment_id}`
        );

        let order_txn = {
            order_id: req.bodyString("p_order_id"),
            type: "REFUND",
            txn: generate_payment_id,
            status: "AUTHORISED",
            amount: req.body.amount.value,
            currency: captured_data?.currency,
            payment_id: await_3ds_data?.payment_id,
            order_reference_id: await_3ds_data?.order_reference_id,
            capture_no: "",
            created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
        };
        await orderTransactionModel.test_txn_add(order_txn);
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : order txn added with data ${JSON.stringify(order_txn)}`
        );
        let res_obj = {
            order_status: "REFUNDED",
            payment_id: order_txn.txn,
            order_id: order_txn.order_id,
            amount: req.body.amount.value,
            currency: captured_data?.currency ? captured_data?.currency : "",
            date: moment(order_txn.created_at).format("DD/MM/YYYY"),
        };
        let resp_dump = {
            order_id: req.bodyString("p_order_id"),
            type: "REFUND",
            status: "APPROVED",
            dump: JSON.stringify(order_txn),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : transaction dump added with data ${JSON.stringify(resp_dump)}`
        );

        let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
        };
        await order_logs
            .update_test_logs_data(
                {
                    order_id: req.bodyString("p_order_id"),
                },
                logs_payload
            )
            .then((result) => {
                
            })
            .catch((err) => {
                winston.error(err);
                
            });

        res.status(statusCode.ok).send(
            response.successansmsg(res_obj, "Refunded Successfully.")
        );
    } catch (error) {
        winston.error(error);
        
        let resp_dump = {
            order_id: req.bodyString("p_order_id"),
            type: "REFUND",
            status: "FAILED",
            dump: JSON.stringify(error),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        res.status(statusCode.ok).send(
            response.errormsg(error.response.data.errors[0].message)
        );
    }
};

const test_void_func = async (req, res) => {
    let logs = await order_logs.get_test_log_data(req.bodyString("p_order_id"));
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${
            req.protocol
        }`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${
            req.method
        }`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${
            req.url
        }`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : Request content-type = ${req.headers["content-type"]}`
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${
            req.headers["content-length"]
        }`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : TestOrder.test_void_func`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with headers ${JSON.stringify(req.headers)}`
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : request with data ${JSON.stringify(req.body)}`
    );

    order_details = await orderTransactionModel.selectOne(
        "*",
        { order_id: req.bodyString("p_order_id") },
        "test_orders"
    );
    logs.push(
        `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : fetched order details`
    );

    let captured_data = await orderTransactionModel.selectOne(
        "capture_no,amount,currency",
        {
            order_id: req.bodyString("p_order_id"),
            type: "CAPTURE",
            status: "AUTHORISED",
        },
        "test_order_txn"
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : fetched capture details`
    );

    let await_3ds_data = await orderTransactionModel.selectOne(
        "payment_id,order_reference_id,capture_no",
        {
            order_id: req.bodyString("p_order_id"),
            status: "AWAIT_3DS",
        },
        "test_order_txn"
    );
    logs.push(
        `${moment().format(
            "DD/MM/YYYY HH:mm:ss.SSS"
        )} : fetched await_3ds details`
    );

    try {
        let updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

        let order_update = {
            status: "VOID",
            updated_at: updated_at,
        };
        await merchantOrderModel.updateDynamic(
            order_update,
            {
                order_id: req.bodyString("p_order_id"),
            },
            "test_orders"
        );
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : updated order details with data ${JSON.stringify(
                order_update
            )}`
        );

        let generate_payment_id = await helpers.make_sequential_no("TST_TXN");
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : generated txn id ${generate_payment_id}`
        );
        let order_txn = {
            order_id: req.bodyString("p_order_id"),
            type: "VOID",
            txn: generate_payment_id,
            status: "AUTHORISED",
            amount: captured_data?.amount,
            currency: captured_data?.currency,
            payment_id: await_3ds_data?.payment_id,
            order_reference_id: await_3ds_data?.order_reference_id,
            capture_no: "",
            created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
        };
        await orderTransactionModel.test_txn_add(order_txn);
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : order txn added with data ${JSON.stringify(order_txn)}`
        );

        let res_obj = {
            status: "VOID",
            p_order_id: order_txn.order_id,
            p_request_id: order_txn.txn,
            p_ref_id: order_details?.psp_id
                ? enc_dec.cjs_encrypt(order_details?.psp_id)
                : "",
            txn_id: generate_payment_id,
            amount: order_txn.amount,
            currency: order_txn.currency,
            date: moment(order_txn.created_at).format("DD/MM/YYYY"),
        };

        let resp_dump = {
            order_id: req.bodyString("p_order_id"),
            type: "VOID",
            status: "APPROVED",
            dump: JSON.stringify(order_txn),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        logs.push(
            `${moment().format(
                "DD/MM/YYYY HH:mm:ss.SSS"
            )} : transaction dump added with data ${JSON.stringify(resp_dump)}`
        );

        let logs_payload = {
            activity: JSON.stringify(logs),
            updated_at: updated_at,
        };
        await order_logs
            .update_test_logs_data(
                {
                    order_id: req.bodyString("p_order_id"),
                },
                logs_payload
            )
            .then((result) => {
                
            })
            .catch((err) => {
                winston.error(err);
                
            });

        res.status(statusCode.ok).send(
            response.successansmsg(res_obj, "Transaction successfully void.")
        );
    } catch (error) {
        winston.error(error);
        
        let resp_dump = {
            order_id: req.bodyString("p_order_id"),
            type: "VOID",
            status: "FAILED",
            dump: JSON.stringify(error),
        };
        await orderTransactionModel.addTestResDump(resp_dump);
        res.status(statusCode.ok).send(response.errormsg(error));
    }
};

const test_capture = async (req, res) => {
    let order_status = await helpers.get_data_list("status", "test_orders", {
        order_id: req.bodyString("p_order_id"),
    });

    if (
        order_status[0]?.status === "AUTHORISED" ||
        order_status[0]?.status === "PARTIALLY_CAPTURED"
    ) {
        let captured_data = await orderTransactionModel.selectOne(
            "order_reference_id,payment_id,amount,currency",
            {
                order_id: req.bodyString("p_order_id"),
                status: "AUTHORISED",
            },
            "test_order_txn"
        );

        try {
            let order_update = {
                status: "CAPTURED",
            };

            let get_order_amount = await orderTransactionModel.selectOne(
                "amount_left",
                {
                    order_id: req.bodyString("p_order_id"),
                    status: "AUTHORISED",
                },
                "test_orders"
            );
            

            let get_partial_order_amount =
                await orderTransactionModel.selectOne(
                    "amount_left",
                    {
                        order_id: req.bodyString("p_order_id"),
                        status: "PARTIALLY_CAPTURED",
                    },
                    "test_orders"
                );
            

            let check_amount = 0;
            if (get_order_amount) {
                check_amount = get_order_amount.amount_left - req.body.amount.value;
            } else if (get_partial_order_amount) {
                check_amount =
                    get_partial_order_amount.amount_left - req.body.amount.value;
            }

            if (check_amount > 0) {
                order_update.status = "PARTIALLY_CAPTURED";
            }
            order_update.amount_left = check_amount;

            

            await merchantOrderModel.updateDynamic(
                order_update,
                {
                    order_id: req.bodyString("p_order_id"),
                },
                "test_orders"
            );

            let res_order_data = await merchantOrderModel.selectOne(
                "*",
                {
                    order_id: req.bodyString("p_order_id"),
                },
                "test_orders"
            );

            // request id table entry
            let p_request_id = await helpers.make_sequential_no("TST_REQ");
            let merchant_id = await helpers.get_data_list(
                "merchant_id",
                "test_orders",
                { order_id: req.bodyString("p_order_id") }
            );

            let order_req = {
                merchant_id: merchant_id[0].merchant_id,
                order_id: req.bodyString("p_order_id"),
                request_id: p_request_id,
                request: JSON.stringify(req.body),
            };
            await helpers.common_add(order_req, "test_generate_request_id");

            let capture_no = await helpers.generateRandomString();
            let generate_payment_id = await helpers.make_sequential_no(
                "TST_TXN"
            );
            let order_txn = {
                status: "AUTHORISED",
                txn: generate_payment_id,
                type: "CAPTURE",
                payment_id: captured_data?.payment_id,
                order_reference_id: captured_data?.order_reference_id,
                capture_no: capture_no,
                order_id: req.bodyString("p_order_id"),
                amount: req.body.amount.value,
                currency: res_order_data?.currency,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            };
            await orderTransactionModel.test_txn_add(order_txn);

            let new_res = {
                m_order_id: res_order_data.merchant_order_id,
                p_order_id: res_order_data?.order_id,
                p_request_id: p_request_id,
                psp_ref_id: captured_data?.payment_id,
                psp_txn_id: captured_data?.order_reference_id,
                transaction_id: generate_payment_id,
                status:
                    res_order_data.status === "FAILED" ? "FAILED" : "SUCCESS",
                status_code: res_order_data?.status,
                currency: res_order_data?.currency,
                amount: req.body.amount.value,
                m_customer_id: res_order_data?.merchant_customer_id,
                psp: res_order_data?.psp,
                payment_method: res_order_data?.payment_mode,
                m_payment_token: res_order_data?.card_id
                    ? res_order_data?.card_id
                    : "",
                transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                return_url: res_order_data?.success_url,
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
                    mask_card_number: res_order_data?.pan
                        ? res_order_data?.pan
                        : "",
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: res_order_data?.merchant_id
                    ? await enc_dec.cjs_encrypt(res_order_data?.merchant_id)
                    : "",
            };

            let resp_dump = {
                order_id: res_order_data?.order_id,
                type: "CAPTURE",
                status: "SUCCESS",
                dump: JSON.stringify(new_res),
            };
            await orderTransactionModel.addTestResDump(resp_dump);

            res.status(statusCode.ok).send(
                response.successansmsg(
                    new_res,
                    "Transaction successfully Captured."
                )
            );
        } catch (error) {
            winston.error(error);
            
            let resp_dump = {
                order_id: req.bodyString("p_order_id"),
                type: "CAPTURE",
                status: "FAILED",
                dump: JSON.stringify(error),
            };
            await orderTransactionModel.addTestResDump(resp_dump);
            res.status(statusCode.ok).send(
                response.errormsg("Unable to capture transaction")
            );
        }
    } else {
        res.status(statusCode.badRequest).send(
            response.errormsg("Order Already Processed!!")
        );
    }
};

module.exports = MerchantOrder;
