const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const checkifrecordexist = require("./checkifrecordexist");
const checktype = require("./check_type");
const enc_dec = require("../decryptor/decryptor");
const { required } = require("joi");
const checkerwithcolumn = require("./checkerwithcolumn");
const checkmcc = require("./checkechatgesType");
const end_date = require("./checkexpiery");
const qrGenerateModule = require("../../models/qrGenerateModule");
const expiery = require("./check_expierydate");
const helpers = require("../helper/general_helper");
const moment = require("moment");
const qr_validation = {
    add: async (req, res, next) => {

        const schema = Joi.object().keys({
            sub_merchant_id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("sub merchant id required.");
                }),
            currency: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("currency required.");
                }),

            // Joi.string().min(1).max(20).trim().required().error(()=>{})
            type_of_qr: Joi.string()
                .valid("Static_QR", "Dynamic_QR")
                .trim()
                .required()
                .error(() => {
                    return new Error("type of qr required.");
                }),
            amount: Joi.alternatives().conditional("type_of_qr", {
                is: "Dynamic_QR",
                then: Joi.number().min(1).max(99999999).required().messages({
                    "number.base": "Amount must be a number",
                    "number.min": "Amount must be at least 1",
                    "number.max": "Amount must not exceed 9,999,999",
                    "any.required": "Amount is required",
                }),
                otherwise: Joi.string().optional().allow(""),
            }),
            quantity: Joi.alternatives().conditional("type_of_qr", {
                is: "Dynamic_QR",
                then: Joi.number()
                    .min(1)
                    .max(9999999)
                    .required()
                    .error(() => {
                        return new Error("quantity required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            no_of_collection: Joi.alternatives().conditional("type_of_qr", {
                is: "Dynamic_QR",
                then: Joi.number()
                    .min(1)
                    .max(9999999)
                    .required()
                    .error(() => {
                        return new Error("no. of collection required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            total_collection: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("total collection is required.");
                }),
            start_date: Joi.string().allow(""),
            is_expiry: Joi.alternatives().conditional("type_of_qr", {
                is: "Dynamic_QR",
                then: Joi.number()
                    .valid(0, 1)
                    .required()
                    .error(() => {
                        return new Error("expiry is required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            end_date: Joi.alternatives().conditional("is_expiry", {
                is: 1,
                then: Joi.date()
                    .min(moment().format("YYYY-MM-DD"))
                    .format("YYYY-MM-DD")
                    .iso()
                    .required()
                    .error(() => {
                        return new Error(
                            "End date should be today or greater than today."
                        );
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            overall_qty_allowed: Joi.number().min(1).max(9999999).required(),
            // .error(() => {
            //     return new Error("overall qty allowed is required.");
            // }),
            qty_frq: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("Quantity frequency is required.");
                }),
            description: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("description required.");
                }),
            error_msg: Joi.string().optional().allow(""),
            mode: Joi.string()
                .required()
                .error(() => {
                    return new Error("Mode is required.");
                }),
        });
        try {
            const result = schema.validate(req.body);

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                if (req.body.type_of_qr == "Static_QR") {
                    let record_id = await enc_dec.cjs_decrypt(
                        req.bodyString("sub_merchant_id")
                    );
                    let plan_exist = await checkifrecordexist(
                        {
                            sub_merchant_id: record_id,
                            currency: req.bodyString("currency"),
                        },
                        "merchant_qr_codes"
                    );

                    if (!plan_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "QR already exist."
                            )
                        );
                    }
                } else {
                    let overall_qty_allowed = req.bodyInt(
                        "overall_qty_allowed"
                    );
                    let quantity = req.bodyInt("quantity");
                    if (quantity > overall_qty_allowed) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Quantity per user per transaction can't be more than overall allowed quantity."
                            )
                        );
                    } else {
                        next();
                    }
                }
            }
        } catch (error) {
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_add: async (req, res, next) => {
        const schema = Joi.object().keys({
            // sub_merchant_id: Joi.string()
            //     .trim()
            //     .required()
            //     .error(() => {
            //         return new Error("sub merchant id required.");
            //     }),
            currency: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("Currency not valid/not supplied");
                }),
            amount: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("Amount not valid/not supplied");
                }),
            quantity: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("Quantity not valid/not supplied");
                }),
            no_of_collection: Joi.number()
                .min(1)
                .max(99999)
                .required()
                .error(() => {
                    return new Error("No of collection not valid/not supplied");
                }),
            total_collection: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("Total collection not valid/not supplied");
                }),
            start_date: Joi.string().allow(""),
            // start_date: Joi.string()
            //     .required()
            //     .error(() => {
            //         return new Error("Start date not valid/not supplied");
            //     }),
            is_expiry: Joi.number()
                .valid(0, 1)
                .required()
                .error(() => {
                    return new Error("Is expiry not valid/not supplied");
                }),
            end_date: Joi.alternatives().conditional("is_expiry", {
                is: 1,
                then: Joi.date()
                    .min(moment().format("YYYY-MM-DD"))
                    .format("YYYY-MM-DD")
                    .iso()
                    .required()
                    .error(() => {
                        return new Error(
                            "End date should be today or greater than today."
                        );
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            // end_date: Joi.date()
            //     .min(moment().format("YYYY-MM-DD"))
            //     .format("YYYY-MM-DD")
            //     .iso()
            //     .required()
            //     .error(() => {
            //         return new Error("End date not valid/not supplied");
            //     }),
            overall_qty_allowed: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error(
                        "Overall quantity allowed not valid/not supplied"
                    );
                }),
            qty_frq: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error(
                        "Quantity frequency not valid/not supplied"
                    );
                }),
            description: Joi.string().optional().allow(""),
            error_msg: Joi.string().optional().allow(""),
            // mode: Joi.string()
            //     .required()
            //     .error(() => {
            //         return new Error("Mode is required.");
            //     }),
        });
        try {
            const result = schema.validate(req.body);

            if (result.error) {
                
                // let payload = {
                //     psp_name: "paydart",
                //     psp_response_details: result.error.message,
                // };
                // let common_err = await helpers.get_common_response(payload);
                

                // res.status(StatusCode.badRequest).send(
                //     ServerResponse.common_error_msg(
                //         common_err.response[0].response_details,
                //         common_err.response[0].response_code
                //     )
                // );

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let overall_qty_allowed = req.bodyInt("overall_qty_allowed");
                let quantity = req.bodyInt("quantity");
                if (quantity > overall_qty_allowed) {
                    let payload = {
                        psp_name: "paydart",
                        psp_response_details:
                            "Quantity of transaction per user cannot be greater than overall allowed quantity",
                    };
                    let common_err = await helpers.get_common_response(payload);
                    

                    res.status(StatusCode.badRequest).send(
                        ServerResponse.common_error_msg(
                            common_err.response[0].response_details,
                            common_err.response[0].response_code
                        )
                    );

                    // res.status(StatusCode.badRequest).send(
                    //     ServerResponse.validationResponse(
                    //         "Quantity of transaction per user cannot be greater than overall allowed quantity"
                    //     )
                    // );
                } else {
                    next();
                }
            }
        } catch (error) {
            // 
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },

    update: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string()
                .min(10)
                .required()
                .error(() => {
                    return new Error("transaction setup id required");
                }),
            sub_merchant_id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("sub merchant id required.");
                }),
            type_of_qr: Joi.string()
                .valid("Static_QR", "Dynamic_QR")
                .trim()
                .required()
                .error(() => {
                    return new Error("qr type required.");
                }),
            currency: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("currency required.");
                }),
            amount: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("amount required.");
                }),
            quantity: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("quantity required.");
                }),

            no_of_collection: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("no. of collection required.");
                }),
            total_collection: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("total collection is required.");
                }),
            start_date: Joi.string().allow(""),
            is_expiry: Joi.number()
                .valid(0, 1)
                .required()
                .error(() => {
                    return new Error("expiry is required.");
                }),

            end_date: Joi.alternatives().conditional("is_expiry", {
                is: 1,
                then: Joi.date()
                    .min(moment().format("YYYY-MM-DD"))
                    .iso()
                    .required()
                    .error(() => {
                        return new Error(
                            "End date required and it should today or greater."
                        );
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            overall_qty_allowed: Joi.number()
                .min(1)
                .max(9999999)
                .required()
                .error(() => {
                    return new Error("overall qty allowed is required.");
                }),
            qty_frq: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("Quantity frequency is required.");
                }),
            description: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("description required.");
                }),
            error_msg: Joi.string().optional().allow(""),
        });
        try {
            const result = schema.validate(req.body);
            let cid = enc_dec.cjs_decrypt(req.bodyString("id"));

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let overall_qty_allowed = req.bodyInt("overall_qty_allowed");
                let quantity = req.bodyInt("quantity");
                if (quantity > overall_qty_allowed) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Quantity per user per transaction can't be more than overall allowed quantity."
                        )
                    );
                } else {
                    next();
                }
                // let plan_exist
                // if (req.body.is_expiry == 1) {
                //     plan_exist = await end_date(cid, 'Dynamic_QR', 'merchant_qr_codes');
                // }
                // else{
                //     plan_exist = await exp_date(cid, 'Dynamic_QR', 'merchant_qr_codes');
                // }

                
                // if (plan_exist) {

                // } else {
                //     res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Payment Link Already Expired.'));
                // }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    deactivate: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("transaction setup id required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    record_exist = await checkifrecordexist(
                        { id: record_id, is_reseted: 0, status: 0 },
                        "merchant_qr_codes"
                    );
                    // let type = await checktype({ id: record_id }, 'merchant_qr_codes');
                    // let qr_type = type[0].type_of_qr_code

                    // // if (qr_type == "Static_QR") {
                    //    ;
                    // }
                    // else if (qr_type == "Dynamic_QR") {
                    //     record_exist = await expiery(record_id, 'Dynamic_QR', 0, 'merchant_qr_codes');
                    // }

                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !record_exist
                                    ? "Record not found or already deactivated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    activate: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("transaction setup id required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    // let type = await checktype({ id: record_id }, 'merchant_qr_codes');
                    // let qr_type = type[0].type_of_qr_code
                    // if (qr_type == "Static_QR") {
                    record_exist = await checkifrecordexist(
                        { id: record_id, is_reseted: 0, status: 1 },
                        "merchant_qr_codes"
                    );
                    // }
                    // else if (qr_type == "Dynamic_QR") {
                    //     record_exist = await expiery(record_id, 'Dynamic_QR', 1, 'merchant_qr_codes');
                    // }
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !record_exist
                                    ? "Record not found or already activated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    details: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("transaction setup id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, is_reseted: 0, is_expired: 0 },
                        "merchant_qr_codes"
                    );
                    // let record_reset = await checkifrecordexist({ 'id': record_id, 'is_reseted': 0 }, 'merchant_qr_codes');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    reset: async (req, res, next) => {
        if (checkEmpty(req.body, ["id"])) {
            const schema = Joi.object().keys({
                id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Valid transaction setup id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("id"));
                    let record_exist = await checkifrecordexist(
                        { id: record_id, is_reseted: 0 },
                        "merchant_qr_codes"
                    );
                    // let record_reset = await checkifrecordexist({ 'id': record_id, 'is_reseted': 0 }, 'merchant_qr_codes');

                    // record_id = enc_dec.cjs_decrypt(req.bodyString('id'));

                    // let type = await checktype({ id: record_id, 'status': 1 }, 'merchant_qr_codes');
                    // let qr_type = type[0].type_of_qr_code
                    
                    // if (qr_type == "Static_QR") {
                    //     record_exist = await checkifrecordexist({ 'id': record_id, 'is_reseted': 0, 'status': 1 }, 'merchant_qr_codes');
                    // }
                    // else if (qr_type == "Dynamic_QR") {
                    //     record_exist = await expiery(record_id, 'Dynamic_QR', 1, 'merchant_qr_codes');
                    // }

                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record already reseted."
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    link_details: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["qr_id"])) {
            const schema = Joi.object().keys({
                qr_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("QR id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.bodyString("qr_id");
                    let perDayData = await qrGenerateModule.selectOne({
                        qr_id: record_id,
                    });
                    
                    let record_exist = await checkifrecordexist(
                        { qr_id: record_id, is_reseted: 0, is_expired: 0 },
                        "merchant_qr_codes"
                    );
                    let deactivate_data = await checkifrecordexist(
                        { qr_id: record_id, status: 0 },
                        "merchant_qr_codes"
                    );

                    if (perDayData?.type_of_qr_code === "Dynamic_QR") {
                        if (perDayData.is_expiry === 1) {
                            // total collection count
                            let today = moment().format("YYYY-MM-DD");
                            
                            if (moment(today).isAfter(perDayData.end_date)) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationResponse(
                                        `Link is expired`
                                    )
                                );
                            }

                            if (perDayData.qty_frq == "per_day") {
                                let day = new Date().toLocaleDateString("sv");
                                var sum_quantity_collection =
                                    await qrGenerateModule.per_day_quantity(
                                        {
                                            'qp.payment_id': `'${perDayData.qr_id}'`,
                                            'qp.currency': `'${perDayData.currency}'`,
                                        },
                                        `'${day}'`,
                                        "qr_payment"
                                    );
                            }

                            if (perDayData.qty_frq === "per_month") {
                                const d = new Date();
                                let month = d.getUTCMonth() + 1;
                                var sum_quantity_collection =
                                    await qrGenerateModule.per_month_quantity(
                                        {
                                            'qp.payment_id': `'${perDayData.qr_id}'`,
                                            'qp.currency': `'${perDayData.currency}'`,
                                        },
                                        `'${month}'`,
                                        "qr_payment"
                                    );
                            }

                            if (perDayData.qty_frq === "till_expiry") {
                                let expiry_date = moment(
                                    perDayData.end_date
                                ).format("YYYY-MM-DD");
                                var sum_quantity_collection =
                                    await qrGenerateModule.until_expiry_quantity(
                                        {
                                            'qp.payment_id': `'${perDayData.qr_id}'`,
                                            'qp.currency': `'${perDayData.currency}'`,
                                        },
                                        `'${expiry_date}'`,
                                        "qr_payment"
                                    );
                            }
                        } else {
                            var total_sum_quantity_overall =
                                await qrGenerateModule.over_all_quantity_sum(
                                    {
                                        'qp.payment_id': `'${perDayData.qr_id}'`,
                                        'qp.currency': `'${perDayData.currency}'`,
                                    },
                                    "qr_payment"
                                );

                           
                            if (perDayData.total_collection === "per_day") {
                                let day = new Date().toLocaleDateString("sv");
                                var sum_quantity_collection =
                                    await qrGenerateModule.per_day_quantity(
                                        {
                                            'qp.payment_id': `'${perDayData.qr_id}'`,
                                            'qp.currency': `'${perDayData.currency}'`,
                                        },
                                        `'${day}'`,
                                        "qr_payment"
                                    );
                            }
                            
                            
                            if (perDayData.total_collection === "per_month") {
                                const d = new Date();
                                let month = d.getUTCMonth() + 1;
                                var sum_quantity_collection =
                                    await qrGenerateModule.per_month_quantity(
                                        {
                                            'qp.payment_id': `'${perDayData.qr_id}'`,
                                            'qp.currency': `'${perDayData.currency}'`,
                                        },
                                        `'${month}'`,
                                        "qr_payment"
                                    );
                            }

                            // if (perDayData.total_collection === "till_expiry") {
                            //     let expiry_date = perDayData.end_date
                            //         .toISOString()
                            //         .substring(0, 10);

                            //     var sum_quantity_collection =
                            //         await qrGenerateModule.until_expiry_quantity(
                            //             {
                            //                 payment_id: `'${perDayData.qr_id}'`,
                            //                 currency: `'${perDayData.currency}'`,
                            //             },
                            //             `'${expiry_date}'`,
                            //             "qr_payment"
                            //         );
                            // }
                        }

                        if (total_sum_quantity_overall >= perDayData.overall_qty_allowed) {
                            const message = perDayData?.error_message
                                ? perDayData?.error_message
                                : "You can not make payment for this link, maximum overall quantity reached.";
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(message)
                            );
                        }
                        else if (
                            !record_exist ||
                            !deactivate_data ||
                            sum_quantity_collection >=
                            perDayData.overall_qty_allowed
                        ) {
                            if (!record_exist) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationResponse(
                                        `Record not found`
                                    )
                                );
                            } else if (!deactivate_data) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationResponse(
                                        `Invalid link`
                                    )
                                );
                            } else if (
                                sum_quantity_collection >=
                                perDayData.overall_qty_allowed
                            ) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationDataResponseModified(
                                        perDayData?.error_message,
                                        `You can not make payment for this link. Maximum collection limit reached`
                                    )
                                );
                                // res.status(StatusCode.badRequest).send(
                                //     ServerResponse.validationResponse(
                                //         `You can not make payment for this link. Maximum collection limit reached`
                                //     )
                                // );
                            }
                            // else if (
                            //     sum_quantity_collection >=
                            //     perDayData.no_of_collection
                            // ) {
                            //     res.status(StatusCode.badRequest).send(
                            //         ServerResponse.validationResponse(
                            //             `You can not make payment for this link. Per user maximum collection limit reached`
                            //         )
                            //     );
                            // }
                        } else {
                            // res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(!deactivate_data?"Invalid link.":!record_exist?'Record not found.':""));
                            next();
                        }
                    } else {
                        if (!record_exist || !deactivate_data) {
                            if (!record_exist) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationResponse(
                                        `Record not found`
                                    )
                                );
                            } else if (!deactivate_data) {
                                res.status(StatusCode.badRequest).send(
                                    ServerResponse.validationResponse(
                                        `Invalid link`
                                    )
                                );
                            }
                        } else {
                            next();
                        }
                    }
                }
            } catch (error) {
                console.log(error);
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    add_payment: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("id required.");
                }),
            sub_merchant_id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("sub merchant id required.");
                }),
            type_of_qr: Joi.string()
                .valid("Static_QR", "Dynamic_QR")
                .trim()
                .required()
                .error(() => {
                    return new Error("qr type required.");
                }),
            currency: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("currency required.");
                }),
            amount: Joi.alternatives().conditional("type_of_qr", {
                is: "Static_QR",
                then: Joi.number()
                    .min(1)
                    .max(9999999)
                    .required()
                    .error(() => {
                        return new Error("amount required.");
                    }),
                otherwise: Joi.number().optional().allow(""),
            }),
            quantity: Joi.alternatives().conditional("type_of_qr", {
                is: "Dynamic_QR",
                then: Joi.number()
                    .min(1)
                    .max(99999)
                    .required()
                    .error(() => {
                        return new Error("quantity required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            name: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("name required.");
                }),
            email: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("email required.");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let plan_exist;
                let quantity;
                let record_id = await enc_dec.cjs_decrypt(req.bodyString("id"));

                if (req.body.type_of_qr == "Static_QR") {
                    plan_exist = await checkifrecordexist(
                        { id: record_id, is_reseted: 0 },
                        "merchant_qr_codes"
                    );
                    if (plan_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "QR code is reseted"
                            )
                        );
                    }
                } else if (req.body.type_of_qr == "Dynamic_QR") {
                    plan_exist = await checkifrecordexist(
                        { id: record_id },
                        "merchant_qr_codes"
                    );

                    if (plan_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Record not found."
                            )
                        );
                    }
                }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    collection_payment: async (req, res, next) => {
        const schema = Joi.object().keys({
            qr_order_id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("qr order id required.");
                }),
            type_of_qr: Joi.string()
                .valid("Static_QR", "Dynamic_QR")
                .trim()
                .required()
                .error(() => {
                    return new Error("qr type required.");
                }),
            payment_id: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("payment id required.");
                }),
            amount: Joi.alternatives().conditional("type_of_qr", {
                is: "Static_QR",
                then: Joi.number()
                    .min(1)
                    .max(9999999)
                    .required()
                    .error(() => {
                        return new Error("amount required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            status: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("status required.");
                }),
            payment_mode: Joi.string()
                .trim()
                .required()
                .error(() => {
                    return new Error("payment mode required.");
                }),
            remark: Joi.string()
                .trim()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("remark required.");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    pay_mail: async (req, res, next) => {
        let email = req.body.emails.split(",");
        const schema = Joi.object().keys({
            id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Id required");
                }),
            emails: Joi.string()
                .email({
                    multiple: true,
                    // minDomainSegments: 2,
                    // tlds: { allow: ["com", "net"] },
                })
                .required()
                .error(() => {
                    return new Error("Valid emails required");
                }),
            //   cc_email: Joi.string().optional().allow('').error(() => {
            //       return new Error("CC Email id required")
            //   }),
            subject: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subject required");
                }),
            message: Joi.string()
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Message required");
                }),
            //    amount: Joi.string().optional().allow("").error(()=>{
            //       return new Error("Amount required")
            //    })
        });
        try {
            const result = schema.validate(req.body);

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                if (email.length > 40) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "More than 40 emails not allow at one time"
                        )
                    );
                } else {
                    next();
                }
                //   let record_exist = await checkifrecordexist({ 'id': enc_dec.cjs_decrypt(req.bodyString('invoice_id')) }, 'inv_invoice_master');
                //   if (record_exist) {
                // next();
                //   } else {
                //      res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found.'));
                //   }
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    open_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            status: Joi.string()
                .valid("Deactivated", "Active", "Expired")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Deactivated", "Active", or "Expired".',
                }),
            description: Joi.string().allow("").optional(),
            perpage: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error(
                        "Valid perpage value is required 1 - 1000"
                    );
                }),
            // .messages({
            //     "any.required": "The perpage field is required.",
            //     "number.base": "The perpage field must be a number.",
            //     "number.integer": "The perpage field must be an integer.",
            //     "number.positive":
            //         "The perpage field must be a positive number 1 - 1000.",
            //     "number.min": "The perpage field must be at least 1.",
            //     "number.max": "The perpage field must be at most 1000.",
            // }),
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
            // .messages({
            //     "any.required": "The page field is required.",
            //     "number.base": "The page field must be a number.",
            //     "number.integer": "The page field must be an integer.",
            //     "number.positive":
            //         "The page field must be a positive number 1 - 1000.",
            //     "number.min": "The page field must be at least 1.",
            //     "number.max": "The page field must be at most 1000.",
            // }),
            from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid from_date is required (ex: yyyy-mm-dd)"
                    );
                }),
            to_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid to_date is required (ex: yyyy-mm-dd)"
                    );
                }),
            amount_condition: Joi.string()
                .valid(
                    "less_then_equal",
                    "greater_then_equal",
                    "less_then",
                    "greater_then",
                    "equal_to"
                )
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        "Amount condition field must be one of the allowed values (equal_to, greater_then, less_then, greater_then_equal, less_then_equal).",
                }),
            amount: Joi.number().min(1).allow("").optional().messages({
                "number.base": "The amount field must be a number.",
                "number.min": "The amount field must be at least 1.",
            }),
            // is_expired: Joi.number()
            //     .valid(0, 1)
            //     .required().error(() => {
            //         return new Error("Expiry field is required between 0 or 1");
            //     }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                // let payload = {
                //     psp_name: "paydart",
                //     psp_response_details: result.error.message,
                // };
                // let common_err = await helpers.get_common_response(payload);
                

                // res.status(StatusCode.badRequest).send(
                //     ServerResponse.common_error_msg(
                //         common_err.response[0].response_details,
                //         common_err.response[0].response_code
                //     )
                // );

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_paymentLink_add: async (req, res, next) => {
       
        let no_of_transactions_per_user = req.body.no_of_transactions_per_user;
        let total_quantity_allowed = req.body.total_quantity_allowed;
        let link_expiry = req.body.link_expiry;
        let amount = req.body.amount;
        const schema = Joi.object().keys({
            description: Joi.string()
            .required()
            .trim()
            .max(1000)
            .error(() => {
                return new Error("Description not valid/supplied.");
            }),
           amount: Joi.object(),
          no_of_transactions_per_user: Joi.object(),
          total_quantity_allowed: Joi.object(),
          link_expiry: Joi.object(),
            error_msg: Joi.string()
            .required()
            .trim()
            .error(() => {
                return new Error("Error message not valid/supplied.");
            }),
            no_quantity_per_transaction:  Joi.number()
            .min(1)
            .max(9999999)
            .required()
            .messages({
                "number.base": "No quantity per transaction must be a number",
                "number.min": "Please enter no quantity per transaction equal to 1",
                "number.max": "Please enter  no quantity per transaction less than or equal to 9999999",
                "any.required": "No quantity per transaction is required",
        
          }),
           
        })
        const amountSchema = Joi.object().keys({
            currency: Joi.string()
            .trim()
            .required()
            .error(() => {
                return new Error("currency required.");
            }),
     
        value:  Joi.number().min(1).max(99999999).required().messages({
                "number.base": "Amount must be a number",
                "number.min": "Please enter amount equal to 1",
                "number.max": "Please enter amount less or equal to 8 digits",
                "any.required": "Amount is required",
        
        }),
        })
        const no_of_user_schema = Joi.object().keys({
      
        no_limit:  Joi.number()
        .valid('yes', 'no')
        .required()
        .error(() => {
            return new Error("Limit of no_of_transactions_per_user must be either yes or no.");

        }),
        quantity: Joi.alternatives().conditional("no_limit", {
            is: 'no',
            then:Joi.number().min(1).max(9999999).required()
            .messages({
                "number.base": "Quantity of no of transactions per user must be a number",
                "number.min": "Please enter quantity of no of transactions per user equal to 1",
                "number.max": "Please enter quantity of no of transactions per user less than or equal to 9999999",
                "any.required": "Quantity of no of transactions per user is required",
        
          }),
           
            otherwise: Joi.string().optional().allow(""),
        }),
        frequency: Joi.string()
            .valid("per_day", "per_month", "till_expiry")
            .required()
            .error(() => {
                return new Error("Frequency of no_of_transactions_per_user should be per_day, per_month, till_expiry.");
            }),
        
        })
        const expiry_schema = Joi.object().keys({
        is_expiry:  Joi.number()
        .valid('yes', 'no')
                .required()
                .error(() => {
                    return new Error("Expiry must be either yes or no.");
                
        }),
        end_date: Joi.alternatives().conditional("is_expiry", {
            is: 'yes',
            then: Joi.date()
                .min(moment().format("YYYY-MM-DD"))
                .format("YYYY-MM-DD")
                .iso()
                .required()
                .error(() => {
                    return new Error(
                        "End date should be today or greater than today."
                    );
                }),
            otherwise: Joi.string().optional().allow(""),
        }),
        })
        const total_quantity_schema = Joi.object().keys({
            quantity: Joi.alternatives().conditional("no_limit", {
                is: 'no',
                then:Joi.number().min(1).max(9999999).required()
                .messages({
                    "number.base": "Total quantity allowed must be a number",
                    "number.min": "Please enter total quantity allowed equal to 1",
                    "number.max": "Please enter total quantity allowed less than or equal to 9999999",
                    "any.required": "Total quantity allowed is required",
            
              }),
                
                otherwise: Joi.string().optional().allow(""),
            }),
        
            frequency: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("Frequency of total_quantity_allowed should be per_day, per_month, till_expiry.");
                }),
        
                no_limit:  Joi.number()
                .valid('yes', 'no')
                .required()
                .error(() => {
                    return new Error("Limit of total_quantity_allowed must be either yes or no.");
        
                }),
            });
            
        try {
            const result = schema.validate(req.body);
            const result2 = amountSchema.validate(amount);
            const result3 = no_of_user_schema.validate(no_of_transactions_per_user);
            const result4 = expiry_schema.validate(link_expiry);
            const result5 = total_quantity_schema.validate(total_quantity_allowed);
            if (result.error) {
              
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }else if(result3.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result3.error.message)
                );
            }else if(result4.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result4.error.message)
                );
            }else if(result5.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result5.error.message)
                );
            } else {
                let currency=await helpers.get_currency_id_by_name(req.body.amount.currency);
              
                let currency_exist=await helpers.check_if_data_currency_exist({'submerchant_id':req.credentials.merchant_id,'currency_id':currency},'mid');
                let overall_qty_allowed =total_quantity_allowed.no_limit=="yes"?"9999999": total_quantity_allowed.quantity;
               
                let quantity = req.body.no_quantity_per_transaction;
              
               if(!currency_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Currency not exist"
                        )
                    );
                } else if (parseInt(overall_qty_allowed) < parseInt(quantity) ) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "no_quantity_per_transaction can't be more than quantity of total_quantity_allowed."
                        )
                    );
                }
                else {
                    next();
                }
            }
        } catch (error) {
            // 
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_paymentLink_update: async (req, res, next) => {
       
        let no_of_transactions_per_user = req.body.no_of_transactions_per_user;
        let total_quantity_allowed = req.body.total_quantity_allowed;
        let link_expiry = req.body.link_expiry;
        let amount = req.body.amount;
        const schema = Joi.object().keys({
            data_id: Joi.string()
            .trim()
            .required()
            .error(() => {
                return new Error("Record ID required.");
            }),
            description: Joi.string()
            .required()
            .trim()
            .max(1000)
            .error(() => {
                return new Error("Description not valid/supplied.");
            }),
           amount: Joi.object(),
          no_of_transactions_per_user: Joi.object(),
          total_quantity_allowed: Joi.object(),
          link_expiry: Joi.object(),
            error_msg: Joi.string()
            .required()
            .trim()
            .error(() => {
                return new Error("Error message not valid/supplied.");
            }),
            no_quantity_per_transaction:  Joi.number()
            .min(1)
            .max(9999999)
            .required()
            .messages({
                "number.base": "no quantity per transaction must be a number",
                "number.min": "Please enter no quantity per transaction equal to 1",
                "number.max": "Please enter no quantity per transaction less than or equal to 9999999",
                "any.required": "No quantity per transaction is required",
        
          }),
        })
        const amountSchema = Joi.object().keys({
            currency: Joi.string()
            .trim()
            .required()
            .error(() => {
                return new Error("currency required.");
            }),
     
         value:  Joi.number().min(1).max(99999999).required().messages({
                "number.base": "Amount must be a number",
                "number.min": "Please enter a amount equal to 1",
                "number.max": "Please enter amount less than and equal to 8 digits",
                "any.required": "Amount is required",
        
        }),
        })
        const no_of_user_schema = Joi.object().keys({
      
        no_limit:  Joi.number()
        .valid('yes', 'no')
        .required()
        .error(() => {
            return new Error("Limit of no_of_transactions_per_user must be either yes or no.");

        }),
        quantity: Joi.alternatives().conditional("no_limit", {
            is: 'no',
            then:Joi.number().min(1).max(9999999).required()
            .messages({
                "number.base": "Quantity of no of transactions per user must be a number",
                "number.min": "Please enter quantity of no of transactions per user equal to 1",
                "number.max": "Please enter quantity of no of transactions per user less than or equal to 9999999",
                "any.required": "Quantity of no of transactions per user is required",
        
          }),
             
            otherwise: Joi.string().optional().allow(""),
        }),
        frequency: Joi.string()
            .valid("per_day", "per_month", "till_expiry")
            .required()
            .error(() => {
                return new Error("Frequency of no_of_transactions_per_user should be per_day, per_month, till_expiry.");
            }),
        
        })
        const expiry_schema = Joi.object().keys({
        is_expiry:  Joi.number()
           .valid('yes', 'no')
                .required()
                .error(() => {
                    return new Error("Expiry must be either yes or no.");
                
        }),
        end_date: Joi.alternatives().conditional("is_expiry", {
            is: 'yes',
            then: Joi.date()
                .min(moment().format("YYYY-MM-DD"))
                .format("YYYY-MM-DD")
                .iso()
                .required()
                .error(() => {
                    return new Error(
                        "End date should be today or greater than today."
                    );
                }),
            otherwise: Joi.string().optional().allow(""),
        }),
        })
        const total_quantity_schema = Joi.object().keys({
            quantity: Joi.alternatives().conditional("no_limit", {
                is: 'no',
                then:Joi.number().min(1).max(9999999).required()
                .messages({
                    "number.base": "Total quantity allowed must be a number",
                    "number.min": "Please enter total quantity allowed equal to 1",
                    "number.max": "Please enter total quantity allowed less than or equal to 9999999",
                    "any.required": "Total quantity allowed is required",
            
              }),
                otherwise: Joi.string().optional().allow(""),
            }),
        
            frequency: Joi.string()
                .valid("per_day", "per_month", "till_expiry")
                .required()
                .error(() => {
                    return new Error("Frequency of total_quantity_allowed should be per_day, per_month, till_expiry.");
                }),
        
                no_limit:  Joi.number()
                .valid('yes', 'no')
                .required()
                .error(() => {
                    return new Error("Limit of total_quantity_allowed must be either yes or no.");
        
                }),
            });
            
        try {
            const result = schema.validate(req.body);
            const result2 = amountSchema.validate(amount);
            const result3 = no_of_user_schema.validate(no_of_transactions_per_user);
            const result4 = expiry_schema.validate(link_expiry);
            const result5 = total_quantity_schema.validate(total_quantity_allowed);
            if (result.error) {
              
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }else if(result3.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result3.error.message)
                );
            }else if(result4.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result4.error.message)
                );
            }else if(result5.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result5.error.message)
                );
            } else {

              
                let overall_qty_allowed =total_quantity_allowed.no_limit=="yes"?"9999999": total_quantity_allowed.quantity;
                let quantity = req.body.no_quantity_per_transaction;
                let record_exits = await checkifrecordexist({qr_id:req.body.data_id,mode:req.credentials.type},'merchant_qr_codes');
                let currency=await helpers.get_currency_id_by_name(req.body.amount.currency);
                let currency_exist=await helpers.check_if_data_currency_exist({'submerchant_id':req.credentials.merchant_id,'currency_id':currency},'mid');
              if(!record_exits){
                       res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Record not found"
                        )
                    );
                } else if(!currency_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Currency not exist"
                        )
                    );
                }else if (parseInt(quantity) > parseInt(overall_qty_allowed)) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "no_quantity_per_transaction can't be more than quantity of total_quantity_allowed."
                        )
                    );
                } else {
                    next();
                }
            }
        } catch (error) {
            // 
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_paymentLink_deactivate: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["data_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Record ID required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.bodyString("data_id");
                    record_exist = await checkifrecordexist(
                        { qr_id: record_id, is_reseted: 0, status: 0 ,mode:req.credentials.type},
                        "merchant_qr_codes"
                    );
                    
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !record_exist
                                    ? "Record not found or already deactivated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_paymentLink_activate: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.body, ["data_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Record ID required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.bodyString("data_id");
                    record_exist = await checkifrecordexist(
                        { qr_id: record_id, is_reseted: 0, status: 1 ,mode:req.credentials.type},
                        "merchant_qr_codes"
                    );
                    
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !record_exist
                                    ? "Record not found or already activated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_paymentLink_details: async (req, res, next) => {
        let record_exist;
        if (checkEmpty(req.query, ["data_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Record ID required");
                    }),
            });
            try {
                const result = schema.validate(req.query);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = req.queryString("data_id");
                    record_exist = await checkifrecordexist(
                        { qr_id: record_id, is_reseted: 0 ,mode:req.credentials.type},
                        "merchant_qr_codes"
                    );
                    
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !record_exist
                                    ? "Record not found."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_paymentLink_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            status: Joi.string()
                .valid("Deactivated", "Active", "Expired")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Deactivated", "Active", or "Expired".',
                }),
            description: Joi.string().allow("").optional(),
            currency: Joi.string().allow("").optional(),
            perpage: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .error(() => {
                    return new Error(
                        "Valid perpage value is required 1 - 1000"
                    );
                }),
                is_expiry:  Joi.string()
                .valid('yes', 'no').allow("").optional()
                .error(() => {
                    return new Error("Expiry must be either yes or no.");
                }),
            page: Joi.number()
                .integer()
                .positive()
                .min(1)
                .max(1000)
                .required()
                .required()
                .error(() => {
                    return new Error("Valid page value is required 1 - 1000");
                }),
           
            expiry_from_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid from_date is required (ex: yyyy-mm-dd)"
                    );
                }),
            expiry_to_date: Joi.date()
                .format("YYYY-MM-DD")
                .allow("")
                .optional()
                .error(() => {
                    return new Error(
                        "Valid to_date is required (ex: yyyy-mm-dd)"
                    );
                }),
            amount_condition: Joi.string()
                .valid(
                    "less_then_equal",
                    "greater_then_equal",
                    "less_then",
                    "greater_then",
                    "equal_to"
                )
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        "Amount condition field must be one of the allowed values (equal_to, greater_then, less_then, greater_then_equal, less_then_equal).",
                }),
            amount: Joi.number().min(1).allow("").optional().messages({
                "number.base": "The amount field must be a number.",
                "number.min": "The amount field must be at least 1.",
            }),
            // is_expired: Joi.number()
            //     .valid(0, 1)
            //     .required().error(() => {
            //         return new Error("Expiry field is required between 0 or 1");
            //     }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                // let payload = {
                //     psp_name: "paydart",
                //     psp_response_details: result.error.message,
                // };
                // let common_err = await helpers.get_common_response(payload);
                

                // res.status(StatusCode.badRequest).send(
                //     ServerResponse.common_error_msg(
                //         common_err.response[0].response_details,
                //         common_err.response[0].response_code
                //     )
                // );

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
};

module.exports = qr_validation;
