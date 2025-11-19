const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const validate_mobile = require('./validate_mobile');
const checkwithcolumn = require('./checkerwithcolumn');
const checkifrecordexist = require('./checkifrecordexist')
const enc_dec = require("../decryptor/decryptor");
const multer = require('multer');
const helpers = require('../helper/general_helper');
const fs = require('fs');
const encrypt_decrypt = require("../../utilities/decryptor/encrypt_decrypt");
const logger = require('../../config/logger');

const { join } = require('path');
const customer_validations = {
    login: async (req, res, next) => {

        const schema = Joi.object().keys({
            cid: Joi.string().min(5).max(50).required().error(() => {
                return new Error("Valid cid Required")
            }),
            pin: Joi.string().min(4).max(4).required().error(() => {
                return new Error("Valid pin Required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let cid = enc_dec.cjs_decrypt(req.bodyString('cid'));
                let pin = enc_dec.cjs_encrypt(req.bodyString('pin'));

                let customer_exists = await checkifrecordexist({ id: cid,deleted:0 }, 'customers');
                let pin_is_blank = await checkifrecordexist({ id: cid, pin: '' }, 'customers');
                let pin_exist = await checkifrecordexist({ id: cid, pin: pin }, 'customers');

                if (!customer_exists || pin_is_blank || !pin_exist) {
                    if (!customer_exists) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`ID not found or account deleted`));
                    } else if (pin_is_blank) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationDataResponse(req.bodyString('cid'), `Please set your pin first.`));
                    } else if (!pin_exist) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Pin does not match`));
                    }
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    otp_Sent: async (req, res, next) => {

        const schema = Joi.object().keys({
            email: Joi.string().email().required().error(() => {
                return new Error("Valid email required")
            }),
            is_existing: Joi.number().allow('').error(() => {
                return new Error("Is existing required")
            }),
            mobile_code: Joi.string().required().error(() => {
                return new Error("Dial code required")
            }),
            mobile_no: Joi.string().required().error(() => {
                return new Error("Mobile no required")
            })
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                // let email = req.bodyString('email');
                // let email_exist = await checkifrecordexist({email: email}, 'customers');

                // if (email_exist) {
                //         res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Email already exist`)); 
                // } else {
                next();
                // }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },

    otp_verify: async (req, res, next) => {

        const schema = Joi.object().keys({
            otp: Joi.string().min(4).max(4).required().error(() => {
                return new Error("Valid otp Required")
            }),

            otp_token: Joi.string().required().error(() => {
                return new Error("Valid OTP token Required")
            }),
            token: Joi.string().required().error(() => {
                return new Error("Valid  token Required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let otp = req.bodyString('otp');
                let otp_token = req.bodyString('otp_token');
                let check_otp = await helpers.get_otp_check({ otp: otp, token: otp_token });
                if (check_otp) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Email not verified`));

                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    reset_otp_Sent: async (req, res, next) => {

        const schema = Joi.object().keys({
            email: Joi.string().email().required().error(() => {
                return new Error("Valid email required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let email = req.bodyString('email');
                let email_exist = await checkifrecordexist({ email: email }, 'customers');

                if (!email_exist) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Email not found`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    reset_otp_verify: async (req, res, next) => {

        const schema = Joi.object().keys({
            otp: Joi.string().min(4).max(4).required().error(() => {
                return new Error("Valid otp Required")
            }),

            otp_token: Joi.string().required().error(() => {
                return new Error("Valid OTP token Required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let otp = req.bodyString('otp');
                let otp_token = req.bodyString('otp_token');
                let check_otp = await helpers.get_otp_check({ otp: otp, token: otp_token });
                
                if (check_otp) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Email not verified`));

                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    questions_list: async (req, res, next) => {

        const schema = Joi.object().keys({
            cid: Joi.string().min(5).max(50).required().error(() => {
                return new Error("Valid cid Required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let cid = enc_dec.cjs_decrypt(req.bodyString('cid'));
                let customer_exists = await checkifrecordexist({ id: cid }, 'customers');
                if (!customer_exists) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer not found`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    verify_cid: async (req, res, next) => {
        let verify_data = req.body.data;
        let cid = await enc_dec.cjs_decrypt(verify_data[0].cid);
        let customer_exists = await checkifrecordexist({ id: cid }, 'customers');
        if (!customer_exists) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer not found`));
        } else {
            next();
        }
    },
    reset_pin: async (req, res, next) => {

        const schema = Joi.object().keys({
            cid: Joi.string().min(5).max(50).required().error(() => {
                return new Error("Valid cid Required")
            }),

            pin: Joi.string().min(4).max(4).required().error(() => {
                return new Error("4-digit PIN required")
            }),
            confirm_pin: Joi.string().valid(Joi.ref('pin')).min(4).max(4).required().error(() => {
                return new Error("4-digit confirm PIN required")
            })
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let cid = enc_dec.cjs_decrypt(req.bodyString('cid'));
                let customer_exists = await checkifrecordexist({ id: cid }, 'customers');
                if (!customer_exists) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer not found`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    update_profile: async (req, res, next) => {

        if (checkEmpty(req.body, ["name", "avatar"])) {

            const schema = Joi.object().keys({

                avatar: Joi.optional().allow('').error(() => {
                    return new Error("Valid avatar required")
                }),
                name: Joi.string().min(1).max(100).required().error(() => {
                    return new Error("Valid name required")
                }),

            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    let user_exist = await checkifrecordexist({ 'id': req.user.payload.id }, 'customers');

                    // let code_country = await validate_mobile(req.bodyString('code'),"country",req.bodyString('mobile'));
                    if (user_exist) {
                        next();
                    } //  else if(!code_country.status){
                    //     res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(code_country.message));
                    // }
                    else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse("Record not found."));
                    }
                }

            } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
                
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    change_pin: async (req, res, next) => {
        if (checkEmpty(req.body, ["old_pin", "new_pin", "confirm_pin"])) {

            const schema = Joi.object().keys({
                old_pin: Joi.string().min(4).max(4).required().error(() => {
                    return new Error("Valid old PIN required")
                }),
                new_pin: Joi.string().min(4).max(4).required().error(() => {
                    return new Error("4-digit New PIN required")
                }),
                confirm_pin: Joi.string().valid(Joi.ref('new_pin')).min(4).max(4).required().error(() => {
                    return new Error("4-digit Confirm PIN required or same value of New Pin")
                })
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    let old_pin = await encrypt_decrypt('encrypt', req.bodyString("old_pin"));
                    var customers_exists = await checkifrecordexist({ id: req.user.payload.id }, 'customers');
                    var check = await checkifrecordexist({ "pin": old_pin, id: req.user.payload.id }, 'customers');
                    if (!check || !customers_exists) {
                        if (!check) {
                            res.status(StatusCode.ok).send(ServerResponse.validationResponse("You have entered wrong old pin"));
                        }
                        else if (!customers_exists) {
                            res.status(StatusCode.ok).send(ServerResponse.validationResponse("Customer not found"));
                        }
                    }
                    else {
                        next();

                    }

                }

            } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
                
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    otp_sent_email: async (req, res, next) => {

        const schema = Joi.object().keys({
            email: Joi.string().email().required().error(() => {
                return new Error("Valid email required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let email = req.bodyString('email');
                let email_exist = await checkifrecordexist({ email: email,deleted:0 }, 'customers');
                if (email_exist) {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Customer with email ${email} already exits.`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.ok).send(ServerResponse.validationResponse(error));
        }

    },
    card_list: async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string().allow(''),
        })
        const result = schema.validate(req.body);
        if (result.error) {
            res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
        } else {
            next();

        }
    },

    card_add: async (req, res, next) => {
        const schema = Joi.object().keys({
            card_holder_name: Joi.string().min(1).max(100).required().error(() => {
                return new Error("Valid card holder name required")
            }),
            card_no: Joi.string().min(16).max(16).required().error(() => {
                return new Error("16 digit card number required")
            }),
            expiry_date: Joi.date().format("MM/YY").required().error(() => {
                return new Error("Valid expiry date required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let card_no = req.bodyString('card_no');
                let card_holder_name = req.bodyString('card_holder_name');
                let card_exist = await helpers.checkCardExistByCardNoAndCID({cid:enc_dec.cjs_encrypt(req.user.payload.id), deleted:0},card_no)
                if (card_exist ) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Card number exists`));
                } else {
                    next()
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error.message));
        }

    },
    card_delete: async (req, res, next) => {

        const schema = Joi.object().keys({
            card_id: Joi.string().required().error(() => {
                return new Error("Valid card Id required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let card_id = enc_dec.cjs_decrypt(req.bodyString('card_id'));
                let card_id_exist = await checkifrecordexist({ id: card_id, deleted: 0 }, 'customers_cards');

                if (!card_id_exist) {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Card not found or already deleted`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    card_hide: async (req, res, next) => {

        const schema = Joi.object().keys({
            card_id: Joi.string().required().error(() => {
                return new Error("Valid card Id required")
            }),
            visibility: Joi.number().min(0).max(1).required().error(() => {
                return new Error("Valid visibility required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let card_id = enc_dec.cjs_decrypt(req.bodyString('card_id'));
                let card_id_exist = await checkifrecordexist({ id: card_id, deleted: 0 }, 'customers_cards');

                if (!card_id_exist) {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Card not found or already hide`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    card_primary: async (req, res, next) => {

        const schema = Joi.object().keys({
            card_id: Joi.string().required().error(() => {
                return new Error("Valid card Id required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let card_id = enc_dec.cjs_decrypt(req.bodyString('card_id'));
                let card_id_exist = await checkifrecordexist({ id: card_id, deleted: 0 }, 'customers_cards');
                let card_hide = await checkifrecordexist({ id: card_id, deleted: 0, status: 1 }, 'customers_cards');
                if (!card_id_exist) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Card not found`));
                } else if (card_hide) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Hidden card`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    delete_hide_card: async (req, res, next) => {
        let verify_data = req.body.data;
        
        for (let i = 0; i < verify_data.length; i++) {
            let card_id = await enc_dec.cjs_decrypt(verify_data[i].card_id);
            let card_exists = await checkifrecordexist({ id: card_id }, 'customers_cards');
            if (!card_exists) {
                res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Card not found`));
            } else {
                next();
            }
        }

    },
    check_mobile_and_code: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            mobile_code: myCustomJoi.string(),
            mobile_no: Joi.string().required().error(() => {
                return new Error("Valid mobile no required")
            }),
            fcm_id: Joi.string().required().error(() => {
                return new Error("Valid fcm id required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                
                res.status(StatusCode.ok).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let mobile_code = req.bodyString('mobile_code');
                let mobile_no = req.bodyString('mobile_no');
                let mobile_exist = await checkifrecordexist({ dial_code: mobile_code, mobile_no: mobile_no, id: req.user.payload.id }, 'customers');
                // let table_mobile_exist = await checkifrecordexist({ dial_code: mobile_code, mobile_no: mobile_no }, 'customers');

             /*   if (mobile_exist || table_mobile_exist) {
                    if (mobile_exist) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Mobile number already exist,please choose another number`));
                    } else if (table_mobile_exist) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse("Mobile already exist"));
                    }
                } else {
                    next();
                } */
                if (mobile_exist) {
                    res.status(StatusCode.ok).send(ServerResponse.validationResponse(`Mobile number already exist,please choose another number`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    send_otp_mobile: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            mobile_code: myCustomJoi.string(),
            mobile_no: Joi.string().required().error(() => {
                return new Error("Valid mobile no required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                //     let mobile = req.bodyString('mobile_no');
                //     let code = req.bodyString('mobile_code');
                //     let mobile_exist = await checkifrecordexist({dial_code: code,mobile_no:mobile}, 'customers');

                //     if (mobile_exist) {
                //         res.status(StatusCode.ok).send(ServerResponse.successdatamsg({ is_existing :1}));
                //    } else {
                next();
                // }
            }

        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    mobile_otp_verify: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            otp: Joi.string().min(4).max(4).required().error(() => {
                return new Error("Valid otp Required")
            }),
            otp_token: Joi.string().required().error(() => {
                return new Error("Valid otp token Required")
            }),
            fcm_id: Joi.string().required().error(() => {
                return new Error("Valid fcm_id Required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let otp = req.bodyString('otp');
                let otp_token = req.bodyString('otp_token');

                let check_otp = await helpers.get_mobile_otp_check({ otp: otp, token: otp_token });
                if (check_otp) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Invalid OTP`));

                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    forgot_otp_mobile: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            mobile_code: myCustomJoi.string(),
            mobile_no: Joi.string().required().error(() => {
                return new Error("Valid mobile no required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let mobile = req.bodyString('mobile_no');
                let code = req.bodyString('mobile_code');
                let mobile_exist = await checkifrecordexist({ dial_code: code, mobile_no: mobile }, 'customers');

                if (!mobile_exist) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Mobile number not found`));
                } else {
                    next();
                }
            }

        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    forgot_mobile_otp_verify: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            otp: Joi.string().min(4).max(4).required().error(() => {
                return new Error("Valid otp Required")
            }),
            otp_token: Joi.string().required().error(() => {
                return new Error("Valid otp token Required")
            }),


        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let otp = req.bodyString('otp');
                let otp_token = req.bodyString('otp_token');

                let check_otp = await helpers.get_mobile_otp_check({ otp: otp, token: otp_token });
                if (check_otp) {
                    next();
                } else {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Invalid OTP`));

                }
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    change_mobile_otp: async (req, res, next) => {
        const myCustomJoi = Joi.extend(require('joi-phone-number'));
        const schema = Joi.object().keys({
            mobile_code: myCustomJoi.string(),
            mobile_no: Joi.string().required().error(() => {
                return new Error("Valid mobile no required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let mobile = req.bodyString('mobile_no');
                let code = req.bodyString('mobile_code');
                let mobile_exist = await checkifrecordexist({ id: req.user.id, dial_code: code, mobile_no: mobile }, 'customers');
                let table_mobile_exist = await checkifrecordexist({ dial_code: code, mobile_no: mobile }, 'customers');
                var customers_exists = await checkifrecordexist({ id: req.user.id }, 'customers');
                if (mobile_exist || !customers_exists || table_mobile_exist) {
                    if (table_mobile_exist) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Mobile number already exist`));
                    }
                    else if (mobile_exist) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`You have changed you Mobile number`));
                    }
                    else if (!customers_exists) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Customer not found`));
                    }
                } else {
                    next();
                }
            }

        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    delete: async (req, res, next) => {
        try {
            let user_exist = await checkifrecordexist({ 'id': req.user.payload.id,'deleted':0 }, 'customers');
            if (user_exist) {
                next();
            } 
            else {
                res.status(StatusCode.ok).send(ServerResponse.validationResponse("Customer account already deleted."));
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse("Unable to process."));
        }
    },
}
module.exports = customer_validations;