const axios = require('axios');
const credentials = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const merchantOrderModel = require('../../models/merchantOrder');
const moment = require('moment');
const order_transactionModel = require('../../models/order_transaction');
const enc_dec = require("../../utilities/decryptor/decryptor");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const { v4: uuidv4 } = require('uuid')
const { countryToAlpha3 } = require('country-to-iso');
const { send_webhook_data } = require("../webhook_settings");
const directpay = async (req, res) => {
    let payment_id;
    const order_id = req.body.order_id;
    const mode = req.body.payment_mode;
    let order_table = mode == 'live' ? 'orders' : 'test_orders';
    let txn_table = mode == 'live' ? 'order_txn' : 'test_order_txn';
    let txn_response_dump = mode == 'live' ? 'txn_response_dump' : 'test_txn_response_dump';
    let generate_request_id_table = mode=='live'?'generate_request_id':'test_generate_request_id';
    let body_date = {
        ...req.body,
    };
    body_date.card = "**** **** **** " + req.bodyString("card").slice(-4);
    body_date.cvv = "****";
    var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let card_no = "";
    let enc_customer_id = "";
    let card_details;
    let full_card_no = "";
    let name_on_card="";
    let expiry = "";
    if (req.bodyString("card_id") != "") {
        let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
        card_details = await merchantOrderModel.selectOne(
            "*",
            {
                id: card_id,
            },
            "customers_cards"
        );

        card_no = card_details.last_4_digit;
        enc_customer_id = card_details.cid;
        full_card_no = await enc_dec.dynamic_decryption(
            card_details.card_number,
            card_details.cipher_id
        );
        name_on_card = card_details.name_on_card;
        expiry = card_details.card_expiry
        .split("/")
        .reverse()
        .join("-");
    } else {
        full_card_no = req.bodyString("card");
        card_no = req.bodyString("card").slice(-4);
        enc_customer_id = req.customer_id;
        name_on_card = req.bodyString("form_name");
        expiry = req.body.expiry_date.split("/").reverse().join("-");
    }
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
    if (req.bodyString("card_id") != "") {
        card_id = req.bodyString("card_id");
    } else if (req.card_id) {
        card_id = req.card_id;
    } else {
        card_id = "";
    }
    let order_data = {
        browser: req.headers.browser,
        browser_version: req.headers["x-browser-version"],
        os: req.headers.os,
        ip: req.headers.ip,
        ip_country: req.headers.ipcountry,
        card_no: card_no,
        cid: enc_customer_id,
        card_id: card_id,
        browser_fingerprint: browser_token_enc,
        updated_at: updated_at,
        card_country: req.card_details.country,
        cardType: req.card_details.card_type,
        scheme: req.card_details.card_brand,
        pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
            full_card_no.length - 4
        )}`,
        cardHolderName:name_on_card,
        expiry:expiry
    };
    const order_date_update = await merchantOrderModel
        .updateDynamic(
            order_data,
            {
                order_id: order_id,
            },
            order_table
        )

    const order_details = await merchantOrderModel.selectOne(
        "*",
        {
            order_id: order_id,
        },
        order_table
    );
    const mid_details = await merchantOrderModel.selectOne(
        "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime,statementDescriptor",
        {
            terminal_id: order_details.terminal_id,
        },
        "mid"
    );
    if (!mid_details) {
        res
            .status(statusCode.badRequest)
            .send(Server_response.errormsg("No Terminal Available"));
    }

    const autoCaptureHours = parseInt(mid_details.autoCaptureWithinTime);
    // Get the current date and time using moment.
    const currentDate = moment();
    // Add autoCaptureHours to the current date to get the new date and time.
    const newDateTime = currentDate.add(autoCaptureHours, "hours");
    // Format the newDateTime as "YYYY-MM-DD HH:mm"
    const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

    let voidWithinDatetime = "";

    if (mid_details.allowVoid == 1) {
        const voidWithinTimeHours = parseInt(mid_details?.voidWithinTime);
        const newVoidDateTime = currentDate.add(voidWithinTimeHours, "hours");
        // Format the newDateTime as "YYYY-MM-DD HH:mm"
        voidWithinDatetime = newVoidDateTime.format("YYYY-MM-DD HH:mm");
    }

    const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
            id: mid_details.psp_id,
        },
        "psp"
    );
    console.log(`psp details is here`);
    console.log(_pspid);
    if (!_pspid) {
        res
            .status(statusCode.badRequest)
            .send(Server_response.errormsg("No Psp Available"));
    }

    let myf_execuate_payment_req = {
        "PaymentMethodId": mode == 'test' ? "2" : "6",
        "CustomerName": order_details.customer_name,
        "DisplayCurrencyIso": order_details.currency,
        "MobileCountryCode": order_details.customer_code,
        "CustomerMobile": order_details.customer_mobile,
        "CustomerEmail": order_details.customer_email,
        "InvoiceValue": order_details.amount,
        "CallBackUrl": process.env.PAYMENT_URL + "/result/myf/" + order_id + '/' + mode,
        "ErrorUrl": process.env.PAYMENT_URL + "/result/myf/" + order_id + '/' + mode,
        "Language": "en",
        "CustomerReference": uuidv4(),
        "CustomerCivilId": "",
        "UserDefinedField": mid_details.statementDescriptor,
        "ExpireDate": "",
        "CustomerAddress": {
            "Block": "",
            "Street": "",
            "HouseBuildingNo": "",
            "Address": "",
            "AddressInstructions": ""
        },
        "InvoiceItems": [
            //   {
            //     "ItemName": "Product 01",
            //     "Quantity": 1,
            //     "UnitPrice": 2
            //   }
        ]
    };
    const config1 = {
        method: 'post',
        url: mode == "test" ? credentials.myf.test_url + `ExecutePayment` : credentials.myf.base_url + `ExecutePayment`,
        headers: {
            'Authorization': 'Bearer ' + mid_details.password,
            'Content-Type': 'application/json'
        },
        data: myf_execuate_payment_req
    };
    try {
        const response = await axios(config1);
        console.log(`response`);
        console.log(response);
        let direct_pay_url = response.data.Data.PaymentURL;
        let card_no = req.body.card;
        let expiry_date = req.body.expiry_date.split("/").reverse().join("-");
        let cvv = req.body.cvv;
        let card_holder_name = req.body.form_name;
        if (req.bodyString("card_id")) {
            card_no = await enc_dec.dynamic_decryption(
                card_details.card_number,
                card_details.cipher_id
            );
            expiry_date = card_details.card_expiry
                .split("/")
                .reverse()
                .join("-");
            card_holder_name = card_details.name_on_card;
        }
        const [year, month] = expiry_date.split('-');
        let direct_pay_req = {
            "PaymentType": "Card",
            "SaveToken": false,
            "Card": {
                "Number": card_no,
                "ExpiryMonth": month,
                "ExpiryYear": year.slice(-2),
                "SecurityCode": cvv,
                "CardHolderName": card_holder_name
            },
            "Bypass3DS": false
        }
        const direct_pay_config = {
            method: 'post',
            url: direct_pay_url,
            headers: {
                'Authorization': 'Bearer ' + mid_details.password,
                'Content-Type': 'application/json'
            },
            data: direct_pay_req
        };
        const direct_pay_response = await axios(direct_pay_config);
        console.log(direct_pay_response.data);
        let three_ds_url = direct_pay_response.data.Data.PaymentURL;
        payment_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
        const pay_request_id = await helpers.make_sequential_no(mode == 'test' ? "TST_REQ" : "REQ");
        await merchantOrderModel.updateDynamic({ payment_id: payment_id, psp: _pspid.name, }, { order_id: order_id }, order_table);
        const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
        const insert_to_txn_table = await insertFunction({
            order_id: order_id,
            txn: payment_id.toString(),
            type: order_details.action.toUpperCase(),
            status: 'AWAIT_3DS',
            amount: order_details.amount,
            currency: order_details.currency,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            payment_id: payment_id.toString()
        });
        return res.json({
            data: {
                "three_ds_url": three_ds_url,// from config file
                "order_id": order_id, // paydart order id
                "transaction_id": payment_id.toString(),
                "token":browser_token_enc
            },
            status: "success"
        })

    } catch (error) {
        console.log(error);
        let error_with_mid = false;
        if(error?.response?.status=='401'){
            error_with_mid=true;
        }
        console.log(`error with mid ${error.status} ${error_with_mid}`);
        console.log(error_with_mid);
        let response_category = await helpers.get_error_category(
            '01',
            "myf",
            'FAILED'
        );

        // console.log(`inside the catch block`);
        // console.log(error);
        // console.log(`error is here`);
        await merchantOrderModel.updateDynamic({ status: "FAILED",'3ds':"0","3ds_status":"NA" }, { order_id: order_id }, order_table);
        const insertFunction = mode === 'live' ? order_transactionModel.add : order_transactionModel.test_txn_add;
        let transaction_id = await helpers.make_sequential_no(mode == 'test' ? "TST_TXN" : "TXN");
        const order_txn_update = {
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            order_id: order_details?.order_id || "",
            currency: order_details?.currency || "",
            amount: order_details?.amount || "",
            type: order_details?.action.toUpperCase(),
            status: "FAILED",
            psp_code: "",
            paydart_category: "Transaction FAILED",
            remark: "Transaction Failed",
            capture_no: "",
            created_at: moment().format('YYYY-MM-DD HH:mm:ss') || "",
            payment_id: "",
            order_reference_id: "",
        };
        await insertFunction(order_txn_update);
        let paydart_req_id = await helpers.make_sequential_no(mode == 'test' ? 'TST_REQ' : 'REQ');
        let order_req = {
            merchant_id: order_details.merchant_id,
            order_id: order_id,
            request_id: paydart_req_id,
            request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, generate_request_id_table);
        console.log(`order_details`)
        console.log(order_details);
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
                m_order_id: order_details?.merchant_order_id || "",
                p_order_id: order_details?.order_id || "",
                p_request_id: paydart_req_id,
                psp_ref_id: "",
                psp_txn_id: "",
                transaction_id: transaction_id.toString(),
                status_code: response_category?.response_code,//final_response.data.response.acquirerCode,
                remark: error_with_mid?'Access Denied':response_category?.response_details,//final_response.data.response.acquirerMessage,
                paydart_category: response_category?.category,//final_response.data.result === 'SUCCESS' ? '' : 'FAILED',
                currency: order_details?.currency,
                return_url: order_details.failure_url,//process.env.PAYMENT_URL + 'status',//order_data?.[0]?.failure_url,
                transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
                amount:order_details?.amount.toFixed(2) || "",
                m_customer_id: order_details?.[0]?.m_customer_id || "",
                psp: order_details?.psp || "",
                payment_method: order_details?.payment_mode || "",
                m_payment_token: order_details?.m_payment_token || "",
                payment_method_data: {
                    scheme: order_details?.scheme || "",
                    card_country: order_details?.card_country || "",
                    card_type: req.card_details.card_type|| "",
                    mask_card_number: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
            full_card_no.length - 4
        )}`,
                },
                apm_name: "",
                apm_identifier: "",
                sub_merchant_identifier: order_details?.merchant_id
                    ? await helpers.formatNumber(order_details?.merchant_id)
                    : "",
            }
        };
        let txnFailedLog = {
            order_id: order_details?.order_id,
            terminal: order_details?.terminal_id,
            req: JSON.stringify(req.body),
            res: '',
            psp: _pspid.name,
            status_code: "01",
            description: "",
            activity: "Transaction success with MYF",
            status: 0,
            mode: mode,
            card_holder_name:  '',
            card: '',
            expiry:'',
            cipher_id: '',
            txn: transaction_id.toString() ? transaction_id.toString() : "",
            card_proxy: '',
            "3ds_version": "0",
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        await helpers.addTransactionFailedLogs(txnFailedLog);
        let web_hook_res = Object.assign({}, res_obj.new_res);
        delete web_hook_res?.return_url;
        delete web_hook_res?.paydart_category;
        let hook_info = await helpers.get_data_list("*", "webhook_settings", {
            merchant_id: order_details.merchant_id,
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
        return res.status(statusCode.ok).send(Server_response.errorMsgWithData(res_obj.message, res_obj, "FAILED")
        );
    }

}


module.exports = directpay; 
