const SecurityQuestionModel = require("../models/security_questions");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const MerchantModel = require("../models/merchantmodel")
const accessToken = require("../utilities/tokenmanager/token");
const moment = require('moment');
const winston = require('../utilities/logmanager/winston');

var SecurityQuestions = {
    add: async(req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let question = req.bodyString("question");

            let result = SecurityQuestionModel.selectOne('id',{'question':question})
            if(result.length>0){
                res.status(statusCode.ok).send(response.AlreadyExist(question));
            }else{
                let ins_body  ={
                    'question':question,
                    'added_date':added_date,
                }
                SecurityQuestionModel.add(ins_body).then((result) => {
                    let module_and_user = {
                        user:req.user.id,
                        admin_type:req.user.type,
                        module:'Users',
                        sub_module:'Security Questions'
                    }
                    let added_name = req.bodyString('question');
                    let headers = req.headers;
                    admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                        res.status(statusCode.ok).send(response.successmsg('Added successfully.'));
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

        SecurityQuestionModel.select(filter_arr,limit)
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        question_id: enc_dec.cjs_encrypt(val.id),
                        question:val.question,
                        status:(val.status == 1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                });
                total_count = await SecurityQuestionModel.get_count({'deleted':0})
                
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                winston.error(error);
                
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    list_all: async(req, res) => {
      

        SecurityQuestionModel.selectActive({deleted:0,status:0})
            .then(async (result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        question_id: enc_dec.cjs_encrypt(val.id),
                        question:val.question,
                        status:(val.status == 1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                });
                total_count = await SecurityQuestionModel.get_count({'deleted':0})
                
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                winston.error(error);
                
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let question_id = await enc_dec.cjs_decrypt(req.bodyString("question_id"));
        SecurityQuestionModel.selectOne("id,question,status",{ id:question_id })
            .then((result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        question_id: enc_dec.cjs_encrypt(val.id),
                        question:val.question,
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
            
             let question_id = await enc_dec.cjs_decrypt(req.bodyString("question_id"));
             let question = req.bodyString("question");
             
            var insdata = {
                'question':question
            };
            $ins_id = await SecurityQuestionModel.updateDetails({id:question_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Security Questions'
            }
            let headers = req.headers;
            admin_activity_logger.edit(module_and_user,question_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Security question updated successfully'));
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
            
             let question_id = await enc_dec.cjs_decrypt(req.bodyString("question_id"));
            var insdata = {
                'status':1
            };

            
            $ins_id = await SecurityQuestionModel.updateDetails({id:question_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Security Questions'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user,question_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Security Questions deactivated successfully'));
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
            
             let question_id =  enc_dec.cjs_decrypt(req.bodyString("question_id"));
            var insdata = {
                'status':0
            };

            
            ins_id = await SecurityQuestionModel.updateDetails({id:question_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Security Questions'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user,question_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Security Questions activated successfully'));
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
            
             let question_id =  enc_dec.cjs_decrypt(req.bodyString("question_id"));
            var insdata = {
                'deleted':1
            };

            
            let ins_id = await SecurityQuestionModel.updateDetails({id:question_id},insdata);
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Users',
                sub_module:'Security Questions'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,question_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Security Questions deleted successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
            
        } catch(error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

    store_answer: async (req, res) => {
        try {
            let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
             let data = req.body.data;
             let answers = []
             for(ans_data of data){
                let ans = {
                    question_id:enc_dec.cjs_decrypt(ans_data.question_id),
                    temp_id:enc_dec.cjs_decrypt(ans_data.cid),
                    answer:ans_data.answer,
                    added_date : added_date
                }
                answers.push(ans)
             }
           
             SecurityQuestionModel.add_answer(answers).then(async (result_data)=>{

                let result = await MerchantModel.selectCustomerDetails("*", {'id': enc_dec.cjs_decrypt(data[0].cid)})
                let customerData = {
                    name: result.name,
                    email: result.email,
                    pin: result.pin,
                    dial_code: result.mobile_code,
                    mobile_no: result.mobile_no,
                    fcm_id:result.fcm_id,
                    created_at: added_date,
                    updated_at: added_date
                }
                
                await MerchantModel.updateCustomerTempToken({id:enc_dec.cjs_decrypt(data[0].cid)},{is_invalid:1});

                let req_id = await MerchantModel.addCustomer(customerData)
                await SecurityQuestionModel.updateAnswer({ 'temp_id': enc_dec.cjs_decrypt(data[0].cid), 'deleted': 0 },{customer_id:req_id.insertId});
                let cid=enc_dec.cjs_encrypt(req_id.insertId)
                let payload = {
                    id:req_id.insertId,
                    name:customerData.name,
                    email:customerData.email
                }
                let aToken  = accessToken(payload);
                res.status(statusCode.ok).send(response.successansmsg({cid:cid,accessToken:aToken},'Answers added successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
           
        } catch(error) {
            winston.error(error);
            
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}
module.exports = SecurityQuestions;