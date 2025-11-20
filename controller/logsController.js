const CountryModel = require("../models/country");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const order_logs = require("../models/order_logs");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const errlogger = require('../config/logger');

var logger = {
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

        let mode = req.bodyString("mode")

        const order_id = req.bodyString("order_id");
        const filter = { order_id: "" };
        if (req.bodyString("order_id")) {
            filter.order_id = order_id;
        }

        order_logs
            .select(filter, limit, mode)
            .then(async (result) => {
                
                let send_res = [];
                for (let val of result) {
                    let res = {
                        id: enc_dec.cjs_encrypt(val?.id),
                        order_id: val?.order_id ? val?.order_id : "",
                        activity: val?.activity ? val?.activity : "",
                        // activity: val?.activity
                        //     ? JSON.parse(val?.activity)
                        //     : "",
                        created_at: val?.created_at ? val?.created_at : "",
                        updated_at: val?.updated_at ? val?.updated_at : "",
                    };
                    send_res.push(res);
                }
                total_count = await order_logs.get_count(filter);
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "List fetched successfully.",
                        total_count
                    )
                );
            })
            .catch((error) => {
                  errlogger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
    details: async (req, res) => {
        let country_id = await enc_dec.cjs_decrypt(
            req.bodyString("country_id")
        );
        CountryModel.selectOne("*", { id: country_id, deleted: 0 })
            .then((result) => {
                let send_res = [];
                let val = result;
                let res1 = {
                    country_id: enc_dec.cjs_encrypt(val.id),
                    country_name: val.country_name,
                    country_code: val.country_code,
                    currency: val.currency,
                    dial: val.dial,
                    mobile_no_length: val.mobile_no_length,
                    accept_zero_at_first_place: val.accept_zero_at_first_palce,
                    is_high_risk: val.is_high_risk,
                    status: val.status == 1 ? "Deactivated" : "Active",
                    is_this_country_zone: val.is_this_country_zone,
                    status: val.status == 1 ? "Deactivated" : "Active",
                };
                send_res = res1;

                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "Details fetched successfully."
                    )
                );
            })
            .catch((error) => {
                  errlogger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
};
module.exports = logger;
