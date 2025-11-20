const TransactionsModel = require("../models/transactions");
const PartnerModel = require("../models/partner");
const MerchantModel = require("../models/merchantmodel");
const dashboardModel = require("../models/dashboardModel");
const PspModel = require("../models/psp");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const moment = require("moment");
const e = require("express");
const referrer_model = require("../models/referrer_model");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');

const getDateCondition = async (req) => {
    const from_date = req.bodyString("from_date") || (await date_formatter.convert_date_by_days(6));
    const to_date = req.bodyString("to_date") || (await date_formatter.insert_date(new Date()));
    return { from_date, to_date };
};

async function table_conditions(req) {
    return new Promise((resolve, reject) => {
        try {
            let obj = {
                'super_merchant_id': req?.user?.super_merchant_id,
                'type': req?.user?.type,
                'mode': req?.body?.mode,
            };
            resolve(obj);
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            reject(error);
        }
    });
}

const getAndCondition = async (req) => {
    let and_condition = {};
    if (req.bodyString("merchant_id")) {
        let sub_merchant_id = req.bodyString("merchant_id");
        if (sub_merchant_id === '0') {
            and_condition.merchant_id = 0;
            and_condition.super_merchant_id = req.user.id;
        } else {
            and_condition.merchant_id =  enc_dec.cjs_decrypt(sub_merchant_id);
        }
    }

    if (req.bodyString("currency")) {
        and_condition.currency =  req.bodyString("currency");
    }
    if (req.bodyString("psp")) {
        and_condition.psp = req.bodyString("psp");
    }
    if (req.bodyString("payment_mode")) {
        and_condition.origin = req.bodyString("payment_mode");
    }
    if (req.bodyString("payment_method")) {
        and_condition.payment_mode = req.bodyString("payment_method");
    }
    if (req.bodyString("scheme")) {
        and_condition.scheme = req.bodyString("scheme");
    }

    if (req.bodyString("issuer")) {
        and_condition.issuer = req.body.issuer;
    }
    return and_condition;
};



var res_data = {
    dashboard: async (req, res) => {
        let added_date = moment().format("YYYY-MM-DD HH:mm:ss");

        let from_date = await date_formatter.convert_date_by_days(7);
        let to_date = await date_formatter.insert_date(new Date());
        if (req.bodyString("from_date") && req.bodyString("to_date")) {
            from_date = req.bodyString("from_date");
            to_date = req.bodyString("to_date");
        }
        let search_date = { from_date: from_date, to_date: to_date };
        let data = {};
        try {
            if (req.user.type == "admin") {
                let mode = req.bodyString("mode");
                let transaction_table = "";
                if (mode === "test") {
                    transaction_table = "test_orders";
                } else {
                    transaction_table = "orders";
                }
                // let search_date = { from_date: from_date, to_date: to_date };
                let no_of_transactions =
                    await TransactionsModel.get_dynamic_count(
                        {},
                         search_date ,
                        transaction_table
                    );
                let total_revenue = await TransactionsModel.get_volume_dynamic(
                    {},
                    req.bodyString("from_date") ? search_date : {},
                    transaction_table
                );

                let psp = await PspModel.get_psp_by_merchant_admin();
                let total_sub_merchant =
                    await MerchantModel.get_sub_merchant_count_by_merchant(
                        "status=0 and deleted=0 and live=1",
                        req.bodyString("from_date") ? search_date : false
                    );
                //=================Weekly==================//
                let weekly_transactions = [];
                let week_start_date;
                let week_end_date;
                let get_week_wise_amount;
                for (let k = 0; k <= 9; k++) {
                    week_start_date = await date_formatter.convert_start_date_by_weeks(k)
                    //  moment().subtract(k, "weeks").startOf("week").format("YYYY-MM-DD");
                    week_end_date = await date_formatter.convert_end_date_by_weeks(k)
                    //  moment().subtract(k, "weeks").endOf("week").format("YYYY-MM-DD");

                    get_week_wise_amount =
                        await TransactionsModel.get_week_wise_amount(
                            {
                                from_date: week_start_date,
                                to_date: week_end_date,
                            },
                            {},
                            transaction_table
                        );

                    weekly_transactions.push({
                        start_date: week_start_date,
                        end_date: week_end_date,
                        amount: get_week_wise_amount,
                    });
                }
                //=================Weekly END==============//
                //=========== Daily ==============//
                var last_days = 10;
                var date_last_days = await date_formatter.convert_date_by_days(last_days);
                let daily_query_res =
                    await TransactionsModel.get_last_day_wise_amount(
                        date_last_days,
                        {},
                        transaction_table
                    );
                let daily_status_obj = [];
                let daily_transactions = [];
                for (let val of daily_query_res) {
                    daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let daily_date;
                for (let j = 0; j <= last_days; j++) {
                    daily_date = await date_formatter.get_date_by_days(j)
                    // moment().subtract(j, "day").format("DD-MM-YYYY");
                    if (daily_status_obj[daily_date] !== undefined) {
                        daily_transactions.push(daily_status_obj[daily_date]);
                    } else {
                        daily_transactions.push({ date: daily_date, total: 0 });
                    }
                }

                //=========== Daily END==============//
                let shared_revenue = 0;
                if (psp.length > 0 && total_revenue > 0) {
                    shared_revenue = total_revenue / psp.length;
                }
                let donut_chart = [];
                for (i = 0; i < psp.length; i++) {
                    donut_chart.push(shared_revenue);
                }

                let last_ten_transactions_resp =[];
                    await TransactionsModel.TenTransactions(
                        { },
                        req.bodyString("from_date") ? search_date : {},
                        transaction_table
                    );

                //================Fraud Detections Count===============/
                let block_transaction_count =
                    await TransactionsModel.get_fraud_transaction_counter(
                        transaction_table,
                        req.bodyString("from_date") ? search_date : {}
                    );

                let block_volume_total =
                    await TransactionsModel.get_fraud_volume(
                        transaction_table,
                        req.bodyString("from_date") ? search_date : {}
                    );
                //================ Fraud Detection Count End  //
                //=========== Fraud Daily ==============//
                var fraud_last_days = 10;
                var fraud_date_last_days = moment()
                    .subtract(fraud_last_days, "day")
                    .format("YYYY-MM-DD");
                /*Total Transaction for date*/
                let fraud_daily_query_res =
                    await TransactionsModel.get_last_day_wise_amount(
                        date_last_days,
                        {},
                        transaction_table
                    );
                /*Total Blocked Transaction for the date*/

                let fraud_daily_status_obj = [];
                let fraud_daily_transactions = [];
                for (let val of fraud_daily_query_res) {
                    fraud_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_daily_date = await date_formatter.get_date_by_days(j)
                    //  moment().subtract(j, "day").format("DD-MM-YYYY");
                    if (
                        fraud_daily_status_obj[fraud_daily_date] !== undefined
                    ) {
                        fraud_daily_transactions.push(
                            fraud_daily_status_obj[fraud_daily_date]
                        );
                    } else {
                        fraud_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }

                let fraud_blocked_daily_query_res =
                    await TransactionsModel.get_blocked_last_day_wise_amount(
                        date_last_days,
                        " block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1",
                        transaction_table
                    );
                let fraud_blocked_daily_status_obj = [];
                let fraud_blocked_daily_transactions = [];
                for (let val of fraud_blocked_daily_query_res) {
                    fraud_blocked_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_blocked_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_blocked_daily_date = await date_formatter.get_date_by_days(j)
                    //  moment().subtract(j, "day").format("DD-MM-YYYY");
                    if (
                        fraud_blocked_daily_status_obj[
                        fraud_blocked_daily_date
                        ] !== undefined
                    ) {
                        fraud_blocked_daily_transactions.push(
                            fraud_blocked_daily_status_obj[
                            fraud_blocked_daily_date
                            ]
                        );
                    } else {
                        fraud_blocked_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }

                let fraud_high_risk_daily_query_res =
                    await TransactionsModel.get_high_risk_last_day_wise_amount(
                        date_last_days,
                        " high_risk_transaction=1 OR high_risk_country=1 ",
                        transaction_table
                    );
                let fraud_high_risk_daily_status_obj = [];
                let fraud_high_risk_daily_transactions = [];
                for (let val of fraud_high_risk_daily_query_res) {
                    fraud_high_risk_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_high_risk_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_high_risk_daily_date = await date_formatter.get_date_by_days(j)
                    //  moment().subtract(j, "day").format("DD-MM-YYYY");
                    if (
                        fraud_high_risk_daily_status_obj[
                        fraud_high_risk_daily_date
                        ] !== undefined
                    ) {
                        fraud_high_risk_daily_transactions.push(
                            fraud_high_risk_daily_status_obj[
                            fraud_high_risk_daily_date
                            ]
                        );
                    } else {
                        fraud_high_risk_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }

                let fraud_transactions_array = [];
                for (i = 0; i < fraud_daily_transactions.length; i++) {
                    let obj = {
                        date: fraud_daily_transactions[i].date,
                        total: fraud_daily_transactions[i].total,
                        blocked: fraud_blocked_daily_transactions[i].total,
                        high_risk: fraud_high_risk_daily_transactions[i].total,
                    };
                    fraud_transactions_array.push(obj);
                }

                //=========== Fraud Daily END==============//

                data.recent_transactions = last_ten_transactions_resp;
                data.graph_data = weekly_transactions;
                (data.pie_chart_label = psp),
                    (data.pie_chart_value = donut_chart);
                data.total_revenue = total_revenue;
                data.total_transaction = no_of_transactions;
                data.total_sub_merchant = total_sub_merchant;
                data.total_psp = psp.length;
                data.daily_transactions = daily_transactions;
                data.total_blocked_transactions = block_transaction_count;
                data.total_blocked_volume = block_volume_total;
                data.fraud_daily_transaction = fraud_transactions_array;
                res.status(statusCode.ok).send(
                    response.successdatamsg(data, "Details fetch successfully")
                );
            } else if (req.user.type == "merchant") {
                let mode = req.bodyString("mode");
                let merchant = req.bodyString("merchant");
                let search_obj = {
                    super_merchant: req.user.super_merchant_id
                        ? req.user.super_merchant_id
                        : req.user.id,
                };
                let transaction_table = "";
                if (mode == "test") {
                    transaction_table = "test_orders";
                } else {
                    transaction_table = "orders";
                }
                if (merchant != 0) {
                    search_obj.merchant_id = encrypt_decrypt(
                        "decrypt",
                        merchant
                    );
                }
                let search_date = { from_date: from_date, to_date: to_date };
                let no_of_transactions =
                    await TransactionsModel.get_dynamic_count(
                        search_obj,
                        req.bodyString("from_date") ? search_date : {},
                        transaction_table
                    );
                let total_revenue = await TransactionsModel.get_volume_dynamic(
                    search_obj,
                    req.bodyString("from_date") ? search_date : {},
                    transaction_table
                );
                let psp = await PspModel.get_psp_by_merchant(
                    "merchant_id=" +
                    (req.user.super_merchant_id
                        ? req.user.super_merchant_id
                        : req.user.id)
                );
                let total_sub_merchant =
                    await MerchantModel.get_sub_merchant_count_by_merchant(
                        " super_merchant_id=" +
                        (req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id),
                        req.bodyString("from_date") ? search_date : false
                    );

                //=================Weekly==================//
                let weekly_transactions = [];
                let week_start_date;
                let week_end_date;
                let get_week_wise_amount;
                for (let k = 0; k <= 9; k++) {
                    week_start_date = await date_formatter.convert_start_date_by_weeks(k)
                    week_end_date = await date_formatter.convert_end_date_by_weeks(k)

                    get_week_wise_amount =
                        await TransactionsModel.get_week_wise_amount(
                            {
                                from_date: week_start_date,
                                to_date: week_end_date,
                            },
                            {
                                super_merchant: req.user.super_merchant_id
                                    ? req.user.super_merchant_id
                                    : req.user.id,
                            },
                            transaction_table
                        );

                    weekly_transactions.push({
                        start_date: week_start_date,
                        end_date: week_end_date,
                        amount: get_week_wise_amount,
                    });
                }
                //=================Weekly END==============//
                //=========== Daily ==============//
                var last_days = 10;
                var date_last_days = await date_formatter.convert_date_by_days(last_days)
                let daily_query_res =
                    await TransactionsModel.get_last_day_wise_amount(
                        date_last_days,
                        search_obj,
                        transaction_table
                    );
                let daily_status_obj = [];
                let daily_transactions = [];
                for (let val of daily_query_res) {
                    daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let daily_date;
                for (let j = 0; j <= last_days; j++) {
                    daily_date = await date_formatter.get_date_by_days(j)
                    if (daily_status_obj[daily_date] !== undefined) {
                        daily_transactions.push(daily_status_obj[daily_date]);
                    } else {
                        daily_transactions.push({ date: daily_date, total: 0 });
                    }
                }

                //=========== Daily END==============//
                let shared_revenue = 0;
                if (psp.length > 0) {
                    shared_revenue = total_revenue / psp.length;
                }
                let donut_chart = [];
                for (i = 0; i < psp.length; i++) {
                    donut_chart.push(shared_revenue);
                }

                if (merchant != 0) {
                    var search_obj_ = {
                        "ord.super_merchant": req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                        "ord.merchant_id": encrypt_decrypt("decrypt", merchant),
                    };
                } else {
                    var search_obj_ = {
                        "ord.super_merchant": req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    };
                }
                let last_ten_transactions_resp =
                    await TransactionsModel.selectTenTransactions(
                        search_obj_,
                        transaction_table
                    );
                //================Fraud Detections Count===============/

                if (merchant != 0) {
                    var search_obj_bl = {
                        super_merchant: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                        merchant_id: encrypt_decrypt("decrypt", merchant),
                    };
                } else {
                    var search_obj_bl = {
                        super_merchant: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    };
                }
                let block_transaction_count =
                    await TransactionsModel.get_fraud_transaction_counter_merchant_dash(
                        transaction_table,
                        search_obj_bl,
                        req.bodyString("from_date") ? search_date : {}
                    );

                let block_volume_total =
                    await TransactionsModel.get_fraud_volume_merchant_dash(
                        transaction_table,
                        search_obj_bl,
                        req.bodyString("from_date") ? search_date : {}
                    );
                //================ Fraud Detection Count End  //
                //=========== Fraud Daily ==============//
                var fraud_last_days = 10;
                var fraud_date_last_days = await date_formatter.convert_date_by_days(fraud_last_days)
                //   moment().subtract(fraud_last_days, "day").format("YYYY-MM-DD");
                /*Total Transaction for date*/
                let fraud_daily_query_res =
                    await TransactionsModel.get_last_day_wise_amount(
                        date_last_days,
                        search_obj,
                        transaction_table
                    );
                /*Total Blocked Transaction for the date*/

                let fraud_daily_status_obj = [];
                let fraud_daily_transactions = [];
                for (let val of fraud_daily_query_res) {
                    fraud_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_daily_date = await date_formatter.get_date_by_days(j)
                    if (
                        fraud_daily_status_obj[fraud_daily_date] !== undefined
                    ) {
                        fraud_daily_transactions.push(
                            fraud_daily_status_obj[fraud_daily_date]
                        );
                    } else {
                        fraud_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }
                if (merchant != 0) {
                    var cond =
                        " (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) AND super_merchant=" +
                        (req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id) +
                        " AND merchant_id=" +
                        encrypt_decrypt("decrypt", merchant);
                } else {
                    var cond =
                        " (block_for_suspicious_ip=1 OR block_for_suspicious_email=1 OR block_for_transaction_limit=1) AND super_merchant=" +
                        (req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id);
                }
                let fraud_blocked_daily_query_res =
                    await TransactionsModel.get_blocked_last_day_wise_amount(
                        date_last_days,
                        cond,
                        transaction_table
                    );
                let fraud_blocked_daily_status_obj = [];
                let fraud_blocked_daily_transactions = [];
                for (let val of fraud_blocked_daily_query_res) {
                    fraud_blocked_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_blocked_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_blocked_daily_date = await date_formatter.get_date_by_days(j)
                    if (
                        fraud_blocked_daily_status_obj[
                        fraud_blocked_daily_date
                        ] !== undefined
                    ) {
                        fraud_blocked_daily_transactions.push(
                            fraud_blocked_daily_status_obj[
                            fraud_blocked_daily_date
                            ]
                        );
                    } else {
                        fraud_blocked_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }
                if (merchant != 0) {
                    var cond_risk =
                        " (high_risk_transaction=1 OR high_risk_country=1) AND super_merchant=" +
                        (req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id) +
                        " AND merchant_id=" +
                        encrypt_decrypt("decrypt", merchant);
                } else {
                    var cond_risk =
                        " (high_risk_transaction=1 OR high_risk_country=1) AND super_merchant=" +
                        (req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id);
                }
                let fraud_high_risk_daily_query_res =
                    await TransactionsModel.get_high_risk_last_day_wise_amount(
                        date_last_days,
                        cond_risk,
                        transaction_table
                    );
                let fraud_high_risk_daily_status_obj = [];
                let fraud_high_risk_daily_transactions = [];
                for (let val of fraud_high_risk_daily_query_res) {
                    fraud_high_risk_daily_status_obj[
                        await date_formatter.get_date(val.transaction_date)
                    ] = {
                        date: await date_formatter.get_date(val.transaction_date),
                        total: val.total,
                    };
                }
                let fraud_high_risk_daily_date;
                for (let j = 0; j <= fraud_last_days; j++) {
                    fraud_high_risk_daily_date = await date_formatter.get_date_by_days(j)
                    if (
                        fraud_high_risk_daily_status_obj[
                        fraud_high_risk_daily_date
                        ] !== undefined
                    ) {
                        fraud_high_risk_daily_transactions.push(
                            fraud_high_risk_daily_status_obj[
                            fraud_high_risk_daily_date
                            ]
                        );
                    } else {
                        fraud_high_risk_daily_transactions.push({
                            date: fraud_daily_date,
                            total: 0,
                        });
                    }
                }

                let fraud_transactions_array = [];
                for (i = 0; i < fraud_daily_transactions.length; i++) {
                    let obj = {
                        date: fraud_daily_transactions[i].date,
                        total: fraud_daily_transactions[i].total,
                        blocked: fraud_blocked_daily_transactions[i].total,
                        high_risk: fraud_high_risk_daily_transactions[i].total,
                    };
                    fraud_transactions_array.push(obj);
                }

                data.recent_transactions = last_ten_transactions_resp;
                data.graph_data = weekly_transactions;
                (data.pie_chart_label = psp),
                    (data.pie_chart_value = donut_chart);
                data.total_revenue = total_revenue;
                data.total_transaction = no_of_transactions;
                data.total_sub_merchant = total_sub_merchant;
                data.total_psp = psp.length;
                data.daily_transactions = daily_transactions;
                data.total_blocked_transactions = block_transaction_count;
                data.total_blocked_volume = block_volume_total
                    ? block_volume_total
                    : 0.0;
                data.fraud_daily_transaction = fraud_transactions_array;
                res.status(statusCode.ok).send(
                    response.successdatamsg(data, "Details fetch successfully")
                );
            } else if (req.user.type == "referrer") {
                let referral_code = req.bodyString("referral_code");
                let condition = {
                    referral_code_used: referral_code,
                    email_verified: 1,
                    mobile_no_verified: 0,
                };
                let filter = {};
                let date_condition = {};
                let merchant_id = await helpers.get_merchant_id(
                    await helpers.get_super_merchant(referral_code)
                );
                data.total_count = await referrer_model.get_count_merchant(
                    condition,
                    filter,
                    date_condition
                );
                data.onboarded_count =
                    await referrer_model.get_count_data_referrer(
                        referral_code,
                        1
                    );
                data.registered_count =
                    await referrer_model.get_count_data_referrer(
                        referral_code,
                        0
                    );
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        data,
                        "Onboarded list fetched successfully."
                    )
                );
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    sales: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);
            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let sales_data = await dashboardModel.sales(
                date_condition,
                and_condition,
                table_condition
            );


            let total = 0.0;
            for (let val of sales_data) {
                total += parseFloat(val?.total_amount);
            }

            let send_res = {
                total: total.toFixed(2),
                sales_data,
            };


            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Sales data fetched successfully."
                )
            );

            
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    oneclick: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let sales_data = await dashboardModel.oneclick(
                date_condition,
                and_condition,
                table_condition
            );


            let total = 0.0;
            for (let val of sales_data) {
                total += parseFloat(val?.total_amount);
            }

            let send_res = {
                total: total.toFixed(2),
                sales_data,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Sales data fetched successfully."
                )
            );
            
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    transactions: async (req, res) => {
        try {

            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let trans_data = await dashboardModel.transactions(
                date_condition,
                and_condition,
                table_condition
            );



            let total = 0.0;
            for (let val of trans_data) {
                total += parseFloat(val?.transaction_count);
            }


            let psp_count = 0;
            let merchant_id = await enc_dec.cjs_decrypt(
                req.bodyString("merchant_id")
            )
            if (merchant_id) {
                psp_count = await PspModel.getPspCount(merchant_id);
            } else {
                psp_count = await PspModel.getSuperMerchantSubMerchantPspCount(req.user.id);
                //  console.info('psp_count', psp_count)
            }

            let send_res = {
                total: total.toFixed(2),
                trans_data,
                psp_count
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Transaction data fetched successfully."
                )
            );

           
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    routingGraph: async (req, res) => {
        try {

            const date_condition = {};
            const and_condition = {};
            and_condition['o.super_merchant'] = req.user.id;
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                date_condition.from_date = req.bodyString("from_date");
                date_condition.to_date = req.bodyString("to_date");
            }

            const fromDate = moment(req.bodyString("from_date"));
            const toDate = moment(req.bodyString("to_date"));

            if (req.bodyString("merchant_id")) {
                let sub_merchant_id = req.bodyString("merchant_id");
                if (sub_merchant_id === '0') {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant = req.user.id;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
                }
            }

            if (req.bodyString("currency")) {
                and_condition.currency = await req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            if (req.bodyString("issuer")) {
                and_condition.issuer = req.body.issuer;
            }


            let tableName = req.body.mode == 'test' ? 'pg_test_orders' : 'pg_orders';
            const retryCountData = await dashboardModel.routingCountData( and_condition, date_condition, tableName);
            const countPercentage = await dashboardModel.routingTotalCountData( and_condition, date_condition, tableName);
            const retryAmountData = await dashboardModel.routingAmountData( and_condition, date_condition, tableName);

            return res.status(statusCode.ok).send(
                response.successdatamsg({
                    total:countPercentage,
                    routingCountArr:retryCountData,
                    routingAmountArr:retryAmountData
                },
                    "Transaction data fetched successfully."
            ));

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            return res.status(statusCode.ok).send(
                response.errormsg(error.message)
            );
        }
    },  
    
    oneclickGraph: async (req, res) => {
        try {
            const date_condition = {};
            const and_condition = {};
            and_condition['o.super_merchant'] = req.user.id;
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                date_condition.from_date = req.bodyString("from_date");
                date_condition.to_date = req.bodyString("to_date");
            }

            const fromDate = moment(req.bodyString("from_date"));
            const toDate = moment(req.bodyString("to_date"));

            if (req.bodyString("merchant_id")) {
                let sub_merchant_id = req.bodyString("merchant_id");
                if (sub_merchant_id === '0') {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant = req.user.id;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
                }
            }

            if (req.bodyString("currency")) {
                and_condition.currency = await req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            if (req.bodyString("issuer")) {
                and_condition.issuer = req.body.issuer;
            }


            let tableName = req.body.mode == 'test' ? 'pg_test_orders' : 'pg_orders';
            const selection = '*'
            //const totalcountData = await dashboardModel.totalsaleCount(selection, and_condition, date_condition, tableName)
            //retry count genrated
            and_condition['l.mode'] = req.body.mode
            const retryCountData = await dashboardModel.oneclickCountData(selection, and_condition, date_condition, tableName);
            const retryAmountData = await dashboardModel.oneclickAmountData(selection, and_condition, date_condition, tableName);
            const totalPercentage = await dashboardModel.oneclickTotalCountPercentage(selection, and_condition, date_condition, tableName);
            

            return res.status(statusCode.ok).send(
                response.successdatamsg({
                    total:totalPercentage,
                    CountArr:retryCountData,
                    AmountArr:retryAmountData
                },
                    "Transaction data fetched successfully."
            ));



           

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },  
    
    
    refund: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);  
            
            
            let refund_count_data = await dashboardModel.refund_count(
                date_condition,
                and_condition,
                table_condition
            );

            let refund_data = await dashboardModel.refund_amount(
                date_condition,
                and_condition,
                table_condition
            );

            let refund_canceled_data = await dashboardModel.refund_canceled_count(
                date_condition,
                and_condition,
                table_condition
            );
                
            let refund_percentage =refund_count_data.total_per;
            let send_res = {
                //total:  avg?avg.toFixed(2):0,
                total:refund_percentage,
                refund_arr:refund_data,
                refund_count_arr:refund_count_data.resp,
                refund_count_percent:refund_percentage,
                refund_cancel_count_arr:refund_canceled_data,
            };

            return res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Refund data fetched successfully."
                )
            );
        
            
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            return res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    
    
    retryGraph: async (req, res) => {
        try {
            const date_condition = {};
            const and_condition = {};
            and_condition['o.super_merchant'] = req.user.id;
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                date_condition.from_date = req.bodyString("from_date");
                date_condition.to_date = req.bodyString("to_date");
            }

            const fromDate = moment(req.bodyString("from_date"));
            const toDate = moment(req.bodyString("to_date"));

            if (req.bodyString("merchant_id")) {
                let sub_merchant_id = req.bodyString("merchant_id");
                if (sub_merchant_id === '0') {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant = req.user.id;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
                }
            }

            if (req.bodyString("currency")) {
                and_condition.currency = await req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            if (req.bodyString("issuer")) {
                and_condition.issuer = req.body.issuer;
            }


            let tableName = req.body.mode == 'test' ? 'pg_test_orders' : 'pg_orders';
            const selection = '*';
            and_condition['l.mode'] = req.body.mode
            //const totalcountData = await dashboardModel.totalsaleCount(selection, and_condition, date_condition, tableName)
            
            const retryCountData = await dashboardModel.retryCountData(selection, and_condition, date_condition, tableName);
            const retryAmountData = await dashboardModel.retryAmountData(selection, and_condition, date_condition, tableName);
            const retryTotalPercentage = await dashboardModel.retryTotalPercentage(selection, and_condition, date_condition, tableName);
            
            
            
            return res.status(statusCode.ok).send(
                response.successdatamsg({

                    total:retryTotalPercentage,
                    retryCountArr:retryCountData,
                    retryAmountArr:retryAmountData
                },
                "Transaction data fetched successfully."
            ));
            


        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    cascade: async (req, res) => {
        try {
            const date_condition = {};
            const and_condition = {};
            and_condition['o.super_merchant'] = req.user.id;
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                date_condition.from_date = req.bodyString("from_date");
                date_condition.to_date = req.bodyString("to_date");
            }

            const fromDate = moment(req.bodyString("from_date"));
            const toDate = moment(req.bodyString("to_date"));

            if (req.bodyString("merchant_id")) {
                let sub_merchant_id = req.bodyString("merchant_id");
                if (sub_merchant_id === '0') {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant = req.user.id;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
                }
            }

            if (req.bodyString("currency")) {
                and_condition.currency = await req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            if (req.bodyString("issuer")) {
                and_condition.issuer = req.body.issuer;
            }


            let tableName = req.body.mode == 'test' ? 'pg_test_orders' : 'pg_orders';
            const selection = '*'
            
            
            and_condition['l.mode'] = req.body.mode

            const cascadeResAmountCountData = await dashboardModel.cascadeAmountCountData(selection, and_condition, date_condition, tableName)
            const cascadeResCountData = await dashboardModel.cascadeCountData(selection, and_condition, date_condition, tableName)
            let total_percentage = await dashboardModel.totalCascadeCountData(selection, and_condition, date_condition, tableName);

            return res.status(statusCode.ok).send(
                response.successdatamsg({
                    total:total_percentage?.percentage?total_percentage?.percentage:0,
                    cascadeCountArr:cascadeResCountData,
                    cascadeAmountArr:cascadeResAmountCountData
                },
                    "Cascade data fetched successfully."
            ));


           

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    oneclick: async (req, res) => {
        try {

            console.log(req.user);
            const date_condition = {};
            const and_condition = {};
            and_condition['o.super_merchant'] = req.user.id;
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                date_condition.from_date = req.bodyString("from_date");
                date_condition.to_date = req.bodyString("to_date");
            }

            const fromDate = moment(req.bodyString("from_date"));
            const toDate = moment(req.bodyString("to_date"));

            if (req.bodyString("merchant_id")) {
                let sub_merchant_id = req.bodyString("merchant_id");
                if (sub_merchant_id === '0') {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant = req.user.id;
                } else {
                    and_condition.merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
                }
            }

            if (req.bodyString("currency")) {
                and_condition.currency = await req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            if (req.bodyString("issuer")) {
                and_condition.issuer = req.body.issuer;
            }


            let tableName = req.body.mode == 'test' ? 'pg_test_orders' : 'pg_orders';
            const selection = '*'
            const totalcountData = await dashboardModel.totalsaleCount(selection, and_condition, date_condition, tableName)
            //retry count genrated
            and_condition['l.mode'] = req.body.mode
            const retryCountData = await dashboardModel.cascadeCountData(selection, and_condition, date_condition, tableName)
            const totalcountDict = totalcountData.reduce((acc, row) => {
                acc[row.date] = {
                    transactionCount: row.transactionCount,
                    totalAmount: row.totalAmount
                };
                return acc;
            }, {});

            const retryCountDict = retryCountData.reduce((acc, row) => {
                acc[row.date] = {
                    transactioncascadeCount: row.transactioncascadeCount,
                    totalcascadeAmount: row.totalcascadeAmount
                };
                return acc;
            }, {});

            const dateRange = [];
            for (let date = moment(toDate); date.isSameOrAfter(fromDate); date.subtract(1, 'days')) {
                dateRange.push(date.format('YYYY-MM-DD'));
            }

            const cascadeCountArr = [];
            const cascadeAmountArr = [];

            dateRange.forEach(date => {
                const transactionCount = totalcountDict[date] ? totalcountDict[date].transactionCount : 0;
                const totalAmount = totalcountDict[date] ? totalcountDict[date].totalAmount : 0;
                const transactioncascadeCount = retryCountDict[date] ? retryCountDict[date].transactioncascadeCount : 0;
                const totalcascadeAmount = retryCountDict[date] ? retryCountDict[date].totalcascadeAmount : 0;

                const cascadecountpercentage = (transactioncascadeCount / transactionCount) * 100 || 0;
                const cascadeAmountpercentage = (totalcascadeAmount / totalAmount) * 100 || 0;

                cascadeCountArr.push({
                    date,
                    transactionCount,
                    transactioncascadeCount,
                    percentage: isNaN(cascadecountpercentage) ? 0 : cascadecountpercentage
                });

                cascadeAmountArr.push({
                    date,
                    totalAmount,
                    totalcascadeAmount,
                    percentage: isNaN(cascadeAmountpercentage) ? 0 : cascadeAmountpercentage
                });
            });

            //console.log(cascadeCountArr)
            return res.status(statusCode.ok).send(
                response.successdatamsg({
                    cascadeCountArr,
                    cascadeAmountArr
                },
                    "Transaction data fetched successfully."
                ));


        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    authorised: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let authorised_data = await dashboardModel.authorised(
                date_condition,
                and_condition,
                table_condition
            );

            let authorised_value_data = await dashboardModel.authorised_value(
                date_condition,
                and_condition,
                table_condition
            );

            let total_data = await dashboardModel.authorised_total(
                date_condition,
                and_condition,
                table_condition
            );


            let send_res1 = {
                
                total: total_data,
                auth_arr:authorised_data,
                //total_value: total_value_percentage,
                auth_value_arr:authorised_value_data
            };

            return res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res1,
                    "Authorised data fetched successfully."
                )
            );

            
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    top_customer: async (req, res) => {
        try {

            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let authorised_data = await dashboardModel.top_customer(
                date_condition,
                and_condition,
                table_condition
            );

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Top customers data fetched successfully."
                )
            );
            /*
            // old code
            let and_condition = {};
            let from_date = await date_formatter.convert_date_by_days(6);
            let to_date = await date_formatter.insert_date(new Date());
            let table_name = "";
            if (req.user.super_merchant_id != "" && req.user.type == "merchant") {
                if (req.user.mode == "live") {
                    table_name = "pg_orders";
                } else {
                    table_name = "pg_test_orders";
                }
            } else {
                if (req.bodyString("mode") === "test") {
                    table_name = "pg_test_orders";
                } else {
                    table_name = "pg_orders";
                }
            }
            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                from_date = req.bodyString("from_date");
                to_date = req.bodyString("to_date");
            }
            let date_condition = { from_date, to_date };
            let merchant_id =  await enc_dec.cjs_decrypt(
                req.bodyString("merchant_id")
            )
            if (req.bodyString("merchant_id")) {
                let sub_merchant_id_new =  req.bodyString("merchant_id");
                if (sub_merchant_id_new === "0") {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = merchant_id;
                }
            }
            if (req.bodyString("currency")) {
                and_condition.currency = req.bodyString("currency") ;
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }

            let authorised_data = await dashboardModel.top_customer(
                date_condition,
                and_condition,
                table_name
            );

            // let auth_arr = [];
            // for (let val of authorised_data) {
            //     let temp = {
            //         date: val?.date ? val?.date : "",
            //         total_count: val?.total_count
            //             ? val?.total_count.toFixed(2)
            //             : 0.0,
            //         authorized_count: val?.authorized_count
            //             ? val?.authorized_count.toFixed(2)
            //             : 0.0,
            //         authorized_percentage: val?.authorized_percentage
            //             ? val?.authorized_percentage.toFixed(2)
            //             : 0.0,
            //     };
            //     auth_arr.push(temp);
            // }

            // let total = 0.0;
            // for (let val of auth_arr) {
            //     total += parseFloat(val?.authorized_percentage);
            // }

            // let avg = total / auth_arr.length;

            // let send_res = {
            //     total: avg.toFixed(2),
            //     auth_arr,
            // };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Top customers data fetched successfully."
                )
            );
            */
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    top_country: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let authorised_data = await dashboardModel.top_country(
                date_condition,
                and_condition,
                table_condition
            );

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Authorised data fetched successfully."
                )
            );
            /*
            // old code
            let and_condition = {};
            let from_date = await date_formatter.convert_date_by_days(6);
            let to_date = await date_formatter.insert_date(new Date());

            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                from_date = req.bodyString("from_date");
                to_date = req.bodyString("to_date");
            }
            let date_condition = { from_date, to_date };
            let merchant_id =  await enc_dec.cjs_decrypt(
                req.bodyString("merchant_id")
            )
            if (req.bodyString("merchant_id")) {
                let sub_merchant_id_new =  req.bodyString("merchant_id");
                if (sub_merchant_id_new === "0") {
                    and_condition.merchant_id = 0;
                    and_condition.super_merchant_id = req.user.id;
                } else {
                    and_condition.merchant_id = merchant_id;
                }
            }
            if (req.bodyString("currency")) {
                and_condition.currency = req.bodyString("currency");
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }
            let table_name = "";
            if (req.user.super_merchant_id != "" && req.user.type == "merchant") {
                if (req.user.mode == "live") {
                    table_name = "pg_orders";
                } else {
                    table_name = "pg_test_orders";
                }
            } else {
                if (req.bodyString("mode") === "test") {
                    table_name = "pg_test_orders";
                } else {
                    table_name = "pg_orders";
                }
            }
            let authorised_data = await dashboardModel.top_country(
                date_condition,
                and_condition,
                table_name
            );

            // let auth_arr = [];
            // for (let val of authorised_data) {
            //     let temp = {
            //         date: val?.date ? val?.date : "",
            //         total_count: val?.total_count
            //             ? val?.total_count.toFixed(2)
            //             : 0.0,
            //         authorized_count: val?.authorized_count
            //             ? val?.authorized_count.toFixed(2)
            //             : 0.0,
            //         authorized_percentage: val?.authorized_percentage
            //             ? val?.authorized_percentage.toFixed(2)
            //             : 0.0,
            //     };
            //     auth_arr.push(temp);
            // }

            // let total = 0.0;
            // for (let val of auth_arr) {
            //     total += parseFloat(val?.authorized_percentage);
            // }

            // let avg = total / auth_arr.length;

            // let send_res = {
            //     total: avg.toFixed(2),
            //     auth_arr,
            // };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Authorised data fetched successfully."
                )
            );
            */
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    top_payment_method: async (req, res) => {
        try {

            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let authorised_data = await dashboardModel.top_payment_method(
                date_condition,
                and_condition,
                table_condition
            );

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Authorised data fetched successfully."
                )
            );
            /*
            let and_condition = {};
            let from_date = await date_formatter.convert_date_by_days(6);
            let to_date = await date_formatter.insert_date(new Date());

            if (req.bodyString("from_date") && req.bodyString("to_date")) {
                from_date = req.bodyString("from_date");
                to_date = req.bodyString("to_date");
            }
            let date_condition = { from_date, to_date };

            if (req.bodyString("merchant_id")) {
                and_condition.merchant_id = await enc_dec.cjs_decrypt(
                    req.bodyString("merchant_id")
                );
            }
            if (req.bodyString("currency")) {
                and_condition.currency =await helpers.get_currency_name_by_id(await enc_dec.cjs_decrypt(req.bodyString("currency"))) ;
            }
            if (req.bodyString("psp")) {
                and_condition.psp = req.bodyString("psp");
            }
            if (req.bodyString("payment_mode")) {
                and_condition.origin = req.bodyString("payment_mode");
            }
            if (req.bodyString("payment_method")) {
                and_condition.payment_mode = req.bodyString("payment_method");
            }
            if (req.bodyString("scheme")) {
                and_condition.scheme = req.bodyString("scheme");
            }
            let table_name = "";
            if (req.user.super_merchant_id != "" && req.user.type == "merchant") {
                if (req.user.mode == "live") {
                    table_name = "pg_orders";
                } else {
                    table_name = "pg_test_orders";
                }
            } else {
                if (req.bodyString("mode") === "test") {
                    table_name = "pg_test_orders";
                } else {
                    table_name = "pg_orders";
                }
            }
            let authorised_data = await dashboardModel.top_payment_method(
                date_condition,
                and_condition,
                table_name
            );

            // let auth_arr = [];
            // for (let val of authorised_data) {
            //     let temp = {
            //         date: val?.date ? val?.date : "",
            //         total_count: val?.total_count
            //             ? val?.total_count.toFixed(2)
            //             : 0.0,
            //         authorized_count: val?.authorized_count
            //             ? val?.authorized_count.toFixed(2)
            //             : 0.0,
            //         authorized_percentage: val?.authorized_percentage
            //             ? val?.authorized_percentage.toFixed(2)
            //             : 0.0,
            //     };
            //     auth_arr.push(temp);
            // }

            // let total = 0.0;
            // for (let val of auth_arr) {
            //     total += parseFloat(val?.authorized_percentage);
            // }

            // let avg = total / auth_arr.length;

            // let send_res = {
            //     total: avg.toFixed(2),
            //     auth_arr,
            // };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    authorised_data,
                    "Authorised data fetched successfully."
                )
            );
            */
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    card_issuers: async (req, res) => {
        try {
            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let issuer_data = await dashboardModel.getAllIssuers(
                and_condition,
                table_condition
            );

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    issuer_data,
                    "Issuer data fetched successfully."
                )
            );
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    retry: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let retry_data = await dashboardModel.retry(
                date_condition,
                and_condition,
                table_condition
            );


            //retry value
            let retry_arr = [];
            let total_capture_amount = 0;
            let total_retry_amount = 0;
            for (let val of retry_data) {
                total_capture_amount += val?.captured_amount;
                total_retry_amount += val?.retry_amount;
                let temp = {
                    date: val?.dates ? val?.dates : "",
                    captured_amount: val?.captured_amount
                        ? val?.captured_amount.toFixed(2)
                        : 0,
                    retry_amount: val?.retry_amount
                        ? val?.retry_amount.toFixed(2)
                        : 0,
                    retry_percentage: val?.retry_percentage
                        ? val?.retry_percentage.toFixed(2)
                        : 0,
                };
                retry_arr.push(temp);
            }

            let total = 0.0;
            for (let val of retry_arr) {
                total += parseFloat(val?.retry_percentage);
            }
            let retry_percent = 0;
            // if (total_capture_amount !== 0 && total_retry_amount !== 0) {
            //     retry_percent = Number((total_retry_amount / total_capture_amount) * 100).toFixed(2);

            // }

            retry_percent = total / retry_arr.length;

            let send_res = {
                //total:  avg?avg.toFixed(2):0,
                total: retry_percent ? retry_percent.toFixed(2) : 0,
                retry_arr,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Retry data fetched successfully."
                )
            );


        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    allowed: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let allowed_data = await dashboardModel.allowed(
                date_condition,
                and_condition,
                table_condition
            );


            let amount_data = await dashboardModel.allowed_amount(
                date_condition,
                and_condition,
                table_condition
            );


            let allow_total_percentage = await dashboardModel.allow_total_percentage(
                date_condition,
                and_condition,
                table_condition
            );

            let send_res1 = {
                //total: avg?avg.toFixed(2):0,
                total: allow_total_percentage,
                allowed_arr:allowed_data,
                //amount_total: amount_percent,
                amount_arr:amount_data,
                            
                
            };

            return res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res1,
                    "Allowed txn data fetched successfully."
                )
            );
         
            

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    declined: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let declined_data = await dashboardModel.declined(
                date_condition,
                and_condition,
                table_condition
            );

            let declined_amount_data = await dashboardModel.declined_amount(
                date_condition,
                and_condition,
                table_condition
            );
            let declined_total_percentage = await dashboardModel.declined_percentage(
                date_condition,
                and_condition,
                table_condition
            );



            let send_res1 = {
                //total: avg?avg.toFixed(2):0,
                total: declined_total_percentage,
                declined_count_arr:declined_data,
                //total_amount:amount_percent,
                declined_arr:declined_amount_data
            };

            return res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res1,
                    "Declined txn data fetched successfully."
                )
            );
                    
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    reviewed: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let reviewed_data = await dashboardModel.reviewed(
                date_condition,
                and_condition,
                table_condition
            );
            let review_amount_data = await dashboardModel.reviewed_amount(
                date_condition,
                and_condition,
                table_condition
            );

            let reviewed_total_data = await dashboardModel.reviewed_total(
                date_condition,
                and_condition,
                table_condition
            );

            

            let send_res1 = {
                //total: avg?avg.toFixed(2):0,
                total: reviewed_total_data,
                reviewed_count_arr:reviewed_data,
                //total_amount: amount_percent,
                reviewed_arr:review_amount_data,
                
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res1,
                    "Review txn data fetched successfully."
                )
            );
         
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    reviewed_captured: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let reviewed_data = await dashboardModel.reviewed_captured(
                date_condition,
                and_condition,
                table_condition
            );
            let reviewed_total_data = await dashboardModel.reviewed_total_captured(
                date_condition,
                and_condition,
                table_condition
            );
            let review_amount_data = await dashboardModel.reviewed_approved_amount(
                date_condition,
                and_condition,
                table_condition
            );
            

            let send_res = {
                total: reviewed_total_data,
                reviewed_count_arr:reviewed_data,
                //total_amount:amount_percent,
                reviewed_arr:review_amount_data
            };

            return res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Review approved txn data fetched successfully."
                )
            );

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    success_3DS: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let data = await dashboardModel.success_3DS(
                date_condition,
                and_condition,
                table_condition
            );

            
            let amount_data = await dashboardModel.success_3DS_amount(
                date_condition,
                and_condition,
                table_condition
            );
         
            let amount_arr = [];
            let total_amount = 0;
            let total_3ds_amount = 0;
            for (let val of amount_data) {
                total_amount += val?.total_amount;
                total_3ds_amount += val?.amount;
                let temp = {
                    date: val?.dates ? val?.dates : "",
                    total_amount: val?.total_amount
                        ? val?.total_amount.toFixed(2)
                        : 0,
                        amount: val?.amount
                        ? val?.amount.toFixed(2)
                        : 0,
                        amount_percentage: val?.amount_percentage
                        ? val?.amount_percentage.toFixed(2)
                        : 0,
                };
                amount_arr.push(temp);
            }

            let total = 0.0;
            for (let val of amount_arr) {
                total += parseFloat(val?.amount_percentage);
            }

            let avg = total / amount_arr.length;
            let amount_percent = 0;
            if (total_amount !== 0 && total_3ds_amount !== 0) {
                amount_percent = Number((total_3ds_amount / total_amount) * 100).toFixed(2);
                
            } 
            let ds_count_arr = [];
            let date_wise_total_count = 0
            let date_wise_3ds_total_count = 0
            for (let val of data) {
                date_wise_total_count += val?.total_count
                date_wise_3ds_total_count += val?.count
                let temp = {
                    date: val?.dates ? val?.dates : "",
                    total_count: val?.total_count
                        ? val?.total_count
                        : 0,
                    count: val?.count
                        ? val?.count
                        : 0,
                    percentage: val?.percentage
                        ? val?.percentage.toFixed(2)
                        : 0.0,
                };
                ds_count_arr.push(temp);
            }


            let total_percentage = 0;
            if (date_wise_3ds_total_count !== 0 && date_wise_total_count !== 0) {
                total_percentage = Number((date_wise_3ds_total_count / date_wise_total_count) * 100).toFixed(2);
            }
            let send_res = {
                //total: avg?avg.toFixed(2):0,
                total: total_percentage,
                ds_count_arr,
                total_amount: amount_percent,
                amount_arr
              
                
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "3DS success txn data fetched successfully."
                )
            );

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    version_3DS: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let data = await dashboardModel.version_3DS(
                date_condition,
                and_condition,
                table_condition
            );
            let amount_data = await dashboardModel.version_3DS_amount(
                date_condition,
                and_condition,
                table_condition
            );

            let total = await dashboardModel.version_3DS_total(
                date_condition,
                and_condition,
                table_condition
            );
            
            let send_res = {
                total: total,
                ds_arr:data,
                amount_arr:amount_data,
                
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "3DS txn data fetched successfully."
                )
            );

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    revenue: async (req, res) => {
        try {
            let date_condition = await getDateCondition(req);
            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);

            let sales_data = await dashboardModel.sales(
                date_condition,
                and_condition,
                table_condition
            );


            let total = 0.0;
            for (let val of sales_data) {
                total += parseFloat(val?.total_amount);
            }

            let send_res = {
                total: total.toFixed(2),
                sales_data,
            };


            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Sales data fetched successfully."
                )
            );

      
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    blocked_txn: async (req, res) => {
        try {
         
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
            let declined_data = await dashboardModel.declined(
                date_condition,
                and_condition,
                table_condition
            );

            let declined_amount_data = await dashboardModel.blocked_amount(
                date_condition,
                and_condition,
                table_condition
            );

            let high_risk = await dashboardModel.high_risk_amount(
                date_condition,
                and_condition,
                table_condition
            );
            let high_risk_arr = [];
            let high_risk_amount = 0
            for (let val of high_risk) {
                high_risk_amount += val?.total_amount
                let temp = {
                    date: val?.date ? val?.date : "",
                    risk_total_amount: val?.total_amount
                        ? val?.total_amount.toFixed(2)
                        : 0,
                };
                high_risk_arr.push(temp);
            }
            let date_wise_total_count = 0
            let total_payments = 0
            for (let val of declined_data) {
                date_wise_total_count += val?.declined_count,
                total_payments += val?.total_count
            }

            let declined_arr = [];
            let total_amount = 0;
            let total_declined_amount = 0;
            for (let val of declined_amount_data) {
                total_amount += val?.total_amount;
                total_declined_amount += val?.declined_amount;
                let temp = {
                    date: val?.dates ? val?.dates : "",
                    total_amount: val?.total_amount
                        ? val?.total_amount.toFixed(2)
                        : 0,
                        declined_amount: val?.declined_amount
                        ? val?.declined_amount.toFixed(2)
                        : 0,
                        declined_amount_percentage: val?.declined_amount_percentage
                        ? val?.declined_amount_percentage.toFixed(2)
                        : 0,
                };
                declined_arr.push(temp);
            }

            let total = 0.0;
            for (let val of declined_arr) {
                total += parseFloat(val?.declined_amount_percentage);
            }

            let avg = total / declined_arr.length;
            let amount_percent = 0;
            if (total_amount !== 0 && total_declined_amount !== 0) {
                amount_percent = Number((total_declined_amount / total_amount) * 100).toFixed(2);
                
            }
            let send_res = {
                total_payments:total_payments,
                blocked_payments: date_wise_total_count,
                blocked_volume:Number(total_declined_amount).toFixed(2),
                blocked_rate:amount_percent,
                declined_arr,
                high_risk_arr
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Txn data fetched successfully."
                )
            );

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },


   psp_txn: async (req, res) => {
        try {
         
            let date_condition = await getDateCondition(req);

            let and_condition = await getAndCondition(req);
            let table_condition = await table_conditions(req);
          
            let amount_data = await dashboardModel.psp_txn(
                date_condition,
                and_condition,
                table_condition
            );
            let count_arr = [];
            let amount_arr = [];
            let total_count = 0;
            let total_amount = 0;
            for (let val of amount_data) {
                total_amount += val?.total_amount;
                let temp = {
                    psp: val?.psp ? val?.psp : "",
                    total_amount: val?.total_amount
                        ? val?.total_amount.toFixed(2)
                        : 0,
                };
                amount_arr.push(temp);


                total_count += val?.total_count;
                let temp1 = {
                    psp: val?.psp ? val?.psp : "",
                    total_count: val?.total_count
                        ? val?.total_count.toFixed(2)
                        : 0,
                };
                count_arr.push(temp1);
            }
            let send_res = {
                total_amount:Number(total_amount).toFixed(2),
                amount_arr,
                total_count:Number(total_count).toFixed(2),
                count_arr,
               
            };
            //console.log('send_ressend_res',send_res);
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "PSP Txn data fetched successfully."
                )
            );

        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};
module.exports = res_data;
