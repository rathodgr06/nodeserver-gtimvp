const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const db_table = config.table_prefix + "master_merchant";
const super_merchant_table = config.table_prefix + "master_super_merchant";
const merchantDetailTable = config.table_prefix + "master_merchant_details";
const merchantPSPStatus = config.table_prefix + "merchant_psp_status";
const merchant_key_and_secret =
  config.table_prefix + "master_merchant_key_and_secret";
const businessOwnerTable = config.table_prefix + "merchant_business_owners";
const executiveTable = config.table_prefix + "merchant_business_executives";
const merchantDocTable = config.table_prefix + "merchant_entity_document";
const merchantPSPOnboard = config.table_prefix + "merchant_psp_onboard";
const doctable = config.table_prefix + "master_entity_document";
const helpers = require("../utilities/helper/general_helper");
const currency = require("../controller/currency");
var MerchantEkycModel = {
  select: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  select_first: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "asc")
        .get(db_table);
        console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  select_super_merchant: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(super_merchant_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectMcc: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,mcc_category")
        .where({ deleted: 0, status: 0 })
        .get(config.table_prefix + "master_mcc_category");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  fetchChild: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("`id`, `mcc`, `description`,")
        .from(config.table_prefix + "mcc_codes")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectPspByMcc: async (mcc_code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query =
        "SELECT id,name,status,ekyc_required,files,threshold_value FROM " +
        config.table_prefix +
        'psp WHERE FIND_IN_SET("' +
        mcc_code +
        '",mcc) AND status=0 AND deleted=0';
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  merchantDetais: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,account_id")
        .from(config.table_prefix + "master_merchant_details")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  insertMerchantDetails: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchantDetailTable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  insertPspStatus: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchantPSPStatus, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  insertPspOnboard: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchantPSPOnboard, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  updateMerchantDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(merchantDetailTable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  update: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(super_merchant_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  updateDynamic: async (condition, data, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addBusinessOwner: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(businessOwnerTable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectBusiness: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(businessOwnerTable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addExecutive: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(executiveTable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamic: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamicDocument: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "asc")
        .group_by("document_for")
        .get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectDynamicOwnerData: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectDynamicSingle: async (selection, condition, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectMerchantDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(merchantDetailTable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectFullProfileModified: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mm.`id`,mm.super_merchant_id,sm.name,sm.mobile_no,sm.code,sm.email,mm.referral_code,mm.`ekyc_done`,mm.`video_kyc_done`,mm.`onboarding_done`,mm.`ekyc_required`,mm.`main_step`,mm.live,mm.`password`,md.`register_business_country`, md.`type_of_business`, md.`is_business_register_in_free_zone`, md.`company_name`, md.`company_registration_number`, md.`vat_number`, md.`doing_business_as`, md.`register_business_address_country`, md.`address_line1`, md.`address_line2`, md.`province`, md.`business_phone_code`, md.`business_phone_number`, md.`mcc_codes`, md.`psp_id`, md.`business_website`, md.`product_description`, md.`legal_person_first_name`, md.`legal_person_last_name`, md.`legal_person_email`, md.`job_title`, md.`rep_expiry_date`, md.`nationality`, md.`dob`, md.`home_address_country`, md.`home_address_line_1`, md.`home_address_line_2`, md.`home_province`, md.`home_phone_code`, md.`home_phone_number`, md.`personal_id_number`, md.`statement_descriptor`, md.`shortened_descriptor`, md.`customer_support_phone_code`, md.`customer_support_phone_number`, md.`iban`, md.`name_on_the_bank_account`, md.`bank_name`,md.`branch_name`, md.`country`, md.`city`, md.`state`,md.`zip_code`, md.`bic_swift`, md.`bank_account_no`, md.`address`,md.`currency`, md.`poc_name`, md.`poc_email`, md.`poc_mobile_code`,md.`poc_mobile`,md.`cro_name`,md.`cro_email`,md.`cro_mobile_code`,md.`cro_mobile`,md.`co_name`, md.`co_email`,md.`co_mobile_code`,md.`co_mobile`,md.`link_tc`,md.`link_pp`,md.`link_refund`,md.`link_cancellation`,md.`link_delivery_policy`,md.`last_updated`,c1.country_name as register_business_country_name,c2.country_name as register_business_address_country_name,c3.country_name as legal_person_home_address_country_name,et.entity as type_of_business_name,mc.description as mcc_codes_name,p.name as psp_name,s1.state_name as province_name,s2.state_name as legal_person_home_province_name,md.monthly_business_volume,md.currency_volume"
        )
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_super_merchant sm",
          "sm.id=mm.super_merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "country c1",
          "md.register_business_country=c1.id",
          "left"
        )
        .join(
          config.table_prefix + "country c2",
          "md.register_business_country=c2.id",
          "left"
        )
        .join(
          config.table_prefix + "country c3",
          "md.register_business_country=c3.id",
          "left"
        )
        .join(
          config.table_prefix + "master_entity_type et",
          "md.type_of_business=et.id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mc",
          "md.mcc_codes=mc.id",
          "left"
        )
        .join(config.table_prefix + "psp p", "md.psp_id=p.id", "left")
        .join(config.table_prefix + "states s1", "md.province=s1.id", "left")
        .join(
          config.table_prefix + "states s2",
          "md.home_province=s2.id",
          "left"
        )
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectFullProfile: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mm.`id`,mm.email as memail,sm.name,sm.legal_business_name,sm.mobile_no,sm.code,sm.legal_business_name as super_business_name,sm.registered_business_address as business_address,sm.email,mm.referral_code,mm.`ekyc_done`,mm.`video_kyc_done`,mm.`onboarding_done`,mm.`ekyc_required`,mm.`main_step`,mm.live,md.`register_business_country`, md.`type_of_business`, md.`is_business_register_in_free_zone`, md.`company_name`, md.`company_registration_number`, md.`vat_number`, md.`doing_business_as`, md.`register_business_address_country`, md.`address_line1`, md.`address_line2`, md.`province`, md.`business_phone_code`, md.`business_phone_number`, md.`mcc_codes`, md.`psp_id`, md.`business_website`, md.`product_description`, md.`legal_person_first_name`, md.`legal_person_last_name`, md.`legal_person_email`, md.`job_title`, md.`rep_expiry_date`, md.`nationality`, md.`dob`, md.`home_address_country`, md.`home_address_line_1`, md.`home_address_line_2`, md.`home_province`, md.`home_phone_code`, md.`home_phone_number`, md.`personal_id_number`, md.`statement_descriptor`, md.`shortened_descriptor`, md.`customer_support_phone_code`, md.`customer_support_phone_number`, md.`iban`, md.`name_on_the_bank_account`, md.`bank_name`,md.`branch_name`, md.`country`, md.`city`, md.`state`,md.`zip_code`, md.`bic_swift`, md.`bank_account_no`, md.`address`,md.`currency`, md.`poc_name`, md.`poc_email`, md.`poc_mobile_code`,md.`poc_mobile`,md.`cro_name`,md.`cro_email`,md.`cro_mobile_code`,md.`cro_mobile`,md.`co_name`, md.`co_email`,md.`co_mobile_code`,md.`co_mobile`,md.`link_tc`,md.`link_pp`,md.`link_refund`,md.`monthly_transaction_volume`,md.`currency_volume`,md.`link_cancellation`,md.`link_delivery_policy`,md.`link_success_url`,md.`link_failed_url`,md.`link_cancelled_url`,md.`last_updated`,c1.country_name as register_business_country_name,c2.country_name as register_business_address_country_name,c3.country_name as legal_person_home_address_country_name,et.entity as type_of_business_name,mc.description as mcc_codes_name,p.name as psp_name,s1.state_name as province_name,s2.state_name as legal_person_home_province_name,md.monthly_business_volume,md.bank_document_name,md.bank_document_file,sm.register_at as super_register,mm.referral_code_used,md.msisdn_country,md.msisdn,md.account_id"
        )
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_super_merchant sm",
          "sm.id=mm.super_merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "country c1",
          "md.register_business_country=c1.id",
          "left"
        )
        .join(
          config.table_prefix + "country c2",
          "md.register_business_country=c2.id",
          "left"
        )
        .join(
          config.table_prefix + "country c3",
          "md.register_business_country=c3.id",
          "left"
        )
        .join(
          config.table_prefix + "master_entity_type et",
          "md.type_of_business=et.id",
          "left"
        )
        .join(
          config.table_prefix + "mcc_codes mc",
          "md.mcc_codes=mc.id",
          "left"
        )
        .join(config.table_prefix + "psp p", "md.psp_id=p.id", "left")
        .join(config.table_prefix + "states s1", "md.province=s1.id", "left")
        .join(
          config.table_prefix + "states s2",
          "md.home_province=s2.id",
          "left"
        )
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateMerchantDocs: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(merchantDocTable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addMerchantDocs: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchantDocTable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addDynamic: async (data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getSelfieDocsRep: async (merchant_id, document_for, owner_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "me.id as master_entity_id,me.ekyc_required,med.document_name,med.sequence,med.id,med.entity_id,med.merchant_id,med.document_id,med.document_num"
        )
        .from(config.table_prefix + "merchant_entity_document med")
        .join(
          config.table_prefix + "master_entity_document me",
          "me.id = med.document_id",
          "inner"
        )
        .where({
          "med.merchant_id": merchant_id,
          "med.document_for": document_for,
          "med.owners_id": owner_id,
          "me.match_with_selfie": 1,
          "me.deleted": 0,
          "me.status": 0,
          "med.deleted": 0,
        })
        .order_by("med.id", "desc")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return [];
    }
  },
  getSelfieDocs: async (merchant_id, document_for, owner_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "me.id as master_entity_id,med.document_name,med.sequence,med.id,med.entity_id,med.merchant_id,med.document_id,med.document_num"
        )
        .from(config.table_prefix + "master_entity_document me")
        .join(
          config.table_prefix + "merchant_entity_document med",
          "me.id = med.document_id",
          "inner"
        )
        .where({
          "med.merchant_id": merchant_id,
          "med.owners_id": owner_id,
          "med.document_for": document_for,
          "me.match_with_selfie": 1,
          "me.deleted": 0,
          "me.status": 0,
          "med.deleted": 0,
        })
        .order_by("med.id", "desc")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return [];
    }
  },
  getSelfieDocsEkyc: async (merchant_id, owner_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "me.id as master_entity_id,med.document_name,med.sequence,med.id,med.entity_id,med.merchant_id,med.document_id,med.document_num"
        )
        .from(config.table_prefix + "master_entity_document me")
        .join(
          config.table_prefix + "merchant_entity_document med",
          "me.id = med.document_id",
          "inner"
        )
        .where({
          "med.merchant_id": merchant_id,
          "med.owners_id": owner_id,
          "me.match_with_selfie": 1,
          "me.deleted": 0,
          "me.status": 0,
          "med.deleted": 0,
        })
        .order_by("med.id", "desc")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0];
    } else {
      return [];
    }
  },
  selectKeyData: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = qb
        .where({ "s.id": condition, "s.deleted": 0 })
        .select(
          "m.id,m.type,m.merchant_id,m.merchant_key,m.merchant_secret,m.created_at"
        )
        .from(db_table + " s")
        .join(merchant_key_and_secret + " m", "s.id=m.merchant_id")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectAll: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "desc")
        .get(super_merchant_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  master_super_merchant: async (condition_obj, filter, limit) => {
    let response;
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    if (limit.perpage) {
      if (Object.keys(filter).length) {
        let qb = await pool.get_connection();
        try {
          response = await qb.query(
            "select * from " +
              super_merchant_table +
              " where " +
              condition +
              " and (" +
              search_text +
              ") order by id desc LIMIT " +
              limit.perpage +
              limit.start
          );
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        let qb = await pool.get_connection();
        try {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("id", "desc")
            .limit(limit.perpage, limit.start)
            .get(super_merchant_table);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    } else {
      if (Object.keys(filter).length) {
        let qb = await pool.get_connection();
        try {
          response = await qb.query(
            "select * from " +
              super_merchant_table +
              " where " +
              condition +
              " and (" +
              search_text +
              ")" +
              " order by id desc"
          );
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        let qb = await pool.get_connection();
        try {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("id", "desc")
            .get(super_merchant_table);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    }

    return response;
  },
  get_count: async (condition_obj, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + table_name + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.count;
  },
  get_count_for_rep: async (condition_obj, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " +
          table_name +
          " where " +
          condition +
          " and (ekyc_done=1 or ekyc_done=4) "
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.count;
  },
  removeEntityDoc: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(merchantDocTable, condition);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  ekycRequired: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)

        .order_by("id", "desc")
        .limit("1")
        .get(doctable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.ekyc_required ? response?.[0]?.ekyc_required : "";
  },
  select_first_super_merchant: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id", "asc")
        .get(db_table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.id;
  },
  get_count_super_merchant: async (condition_obj, filter, table_name) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let response;
    let qb = await pool.get_connection();
    try {
      if (Object.keys(filter).length) {
        response = await qb.query(
          "select count('id') as count from " +
            table_name +
            " where " +
            condition +
            " and (" +
            search_text +
            ")"
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " +
            table_name +
            " where " +
            condition
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.count;
  },
  get_count_referrer: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as count from " +
          config.table_prefix +
          "referrers" +
          " where " +
          condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.count;
  },
  fetchMerchantDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "master_merchant_details")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  fetchAllMerchantDetails: async (conditions) => {
    let response;
    const page = parseInt(conditions.page) || 1;
    const limit = parseInt(conditions.per_page) || 50;
    const offset = (page - 1) * limit;

    let qb;

    try {
      qb = await pool.get_connection();
      let strQuery = `SELECT acc.id, acc.type, acc.account_id, acc.account_type,acc.account_for, acc.payer_id, acc.country, acc.currency, acc.beneficiary_id as receiver_id, acc.submerchant_id as merchant_id, acc.account_details, acc.status, acc.bank_verified, acc.deleted, acc.created_at,acc.updated_at, super_merchant.legal_business_name AS supermerchant_legal_name, sub_merchant_details.company_name FROM pg_merchant_accounts acc LEFT JOIN pg_master_merchant sub_merchant ON acc.submerchant_id = sub_merchant.id LEFT JOIN pg_master_super_merchant super_merchant ON sub_merchant.super_merchant_id = super_merchant.id LEFT JOIN pg_master_merchant_details sub_merchant_details ON sub_merchant.id = sub_merchant_details.merchant_id WHERE acc.deleted = 0`;

      if (conditions.submerchant_id) {
        strQuery = strQuery + ` AND submerchant_id = ${conditions.submerchant_id} `;
      }

      strQuery = strQuery + ` ORDER BY acc.id DESC LIMIT ${limit} OFFSET ${offset}`;

      var rows = await qb.query(strQuery);
      console.log("🚀 ~ fetchAllMerchantDetails: ~ strQuery:", strQuery);
      const parsedRows = rows.map((row) => {
        /*let parsedFundingDetails;
        try {
          parsedFundingDetails = JSON.parse(row.funding_details);
        } catch (err) {
          console.error("Invalid JSON in funding_details:", err);
          parsedFundingDetails = null;
        } */

        return {
          ...row
          // funding_details: parsedFundingDetails,
        };
      });
      // console.log("🚀 ~ fetchAllMerchantDetails: ~ rows:", parsedRows);

      qb.release(); // release after query 1
      qb = await pool.get_connection(); // new connection for count query

      let countQuery = `SELECT COUNT(*) AS total FROM pg_merchant_accounts WHERE deleted=0`;

      if (conditions.submerchant_id) {
        countQuery = countQuery + ` AND submerchant_id = ${conditions.submerchant_id} `;
      }

      // 2. Total count query
      const [countResult] = await qb.query(countQuery);

      const totalRecords = countResult?.total || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      response = {
        rows: parsedRows,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
        },
      };
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      response = {
        error: true,
        message: "Database query failed",
        details: error.message,
      };
    } finally {
      if (qb) qb.release();
    }

    return response;
  },
  storeFundingDetails: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert("pg_merchant_accounts", data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  fetchMerchantAccounts: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      //  await qb
      //   .select("id, type, account_id, account_type, payer_id, country, currency, beneficiary_id as receiver_id, submerchant_id, account_details, status, bank_verified, deleted, created_at,updated_at")
      //   .from(config.table_prefix + "merchant_accounts")
      //   if(condition.submerchant_id){
      //     qb.where({submerchant_id:condition.submerchant_id});
      //   }
      //   if(condition.beneficiary_id){
      //     qb.where({beneficiary_id:condition.beneficiary_id});
      //   }
      //   if(condition.currency){
      //     qb.where({currency:condition.currency});
      //   }
      //   qb.order_by('id','desc')
      //   response = qb.get();


      if (!condition.submerchant_id) {
        condition.submerchant_id = 0;
      }

      if (!condition.beneficiary_id) {
        condition.beneficiary_id = 0;
      }

      if (!condition.currency) {
        condition.currency = 0;
      }

      let query = '';
      if (condition.submerchant_id != 0 && condition.beneficiary_id != 0 && condition.currency != 0) {
        query = `
        SELECT 
          id, type, account_id, account_type, payer_id, country, currency,
          beneficiary_id AS receiver_id, submerchant_id, account_details,
          status, bank_verified, deleted, created_at, updated_at
        FROM pg_merchant_accounts
        WHERE 
        (submerchant_id != 0 AND submerchant_id = ${condition.submerchant_id} AND currency = '${condition.currency}')
          OR 
        (beneficiary_id != 0 AND beneficiary_id = '${condition.beneficiary_id}' AND currency = '${condition.currency}')
        ORDER BY id DESC
      `;
      } else if (condition.submerchant_id != 0 && condition.currency != 0) {
        query = `
        SELECT 
          id, type, account_id, account_type, payer_id, country, currency,
          beneficiary_id AS receiver_id, submerchant_id, account_details,
          status, bank_verified, deleted, created_at, updated_at
        FROM pg_merchant_accounts
        WHERE submerchant_id = ${condition.submerchant_id} AND currency = '${condition.currency}'
        ORDER BY id DESC
      `;
      } else if (condition.beneficiary_id != 0 && condition.currency != 0) {
        query = `
        SELECT 
          id, type, account_id, account_type, payer_id, country, currency,
          beneficiary_id AS receiver_id, submerchant_id, account_details,
          status, bank_verified, deleted, created_at, updated_at
        FROM pg_merchant_accounts
        WHERE beneficiary_id = '${condition.beneficiary_id}' AND currency = '${condition.currency}'
        ORDER BY id DESC
      `;
      } else if (condition.submerchant_id != 0) {
        query = `
        SELECT 
          id, type, account_id, account_type, payer_id, country, currency,
          beneficiary_id AS receiver_id, submerchant_id, account_details,
          status, bank_verified, deleted, created_at, updated_at
        FROM pg_merchant_accounts
        WHERE submerchant_id = ${condition.submerchant_id}
        ORDER BY id DESC
      `;
      } else if (condition.beneficiary_id != 0) {
        query = `
        SELECT 
          id, type, account_id, account_type, payer_id, country, currency,
          beneficiary_id AS receiver_id, submerchant_id, account_details,
          status, bank_verified, deleted, created_at, updated_at
        FROM pg_merchant_accounts
        WHERE beneficiary_id = ${condition.beneficiary_id}
        ORDER BY id DESC
      `;
      }
      
      response = await qb.query(query);
      console.log("🚀 ~ qb query:", query);

    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  fetchSingleMerchantAccounts: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      // let query = `SELECT * FROM pg_merchant_accounts WHERE (submerchant_id = '${condition.submerchant_id}' AND currency = '${condition.currency}' AND deleted = 0) OR (account_id='${condition.account_id}' AND deleted = 0);`;
      // response = await qb.query(query)
      let query = ``;
      if (condition.submerchant_id && condition.currency) {
        query = `SELECT * FROM pg_merchant_accounts WHERE submerchant_id = '${condition.submerchant_id}' AND currency = '${condition.currency}' AND deleted = 0;`;
      }else if (condition.receiver_id && condition.currency) {
        query = `SELECT * FROM pg_merchant_accounts WHERE beneficiary_id = '${condition.receiver_id}' AND currency = '${condition.currency}' AND deleted = 0;`;
      }else if (condition.account_id) {
        query = `SELECT * FROM pg_merchant_accounts WHERE account_id='${condition.account_id}' AND deleted = 0;`;
      }
      
      response = await qb.query(query)
      console.log("query....", qb.last_query())
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateFundingDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
       response = await qb
        .set(data)
        .where(condition)
        .update("pg_merchant_accounts");
        console.log(qb.last_query());
    } catch (error) {
      console.error("Database update failed:", error);
    } finally {
      qb.release();
    }
    return response;
  }

};
module.exports = MerchantEkycModel;
