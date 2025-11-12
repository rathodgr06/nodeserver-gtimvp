const nationalityModel = require("../models/nationalityModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const moment = require('moment');
const winston = require('../utilities/logmanager/winston');

var nationality = {
      add: async(req,res)=>{
            let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
            let inc_body={
                  'code':req.bodyString("code"),
                  'nationality':req.bodyString("nationality"),
                  "added_by": req.user.id,
                  'created_at	':added_date,
                  'ip':await helpers.get_ip(req),
            }
            nationalityModel.add(inc_body).then((result)=>{
                  res.status(statusCode.ok).send(response.successmsg('Nationality added successfully.'));
            }).catch((error)=>{
                winston.error(error);
                  res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
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
            let filter = {}
            if (req.bodyString('search')) { filter.code = req.bodyString('search');
                  filter.nationality= req.bodyString('search');            
              }
            let filter_arr = { "deleted":0 }
    
            if(req.bodyString('status') == "Active"){
                filter_arr.status = 0
            }
            if(req.bodyString('status') == "Deactivated"){
                filter_arr.status = 1
            }
    
            nationalityModel.select(filter_arr,filter,limit)
                .then(async (result) => {
                  
                    let send_res = [];
                    for (let val of result){
                        let res = {
                            nationality_id: enc_dec.cjs_encrypt(val.id),
                            code: val.code,
                            nationality:val.nationality,
                            status:(val.status==1)?"Deactivate":"Active",
                        };
                        send_res.push(res);
                    };
                    total_count = await nationalityModel.get_count(filter)
                    res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                });
        },
        details: async(req, res) => {
            let nationality_id = await enc_dec.cjs_decrypt(req.bodyString("nationality_id"));
            nationalityModel.selectOne("*",{ id:nationality_id,deleted:0 })
                .then((result) => {
                    
                  let send_res = [];
                    let val = result
                        let res1 = {
                            nationality_id: enc_dec.cjs_encrypt(val.id),
                            code:val.code,
                            nationality:val.nationality,
                            status:(val.status==1)?"Deactivated":"Active",
                        };
                        send_res = res1;
                   
    
                    res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
                })
                .catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                });
        },
        update: async (req, res) => {
            try {
                
                 let nationality_id = await enc_dec.cjs_decrypt(req.bodyString("nationality_id"));
                 let nationality = req.bodyString("nationality");
                 let code = req.bodyString("code");
                var insdata = {
                    'code':code,
                    'nationality':nationality,
                };
                $ins_id = await nationalityModel.updateDetails({id:nationality_id},insdata);
                
                let module_and_user = {
                    user:req.user.id,
                    admin_type:req.user.type,
                    module:'Locations',
                    sub_module:'Nationality'
                }
                let headers = req.headers;
                admin_activity_logger.edit(module_and_user,nationality_id,headers).then((result)=>{
                    res.status(statusCode.ok).send(response.successmsg('Nationality updated successfully'));
                }).catch((error)=>{
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            } catch(error) {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            }
        },
        deactivate: async (req, res) => {
            try {
                
                 let nationality_id = await enc_dec.cjs_decrypt(req.bodyString("nationality_id"));
                var insdata = {
                    'status':1
                };
    
                
                $ins_id = await nationalityModel.updateDetails({id:nationality_id},insdata);
                let module_and_user = {
                    user:req.user.id,
                    admin_type:req.user.type,
                    module:'Locations',
                    sub_module:'Nationality'
                }
                let headers = req.headers;
                admin_activity_logger.deactivate(module_and_user,nationality_id,headers).then((result)=>{
                    res.status(statusCode.ok).send(response.successmsg('Nationality deactivated successfully'));
                }).catch((error)=>{
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            } catch (error) {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            }
        },
        activate: async (req, res) => {
            try {
                
                 let nationality_id = await enc_dec.cjs_decrypt(req.bodyString("nationality_id"));
                var insdata = {
                    'status':0
                };
    
                
                $ins_id = await nationalityModel.updateDetails({id:nationality_id},insdata);
                let module_and_user = {
                    user:req.user.id,
                    admin_type:req.user.type,
                    module:'Locations',
                    sub_module:'Nationality'
                }
                let headers = req.headers;
                admin_activity_logger.activate(module_and_user,nationality_id,headers).then((result)=>{
                    res.status(statusCode.ok).send(response.successmsg('Nationality activated successfully'));
                }).catch((error)=>{
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            } catch (error) {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            }
        },
        delete: async (req, res) => {
            try {
                
                 let nationality_id = await enc_dec.cjs_decrypt(req.bodyString("nationality_id"));
                var insdata = {
                    'deleted':1
                };
    
                
                $ins_id = await nationalityModel.updateDetails({id:nationality_id},insdata);
                let module_and_user = {
                    user:req.user.id,
                    admin_type:req.user.type,
                    module:'Locations',
                    sub_module:'Nationality'
                }
                let headers = req.headers;
                admin_activity_logger.delete(module_and_user,nationality_id,headers).then((result)=>{
                    res.status(statusCode.ok).send(response.successmsg('Nationality deleted successfully'));
                }).catch((error)=>{
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            } catch (error) {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            }
        }


}

module.exports =nationality;