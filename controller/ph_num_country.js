const CountryModel = require("../models/ph_num_country_model");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const logger = require('../config/logger');

var country = {
    add: async (req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let country_name = req.bodyString("country_name");
        let country_code = req.bodyString("country_code");
        let currency = req.bodyString("currency");
        let is_this_country_zone = req.bodyString("is_this_country_zone");
        let dial = req.bodyString("dial");
        let mobile_no_length = req.bodyString("mobile_no_length");
        let zero_at_first_place = req.bodyString("zero_at_first_place");

        let ins_body = {
            country_name: country_name,
            country_code: country_code,
            currency: currency,
            is_this_country_zone: is_this_country_zone,
            dial: dial,
            mobile_no_length: mobile_no_length,
            accept_zero_at_first_palce: zero_at_first_place,
            updated_at: added_date,
            ip: await helpers.get_ip(req),
        };

        if (req.bodyString("is_high_risk") == 1) {
            ins_body.is_high_risk = 1;
        } else {
            ins_body.is_high_risk = 0;
        }

        CountryModel.add(ins_body)
            .then((result) => {
                let module_and_user = {
                    user: req.user.id,
                    admin_type: req.user.type,
                    module: "Locations",
                    sub_module: "Country",
                };
                let added_name = req.bodyString("country_name");
                let headers = req.headers;
                admin_activity_logger
                    .add(module_and_user, added_name, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successmsg("Phone number country added successfully.")
                        );
                    })
                    .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });
            })
            .catch((error) => {
               logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
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
        const country = req.bodyString("country_name");
        const filter = { country_name: "" };
        if (req.bodyString("country_name")) {
            filter.country_name = country;
        }

        let filter_arr = { deleted: 0 };

        if (req.bodyString("status") == "Active") {
            filter_arr.status = 0;
        }
        if (req.bodyString("status") == "Deactivated") {
            filter_arr.status = 1;
        }

        CountryModel.select(filter_arr, filter, limit)
            .then(async (result) => {
                let send_res = [];
                result.forEach(function (val, key) {
                    let res = {
                        country_id: enc_dec.cjs_encrypt(val.id),
                        country_name: val.country_name,
                        country_code: val.country_code,
                        currency: val.currency,
                        accept_zero: val.accept_zero_at_first_palce,
                        mobile_no_length: val.mobile_no_length,
                        dial: val.dial,
                        is_high_risk: val.is_high_risk,
                        is_this_country_zone: val.is_this_country_zone,
                        status: val.status == 1 ? "Deactivated" : "Active",
                    };
                    send_res.push(res);
                });
                total_count = await CountryModel.get_count(filter);
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
                    is_this_country_zone: val.is_this_country_zone
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
               logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
    update: async (req, res) => {
        try {
            let country_id = await enc_dec.cjs_decrypt(
                req.bodyString("country_id")
            );
            let country_name = req.bodyString("country_name");
            let country_code = req.bodyString("country_code");
            let currency = req.bodyString("currency");
            let dial = req.bodyString("dial");
            let mobile_no_length = req.bodyString("mobile_no_length");
            let zero_at_first_place = req.bodyString("zero_at_first_place");
            let is_this_country_zone = req.bodyString("is_this_country_zone");

            var insdata = {
                country_name: country_name,
                country_code: country_code,
                currency: currency,
                dial: dial,
                is_this_country_zone: is_this_country_zone,
                mobile_no_length: mobile_no_length,
                accept_zero_at_first_palce: zero_at_first_place,
            };

            if (req.bodyString("is_high_risk") == 1) {
                insdata.is_high_risk = 1;
            } else {
                insdata.is_high_risk = 0;
            }

            $ins_id = await CountryModel.updateDetails(
                { id: country_id },
                insdata
            );

            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "Country",
            };
            let headers = req.headers;
            admin_activity_logger
                .edit(module_and_user, country_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("Phone number country updated successfully")
                    );
                })
                .catch((error) => {
                   logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    country_deactivate: async (req, res) => {
        try {
            let country_id = await enc_dec.cjs_decrypt(
                req.bodyString("country_id")
            );
            var insdata = {
                status: 1,
            };

            $ins_id = await CountryModel.updateDetails(
                { id: country_id },
                insdata
            );
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "Country",
            };
            let headers = req.headers;
            admin_activity_logger
                .deactivate(module_and_user, country_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("Phone number country deactivated successfully")
                    );
                })
                .catch((error) => {
                   logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    country_activate: async (req, res) => {
        try {
            let country_id = await enc_dec.cjs_decrypt(
                req.bodyString("country_id")
            );
            var insdata = {
                status: 0,
            };

            $ins_id = await CountryModel.updateDetails(
                { id: country_id },
                insdata
            );
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "Country",
            };
            let headers = req.headers;
            admin_activity_logger
                .activate(module_and_user, country_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("Phone number country activated successfully")
                    );
                })
                .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    country_delete: async (req, res) => {
        try {
            let country_id = await enc_dec.cjs_decrypt(
                req.bodyString("country_id")
            );
            var insdata = {
                deleted: 1,
            };

            $ins_id = await CountryModel.updateDetails(
                { id: country_id },
                insdata
            );
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "Country",
            };
            let headers = req.headers;
            admin_activity_logger
                .delete(module_and_user, country_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("Phone number country deleted successfully")
                    );
                })
                .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};
module.exports = country;
