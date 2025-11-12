const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const enc_dec = require("../decryptor/decryptor");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");

const charges_invoice_validator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            merchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Merchant id required");
                }),
            month_year: Joi.string()
                .required()
                .pattern(new RegExp(/^([A-Z][a-z]{2})-(2[0-9]{3})$/))
                .error(() => {
                    return new Error(
                        "Valid month year required (ex: Jan-2023)"
                    );
                }),
        });
        try {
            const result = schema.validate(req.body);
            let merchantId = enc_dec.cjs_decrypt(req.bodyString("merchant_id"));

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        id: merchantId,
                    },
                    // "master_merchant"
                    "orders"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid merchant id."
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
    update: async (req, res, next) => {
        const schema = Joi.object().keys({
            charges_invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Charges invoice id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            let charges_invoice_id = enc_dec.cjs_decrypt(
                req.bodyString("charges_invoice_id")
            );

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        id: charges_invoice_id,
                    },
                    "charges_invoice"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid charges invoice id."
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
    new_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            charges_invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Charges invoice id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            let charges_invoice_id = enc_dec.cjs_decrypt(
                req.bodyString("charges_invoice_id")
            );

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        id: charges_invoice_id,
                    },
                    "submercahnt_invoice_charges"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid charges invoice id."
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

    invoice_to_merchant: async (req, res, next) => {
        const schema = Joi.object().keys({
            invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Invoice id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            let invoice_id = enc_dec.cjs_decrypt(
                req.bodyString("invoice_id")
            );

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        id: invoice_id,
                    },
                    "invoice_to_merchant"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid charges invoice id."
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
    invoice_to_psp: async (req, res, next) => {
        const schema = Joi.object().keys({
            invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Invoice id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            let invoice_id = enc_dec.cjs_decrypt(
                req.bodyString("invoice_id")
            );

            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let data_exist = await checkifrecordexist(
                    {
                        id: invoice_id,
                    },
                    "invoice_to_psp"
                );
                if (!data_exist) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invalid charges invoice id."
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

module.exports = charges_invoice_validator;
