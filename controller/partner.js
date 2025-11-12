const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor")
const PartnerModel = require("../models/partner");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper")
require('dotenv').config({ path: "../.env" });
const moment = require('moment');
const winston = require('../utilities/logmanager/winston');

var partner = {
    add: async (req, res) => {
        
        try {
            let hashPassword = await encrypt_decrypt('encrypt',req.bodyString("password"));
            let username = await encrypt_decrypt('encrypt',req.bodyString("username"));
            
            let type_of_business = await enc_dec.cjs_decrypt(req.bodyString("type_of_business"));
            userData = {
                name: req.bodyString("name"),
                email: req.bodyString("email"),
                code: req.bodyString("country_code"),
                mobile: req.bodyString("mobile_no"),
                company_name: req.bodyString("company_name"),
                username: username,
                password: hashPassword,
                partner_id: await helpers.make_random_key('PAR'),
                type_of_business: type_of_business,
                added_by: req.user.id,
                added_date:moment().format('YYYY-MM-DD HH:mm:ss'),
                ip:await helpers.get_ip(req),
            };

            if(req.bodyString("address")){
                userData.address = req.bodyString("address");
            }
            if(req.bodyString("country_id")){
                let country = await enc_dec.cjs_decrypt(req.bodyString("country_id"));
                userData.country = country;
            }
            if(req.bodyString("state")){
                userData.state = req.bodyString("state");
            }
            if(req.bodyString("city")){
                userData.city = req.bodyString("city");
            }
            if(req.bodyString("zipcode")){
                userData.pincode = req.bodyString("zipcode");
            }
            
            ins_id = await PartnerModel.add(userData);

            let company_details = await helpers.company_details({id:1});
            var company_ins_data = {
                partner_id:ins_id.insertId,
                company_name:company_details.company_name,
                company_logo:company_details.company_logo,
                company_address:company_details.company_address,
                company_country: company_details.company_country,
                company_city: company_details.company_city,
                company_state: company_details.company_state,
                company_pincode: company_details.company_pincode,
                company_contact: company_details.company_contact,
                company_email: company_details.company_email,
                company_organizer: company_details.company_organizer,
                company_currency: company_details.company_currency,
                fav_icon: company_details.fav_icon,
                letter_head: company_details.letter_head,
                footer_banner: company_details.footer_banner,
                added_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                ip:await helpers.get_ip(req),
                batch_size: company_details.batch_size,
                android_link: company_details.android_link,
                ios_link: company_details.ios_link,
            };

            await helpers.insert_data(company_ins_data,'company_master')

            res.status(statusCode.ok).send(response.successmsg('Partner registered successfully'));
        } catch(error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error));
        }
    },
    list: async(req, res) => {
        let limit = {
            perpage:0,
            page:0,
        }
        if(req.bodyString('perpage') && req.bodyString('page')){
            perpage =parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start-1)*perpage)
        }
        const search_text = req.bodyString('search');
        const business = await helpers.get_business_id_by_name(req.bodyString('type_of_business'));
        const status = await helpers.get_status(req.bodyString('status'));
        const country = await helpers.get_country_id_by_name(req.bodyString('country'));
        const partner_id = `'${req.bodyString('partner_id')}'`;
        const state = `'${req.bodyString('state')}'`;
        const city =`'${req.bodyString('city')}'`;
        const search = { "deleted": 0 }
      
        const filter = {}
        if (req.bodyString('type_of_business')) { search.type_of_business = business }
        if (req.bodyString('country')) { search.country = country }
        if (req.bodyString('city')) { search.city = city }
        if (req.bodyString('state')) { search.state = state }
        if (req.bodyString('status')) { search.status = status }
        if (req.bodyString('partner_id')) { search.partner_id = partner_id }
        if (search_text) { filter.name = search_text;
            filter.email= search_text;            
            filter.mobile = search_text;
            filter.company_name = search_text;
        }



        PartnerModel.select(search,filter,limit)
            .then(async (result) => {
                
                let send_res = [];
                for (let val of result) {
                    let res = {
                        id: await enc_dec.cjs_encrypt(val.id),
                        partner_id: val.partner_id,
                        name:val.name,
                        email:val.email,
                        country_code:val.code,
                        mobile_no:val.mobile,
                        company_name:val.company_name,
                        username: await encrypt_decrypt('decrypt',val.username),
                        type_of_business: await enc_dec.cjs_encrypt(val.type_of_business),
                        type_of_business_name: await helpers.get_type_of_business(val.type_of_business),
                        address:val.address,
                        country:enc_dec.cjs_encrypt(val.country),
                        country_name:await helpers.get_country_name_by_id(val.country),
                        state:val.state,
                        city:val.city,
                        zipcode:val.pincode,
                        status:(val.status==1)?"Deactivated":"Active",
                        blocked_status:(val.is_blocked==1)?"Blocked":"Active",
                    };
                    send_res.push(res);
                };

                total_count = await PartnerModel.get_count(search,filter,)
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.',total_count));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },

    filter_list: async(req, res) => {
        let search = { "deleted": 0 }
        PartnerModel.selectSpecific("id,partner_id,name,email",search)
            .then(async (result) => {
                
                let send_res = [];
                for (let val of result) {
                    let res = {
                        id: await encrypt_decrypt('encrypt',val.id),
                        partner_id: val.partner_id,
                        name:val.name,
                        email:val.email
                    };
                    send_res.push(res);
                };
                res.status(statusCode.ok).send(response.successdatamsg(send_res,'List fetched successfully.'));
            })
            .catch((error) => {
                winston.error(error);
                
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    details: async(req, res) => {
        let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
        PartnerModel.selectOne("*",{ id:user_id,deleted:0 })
            .then(async (result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        id: await enc_dec.cjs_encrypt(val.id),
                        partner_id: val.partner_id,
                        name:val.name,
                        email:val.email,
                        country_code:val.code,
                        mobile_no:val.mobile,
                        company_name:val.company_name,
                        address:val.address,
                        username: await encrypt_decrypt('decrypt',val.username),
                        country:val.country?enc_dec.cjs_encrypt(val.country):'',
                        country_name:val.country?await helpers.get_country_name_by_id(val.country):'',
                        state:val.state,
                        city:val.city,
                        zipcode:val.pincode,
                        type_of_business: await enc_dec.cjs_encrypt(val.type_of_business),
                        type_of_business_name: await helpers.get_type_of_business(val.type_of_business),
                        status:(val.status==1)?"Deactivated":"Active",
                        blocked_status:(val.is_blocked==1)?"Blocked":"Active",
                    };
                    send_res = res1;
               

                res.status(statusCode.ok).send(response.successdatamsg(send_res,'Details fetched successfully.'));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
    update: async (req, res) => {
        try {
            
            let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            
            let type_of_business = await enc_dec.cjs_decrypt(req.bodyString("type_of_business"));
            userData = {
                name: req.bodyString("name"),
                email: req.bodyString("email"),
                code: req.bodyString("country_code"),
                mobile: req.bodyString("mobile_no"),
                username: await encrypt_decrypt('encrypt',req.bodyString("username")),
                company_name: req.bodyString("company_name"),
                type_of_business: type_of_business,
            };

            if(req.bodyString("password")){
                userData.password = await encrypt_decrypt('encrypt',req.bodyString("password"));
            }
            if(req.bodyString("address")){
                userData.address = req.bodyString("address");
            }
            if(req.bodyString("country_id")){
                let country = await enc_dec.cjs_decrypt(req.bodyString("country_id"));
                userData.country = country;
            }
            if(req.bodyString("state")){
                userData.state = req.bodyString("state");
            }
            if(req.bodyString("city")){
                userData.city = req.bodyString("city");
            }
            if(req.bodyString("zipcode")){
                userData.pincode = req.bodyString("zipcode");
            }

            $ins_id = await PartnerModel.updateDetails({id:user_id},userData);
            res.status(statusCode.ok).send(response.successmsg('Partner updated successfully'));
           
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

    deactivate: async (req, res) => {
        try {
            
             let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            var insdata = {
                'status':1
            };

            $ins_id = await PartnerModel.updateDetails({id:user_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record deactivated successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    activate: async (req, res) => {
        try {
            
             let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            var insdata = {
                'status':0
            };

            
            $ins_id = await PartnerModel.updateDetails({id:user_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record activated successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    delete: async (req, res) => {
        try {
            
             let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            var insdata = {
                'deleted':1
            };

            
            $ins_id = await PartnerModel.updateDetails({id:user_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record deleted successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    blocked: async (req, res) => {
        try {
            
             let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            var insdata = {
                'is_blocked':1
            };

            
            $ins_id = await PartnerModel.updateDetails({id:user_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record blocked successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    unblocked: async (req, res) => {
        try {
            
             let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
            var insdata = {
                'is_blocked':0
            };

            
            $ins_id = await PartnerModel.updateDetails({id:user_id},insdata);
            res.status(statusCode.ok).send(response.successmsg('Record unblocked successfully'));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    password: async(req, res) => {
        let user_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
        PartnerModel.selectOne("password",{ id:user_id,deleted:0 })
            .then(async (result) => {
                
              let send_res = [];
                let val = result
                    let res1 = {
                        password:await encrypt_decrypt('decrypt',val.password),
                    };
                    send_res = res1;
               

                res.status(statusCode.ok).send(response.successdatamsg(send_res,'Password fetched successfully.'));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },
}
module.exports = partner;