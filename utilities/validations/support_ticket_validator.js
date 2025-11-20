const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const logger = require('../../config/logger');

const support_ticket_validator = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            trid: Joi.string().optional().allow(""),
            order_no: Joi.string().optional().allow(""),
            customer_name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Customer name required");
                }),
            customer_email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid customer email required");
                }),
            customer_mobile: Joi.string().optional().allow(""),
            id: Joi.string().optional().allow(""),
            cid: Joi.string().optional().allow(""),
            token: Joi.string().optional().allow(""),
            category: Joi.string()
                .required()
                .error(() => {
                    return new Error("Category required");
                }),
            sub_category: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub category required");
                }),
            other: Joi.string().optional().allow(""),
            priority: Joi.string()
                .valid("High", "Medium", "Low")
                .required()
                .error(() => {
                    return new Error("Invalid priority input");
                }),
            description: Joi.string()
                .required()
                .error(() => {
                    return new Error("Description is required");
                }),
            amount: Joi.number().optional().allow(""),
            currency: Joi.string().optional().allow(""),
            file_1: Joi.binary().optional(),
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
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    list: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token is required");
                }),
            reference_no: Joi.string().optional().allow(""),
            customer_name: Joi.string().optional().allow(""),
            customer_email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid customer email required");
                }),
            customer_mobile: Joi.string().optional().allow(""),
            order_no: Joi.string().optional().allow(""),
            category: Joi.string().optional().allow(""),
            sub_category: Joi.string().optional().allow(""),
            priority: Joi.string()
                .valid("High", "Medium", "Low")
                .optional()
                .error(() => {
                    return new Error("Invalid priority input");
                }),
            status: Joi.string()
                .valid("Open", "Close")
                .optional()
                .error(() => {
                    return new Error("Invalid status input");
                }),
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
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    details: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token is required");
                }),
            reference_no: Joi.string()
                .required()
                .error(() => {
                    return new Error("Reference no is required");
                }),
            customer_email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid customer email required");
                }),
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
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    list_subcategory: async (req, res, next) => {
        const schema = Joi.object().keys({
            category_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid category id required");
                }),
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
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    comment: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string()
                .required()
                .error(() => {
                    return new Error("Token is required");
                }),
            reference_no: Joi.string()
                .required()
                .error(() => {
                    return new Error("Reference no is required");
                }),
            customer_email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Valid customer email required");
                }),
            comment: Joi.string()
                .required()
                .error(() => {
                    return new Error("Comment is required");
                }),
            ticket_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid ticket id required");
                }),
            name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid name required");
                }),
            email: Joi.string()
                .required()
                .error(() => {
                    return new Error("Valid email required");
                }),
            file_1: Joi.binary().optional(),
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
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
};

module.exports = support_ticket_validator;
