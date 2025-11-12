const webhook_settings = require("../models/webhook_settings");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const SequenceUUID = require("sequential-uuid");
const uuid = require("uuid");
const { errorMsg } = require("../utilities/response/ServerResponse");
const { default: axios } = require("axios");
const winston = require('../utilities/logmanager/winston');

const webHook = {
    get: async (req, res) => {
        try {
            const uuid = new SequenceUUID({
                valid: true,
                dashes: false,
                unsafeBuffer: true,
            });
            let token = uuid.generate();

            res.status(statusCode.ok).send(
                response.successdatamsg(
                    token,
                    "New Notification secret generated"
                )
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.badRequest).send(
                response.errormsg(error.message)
            );
        }
    },

    add_update: async (req, res) => {
        try {
            let merchant_id = req.user.id;
            let enabled = req.bodyString("enabled");
            let notification_url = req.bodyString("notification_url");
            let notification_secret = req.bodyString("notification_secret");

            let merchant = await webhook_settings.selectOne("*", {
                merchant_id: merchant_id,
            });
            if (merchant) {
                var insdata = {
                    enabled: enabled,
                    merchant_id: merchant_id,
                    notification_secret: notification_secret,
                    notification_url: notification_url,
                };
                $ins_id = await webhook_settings.updateDetails(
                    { id: merchant.id },
                    insdata
                );
                res.status(statusCode.ok).send(
                    response.successmsg("Record updated successfully")
                );
            } else {
                let ins_body = {
                    enabled: enabled,
                    merchant_id: merchant_id,
                    notification_secret: notification_secret,
                    notification_url: notification_url,
                };
                webhook_settings
                    .add(ins_body)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successmsg("Added successfully.")
                        );
                    })
                    .catch((error) => {
                        winston.error(error);
                        res.status(statusCode.badRequest).send(
                            response.errormsg(error.message)
                        );
                    });
            }
        } catch (error) {
            winston.error(error);
            res.status(statusCode.badRequest).send(
                response.errormsg(error.message)
            );
        }
    },
    add_update_with_merchant: async (req, res) => {
        try {
            const merchant_id = enc_dec.cjs_decrypt(req.body.merchant_id);
            if (!merchant_id) {
                return res.status(statusCode.badRequest).send(response.errormsg("Unknown Merchant"));
            }
            let enabled = req.bodyString("enabled");
            let notification_url = req.bodyString("notification_url");
            let notification_secret = req.bodyString("notification_secret");
            const merchant = await webhook_settings.selectOne("*", { merchant_id: merchant_id });
            if (merchant) {
                const insdata = {
                    enabled: enabled,
                    merchant_id: merchant_id,
                    notification_secret: notification_secret,
                    notification_url: notification_url,
                };
                $ins_id = await webhook_settings.updateDetails({ id: merchant.id }, insdata);
                res.status(statusCode.ok).send(
                    response.successmsg("Record updated successfully")
                );
            } else {
                const ins_body = {
                    enabled: enabled,
                    merchant_id: merchant_id,
                    notification_secret: notification_secret,
                    notification_url: notification_url,
                };
                webhook_settings
                    .add(ins_body)
                    .then(() => {
                        res.status(statusCode.ok).send(
                            response.successmsg("Added successfully.")
                        );
                    })
                    .catch((error) => {
                        winston.error(error);
                        res.status(statusCode.badRequest).send(
                            response.errormsg(error.message)
                        );
                    });
            }
        } catch (error) {
            winston.error(error);
            res.status(statusCode.badRequest).send(
                response.errormsg(error.message)
            );
        }
    },

    details: async (req, res) => {
        try {
            // const merchant_id = enc_dec.cjs_decrypt(req.body.merchant_id);
            const merchant_id = enc_dec.cjs_decrypt(req.body.merchant_id) || req.body.merchant_id;

            if (!merchant_id) {
                return res.status(statusCode.badRequest).send(response.errormsg("Unknown Merchant"));
            }

            let webhook_details = await webhook_settings.selectOne("*", { enabled: 0, merchant_id: merchant_id });
            const uuid = new SequenceUUID({
                valid: true,
                dashes: false,
                unsafeBuffer: true,
            });
            let token = uuid.generate();

            let send_res = {};
            send_res.is_enabled =
                webhook_details?.enabled == 0 ? "Enabled" : "Disabled";
            send_res.notification_url = webhook_details?.notification_url
                ? webhook_details.notification_url
                : "";
            send_res.notification_secret = webhook_details?.notification_secret
                ? webhook_details.notification_secret
                : token;

            res.status(statusCode.ok).send(
                response.successdatamsg(send_res, "Details fetch successfully.")
            );
        } catch (error) {
            winston.error(error);
            res.status(statusCode.badRequest).send(
                response.errormsg(error.message)
            );
        }
    },

    send_webhook_data: async (url, data, notification_secret) => {
        var support_config = {
            method: "POST",
            url: url,
            headers: { "notification-secret": notification_secret },
            data: data,
            validateStatus: false
        };
        try{
            let result =  await axios(support_config);
            return true;
        }catch(error){
            console.log(error);
            return true;
        }
       /* var support_config = {
            method: "POST",
            url: url,
            headers: { "notification-secret": notification_secret },
            data: data,
            validateStatus: false
        };
        return new Promise((resolve, reject) => {
            axios(support_config)
                .then(function (result) {
                    resolve(result.data);
                })
                .catch(function (error) {
                    winston.error(error);
                    reject(error);
                });
        }); */
    },
};

module.exports = webHook;
