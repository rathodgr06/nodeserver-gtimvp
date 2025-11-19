const Joi = require("joi")
    .extend(require("@joi/date"))
    .extend(require("joi-currency-code"));
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const enc_dec = require("../decryptor/decryptor");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkRecordExits = require("../validations/checkifrecordexist");
const checkifrecordexist = require("./checkifrecordexist");
const logger = require('../../config/logger');

const Referral_Bonus_Validator = {
    update: async (req, res, next) => {
        const schema = Joi.object().keys({
            referral_bonus_id: Joi.string()
                .required()
                .error(() => {
                    return new Error("Referral bonus id required");
                }),
        });
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(
                    ServerResponse.errormsg(result.error.message)
                );
            } else {
                let record_id = enc_dec.cjs_decrypt(
                    req.bodyString("referral_bonus_id")
                );
                let record_exits = await checkRecordExits(
                    { id: record_id },
                    "referral_bonus"
                );
                if (record_exits) {
                    next();
                } else {
                    res.status(StatusCode.ok).send(
                        ServerResponse.errormsg("Record not exits or Invalid Id.")
                    );
                }
            }
        } catch (error) {
            logger.error(400,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(
                ServerResponse.validationResponse(error)
            );
        }
    },
};

module.exports = Referral_Bonus_Validator;
