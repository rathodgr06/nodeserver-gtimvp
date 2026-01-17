const DocumentModel = require("../models/documentModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const moment = require('moment')
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const logger = require('../config/logger');

var resp = {
    add: async(req, res) => {
        let added_date =await date_formatter.created_date_time();;
        let tc = req.bodyString("tc");
        let version = req.bodyString("version");
        let type = req.bodyString("type");
        let ins_body  ={
            'tc':tc,
            'version':version,
            'type':type,
            'added_date':added_date,
            'user':req.user.id,
            'ip':await helpers.get_ip(req),
        }
        DocumentModel.addtc(ins_body).then((result) => {
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Documentation',
                sub_module:'Terms & conditions'
            }
            let added_name = "version - "+req.bodyString('version');
            let headers = req.headers;
            admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Terms & Conditions added successfully.'));
            }).catch((error)=>{
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        }).catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        });
            
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
        
        let filter_arr = { "deleted":0 }
        if(req.bodyString('version') && req.bodyString('version') != ""){
            filter_arr.version = req.bodyString('version')
        }

        DocumentModel.select(filter_arr,limit)
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        tc_id: enc_dec.cjs_encrypt(val.id),
                        tc:val.tc,
                        version:val.version,
                        type:val.type,
                        date:moment(val.added_date).format('DD-MM-YYYY hh:mm A'),
                    };
                    send_res.push(res);
                });
                total_count = await DocumentModel.get_count(filter_arr)
                
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let tc_id = await enc_dec.cjs_decrypt(req.bodyString("tc_id"));
        console.log("tc_id",tc_id);
        DocumentModel.selectOne('id,tc,type,version',{ id:tc_id })
            .then((result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        tc_id: enc_dec.cjs_encrypt(val.id),
                        tc:val.tc,
                        version:val.version,
                        type:val.type,
                        date:moment(val.added_date).format('DD-MM-YYYY hh:mm A'),
                    };
                    send_res = res1;
               

                res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    auth_tc: async(req, res) => {
        DocumentModel.selectOneLatest('id,tc,type,version',{deleted:0})
            .then((result) => {
              let send_res = [];
                let val = result
                    let res1 = {
                        tc_id: enc_dec.cjs_encrypt(val.id),
                        tc:val.tc,
                        type:val.type,
                        version:val.version,
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
            
             let tc_id = await enc_dec.cjs_decrypt(req.bodyString("tc_id"));
             let tc = req.bodyString("tc");
             let version = req.bodyString("version");
             let type = req.bodyString("type");
            var insdata = {
                'tc':tc,
                'version':version,
                'type':type
            };

            
            $ins_id = await DocumentModel.updateDetails({id:tc_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Documentation',
                sub_module:'Terms & conditions'
            }
            let headers = req.headers;
            admin_activity_logger.edit(module_and_user,tc_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Terms & Conditions updated successfully'));
            }).catch((error)=>{
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
           
        } catch(error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

    delete: async (req, res) => {
        try {
            
             let tc_id = await enc_dec.cjs_decrypt(req.bodyString("tc_id"));
            var insdata = {
                'deleted':1
            };

            
            $ins_id = await DocumentModel.updateDetails({id:tc_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Documentation',
                sub_module:'Terms & conditions'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,tc_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Terms & Conditions deleted successfully'));
            }).catch((error)=>{
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error){
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}
module.exports = resp;