const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const enc_dec = require("../decryptor/decryptor");
const checkEmpty = require("./emptyChecker");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkRecordExits = require("../validations/checkifrecordexist");
const checkifrecordexist = require("./checkifrecordexist");
const subs_plan_model = require("../../models/subs_plan_model");
const helpers = require("../helper/general_helper");
const checkPlanDetails = require("../validations/checkPlanDetails");
const checkSubscriptionOfCustomer = require("../validations/check_subscription_for_customer");
const subscription_check = require("../validations/subscription_check");
const statusCode = require("../../utilities/statuscode/index");
const response = require("../../utilities/response/ServerResponse");
const moment = require("moment");
const SubscriptionPlan = {
    add: async (req, res, next) => {
        const billing_freq = ["yearly", "monthly", "weekly", "daily"];
        const schema = Joi.object().keys({
            plan_name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Plan name not valid/not supplied");
                }),
            plan_description: Joi.string().error(() => {
                return new Error("Plan description required");
            }),
            plan_billing_frequency: Joi.string()
                .valid(...billing_freq)
                .required()
                .error(() => {
                    return new Error(
                        "Billing frequency not valid/not supplied"
                    );
                }),
            currency: Joi.string()
                .currency()
                .required()
                .error(() => {
                    return new Error("Currency not valid/not supplied");
                }),
            plan_billing_amount: Joi.number()
                .required()
                .min(1)
                .error(() => {
                    return new Error("Billing amount not valid/not supplied");
                }),
            note: Joi.string()
                .required()
                .error(() => {
                    return new Error("Note not valid/not supplied");
                }),

            payment_interval: Joi.number()
                .required()
                .error(() => {
                    return new Error("Payment interval not valid/not supplied");
                }),
            initial_payment_amount: Joi.number()
                .required()
                .error(() => {
                    return new Error("Initial payment not valid/not supplied");
                }),
            start_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .required()
                .error(() => {
                    return new Error("Start date not valid/not supplied");
                }),
            terms: Joi.number()
                .required()
                .error(() => {
                    return new Error("Terms not valid/not supplied");
                }),
            final_payment_amount: Joi.number()
                .required()
                .error(() => {
                    return new Error("Final payment not valid/not supplied");
                }),
            submerchant_id: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Sub-merchant id required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result.error.message,
                };
                let common_err = await helpers.get_common_response(payload);
                

                res.status(StatusCode.ok).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );

                // res.status(StatusCode.ok).send(
                //     ServerResponse.errormsg(result.error.message)
                // );
            } else {
                let plan_name = req.bodyString("plan_name");
                let plan_billing_frequency = req.bodyString(
                    "plan_billing_frequency"
                );

                let data_exist = await checkifrecordexist(
                    {
                        plan_billing_frequency: plan_billing_frequency,
                        plan_name: plan_name,
                        plan_currency: req.bodyString("currency"),
                        plan_billing_amount: req.bodyString(
                            "plan_billing_amount"
                        ),
                        merchant_id: req.credentials.super_merchant_id
                            ? req.credentials.super_merchant_id
                            : req.credentials.id,
                        deleted: 0,
                    },
                    "subs_plans"
                );
                if (data_exist) {
                    let payload = {
                        psp_name: "paydart",
                        psp_response_details: "Data already exist",
                    };
                    let common_err = await helpers.get_common_response(payload);
                    

                    res.status(StatusCode.ok).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    );

                    // res.status(StatusCode.badRequest).send(
                    //     ServerResponse.validationResponse("Data already exist")
                    // );
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

    create: async (req, res, next) => {
      
        const billing_freq = ["yearly", "monthly", "weekly", "daily"];
        const schema = Joi.object().keys({
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant id required");
                }),
            plan_name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Plan name not valid/not supplied");
                }),
            plan_description: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Plan description required");
                }),
            currency: Joi.string()
                .currency()
                .required()
                .error(() => {
                    return new Error("Currency not valid/not supplied");
                }),
            plan_billing_amount: Joi.number()
                .required()
                .min(1)
                .error(() => {
                    return new Error("Billing amount not valid/not supplied");
                }),
            payment_interval: Joi.number()
                .required()
                .min(1)
                .error(() => {
                    return new Error("Payment interval valid/not supplied");
                }),
            initial_payment_amount: Joi.number()
                .required()
                .min(0)
                .error(() => {
                    return new Error("Initial payment amount not valid/not supplied");
                }),
            final_payment_amount: Joi.number()
                .required()
                .min(0)
                .error(() => {
                    return new Error("Final payment amount not valid/not supplied");
                }),
            plan_billing_frequency: Joi.string()
                .valid(...billing_freq)
                .required()
                .error(() => {
                    return new Error(
                        "Billing frequency not valid/not supplied"
                    );
                }),
            terms: Joi.number()
                .required()
                .min(1)
                .max(1999)
                .error(() => {
                    return new Error("Terms not valid/not supplied");
                }),
              
            start_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .required()
                .error(() => {
                    return new Error("Start date not valid/not supplied");
                }),
                expiry_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .allow('')
                .optional()
                .error(() => {
                    return new Error("Expiry date not valid/not supplied");
                }),
                discounted_terms: Joi.number()
                .allow('')
                .optional()
                .max(1999)
                .error(() => {
                    return new Error("Discounted Terms not valid/not supplied");
                }),
                discounted_amount: Joi.number()
                .allow('')
                .optional()
                .error(() => {
                    return new Error("Final payment amount not valid/not supplied");
                }),
            note: Joi.string()
            .optional()
            .allow("")
                .error(() => {
                    return new Error("Note not valid/not supplied");
                }),
                payment_terms: Joi.array().items({
                    pay_terms: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Payment schedule terms required.");
                        }),
                        pay_amount: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Payment schedule amount required.");
                        }),
                 
                }),
              mode:Joi.string().optional().allow("")  
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result.error.message,
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.ok).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            } else {
                let plan_name = req.bodyString("plan_name");
                let plan_billing_frequency = req.bodyString(
                    "plan_billing_frequency"
                );
                let data_exist = await checkifrecordexist(
                    {
                        plan_billing_frequency: plan_billing_frequency,
                        plan_name: plan_name,
                        plan_currency: req.bodyString("currency"),
                        plan_billing_amount: req.bodyString(
                            "plan_billing_amount"
                        ),
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                        deleted: 0,
                    },
                    "subs_plans"
                );
                if (data_exist) {
                    let payload = {
                        psp_name: "paydart",
                        psp_response_details: "Data already exist",
                    };
                    let common_err = await helpers.get_common_response(payload);
                    res.status(StatusCode.ok).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
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

    get: async (req, res, next) => {
        const schema = Joi.object().keys({
            subs_plan_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
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
                    req.bodyString("subs_plan_id")
                );
                
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subs_plans"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    delete: async (req, res, next) => {
        const schema = Joi.object().keys({
            subs_plan_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
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
                    req.bodyString("subs_plan_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        deleted: 0,
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subs_plans"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    update: async (req, res, next) => {
        const billing_freq = ["yearly", "monthly", "weekly", "daily"];
        const schema = Joi.object().keys({
            plan_name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Plan name required");
                }),
            plan_description: Joi.string()
            .optional()
            .allow("")
            .error(() => {
                return new Error("Plan description required");
            }),
            plan_no: Joi.string().optional().allow('').error(() => {
                return new Error("Plan no required");
            }),
            plan_billing_frequency: Joi.string()
                .valid(...billing_freq)
                .required()
                .error(() => {
                    return new Error("Plan billing frequency required");
                }),
            currency: Joi.string()
                .currency()
                .required()
                .error(() => {
                    return new Error("Valid plan currency  required");
                }),
            plan_billing_amount: Joi.number()
                .allow("")
                .error(() => {
                    return new Error("Valid plan billing amount required");
                }),
            note: Joi.string()
            .optional()
            .allow("")
                .error(() => {
                    return new Error("Valid note required");
                }),
            subs_plan_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription id required");
                }),

            payment_interval: Joi.number()
                .required()
                .error(() => {
                    return new Error("Valid payment interval required");
                }),
            initial_payment_amount: Joi.number()
                .required()
                .error(() => {
                    return new Error("Valid initial payment amount required");
                }),
            start_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .required()
                .error(() => {
                    return new Error("valid start date required");
                }),
            terms: Joi.number()
                .required()
                .error(() => {
                    return new Error("Valid terms required");
                }),
            final_payment_amount: Joi.number()
                .required()
                .min(0)
                .error(() => {
                    return new Error("Final payment amount not valid/not supplied");
                }),
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant id required");
                }),
                payment_terms: Joi.array().items({
                    pay_terms: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Payment schedule terms required.");
                        }),
                        pay_amount: Joi.string()
                        .required()
                        .error(() => {
                            return new Error("Payment schedule amount required.");
                        }),
                 
                }),
                expiry_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .allow('')
                .optional()
                .error(() => {
                    return new Error("Expiry date not valid/not supplied");
                }),
                discounted_terms: Joi.number()
                .allow('')
                .optional()
                .max(1999)
                .error(() => {
                    return new Error("Discounted Terms not valid/not supplied");
                }),
                discounted_amount: Joi.number()
                .allow('')
                .optional()
                .error(() => {
                    return new Error("Final payment amount not valid/not supplied");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                record_id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
                let plan_name = req.bodyString("plan_name");
                let plan_billing_frequency = req.bodyString(
                    "plan_billing_frequency"
                );

                let data_exist = await checkifrecordexist(
                    {
                        plan_billing_frequency: plan_billing_frequency,
                        plan_name: plan_name,
                        plan_currency: req.bodyString("currency"),
                        plan_billing_amount: req.bodyString(
                            "plan_billing_amount"
                        ),
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                        deleted: 0,
                        "id !=": record_id,
                    },
                    "subs_plans"
                );
                if (data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse("Data already exist.")
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
    activate: async (req, res, next) => {
        const schema = Joi.object().keys({
            subs_plan_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
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
                    req.bodyString("subs_plan_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        deleted: 0,
                        status: 1,
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subs_plans"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    deactivate: async (req, res, next) => {
        const schema = Joi.object().keys({
            subs_plan_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
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
                    req.bodyString("subs_plan_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        deleted: 0,
                        status: 0,
                        merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subs_plans"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    mail_send: async (req, res, next) => {
        let email = req.body.emails.split(",");
        const schema = Joi.object().keys({
            id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Id required");
                }),
            //   {
            //       multiple: true, minDomainSegments: 2, tlds: { allow: ['com', 'net'] }
            //   }
            emails: Joi.string()
                .email({
                    multiple: true,
                })
                .required()
                .error(() => {
                    return new Error("Valid emails required");
                }),

            subject: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subject required");
                }),
            //    message: Joi.string().optional().allow("").error(() => {
            //       return new Error("Message required")
            //    }),
        });
        try {
            const result = schema.validate(req.body);

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                if (email.length > 40) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "More than 40  emails not allow at one time"
                        )
                    );
                } else {
                    next();
                }
                //   let record_exist = await checkifrecordexist({ 'id': enc_dec.cjs_decrypt(req.bodyString('invoice_id')) }, 'inv_invoice_master');
                //   if (record_exist) {
                // next();
                //   } else {
                //      res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found.'));
                //   }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    link_details: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["token"])) {
            const schema = Joi.object().keys({
                token: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Token required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    let ref_no = req.bodyString("token");
                    let record_exist = await checkifrecordexist(
                        { ref_no: ref_no, deleted: 0 },
                        "subs_plans"
                    );
                    let deactivate_data = await checkifrecordexist(
                        { ref_no: ref_no, status: 0 },
                        "subs_plans"
                    );
                    
                    // let record_reset = await checkifrecordexist({ 'id': record_id, 'is_reseted': 0 }, 'merchant_qr_codes');
                    
                    if (!record_exist || !deactivate_data) {
                        if (!record_exist) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `Link expired`
                                )
                            );
                        } else {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `Link is deactivated`
                                )
                            );
                        }
                    } else {
                        
                        next();
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
    subscription_details: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["token"])) {
            const schema = Joi.object().keys({
                token: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Token required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    let record_id = req.bodyString("token");
                    let token_exist = await checkifrecordexist(
                        { ref_no: record_id, deleted: 0, status: 0 },
                        "subs_plans"
                    );
                    if (!token_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                `Invalid subscription link.`
                            )
                        );
                    } else {
                        // res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(!deactivate_data?"Invalid link.":!record_exist?'Record not found.':""));
                        next();
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
    get_subscriber: async (req, res, next) => {
        const schema = Joi.object().keys({
            subscriber_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscriber id required");
                }),
             mode:Joi.string().optional('').allow('')   
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("subscriber_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        super_merchant: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subscription"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    cancel: async (req, res, next) => {
        const schema = Joi.object().keys({
            subscription_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription id required");
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
                    req.bodyString("subscription_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        status: 1,
                        super_merchant: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subscription"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    start_expired : async (req, res) =>  {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }

            let record_id = req.bodyString("token");
            let subscriptionPlanDetails = await checkPlanDetails.planDetails({ ref_no: record_id, deleted: 0 }, 'subs_plans');
            
            if (subscriptionPlanDetails) {
                if(subscriptionPlanDetails.status === 1) {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `Plan is deactivated`
                        )
                    );
                }
            } else {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        `Invalid subscription link`
                    )
                );
            }

            //check start date
            let startDate = await checkPlanDetails.startDate(record_id);
            if (startDate && startDate.length === 0) {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        `The plan is not available yet please contact the merchant,start_date`
                    )
                );
            }

            //check expiry date
            let expiryDate = await checkPlanDetails.expiryDate(record_id);
            if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        `The plan is not available anymore please contact the merchant,expiry_date`
                    )
                );
            }
            
            res.status(statusCode.ok).send(
                response.successansmsg("success")
            );


        } catch (error) {
            return res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    create_subscription_order: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["token"])) {
            const schema = Joi.object().keys({
                token: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Token required");
                    }),
                name: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Name required");
                    }),
                email: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Email required");
                    }),
                mobile_no: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Mobile NO. required");
                    }),
                mobile_code: Joi.string().required().error(() => {
                    return new Error("Mobile code required");
                }),
                address: Joi.string().required().error(() => {
                    return new Error("Address required")
                }),
                city: Joi.string().required().error(() => {
                    return new Error("City required")
                }),
                country: Joi.string().required().error(() => {
                    return new Error("Country required")
                }),
            });

            try {

                const result = schema.validate(req.body);
                if (result.error) {

                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {

                    let record_id = req.bodyString("token");
                    const email = req.bodyString("email");

                    let subscriptionPlanDetails = await checkPlanDetails.planDetails({ ref_no: record_id, deleted: 0, status: 0 }, 'subs_plans');                
                    
                    //subscription for the plan
                    let customer_subscription_result = await checkSubscriptionOfCustomer({
                        plan_id: subscriptionPlanDetails.id,
                        //status: 1,
                        email: email,
                        //is_customer_subscribed : 1
                    },
                        'subscription');
                    

                    if (customer_subscription_result && Object.keys(customer_subscription_result).length > 0) {

                        if (customer_subscription_result.status === 0) {
                            return res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `Subscription is not active for this plan`
                                )
                            );
                        }

                        const { unpaid_recurring } = await subscription_check.checkForSubscriptionRecurring(customer_subscription_result.subscription_id);
                        

                        if (customer_subscription_result.is_customer_subscribed === 1 && unpaid_recurring > 0) {
                            return res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `You already subscribe for this plan`
                                )
                            );
                        }
                    }
                    //end subscription for the plan
                    
                    let mode = subscriptionPlanDetails.mode==0?"test":"live";
                    let mid_data = await helpers.get_mid_by_merchant_id(
                        subscriptionPlanDetails.submerchant_id, subscriptionPlanDetails.plan_currency,mode,subscriptionPlanDetails.plan_currency
                    );

                    if (mid_data.length > 0) {
                        let min_amount = mid_data.reduce((min, p) => p.minTxnAmount < min ? p.minTxnAmount : min, mid_data[0].minTxnAmount);
                        let max_amount = mid_data.reduce((max, p) => p.maxTxnAmount > max ? p.maxTxnAmount : max, mid_data[0].maxTxnAmount);
                        if (subscriptionPlanDetails.amount < min_amount) {
                            return res
                                .status(StatusCode.badRequest)
                                .send(
                                    ServerResponse.errormsg(
                                        "Order amount is less than min order amount"
                                    )
                                );
                        }
                        if (subscriptionPlanDetails.amount > max_amount) {
                            return res
                                .status(StatusCode.badRequest)
                                .send(
                                    ServerResponse.errormsg(
                                        "Order amount is greater than max order amount"
                                    )
                                );
                        }
                    } else {
                        return res
                            .status(StatusCode.ok)
                            .send(ServerResponse.errormsg("Merchant not accepting payments in " + subscriptionPlanDetails.plan_currency));
                    }
                    if(mid_data.length>0){
                        next();
                    }else{
                        return res
                            .status(StatusCode.ok)
                            .send(ServerResponse.errormsg("Merchant not accepting payments in " + subscriptionPlanDetails.plan_currency));
                    }


                    // next();
                }
            } catch (error) {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }

        } else {
            return res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    create_plan_order: async (req, res, next) => {
        let customer_details = req.body.data.customer_details;
        let order_details = req.body.data.order_details;

        const customer_details_schema = Joi.object().keys({
            // name: Joi.string().required().error(() => {
            //     return new Error("Valid name required")
            // }),
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
            code: Joi.string()
                .min(1)
                .max(7)
                .allow("")
                .error(() => {
                    return new Error("Valid code required");
                }),
            mobile: Joi.string()
                .length(10)
                .pattern(/^[0-9]+$/)
                .allow("")
                .error(() => {
                    return new Error("Valid mobile number required");
                }),
        });
        const order_details_schema = Joi.object().keys({
            amount: Joi.number()
                .required()
                .error(() => {
                    return new Error("Valid amount required");
                }),
            currency: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid currency required");
                }),
            quantity: Joi.number()
                .min(1)
                .error(() => {
                    return new Error("Quantity should be more than 0");
                }),
            return_url: Joi.string()
                .optional()
                .allow("")
                .uri()
                .required()
                .error(() => {
                    return new Error("Valid return url required");
                }),
            planlink_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid payment link ID required");
                }),
        });

        const result1 = customer_details_schema.validate(customer_details);
        if (result1.error) {
            res.status(StatusCode.ok).send(
                ServerResponse.errormsg(result1.error.message)
            );
        }
        const result2 = order_details_schema.validate(order_details);
        if (result2.error) {
            res.status(StatusCode.ok).send(
                ServerResponse.errormsg(result2.error.message)
            );
        }
        let record_exist = await checkifrecordexist(
            { ref_no: req.body.data.order_details.planlink_id, status: 0 },
            "subs_plans"
        );
       

      
      


        if (!record_exist) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse("Record not found.")
            );
        } else {
            next();
        } 
        // record_id = req.body.data.order_details.paymentlink_id;
        // let perDayData = await qrGenerateModule.selectOne({
        //     qr_id: record_id,
        // });

        
        // if (perDayData.type_of_qr_code == 'Dynamic_QR') {

        //     if (perDayData.is_expiry == '1') {
        //         let today = moment().format("YYYY-MM-DD");
        //         if (!moment(today).isSameOrBefore(perDayData.end_date)) {
        //             res.status(StatusCode.badRequest).send(
        //                 ServerResponse.validationResponse("Link is expired.")
        //             );
        //         }
        //     }
        
        //     if (perDayData.total_collection === "per_day") {
        //         let day = new Date().toLocaleDateString("sv");
        //         var sum_quantity = await qrGenerateModule.per_day_quantity(
        //             {
        //                 email: `'${req.body.data.customer_details.email}'`,
        //                 payment_id: `'${perDayData.qr_id}'`,
        //                 currency: `'${perDayData.currency}'`,
        //             },
        //             `'${day}'`,
        //             "qr_payment"
        //         );
        //     }

        
        //     if (perDayData.total_collection === "per_month") {
        //         const d = new Date();
        //         let month = d.getUTCMonth() + 1;
        //         var sum_quantity = await qrGenerateModule.per_month_quantity(
        //             {
        //                 email: `'${req.body.data.customer_details.email}'`,
        //                 payment_id: `'${perDayData.qr_id}'`,
        //                 currency: `'${perDayData.currency}'`,
        //             },
        //             `'${month}'`,
        //             "qr_payment"
        //         );
        //     }
        
        //     if (perDayData.total_collection === "till_expiry") {
        //         let expiry_date = moment(perDayData.end_date).format('YYYY-MM-DD');

        //         var sum_quantity = await qrGenerateModule.until_expiry_quantity(
        //             {
        //                 email: `'${req.body.data.customer_details.email}'`,
        //                 payment_id: `'${perDayData.qr_id}'`,
        //                 currency: `'${perDayData.currency}'`,
        //             },
        //             `'${expiry_date}'`,
        //             "qr_payment"
        //         );
        //     }

        
        
        
        //     if (sum_quantity >= perDayData.no_of_collection) {
        //         res.status(StatusCode.badRequest).send(
        //             ServerResponse.validationResponse(
        //                 `You can not make payment for this link. <br> Per user maximum quantity limit reached`
        //             )
        //         );
        //     } else if ((parseInt(sum_quantity) + parseInt(order_details.quantity)) > perDayData.no_of_collection) {
        //         res.status(StatusCode.badRequest).send(
        //             ServerResponse.validationResponse(
        //                 `You can not make payment for this link. <br> Ordered quantity is more than maximum per user quantity allowed.`
        //             )
        //         );
        //     } else {
        //         next();
        //     }
        // } else {
        //     next();
        // }

        // if (!result1.error && !result2.error && record_exist) {
        //     next();
        // }
    },

    open_plan_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            status: Joi.string()
                .valid("Active","Deactivated","Expired")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Active", "Deactivated", "Expired".',
                }),
                billing_frequency: Joi.string()
                .valid("yearly","monthly","weekly","daily")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Billing frequency should be yearly, monthly, weekly, daily."
                    );
                }),
            installment_amount: Joi.number().allow("").optional(),
            currency: Joi.string().min(3).max(3).allow("").optional() .error(() => {
                return new Error(
                    "Currency should be at least 3 characters."
                );
            }),
            perpage: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error(
                        "Valid perpage value is required 1 - 1000"
                    );
                }),
             
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
           
            created_from_date: Joi.date()
                .format("YYYY-MM-DD")
               
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid created from date is required (format: yyyy-mm-dd)"
                    );
                }),
            created_to_date: Joi.date()
                .format("YYYY-MM-DD")
                .min(Joi.ref('created_from_date'))
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Created to date is greater than created from date(format: yyyy-mm-dd)"
                    );
                }),
                modified_from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid modified from date is required (format: yyyy-mm-dd)"
                    );
                }),
            modified_to_date: Joi.date()
                .format("YYYY-MM-DD")
                .min(Joi.ref('modified_from_date'))
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Modified to date is greater than modified to date (format: yyyy-mm-dd)"
                    );
                }),
                subscribe_from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid subscribe from date is required (format: yyyy-mm-dd)"
                    );
                }),
            subscribe_to_date: Joi.date()
                .format("YYYY-MM-DD")
                .min(Joi.ref('subscribe_from_date'))
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Subscribe to date is greater than modified from date (format: yyyy-mm-dd)"
                    );
                }),
            billing_interval: Joi.number().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid billing interval required."
                );
            }),
            total_terms: Joi.number().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid total_terms interval required."
                );
            }),
            plan_id_or_name:Joi.string().allow("").optional()
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    setup_create: async (req, res, next) => {
        const schema = Joi.object().keys({
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant id required");
                }),
                about_to_expire: Joi.string()
                .required()
                .error(() => {
                    return new Error("About to expire cards required");
                }),
                expired: Joi.string()
                .required()
                .error(() => {
                    return new Error("Expire cards required");
                }),
         
                time: Joi.date()
                .format("HH:mm:ss")
                .required()
                .error(() => {
                    return new Error("Time not valid/not supplied");
                }),
           
        });

        try {
            const result = schema.validate(req.body);
              if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let submerchant_id = enc_dec.cjs_decrypt(
                    req.bodyString("submerchant_id")
                );
                let record_exists = await checkRecordExits(
                    { merchant_id: submerchant_id, deleted: 0 },
                    "subscription_setup"
                );
                if (record_exists) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Submerchant already exits"
                        )
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
    get_setup_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            subs_setup_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription setup id required");
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
                    req.bodyString("subs_setup_id")
                );
                
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        super_merchant_id: req.user.super_merchant_id
                            ? req.user.super_merchant_id
                            : req.user.id,
                    },
                    "subscription_setup"
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
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    setup_update: async (req, res, next) => {
        const schema = Joi.object().keys({
           setup_id: Joi.string()
            .required()
            .error(() => {
                return new Error("Subscription setup id required");
            }),
            submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant id required");
                }),
                about_to_expire: Joi.string()
                .required()
                .error(() => {
                    return new Error("About to expire cards required");
                }),
                expired: Joi.string()
                .required()
                .error(() => {
                    return new Error("Expire cards required");
                }),
         
                time: Joi.date()
                .format("HH:mm:ss")
                .required()
                .error(() => {
                    return new Error("Time not valid/not supplied");
                }),
           
        });

        try {
            const result = schema.validate(req.body);
              if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let submerchant_id = enc_dec.cjs_decrypt(
                    req.bodyString("submerchant_id")
                );
                let setup_id = enc_dec.cjs_decrypt(
                    req.bodyString("setup_id")
                );
                let record_exists = await checkRecordExits(
                    { merchant_id: submerchant_id, deleted: 0, "id !=": setup_id, },
                    "subscription_setup"
                );
                if (record_exists) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Submerchant already exits"
                        )
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
    subscription_link_details: async (req, res, next) => {

        if (!checkEmpty(req.body, ["token"])) {
           return res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }

        try {
            const schema = Joi.object().keys({
                token: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Token required");
                    }),
            });

            const validation_result = schema.validate(req.body);
            if (validation_result.error) {
               return  res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(validation_result.error.message)
                );
            }

            let subscription_id = enc_dec.cjs_decrypt(req.bodyString("token"));
            let record_exist = await checkifrecordexist(
                { subscription_id: subscription_id, status: 1 },
                "subscription"
            );

            if (!record_exist) {
                return res.status(StatusCode.badRequest).send(
                    "Subscription not found"
                );
            }
            next();
        } catch (error) {
            
            return res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    subscription_update_create_order: async (req, res, next) => {

        if (!checkEmpty(req.body, ["token"])) {
            return res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }

        try {
            const schema = Joi.object().keys({
                token: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Token required");
                    }),
                    name: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Name required");
                    }),    
                    email: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Email required");
                    }),    
                    mobile_no: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Mobile number required");
                    }),    
                    mobile_code: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Mobile code required");
                    }),    
                    address: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Address required");
                    }),    
                    city: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("City required");
                    }),    
                    country: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Country required");
                    }),  
                    subscription_token: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Subscription token required");
                    }),  
                    recurring_amount: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Recurring amount required");
                    }),  
            });

            const validation_result = schema.validate(req.body);
            if (validation_result.error) {
                return res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(validation_result.error.message)
                );
            }

            let ref_no = req.bodyString("token");
            let record_exist = await checkifrecordexist(
                { ref_no: ref_no, deleted: 0, status:0 },
                "subs_plans"
            );

            if (!record_exist) {
                return res.status(StatusCode.badRequest).send(
                    "Token not found"
                );
            }

            //send to next
            next();
        } catch (error) {
            
            return res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_add: async (req, res, next) => {
      
        const billing_freq = ["yearly", "monthly", "weekly", "daily"];
        let billing_frequency = req.body.billing_frequency;
        let installment_amount = req.body.installment_amount;
        let terms = req.body.terms;
        const installment_amount_schema = Joi.object().keys({
            currency: Joi.string()
            .trim()
            .min(3)
            .max(3)
            .required()
            .error(() => {
                return new Error("currency not valid.");
            }),
     
        value:  Joi.number().min(0.1).max(99999999).required().messages({
                "number.base": "Installment Amount must be a number",
                "number.min": "Installment Amount must be at least 0.1",
                "number.max": "Installment Amount must not exceed 9,999,999",
                "any.required": "Installment Amount is required",
        
        }),
        })
        const schema = Joi.object().keys({
            plan_name: Joi.string()
                .required()
                .trim()
                .max(50)
                .error(() => {
                    return new Error("Plan name not valid");
                }),
            plan_description: Joi.string().max(200).allow("").optional().error(() => {
                return new Error("Plan description not valid.");
            }),
        
          
            note: Joi.string()
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Note not valid");
                }),

           
            initial_payment_amount: Joi.number().min(0.1).max(99999999).required().messages({
                    "number.base": "Initial payment amount Amount must be a number",
                    "number.min": "Initial payment amount must be at least 0.1",
                    "number.max": "Initial payment amount must not exceed 9,999,999",
                    "any.required": "Initial payment amount is required",
            
            }),
            final_payment_amount:Joi.optional(),
               start_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .min(moment().format("YYYY-MM-DD HH:mm"))
                .required()
                .error(() => {
                    return new Error("Start date must be today's date or greater than today's date (format: YYYY-MM-DD HH:mm)");
                }),
                expiry_date: Joi.date()
                .min(moment().format("YYYY-MM-DD HH:mm"))
                .format("YYYY-MM-DD HH:mm")
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Expiry date must be today's date or greater than today's date (format: YYYY-MM-DD HH:mm)");
                }),
            
                billing_frequency: Joi.object(),
                terms: Joi.object(),
                installment_amount: Joi.object(),
          
        });
       // console.log("final amount")

        const final_amount_schema = Joi.object().keys({
            
            final_payment_amount: Joi.number().min(0.1).max(99999999).required().messages({
                "number.base": "Final payment amount Amount must be a number",
                "number.min": "Final payment amount must be at least 0.1",
                "number.max": "Final payment amount must not exceed 9,999,999",
                "any.required": "Final payment amount is required",
            })

        });
     
        const billing_frequency_schema = Joi.object().keys({
            interval: Joi.number()
                .required()
                .min(1)
                .max(9999999)
                .messages({
                    "number.base": "Interval must be a number",
                    "number.min": "Interval must be at least 1",
                    "number.max": "Interval must not exceed 9,999,999",
                    "any.required": "Interval is required",
            
            }),
        
             frequency: Joi.string()
            .valid(...billing_freq)
            .required()
            .error(() => {
                return new Error(
                    "Billing frequency should be yearly, monthly, weekly, daily."
                );
            }),
            
         });
        const terms_schema = Joi.object().keys({
            unlimited:  Joi.number()
            .valid('yes', 'no')
            .required()
            .error(() => {
                return new Error("Unlimited terms must be either yes or no.");
          }),
          value: Joi.alternatives().conditional("unlimited", {
                    is: 'no',
                    then:Joi.number()
                    .min(1)
                    .max(1999)
                    .required()
                    .messages({
                        "number.base": "Terms value must be a number",
                        "number.min": "Terms value must be at least 1",
                        "number.max": "Terms value must not exceed 1999",
                        "any.required": "Terms value is required",
                
                }),
                    otherwise: Joi.number().optional().allow(""),
                }),
                discount_term: Joi.alternatives().conditional("unlimited", {
                    is: 'yes',
                    then:Joi.number()
                    .max(1999)
                    .allow("")
                    .optional()
                    .messages({
                        "number.base": "Discount Terms value must be a number",
                        "number.max": "Discount Terms value must not exceed 1999",
                        "any.required": "Discount Terms value is required",
                
                }),
                    otherwise:  Joi.alternatives().conditional("unlimited", {
                        is: 'no',
                        then:Joi.number()
                        .max(Joi.ref("value"))
                        .allow("")
                        .optional()
                        .messages({
                            "number.base": "Discount Terms value must be a equal to terms value",

                            "any.required": "Discount Terms value is required",
                    
                    }),
                        otherwise: Joi.number().optional().allow(""),
                    }),
                }),
                discount_amount:  Joi.number().min(0.1).max(99999999).allow("").optional().messages({
                    "number.base": "Discount Amount must be a number",
                    "number.min": "Discount Amount must be at least 0.1",
                    "number.max": "Discount Amount must not exceed 9,999,999",
                    "any.required": "Discount Amount is required",
            
            }),
         });
   
        try {
            const result = schema.validate(req.body);
            const result1 = billing_frequency_schema.validate(billing_frequency);
            const result2 = installment_amount_schema.validate(installment_amount);
            const result3 = terms_schema.validate(terms);
            var result4=""
            if (req.body.terms.unlimited == "no") {
             result4 = final_amount_schema.validate(req.body);
            }
          
        
            if (result1.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result1.error.message)
                );
            }else if(result.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }else if(result3.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result3.error.message)
                );
            } else if (result4.error && req.body.terms.unlimited == "no") {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result4.error.message)
                );
            } else {
                let today =moment().format('YYYY-MM-DD HH:mm')
                let currency=await helpers.get_currency_id_by_name(req.body.installment_amount.currency);
                let currency_exist=await helpers.check_if_data_currency_exist({'submerchant_id':req.credentials.merchant_id,'currency_id':currency},'mid');
                let plan_name = req.bodyString("plan_name");
                let installment_amount_=req.body.installment_amount.value
                let discount_amount=req.body.terms.discount_amount
                let initial_amount=req.body.initial_payment_amount
                let final_amount=req.body.final_payment_amount
                let data_exist = await checkifrecordexist(
                    {
                        plan_billing_frequency: billing_frequency.frequency,
                        plan_name: plan_name,
                        plan_currency: installment_amount.currency,
                        plan_billing_amount: installment_amount_,
                        submerchant_id: req.credentials.merchant_id,
                        merchant_id: req.credentials.super_merchant_id,
                        mode:req.credentials.type=="live"?1:0,
                        deleted: 0,
                    },
                    "subs_plans"
                );
             
                if(req.bodyString("start_date") >=  req.bodyString("expiry_date") && req.bodyString("expiry_date")!=""){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Expiry date must be grater than issue date"
                        )
                    );
                }
               else if(!currency_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Currency not exist"
                        )
                    );
                }else if (parseFloat(discount_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Discounted amount can't be greater than the installment amount."
                        )
                    );
                }else if (parseFloat(initial_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Initial payment amount can't be greater than the installment amount."
                        )
                    );
                }else if (parseFloat(final_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Final payment amount can't be greater than the installment amount."
                        )
                    );
                }/* else if(terms.unlimited=="yes" && parseFloat(final_amount) < parseFloat(installment_amount_)){
                 
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                `Final payment amount should be equal to ${parseFloat(installment_amount_)}`
                            )
                        );
                    
                } */ else if (data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse("Data already exist")
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
    open_plan_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
                }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.queryString("data_id")
                );
                let mode=req.credentials.type=="live"?1:0

                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        merchant_id: req.credentials.super_merchant_id,
                        submerchant_id: req.credentials.merchant_id,
                        mode: mode
                    },
                    "subs_plans"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg("Record not exits.")
                    );
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_plan_update: async (req, res, next) => {
      
        const billing_freq = ["yearly", "monthly", "weekly", "daily"];
        let billing_frequency = req.body.billing_frequency;
        let installment_amount = req.body.installment_amount;
        let terms = req.body.terms;
    
        const schema = Joi.object().keys({
            data_id: Joi.string()
            .required()
            .error(() => {
                return new Error("Subscription plan id required");
            }),
            plan_name: Joi.string()
                .required()
                .trim()
                .max(50)
                .error(() => {
                    return new Error("Plan name not valid");
                }),
            plan_description: Joi.string().max(200).allow("").optional().error(() => {
                return new Error("Plan description not valid.");
            }),
        
          
            note: Joi.string()
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Note not valid");
                }),

           
                initial_payment_amount: Joi.number().min(0.1).max(99999999).required().messages({
                    "number.base": "Initial payment amount Amount must be a number",
                    "number.min": "Initial payment amount must be at least 0.1",
                    "number.max": "Initial payment amount must not exceed 9,999,999",
                    "any.required": "Initial payment amount is required",
            
            }),
            final_payment_amount: Joi.number().min(0.1).max(99999999).required().messages({
                "number.base": "Final payment amount Amount must be a number",
                "number.min": "Final payment amount must be at least 0.1",
                "number.max": "Final payment amount must not exceed 9,999,999",
                "any.required": "Final payment amount is required",
            }),
            start_date: Joi.date()
                .format("YYYY-MM-DD HH:mm")
                .min(moment().format("YYYY-MM-DD HH:mm"))
                .required()
                .error(() => {
                    return new Error("Start date must be today's date or greater than today's date (format: YYYY-MM-DD HH:mm)");
                }),
                expiry_date: Joi.date()
                .min(moment().format("YYYY-MM-DD HH:mm"))
                .format("YYYY-MM-DD HH:mm")
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Expiry date must be today's date or greater than today's date (format: YYYY-MM-DD HH:mm)");
                }),
       
                billing_frequency: Joi.object(),
                terms: Joi.object(),
                installment_amount: Joi.object(),
          
        });
        const installment_amount_schema = Joi.object().keys({
            currency: Joi.string()
            .trim()
            .min(3)
            .max(3)
            .required()
            .error(() => {
                return new Error("currency not valid.");
            }),
     
        value:  Joi.number().min(1).max(99999999).required().messages({
                "number.base": "Installment Amount must be a number",
                "number.min": "Installment Amount must be at least 1",
                "number.max": "Installment Amount must not exceed 9,999,999",
                "any.required": "Installment Amount is required",
        
        }),
        })
        const billing_frequency_schema = Joi.object().keys({
            interval: Joi.number()
                .required()
                .min(1)
                .max(9999999)
                .messages({
                    "number.base": "Interval must be a number",
                    "number.min": "Interval must be at least 1",
                    "number.max": "Interval must not exceed 9,999,999",
                    "any.required": "Interval is required",
            
            }),
        
             frequency: Joi.string()
            .valid(...billing_freq)
            .required()
            .error(() => {
                return new Error(
                    "Billing frequency should be yearly, monthly, weekly, daily."
                );
            }),
            
         });
        const terms_schema = Joi.object().keys({
            unlimited:  Joi.number()
            .valid('yes', 'no')
            .required()
            .error(() => {
                return new Error("Unlimited terms must be either yes or no.");
          }),
          value: Joi.alternatives().conditional("unlimited", {
                    is: 'no',
                    then:Joi.number()
                    .min(1)
                    .max(1999)
                    .required()
                    .messages({
                        "number.base": "Terms value must be a number",
                        "number.min": "Terms value must be at least 1",
                        "number.max": "Terms value must not exceed 1999",
                        "any.required": "Terms value is required",
                
                }),
                    otherwise: Joi.number().optional().allow(""),
                }),
                discount_term: Joi.alternatives().conditional("unlimited", {
                    is: 'yes',
                    then:Joi.number()
                    .min(0)
                    .max(1999)
                    .allow("")
                    .optional()
                    .messages({
                        "number.base": "Discount Terms value must be a number",
                        "number.min": "Discount Terms value must be at least 1",
                        "number.max": "Discount Terms value must not exceed 1999",
                        "any.required": "Discount Terms value is required",
                
                }),
                    otherwise:  Joi.alternatives().conditional("unlimited", {
                        is: 'no',
                        then:Joi.number()
                        .min(0)
                        .max(Joi.ref("value"))
                        .allow("")
                        .optional()
                        .messages({
                            "number.base": "Discount Terms value must be a equal to terms value",

                            "any.required": "Discount Terms value is required",
                    
                    }),
                        otherwise: Joi.number().optional().allow(""),
                    }),
                }),
                discount_amount:  Joi.number().min(0).max(99999999).allow("").optional().messages({
                    "number.base": "Amount must be a number",
                    "number.min": "Amount must be at least 0",
                    "number.max": "Amount must not exceed 9,999,999",
                    "any.required": "Amount is required",
            
            }),
         });
   
        try {
            const result = schema.validate(req.body);
            const result1 = billing_frequency_schema.validate(billing_frequency);
            const result2 = installment_amount_schema.validate(installment_amount);
            const result3 = terms_schema.validate(terms);
          
          
            if (result.error) {
              
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result1.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result1.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }else if(result3.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result3.error.message)
                );
            }else {
                let today =moment().format('YYYY-MM-DD HH:mm')
                let currency=await helpers.get_currency_id_by_name(req.body.installment_amount.currency);
                let currency_exist=await helpers.check_if_data_currency_exist({'submerchant_id':req.credentials.merchant_id,'currency_id':currency},'mid');
                let plan_name = req.bodyString("plan_name");
                let installment_amount_=req.body.installment_amount.value
                let discount_amount=req.body.terms.discount_amount
                let initial_amount=req.body.initial_payment_amount
                let final_amount=req.body.final_payment_amount
                record_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
                let data_exist = await checkifrecordexist(
                    {
                        'id !=':record_id,
                        plan_billing_frequency: billing_frequency.frequency,
                        plan_name: plan_name,
                        plan_currency: installment_amount.currency,
                        plan_billing_amount: installment_amount.value,
                        submerchant_id: req.credentials.merchant_id,
                        merchant_id: req.credentials.super_merchant_id,
                        deleted: 0,
                    },
                    "subs_plans"
                );
                let record_exist = await checkifrecordexist(
                    {
                        id:record_id,
                        submerchant_id: req.credentials.merchant_id,
                        merchant_id: req.credentials.super_merchant_id,
                        deleted: 0,
                        mode:req.credentials.type=="live"?1:0,
                    },
                    "subs_plans"
                );
              //check expiry date
               let expiryDate = await checkPlanDetails.is_plan_expired(record_id);
         
               if(req.bodyString("start_date") >=  req.bodyString("expiry_date") && req.bodyString("expiry_date")!=""){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        "Expiry date must be grater than issue date"
                    )
                );
            }else if (!record_exist) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        "Record not exist."
                    )
                );
            }else if (data_exist) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(
                        "Data already exist."
                    )
                );
            }
               else if(!currency_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Currency not exist"
                        )
                    );
                }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `The plan has been expired`
                        )
                    );
                } else if (parseFloat(discount_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Discounted amount can't be greater than the installment amount."
                        )
                    );
                }else if (parseFloat(initial_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Initial payment amount can't be greater than the installment amount."
                        )
                    );
                }else if (parseFloat(final_amount) > parseFloat(installment_amount_)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Final payment amount can't be greater than the installment amount."
                        )
                    );
                }else if(terms.unlimited=="yes" && parseFloat(final_amount) < parseFloat(installment_amount_)){
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                `Final payment amount should  be equal to ${parseFloat(installment_amount_)}`
                            )
                        );
                }else {
                    next();
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_plan_activate: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("data_id")
                );
                let mode=req.credentials.type=="live"?1:0

                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        status:1,
                        merchant_id: req.credentials.super_merchant_id,
                        submerchant_id: req.credentials.merchant_id,
                        mode: mode
                    },
                    "subs_plans"
                );
                let expiryDate = await checkPlanDetails.is_plan_expired(record_id);
                if (!record_exits) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg("Record not exits or already activated.")
                    );
                  
                }
               else if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `The plan has been expired`
                        )
                    );
                }else   {
                    next();
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_plan_deactivate: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription plan id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("data_id")
                );
                let mode=req.credentials.type=="live"?1:0

                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        status:0,
                        merchant_id: req.credentials.super_merchant_id,
                        submerchant_id: req.credentials.merchant_id,
                        mode: mode
                    },
                    "subs_plans"
                );
                let expiryDate = await checkPlanDetails.is_plan_expired(record_id);

                if (!record_exits) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg("Record not exits or already deactivated.")
                    );
             
                }  else if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `The plan has been expired`
                        )
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
    open_subscriber_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscriber id required");
                }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.queryString("data_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        super_merchant: req.credentials.super_merchant_id,
                        mode:req.credentials.type,
                        merchant_id:req.credentials.merchant_id,
                        status:1
                    },
                    "subscription"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg("Record not exits.")
                    );
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_subscriber_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            perpage: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error(
                        "Valid perpage value is required 1 - 1000"
                    );
                }),
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
            subscriber_id: Joi.string().allow("").optional().error(() => {
                return new Error("Valid subscriber_id required");
            }),
            subscriber_email_mobile: Joi.string().allow("").optional().error(() => {
                return new Error("Valid subscriber email , mobile required");
            }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
        

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_mail_send: async (req, res, next) => {
    
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Plan Id required");
                }),
                client_email: Joi.string()
                .email({
                    multiple: true,
                })
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Valid client emails required");
                }),

            email: Joi.string()
                .email({
                    multiple: true,
                })
                .allow("")
                .optional()
                .error(() => {
                    return new Error("Valid emails required");
                }),

            subject: Joi.string()
                .max(100)
                .required()
                .error(() => {
                    return new Error("Subject required");
                }),
            
        });
        try {
            const result = schema.validate(req.body);

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let subscriber_exist=true;
                let email=[];
                let subscriber_email = req.body.client_email;
                 if(subscriber_email!=""){
                    let subscriber= await helpers.getStringJoin(req.body.client_email)
                    subscriber_exist= await subs_plan_model.count_plan_customers(subscriber,req.credentials.super_merchant_id,req.credentials.merchant_id,req.credentials.type)
                 }
                 if(req.body.email!=""){
                     email = req.body.email.split(",");
                 }
                    //check expiry date
                    let record_id = enc_dec.cjs_decrypt(
                        req.bodyString("data_id")
                    );
                    let expiryDate = await checkPlanDetails.is_plan_expired(record_id);
                  //check deactivate
                  let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        merchant_id: req.credentials.super_merchant_id,
                        mode:req.credentials.type=="live"?1:0,
                        submerchant_id:req.credentials.merchant_id,
                        status:0
                    },
                    "subs_plans"
                );
                  
               if(req.body.client_email=="" && req.body.email==""){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Either Client or Email field is required"
                        )
                    );
                }else if (email.length > 40) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "More than 40  emails not allow at one time"
                        )
                    );
                }else if(!record_exits){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Record not exists or deactivated"
                        )
                    );   
                }else if(!subscriber_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Subscriber email not exist"
                        )
                    );   
                }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `The plan has been expired`
                        )
                    );
                } else {
                    next();
                }
           
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    cancel_subscription: async (req, res, next) => {
        const schema = Joi.object().keys({
            subscription_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("subscription_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        status: 1,
                        super_merchant: req.credentials.super_merchant_id,
                        merchant_id:req.credentials.merchant_id,
                        mode:req.credentials.type
                    },
                    "subscription"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg(
                            "Record not exits or already cancelled."
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
    open_contract_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            status: Joi.string()
                .valid("Active","Deactivated")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Active", "Deactivated".',
                }),
                last_payment_status: Joi.string()
                .valid("FAILED","PAID")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "FAILED", "PAID".',
                }),
                billing_frequency: Joi.string()
                .valid("yearly","monthly","weekly","daily")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Billing frequency should be yearly, monthly, weekly, daily."
                    );
                }),
            installment_amount: Joi.number().allow("").optional(),
            currency: Joi.string().min(3).max(3).allow("").optional() .error(() => {
                return new Error(
                    "Currency should be at least 3 characters."
                );
            }),
            perpage: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error(
                        "Valid perpage value is required 1 - 1000"
                    );
                }),
             
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
                payment_to_date: Joi.date()
                .min(Joi.ref('payment_from_date'))
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid payment to date is greater than payment from date  (format: yyyy-mm-dd)"
                    );
                }),
                payment_from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid payment from date is required (format: yyyy-mm-dd)"
                    );
                }),
                subscription_from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid subscription from date is required (format: yyyy-mm-dd)"
                    );
                }),
                subscription_to_date: Joi.date()
                .min(Joi.ref('subscription_from_date'))
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid subscription to date is greater than subscription from date  (format: yyyy-mm-dd)"
                    );
                }),
            billing_interval: Joi.number().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid billing interval required."
                );
            }),
            total_terms: Joi.number().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid total_terms interval required."
                );
            }),
            subscriber_email_or_mobile:Joi.string().allow("").optional(),
            contract_id:Joi.number().allow("").optional() .error(() => {
                return new Error(
                    "Contract id should be a number."
                );
            }),
            subscriber_id:Joi.number().allow("").optional() .error(() => {
                return new Error(
                    "Subscriber id should be a number."
                );
            })
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_contract_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            subscription_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subscription id required");
                }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.queryString("subscription_id")
                );
                let record_exits = await checkRecordExits(
                    {
                        id: record_id,
                        super_merchant: req.credentials.super_merchant_id,
                        mode:req.credentials.type,
                        merchant_id:req.credentials.merchant_id,
                       
                    },
                    "subscription"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg("Record not exits.")
                    );
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
};

module.exports = SubscriptionPlan;
