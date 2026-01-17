const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const document_model = require('../models/document_type');
var uuid = require('uuid');
const { authenticator } = require('otplib')
const mailSender = require('../utilities/mail/mailsender');
const merchantToken = require("../utilities/tokenmanager/merchantToken");
const QRCode = require('qrcode')
const moment = require('moment');
const EntityModel = require("../models/entityModel");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');

var referrer = {
    add: async (req, res) => {
        
        let created_at = await date_formatter.created_date_time();
        let added_date = await date_formatter.created_date_time();
        let country = enc_dec.cjs_decrypt(req.body.country);
      
        let ins_data = {
            category: req.bodyString('category'),
            document_type: req.bodyString('document_type'),
            country:country,
             ip :await helpers.get_ip(req),
            is_required: req.bodyString('is_required'),
            group_required: req.bodyString('group_required'),
            status: 0,
            created_at: added_date,
            
        }
        document_model.add(ins_data).then(async(result) => {
            
            res.status(statusCode.ok).send(response.successmsg('Document added successfully.'));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    list: async (req, res) => {
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
        let condition = {deleted:0};
        if (req.bodyString("category")) {
       
            condition.category = `${req.bodyString("category")}`;
        }
        if (req.bodyString("document_type")) {
       
            condition.id = req.bodyString("document_type");
        }
        if (req.bodyString("status")) {
       
            condition.status = await helpers.get_status(req.bodyString("status"));
        }
        let condition1 = {deleted:0};
        if (req.bodyString("category")) {
       
            condition1.category = `'${req.bodyString("category")}'`;
        }
        if (req.bodyString("document_type")) {
       
            condition.id = req.bodyString("document_type");
        }
        if (req.bodyString("country")) {
       
            condition.country = enc_dec.cjs_decrypt(req.bodyString("country"));
            condition1.country = enc_dec.cjs_decrypt(req.bodyString("country"));
        }
        if (req.bodyString("status")) {
       
            condition1.status = await helpers.get_status(req.bodyString("status"));
        }
        document_model.select(condition,limit).then(async(result) => {
            let send_res = [];
            for (val of result) {
                let temp = {
                    document_id: enc_dec.cjs_encrypt(val.id),
                    country_name:val.country?await helpers.get_country_name_by_id(val.country):'NA',
                    category: val.category,
                    is_required: val.is_required,
                    group_required: val.group_required,
                    status: val.status == 0 ? 'Active' : 'Deactivated',
                    document: val.document_type,
                    added_date:await date_formatter.get_date(val.created_at),  
                    //moment(val.created_at).format("DD-MM-YYYY"),
                }
                send_res.push(temp);
            }
            let total_count = await document_model.get_count(condition1);
            res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Document list fetched successfully.',total_count));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    list_of_entity_document: async (req, res) => {
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
        let condition = {deleted:0};
        if (req.bodyString("category")) {
       
            condition.category = `${req.bodyString("category")}`;
        }
        if (req.bodyString("document_type")) {
       
            condition.id = req.bodyString("document_type");
        }
        if (req.bodyString("status")) {
       
            condition.status = await helpers.get_status(req.bodyString("status"));
        }
        let condition1 = {deleted:0};
        if (req.bodyString("category")) {
       
            condition1.category = `'${req.bodyString("category")}'`;
        }
        if (req.bodyString("document_type")) {
       
            condition.id = req.bodyString("document_type");
        }
        if (req.bodyString("status")) {
       
            condition1.status = await helpers.get_status(req.bodyString("status"));
        }
    
        document_model.select(condition,limit).then(async(result) => {
            let send_res = [];
        
            for (val of result) {
                let condition_ = {deleted:0,
                    document:val.id,
                    entity_id: enc_dec.cjs_decrypt(req.bodyString("entity_id"))
                };
                if (req.bodyString("document_for")) {
           
                    condition_.document_for = `'${req.bodyString("document_for")}'`;
                }
                var total_count_document= await EntityModel.get_count_document(condition_);
                if(total_count_document==0){
             
                let temp = {
                    document_id: enc_dec.cjs_encrypt(val.id),
                    category: val.category,
                    is_required: val.is_required,
                    group_required: val.group_required,
                    status: val.status == 0 ? 'Active' : 'Deactivated',
                    document: val.document_type,
                 
                }
                send_res.push(temp);
            
        }
            }
            let total_count = await document_model.get_count(condition1);
            res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Document list fetched successfully.',total_count_document));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    get: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('document_id'));
        document_model.selectOne('*', { id: id }).then(async(val) => {
        
            let send_res = {
                document_id: enc_dec.cjs_encrypt(val.id),
                category: val.category,
                country:val.country?enc_dec.cjs_encrypt(val.country):'',
                is_required: val.is_required,
                group_required: val.group_required,
                status: val.status == 0 ? 'Active' : 'Deactivated',
                document: val.document_type,
                added_date:await date_formatter.get_date(val.created_at)  
            }
            res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Details fetched successfully.'));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })
    },
    delete: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('document_id'));
        let update_data = { deleted: 1 }
        document_model.updateDetails({ id: id }, update_data).then((result) => {
            res.status(statusCode.ok).send(response.successmsg('User deleted successfully.'));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })

    },
    update: async (req, res) => {
        
        let document_id = enc_dec.cjs_decrypt(req.bodyString("document_id"));
        document_model.selectOne('category,document_type', { id: document_id }).then(async (result) => {
            let duplicate = false;
            if (result.category != req.bodyString("category") && result.document_type != req.bodyString("document_type" )) {
                let document_exits = await document_model.selectSome({ category: req.bodyString("category") ,document_type: req.bodyString("document_type") });
                if (document_exits) {
                    duplicate = document_exits.length > 0 ? true : false;
                }
            
       
            } else {
                let added_date = await date_formatter.created_date_time();
                let country = enc_dec.cjs_decrypt(req.body.country);
                let ins_data = {
                    category: req.bodyString('category'),
                    country:country,
                    document_type: req.bodyString('document_type'),
                     ip :await helpers.get_ip(req),
                    is_required: req.bodyString('is_required'),
                    group_required: req.bodyString('group_required'),
                    status: 0,
                    updated_at: added_date,
                }
                
                document_model.updateDetails({ id: document_id }, ins_data).then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Document updated successfully.'));
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
        let id = enc_dec.cjs_decrypt(req.bodyString('document_id'));
        let update_data = { status: 0 }
        document_model.updateDetails({ id: id }, update_data).then(async(result) => {
        //    let entity= await  EntityModel.insert({document: id }, {deleted:0})
            res.status(statusCode.ok).send(response.successmsg('Document activated successfully.'));
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        })

    },
    deactivate: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString('document_id'));
        let update_data = { status: 1 }
        document_model.updateDetails({ id: id }, update_data).then(async(result) => {
           let entity= await  EntityModel.removeEntityDoc({document: id })
            res.status(statusCode.ok).send(response.successmsg('Document deactivated successfully.'));
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
                        let created_at =await date_formatter.created_date_time();
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
        
        document_model.selectWithSelection("id,email", condition)
            .then((result) => {
                if (result) {
                    let reset_condition = { merchant_id: result.id };
                    let reset_data = { is_expired: 1 };
                    document_model.updateResetPassword(
                        reset_condition,
                        reset_data
                    )
                        .then(async(result_reset) => {
                            let created_at = await date_formatter.created_date_time();
                            let token = uuid.v1();
                            let resetData = {
                                merchant_id: result.id,
                                token: token,
                                is_expired: 0,
                                created_at: created_at,
                            };
                            document_model.addResetPassword(
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
            .catch((err) => {
               logger.error(500,{message: err,stack: err.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(err)
                );
            });
    },
}
module.exports = referrer;