const type_of_business_model = require("../models/type_of_business");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const moment = require('moment');
const logger = require('../config/logger');

var type_of_business = {
    add: async(req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let type_of_business = req.bodyString("type_of_business");

            let result = type_of_business_model.selectOne('id',{'type_of_business':type_of_business})
            if(result.length>0){
                res.status(statusCode.ok).send(response.AlreadyExist(type_of_business));
            }else{
                let ins_body  ={
                    'type_of_business':type_of_business,
                    'added_date':added_date,
                    'ip':await helpers.get_ip(req),
                }
                type_of_business_model.add(ins_body).then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Added successfully.'));
                }).catch((error) => {
                   logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                });
            }
    },
    list: async(req, res) => {
        let limit = {
            perpage:0,
            page:0,
        }
        if(req.bodyString('perpage') && req.bodyString('page')){
            perpage =parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start-1)*perpage)
        }
        type_of_business_model.select({ "deleted":0 },limit)
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        type_of_business_id: enc_dec.cjs_encrypt(val.id),
                        type_of_business:val.type_of_business,
                        status:(val.status == 1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                });
                total_count = await type_of_business_model.get_count({'deleted':0})
                
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
               logger.error(500,{message: error,stack: error.stack}); 
                
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let type_of_business_id = await enc_dec.cjs_decrypt(req.bodyString("type_of_business_id"));
        type_of_business_model.selectOne("id,type_of_business,status",{ id:type_of_business_id })
            .then((result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        type_of_business_id: enc_dec.cjs_encrypt(val.id),
                        type_of_business:val.type_of_business,
                        status:val.status?"Deactivated":"Active",
                    };
                    send_res = res1;
               

                res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
            })
            .catch((error) => {
               logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    update: async (req, res) => {
        try {
            
             let type_of_business_id = await enc_dec.cjs_decrypt(req.bodyString("type_of_business_id"));
             let type_of_business = req.bodyString("type_of_business");
             
            var insdata = {
                'type_of_business':type_of_business
            };
            $ins_id = await type_of_business_model.updateDetails({id:type_of_business_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record updated successfully'));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    deactivate: async (req, res) => {
        try {
            
             let type_of_business_id = await enc_dec.cjs_decrypt(req.bodyString("type_of_business_id"));
            var insdata = {
                'status':1
            };

            
            $ins_id = await type_of_business_model.updateDetails({id:type_of_business_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record deactivated successfully'));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    activate: async (req, res) => {
        try {
            
             let type_of_business_id = await enc_dec.cjs_decrypt(req.bodyString("type_of_business_id"));
            var insdata = {
                'status':0
            };

            
            $ins_id = await type_of_business_model.updateDetails({id:type_of_business_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record activated successfully'));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    delete: async (req, res) => {
        try {
            
             let type_of_business_id = await enc_dec.cjs_decrypt(req.bodyString("type_of_business_id"));
            var insdata = {
                'deleted':1
            };

            
            $ins_id = await type_of_business_model.updateDetails({id:type_of_business_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record deleted successfully'));
        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}
module.exports = type_of_business;