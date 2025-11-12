const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const idChecker = require('./idchecker');
const checkifrecordexist = require('./checkifrecordexist');
const DownloadValidator = {
    invoice: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Invoice id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_invoice',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invoice not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    estimate: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Estimate id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_estimate',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Estimate not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    saleorder: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Sale order id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_saleorder',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Sale order not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    deliverychallan: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Delivery challan id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_deliverychallan',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Delivery challan not exist'));

            }
        } catch (error) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error.message));
        }
    },
    cashmemo: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Cashmemo id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_cashmemo',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Cashmemo  not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    creditnote: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Credit note id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_credit_note',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Credit note not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    purchaseorder: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Purchase order id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_purchaseorder',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Purchase order not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    receiptnote: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Receipt note id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_recieptnote',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Receipt note not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    receipt: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Receipt  id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_reciept',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Receipt not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    debitnote: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Debit note id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_debitnote',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Debit note not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    paymentlink:async(req,res,next)=>{
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Payment link id required")
            }),
            
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let paymentlink_exist = await checkifrecordexist('id',req.bodyString('id'),'payment_links',req.user.id);
                if(paymentlink_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Payment link not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    send_invoice: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Invoice id required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.body.id,'users_invoice',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invoice not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    send_saleorder: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Sale order id required")
            }),
        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.body.id,'users_saleorder',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Sale order not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    bill: async (req, res, next) => {
        const schema = Joi.object().keys({
            id: Joi.string().required().error(() => {
                return new Error("Bill id required")
            }),
        })
        try {
            const result = schema.validate(req.query);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
                let invoice_exist = await checkifrecordexist('id',req.query.id,'users_bills',req.user.id);
                if(invoice_exist)
                next();
                else
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Bill not exist'));

            }
        } catch (error) {

            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },

}
module.exports = DownloadValidator;