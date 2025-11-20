const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const AdminModel = require("../models/adm_user");
const protector = require("../utilities/decryptor/decryptor");
const helpers = require("../utilities/helper/general_helper");
const PspModel = require("../models/psp");
require("dotenv").config({ path: "../.env" });
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const checkifrecordexist = require("../utilities/validations/checkifrecordexist");
const moment = require("moment");
const pricing_model = require("../models/pricing_plan");
const date_formatter = require("../utilities/date_formatter/index");
const setUpCharges = require("../utilities/charges/setup-charges/index");
require("dotenv").config({ path: "../.env" });
const logger = require('../config/logger');

var Psp = {
    getMccCodes: async (req, res) => {
        let mcc_codes = await PspModel.selectAll("*", { deleted: 0 });
        let send_res = [];
        for (let val of mcc_codes) {
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                mcc: val.mcc,
                description: val.description,
                classification: val.classification,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    add: async (req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let mcc_codes = req.bodyString("mcc").split(",");
        let mcc_code_array = [];
        let country_id = await enc_dec.cjs_decrypt(
            req.bodyString("country_id")
        );
        for (val of mcc_codes) {
            mcc_code_array.push(enc_dec.cjs_decrypt(val));
        }

        let psp_data = {
            country: country_id,
            name: req.bodyString("name"),
            email_to: req.bodyString("email_to"),
            cc: req.bodyString("cc"),
            min_revenue: req.bodyString("min_revenue"),
            min_bps: req.bodyString("min_bps"),
            mcc: mcc_code_array.join(","),
            ekyc_required: req.bodyString("ekyc_required"),
            threshold_value: req.bodyString("threshold_value"),
            payment_methods: req.bodyString("payment_methods"),
            payment_schemes: req.bodyString("payment_schemes"),
            transaction_allowed_daily: req.bodyString(
                "transaction_allowed_daily"
            ),
            deleted: 0,
            status: 0,
            added_date: added_date,
        };
        if (req.bodyString("remark")) {
            psp_data.remark = req.bodyString("remark");
        }
        if (req.bodyString("files")) {
            psp_data.files = req.bodyString("files");
        }

        

        PspModel.add(psp_data)
            .then((result) => {
                let module_and_user = {
                    user: req.user?.id,
                    admin_type: req.user?.type,
                    module: "Databank",
                    sub_module: "PSP",
                };
                let added_name = req.bodyString("name");
                let headers = req.headers;
                admin_activity_logger
                    .add(module_and_user, added_name, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successmsg("PSP added successfully")
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
                    response.errormsg(error)
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
        let all_and_cond = {
            deleted: 0,
        };
        if (req.bodyString("status") == "Active") {
            all_and_cond.status = 0;
        }
        if (req.bodyString("status") == "Deactivated") {
            all_and_cond.status = 1;
        }

        let and_in_set = {};
        let like_search = {};

        if (req.bodyString("search")) {
            like_search.email_to = req.bodyString("search");
            like_search.name = req.bodyString("search");
        }
        if (req.bodyString("mcc_codes")) {
            and_in_set.mcc = enc_dec.cjs_decrypt(req.bodyString("mcc_codes"));
        }
        
        let result = await PspModel.select(
            "id,credentials_key,country,name,email_to,cc,ekyc_required,threshold_value,status,mcc,files,payment_methods,payment_schemes,transaction_allowed_daily,min_bps,min_revenue,added_date as created_at",
            limit,
            all_and_cond,
            and_in_set,
            like_search
        );
        let send_res = [];
        for (let val of result) {
            let res = {
                psp_id: enc_dec.cjs_encrypt(val.id),
                credentials_key:val.credentials_key,
                country: val?.country
                    ? await helpers.get_country_name_by_id(val?.country)
                    : "",
                country_id: val?.country
                    ? await enc_dec.cjs_encrypt(val?.country)
                    : "",
                name: val.name,
                psp_name: val.name,
                email_to: val.email_to,
                cc: val.cc,
                mcc: await PspModel.getEncMCC(val.mcc),
                mcc_name: await PspModel.getMccName(val.mcc),
                files: process.env.STATIC_URL + "/static/images/" + val.files,
                ekyc_required: val.ekyc_required,
                threshold_value: val.threshold_value,
                status: val.status == 1 ? "Deactivated" : "Active",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                transaction_allowed_daily: val?.transaction_allowed_daily
                    ? val?.transaction_allowed_daily
                    : "",
                min_revenue: val.min_revenue.toFixed(2),
                min_bps: val.min_bps,
                created_at:moment(val.created_at).format('YYYY-MM-DD HH:mm')
            };
            send_res.push(res);
        }
        let total_count = await PspModel.get_count(
            all_and_cond,
            and_in_set,
            like_search
        );
        res.status(statusCode.ok).send(
            response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
            )
        );
    },

    // list_salerate: async (req, res) => {
    //     let and_conditions = {
    //         merchant_id: req.user.id,
    //         submerchant_id: enc_dec.cjs_decrypt(
    //             req.bodyString("submerchant_id")
    //         ),
    //         psp: req.bodyString("psp"),
    //         deleted: 0,
    //     };
    //     let result = await PspModel.list_salerate("*", and_conditions);
    //     let send_res = [];
    //     for (let val of result) {
    //         
    //         let res = {
    //             id: enc_dec.cjs_encrypt(val.id),
    //             merchant_id: val.merchant_id
    //                 ? enc_dec.cjs_encrypt(val.merchant_id)
    //                 : "",
    //             submerchant_id: val.submerchant_id
    //                 ? enc_dec.cjs_encrypt(val.submerchant_id)
    //                 : "",
    //             psp: val?.psp ? val?.psp : "",
    //             mid: val?.mid ? val?.mid : "",
    //             dom_int: val?.dom_int ? val?.dom_int : "",
    //             payment_methods: val?.payment_methods
    //                 ? val?.payment_methods
    //                 : "",
    //             payment_schemes: val?.payment_schemes
    //                 ? val?.payment_schemes
    //                 : "",
    //             currency: val?.currency ? val?.currency : "",
    //             salerate_fix: val?.salerate_fix ? val?.salerate_fix : 0,
    //             salerate_per: val?.salerate_per ? val?.salerate_per : 0,
    //             tax: val?.tax ? val?.tax : 0,
    //         };
    //         send_res.push(res);
    //     }
    //     res.status(statusCode.ok).send(
    //         response.successdatamsg(send_res, "List fetched successfully.")
    //     );
    // },

    // delete_salerate: async (req, res) => {
    //     try {
    //         const id = enc_dec.cjs_decrypt(req.bodyString("id"));
    //         let userData = { deleted: 1 };

    //         await PspModel.update_salerate_details({ id: id }, userData);

    //         return res
    //             .status(statusCode.ok)
    //             .send(response.successmsg("Sale rate deleted successfully"));
    //     } catch (error) {
    
    //         res.status(statusCode.internalError).send(response.errormsg(error));
    //     }
    // },

    get: async (req, res) => {
        let psp_id = await enc_dec.cjs_decrypt(req.bodyString("psp_id"));
        PspModel.selectOne(
            "id,credentials_key,country,name,email_to,cc,ekyc_required,threshold_value,status,mcc,files,remark,payment_methods,payment_schemes,transaction_allowed_daily,min_bps,min_revenue,domestic,international,mcc_category,supported_scheme,supported_methods,added_date as created_at",
            { id: psp_id }
        )
            .then(async (result) => {

                let send_res = [];
                let val = result;
                let res1 = {
                    credentials_key:val.credentials_key,
                    psp_id: enc_dec.cjs_encrypt(val.id),
                    country_id: val?.country
                        ? await enc_dec.cjs_encrypt(val?.country)
                        : "",
                    country_name: val?.country
                        ? await helpers.get_country_name_by_id(val?.country)
                        : "",
                    name: val.name,
                    email_to: val.email_to,
                    cc: val.cc,
                    min_revenue: val.min_revenue.toFixed(2),
                    min_bps: val.min_bps,
                    ekyc_required: val.ekyc_required,
                    domestic: val.domestic,
                    international: val.international,
                    mcc: await PspModel.getEncMCC(val.mcc),
                    mcc_name: await PspModel.getMccName(val.mcc),
                    mcc_category: await PspModel.getEncMCC(val.mcc_category),
                    files:
                        process.env.STATIC_URL + "/static/images/" + val.files,
                    remark: val.remark,
                    file_name: val.files,
                    threshold_value: val.threshold_value,
                    status: val.status == 1 ? "Deactivated" : "Active",
                    transaction_allowed_daily: val?.transaction_allowed_daily
                        ? val?.transaction_allowed_daily
                        : "",
                    payment_methods: val?.payment_methods
                        ? val?.payment_methods
                        : "",
                    payment_schemes: val?.payment_schemes
                        ? val?.payment_schemes
                        : "",
                    supported_methods: val?.supported_methods,
                    supported_scheme: val?.supported_scheme,
                    created_at:moment(val.created_at).format('YYYY-MM-DD HH:ii')
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
            let psp_id = enc_dec.cjs_decrypt(req.bodyString("psp_id"));
            let mcc_codes = req.bodyString("mcc").split(",");
            let mcc_code_array = [];
            for (val of mcc_codes) {
                mcc_code_array.push(enc_dec.cjs_decrypt(val));
            }
            let mcc_category = req.bodyString("mcc_category").split(",");
            let mcc_category_array = [];
            for (val of mcc_category) {
                mcc_category_array.push(enc_dec.cjs_decrypt(val));
            }
            let psp_data = {
                name: req.bodyString("name"),
                email_to: req.bodyString("email_to"),
                cc: req.bodyString("cc"),
                min_revenue: req.bodyString("min_revenue"),
                min_bps: req.bodyString("min_bps"),
                ekyc_required: req.bodyString("ekyc_required"),
                domestic: req.bodyString("domestic"),
                international: req.bodyString("international"),
                mcc: mcc_code_array.join(","),
                mcc_category: mcc_category_array.join(","),
                threshold_value: req.bodyString("threshold_value"),
                transaction_allowed_daily: req.bodyString(
                    "transaction_allowed_daily"
                ),
            };
            if (req.bodyString("remark")) {
                psp_data.remark = req.bodyString("remark");
            }
            if (req.bodyString("files")) {
                psp_data.files = req.bodyString("files");
            }
            if (req.bodyString("payment_methods")) {
                psp_data.payment_methods = req.bodyString("payment_methods");
            }
            if (req.bodyString("payment_schemes")) {
                psp_data.payment_schemes = req.bodyString("payment_schemes");
            }
            if (req.bodyString("country")) {
                psp_data.country = await enc_dec.cjs_decrypt(
                    req.bodyString("country")
                );
            }
            $ins_id = await PspModel.updateDetails({ id: psp_id }, psp_data);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Databank",
                sub_module: "PSP",
            };
            let headers = req.headers;
            admin_activity_logger
                .edit(module_and_user, psp_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("PSP updated successfully")
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

    deactivate: async (req, res) => {
        try {
            let psp_id = await enc_dec.cjs_decrypt(req.bodyString("psp_id"));

            let psp_data = {
                status: 1,
            };
            $ins_id = await PspModel.updateDetails({ id: psp_id }, psp_data);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Databank",
                sub_module: "PSP",
            };
            let headers = req.headers;
            admin_activity_logger
                .deactivate(module_and_user, psp_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("PSP deactivated successfully")
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

    activate: async (req, res) => {
        try {
            let psp_id = await enc_dec.cjs_decrypt(req.bodyString("psp_id"));

            let psp_data = {
                status: 0,
            };
            $ins_id = await PspModel.updateDetails({ id: psp_id }, psp_data);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Databank",
                sub_module: "PSP",
            };
            let headers = req.headers;
            admin_activity_logger
                .activate(module_and_user, psp_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("PSP activated successfully")
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

    delete: async (req, res) => {
        try {
            let psp_id = await enc_dec.cjs_decrypt(req.bodyString("psp_id"));

            let psp_data = {
                deleted: 1,
            };
            $ins_id = await PspModel.updateDetails({ id: psp_id }, psp_data);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: "Users",
                sub_module: "Designation",
            };
            let headers = req.headers;
            admin_activity_logger
                .delete(module_and_user, psp_id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg("PSP deleted successfully")
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

    // buy rate
    create_psp_buyrate: async (req, res) => {
        try {
            let master_data = req.body.master_data;
            let ins_data = req.body.buy_rates;
            let promo_data = req.body.promo_buy_rates;
            var fault = 0;
            var pass = 0;
            let master_psp_entry;
            let master_buyrate;
            let mcc_cate = master_data.mcc_category.split(",");
            let mcc_code_array = [];
            for (val of mcc_cate) {
                mcc_code_array.push(enc_dec.cjs_decrypt(val));
            }
            
            //master data
            master_data.psp = await enc_dec.cjs_decrypt(master_data.psp);
            master_data.mcc_category = mcc_code_array.join(",");
            master_data.country_id = await enc_dec.cjs_decrypt(master_data.country);
            const country_name = await helpers.get_country_name_by_id(master_data.country_id);
            master_data.country_name = country_name
            delete master_data.country;
            if (master_data.id) {
                master_data.id = await enc_dec.cjs_decrypt(master_data.id);
                master_psp_entry = await PspModel.update_master_buyrate_details(
                    {
                        id: master_data.id,
                    },
                    master_data
                );
                master_buyrate = master_data.id;
            } else {
                master_psp_entry = await await PspModel.add_master_buy_rate(
                    master_data
                );
                master_buyrate = master_psp_entry.insert_id;
            }

            

            if (ins_data.length > 0) {
                for (let val of ins_data) {
                    
                    if (val.id) {
                        val.id = await enc_dec.cjs_decrypt(val.id);
                        await PspModel.update_buyrate_details(
                            {
                                id: val.id,
                            },
                            val,
                            "psp_buyrate"
                        )
                            .then((result) => {
                                pass++;

                            })
                            .catch((error) => {
                               logger.error(500,{message: error,stack: error.stack}); 
                                fault++;
                                
                            });
                    } else {
                        val.master_buyrate_id = master_buyrate;
                        await PspModel.add_buyrate(val)
                            .then((result) => {
                                pass++;

                            })
                            .catch((error) => {
                               logger.error(500,{message: error,stack: error.stack}); 
                                fault++;
                                
                            });
                    }
                }
            }

            if (master_data.promo_period_start) {
                if (promo_data.length > 0) {
                    for (let item of promo_data) {
                        if (item.id) {
                            item.id = await enc_dec.cjs_decrypt(item.id);
                            await PspModel.update_promo_buyrate_details(
                                {
                                    id: item.id,
                                },
                                item
                            )
                                .then((result) => {
                                    pass++;

                                })
                                .catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    fault++;
                                    
                                });
                        } else {
                            item.master_buyrate_id = master_buyrate;
                            await PspModel.add_promo_buyrate(item)
                                .then((result) => {
                                    pass++;

                                })
                                .catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    fault++;
                                    
                                });
                        }
                    }
                }
            }

            if (fault > 0) {
                res.status(statusCode.ok).send({
                    status: false,
                    message: `Failed to add ${fault} entries and passed ${pass} entries.`,
                });
            } else {
                res.status(statusCode.ok).send({
                    status: "success",
                    message: "PSP buy-rate added successfully",
                });
            }
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_buyrate_list: async (req, res) => {
        try {
            let and_conditions = { deleted: 0 };
            let like_condition = {};
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

            if (req.bodyString("psp")) {
                and_conditions.psp = await enc_dec.cjs_decrypt(
                    req.bodyString("psp")
                );
            }
            if (req.bodyString("currency")) {
                like_condition.currency = req.bodyString("currency");
            }

            let result = await PspModel.master_buyrate_list(
                limit,
                "*",
                and_conditions,
                like_condition,
                "master_buyrate"
            );
            let send_res = [];
            for (let val of result) {
                
                let res = {
                    master_buyrate_id: enc_dec.cjs_encrypt(val.id),
                    psp: val?.psp ? enc_dec.cjs_encrypt(val?.psp) : "",
                    psp_name: await helpers.get_psp_name_by_id(val?.psp),
                    setup_fees: val?.setup_fees ? val?.setup_fees : 0.0,
                    mid_active_fees: val?.mid_active_fees
                        ? val?.mid_active_fees
                        : 0.0,
                    refund_fees_per: val?.refund_fees_per
                        ? val?.refund_fees_per
                        : 0.0,
                    refund_fees_fix: val?.refund_fees_fix
                        ? val?.refund_fees_fix
                        : 0.0,
                    charge_back_fees_per: val?.charge_back_fees_per
                        ? val?.charge_back_fees_per
                        : 0.0,
                    charge_back_fees_fix: val?.charge_back_fees_fix
                        ? val?.charge_back_fees_fix
                        : 0.0,
                    currency: val?.currency ? val?.currency : "",
                    promo_period_start:
                        val?.promo_period_start === "0000-00-00"
                            ? ""
                            : await date_formatter.get_date(val?.promo_period_start),
                    promo_period_end:
                        val?.promo_period_end === "0000-00-00"
                            ? ""
                            : await date_formatter.get_date(val?.promo_period_end),
                    // promo_period_start: val?.promo_period_start
                    //     ? val?.promo_period_start
                    //     : "",
                    // promo_period_end: val?.promo_period_end
                    //     ? val?.promo_period_end
                    //     : "",
                    mcc_category: await PspModel.getEncMCC(val.mcc_category),
                    mcc_category_name: val.mcc_category?await PspModel.get_mcc_cat_name(val.mcc_category):'',
                    account_fee: val?.account_fee ? val?.account_fee : "",
                };
                send_res.push(res);
            }
            let total = await PspModel.total_count(
                and_conditions,
                "master_buyrate",
                like_condition
            );
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "List fetched successfully.",
                    total
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_buyrate_delete: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("master_buyrate_id"));

            let userData = { deleted: 1 };

            await pricing_model.remove_master_buyrate(id);

            await pricing_model.updateDetails(
                {
                    master_buyrate_id: id,
                },
                userData,
                "psp_buyrate"
            );

            await pricing_model.updateDetails(
                {
                    master_buyrate_id: id,
                },
                userData,
                "psp_promo_buyrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Buyrate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    master_buyrate_details: async (req, res) => {
        try {
            let limit = {
                perpage: 0,
                page: 0,
            };
            let and_conditions = {
                id: await enc_dec.cjs_decrypt(
                    req.bodyString("master_buyrate_id")
                ),
            };
            let like_condition = {};
            let result = await PspModel.master_buyrate(
                limit,
                "*",
                and_conditions,
                like_condition,
                "master_buyrate"
            );
            let send_res = [];
            for (let val of result) {
                let res = {
                    master_buyrate_id: enc_dec.cjs_encrypt(val.id),
                    psp: val?.psp ? enc_dec.cjs_encrypt(val?.psp) : "",
                    psp_name: await helpers.get_psp_name_by_id(val?.psp),
                    currency: val?.currency ? val?.currency : "",
                    country_name: val?.country_name ? val?.country_name : "",
                    country_id: val?.country_id ? enc_dec.cjs_encrypt(val?.country_id) : "",
                    setup_fees: val?.setup_fees ? val?.setup_fees : 0.0,
                    account_fee: val?.account_fee ? val?.account_fee : 0,
                    account_fee_type: val?.account_fee_type ? val?.account_fee_type : "",
                    mid_active_fees: val?.mid_active_fees
                        ? val?.mid_active_fees
                        : 0.0,
                    refund_fees_per: val?.refund_fees_per
                        ? val?.refund_fees_per
                        : 0.0,
                    refund_fees_fix: val?.refund_fees_fix
                        ? val?.refund_fees_fix
                        : 0.0,
                    charge_back_fees_per: val?.charge_back_fees_per
                        ? val?.charge_back_fees_per
                        : 0.0,
                    charge_back_fees_fix: val?.charge_back_fees_fix
                        ? val?.charge_back_fees_fix
                        : 0.0,
                    promo_period_start:
                        val?.promo_period_start === "0000-00-00"
                            ? ""
                            :  await date_formatter.get_date(val?.promo_period_start),
                    promo_period_end:
                        val?.promo_period_end === "0000-00-00"
                            ? ""
                            :  await date_formatter.get_date(val?.promo_period_end),
                            mcc_category: await PspModel.getEncMCC(val.mcc_category),
                            mcc_category_name: val.mcc_category?await PspModel.get_mcc_cat_name(val.mcc_category):'',
                    // promo_period_start: val?.promo_period_start
                    //     ? val?.promo_period_start
                    //     : "",
                    // promo_period_end: val?.promo_period_end
                    //     ? val?.promo_period_end
                    //     : "",
                };
                send_res.push(res);
            }
            res.status(statusCode.ok).send(
                response.successdatamsg(send_res, "List fetched successfully.")
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    psp_buyrate_list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        };
        let and_conditions = {
            master_buyrate_id: await enc_dec.cjs_decrypt(
                req.bodyString("master_buyrate_id")
            ),
            deleted: 0,
        };
        let like_condition = {};
        let result = await PspModel.master_buyrate(
            limit,
            "*",
            and_conditions,
            like_condition,
            "psp_buyrate"
        );
        let send_res = [];
        for (let val of result) {
            
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_buyrate_id: enc_dec.cjs_encrypt(val.master_buyrate_id),
                dom_int: val?.dom_int ? val?.dom_int : "",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                currency: val?.currency ? val?.currency : "",
                buy_rate_fix: val?.buy_rate_fix ? val?.buy_rate_fix : 0,
                buy_rate_per: val?.buy_rate_per ? val?.buy_rate_per : 0,
                tax: val?.tax ? val?.tax : 0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    psp_promo_buyrate_list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        };
        let and_conditions = {
            master_buyrate_id: await enc_dec.cjs_decrypt(
                req.bodyString("master_buyrate_id")
            ),
            deleted: 0,
        };
        let like_condition = {};
        let result = await PspModel.master_buyrate(
            limit,
            "*",
            and_conditions,
            like_condition,
            "psp_promo_buyrate"
        );
        let send_res = [];
        for (let val of result) {
            
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_buyrate_id: enc_dec.cjs_encrypt(val.master_buyrate_id),
                dom_int: val?.dom_int ? val?.dom_int : "",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                currency: val?.currency ? val?.currency : "",
                promo_buy_rate_fix: val?.promo_buy_rate_fix
                    ? val?.promo_buy_rate_fix
                    : 0,
                promo_buy_rate_per: val?.promo_buy_rate_per
                    ? val?.promo_buy_rate_per
                    : 0,
                promo_tax: val?.promo_tax ? val?.promo_tax : 0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    delete_buyrate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };

            await PspModel.update_buyrate_details(
                { id: id },
                userData,
                "psp_buyrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Buy rate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    delete_promo_buyrate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };
            await PspModel.update_buyrate_details(
                { id: id },
                userData,
                "psp_promo_buyrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Buy rate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    // sell rate
    create_mid_sellrate: async (req, res) => {
        
        try {
            let master_data = req.body.master_data;
            let regular_data = req.body.sell_rates;
            let promo_data = req.body.promo_sell_rates;
            var fault = 0;
            var pass = 0;
            let master_mid_entry;
            let master_sellrate;
            const mid = await enc_dec.cjs_decrypt(master_data.mid);
            const plan_id = await enc_dec.cjs_decrypt(master_data.plan_id);
            master_data.mid = mid;
            master_data.plan_id = plan_id;
            if (master_data.id) {
                master_data.id = await enc_dec.cjs_decrypt(master_data.id);
                master_mid_entry =
                    await PspModel.update_master_sellrate_details(
                        {
                            id: master_data.id,
                        },
                        master_data
                    );
                master_sellrate = master_data.id;
            } else {
                master_mid_entry = await PspModel.add_master_sell_rate(
                    master_data
                );
                master_sellrate = master_mid_entry.insert_id;

                //add set up fee and mid set up fee
                setUpCharges({
                    mid
                    //   submerchant_id,
                    //   psp_id,
                    //   country_id,
                    //   terminal_id: _terminalid,
                });
            }

            if (regular_data.length > 0) {
                for (let val of regular_data) {
                    val.master_mid_sellrate_id = master_sellrate;
                    if (val.id) {
                        val.id = await enc_dec.cjs_decrypt(val.id);
                        await PspModel.update_buyrate_details(
                            {
                                id: val.id,
                            },
                            val,
                            "mid_sellrate"
                        )
                            .then((result) => {
                                pass++;

                            })
                            .catch((error) => {
                               logger.error(500,{message: error,stack: error.stack}); 
                                fault++;
                                
                            });
                    } else {
                        await PspModel.add_sellrate(val)
                            .then((result) => {
                                pass++;

                            })
                            .catch((error) => {
                               logger.error(500,{message: error,stack: error.stack}); 
                                fault++;
                                
                            });
                    }
                }
            }

            if (master_data.promo_period_start) {
                if (promo_data.length > 0) {
                    for (let item of promo_data) {
                        item.master_mid_sellrate_id = master_sellrate;
                        if (item.id) {
                            item.id = await enc_dec.cjs_decrypt(item.id);
                            await PspModel.update_promo_sellrate_details(
                                {
                                    id: item.id,
                                },
                                item
                            )
                                .then((result) => {
                                    pass++;

                                })
                                .catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    fault++;
                                    
                                });
                        } else {
                            await PspModel.add_promo_sellrate(item)
                                .then((result) => {
                                    pass++;

                                })
                                .catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    fault++;
                                    
                                });
                        }
                    }
                }
            }
            if (fault > 0) {
                res.status(statusCode.ok).send({
                    status: false,
                    message: `Failed to add ${fault} entries and passed ${pass} entries.`,
                });
            } else {
                res.status(statusCode.ok).send({
                    status: true,
                    message: "MID sellrate added successfully",
                });
            }
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_mid_sellrate_list: async (req, res) => {
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

            let and_conditions = { deleted: 0 };
            let like_condition = {};
            let result = await PspModel.master_buyrate(
                limit,
                "*",
                and_conditions,
                like_condition,
                "master_mid_sellrate"
            );
            let send_res = [];
            for (let val of result) {
                
                let res = {
                    master_mid_sellrate_id: await enc_dec.cjs_encrypt(val.id),
                    mid: val?.mid ? await enc_dec.cjs_encrypt(val?.mid) : "",
                    plan_id: val?.plan_id
                        ? await enc_dec.cjs_encrypt(val?.plan_id)
                        : "",
                    num_of_free_mid: val?.num_of_free_mid
                        ? val?.num_of_free_mid
                        : 0,
                    currency: val?.currency ? val?.currency : "",
                    setup_fees: val?.setup_fees ? val?.setup_fees : 0,
                    mid_active_fees: val?.mid_active_fees
                        ? val?.mid_active_fees
                        : 0,
                    refund_fees_per: val?.refund_fees_per
                        ? val?.refund_fees_per
                        : 0,
                    refund_fees_fix: val?.refund_fees_fix
                        ? val?.refund_fees_fix
                        : 0,
                    charge_back_fees_per: val?.charge_back_fees_per
                        ? val?.charge_back_fees_per
                        : 0,
                    charge_back_fees_fix: val?.charge_back_fees_fix
                        ? val?.charge_back_fees_fix
                        : 0,
                    promo_period_start:
                        val?.promo_period_start === "0000-00-00"
                            ? ""
                            : val?.promo_period_start,
                    promo_period_end:
                        val?.promo_period_end === "0000-00-00"
                            ? ""
                            : val?.promo_period_end,
                };
                send_res.push(res);
            }
            let total = await PspModel.total_count(
                and_conditions,
                "master_mid_sellrate",
                like_condition
            );
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "List fetched successfully.",
                    total
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_mid_sellrate_delete: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(
                req.bodyString("master_mid_sellrate_id")
            );

            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "master_mid_sellrate"
            );

            await pricing_model.updateDetails(
                {
                    master_mid_sellrate_id: id,
                },
                userData,
                "mid_sellrate"
            );

            await pricing_model.updateDetails(
                {
                    master_mid_sellrate_id: id,
                },
                userData,
                "mid_promo_sellrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Sellrate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    master_mid_sellrate_details: async (req, res) => {
        try {
            let limit = {
                perpage: 0,
                page: 0,
            };
            let and_conditions = {
                id: await enc_dec.cjs_decrypt(
                    req.bodyString("master_mid_sellrate_id")
                ),
            };
            let like_condition = {};
            let result = await PspModel.master_buyrate(
                limit,
                "*",
                and_conditions,
                like_condition,
                "master_mid_sellrate"
            );
            let send_res = [];
            for (let val of result) {
                
                let res = {
                    master_mid_sellrate_id: enc_dec.cjs_encrypt(val.id),
                    mid: val?.mid ? enc_dec.cjs_encrypt(val?.mid) : "",
                    plan_id: val?.plan_id
                        ? enc_dec.cjs_encrypt(val?.plan_id)
                        : "",
                    currency: val?.currency ? val?.currency : "",
                    num_of_free_mid: val?.num_of_free_mid
                        ? val?.num_of_free_mid
                        : 0,
                    //setup_fees: val?.setup_fees ? val?.setup_fees : 0,
                    mid_active_fees: val?.mid_active_fees
                        ? val?.mid_active_fees
                        : 0,
                    refund_fees_per: val?.refund_fees_per
                        ? val?.refund_fees_per
                        : 0,
                    refund_fees_fix: val?.refund_fees_fix
                        ? val?.refund_fees_fix
                        : 0,
                    charge_back_fees_per: val?.charge_back_fees_per
                        ? val?.charge_back_fees_per
                        : 0,
                    charge_back_fees_fix: val?.charge_back_fees_fix
                        ? val?.charge_back_fees_fix
                        : 0,
                    promo_period_start:
                        val?.promo_period_start === "0000-00-00"
                            ? ""
                            : val?.promo_period_start,
                    promo_period_end:
                        val?.promo_period_end === "0000-00-00"
                            ? ""
                            : val?.promo_period_end,
                };
                send_res.push(res);
            }
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Details fetched successfully."
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_mid_sellrate_details_all: async (req, res) => {
        try {
            let mid = await enc_dec.cjs_decrypt(req.bodyString("mid"));

            let master_id = await helpers.get_master_id_by_mid(
                { mid: mid },
                "master_mid_sellrate"
            );
            
            let sell_rates;
            let promo_sell_rates;
            let master_data;

            let master = await helpers.get_data_list(
                "*",
                "master_mid_sellrate",
                {
                    mid: mid,
                }
            );
            
            let master_arr = [];
            for (let item of master) {
                let temp = {
                    id: item?.id ? await enc_dec.cjs_encrypt(item?.id) : "",
                    mid: item?.mid ? await enc_dec.cjs_encrypt(item?.mid) : "",
                    plan_id: item?.plan_id
                        ? await enc_dec.cjs_encrypt(item?.plan_id)
                        : "",
                    currency: item?.currency ? item?.currency : "",
                    refund_fees_per: item?.refund_fees_per
                        ? item?.refund_fees_per
                        : 0,
                    refund_fees_fix: item?.refund_fees_fix
                        ? item?.refund_fees_fix
                        : 0,
                    mid_activation_fee: item?.mid_activation_fee
                        ? item?.mid_activation_fee
                        : 0,
                    num_of_free_mid: item?.num_of_free_mid
                        ? item?.num_of_free_mid
                        : 0,
                    charge_back_fees_per: item?.charge_back_fees_per
                        ? item?.charge_back_fees_per
                        : 0,
                    charge_back_fees_fix: item?.charge_back_fees_fix
                        ? item?.charge_back_fees_fix
                        : 0,
                    promo_period_start:
                        item?.promo_period_start === "0000-00-00"
                            ? ""
                            : item?.promo_period_start,
                    promo_period_end:
                        item?.promo_period_end === "0000-00-00"
                            ? ""
                            : item?.promo_period_end,
                    num_of_free_mid: item?.num_of_free_mid
                        ? item?.num_of_free_mid
                        : 0,
                    setup_fees: item?.setup_fees ? item?.setup_fees : 0,
                    mid_active_fees: item?.mid_active_fees
                        ? item?.mid_active_fees
                        : 0,
                };
                master_arr.push(temp);
            }
            master_data = master_arr;

            let data = await helpers.get_data_list("*", "mid_sellrate", {
                master_mid_sellrate_id: master_id, deleted: 0
            });
            
            let data_arr = [];
            for (let item of data) {
                let temp = {
                    id: item?.id ? await enc_dec.cjs_encrypt(item?.id) : "",
                    master_mid_sellrate_id: item?.master_mid_sellrate_id
                        ? await enc_dec.cjs_encrypt(
                            item?.master_mid_sellrate_id
                        )
                        : "",
                    dom_int: item?.dom_int ? item?.dom_int : "",
                    payment_methods: item?.payment_methods
                        ? item?.payment_methods
                        : "",
                    payment_schemes: item?.payment_schemes
                        ? item?.payment_schemes
                        : "",
                    currency: item?.currency ? item?.currency : "",
                    sell_rate_fix: item?.sell_rate_fix
                        ? item?.sell_rate_fix
                        : 0,
                    sell_rate_per: item?.sell_rate_per
                        ? item?.sell_rate_per
                        : 0,
                    paydart_rate_fix: item?.paydart_rate_fix
                        ? item?.paydart_rate_fix
                        : 0,
                    paydart_rate_per: item?.paydart_rate_per
                        ? item?.paydart_rate_per
                        : 0,
                    tax: item?.tax ? item?.tax : 0,
                };
                data_arr.push(temp);
            }
            sell_rates = data_arr;
            let promo_data = await helpers.get_data_list(
                "*",
                "mid_promo_sellrate",
                {
                    master_mid_sellrate_id: master_id, deleted: 0
                }
            );
            
            let promo_data_arr = [];
            for (let item of promo_data) {
                let temp = {
                    id: item?.id ? await enc_dec.cjs_encrypt(item?.id) : "",
                    master_mid_sellrate_id: item?.master_mid_sellrate_id
                        ? await enc_dec.cjs_encrypt(
                            item?.master_mid_sellrate_id
                        )
                        : "",
                    dom_int: item?.dom_int ? item?.dom_int : "",
                    payment_methods: item?.payment_methods
                        ? item?.payment_methods
                        : "",
                    payment_schemes: item?.payment_schemes
                        ? item?.payment_schemes
                        : "",
                    currency: item?.currency ? item?.currency : "",
                    promo_sell_rate_fix: item?.promo_sell_rate_fix
                        ? item?.promo_sell_rate_fix
                        : 0,
                    promo_sell_rate_per: item?.promo_sell_rate_per
                        ? item?.promo_sell_rate_per
                        : 0,
                    paydart_rate_fix: item?.paydart_rate_fix
                        ? item?.paydart_rate_fix
                        : 0,
                    paydart_rate_per: item?.paydart_rate_per
                        ? item?.paydart_rate_per
                        : 0,
                    promo_tax: item?.promo_tax ? item?.promo_tax : 0,
                };
                promo_data_arr.push(temp);
            }
            promo_sell_rates = promo_data_arr;
            let send_res = {
                master_data,
                sell_rates,
                promo_sell_rates,
            };
            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Details fetched successfully."
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    mid_sellrate_list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        };
        let and_conditions = {
            master_mid_sellrate_id: await enc_dec.cjs_decrypt(
                req.bodyString("master_mid_sellrate_id")
            ),
            deleted: 0,
        };
        let like_condition = {};
        let result = await PspModel.master_buyrate(
            limit,
            "*",
            and_conditions,
            like_condition,
            "mid_sellrate"
        );
        let send_res = [];
        for (let val of result) {
            
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_mid_sellrate_id: enc_dec.cjs_encrypt(
                    val.master_mid_sellrate_id
                ),
                dom_int: val?.dom_int ? val?.dom_int : "",
                currency: val?.currency ? val?.currency : "",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                sell_rate_fix: val?.sell_rate_fix ? val?.sell_rate_fix : 0.0,
                sell_rate_per: val?.sell_rate_per ? val?.sell_rate_per : 0.0,
                tax: val?.tax ? val?.tax : 0.0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    mid_promo_sellrate_list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        };
        let and_conditions = {
            master_mid_sellrate_id: await enc_dec.cjs_decrypt(
                req.bodyString("master_mid_sellrate_id")
            ),
            deleted: 0,
        };
        let like_condition = {};
        let result = await PspModel.master_buyrate(
            limit,
            "*",
            and_conditions,
            like_condition,
            "mid_promo_sellrate"
        );
        let send_res = [];
        for (let val of result) {
            
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_mid_sellrate_id: enc_dec.cjs_encrypt(
                    val.master_mid_sellrate_id
                ),
                dom_int: val?.dom_int ? val?.dom_int : "",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                currency: val?.currency ? val?.currency : "",
                promo_sell_rate_fix: val?.promo_sell_rate_fix
                    ? val?.promo_sell_rate_fix
                    : 0.0,
                promo_sell_rate_per: val?.promo_sell_rate_per
                    ? val?.promo_sell_rate_per
                    : 0.0,
                promo_tax: val?.promo_tax ? val?.promo_tax : 0.0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    delete_sellrate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };

            await PspModel.update_buyrate_details(
                { id: id },
                userData,
                "mid_sellrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Sellrate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    delete_promo_sellrate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };
            await PspModel.update_buyrate_details(
                { id: id },
                userData,
                "mid_promo_sellrate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Sellrate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    // master plan sell rate
    add_master_sellrate: async (req, res) => {
        try {
            let data = {
                plan_id : await enc_dec.cjs_decrypt(
                    req.bodyString("plan_id")
                ),
                submerchant_id : await enc_dec.cjs_decrypt(
                    req.bodyString("submerchant_id")
                ),
                setup_fee: req.bodyString("setup_fee") ?? 0,
                //mid_active_fee: req.bodyString("mid_active_fee") ?? 0,
                currency: req.bodyString("currency") ?? null,
                num_of_free_mid: req.bodyString("num_of_free_mid") ?? 0,
                buy_account_fee: req.bodyString("buy_account_fee") ?? 0,
                sell_account_fee: req.bodyString("sell_account_fee") ?? 0,
                buy_setup_fee: req.bodyString("buy_setup_fee") ?? 0,
                country_id: req.bodyString("country_id") ?? 0,
                sell_account_fee_type: req.bodyString("sell_account_fee_type") ?? 0,
                buy_account_fee_type: req.bodyString("buy_account_fee_type") ?? 0,

            };
            // if (req.bodyString("plan_id")) {
            //     data.plan_id = await enc_dec.cjs_decrypt(
            //         req.bodyString("plan_id")
            //     );
            // }
            // if (req.bodyString("submerchant_id")) {
            //     data.submerchant_id = await enc_dec.cjs_decrypt(
            //         req.bodyString("submerchant_id")
            //     );
            // }
            // if (req.bodyString("setup_fee")) {
            //     data.setup_fee = req.bodyString("setup_fee");
            // }
            // if (req.bodyString("mid_active_fee")) {
            //     data.mid_active_fee = req.bodyString("mid_active_fee");
            // }
            // if (req.bodyString("num_of_free_mid")) {
            //     data.num_of_free_mid = req.bodyString("num_of_free_mid");
            // }
            // if (req.bodyString("currency")) {
            //     data.currency = req.bodyString("currency");
            // }
            

            pricing_model
                .add(data, "master_subm_sellrate")
                .then(async (result) => {

                    let master_subm_sellrate_id = await enc_dec.cjs_encrypt(
                        result.insert_id
                    );
                    res.status(statusCode.ok).send({
                        status: "success",
                        message: "Plan sell rate added successfully",
                        master_subm_sellrate_id: master_subm_sellrate_id,
                    });
                })
                .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                    
                    res.status(statusCode.internalError).send(
                        response.errormsg(error)
                    );
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    master_sellrate_list: async (req, res) => {
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
        let condition = { deleted: 0 };

        await pricing_model
            .select_sellrate(limit, condition)
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let res = {
                        master_subm_sellrate_id: await enc_dec.cjs_encrypt(
                            val.id
                        ),
                        plan_id: val?.plan_id
                            ? await enc_dec.cjs_encrypt(val?.plan_id)
                            : "",
                        submerchant_id: val?.submerchant_id
                            ? await enc_dec.cjs_encrypt(val?.submerchant_id)
                            : "",
                        setup_fee: val?.setup_fee ? val?.setup_fee : 0.0,
                        mid_active_fee: val?.mid_active_fee
                            ? val?.mid_active_fee
                            : 0.0,
                        currency: val?.currency ? val?.currency : "",
                        // refund_fee_per: val?.refund_fee_per
                        //     ? val?.refund_fee_per
                        //     : 0.0,
                        // refund_fee_fix: val?.refund_fee_fix
                        //     ? val?.refund_fee_fix
                        //     : 0.0,
                        // chargeback_fee_per: val?.chargeback_fee_per
                        //     ? val?.chargeback_fee_per
                        //     : 0.0,
                        // chargeback_fee_fix: val?.chargeback_fee_fix
                        //     ? val?.chargeback_fee_fix
                        //     : 0.0,
                    };
                    send_res.push(res);
                }
                let total_count = await pricing_model.get_total_sellrate_count(
                    condition
                );
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "List fetched successfully.",
                        total_count
                    )
                );
            });
    },

    master_sellrate_details: async (req, res) => {
        let master_subm_sellrate_id = await enc_dec.cjs_decrypt(
            req.bodyString("master_subm_sellrate_id")
        );
        let condition = { id: master_subm_sellrate_id };

        await pricing_model
            .select_sellrate_detilas(condition)
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let temp = {
                        master_subm_sellrate_id: await enc_dec.cjs_encrypt(
                            val.id
                        ),
                        plan_id: val?.plan_id
                            ? await enc_dec.cjs_encrypt(val?.plan_id)
                            : "",
                        submerchant_id: val?.submerchant_id
                            ? await enc_dec.cjs_encrypt(val?.submerchant_id)
                            : "",
                        setup_fee: val?.setup_fee ? val?.setup_fee : 0.0,
                        mid_active_fee: val?.mid_active_fee
                            ? val?.mid_active_fee
                            : 0.0,
                        currency: val?.currency ? val?.currency : "",
                        num_of_free_mid: val?.num_of_free_mid
                            ? val?.num_of_free_mid
                            : 0,
                        // refund_fee_per: val?.refund_fee_per
                        //     ? val?.refund_fee_per
                        //     : 0.0,
                        // refund_fee_fix: val?.refund_fee_fix
                        //     ? val?.refund_fee_fix
                        //     : 0.0,
                        // chargeback_fee_per: val?.chargeback_fee_per
                        //     ? val?.chargeback_fee_per
                        //     : 0.0,
                        // chargeback_fee_fix: val?.chargeback_fee_fix
                        //     ? val?.chargeback_fee_fix
                        //     : 0.0,
                    };
                    send_res.push(temp);
                }

                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "Details fetched successfully."
                    )
                );
            });
    },

    master_sellrate_all_details: async (req, res) => {
        try {
            let submerchant_id = await enc_dec.cjs_decrypt(
                req.bodyString("submerchant_id")
            );

            let master_id = await helpers.get_master_id_by_mid(
                { submerchant_id: submerchant_id },
                "master_subm_sellrate"
            );
            

            let master_data;
            let sell_data;

            let master = await helpers.get_data_list(
                "*",
                "master_subm_sellrate",
                { submerchant_id: submerchant_id }
            );
            
            let master_arr = [];
            for (let item of master) {
                let temp = {
                    id: item?.id ? await enc_dec.cjs_encrypt(item?.id) : "",
                    plan_id: item?.plan_id
                        ? await enc_dec.cjs_encrypt(item?.plan_id)
                        : "",
                    submerchant_id: item?.submerchant_id
                        ? await enc_dec.cjs_encrypt(item?.submerchant_id)
                        : "",
                    currency: item?.currency ? item?.currency : "",
                    setup_fee: item?.setup_fee ? item?.setup_fee : 0,
                    mid_active_fee: item?.mid_active_fee
                        ? item?.mid_active_fee
                        : 0,
                    num_of_free_mid: item?.num_of_free_mid
                        ? item?.num_of_free_mid
                        : 0,
                    buy_account_fee: item?.buy_account_fee.toFixed(2) ?? 0,
                    buy_account_fee_type: item?.buy_account_fee_type ?? "",
                    buy_setup_fee: item?.buy_setup_fee.toFixed(2) ?? 0,
                    sell_account_fee: item?.sell_account_fee.toFixed(2) ?? 0,
                    sell_account_fee_type: item?.sell_account_fee_type ?? '',
                };
                master_arr.push(temp);
            }
            master_data = master_arr;

            let selldata = await helpers.get_data_list("*", "subm_sellrate", {
                master_subm_sellrate_id: master_id, deleted: 0
            });
            
            let selldata_arr = [];
            for (let val of selldata) {
                let temp = {
                    id: val?.id ? await enc_dec.cjs_encrypt(val?.id) : "",
                    master_subm_sellrate_id: val?.master_subm_sellrate_id
                        ? await enc_dec.cjs_encrypt(
                            val?.master_subm_sellrate_id
                        )
                        : "",
                    feature: val?.features ? val?.features : "",
                    sell_rate_per: val?.sell_rate_per ? val?.sell_rate_per : 0,
                    sell_rate_fix: val?.sell_rate_fix ? val?.sell_rate_fix : 0,
                    tax: val?.tax ? val?.tax : 0,
                    currency: val?.currency ? val?.currency : '',
                };
                selldata_arr.push(temp)
            }
            sell_data = selldata_arr;

            let send_res = {
                master_data,
                sell_data,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_res,
                    "Details fetched successfully."
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    master_sellrate_delete: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(
                req.bodyString("master_subm_sellrate_id")
            );

            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "master_subm_sellrate"
            );

            await pricing_model.updateDetails(
                {
                    master_subm_sellrate_id: id,
                },
                userData,
                "subm_sellrate"
            );

            return res
                .status(statusCode.ok)
                .send(
                    response.successmsg("Plan sellrate deleted successfully")
                );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    master_sellrate_update: async (req, res) => {
        try {
            let data = {
                plan_id: await enc_dec.cjs_decrypt(
                    req.bodyString("plan_id")
                ),
                submerchant_id: await enc_dec.cjs_decrypt(
                    req.bodyString("submerchant_id")
                ),
                setup_fee: req.bodyString("setup_fee") ?? 0,
                mid_active_fee: req.bodyString("mid_active_fee") ?? 0,
                num_of_free_mid: req.bodyString("num_of_free_mid") ?? 0,
                buy_account_fee: req.bodyString("buy_account_fee") ?? 0,
                sell_account_fee: req.bodyString("sell_account_fee") ?? 0,
                buy_setup_fee: req.bodyString("buy_setup_fee") ?? 0,
                country_id: req.bodyString("country_id") ?? 0,
                sell_account_fee_type: req.bodyString("sell_account_fee_type") ?? 0,
                buy_account_fee_type: req.bodyString("buy_account_fee_type") ?? 0,
                currency: req.bodyString("currency") ?? null,
            };
            const master_subm_sellrate_id = enc_dec.cjs_decrypt(
                req.bodyString("master_subm_sellrate_id")
            );

            // if (req.bodyString("plan_id")) {
            //     data.plan_id = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
            // }

            // if (req.bodyString("submerchant_id")) {
            //     data.submerchant_id = enc_dec.cjs_decrypt(
            //         req.bodyString("submerchant_id")
            //     );
            // }

            // if (req.bodyString("setup_fee")) {
            //     data.setup_fee = req.bodyString("setup_fee");
            // }

            // if (req.bodyString("mid_active_fee")) {
            //     data.mid_active_fee = req.bodyString("mid_active_fee");
            // }
            // if (req.bodyString("currency")) {
            //     data.currency = req.bodyString("currency");
            // }

            await pricing_model
                .updateDetails(
                    { id: master_subm_sellrate_id },
                    data,
                    "master_subm_sellrate"
                )
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg(
                            "Plan sell rate updated successfully"
                        )
                    );
                })
                .catch((error) => {
                   logger.error(500,{message: error,stack: error.stack}); 
                    
                });
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    // plan sell rate
    add_sellrate: async (req, res) => {
        try {
            let ins_data = req.body.data;
            var fault = 0;
            var pass = 0;
            for (let val of ins_data) {
                if (val.id) {
                    val.id = enc_dec.cjs_decrypt(val.id);
                    val.master_subm_sellrate_id = enc_dec.cjs_decrypt(
                        val.master_subm_sellrate_id
                    );

                    await pricing_model
                        .updateDetails(
                            {
                                id: val.id,
                            },
                            val,
                            "subm_sellrate"
                        )
                        .then((result) => {
                            pass++;

                        })
                        .catch((error) => {
                           logger.error(500,{message: error,stack: error.stack}); 
                            fault++;
                            
                        });
                } else {
                    val.master_subm_sellrate_id = enc_dec.cjs_decrypt(
                        val.master_subm_sellrate_id
                    );

                    pricing_model
                        .add(val, "subm_sellrate")
                        .then((result) => {

                            pass++;
                        })
                        .catch((error) => {
                           logger.error(500,{message: error,stack: error.stack}); 
                            
                            fault++;
                            // res.status(statusCode.internalError).send(
                            //     response.errormsg(error)
                            // );
                        });
                }
            }
            
            
            if (fault > 0) {
                res.status(statusCode.ok).send({
                    status: false,
                    message: `Failed to add ${fault} entries and passed ${pass} entries.`,
                });
            } else {
                res.status(statusCode.ok).send({
                    status: true,
                    message: "Plan sell rate added successfully",
                });
            }
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(
                response.errormsg("internal server error")
            );
        }
    },

    sellrate_list: async (req, res) => {
        let master_subm_sellrate_id = await enc_dec.cjs_decrypt(
            req.bodyString("master_subm_sellrate_id")
        );
        let and_conditions = {
            master_subm_sellrate_id: master_subm_sellrate_id,
            deleted: 0,
        };

        let result = await pricing_model.list_rates(
            "*",
            and_conditions,
            "subm_sellrate"
        );
        let send_res = [];
        for (let val of result) {
            
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_subm_sellrate_id: val?.master_subm_sellrate_id
                    ? await enc_dec.cjs_encrypt(val?.master_subm_sellrate_id)
                    : "",
                features: val?.features ? val?.features : "",
                feature_name: val?.features
                    ? await helpers.get_feature_name_by_id(val?.features)
                    : "",
                sell_rate_per: val?.sell_rate_per ? val?.sell_rate_per : 0.0,
                sell_rate_fix: val?.sell_rate_fix ? val?.sell_rate_fix : 0.0,
                tax: val?.tax ? val?.tax : 0.0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    sellrate_delete: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "subm_sellrate"
            );

            return res
                .status(statusCode.ok)
                .send(
                    response.successmsg("Plan sell rate deleted successfully")
                );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    psp_currency: async (req, res) => {
        try {
            const psp_id = await enc_dec.cjs_decrypt(
                req.bodyString("psp_id")
            );
            const currency_id = await pricing_model.get_currency_code(
                psp_id
            );
            
         
                let cur_ids=[];
                for (let psp_cur of currency_id){
                    cur_ids.push(psp_cur.currency);
                }
              
                var ins_id = await pricing_model.get_psp_buy_rate_currency(
                    await helpers.getStringJoin(cur_ids.toString())
                );
            let count=await pricing_model.get_psp_buy_rate_currency_count( await helpers.getStringJoin(cur_ids.toString()))
            const arrs = [].concat(ins_id);
            const noDuplicate = (arr) => [...new Set(arr)];
            const allIds = arrs.map((ele) => ele.currency);
            const ids = noDuplicate(allIds);

            var result = ids.map((id) =>
                arrs.reduce((self, item) => {
                    return item.currency === id ? { ...self, ...item } : self;
                }, {})
            );
            let send_res = [];
            for (let val of result) {
                let resp = {
                    code: val.code ? val.code : "",
                    currency: val.currency ? val.currency : "",
                };
                send_res.push(resp);
            }
            res.status(statusCode.ok).send(response.successdatamsg(send_res));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};
module.exports = Psp;
