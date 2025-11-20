const Joi = require("joi").extend(require("@joi/date")).extend(require('joi-currency-code'));
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const enc_dec = require('../decryptor/decryptor');
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkRecordExits = require('./checkifrecordexist');
const checkifrecordexistandexpiration = require('./checkifrecordexistandexpiration');
let iban_expression = new RegExp(/^[a-zA-Z]{2}[0-9]{2}\s?[a-zA-Z0-9]{4}\s?[0-9]{4}\s?[0-9]{3}([a-zA-Z0-9]\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,4}\s?[a-zA-Z0-9]{0,3})?$/);
const logger = require('../../config/logger');

const MuserValidator = {
    
    add: async (req, res, next) => {
   
        const schema = Joi.object().keys({
            name: Joi.string().required().error(() => {
                return new Error("Name required")
            }),
            email: Joi.string().email().required().error(() => {
                return new Error("Enter valid email address")
            }),
            mobile_code: Joi.string().required().error(() => {
                return new Error("Mobile code required")
            }),
            mobile: Joi.number().integer().min(10000000).max(99999999999).required().error(() => {
                return new Error("Valid mobile number  required")
            }),
            address: Joi.string().allow('').error(() => {
                return new Error("Valid address required")
            }),
            role: Joi.string().min(2).error(() => {
                return new Error("The role field is required")
            }),
            stores: Joi.string().min(2).error(() => {
                return new Error("The store access field is required")
            }),
            amount_allowed: Joi.string().min(0).allow('').optional().error(() => {
                return new Error("The Max. amount allowed field is required")
            }),
            country: Joi.string()
            .min(2)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid country required");
            }),
            province: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid state required");
            }),
        city: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid city required");
            }),
            zipcode: Joi.string()
            .min(4)
            .max(6)
            .optional()
            .allow("")
            .error(() => {
                return new Error(
                    "Valid zipcode required (max. length 6)"
                );
            }),
            allow_mid : Joi.required(),
            live:Joi.required()
        })

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let email_exits = await checkRecordExits({email:req.bodyString('email'),deleted:0},'master_super_merchant');
                let mobile_no_exits = await checkRecordExits({mobile_no:req.bodyString('mobile'),code:req.bodyString('mobile_code'),deleted:0},'master_super_merchant');
                if(!email_exits) {
                    next();
                } else {
                    if(email_exits){
                        res.status(StatusCode.ok).send(ServerResponse.errormsg('User or merchant with email already exits'));
                    }
                }
                
            }
        } catch (error) {
                    logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    get:async(req,res,next)=>{
        const schema = Joi.object().keys({
            muser_id: Joi.string().required().error(() => {
                return new Error("Merchant user id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
                let record_exits = await checkRecordExits({id:record_id,deleted:0},'master_super_merchant');
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    delete:async(req,res,next)=>{
        const schema = Joi.object().keys({
            muser_id: Joi.string().required().error(() => {
                return new Error("Merchant user id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString('muser_id'));
                let record_exits = await checkRecordExits({id:record_id,deleted:0},'master_super_merchant');
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits or already deleted.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    update: async (req, res, next) => {

        const schema = Joi.object().keys({
            name: Joi.string().required().error(() => {
                return new Error("Name required")
            }),
            email: Joi.string().email().required().error(() => {
                return new Error("Enter valid email address")
            }),
            mobile_code: Joi.string().required().error(() => {
                return new Error("Mobile code required")
            }),
            mobile: Joi.number().integer().min(10000000).max(99999999999).required().error(() => {
                return new Error("Valid mobile no  required")
            }),
            address: Joi.string().allow('').error(() => {
                return new Error("Valid address required")
            }),
            role: Joi.string().min(2).error(() => {
                return new Error("The role field is required");
            }),
            stores: Joi.string().min(2).error(() => {
                return new Error("The store access field is required")
            }),
            muser_id:Joi.string().required().error(()=>{
                return new Error("Merchant user id required")
            }),      country: Joi.string()
            .min(2)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid country required");
            }),
        province: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid province required");
            }),
        city: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .allow("")
            .error(() => {
                return new Error("Valid city required");
            }),
            zipcode: Joi.string()
            .min(4)
            .max(6)
            .optional()
            .allow("")
            .error(() => {
                return new Error(
                    "Valid zipcode required (max. length 6)"
                );
            }),
            allow_mid : Joi.required(),
            amount_allowed: Joi.string().min(0).allow('').optional().error(() => {
                return new Error("The Max. amount allowed field is required")
            }),
        })

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("muser_id"))
                let record_exits = await checkRecordExits({id:record_id},'master_super_merchant')
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            return res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    activate:async(req,res,next)=>{
        const schema = Joi.object().keys({
            muser_id: Joi.string().required().error(() => {
                return new Error("Referrer id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("muser_id"))
                let record_exits = await checkRecordExits({id:record_id,status:1},'master_super_merchant')
            
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits or already activated.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    deactivate:async(req,res,next)=>{
        const schema = Joi.object().keys({
            muser_id: Joi.string().required().error(() => {
                return new Error("Referrer id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("muser_id"))
                let record_exits = await checkRecordExits({id:record_id,status:0},'master_super_merchant')
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits or already deactivated.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    approve:async(req,res,next)=>{
        const schema = Joi.object().keys({
            referrer_id: Joi.string().required().error(() => {
                return new Error("Referrer id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString('referrer_id'));
                let record_exits = await checkRecordExits({id:record_id,deleted:0,is_approved:0},'referrers');
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits or already approved.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    onboard:async(req, res,next) => {
        const schema = Joi.object().keys({
            referral_code: Joi.string().required().error(() => {
                return new Error("Referral code required")
            }),
            perpage: Joi.string().required().error(() => {
                return new Error("perpage required")
            }),
            page: Joi.string().required().error(() => {
                return new Error("page required")
            }),
            search: Joi.string().optional().allow('').error(() => {
                return new Error("search required")
            }),
            from_date: Joi.date().format("YYYY-MM-DD").optional().allow('').error(() => {
                return new Error("onboard date required")
            }),
            to_date: Joi.date().format("YYYY-MM-DD").optional().allow('').error(() => {
                return new Error("onboard date required")
            }),
           
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = req.bodyString('referral_code');
                let record_exits = await checkRecordExits({referral_code:record_id},'referrers');
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Invalid referral code'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    twoFa:async(req,res,next)=>{
        const schema = Joi.object().keys({
            token: Joi.string().required().error(() => {
                return new Error("Token id required")
            }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = req.bodyString('token');
                let record_exits = await checkRecordExits({token:record_id,is_expired:0},'twofa_referrer');
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Invalid token.'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }

    },
    verify_2fa:async (req, res, next) => {
        const schema = Joi.object().keys({
            token: Joi.string().required().error(() => {
                return new Error("Token required")
            }),
            pin: Joi.string().length(6).pattern(/^[0-9]+$/).required().error(() => {
                return new Error("Valid Pin Required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let link_valid = await checkifrecordexistandexpiration({ token: req.bodyString('token'),is_expired:0}, 'twofa_referrer');
                if (link_valid) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Token is not valid or expired.'));
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    login: async (req, res, next) => {
        const schema = Joi.object().keys({
            email: Joi.string().email().required().error(() => {
                return new Error("Valid email required")
            }),
            password: Joi.string().required().error(() => {
                return new Error("Password Required")
            }),
        })

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let email_exits = await checkRecordExits({ email: req.bodyString('email'),deleted:0}, 'referrers');
                let deactive_account = await checkRecordExits({ email: req.bodyString('email'),status:1}, 'referrers');
             
                if (!email_exits || deactive_account) {
                    if(!email_exits){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Account is not registered`));
                    }else if(deactive_account){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(`Referrer is not active`));
                    }
                  
                } else {
                    next()
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }


    },
    update_profile: async (req, res, next) => {
        const schema = Joi.object().keys({
            name: Joi.string().required().error(() => {
                return new Error("Name required")
            }),
            email: Joi.string().email().required().error(() => {
                return new Error("Email required")
            }),
            mobile_code: Joi.string().required().error(() => {
                return new Error("Mobile code required")
            }),
            mobile_no: Joi.number().integer().min(10000000).max(99999999999).required().error(() => {
                return new Error("Valid mobile no  required")
            }),
            currency: Joi.string().currency().allow('').error(() => {
                return new Error("Valid currency  required")
            }),
            bank_name: Joi.string().allow('').error(() => {
                return new Error("Valid bank name required")
            }),
            branch_name: Joi.string().allow('').error(() => {
                return new Error("Valid branch name required")
            }),
            bank_account_no: Joi.string().allow('').error(() => {
                return new Error("Valid bank account no  required")
            }),
            address: Joi.string().allow('').error(() => {
                return new Error("Valid iban no required")
            }),
          
        })

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let record_id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"))
                let record_exits = await checkRecordExits({id:record_id},'referrers')
                if(record_exits){
                    next();
                }else{
                    res.status(StatusCode.ok).send(ServerResponse.errormsg('Record not exits'));
                }
                
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    reset_link: async (req, res, next) => {
        
        const schema = Joi.object().keys({
            email: Joi.string().email().required().error(() => {
                return new Error("Valid email required")
            })
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let email_exits = await checkRecordExits({ email: req.bodyString('email') }, 'master_super_merchant');
                
                if (!email_exits) {
                    res.status(StatusCode.badRequest).send(ServerResponse.successmsg(`If your account is identified, you will be receiving an email to change your password.`));
                } else {
                    next();
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }


    },
}
module.exports = MuserValidator;