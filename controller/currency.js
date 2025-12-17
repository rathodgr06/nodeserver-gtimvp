const CurrencyModel = require("../models/currency");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const logger = require('../config/logger');
const submerchantModel = require('../models/submerchantmodel');

var currency = {
    add: async (req, res) => {

        let currency_name = req.bodyString("currency");
        let code = req.bodyString("code");
        let ins_body = {
            'currency': currency_name,
            'code': code,

        }
        CurrencyModel.add(ins_body).then((result) => {
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: 'Merchants',
                sub_module: 'Currency'
            }
            let added_name = req.bodyString('currency');
            let headers = req.headers;
            admin_activity_logger.add(module_and_user, added_name, headers).then((result) => {
                res.status(statusCode.ok).send(response.successmsg('Currency added successfully.'));
            }).catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        });

    },
    list: async (req, res) => {
        let limit = {
            perpage: 0,
            page: 0,
        }
        if (req.bodyString('perpage') && req.bodyString('page')) {
            perpage = parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start - 1) * perpage)
        }

        let filter_arr = { "deleted": 0 }

        if (req.bodyString('status') == "Active") {
            filter_arr.status = 0
        }
        if (req.bodyString('status') == "Deactivated") {
            filter_arr.status = 1
        }
        CurrencyModel.select(filter_arr, limit)
            .then(async (result) => {

                let send_res = [];
                result.forEach(function (val, key) {
                    let res = {
                        currency_id: enc_dec.cjs_encrypt(val.id),
                        currency: val.currency,
                        code: val.code,
                        status: (val.status == 1) ? "Deactivated" : "Active",
                    };
                    send_res.push(res);
                });
                total_count = await CurrencyModel.get_count({ 'deleted': 0 })
                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'List fetched successfully.', total_count));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    list_form_mid: async (req, res) => {
        let filter_arr = { "deleted": 0 }

        if (req.bodyString('status') == "Active") {
            filter_arr.status = 0
        }

        //console.log('req', req.user);

        //mid code
        let condition = {
            status: 0,
            deleted: 0,
        };
        let submerchant_id = enc_dec.cjs_decrypt(
            req.bodyString("submerchant_id")
        );

        submerchant_id = req?.user?.id;

        condition["env"] = req.bodyString("env");

        const type = req.bodyString("type");

        if (submerchant_id) {
            condition["submerchant_id"] = submerchant_id;
        }

        //console.log('mid_currency', mid_currency.currency_ids);
        //mid code

        let mid_currency = await submerchantModel.getMIDCurrency(
            condition,
            'mid'
        );
        CurrencyModel.select_mid_currency(filter_arr, mid_currency.currency_ids)
            .then(async (result) => {

                let send_res = [];
                result.forEach(function (val, key) {
                    let res = {
                        currency_id: enc_dec.cjs_encrypt(val.id),
                        currency: val.currency,
                        code: val.code,
                        status: (val.status == 1) ? "Deactivated" : "Active",
                    };
                    send_res.push(res);
                });
                total_count = await CurrencyModel.get_count({ 'deleted': 0 })
                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'List fetched successfully.', total_count));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });

    },
    details: async (req, res) => {
        let currency_id = await enc_dec.cjs_decrypt(req.bodyString("currency_id"));
        CurrencyModel.selectOne('id,currency,code', { id: currency_id })
            .then((result) => {

                let send_res = [];
                let val = result
                let res1 = {
                    currency_id: enc_dec.cjs_encrypt(val.id),
                    currency: val.currency,
                    code: val.code,
                    status: (val.status == 1) ? "Deactivated" : "Active",
                };
                send_res = res1;


                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Details fetched successfully.'));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    update: async (req, res) => {
        try {

            let currency_id = await enc_dec.cjs_decrypt(req.bodyString("currency_id"));
            let currency = req.bodyString("currency");
            let code = req.bodyString("code");

            var insdata = {
                'currency': currency,
                'code': code
            };


            $ins_id = await CurrencyModel.updateDetails({ id: currency_id }, insdata);

            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: 'Merchants',
                sub_module: 'Currency'
            }
            let headers = req.headers;
            admin_activity_logger.edit(module_and_user, currency_id, headers).then((result) => {
                res.status(statusCode.ok).send(response.successmsg('Currency updated successfully'));
            }).catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    deactivate: async (req, res) => {
        try {

            let currency_id = await enc_dec.cjs_decrypt(req.bodyString("currency_id"));
            var insdata = {
                'status': 1
            };


            $ins_id = await CurrencyModel.updateDetails({ id: currency_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: 'Merchants',
                sub_module: 'Currency'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user, currency_id, headers).then((result) => {
                res.status(statusCode.ok).send(response.successmsg('Currency deactivated successfully'));
            }).catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    activate: async (req, res) => {
        try {

            let currency_id = await enc_dec.cjs_decrypt(req.bodyString("currency_id"));
            var insdata = {
                'status': 0
            };


            $ins_id = await CurrencyModel.updateDetails({ id: currency_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: 'Merchants',
                sub_module: 'Currency'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user, currency_id, headers).then((result) => {
                res.status(statusCode.ok).send(response.successmsg('Currency activated successfully'));
            }).catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    delete: async (req, res) => {
        try {

            let currency_id = await enc_dec.cjs_decrypt(req.bodyString("currency_id"));
            var insdata = {
                'deleted': 1
            };


            $ins_id = await CurrencyModel.updateDetails({ id: currency_id }, insdata);
            let module_and_user = {
                user: req.user.id,
                admin_type: req.user.type,
                module: 'Merchants',
                sub_module: 'Currency'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user, currency_id, headers).then((result) => {
                res.status(statusCode.ok).send(response.successmsg('Currency deleted successfully'));
            }).catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    fetchBumpUpRate: async (req, res) => {
        try {
            let currency = req.bodyString("currency");
            let rates = await CurrencyModel.selectBumpUpRate(currency);
            res.status(statusCode.ok).send(response.successdatamsg(rates, 'rates fetched successfully.'));
        
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    storeRate:async(req,res)=>{
       try {
           let baseCurrency = req.body?.rates?.[0]?.base_currency;
           if(baseCurrency){
            let DeleteRes = await CurrencyModel.removeOldRate(baseCurrency);
            let newRates = req.body.rates;
            let bulkAddRes = await CurrencyModel.addRate(newRates);
            res.status(statusCode.ok).send(response.successmsg('rates updated successfully.'));
           }else{
            res.status(statusCode.ok).send(response.errorMsg('unable to update rate.'));
           }
        
        } catch (error) {
            console.log(error);
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    }

}
module.exports = currency;