const EntityModel = require("../models/entityModel");
const MerchantEkycModel = require("../models/merchant_ekycModel");
const encrypt_decrypt = require('../utilities/decryptor/encrypt_decrypt');
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper")
const enc_dec = require("../utilities/decryptor/decryptor")
const admin_activity_logger =require('../utilities/activity-logger/admin_activity_logger')
const moment = require('moment');
const winston = require('../utilities/logmanager/winston');

const path = require('path');
require('dotenv').config({ path: "../.env" });
const env = process.env.ENVIRONMENT
const config = require('../config/config.json')[env];
const server_addr = process.env.SERVER_LOAD
const port = process.env.SERVER_PORT
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
var Entity = {
    add: async (req, res) => {
        
        let added_date = await date_formatter.created_date_time();
        let entity_name =  req.body.entity_type;
        let country_id = enc_dec.cjs_decrypt(req.bodyString('country_id'));
        let document = req.body.data;
        let result = await EntityModel.selectOne('id', { 'entity': entity_name,deleted:0 })
        if (result){
            res.status(statusCode.ok).send(response.AlreadyExist(entity_name));
        } else {
            let ins_body = {
                'entity': entity_name,
                'country_id': country_id,
                'user_id': req.user.id,
                'added_date': added_date,
                'ip': await helpers.get_ip(req),
            }
            EntityModel.add(ins_body).then(async (result) => {
                let resp = [];
                let document_add;
                for (i = 0; i < document.length; i++) {
                    document_add = {
                        'entity_id': result.insert_id,
                        'document_for':document[i].document_for,
                        'ekyc_required':document[i].ekyc_required,
                        'document': enc_dec.cjs_decrypt(document[i].document),
                        'required': document[i].is_required==1 ? 1 : 0,
                        'issue_date_required': document[i].issue_date_required == 1 ? 1 : 0,
                        'document_num_required': document[i].document_num_required == 1 ? 1 : 0,
                        'expiry_date_required': document[i].expiry_date_required == 1? 1 : 0,
                        'match_with_selfie': document[i].match_with_selfie == 1? 1 : 0,
                        'issuing_authority': document[i].issuing_authority== 1? 1 : 0,
                        'user_id': req.user.id,
                        'added_date': added_date,
                        'ip': await helpers.get_ip(req),
                    }
                    
                    resp.push(document_add)
                    
                }
                await EntityModel.addDocument(resp)

                let module_and_user = {
                    user:req.user.id,
                    admin_type:req.user.type,
                    module:'Merchants',
                    sub_module:'Entity type'
                }
                let added_name = req.body.entity_type;
                let headers = req.headers;
                admin_activity_logger.add(module_and_user,added_name,headers).then((result)=>{
                    res.status(statusCode.ok).send(response.successmsg('Entity added successfully.'));
                }).catch((error)=>{
                    winston.error(error);
                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                })
            }).catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
        }
    },
    list_onboard: async (req, res) => {
        
        let limit = {
            perpage: 0,
            page: 0,
        }
        if (req.bodyString('perpage') && req.bodyString('page')) {
            perpage = parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start - 1) * perpage)
        }
       
        let c_id = await enc_dec.cjs_decrypt(req.bodyString('country_id'))
        let search_obj = {}
        search_obj.deleted = 0;
        if (c_id) {
            in_country_id = c_id;
            search_obj.country_id = in_country_id;
        }
        if (req.bodyString('status')) {
          
            search_obj.status = await helpers.get_status(req.bodyString('status'));
        }
        EntityModel.select(search_obj,limit)
            .then(async (result) => {

                let send_res = [];
                var  total_count = await EntityModel.get_count(search_obj)   
                 
                for (let val of result){
                    let res = {
                        entity: val.entity,
                        entity_id: enc_dec.cjs_encrypt(val.id),
                        country_id: await enc_dec.cjs_encrypt(val.country_id),
                    };
                    send_res.push(res);
                }
         
                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'List fetched successfully.', total_count));
            })
        
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
        
    },
    list: async (req, res) => {
        
        let limit = {
            perpage: 0,
            page: 0,
        }
        if (req.bodyString('perpage') && req.bodyString('page')) {
            perpage = parseInt(req.bodyString('perpage'))
            start = parseInt(req.bodyString('page'))

            limit.perpage = perpage
            limit.start = ((start - 1) * perpage)
        }
        
        let c_id = await enc_dec.cjs_decrypt(req.bodyString('country_id'))
        const country = await helpers.get_country_id_by_name(req.bodyString('country_name'));
        const country1 = await helpers.get_country_name_by_id(c_id);
        let search_obj = {}
        search_obj.deleted = 0;
        if (c_id) {
            in_country_id = c_id;
            search_obj.country_id = in_country_id;
        }
        if (req.bodyString('status')) {
          
            search_obj.status = await helpers.get_status(req.bodyString('status'));
        }
        EntityModel.select(search_obj,limit)
            .then(async (result) => {

                let send_res = [];
                for (let val of result){
                    let list_of_document = []

                    let list = await EntityModel.list_of_document({ entity_id: val.id,deleted:0 });
                  
                    for (let element of list) {
                         list_of_document.push({
                            "id": enc_dec.cjs_encrypt(element.id),
                            "document_for": element.document_for,
                            "document_id":  enc_dec.cjs_encrypt(element.document),
                            "document": element.document?await helpers.get_document_type(element.document):"",
                            // "document": "document_"+element.document,
                            "is_required":element.required?1:0,
                            "issue_date_required": element.issue_date_required, 
                            "expiry_date_required":element.expiry_date_required?1:0,
                            "match_with_selfie":element.match_with_selfie?1:0,
                            'issuing_authority': element.issuing_authority?1:0,
                        });
                    }

                    let res = {
                        entity: val.entity,
                        last_updated_date:val.updated_at!=null? await date_formatter.get_date_time(val.updated_at):'-',
                        entity_id: enc_dec.cjs_encrypt(val.id),
                        country_id: await enc_dec.cjs_encrypt(val.country_id),
                        country:await helpers.get_country_name_by_id(val.country_id),
                        status: (val.status == 1) ? "Deactivated" : "Active",
                        document:  list_of_document,
                    };
                    send_res.push(res);
                }

 

                total_count = await EntityModel.get_count(search_obj)

 

                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'List fetched successfully.', total_count));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
        
    },
    details: async (req, res) => {
      
        let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_id"));
        let submerchant_id = enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
     
        let list_of_document = []
        search_obj={deleted :0,
        entity_id: entity_id
        }
        search_obj_={deleted :0,
            entity_id: entity_id
            }
        let document_for = req.bodyString("document_for");
        let document_for_ = `'${req.bodyString("document_for")}'`;
        if (document_for) {
            
            search_obj.document_for = document_for;
            
        }
        if (req.bodyString("status")) {
            search_obj.status = req.bodyString("status");
            search_obj_.status = req.bodyString("status");
        }
   
        let list = await EntityModel.list_of_document(search_obj);
        let count = await EntityModel.get_count_document(search_obj_);
        if(document_for=="representative" || document_for=="owner_individual" || document_for=="executive" ){
            search_obj_.document_for = document_for_;
            var count_selfie = await EntityModel.getSelfieDocs(search_obj_);
        }
        
        let group_document_list = {};

        for (let element of list) {
            let document_type = await EntityModel.list_of_document_type({id:element.document,deleted:0});
            let group_required = await helpers.get_document_group_required(element.document);
            let document_type_name = element.document?await helpers.get_document_type(element.document):"";
            let obj_list = {
                "id": enc_dec.cjs_encrypt(element.id),
                "id_":element.id,
                "sequence": element.document,
                "document_for":element.document_for,
              
                "document_ids":  enc_dec.cjs_encrypt(element.document),
                "document_required":  await helpers.getDocumentRequired(element.document),
                "document": document_type_name,
                "group_required": group_required,
                "is_required":element.required?1:0,
                
                "document_num_required": element.document_num_required == 1 ? 1 : 0,
                "issue_date_required": element.issue_date_required == 1 ? 1 : 0,
                "expiry_date_required":element.expiry_date_required?1:0,
                "match_with_selfie":element.match_with_selfie?1:0,
                'issuing_authority': element.issuing_authority== 1? 1 : 0,
                'count': count,
                "selfie_doc": count_selfie?enc_dec.cjs_encrypt(count_selfie):'',
            }

            if(group_required){
                if(!group_document_list[group_required]){
                    group_document_list[group_required] = [];
                }
                group_document_list[group_required].push(document_type_name)
            }

            
            for (let val of document_type) {
                obj_list['document_selected']=(element.document==val.id)?"checked":"";
           }
           let entity_document = await MerchantEkycModel.selectDynamic("*",{merchant_id:submerchant_id,entity_id:element.entity_id,document_for:document_for,document_id:element.id,deleted:0},config.table_prefix+'merchant_entity_document');
            if(entity_document[0]) {
                let val = entity_document[0]
                let seq =  val.sequence
                obj_list.entity_type= encrypt_decrypt('encrypt',val.entity_id)
                obj_list['data_id'] = encrypt_decrypt('encrypt', val.id)
                obj_list['document_id'] = encrypt_decrypt('encrypt', val.document_id)
                obj_list['document_number'] =  val.document_num?val.document_num:""
                obj_list['document_issue_date'] = val.issue_date?await date_formatter.get_date(val.issue_date)  :""
                obj_list['document_expiry_date'] = val.expiry_date?await date_formatter.get_date(val.expiry_date):""
                obj_list['document_file'] = val.document_name?server_addr+"/static/files/"+val.document_name:"",
                obj_list['document_file_back'] = val.document_name?server_addr+"/static/files/"+val.document_name_back:"",
                obj_list['document_file_name'] = val.document_name?val.document_name:"",
                obj_list['document_file_back_name'] = val.document_name?val.document_name_back:""
                
            }else{
                obj_list.entity_type= ''
                obj_list['data_id'] = ''
                obj_list['document_id'] = ''
                obj_list['document_number'] =  ""
                obj_list['document_issue_date'] = ""
                obj_list['document_expiry_date'] = ""
                obj_list['document_file'] = ""
                obj_list['document_file_back']=""
                obj_list['document_file_name'] = ""
                obj_list['document_file_back_name'] = ""
            }
            list_of_document.push(obj_list);
        }
        
        EntityModel.selectOne("*", { id: entity_id,deleted: 0 })
            .then(async(result) => {
          
                let send_res = [];
                let res1 = {
                    entity_id: enc_dec.cjs_encrypt(result.id),
                    country_id: enc_dec.cjs_encrypt(result.country_id),
                    country_name:await helpers.get_country_name_by_id(result.country_id),
                    country_code:await helpers.get_country_code_by_id(result.country_id),
                    last_updated_date:await date_formatter.get_date_time(result.updated_at),
                    entity: result.entity,
                    "ekyc_required_rep":await EntityModel.ekycRequired('ekyc_required',{document_for:'representative',entity_id: entity_id,deleted:0,status:0}),
                    "ekyc_required_owner":await EntityModel.ekycRequired('ekyc_required',{document_for:'owner_individual',entity_id: entity_id,deleted:0,status:0}),
                    "ekyc_required_exe":await EntityModel.ekycRequired('ekyc_required',{document_for:'executive',entity_id: entity_id,deleted:0,status:0}),
                //    document_id_selfies:selfiedocs,
                    status: result.status ? "Deactivated" : "Active",
                    document: list_of_document,
                    group_document_list:group_document_list,
                   
                };
                send_res = res1;
                res.status(statusCode.ok).send(response.successdatamsg(send_res, 'Details fetched successfully.'));
            })
            .catch((error) => {
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            });
    },

    update: async (req, res) => {
        try {
            

            let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_id"));
            let entity = req.bodyString("entity_type");
            let country_id = enc_dec.cjs_decrypt(req.bodyString('country_id'));
            let document = req.body.data;
            let added_date = await date_formatter.created_date_time();
            let result = await EntityModel.selectOne('id', { 'entity': entity,deleted:0, 'id !=':entity_id })
            if (result){
                res.status(statusCode.ok).send(response.AlreadyExist(entity));
            } else {
                var insdata = {
                    'entity': entity,
                    'country_id': country_id,
                    'updated_at': added_date
                };
              
                await EntityModel.updateDetails({ id: entity_id }, insdata);
                await EntityModel.update_document({ entity_id: entity_id }, { deleted: 1 });
                
                    let resp = [];
                    let document_add;
                    for (i = 0; i < document.length; i++) {
                        document_add = {
                            'entity_id': entity_id,
                            'document_for':document[i].document_for,
                            'ekyc_required':document[i].ekyc_required,
                            'document': enc_dec.cjs_decrypt(document[i].document),
                            'required': document[i].is_required==1 ? 1 : 0,
                            'issue_date_required': document[i].issue_date_required == 1 ? 1 : 0,
                            'document_num_required': document[i].document_num_required == 1 ? 1 : 0,
                            'expiry_date_required': document[i].expiry_date_required == 1? 1 : 0,
                            'match_with_selfie': document[i].match_with_selfie == 1? 1 : 0,
                            'issuing_authority': document[i].issuing_authority== 1 ? 1 : 0,
                            'user_id': req.user.id,
                            'added_date': added_date,
                            'ip': await helpers.get_ip(req),
                        }
                        
                        resp.push(document_add)
                        
                    }
                    await EntityModel.addDocument(resp)

                    let module_and_user = {
                        user:req.user.id,
                        admin_type:req.user.type,
                        module:'Merchants',
                        sub_module:'Entity type'
                    }
                    let headers = req.headers;
                    admin_activity_logger.edit(module_and_user,entity_id,headers).then((result)=>{
                        res.status(statusCode.ok).send(response.successmsg('Entity type updated successfully'));
                    }).catch((error)=>{
                        winston.error(error);
                        res.status(statusCode.internalError).send(response.errormsg(error.message));
                    })
                

                if(document_add[0]){
                    EntityModel.addDocument(document_add)
                }
            }
        } catch(error) {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

 
    deactivate: async (req, res) => {
        try {
            let added_date = await date_formatter.created_date_time();
            let entity_id = await enc_dec.cjs_decrypt(req.bodyString("entity_id"));
            var insdata = {
                'status': 1,
                'updated_at': added_date
            };
            $ins_id = await EntityModel.updateDetails({ id: entity_id }, insdata);
            $ins_doc = await EntityModel.update_document({ entity_id: entity_id }, {'status': 0})
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'Entity type'
            }
            let headers = req.headers;
            admin_activity_logger.deactivate(module_and_user,entity_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Entity type deactivated successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error)  {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    activate: async (req, res) => {
        try {
            let added_date = await date_formatter.created_date_time();
            let entity_id = await enc_dec.cjs_decrypt(req.bodyString("entity_id"));
            var insdata = {
                'status': 0,
                'updated_at': added_date
            };
            
            $ins_id = await EntityModel.updateDetails({ id: entity_id }, insdata);
            $ins_doc = await EntityModel.update_document({ entity_id: entity_id }, {'status': 0})
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'Entity type'
            }
            let headers = req.headers;
            admin_activity_logger.activate(module_and_user,entity_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Entity type activated successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error)  {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },
    delete: async (req, res) => {
        try {
            let entity_id = await enc_dec.cjs_decrypt(req.bodyString("entity_id"));
            var insdata = {
                'deleted': 1
            };
            $ins_id = await EntityModel.updateDetails({ id: entity_id }, insdata);
            $ins_doc = await EntityModel.update_document({ entity_id: entity_id }, {'status': 0})
            let module_and_user = {
                user:req.user.id,
                admin_type:req.user.type,
                module:'Merchants',
                sub_module:'Entity type'
            }
            let headers = req.headers;
            admin_activity_logger.delete(module_and_user,entity_id,headers).then((result)=>{
                res.status(statusCode.ok).send(response.successmsg('Entity type deleted successfully'));
            }).catch((error)=>{
                winston.error(error);
                res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
        } catch(error)  {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error.message));
        }
    },

}

module.exports = Entity;