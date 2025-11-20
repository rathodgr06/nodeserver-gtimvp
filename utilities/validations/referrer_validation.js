const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const enc_dec = require("../decryptor/decryptor");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkRecordExits = require("../validations/checkifrecordexist");
const checkifrecordexistandexpiration = require("../../utilities/validations/checkifrecordexistandexpiration");
const checkifrecordexist = require("../validations/checkifrecordexist");
let iban_expression = new RegExp(
    /^[a-zA-Z]{2}[0-9]{2}\s?[a-zA-Z0-9]{4}\s?[0-9]{4}\s?[0-9]{3}([a-zA-Z0-9]\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,3})?$/
);
const logger = require('../../config/logger');

const ReferrerValidator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Name required");
                }),
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Enter valid email address");
                }),
            mobile_code: Joi.string()
                .required()
                .error(() => {
                    return new Error("Mobile code required");
                }),
            mobile_no: Joi.number()
                .integer()
                .min(1000)
                .max(99999999999)
                .required()
                .error(() => {
                    return new Error("Valid mobile no  required");
                }),
            password: Joi.string()
                .min(8)
                .max(15)
                .required()
                .pattern(
                    new RegExp(
                        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$_!%*?&])[A-Za-z\d$@$_!%*#?&]{8,}$/
                    )
                )
                .messages({
                    "string.pattern.base":
                        "Password should contain at least 8 characters long, one alphabet, one number and one special character,no white-spaces.",
                    "string.empty": "Password should not be an empty",
                    "any.required": "Password required",
                    "string.max":
                        "Password must have a maximum of 15 characters",
                }),

            confirm_password: Joi.any()
                .equal(Joi.ref("password"))
                .required()
                .label("Confirm password")
                .options({
                    messages: { "any.only": "Confirm password does not match with entered password" },
                }),
            currency: Joi.string()
                .currency()
                .allow("")
                .error(() => {
                    return new Error("Valid currency  required");
                }),
            bank_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid bank name required");
                }),
            branch_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid branch name required");
                }),
            name_on_the_bank_account: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid name on the bank account required");
                }),
            bic_swift: Joi.alternatives().conditional("bank_account_no", {
                is: "",
                then: Joi.optional().allow(""),

                otherwise: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("BIC/SWIFT required.");
                    }),
            }),
            bank_account_no: Joi.alternatives().conditional("bic_swift", {
                is: "",
                then: Joi.string().optional().allow(""),
                otherwise: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Account number required.");
                    }),
            }),
            iban: Joi.alternatives().conditional("iban", {
                is: "",
                then: Joi.string().optional().allow(""),
                otherwise: Joi.alternatives().conditional(
                    ("bic_swift", "bank_account_no"),
                    {
                        is: "",
                        then: Joi.string()
                            .pattern(iban_expression)
                            .required()
                            .messages({
                                "string.pattern.base":
                                    "IBAN must follow this pattern ( AT61 1904 3002 3457 3201 or AT61 1904 3002 3457 ) with and without the space.",
                                "string.empty":
                                    "If Account number and BIC/SWIFT fields are blank, an IBAN will be required.",
                                "any.required":
                                    "If Account number and BIC/SWIFT fields are blank, an IBAN will be required.",
                            }),
                        otherwise: Joi.string()
                            .optional()
                            .error(() => {
                                return new Error("IBAN is optional.");
                            }),
                    }
                ),
            }),
            // bank_account_no: Joi.string().allow('').error(() => {
            //     return new Error("Valid bank account no  required")
            // }),
            address: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid iban no required");
                }),
            country: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid country required");
                }),
            state: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid state required");
                }),
            city: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid city required");
                }),
            zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid zip code required");
                }),
            // iban: Joi.string().optional().allow('').error(() => {
            //     return new Error("Valid IBAN required")
            // }),
            // bic_swift: Joi.string().optional().allow('').error(() => {
            //     return new Error("Valid BIC/SWIFT required")
            // }),
            national_id: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid national id required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let email_exits = await checkRecordExits(
                    { email: req.bodyString("email"), deleted: 0 },
                    "referrers"
                );
                let mobile_no_exits = await checkRecordExits(
                    {
                        mobile_no: req.bodyString("mobile_no"),
                        mobile_code: req.bodyString("mobile_code"),
                        deleted: 0,
                    },
                    "referrers"
                );
                if (!email_exits) {
                    next();
                } else {
                    if (email_exits) {
                        res.status(StatusCode.ok).send(
                            ServerResponse.errormsg(
                                "Referrer with email already exits"
                            )
                        );

                     } 
                    //else {
                    //     res.status(StatusCode.ok).send(
                    //         ServerResponse.errormsg(
                    //             "Referrer with mobile no already exits"
                    //         )
                    //     );
                    // }
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    get: async (req, res, next) => {
        const schema = Joi.object().keys({
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Record not exits.")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    delete: async (req, res, next) => {
        const schema = Joi.object().keys({
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id, deleted: 0 },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg(
                            "Record not exits or already deleted."
                        )
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    update: async (req, res, next) => {
        
        const schema = Joi.object().keys({
            name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Name required");
                }),
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Enter valid email address");
                }),
            mobile_code: Joi.string()
                .required()
                .error(() => {
                    return new Error("Mobile code required");
                }),
            mobile_no: Joi.number()
                .integer()
                .min(10000000)
                .max(99999999999)
                .required()
                .error(() => {
                    return new Error("Valid mobile no  required");
                }),
            currency: Joi.string()
                .currency()
                .allow("")
                .error(() => {
                    return new Error("Valid currency  required");
                }),
            bank_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid bank name required");
                }),
            name_on_the_bank_account: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid name on the bank account required");
                }),
            branch_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid branch required");
                }),
            bic_swift: Joi.alternatives().conditional("bank_account_no", {
                is: "",
                then: Joi.optional().allow(""),

                otherwise: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("BIC/SWIFT required.");
                    }),
            }),
            bank_account_no: Joi.alternatives().conditional("bic_swift", {
                is: "",
                then: Joi.string().optional().allow(""),
                otherwise: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Account number required.");
                    }),
            }),
            iban: Joi.alternatives().conditional("iban", {
                is: "",
                then: Joi.string().optional().allow(""),
                otherwise: Joi.alternatives().conditional(
                    ("bic_swift", "bank_account_no"),
                    {
                        is: "",
                        then: Joi.string()
                            .required()
                            .pattern(iban_expression)
                            .messages({
                                "string.pattern.base":
                                    "IBAN must follow this pattern ( AT61 1904 3002 3457 3201 or AT61 1904 3002 3457 ) with and without the space.",
                                "string.empty":
                                    "If Account number and BIC/SWIFT fields are blank, an IBAN will be required.",
                                "any.required":
                                    "If Account number and BIC/SWIFT fields are blank, an IBAN will be required.",
                            }),
                        otherwise: Joi.string()
                            .optional()
                            .error(() => {
                                return new Error("IBAN is optional.");
                            }),
                    }
                ),
            }),
            address: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid iban no required");
                }),
            national_id: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid national id required");
                }),
            bank_detail_document: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid bank details document required");
                }),
            country: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid country required");
                }),
            state: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid state required");
                }),
            city: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid city required");
                }),
            zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid zip code required");
                }),

            fix_amount_for_reference: Joi.number()
                .precision(2)
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per successful reference required"
                    );
                }),
            fix_amount: Joi.number()
                .precision(2)
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per transaction required"
                    );
                }),
            per_amount: Joi.number()
                .precision(2)
                .min(0)
                .max(100)
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid percentage of transaction amount required"
                    );
                }),
            apply_greater: Joi.number()
                .integer()
                .min(0)
                .max(1)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid apply greater required");
                }),
            settlement_frequency: Joi.string()
                .optional()
                .error(() => {
                    return new Error("Settlement frequency required");
                }),
            settlement_date: Joi.number()
                .integer()
                .min(0)
                .max(31)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid settlement date required");
                }),
            calculate_bonus_till: Joi.number()
                .integer()
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid no. of days for per transaction wise bonus required"
                    );
                }),
            tax_per: Joi.number()
                .precision(2)
                .min(0)
                .max(100)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Valid tax percentage required");
                }),
            status: Joi.number()
                .min(0)
                .max(1)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Status should be 0 or 1");
                }),
            referral_status: Joi.number()
                .min(0)
                .max(1)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Referral Status should be 0 or 1");
                }),
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
                expiry_date: Joi.date()
                .format("YYYY-MM-DD")
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Expiry date required or use YYYY-MM-DD format.");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Record not exits")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    activate: async (req, res, next) => {
        const schema = Joi.object().keys({
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id, deleted: 0, status: 1 },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg(
                            "Record not exits or already activated."
                        )
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    deactivate: async (req, res, next) => {
        const schema = Joi.object().keys({
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id, deleted: 0, status: 0 },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg(
                            "Record not exits or already deactivated."
                        )
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    approve: async (req, res, next) => {
        const schema = Joi.object().keys({
            referrer_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referrer id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id, deleted: 0, is_approved: 0 },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg(
                            "Record not exits or already approved."
                        )
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    onboard: async (req, res, next) => {
        const schema = Joi.object().keys({
            referral_code: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referral code required");
                }),
            perpage: Joi.string()
                .required()
                .error(() => {
                    return new Error("perpage required");
                }),
            page: Joi.string()
                .required()
                .error(() => {
                    return new Error("page required");
                }),
            search: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("search required");
                }),
                ekyc_status: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("ekyc_status required");
                }),
                submerchant_id: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("submerchant_id required");
                }),
            from_date: Joi.date()
                .format("YYYY-MM-DD")
                .optional()
                .allow("")
                .error(() => {
                    return new Error("onboard date required");
                }),
            to_date: Joi.date()
                .format("YYYY-MM-DD")
                .optional()
                .allow("")
                .error(() => {
                    return new Error("onboard date required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = req.bodyString("referral_code");
                let record_exits = await checkRecordExits(
                    { referral_code: record_id },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Invalid referral code")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    reset_referrer_password: async (req, res, next) => {
        const schema = Joi.object().keys({
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let email_exits = await checkifrecordexist(
                    { email: req.bodyString("email") },
                    "referrers"
                );
                if (!email_exits) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.successmsg(
                            `If your account is identified, you will be receiving an email to change your password.`
                        )
                    );
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    forgot_2fa: async (req, res, next) => {
        const schema = Joi.object().keys({
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let email_exits = await checkifrecordexist(
                    { email: req.bodyString("email") },
                    "referrers"
                );
                if (!email_exits) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.successmsg(
                            `If your account is identified, you will be receiving an email to reset 2fa.`
                        )
                    );
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    verify_link: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid token required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let link_valid = await checkifrecordexistandexpiration(
                    { token: req.bodyString("token"), is_expired: 0 },
                    "master_referrer_password_reset"
                );
                if (link_valid) {
                    res.status(StatusCode.ok).send(
                        ServerResponse.successmsg(
                            "link is valid, please reset password"
                        )
                    );
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("link expired or invalid token")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    reset_password: async (req, res, next) => {
        const schema = Joi.object().keys({
            password: Joi.string()
                .min(8)
                .max(15)
                .required()
                .pattern(
                    new RegExp(
                        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$_!%*?&])[A-Za-z\d$@$_!%*#?&]{8,}$/
                    )
                )
                .messages({
                    "string.pattern.base":
                        "Password should contain at least 8 characters long, one alphabet, one number and one special character,no white-spaces.",
                    "string.empty": "Password should not be an empty",
                    "any.required": "Password required",
                    "string.max":
                        "Password must have a maximum of 15 characters",
                }),
            confirm_password: Joi.any()
                .equal(Joi.ref("password"))
                .required()
                .label("Confirm password")
                .options({
                    messages: { "any.only": "{{#label}} does not match" },
                }),
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid token required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let link_valid = await checkifrecordexistandexpiration(
                    { token: req.bodyString("token"), is_expired: 0 },
                    "master_referrer_password_reset"
                );
                if (link_valid) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("link expired or invalid token")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    twoFa: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = req.bodyString("token");
                let record_exits = await checkRecordExits(
                    { token: record_id, is_expired: 0 },
                    "twofa_referrer"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Invalid token.")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    verify_2fa: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token required");
                }),
            pin: Joi.string()
                .length(6)
                .pattern(/^[0-9]+$/)
                .required()
                .error(() => {
                    return new Error("Valid Pin Required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let link_valid = await checkifrecordexistandexpiration(
                    { token: req.bodyString("token"), is_expired: 0 },
                    "twofa_referrer"
                );
                if (link_valid) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg(
                            "Token is not valid or expired."
                        )
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    login: async (req, res, next) => {
        const schema = Joi.object().keys({
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
            password: Joi.string()
                .required()
                .error(() => {
                    return new Error("Password Required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let email_exits = await checkRecordExits(
                    { email: req.bodyString("email"), deleted: 0 },
                    "referrers"
                );
                let deactive_account = await checkRecordExits(
                    { email: req.bodyString("email"), status: 1 },
                    "referrers"
                );

                if (!email_exits || deactive_account) {
                    if (!email_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                `Account is not registered`
                            )
                        );
                    } else if (deactive_account) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                `Referrer is not active`
                            )
                        );
                    }
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    update_profile: async (req, res, next) => {
        const schema = Joi.object().keys({
            name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Name required");
                }),
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Email required");
                }),
            mobile_code: Joi.string()
                .required()
                .error(() => {
                    return new Error("Mobile code required");
                }),
            mobile_no: Joi.number()
                .integer()
                .min(10000000)
                .max(99999999999)
                .required()
                .error(() => {
                    return new Error("Valid mobile no  required");
                }),
            currency: Joi.string()
                .currency()
                .allow("")
                .error(() => {
                    return new Error("Valid currency  required");
                }),
            bank_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid bank name required");
                }),
            branch_name: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid branch name required");
                }),
            bank_account_no: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid bank account no  required");
                }),
            address: Joi.string()
                .allow("")
                .error(() => {
                    return new Error("Valid iban no required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referrer_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id },
                    "referrers"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Record not exits")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
};
module.exports = ReferrerValidator;
