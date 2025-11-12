const DesignationModel = require("../models/designation");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const moment = require('moment');
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require('../utilities/logmanager/winston');

var Designation = {
    add: async(req, res) => {
        let added_date = await date_formatter.created_date_time();
        let designation_name = req.bodyString("designation");
        let role = req.bodyString("role");
        let ins_body  ={
            'designation':designation_name,
            'added_date':added_date,
            'role':role+"",
            'user_id':req.user.id,
            'ip':await helpers.get_ip(req),
        }
        DesignationModel.add(ins_body).then((result) => {
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Designation'
            }
            let added_name = req.bodyString('designation');
            let headers = req.headers;
            admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Designation added successfully.'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        }).catch((error) => {
            winston.error(error);
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

        if(req.bodyString('status') == "Active"){
            filter_arr.status = 0
        }
        if(req.bodyString('status') == "Deactivated"){
            filter_arr.status = 1
        }

        DesignationModel.select(filter_arr,limit)
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        designation_id: enc_dec.cjs_encrypt(val.id),
                        designation:val.designation,
                        role:val.role,
                        status:(val.status==1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                });
                total_count = await DesignationModel.get_count({'deleted':0})
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let designation_id = await enc_dec.cjs_decrypt(req.bodyString("designation_id"));
        DesignationModel.selectOne('id,designation,role,status',{ id:designation_id })
            .then((result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        designation_id: enc_dec.cjs_encrypt(val.id),
                        designation:val.designation,
                        role:val.role,
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
            
             let designation_id = await enc_dec.cjs_decrypt(req.bodyString("designation_id"));
             let designation = req.bodyString("designation");
             let role = req.bodyString("role");

            var insdata = {
                'designation':designation,
                'role':role
            };

            
            $ins_id = await DesignationModel.updateDetails({id:designation_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Designation'
            }
            let headers = req.headers;
            admin_activity_logger.edit(module_and_user,designation_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Designation updated successfully'));
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
            
             let designation_id = await enc_dec.cjs_decrypt(req.bodyString("designation_id"));
            var insdata = {
                'status':1
            };

            
            $ins_id = await DesignationModel.updateDetails({id:designation_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Designation'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user,designation_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Designation deactivated successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    activate: async (req, res) => {
        try {
            
             let designation_id = await enc_dec.cjs_decrypt(req.bodyString("designation_id"));
            var insdata = {
                'status':0
            };

            
            $ins_id = await DesignationModel.updateDetails({id:designation_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Designation'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user,designation_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Designation activated successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    delete: async (req, res) => {
        try {
            
             let designation_id = await enc_dec.cjs_decrypt(req.bodyString("designation_id"));
            var insdata = {
                'deleted':1
            };

            
            $ins_id = await DesignationModel.updateDetails({id:designation_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Designation'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,designation_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Designation deleted successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error){
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}
module.exports = Designation;