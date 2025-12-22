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
            let action_data = {
                action: req.body.action,
                capture_method: req.body.capture_method,
            };
            let payment_method = req.body.paymentMethod;

            // Validate required objects exist
            if (payment_method === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Payment details object missing")
                );
            }

            if (customer_details === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Customer details object missing")
                );
            }

            if (billing_details === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Billing details object missing")
                );
            }

            // if (billing_details.address_line1 === undefined) {
            //     return res.status(StatusCode.badRequest).send(
            //         await getCommonError("Address line 1 not valid/not supplied")
            //     );
            // }

            if (shipping_details === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Shipping details object missing")
                );
            }

            if (order_details === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Order details object missing")
                );
            }

            if (urls === undefined) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("URLs object missing")
                );
            }

            // Check country code exists
            const code_exist = await checkifrecordexist(
                { dial: req.body.customer_details.code },
                "country"
            );

            // Schema definitions
            const schema = Joi.object().keys({
                action: Joi.string()
                    .valid("AUTH", "SALE")
                    .required()
                    .error(() => new Error("Order action not valid/not supplied")),
                capture_method: Joi.alternatives().conditional("action", {
                    is: "AUTH",
                    then: Joi.string()
                        .valid("MANUAL", "AUTOMATIC",)
                        .required()
                        .error(() => new Error("Capture method not valid/not supplied")),
                    otherwise: Joi.string().allow(""),
                }),
            });

            // Enhanced Payment Method Schema with Wallet Support
            const payment_method_schema = Joi.object().keys({
                // Wallet configuration - optional for backward compatibility
                is_wallet: Joi.string()
                    .valid("0", "1")
                    .optional()
                    .default("0")
                    .error(() => new Error("is_wallet must be '0' or '1'")),

                // Wallet details - required when is_wallet is "1"
                wallet_details: Joi.when("is_wallet", {
                    is: "1",
                    then: Joi.object().keys({
                        walletType: Joi.string()
                            .valid("mtn-momo","mtn","orange","orange-money","ZEEPAY GHANA LIMITED","G-MONEY","MTN","AIRTELTIGO MONEY","VODAFONE CASH","GHANAPAY","YUP GHANA LIMITED")
                            .required()
                            .error(() => new Error("Valid wallet type required when is_wallet is 1")),
                        mobileCode:Joi.string()
                             .required()
                             .error(()=>new Error("valid mobile code required")),
                        msisdn: Joi.string()
                            .pattern(/^[0-9]{7,15}$/)
                            .optional()
                            .error(() => new Error("Valid MSISDN required (7-15 digits)"))
                    }).required(),
                    otherwise: Joi.object().optional().allow(null, "")
                }),

                // Payment card details - required when is_wallet is "0" or not provided
                paymentCard: Joi.when("is_wallet", {
                    is: "1",
                    then: Joi.object().optional().allow(null, ""),
                    otherwise: Joi.object().keys({
                        number: Joi.string()
                            .min(12)
                            .max(20)
                            .pattern(/^[0-9]+$/)
                            .required()
                            .error(() => new Error("Valid card number required (12-20 digits)")),
                        securityCode: Joi.string()
                            .min(3)
                            .max(4)
                            .pattern(/^[0-9]+$/)
                            .required()
                            .error(() => new Error("Valid CVV required (3-4 digits)")),
                        expiryDate: Joi.date()
                            .format("MM/YYYY")
                            .raw()
                            .greater(Date.now())
                            .required()
                            .error(() => new Error("Valid expiry date required (MM/YYYY format, future date)"))
                    }).required()
                }),

                // Tokenization flag
                tokenize: Joi.number()
                    .valid(0, 1)
                    .optional()
                    .allow("")
                    .error(() => new Error("Tokenize must be 0 or 1"))
            });

            const customer_details_schema = Joi.object().keys({
                name: Joi.string()
                    .pattern(/^[a-zA-Z]+ [a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/)
                    .min(1)
                    .max(50)
                    // .required()
                    .allow("")
                    .optional()
                    .error(() => new Error("Name not valid/not supplied (First and Last name required)")),
                email: Joi.string()
                    .email()
                    .max(50)
                   .allow("")
                    .optional()
                    .error(() => new Error("Email not valid/not supplied")),
                code:Joi.string().allow(""),// Joi.alternatives().conditional("mobile", {
                //     is: "",
                //     then: Joi.string().allow(""),
                //     otherwise: Joi.string()
                //         .min(1)
                //         .max(9)
                //         .pattern(/^[0-9]+$/)
                //         .required()
                //         .error(() => new Error("Mobile code not valid/not supplied")),
                // }),
                mobile: Joi.string().allow(""),// Joi.alternatives().conditional("code", {
                //     is: "",
                //     then: Joi.string().allow(""),
                //     otherwise: Joi.string()
                //         .required()
                //         .pattern(/^[0-9]+$/)
                //         .error(() => new Error("Mobile No. not valid/not supplied")),
                // }),
                m_customer_id: Joi.string()
                    .optional()
                    .max(50)
                    .allow("")
                    .error(() => new Error("Customer Id not valid/not supplied"))
            });

            const order_details_schema = Joi.object().keys({
                m_order_id: Joi.string().optional().max(50).allow(""),
                amount: Joi.number()
                    .positive()
                    .precision(2)
                    .required()
                    .error(() => new Error("Amount not valid/not supplied (must be positive number)")),
                currency: Joi.string()
                    .currency()
                    .length(3)
                    .required()
                    .error(() => new Error("Currency not valid/not supplied (3-letter ISO code)")),
                return_url: Joi.string().uri().optional().allow(""),
                description: Joi.string()
                    .optional()
                    .allow("")
                    .max(200)
                    .error(() => new Error("Description not valid/not supplied (max 200 characters)"))
            });

            const billingDetailsSchema = Joi.object({
                address_line1: Joi.string()
                    .max(50)
                    .trim()
                    .allow("")
                    .error(() => new Error("Address line 11 not valid/not supplied")),
                address_line2: Joi.string()
                    .optional()
                    .max(50)
                    .allow("")
                    .error(() => new Error("Address line 2 not valid/not supplied")),
                country: Joi.string()
                    .regex(/^(A(D|E|F|G|I|L|M|N|O|R|S|T|Q|U|W|X|Z)|B(A|B|D|E|F|G|H|I|J|L|M|N|O|R|S|T|V|W|Y|Z)|C(A|C|D|F|G|H|I|K|L|M|N|O|R|U|V|X|Y|Z)|D(E|J|K|M|O|Z)|E(C|E|G|H|R|S|T)|F(I|J|K|M|O|R)|G(A|B|D|E|F|G|H|I|L|M|N|P|Q|R|S|T|U|W|Y)|H(K|M|N|R|T|U)|I(D|E|Q|L|M|N|O|R|S|T)|J(E|M|O|P)|K(E|G|H|I|M|N|P|R|W|Y|Z)|L(A|B|C|I|K|R|S|T|U|V|Y)|M(A|C|D|E|F|G|H|K|L|M|N|O|Q|P|R|S|T|U|V|W|X|Y|Z)|N(A|C|E|F|G|I|L|O|P|R|U|Z)|OM|P(A|E|F|G|H|K|L|M|N|R|S|T|W|Y)|QA|R(E|O|S|U|W)|S(A|B|C|D|E|G|H|I|J|K|L|M|N|O|R|T|V|Y|Z)|T(C|D|F|G|H|J|K|L|M|N|O|R|T|V|W|Z)|U(A|G|M|S|Y|Z)|V(A|C|E|G|I|N|U)|W(F|S)|Y(E|T)|Z(A|M|W))$/)
                    .length(2)
                    .allow("")
                    .error(() => new Error("Country not valid/not supplied (2-letter ISO code)")),
                city: Joi.string()
                    .trim()
                    .max(50)
                    .allow("")
                    .error(() => new Error("City not valid/not supplied")),
                pin: Joi.string()
                    .optional()
                    .min(3)
                    .max(13)
                    .allow("")
                    .pattern(/^[a-zA-Z0-9]+$/)
                    .error(() => new Error("Pin code not valid/not supplied (alphanumeric, 3-13 chars)")),
                province: Joi.string()
                    .optional()
                    .max(50)
                    .allow("")
                    .error(() => new Error("Province not valid/not supplied"))
            });

            const shippingDetailsSchema = Joi.object({
                address_line1: Joi.string()
                    .optional()
                    .allow("")
                    .max(50)
                    .error(() => new Error("Address line 1 not valid/not supplied")),
                address_line2: Joi.string()
                    .optional()
                    .allow("")
                    .max(50)
                    .error(() => new Error("Address line 2 not valid/not supplied")),
                country: Joi.string()
                    .regex(/^(A(D|E|F|G|I|L|M|N|O|R|S|T|Q|U|W|X|Z)|B(A|B|D|E|F|G|H|I|J|L|M|N|O|R|S|T|V|W|Y|Z)|C(A|C|D|F|G|H|I|K|L|M|N|O|R|U|V|X|Y|Z)|D(E|J|K|M|O|Z)|E(C|E|G|H|R|S|T)|F(I|J|K|M|O|R)|G(A|B|D|E|F|G|H|I|L|M|N|P|Q|R|S|T|U|W|Y)|H(K|M|N|R|T|U)|I(D|E|Q|L|M|N|O|R|S|T)|J(E|M|O|P)|K(E|G|H|I|M|N|P|R|W|Y|Z)|L(A|B|C|I|K|R|S|T|U|V|Y)|M(A|C|D|E|F|G|H|K|L|M|N|O|Q|P|R|S|T|U|V|W|X|Y|Z)|N(A|C|E|F|G|I|L|O|P|R|U|Z)|OM|P(A|E|F|G|H|K|L|M|N|R|S|T|W|Y)|QA|R(E|O|S|U|W)|S(A|B|C|D|E|G|H|I|J|K|L|M|N|O|R|T|V|Y|Z)|T(C|D|F|G|H|J|K|L|M|N|O|R|T|V|W|Z)|U(A|G|M|S|Y|Z)|V(A|C|E|G|I|N|U)|W(F|S)|Y(E|T)|Z(A|M|W))$/)
                    .length(2)
                    .allow("")
                    .optional()
                    .error(() => new Error("Country not valid/not supplied (2-letter ISO code)")),
                city: Joi.string()
                    .allow("")
                    .max(50)
                    .optional()
                    .error(() => new Error("City not valid/not supplied")),
                pin: Joi.string()
                    .optional()
                    .min(3)
                    .max(13)
                            .allow("")
                            .pattern(/^[a-zA-Z0-9]+$/)
                    .error(() => new Error("Pin code not valid/not supplied (alphanumeric, 3-13 chars)")),
                province: Joi.string()
                    .optional()
                    .max(50)
                    .allow("")
                    .error(() => new Error("Province not valid/not supplied"))
            });

            const response_url = Joi.object().keys({
                callback: Joi.string()
                    .uri()
                    .optional()
                    .allow("")
                    .error(() => new Error("Valid callback URL required"))
            });

            // Validate country and city existence
            let ship_country = true;
            let ship_city = true;
            // if (shipping_details.country != "") {
            //     ship_country = await checkifrecordexist(
            //         { iso2: shipping_details.country, status: 0, deleted: 0 },
            //         "country"
            //     );
            //     if (shipping_details.city != "") {
            //         ship_city = await helpers.find_city_by_country(
            //             shipping_details.city,
            //             shipping_details.country
            //         );
            //     }
            // }

            // const bill_country = await checkifrecordexist(
            //     { iso2: billing_details.country, status: 0, deleted: 0 },
            //     "country"
            // );
            // const bill_city = await helpers.find_city_by_country(
            //     billing_details.city,
            //     billing_details.country
            // );

            // Validate payment token if provided
            let card_id_exist = true;
            if (payment_token) {
                let id = enc_dec.cjs_decrypt(payment_token);
                card_id_exist = await checkifrecordexist(
                    { id: id },
                    "customers_cards"
                );
                if (!card_id_exist) {
                    return res.status(StatusCode.badRequest).send(
                        await getCommonError("Invalid payment token.")
                    );
                }
            }

            // Run all validations
            const validations = [
                { result: schema.validate(action_data), name: "action_data" },
                { result: customer_details_schema.validate(customer_details), name: "customer_details" },
                { result: order_details_schema.validate(order_details), name: "order_details" },
                { result: billingDetailsSchema.validate(billing_details), name: "billing_details" },
                { result: shippingDetailsSchema.validate(shipping_details), name: "shipping_details" },
                { result: response_url.validate(urls), name: "urls" },
                { result: payment_method_schema.validate(payment_method), name: "payment_method" }
            ];

            // Check for validation errors
            for (const validation of validations) {
                if (validation.result.error) {
                    const common_err = await getCommonError(validation.result.error.message);
                    return res.status(StatusCode.badRequest).send(common_err);
                }
            }

            // Additional business logic validations
            if (!code_exist && customer_details.mobile != "") {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Mobile code not valid/not supplied")
                );
            }

            if (!card_id_exist) {
                return res.status(StatusCode.badRequest).send(
                    await getCommonError("Payment token not valid/not supplied")
                );
            }

            // if (!bill_country || !ship_country) {
            //     const msg = !bill_country ? "Billing country not exist." : "Shipping country not exist.";
            //     return res.status(StatusCode.badRequest).send(
            //         ServerResponse.validationResponse(msg)
            //     );
            // }

            // if (!bill_city || !ship_city) {
            //     const msg = !bill_city ? "Billing city not exist." : "Shipping city not exist.";
            //     return res.status(StatusCode.badRequest).send(
            //         ServerResponse.validationResponse(msg)
            //     );
            // }

            // Validate amount against MID limits
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
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg(
                            `Order amount must be at least ${min_amount} ${order_details.currency}`
                        )
                    );
                }
                if (order_details.amount > max_amount) {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.errormsg(
                            `Order amount cannot exceed ${max_amount} ${order_details.currency}`
                        )
                    );
                }
            } else {
                return res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(
                        `No active MID found for currency ${order_details.currency}.`
                    )
                );
            }

            // All validations passed
            next();
        } catch (error) {
            console.error("Payment validation error:", error);
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message || "Validation error occurred")
            );
        }
    }
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