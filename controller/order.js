const TransactionsModel = require("../models/transactions.js");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const TempModel = require("../models/temp");
const merchantOrderModel = require("../models/merchantOrder");
const moment = require("moment");
const winston = require('../utilities/logmanager/winston');

var res_data = {
    add: async (req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let amount = req.bodyString("amount");
        let currency = req.bodyString("currency");
        let payment_method = req.bodyString("payment_method");
        let artha_order_no = await helpers.make_order_number("ORD");
        let ip = await helpers.get_ip(req);
        let ins_body = {
            merchant_id: req.user.id,
            super_merchant: req.user.super_merchant,
            partner_id: req.user.partner_id,
            artha_order_no: artha_order_no,
            payment_method: payment_method,
            amount: amount,
            order_status: "Created",
            order_currency: currency,
            transaction_date: added_date,
            ip: ip,
        };

        if (req.bodyString("description")) {
            ins_body.description = req.bodyString("description");
        }
        if (req.bodyString("customer_name")) {
            ins_body.customer_name = req.bodyString("customer_name");
        }
        if (req.bodyString("customer_mobile")) {
            ins_body.customer_mobile = req.bodyString("customer_mobile");
        }
        if (req.bodyString("customer_email")) {
            ins_body.customer_email = req.bodyString("customer_email");
        }

        let data = {
            artha_order_no: artha_order_no,
            amount: amount,
        };

        TransactionsModel.add(ins_body)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successdatamsg(data, "Order Created successfully.")
                );
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
    list: async (req,res) => {
         try {
    const params = extractParams(req); // ✅ One place to get all params
    const table_name = chooseTableName(req.user, params.mode);
    const filters = await buildFilters(req.user, params); // ✅ Build all filter objects

    // ✅ Single query returning both data & total_count using COUNT(*) OVER()
    const result = await TransactionsModel.select_trans_with_count(
      filters.and_filter_obj,
      filters.date_condition,
      filters.limit,
      table_name,
      filters.in_condition,
      filters.amount_condition,
      filters.like_condition,
      filters.trans_date,
      filters.search_terms,
      filters.subscription_order
    );

    // ✅ Transform DB rows into final response in parallel
    const send_res = await Promise.all(
      result.rows.map(row => transformTransaction(row, params, table_name))
    );

    res.status(statusCode.ok).send(
      response.successdatamsg(
        send_res,
        "List fetched successfully.",
        result.total_count // comes from the same query
      )
    );

  } catch (error) {
    winston.error(error);
    res.status(statusCode.internalError).send(
      response.errormsg(error.message)
    );
  }

    },
    export_list: async (req,res) => {
         try {
    const params = extractParams(req); // ✅ One place to get all params
    const table_name = chooseTableName(req.user, params.mode);
    const filters = await buildFilters(req.user, params); // ✅ Build all filter objects

    // ✅ Single query returning both data & total_count using COUNT(*) OVER()
    const result = await TransactionsModel.export_transactions(
      filters.and_filter_obj,
      filters.date_condition,
      filters.limit,
      table_name,
      filters.in_condition,
      filters.amount_condition,
      filters.like_condition,
      filters.trans_date,
      filters.search_terms,
      filters.subscription_order
    );

    // ✅ Transform DB rows into final response in parallel
    const send_res = await Promise.all(
      result.rows.map(row => transformTransaction(row, params, table_name))
    );

    res.status(statusCode.ok).send(
      response.successdatamsg(
        send_res,
        "List fetched successfully.",
        result.total_count // comes from the same query
      )
    );

  } catch (error) {
    winston.error(error);
    res.status(statusCode.internalError).send(
      response.errormsg(error.message)
    );
  }

    },
    charges_list: async (req,res) => {
         try {
    const params = extractParams(req); // ✅ One place to get all params
    const table_name = chooseTableName(req.user, params.mode);
    const filters = await buildFilters(req.user, params); // ✅ Build all filter objects

    // ✅ Single query returning both data & total_count using COUNT(*) OVER()
    const result = await TransactionsModel.select_trans_with_count(
      filters.and_filter_obj,
      filters.date_condition,
      filters.limit,
      table_name,
      filters.in_condition,
      filters.amount_condition,
      filters.like_condition,
      filters.trans_date,
      filters.search_terms,
      filters.subscription_order
    );

    // ✅ Transform DB rows into final response in parallel
    const send_res = await Promise.all(
      result.rows.map(row => transformTransaction(row, params, table_name))
    );

    res.status(statusCode.ok).send(
      response.successdatamsg(
        send_res,
        "List fetched successfully.",
        result.total_count // comes from the same query
      )
    );

  } catch (error) {
    winston.error(error);
    res.status(statusCode.internalError).send(
      response.errormsg(error.message)
    );
  }

    },
    /*  list: async (req, res) => {
        let mode = req.bodyString("mode");
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
        let search_terms = {};

        if (req.user.type == "merchant") {
            if (req.user.super_merchant_id != "") {
                and_filter_obj.super_merchant = req.user.super_merchant_id;
            } else {
                and_filter_obj.super_merchant = req.user.id;
            }
            if (req.bodyString("selected_merchant") != 0) {
                and_filter_obj.merchant_id = encrypt_decrypt(
                    "decrypt",
                    req.bodyString("selected_merchant")
                );
            }

            if (req.bodyString("m_id")) {
                var merchant_id = req.bodyString("m_id");

                and_filter_obj.merchant_id = merchant_id.merchant_id;
            }
        }
        let table_name = "";
        let subscription_order = "";
        if (req.user.super_merchant_id != "" && req.user.type == "merchant") {
            if (req.bodyString("mode") == "live") {
                table_name = "orders";
            } else {
                table_name = "test_orders";
            }
        } else {
            if (req.bodyString("mode") === "test") {
                table_name = "test_orders";
            } else {
                table_name = "orders";
            }
        }

        console.log("req.user.super_merchant_id", req.user.super_merchant_id)
        console.log("req.user.type", req.user.type)
        console.log("req.user.mode", req.user.mode)
        console.log(table_name);

        if (req.bodyString("merchant")) {
            and_filter_obj.merchant_id = encrypt_decrypt(
                "decrypt",
                req.bodyString("merchant")
            );
        }
        if (req.bodyString("super_merchant")) {
            and_filter_obj.super_merchant = encrypt_decrypt(
                "decrypt",
                req.bodyString("super_merchant")
            );
        }
        if (req.bodyString("status")) {
            and_filter_obj.status = req.bodyString("status");
        }
        if (req.bodyString("subs_id")) {
            subscription_order = 'yes';
        } else {
            subscription_order = 'no';
        }
        if (req.bodyString("currency")) {
            and_filter_obj.currency = req.bodyString("currency");
        }

        if (req.bodyString("fraud_request_type")) {
            and_filter_obj.fraud_request_type = req.bodyString("fraud_request_type");
        }
        let in_condition = "";

        if (req.bodyString("paymentlink_id")) {
            let order_id = await helpers.get_data_list(
                "order_no",
                "qr_payment",
                { payment_id: req.bodyString("paymentlink_id") }
            );

            const ords =
                "(" +
                order_id.map((item) => `'${item.order_no}'`).join(", ") +
                ")";
            if (ords != "()") {
                in_condition = ` order_id IN ${ords} `;
            }
        }

        if (req.bodyString("order_no")) {
            // and_filter_obj.order_id = req.bodyString("order_no");
            let str = req.bodyString("order_no");
            if (str.indexOf(",") !== -1) {
                var segments = str.split(",");
                const str2 =
                    "(" + segments.map((item) => `'${item}'`).join(", ") + ")";
                if (str2 != "()") {
                    in_condition = ` order_id IN ${str2} `;
                }
            } else {
                and_filter_obj.order_id = req.bodyString("order_no");
            }
        }

        if (req.bodyString("customer_id")) {
            let order_ids = await helpers.get_order_ids(
                parseInt(req.bodyString("customer_id"), 10)
            );

            let commaSeparatedString = "";
            if (order_ids.length > 0) {
                let order_ids_string = order_ids
                    .map((row) => row.order_id)
                    .filter((order_id) => order_id !== "" && order_id !== null);
                commaSeparatedString = order_ids_string.join(",");

            }
            if (commaSeparatedString.indexOf(",") !== -1) {
                var segments = commaSeparatedString.split(",");

                const str2 =
                    "(" + segments.map((item) => `'${item}'`).join(", ") + ")";

                if (str2 != "()") {
                    in_condition = ` order_id IN ${str2} `;
                }
            }
        }

        if (req.bodyString("transaction_date")) {
            trans_date.updated_at = req.bodyString("transaction_date");
        }
        if (req.bodyString("payment_method")) {
            // and_filter_obj.payment_mode = req.bodyString("payment_method");
            var payment_mode = await helpers.get_payment_mode_by_id(
                await enc_dec.cjs_decrypt(req.bodyString("payment_method"))
            );
            and_filter_obj.payment_mode = payment_mode;
            if (payment_mode == "Apple Pay") {
                var new_str = payment_mode.split(' ').join('_');
                and_filter_obj.payment_mode = new_str;
            }

        }
        if (req.bodyString("m_payment_token")) {
            and_filter_obj.card_id = req.bodyString("m_payment_token");
        }
        if (req.bodyString("card_bin")) {
            like_condition.pan = req.bodyString("card_bin");
        }
        if (
            req.bodyString("min_amount") &&
            parseFloat(req.bodyString("min_amount")) > 0
        ) {
            amount_condition.min_amount = req.bodyString("min_amount");
        }
        if (
            req.bodyString("max_amount") &&
            parseFloat(req.bodyString("min_amount")) > 0
        ) {
            amount_condition.max_amount = req.bodyString("max_amount");
        }
        if (req.bodyString("processor")) {
            and_filter_obj.psp = req.bodyString("processor");
        }
        if (req.bodyString("mid")) {
            and_filter_obj.terminal_id = req.bodyString("mid");
        }
        if (req.bodyString("m_customer_id")) {
            const trimmedCustomerId = parseInt(
                req.bodyString("m_customer_id"),
                10
            ).toString();
            and_filter_obj.merchant_customer_id = trimmedCustomerId;
        }
        if (req.bodyString("declined_reason")) {

            and_filter_obj.remark = req.bodyString("declined_reason");
        }
        // if (req.bodyString("m_customer_id")) {
        //     and_filter_obj.merchant_customer_id = await enc_dec.cjs_decrypt(
        //         req.bodyString("m_customer_id")
        //     );
        // }
        if (req.bodyString("customer_country")) {
            // and_filter_obj.billing_country = req.bodyString("customer_country");
            and_filter_obj.billing_country =
                await helpers.get_country_iso2_by_id(
                    await enc_dec.cjs_decrypt(
                        req.bodyString("customer_country")
                    )
                );
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
        // if (req.bodyString("customer_name")) {
        //     and_filter_obj.customer_name = req.bodyString("customer_name");
        // }
        // if (req.bodyString("email")) {
        //     and_filter_obj.customer_email = req.bodyString("email");
        // }
        // if (req.bodyString("mobile")) {
        //     and_filter_obj.customer_mobile = req.bodyString("mobile");
        // }
        if (req.bodyString("search")) {
            search_terms.customer_email = req.bodyString("search");
            search_terms.customer_mobile = req.bodyString("search");
            search_terms.customer_name = req.bodyString("search");
            search_terms.payment_id = req.bodyString("search");
        }
        if (req.bodyString("channel")) {
            and_filter_obj.origin = req.bodyString("channel");
        }
        if (req.bodyString("from_date")) {
            date_condition.from_date = req.bodyString("from_date");
        }
        if (req.bodyString("to_date")) {
            date_condition.to_date = req.bodyString("to_date");
        }
        if (req.bodyString("fraud_rule")) {
            let fraud_rule = req.bodyString("fraud_rule");
            if (fraud_rule == "suspicious_ip") {
                and_filter_obj.block_for_suspicious_ip = "1";
            } else if (fraud_rule == "suspicious_email") {
                and_filter_obj.block_for_suspicious_ip = "1";
            } else if (fraud_rule == "high_risk_country") {
                and_filter_obj.high_risk_country = "1";
            } else if (fraud_rule == "high_risk_transaction") {
                and_filter_obj.block_for_transaction_limit = "1";
            } else {
                and_filter_obj.high_risk_transaction = "1";
            }
        }
        console.log(table_name);
        TransactionsModel.select_trans(
            and_filter_obj,
            date_condition,
            limit,
            table_name,
            in_condition,
            amount_condition,
            like_condition,
            trans_date,
            search_terms,
            subscription_order
        )
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    failed_remark = ""
                    if (val.status == 'FAILED') {
                        let txn_details = await TransactionsModel.selectOne('remark', { order_id: val.order_id, type: ['AUTH', 'CAPTURE'], status: 'FAILED' }, mode == 'test' ? 'test_order_txn' : 'order_txn');
                        failed_remark = txn_details?.remark;
                    }


                    let today = moment().format("YYYY-MM-DD");
                    let order_date = moment(val.created_at).format(
                        "YYYY-MM-DD"
                    );

                    let _getmid = await merchantOrderModel.selectOne(
                        "*",
                        {
                            terminal_id: val?.terminal_id,
                        },
                        "mid"
                    );


                    let trans_data = await helpers.get_trans_data(
                        val?.order_id,
                        mode
                    );

                    let country_iso = val?.billing_country ? val?.billing_country : "";
                    let country = '';
                    if (country_iso !== "") {
                        country = await helpers.get_customer_country(country_iso, 'country')
                        // country = await helpers.get_country_name_by_iso(country_iso);
                    }
                    if (req.bodyString("channel") == "QR" || req.bodyString("channel") == "PAYMENT LINK") {
                        var data_link = await helpers.getLinkID(val.order_id);
                        var show_ID = data_link.merchant_qr_id ? await helpers.formatNumber(data_link.merchant_qr_id) : ''
                        var show_link = data_link.payment_id ? data_link.payment_id : ''
                    } else if (req.bodyString("channel") == "INVOICE") {
                        var data_link = await helpers.getInvoiceID(val.order_id);
                        var show_ID = data_link.invoice_no ? data_link.invoice_no : ''
                        var show_link = data_link.id ? await enc_dec.cjs_encrypt(data_link.id) : ''
                    } else if (req.bodyString("channel") == "SUBSCRIPTION") {
                        var data_link = await helpers.getSubsID(val.order_id);
                        var show_ID = data_link.subscription_id ? data_link.subscription_id : ''
                        var show_link = data_link.plan_id ? await helpers.get_subs_plan_id(data_link.plan_id) : ''
                    }

                    let is_retry = await TransactionsModel.get_transactions_retry(val?.order_id, req.bodyString("mode"));
                    let is_cascade = await TransactionsModel.get_transactions_cascade(val?.order_id, req.bodyString("mode"));

                    let new_res = {
                        data_id_plain: await helpers.formatNumber(val?.id),
                        data_id: enc_dec.cjs_encrypt(val?.id),
                        m_order_id: val?.merchant_order_id
                            ? val?.merchant_order_id
                            : "",
                        p_order_id: val?.order_id ? val?.order_id : "",
                        p_request_id: trans_data[0]?.last_request_id
                            ? trans_data[0]?.last_request_id
                            : "",
                        psp_ref_id: trans_data[0]?.last_psp_txn_id
                            ? trans_data[0]?.last_psp_txn_id
                            : "",
                        transaction_id: val?.payment_id ? val?.payment_id : "",
                        psp_txn_id: trans_data[0]?.last_psp_ref_id
                            ? trans_data[0]?.last_psp_ref_id
                            : "",
                        transaction_date:
                            val && val.updated_at
                                ? moment(val.updated_at).format(
                                    "DD-MM-YYYY HH:mm:ss"
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
                        payment_method_id: val?.pan ? val?.pan : "",
                        is_oneclick: val?.is_one_click == 1 ? 1 : 0,
                        is_retry: is_retry > 0 ? 1 : 0,
                        is_cascade: is_cascade > 1 ? 1 : 0,
                        m_customer_id: val?.merchant_customer_id,
                        m_customer_id_plain: val?.merchant_customer_id
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
                        customer_country_name: country,
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
                            ? enc_dec.cjs_encrypt(val?.merchant_id ? val?.merchant_id : '')
                            : "",
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
                        //  remark:failed_remark?failed_remark:'-'
                        remark: val.other_description != "" ? val.other_description : "-"
                    };

                    let res = {
                        transactions_id: await enc_dec.cjs_encrypt(val.id),
                        merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
                        order_id: val.order_id,
                        payment_id: val.payment_id,
                        merchant_name:
                            await helpers.get_merchantdetails_name_by_id(
                                val.merchant_id
                            ),
                        order_amount: val.amount.toFixed(2),
                        allowVoid: _getmid?.allowVoid == 0 ? 0 : 1,
                        allowRefunds: _getmid?.allowRefunds == 0 ? 0 : 1,
                        order_currency: val.currency,
                        customer_name: val.customer_name,
                        customer_email: val.customer_email,
                        customer_mobile: val.customer_mobile,
                        channel: val.origin,
                        status: val.status,
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
                        fraud_request_type: val.fraud_request_type ? val.fraud_request_type : "",
                        show_id: show_ID ? show_ID : '',
                        show_link: show_link ? show_link : '',
                        new_res,
                    };
                    send_res.push(res);
                }
                total_count = await TransactionsModel.get_count(
                    and_filter_obj,
                    date_condition,
                    table_name,
                    in_condition,
                    amount_condition,
                    like_condition,
                    trans_date,
                    search_terms
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
    }, */

    open_list: async (req, res) => {

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

        // if (req.user.type == "merchant") {
        //     and_filter_obj.super_merchant = req.user.id;
        //     if (req.bodyString("selected_merchant") != 0) {
        //         and_filter_obj.merchant_id = encrypt_decrypt(
        //             "decrypt",
        //             req.bodyString("selected_merchant")
        //         );
        //     }
        // }

        let table_name = "";
        if (req.bodyString("mode") == "test") {
            table_name = "test_orders";
        } else {
            table_name = "orders";
        }

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

    details: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString("id"));
        let table = "orders";
        let dump_table = "txn_response_dump";
        let txn_table = "order_txn";
        if (req.bodyString("mode") === "test") {
            table = "test_orders";
            dump_table = "test_txn_response_dump";
            txn_table = "test_order_txn";
        }

        TransactionsModel.selectOne("*", { id: id }, table)
            .then(async (result) => {
                let txn_order_dump = "";
                let failed_remark = '';

                // console.log("txn_table", txn_table);
                if (result.status == 'FAILED') {
                    let txn_details = await TransactionsModel.selectOne('remark', { order_id: result.order_id, type: ['AUTH', 'SALE'], status: 'FAILED' }, txn_table);
                    failed_remark = txn_details?.remark;
                }

                let order_txn = await TransactionsModel.selectSpecificDynamic(
                    "order_id, txn, type,payment_id, status, res_dump, amount, currency, created_at,is_voided,remark,psp_code,txn_ref_id,is_voided,paydart_category",
                    { order_id: result.order_id },
                    txn_table
                );
                let terminal_details = await TransactionsModel.selectOne('allowVoid,allowRefunds', { terminal_id: result.terminal_id }, 'mid');
                let send_res = [];
                let update_order_txn = [];

                let val = result;

                let trans_history = [];

                // let amount_capture = 0;
                let amount_refunded = 0;
                let total_amount_capture_by_txn = 0;
                const psp_code = '';
                // console.log(`PSP NAME`);
                // Switch For Transaction History Status and Button
                let can_be_capture = false;
                let can_be_void = false;
                let can_be_refund = false;
                let capture_amount = 0;
               

                switch (val.psp) {

                    case 'TELR':
                        capture_amount = 0;
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));

                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? Number(val?.amount - capture_amount).toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void: false,
                                can_be_refund: false,
                                is_voided: val.is_voided,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                                mid: mid_details?.label,
                                psp: mid_details?.psp,
                                terminal: mid_details?.terminal_id,
                            };

                            //console.log(temp);
                            // temp.can_be_refund = false;
                            // temp.can_be_void = false;

                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'PARTIALLY_CAPTURE' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                capture_amount = capture_amount + val.amount
                            }
                            if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE' || val.type == 'SALE') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));


                                temp.can_be_void = true;
                                temp.can_be_refund = amount_refunded == val.amount ? false : true;
                            }
                            if ((val.type == 'REFUND' || val.type == 'PARTIALLY_REFUND') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'VOID' && val.status == 'AUTHORISED') {
                                let voided_txn_type = await TransactionsModel.selectSpecificDynamic(
                                    "type",
                                    { txn: val.txn_ref_id },
                                    txn_table
                                );
                                let msg = '';
                                // console.log(voided_txn_type[0]);
                                // console.log(`${voided_txn_type[0].type} voided txn type`)
                                switch (voided_txn_type[0]?.type) {
                                    case 'AUTH':
                                        msg = 'Auth Reversal';
                                        break;
                                    case 'CAPTURE':
                                    case 'PARTIALLY_CAPTURE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'REFUND':
                                    case 'PARTIALLY_REFUND':
                                        msg = 'Refund Reversal';
                                        break;
                                }
                                temp.remark = msg;
                            }
                            /*   if (val.status != 'AUTHORISED') {
                                   temp.can_be_refund = false;
                                   temp.can_be_void = false;
           
                               }
                               if (result.psp == 'TELR' || result.psp == 'NI' || result.psp == 'PAYTABS') {
                                   if (val.status == 'AUTHORISED') {
                                       if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE') && val.status == 'AUTHORISED') {
                                           temp.can_be_refund = true;
                                           temp.can_be_void = true;
                                       }
                                       if ((val.type == 'REFUND' || val.type == 'PARTIAL_REFUND') && val.status == 'AUTHORISED') {
                                           temp.can_be_refund = false;
                                           temp.can_be_void = true;
                                       }
                                       if (val.type == 'AUTH' && val.status == 'AUTHORISED') {
                                           temp.can_be_refund = false;
                                           temp.can_be_void = true;
                                       }
                                       if (val.is_voided == 1) {
                                           temp.can_be_void = false;
                                           temp.can_be_refund = false;
                                       }
                                   }
                               }
                               if(result.psp == 'NI'){
                                   
                                   let today = moment().format('DD-MM-YYYY');
                                  if(check_created_at==today && val.is_voided==0 && val.type!='VOID' && val.status=='AUTHORISED'){
                                   temp.can_be_void=true;
                                   temp.can_be_refund = false;
                                  }else{
                                   temp.can_be_void=false;
                                  }
                               }
                               if (
                                   (val.type == "CAPTURE" ||
                                       val.type == "PARTIALLY_CAPTURE") && val.is_voided == 0
                               ) {
                                   amount_capture =
                                       parseFloat(amount_capture) +
                                       parseFloat(temp.amount);
                               }
           
                               if (temp.txn == req.bodyString('txn_id')) {
                                   total_amount_capture_by_txn = temp.amount;
                               }
                               let amount_refunded_by_current_txn = await helpers.get_refunded_amount_by_txn(val.txn);
                               if (parseInt(temp.amount) - parseInt(amount_refunded_by_current_txn) == 0) {
                                   temp.can_be_refund = false;
                               }
                               if (val.type == 'AUTH' && result.status != 'AUTHORISED') {
                                   temp.can_be_void = false;
                               } */
                            //console.log(temp);
                            trans_history.push(temp);
                        }

                        break;
                    case 'NI':
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));
                            //console.log("mid_details1", mid_details);
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void: false,
                                can_be_refund: false,
                                is_voided: val?.is_voided,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                                psp: mid_details?.psp,
                                terminal: mid_details?.terminal_id,
                                mid: mid_details?.label,
                            };
                            // temp.can_be_refund = false;
                            // temp.can_be_void = false;

                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_capture = false;
                            }
                            if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE' || val.type == 'SALE') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));


                                temp.can_be_void = true;
                                temp.can_be_refund = amount_refunded == val.amount ? false : true;
                            }

                            // console.log((val.type=='REFUND' || val.type=='PARTIALLY_REFUND') && val.status=='AUTHORISED' && val.is_voided==0);
                            if ((val.type == 'REFUND' || val.type == 'PARTIALLY_REFUND') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'VOID' && val.status == 'AUTHORISED') {
                                let voided_txn_type = await TransactionsModel.selectSpecificDynamic(
                                    "type",
                                    { txn: val.txn_ref_id },
                                    txn_table
                                );
                                let msg = '';
                                // console.log(voided_txn_type[0]);
                                // console.log(`${voided_txn_type[0].type} voided txn type`)
                                switch (voided_txn_type[0]?.type) {
                                    case 'AUTH':
                                    case 'SALE':
                                        msg = 'Auth Reversal';
                                        break;
                                    case 'CAPTURE':
                                    case 'PARTIALLY_CAPTURE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'REFUND':
                                    case 'PARTIALLY_REFUND':
                                        msg = 'Refund Reversal';
                                        break;
                                }
                                temp.remark = msg;

                            }
                            let today = moment().format('DD-MM-YYYY');
                            if (check_created_at == today && val.is_voided == 0 && val.type != 'VOID' && val.status == 'AUTHORISED') {
                                temp.can_be_void = true;
                                temp.can_be_refund = false;
                            } else {
                                temp.can_be_void = false;
                            }
                            trans_history.push(temp);
                        }
                        break;
                    case 'PAYTABS':
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void: false,
                                can_be_refund: false,
                                is_voided: val?.is_voided,
                                psp: mid_details?.psp,
                                terminal: mid_details?.terminal_id,
                                mid: mid_details?.label,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                            };
                            // temp.can_be_refund = false;
                            // temp.can_be_void = false;

                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 1) {
                                temp.can_be_capture = false;
                            }
                            if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));

                                temp.can_be_void = false;
                                temp.can_be_refund = amount_refunded == val.amount ? false : true;
                            }
                            if ((val.type == 'SALE') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));

                                temp.can_be_void = false;
                                temp.can_be_refund = amount_refunded == val.amount ? false : true;
                            }
                            // console.log((val.type=='REFUND' || val.type=='PARTIALLY_REFUND') && val.status=='AUTHORISED' && val.is_voided==0);
                            if ((val.type == 'REFUND' || val.type == 'PARTIALLY_REFUND') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = false;
                            }
                            if (val.type == 'VOID' && val.status == 'AUTHORISED') {
                                let voided_txn_type = await TransactionsModel.selectSpecificDynamic(
                                    "type",
                                    { txn: val.txn_ref_id },
                                    txn_table
                                );
                                let msg = '';
                                // console.log(voided_txn_type[0]);
                                // console.log(`${voided_txn_type[0].type} voided txn type`)
                                switch (voided_txn_type[0]?.type) {
                                    case 'AUTH':
                                        msg = 'Auth Reversal';
                                        break;
                                    case 'CAPTURE':
                                    case 'PARTIALLY_CAPTURE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'REFUND':
                                    case 'PARTIALLY_REFUND':
                                        msg = 'Refund Reversal';
                                        break;
                                }
                                temp.remark = msg;

                            }
                            trans_history.push(temp);
                        }
                        break;
                    case "MPGS-ADIB":
                    case "MPGS-MEPSPAY":
                    case "MPGS-PAYSHIFT":
                    case "MPGS-GTI":            
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));
                            console.log(`mid details`)
                            console.log(mid_details);
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void: false,
                                can_be_refund: false,
                                is_voided: val?.is_voided,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                                psp: mid_details?.psp,
                                terminal: mid_details?.terminal_id,
                                mid: mid_details?.label,
                            };

                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_capture = false;
                            }
                            if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE' || val.type == "SALE") && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));
                                console.log(amount_refunded, typeof amount_refunded);
                                console.log(amount_refunded == val.amount);
                                temp.can_be_void = true;
                                if (amount_refunded) {
                                    temp.can_be_refund = amount_refunded == val.amount ? false : true;
                                } else {
                                    temp.can_be_refund = true;
                                }

                            }
                            if ( val.type == "SALE" && val.status == 'AUTHORISED' && val.is_voided == 1) {
                                amount_capture = val.amount;

                            }

                            if ((val.type == 'REFUND' || val.type == 'PARTIALLY_REFUND') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'VOID' && val.status == 'AUTHORISED') {
                                let voided_txn_type = await TransactionsModel.selectSpecificDynamic(
                                    "type",
                                    { txn: val.txn_ref_id },
                                    txn_table
                                );
                                let msg = '';
                                switch (voided_txn_type[0]?.type) {
                                    case 'AUTH':
                                    case 'SALE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'CAPTURE':
                                    case 'PARTIALLY_CAPTURE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'REFUND':
                                    case 'PARTIALLY_REFUND':
                                        msg = 'Refund Reversal';
                                        break;
                                }
                                temp.remark = msg;

                            }
                            let today = moment().format('DD-MM-YYYY');
                            if (check_created_at == today && val.is_voided == 0 && val.type != 'VOID' && val.status == 'AUTHORISED') {
                                temp.can_be_void = true;
                                //  temp.can_be_refund = false;
                            } else {
                                temp.can_be_void = false;
                            }
                            trans_history.push(temp);
                        }
                        break;
                    case "My Fatoorah":
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void: false,
                                can_be_refund: false,
                                is_voided: val?.is_voided,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                                psp: mid_details?.psp,
                                terminal: mid_details?.terminal_id,
                                mid: mid_details?.label,
                            };
                            console.log(`temp is here`);
                            console.log(temp);

                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'AUTH' && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_capture = false;
                            }
                            if ((val.type == 'CAPTURE' || val.type == 'PARTIALLY_CAPTURE' || val.type == "SALE") && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                amount_refunded = await helpers.get_refunded_amount_by_txn(val.txn, req.bodyString("mode"));
                                console.log(amount_refunded, typeof amount_refunded);
                                console.log(amount_refunded == val.amount);
                                temp.can_be_void = true;
                                if (amount_refunded) {
                                    temp.can_be_refund = amount_refunded == val.amount ? false : true;
                                } else {
                                    temp.can_be_refund = true;
                                }

                            }

                            if ((val.type == 'REFUND' || val.type == 'PARTIALLY_REFUND') && val.status == 'AUTHORISED' && val.is_voided == 0) {
                                temp.can_be_void = true;
                            }
                            if (val.type == 'VOID' && val.status == 'AUTHORISED') {
                                let voided_txn_type = await TransactionsModel.selectSpecificDynamic(
                                    "type",
                                    { txn: val.txn_ref_id },
                                    txn_table
                                );
                                let msg = '';
                                switch (voided_txn_type[0]?.type) {
                                    case 'AUTH':
                                    case 'SALE':
                                        msg = 'Auth Reversal';
                                        break;
                                    case 'CAPTURE':
                                    case 'PARTIALLY_CAPTURE':
                                        msg = 'Capture Reversal';
                                        break;
                                    case 'REFUND':
                                    case 'PARTIALLY_REFUND':
                                        msg = 'Refund Reversal';
                                        break;
                                }
                                temp.remark = msg;

                            }
                            let today = moment().format('DD-MM-YYYY');
                            if (check_created_at == today && val.is_voided == 0 && val.type != 'VOID' && val.status == 'AUTHORISED') {
                                temp.can_be_void = true;
                                //  temp.can_be_refund = false;
                            } else {
                                temp.can_be_void = false;
                            }
                            trans_history.push(temp);
                        }
                        break;
                    case "fiserv":
                        console.log(`result in fiserv`);
                        console.log(result);
                        for (let val of order_txn) {
                            let mid_details = await helpers.midDetails(result.order_id, val?.txn, req.bodyString("mode"));
                            console.log(`mid details`);
                            console.log(mid_details);
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void:  ((val?.type=="AUTH" || val?.type=="CAPTURE" || val?.type=="REFUND" || val?.type=="SALE") && val.is_voided==0)?true:false,
                                can_be_refund: val?.type=="CAPTURE" && val.is_voided==0?true:false ,
                                is_voided: val?.is_voided,
                                psp: result.psp,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                                terminal: result.terminal_id,
                                mid:mid_details?.label
                            };
                            // temp.can_be_refund = false;
                            // temp.can_be_void = false;
                            trans_history.push(temp);
                        }
                        break;
                    default:
                        for (let val of order_txn) {
                            let check_created_at = moment(val.created_at, 'DD-MM-YYYY').format('DD-MM-YYYY');
                            let mid_details_default = await helpers.midDetailsDefault(result.terminal_id);
                            let temp = {
                                order_id: val?.order_id ? val?.order_id : "",
                                txn: val?.txn ? val?.txn : "",
                                payment_id: val?.payment_id ? val.payment_id : '',
                                type: val?.type ? val?.type : "",
                                status: val?.status ? val?.status : "",
                                currency: val?.currency ? val?.currency : "",
                                amount: val?.amount ? val?.amount.toFixed(2) : "",
                                created_at: val?.created_at ? moment(val?.created_at).format('DD-MM-YYYY hh:mm') : "",
                                remark: val.remark,
                                can_be_capture: false,
                                can_be_void:  ((val?.type=="AUTH" || val?.type=="CAPTURE" || val?.type=="REFUND" || val?.type=="SALE") && val.is_voided==0)?true:false,
                                can_be_refund: val?.type=="CAPTURE" && val.is_voided==0?true:false ,
                                is_voided: val?.is_voided,
                                psp: result?.psp,
                                terminal: result?.terminal_id,
                                mid: mid_details_default?.label,
                                code_psp: val?.psp_code,
                                code_category: val?.paydart_category,
                            };
                            // temp.can_be_refund = false;
                            // temp.can_be_void = false;
                            trans_history.push(temp);
                        }
                    break;

                }
                let retryCascadeMidList = await helpers.getRetryAndCascade(val?.order_id);
                // console.log(`Retry and Cascade details`)
                // console.log(retryCascadeMidList);
                let sumRetryAndCascade = retryCascadeMidList.retry + retryCascadeMidList.cascade;
                let r = retryCascadeMidList.retry;
                let c = retryCascadeMidList.cascade;
                trans_history = trans_history.reverse();
                let i = 0;
                /* for(let transaction of trans_history){
                    if(transaction.status=='FAILED' && (transaction.type=='AUTH' || transaction.type=='SALE')){
                        let failed_logs = await helpers.fetchPSPBYTXN({txn:transaction.txn});
                       
                    }else{
                       
                    }
                  
                    if(i==0){
                        transaction.retry = false;
                        transaction.cascade = false;
                    }else if(r>0 && i>0){
                        transaction.retry = true;
                        transaction.cascade = false;
                        r--;
                    }else if(i>(1+retryCascadeMidList.retry) && c>0){
                        transaction.retry = false;
                        transaction.cascade = true;
                        c--;
                    }
                    i++;
                } */
                for (let transaction of trans_history) {
                    console.log(`txnksdandkasdnkadnakdnka`)
                    console.log(transaction)
                    var txn_mid, txn_psp, txn_terminal = ""
                    // if ((transaction.type == 'AUTH' || transaction.type == 'SALE' || transaction.type=="CAPTURE") && transaction.status == 'AUTHORISED') {
                    //     txn_mid = transaction.mid
                    //     txn_psp = transaction.psp
                    //     txn_terminal = transaction.terminal
                    //     // console.log("txn_mid1", txn_mid);
                    // }

                    // if (transaction.type == 'REFUND' || transaction.type == 'PARTIALLY_REFUND' || transaction.type == 'PARTIALLY_CAPTURE' || transaction.type == 'VOID' || transaction.type == 'CAPTURE' || transaction.type == '') {
                    //     console.log("txn_mid2", txn_mid);
                    //     transaction.mid = txn_mid
                    //     transaction.psp = txn_psp
                    //     transaction.terminal = txn_terminal
                    // }

                    transaction.retry = false;
                    transaction.cascade = false;
                    let retry = await helpers.lastCardUsed({ order_id: val.order_id, txn: transaction.txn, mode: req.bodyString("mode") })
                    // console.log(retry);
                    transaction.retry = retry?.retry_txn == 1 ? true : false
                    transaction.cascade = retry?.cascade_txn == 1 ? true : false
                }
                trans_history = trans_history.reverse();
                console.log(`transaction isdkasdnaksdfk`)
                console.log(trans_history);
                let data_created = {
                    order_id: val?.order_id ? val?.order_id : "",
                    txn: "-",
                    status: "INITIATED",
                    type: "CREATED",
                    payment_id: '-',
                    currency: val?.currency ? val?.currency : "",
                    amount: val?.amount ? val?.amount.toFixed(2) : "",
                    created_at: moment(result.created_at).format(
                        "DD-MM-YYYY hh:mm"
                    ),
                    can_be_refund: false,
                    can_be_void: false
                };
                trans_history.push(data_created);
                // const filteredData = trans_history

                let trans_data = await helpers.get_trans_data(
                    result?.order_id,
                    req.bodyString("mode")
                );

                if (req.bodyString('txn_id')) {
                    let refunded_amount_as_per_txn = await helpers.get_refunded_amount_by_txn(req.bodyString('txn_id'), req.bodyString("mode"));
                    let amount_capture_by_txn = await helpers.get_capture_amount_by_txn(req.bodyString('txn_id'), req.bodyString("mode"));
                    amount_refunded = amount_capture_by_txn - refunded_amount_as_per_txn;
                    console.log(`refunded amount as per txn`);
                    console.log(refunded_amount_as_per_txn);
                }
                amount_capture = await helpers.get_capture_amount_by_order_id(val?.order_id, req.bodyString("mode"));
                let is_retry = await TransactionsModel.get_transactions_retry(val?.order_id, req.bodyString("mode"));
                let is_cascade = await TransactionsModel.get_transactions_cascade(val?.order_id, req.bodyString("mode"));
                let user_card_token_Details = await helpers.fetchLastTryData({ order_id: val?.order_id });
                let new_res = {
                    action: val.action,
                    allow_void: terminal_details?.allowVoid == 1 ? 'Yes' : 'No',
                    allow_refund: terminal_details?.allowRefunds == 1 ? 'Yes' : 'No',
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
                    transaction_id: trans_data[0]?.last_txn_id
                        ? trans_data[0]?.last_txn_id
                        : "",
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
                    is_oneclick: result.is_one_click == 1 ? 1 : 0,
                    is_retry: is_retry > 0 ? 1 : 0,
                    is_cascade: is_cascade > 0 ? 1 : 0,
                    m_customer_id: result?.merchant_customer_id
                        ? result?.merchant_customer_id
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
                    amount_remaining_for_capture: result?.amount - amount_capture,
                    amount_tobe_refunded: amount_refunded,
                    remark: failed_remark ? failed_remark : '-',
                    card_bin: result.card_bin != "" ? result.card_bin : result?.pan.substring(0, 5),
                    issuer: result.issuer ? result.issuer : '-',
                    issuer_website: result.issuer_website ? result.issuer_website : "-",
                    issuer_phone_number: result.issuer_phone_number ? result.issuer_phone_number : '-',
                    threeds_version: result['3ds'],
                    threeds_status: result['3ds_status']

                };

                var psp_result = ""
                const last_txn_result = await helpers.get_last_transaction(result.order_id);

                if (last_txn_result) {
                    psp_result = await helpers.get_response_code(result?.psp, last_txn_result?.psp_code);
                }

                let psp_card_token = '-';
                switch (val.psp) {
                    case 'TELR':
                        if (val.saved_card_for_recurring != '')
                            psp_card_token = val.saved_card_for_recurring;
                        break;
                    case 'NI':
                        if (val.saved_card_for_recurring != '') {
                            let saved_card_for_recurirng = JSON.parse((val.saved_card_for_recurring));
                            psp_card_token = saved_card_for_recurirng?.cardToken;
                        }
                        break;
                    case 'PAYTABS':
                        if (val.saved_card_for_recurring != '')
                            psp_card_token = val.saved_card_for_recurring;
                        break;
                }

                let fraud_details = await helpers.get_fraud_data(val.order_id, req.bodyString("mode"));


                let sale_success = await helpers.get_date_by_order_id(
                    {
                        order_id: val.order_id,
                        status: "AUTHORISED",
                        type: "SALE",
                    },
                    txn_table
                )
                console.log("sale_success", sale_success);

                let capture_date = "-"
                if (val.action == "SALE" && sale_success != "") {
                    capture_date = sale_success
                } else {
                    capture_date = await helpers.get_capture_date_by_order_id(val.order_id, txn_table)
                }

                let partial_refund = await helpers.get_partial_refund_date_by_order_id(val.order_id, txn_table)

                let res1 = {
                    transactions_id: await enc_dec.cjs_encrypt(val.id),
                    merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
                    order_id: val?.order_id ? val?.order_id : "",
                    payment_id: val?.payment_id ? val?.payment_id : "",
                    payment_mode: val?.payment_mode ? val?.payment_mode : "",
                    merchant_name: await helpers.get_merchantdetails_name_by_id(
                        val.merchant_id
                    ),
                    customer_name: val?.customer_name ? val.customer_name : "",
                    customer_email: val?.customer_email
                        ? val.customer_email
                        : "",
                    customer_mobile: val?.customer_mobile
                        ? val.customer_mobile
                        : "",
                    customer_code: val?.customer_code ? val.customer_code : "",
                    order_amount: val?.amount.toFixed(2)
                        ? val.amount.toFixed(2)
                        : "",
                    order_currency: val?.currency ? val.currency : "",
                    status: val?.status ? val.status : "",
                    billing_address_1: val?.billing_address_line_1
                        ? val?.billing_address_line_1
                        : "",
                    billing_address_2: val?.billing_address_line_2
                        ? val?.billing_address_line_2
                        : "",
                    billing_city: val?.billing_city ? val?.billing_city : "",
                    billing_pincode: val?.billing_pincode
                        ? val?.billing_pincode
                        : "",
                    billing_province: val?.billing_province
                        ? val?.billing_province
                        : "",
                    billing_country: val?.billing_country
                        ? val?.billing_country
                        : "",
                    shipping_address_1: val?.shipping_address_line_1
                        ? val?.shipping_address_line_1
                        : "",
                    shipping_address_2: val?.shipping_address_line_2
                        ? val?.shipping_address_line_2
                        : "",
                    shipping_city: val?.shipping_city ? val?.shipping_city : "",
                    shipping_province: val?.shipping_province
                        ? val?.shipping_province
                        : "",
                    shipping_country: val?.shipping_country
                        ? val?.shipping_country
                        : "",
                    shipping_pincode: val?.shipping_pincode
                        ? val?.shipping_pincode
                        : "",
                    order_description: val?.other_description ? val?.other_description : val?.description || "-",
                    card_no: val?.card_no ? val?.card_no : "",
                    card_token: val?.card_id ? val?.card_id : "",
                    u_card_token: user_card_token_Details?.card_proxy ? user_card_token_Details?.card_proxy : "-",
                    psp_card_token: psp_card_token,
                    browser_fingerprint: val?.browser_fingerprint
                        ? val?.browser_fingerprint
                        : "",
                    block_for_suspicious_ip: val?.block_for_suspicious_ip
                        ? val?.block_for_suspicious_ip
                        : "",
                    block_for_suspicious_email: val?.block_for_suspicious_email
                        ? val?.block_for_suspicious_email
                        : "",
                    high_risk_country: val?.high_risk_country
                        ? val?.high_risk_country
                        : "",
                    block_for_transaction_limit:
                        val?.block_for_transaction_limit
                            ? val?.block_for_transaction_limit
                            : "",
                    high_risk_transaction: val?.high_risk_transaction
                        ? val?.high_risk_transaction
                        : "",
                    risk_rating:
                        val.high_risk_transaction +
                        val.block_for_suspicious_ip +
                        val.block_for_suspicious_email +
                        val.block_for_transaction_limit +
                        val.high_risk_country,
                    remark: failed_remark ? failed_remark : "-",
                    transaction_date: moment(val.created_at).format(
                        "DD-MM-YYYY H:mm:ss"
                    ),
                    url: val?.return_url ? val?.return_url : "",
                    browser: val?.browser ? val?.browser : "",
                    browser_version: val?.browser_version
                        ? val?.browser_version
                        : "",
                    os: val?.os ? val?.os : "",
                    ip: val?.ip ? val?.ip : "",
                    ip_country: val?.ip_country ? val?.ip_country : "",
                    device_type: val?.device_type ? val?.device_type : "",
                    origin: val?.origin ? val?.origin : "",
                    psp: val?.psp ? val?.psp : "",
                    expiry: val?.expiry ? val?.expiry : "",
                    cardholderName: result?.cardholderName
                        ? result?.cardholderName
                        : "",
                    scheme: val?.scheme ? val?.scheme : "",
                    cardType: val?.cardType ? val?.cardType : "",
                    cardCategory: val?.cardCategory ? val?.cardCategory : "",
                    pan: val?.pan ? val?.pan : "",
                    updated_at: moment(val.updated_at).format(
                        "DD-MM-YYYY H:mm:ss"
                    ),
                    order_txn: update_order_txn,
                    acquirer_response: txn_order_dump?.dump
                        ? txn_order_dump?.dump
                        : "",
                    void_date: await helpers.get_date_by_order_id(
                        {
                            order_id: val.order_id,
                            status: "AUTHORISED",
                            type: "VOID",
                        },
                        txn_table
                    ),
                    auth_date: await helpers.get_date_by_order_id(
                        {
                            order_id: val.order_id,
                            status: "AUTHORISED",
                            type: "AUTH",
                        },
                        txn_table
                    ),
                    failed_date: await helpers.get_date_by_order_id(
                        {
                            order_id: val.order_id,
                            status: "FAILED",
                            type: "CAPTURE",
                        },
                        txn_table
                    ),
                    partial_refund: partial_refund,
                    refund_date: await helpers.get_refund_date_by_order_id(val.order_id, txn_table),
                    cancel_date: await helpers.get_date_by_order_id(
                        {
                            order_id: val.order_id,
                            status: "CANCELLED",
                            type: "PAYMENT",
                        },
                        txn_table
                    ),
                    capture_date: capture_date,
                    psp_payment_id:
                        await helpers.get_txn_details_by_order_status(
                            {
                                order_id: val.order_id,
                                status: "AUTHORISED",
                                type: "CAPTURE",
                            },
                            "CAPTURE",
                            txn_table
                        ),
                    refund_amount:
                        await helpers.get_txn_details_by_order_status(
                            {
                                order_id: val.order_id,
                                status: "AUTHORISED",
                                type: "REFUND",
                            },
                            "REFUND",
                            txn_table
                        ),
                    new_res,
                    psp_category: psp_result,
                    bt_name: val?.scheme ? val?.scheme : "",
                    bt_user: val?.bt_name ? val?.bt_name : "",
                    bt_id: val?.bt_id ? val?.bt_id : "",
                    bt_iban: val?.bt_iban ? val?.bt_iban : "",
                    bt_type: val?.bt_type ? val?.bt_type : "",
                    bt_number: val?.bt_number ? val?.bt_number : "",
                    routed_by: await helpers.getRoutingRuleDetails(val?.order_id, req.bodyString("mode")),
                    fraud_details: fraud_details,
                    status_3ds: user_card_token_Details?.['3ds_version'] != undefined ? user_card_token_Details?.['3ds_version'] : "NA"
                };

                // send_res = new_res;
                send_res = res1;

                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "Transaction details fetched successfully."
                    )
                );
            })
            .catch((error) => {
                console.log(error);
                winston.error(error);
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    requests: async (req, res) => {
        try {
            let request_id = req.bodyString("request_id");
            let mode = req.bodyString("mode");
            let request_data = await helpers.get_data_list(
                "*",
                mode === "test"
                    ? "test_generate_request_id"
                    : "generate_request_id",
                { request_id: request_id }
            );

            // let request_data = await helpers.get_data_list(
            //     "*",
            //     mode === "test" ? "test_generate_request_id" : "generate_request_id",
            //     { order_id: order_id[0].order_id }
            // );


            let rest_data = [];
            for (let val of request_data) {
                let temp = {
                    id: val?.id ? enc_dec.cjs_encrypt(val?.id) : "",
                    merchant_id: val?.merchant_id
                        ? enc_dec.cjs_encrypt(val?.merchant_id)
                        : "",
                    order_id: val?.order_id ? val?.order_id : "",
                    request_id: val?.request_id ? val?.request_id : "",
                    request: val?.request ? val?.request : "",
                };
                rest_data.push(temp);
            }

            res.status(statusCode.ok).send(
                response.successdatamsg(rest_data, "List fetched successfully.")
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    payment_id: async (req, res) => {
        try {
            let payment_ref_id = req.bodyString("payment_ref_id");
            let mode = req.bodyString("mode");
            let table =
                mode === "test"
                    ? "test_txn_response_dump"
                    : "txn_response_dump";
            // let order_id = await helpers.get_data_list(
            //     "order_id",
            //     "order_txn",
            //     { payment_id: payment_ref_id }
            // );

            // let dump_data = await helpers.get_data_list(
            //     "*",
            //     "txn_response_dump",
            //     { order_id: order_id[0]?.order_id }
            // );

            let data = await helpers.get_dump_by_payment_ref(
                payment_ref_id,
                table
            );


            const filteredData = data.filter(
                (item) => item.status !== "AWAIT_3DS"
            );

            // let rest_data=[]
            // for(let val of request_data){
            //     let temp = {
            //         id: val?.id ? enc_dec.cjs_encrypt(val?.id) : "",
            //         merchant_id: val?.merchant_id
            //             ? enc_dec.cjs_encrypt(val?.merchant_id)
            //             : "",
            //         order_id: val?.order_id ? val?.order_id : "",
            //         request_id: val?.request_id ? val?.request_id : "",
            //         request: val?.request ? JSON.parse(val?.request) : "",
            //     };
            //     rest_data.push(temp)
            // }

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    filteredData,
                    "List fetched successfully."
                )
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    update: async (req, res) => {
        try {
            let department_id = await enc_dec.cjs_decrypt(
                req.bodyString("department_id")
            );
            let department = req.bodyString("department");

            var insdata = {
                department: department,
            };
            $ins_id = await TransactionsModel.updateDetails(
                { id: department_id },
                insdata
            );
            res.status(statusCode.ok).send(
                response.successmsg("Record updated successfully")
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    payment_status: async (req, res) => {
        let payment_status = await helpers.get_data_list(
            "*",
            "payment_status",
            { deleted: 0 }
        );
        let payment_modes = await helpers.get_data_list("*", "payment_mode", {
            deleted: 0,
        });

        let send_res = { payment_status: [], payment_mode: [] };
        payment_status.forEach(function (val, key) {
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                payment_status: val.status,
            };
            send_res.payment_status.push(res);
        });
        payment_modes.forEach(function (val, key) {
            let res1 = {
                id: enc_dec.cjs_encrypt(val.id),
                payment_mode: val.payment_mode,
            };
            send_res.payment_mode.push(res1);
        });

        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    highrisk_list: async (req, res) => {
        let limit = {
            perpage: 10,
            start: 0,
            page: 1,
        };

        if (req.bodyString("perpage") && req.bodyString("page")) {
            perpage = parseInt(req.bodyString("perpage"));
            start = parseInt(req.bodyString("page"));

            limit.perpage = perpage;
            limit.start = (start - 1) * perpage;
        }
        let and_filter_obj = {};
        let date_condition = {};
        let or_filter_obj = {};
        // if (req.user.type == "merchant") {
        //     and_filter_obj.super_merchant = req.user.id;
        // }
        let table_name = "";
        if (req.bodyString("mode") == "test") {
            table_name = "test_orders";
        } else {
            table_name = "orders";
        }

        if (req.bodyString("merchant_id")) {
            and_filter_obj.merchant_id = encrypt_decrypt(
                "decrypt",
                req.bodyString("merchant_id")
            );
        }

        let get_risk = 0;
        if (req.bodyString("type")) {
            get_risk = await helpers.get_high_risk(req.bodyString("type"));

        }

        // if (req.bodyString("super_merchant")) {
        //     and_filter_obj.super_merchant = encrypt_decrypt(
        //         "decrypt",
        //         req.bodyString("super_merchant")
        //     );
        // }

        if (req.bodyString("status")) {
            and_filter_obj.status = req.bodyString("status");
        }
        if (req.bodyString("currency")) {
            and_filter_obj.currency = req.bodyString("currency");
        }
        if (req.bodyString("order_id")) {
            and_filter_obj.order_id = req.bodyString("order_id");
        }
        if (req.bodyString("customer_name")) {
            and_filter_obj.customer_name = req.bodyString("customer_name");
        }

        if (req.bodyString("email")) {
            and_filter_obj.customer_email = req.bodyString("email");
        }

        if (req.bodyString("mobile")) {
            and_filter_obj.customer_mobile = req.bodyString("mobile");
        }

        if (req.bodyString("from_date")) {
            date_condition.from_date = req.bodyString("from_date");
        }

        if (req.bodyString("to_date")) {
            date_condition.to_date = req.bodyString("to_date");
        }



        TransactionsModel.select_highrisk(
            and_filter_obj,
            date_condition,
            get_risk,
            limit,
            table_name
        )
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {

                    let refunded_amt = await helpers.get_refunded_amount(
                        val.order_id
                    );
                    let res = {
                        transactions_id: await enc_dec.cjs_encrypt(val.id),
                        merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
                        order_id: val.order_id,
                        payment_id: val.payment_id,
                        merchant_name:
                            await helpers.get_merchantdetails_name_by_id(
                                val.merchant_id
                            ),
                        order_amount: val.amount.toFixed(2),
                        order_currency: val.currency,
                        customer_name: val.customer_name,
                        customer_email: val.customer_email,
                        customer_mobile: val.customer_mobile,
                        class: val.class,
                        mode: "",
                        type: await helpers.get_latest_type_of_txn(
                            val.order_id
                        ),
                        status: val.status,
                        can_be_void: val.status == "APPROVED" ? true : false,
                        refunded_amount: refunded_amt ? refunded_amt : 0.0,
                        // reason: get_risk.val,
                        reason:
                            val.high_risk_transaction == 1
                                ? "block for transaction"
                                : val.block_for_suspicious_ip == 1
                                    ? "block for suspicious ip"
                                    : val.block_for_suspicious_email == 1
                                        ? "block for suspicious email"
                                        : val.block_for_transaction_limit == 1
                                            ? "block for transaction limit"
                                            : val.high_risk_country == 1
                                                ? "block for high risk country"
                                                : "",
                        risk_rating:
                            val.high_risk_transaction +
                            val.block_for_suspicious_ip +
                            val.block_for_suspicious_email +
                            val.block_for_transaction_limit +
                            val.high_risk_country,
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
                        transaction_date: moment(val.created_at).format(
                            "DD-MM-YYYY H:mm:ss"
                        ),
                    };
                    send_res.push(res);
                }
                total_count = await TransactionsModel.get_count_risk(
                    and_filter_obj,
                    date_condition,
                    get_risk,
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

    header_update: async (req, res) => {
        try {
            let order_id = req.bodyString("order_id");
            let order_data = {
                browser: req.headers.browser,
                browser_version: req.headers.browser_version,
                os: req.headers.os,
                ip: req.headers['ip'],
                ip_country: req.headers.ipcountry,
                device_type: req.headers.mobilebrand != "" ? req.headers.mobilebrand : "Desktop",
            };
            //console.log(req.headers);
            let table_name = "";
            if (req.bodyString("mode") == "test") {
                table_name = "test_orders"
            } else {
                table_name = "orders"
            }

            $ins_id = await TransactionsModel.orderDetailsUpdate(
                { order_id: order_id },
                order_data, table_name
            );
            res.status(statusCode.ok).send(
                response.successmsg("Record updated successfully")
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};
function extractParams(req) {
  return {
    mode: req.bodyString("mode"),
    perpage: parseInt(req.bodyString("perpage") || "0", 10),
    page: parseInt(req.bodyString("page") || "0", 10),
    selected_merchant: req.bodyString("selected_merchant"),
    m_id: req.bodyString("m_id"),
    merchant: req.bodyString("merchant"),
    super_merchant: req.bodyString("super_merchant"),
    status: req.bodyString("status"),
    subs_id: req.bodyString("subs_id"),
    currency: req.bodyString("currency"),
    fraud_request_type: req.bodyString("fraud_request_type"),
    paymentlink_id: req.bodyString("paymentlink_id"),
    order_no: req.bodyString("order_no"),
    customer_id: req.bodyString("customer_id"),
    transaction_date: req.bodyString("transaction_date"),
    payment_method: req.bodyString("payment_method"),
    m_payment_token: req.bodyString("m_payment_token"),
    card_bin: req.bodyString("card_bin"),
    min_amount: req.bodyString("min_amount"),
    max_amount: req.bodyString("max_amount"),
    processor: req.bodyString("processor"),
    mid: req.bodyString("mid"),
    m_customer_id: req.bodyString("m_customer_id"),
    declined_reason: req.bodyString("declined_reason"),
    customer_country: req.bodyString("customer_country"),
    search: req.bodyString("search"),
    channel: req.bodyString("channel"),
    from_date: req.bodyString("from_date"),
    to_date: req.bodyString("to_date"),
    fraud_rule: req.bodyString("fraud_rule")
  };
}
function chooseTableName(user, mode) {
  if (user.super_merchant_id && user.type === "merchant") {
    return mode === "live" ? "orders" : "test_orders";
  }
  return mode === "test" ? "test_orders" : "orders";
}
async function buildFilters(user, params) {
  const and_filter_obj = {};
  const date_condition = {};
  const amount_condition = {};
  const like_condition = {};
  const trans_date = {};
  const search_terms = {};
  let subscription_order = params.subs_id ? "yes" : "no";
  let in_condition = "";

  // ✅ Merchant restrictions
  if (user.type === "merchant") {
    and_filter_obj.super_merchant = user.super_merchant_id || user.id;
    if (params.selected_merchant && params.selected_merchant !== "0") {
      and_filter_obj.merchant_id = encrypt_decrypt("decrypt", params.selected_merchant);
    }
    if (params.m_id) {
      and_filter_obj.merchant_id = params.m_id.merchant_id;
    }
  }

  // ✅ Filters
  if (params.merchant) {
    and_filter_obj.merchant_id = encrypt_decrypt("decrypt", params.merchant);
  }
  if (params.super_merchant) {
    and_filter_obj.super_merchant = encrypt_decrypt("decrypt", params.super_merchant);
  }
  if (params.status) and_filter_obj.status = params.status;
  if (params.currency) and_filter_obj.currency = params.currency;
  if (params.fraud_request_type) and_filter_obj.fraud_request_type = params.fraud_request_type;
  if (params.processor) and_filter_obj.psp = params.processor;
  if (params.mid) and_filter_obj.terminal_id = params.mid;
  if (params.m_customer_id) {
    and_filter_obj.merchant_customer_id = parseInt(params.m_customer_id, 10).toString();
  }
  if (params.declined_reason) and_filter_obj.remark = params.declined_reason;

  // ✅ Payment Link filter
  if (params.paymentlink_id) {
    const order_id = await helpers.get_data_list("order_no", "qr_payment", { payment_id: params.paymentlink_id });
    const ords = order_id.map(o => `'${o.order_no}'`).join(", ");
    if (ords) in_condition = `order_id IN (${ords})`;
  }

  // ✅ Order No filter
  if (params.order_no) {
    if (params.order_no.includes(",")) {
      const ords = params.order_no.split(",").map(o => `'${o}'`).join(", ");
      in_condition = `order_id IN (${ords})`;
    } else {
      and_filter_obj.order_id = params.order_no;
    }
  }

  // ✅ Customer ID filter
  if (params.customer_id) {
    const order_ids = await helpers.get_order_ids(parseInt(params.customer_id, 10));
    const ords = order_ids.map(r => `'${r.order_id}'`).join(", ");
    if (ords) in_condition = `order_id IN (${ords})`;
  }

  // ✅ Date filters
  if (params.transaction_date) trans_date.updated_at = params.transaction_date;
  if (params.from_date) date_condition.from_date = params.from_date;
  if (params.to_date) date_condition.to_date = params.to_date;

  // ✅ Payment method
  if (params.payment_method) {
    let payment_mode = await helpers.get_payment_mode_by_id(await enc_dec.cjs_decrypt(params.payment_method));
    if (payment_mode === "Apple Pay") payment_mode = payment_mode.replace(" ", "_");
    and_filter_obj.payment_mode = payment_mode;
  }

  // ✅ Amount filters
  if (params.min_amount && parseFloat(params.min_amount) > 0) amount_condition.min_amount = params.min_amount;
  if (params.max_amount && parseFloat(params.max_amount) > 0) amount_condition.max_amount = params.max_amount;

  // ✅ Search
  if (params.search) {
    search_terms.customer_email = params.search;
    search_terms.customer_mobile = params.search;
    search_terms.customer_name = params.search;
    search_terms.payment_id = params.search;
  }

  // ✅ Fraud rules
  if (params.fraud_rule) {
    const map = {
      suspicious_ip: { block_for_suspicious_ip: "1" },
      suspicious_email: { block_for_suspicious_email: "1" },
      high_risk_country: { high_risk_country: "1" },
      high_risk_transaction: { block_for_transaction_limit: "1" }
    };
    Object.assign(and_filter_obj, map[params.fraud_rule] || { high_risk_transaction: "1" });
  }

  return { and_filter_obj, date_condition, amount_condition, like_condition, trans_date, search_terms, subscription_order, in_condition, limit: { perpage: params.perpage, start: (params.page - 1) * params.perpage } };
}
async function transformTransaction(val, params, table_name) {
  const mode = params.mode;
  const today = moment().format("YYYY-MM-DD");
  const order_date = moment(val.created_at).format("YYYY-MM-DD");

  const [
    _getmid,
    trans_data,
    country,
    is_retry,
    is_cascade
  ] = await Promise.all([
    merchantOrderModel.selectOne("*", { terminal_id: val?.terminal_id }, "mid"),
    helpers.get_trans_data(val?.order_id, mode),
    val?.billing_country ? helpers.get_customer_country(val.billing_country, 'country') : Promise.resolve(''),
    TransactionsModel.get_transactions_retry(val?.order_id, mode),
    TransactionsModel.get_transactions_cascade(val?.order_id, mode)
  ]);

  let show_ID = "", show_link = "";
  if (params.channel === "QR" || params.channel === "PAYMENT LINK") {
    const data_link = await helpers.getLinkID(val.order_id);
    show_ID = data_link.merchant_qr_id ? await helpers.formatNumber(data_link.merchant_qr_id) : '';
    show_link = data_link.payment_id || '';
  } else if (params.channel === "INVOICE") {
    const data_link = await helpers.getInvoiceID(val.order_id);
    show_ID = data_link.invoice_no || '';
    show_link = data_link.id ? await enc_dec.cjs_encrypt(data_link.id) : '';
  } else if (params.channel === "SUBSCRIPTION") {
    const data_link = await helpers.getSubsID(val.order_id);
    show_ID = data_link.subscription_id || '';
    show_link = data_link.plan_id ? await helpers.get_subs_plan_id(data_link.plan_id) : '';
  }

  return {
    transactions_id: await enc_dec.cjs_encrypt(val.id),
    merchant_id: await enc_dec.cjs_encrypt(val.merchant_id),
    sub_merchant_id:val.merchant_id,
    order_id: val.order_id,
    payment_id: val.payment_id,
    merchant_name: await helpers.get_merchantdetails_name_by_id(val.merchant_id),
    order_amount: val.amount.toFixed(2),
    allowVoid: _getmid?.allowVoid == 0 ? 0 : 1,
    allowRefunds: _getmid?.allowRefunds == 0 ? 0 : 1,
    order_currency: val.currency,
    customer_name: val.customer_name,
    customer_email: val.customer_email,
    customer_mobile: val.customer_mobile,
    channel: val.origin,
    status: val.status,
    can_be_voided: moment(order_date).isSame(today) ? "1" : "0",
    transaction_date: moment(val.created_at).format("DD-MM-YYYY H:mm:ss"),
    show_id: show_ID,
    show_link: show_link,
    high_risk_country: val.high_risk_country || 0,
    high_risk_transaction: val.high_risk_transaction || 0,
    block_for_suspicious_ip: val.block_for_suspicious_ip || 0,
    block_for_suspicious_email: val.block_for_suspicious_email || 0,
    block_for_transaction_limit: val.block_for_transaction_limit || 0,
    fraud_request_type: val.fraud_request_type || "",
    new_res: {
      data_id_plain: await helpers.formatNumber(val?.id),
      data_id: enc_dec.cjs_encrypt(val?.id),
      m_order_id: val?.merchant_order_id || "",
      p_order_id: val?.order_id || "",
      p_request_id: trans_data[0]?.last_request_id || "",
      psp_ref_id: trans_data[0]?.last_psp_txn_id || "",
      transaction_id: val?.payment_id || "",
      psp_txn_id: trans_data[0]?.last_psp_ref_id || "",
      transaction_date: val?.updated_at ? moment(val.updated_at).format("DD-MM-YYYY HH:mm:ss") : "",
      transaction_status: val?.status || "",
      status_code: val?.status || "",
      currency: val?.currency || "",
      amount: val?.amount ? val.amount.toFixed(2) : "",
      psp: val?.psp || "",
      payment_method: val?.payment_mode || "",
      payment_method_id: val?.pan || "",
      is_oneclick: val?.is_one_click == 1 ? 1 : 0,
      is_retry: is_retry > 0 ? 1 : 0,
      is_cascade: is_cascade > 1 ? 1 : 0,
      m_customer_id: val?.merchant_customer_id,
      m_customer_id_plain: val?.merchant_customer_id ? enc_dec.cjs_encrypt(val?.merchant_customer_id) : "",
      customer_email: val?.customer_email || "",
      customer_mobile_code: val?.customer_code || "",
      customer_mobile: val?.customer_mobile || "",
      customer_country_name: country,
      customer_country: val?.billing_country || "",
      m_payment_token: val?.card_id || "",
      payment_method_data: {
        scheme: val?.scheme || "",
        card_country: val?.card_country || "",
        card_type: val?.cardType || "",
        masked_pan: val?.pan || ""
      },
      remark: val.other_description !== "" ? val.other_description : "-"
    }
  };
}

module.exports = res_data;
