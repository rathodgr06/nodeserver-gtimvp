const Joi = require("joi")
  .extend(require("@joi/date"))
  .extend(require("joi-currency-code"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
// const idChecker = require("./idchecker");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
// const checkifrecordexistandexpiration = require("./checkifrecordexistandexpiration");
const invModel = require("../../models/invoiceModel");
// const e = require("express");
const moment = require("moment");
const qrGenerateModule = require("../../models/qrGenerateModule");
const merchantOrderModel = require("../../models/merchantOrder");
const helpers = require("../helper/general_helper");
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const logger = require("../../config/logger");
const MerchantOrderValidator = {
  create: async (req, res, next) => {
    try {
      let classType = req?.body?.data?.class;

      if (classType !== "ECOM" && classType !== "CONT") {
        let payload = {
          psp_name: "paydart",
          psp_response_details: "Class not valid/not supplied",
        };

        let common_err = await helpers.get_common_response(payload);

        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.common_error_msg(
              common_err?.response?.[0]?.response_details || "Class not valid",
              common_err?.response?.[0]?.response_code || 99,
            ),
          );
      }

      switch (classType) {
        /* ============================= CONT ============================= */
        case "CONT":
          try {
            let transactionDetails = req.body.data;

            const transactionSchema = Joi.object({
              class: Joi.string().valid("CONT").required(),
              action: Joi.string().valid("SALE").required(),
              transaction_id: Joi.string().required(),
              amount: Joi.number().required(),
              currency: Joi.string().currency().required(),
            });

            const result1 = transactionSchema.validate(transactionDetails);

            if (result1.error) {
              let payload = {
                psp_name: "paydart",
                psp_response_details: result1.error.message,
              };

              let common_err = await helpers.get_common_response(payload);

              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.common_error_msg(
                    common_err?.response?.[0]?.response_details ||
                      result1.error.message,
                    common_err?.response?.[0]?.response_code || 99,
                  ),
                );
            }

            let mode = req.credentials.type;
            let record_exits = false;

            try {
              record_exits =
                mode === "test"
                  ? await checkifrecordexist(
                      { txn: transactionDetails.transaction_id },
                      "test_order_txn",
                    )
                  : await checkifrecordexist(
                      { txn: transactionDetails.transaction_id },
                      "order_txn",
                    );
            } catch (e) {
              logger.error(500, e);
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Transaction lookup failed",
                  ),
                );
            }

            if (!record_exits) {
              let payload = {
                psp_name: "paydart",
                psp_response_details: "Invalid transaction reference",
              };

              let common_err = await helpers.get_common_response(payload);

              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.common_error_msg(
                    common_err?.response?.[0]?.response_details ||
                      "Invalid transaction reference",
                    common_err?.response?.[0]?.response_code || 99,
                  ),
                );
            }

            return next();
          } catch (err) {
            logger.error(500, err);
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.validationResponse("CONT validation failed"),
              );
          }

        /* ============================= ECOM ============================= */
        case "ECOM":
          try {
            let customer_details = req.body.data.customer_details;
            let order_details = req.body.data.order_details;
            let billing_details = req.body.data.billing_details;
            let shipping_details = req.body.data.shipping_details;
            let payment_token = req.body.data.payment_token;
            let urls = req.body.data.urls;

            let action_data = {
              action: req.body.data.action,
              capture_method: req.body.data.capture_method,
            };

            /* -------- Required object guards -------- */
            if (!customer_details)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Customer details object missing",
                  ),
                );

            if (!billing_details)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Billing details object missing",
                  ),
                );

            if (!billing_details.address_line1)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Address line 1 not valid/not supplied",
                  ),
                );

            if (!shipping_details)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Shipping details object missing",
                  ),
                );

            if (!order_details)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "Order details object missing",
                  ),
                );

            if (!urls)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse("URLs object missing"));

            /* -------- Country & mobile validation -------- */
            let code_exist = false;
            try {
              code_exist = await checkifrecordexist(
                { dial: customer_details.code },
                "country",
              );
            } catch (e) {
              logger.error(500, e);
            }

            let mobile_length = 0;
            try {
              mobile_length = await helpers.get_mobile_length(
                customer_details.code,
              );
            } catch (e) {
              logger.error(500, e);
            }

            /* -------- Joi schemas (UNCHANGED LOGIC) -------- */
            const schema = Joi.object({
              action: Joi.string().valid("AUTH", "SALE").required(),
              capture_method: Joi.alternatives().conditional("action", {
                is: "AUTH",
                then: Joi.string()
                  .valid("MANUAL", "AUTOMATIC", "AUTOMATIC_ASYNC", "")
                  .required(),
                otherwise: Joi.string().allow(""),
              }),
            });

            const customer_details_schema = Joi.object({
              name: Joi.string().min(1).max(50).required(),
              email: Joi.string().email().max(50).required(),
              code: Joi.string().allow(""),
              mobile: Joi.string().allow(""),
              m_customer_id: Joi.string().optional().allow("").max(50),
            });

            const order_details_schema = Joi.object({
              m_order_id: Joi.string().optional().allow(""),
              amount: Joi.number().required(),
              currency: Joi.string().currency().required(),
              return_url: Joi.string().optional().allow(""),
              description: Joi.string().optional().allow("").max(200),
              statement_descriptor: Joi.string().optional().allow(""),
            });

            const billingDetailsSchema = Joi.object({
              address_line1: Joi.string().required(),
              address_line2: Joi.string().allow(""),
              country: Joi.string().required(),
              city: Joi.string().required(),
              pin: Joi.string().allow(""),
              province: Joi.string().allow(""),
            });

            const shippingDetailsSchema = Joi.object({
              address_line1: Joi.string().allow(""),
              address_line2: Joi.string().allow(""),
              country: Joi.string().allow(""),
              city: Joi.string().allow(""),
              pin: Joi.string().allow(""),
              province: Joi.string().allow(""),
            });

            const response_url = Joi.object({
              success: Joi.string().allow(""),
              cancel: Joi.string().allow(""),
              failure: Joi.string().allow(""),
            });

            /* -------- Run validations -------- */
            const result3 = schema.validate(action_data);
            const result1 = customer_details_schema.validate(customer_details);
            const result2 = order_details_schema.validate(order_details);
            const result4 = billingDetailsSchema.validate(billing_details);
            const result5 = response_url.validate(urls);
            const result6 = shippingDetailsSchema.validate(shipping_details);

            if (result3.error)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(result3.error.message));

            if (result1.error)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(result1.error.message));

            if (result4.error)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(result4.error.message));

            if (result2.error)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(result2.error.message));

            if (result6.error)
              return res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(result6.error.message));

            if (!code_exist && customer_details.mobile)
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse("Mobile code not valid"),
                );

            if (
              customer_details.mobile &&
              mobile_length &&
              customer_details.mobile.length !== mobile_length
            ) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    `Please enter mobile no. at least ${mobile_length} digits.`,
                  ),
                );
            }

            /* -------- Payment token decrypt (SAFE) -------- */
            if (payment_token) {
              let id;
              try {
                id = enc_dec.cjs_decrypt(payment_token);
              } catch (e) {
                logger.error(500, e);
                return res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.validationResponse("Invalid payment token"),
                  );
              }

              let card_id_exist = false;
              try {
                card_id_exist = await checkifrecordexist(
                  { id: id },
                  "customers_cards",
                );
              } catch (e) {
                logger.error(500, e);
              }

              if (!card_id_exist)
                return res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.validationResponse("Invalid payment token"),
                  );
            }

            return next();
          } catch (err) {
            logger.error(500, err);
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.validationResponse("ECOM validation failed"),
              );
          }
      }
    } catch (error) {
      logger.error(500, error);
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse("Request validation failed"));
    }
  },
  test_create: async (req, res, next) => {
    try {
      // let action_data = req.body.data.actions;
      let customer_details = req.body.data.customer_details;
      let order_details = req.body.data.order_details;
      let billing_details = req.body.data.billing_details;
      let urls = req.body.data.urls;
      let action_data = {
        action: req.body.data.action,
        capture_method: req.body.data.capture_method,
      };

      const schema = Joi.object().keys({
        action: Joi.string()
          .valid("AUTH", "SALE")
          .required()
          .error(() => {
            return new Error("Order action not valid/not supplied");
          }),

        capture_method: Joi.alternatives().conditional("action", {
          is: "AUTH",
          then: Joi.string()
            .valid("MANUAL", "AUTOMATIC", "AUTOMATIC_ASYNC")
            .required()
            .error(() => {
              return new Error("Capture method not valid/not supplied");
            }),
          otherwise: Joi.string().allow(""),
        }),
      });
      const customer_details_schema = Joi.object().keys({
        name: Joi.string()
          .pattern(/^[a-zA-Z]+ [a-zA-Z]+(([’,. -][a-zA-Z ])?[a-zA-Z]*)*$/)
          .required()
          .error(() => {
            return new Error("Name not valid/not supplied");
          }),
        email: Joi.string()
          .email()
          .required()
          .error(() => {
            return new Error("Email not valid/not supplied");
          }),
        code: Joi.string()
          .min(1)
          .max(7)
          .allow("")
          .error(() => {
            return new Error("Valid code required");
          }),
        mobile: Joi.string()
          .length(10)
          .pattern(/^[0-9]+$/)
          .allow("")
          .error(() => {
            return new Error("Valid mobile no. required");
          }),
        m_customer_id: Joi.string().allow(""),
      });
      const order_details_schema = Joi.object().keys({
        m_order_id: Joi.string().optional().allow(""),
        // .error(() => {
        //     return new Error("Order id not valid/not supplied");
        // }),
        amount: Joi.number()
          .required()
          .error(() => {
            return new Error("Amount not valid/not supplied");
          }),
        currency: Joi.string()
          .required()
          .error(() => {
            return new Error("Currency not valid/not supplied");
          }),
        // return_url: Joi.string()
        //     .uri()
        //     .required()
        //     .error(() => {
        //         return new Error("Return URL not valid/not supplied");
        //     }),
        description: Joi.string().optional().allow(""),
        // .error(() => {
        //     return new Error("Description not valid/not supplied");
        // }),
      });
      const billingDetailsSchema = Joi.object({
        address_line1: Joi.string()
          .required()
          .error(() => {
            return new Error("Address line 1 not valid/not supplied");
          }),
        address_line2: Joi.string().optional().allow(""),
        country: Joi.string()
          .required()
          .error(() => {
            return new Error("Country not valid/not supplied");
          }),
        city: Joi.string()
          .required()
          .error(() => {
            return new Error("City not valid/not supplied");
          }),
        pin: Joi.string().optional().allow(""),
        province: Joi.string().optional().allow(""),
      });
      const response_url = Joi.object().keys({
        success: Joi.string().allow(""),
        cancel: Joi.string().allow(""),
        failure: Joi.string().allow(""),
      });

      const order_id_exist = await checkifrecordexist(
        {
          order_id: req.bodyString("order_id"),
        },
        "test_orders",
      );
      const result1 = customer_details_schema.validate(customer_details);
      const result2 = order_details_schema.validate(order_details);
      const result3 = schema.validate(action_data);
      const result4 = billingDetailsSchema.validate(billing_details);
      const result5 = response_url.validate(urls);
      // let common_err
      if (result1.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result1.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );
      } else if (result4.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result4.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0]?.response_details,
              common_err.response[0]?.response_code,
            ),
          );
      } else if (result2.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result2.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );
      } else if (result3.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result3.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );
      } else if (order_id_exist) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: "Order id already exist",
        };
        let common_err = await helpers.get_common_response(payload);
        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );
      } else if (result5.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result5.error.message));
      } else {
        if (
          !result1.error &&
          !result2.error &&
          !result3.error &&
          !result4.error &&
          !order_id_exist
        ) {
          next();
        }
      }
    } catch (err) {
      logger.error(400, { message: err, stack: err?.stack });

      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },

  routing: async (req, res, next) => {
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
            // .pattern(/^[A-Za-z]+ [A-Za-z]+ [A-Za-z]+$/)
            .required()
            .error(() => {
              return new Error("Valid name required");
            }),
          otherwise: Joi.allow(""),
        }),
        email: Joi.string()
          .email()
          .optional()
          .error(() => {
            return new Error("Valid email required");
          }),
        dial_code: Joi.string()
          .allow("")
          .optional()
          .error(() => {
            return new Error("Valid country code required");
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
        payment_mode: Joi.string()
          .optional()
          .error(() => {
            return new Error("Payment mode required");
          }),
        // token: Joi.string()
        //     .required()
        //     .error(() => {
        //         return new Error("Token required");
        //     }),
        browserFP: Joi.string().optional().allow(""),
        prefer_lang: Joi.string()
          .optional()
          .error(() => {
            return new Error("Prefer lang required");
          }),
        card_type: Joi.string().optional().allow(""),
        call_api: Joi.string().optional().allow(""),
        type: Joi.string().optional().allow(""),
      });
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        const order_id = req.bodyString("order_id");
        let table_name = "orders";
        if (req.bodyString("payment_mode") == "test") {
          table_name = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
          },
          table_name,
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
          // } else if (orderdata.status !== "PENDING" || orderdata.) {
          //     return res
          //         .status(StatusCode.badRequest)
          //         .send(
          //             ServerResponse.validationResponse(
          //                 "Order Already Processed!!"
          //             )
          //         );
        } else if (card_id) {
          let card_exits = await checkifrecordexist(
            {
              id: card_id,
            },
            "customers_cards",
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
      logger.error(400, { message: error, stack: error?.stack });
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  get: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      // token: Joi.string()
      //     .required()
      //     .error(() => {
      //         return new Error("Valid order token required");
      //     }),
      browserFP: Joi.string().allow(""),
      mode: Joi.string().allow(""),
      retry: Joi.string().optional("").allow(""),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let table_name = "orders";
          if (req.bodyString("mode") == "test") {
            table_name = "test_orders";
          }

          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
            },
            table_name,
          );
          if (!order_exits)
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
        }
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  test_get: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order token required");
        }),
      browserFP: Joi.string().allow(""),
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
            },
            "test_orders",
          );
          if (!order_exits)
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
        }
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  open_get: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Order id not valid/not supplied");
        }),
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);

        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );

        // res.status(StatusCode.ok).send(
        //     ServerResponse.errormsg(result.error.message)
        // );
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let table_name =
            req?.credentials?.type == "test" ? "test_orders" : "orders";

          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
              merchant_id: req?.credentials?.merchant_id,
            },
            table_name,
          );

          if (!order_exits) {
            let payload = {
              psp_name: "paydart",
              psp_response_details: "Order id not valid/not supplied",
            };
            let common_err = await helpers.get_common_response(payload);

            res
              .status(StatusCode.ok)
              .send(
                ServerResponse.common_error_msg(
                  common_err.response[0].response_details,
                  common_err.response[0].response_code,
                ),
              );

            // res.status(StatusCode.badRequest).send(
            //     ServerResponse.validationResponse(
            //         "Invalid order id"
            //     )
            // );
          } else {
            next();
          }
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      console.log("🚀 ~ open_get: ~ error:", error);

      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  telr_pay: async (req, res, next) => {
    const schema = Joi.object().keys({
      card_id: Joi.string().allow(""),
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      name: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("Valid name required");
          }),
      }),
      email: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .email()
          .required()
          .error(() => {
            return new Error("Valid email required");
          }),
      }),
      dial_code: Joi.when("card_id", {
        is: "",
        then: Joi.string().allow(""),
      }),
      mobile_no: Joi.when("card_id", {
        is: "",
        then: Joi.string().allow(""),
        // .length(10)
        // .pattern(/^[0-9]+$/)
        // .allow("")
        // .optional()
        // .error(() => {
        //     return new Error("Valid mobile no required");
        // }),
      }),
      card: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .min(12)
          .max(20)
          .pattern(/^[0-9]+$/)
          .required()
          .error(() => {
            return new Error("Valid card no required");
          }),
      }),
      expiry_date: Joi.when("card_id", {
        is: "",
        then: Joi.date()
          .format("MM/YYYY")
          .raw()
          .greater(Date.now())
          .required(() => {
            return new Error("Valid expiry date required");
          }),
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
      payment_mode: Joi.string()
        .required()
        .error(() => {
          return new Error("Payment mode required");
        }),
      // token: Joi.string()
      //     .required()
      //     .error(() => {
      //         return new Error("Token required");
      //     }),
      browserFP: Joi.string().allow(""),
      prefer_lang: Joi.string()
        .required()
        .error(() => {
          return new Error("Prefer lang required");
        }),
      env: Joi.string()
        .required()
        .error(() => {
          return new Error("Prefer lang required");
        }),
      width: Joi.string()
        .required()
        .error(() => {
          return new Error("Width required");
        }),
      height: Joi.string()
        .required()
        .error(() => {
          return new Error("Height required");
        }),
      agent: Joi.string()
        .required()
        .error(() => {
          return new Error("Agent required");
        }),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      return res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      if (req.bodyString("order_id")) {
        let order_id = req.bodyString("order_id");
        let table_name = "orders";

        if (req.body.env == "test") {
          table_name = "test_orders";
        }

        let order_exits = await checkifrecordexist(
          {
            order_id: order_id,
            // merchant_id: req.order.merchant_id,
          },
          table_name,
        );
        let order_is_processed = await checkifrecordexist(
          {
            order_id: order_id,
            // merchant_id: req.order.merchant_id /*status: 'Created'*/,
          },
          table_name,
        );
        let card_id = req.bodyString("card_id");
        if (card_id != "") {
          card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
        } else {
          card_id = false;
        }
        if (!order_exits) {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else if (!order_is_processed) {
          res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Order is already processed"),
            );
        } else if (card_id) {
          let card_exits = await checkifrecordexist(
            {
              id: card_id,
            },
            "customers_cards",
          );
          if (!card_exits) {
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid card id"));
          } else {
            next();
          }
        } else {
          next();
        }
      } else {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Valid order id required"));
      }
    }
  },
  pay: async (req, res, next) => {
    const schema = Joi.object().keys({
      card_id: Joi.string().allow(""),
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      name: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("Valid name required");
          }),
      }),
      email: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .email()
          .required()
          .error(() => {
            return new Error("Valid email required");
          }),
      }),
      dial_code: Joi.when("card_id", {
        is: "",
        then: Joi.string().allow(""),
      }),
      mobile_no: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .pattern(/^[0-9]+$/)
          .allow("")
          .optional()
          .error(() => {
            return new Error("Valid mobile no required");
          }),
      }),
      card: Joi.when("card_id", {
        is: "",
        then: Joi.string()
          .min(12)
          .max(20)
          .pattern(/^[0-9]+$/)
          .required()
          .error(() => {
            return new Error("Valid card no required");
          }),
      }),
      expiry_date: Joi.when("card_id", {
        is: "",
        then: Joi.date()
          .format("MM/YYYY")
          .raw()
          .greater(Date.now())
          .required(() => {
            return new Error("Valid expiry date required");
          }),
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
      payment_mode: Joi.string()
        .required()
        .error(() => {
          return new Error("Payment mode required");
        }),
      // token: Joi.string()
      //     .required()
      //     .error(() => {
      //         return new Error("Token required");
      //     }),
      browserFP: Joi.string().allow(""),
      prefer_lang: Joi.string()
        .required()
        .error(() => {
          return new Error("Prefer lang required");
        }),
      env: Joi.string().allow(""),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      if (req.bodyString("order_id")) {
        let order_id = req.bodyString("order_id");
        let table_name = "orders";
        if (req?.body?.env == "test") {
          table_name = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
          },
          table_name,
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
          // }
          // else if (orderdata.status !== "PENDING") {
          //     return res
          //         .status(StatusCode.badRequest)
          //         .send(
          //             ServerResponse.validationResponse(
          //                 "Order Already Processed!!"
          //             )
          //         );
        } else if (card_id) {
          let card_exits = await checkifrecordexist(
            {
              id: card_id,
            },
            "customers_cards",
          );
          if (!card_exits) {
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("In valid card id"));
          } else {
            next();
          }
        } else {
          next();
        }
      } else {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Valid order id required"));
      }
    }
  },
  apple_pay: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      apple_token: Joi.object({
        data: Joi.string()
          .required()
          .error(() => {
            return new Error("Apple Token Data is required");
          }),
        signature: Joi.string()
          .required()
          .error(() => {
            return new Error("Apple Token Signature is required");
          }),
        header: Joi.object({
          publicKeyHash: Joi.string()
            .required()
            .error(() => {
              return new Error("Header Public Key Hash is required");
            }),
          ephemeralPublicKey: Joi.string()
            .required()
            .error(() => {
              return new Error("Header Ephemeral Public Key is required");
            }),
          transactionId: Joi.string()
            .required()
            .error(() => {
              return new Error("Header Transaction ID is required");
            }),
        })
          .required()
          .error((errors) => {
            // Custom error message for the entire header object
            if (
              errors[0].code === "any.required" &&
              errors[0].path[0] === "header"
            ) {
              return new Error("Apple Token Header is required");
            }
            return errors;
          }),
        version: Joi.string()
          .required()
          .error(() => {
            return new Error("Apple Token Version is required");
          }),
      })
        .required()
        .error((errors) => {
          // Custom error message for the entire apple_token object
          if (errors[0].code === "any.required") {
            return new Error("Apple Token is required");
          }
          return errors;
        }),
    });

    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      if (req.bodyString("order_id")) {
        let order_id = req.bodyString("order_id");
        let table_name = "orders";
        if (req?.order?.env == "test") {
          table_name = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
          },
          table_name,
        );

        if (!orderdata) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else if (orderdata.status !== "PENDING") {
          return res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Order Already Processed!!"),
            );
        } else {
          next();
        }
      } else {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Valid order id required"));
      }
    }
  },
  card_list: async (req, res, next) => {
    const schema = Joi.object().keys({
      token: Joi.string().allow(""),
      email: Joi.string().email().required(),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      next();
    }
  },
  cancel: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      mode: Joi.string().optional().allow(""),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      let order_id = req.bodyString("order_id");
      let mode = req.bodyString("mode");
      let table_name = mode == "test" ? "test_orders" : "orders";

      let order_exits = await checkifrecordexist(
        {
          order_id: order_id,
          // merchant_id: req.order.merchant_id,
        },
        table_name,
      );
      let order_is_processed = await checkifrecordexist(
        {
          order_id: order_id,
          // merchant_id: req.order.merchant_id,
          status: ["Pending", "FAILED"],
        },
        table_name,
      );

      if (!order_exits) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid order id"));
      } else if (!order_is_processed) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Order is already processed"),
          );
      } else {
        next();
      }
    }
  },
  remove: async (req, res, next) => {
    const schema = Joi.object().keys({
      card_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
      let table_name = "customers_cards";
      let card_exits = await checkifrecordexist(
        {
          id: card_id,
          deleted: 0,
        },
        table_name,
      );
      if (!card_exits) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              "Invalid card id or already deleted.",
            ),
          );
      } else {
        next();
      }
    }
  },
  send_notification_pay_with_vault: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      // token: Joi.string()
      //     .required()
      //     .error(() => {
      //         return new Error("Valid order token required");
      //     }),
      browserFP: Joi.string()
        .allow("")
        .error(() => {
          return new Error("Valid browser fingerprint required");
        }),
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let table_name = "orders";

          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
            },
            table_name,
          );
          if (!order_exits)
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
          // let browser_fingerprint = JSON.parse(enc_dec.cjs_decrypt(req.bodyString('browserFP')));
          // req.browser_fingerprint = browser_fingerprint;
        }
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  pay_with_vault: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order token required");
        }),
      card_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid card id required");
        }),
      cvv: Joi.string()
        .length(3)
        .pattern(/^[0-9]+$/)
        .required()
        .error(() => {
          return new Error("Valid cvv required");
        }),
      email: Joi.string()
        .email()
        .required()
        .error(() => {
          return new Error("Valid email required");
        }),
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let table_name = "orders";

          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
            },
            table_name,
          );
          if (!order_exits)
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
          let browser_fingerprint = JSON.parse(
            enc_dec.cjs_decrypt(req.bodyString("browserFP")),
          );
          req.browser_fingerprint = browser_fingerprint;
          let dec_card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
          let card_exits = await checkifrecordexist(
            {
              id: dec_card_id,
            },
            "customers_cards",
          );
          if (!card_exits)
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid card id"));
        }
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  order_details_fetch: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let order_id = req.bodyString("order_id");
        let table_name = "orders";
        /*** 
             * skipping this because not clear now 
            if (req.order.env == 'test') {
                table_name = 'test_orders'
              
            } else {
                table_name = 'orders'
              
            }
            */

        let order_exits = await checkifrecordexist(
          {
            order_id: order_id,
          },
          table_name,
        );
        if (!order_exits) {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  test_order_id_check: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      status: Joi.string()
        .required()
        .error(() => {
          return new Error("Status is required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let order_id = req.bodyString("order_id");
        let order_exits = await checkifrecordexist(
          {
            order_id: order_id,
          },
          "test_orders",
        );
        if (!order_exits) {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  test_capture: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Id is not valid/not supplied");
          }),
        amount: Joi.string()
          .required()
          .error(() => {
            throw new Error("Amount is not valid/not supplied");
          }),
        reason: Joi.string().allow(""),
      });
      const { error } = schema.validate(req.body);
      let id = enc_dec.cjs_decrypt(req.body.id);
      let check_order = await helpers.get_data_list("*", "test_orders", {
        id: id,
      });

      if (error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(error.message));
      } else if (check_order.length > 0) {
        next();
      } else {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Id is not valid"));
      }
    } catch (err) {
      logger.error(400, { message: err, stack: err?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },

  test_bin: async (req, res, next) => {
    const schema = Joi.object().keys({
      bin_number: Joi.string()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
        .error(() => {
          return new Error("Valid bin number Required");
        }),
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id Required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  create_qr_order: async (req, res, next) => {
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    console.log("🚀 ~ create_qr_order: ~ order_details:", order_details);

    const customer_details_schema = Joi.object().keys({
      m_customer_id: Joi.string().allow(""),
      name: Joi.string()
        .pattern(/^[a-zA-Z]+ [a-zA-Z]+(([’,. -][a-zA-Z ])?[a-zA-Z]*)*$/)
        .required()
        .messages({
          "string.base": "Name must be a string",
          "string.pattern.base":
            "Name must contain both a first name and a surname separated by a space",
          "any.required": "Valid Name required",
        }),
      // email: Joi.string()
      //     .email()
      //     .required()
      //     .error(() => {
      //         return new Error("Valid email required");
      //     }),
      code: Joi.string()
        .min(1)
        .max(7)
        .allow("")
        .error(() => {
          return new Error("Valid code required");
        }),
      mobile: Joi.string()
        .pattern(/^[0-9]+$/)
        .allow("")
        .error(() => {
          return new Error("Valid mobile number required");
        }),
    });
    const order_details_schema = Joi.object().keys({
      m_order_id: Joi.string().allow(""),
      amount: Joi.number()
        .required()
        .error(() => {
          return new Error("Valid amount required");
        }),
      currency: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid currency required");
        }),
      quantity: Joi.number()
        .min(1)
        .error(() => {
          return new Error("Quantity should be more than 0");
        }),
      return_url: Joi.string()
        .optional()
        .allow("")
        .uri()
        .error(() => {
          return new Error("Valid return url required");
        }),
      paymentlink_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid payment link ID required");
        }),
      description: Joi.string().optional().allow(""),
      // .error(() => {
      //     return new Error("description required");
      // }),
    });

    // const result1 = customer_details_schema.validate(customer_details);
    // if (result1.error) {
    //     res.status(StatusCode.ok).send(
    //         ServerResponse.errormsg(result1.error.message)
    //     );
    // }
    const result2 = order_details_schema.validate(order_details);
    if (result2.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result2.error.message));
    }
    let record_exist = await checkifrecordexist(
      {
        qr_id: req.body.data.order_details.paymentlink_id,
        status: 0,
        is_reseted: 0,
      },
      "merchant_qr_codes",
    );
    if (!record_exist) {
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse("Record not found."));
    }

    let record_id = req.body.data.order_details.paymentlink_id;

    const perDayData = await qrGenerateModule.selectOne({ qr_id: record_id });

    // console.log( req.body.data);
    let mode = perDayData.mode;

    let qr_order_data =
      await merchantOrderModel.selectMerchantIdByQrCode(record_id);
    // console.log("mode", perDayData.sub_merchant_id, perDayData.currency, mode);

    let mid_data = await helpers.get_mid_by_merchant_id(
      perDayData.sub_merchant_id,
      req.body.data.order_details.currency,
      mode,
    );

    // console.log(mid_data);

    if (mid_data.length > 0) {
      let min_amount = mid_data.reduce(
        (min, p) => (p.minTxnAmount < min ? p.minTxnAmount : min),
        mid_data[0].minTxnAmount,
      );
      let max_amount = mid_data.reduce(
        (max, p) => (p.maxTxnAmount > max ? p.maxTxnAmount : max),
        mid_data[0].maxTxnAmount,
      );

      console.log("🚀 ~ create_qr_order: ~ min_amount:", min_amount);
      console.log(
        "🚀 ~ create_qr_order: ~ order_details.amount:",
        order_details.amount,
      );
      if (order_details.amount < min_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Order amount is less than min order amount",
            ),
          );
      }
      if (order_details.amount > max_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Order amount is greater than max order amount",
            ),
          );
      }
    } else {
      return res
        .status(StatusCode.ok)
        .send(
          ServerResponse.errormsg(
            "Merchant not accepting payments in " +
              req?.body?.data?.order_details?.currency +
              ".",
          ),
        );
    }

    if (perDayData.type_of_qr_code == "Dynamic_QR") {
      /*   if (perDayData.is_expiry == "1") {
                let today = moment().format("YYYY-MM-DD");
                if (!moment(today).isSameOrBefore(perDayData.end_date)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse("Link is expired.")
                    );
                }
            }
            
            
            
            */
      var sum_quantity_overall = await qrGenerateModule.over_all_quantity_sum(
        {
          "qp.payment_id": `'${perDayData.qr_id}'`,
          "qp.currency": `'${perDayData.currency}'`,
        },
        "qr_payment",
      );

      if (sum_quantity_overall >= perDayData.overall_qty_allowed) {
        const message = perDayData?.error_message
          ? perDayData?.error_message
          : "You can not make payment for this link, maximum overall quantity reached.";
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(message));
      }
      if (perDayData.qty_frq === "per_day") {
        let day = moment().format("YYYY-MM-DD");
        var sum_quantity_overall = await qrGenerateModule.per_day_quantity_sum(
          {
            "qp.payment_id": `'${perDayData.qr_id}'`,
            "qp.currency": `'${perDayData.currency}'`,
          },
          `'${day}'`,
          "qr_payment",
        );
      }
      if (perDayData.qty_frq === "per_month") {
        const d = new Date();
        let month = d.getUTCMonth() + 1;
        var sum_quantity_overall =
          await qrGenerateModule.per_month_quantity_sum(
            {
              "qp.payment_id": `'${perDayData.qr_id}'`,
              "qp.currency": `'${perDayData.currency}'`,
            },
            `'${month}'`,
            "qr_payment",
          );
      }
      if (perDayData.qty_frq === "till_expiry") {
        let expiry_date = moment(perDayData.end_date).format("YYYY-MM-DD");
        var sum_quantity_overall =
          await qrGenerateModule.until_expiry_quantity_sum(
            {
              "qp.payment_id": `'${perDayData.qr_id}'`,
              "qp.currency": `'${perDayData.currency}'`,
            },
            `'${expiry_date}'`,
            "qr_payment",
          );
      }

      if (perDayData.total_collection === "per_day") {
        let day = moment().format("YYYY-MM-DD");
        var sum_quantity = await qrGenerateModule.per_day_quantity(
          {
            "qp.email": `'${req.body.data.customer_details.email}'`,
            "qp.payment_id": `'${perDayData.qr_id}'`,
            "qp.currency": `'${perDayData.currency}'`,
          },
          `'${day}'`,
          "qr_payment",
        );
      }

      if (perDayData.total_collection === "per_month") {
        const d = new Date();
        let month = d.getUTCMonth() + 1;
        var sum_quantity = await qrGenerateModule.per_month_quantity(
          {
            "qp.email": `'${req.body.data.customer_details.email}'`,
            "qp.payment_id": `'${perDayData.qr_id}'`,
            "qp.currency": `'${perDayData.currency}'`,
          },
          `'${month}'`,
          "qr_payment",
        );
      }

      if (perDayData.total_collection === "till_expiry") {
        let expiry_date = moment(perDayData.end_date).format("YYYY-MM-DD");
        var sum_quantity = await qrGenerateModule.until_expiry_quantity(
          {
            "qp.email": `'${req.body.data.customer_details.email}'`,
            "qp.payment_id": `'${perDayData.qr_id}'`,
            "qp.currency": `'${perDayData.currency}'`,
          },
          `'${expiry_date}'`,
          "qr_payment",
        );
      }

      if (
        parseInt(sum_quantity_overall) +
          parseInt(req?.body?.data?.order_details?.quantity) >
        parseInt(perDayData.overall_qty_allowed)
      ) {
        const message = perDayData?.error_message
          ? perDayData?.error_message
          : "You can not make payment for this link, maximum overall quantity reached.";
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(message));
      } else if (sum_quantity >= perDayData.no_of_collection) {
        const message = perDayData?.error_message
          ? perDayData?.error_message
          : "You can not make payment for this link. <br> Per user maximum quantity limit reached";
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(message));
      } else if (parseInt(sum_quantity) > perDayData.no_of_collection) {
        const message = perDayData?.error_message
          ? perDayData?.error_message
          : "You can not make payment for this link. <br> Ordered quantity is more than maximum per user quantity allowed.";
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(message));
      } else {
        next();
      }
    } else {
      next();
    }

    // if (!result1.error && !result2.error && record_exist) {
    //     next();
    // }
  },

  create_invoice_order: async (req, res, next) => {
    if (checkEmpty(req.body, ["invoice_id"])) {
      const schema = Joi.object().keys({
        invoice_id: Joi.string()
          .min(10)
          .required()
          .error(() => {
            return new Error("Invoice id required");
          }),
      });

      try {
        const result = schema.validate(req.body);
        if (result.error) {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse(result.error.message));
        } else {
          let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
          var invoice_data = await invModel.FetchExpiryAndStatus(
            invoice_id,
            "inv_invoice_master",
          );

          console.log(invoice_data);

          if (invoice_data) {
            // MID Validation
            let mid_data = await helpers.get_mid_by_merchant_id(
              invoice_data.sub_merchant_id,
              invoice_data.currency,
              invoice_data.mode,
            );
            let mid_error_occurred = false;
            let mid_error = "";
            /* if (mid_data.length > 0) {
                             let min_amount = mid_data.reduce((min, p) => p.minTxnAmount < min ? p.minTxnAmount : min, mid_data[0].minTxnAmount);
                             let max_amount = mid_data.reduce((max, p) => p.maxTxnAmount > max ? p.maxTxnAmount : max, mid_data[0].maxTxnAmount);
 
                             if ((invoice_data.amount < min_amount)) {
                                 mid_error_occurred = true;
                                 mid_error = "Order amount is less than min order amount";
                             }
                             if ((invoice_data.amount > max_amount)) {
                                 mid_error_occurred = true;
                                 mid_error = "Order amount is greater than max order amount";
                             }
                         } else {
                             mid_error_occurred = true;
                             mid_error = "No active MID found for currency " + invoice_data.currency + ".";
 
                         } */
            if (mid_data.length == 0) {
              mid_error_occurred = true;
              mid_error =
                "Merchant not accepting payments in " +
                invoice_data.currency +
                ".";
            }
            if (invoice_data.status == "Pending") {
              var now = moment();
              var date = moment(invoice_data.expiry_date);
              let dif = date.diff(now, "day");
              let is_today = date.isSame(moment(), "day");
              if (mid_error_occurred && mid_error != "") {
                res
                  .status(StatusCode.badRequest)
                  .send(ServerResponse.validationResponse(mid_error));
              } else if (dif >= 0 || is_today) {
                next();
              } else {
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.validationResponse(
                      "This invoice No. " +
                        invoice_data.invoice_no +
                        " is expired",
                    ),
                  );
              }
            } else {
              res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse(
                    "This invoice No. " +
                      invoice_data.invoice_no +
                      " is " +
                      invoice_data.status,
                  ),
                );
            }
          } else {
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Record not exits"));
          }
        }
      } catch (error) {
        logger.error(400, { message: error, stack: error?.stack });
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(error));
      }
    } else {
      res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
    }
  },
  get_card_transactions: async (req, res, next) => {
    const schema = Joi.object().keys({
      card_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid card id required");
        }),
      perpage: Joi.string().allow(""),
      page: Joi.string().allow(""),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
        let table_name = "customers_cards";

        let card_exits = await checkifrecordexist(
          {
            id: card_id,
          },
          table_name,
        );
        if (!card_exits) {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid card id"));
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  get_request: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Order id not valid/not supplied");
        }),
      // merchant_id: Joi.string()
      //     .required()
      //     .error(() => {
      //         return new Error("Merchant id not valid/not supplied");
      //     }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);

        res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code,
            ),
          );
      } else {
        if (req.bodyString("order_id")) {
          let order_id = req.bodyString("order_id");
          let table_name = "order_request";

          let order_exits = await checkifrecordexist(
            {
              order_id: order_id,
              // merchant_id: enc_dec.cjs_decrypt(
              //     req.bodyString("merchant_id")
              // ),
            },
            table_name,
          );
          if (!order_exits) {
            let payload = {
              psp_name: "paydart",
              psp_response_details: "Order id not valid/not supplied",
            };
            let common_err = await helpers.get_common_response(payload);

            res
              .status(StatusCode.ok)
              .send(
                ServerResponse.common_error_msg(
                  common_err.response[0].response_details,
                  common_err.response[0].response_code,
                ),
              );
          } else {
            next();
          }
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  test_cancel: async (req, res, next) => {
    const schema = Joi.object().keys({
      order_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid order id required");
        }),
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Token required");
        }),
    });
    const result = schema.validate(req.body);
    if (result.error) {
      res
        .status(StatusCode.ok)
        .send(ServerResponse.errormsg(result.error.message));
    } else {
      let order_id = req.bodyString("order_id");
      let table_name = "test_orders";
      let order_exits = await checkifrecordexist(
        {
          order_id: order_id,
        },
        table_name,
      );
      let order_is_processed = await checkifrecordexist(
        {
          order_id: order_id,
          status: "Pending",
        },
        table_name,
      );
      if (!order_exits) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid order id"));
      } else if (!order_is_processed) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Order is already processed"),
          );
      } else {
        next();
      }
    }
  },
  createCont: async (req, res, next) => {
    console.log("contineous");
  },
  apple_routing: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        order_id: Joi.string()
          .required()
          .error(() => {
            return new Error("Valid order id required");
          }),
        env: Joi.string()
          .valid("test", "live")
          .error(() => {
            return new Error("Valid env required (test, live)");
          }),
      });
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        const order_id = req.bodyString("order_id");
        let table_name = "orders";
        if (req.bodyString("env") == "test") {
          table_name = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
          },
          table_name,
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
      logger.error(400, { message: error, stack: error?.stack });
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  set_expired_order: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        order_id: Joi.string()
          .required()
          .error(() => {
            return new Error("Valid order id required");
          }),
        env_mode: Joi.string()
          .valid("test", "live")
          .error(() => {
            return new Error("Valid env required (test, live)");
          }),
      });
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        const order_id = req.bodyString("order_id");
        let table_name = "orders";
        if (req.bodyString("env_mode") == "test") {
          table_name = "test_orders";
        }
        const orderdata = await merchantOrderModel.selectOne(
          "*",
          {
            order_id: order_id,
          },
          table_name,
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
      logger.error(400, { message: error, stack: error?.stack });
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
};

module.exports = MerchantOrderValidator;
