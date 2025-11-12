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
                then: Joi.number()
                    .min(1)
                    .max(9999999)
                    .required()
                    .error(() => {
                        return new Error("amount required.");
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
                    .max(99999)
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
                    .iso()
                    .min(Joi.ref("start_date"))
                    .required()
                    .error(() => {
                        return new Error(
                            "Invalid end date. End should be greater or equal to start date."
                        );
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            overall_qty_allowed: Joi.number()
                .min(1)
                .max(1001)
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
                    next();
                }
            }
        } catch (error) {
            
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
            start_date: Joi.date()
                .iso()
                .required()
                .error(() => {
                    return new Error("start date required.");
                }),
            is_expiry: Joi.number()
                .valid(0, 1)
                .required()
                .error(() => {
                    return new Error("expiry is required.");
                }),

            end_date: Joi.alternatives().conditional("is_expiry", {
                is: 1,
                then: Joi.date()
                    .iso()
                    .min(Joi.ref("start_date"))
                    .required()
                    .error(() => {
                        return new Error("end date required.");
                    }),
                otherwise: Joi.string().optional().allow(""),
            }),
            overall_qty_allowed: Joi.number()
                .min(1)
                .max(1001)
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
        });
        try {
            const result = schema.validate(req.body);
            let cid = enc_dec.cjs_decrypt(req.bodyString("id"));

            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                // let plan_exist
                // if (req.body.is_expiry == 1) {
                //     plan_exist = await end_date(cid, 'Dynamic_QR', 'merchant_qr_codes');
                // }
                // else{
                //     plan_exist = await exp_date(cid, 'Dynamic_QR', 'merchant_qr_codes');
                // }
                // if (plan_exist) {
                next();
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
                    if (perDayData.is_expiry == 1) {
                        if (perDayData.qty_frq == "per_day") {
                            let day = new Date().toLocaleDateString("sv");
                            var sum_quantity =
                                await qrGenerateModule.per_day_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${day}'`,
                                    "qr_payment"
                                );
                        }
                        if (perDayData.qty_frq == "per_month") {
                            const d = new Date();
                            let month = d.getUTCMonth() + 1;
                            var sum_quantity =
                                await qrGenerateModule.per_month_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${month}'`,
                                    "qr_payment"
                                );
                        }
                        if (perDayData.qty_frq == "till_expiry") {
                            let expiry_date = perDayData.end_date;
                            var sum_quantity =
                                await qrGenerateModule.per_day_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${expiry_date}'`,
                                    "qr_payment"
                                );
                        }
                        if (perDayData.total_collection == "per_day") {
                            let day = new Date().toLocaleDateString("sv");
                            var sum_quantity_collection =
                                await qrGenerateModule.per_day_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${day}'`,
                                    "qr_payment"
                                );
                        }
                        if (perDayData.total_collection == "per_month") {
                            const d = new Date();
                            let month = d.getUTCMonth() + 1;
                            var sum_quantity_collection =
                                await qrGenerateModule.per_month_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${month}'`,
                                    "qr_payment"
                                );
                        }
                        if (perDayData.total_collection == "till_expiry") {
                            let expiry_date = perDayData.end_date;
                            var sum_quantity_collection =
                                await qrGenerateModule.per_day_quantity(
                                    {
                                        payment_id: `'${perDayData.qr_id}'`,
                                        currency: `'${perDayData.currency}'`,
                                    },
                                    `'${expiry_date}'`,
                                    "qr_payment"
                                );
                        }
                    }
                    let record_exist = await checkifrecordexist(
                        { qr_id: record_id, is_reseted: 0, is_expired: 0 },
                        "merchant_qr_codes"
                    );
                    let deactivate_data = await checkifrecordexist(
                        { qr_id: record_id, status: 0 },
                        "merchant_qr_codes"
                    );
                    // let record_reset = await checkifrecordexist({ 'id': record_id, 'is_reseted': 0 }, 'merchant_qr_codes');
                    if (
                        !record_exist ||
                        !deactivate_data ||
                        sum_quantity >= perDayData.overall_qty_allowed ||
                        sum_quantity_collection >= perDayData.no_of_collection
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
                            sum_quantity >= perDayData.overall_qty_allowed
                        ) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `You can not make payment for this link.Maximum quantity reached`
                                )
                            );
                        } else if (
                            sum_quantity_collection >=
                            perDayData.no_of_collection
                        ) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `You can not make payment for this link.Maximum collection reached`
                                )
                            );
                        }
                    } else {
                        // res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(!deactivate_data?"Invalid link.":!record_exist?'Record not found.':""));
                        next();
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
                    minDomainSegments: 2,
                    tlds: { allow: ["com", "net"] },
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
                if (email.length > 5) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "More than five emails not allow at one time"
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
};
module.exports = qr_validation;
