const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const LogsModel = require("../models/logsModel");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
require("dotenv").config({ path: "../.env" });
const moment = require("moment");
const winston = require('../utilities/logmanager/winston');

var mobile_logs = {
    list: async (req, res) => {
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
        const search = {};
        const search_text = req.bodyString("search");
        let date_condition = {};

        
        // if (req.user.type == "merchant") {
        //     search.admin_type = "merchant";
        // }

        const filter = {};
        if (search_text) {
            filter.user_type = search_text;
            filter.user_name = search_text;
            filter.module = search_text;
            filter.sub_module = search_text;
            filter.activity = search_text;
            filter.ip = search_text;
            filter.platform = search_text;
            filter.mobile_brand = search_text;
            filter.email = search_text;
            filter.mobile_no = search_text;
        }

        if (req.bodyString("from_date")) {
            date_condition.from_date = req.bodyString("from_date");
        }

        if (req.bodyString("to_date")) {
            date_condition.to_date = req.bodyString("to_date");
        }

        LogsModel.select(search, filter, date_condition, limit, "cst_logs")
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    

                    let customer_info = await helpers.get_customer_info_by_id(
                        val.user
                    );

                    let res = {
                        user: await helpers.get_customername_by_id(val.user),
                        // user_name: val.user_name,
                        email: val?.email ? val?.email : "",
                        // email: customer_info?.email ? customer_info?.email : "",
                        mobile_code: customer_info?.dial_code
                            ? customer_info?.dial_code
                            : "",
                        mobile_no: val?.mobile_no ? val?.mobile_no : "",
                        // mobile_no: customer_info?.mobile_no
                        //     ? customer_info?.mobile_no
                        //     : "",
                        user_type: val.user_type,
                        module: val?.module ? val?.module : "",
                        sub_module: val?.sub_module ? val?.sub_module : "",
                        app_version: val.app_version,
                        activity: val?.activity ? val?.activity : "",
                        platform: val?.platform ? val?.platform : "",
                        platform_version: val?.platform_version
                            ? val.platform_version
                            : "",
                        browser_version: val?.browser_version
                            ? val?.browser_version
                            : "",
                        is_mobile: val.is_mobile ? "No" : "Yes",
                        mobile_brand: val?.mobile_brand
                            ? val?.mobile_brand
                            : "",
                        mobile_model: val?.mobile_model
                            ? val?.mobile_model
                            : "",
                        is_robot: val.is_robot ? "Yes" : "No",
                        ip: val.ip,
                        added_date: moment(val.added_at).format(
                            "DD-MM-YYYY H:mm:ss"
                        ),
                    };
                    send_res.push(res);
                }
                total_count = await LogsModel.get_count(
                    search,
                    filter,
                    date_condition,
                    "cst_logs"
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
};

module.exports = mobile_logs;
