const RuleModel = require("../models/rule_document_model");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const winston = require('../utilities/logmanager/winston');
const moment= require('moment');

const rules_document = {
    add: async (req, res) => {
        let added_date = moment().format('YYYY-MM-DD HH:mm:ss');
        let document_data = req.bodyString("document_data");
        let id = req.bodyString("id")
        let ins_body = {};

        let old_data = await RuleModel.selectOne({ id: 1 })
            .then((result) => {
                
                let val = result;

                if (val && val?.id === 1) {
                    // let old_data = val?.document_data;
                    // old_data = old_data + req.bodyString("document_data");
                    ins_body.document_data = req.bodyString("document_data");
                    
                    RuleModel.updateDetails({ id: 1 }, ins_body)
                        .then((result) => {
                            res.status(statusCode.ok).send(
                                response.successmsg(
                                    "Document updated successfully."
                                )
                            );
                        })
                        .catch((error) => {
                            winston.error(error);
                            res.status(statusCode.internalError).send(
                                response.errormsg(error.message)
                            );
                        });
                } else {
                    ins_body.document_data = req.bodyString("document_data");
                    RuleModel.add(ins_body)
                        .then((result) => {
                            res.status(statusCode.ok).send(
                                response.successmsg(
                                    "Document added successfully."
                                )
                            );
                        })
                        .catch((error) => {
                            winston.error(error);
                            res.status(statusCode.internalError).send(
                                response.errormsg(error.message)
                            );
                        });
                }
            })
            .catch((err) => {
                winston.error(err);
            });
    },

    list: async (req, res) => {
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

        RuleModel.select(limit)
            .then(async (result) => {
                
                let send_res = [];
                for (let item of result) {
                    let temp = {
                        id: enc_dec.cjs_encrypt(item.id),
                        document_data: item.document_data,
                        created_at: item.created_at,
                    };
                    send_res.push(temp);
                }

                total_count = await RuleModel.get_count();

                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "List fetched successfully.",
                        total_count
                    )
                );
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },
};

module.exports = rules_document;
