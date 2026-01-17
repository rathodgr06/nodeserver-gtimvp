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
      let classType = req.body.data.class;
      if (classType === "ECOM" || classType === "CONT") {
        let classType = req.body.data.class;
        switch (classType) {
          case "CONT":
            try {
              let transactionDetails = req.body.data;
              let transactionSchema = Joi.object().keys({
                class: Joi.string()
                  .valid("CONT")
                  .error(() => {
                    return new Error("Class not valid/not supplied");
                  }),
                action: Joi.string()
                  .valid("SALE")
                  .error(() => {
                    return new Error("Order action not valid/not supplied");
                  }),
                transaction_id: Joi.string()
                  .required()
                  .error(() => {
                    return new Error("Transaction id not supplied");
                  }),
                amount: Joi.number()
                  .required()
                  .error(() => {
                    return new Error("Amount not valid/not supplied");
                  }),
                currency: Joi.string()
                  .currency()
                  .required()
                  .error(() => {
                    return new Error("Currency not valid/not supplied");
                  }),
              });
              const result1 = transactionSchema.validate(transactionDetails);
              if (result1.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result1.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              } else {
                let mode = req.credentials.type;

                let record_exits = false;
                if (mode == "test") {
                  record_exits = await checkifrecordexist(
                    { txn: req.body.data.transaction_id },
                    "test_order_txn"
                  );
                } else {
                  record_exits = await checkifrecordexist(
                    { txn: req.body.data.transaction_id },
                    "order_txn"
                  );
                }
                if (record_exits) {
                  next();
                } else {
                  let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Invalid transaction reference",
                  };
                  let common_err = await helpers.get_common_response(payload);

                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                }
              }
            } catch (err) {
              logger.error(400, { message: err, stack: err?.stack });
              console.log(err);
            }
            break;
          case "ECOM":
            try {
              // let action_data = req.body.data.actions;
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

              if (customer_details == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Customer details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }

              if (billing_details == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Billing details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }
              if (billing_details.address_line1 == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Address line 1 not valid/not supplied",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }

              if (shipping_details == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Shipping details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }
              if (order_details == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Order details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }
              if (urls == undefined) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "URLs object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              }

              const code_exist = await checkifrecordexist(
                {
                  dial: req.body.data.customer_details.code,
                },
                "country"
              );

              /*  if (!code_exist) {
                             let payload = {
                                 psp_name: "paydart",
                                 psp_response_details: "Mobile code invalid",
                             };
                             let common_err = await helpers.get_common_response(payload);
                             res.status(StatusCode.badRequest).send(
                                 ServerResponse.common_error_msg(
                                     common_err.response?.[0]?.response_details,
                                     common_err.response?.[0]?.response_code
                                 )
                             );
                         } */

              //console.log(code_exist);

              let mobile_length = await helpers.get_mobile_length(
                customer_details.code
              );
              // console.log(mobile_length);

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
                    .valid("MANUAL", "AUTOMATIC", "AUTOMATIC_ASYNC", "")
                    .required()
                    .error(() => {
                      return new Error("Capture method not valid/not supplied");
                    }),
                  otherwise: Joi.string().allow(""),
                }),
              });
              const customer_details_schema = Joi.object().keys({
                name: Joi.string()
                  .pattern(
                    /^[a-zA-Z]+ [a-zA-Z]+(([’,. -][a-zA-Z ])?[a-zA-Z]*)*$/
                  )
                  .min(1)
                  .max(50)
                  .required()
                  .error(() => {
                    return new Error("Name not valid/not supplied");
                  }),
                email: Joi.string()
                  .email()
                  .max(50)
                  .required()
                  .error(() => {
                    return new Error("Email not valid/not supplied");
                  }),
                code: Joi.string()
                  .min(1)
                  .max(9)
                  .error(() => {
                    return new Error("Mobile code not valid/not supplied");
                  }),
                code: Joi.alternatives().conditional("mobile", {
                  is: "",
                  then: Joi.string().allow(""),
                  otherwise: Joi.string()
                    .required()
                    .error(() => {
                      return new Error("Mobile code not valid/not supplied");
                    }),
                }),
                mobile: Joi.alternatives().conditional("code", {
                  is: "",
                  then: Joi.string().allow(""),
                  otherwise: Joi.string()
                    .required()
                    .pattern(/^[0-9]+$/)
                    .error(() => {
                      return new Error("Mobile No. not valid/not supplied");
                    }),
                }),
                m_customer_id: Joi.string()
                  .optional()
                  .max(50)
                  .allow("")
                  .error(() => {
                    return new Error("Customer Id not valid/not supplied");
                  }),
              });
              const order_details_schema = Joi.object().keys({
                m_order_id: Joi.string().optional().allow(""),
                amount: Joi.number()
                  .required()
                  .error(() => {
                    return new Error("Amount not valid/not supplied");
                  }),
                currency: Joi.string()
                  .currency()
                  .min(3)
                  .max(3)
                  .required()
                  .error(() => {
                    return new Error("Currency not valid/not supplied");
                  }),
                return_url: Joi.string().optional().allow(""),
                description: Joi.string()
                  .optional()
                  .allow("")
                  .max(200)
                  .error(() => {
                    return new Error("Description not valid/not supplied");
                  }),
                 statement_descriptor: Joi.string()
                .optional()
                .allow("")
                .error(
                  () =>
                    new Error(
                      "Statement descriptior not valid/not supplied (max 22 characters)"
                    )
                ),  
              });
              const billingDetailsSchema = Joi.object({
                address_line1: Joi.string()
                  .max(50)
                  .trim()
                  .required()
                  .error(() => {
                    return new Error("Address line 1 not valid/not supplied");
                  }),
                address_line2: Joi.string()
                  .optional()
                  .max(50)
                  .allow("")
                  .error(() => {
                    return new Error("Address line 2 not valid/not supplied");
                  }),
                country: Joi.string()
                  .regex(
                    /^(A(D|E|F|G|I|L|M|N|O|R|S|T|Q|U|W|X|Z)|B(A|B|D|E|F|G|H|I|J|L|M|N|O|R|S|T|V|W|Y|Z)|C(A|C|D|F|G|H|I|K|L|M|N|O|R|U|V|X|Y|Z)|D(E|J|K|M|O|Z)|E(C|E|G|H|R|S|T)|F(I|J|K|M|O|R)|G(A|B|D|E|F|G|H|I|L|M|N|P|Q|R|S|T|U|W|Y)|H(K|M|N|R|T|U)|I(D|E|Q|L|M|N|O|R|S|T)|J(E|M|O|P)|K(E|G|H|I|M|N|P|R|W|Y|Z)|L(A|B|C|I|K|R|S|T|U|V|Y)|M(A|C|D|E|F|G|H|K|L|M|N|O|Q|P|R|S|T|U|V|W|X|Y|Z)|N(A|C|E|F|G|I|L|O|P|R|U|Z)|OM|P(A|E|F|G|H|K|L|M|N|R|S|T|W|Y)|QA|R(E|O|S|U|W)|S(A|B|C|D|E|G|H|I|J|K|L|M|N|O|R|T|V|Y|Z)|T(C|D|F|G|H|J|K|L|M|N|O|R|T|V|W|Z)|U(A|G|M|S|Y|Z)|V(A|C|E|G|I|N|U)|W(F|S)|Y(E|T)|Z(A|M|W))$/
                  )
                  .min(2)
                  .max(2)
                  .required()
                  .error(() => {
                    return new Error("Country not valid/not supplied");
                  }),
                city: Joi.string()
                  .trim()
                  .max(50)
                  .required()
                  .error(() => {
                    return new Error("City not valid/not supplied");
                  }),
                pin: Joi.string()
                  .optional()
                  .min(3)
                  .max(13)
                  .allow("")
                  .pattern(/^[a-zA-Z0-9]+$/)
                  .error(() => {
                    return new Error("Pin code not valid/not supplied");
                  }),
                province: Joi.string()
                  .optional()
                  .max(50)
                  .allow("")
                  .error(() => {
                    return new Error("Province not valid/not supplied");
                  }),
              });
              const shippingDetailsSchema = Joi.object({
                address_line1: Joi.string()
                  .optional()
                  .allow("")
                  .max(50)
                  .error(() => {
                    return new Error("Address line 1 not valid/not supplied");
                  }),
                address_line2: Joi.string()
                  .optional()
                  .allow("")
                  .max(50)
                  .error(() => {
                    return new Error("Address line 2 not valid/not supplied");
                  }),
                country: Joi.string()
                  .regex(
                    /^(A(D|E|F|G|I|L|M|N|O|R|S|T|Q|U|W|X|Z)|B(A|B|D|E|F|G|H|I|J|L|M|N|O|R|S|T|V|W|Y|Z)|C(A|C|D|F|G|H|I|K|L|M|N|O|R|U|V|X|Y|Z)|D(E|J|K|M|O|Z)|E(C|E|G|H|R|S|T)|F(I|J|K|M|O|R)|G(A|B|D|E|F|G|H|I|L|M|N|P|Q|R|S|T|U|W|Y)|H(K|M|N|R|T|U)|I(D|E|Q|L|M|N|O|R|S|T)|J(E|M|O|P)|K(E|G|H|I|M|N|P|R|W|Y|Z)|L(A|B|C|I|K|R|S|T|U|V|Y)|M(A|C|D|E|F|G|H|K|L|M|N|O|Q|P|R|S|T|U|V|W|X|Y|Z)|N(A|C|E|F|G|I|L|O|P|R|U|Z)|OM|P(A|E|F|G|H|K|L|M|N|R|S|T|W|Y)|QA|R(E|O|S|U|W)|S(A|B|C|D|E|G|H|I|J|K|L|M|N|O|R|T|V|Y|Z)|T(C|D|F|G|H|J|K|L|M|N|O|R|T|V|W|Z)|U(A|G|M|S|Y|Z)|V(A|C|E|G|I|N|U)|W(F|S)|Y(E|T)|Z(A|M|W))$/
                  )
                  .min(2)
                  .max(2)
                  .allow("")
                  .optional()
                  .error(() => {
                    return new Error("Country not valid/not supplied");
                  }),
                city: Joi.string()
                  .allow("")
                  .max(50)
                  .optional()
                  .error(() => {
                    return new Error("City not valid/not supplied");
                  }),
                pin: Joi.string()
                  .optional()
                  .min(3)
                  .max(13)
                  .allow("")
                  .pattern(/^[a-zA-Z0-9]+$/)
                  .error(() => {
                    return new Error("Pin code not valid/not supplied");
                  }),
                province: Joi.string()
                  .optional()
                  .max(50)
                  .allow("")
                  .error(() => {
                    return new Error("Province not valid/not supplied");
                  }),
              });

              const response_url = Joi.object().keys({
                success: Joi.string().allow(""),
                cancel: Joi.string().allow(""),
                failure: Joi.string().allow(""),
              });

              const check_terminal_exit = await checkifrecordexist(
                {
                  mode: req.body.data.action,
                  submerchant_id: req.credentials.merchant_id,
                  env: req.credentials.type,
                  deleted: 0,
                },
                "mid"
              );
              var ship_country = true;
              var ship_city = true;
              if (shipping_details.country != "") {
                ship_country = await checkifrecordexist(
                  { iso2: shipping_details.country, status: 0, deleted: 0 },
                  "country"
                );

                if (shipping_details.city != "") {
                  ship_city = await helpers.find_city_by_country(
                    shipping_details.city,
                    shipping_details.country
                  );
                }
              }

              const bill_country = await checkifrecordexist(
                { iso2: billing_details.country, status: 0, deleted: 0 },
                "country"
              );
              const bill_city = await helpers.find_city_by_country(
                billing_details.city,
                billing_details.country
              );
              let card_id_exist = true;
              if (payment_token) {
                let id = enc_dec.cjs_decrypt(payment_token);
                card_id_exist = await checkifrecordexist(
                  {
                    id: id,
                    // merchant_id: req.credentials.merchant_id,
                  },
                  "customers_cards"
                );
                if (!card_id_exist) {
                  let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Invalid payment token.",
                  };
                  let common_err = await helpers.get_common_response(payload);
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response[0]?.response_details,
                        common_err.response[0]?.response_code
                      )
                    );
                }
              }

              const result3 = schema.validate(action_data);
              const result1 =
                customer_details_schema.validate(customer_details);
              const result2 = order_details_schema.validate(order_details);
              const result4 = billingDetailsSchema.validate(billing_details);
              const result5 = response_url.validate(urls);
              const result6 = shippingDetailsSchema.validate(shipping_details);
              // let common_err
              if (result3.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result3.error.message,
                };
                let common_err = await helpers.get_common_response(payload);
                if (common_err?.response[0]?.response_details) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        result3.error.message,
                        99
                      )
                    );
                }
              } else if (result1.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result1.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                if (common_err?.response[0]?.response_details) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                } else {
                  console.log(`the error details are below`);
                  console.log(result1.error.message);
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(result1.error.message,
                       99
                      )
                    );
                }
              } else if (result4.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result4.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                console.log(common_err);

                if (common_err?.response[0]?.response_details) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        result4.error.message,
                        99
                      )
                    );
                }

                // res.status(StatusCode.ok).send(
                //     ServerResponse.errormsg(result4.error.message)
                // );
              } else if (result2.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result2.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                if (common_err?.response[0]?.response_details) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        result2.error.message,
                        99
                      )
                    );
                }

                // res.status(StatusCode.ok).send(
                //     ServerResponse.errormsg(result2.error.message)
                // );
              } else if (result6.error) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: result6.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                if (common_err?.response[0]?.response_details) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        common_err.response?.[0]?.response_details,
                        common_err.response?.[0]?.response_code
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.common_error_msg(
                        result6.error.message,
                        99
                      )
                    );
                }

                // res.status(StatusCode.ok).send(
                //     ServerResponse.errormsg(result3.error.message)
                // );
              } /* else if (!check_terminal_exit) {
                            let payload = {
                                psp_name: "paydart",
                                psp_response_details: `Mid not found for ${req.body.data.action} transactions`,
                            };
                            let common_err = await helpers.get_common_response(payload);
                            
            
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.common_error_msg(
                                    common_err.response?.[0]?.response_details,
                                    common_err.response?.[0]?.response_code
                                )
                            );
                        } */ else if (
                !code_exist &&
                req.body.data.customer_details.mobile != ""
              ) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Mobile code not valid/not supplied",
                };

                let common_err = await helpers.get_common_response(payload);

                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              } else if (customer_details.mobile.length != mobile_length) {
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.validationResponse(
                      `Please enter mobile no. at least ${mobile_length} digits.`
                    )
                  );
              } else if (!card_id_exist) {
                let payload = {
                  psp_name: "paydart",
                  psp_response_details: "Payment token not valid/not supplied",
                };

                let common_err = await helpers.get_common_response(payload);

                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.common_error_msg(
                      common_err.response?.[0]?.response_details,
                      common_err.response?.[0]?.response_code
                    )
                  );
              } else if (result5.error) {
                res
                  .status(StatusCode.ok)
                  .send(ServerResponse.errormsg(result5.error.message));
              } else if (!bill_country || !ship_country) {
                if (!bill_country) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.validationResponse(
                        `Billing country not exist.`
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.validationResponse(
                        `Shipping country not exist.`
                      )
                    );
                }
              } else if (!bill_city || !ship_city) {
                if (!bill_city) {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.validationResponse(
                        `Billing city not exist.`
                      )
                    );
                } else {
                  res
                    .status(StatusCode.badRequest)
                    .send(
                      ServerResponse.validationResponse(
                        `Shipping city not exist.`
                      )
                    );
                }
              } else {
                let mid_data = await helpers.get_mid_by_merchant_id(
                  req?.credentials?.merchant_id,
                  order_details.currency,
                  req.credentials.type
                );

                if (mid_data.length > 0) {
                  let min_amount = mid_data.reduce(
                    (min, p) => (p.minTxnAmount < min ? p.minTxnAmount : min),
                    mid_data[0].minTxnAmount
                  );
                  let max_amount = mid_data.reduce(
                    (max, p) => (p.maxTxnAmount > max ? p.maxTxnAmount : max),
                    mid_data[0].maxTxnAmount
                  );

                  if (order_details.amount < min_amount) {
                    return res
                      .status(StatusCode.badRequest)
                      .send(
                        ServerResponse.errormsg(
                          "Order amount is less than min order amount"
                        )
                      );
                  }
                  if (order_details.amount > max_amount) {
                    return res
                      .status(StatusCode.badRequest)
                      .send(
                        ServerResponse.errormsg(
                          "Order amount is greater than max order amount"
                        )
                      );
                  }
                } else {
                  return res
                    .status(StatusCode.ok)
                    .send(
                      ServerResponse.errormsg(
                        "No active MID found for currency " +
                          order_details.currency +
                          "."
                      )
                    );
                }
                if (
                  !result1.error &&
                  !result2.error &&
                  !result3.error &&
                  !result4.error
                ) {
                  next();
                }
              }
            } catch (err) {
              logger.error(400, { message: err, stack: err?.stack });
             
              res
                .status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(err));
            }
            break;
        }
      } else {
        let payload = {
          psp_name: "paydart",
          psp_response_details: "Class not valid/not supplied",
        };
        let common_err = await helpers.get_common_response(payload);
        console.log(common_err);

        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.common_error_msg(
              common_err.response?.[0]?.response_details,
              common_err.response?.[0]?.response_code
            )
          );
      }
    } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
      throw error;
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
        "test_orders"
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
              common_err.response[0].response_code
            )
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
              common_err.response[0]?.response_code
            )
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
              common_err.response[0].response_code
            )
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
              common_err.response[0].response_code
            )
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
              common_err.response[0].response_code
            )
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
          table_name
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
        logger.error(400,{message: error,stack: error?.stack});
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
            table_name
          );
          if (!order_exits)
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
        }
        next();
      }
    } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
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
            "test_orders"
          );
          if (!order_exits)
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
        }
        next();
      }
    } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
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
              common_err.response[0].response_code
            )
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
            table_name
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
                  common_err.response[0].response_code
                )
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
        logger.error(400,{message: error,stack: error?.stack});
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
          table_name
        );
        let order_is_processed = await checkifrecordexist(
          {
            order_id: order_id,
            // merchant_id: req.order.merchant_id /*status: 'Created'*/,
          },
          table_name
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
              ServerResponse.validationResponse("Order is already processed")
            );
        } else if (card_id) {
          let card_exits = await checkifrecordexist(
            {
              id: card_id,
            },
            "customers_cards"
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
          table_name
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
            "customers_cards"
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
          table_name
        );

        if (!orderdata) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid order id"));
        } else if (orderdata.status !== "PENDING") {
          return res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Order Already Processed!!")
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
        table_name
      );
      let order_is_processed = await checkifrecordexist(
        {
          order_id: order_id,
          // merchant_id: req.order.merchant_id,
          status: ["Pending", "FAILED"],
        },
        table_name
      );

      if (!order_exits) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid order id"));
      } else if (!order_is_processed) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Order is already processed")
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
        table_name
      );
      if (!card_exits) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              "Invalid card id or already deleted."
            )
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
            table_name
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
        logger.error(400,{message: error,stack: error?.stack});
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
            table_name
          );
          if (!order_exits)
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid order id"));
          let browser_fingerprint = JSON.parse(
            enc_dec.cjs_decrypt(req.bodyString("browserFP"))
          );
          req.browser_fingerprint = browser_fingerprint;
          let dec_card_id = enc_dec.cjs_decrypt(req.bodyString("card_id"));
          let card_exits = await checkifrecordexist(
            {
              id: dec_card_id,
            },
            "customers_cards"
          );
          if (!card_exits)
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid card id"));
        }
        next();
      }
    } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
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
          table_name
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
        logger.error(400,{message: error,stack: error?.stack});
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
          "test_orders"
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
        logger.error(400,{message: error,stack: error?.stack});
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
        logger.error(400,{message: error,stack: error?.stack});
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
      "merchant_qr_codes"
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

    let qr_order_data = await merchantOrderModel.selectMerchantIdByQrCode(
      record_id
    );
    // console.log("mode", perDayData.sub_merchant_id, perDayData.currency, mode);

    let mid_data = await helpers.get_mid_by_merchant_id(
      perDayData.sub_merchant_id,
      req.body.data.order_details.currency,
      mode
    );

    // console.log(mid_data);

    if (mid_data.length > 0) {
      let min_amount = mid_data.reduce(
        (min, p) => (p.minTxnAmount < min ? p.minTxnAmount : min),
        mid_data[0].minTxnAmount
      );
      let max_amount = mid_data.reduce(
        (max, p) => (p.maxTxnAmount > max ? p.maxTxnAmount : max),
        mid_data[0].maxTxnAmount
      );

      console.log("🚀 ~ create_qr_order: ~ min_amount:", min_amount);
      console.log(
        "🚀 ~ create_qr_order: ~ order_details.amount:",
        order_details.amount
      );
      if (order_details.amount < min_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Order amount is less than min order amount"
            )
          );
      }
      if (order_details.amount > max_amount) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.errormsg(
              "Order amount is greater than max order amount"
            )
          );
      }
    } else {
      return res
        .status(StatusCode.ok)
        .send(
          ServerResponse.errormsg(
            "Merchant not accepting payments in " +
              req?.body?.data?.order_details?.currency +
              "."
          )
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
        "qr_payment"
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
          "qr_payment"
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
            "qr_payment"
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
            "qr_payment"
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
          "qr_payment"
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
          "qr_payment"
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
          "qr_payment"
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
            "inv_invoice_master"
          );

          console.log(invoice_data);

          if (invoice_data) {
            // MID Validation
            let mid_data = await helpers.get_mid_by_merchant_id(
              invoice_data.sub_merchant_id,
              invoice_data.currency,
              invoice_data.mode
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
                        " is expired"
                    )
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
                      invoice_data.status
                  )
                );
            }
          } else {
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Record not exits"));
          }
        }
      } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
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
          table_name
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
        logger.error(400,{message: error,stack: error?.stack});
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
              common_err.response[0].response_code
            )
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
            table_name
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
                  common_err.response[0].response_code
                )
              );
          } else {
            next();
          }
        }
      }
    } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
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
        table_name
      );
      let order_is_processed = await checkifrecordexist(
        {
          order_id: order_id,
          status: "Pending",
        },
        table_name
      );
      if (!order_exits) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid order id"));
      } else if (!order_is_processed) {
        res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Order is already processed")
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
          table_name
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
        logger.error(400,{message: error,stack: error?.stack});
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
          table_name
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
        logger.error(400,{message: error,stack: error?.stack});
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
};

module.exports = MerchantOrderValidator;
