const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
const merchantOrderModel = require("../../models/merchantOrder");
const FiservPay = {
  primary_transaction: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        card_id: Joi.string().allow(""),
        order_id: Joi.string()
          .required()
          .error(() => {
            return new Error("Valid order id required");
          }),
        name: Joi.alternatives().conditional("card_id", {
          is: "",
          then: Joi.string()
            .required()
            .error(() => {
              return new Error("Valid name required");
            }),
          otherwise: Joi.allow(""),
        }),
        email: Joi.string()
          .email()
          .required()
          .error(() => {
            return new Error("Valid email required");
          }),
        dial_code: Joi.string()
          .allow("")
          .required()
          .error(() => {
            return new Error("Valid email required");
          }),
        mobile_no: Joi.string()
          .pattern(/^[0-9]+$/)
          .allow("")
          .optional()
          .error(() => {
            return new Error("Valid mobile no required");
          }),
        card: Joi.alternatives().conditional("card_id", {
          is: "",
          then: Joi.string()
            .min(12)
            .max(20)
            .required()
            .error(() => {
              return new Error("Valid card no required");
            }),
          otherwise: Joi.allow(""),
        }),
        expiry_date: Joi.alternatives().conditional("card_id", {
          is: "",
          then: Joi.date()
            .format("MM/YYYY")
            .raw()
            .greater(Date.now())
            .required()
            .error(() => {
              return new Error("Valid expiry date required");
            }),
          otherwise: Joi.allow(""),
        }),
        cvv: Joi.string()
          .min(3)
          .max(4)
          .pattern(/^[0-9]+$/)
          .required()
          .error(() => {
            return new Error("Valid cvv required");
          }),
        save_card: Joi.string()
          .allow("0", "1")
          .required()
          .error(() => {
            return new Error("Save card field required");
          }),
        // token: Joi.string().required().error(() => { return new Error("Token required") }),
        browserFP: Joi.string().allow(""),
        prefer_lang: Joi.string()
          .required()
          .error(() => {
            return new Error("Prefer lang required");
          }),
        page_language: Joi.string()
          .required()
          .error(() => {
            return new Error("page language is required");
          }),
        payment_mode: Joi.string().optional().allow(""),
        env: Joi.string().optional().allow(""),
        type: Joi.string().optional().allow(""),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        const order_id = req.bodyString("order_id");
        let mode = req.bodyString("payment_mode");
        let order_table = "orders";
        if (mode == "test") {
          order_table = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          { order_id: order_id },
          order_table
        );
        let card_id = req.bodyString("card_id");
        if (card_id != "") {
          card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
        } else {
          card_id = false;
        }
        if (!orderdata) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else if (card_id) {
          let card_exits = await checkifrecordexist(
            { id: card_id },
            "customers_cards"
          );
          if (!card_exits) {
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("In valid card id"));
          } else {
            next();
          }
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
};
module.exports = FiservPay;
