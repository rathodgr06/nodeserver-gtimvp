const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const LogsModel = require("../models/logsModel");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
require("dotenv").config({ path: "../.env" });
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const moment = require("moment");
require("dotenv").config({ path: "../.env" });
const logger = require('../config/logger');

var admin_user = {
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
        if (req.user.type == "merchant") {
            search.admin_type = "merchant";
        }

        const filter = {};
        if (search_text) {
            filter.admin_type = search_text;
            filter.module = search_text;
            filter.sub_module = search_text;
            filter.activity = search_text;
            filter.ip = search_text;
            filter.os = search_text;
            filter.browser = search_text;
        }

        if (req.bodyString("from_date")) {
            date_condition.from_date = req.bodyString("from_date");
        }

        if (req.bodyString("to_date")) {
            date_condition.to_date = req.bodyString("to_date");
        }
        LogsModel.select(search, filter, date_condition, limit, "admin_logs")
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let res = {
                        user: await helpers.get_admin_name_by_id(val.user),
                        module: val.module,
                        sub_module: val.sub_module,
                        activity: val.activity,
                        os: val.os,
                        browser: val.browser,
                        browser_version: val.browser_version,
                        is_mobile: val.is_mobile ? "Yes" : "No",
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
                    "admin_logs"
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
               logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
};
module.exports = admin_user;
