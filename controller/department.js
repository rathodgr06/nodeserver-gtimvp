const DepartmentModel = require("../models/department");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const moment = require('moment');
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require('../utilities/logmanager/winston');

var department = {
    add: async(req, res) => {
        let added_date = await date_formatter.created_date_time();
        let department_name = req.bodyString("department");

            let result = DepartmentModel.selectOne('id',{'department':department_name})
            if(result.length>0){
                res.status(statusCode.ok).send(response.AlreadyExist(department_name));
            }else{
                let ins_body  ={
                    'department':department_name,
                    'added_date':added_date,
                    'ip':await helpers.get_ip(req),
                }
                
                DepartmentModel.add(ins_body).then((result) => {
                    let module_and_user = {
                        user:req.user.id,
                        admin_type:req.user.type,
                        module:'Users',
                        sub_module:'Department'
                    }
                    let added_name = req.bodyString('department');
                    let headers = req.headers;
                    admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                        res.status(statusCode.ok).send(
                            response.successmsg("Department added successfully.")
                        );
                    }).catch((error)=>{
                        winston.error(error);
                        res.status(statusCode.internalError).send(response.errormsg(error.message));
                    })
                    
                }).catch((error) => {
                    winston.error(error);
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

        let filter_arr = { "deleted":0 }

        if(req.bodyString('status') == "Active"){
            filter_arr.status = 0
        }
        if(req.bodyString('status') == "Deactivated"){
            filter_arr.status = 1
        }

        DepartmentModel.select(filter_arr,limit)
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        department_id: enc_dec.cjs_encrypt(val.id),
                        department:val.department,
                        status:(val.status == 1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                });
                total_count = await DepartmentModel.get_count({'deleted':0})
                
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let department_id = await enc_dec.cjs_decrypt(req.bodyString("department_id"));
        DepartmentModel.selectOne("id,department,status",{ id:department_id })
            .then((result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        department_id: enc_dec.cjs_encrypt(val.id),
                        department:val.department,
                        status:val.status?"Deactivated":"Active",
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
            
             let department_id = await enc_dec.cjs_decrypt(req.bodyString("department_id"));
             let department = req.bodyString("department");
             
            var insdata = {
                'department':department
            };
            $ins_id = await DepartmentModel.updateDetails({id:department_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Department'
            }
            let headers = req.headers;
            admin_activity_logger.edit(module_and_user,department_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Department updated successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
           
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    deactivate: async (req, res) => {
        try {
            
             let department_id = await enc_dec.cjs_decrypt(req.bodyString("department_id"));
            var insdata = {
                'status':1
            };

            
            $ins_id = await DepartmentModel.updateDetails({id:department_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Department'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user,department_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Department deactivated successfully'));
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
            
             let department_id = await enc_dec.cjs_decrypt(req.bodyString("department_id"));
            var insdata = {
                'status':0
            };

            
            $ins_id = await DepartmentModel.updateDetails({id:department_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Department'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user,department_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Department activated successfully'));
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
            
             let department_id = await enc_dec.cjs_decrypt(req.bodyString("department_id"));
            var insdata = {
                'deleted':1
            };

            
            $ins_id = await DepartmentModel.updateDetails({id:department_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Department'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,department_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Department deleted successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
            
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}
module.exports = department;