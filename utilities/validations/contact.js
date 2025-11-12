const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const idChecker = require('./idchecker');
const checkifrecordexist = require('./checkifrecordexist');
const ContactValidator = {
    store: async(req, res, next) => {
            const schema = Joi.object().keys({
                contact_type: Joi.string().required().error(() => {
                    return new Error("Contact Type Required")
                }),
                name: Joi.string().required().error(() => {
                    return new Error("Name Required")
                }),
                contact_person_name: Joi.string().required().error(() => {
                    return new Error("Contact Person Name Required")
                }),
                country: Joi.string().required().error(() => {
                    return new Error("Country Required")
                }),
                mobile: Joi.string().required().error(() => {
                    return new Error("Mobile Required")
                }),
                email: Joi.string().required().error(() => {
                    return new Error("Email Required")
                }),
                account_number: Joi.string().required().error(() => {
                    return new Error("Account Number Required")
                }),
                ifsc_code: Joi.string().required().error(() => {
                    return new Error("IFSC Code Required")
                }),
                bank_name: Joi.string().required().error(() => {
                    return new Error("Bank Name Required")
                }),
                branch_name: Joi.string().required().error(() => {
                    return new Error("Branch Name Required")
                }),
                billing_name: Joi.string().allow(null, ''),
                billing_address: Joi.string().allow(null, ''),
                billing_pincode: Joi.string().allow(null, ''),
                billing_city: Joi.number().allow(null, ''),
                billing_state: Joi.number().allow(null, ''),
                shipping_name: Joi.string().allow(null, ''),
                shipping_address: Joi.string().allow(null, ''),
                shipping_pincode: Joi.string().allow(null, ''),
                shipping_city: Joi.number().allow(null, ''),
                shipping_state: Joi.number().allow(null, ''),
                pan: Joi.string().allow(null, ''),
                gst_no: Joi.string().allow(null, ''),
                tds_percentage: Joi.string().allow(null, ''),
                notes: Joi.string().allow(null, ''),
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.ok).send(ServerResponse.errormsg(result.error.message));
                } else {
                    if(req.bodyString('billing_city')){
                        let billing_city = await idChecker(req.bodyString('billing_city'),'city');
                        if(!billing_city)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid billing city'));
                    }
                    if(req.bodyString('billing_state')){
                        let billing_state = await idChecker(req.bodyString('billing_state'),'states');
                        if(!billing_state)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid billing state'));
                    }
                    if(req.bodyString('shipping_city')){
                        let shipping_city = await idChecker(req.bodyString('shipping_city'),'city');
                        if(!shipping_city)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid shipping city'));
                    }
                    if(req.bodyString('shipping_state')){
                        let shipping_state = await idChecker(req.bodyString('shipping_state'),'states');
                        if(!shipping_state)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid shipping state'));
                    }
                    let name_exist = await checkifrecordexist('name',req.bodyString('name'),'contacts',req.user.id);
                    let email_exist = await checkifrecordexist('email',req.bodyString('email'),'contacts',req.user.id);
                    let mobile_exist = await checkifrecordexist('mobile',req.bodyString('mobile'),'contacts',req.user.id);
                    if(!email_exist && !mobile_exist && !name_exist){
                      
                        next();
                    }else{
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(name_exist?'Contact already exist':''+' '+email_exist?'Contact with email already exist.':''+' '+mobile_exist?'Contact with mobile already exist.':''));
                    }
                   
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        
    },
    update: async(req, res, next) => {
        if (checkEmpty(req.body, ["id","contact_type","name","contact_person_name","country","mobile","email","account_number","ifsc_code","bank_name","branch_name"])) {

            const schema = Joi.object().keys({
                id: Joi.string().required().error(() => {
                    return new Error("ID Required")
                }),
                contact_type: Joi.string().required().error(() => {
                    return new Error("Contact Type Required")
                }),
                name: Joi.string().required().error(() => {
                    return new Error("Name Required")
                }),
                contact_person_name: Joi.string().required().error(() => {
                    return new Error("Contact Person Name Required")
                }),
                country: Joi.string().required().error(() => {
                    return new Error("Country Required")
                }),
                mobile: Joi.string().required().error(() => {
                    return new Error("Mobile Required")
                }),
                email: Joi.string().required().error(() => {
                    return new Error("Email Required")
                }),
                account_number: Joi.string().required().error(() => {
                    return new Error("Account Number Required")
                }),
                ifsc_code: Joi.string().required().error(() => {
                    return new Error("IFSC Code Required")
                }),
                bank_name: Joi.string().required().error(() => {
                    return new Error("Bank Name Required")
                }),
                branch_name: Joi.string().required().error(() => {
                    return new Error("Branch Name Required")
                }),
                billing_name: Joi.string().allow(null, ''),
                billing_address: Joi.string().allow(null, ''),
                billing_pincode: Joi.string().allow(null, ''),
                billing_city: Joi.number().allow(null, ''),
                billing_state: Joi.number().allow(null, ''),
                shipping_name: Joi.string().allow(null, ''),
                shipping_address: Joi.string().allow(null, ''),
                shipping_pincode: Joi.string().allow(null, ''),
                shipping_city: Joi.number().allow(null, ''),
                shipping_state: Joi.number().allow(null, ''),
                pan: Joi.string().allow(null, ''),
                gst: Joi.string().allow(null, ''),
                tds_percentage: Joi.string().allow(null, ''),
                notes: Joi.string().allow(null, ''),
            })

            try {
                const result = schema.validate(req.body);
              
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    if(req.bodyString('billing_city')){
                        let billing_city = await idChecker(req.bodyString('billing_city'),'city');
                        if(!billing_city)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid billing city'));
                    }
                    if(req.bodyString('billing_state')){
                        let billing_state = await idChecker(req.bodyString('billing_state'),'states');
                        if(!billing_state)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid billing state'));
                    }
                    if(req.bodyString('shipping_city')){
                        let shipping_city = await idChecker(req.bodyString('shipping_city'),'city');
                        if(!shipping_city)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid shipping city'));
                    }
                    if(req.bodyString('shipping_state')){
                        let shipping_state = await idChecker(req.bodyString('shipping_state'),'states');
                        if(!shipping_state)
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid shipping state'));
                    }
                    next();
                }
            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    get:async(req,res,next)=>{
        if (checkEmpty(req.body, ["id"])) {

            const schema = Joi.object().keys({
                id: Joi.string().required().error(() => {
                    return new Error("Contact Id Required")
                }), 
            })

            try {
                const result = schema.validate(req.body);
               
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    let contact  = await idChecker(req.bodyString('id'),'contacts');
                    if(!contact){
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Invalid contact id'));
                    }
                    next();
                }
            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },
    search:async(req,res,next)=>{
        if (checkEmpty(req.body, ["search_string"])) {

            const schema = Joi.object().keys({
                search_string: Joi.string().required().error(() => {
                    return new Error("Search String Required")
                }),
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    next();
                }
            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    }
   

}
module.exports = ContactValidator;