const Joi = require("joi").extend(require("@joi/date")).extend(require("joi-currency-code"));;
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
const { valid } = require("joi");
const logger = require('../../config/logger');

const S2SValidator = {
    execuatePayment: async (req, res, next) => {
        try {
            // let action_data = req.body.data.actions;
            let customer_details = req.body.customer_details;
            let order_details = req.body.order_details;
            let billing_details = req.body.billing_details;
            let shipping_details = req.body.shipping_details;
            let payment_token = req.body.payment_token;
            let urls = req.body.urls;
            let action_data = {
                action: req.body.action,
                capture_method: req.body.capture_method,
            };
            let payment_method = req.body.paymentMethod;
            if (payment_method == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Payment details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }

            if (customer_details == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Customer details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }

            if (billing_details == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Billing details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }
            if (billing_details.address_line1 == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Address line 1 not valid/not supplied",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }

            if (shipping_details == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Shipping details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }
            if (order_details == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Order details object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }
            if (urls == undefined) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "URLs object missing",
                };
                let common_err = await helpers.get_common_response(payload);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }

            const code_exist = await checkifrecordexist(
                {
                    dial: req.body.customer_details.code
                },
                "country"
            );

            // let mobile_length = await helpers.get_mobile_length(
            //     customer_details.code
            // );
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
                            return new Error(
                                "Capture method not valid/not supplied"
                            );
                        }),
                    otherwise: Joi.string().allow(""),
                }),
            });
            const payment_method_schema = Joi.object().keys({
                paymentCard: Joi.object().keys({
                    number: Joi.string().min(12).max(20).required().error(() => {return new Error("Valid card no required");}),
                    securityCode: Joi.string().min(3) .max(4).pattern(/^[0-9]+$/).required().error(() => {return new Error("Valid cvv required");}),
                    expiryDate:Joi.date().format("MM/YYYY").raw().greater(Date.now()).required().error(() => {return new Error("Valid expiry date required");})
                }),
                tokenize:Joi.number().valid(0,1).optional().allow("").error(()=>{return new Error("Valid tokenization value required")})
            })
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
                            return new Error(
                                "Mobile code not valid/not supplied"
                            );
                        }),
                }),
                mobile: Joi.alternatives().conditional("code", {
                    is: "",
                    then: Joi.string().allow(""),
                    otherwise: Joi.string()
                        .required()
                        .pattern(/^[0-9]+$/)
                        .error(() => {
                            return new Error(
                                "Mobile No. not valid/not supplied"
                            );
                        }),
                }),
                m_customer_id: Joi.string().optional().max(50).allow("").error(() => {
                    return new Error("Customer Id not valid/not supplied");
                })
            })
            const order_details_schema = Joi.object().keys({
                m_order_id: Joi.string().optional().allow(""),
                amount: Joi.number()
                    .required()
                    .error(() => {
                        return new Error("Amount not valid/not supplied");
                    }),
                currency: Joi.string().currency()
                    .min(3)
                    .max(3)
                    .required()
                    .error(() => {
                        return new Error("Currency not valid/not supplied");
                    }),
                return_url: Joi.string().optional().allow(""),
                description: Joi.string().optional().allow("")
                    .max(200)
                    .error(() => {
                        return new Error("Description not valid/not supplied");
                    }),
            });
            const billingDetailsSchema = Joi.object({
                address_line1: Joi.string()
                    .max(50)
                    .trim()
                    .required()
                    .error(() => {
                        return new Error(
                            "Address line 1 not valid/not supplied"
                        );
                    }),
                address_line2: Joi.string().optional().max(50).allow("").error(() => {
                    return new Error(
                        "Address line 2 not valid/not supplied"
                    );
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
                        return new Error(
                            "Address line 1 not valid/not supplied"
                        );
                    }),
                address_line2: Joi.string()
                    .optional()
                    .allow("")
                    .max(50)
                    .error(() => {
                        return new Error(
                            "Address line 2 not valid/not supplied"
                        );
                    }),
                country: Joi.string()
                    .regex(
                        /^(A(D|E|F|G|I|L|M|N|O|R|S|T|Q|U|W|X|Z)|B(A|B|D|E|F|G|H|I|J|L|M|N|O|R|S|T|V|W|Y|Z)|C(A|C|D|F|G|H|I|K|L|M|N|O|R|U|V|X|Y|Z)|D(E|J|K|M|O|Z)|E(C|E|G|H|R|S|T)|F(I|J|K|M|O|R)|G(A|B|D|E|F|G|H|I|L|M|N|P|Q|R|S|T|U|W|Y)|H(K|M|N|R|T|U)|I(D|E|Q|L|M|N|O|R|S|T)|J(E|M|O|P)|K(E|G|H|I|M|N|P|R|W|Y|Z)|L(A|B|C|I|K|R|S|T|U|V|Y)|M(A|C|D|E|F|G|H|K|L|M|N|O|Q|P|R|S|T|U|V|W|X|Y|Z)|N(A|C|E|F|G|I|L|O|P|R|U|Z)|OM|P(A|E|F|G|H|K|L|M|N|R|S|T|W|Y)|QA|R(E|O|S|U|W)|S(A|B|C|D|E|G|H|I|J|K|L|M|N|O|R|T|V|Y|Z)|T(C|D|F|G|H|J|K|L|M|N|O|R|T|V|W|Z)|U(A|G|M|S|Y|Z)|V(A|C|E|G|I|N|U)|W(F|S)|Y(E|T)|Z(A|M|W))$/
                    )
                    .min(2)
                    .max(2)
                    .allow('')
                    .optional()
                    .error(() => {
                        return new Error("Country not valid/not supplied");
                    }),
                city: Joi.string()
                    .allow('')
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
                callback: Joi.string().optional().allow("").error(()=>{
                    return new Error("Callback url required")
                })
            });

            const check_terminal_exit = await checkifrecordexist(
                {
                    mode: req.body.action,
                    submerchant_id: req.credentials.merchant_id,
                    env: req.credentials.type,
                    deleted: 0
                },
                "mid"
            );
            var ship_country = true
            var ship_city = true
            if (shipping_details.country != "") {
                ship_country = await checkifrecordexist({ 'iso2': shipping_details.country, 'status': 0, 'deleted': 0 }, 'country');

                if (shipping_details.city != "") {
                    ship_city = await helpers.find_city_by_country(
                        shipping_details.city, shipping_details.country
                    );
                }
            }

            const bill_country = await checkifrecordexist({ 'iso2': billing_details.country, 'status': 0, 'deleted': 0 }, 'country');
            const bill_city = await helpers.find_city_by_country(billing_details.city, billing_details.country);
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
                        psp_response_details: 'Invalid payment token.',
                    };
                    let common_err = await helpers.get_common_response(payload);
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0]?.response_details,
                            common_err.response[0]?.response_code
                        )
                    );
                }
            }



            const result3 = schema.validate(action_data);
            const result1 = customer_details_schema.validate(customer_details);
            const result2 = order_details_schema.validate(order_details);
            const result4 = billingDetailsSchema.validate(billing_details);
            const result5 = response_url.validate(urls);
            const result6 = shippingDetailsSchema.validate(shipping_details);
            const result7 = payment_method_schema.validate(payment_method)
            // let common_err
            if (result3.error) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result3.error.message,
                };
                let common_err = await helpers.get_common_response(payload);
                if (common_err?.response[0]?.response_details) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result3.error.details[0].message,
                            99
                        ))
                }

            } else if (result1.error) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result1.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                if (common_err?.response[0]?.response_details) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result1.error.details[0].message,
                            99
                        ))
                }
            } else if (result4.error) {
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result4.error.message,
                };
                let common_err = await helpers.get_common_response(payload);

                console.log(common_err);

                if (common_err?.response[0]?.response_details) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result4.error.details[0].message,
                            99
                        ))
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
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result2.error.details[0].message,
                            99
                        ))
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
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result6.error.details[0].message,
                            99
                        ))
                }

                // res.status(StatusCode.ok).send(
                //     ServerResponse.errormsg(result3.error.message)
                // );
            } else if (result7.error){
                let payload = {
                    psp_name: "paydart",
                    psp_response_details: result7.error.message,
                };
                let common_err = await helpers.get_common_response(payload);


                if (common_err?.response[0]?.response_details) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    )
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            result7.error.details[0].message,
                            99
                        ))
                }
            }
            /* else if (!check_terminal_exit) {
                            let payload = {
                                psp_name: "paydart",
                                psp_response_details: `Mid not found for ${req.body.data.action} transactions`,
                            };
                            let common_err = await helpers.get_common_response(payload);
                            
            
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.common_error_msg(
                                    common_err.response[0].response_details,
                                    common_err.response[0].response_code
                                )
                            );
                        } */ else if (!code_exist && req.body.data.customer_details.mobile != "") {

                let payload = {
                    psp_name: "paydart",
                    psp_response_details: "Mobile code not valid/not supplied",
                };

                let common_err = await helpers.get_common_response(payload);


                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            }/* else if (customer_details.mobile.length != mobile_length) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Please enter mobile no. at least ${mobile_length} digits.`));
            }*/ else if (!card_id_exist) {

                let payload = {
                    psp_name: "paydart",
                    psp_response_details:
                        "Payment token not valid/not supplied",
                };

                let common_err = await helpers.get_common_response(payload);


                res.status(StatusCode.badRequest).send(
                    ServerResponse.common_error_msg(
                        common_err.response[0].response_details,
                        common_err.response[0].response_code
                    )
                );
            } else if (result5.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result5.error.message)
                );
            } else if (!bill_country || !ship_country) {
                if (!bill_country) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing country not exist.`));
                } else {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping country not exist.`));
                }

            } else if (!bill_city || !ship_city) {
                if (!bill_city) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing city not exist.`));
                } else {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping city not exist.`));
                }

            } else {
                let mid_data = await helpers.get_mid_by_merchant_id(
                    req?.credentials?.merchant_id, order_details.currency, req.credentials.type
                );

                if (mid_data.length > 0) {
                    let min_amount = mid_data.reduce((min, p) => p.minTxnAmount < min ? p.minTxnAmount : min, mid_data[0].minTxnAmount);
                    let max_amount = mid_data.reduce((max, p) => p.maxTxnAmount > max ? p.maxTxnAmount : max, mid_data[0].maxTxnAmount);

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
                        .send(ServerResponse.errormsg("No active MID found for currency " + order_details.currency + '.'));
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
        } catch (error) {
            console.log(error);
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }


    }

}
module.exports = S2SValidator;