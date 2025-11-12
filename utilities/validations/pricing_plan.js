const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const idChecker = require("./idchecker");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../../utilities/decryptor/decryptor");
const helpers = require("../helper/general_helper");

const pricing_plan_validator = {

    add: async (req, res, next) => {
        console.log("🚀 ~ add: ~ req:", req.body)
        const account_fees = ["yearly", "monthly"];
        const schema = Joi.object({
            plan_name: Joi.string()
                .required()
                .error(new Error("Plan name required and must be a string.")),
            multi_currency: Joi.string()
                .required()
                .allow("", null)
                .error(
                    new Error(
                        "Multi-currency is required and must be comma separated currencies."
                    )
                ),
            num_of_free_mid: Joi.number()
                .min(0)
                .required()
                .error(new Error("Number of free MID required")),
            setup_fees: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Setup fees is required and must be a positive number."
                    )
                ),
            mid_active_fees: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Mid active fees is required and must be a positive number."
                    )
                ),
            refund_fees_per: Joi.number()
                .min(0)
                .max(100)
                .required()
                .error(
                    new Error(
                        "Refund fees percentage is required and must be an integer between 1 and 100."
                    )
                ),
            refund_fees_fix: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Refund fees fix amount is required and must be a positive number."
                    )
                ),
            charge_back_fees_per: Joi.number()
                .min(0)
                .max(100)
                .required()
                .error(
                    new Error(
                        "Charge back fees percentage is required and must be an integer between 0 and 100."
                    )
                ),
            charge_back_fees_fix: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Charge back fees fix amount is required and must be a positive number."
                    )
                ),
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Country is required");
                }),
            account_fee_type: Joi.string()
                .optional()
                .allow('')
                // .valid(...account_fees)
                // .required()
                .error(() => {
                    return new Error("Account Fee required");
                }),
            account_fee: Joi.string()
                .optional()
                // .required()
                .allow(0)
                // .min(0)
                .error(() => {
                    return new Error("Account Fee required");
                }),
            is_default: Joi.number()
                .required()
                .error(() => {
                    return new Error("Is Default required");
                }),
        });

        try {
            // let currency_available =
            //     await helpers.check_if_currency_value_exist_pricing(
            //         req.body.multi_currency,
            //         "master_pricing_plan",
            //         req.body.plan_name
            //     );
            
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } /*else if (currency_available) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg("Currency already exist")
                );
            } */ 
           else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    add_trans: async (req, res, next) => {
        const schema = Joi.object({
            data: Joi.array().items(
                Joi.object({
                    id: Joi.string().optional().allow(""),
                    master_pricing_plan_id: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Pricing Plan id required");
                        }),
                    psp: Joi.string()
                        .required()
                        .error(() => {
                            return new Error(
                                "PSP is required"
                            );
                        }),
                    dom_int: Joi.string()
                        .valid("Domestic", "International")
                        .required()
                        .error(() => {
                            return new Error(
                                "Domestic/International is required"
                            );
                        }),
                    currency: Joi.string()
                        .required()
                        .error(
                            new Error(
                                "Currency is required and must be comma separated currencies."
                            )
                        ),
                    payment_methods: Joi.string()
                        .required()
                        .custom((value, helpers) => {
                            const methods = value
                                .split(",")
                                .map((item) => item.trim());
                            const uniqueMethods = [...new Set(methods)];

                            if (methods.length !== uniqueMethods.length) {
                                return helpers.error("any.invalid");
                            }

                            return value;
                        })
                        .error(() => {
                            return new Error("Valid Payment method required.");
                        }),
                    payment_schemes: Joi.string()
                        .optional()
                        .allow("")
                        .custom((value, helpers) => {
                            const schemes = value
                                .split(",")
                                .map((item) => item.trim());
                            const uniqueSchemes = [...new Set(schemes)];

                            if (schemes.length !== uniqueSchemes.length) {
                                return helpers.error("any.invalid");
                            }

                            return value;
                        })
                        .error(() => {
                            return new Error("Valid Payment schemes required.");
                        }),
                    sale_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(() => {
                            return new Error(
                                "Sale rate fix must be a positive number"
                            );
                        }),
                    sale_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Sale rate percentage must be an integer between 1 and 100"
                            );
                        }),
                    paydart_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(() => {
                            return new Error(
                                "Paydart rate fix must be a positive number"
                            );
                        }),
                    paydart_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Paydart rate percentage must be an integer between 1 and 100"
                            );
                        }),
                    tax: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Tax must be an integer between 1 and 100"
                            );
                        }),
                     min_amount: Joi.number()
                        .required()
                        .error(() => {
                            return new Error(
                                "Min Amount be an integer"
                            );
                        }),
                     max_amount: Joi.number()
                        .required()
                        .error(() => {
                            return new Error(
                                "Max Amount be an integer"
                            );
                        }),        
                })
            ),
        });
        try {
            let fail = 0;

            for (let item of req.body.data) {
                // if (!item.id) {
                //     let condition = {
                //         master_pricing_plan_id: await enc_dec.cjs_decrypt(
                //             item.master_pricing_plan_id
                //         ),
                //         dom_int: item.dom_int,
                //         payment_methods: item.payment_methods,
                //         payment_schemes: item.payment_schemes,
                //     };
                //     let currency = item.currency;
                //     let data_available = await helpers.check_if_data_exist(
                //         condition,
                //         currency,
                //         "pricing_plan_txn_rate"
                //     );
                    
                //     if (data_available) {
                //         fail++;
                //     }
                // }
            }

            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            }/* else if (fail > 0) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg("Record already exist")
                );
            } */else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    add_feature: async (req, res, next) => {
        const schema = Joi.object({
            data: Joi.array().items(
                Joi.object({
                    id: Joi.string().optional().allow(""),
                    master_pricing_plan_id: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Pricing plan id required");
                        }),
                    feature: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("feature id required");
                        }),
                    sale_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(() => {
                            return new Error(
                                "Sale rate fix must be a positive number"
                            );
                        }),
                    sale_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Sale rate percentage must be an integer between 1 and 100"
                            );
                        }),
                    tax: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Tax must be an integer between 1 and 100"
                            );
                        }),
                })
            ),
        });
        try {
            let fail = 0;
            for (let item of req.body.data) {
                if (!item.id) {
                    let condition = {
                        deleted: 0,
                        master_pricing_plan_id: await enc_dec.cjs_decrypt(
                            item.master_pricing_plan_id
                        ),
                        feature: item.feature,
                    };
                    let data_available = await checkifrecordexist(
                        condition,
                        "pricing_plan_features_rate"
                    );
                    if (data_available) {
                        fail++;
                    }
                }
            }
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else if (fail > 0) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg("Record already exist")
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    update: async (req, res, next) => {
        const account_fees = ["yearly", "monthly"];
        const schema = Joi.object({
            master_pricing_plan_id: Joi.string()
                .required()
                .error(new Error("Pricing plan id required.")),
            plan_name: Joi.string()
                .required()
                .error(
                    new Error("Plan name is required and must be a string.")
                ),
            multi_currency: Joi.string()
                .required()
                .allow("", null)
                .error(
                    new Error(
                        "Multi-currency is required and must be comma separated currencies."
                    )
                ),
            num_of_free_mid: Joi.number()
                .min(0)
                .required()
                .error(new Error("Number of free MID required")),
            setup_fees: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Setup fees is required and must be a positive number."
                    )
                ),
            mid_active_fees: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Mid active fees is required and must be a positive number."
                    )
                ),
            refund_fees_per: Joi.number()
                .min(0)
                .max(100)
                .required()
                .error(
                    new Error(
                        "Refund fees percentage is required between 1 and 100."
                    )
                ),
            refund_fees_fix: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Refund fees fix amount is required and must be a positive number."
                    )
                ),
            charge_back_fees_per: Joi.number()
                .min(0)
                .max(100)
                .required()
                .error(
                    new Error(
                        "Charge back fees percentage is required between 1 and 100."
                    )
                ),
            charge_back_fees_fix: Joi.number()
                .min(0)
                .required()
                .error(
                    new Error(
                        "Charge back fees fix amount is required and must be a positive number."
                    )
                ),
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Country is required");
                }),
            // psp: Joi.string()
            //     .required()
            //     .error(() => {
            //         return new Error("PSP is required");
            //     }),
            account_fee_type: Joi.string()
            .optional()
            .allow('')
                // .valid(...account_fees)
                // .required()
                .error(() => {
                    return new Error("Account Fee required");
                }),
            account_fee: Joi.string()
                .optional()
                .allow(0)
                // .required()
                // .min(0)
                .error(() => {
                    return new Error("Account Fee required");
                }),
            is_default: Joi.number()
                .required()
                .error(() => {
                    return new Error("Is Default required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                if (req.bodyString("master_pricing_plan_id")) {
                    let master_pricing_plan_id = enc_dec.cjs_decrypt(
                        req.bodyString("master_pricing_plan_id")
                    );
                    let record_exits = await checkifrecordexist(
                        { id: master_pricing_plan_id },
                        "master_pricing_plan"
                    );
                    if (!record_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found!"
                            )
                        );
                    } else {
                        next();
                    }
                }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    delete_feature_rate: async (req, res, next) => {
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid ID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, deleted: 0 },
                        "pricing_plan_features_rate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found or already deleted."
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    delete_trans_rate: async (req, res, next) => {
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid ID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, deleted: 0 },
                        "pricing_plan_txn_rate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found or already deleted."
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
};
module.exports = pricing_plan_validator;
