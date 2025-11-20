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
const country = require("./country");
const logger = require('../config/logger');

require("dotenv").config({ path: "../.env" });

var pricing_plan = {
    // master plan
    add: async (req, res) => {
        const post_data = req.body;

        const country_id = await enc_dec.cjs_decrypt(post_data.country);
        const country_name = await helpers.get_country_name_by_id(enc_dec.cjs_decrypt(post_data.country));
        const psp = await enc_dec.cjs_decrypt(post_data.psp);

        let data = {
            plan_name: post_data.plan_name,
            currency: post_data.multi_currency,
            num_of_free_mid: post_data.num_of_free_mid,
            setup_fees: post_data.setup_fees,
            mid_active_fees: post_data.mid_active_fees,
            refund_fees_per: post_data.refund_fees_per,
            refund_fees_fix: post_data.refund_fees_fix,
            charge_back_fees_per: post_data.charge_back_fees_per,
            charge_back_fees_fix: post_data.charge_back_fees_fix,
            country_id: country_id,
            country_name: country_name,
            psp: psp,
            account_fee: post_data.account_fee,
            account_fee_type: post_data.account_fee_type,
            is_default: post_data.is_default,
        };
        // if (req.bodyString("plan_name")) {
        //     data.plan_name = req.bodyString("plan_name");
        // }
        // if (req.bodyString("multi_currency")) {
        //     data.currency = req.bodyString("multi_currency");
        // }
        // if (req.bodyString("num_of_free_mid")) {
        //     data.num_of_free_mid = req.bodyString("num_of_free_mid");
        // }
        // if (req.bodyString("setup_fees")) {
        //     data.setup_fees = req.bodyString("setup_fees");
        // }
        // if (req.bodyString("mid_active_fees")) {
        //     data.mid_active_fees = req.bodyString("mid_active_fees");
        // }
        // if (req.bodyString("refund_fees_per")) {
        //     data.refund_fees_per = req.bodyString("refund_fees_per");
        // }
        // if (req.bodyString("refund_fees_fix")) {
        //     data.refund_fees_fix = req.bodyString("refund_fees_fix");
        // }
        // if (req.bodyString("charge_back_fees_per")) {
        //     data.charge_back_fees_per = req.bodyString("charge_back_fees_per");
        // }
        // if (req.bodyString("charge_back_fees_fix")) {
        //     data.charge_back_fees_fix = req.bodyString("charge_back_fees_fix");
        // }
        // if (req.bodyString("country")) {
        //     data.country_id =  await enc_dec.cjs_decrypt(req.bodyString("country"));
        //     data.country_name =  await helpers.get_country_name_by_id(enc_dec.cjs_decrypt(req.bodyString("country")));
        // }
        // if (req.bodyString("psp")) {
        //     data.psp =  await enc_dec.cjs_decrypt(req.bodyString("psp"));
        // }
        pricing_model
            .add(data, "master_pricing_plan")
            .then(async (result) => {

                let master_pricing_plan_id = await enc_dec.cjs_encrypt(
                    result.insert_id
                );
                res.status(statusCode.ok).send({
                    status: "success",
                    message: "Pricing plan added successfully",
                    master_pricing_plan_id: master_pricing_plan_id,
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
        let condition = { deleted: 0 };
        let like_condition = {};

        if (req.bodyString("plan_name")) {
            condition.plan_name = req.bodyString("plan_name");
        }
        if (req.bodyString("currency")) {
            like_condition.currency = req.bodyString("currency");
        }
        if (req.bodyString("country_id")) {
            condition.country_id = req.bodyString("country_id");
        }
        if (req.bodyString("is_default")) {
            condition.is_default = req.bodyString("is_default");
        }

        await pricing_model
            .select_pricing_list(limit, condition, like_condition)
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let res = {
                        plan_id: await helpers.formatNumberEight(val.id),
                        master_pricing_plan_id: await enc_dec.cjs_encrypt(
                            val.id
                        ),
                        plan_name: val?.plan_name ? val?.plan_name : "",
                        multi_currency: val?.currency ? val?.currency : "",
                        num_of_free_mid: val?.num_of_free_mid
                            ? val?.num_of_free_mid
                            : "",
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
                        country_id: val?.country_id ? await enc_dec.cjs_encrypt(val.country_id) : "",
                        country_code: val?.country_name ? val.country_name : "",
                        psp_id: val?.psp ? await enc_dec.cjs_encrypt(val.psp) : "",
                        psp_name: val?.psp ? await helpers.get_psp_name_by_id(val.psp) : "",
                        is_default: val?.is_default,
                        created_at: val?.created_at,
                        updated_at: val?.updated_at,
                    };
                    send_res.push(res);
                }
                let total_count = await pricing_model.get_total_count(
                    condition,
                    like_condition
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

    update: async (req, res) => {
        try {

            const post_data = req.body;
            console.log("🚀 ~ update: ~ post_data:", post_data)

            const master_pricing_plan_id = await enc_dec.cjs_decrypt(
                post_data.master_pricing_plan_id
            );
            const country_id = await enc_dec.cjs_decrypt(post_data.country);
            const country_name = await helpers.get_country_name_by_id(country_id);
            const psp = await enc_dec.cjs_decrypt(post_data.psp);
            let data = {
                plan_name: post_data.plan_name,
                currency: post_data.multi_currency,
                num_of_free_mid: post_data.num_of_free_mid,
                setup_fees: post_data.setup_fees,
                mid_active_fees: post_data.mid_active_fees,
                refund_fees_per: post_data.refund_fees_per,
                refund_fees_fix: post_data.refund_fees_fix,
                charge_back_fees_per: post_data.charge_back_fees_per,
                charge_back_fees_fix: post_data.charge_back_fees_fix,
                country_id: country_id,
                country_name: country_name,
                psp: psp,
                account_fee: post_data.account_fee,
                account_fee_type: post_data.account_fee_type,
                is_default: post_data.is_default,
            };
            console.log("🚀 ~ update: ~ data:", data)

            // const master_pricing_plan_id = enc_dec.cjs_decrypt(
            //     req.bodyString("master_pricing_plan_id")
            // );

            // if (req.bodyString("plan_name")) {
            //     data.plan_name = req.bodyString("plan_name");
            // }

            // if (req.bodyString("multi_currency")) {
            //     data.currency = req.bodyString("multi_currency");
            // }
            // if (req.bodyString("num_of_free_mid")) {
            //     data.num_of_free_mid = req.bodyString("num_of_free_mid");
            // }
            // if (req.bodyString("setup_fees")) {
            //     data.setup_fees = req.bodyString("setup_fees");
            // }

            // if (req.bodyString("mid_active_fees")) {
            //     data.mid_active_fees = req.bodyString("mid_active_fees");
            // }

            // if (req.bodyString("refund_fees_per")) {
            //     data.refund_fees_per = req.bodyString("refund_fees_per");
            // }

            // if (req.bodyString("refund_fees_fix")) {
            //     data.refund_fees_fix = req.bodyString("refund_fees_fix");
            // }

            // if (req.bodyString("charge_back_fees_per")) {
            //     data.charge_back_fees_per = req.bodyString(
            //         "charge_back_fees_per"
            //     );
            // }

            // if (req.bodyString("charge_back_fees_fix")) {
            //     data.charge_back_fees_fix = req.bodyString(
            //         "charge_back_fees_fix"
            //     );
            // }
            // if (req.bodyString("country")) {
            //     data.country_id =  await enc_dec.cjs_decrypt(req.bodyString("country"));
            //     data.country_name =  await helpers.get_country_name_by_id(enc_dec.cjs_decrypt(req.bodyString("country")));
            // }
            // if (req.bodyString("psp")) {
            //     data.psp =  await enc_dec.cjs_decrypt(req.bodyString("psp"));
            // }
            await pricing_model
                .updateDetails(
                    { id: master_pricing_plan_id },
                    data,
                    "master_pricing_plan"
                )
                .then(async (result) => {
                    console.log("🚀 ~ .then ~ result:", result)
                    await pricing_model.removeTransactionCharges({ master_pricing_plan_id: master_pricing_plan_id });
                    res.status(statusCode.ok).send(
                        response.successmsg("Pricing plan updated successfully")
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

    plan_details: async (req, res) => {
        let master_pricing_plan_id = await enc_dec.cjs_decrypt(
            req.bodyString("master_pricing_plan_id")
        );
        let condition = { id: master_pricing_plan_id };

        await pricing_model.select_detilas(condition).then(async (result) => {
            let send_res = [];
            for (let val of result) {
                let temp = {
                    plan_id: await helpers.formatNumberEight(val.id),
                    master_pricing_plan_id: await enc_dec.cjs_encrypt(val.id),
                    plan_name: val?.plan_name ? val?.plan_name : "",
                    multi_currency: val?.currency ? val?.currency : "",
                    country_id: val?.country_id ? await enc_dec.cjs_encrypt(val.country_id) : "",
                    country_code: val?.country_name ? val.country_name : "",
                    psp_id: val?.psp ? await enc_dec.cjs_encrypt(val.psp) : "",
                    psp_name: val?.psp ? await helpers.get_psp_name_by_id(val.psp) : "",
                    is_default: val?.is_default ? val?.is_default : 0,
                    num_of_free_mid: val?.num_of_free_mid
                        ? val?.num_of_free_mid
                        : "",
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
                    account_fee: val?.account_fee
                        ? val?.account_fee
                        : '0.00',
                    account_fee_type: val?.account_fee_type
                        ? val?.account_fee_type
                        : '',
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

    delete: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(
                req.bodyString("master_pricing_plan_id")
            );

            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "master_pricing_plan"
            );

            await pricing_model.updateDetails(
                {
                    master_pricing_plan_id: id,
                },
                userData,
                "pricing_plan_txn_rate"
            );

            await pricing_model.updateDetails(
                {
                    master_pricing_plan_id: id,
                },
                userData,
                "pricing_plan_features_rate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Pricing plan deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    // trans rates
    add_trans: async (req, res) => {
        let ins_data = req.body.data;
        console.log("🚀 ~ add_trans: ~ ins_data:", ins_data)
        var fault = 0;
        var pass = 0;
        console.log(`here is the ins data`);
        console.log(ins_data);
        for (let val of ins_data) {
            let data = {};
            if (val.psp) {
                data.psp = enc_dec.cjs_decrypt(val.psp);
            }
            if (val.dom_int) {
                data.dom_int = val.dom_int;
            }
            if (val.payment_methods) {
                data.payment_methods = val.payment_methods;
            }
            if (val.payment_schemes) {
                data.payment_schemes = val.payment_schemes;
            }
            if (val.currency) {
                data.currency = val.currency;
            }
            if (val.sale_rate_fix) {
                data.sale_rate_fix = val.sale_rate_fix;
            }
            if (val.sale_rate_per) {
                data.sale_rate_per = val.sale_rate_per;
            }
            if (val.paydart_rate_fix) {
                data.paydart_rate_fix = val.paydart_rate_fix;
            }

            if (val.paydart_rate_per) {
                data.paydart_rate_per = val.paydart_rate_per;
            }
            if (val.tax) {
                data.tax = val.tax;
            }
            if(val.min_amount){
                data.min_amount=val.min_amount;
            }
              if(val.max_amount){
                data.max_amount=val.max_amount;
            }
            if (val.id) {
                data.id = enc_dec.cjs_decrypt(val.id);
                data.master_pricing_plan_id = enc_dec.cjs_decrypt(
                    val.master_pricing_plan_id
                );

                await pricing_model
                    .updateDetails(
                        {
                            id: enc_dec.cjs_decrypt(val.id),
                        },
                        data,
                        "pricing_plan_txn_rate"
                    )
                    .then((result) => {
                        pass++;

                    })
                    .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                        fault++;

                    });
            } else {
                data.master_pricing_plan_id = enc_dec.cjs_decrypt(
                    val.master_pricing_plan_id
                );
                pricing_model
                    .add(data, "pricing_plan_txn_rate")
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
                message: "Transaction rate added successfully",
            });
        }
    },

    list_trans_rate: async (req, res) => {
        let master_pricing_plan_id = await enc_dec.cjs_decrypt(
            req.bodyString("master_pricing_plan_id")
        );
        let and_conditions = {
            master_pricing_plan_id: master_pricing_plan_id,
            deleted: 0,
        };

        let result = await pricing_model.list_rates("id,master_pricing_plan_id,psp,currency,dom_int,GROUP_CONCAT(DISTINCT payment_methods) as payment_methods,GROUP_CONCAT(DISTINCT payment_schemes) as payment_schemes,sale_rate_fix,sale_rate_per,tax,paydart_rate_fix,deleted,created_at,paydart_rate_per,min_amount,max_amount",
            and_conditions,
            "pricing_plan_txn_rate"
        );
        let send_res = [];
        for (let val of result) {

            let master_pricing_plan_id = await enc_dec.cjs_decrypt(
              req.bodyString("master_pricing_plan_id")
            );
            let condition = { id: master_pricing_plan_id };

            let plan_result = await pricing_model.select_detilas(condition);
            for (let val of plan_result) {
                plan_result = {
                    plan_id: await helpers.formatNumberEight(val.id),
                    master_pricing_plan_id: await enc_dec.cjs_encrypt(val.id),
                    plan_name: val?.plan_name ? val?.plan_name : "",
                    is_default: val?.is_default ? val?.is_default : "",
                };
            }

            let all_and_cond = { deleted: 0, status: 0, id: val.psp };
            let psp_result = await PspModel.select( "id,name", 1, all_and_cond, {}, {} );
            // console.log("🚀 ~ list_trans_rate: ~ psp_result:", psp_result)
            let psp_name = "";
            if (psp_result && Array.isArray(psp_result) && psp_result?.length > 0) {
                psp_name = psp_result[0].name;
            }
            let payment_scheme_in_char = "";
            if(val?.payment_schemes){
                let payment_scheme_array = val?.payment_schemes.split(',');
                console.log(payment_scheme_array);
                let schemes_array = [];
                for(let scheme of payment_scheme_array){
                    let decrypted_scheme = enc_dec.cjs_decrypt(scheme);
                    let s = await pricing_model.selectOneDynamic('card_scheme',{id:decrypted_scheme},'card_scheme');
                    schemes_array.push(s);
                }
                payment_scheme_in_char = schemes_array.join(',');
            }
            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_pricing_plan_id: val?.master_pricing_plan_id
                ? await enc_dec.cjs_encrypt(val?.master_pricing_plan_id)
                : "",
                psp: enc_dec.cjs_encrypt(val.psp),
                psp_name: psp_name,
                dom_int: val?.dom_int ? val?.dom_int : "",
                payment_methods: val?.payment_methods
                    ? val?.payment_methods
                    : "",
                payment_schemes: val?.payment_schemes
                    ? val?.payment_schemes
                    : "",
                payment_scheme_chars:payment_scheme_in_char,   
                currency: val?.currency ? val?.currency : "",
                sale_rate_fix: val?.sale_rate_fix ? val?.sale_rate_fix : 0,
                sale_rate_per: val?.sale_rate_per ? val?.sale_rate_per : 0,
                paydart_rate_fix: val?.paydart_rate_fix ? val?.paydart_rate_fix : 0,
                paydart_rate_per: val?.paydart_rate_per ? val?.paydart_rate_per : 0,
                tax: val?.tax ? val?.tax : 0,
                is_default: plan_result?.is_default ? plan_result?.is_default : 0,
                min_amount:val.min_amount?val.min_amount:0,
                max_amount:val.max_amount?val.max_amount:0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        ); 
    },

    delete_trans_rate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "pricing_plan_txn_rate"
            );

            return res
                .status(statusCode.ok)
                .send(
                    response.successmsg("Transaction rate deleted successfully")
                );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 

            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    plan_array: async (req, res) => {
        try {
            console.log("🚀 ~ plan_array: ~ req.bodyString:", req.bodyString)
            const currency = req.bodyString("currency") ?? null;
            console.log("🚀 ~ plan_array: ~ currency:", currency)
            const country_id_enc = req.bodyString("country_id") ?? '' ;
            console.log("🚀 ~ plan_array: ~ country_id_enc:", country_id_enc)
            const country_id = enc_dec.cjs_decrypt(country_id_enc);
            console.log("🚀 ~ plan_array: ~ country_id:", country_id)
            const psp = req.bodyString("psp") ?? null;
            console.log("🚀 ~ plan_array: ~ psp:", psp)

            let condition = null;
            let res_data = [];

            if (currency && psp) {
                condition = { currency: currency };
                await pricing_model
                    .details_by_country_currency_psp(country_id, currency, psp)
                    .then(async (result) => {
                        res_data = [];
                        for (let item of result) {
                            let temp = {
                                id: await enc_dec.cjs_encrypt(item.id),
                                plan_name: item.plan_name,
                            };
                            res_data.push(temp);
                        }
                        return res.status(statusCode.ok).send(
                            response.successdatamsg(
                                res_data,
                                "Details fetched successfully."
                            )
                        );
                    })
                    .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                        return res.status(statusCode.internalError).send(
                            response.errormsg(error)
                        );
                    });
            }


            // if (country_id) {
            //     await pricing_model
            //         .details_by_country(country_id)
            //         .then(async (result) => {
            //             res_data = [];
            //             for (let item of result) {
            //                 let temp = {
            //                     id: await enc_dec.cjs_encrypt(item.id),
            //                     plan_name: item.plan_name,
            //                 };
            //                 res_data.push(temp);
            //             }
            //             return res.status(statusCode.ok).send(
            //                 response.successdatamsg(
            //                     res_data,
            //                     "Details fetched successfully."
            //                 )
            //             );
            //         })
            //         .catch((error) => {
            //            logger.error(500,{message: error,stack: error.stack}); 
            //             return res.status(statusCode.internalError).send(
            //                 response.errormsg(error)
            //             );
            //         });
            // }


            // if (currency) {
            //     condition = { currency: currency };
            //     await pricing_model
            //         .details_by_currency(condition, { psp: psp })
            //         .then(async (result) => {
            //             res_data = [];
            //             for (let item of result) {
            //                 let temp = {
            //                     id: await enc_dec.cjs_encrypt(item.id),
            //                     plan_name: item.plan_name,
            //                 };
            //                 res_data.push(temp);
            //             }
            //             return res.status(statusCode.ok).send(
            //                 response.successdatamsg(
            //                     res_data,
            //                     "Details fetched successfully."
            //                 )
            //             );
            //         })
            //         .catch((error) => {
            //            logger.error(500,{message: error,stack: error.stack}); 
            //             return res.status(statusCode.internalError).send(
            //                 response.errormsg(error)
            //             );
            //         });
            // }


        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },

    mid_sellrate_plan_trans_details: async (req, res) => {
        try {
            let master_pricing_plan_id = enc_dec.cjs_decrypt(
                req.bodyString("id")
            );

            let mid = enc_dec.cjs_decrypt(
                req.bodyString("mid_id")
            );

            let condition = { master_pricing_plan_id: master_pricing_plan_id, deleted: 0 };
            let promo_sell_rates = [];
            let trans_data = [];
            let master_data = {};
            let table_name = "";
            let table_for_txn = "";
            let table_for_promo = "";
            let get_exists_data = await pricing_model.get_count_mid_sell_rate(master_pricing_plan_id, mid)
            let condition1 = { id: master_pricing_plan_id };
            let condition_for_mid = { plan_id: master_pricing_plan_id, mid: mid };
            if (get_exists_data > 0) {
                table_name = "master_mid_sellrate";
                table_for_txn = "mid_sellrate"
                table_for_promo = "mid_promo_sellrate"
            } else {
                table_name = "master_pricing_plan";
                table_for_txn = "pricing_plan_txn_rate"
            }


            let result0 = await pricing_model.select_plan_mid(condition1, table_name, condition_for_mid);

            let start = ""
            let end = ""
            if (get_exists_data > 0) {
                start = result0[0]?.promo_period_start == "0000-00-00" ? '' : moment(result0[0]?.promo_period_start).format('DD-MM-YYYY')
                end = result0[0]?.promo_period_end == "0000-00-00" ? '' : moment(result0[0]?.promo_period_end).format('DD-MM-YYYY')
            }
            master_data = {
                id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(result0[0]?.id),
                plan_name: result0[0]?.plan_name
                    ? result0[0]?.plan_name
                    : "",
                currency: result0[0]?.currency
                    ? result0[0]?.currency
                    : "",
                mid_activation_fee: (result0[0]?.mid_activation_fee || result0[0]?.mid_active_fees) ?? 0,
                //setup_fees: result0[0]?.setup_fees ?? 0,
                num_of_free_mid: result0[0]?.num_of_free_mid ?? "",

                refund_fees_per: result0[0]?.refund_fees_per
                    ? result0[0]?.refund_fees_per
                    : 0,
                refund_fees_fix: result0[0]?.refund_fees_fix
                    ? result0[0]?.refund_fees_fix
                    : 0,
                charge_back_fees_per: result0[0]?.charge_back_fees_per
                    ? result0[0]?.charge_back_fees_per
                    : 0,
                charge_back_fees_fix: result0[0]?.charge_back_fees_fix
                    ? result0[0]?.charge_back_fees_fix
                    : 0,
                promo_period_start: start,
                promo_period_end: end
            };
            let condition_for_mid_txn = { master_mid_sellrate_id: result0[0]?.id, deleted: 0 };
            let result = await pricing_model.select_mid_txn(condition, table_for_txn, condition_for_mid_txn);
            console.log(`response result`);
            console.log(result);
            for (let item of result) {
                let sell_rate_per = null;
                let sell_rate_fix = null;

                if (item.sale_rate_per) {
                    sell_rate_per = item?.sale_rate_per;
                } else {
                    sell_rate_per = item?.sell_rate_per;
                }
                if (item.sale_rate_fix) {
                    sell_rate_fix = item?.sale_rate_fix;
                } else {
                    sell_rate_fix = item?.sale_rate_fix;
                }


                let temp = {
                    id: get_exists_data > 0 ? enc_dec.cjs_encrypt(item.id) : '',
                    master_pricing_plan_id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(
                        item.master_pricing_plan_id
                    ),
                    sale_rate_per: sell_rate_per ?? 0,
                    sale_rate_fix: sell_rate_fix ?? 0,
                    paydart_rate_per: item.paydart_rate_per ? item?.paydart_rate_per.toFixed(2) : 0 ?? 0,
                    paydart_rate_fix: item.paydart_rate_fix ? item?.paydart_rate_fix.toFixed(2) : 0 ?? 0,
                    tax: item.tax ? item.tax.toFixed(2) : 0,
                    currency: item.currency
                        ? item.currency
                        : "",
                    psp: item.psp ? enc_dec.cjs_encrypt(item.psp) : "",
                    dom_int: item.dom_int ? item.dom_int : "",
                    payment_methods: item.payment_methods
                        ? item.payment_methods
                        : "",
                    payment_schemes: item.payment_schemes
                        ? item.payment_schemes
                        : "",
                };
                trans_data.push(temp);
            }
            let send_data = {
                master_data,
                trans_data,
                promo_sell_rates,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_data,
                    "Details fetched successfully."
                )
            );


            /* await pricing_model
                 .select_mid_txn(condition, table_for_txn, condition_for_mid_txn)
                 .then(async (result) => {

                     for (let item of result) {
                         let sell_rate_per = null;
                         let sell_rate_fix = null;

                         if (item.sale_rate_per) {
                             sell_rate_per = item?.sale_rate_per.toFixed(2)
                         } else {
                             sell_rate_per = item?.sell_rate_per.toFixed(2)
                         }
                         if (item.sale_rate_fix) {
                             sell_rate_fix = item?.sale_rate_fix.toFixed(2)
                         } else {
                             sell_rate_fix = item?.sell_rate_fix.toFixed(2)
                         }


                         let temp = {
                             id: get_exists_data > 0 ? enc_dec.cjs_encrypt(item.id) : '',
                             master_pricing_plan_id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(
                                 item.master_pricing_plan_id
                             ),
                             sale_rate_per: sell_rate_per ?? 0,
                             sale_rate_fix: sell_rate_fix ?? 0,
                             paydart_rate_per: item.paydart_rate_per ? item?.paydart_rate_per.toFixed(2) : 0 ?? 0,
                             paydart_rate_fix: item.paydart_rate_fix ? item?.paydart_rate_fix.toFixed(2) : 0 ?? 0,
                             tax: item.tax ? item.tax.toFixed(2) : 0,
                             currency: item.currency
                                 ? item.currency
                                 : "",
                             dom_int: item.dom_int ? item.dom_int : "",
                             payment_methods: item.payment_methods
                                 ? item.payment_methods
                                 : "",
                             payment_schemes: item.payment_schemes
                                 ? item.payment_schemes
                                 : "",
                         };
                         trans_data.push(temp);
                     }
                     await pricing_model
                         .select_mid_promo(
                             condition,
                             table_for_promo,
                             condition_for_mid_txn
                         )
                         .then(async (result) => {
                             if (result.length > 0) {
                                 for (let item of result) {
                                     let temp = {
                                         id: enc_dec.cjs_encrypt(item.id),
                                         master_pricing_plan_id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(
                                             item.master_pricing_plan_id
                                         ),
                                         promo_sell_rate_fix: item.promo_sell_rate_fix
                                             ? item.promo_sell_rate_fix.toFixed(2)
                                             : 0,
                                         promo_sell_rate_per: item.promo_sell_rate_per
                                             ? item.promo_sell_rate_per.toFixed(2)
                                             : 0,
                                         paydart_rate_per: item.paydart_rate_per ? item?.paydart_rate_per.toFixed(2) : 0 ?? 0,
                                         paydart_rate_fix: item.paydart_rate_fix ? item?.paydart_rate_fix.toFixed(2) : 0 ?? 0,
                                         promo_tax: item.promo_tax ? item.promo_tax.toFixed(2) : 0,
                                         currency: item.currency
                                             ? item.currency
                                             : "",
                                         dom_int: item.dom_int ? item.dom_int : "",
                                         payment_methods: item.payment_methods
                                             ? item.payment_methods
                                             : "",
                                         payment_schemes: item.payment_schemes
                                             ? item.payment_schemes
                                             : "",
                                     };
                                     promo_sell_rates.push(temp);
                                 }
                             }
                         });

                     let send_data = {
                         master_data,
                         trans_data,
                         promo_sell_rates,
                     };

                     res.status(statusCode.ok).send(
                         response.successdatamsg(
                             send_data,
                             "Details fetched successfully."
                         )
                     );
                 })
                 .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                     res.status(statusCode.internalError).send(
                         response.errormsg(error)
                     );
                 }); 
         });*/
        } catch (error) {
            console.log(error);
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    merchant_sellrate_plan_trans_details: async (req, res) => {
        try {
            let master_pricing_plan_id = enc_dec.cjs_decrypt(
                req.bodyString("id")
            );
            let sub_merchant_id = enc_dec.cjs_decrypt(
                req.bodyString("sub_merchant_id")
            );


            let feate_data = [];
            let table_name = "";
            let table_for_txn = "";
            let condition1 = { id: master_pricing_plan_id, deleted: 0 };
            let condition = { master_pricing_plan_id: master_pricing_plan_id, deleted: 0 }
            let result0 = null;
            let buy_rate = null;

            let get_exists_data = await pricing_model.get_count_merchant_sell_rate(master_pricing_plan_id, sub_merchant_id);

            let condition_for_mid = { plan_id: master_pricing_plan_id, submerchant_id: sub_merchant_id };
            if (get_exists_data === 0) {
                table_name = "master_pricing_plan";
                table_for_txn = "pricing_plan_features_rate";
                result0 = await pricing_model.select_plan_mid(condition1, table_name, condition_for_mid);
                buy_rate = await pricing_model.select_buy_rate({ psp: result0[0]?.psp, country_id: result0[0]?.country_id }, 'master_buyrate');
            } else {
                table_name = "master_subm_sellrate";
                table_for_txn = "subm_sellrate";
                result0 = await pricing_model.select_plan_mid(condition1, table_name, condition_for_mid);
            }



            let master_data = {
                id: enc_dec.cjs_encrypt(result0[0]?.id),
                plan_name: result0[0]?.plan_name
                    ? result0[0]?.plan_name
                    : "",
                currency: result0[0]?.currency
                    ? result0[0]?.currency
                    : "",
                mid_active_fees: (result0[0]?.mid_active_fees || result0[0]?.mid_active_fee) ?? 0,
                num_of_free_mid: result0[0]?.num_of_free_mid ?? "",
                buy_account_fee: (result0[0]?.buy_account_fee || buy_rate[0]?.account_fee) ?? 0,
                buy_setup_fee: (result0[0]?.buy_setup_fee || buy_rate[0]?.setup_fees) ?? 0,
                setup_fees: (result0[0]?.setup_fees || result0[0]?.setup_fee) ?? 0,
                sell_account_fee: (result0[0]?.account_fee || result0[0]?.sell_account_fee) ?? 0,
                sell_account_fee_type: (result0[0]?.sell_account_fee_type || result0[0]?.account_fee_type) ?? 0,
                buy_account_fee_type: (result0[0]?.buy_account_fee_type || buy_rate[0]?.account_fee_type) ?? 0,


                refund_fees_per: result0[0]?.refund_fees_per
                    ? result0[0]?.refund_fees_per
                    : 0,
                refund_fees_fix: result0[0]?.refund_fees_fix
                    ? result0[0]?.refund_fees_fix
                    : 0,
                charge_back_fees_per: result0[0]?.charge_back_fees_per
                    ? result0[0]?.charge_back_fees_per
                    : 0,
                charge_back_fees_fix: result0[0]?.charge_back_fees_fix
                    ? result0[0]?.charge_back_fees_fix
                    : 0
            };
            let condition_for_mid_txn = { master_subm_sellrate_id: result0[0]?.id, deleted: 0 };
            const result = await pricing_model.select_mid_txn(condition, table_for_txn, condition_for_mid_txn)
            for (let item of result) {
                console.log(item);
                let sell_per = 0;
                let sell_fix = 0;
                let tax = 0;
                if (item.sale_rate_fix) {
                    sell_fix = item.sale_rate_fix;
                } else {
                    sell_fix = item.sell_rate_fix;
                }
                if (item.sale_rate_per) {
                    sell_per = item.sale_rate_per;
                } else {
                    sell_per = item.sell_rate_per;
                }

                let temp = {
                    id: enc_dec.cjs_encrypt(item.id),
                    master_pricing_plan_id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(
                        item.master_pricing_plan_id
                    ),
                    sale_rate_fix: sell_fix,
                    sale_rate_per: sell_per,
                    tax: item.tax ? item.tax : 0,
                    feature: (item.feature || item.features) ?? 0,
                    currency: item.currency
                        ? item.currency
                        : "",
                    dom_int: item.dom_int ? item.dom_int : "",
                    payment_methods: item.payment_methods
                        ? item.payment_methods
                        : "",
                    payment_schemes: item.payment_schemes
                        ? item.payment_schemes
                        : "",
                };
                feate_data.push(temp);
            }

            let send_data = {
                master_data,
                feature_data: feate_data,
            };

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    send_data,
                    "Details fetched successfully."
                )
            );

            /*
            
            // let condition = { master_pricing_plan_id: master_pricing_plan_id };
            // let promo_sell_rates = [];
            // let feate_data = [];
            // let master_data = {};
            // let table_name = "";
            // let table_for_txn = "";
            // let table_for_promo = "";
            
            let condition1 = { id: master_pricing_plan_id };
            
            let condition_for_mid_txn = { master_subm_sellrate_id: master_pricing_plan_id };
    
            if (get_exists_data > 0) {
                table_name = "master_subm_sellrate";
                table_for_txn = "subm_sellrate"
            } else {
                table_name = "master_pricing_plan";
                table_for_txn = "pricing_plan_features_rate"
            }
            
            await pricing_model
                .select_plan_mid(condition1, table_name, condition_for_mid)
                .then(async (result0) => {
                    
                    master_data = {
                        id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(result0[0]?.id),
                        plan_name: result0[0]?.plan_name
                            ? result0[0]?.plan_name
                            : "",
                        currency: result0[0]?.currency
                            ? result0[0]?.currency
                            : "",
                        mid_active_fees: (result0[0]?.mid_active_fees || result0[0]?.mid_active_fee) ?? 0,
                        setup_fees: result0[0]?.setup_fees ?? 0,
                        num_of_free_mid: result0[0]?.num_of_free_mid ?? "",
    
                        refund_fees_per: result0[0]?.refund_fees_per
                            ? result0[0]?.refund_fees_per
                            : 0,
                        refund_fees_fix: result0[0]?.refund_fees_fix
                            ? result0[0]?.refund_fees_fix
                            : 0,
                        charge_back_fees_per: result0[0]?.charge_back_fees_per
                            ? result0[0]?.charge_back_fees_per
                            : 0,
                        charge_back_fees_fix: result0[0]?.charge_back_fees_fix
                            ? result0[0]?.charge_back_fees_fix
                            : 0
                    };
                    
                    await pricing_model
                        .select_mid_txn(condition, table_for_txn, condition_for_mid_txn)
                        .then(async (result) => {
    
                            for (let item of result) {
                                let temp = {
                                    id: enc_dec.cjs_encrypt(item.id),
                                    master_pricing_plan_id: get_exists_data > 0 ? enc_dec.cjs_encrypt(master_pricing_plan_id) : enc_dec.cjs_encrypt(
                                        item.master_pricing_plan_id
                                    ),
                                    sale_rate_fix: item.sale_rate_fix ? item.sale_rate_fix : (item.sell_rate_fix
                                        ? item.sell_rate_fix.toFixed(2) : 0),
                                    sale_rate_per: item.sale_rate_per ? item.sale_rate_per.toFixed(2) : (item.sell_rate_per
                                        ? item.sell_rate_per
                                        : 0),
                                    tax: item.tax ? item.tax : 0,
                                    feature: item.feature ? item.feature : 0,
                                    currency: item.currency
                                        ? item.currency
                                        : "",
                                    dom_int: item.dom_int ? item.dom_int : "",
                                    payment_methods: item.payment_methods
                                        ? item.payment_methods
                                        : "",
                                    payment_schemes: item.payment_schemes
                                        ? item.payment_schemes
                                        : "",
                                };
                                feate_data.push(temp);
                            }
                            
                            let send_data = {
                                master_data,
                                feature_data: feate_data,
                            };
    
                            res.status(statusCode.ok).send(
                                response.successdatamsg(
                                    send_data,
                                    "Details fetched successfully."
                                )
                            );
                        })
                        .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                            
                            res.status(statusCode.internalError).send(
                                response.errormsg(error)
                            );
                        });
                });*/
        } catch (error) {
            console.log(error);
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    mid_sell_rate: async (req, res) => {
        try {
            let mid_id = await enc_dec.cjs_decrypt(req.bodyString("mid"))
            let currency = req.bodyString("currency");
            let condition = { mid: mid_id };
            let methods = await helpers.getString(req.bodyString("methods"));
            let scheme = await helpers.getString(req.bodyString("scheme"));
            let dom_in = await helpers.getString(req.bodyString("dom_int"));
            let user_type = req.user.type
            let all_data = [];

            // let condition1 = { id: master_pricing_plan_id };
            let mid_by_data = await pricing_model.select_master_mid_sellrate(condition);
            console.log("🚀 ~ mid_sell_rate: ~ mid_by_data:", mid_by_data)
            for (result0 of mid_by_data) {

                let feature_data = [];
                let trans_data = [];
                let master_id = result0?.id
                let result = await pricing_model.select_mid_wise_pricing(master_id, methods, scheme, dom_in, "mid_sellrate", user_type)
                console.log("🚀 ~ mid_sell_rate: ~ result:", result)
                for (let item of result) {

                    
                    let temp = {
                        id: enc_dec.cjs_encrypt(item.id),
                        master_pricing_plan_id: enc_dec.cjs_encrypt(
                            item.master_mid_sellrate_id
                        ),
                        sale_rate_fix: item.sell_rate_fix
                        ? item.sell_rate_fix.toFixed(2)
                        : 0,
                        sale_rate_per: item.sell_rate_per
                        ? item.sell_rate_per.toFixed(2)
                        : 0,
                        paydart_rate_fix: item.paydart_rate_fix
                        ? item.paydart_rate_fix.toFixed(2)
                        : 0,
                        paydart_rate_per: item.paydart_rate_per
                        ? item.paydart_rate_per.toFixed(2)
                        : 0,
                        tax: item.tax ? item.tax : 0,
                        currency: item.currency ? item.currency : "",
                        dom_int: item.dom_int ? item.dom_int : "",
                        payment_methods: item.payment_methods
                        ? item.payment_methods
                        : "",
                        payment_schemes: item.payment_schemes
                        ? item.payment_schemes
                        : "",
                        psp: item?.psp ? enc_dec.cjs_encrypt(item?.psp) : "",
                    };
                    
                    // let psp = await helpers.getPSPByPricingPlanID(item.master_mid_sellrate_id, temp.currency, temp.dom_int, temp.payment_methods, enc_dec.cjs_encrypt(temp.payment_schemes));
                    // temp.psp = psp !== "" ? enc_dec.cjs_encrypt(psp) : "",
                    trans_data.push(temp);
                    console.log("🚀 ~ mid_sell_rate: ~ temp:", temp)
                }

                let feature = await pricing_model.select_mid_wise_pricing(master_id, methods, scheme, dom_in, "mid_promo_sellrate", user_type)
                for (let item of feature) {
                    let temp = {
                        id: enc_dec.cjs_encrypt(item.id),
                        master_pricing_plan_id: enc_dec.cjs_encrypt(
                            item.master_mid_sellrate_id
                        ),
                        sale_rate_fix: item.promo_sell_rate_fix
                            ? item.promo_sell_rate_fix
                            : 0,
                        sale_rate_per: item.promo_sell_rate_per
                            ? item.promo_sell_rate_per
                            : 0,
                        paydart_rate_fix: item.paydart_rate_fix
                            ? item.paydart_rate_fix
                            : 0,
                        paydart_rate_per: item.paydart_rate_per
                            ? item.paydart_rate_per
                            : 0,
                        tax: item.promo_tax ? item.promo_tax : 0,
                        currency: item.currency
                            ? item.currency
                            : "",
                        dom_int: item.dom_int ? item.dom_int : "",
                        payment_methods: item.payment_methods
                            ? item.payment_methods
                            : "",
                        payment_schemes: item.payment_schemes
                            ? item.payment_schemes
                            : "",
                    };

                    let psp = await helpers.getPSPByPricingPlanID(item.master_mid_sellrate_id, temp.currency, temp.dom_int, temp.payment_methods, enc_dec.cjs_encrypt(temp.payment_schemes));
                    temp.psp = psp !== "" ? enc_dec.cjs_encrypt(psp) : "",
                    feature_data.push(temp);
                }

                let master_data = {
                    plan_id:result0?.plan_id,
                    id: enc_dec.cjs_encrypt(result0?.id),
                    plan_name: result0?.plan_id
                        ? await helpers.getPricingPlan(result0?.plan_id)
                        : "",
                    currency: result0?.currency
                        ? result0?.currency
                        : "",

                    refund_fees_per: result0?.refund_fees_per
                        ? result0?.refund_fees_per
                        : 0,
                    refund_fees_fix: result0?.refund_fees_fix
                        ? result0?.refund_fees_fix
                        : 0,
                    mid_activation_fee: result0?.mid_activation_fee
                        ? result0?.mid_activation_fee
                        : 0,
                    num_of_free_mid: result0?.num_of_free_mid
                        ? result0?.num_of_free_mid
                        : 0,
                    charge_back_fees_per: result0?.charge_back_fees_per
                        ? result0?.charge_back_fees_per
                        : 0,
                    charge_back_fees_fix: result0?.charge_back_fees_fix
                        ? result0?.charge_back_fees_fix
                        : 0,
                    num_of_free_mid: result0?.num_of_free_mid
                        ? result0?.num_of_free_mid
                        : 0,
                    setup_fees: result0?.setup_fees ? result0?.setup_fees : 0,
                    mid_active_fees: result0?.mid_active_fees
                        ? result0?.mid_active_fees
                        : 0,
                    transa_data: trans_data,
                    feate_data: feature_data,
                    promo_period_start: result0?.promo_period_start == "0000-00-00" ? '' : moment(result0?.promo_period_start).format('DD-MM-YYYY'),
                    promo_period_end: result0?.promo_period_end == "0000-00-00" ? '' : moment(result0?.promo_period_end).format('DD-MM-YYYY')

                };
                all_data.push(master_data);

            }


            res.status(statusCode.ok).send(
                response.successdatamsg(
                    all_data,
                    "Details fetched successfully."
                )
            );
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    // feature rates
    add_feature: async (req, res) => {
        let ins_data = req.body.data;
        var fault = 0;
        var pass = 0;
        for (let val of ins_data) {
            let data = {};
            if (val.feature) {
                data.feature = val.feature;
            }
            if (val.sale_rate_fix) {
                data.sale_rate_fix = val.sale_rate_fix;
            }
            if (val.sale_rate_per) {
                data.sale_rate_per = val.sale_rate_per;
            }
            if (val.tax) {
                data.tax = val.tax;
            }
            if (val.id) {
                data.id = enc_dec.cjs_decrypt(val.id);
                data.master_pricing_plan_id = enc_dec.cjs_decrypt(
                    val.master_pricing_plan_id
                );

                await pricing_model
                    .updateDetails(
                        {
                            id: enc_dec.cjs_decrypt(val.id),
                        },
                        data,
                        "pricing_plan_features_rate"
                    )
                    .then((result) => {
                        pass++;

                    })
                    .catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                        fault++;

                    });
            } else {
                data.master_pricing_plan_id = enc_dec.cjs_decrypt(
                    val.master_pricing_plan_id
                );

                pricing_model
                    .add(data, "pricing_plan_features_rate")
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
                message: "Feature rate added successfully",
            });
        }
    },

    list_feature_rate: async (req, res) => {
        let master_pricing_plan_id = await enc_dec.cjs_decrypt(
            req.bodyString("master_pricing_plan_id")
        );
        let and_conditions = {
            master_pricing_plan_id: master_pricing_plan_id,
            deleted: 0,
        };

        let result = await pricing_model.list_rates(
            "*",
            and_conditions,
            "pricing_plan_features_rate"
        );
        let send_res = [];
        for (let val of result) {

            let res = {
                id: enc_dec.cjs_encrypt(val.id),
                master_pricing_plan_id: val?.master_pricing_plan_id
                    ? await enc_dec.cjs_encrypt(val?.master_pricing_plan_id)
                    : "",
                feature: val?.feature ? val?.feature : "",
                feature_name: val?.feature
                    ? await helpers.get_feature_name_by_id(val?.feature)
                    : "",
                sale_rate_fix: val?.sale_rate_fix ? val?.sale_rate_fix : 0.0,
                sale_rate_per: val?.sale_rate_per ? val?.sale_rate_per : 0.0,
                tax: val?.tax ? val?.tax : 0.0,
            };
            send_res.push(res);
        }
        res.status(statusCode.ok).send(
            response.successdatamsg(send_res, "List fetched successfully.")
        );
    },

    delete_feature_rate: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            let userData = { deleted: 1 };

            await pricing_model.updateDetails(
                {
                    id: id,
                },
                userData,
                "pricing_plan_features_rate"
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("Feature rate deleted successfully"));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 

            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    view_sale_rate:async(req,res)=>{
        console.log("🚀 ~ req:", req.body)
        try{
        let mid_id = enc_dec.cjs_decrypt(req.bodyString('mid'));
        let currency = req.bodyString('currency');
        let planDetails = await pricing_model.fetchPlanDetailsByMid({'mms.mid':mid_id});
        console.log("🚀 ~ planDetails:", planDetails)
        if (!planDetails) {
            return res.status(statusCode.ok).send(
            response.errormsg("Not found")
        );
        }
        let pspDetails = await pricing_model.fetchPSP({'m.id':mid_id},'mid');
        console.log("🚀 ~ pspDetails:", pspDetails)
        let fetchTransabasedForMid = await pricing_model.fetchTransactionBasedRate({psp:pspDetails.id,master_pricing_plan_id:planDetails.id});
        console.log("🚀 ~ fetchTransabasedForMid:", fetchTransabasedForMid)
        let send_res = [];
        for(let val of fetchTransabasedForMid){
             let payment_scheme_in_char = "";
            if(val?.payment_schemes_list){
                let payment_scheme_array = val?.payment_schemes_list.split(',');
                let schemes_array = [];
                for(let scheme of payment_scheme_array){
                    let decrypted_scheme = enc_dec.cjs_decrypt(scheme);
                    let s = await pricing_model.selectOneDynamic('card_scheme',{id:decrypted_scheme},'card_scheme');
                    schemes_array.push(s);
                }
                payment_scheme_in_char = schemes_array.join(',');
            }
            let transbases = {
                psp:pspDetails.name,
                dom_int:val.dom_int,
                currency:val.currency,
                payment_methods:val.payment_methods_list,
                payment_scheme:payment_scheme_in_char,
                sale_rate_fix:val.sale_rate_fix,
                sale_rate_per:val.sale_rate_per,
                tax:val.tax,
                min_amount:val.min_amount,
                max_amount:val.max_amount
            }
            console.log("🚀 ~ transbases:", transbases)
            send_res.push(transbases);

        }
        let mid_sale_rate = {
            plan_id:planDetails.id.toString().padStart(8, '0'),
            plan_name:planDetails.plan_name,
            country_name:planDetails.country_name,
            country_code:planDetails.country_name,
            multi_currency:'',
            psp_id:'',
            psp_name:'',
            is_default:planDetails.is_default,
            setup_fees:0,
            mid_active_fees:0,
            num_of_free_mid:0,
            refund_fees_per:0,
            refund_fees_fix:0,
            charge_back_fees_per:0,
            charge_back_fees_fix:0,
            master_pricing_plan_id:enc_dec.cjs_encrypt(planDetails.id),
            created_at:planDetails.created_at,
            updated_at:planDetails.updated_at,
            trans_based_records:send_res
        }
       res.status(statusCode.ok).send(
            response.successdatamsg(mid_sale_rate, "MID sale rate fetched successfully.")
        );

    }catch(error){
        console.log(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
    }
    }
};

module.exports = pricing_plan;
