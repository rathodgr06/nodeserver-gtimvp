const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const idChecker = require("./idchecker");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../../utilities/decryptor/decryptor");
const helpers = require("../helper/general_helper");
const PspValidator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Country is required");
                }),
            name: Joi.string()
                .min(3)
                .max(60)
                .pattern(new RegExp(/^[A-Za-z]+[A-Za-z ]*$/))
                .required()
                .messages({
                    "string.pattern.base": "Name can contain alphabets",
                    "string.empty": "Name should not be an empty",
                    "any.required": "Name required",
                    "string.min": "Name minimum length is 3 characters",
                    "string.max": "Name maximum length is 60 characters",
                }),
            email_to: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Email Required");
                }),
            cc: Joi.string()
                .email({ multiple: true })
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid cc email Required");
                }),
            mcc: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid cc email Required");
                }),
            payment_schemes: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Should only contain accepted payment schemes (Visa, Master, Amex, Diner) once"
                    );
                }),
            payment_methods: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Should only contain accepted payment methods (Credit card, Debit card, Wallet, Net Banking, BNPL, Virtual card, Prepaid card) once"
                    );
                }),
            ekyc_required: Joi.string()
                .required()
                .error(() => {
                    return new Error("Ekyc Required");
                }),
            threshold_value: Joi.number()
                .required()
                .error(() => {
                    return new Error("Threshold value Required");
                }),
            transaction_allowed_daily: Joi.optional()
                // .required()
                .error(() => {
                    return new Error("Daily transaction value Required");
                }),
            min_bps: Joi.number()
                .required()
                .error(() => {
                    return new Error("Min. BPS value Required");
                }),
            min_revenue: Joi.number()
                .required()
                .error(() => {
                    return new Error("Min. Revenue value Required");
                }),
            files: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid file required");
                }),
            remark: Joi.string()
                .max(200)
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid remark required (max 200 characters)"
                    );
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let cc = req.bodyString("cc");
                let cc_error = false;
                if (cc != "") {
                    let cc_array = cc.split(",");
                    if (cc_array.length > 5) {
                        cc_error = true;
                    }
                }
                if (!cc_error) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Maximum 5 emails are allowed in cc"
                        )
                    );
                }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    create: async (req, res, next) => {
        const account_fees = ["yearly", "monthly"];
        const schema = Joi.object({
            master_data: Joi.object({
                id: Joi.string().optional().allow(""),
                psp: Joi.string()
                    .required()
                    .error(new Error("PSP is required")),
                currency: Joi.string()
                    .required()
                    .error(new Error("Currency required")),
                setup_fees: Joi.number()
                    .min(0)
                    .required()
                    .error(new Error("Setup fees is required")),
                mid_active_fees: Joi.number()
                    .min(0)
                    .required()
                    .error(new Error("Mid active fees is required")),
                refund_fees_per: Joi.number()
                    .min(0)
                    .max(100)
                    .required()
                    .error(new Error("Refund fees percentage is required")),
                refund_fees_fix: Joi.number()
                    .min(0)
                    .required()
                    .error(new Error("Refund fees fix amount is required")),
                charge_back_fees_per: Joi.number()
                    .min(0)
                    .max(100)
                    .required()
                    .error(
                        new Error("Charge back fees percentage is required")
                    ),
                charge_back_fees_fix: Joi.number()
                    .min(0)
                    .required()
                    .error(
                        new Error("Charge back fees fix amount is required")
                    ),
                mcc_category: Joi.string()
                    .required()
                    .error(new Error("Mcc category required")),
                promo_period_start: Joi.date()
                    .iso()
                    .format("YYYY-MM-DD")
                    .optional()
                    .allow("", null)
                    .error(
                        new Error(
                            "Promo period start must be a valid ISO date in the format 'YYYY-MM-DD'"
                        )
                    ),
                promo_period_end: Joi.date()
                    .iso()
                    .format("YYYY-MM-DD")
                    .when("promo_period_start", {
                        is: Joi.date().empty(null),
                        then: Joi.date()
                            .iso()
                            .min(Joi.ref("promo_period_start"))
                            .required()
                            .error(
                                new Error(
                                    "Promo period end must be a valid ISO date in the format 'YYYY-MM-DD' and greater than or equal to promo period start"
                                )
                            ),
                        otherwise: Joi.optional()
                            .allow("")
                            .error(
                                new Error(
                                    "Promo period end must be a valid ISO date in the format 'YYYY-MM-DD' and greater than or equal to promo period start"
                                )
                            ),
                    }),
                    account_fee_type: Joi.string()
                    .valid(...account_fees)
                    .required()
                    .error(() => {
                        return new Error("Account Fee required");
                    }),
                    account_fee: Joi.string()
                        .required()
                        .min(0)
                        .error(() => {
                            return new Error("Account Fee required");
                        }),
                country: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Country  required");
                    }),
            }),
            buy_rates: Joi.array().items(
                Joi.object({
                    id: Joi.string().optional().allow(""),
                    dom_int: Joi.string()
                        .valid("Domestic", "International")
                        .required()
                        .error(new Error("Domestic/International is required")),
                    payment_methods: Joi.string()
                        .required()
                        .error(new Error("Payment methods is required")),
                    payment_schemes: Joi.string().optional().allow(""),
                    currency: Joi.string()
                        .required()
                        .error(new Error("Currency required")),
                    buy_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(
                            new Error(
                                "Buy rate is required must be greater than 1"
                            )
                        ),
                    buy_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(
                            new Error(
                                "Buy rate percentage is required between 1 and 100"
                            )
                        ),
                    tax: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(
                            new Error("Tax must is required between 0 and 100")
                        ),
                })
            ),
            promo_buy_rates: Joi.array()
                .items(
                    Joi.object({
                        id: Joi.string().optional().allow(""),
                        dom_int: Joi.string()
                            .valid("Domestic", "International")
                            .required()
                            .error(
                                new Error("Domestic/International is required")
                            ),
                        payment_methods: Joi.string()
                            .required()
                            .error(new Error("Payment methods is required")),
                        payment_schemes: Joi.string().optional().allow(""),
                        currency: Joi.string()
                            .required()
                            .error(new Error("Currency required")),
                        promo_buy_rate_per: Joi.number()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error(
                                    "Promo buy rate percentage must be between 0 and 100"
                                )
                            ),
                        promo_buy_rate_fix: Joi.number()
                            .min(0)
                            .required()
                            .error(new Error("Promo buy rate fix is required")),
                        promo_tax: Joi.number()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error("Promo tax must be between 0 and 100")
                            ),
                    })
                )
                .when("master_data.promo_period_start", {
                    is: Joi.date().empty(null),
                    then: Joi.required().error(
                        new Error("Promo buy rates are required")
                    ),
                    otherwise: Joi.optional().allow(""),
                }),
        });

        try {
        

            const result = schema.validate(req.body);
            if (result.error) {
                
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else 
            {
                const master_id = req.body.master_data.id ? enc_dec.cjs_decrypt(req.body.master_data.id) : '';
                let currency_available = await helpers.check_buy_rate(master_id, req, req.body.master_data.currency,null, "master_buyrate");

                if (currency_available && !master_id) {
                    return res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Currency already exist for the psp and country")
                    );
                }
                
                let mcc_available = await helpers.check_buy_rate(master_id, req, null, req.body.master_data.mcc_category, "master_buyrate");

                if (mcc_available && !master_id) {
                   return  res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Mcc category already exist for the psp")
                    );
                }

                //let currency_available =
                // await helpers.check_if_currency_value_exist(
                //     enc_dec.cjs_decrypt(req.body.master_data.psp),
                //     req.body.master_data.currency,
                //     "master_buyrate"
                // );
                // let mcc_available = await helpers.check_if_mcc_value_exist(
                //     enc_dec.cjs_decrypt(req.body.master_data.psp),
                //     req.body.master_data.mcc_category,
                //     "master_buyrate",master_id
                // );

                let check_regular_data_available = await helpers.checkIfArrayIsUnique(req.body.buy_rates)
                let check_promo_data_available = false
                if (req.body?.promo_buy_rates) {
                    check_promo_data_available = await helpers.checkIfArrayIsUnique(req.body.promo_buy_rates)
                }
                
                
                if (req.body?.master_data?.id) {
                    let promo_data = await helpers.get_data_list(
                        "*",
                        "psp_promo_buyrate",
                        {
                            master_buyrate_id: enc_dec.cjs_decrypt(
                                req.body?.master_data?.id
                            ),
                            deleted: 0,
                        }
                    );
                    if (promo_data.length > 0 && !req.body?.promo_buy_rates) {
                        await helpers.common_delete(
                            {
                                master_buyrate_id: enc_dec.cjs_decrypt(
                                    req.body?.master_data?.id
                                ),
                            },
                            "psp_promo_buyrate"
                        );
                    }
                }

                let fail_buy_rate = 0;
                let fail_promo_buy_rate = 0;
                if (req.body.master_data?.id) {

                    for (let item of req.body.buy_rates) {
                        if (!item.id) {
                            let condition = {
                                dom_int: item.dom_int,
                                payment_methods: item.payment_methods,
                                payment_schemes: item.payment_schemes,
                                deleted: 0,
                            };

                            if (req.body.master_data?.id) {
                                condition.master_buyrate_id =
                                    await enc_dec.cjs_decrypt(
                                        req.body.master_data?.id
                                    );
                            }

                            let data_available = await helpers.check_if_data_exist(
                                condition,
                                item.currency,
                                "psp_buyrate"
                            );
                            
                            if (data_available) {
                                fail_buy_rate++;
                            }

                        }
                    }
                }
                

                if (req.body.master_data?.id) {
                    if (req.body.promo_buy_rates) {
                        for (let item of req.body.promo_buy_rates) {
                            if (!item.id) {
                                let condition = {
                                    dom_int: item.dom_int,
                                    payment_methods: item.payment_methods,
                                    payment_schemes: item.payment_schemes,
                                    deleted: 0,
                                };
                                if (req.body.master_data?.id) {
                                    condition.master_buyrate_id =
                                        await enc_dec.cjs_decrypt(
                                            req.body.master_data?.id
                                        );
                                }
                                let data_available =
                                    await helpers.check_if_data_exist(
                                        condition,
                                        item.currency,
                                        "psp_promo_buyrate"
                                    );
                                
                                if (data_available) {
                                    fail_promo_buy_rate++;
                                }
                            }
                        }
                    }
                }
                
                if (check_regular_data_available) {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("You have entered duplicate data for setup regular buy rate.")
                    );
                } else if (check_promo_data_available) {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("You have entered duplicate data for setup promotional buy rate.")
                    );
                } else if (fail_buy_rate > 0) {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Buy rate data already exist")
                    );
                } else if (fail_promo_buy_rate > 0) {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Promo Buy rate data already exist")
                    );
                } else {
                    next();
                }
        }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    add_sellrate_mid: async (req, res, next) => {
        
        const schema = Joi.object({
            master_data: Joi.object({
                id: Joi.string().optional().allow(""),
                mid: Joi.string()
                    .required()
                    .error(new Error("MID is required")),
                plan_id: Joi.string()
                    .required()
                    .error(new Error("Plan id required")),
                currency: Joi.string()
                    .required()
                    .error(
                        new Error(
                            "Currency is required and must be comma separated currencies"
                        )
                    ),
                // num_of_free_mid: Joi.number()
                //     .min(0)
                //     .max(100)
                //     .required()
                //     .error(new Error("Number of free MID is required")),            
                mid_activation_fee: Joi.number()
                    .min(0)
                    .required()
                    .error(new Error("MID activation fee is required")),            
                refund_fees_per: Joi.number()
                    .min(0)
                    .max(100)
                    .required()
                    .error(new Error("Refund fees percentage is required")),
                refund_fees_fix: Joi.number()
                    .min(0)
                    .required()
                    .error(new Error("Refund fees fix amount is required")),
                charge_back_fees_per: Joi.number()
                    .min(0)
                    .max(100)
                    .required()
                    .error(
                        new Error("Charge back fees percentage is required")
                    ),
                charge_back_fees_fix: Joi.number()
                    .min(0)
                    .required()
                    .error(
                        new Error("Charge back fees fix amount is required")
                    ),
                promo_period_start: Joi.date()
                    .iso()
                    .format("YYYY-MM-DD")
                    .optional()
                    .allow("", null)
                    .error(
                        new Error(
                            "Promo period start must be a valid format 'YYYY-MM-DD'"
                        )
                    ),
                promo_period_end: Joi.date()
                    .iso()
                    .format("YYYY-MM-DD")
                    .when("promo_period_start", {
                        is: Joi.date().empty(null),
                        then: Joi.date()
                            .iso()
                            .min(Joi.ref("promo_period_start"))
                            .required()
                            .error(
                                new Error(
                                    "Promo period end must be a valid format 'YYYY-MM-DD' and greater than or equal to promo period start"
                                )
                            ),
                        otherwise: Joi.optional()
                            .allow("")
                            .error(
                                new Error(
                                    "Promo period end must be a valid format 'YYYY-MM-DD' and greater than or equal to promo period start"
                                )
                            ),
                    }),
            }),
            sell_rates: Joi.array().items(
                Joi.object({
                    id: Joi.string().optional().allow(""),
                    dom_int: Joi.string()
                        .valid("Domestic", "International")
                        .required()
                        .error(new Error("Domestic/International is required")),
                    payment_methods: Joi.string()
                        .required()
                        .error(new Error("Payment methods sis required")),
                    payment_schemes: Joi.string().optional().allow(""),
                    currency: Joi.string()
                        .required()
                        .error(
                            new Error(
                                "Currency is required and must be comma separated currencies"
                            )
                        ),
                    sell_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(
                            new Error(
                                "Sell rate is required must be greater than 1"
                            )
                        ),
                    sell_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(
                            new Error(
                                "Sell rate percentage is required between 1 and 100"
                            )
                    ),
                    paydart_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(
                            new Error(
                                "Sell rate is required must be greater than 1"
                            )
                        ),
                    paydart_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(
                            new Error(
                                "Sell rate percentage is required between 1 and 100"
                            )
                        ),
                    tax: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(
                            new Error("Tax must is required between 0 and 100")
                        ),
                })
            ),
            promo_sell_rates: Joi.array()
                .items(
                    Joi.object({
                        id: Joi.string().optional().allow(""),
                        dom_int: Joi.string()
                            .valid("Domestic", "International")
                            .required()
                            .error(
                                new Error("Domestic/International is required")
                            ),
                        payment_methods: Joi.string()
                            .required()
                            .error(new Error("Payment methods is required")),
                        payment_schemes: Joi.string().optional().allow(""),
                        currency: Joi.string()
                            .required()
                            .error(
                                new Error(
                                    "Currency is required and must be comma separated currencies"
                                )
                            ),
                        promo_sell_rate_per: Joi.number()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error(
                                    "Promo sell rate percentage must be between 0 and 100"
                                )
                            ),
                        promo_sell_rate_fix: Joi.number()
                            .min(0)
                            .required()
                            .error(
                                new Error("Promo sell rate fix is required")
                            ),
                        paydart_rate_per: Joi.number()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error(
                                    "Promo paydart rate percentage must be between 0 and 100"
                                )
                            ),
                        paydart_rate_fix: Joi.number()
                            .min(0)
                            .required()
                            .error(
                                new Error("Promo paydart rate fix is required")
                            ),
                        promo_tax: Joi.number()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error("Promo tax must be between 0 and 100")
                            ),
                    })
                )
                .when("master_data.promo_period_start", {
                    is: Joi.date().empty(null),
                    then: Joi.required().error(
                        new Error("Promo sell rates are required")
                    ),
                    otherwise: Joi.optional().allow(""),
                }),
        });

        try {
            let condition = {
                deleted: 0,
                mid: await enc_dec.cjs_decrypt(req.body.master_data.mid),
                plan_id: await enc_dec.cjs_decrypt(
                    req.body.master_data.plan_id
                ),
            };

            if (req.body?.master_data?.id) {
                let plan_id = await helpers.get_data_list(
                    "plan_id",
                    "master_mid_sellrate",
                    { id: enc_dec.cjs_decrypt(req.body.master_data?.id) }
                );
                
                

                if (
                    plan_id[0]?.plan_id !=
                    enc_dec.cjs_decrypt(req.body.master_data?.plan_id)
                ) {
                    
                    await helpers.common_delete(
                        {
                            master_mid_sellrate_id: enc_dec.cjs_decrypt(
                                req.body.master_data?.id
                            ),
                        },
                        "mid_sellrate"
                    );
                    await helpers.common_delete(
                        {
                            master_mid_sellrate_id: enc_dec.cjs_decrypt(
                                req.body.master_data?.id
                            ),
                        },
                        "mid_promo_sellrate"
                    );
                }
            }

            if (req.body?.master_data?.id) {
                let promo_data = await helpers.get_data_list(
                    "*",
                    "mid_promo_sellrate",
                    {
                        master_mid_sellrate_id: enc_dec.cjs_decrypt(
                            req.body?.master_data?.id
                        ),
                        deleted: 0,
                    }
                );
                if (promo_data.length > 0 && !req.body?.promo_sell_rates) {
                    await helpers.common_delete(
                        {
                            master_mid_sellrate_id: enc_dec.cjs_decrypt(
                                req.body?.master_data?.id
                            ),
                        },
                        "mid_promo_sellrate"
                    );
                }
            }

            let master_available = await helpers.check_if_data_exist(
                condition,
                req.body.master_data.currency,
                "master_mid_sellrate"
            );
            

            let fail_buy_rate = 0;
            let fail_promo_buy_rate = 0;
            if (req.body.master_data?.id) {
                for (let item of req.body.sell_rates) {
                    
                    if (!item.id) {
                        let condition = {
                            dom_int: item.dom_int,
                            payment_methods: item.payment_methods,
                            payment_schemes: item.payment_schemes,
                            deleted: 0,
                        };
                        if (req.body?.master_data?.id) {
                            condition.master_mid_sellrate_id =
                                await enc_dec.cjs_decrypt(
                                    req.body?.master_data?.id
                                );
                        }
                        let data_available = await helpers.check_if_data_exist(
                            condition,
                            item.currency,
                            "mid_sellrate"
                        );
                        
                        if (data_available) {
                            fail_buy_rate++;
                        }
                    }
                }
            }

            
            if (req.body?.master_data?.id) {
                if (req.body.promo_sell_rates) {
                    for (let item of req.body.promo_sell_rates) {
                        if (!item.id) {
                            let condition = {
                                dom_int: item.dom_int,
                                payment_methods: item.payment_methods,
                                payment_schemes: item.payment_schemes,
                                deleted: 0,
                            };

                            if (req.body?.master_data?.id) {
                                condition.master_mid_sellrate_id =
                                    await enc_dec.cjs_decrypt(
                                        req.body?.master_data?.id
                                    );
                            }

                            let data_available =
                                await helpers.check_if_data_exist(
                                    condition,
                                    item.currency,
                                    "mid_promo_sellrate"
                                );
                            
                            if (data_available) {
                                fail_promo_buy_rate++;
                            }
                        }
                    }
                }

                
            }

            const result = schema.validate(req.body);
            if (result.error) {
                
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else if (master_available && !req.body.master_data.id) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg("Currency already exist")
                );
            } else if (fail_buy_rate > 0) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg("Sell rate data already exist")
                );
            } else if (fail_promo_buy_rate > 0) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(
                        "Promo Sell rate data already exist"
                    )
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
    add_salerate: async (req, res, next) => {
        const schema = Joi.object({
            data: Joi.array().items(
                Joi.object({
                    id: Joi.string().optional().allow(""),
                    submerchant_id: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Submerchant id is required");
                        }),
                    psp: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("PSP is required");
                        }),
                    mid: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("MID is required");
                        }),
                    dom_int: Joi.string()
                        .valid("Domestic", "International")
                        .required()
                        .error(() => {
                            return new Error(
                                "Domestic/International is required"
                            );
                        }),
                    payment_methods: Joi.string()
                        .optional()
                        .allow("")
                        .error(() => {
                            return new Error(
                                "Payment methods should only contain accepted values (Credit card, Debit card, Wallet, Net Banking, BNPL, Virtual card, Prepaid card) once"
                            );
                        }),
                    payment_schemes: Joi.string()
                        .optional()
                        .allow("")
                        .error(() => {
                            return new Error(
                                "Payment schemes should only contain accepted values (Visa, Master, Amex, Diner) once"
                            );
                        }),
                    currency: Joi.string()
                        .trim()
                        .length(3)
                        .uppercase()
                        .required()
                        .error(() => {
                            return new Error("Currency required.");
                        }),
                    sale_rate_fix: Joi.number()
                        .min(0)
                        .required()
                        .error(() => {
                            return new Error(
                                "Buy rate fix must be a positive number"
                            );
                        }),
                    sale_rate_per: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error(
                                "Buy rate percentage must be between 1 and 100"
                            );
                        }),
                    tax: Joi.number()
                        .min(0)
                        .max(100)
                        .required()
                        .error(() => {
                            return new Error("Tax must be between 1 and 100");
                        }),
                })
            ),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
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

    add_master_sellrate: async (req, res, next) => {
        const schema = Joi.object({
            plan_id: Joi.string()
                .required()
                .error(new Error("Plan id is required")),
            submerchant_id: Joi.string()
                .required()
                .error(new Error("submerchant id is required")),
            setup_fee: Joi.number()
                .min(0)
                .required()
                .error(new Error("setup fee is required")),
            // mid_active_fee: Joi.number()
            //     .min(1)
            //     .required()
            //     .error(new Error("mid active fee is required")),
            num_of_free_mid: Joi.number()
                .min(0)
                .required()
                .error(new Error("Number of free MID required")),
            currency: Joi.string()
                .required()
                .error(
                    new Error(
                        "Currency is required and must be comma separated currencies"
                    )
                ),
            country_id: Joi.number()
                .required()
                .error(new Error("Country is required")),
            buy_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy account fee is required")),
            sell_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Sell account fee is required")),
            buy_setup_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy setup fee is required")),
            // sell_setup_fee: Joi.number()
            //     .required()
            //     .min(0)
            //     .error(new Error("Sell setup fee is required")),
            country_id: Joi.number()
                .required()
                .error(new Error("Country is required")),
            buy_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy account fee is required")),
            buy_setup_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy setup fee is required")),
            sell_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Sell account fee is required")),
            sell_account_fee_type: Joi.string()
                .required()
                .error(new Error("Sell account fee type is required")),
            buy_account_fee_type: Joi.string()
                .required()
                .error(new Error("Buy account fee is required")),
        });
        try {
            let condition = {
                deleted: 0,
                plan_id: await enc_dec.cjs_decrypt(req.body.plan_id),
                submerchant_id: await enc_dec.cjs_decrypt(
                    req.body.submerchant_id
                ),
            };
            let data_available = await checkifrecordexist(
                condition,
                "master_subm_sellrate"
            );
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else if (data_available) {
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

    list_sbm_sellrate_details_all: async (req, res, next) => {
        if (checkEmpty(req.body, ["submerchant_id"])) {
            const schema = Joi.object().keys({
                submerchant_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid submerchant id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("submerchant_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { submerchant_id: record_id },
                        "master_subm_sellrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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

    update_master_sellrate: async (req, res, next) => {
        
        const schema = Joi.object({
            master_subm_sellrate_id: Joi.string()
                .required()
                .error(new Error("Master sellrate id is required")),
            plan_id: Joi.string()
                .required()
                .error(new Error("Plan id is required")),
            submerchant_id: Joi.string()
                .required()
                .error(new Error("submerchant id is required")),
            setup_fee: Joi.number()
                .min(0)
                .required()
                .error(new Error("setup fee is required")),
            // mid_active_fee: Joi.number()
            //     .min(1)
            //     .required()
            //     .error(new Error("mid active fee is required")),
            num_of_free_mid: Joi.number()
                .min(0)
                .required()
                .error(new Error("Number of free MID required")),
            currency: Joi.string()
                .required()
                .error(
                    new Error(
                        "Currency is required and must be comma separated currencies"
                    )
                ),
            country_id: Joi.number()
                .required()
                .error(new Error("Country is required")),
            buy_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy account fee is required")),
            buy_setup_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Buy setup fee is required")),
            sell_account_fee: Joi.number()
                .required()
                .min(0)
                .error(new Error("Sell account fee is required")),
            sell_account_fee_type: Joi.string()
                .required()
                .error(new Error("Sell account fee type is required")),
            buy_account_fee_type: Joi.string()
                .required()
                .error(new Error("Buy account fee is required")),
        });
        try {
            let master_subm_sellrate_id = enc_dec.cjs_decrypt(
                req.body.master_subm_sellrate_id
            );

            let master_data = await helpers.get_data_list(
                "*",
                "master_subm_sellrate",
                {
                    id: master_subm_sellrate_id,
                }
            );

            if (
                master_data[0].plan_id != enc_dec.cjs_decrypt(req.body.plan_id)
            ) {
                await helpers.common_delete(
                    { master_subm_sellrate_id: master_subm_sellrate_id },
                    "subm_sellrate"
                );
            }

            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
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

    add_sellrate: async (req, res, next) => {
        const schema = Joi.object({
            data: Joi.array()
                .items(
                    Joi.object({
                        id: Joi.string().optional().allow(""),
                        master_subm_sellrate_id: Joi.string()
                            .required()
                            .error(
                                new Error(
                                    "master submarvhent sell rate id is required"
                                )
                            ),
                        features: Joi.string()
                            .required()
                            .error(new Error("features is required")),
                        sell_rate_per: Joi.string()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error(
                                    "Sell rate percentage is required between 1 - 100"
                                )
                            ),
                        sell_rate_fix: Joi.string()
                            .min(1)
                            .required()
                            .error(new Error("Sell rate fix is required")),
                        tax: Joi.string()
                            .min(0)
                            .max(100)
                            .required()
                            .error(
                                new Error("Tax is required between 1 - 100")
                        )
                    })
                )
                .required()
                .error(new Error("Invalid or missing data array")),
        });
        try {
            let fail = 0;
            for (let item of req.body.data) {
                if (!item.id) {
                    let condition = {
                        deleted: 0,
                        master_subm_sellrate_id: await enc_dec.cjs_decrypt(
                            item.master_subm_sellrate_id
                        ),
                        features: item.features,
                    };
                    let data_available = await checkifrecordexist(
                        condition,
                        "subm_sellrate"
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

    get: async (req, res, next) => {
        const schema = Joi.object().keys({
            psp_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("PSP id Required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                if (req.bodyString("psp_id")) {
                    let psp_id = await enc_dec.cjs_decrypt(
                        req.bodyString("psp_id")
                    );
                    let psp_exits = await idChecker(psp_id, "psp");
                    if (!psp_exits)
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse("Invalid psp id")
                        );
                }
                next();
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    update: async (req, res, next) => {
        const schema = Joi.object().keys({
            psp_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("PSP id Required");
                }),
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Country is required");
                }),
            name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Name Required");
                }),
            email_to: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Email Required");
                }),
            cc: Joi.string()
                .email({ multiple: true })
                .allow("")
                .error(() => {
                    return new Error("Valid cc email Required");
                }),
            ekyc_required: Joi.string()
                .required()
                .error(() => {
                    return new Error("Ekyc Required");
                }),
                domestic: Joi.string()
                .required()
                .error(() => {
                    return new Error("Ekyc Required");
                }),
                international: Joi.string()
                .required()
                .error(() => {
                    return new Error("Ekyc Required");
                }),
            threshold_value: Joi.number()
                .required()
                .error(() => {
                    return new Error("Threshold value Required");
                }),
            mcc: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid cc email Required");
                }),
            mcc_category: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid mcc category Required");
                }),
            files: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid file required");
                }),
            min_bps: Joi.number()
                .required()
                .error(() => {
                    return new Error("Min. BPS value Required");
                }),
            min_revenue: Joi.number()
                .required()
                .error(() => {
                    return new Error("Min. Revenue value Required");
                }),
            remark: Joi.string()
                .max(200)
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid remark required (max 200 characters)"
                    );
                }),
            payment_schemes: Joi.string()
                .optional()
                .allow("")
                // .regex(
                //     /^(Visa|Master|Amex|Diner)(,(?!\1)(Visa|Master|Amex|Diner)){0,3}$/
                // )
                .error(() => {
                    return new Error(
                        "Should only contain accepted payment schemes (Visa, Master, Amex, Diner) once"
                    );
                }),
            payment_methods: Joi.string()
                .optional()
                .allow("")
                // .regex(
                //     /^(Credit card|Debit card|Wallet|Net Banking|BNPL|Virtual card|Prepaid card)(,(?!\1)(Credit card|Debit card|Wallet|Net Banking|BNPL|Virtual card|Prepaid card)){0,6}$/
                // )
                .error(() => {
                    return new Error(
                        "Should only contain accepted payment methods (Credit card, Debit card, Wallet, Net Banking, BNPL, Virtual card, Prepaid card) once"
                    );
                }),
            transaction_allowed_daily: Joi.number()
                .required()
                .error(() => {
                    return new Error("Daily transaction value Required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                if (req.bodyString("psp_id")) {
                    let psp_id = enc_dec.cjs_decrypt(req.bodyString("psp_id"));
                    let psp_exits = await idChecker(psp_id, "psp");
                    if (!psp_exits)
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse("Invalid psp id")
                        );
                }
                let cc = req.bodyString("cc");
                let cc_error = false;
                if (cc != "") {
                    let cc_array = cc.split(",");
                    if (cc_array.length > 5) {
                        cc_error = true;
                    }
                }
                if (!cc_error) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Maximum 5 emails are allowed in cc"
                        )
                    );
                }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    deactivate: async (req, res, next) => {
        if (checkEmpty(req.body, ["psp_id"])) {
            const schema = Joi.object().keys({
                psp_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Valid psp ID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("psp_id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 0, deleted: 0 },
                        "psp"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found or already deactivated."
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
    activate: async (req, res, next) => {
        if (checkEmpty(req.body, ["psp_id"])) {
            const schema = Joi.object().keys({
                psp_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Valid psp ID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("psp_id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 1, deleted: 0 },
                        "psp"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found or already activated."
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
    delete: async (req, res, next) => {
        if (checkEmpty(req.body, ["psp_id"])) {
            const schema = Joi.object().keys({
                psp_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Valid psp ID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("psp_id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, deleted: 0 },
                        "psp"
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
    delete_buyrate: async (req, res, next) => {
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
                        "psp_buyrate"
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
    delete_sellrate: async (req, res, next) => {
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
                        "mid_sellrate"
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
    delete_promo_buyrate: async (req, res, next) => {
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
                        "psp_promo_buyrate"
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
    delete_promo_sellrate: async (req, res, next) => {
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
                        "mid_promo_sellrate"
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
    delete_salerate: async (req, res, next) => {
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
                        "master_psp_salerate"
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
    list_buyrate: async (req, res, next) => {
        if (checkEmpty(req.body, ["psp"])) {
            const schema = Joi.object().keys({
                psp: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid psp required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.bodyString("psp");
                    let record_exist = await checkifrecordexist(
                        { psp: record_id },
                        "master_buy_rate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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

    list_buyrate_details: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_id"])) {
            const schema = Joi.object().keys({
                master_buyrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master buyrate id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_buyrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id },
                        "master_buyrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    list_sellrate_details: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_mid_sellrate_id"])) {
            const schema = Joi.object().keys({
                master_mid_sellrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master sellrate id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_mid_sellrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id },
                        "master_mid_sellrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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

    list_sellrate_details_all: async (req, res, next) => {
        if (checkEmpty(req.body, ["mid"])) {
            const schema = Joi.object().keys({
                mid: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid MID required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("mid")
                    );
                    let record_exist = await checkifrecordexist(
                        { mid: record_id },
                        "master_mid_sellrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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

    psp_buyrate: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_id"])) {
            const schema = Joi.object().keys({
                master_buyrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_buyrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { master_buyrate_id: record_id },
                        "psp_buyrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    mid_sellrate: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_mid_sellrate_id"])) {
            const schema = Joi.object().keys({
                master_mid_sellrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_mid_sellrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { master_mid_sellrate_id: record_id },
                        "mid_sellrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    psp_promo_buyrate: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_id"])) {
            const schema = Joi.object().keys({
                master_buyrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master buyrate id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_buyrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { master_buyrate_id: record_id },
                        "psp_promo_buyrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    psp_promo_sellrate: async (req, res, next) => {
        if (checkEmpty(req.body, ["master_mid_sellrate_id"])) {
            const schema = Joi.object().keys({
                master_mid_sellrate_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid master buyrate id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("master_mid_sellrate_id")
                    );
                    let record_exist = await checkifrecordexist(
                        { master_mid_sellrate_id: record_id },
                        "mid_promo_sellrate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    list_salerate: async (req, res, next) => {
        if (checkEmpty(req.body, ["psp"])) {
            const schema = Joi.object().keys({
                psp: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid psp required");
                    }),
                submerchant_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Submerchant id is required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.bodyString("psp");
                    let record_exist = await checkifrecordexist(
                        {
                            psp: record_id,
                            submerchant_id: enc_dec.cjs_decrypt(
                                req.bodyString("submerchant_id")
                            ),
                            deleted: 0,
                        },
                        "master_psp_salerate"
                    );
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
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
    routing_mid: async (req, res, next) => {
        const schema = Joi.object().keys({
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Submerchant id is required");
                }),
            method: Joi.string()
                .required()
                .error(() => {
                    return new Error("Payment method is required");
                }),
            env: Joi.string()
                .required()
                .error(() => {
                    return new Error("Env is required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }
            next();
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    routing_rule: async (req, res, next) => {
        const schema = Joi.object().keys({
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Submerchant id is required");
                }),
            method: Joi.string()
                .required()
                .error(() => {
                    return new Error("Payment method is required");
                }),
            env: Joi.string()
                .required()
                .error(() => {
                    return new Error("Env is required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }
            next();
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    routing_store: async (req, res, next) => {
        console.log('here in store');
        const schema = Joi.object().keys({
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Submerchant id is required");
                }),
            env: Joi.string()
                .required()
                .error(() => {
                    return new Error("Env is required");
                }),
            payment_method: Joi.string()
                .required()
                .error(() => {
                    return new Error("Payment method is required");
                }),
            mid_id: Joi.array().items(Joi.string())
                .error(() => {
                    return new Error("MID is required");
                }),
            retry: Joi.string()
                .required()
                .error(() => {
                    return new Error("retry is required");
                }),
            cascade: Joi.string()
                .required()
                .error(() => {
                    return new Error("cascade is required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }
            next();
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    }
};
module.exports = PspValidator;
