const MccModel = require("../models/mccModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const moment = require('moment');
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');

var Mcc = {
      add: async(req, res) => {
          let added_date = await date_formatter.created_date_time();
          let category = enc_dec.cjs_decrypt(req.bodyString("category"));
          let mcc = req.bodyString("mcc");
          let description = req.bodyString("description");
  
              let result = await MccModel.selectOne('*',{'mcc': mcc,"deleted":0})
              if(result){
                  res.status(statusCode.ok).send(response.AlreadyExist(mcc));
              }else{
                  let ins_body  ={
                      'category':category,
                      'mcc':mcc,
                      'description':description.toUpperCase(),

                  }
                  MccModel.add(ins_body).then((result) => {
                    let module_and_user = {
                        user:req.user.id,
                        admin_type:req.user.type,
                        module:'Merchants',
                        sub_module:'MCC'
                    }
                    let added_name = req.bodyString('description');
                    let headers = req.headers;
                    admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                        res.status(statusCode.ok).send(
                            response.successmsg("MCC added successfully")
                        );
                    }).catch((error)=>{
                        logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(response.errormsg(error.message));
                    })
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
        // const country = await helpers.get_country_id_by_name(req.bodyString('country_name'));
        const category_id = await helpers.get_mcc_category_id_by_name(req.bodyString('category'));
        let search_obj = {}
        search_obj.deleted = 0;

      

        if(req.bodyString('status') == "Active"){
            search_obj.status = 0
        }
        if(req.bodyString('status') == "Deactivated"){
            search_obj.status = 1
        }

        if(req.bodyString('category_id')){
            in_category_id = enc_dec.cjs_decrypt(req.bodyString('category_id'));
            search_obj.category = in_category_id;
        }

        
        if (req.bodyString('category') && category_id){ search_obj.category = category_id }

        let search_mcc = {}
        if (req.bodyString('mcc')){ search_mcc.mcc = req.bodyString('mcc'),
        search_mcc.description = req.bodyString('mcc') }
        MccModel.select_all(search_obj,search_mcc,limit)
            .then(async (result) => {
                let send_res = [];
                
                for (let val of result) {
                    let res = {
                        category_id: enc_dec.cjs_encrypt(val.category),
                        category: val.category?await helpers.get_mcc_category_name_by_id(val.category):"",
                        mcc_id: enc_dec.cjs_encrypt(val.id),
                        mcc:val.mcc,
                        description:val.description,
                        status:(val.status==1)?"Deactivated":"Active",
                    };
                    send_res.push(res);
                }
                total_count = await MccModel.get_count_mcc(search_obj,search_mcc)
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },


      
      list1: async(req, res) => {
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
          MccModel.select({ "deleted":0 },limit)
              .then(async (result) => {
                 
                  let send_res = [];
                  result.forEach(function(val,key) {
                      let res = {
                          mcc_id: enc_dec.cjs_encrypt(val.id),
                          category:val.category,
                          mcc:val.mcc,
                          description:val.description,
                        status:(val.status == 1)?"Deactivated":"Active",
                      };
                      send_res.push(res);
                  });
                  total_count = await MccModel.get_count()
                  
                  res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
              })
              .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                  res.status(statusCode.internalError).send(response.errormsg(error.message));
              });
      },

      details: async(req, res) => {
          let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));
          MccModel.selectOne("*",{ id:mcc_id })
              .then(async(result) => {
                let send_res = [];
                  let val = result
                      let res1 = {
                          mcc_id: enc_dec.cjs_encrypt(val.id),
                          category: await helpers.get_mcc_category_by_id(val.category),
                          mcc:val.mcc,
                          description:val.description,
                      };
                      send_res = res1;
                 
  
                  res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
              })
              .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                  res.status(statusCode.internalError).send(response.errormsg(error.message));
              });
      },

    //   details: async(req, res) => {
    //     let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));
    //     StatesModel.selectOne("*",{ id:states_id })
    //         .then(async (result) => {
                
    //           let send_res = [];
    //             let val = result
    //                 let res1 = {
    //                     country_id: enc_dec.cjs_encrypt(val.ref_country),
    //                     country_name: await helpers.get_country_name_by_id(val.ref_country),
    //                     state_id: enc_dec.cjs_encrypt(val.id),
    //                     state_name:val.state_name,
    //                     state_code:val.state_code,
    //                     dial:val.dial,
    //                     status:(val.status==1)?"Deactivated":"Active",
    //                 };
    //                 send_res = res1;
               

    //             res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
    //         })
    //         .catch((error) => {
    //             res.status(statusCode.internalError).send(response.errormsg(error.message));
    //         });
    // },



      update: async (req, res) => {
          try {
                let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));

               let category = enc_dec.cjs_decrypt(req.bodyString("category"));
               let mcc = req.bodyString("mcc");
               let description = req.bodyString("description");
               
              var insdata = {
                  'category':category,
                  'mcc':mcc,
                  'description':description.toUpperCase()
              };
              $ins_id = await MccModel.updateDetails({id:mcc_id},insdata);
              let module_and_user = {
                  user:req.user.id,
                  admin_type:req.user.type,
                  module:'Merchants',
                  sub_module:'MCC'
              }
              let headers = req.headers;
              admin_activity_logger.edit(module_and_user,mcc_id,headers).then((result)=>{
                  res.status(statusCode.ok).send(response.successmsg('MCC updated successfully'));
              }).catch((error)=>{
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
              
               let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));
              var insdata = {
                  'status':1
              };
  
              
              $ins_id = await MccModel.updateDetails({id:mcc_id},insdata);
              let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'MCC'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user,mcc_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('MCC deactivated successfully'));
            }).catch((error)=>{
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
              
               let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));
              var insdata = {
                  'status':0
              };
  
              
              $ins_id = await MccModel.updateDetails({id:mcc_id},insdata);
              let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'MCC'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user,mcc_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('MCC activated successfully'));
            }).catch((error)=>{
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
              
               let mcc_id = await enc_dec.cjs_decrypt(req.bodyString("mcc_id"));
              var insdata = {
                  'deleted':1
              };
  
              
              $ins_id = await MccModel.updateDetails({id:mcc_id},insdata);
              let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'MCC'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,mcc_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('MCC deleted successfully'));
            }).catch((error)=>{
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
          } catch (error) {
                logger.error(500,{message: error,stack: error.stack}); 
              res.status(statusCode.internalError).send(response.errormsg(error.message));
          }
      },
  
  }

module.exports = Mcc;