const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const idChecker = require('./idchecker');
const checkifrecordexist = require('./checkifrecordexist');
const { mode } = require('crypto-js');
const logger = require('../../config/logger');

const DapiValidator = {
    login: async(req, res, next) => {
            const schema = Joi.object().keys({
                order_id: Joi.string().required().error(() => {
                    return new Error("Order id required")
                }),
                userSecret: Joi.string().required().error(() => {
                    return new Error("User secret required")
                }),
                connectionID: Joi.string().required().error(() => {
                    return new Error("Connection id required")
                }),
                accessCode: Joi.string().required().error(() => {
                    return new Error("Access code required")
                }),
                mode:Joi.string().required().error(()=>{
                    return new Error("Mode required")
                }),
                operationID:Joi.string().allow(''),
                userInputs:Joi.any().allow(''),
                
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
                } else {
                    let table_name = 'orders';
                    table_name = req.body.mode=='test'?'test_orders':table_name;
                    let order_exits = await checkifrecordexist({order_id:req.body.order_id},table_name);
                    if(order_exits){
                        next();
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid order id'));
                    }
                   
                }
            } catch (error) {
                        logger.error(500,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        
    },
    transfer:async(req,res,next)=>{
        const schema = Joi.object().keys({
            order_id: Joi.string().required().error(() => {
                return new Error("Order id required")
            }),
            userSecret: Joi.string().required().error(() => {
                return new Error("User secret required")
            }),
            senderId: Joi.string().required().error(() => {
                return new Error("Sender id required")
            }),
            accessToken: Joi.string().required().error(() => {
                return new Error("Access token required")
            }),
            mode:Joi.string().required().error(()=>{
                return new Error("Mode required")
            }),
            mask_account_no:Joi.string().required().error(()=>{
                return new Error("Mask account no required")
            }),
            bank_name:Joi.string().required().error(()=>{
                return new Error("Bank name required")
            }),
            user_name:Joi.string().required().error(()=>{
                return new Error("user name required")
            }),
            type:Joi.string().required().error(()=>{
                return new Error("user name required")
            }),
            iban:Joi.string().required().error(()=>{
                return new Error("user name required")
            }),
            operationID:Joi.string().allow(''),
            userInputs:Joi.any().allow(""),
            hlAPIStep:Joi.string().allow('')
        })

        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
            } else {
                let table_name = 'orders';
                table_name = req.body.mode=='test'?'test_orders':table_name;
                let order_exits = await checkifrecordexist({order_id:req.body.order_id},table_name);
                if(order_exits){
                    next();
                }else{
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid order id'));
                }
               
            }
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
        }
    },
    getAccounts:async(req,res,next)=>{
            const schema = Joi.object().keys({
                order_id: Joi.string().required().error(() => {
                    return new Error("Order id required")
                }),
                userSecret: Joi.string().required().error(() => {
                    return new Error("User secret required")
                }),
               
                accessToken: Joi.string().required().error(() => {
                    return new Error("Access token required")
                }),
                mode:Joi.string().required().error(()=>{
                    return new Error("Mode required")
                }),
                operationID:Joi.string().allow(''),
                userInputs:Joi.any().allow(''),
                
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
                } else {
                    let table_name = 'orders';
                    table_name = req.body.mode=='test'?'test_orders':table_name;
                    let order_exits = await checkifrecordexist({order_id:req.body.order_id},table_name);
                    if(order_exits){
                        next();
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid order id'));
                    }
                   
                }
            } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

    }
   

}
module.exports = DapiValidator;