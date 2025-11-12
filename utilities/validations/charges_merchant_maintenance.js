const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const checkifrecordexist = require('./checkifrecordexist')
const enc_dec = require("../decryptor/decryptor");



const MerchantCharges = {
    plan_add: async (req, res, next) => {

        if (checkEmpty(req.body, ["plan_name", "feature", "notes","description", "billing_cycle"])) {
            const schema = Joi.object().keys({
                plan_name: Joi.string().min(2).max(50).required().error(() => {
                    return new Error("Valid plan name required")
                }),
                mid_currency: Joi.string().min(1).max(20).trim().required().error(()=>{
                    return new Error("Valid mid currency required")
                }),
                billing_cycle: Joi.string().min(1).max(10).required().error(() => {
                    return new Error("Valid billing cycle required")
                }),
                charges_value:  Joi.string().min(1).max(7).required().error(() => {
                    return new Error("Valid charges value required")
                }),
                feature: Joi.string().min(1).max(100).required().error(() => {
                    return new Error("Valid features required")
                }),
                notes: Joi.string().min(2).max(1000).optional().allow("").error(() => {
                    return new Error("Valid notes required")
                }),
                description: Joi.string().min(2).max(1000).required().error(() => {
                    return new Error("Valid description required")
                }),
                tax: Joi.number().greater(0).less(100).required().error(() => {
                    return new Error("Valid tax in % required")
                }),  
            })
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    let plan_exist = await checkifrecordexist({ 'plan_name': req.bodyString('plan_name') }, 'charges_merchant_maintenance');
                    if (!plan_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Plan already exist.'));
                    }
                }

            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {

            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    plan_details: async (req, res, next) => {
        if (checkEmpty(req.body, ["plan_id"])) {

            const schema = Joi.object().keys({
                plan_id: Joi.string().min(2).max(100).required().error(() => {
                    return new Error("Plan id Required")
                })
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    let record_exist = await checkifrecordexist({ 'id': enc_dec.cjs_decrypt(req.bodyString('plan_id'))}, 'charges_merchant_maintenance');

                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found.'));
                    }
                }

            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    plan_update: async (req, res, next) => {

        if (checkEmpty(req.body, ["plan_id", "plan_name", "feature", "notes", "description","billing_cycle"])) {

            const schema = Joi.object().keys({
                plan_id: Joi.string().min(2).max(300).required().error(() => {
                    return new Error("Valid Plan ID Required")
                }),
                plan_name: Joi.string().min(1).max(50).required().error(() => {
                    return new Error("Valid Plan Name Required")
                }),
                mid_currency: Joi.string().min(1).max(20).trim().required().error(()=>{
                    return new Error("Valid mid currency required")
                }),
                billing_cycle: Joi.string().min(1).max(10).required().error(() => {
                    return new Error("Valid billing cycle required")
                }),
                charges_value:  Joi.string().min(1).max(7).required().error(() => {
                    return new Error("Valid charges value required")
                }),
                feature: Joi.string().min(1).max(100).required().error(() => {
                    return new Error("Valid Features Required")
                }),
                notes: Joi.string().min(2).max(1000).optional().allow("").error(() => {
                    return new Error("Valid notes required")
                }),
                description: Joi.string().min(2).max(1000).required().error(() => {
                    return new Error("Valid description required")
                }),
                tax: Joi.number().greater(0).less(100).required().error(() => {
                    return new Error("Valid tax in % required")
                }),  
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString('plan_id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id }, 'charges_merchant_maintenance');
                    let plan_exist = await checkifrecordexist({ 'plan_name': req.bodyString('plan_name'), 'id !=': record_id, }, 'charges_merchant_maintenance');
                    if (record_exist && !plan_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(plan_exist ? 'Plan already exist.' : 'Record not found.'));
                    }
                }

            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }

    },

    plan_deactivate: async (req, res, next) => {

        if (checkEmpty(req.body, ["plan_id"])) {

            const schema = Joi.object().keys({
                plan_id: Joi.string().min(10).required().error(() => {
                    return new Error("Valid plan ID required")
                }),
            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    record_id = enc_dec.cjs_decrypt(req.bodyString('plan_id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 0 }, 'charges_merchant_maintenance');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already deactivated.'));
                    }
                }

            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    plan_activate: async (req, res, next) => {

        if (checkEmpty(req.body, ["plan_id"])) {

            const schema = Joi.object().keys({
                plan_id: Joi.string().min(10).required().error(() => {
                    return new Error("Valid plan ID required")
                }),
            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    record_id = enc_dec.cjs_decrypt(req.bodyString('plan_id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 1 }, 'charges_merchant_maintenance');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already activated.'));
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

}

module.exports = MerchantCharges;