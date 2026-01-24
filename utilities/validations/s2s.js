const Joi = require("joi").extend(require("@joi/date")).extend(require("joi-currency-code"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
const invModel = require("../../models/invoiceModel");
const moment = require("moment");
const qrGenerateModule = require("../../models/qrGenerateModule");
const merchantOrderModel = require("../../models/merchantOrder");
const helpers = require("../helper/general_helper");
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const { valid } = require("joi");
const logger = require('../../config/logger');

const S2SValidator = {
    execuatePayment: async (req, res, next) => {
    try {
      let customer_details = req.body.customer_details;
      let order_details = req.body.order_details;
      let billing_details = req.body.billing_details;
      let shipping_details = req.body.shipping_details;
      let payment_token = req.body.payment_token;
      let urls = req.body.urls;
      let payment_method = req.body.paymentMethod;

      let action_data = {
        action: req.body.action,
        capture_method: req.body.capture_method,
      };

      /* ---------------- BASIC OBJECT VALIDATION ---------------- */

      if (!payment_method) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Payment details object missing"));
      }

      if (!customer_details) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Customer details object missing"));
      }

      if (!billing_details) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Billing details object missing"));
      }

      if (!shipping_details) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Shipping details object missing"));
      }

      if (!order_details) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Order details object missing"));
      }

      if (!urls) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("URLs object missing"));
      }

      /* ---------------- COUNTRY CODE CHECK (SAFE) ---------------- */

      let code_exist = true;
      try {
        if (customer_details.code) {
          code_exist = await checkifrecordexist(
            { dial: customer_details.code },
            "country"
          );
        }
      } catch (e) {
        logger.error("Country code check failed", e);
        code_exist = false;
      }

      /* ---------------- JOI SCHEMAS ---------------- */

      const schema = Joi.object({
        action: Joi.string()
          .valid("AUTH", "SALE")
          .required()
          .error(() => new Error("Order action not valid/not supplied")),

        capture_method: Joi.alternatives().conditional("action", {
          is: "AUTH",
          then: Joi.string()
            .valid("MANUAL", "AUTOMATIC")
            .required()
            .error(() => new Error("Capture method not valid/not supplied")),
          otherwise: Joi.string().allow(""),
        }),
      });

      const payment_method_schema = Joi.object({
        is_wallet: Joi.string()
          .valid("0", "1")
          .optional()
          .default("0"),

        wallet_details: Joi.when("is_wallet", {
          is: "1",
          then: Joi.object({
            walletType: Joi.string().required(),
            mobileCode: Joi.string().required(),
            msisdn: Joi.string().pattern(/^[0-9]{7,15}$/).required(),
          }).required(),
          otherwise: Joi.any().optional(),
        }),

        paymentCard: Joi.when("is_wallet", {
          is: "1",
          then: Joi.any().optional(),
          otherwise: Joi.object({
            number: Joi.string().pattern(/^[0-9]{12,20}$/).required(),
            securityCode: Joi.string().pattern(/^[0-9]{3,4}$/).required(),
            expiryDate: Joi.string()
              .pattern(/^(0[1-9]|1[0-2])\/\d{4}$/)
              .required(),
          }).required(),
        }),

        tokenize: Joi.number().valid(0, 1).optional(),
      });

      const customer_details_schema = Joi.object({
        name: Joi.string().allow("").optional(),
        email: Joi.string().email().allow("").optional(),
        code: Joi.string().allow("").optional(),
        mobile: Joi.string().allow("").optional(),
        m_customer_id: Joi.string().allow("").optional(),
      });

      const order_details_schema = Joi.object({
        m_order_id: Joi.string().allow("").optional(),
        amount: Joi.number().positive().required(),
        currency: Joi.string().currency().length(3).required(),
        return_url: Joi.string().uri().allow("").optional(),
        description: Joi.string().max(200).allow("").optional(),
        statement_descriptor: Joi.string().max(22).allow("").optional(),
      });

      const billingDetailsSchema = Joi.object({
        address_line1: Joi.string().allow("").optional(),
        address_line2: Joi.string().allow("").optional(),
        country: Joi.string().length(2).allow("").optional(),
        city: Joi.string().allow("").optional(),
        pin: Joi.string().allow("").optional(),
        province: Joi.string().allow("").optional(),
      });

      const shippingDetailsSchema = Joi.object({
        address_line1: Joi.string().allow("").optional(),
        address_line2: Joi.string().allow("").optional(),
        country: Joi.string().length(2).allow("").optional(),
        city: Joi.string().allow("").optional(),
        pin: Joi.string().allow("").optional(),
        province: Joi.string().allow("").optional(),
      });

      const response_url = Joi.object({
        callback: Joi.string().uri().allow("").optional(),
      });

      /* ---------------- RUN VALIDATIONS ---------------- */

      const validations = [
        schema.validate(action_data),
        customer_details_schema.validate(customer_details),
        order_details_schema.validate(order_details),
        billingDetailsSchema.validate(billing_details),
        shippingDetailsSchema.validate(shipping_details),
        response_url.validate(urls),
        payment_method_schema.validate(payment_method),
      ];

      for (const v of validations) {
        if (v.error) {
          return res
            .status(StatusCode.badRequest)
            .send(await getCommonError(v.error.message));
        }
      }

      /* ---------------- PAYMENT TOKEN VALIDATION (SAFE) ---------------- */

      if (payment_token) {
        let id;
        try {
          id = enc_dec.cjs_decrypt(payment_token);
        } catch (e) {
          return res
            .status(StatusCode.badRequest)
            .send(await getCommonError("Invalid payment token"));
        }

        const card_id_exist = await checkifrecordexist(
          { id },
          "customers_cards"
        );

        if (!card_id_exist) {
          return res
            .status(StatusCode.badRequest)
            .send(await getCommonError("Invalid payment token"));
        }
      }

      if (!code_exist && customer_details.mobile) {
        return res
          .status(StatusCode.badRequest)
          .send(await getCommonError("Mobile code not valid/not supplied"));
      }

      /* ---------------- MID VALIDATION (SAFE) ---------------- */

      let mid_data;
      try {
        mid_data = await helpers.get_mid_by_merchant_id(
          req.credentials.merchant_id,
          order_details.currency,
          req.credentials.type
        );
      } catch (e) {
        logger.error("MID fetch failed", e);
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg("MID lookup failed"));
      }

      if (!Array.isArray(mid_data) || mid_data.length === 0) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              `No active MID found for currency ${order_details.currency}.`
            )
          );
      }

      const min_amount = Math.min(...mid_data.map(m => m.minTxnAmount));
      const max_amount = Math.max(...mid_data.map(m => m.maxTxnAmount));

      if (order_details.amount < min_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              `Order amount must be at least ${min_amount} ${order_details.currency}`
            )
          );
      }

      if (order_details.amount > max_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              `Order amount cannot exceed ${max_amount} ${order_details.currency}`
            )
          );
      }

      /* ---------------- ALL GOOD ---------------- */
      return next();
    } catch (error) {
      logger.error("Payment validation fatal error", {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(StatusCode.badRequest)
        .send(
          ServerResponse.validationResponse(
            error.message || "Validation error occurred"
          )
        );
    }
  },
};

// Helper function to reduce code duplication
async function getCommonError(message) {
    const payload = {
        psp_name: "paydart",
        psp_response_details: message,
    };
    const common_err = await helpers.get_common_response(payload);
    return ServerResponse.common_error_msg(
        common_err.response[0]?.response_details || message,
        common_err.response[0]?.response_code || 99
    );
}

module.exports = S2SValidator;