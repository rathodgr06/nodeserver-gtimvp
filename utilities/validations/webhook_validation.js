const Joi = require("joi");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');


const webHookValidator = {
    add_update: async (req, res, next) => {
        if (checkEmpty(req.body, ["type_of_business"])) {

            
            const schema = Joi.object().keys({
                notification_url: Joi.string().required().error(() => {
                    return new Error("Valid notification_url required")
                }),
                enabled: Joi.number().required().error(() => {
                    return new Error("Valid integer value for enabled required")
                }),
                notification_secret: Joi.string().required().error(() => {
                    return new Error("Valid notification_secret required")
                }),
                merchant_id : Joi.string().allow("")
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    next();

                    // let type_of_business_exist = await checkifrecordexist({
                    //     'type_of_business': req.bodyString('type_of_business'),
                    //     'deleted': 0
                    // }, 'master_type_of_business');
                    // if (!type_of_business_exist) {
                    // } else {
                    //     res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(' type of business already exist.'));
                    // }
                }

            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    }
}

module.exports = webHookValidator