const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const lookup ={
    bin:async(req,res,next)=>{
        const schema = Joi.object().keys({
            bin_number: Joi.string().length(6).pattern(/^[0-9]+$/).required().error(() => {
               return new Error("Valid bin number Required")
            }),
            order_id: Joi.string().required().error(() => {
               return new Error("Valid order id Required")
            }),
            mode:Joi.string().allow('')
         })
         try {
            const result = schema.validate(req.body);
            if (result.error) {
               res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
              next()
            }
         } catch (error) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
         }
      
    },
    
    ip:async(req,res,next)=>{
        const schema = Joi.object().keys({
            ip: Joi.string().ip({
                version: [
                  'ipv4'
                ],
               }).required().error(() => {
               return new Error("Valid IP address Required")
            })
         })
         try {
            const result = schema.validate(req.body);
            if (result.error) {
               res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {
              next()
            }
         } catch (error) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
         }
      
    }
}

module.exports = lookup;