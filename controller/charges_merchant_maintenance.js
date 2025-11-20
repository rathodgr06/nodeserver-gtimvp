const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const encrypt_decrypt = require('../utilities/decryptor/encrypt_decrypt');
const helpers = require("../utilities/helper/general_helper");
const maintenanceModule = require("../models/charges_merchant_maintenance");
const enc_dec = require("../utilities/decryptor/decryptor");
require('dotenv').config({ path: "../.env" });
const moment = require('moment');
const logger = require('../config/logger');

const merchantMaintenance = {
    add: async (req, res) => {
        let register_at = moment().format('YYYY-MM-DD HH:mm:ss');
        let plan_data = {
            plan_name: req.bodyString("plan_name"),
            mid_currency: req.bodyString("mid_currency"),
            features: req.bodyString('feature'),
            billing_cycle: req.bodyString('billing_cycle'),
            charges_value: req.bodyString("charges_value"),
            tax: req.bodyString('tax'),
            description: req.bodyString("description"),
            notes: req.bodyString("notes"),
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            added_date: register_at,
            status: 0,
            added_by: req.user.id,
        }
        
        maintenanceModule.register(plan_data).then(async (result) => {
            res.status(statusCode.ok).send(response.successmsg('Plan added successfully'));
        }).catch((error) => {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error));
        })

    },

    list: async (req, res) => {
        try {
          let currency = await maintenanceModule.getcurrencyName();
          let limit = {
            perpage: 0,
            page: 0,
          };
          if (req.bodyString("perpage") && req.bodyString("page")) {
            perpage = parseInt(req.bodyString("perpage"));
            start = parseInt(req.bodyString("page"));

            limit.perpage = perpage;
            limit.start = (start - 1) * perpage;
          }
          let like_search = {};

          if (req.bodyString("search")) {
            like_search.plan_name = req.bodyString("search");
          }
          let result = await maintenanceModule.select("*", limit, like_search);

          let send_res = [];
          for (let val of result) {
            let res = {
              plan_id: enc_dec.cjs_encrypt(val.id),
              plan_name: val.plan_name,
              mid_currency: val.mid_currency,
              mid_currency_code: currency[val.mid_currency],
              features: val.features,
              features_name: await maintenanceModule.getfeaturesName(
                val.features
              ),
              billing_cycle: val.billing_cycle,
              charges_value: val.charges_value,
              notes: val.notes,
              description: val.description,
              tax: val.tax,
              status: val.status == 1 ? "Deactivated" : "Active",
            };
            send_res.push(res);
          }

          let total_count = await maintenanceModule.get_counts(like_search);
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
              )
            );
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    details: async (req, res) => {
        let id =  enc_dec.cjs_decrypt(req.bodyString("plan_id"));
        maintenanceModule.selectOne("*", { id: id })


            .then(async (result) => {
                
                let send_res = [];
                let val = result
                let res1 = {
                    plan_id: enc_dec.cjs_encrypt(val.id),
                    plan_name: val.plan_name,
                    mid_currency: val.mid_currency,
                    billing_cycle: val.billing_cycle,
                    charges_value: val.charges_value,
                    features: val.features,
                    features_name: await maintenanceModule.getfeaturesName(val.features),
                    description: val.description,
                    tax: val.tax,
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

            let plan_id = await enc_dec.cjs_decrypt(req.bodyString("plan_id"));

            var insdata = {
                'plan_name': req.bodyString('plan_name'),
                'mid_currency': req.bodyString("mid_currency"),
                'features': req.bodyString('feature'),
                'description': req.bodyString("description"),
                'charges_value': req.bodyString("charges_value"),
                'tax': req.bodyString('tax'),
                "notes": req.bodyString("notes"),
                'billing_cycle': req.bodyString("billing_cycle"),
            };
            $ins_id = await maintenanceModule.updateDetails({ id: plan_id }, insdata)
                .then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Plan updated successfully'));
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

            let plan_id = await enc_dec.cjs_decrypt(req.bodyString("plan_id"));
            var insdata = {
                'status': 1
            };


            $ins_id = await maintenanceModule.updateDetails({ id: plan_id }, insdata)
                .then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Plan deactivated successfully'));
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

            let plan_id = await enc_dec.cjs_decrypt(req.bodyString("plan_id"));
            var insdata = {
                'status': 0
            };
            $ins_id = await maintenanceModule.updateDetails({ id: plan_id }, insdata)
                .then((result) => {
                    res.status(statusCode.ok).send(response.successmsg('Plan activated successfully'));
                }).catch((error) => {
                   logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })

        } catch (error) {
           logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },


    features_list: async (req, res) => {
        try {
          let limit = {
            perpage: 0,
            page: 0,
          };
          if (req.bodyString("perpage") && req.bodyString("page")) {
            perpage = parseInt(req.bodyString("perpage"));
            start = parseInt(req.bodyString("page"));

            limit.perpage = perpage;
            limit.start = (start - 1) * perpage;
          }
          let like_search = {};

          if (req.bodyString("search")) {
            like_search.plan_name = req.bodyString("search");
          }
          let result = await maintenanceModule.select_features(
            "*",
            limit,
            like_search
          );

          let send_res = [];
          for (let val of result) {
            let res = {
              feature_id: val.id,
              feature: val.feature,
              status: val.status == 1 ? "Deactivated" : "Active",
              enc_feature_id: await enc_dec.cjs_encrypt(val.id),
            };
            send_res.push(res);
          }

          let total_count = await maintenanceModule.get_counts_features(
            like_search
          );
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
              )
            );
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    
}
module.exports = merchantMaintenance;