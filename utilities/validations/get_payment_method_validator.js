const Joi = require("joi")
  .extend(require("@joi/date"))
  .extend(require("joi-currency-code"));
const currency = require("../../controller/currency");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");

const get_payment_method_validator = {
  validate: async (req, res, next) => {
    const schema = Joi.object().keys({
      submerchant_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Merchant id is required!");
        }),
      env: Joi.string()
        .required()
        .error(() => {
          return new Error("Mode is required!");
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
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
};

module.exports = get_payment_method_validator;
