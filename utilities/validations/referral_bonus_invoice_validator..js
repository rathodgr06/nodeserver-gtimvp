const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const enc_dec = require("../decryptor/decryptor");
const helpers = require("../helper/general_helper");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");

const ReferralBonusInvoiceValidator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            // merchant_id: Joi.string()
            //     .required()
            //     .error(() => {
            //         return new Error("Merchant id required");
            //     }),
            referral_code: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid referral code required");
                }),
            // month_year: Joi.string()
            //     .required()
            //     .pattern(new RegExp(/^([A-Z][a-z]{2})-(2[0-9]{3})$/))
            //     .error(() => {
            //         return new Error(
            //             "Valid month year required (ex: Jan-2023)"
            //         );
            //     }),
        });
        try {
            const result = schema.validate(req.body);
            // let merchantId = enc_dec.cjs_decrypt(req.bodyString("merchant_id"));

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        // month: req.bodyString("month_year"),
                        // merchant_id: merchantId,
                        // id: merchantId,
                        referral_code: req.bodyString("referral_code"),
                    },
                    "referrers"
                    // "master_merchant"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid referral code"
                        )
                    );
                }
                // else if (data_exist) {
                //     res.status(StatusCode.badRequest).send(
                //         ServerResponse.validationResponse(
                //             "Record for month already exist."
                //         )
                //     );
                // }
                else {
                    next();
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    open_trans_list: async (req, res, next) => {
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
            // .messages({
            //     "any.required": "The perpage field is required.",
            //     "number.base": "The perpage field must be a number.",
            //     "number.integer": "The perpage field must be an integer.",
            //     "number.positive":
            //         "The perpage field must be a positive number 1 - 1000.",
            //     "number.min": "The perpage field must be at least 1.",
            //     "number.max": "The perpage field must be at most 1000.",
            // }),
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
            // .messages({
            //     "any.required": "The page field is required.",
            //     "number.base": "The page field must be a number.",
            //     "number.integer": "The page field must be an integer.",
            //     "number.positive":
            //         "The page field must be a positive number 1 - 1000.",
            //     "number.min": "The page field must be at least 1.",
            //     "number.max": "The page field must be at most 1000.",
            // }),
            from_date: Joi.date()
                .iso()
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid from_date is required (ex: yyyy-mm-dd)"
                    );
                }),
            to_date: Joi.date()
                .iso()
                .greater(Joi.ref("from_date"))
                .optional()
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid to_date is required (ex: yyyy-mm-dd)"
                    );
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
                next();
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    // get: async (req, res, next) => {
    //     const schema = Joi.object().keys({
    //         referral_bonus_id: Joi.string()
    //             .required()
    //             .error(() => {
    //                 return new Error("Referral bonus id required");
    //             }),
    //     });
    //     try {
    //         const result = schema.validate(req.body);
    //         if (result.error) {
    //             res.status(StatusCode.ok).send(
    //                 ServerResponse.errormsg(result.error.message)
    //             );
    //         } else {
    //             let record_id = enc_dec.cjs_decrypt(
    //                 req.bodyString("referral_bonus_id")
    //             );
    //             let record_exits = await checkRecordExits(
    //                 { id: record_id },
    //                 "master_referral_bonus"
    //             );
    //             if (record_exits) {
    //                 next();
    //             } else {
    //                 res.status(StatusCode.ok).send(
    //                     ServerResponse.errormsg("Record not exits.")
    //                 );
    //             }
    //         }
    //     } catch (error) {
    
    //         res.status(StatusCode.badRequest).send(
    //             ServerResponse.validationResponse(error)
    //         );
    //     }
    // },
    // delete: async (req, res, next) => {
    //     const schema = Joi.object().keys({
    //         referral_bonus_id: Joi.string()
    //             .required()
    //             .error(() => {
    //                 return new Error("Referral bonus id required");
    //             }),
    //     });
    //     try {
    //         const result = schema.validate(req.body);
    //         if (result.error) {
    //             res.status(StatusCode.ok).send(
    //                 ServerResponse.errormsg(result.error.message)
    //             );
    //         } else {
    //             let record_id = enc_dec.cjs_decrypt(
    //                 req.bodyString("referral_bonus_id")
    //             );
    //             let record_exits = await checkRecordExits(
    //                 { id: record_id, deleted: 0 },
    //                 "master_referral_bonus"
    //             );
    //             if (record_exits) {
    //                 next();
    //             } else {
    //                 res.status(StatusCode.ok).send(
    //                     ServerResponse.errormsg(
    //                         "Record not exits or already deleted."
    //                     )
    //                 );
    //             }
    //         }
    //     } catch (error) {
    
    //         res.status(StatusCode.badRequest).send(
    //             ServerResponse.validationResponse(error)
    //         );
    //     }
    // },
    // update: async (req, res, next) => {
    //     const schema = Joi.object().keys({
    //         currency: Joi.string()
    //             .currency()
    //             .required()
    //             .error(() => {
    //                 return new Error("Valid currency  required");
    //             }),
    //         fix_amount_for_reference: Joi.number()
    //             .precision(2)
    //             .allow("")
    //             .error(() => {
    //                 return new Error(
    //                     "Valid fixed amount per successful reference required"
    //                 );
    //             }),
    //         fix_amount: Joi.number()
    //             .precision(2)
    //             .allow("")
    //             .error(() => {
    //                 return new Error(
    //                     "Valid fixed amount per successful reference required"
    //                 );
    //             }),
    //         per_amount: Joi.number()
    //             .integer()
    //             .min(1)
    //             .max(100)
    //             .required()
    //             .error(() => {
    //                 return new Error(
    //                     "Valid per transaction wise bonus required"
    //                 );
    //             }),
    //         apply_greater: Joi.number()
    //             .integer()
    //             .min(0)
    //             .max(1)
    //             .error(() => {
    //                 return new Error("Valid apply greater required");
    //             }),
    //         settlement_date: Joi.number()
    //             .integer()
    //             .min(1)
    //             .max(31)
    //             .required()
    //             .error(() => {
    //                 return new Error("Valid settlement date required");
    //             }),
    //         calculate_bonus_till: Joi.number()
    //             .integer()
    //             .error(() => {
    //                 return new Error(
    //                     "Valid no. of days for per transaction wise bonus required"
    //                 );
    //             }),
    //         tax_per: Joi.number()
    //             .min(1)
    //             .max(100)
    //             .required()
    //             .error(() => {
    //                 return new Error("Valid tax percentage required");
    //             }),
    //         referral_bonus_id: Joi.string()
    //             .required()
    //             .error(() => {
    //                 return new Error("Referral bonus id required");
    //             }),
    //     });

    //     try {
    //         const result = schema.validate(req.body);
    //         if (result.error) {
    //             res.status(StatusCode.ok).send(
    //                 ServerResponse.errormsg(result.error.message)
    //             );
    //         } else {
    //             record_id = enc_dec.cjs_decrypt(
    //                 req.bodyString("referral_bonus_id")
    //             );
    //             let fix_amount = req.bodyString("fix_amount");
    //             let currency = req.bodyString("currency");
    //             let data_exist = await checkifrecordexist(
    //                 { currency: currency, deleted: 0, "id !=": record_id },
    //                 "master_referral_bonus"
    //             );
    //             if (data_exist) {
    //                 res.status(StatusCode.badRequest).send(
    //                     ServerResponse.validationResponse(
    //                         "Record with currency already exist."
    //                     )
    //                 );
    //             } else {
    //                 next();
    //             }
    //         }
    //     } catch (error) {
    
    //         res.status(StatusCode.badRequest).send(
    //             ServerResponse.validationResponse(error)
    //         );
    //     }
    // },
    invoice_mail: async (req, res, next) => {
        // let email = req.body.emails.split(",");
        const schema = Joi.object().keys({
            id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Id required");
                }),
            email: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
            subject: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subject required");
                }),
            message: Joi.string()
                .required()
                .error(() => {
                    return new Error("Description required");
                }),
        });
        try {
            const result = schema.validate(req.body);

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
};

module.exports = ReferralBonusInvoiceValidator;
