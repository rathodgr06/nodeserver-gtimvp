const Joi = require("joi")
  .extend(require("@joi/date"))
  .extend(require("joi-currency-code"));
const currency = require("../../controller/currency");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const logger = require('../../config/logger');

const update_custom_form_validator = {
  validate: async (req, res, next) => {
    const schema = Joi.object().keys({
      merchant_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Merchant id is required!");
        }),
      mode: Joi.string()
        .required()
        .error(() => {
          return new Error("Mode is required!");
        }),
      payment_type: Joi.string()
        .required()
        .error(() => {
          return new Error("Payment type is required!");
        }),
      field: Joi.string()
        .required()
        .error(() => {
          return new Error("Field is required!");
        }),
      value: Joi.string()
        .required()
        .error(() => {
          return new Error("Field value is required!");
        }),
    });
    try {
      const result = schema.validate(req.body);

      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
};

module.exports = update_custom_form_validator;
