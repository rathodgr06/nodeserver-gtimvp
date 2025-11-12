const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const enc_dec = require("../decryptor/decryptor");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkRecordExits = require("../validations/checkifrecordexist");
const checkifrecordexist = require("./checkifrecordexist");
const pool = require("../../config/database");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];

const ReferralBonusValidator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid country required");
                }),
            settlement_frequency: Joi.string()
                .required()
                .error(() => {
                    return new Error("Settlement frequency required");
                }),
            currency: Joi.string()
                .min(3)
                .max(3)
                .required()
                .error(() => {
                    return new Error("Valid currency required");
                }),
            fix_amount_for_reference: Joi.number()
                .precision(2)
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per successful reference required"
                    );
                }),
            fix_amount: Joi.number()
                .precision(2)
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per transaction required"
                    );
                }),
            per_amount: Joi.number()
                .min(0)
                .max(100)
                .precision(2)
                .required()
                .error(() => {
                    return new Error(
                        "Valid percentage of transaction amount required"
                    );
                }),
            apply_greater: Joi.number()
                .integer()
                .min(0)
                .max(1)
                .error(() => {
                    return new Error("Valid apply greater required");
                }),
            settlement_date: Joi.number()
                .integer()
                .min(0)
                .max(31)
                .required()
                .error(() => {
                    return new Error("Valid settlement date required");
                }),
            calculate_bonus_till: Joi.number()
                .integer()
                .error(() => {
                    return new Error(
                        "Valid no. of days for per transaction wise bonus required"
                    );
                }),
            tax_per: Joi.number()
                .min(0)
                .max(100)
                .precision(2)
                .required()
                .error(() => {
                    return new Error("Valid tax percentage required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                // let qb = await pool.get_connection();
                // let response = await qb
                //     .select("currency")
                //     .where({ country_code: req.bodyString("currency") })
                //     .get(config.table_prefix + "country");
                // qb.release();
                

                let currency = req.bodyString("currency");
                let data_exist = await checkifrecordexist(
                    { currency: currency, deleted: 0 },
                    "master_referral_bonus"
                );
                if (data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Record with country already exist."
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
            referral_bonus_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referral bonus id required");
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
                    req.bodyString("referral_bonus_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id },
                    "master_referral_bonus"
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
            referral_bonus_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referral bonus id required");
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
                    req.bodyString("referral_bonus_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id, deleted: 0 },
                    "master_referral_bonus"
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
        const schema = Joi.object().keys({
            settlement_frequency: Joi.string()
                .required()
                .error(() => {
                    return new Error("Settlement frequency required");
                }),
            currency: Joi.string()
                .currency()
                .required()
                .error(() => {
                    return new Error("Valid currency required");
                }),
            country: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid country required");
                }),    
            fix_amount_for_reference: Joi.number()
                .precision(2)
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per successful reference required"
                    );
                }),
            fix_amount: Joi.number()
                .precision(2)
                .allow("")
                .error(() => {
                    return new Error(
                        "Valid fixed amount per successful reference required"
                    );
                }),
            per_amount: Joi.number()
                .min(0)
                .max(100)
                .precision(2)
                .required()
                .error(() => {
                    return new Error(
                        "Valid per transaction wise bonus required"
                    );
                }),
            apply_greater: Joi.number()
                .integer()
                .min(0)
                .max(1)
                .error(() => {
                    return new Error("Valid apply greater required");
                }),
            settlement_date: Joi.number()
                .integer()
                .min(1)
                .max(31)
                .required()
                .error(() => {
                    return new Error("Valid settlement days required and It must be greater than 0");
                }),
            calculate_bonus_till: Joi.number()
                .integer()
                .error(() => {
                    return new Error(
                        "Valid no. of days for per transaction wise bonus required"
                    );
                }),
            tax_per: Joi.number()
                .min(0)
                .max(100)
                .precision(2)
                .required()
                .error(() => {
                    return new Error("Valid tax percentage required");
                }),
            referral_bonus_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referral bonus id required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referral_bonus_id")
                );
                let fix_amount = req.bodyString("fix_amount");
                let currency = req.bodyString("currency");
                let data_exist = await checkifrecordexist(
                    { currency: currency, deleted: 0, "id !=": record_id },
                    "master_referral_bonus"
                );
                if (data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Record with currency already exist."
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
};

module.exports = ReferralBonusValidator;
