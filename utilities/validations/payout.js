const Joi = require("joi").extend(require("@joi/date")).extend(require("joi-currency-code"));;
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const logger = require('../../config/logger');

const payoutValidator = {
    add: async (req, res, next) => {
        const payloadSchema = Joi.object({
          submerchant_id: Joi.string().allow("", null),

          receiver_id: Joi.string().allow("", null),

          disbursement_type: Joi.string()
            .valid("settlement", "payout")
            .allow(null),

          currecny: Joi.string().length(3).uppercase().required().messages({
            "string.length": "currecny must be a 3-letter ISO currency code",
            "any.required": "currecny is required",
          }),

          amount: Joi.string()
            .pattern(/^\d+(\.\d{1,2})?$/)
            .required()
            .messages({
              "string.pattern.base": "amount must be a numeric string",
              "any.required": "amount is required",
            }),

          transaction_id: Joi.string().required().messages({
            "any.required": "transaction_id is required",
          }),
          order_id: Joi.string().required().messages({
            "any.required": "order_id is required",
          }),
          order_status: Joi.string()
            .valid("PENDING", "COMPLETED", "FAILED")
            .required()
            .messages({
              "any.required": "order_status is required",
              "any.only":
                "order_status must be one of pending, completed, or failed",
            }),
        });

        try {
            const result = payloadSchema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                next();
            }
        } catch (err) {
          logger.error(400,{message: err,stack: err?.stack});
            console.log(err);
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(err)
            );
        }
    }

}
module.exports = payoutValidator;