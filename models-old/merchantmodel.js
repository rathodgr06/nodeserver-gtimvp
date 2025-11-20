const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_merchant";
const meeting_table = config.table_prefix + "merchant_meetings";
const secdbtable = config.table_prefix + "master_merchant_key_and_secret";
const super_merchant_table = config.table_prefix + "master_super_merchant";
const merchant_details = config.table_prefix + "master_merchant_details";
const merchant_key_and_secret =
  config.table_prefix + "master_merchant_key_and_secret";
const helpers = require("../utilities/helper/general_helper");
const date_formatter = require("../utilities/date_formatter/index");
const { table } = require("console");
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  addWebhook: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(config.table_prefix + "webhook_settings", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select1: async (condition_obj, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      try {
        if (Object.keys(filter).length) {
          response = await qb.query(
            "select * from " +
            dbtable +
            " where " +
            condition +
            " and (" +
            search_text +
            ") LIMIT " +
            limit.perpage +
            limit.start
          );
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("name", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    } else {
      try {
        if (Object.keys(filter).length) {
          response = await qb.query(
            "select * from " +
            dbtable +
            " where " +
            condition +
            " and (" +
            search_text +
            ")"
          );
        } else {
          response = await qb
            .select("*")
            .where(condition)
            .order_by("name", "asc")
            .get(dbtable);
        }
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    }

    return response;
  },

  select_merchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where({
          merchant_secret: condition.secret_key,
          merchant_key: condition.api_key,
        })
        .get(secdbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select_super_merchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id")
        .where({
          id: condition.merchant_id,
        })
        .get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  temp_select_super_merchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id")
        .where({
          id: condition.merchant_id,
        })
        .get(selectsuperchechent);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (condition_obj, filter, limit) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_join_conditional_string(condition_obj);

    let select =
      "s.super_merchant_id,s.id,m.company_name,m.merchant_id,s.mobile_no";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select " +
        select +
        " from " +
        dbtable +
        " s INNER JOIN " +
        merchant_details +
        " m ON s.id=m.merchant_id where " +
        condition +
        "and m.company_name!=''"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  selectSpecific: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectOne: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectOneSupermerchent: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get("");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  selectOneSuperMerchant: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(super_merchant_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectUserDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updatePassword: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(super_merchant_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  SupermerchantupdateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(super_merchant_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  select_pricing_plan: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("feature_plan_id,transaction_plan_id")
        .where({
          id: condition.merchant_id,
        })
        .get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response?.[0];
  },

  get_count: async (condition_obj, filter) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let qb = await pool.get_connection();
    let response;
    try {
      if (Object.keys(filter).length) {
        response = await qb.query(
          "select count('id') as count from " +
          dbtable +
          " where " +
          condition +
          "and (" +
          search_text +
          ")"
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable + " where " + condition
        );
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_sub_merchant_count: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);

      response = await qb.query(
        "select count('id') as count from " +
        dbtable +
        " where super_merchant != 0 and  " +
        condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_sub_merchant_count_by_merchant: async (condition_obj, search_date) => {
    // if (!search_date){
    // }
    // else {
    //     let date_condition_str = await helpers.get_date_between_condition(search_date.from_date, search_date.to_date, "register_at");
    //     final_cond = condition_obj + " and " + date_condition_str;
    //     response = await qb.query("select count('id') as count from " + dbtable + " where   " + condition_obj + ' and ' + date_condition_str)

    // }

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as count from " +
        dbtable +
        " where   " +
        condition_obj
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  main_merchant_details: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mm.id,mm.super_merchant_id,mm.live,mm.email,md.company_name,mm.mode"
        )
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "left"
        )
        .where(condition)
        .order_by("mm.id", "asc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  sub_merchant_list: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "mm.id,mm.super_merchant_id,md.company_name,mm.email,sm.legal_business_name,sm.legal_business_name,mm.live"
        )
        .from(config.table_prefix + "master_merchant mm")
        .join(
          config.table_prefix + "master_merchant_details md",
          "mm.id=md.merchant_id",
          "left"
        )
        .join(
          config.table_prefix + "master_super_merchant sm",
          "mm.super_merchant_id=sm.id",
          "left"
        )
        .where(condition)
        .order_by("md.company_name", "asc")
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_key: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchant_key_and_secret, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_key: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("type, merchant_key, merchant_secret")
        .where(condition)
        .get(merchant_key_and_secret);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  addTempCustomer: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "customer_temp", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectCustomerDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + "customer_temp");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  addCustomer: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "customers", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateCustomerTempToken: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + "customer_temp");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  add_meeting: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(meeting_table, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update_meeting: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(meeting_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  selectMeetingOne: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(meeting_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectMeeting: async (condition, date) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .limit(10)
        .order_by("id", "desc")
        .get(meeting_table);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectMeeting_: async (condition_obj, date) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select * from " +
        meeting_table +
        " where " +
        condition +
        " and end_time >='" +
        date +
        "'"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_meetings: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let today = await date_formatter.insert_date_time();
    //   .query("select count('id') as count from "+meeting_table+" where "+ condition + " and end_time >="+ `'$
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
        meeting_table +
        " where " +
        condition +
        " and status=0  and deleted=0"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0]?.count;
  },
  selectFistSubmentchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,brand_color,accent_color,font_name")
        .where(condition)
        .from(config.table_prefix+"master_merchant")
        .order_by('id','asc')
        .limit(1)
        .get();
        console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  inheritPaymentMethod: async (primary_submerchant_id,new_sub_merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try{
      let query = `INSERT INTO pg_merchant_payment_methods(sub_merchant_id, methods, others, sequence, is_visible, mode, created_at) SELECT ${new_sub_merchant_id}, methods, others, sequence, is_visible, mode, NOW() FROM pg_merchant_payment_methods FORCE INDEX(idx_sub_merchant_id) WHERE sub_merchant_id = ${primary_submerchant_id} LOCK IN SHARE MODE`
      response = await qb.query(query);
    }catch(error){
      console.error("Database query failed:", error);
    }finally{
      qb.release();
    }
    return response;
  },
   inheritPaymentMethodDraft: async (primary_submerchant_id,new_sub_merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try{
      let query = `INSERT INTO pg_merchant_draft_payment_methods(submerchant_id, methods, others, sequence, is_visible, mode, created_at) SELECT ${new_sub_merchant_id}, methods, others, sequence, is_visible, mode, NOW() FROM pg_merchant_draft_payment_methods FORCE INDEX(idx_submerchant_id) WHERE submerchant_id = ${primary_submerchant_id} LOCK IN SHARE MODE`
      response = await qb.query(query);
      
    }catch(error){
      console.error("Database query failed:", error);
    }finally{
      qb.release();
    }
    return response;
  },
  selectMid: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mid.id as mid_id,mid.psp_id,mid.MID as mid, mid.password,mid.currency_id,mid.country_id,mid.country_name,mid.mode,mid.env,psp.name as psp_name")
        .where(condition)
        .from(config.table_prefix+"mid mid")
        .join(config.table_prefix+"psp psp",'mid.psp_id=psp.id','inner')
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  inheritMid:async(mid_id,submerchant_id,terminal_id)=>{
    let qb = await pool.get_connection();
    let response;
    try{
      response = await qb.query(`INSERT INTO pg_mid (submerchant_id,terminal_id,psp_id,cards,MID,password,currency_id,supported_currency,payment_methods,payment_schemes,transaction_allowed_daily,status,deleted,added_at,country_id,country_name,statementDescriptor,shortenedDescriptor,is3DS,allowRefunds,allowVoid,domestic,international,voidWithinTime,autoCaptureWithinTime,minTxnAmount,maxTxnAmount,failure_url,cancel_url,success_url,mode,env,class,label,v2_telr_key,priority,is_inherited,primary_key) SELECT ${submerchant_id},${terminal_id},psp_id,cards,MID,password,currency_id,supported_currency,payment_methods,payment_schemes,transaction_allowed_daily,status,deleted,added_at,country_id,country_name,statementDescriptor,shortenedDescriptor,is3DS,allowRefunds,allowVoid,domestic,international,voidWithinTime,autoCaptureWithinTime,minTxnAmount,maxTxnAmount,failure_url,cancel_url,success_url,mode,env,class,label,v2_telr_key,priority,${true},primary_key FROM pg_mid WHERE id=${mid_id}`);
      console.log(`response of inherit mid`)
      console.log(response);
      
    }catch(error){
      console.error("Database query failed:", error);
    }finally{
      qb.release();
    }
    return response;
  },
  selectAllSubMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where(condition)
        .from(config.table_prefix+"master_merchant")
        .order_by('id','asc')
        .get();
        console.log(`selecting merchant which are onboarded through API And mid inherit`)
        console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  selectOneMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id").from(dbtable).where(condition).get();
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  fetchIpList: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("ip").from(config.table_prefix+'merchants_ip_whitelist').where(condition).get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  removeOldIp: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.from(config.table_prefix+'merchants_ip_whitelist').where(condition).delete();
    } catch (error) {
      console.error("Database query failed:", error);
     
    } finally {
      qb.release();
    }
    return response;
  },
   addIpList: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
       response = await qb.insert(config.table_prefix+'merchants_ip_whitelist', data);
    } catch (error) {
      console.error("Database query failed:", error);
     
    } finally {
      qb.release();
    }
    return response;
  },
    selectOneMerchantDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(config.table_prefix+'master_merchant_details');
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
};
module.exports = dbModel;
