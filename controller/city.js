const CityModel = require("../models/city");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require('../utilities/logmanager/winston');

var city = {
    add: async (req, res) => {
        let added_date = await date_formatter.created_date_time();
        let country_id = enc_dec.cjs_decrypt(req.bodyString("country_id"));
        let state_id = enc_dec.cjs_decrypt(req.bodyString("state_id"));
        let city_name = req.bodyString("city_name");

        let ins_body = {
            city_name: city_name,
            ref_state: state_id,
            ref_country: country_id,
            updated_at: added_date,
            ip: await helpers.get_ip(req),
        };
        CityModel.add(ins_body)
            .then((result) => {
                let module_and_user = {
                    user: req.user.id,
                    admin_type: req.user.type,
                    module: "Locations",
                    sub_module: "City",
                };
                let added_name = req.bodyString("city_name");
                let headers = req.headers;
                admin_activity_logger
                    .add(module_and_user, added_name, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successmsg("City added successfully.")
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
    list: async (req, res) => {
        let limit;
        if (req.bodyString("state_id")) {
            limit = {
                perpage: 0,
                page: 0,
            };
        } else {
            limit = {
                perpage: 0,
                page: 0,
                // perpage: 10,
                // page: 1,
            };
        }
        const country = await helpers.get_country_id_by_name(
            req.bodyString("country_name")
        );
        const state = await helpers.get_state_id_by_name(
            req.bodyString("state_name")
        );
        if (req.bodyString("perpage") && req.bodyString("page")) {
            perpage = parseInt(req.bodyString("perpage"));
            start = parseInt(req.bodyString("page"));

            limit.perpage = perpage;
            limit.start = (start - 1) * perpage;
        }

        let search_obj = {};
        search_obj.deleted = 0;
        if (req.bodyString("country_id")) {
            in_country_id = enc_dec.cjs_decrypt(req.bodyString("country_id"));
            search_obj.ref_country = in_country_id;
        }

        if (req.bodyString("state_id")) {
            in_state_id = enc_dec.cjs_decrypt(req.bodyString("state_id"));
            search_obj.ref_state = in_state_id;
        }

        if (req.bodyString("status") == "Active") {
            search_obj.status = 0;
        }
        if (req.bodyString("status") == "Deactivated") {
            search_obj.status = 1;
        }

        if (req.bodyString("country_name")) {
            search_obj.ref_country = country;
        }

        if (req.bodyString("state_name")) {
            search_obj.ref_state = state;
        }
        let search_city = { city_name: "" };
        if (req.bodyString("city_name")) {
            search_city.city_name = req.bodyString("city_name");
        }
        CityModel.select(search_obj, search_city, limit)
            .then(async (result) => {
                let send_res = [];
                
                
                let country_ids = await helpers.keyByArr(result, 'ref_country');
                let state_ids = await helpers.keyByArr(result, 'ref_state');
                let all_country = await helpers.get_country_name_by_ids(country_ids);
                let all_state = await helpers.get_state_name_by_ids(state_ids);
             
                   
                for (let val of result) {
                    let res = {
                        country_id: enc_dec.cjs_encrypt(val.ref_country),
                        country_name: all_country[val.ref_country],
                        state_id: enc_dec.cjs_encrypt(val.ref_state),
                        state_name: all_state[val.ref_state],
                        city_id: enc_dec.cjs_encrypt(val.id),
                        city_name: val.city_name,
                        status: val.status == 1 ? "Deactivated" : "Active",
                    };
                    send_res.push(res);
                }
                total_count = await CityModel.get_count(
                    search_obj,
                    search_city
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
        let city_id = await enc_dec.cjs_decrypt(req.bodyString("city_id"));
        CityModel.selectOne("*", { id: city_id, deleted: 0 })
            .then(async (result) => {
                let send_res = [];
                let val = result;
                let res1 = {
                    country_id: enc_dec.cjs_encrypt(val.ref_country),
                    country_name: await helpers.get_country_name_by_id(
                        val.ref_country
                    ),
                    state_id: enc_dec.cjs_encrypt(val.ref_state),
                    state_name: await helpers.get_state_name_by_id(
                        val.ref_state
                    ),
                    city_id: enc_dec.cjs_encrypt(val.id),
                    city_name: val.city_name,
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
                winston.error(error);
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
    update: async (req, res) => {
        try {
            let state_id = await enc_dec.cjs_decrypt(
                req.bodyString("state_id")
            );
            let country_id = await enc_dec.cjs_decrypt(
                req.bodyString("country_id")
            );
            let city_id = await enc_dec.cjs_decrypt(req.bodyString("city_id"));
            let city_name = req.bodyString("city_name");

            var insdata = {
                city_name: city_name,
                ref_country: country_id,
                ref_state: state_id,
            };

            $ins_id = await CityModel.updateDetails({ id: city_id }, insdata);

            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "City",
            };
            let headers = req.headers;
            admin_activity_logger
                .edit(module_and_user, city_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("City updated successfully")
                    );
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    deactivate: async (req, res) => {
        try {
            let city_id = await enc_dec.cjs_decrypt(req.bodyString("city_id"));
            var insdata = {
                status: 1,
            };

            $ins_id = await CityModel.updateDetails({ id: city_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "City",
            };
            let headers = req.headers;
            admin_activity_logger
                .deactivate(module_and_user, city_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("City deactivated successfully")
                    );
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    activate: async (req, res) => {
        try {
            let city_id = await enc_dec.cjs_decrypt(req.bodyString("city_id"));
            var insdata = {
                status: 0,
            };

            $ins_id = await CityModel.updateDetails({ id: city_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "City",
            };
            let headers = req.headers;
            admin_activity_logger
                .activate(module_and_user, city_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("City activated successfully")
                    );
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
    delete: async (req, res) => {
        try {
            let city_id = await enc_dec.cjs_decrypt(req.bodyString("city_id"));
            var insdata = {
                deleted: 1,
            };

            $ins_id = await CityModel.updateDetails({ id: city_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Locations",
                sub_module: "City",
            };
            let headers = req.headers;
            admin_activity_logger
                .delete(module_and_user, city_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("City deleted successfully")
                    );
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};
module.exports = city;
