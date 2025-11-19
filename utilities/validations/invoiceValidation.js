const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const validate_mobile = require("./validate_mobile");
const checkwithcolumn = require("./checkerwithcolumn");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
const multer = require("multer");
const helpers = require("../helper/general_helper");
const fs = require("fs");
const encrypt_decrypt = require("../../utilities/decryptor/encrypt_decrypt");
const { join } = require("path");
const invModel = require("../../models/invoiceModel");
const moment = require("moment");
const logger = require('../../config/logger');

// .pattern(new RegExp(/^[A-Za-z]+[A-Za-z ]*$/))
const validation = {
    add: async (req, res, next) => {
        const schema = Joi.object().keys({
            name_prefix: Joi.string()
                .valid("Entity", "Mr.", "Miss")
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Name prefix required.");
                }),
            name: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Name required.");
                }),
            country_code: Joi.number()
                .min(1)
                .max(999)
                .required()
                .error(() => {
                    return new Error("Country code required");
                }),
            mobile: Joi.string()
                .min(4)
                .max(11)
                .trim()
                .required()
                .error(() => {
                    return new Error("Valid Mobile No. required");
                }),
            email: Joi.string()
                .min(1)
                .max(100)
                .email()
                .trim()
                .required()
                .error(() => {
                    return new Error("Email required");
                }),
            ship_address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping address required.");
                }),
            ship_country: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship country required");
                }),
            ship_state: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship state required");
                }),
            ship_city: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship city required");
                }),
            ship_zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow('')
                .allow("")
                .messages({
                    "any.required": "{{#label}} is required",
                    "string.min": "{{#label}} should be min 5 length",
                    "string.max": "{{#label}} should be max 6 length",
                }),

            bill_address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .required()
                .error(() => {
                    return new Error("Billing address required.");
                }),
            bill_country: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill country required");
                }),
            bill_state: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill state required");
                }),
            bill_city: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill city required");
                }),
            bill_zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow("")
                .messages({
                    "any.required": "{{#label}} is required",
                    "string.min": "{{#label}} should be min 5 length",
                    "string.max": "{{#label}} should be max 6 length",
                }),
                submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant ID required");
                }),
            logo: Joi.optional().allow(""),
           
            //  .error(() => {
            //      return new Error("logo required");
            //  }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                if (req.all_files) {
                    if (req.all_files.logo) {
                        fs.unlink(
                            "public/logo/" + req.all_files.logo,
                            function (err) {
                                if (err) console.log(err);
                            }
                        );
                    }
                }
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                submerchant_id = enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
                 let check_if_email_exits = await checkifrecordexist({ 'submerchant_id':submerchant_id,'email': req.bodyString('email'), 'deleted': 0,'merchant_id':req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id }, 'inv_customer');
                if(check_if_email_exits){
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer with email ${req.bodyString('email')} already exits.`));
                } else{
                 
              
                var error = "";
                if (req.all_files) {
                    if (!req.all_files.logo) {
                        error =
                            "Please upload valid flag file. Only .jpg,.png file accepted (size: upto 1MB)";
                    }
                }
                //  else if (!req.all_files) {
                //      error = "Please upload valid file.(size: upto 1MB)";
                //  }

                // if (req.bodyString('direction') != 'ltr' && req.bodyString('direction') != 'rtl') {
                //    error = 'Please add valid direction ltr or rlt';
                // }

                if (error == "") {
                    next();
                } else {
                    if (req.all_files) {
                        if (req.all_files.logo) {
                            fs.unlink(
                                "public/logo/" + req.all_files.logo,
                                function (err) {
                                    if (err) console.log(err);
                                }
                            );
                        }
                    }
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            error ? error : "Error in data."
                        )
                    );
                }
            }
            }
        } catch (error) {
                logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    update: async (req, res, next) => {
        const schema = Joi.object().keys({
            customer_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Customer id required.");
                }),
            name_prefix: Joi.string()
                .valid("Entity", "Mr.", "Miss")
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Name prefix required.");
                }),
            name: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Name required.");
                }),
            country_code: Joi.number()
                .min(1)
                .max(999)
                .required()
                .error(() => {
                    return new Error("Country code required");
                }),
            mobile: Joi.string()
                .min(4)
                .max(11)
                .trim()
                .required()
                .error(() => {
                    return new Error("Valid Mobile No. required");
                }),
            email: Joi.string()
                .min(1)
                .max(100)
                .email()
                .trim()
                .required()
                .error(() => {
                    return new Error("Email required");
                }),

            ship_address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship address required.");
                }),
            ship_country: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship country required");
                }),
            ship_state: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship state required");
                }),
            ship_city: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Ship city required");
                }),
            ship_zip_code: Joi.string()
                .min(1)
                .max(6)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Ship zip code required");
                }),
            bill_address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .required()
                .error(() => {
                    return new Error("Bill address required.");
                }),
            bill_country: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill country required");
                }),
            bill_state: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill state required");
                }),
            bill_city: Joi.string()
                .min(1)
                .max(70)
                .required()
                .error(() => {
                    return new Error("Bill city required");
                }),
            bill_zip_code: Joi.string()
                .min(1)
                .max(6)
                .optional()
                .allow("")
                .error(() => {
                    return new Error("Bill zip code required");
                }),
            logo: Joi.optional().allow(""),
            submerchant_id: Joi.string()
            .required()
            .error(() => {
                return new Error("Sub-merchant ID required");
            }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                if (req.all_files) {
                    if (req.all_files.logo) {
                        fs.unlink(
                            "public/logo/" + req.all_files.logo,
                            function (err) {
                                if (err) console.log(err);
                            }
                        );
                    }
                }
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                record_id = enc_dec.cjs_decrypt(req.bodyString("customer_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id },
                    "inv_customer"
                );
                submerchant_id = enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
                    let email_exist = await checkifrecordexist(
                        {
                            submerchant_id: submerchant_id,
                            email: req.bodyString("email"),
                            deleted: 0,
                            "id !=": record_id, 'deleted': 0,'merchant_id':req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id 
                        },
                        "inv_customer"
                    );
                // let language_exist = await checkifrecordexist({ 'name': req.bodyString('language'), 'id !=': record_id, 'deleted': 0 }, 'master_language');
                if (!record_exist || email_exist) {
                    if (!record_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse("Record not found.")
                        );
                        } else if (email_exist) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Email already exists."
                                )
                            );
                        }
                } else {
                    // if (req.all_files) {
                    //     if (req.all_files.logo) {
                    //         fs.unlink(
                    //             "public/logo/" + req.all_files.logo,
                    //             function (err) {
                    //                 if (err) console.log(err);
                    //             }
                    //         );
                    //     }
                    // }
                    // else {
                        next();
                    // }

                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    details: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                customer_id: Joi.string()
                    .min(2)
                    .max(200)
                    .required()
                    .error(() => {
                        return new Error("Customer id Required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("customer_id")
                            ),
                        },
                        "inv_customer"
                    );
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
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    deactivate: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                customer_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Customer id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("customer_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id },
                        "inv_customer"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 0 },
                        "inv_customer"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found."
                                    : !record_exist
                                    ? "Record already deactivated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    activate: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                customer_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Customer id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("customer_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id },
                        "inv_customer"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 1 },
                        "inv_customer"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found"
                                    : !record_exist
                                    ? "Record already activated."
                                    : " "
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    inv_add: async (req, res, next) => {
        
        const schema = Joi.object().keys({
            customer_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Customer id required.");
                }),
            merchant_full_name: Joi.string()
                .min(2)
                .max(250)
                .trim()
                .required()
                .error(() => {
                    return new Error("Full Name is required.");
                }),
            sub_merchant_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Sub_merchant id required.");
                }),
            currency: Joi.string()
                .min(1)
                .max(3)
                .trim()
                .required()
                .error(() => {
                    return new Error("Currency required.");
                }),

            issue_date: Joi.date()
                .iso()
                .required()
                .error(() => {
                    return new Error("Issue date required.");
                }),
            expiry_date: Joi.date()
                .iso()
                .min(Joi.ref("issue_date"))
                .required()
                .error(() => {
                    return new Error("Expiry date required.");
                }),
            merchant_invoice_no: Joi.string().required(() => {
                return new Error("Merchant invoice no");
            }),
            payment_terms: Joi.string().allow(""),
            description: Joi.string().allow(""),
            note: Joi.string().allow(""),
            items: Joi.array().items({
                item: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item  required.");
                    }),
                item_rate: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item rate required.");
                    }),
                quantity: Joi.number()
                    .greater(0)
                    .required()
                    .error(() => {
                        return new Error("Please enter a quantity value greater than or equal to 0.1.");
                    }),
                tax_per: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Tax required.");
                    }),
                discount_per: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Discount required.");
                    }),
            }),
            mode:Joi.string().optional().allow('')
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let sub_merchant_id = enc_dec.cjs_decrypt(
                    req.bodyString("sub_merchant_id")
                );
                let customer_id = enc_dec.cjs_decrypt(
                    req.bodyString("customer_id")
                );

                let merchant_id_exits;
                let customer_exits;
                if (req.user.type === "admin") {
                    merchant_id_exits = await checkifrecordexist(
                        { id: sub_merchant_id },
                        "master_merchant"
                    );
                    customer_exits = await checkifrecordexist(
                        { id: customer_id },
                        "inv_customer"
                    );
                } else {
                    merchant_id_exits = await checkifrecordexist(
                        { id: sub_merchant_id, super_merchant_id:req.user.super_merchant_id?req.user.super_merchant_id: req.user.id },
                        "master_merchant"
                    );
                    customer_exits = await checkifrecordexist(
                        { id: customer_id, merchant_id: req.user.super_merchant_id?req.user.super_merchant_id:req.user.id },
                        "inv_customer"
                    );
                }

                if (merchant_id_exits && customer_exits) {
                    next();
                } else {
                    if (!merchant_id_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Sub merchant not exits"
                            )
                        );
                    } else if (!customer_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Customer  not exits"
                            )
                        );
                    }
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    inv_details: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_master_id"])) {
            const schema = Joi.object().keys({
                invoice_master_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Invoice master id Required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("invoice_master_id")
                            ),
                        },
                        "inv_invoice_master"
                    );
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
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    inv_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Invoice id required.");
                }),
            customer_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Customer id required.");
                }),
            merchant_full_name: Joi.string()
                .min(2)
                .max(250)
                .trim()
                .required()
                .error(() => {
                    return new Error("Full Name is required.");
                }),
            sub_merchant_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Sub_merchant id required.");
                }),
            currency: Joi.string()
                .min(1)
                .max(3)
                .trim()
                .required()
                .error(() => {
                    return new Error("Currency required.");
                }),

            issue_date: Joi.date()
                .iso()
                .required()
                .error(() => {
                    return new Error("Issue date required.");
                }),
            expiry_date: Joi.date()
                .iso()
                .min(Joi.ref("issue_date"))
                .required()
                .error(() => {
                    return new Error("Expiry date required.");
                }),
            merchant_invoice_no: Joi.string()
                .required()
                .error(() => {
                    return new Error("Merchant invoice no required");
                }),
            payment_terms: Joi.string().allow(""),
            description: Joi.string().allow(""),
            note: Joi.string().allow(""),
            items: Joi.array().items({
                item: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item  required.");
                    }),
                item_rate: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item rate required.");
                    }),
                    quantity: Joi.number()
                    .greater(0)
                    .required()
                    .error(() => {
                        return new Error("Please enter a quantity value greater than or equal to 0.1.");
                    }),
                tax_per: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Tax required.");
                    }),
                discount_per: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Discount required.");
                    }),
            }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let sub_merchant_id = enc_dec.cjs_decrypt(
                    req.bodyString("sub_merchant_id")
                );
                let customer_id = enc_dec.cjs_decrypt(
                    req.bodyString("customer_id")
                );
                let invoice_id = enc_dec.cjs_decrypt(
                    req.bodyString("invoice_id")
                );
                // let merchant_id_exits = await checkifrecordexist(
                //     { id: sub_merchant_id, super_merchant_id: req.user.id },
                //     "master_merchant"
                // );
                // let customer_exits = await checkifrecordexist(
                //     { id: customer_id, merchant_id: req.user.id },
                //     "inv_customer"
                // );
                let merchant_id_exits;
                let customer_exits;
                if (req.user.type === "admin") {
                    merchant_id_exits = await checkifrecordexist(
                        { id: sub_merchant_id },
                        "master_merchant"
                    );
                    customer_exits = await checkifrecordexist(
                        { id: customer_id },
                        "inv_customer"
                    );
                } else {
                    merchant_id_exits = await checkifrecordexist(
                        { id: sub_merchant_id, super_merchant_id: req.user.super_merchant_id?req.user.super_merchant_id:req.user.id },
                        "master_merchant"
                    );
                    customer_exits = await checkifrecordexist(
                        { id: customer_id, merchant_id: req.user.super_merchant_id?req.user.super_merchant_id:req.user.id },
                        "inv_customer"
                    );
                }
                let invoice_exits = await checkifrecordexist(
                    { id: invoice_id },
                    "inv_invoice_master"
                );
                if (merchant_id_exits && customer_exits && invoice_exits) {
                    next();
                } else {
                    if (!merchant_id_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Sub merchant not exits"
                            )
                        );
                    } else if (!customer_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Customer not exits"
                            )
                        );
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Invoice not exits"
                            )
                        );
                    }
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },

    inv_deactivate: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_master_id"])) {
            const schema = Joi.object().keys({
                invoice_master_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Invoice master id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("invoice_master_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id },
                        "inv_invoice_master"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 0 },
                        "inv_invoice_master"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found."
                                    : !record_exist
                                    ? "Record already deactivated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    inv_activate: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_master_id"])) {
            const schema = Joi.object().keys({
                invoice_master_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Invoice master id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("invoice_master_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id },
                        "inv_invoice_master"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 1 },
                        "inv_invoice_master"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found"
                                    : !record_exist
                                    ? "Record already activated."
                                    : " "
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error.message)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    item_add: async (req, res, next) => {
        const schema = Joi.object().keys({
            invoice_master_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Invoice master id required");
                }),
            item: Joi.array().items({
                item_rate: Joi.string()
                    .min(1)
                    .max(7)
                    .required()
                    .error(() => {
                        return new Error("Item rate required");
                    }),
                quantity: Joi.number()
                    .greater(0)
                    .less(9999999)
                    .required()
                    .error(() => {
                        return new Error("Quantity required");
                    }),
                tax_per: Joi.number()
                    .greater(0)
                    .less(100)
                    .required()
                    .error(() => {
                        return new Error("Tax required");
                    }),
                discount_per: Joi.number()
                    .greater(0)
                    .less(100)
                    .required()
                    .error(() => {
                        return new Error("Discount required");
                    }),
                total_amount: Joi.string()
                    .min(1)
                    .max(10)
                    .error(() => {
                        return new Error("Total amount required");
                    }),
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
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    item_details: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_master_id"])) {
            const schema = Joi.object().keys({
                invoice_master_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Invoice master id Required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    let record_exist = await checkifrecordexist(
                        {
                            invoice_master_id: enc_dec.cjs_decrypt(
                                req.bodyString("invoice_master_id")
                            ),
                        },
                        "inv_invoice_items"
                    );
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
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    item_delete: async (req, res, next) => {
        if (checkEmpty(req.body, ["item_id"])) {
            const schema = Joi.object().keys({
                item_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Item id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                    let customer_exist = await checkifrecordexist(
                        { id: record_id },
                        "inv_invoice_items"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 0 },
                        "inv_invoice_items"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found."
                                    : !record_exist
                                    ? "Record already deleted."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    item_master_add: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_name: Joi.string()
                .min(1)
                .max(50)
                .required()
                .error(() => {
                    return new Error("Item name required");
                }),
                submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant ID required");
                }),
            item_rate: Joi.string()
                .min(1)
                .max(50)
                .required()
                .error(() => {
                    return new Error("Item rate required");
                }),
            item_description: Joi.string().allow(""),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                submerchant_id = enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
                let check_if_item_exits = await checkifrecordexist({ 'submerchant_id':submerchant_id,'LOWER(item_name)': req.bodyString('item_name'), 'is_deleted': 0,'merchant_id':req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id  }, 'master_items');
               if(check_if_item_exits){
                   res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Item already exits.`));
               } else{
                next();
               }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    item_master_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist ? "Record already deleted." : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    item_master_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item id required");
                }),
            item_rate: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item rate required");
                }),
                submerchant_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Sub-merchant ID required");
                }),
            item_name: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item name required");
                }),
            item_description: Joi.string().allow(""),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, status: 0 },
                    "master_items"
                );
                submerchant_id = enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
                let check_if_item_exits = await checkifrecordexist(
                    {
                        submerchant_id: submerchant_id,
                        'LOWER(item_name)': req.bodyString("item_name"),
                        "id !=": record_id, 'is_deleted': 0,'merchant_id':req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id 
                    },
                    "master_items"
                );
             
                // let check_if_item_exits = await checkifrecordexist({'id!=':record_id, 'submerchant_id':submerchant_id,'LOWER(item_name)': req.bodyString('item_name'), 'is_deleted': 0,'merchant_id':req.user.id }, 'master_items');
                
                if (!record_exist || check_if_item_exits) {
                   
                    if(check_if_item_exits){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Item already exits.`));
                    } else{
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                             "Record already deleted."
                              
                        )
                    );
                }
                } else {
                    next();
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    item_master_activate: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, status: 1 },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already activated."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    item_master_deactivated: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, status: 0 },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already deactivated."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    item_master_delete: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Item id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, is_deleted: 0 },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already deleted."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    inv_send: async (req, res, next) => {
        
        const schema = Joi.object().keys({
            invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Invoice  id Required");
                }),
            email_to: Joi.string()
                .email()
                .required()
                .error(() => {
                    return new Error("Email to Required");
                }),
            cc_email: Joi.string()
                .email({ multiple: true })
                .optional()
                .allow(""),
            subject: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subject Required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_exist = await checkifrecordexist(
                    { id: enc_dec.cjs_decrypt(req.bodyString("invoice_id")) },
                    "inv_invoice_master"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse("Record not found.")
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    invoiceStatus: async (req, res, next) => {
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
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let invoice_id = enc_dec.cjs_decrypt(
                    req.bodyString("invoice_id")
                );
                var invoice_data = await invModel.FetchExpiryAndStatus(
                    invoice_id,
                    "inv_invoice_master"
                );
                if (invoice_data) {
                    if (invoice_data.status == "Pending") {
                        var now = moment();
                        var date = moment(invoice_data.expiry_date);
                        let dif = date.diff(now, "day");
                        let is_today = date.isSame(moment(), "day");
                        if (dif >= 0 || is_today) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.successmsg("")
                            );
                        } else {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "This invoice No. " +
                                        invoice_data.invoice_no +
                                        " is expired"
                                )
                            );
                        }
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "This invoice No. " +
                                    invoice_data.invoice_no +
                                    " is " +
                                    invoice_data.status
                            )
                        );
                    }
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse("Record not exits")
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_add: async (req, res, next) => {
        const schema = Joi.object().keys({
            item_name: Joi.string()
                .trim()
                .min(1)
                .max(50)
                .required()
                .messages({
                    "any.required": "Item name is required",
                    "string.min": " Item name should be min 1 length",
                    "string.max": "Item name should be max 50 length",
                }),
                item_rate_per_unit: Joi.number()
                .min(0.1)
                .max(9999999)
                .required()
                .messages({
                    "any.required": "Item rate is required",
                    "number.min": "Item rate is greater than 0",
                    "number.max": "Item rate is less than or equal to 9999999",
                }),
                item_description: Joi.string().max(200).allow("").messages({
                    "string.max": "Item name should be max 200 characters",
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                submerchant_id = req.credentials.merchant_id;
                let check_if_item_exits = await checkifrecordexist({ 'submerchant_id':submerchant_id,'LOWER(item_name)': req.bodyString('item_name'), 'is_deleted': 0,'merchant_id':req.credentials.super_merchant_id }, 'master_items');
               if(check_if_item_exits){
                   res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Item already exits.`));
               } else{
                next();
               }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_details: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data id required");
                }),
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.queryString("data_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id,is_deleted: 0,  submerchant_id: req.credentials.merchant_id,merchant_id:req.credentials.super_merchant_id},
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist ? "Record not exits." : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data id required");
                }),
                item_name: Joi.string()
                .trim()
                .min(1)
                .max(50) 
                .required()
                .messages({
                    "any.required": "Item name is required",
                    "string.min": " Item name should be min 1 length",
                    "string.max": "Item name should be max 50 length",
                }),
               
                item_rate_per_unit: Joi.number()
                .min(0.1)
                .max(9999999)
                .required()
                .messages({
                    "any.required": "Item rate is required",
                    "number.min": "Item rate is greater than 0",
                    "number.max": "Item rate is less than or equal to 9999999",
                }),
            item_description: Joi.string().max(200).allow("").messages({
                "string.max": "Item name should be max 200 characters",
            }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                submerchant_id = req.credentials.merchant_id;
                let record_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, status: 0 ,is_deleted: 0,  submerchant_id: submerchant_id,merchant_id:req.credentials.super_merchant_id  },
                    "master_items"
                );
               
                let check_if_item_exits = await checkifrecordexist(
                    {
                        submerchant_id: submerchant_id,
                        'LOWER(item_name)': req.bodyString("item_name"),
                        "id !=": record_id, 'is_deleted': 0,'merchant_id':req.credentials.super_merchant_id 
                    },
                    "master_items"
                );
             
                if (!record_exist || check_if_item_exits) {
                   if(!record_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                             "Record not found."
                              
                        )
                    );
                   }
                   else if(check_if_item_exits){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Item already exits.`));
                    } 
                } else {
                    next();
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_activate: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data  id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
                let record_exist = await checkifrecordexist(
                    { id: record_id, status: 1 ,is_deleted: 0,  submerchant_id: req.credentials.merchant_id,merchant_id:req.credentials.super_merchant_id   },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already activated."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_deactivated: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
                let record_exist = await checkifrecordexist(
                    {  id: record_id, status: 0 ,is_deleted: 0,  submerchant_id: req.credentials.merchant_id,merchant_id:req.credentials.super_merchant_id  },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already deactivated."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_delete: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
                let record_exist = await checkifrecordexist(
                    {  id: record_id,is_deleted: 0,submerchant_id: req.credentials.merchant_id,merchant_id:req.credentials.super_merchant_id   },
                    "master_items"
                );
                if (record_exist) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            !record_exist
                                ? "Record not exits or already deleted."
                                : ""
                        )
                    );
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_add_customer: async (req, res, next) => {

        let customer_details = req.body.customer_details;
        let billing_details = req.body.billing_details;
        let shipping_details = req.body.shipping_details;
        const customerSchema = Joi.object().keys({
            name_prefix: Joi.string()
            .valid("Entity", "Mr.", "Miss")
            .required()
            .error(() => {
                return new Error("Name prefix should be Mr., Miss, Entity.");
            }),
        name: Joi.string()
            .min(1)
            .max(50)
            .pattern(
                new RegExp(
                    /^[a-zA-Z]+ [a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/
                )
            )
            .required()
            .error(() => {
                return new Error("Please enter valid/ full name (length 1 to 50 characters).");
            }),
        code: Joi.number()
            .min(1)
            .max(999)
            .required()
            .messages({
                "any.required": "Code  is required",
                "number.min": "Code  should be min 1 length",
                "number.max": "Code  should be max 3 length",
            }),
        mobile: Joi.number()
             .integer()
             .positive()
             .required()
             .error(() => {
                return new Error("Mobile must be a number");
            }),
        email: Joi.string()
            .min(1)
            .max(100)
            .email()
            .trim()
            .required()
            .error(() => {
                return new Error("Email required");
            }),
        })
        const shippingSchema = Joi.object().keys({
            same_as_billing_address:  Joi.string()
            .valid('yes', 'no')
            .required()
            .error(() => {
                return new Error("same_as_billing_address must be either yes or no.");
    
            }),
            address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping address required / max_length 70.");
                }),
           
              country: Joi.string()
                .min(2)
                .max(2)
                .optional()
                .allow('')
                .messages({
                    "any.required": "Shipping country is required",
                    "string.min": "Shipping country should be min 2 length",
                    "string.max": "Shipping country should be max 2 length",
                }),
                state: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping state required");
                }),
               city: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping city required");
                }),
             zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow('')
                .allow("")
                .messages({
                    "any.required": "Shipping {{#label}} is required",
                    "string.min": "Shipping {{#label}} should be min 5 length",
                    "string.max": "Shipping {{#label}} should be max 6 length",
                }),

        })
        const billingSchema = Joi.object().keys({
      
            address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .error(() => {
                    return new Error("Billing address required / max_length 70.");
                }),
          
              country: Joi.string()
                .min(2)
                .max(2)
                .messages({
                    "any.required": "Billing country is required",
                    "string.min": "Billing country should be min 2 length",
                    "string.max": "Billing country should be max 2 length",
                }),
                state: Joi.string()
                .min(1)
                .max(70)
                .error(() => {
                    return new Error("Billing state required");
                }),
               city: Joi.string()
                .min(1)
                .max(70)
                .error(() => {
                    return new Error("Billing city required");
                }),
             zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow("")
                .messages({
                    "any.required": "Billing {{#label}} is required",
                    "string.min": " Billing {{#label}} should be min 5 length",
                    "string.max": "Billing {{#label}} should be max 6 length",
                }),

        })
      
        try {
            const result = customerSchema.validate(customer_details);
            const result1 = shippingSchema.validate(shipping_details);
            const result2 = billingSchema.validate(billing_details);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result1.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result1.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }  else {
                  submerchant_id = req.credentials.merchant_id;
                 let check_if_email_exits = await checkifrecordexist({ 'submerchant_id':submerchant_id,'email': customer_details.email, 'deleted': 0,'merchant_id':req.credentials.super_merchant_id }, 'inv_customer');
                 let country_exist = await checkifrecordexist({ 'iso2':billing_details.country, 'status':0,'deleted': 0}, 'country');
                 let bill_state = await helpers.find_state_id_by_name(
                    billing_details.state,billing_details.country
                );
                let bill_city = await helpers.find_city_id_by_name(
                    billing_details.city,billing_details.country,bill_state
                );
                let mobile_length = await helpers.get_mobile_length(
                    customer_details.code
                );
                let zero_at_first_place = await helpers.get_zero_at_first_place(
                    customer_details.code
                );
                var f_letter = customer_details.mobile.charAt(0);
                let ship_state=bill_state;
                let ship_city=bill_city;
                let ship_country=country_exist;
                if(shipping_details.same_as_billing_address=="no" && shipping_details.country!=""   ){
                    ship_country = await checkifrecordexist({ 'iso2':shipping_details.country, 'status':0,'deleted': 0}, 'country');
                    if(shipping_details.state!=""){
                        ship_state =await helpers.find_state_id_by_name(
                            shipping_details.state, shipping_details.country
                        );
                    }
                    if(shipping_details.city!=""){
                        ship_city =await helpers.find_city_id_by_name(
                            shipping_details.city, shipping_details.country,ship_state
                        );
                    }
                     
                 
                }
              
               if(zero_at_first_place=="Yes"){
                    if(f_letter !=0 ){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Invalid Mobile Number. Please start with 0.`));
                    }
                  
                }else  if(customer_details.mobile.length != mobile_length){
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Please enter at least ${mobile_length} digits.`));
                }
                else if(check_if_email_exits){
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer with email ${customer_details.email} already exits.`));
                }else if(!country_exist || !ship_country){
                    if(!country_exist ){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing country not exist.`));
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping country not exist.`));
                    }
                 
                } else if(bill_state=="" || ship_state==""){
                    if(bill_state=="" ){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing state not exist.`));
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping state not exist.`));
                    }
                 
                } else if(bill_city=="" || ship_city==""){
                    if(bill_city=="" ){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing city not exist.`));
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping city not exist.`));
                    }
                   
                } else{
                    next();
            }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_customer_details: async (req, res, next) => {
        if (checkEmpty(req.query, ["data_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(2)
                    .max(200)
                    .required()
                    .error(() => {
                        return new Error("Data id Required");
                    }),
            });
            try {
                const result = schema.validate(req.query);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                 
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.queryString("data_id")
                            ),
                            deleted:0,
                            submerchant_id:req.credentials.merchant_id,
                            merchant_id:req.credentials.super_merchant_id
                        },
                        "inv_customer"
                    );
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
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_update_customer: async (req, res, next) => {

        let customer_details = req.body.customer_details;
        let billing_details = req.body.billing_details;
        let shipping_details = req.body.shipping_details;
        const customerSchema = Joi.object().keys({
            data_id:Joi.string()
            .min(2)
            .max(200)
            .required()
            .error(() => {
                return new Error("Data ID required");
            }),
            name_prefix: Joi.string()
            .valid("Entity", "Mr.", "Miss")
            .required()
            .error(() => {
                return new Error("Name prefix should be Mr., Miss, Entity.");
            }),
            name: Joi.string()
            .min(1)
            .max(50)
            .pattern(
                new RegExp(
                    /^[a-zA-Z]+ [a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/
                )
            )
            .required()
            .error(() => {
                return new Error("Please enter valid/ full name (length 1 to 50 characters).");
            }),
        code: Joi.number()
            .min(1)
            .max(999)
            .required()
            .messages({
                "any.required": "Code  is required",
                "number.min": "Code  should be min 1 length",
                "number.max": "Code  should be max 3 length",
            }),
            mobile: Joi.number()
            .integer()
            .positive()
            .required()
            .error(() => {
               return new Error("Mobile must be a number");
           }),
        email: Joi.string()
            .min(1)
            .max(100)
            .email()
            .trim()
            .required()
            .error(() => {
                return new Error("Email required");
            }),
           
        })
        const shippingSchema = Joi.object().keys({
            same_as_billing_address:  Joi.string()
            .valid('yes', 'no')
            .required()
            .error(() => {
                return new Error("same_as_billing_address must be either yes or no.");
    
            }),
            address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping address required / max_length 70.");
                }),
           
                country: Joi.string()
                .min(2)
                .max(2)
                .optional()
                .allow("")
                .messages({
                    "any.required": "Shipping country is required",
                    "string.min": "Shipping country should be min 2 length",
                    "string.max": "Shipping country should be max 2 length",
                }),
                state: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping state required");
                }),
               city: Joi.string()
                .min(1)
                .max(70)
                .optional()
                .allow('')
                .error(() => {
                    return new Error("Shipping city required");
                }),
             zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow('')
                .allow("")
                .messages({
                    "any.required": "Shipping {{#label}} is required",
                    "string.min": "Shipping {{#label}} should be min 5 length",
                    "string.max": "Shipping {{#label}} should be max 6 length",
                }),

        })
        const billingSchema = Joi.object().keys({
      
            address: Joi.string()
                .min(1)
                .max(70)
                .trim()
                .error(() => {
                    return new Error("Billing address required / max_length 70.");
                }),
          
                country: Joi.string()
                .min(2)
                .max(2)
                .messages({
                    "any.required": "Billing country is required",
                    "string.min": "Billing country should be min 2 length",
                    "string.max": "Billing country should be max 2 length",
                }),
                state: Joi.string()
                .min(1)
                .max(70)
                .error(() => {
                    return new Error("Billing state required");
                }),
               city: Joi.string()
                .min(1)
                .max(70)
                .error(() => {
                    return new Error("Billing city required");
                }),
             zip_code: Joi.string()
                .min(5)
                .max(6)
                .optional()
                .allow("")
                .messages({
                    "any.required": "Billing {{#label}} is required",
                    "string.min": " Billing {{#label}} should be min 5 length",
                    "string.max": "Billing {{#label}} should be max 6 length",
                }),

        })
      
        try {
            const result = customerSchema.validate(customer_details);
            const result1 = shippingSchema.validate(shipping_details);
            const result2 = billingSchema.validate(billing_details);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            }else if(result1.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result1.error.message)
                );
            }else if(result2.error){
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result2.error.message)
                );
            }  else {
                record_id = enc_dec.cjs_decrypt(customer_details.data_id);
                submerchant_id = req.credentials.merchant_id;
                let record_exist = await checkifrecordexist(
                    { id: record_id,deleted: 0 , 
                        submerchant_id: submerchant_id,
                        merchant_id:req.credentials.super_merchant_id},
                    "inv_customer"
                );
                let mobile_length = await helpers.get_mobile_length(
                    customer_details.code
                );
                let zero_at_first_place = await helpers.get_zero_at_first_place(
                    customer_details.code
                );
                var f_letter = customer_details.mobile.charAt(0);
                    let email_exist = await checkifrecordexist(
                        {
                            submerchant_id: submerchant_id,
                            merchant_id:req.credentials.super_merchant_id,
                            email: customer_details.email,
                            deleted: 0,
                            "id !=": record_id, 'deleted': 0,'merchant_id':req.credentials.super_merchant_id
                        },
                        "inv_customer"
                    );
                    let country_exist = await checkifrecordexist({ 'iso2':billing_details.country, 'status':0,'deleted': 0}, 'country');
                    let bill_state = await helpers.find_state_id_by_name(
                        billing_details.state,billing_details.country
                    );
                    let bill_city = await helpers.find_city_id_by_name(
                        billing_details.city,billing_details.country,bill_state
                    );
                    let ship_state=bill_state;
                    let ship_city=bill_city;
                    let ship_country=country_exist;
                    if(shipping_details.same_as_billing_address=="no" && shipping_details.country!="" ){
                        ship_country = await checkifrecordexist({ 'iso2':shipping_details.country, 'status':0,'deleted': 0}, 'country');
                        if(shipping_details.state!=""){
                            ship_state =await helpers.find_state_id_by_name(
                                shipping_details.state, shipping_details.country
                            );
                       }
                        if(shipping_details.city!=""){
                            ship_city =await helpers.find_city_id_by_name(
                                shipping_details.city, shipping_details.country,ship_state
                            );
                        }
                      
                    }
                   
            
                       if (!record_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse("Record not found.")
                        );
                        }else if(zero_at_first_place=="Yes"){
                            if(f_letter !=0 ){
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Invalid Mobile Number. Please start with 0.`));
                            }
                          
                        }else  if(customer_details.mobile.length != mobile_length){
                            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Please enter at least ${mobile_length} digits.`));
                        }
                        else if (email_exist) {
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Email already exists."
                                )
                            );
                        }else if(!country_exist || !ship_country){
                            if(!country_exist ){
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing country not exist.`));
                            }else{
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping country not exist.`));
                            }
                         
                        } else if(bill_state=="" || ship_state==""){
                            if(bill_state=="" ){
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing state not exist.`));
                            }else{
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping state not exist.`));
                            }
                         
                        } else if(bill_city=="" || ship_city==""){
                            if(bill_city=="" ){
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Billing city not exist.`));
                            }else{
                                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Shipping city not exist.`));
                            }
                           
                        }
                    else{
                        next();
                        }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_customer_deactivate: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Data id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("customer_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id ,deleted: 0 ,submerchant_id: req.credentials.merchant_id,
                            merchant_id:req.credentials.super_merchant_id},
                        "inv_customer"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 0},
                        "inv_customer"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found."
                                    : !record_exist
                                    ? "Record already deactivated."
                                    : ""
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    open_customer_activate: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Data id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("customer_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id,deleted: 0 ,submerchant_id: req.credentials.merchant_id,
                            merchant_id:req.credentials.super_merchant_id },
                        "inv_customer"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, status: 1  },
                        "inv_customer"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found"
                                    : !record_exist
                                    ? "Record already activated."
                                    : " "
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_customer_delete: async (req, res, next) => {
        if (checkEmpty(req.body, ["customer_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(10)
                    .required()
                    .error(() => {
                        return new Error("Data id required");
                    }),
            });

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                    record_id = enc_dec.cjs_decrypt(
                        req.bodyString("customer_id")
                    );
                    let customer_exist = await checkifrecordexist(
                        { id: record_id,submerchant_id: req.credentials.merchant_id,
                            merchant_id:req.credentials.super_merchant_id },
                        "inv_customer"
                    );
                    let record_exist = await checkifrecordexist(
                        { id: record_id, deleted: 0  },
                        "inv_customer"
                    );
                    if (customer_exist && record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                !customer_exist
                                    ? "Record not found"
                                    : !record_exist
                                    ? "Record already deleted."
                                    : " "
                            )
                        );
                    }
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_inv_add: async (req, res, next) => {
        
        const schema = Joi.array().items({
            customer_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Customer id required.");
                }),
         
            currency: Joi.string()
                .min(1)
                .max(3)
                .trim()
                .required()
                .error(() => {
                    return new Error("Currency required.");
                }),

            issue_date: Joi.date()
                .format("YYYY-MM-DD")
                .required()
                .error(() => {
                    return new Error("Issue date required (format: YYYY-MM-DD).");
                }),
                
            expiry_date: Joi.date()
                .iso()
                .format("YYYY-MM-DD") 
                .greater(moment().format("YYYY-MM-DD"))
                .min(Joi.ref("issue_date"))
                .required()
                .error(() => {
                    return new Error("Expiry date must be greater than issue date or today (format: YYYY-MM-DD).");
                }),
            merchant_invoice_no: Joi.string().required(() => {
                return new Error("Merchant invoice no");
            }),
            payment_terms: Joi.string().allow(""),
            description: Joi.string().allow(""),
            note: Joi.string().allow(""),
            item_data: Joi.array().items({
                item_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item  required.");
                    }),
                
                    rate: Joi.number()
                    .min(0.1)
                    .max(9999999)
                    .required()
                    .messages({
                        "any.required": "Item rate is required",
                        "number.min": "Please enter Item rate greater than or equal to 0.1",
                        "number.max": "Item rate is less than or equal to 9999999",
                    }),
                quantity: Joi.number()
                    .greater(0)
                    .required()
                    .error(() => {
                        return new Error("Please enter a quantity value greater than 0.");
                    }),
                tax: Joi.number()
                   .min(0)
                   .max(100)
                    .required()
                    .error(() => {
                        return new Error("Please enter a tax value less than or equal to 100.");
                    }),
                discount: Joi.number()
                .min(0)
                .max(100)
                    .error(() => {
                        return new Error("Please enter a discount value less than or equal to 100.");
                    }),
            }),
        
        });
        try {
            const result = schema.validate(req.body.data);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let sub_merchant_id = req.credentials.merchant_id;
               
                let customer_id_exist = await helpers.getInvCustomer('customer_id',req.body.data,req.credentials.merchant_id);
                let currency_exist = await helpers.getMIDCurrency('currency_id',req.body.data,req.credentials.merchant_id,req.credentials.type );
                let item_id_exist = await helpers.getInvItems('item_id',req.body.data,req.credentials.merchant_id,'add');
            
                    if (!currency_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Currency not exits"
                            )
                        );
                    }else if (!customer_id_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Customer  not exits"
                            )
                        );
                    } else if (!item_id_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Items not exits"
                            )
                        );
                    }
                    else{
                        next()
                    }
                
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_invoice_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            status: Joi.string()
                .valid("Cancelled","Closed","Expired","Draft","Pending")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Draft", "Pending", "Cancelled", "Closed", or "Expired".',
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
      
            email: Joi.string().email().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid email required."
                );
            }),
            mobile: Joi.number().allow("").optional()   
            .error(() => {
                return new Error(
                    "Valid mobile required."
                );
            }),
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
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_inv_details: async (req, res, next) => {
        if (checkEmpty(req.query, ["invoice_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Data id Required");
                    }),
            });
            try {
                const result = schema.validate(req.query);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                  
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.queryString("data_id")
                            ),
                            deleted:0,
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
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
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_inv_delete: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Data id Required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                  
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("data_id")
                            ),
                            deleted:0,
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
                    let record_draft = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("data_id")
                            ),
                            deleted:0, 
                            status:'Draft',
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
                    let expiryDate = await helpers.getExpiryInvoice(enc_dec.cjs_decrypt(
                        req.bodyString("data_id")
                    ));
                        if(!record_exist){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Record not found."
                                )
                            );
                        }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                            return res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `The invoice has been expired`
                                )
                            );
                        }else if(!record_draft){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Invoice has been Closed or Finalized."
                                )
                            );
                        }else{
                            next();
                        }
                        
                    
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_inv_cancel: async (req, res, next) => {
        if (checkEmpty(req.body, ["invoice_id"])) {
            const schema = Joi.object().keys({
                data_id: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .error(() => {
                        return new Error("Data id Required");
                    }),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(result.error.message)
                    );
                } else {
                  
                    let record_exist = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("data_id")
                            ),
                            deleted:0,
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
                    let record_cancelled = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("data_id")
                            ),
                            deleted:0, 
                            status:'Cancelled',
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
                    let record_closed = await checkifrecordexist(
                        {
                            id: enc_dec.cjs_decrypt(
                                req.bodyString("data_id")
                            ),
                            deleted:0, 
                            status:'Closed',
                            sub_merchant_id:req.credentials.merchant_id,
                            mode:req.credentials.type
                        },
                        "inv_invoice_master"
                    );
                    let expiryDate = await helpers.getExpiryInvoice(enc_dec.cjs_decrypt(
                        req.bodyString("data_id")
                    ));
                        if(!record_exist){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Record not found."
                                )
                            );
                        }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                            return res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `The invoice has been expired`
                                )
                            );
                        } else if(record_cancelled){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Invoice already cancelled."
                                )
                            );
                        }
                        else if(record_closed){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Invoice has been closed."
                                )
                            );
                        }else{
                            next();
                        }
                        
                    
                }
            } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(error)
                );
            }
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    open_inv_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            data_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Data id required.");
                }),
            customer_id: Joi.string()
                .min(1)
                .max(50)
                .trim()
                .required()
                .error(() => {
                    return new Error("Customer id required.");
                }),
          
            currency: Joi.string()
                .min(1)
                .max(3)
                .trim()
                .required()
                .error(() => {
                    return new Error("Currency required.");
                }),

            issue_date: Joi.date()
                .format("YYYY-MM-DD") 
                .required()
                .error(() => {
                    return new Error("Issue date required (format:YYYY-MM-DD).");
                }),
            expiry_date: Joi.date()
                .format("YYYY-MM-DD") 
                .min(Joi.ref("issue_date"))
                .required()
                .error(() => {
                    return new Error("Expiry date must be greater than issue date (format:YYYY-MM-DD).");
                }),
            merchant_invoice_no: Joi.string()
                .required()
                .error(() => {
                    return new Error("Merchant invoice no required");
                }),
            payment_terms: Joi.string().allow(""),
            description: Joi.string().allow(""),
            note: Joi.string().allow(""),
            item_data: Joi.array().items({
                item_id: Joi.string()
                    .required()
                    .error(() => {
                        return new Error("Item ID required.");
                    }),
             
                    quantity: Joi.number()
                    .greater(0)
                    .required()
                    .error(() => {
                        return new Error("Please enter a quantity value greater than 0.");
                    }),
                 
                    rate: Joi.number()
                    .min(0.1)
                    .max(9999999)
                    .required()
                    .messages({
                        "any.required": "Item rate is required",
                        "number.min": "Please enter Item rate greater than or equal to 0.1",
                        "number.max": "Item rate is less than or equal to 9999999",
                    }),
                    tax: Joi.number()
                    .min(0)
                    .max(100)
                     .required()
                     .error(() => {
                         return new Error("Please enter a tax value less than or equal to 100.");
                     }),
                 discount: Joi.number()
                 .min(0)
                 .max(100)
                     .error(() => {
                         return new Error("Please enter a discount value  less than or equal to 100.");
                     }),
            }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let today =moment().format('YYYY-MM-DD')
                let customer_id = enc_dec.cjs_decrypt(
                    req.bodyString("customer_id")
                );
                let invoice_id = enc_dec.cjs_decrypt(
                    req.bodyString("data_id")
                );
            
                let customer_exits;
            
                    customer_exits = await checkifrecordexist(
                        { id: customer_id,submerchant_id: req.credentials.merchant_id , merchant_id: req.credentials.super_merchant_id,deleted:0,status:0 },
                        "inv_customer"
                    );
                    let currency=await helpers.get_currency_id_by_name(req.body.currency);
                    let currency_exist=await helpers.check_if_data_currency_exist({'submerchant_id':req.credentials.merchant_id,'currency_id':currency,env:req.credentials.type,deleted:0,status:0},'mid');
                 let invoice_exits = await checkifrecordexist(
                    { id: invoice_id ,deleted:0,status:'Draft',mode:req.credentials.type,sub_merchant_id: req.credentials.merchant_id , merchant_id: req.credentials.super_merchant_id},
                    "inv_invoice_master"
                  );
                let item_id_exist = await helpers.getInvItems('item_id',req.body.item_data,req.credentials.merchant_id,'update');
                         //check expiry date
               let expiryDate = await helpers.getExpiryInvoice(invoice_id);
                       if(!invoice_exits){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Record not found"
                                )
                            );
                        }else if(today >  req.bodyString("expiry_date")){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Expiry date must be grater than today"
                                )
                            );
                        }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                            return res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    `The invoice has been expired`
                                )
                            );
                        }  else if(!currency_exist){
                            res.status(StatusCode.badRequest).send(
                                ServerResponse.validationResponse(
                                    "Currency not exist"
                                )
                            );
                        } 
                         else if (!customer_exits) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Customer not exits"
                            )
                        );
                    }else if (!item_id_exist) {
                        res.status(StatusCode.badRequest).send(
                            ServerResponse.validationResponse(
                                "Item not exits"
                            )
                        );
                    }else{
                        next();
                    }
                
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_inv_send: async (req, res, next) => {
        
        const schema = Joi.object().keys({
            invoice_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Invoice  id Required");
                }),
         
            cc_email: Joi.string()
                .email({ multiple: true })
                .optional()
                .allow(""),
            subject: Joi.string()
                .required()
                .error(() => {
                    return new Error("Subject Required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                let expiryDate = await helpers.getExpiryInvoice(enc_dec.cjs_decrypt(
                    req.bodyString("invoice_id")
                ));
                let record_exist = await checkifrecordexist(
                    { id: enc_dec.cjs_decrypt(req.bodyString("invoice_id")) ,mode:req.credentials.type,sub_merchant_id: req.credentials.merchant_id , merchant_id: req.credentials.super_merchant_id},
                    "inv_invoice_master"
                );
                let record_cancelled = await checkifrecordexist(
                    {
                        id: enc_dec.cjs_decrypt(
                            req.bodyString("invoice_id")
                        ),
                        deleted:0, 
                        status:'Cancelled',
                        sub_merchant_id:req.credentials.merchant_id,
                        mode:req.credentials.type
                    },
                    "inv_invoice_master"
                );
                let record_closed = await checkifrecordexist(
                    {
                        id: enc_dec.cjs_decrypt(
                            req.bodyString("invoice_id")
                        ),
                        deleted:0, 
                        status:"Closed",
                        sub_merchant_id:req.credentials.merchant_id,
                        mode:req.credentials.type
                    },
                    "inv_invoice_master"
                );
                if(!record_exist){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Record not found."
                        )
                    );
                }else  if (expiryDate && expiryDate[0]?.calculated_expiry_date === 'YES') {
                    return res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            `The invoice has been expired`
                        )
                    );
                }else if(record_cancelled){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invoice has been cancelled."
                        )
                    );
                }else if(record_closed){
                    res.status(StatusCode.badRequest).send(
                        ServerResponse.validationResponse(
                            "Invoice has been Closed."
                        )
                    );
                }else{
                    next();
                }
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
    open_item_list: async (req, res, next) => {
        const schema = Joi.object().keys({
      
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
           
        
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
           

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
    open_customer_list: async (req, res, next) => {
        const schema = Joi.object().keys({
      
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
                status: Joi.string()
                .valid("Active","Deactivated")
                .allow("")
                .optional()
                .messages({
                    "any.only":
                        'The status field must be one of "Deactivated", "Active".',
                }),
                billing_country: Joi.string()
                .min(2)
                .max(2)
                .allow("")
                .optional()
                .messages({
                    "string.max":
                        'Billing country length must be at least 2 characters long',
                        "string.min":
                        'Billing country length must be at least 2 characters long',
                }),
                name_or_email_mobile: Joi.string()
                .allow("")
                .optional(),
                customer_id: Joi.string()
                .allow("")
                .optional()
               
        });
        try {
            const result = schema.validate(req.query);
            if (result.error) {
           

                res.status(StatusCode.badRequest).send(
                    ServerResponse.validationResponse(result.error.message)
                );
            } else {
                next();
            }
        } catch (error) {
        logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error.message)
            );
        }
    },
};
module.exports = validation;
