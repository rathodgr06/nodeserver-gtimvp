const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const merchant_model = require('../models/merchant_registration');
var uuid = require('uuid');
const { authenticator } = require('otplib')
const mailSender = require('../utilities/mail/mailsender');
const merchantToken = require("../utilities/tokenmanager/merchantToken");
const QRCode = require('qrcode')
const moment = require('moment');
const logger = require('../config/logger');

var referrer = {
    add: async (req, res) => {
        let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let country = enc_dec.cjs_decrypt(req.bodyString("country"));
        let state = enc_dec.cjs_decrypt(req.bodyString("province"));
        let city = enc_dec.cjs_decrypt(req.bodyString("city"));
        let store_ids = req.bodyString('stores').split(',');
        let allow_mid = req.bodyString('allow_mid');
        let payment_link_amount = req.bodyString('amount_allowed');
        let selected_merchant = store_ids[0]!='All'?enc_dec.cjs_decrypt(store_ids[0]):0;
        let ins_data = {
            name: req.bodyString('name'),
            email: req.bodyString('email'),
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            mobile_no: req.bodyString('mobile'),
            code: req.bodyString('mobile_code'),
            status: 0,
            user: 1,
            super_merchant_id: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
            address: req.bodyString('address'),
            country: country,
            province: state?state:0,
            city: city?city:0,
            zipcode: req.bodyString('zipcode'),
            role: req.bodyString('role'),
            stores: req.bodyString('stores'),
            selected_submerchant: selected_merchant?selected_merchant:0,
            payment_link_amount: payment_link_amount,
            deleted: 0,
            register_at: added_date,
            allow_mid: allow_mid,
            live:req.body.live
        }
        merchant_model.register(ins_data).then(async (result) => {

            let token = uuid.v1();
            let resetData = {
                merchant_id: result.insert_id,
                token: token,
                is_expired: 0,
                created_at: created_at,
            };
            merchant_model.addResetPassword(resetData).then(
                async (result_add_reset) => {
                    // let merchant_details = {
                    // merchant_id: result.insert_id,
                    // }
                    // let merchant_details_insert_result = await MerchantRegistrationModel.addDetails(merchant_details)

                    let verify_url =
                        process.env.FRONTEND_URL_MERCHANT +
                        "create-password/" +
                        token;
                    
                    await mailSender.welcomeMail(
                        req.bodyString("email"),
                        verify_url
                    );
                    res.status(statusCode.ok).send(
                        response.successmsg(
                            "Register successfully, please verify your email."
                        )
                    );
                }
            );
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    list: async (req, res) => {
        console.log(`request user details are below`);
        console.log(req.user);
        console.log(req.body);
        let limit = {
            perpage: 10,
            start: 0,
            page: 1,
        }
        if (req.bodyString('perpage') && req.bodyString('page')) {
            perpage = parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start - 1) * perpage)
        }
        let condition = { deleted: 0};

        let search = '';
        let or_cond;
        if(req.body.is_user==0){
             or_cond = {
            super_merchant_id: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
            id: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id
        };
        }else{
            let super_merchant_details = await merchant_model.selectOne('stores,selected_submerchant,user',{id: req.user.id});
            console.log(`here is super merchant details`);
            console.log(super_merchant_details);
            condition.stores = `"${super_merchant_details.stores}"`;
            condition.selected_submerchant=super_merchant_details.selected_submerchant
            condition.user=1;
        }
        console.log(or_cond);
       
        if (req.bodyString('search_string')) {
            search = req.bodyString('search_string');
        }
       ;
        merchant_model.select_merchant_user(condition, or_cond,search, limit).then(async (result) => {
            let send_res = [];
            for (val of result) {
                let temp = {
                    muser_id: enc_dec.cjs_encrypt(val.id),
                    format_id: await helpers.formatNumber(val.id),
                    name: val.name?val.name:val.legal_business_name,
                    email: val.email,
                    mobile_no: '+' + val.code + ' ' + val.mobile_no,
                    status: val.status == 0 ? 'Active' : 'Deactivated',
                    address: val.address,
                    role: val.role,
                    super_merchant_id: enc_dec.cjs_encrypt(val.super_merchant_id),
                    email_verified: val.email_verified,
                    mobile_verified: val.mobile_no_verified,
                    password: val.password ? val.password : "",
                    allow_mid: val.allow_mid,
                }
                send_res.push(temp);
            }
            let total_count = await merchant_model.get_count(condition,or_cond, search);
            res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Merchant user list fetched successfully.', total_count));
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    get: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
        merchant_model.selectOne('*', { id: id }).then(async (val) => {
            
            let send_res = {
                format_id: await helpers.formatNumber(val.id),
                muser_id: enc_dec.cjs_encrypt(val.id),
                name: val.name?val.name:val.legal_business_name,
                email: val.email,
                mobile_code: val.code,
                mobile_no: val.mobile_no,
                status: val.status == 0 ? 'Active' : 'Deactivated',
                address: val.address,
                country: val.country ? enc_dec.cjs_encrypt(val.country) : "",
                state: val.province ? enc_dec.cjs_encrypt(val.province) : "",
                city: val.city ? enc_dec.cjs_encrypt(val.city) : "",
                zipcode: val.zipcode,
                role: val.role,
                stores: val.stores,
                super_merchant_id: enc_dec.cjs_encrypt(val.super_merchant_id),
                allow_mid: val.allow_mid,
                amount_allowed: val.payment_link_amount,
            }
            res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Details fetched successfully.'));
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    delete: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
        let update_data = { deleted: 1 }
        merchant_model.updateDetails({ id: id }, update_data).then((result) => {
            res.status(statusCode.ok).send(response.successmsg('User deleted successfully.'));
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })

    },
    update: async (req, res) => {
        let muser_id = enc_dec.cjs_decrypt(req.bodyString("muser_id"));
        merchant_model.selectOne('email,mobile_no', { id: muser_id }).then(async (result) => {
            let duplicate_email = false;
            if (result.email != req.bodyString("email")) {
                let email_exits = await merchant_model.selectSome({ email: req.bodyString("email") });
                
                if (email_exits) {
                    duplicate_email = email_exits.length > 0 ? true : false;
                }
            }
            let duplicate_mobile = false;
            if (result.mobile_no != req.bodyString("mobile")) {
                let mobile_exits = await merchant_model.selectSome({ mobile_no: req.bodyString("mobile") });
                if (mobile_exits) {
                    duplicate_mobile = mobile_exits.length > 0 ? true : false;
                }

            }
            if (duplicate_email || duplicate_mobile) {
                if (duplicate_email) {
                    res.status(statusCode.ok).send(response.errormsg('Email already exits, please try with another email id.'));
                } else {
                    res.status(statusCode.ok).send(response.errormsg('Mobile no already exits, please try with another mobile no.'));
                }
            } else {
                let country = enc_dec.cjs_decrypt(req.bodyString("country"));
                let state = enc_dec.cjs_decrypt(req.bodyString("province"));
                let city = enc_dec.cjs_decrypt(req.bodyString("city"));
                let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
                let store_ids = req.bodyString('stores').split(',');
                let selected_merchant = store_ids[0]!='All'?enc_dec.cjs_decrypt(store_ids[0]):0;
                let payment_link_amount = req.bodyString('amount_allowed');
                let allow_mid = req.bodyString('allow_mid');
                let ins_data = {
                    name: req.bodyString('name'),
                    email: req.bodyString('email'),
                    mobile_no: req.bodyString('mobile'),
                    code: req.bodyString('mobile_code'),
                    address: req.bodyString('address'),
                    role: req.bodyString('role'),
                    stores: req.bodyString('stores'),
                    selected_submerchant:selected_merchant,
                    country: country,
                    province: state,
                    city: city,
                    zipcode: req.bodyString('zipcode'),
                    updated_at: added_date,
                    allow_mid : allow_mid,
                    payment_link_amount: payment_link_amount,
                   
                }
                
                merchant_model.updateDetails({ id: muser_id }, ins_data).then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('User updated successfully.'));
                }).catch((error) => {
                     logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            }
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    activate: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
        let update_data = { status: 0 }
        merchant_model.updateDetails({ id: id }, update_data).then((result) => {
            res.status(statusCode.ok).send(response.successmsg('User activated successfully.'));
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })

    },
    deactivate: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
        let update_data = { status: 1 }
        merchant_model.updateDetails({ id: id }, update_data).then((result) => {
            res.status(statusCode.ok).send(response.successmsg('User deactivated successfully.'));
        }).catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })

    },


    reset_password: async (req, res) => {
        MerchantRegistrationModel.select({ token: req.bodyString("token") })
            .then(async (result_password_reset) => {
                let passwordHash = await encrypt_decrypt(
                    "encrypt",
                    req.bodyString("password")
                );
                let merchant_data = {
                    password: passwordHash,
                };
                let condition = {
                    id: result_password_reset.merchant_id,
                };
                MerchantRegistrationModel.update_super_merchant(
                    condition,
                    merchant_data
                )
                    .then(async (result) => {
                        let merchant_data = {
                            is_expired: 1,
                        };
                        let condition = {
                            token: req.bodyString("token"),
                        };
                        let result1 =
                            await MerchantRegistrationModel.updateResetPassword(
                                condition,
                                merchant_data
                            );

                        let two_fa_token = uuid.v1();
                        let two_fa_secret = authenticator.generateSecret();
                        let created_at = moment().format('YYYY-MM-DD HH:mm:ss');;
                        let two_fa_data = {
                            token: two_fa_token,
                            secret: two_fa_secret,
                            merchant_id: result_password_reset.merchant_id,
                            created_at: created_at,
                        };
                        let result_2fa =
                            await MerchantRegistrationModel.add_two_fa(
                                two_fa_data
                            );
                        res.status(statusCode.ok).send(
                            response.successdatamsg(
                                { token: two_fa_token },
                                "Password reset successfully."
                            )
                        );
                    })
                    .catch((error) => {
                         logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error)
                        );
                    });
            })
            .catch((error) => {
                 logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error)
                );
            });
    },

    reset_link: async (req, res) => {
        let condition = {
            email: req.bodyString("email"),
            deleted: 0,
            status: 0,
        };
        
        merchant_model.selectWithSelection("id,email", condition)
            .then((result) => {
                if (result) {
                    let reset_condition = { merchant_id: result.id };
                    let reset_data = { is_expired: 1 };
                    merchant_model.updateResetPassword(
                        reset_condition,
                        reset_data
                    )
                        .then((result_reset) => {
                            let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
                            let token = uuid.v1();
                            let resetData = {
                                merchant_id: result.id,
                                token: token,
                                is_expired: 0,
                                created_at: created_at,
                            };
                            merchant_model.addResetPassword(
                                resetData
                            ).then(async (result) => {
                                let verify_url =
                                    process.env.FRONTEND_URL_MERCHANT +
                                    "reset-password-merchant/" +
                                    token;
                                await mailSender.forgotMail(
                                    req.bodyString("email"),
                                    verify_url
                                );
                                res.status(statusCode.ok).send(
                                    response.successmsg(
                                        "If your account is identified, you will be receiving an email to change your password."
                                    )
                                );
                            });
                        })
                        .catch((error) => {
                             logger.error(500,{message: error,stack: error.stack}); 
                            res.status(statusCode.internalError).send(
                                response.errormsg(error)
                            );
                        });
                } else {
                    res.status(statusCode.ok).send(
                        response.errormsg("Account is not active or deleted.")
                    );
                }
            })
            .catch((error) => {
                 logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error)
                );
            });
    },
}
module.exports = referrer;