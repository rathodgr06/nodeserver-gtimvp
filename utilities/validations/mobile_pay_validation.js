const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
const merchantOrderModel = require("../../models/merchantOrder");
const MtnMomoValidator = {
    pay: async (req, res, next) => {
        try {
            const schema = Joi.object().keys({
                order_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid order id required");
                    }),
                country_code: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid country code required");
                    }),
                mobile_no: Joi.string()
                    .pattern(/^[0-9]+$/)
                    .error(() => {
                        return new Error("Valid mobile no required");
                    }),
                mode: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid mode required");
                    }),
                psp: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("PSP required");
                    }),
                mno:Joi.string().optional().allow(""),
                account_name:Joi.string().optional().allow("") 
            });
            const result = schema.validate(req.body); // schema validation
            if (result.error) {
                return res
                    .status(StatusCode.ok)
                    .send(ServerResponse.errormsg(result.error.message));
            } else {
                const order_id = req.bodyString("order_id");
                let mode = req.bodyString("mode");
                let order_table = "orders";
                if (mode == "test") {
                    order_table = "test_orders";
                }
                const orderdata = await merchantOrderModel.selectOne(
                    "id",
                    { order_id: order_id },
                    order_table
                );
                if (!orderdata) {
                    return res
                        .status(StatusCode.badRequest)
                        .send(ServerResponse.validationResponse("Invalid order id"));
                } else {
                    next();
                }

            }
        } catch (error) {
            return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(error?.message));
        }
    },
    confirm: async (req, res, next) => {
        try {
            const schema = Joi.object().keys({
                order_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid order id required");
                    }),

                mode: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Valid mode required");
                    }),

            });
            const result = schema.validate(req.body); // schema validation
            if (result.error) {
                return res
                    .status(StatusCode.ok)
                    .send(ServerResponse.errormsg(result.error.message));
            } else {
                const order_id = req.bodyString("order_id");
                let mode = req.bodyString("mode");
                let order_table = "orders";
                if (mode == "test") {
                    order_table = "test_orders";
                }
                const orderdata = await merchantOrderModel.selectOne(
                    "id",
                    { order_id: order_id },
                    order_table
                );
                if (!orderdata) {
                    return res
                        .status(StatusCode.badRequest)
                        .send(ServerResponse.validationResponse("Invalid order id"));
                } else {
                    next();
                }

            }
        } catch (error) {
            return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(error?.message));
        }
    }
};
module.exports = MtnMomoValidator;