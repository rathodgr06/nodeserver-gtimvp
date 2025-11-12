const MerchantCategoryModel = require("../models/merchant_category");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const moment = require('moment');
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require('../utilities/logmanager/winston');

var merchant_category = {
    add: async(req, res) => {
        let added_date = await date_formatter.created_date_time();
        let merchant_category_name = req.bodyString("category_name");
        let role = req.bodyString("role");

            let result = MerchantCategoryModel.selectOne('id',{'category':merchant_category_name})
            if(result.length>0){
                res.status(statusCode.ok).send(response.AlreadyExist(merchant_category_name));
            }else{
                let ins_body  ={
                    'category':merchant_category_name,
                    'role':role,
                    'added_date':added_date,
                    'ip':await helpers.get_ip(req),
                }
                MerchantCategoryModel.add(ins_body).then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Added successfully.'));
                }).catch((error) => {
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                });
            }
    },
    list: async(req, res) => {
        let filter_arr = { "deleted":0 }

        if(req.bodyString('status') == "Active"){
            filter_arr.status = 0
        }
        if(req.bodyString('status') == "Deactivated"){
            filter_arr.status = 1
        }
        MerchantCategoryModel.select(filter_arr)
            .then((result) => {
               
                let send_res = [];
                result.forEach(function(val,key) {
                    let res = {
                        category_id: enc_dec.cjs_encrypt(val.id),
                        category: val.category,
                        role:val.role,
                    };
                    send_res.push(res);
                });

                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.'));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let merchant_category_id = await enc_dec.cjs_decrypt(req.bodyString("category_id"));
        MerchantCategoryModel.select({ id:merchant_category_id })
            .then((result) => {
                
              let send_res = [];
                let val = result[0]
                    let res1 = {
                        category_id: enc_dec.cjs_encrypt(val.id),
                        category: val.category,
                        role:val.role,
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
            
             let rec_id = await enc_dec.cjs_decrypt(req.bodyString("category_id"));
             let merchant_category = req.bodyString("category_name");
             let role = req.bodyString("role");

            var insdata = {
                'category':merchant_category,
                'role':role
            };

            
            $ins_id = await MerchantCategoryModel.updateDetails({id:rec_id},insdata);
            
            res.status(statusCode.ok).send(response.successmsg('Merchant category updated successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    }
    
}
module.exports = merchant_category;