const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const Company = {
    updatelogo: async (req, res, next) => {
        const schema = Joi.object().keys({
            logo: Joi.string()
                .required()
                .error(() => {
                    return new Error("Logo Required");
                }),
        });

        try {
            const result = schema.validate(req.body);
            if (result.error){
                res.status(StatusCode.badRequest)
                    .send(ServerResponse.validationResponse(result.error.message));
            } else {
                next();
            }
        } catch (error) {
            res.status(StatusCode.badRequest)
                .send(ServerResponse.validationResponse(error));
        }
    },
    updatetax: async (req, res, next) => {
        if (checkEmpty(req.body, ["pan", "cin", "vat", "gstin", "servicetax", "tan"])) {
            const schema = Joi.object().keys({
                pan: Joi.string().error(() => {
                    return new Error("Pan Required");
                }),
                cin: Joi.string().allow(null, ''),
                vat: Joi.string().allow(null, ''),
                gstin: Joi.string().allow(null, ''),
                servicetax: Joi.string().allow(null, ''),
                tan: Joi.string().allow(null, ''),
            });
            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res
                        .status(StatusCode.badRequest)
                        .send(ServerResponse.validationResponse(result.error.message));
                } else {
                    next();
                }
            } catch (error) {
                res
                    .status(StatusCode.badRequest)
                    .send(ServerResponse.validationResponse(error));
            }
        }
    },
};
module.exports = Company;