const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_merchant";
const merchant_details = config.table_prefix + "master_merchant_details";
const merchant_psp = config.table_prefix + "merchant_psp_status";
const merchant_onboard = config.table_prefix + "merchant_psp_onboard";
const merchant_key_and_secret =
  config.table_prefix + "master_merchant_key_and_secret";
const mid_dbtable = config.table_prefix + "mid";
const helpers = require("../utilities/helper/general_helper");
const super_merchant_table = config.table_prefix + "master_super_merchant";
const meeting_table = config.table_prefix + "merchant_meetings";
var dbModel = {
  add: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  create: async (data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert_batch(config.table_prefix + table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  update: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  delete_payment_method: async (table, condition) => {
    let qb = await pool.get_connection();
    try {
      await qb.delete(config.table_prefix + table, condition);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
  },
  select_list: async (condition, limit, table) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "desc")
        .limit(limit.perpage)
        .offset(limit.start)
        .get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_mid: async (table, condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      let final_cond = " where ";
      if (Object.keys(condition).length) {
        let condition_str = await helpers.get_and_conditional_string(condition);
        final_cond = final_cond + condition_str;
      }
      if (final_cond == " where ") {
        final_cond = "";
      }

      let query =
        "select count(*) as total from " +
        config.table_prefix +
        table +
        final_cond;

      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.total;
  },

  add_key: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchant_key_and_secret, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_merchant_details: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(merchant_details, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  add_mid: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(mid_dbtable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  update_mid: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(mid_dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  update_qr: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + "merchant_qr_codes");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  delete_mid: async (data_id, submerchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "delete from " + mid_dbtable + " where id=" + data_id
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectOneMID: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(mid_dbtable);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectdata: async (condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = qb
        .where({ "s.id": condition, "s.deleted": 0, "m.deleted": 0 })
        .select(
          "m.id,m.submerchant_id,m.currency_id,m.psp_id,m.MID,m.payment_methods,m.payment_schemes,m.transaction_allowed_daily"
        )
        .from(dbtable + " s")
        .join(mid_dbtable + " m", "s.id=m.submerchant_id")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
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
        .from(dbtable + " s")
        .join(merchant_key_and_secret + " m", "s.id=m.merchant_id")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  checkLiveKeyExits: async (condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "master_merchant_key_and_secret")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response.length > 0 ? response?.[0] : null;
  },

  select: async (condition_obj, filter, limit, condition_obj2) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_and_conditional_string(condition_obj);
    let condition2 = await helpers.get_and_conditional_string_in(
      condition_obj2
    );

    let select =
      "s.super_merchant_id,s.id,m.id as rep_id,s.ekyc_done,s.email,m.legal_person_first_name,m.legal_person_last_name,s.onboarding_done,s.ekyc_required,s.psp_mail_send,s.status,s.live,m.register_business_country,m.type_of_business,m.company_name,m.business_phone_number,m.legal_person_email,m.company_registration_number,m.merchant_id,m.currency,m.last_updated as last_updated";
    let response;
    let qb = await pool.get_connection();
    if (limit.perpage) {
      if (Object.keys(filter).length) {
        try {
          if (Object.keys(condition_obj2).length) {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON s.id=m.merchant_id where " +
              condition +
              " and " +
              condition2 +
              " and (" +
              search_text +
              ")  order by s.id desc LIMIT " +
              limit.start +
              "," +
              limit.perpage
            );
             console.log(qb.last_query());
          } else {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON s.id=m.merchant_id where " +
              condition +
              " and (" +
              search_text +
              ")  order by s.id desc LIMIT " +
              limit.start +
              "," +
              limit.perpage
            );
            console.log(qb.last_query());
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          if (Object.keys(condition_obj2).length) {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON s.id=m.merchant_id where " +
              condition +
              " and " +
              condition2 +
              "order by s.id desc LIMIT " +
              limit.start +
              "," +
              limit.perpage
            );
             console.log(qb.last_query());
          } else {
            response = qb
              .where(condition)
              .select(select)
              .from(dbtable + " s")
              .join(merchant_details + " m", "s.id=m.merchant_id","inner")
              .order_by("s.id", "desc")
               .limit(limit.perpage, limit.start)
              .get();
              console.log(qb.last_query());
          }
        } catch (error) {
          console.log(error);
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    } else {
      console.log(`${Object.keys(filter).length} in the else`);
      if (Object.keys(filter).length) {
        try {
          if (Object.keys(condition_obj2).length) {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON  s.id=m.merchant_id where " +
              condition +
              " and " +
              condition2 +
              " and (" +
              search_text +
              ") order by s.id desc"
            );
          } else {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON  s.id=m.merchant_id where " +
              condition +
              " and (" +
              search_text +
              ") order by s.id desc"
            );
          }
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          if (Object.keys(condition_obj2).length) {
            response = await qb.query(
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON  s.id=m.merchant_id where " +
              condition +
              " and " +
              condition2 +
              "order by s.id desc"

            );
            console.log( "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON  s.id=m.merchant_id where " +
              condition +
              " and " +
              condition2 +
              "order by s.id desc");
          } else {
            $sql =
              "select " +
              select +
              " from " +
              dbtable +
              " s INNER JOIN " +
              merchant_details +
              " m ON  s.id=m.merchant_id where deleted=0 and " +
              condition +
              " order by s.id desc";
            response = await qb.query($sql);
            
            console.log($sql);
          }
          
        } catch (error) {
          console.log(error);
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }
    }
    
    return response;
  },
  // select: async (condition_obj,filter,limit) => {
  //     let qb = await pool.get_connection();
  //     let search_text = await helpers.get_conditional_or_like_string(filter);
  //     let condition = await helpers.get_and_conditional_string(condition_obj);
  //     let response;

  //     let select = "s.super_merchant_id,s.id,s.ekyc_done,s.onboarding_done,s.ekyc_required,s.psp_mail_send,s.status,s.live,m.register_business_country,m.type_of_business,m.company_name,m.business_phone_number,m.legal_person_email,m.company_registration_number,m.merchant_id"

  //     if(limit.perpage){
  //         if(Object.keys(filter).length){
  //             response = await qb
  //             .query("select " + select +" from "+dbtable+ " s LEFT JOIN "+ merchant_details +" m ON s.id=m.merchant_id where "+ condition + " and ("+search_text +")   order by id desc LIMIT " + limit.perpage + limit.start );
  //             qb.release();

  //         }else{
  //             response = qb.where(condition).select(select).from(dbtable +' s')
  //             .join(merchant_details + ' m', 's.id=m.merchant_id').limit(limit.perpage, limit.start).order_by('id','desc')
  //             .get();
  //             qb.release();
  //         }

  //     }else{
  //         if(Object.keys(filter).length){
  //             response = await qb
  //             .query("select "+select+" from "+dbtable+ " s INNER JOIN "+ merchant_details +" m ON  s.id=m.merchant_id where "+ condition +" and ("+search_text +")  order by id desc");
  //             qb.release();
  //         }else{
  //             response = qb.where(condition).select(select).from(dbtable +' s')
  //             .join(merchant_details + ' m', 's.id=m.merchant_id').get();
  //             qb.release();
  //         }
  //     }
  //     return response;
  // },

  selectSpecific: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  selectOneDetails: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .where(condition)
        .select("id,merchant_id,company_name")
        .from(merchant_details)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectpspList: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .where(condition)
        .select("id,merchant_id,psp_id,status")
        .from(merchant_onboard)
        .group_by("psp_id")
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  selectDynamic: async (selection, condition, table) => {
    const dbtable = config.table_prefix + table;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  selectUserDetails: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  update_merchant: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  updateDetailsModified: async (condition, data) => {
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

  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(merchant_details);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj, filter) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let response;
    let qb = await pool.get_connection();
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
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_sub_merchant_count: async (condition_obj, filter, condition_obj2) => {
    let search_text = await helpers.get_conditional_or_like_string(filter);
    let condition = await helpers.get_and_conditional_string(condition_obj);
    let condition2 = await helpers.get_and_conditional_string_in(
      condition_obj2
    );
    let response;

    let select = " count(s.id) as count ";

    let qb = await pool.get_connection();
    try {
      if (Object.keys(filter).length) {
        if (Object.keys(condition_obj2).length) {
          response = await qb.query(
            "select " +
            select +
            " from " +
            dbtable +
            " s INNER JOIN " +
            merchant_details +
            " m ON  s.id=m.merchant_id where " +
            condition +
            " and " +
            condition2 +
            " and (" +
            search_text +
            ")"
          );
        } else {
          response = await qb.query(
            "select " +
            select +
            " from " +
            dbtable +
            " s INNER JOIN " +
            merchant_details +
            " m ON  s.id=m.merchant_id where " +
            condition +
            " and (" +
            search_text +
            ")"
          );
        }
      } else {
        if (Object.keys(condition_obj2).length) {
          response = await qb.query(
            "select " +
            select +
            " from " +
            dbtable +
            " s INNER JOIN " +
            merchant_details +
            " m ON  s.id=m.merchant_id where " +
            condition +
            " and " +
            condition2
          );
        } else {
          response = await qb.query(
            "select " +
            select +
            " from " +
            dbtable +
            " s INNER JOIN " +
            merchant_details +
            " m ON  s.id=m.merchant_id where " +
            condition
          );
        }
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_super_merchant_count: async (condition_obj, data_id) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
        super_merchant_table +
        " where id =" +
        data_id +
        " and  " +
        condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_mid_count: async (condition_obj, data_id) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
        mid_dbtable +
        " where id !=" +
        data_id +
        " and  " +
        condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  fetchCurrencySelect: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + "master_currency msc")
        .join(config.table_prefix + "mid mi", "mi.currency_id = msc.id", "left")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },

  fetchCurrencyName: async (currency_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("code")
        .where({ id: currency_id })
        .get(config.table_prefix + "master_currency");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getMerchantIdBySubMerchant: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id as merchant_id")
        .where(condition)
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].merchant_id;
  },
  ownerEkycCount: async (merchant_id) => {
    let raw_query =
      "SELECT sum(id) as total, sum( CASE WHEN  ekyc_status=1 then 1 ELSE 0 END) as ekyc_done from " +
      config.table_prefix +
      "merchant_business_owners" +
      " where merchant_id=" +
      merchant_id;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(raw_query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  updateSupermerchant: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update("pg_master_super_merchant");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_meetings: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " +
        meeting_table +
        " where " +
        condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_supermerchantid: async (selection, mmid) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        `SELECT ${selection} FROM pg_master_super_merchant sm  LEFT JOIN pg_master_merchant mm ON mm.super_merchant_id = sm.id WHERE mm.id = ${mmid} `
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_key_count: async (condition_obj, filter) => {
    let qb = await pool.get_connection();

    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " +
        merchant_key_and_secret +
        " where " +
        condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  update_key: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(merchant_key_and_secret);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getSelectedMerchantId: async (super_merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("selected_submerchant as selected_merchant")
        .where({ id: super_merchant_id })
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.selected_merchant;
  },
  add_payment_method: async (condition, data) => {
    const table = config.table_prefix + "merchant_payment_methods";
    let response;
    let qb = await pool.get_connection();
    try {
      let check_response = await qb.where(condition).get(table);
      if (check_response && check_response.length === 0) {
        response = await qb.returning("id").insert(table, data);
      } else {
        response = await qb.set(data).where(condition).update(table);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectPaymentMethod: async (sub_merchant_id, mode) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "methods as method,sequence as sr_no,is_visible as show,others as additional"
        )
        .where({ sub_merchant_id: sub_merchant_id, mode: mode })
        .group_by("method")
        .get(config.table_prefix + "merchant_payment_methods");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectAvailablePaymentMethod: async (sub_merchant_id,env="") => {
    let qb = await pool.get_connection();
    let response;
    let query = ``;
    try {
      query = `
        SELECT GROUP_CONCAT(payment_methods) AS payment_methods
        FROM ${config.table_prefix}mid
        WHERE submerchant_id = ${sub_merchant_id} AND deleted = 0 
    `;
      if (env !== "") {
        query += ` AND  env= '${env}'`;
      }
      query += ` GROUP BY submerchant_id`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    console.log(query);
    return response.length > 0 ? response?.[0].payment_methods : "";
  },
  update_payment_methods: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },
  fetch_Currency_Select: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .from(config.table_prefix + "master_currency msc")
        .join(config.table_prefix + "mid mi", "mi.currency_id = msc.id", "left")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response) {
      return response;
    } else {
      return [];
    }
  },
  get_card_payment_method: async (submerchant_id, env) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(["payment_schemes", "domestic", "international"])
        .from(mid_dbtable)
        .where({ submerchant_id: submerchant_id, env: env })
        .where({ deleted: 0 })
        .group_by(["id", "submerchant_id"])
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    let first_data = [];
    let second_data = [];
    Object.values(response).forEach((val) => {
      if (val.payment_schemes == undefined || val.payment_schemes == null) {
        return [];
      }

      if (val.domestic) {
        if (!first_data.includes("Domestic Card")) {
          first_data.push("Domestic Card");
        }
      }

      if (val.international) {
        if (!first_data.includes("International Card")) {
          first_data.push("International Card");
        }
      }

      let payment_methods = val.payment_schemes.split(",");
      payment_methods.forEach((element) => {
        if (!second_data.includes(element)) {
          second_data.push(element);
        }
      });
    });
    return first_data.concat(second_data.sort());
    //return { 'international_card': first_data, 'other_card': second_data.sort() };
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
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_count_sell_mid: async (table, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let final_cond = " where ";
      if (Object.keys(condition).length) {
        let condition_str = await helpers.get_and_conditional_string(condition);
        final_cond = final_cond + condition_str;
      }
      if (final_cond == " where ") {
        final_cond = "";
      }

      let query =
        "select count(*) as total from " +
        config.table_prefix +
        table +
        final_cond;

      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.total;
  },
  add_bulk_mid: async (data, table) => {
    table = config.table_prefix + table;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert(table, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_mid_unique_card_payment_method: async (submerchant_id, mode) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(["payment_schemes", "domestic", "international"])
        .from(mid_dbtable)
        .where({ submerchant_id: submerchant_id, env: mode })
        .where({ deleted: 0 })
        .group_by(["id", "submerchant_id"])
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    let data = [];
    Object.values(response).forEach((val) => {
      if (val.payment_schemes == undefined || val.payment_schemes == null) {
        return [];
      }

      if (val.domestic) {
        if (!data.includes("DOMESTIC CARD")) {
          data.push("DOMESTIC CARD");
        }
      }

      if (val.international) {
        if (!data.includes("INTERNATIONAL CARD")) {
          data.push("INTERNATIONAL CARD");
        }
      }

      let payment_methods = val.payment_schemes.split(",");
      payment_methods.forEach((element) => {
        if (!data.includes(element)) {
          data.push(element);
        }
      });
    });
    return data;
  },
  getDeletedRecord: async (id, submerchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select([
          "payment_methods",
          "payment_schemes",
          "domestic",
          "international",
          "env",
          "psp_id",
        ])
        .from(mid_dbtable)
        .where({ id: id, submerchant_id: submerchant_id })
        .where({ deleted: 1 })
        .group_by(["id", "submerchant_id"])
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  checkPaymentMethod: async (sub_merchant, method, mode) => {
    let sql = `SELECT *  FROM ${config.table_prefix}merchant_draft_payment_methods WHERE submerchant_id = ${sub_merchant} AND methods='${method}' AND mode='${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  checkDraftPaymentMethod: async (sub_merchant) => {
    let sql = `SELECT * FROM ${config.table_prefix}master_merchant_draft WHERE submerchant_id = ${sub_merchant}`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  getSequencePaymentMethod: async (condition, table) => {
    let sql = `SELECT max(sequence) as sequence FROM ${config.table_prefix}${table} WHERE ${condition}`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response && response.length === 0) {
      return 1;
    } else {
      return response?.[0].sequence + 1;
    }
  },
  getMIDCurrency: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("GROUP_CONCAT(currency_id) AS currency_ids", false)
        .where(condition)
        .get(mid_dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  removeOldPaymentMethod: async (condition) => {
    const table = config.table_prefix + "merchant_payment_methods";
    let qb = await pool.get_connection();
    let check_response;
    try {
      check_response = await qb.where(condition).delete(table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return check_response;
  },
  psp_name: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .from(config.table_prefix + "psp")
        .where(condition)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  list_mid_psp: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      // let sql = `SELECT psp.id, psp.name FROM pg_mid midp
      //           LEFT JOIN pg_psp psp on psp.id =midp.psp_id  
      //           WHERE 
      //           midp.status=0 
      //           AND midp.deleted=0
      //           AND psp.status=0 
      //           AND psp.deleted=0
      //           AND midp.submerchant_id=1`;

      response = await qb
        .select(
          'psp.id, psp.name'
        )
        .from(config.table_prefix + "mid midp")
        .join(
          config.table_prefix + "psp psp",
          "midp.psp_id=psp.id",
          "left"
        )
        .where(condition)
        .order_by("psp.name", "asc")
        .get();
      console.log(`mid query`);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  checkMerchantPaymentMethod: async (sub_merchant, method, mode) => {
    let sql = `SELECT *  FROM ${config.table_prefix}merchant_payment_methods WHERE sub_merchant_id = ${sub_merchant} AND methods='${method}' AND mode='${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  checkMerchantDraftPaymentMethod: async (sub_merchant, method, mode) => {
    let sql = `SELECT *  FROM ${config.table_prefix}merchant_draft_payment_methods WHERE submerchant_id = ${sub_merchant} AND methods='${method}' AND mode='${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  addMerchantPaymentMethod: async (sub_merchant, method, mode, others) => {
    let sql = `INSERT INTO pg_merchant_payment_methods (sub_merchant_id, methods, others, sequence, is_visible, mode, created_at) SELECT ${sub_merchant},'${method}','${others}',IFNULL(MAX(sequence), 0) + 1,1,'${mode}',NOW() FROM pg_merchant_payment_methods WHERE sub_merchant_id= ${sub_merchant} AND mode='${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  addMerchantDraftPaymentMethod: async (sub_merchant, method, mode, others) => {
    let sql = `INSERT INTO pg_merchant_draft_payment_methods (submerchant_id, methods, others, sequence, is_visible, mode, created_at) SELECT ${sub_merchant},'${method}','${others}',IFNULL(MAX(sequence), 0) + 1,1,'${mode}',NOW() FROM pg_merchant_draft_payment_methods WHERE submerchant_id= ${sub_merchant} AND mode='${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  checkMerchantDraft: async (sub_merchant) => {
    let sql = `SELECT *  FROM ${config.table_prefix}master_merchant_draft WHERE submerchant_id = ${sub_merchant}`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  deletePaymentMethod:async(merchant_id,mode)=>{
    let sql = `DELETE FROM pg_merchant_payment_methods WHERE sub_merchant_id=${merchant_id} AND mode = '${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
  },
  deleteDraftPaymentMethod:async(merchant_id,mode)=>{
     let sql = `DELETE FROM pg_merchant_draft_payment_methods WHERE submerchant_id=${merchant_id} AND mode = '${mode}'`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
  },
  fetchPaymentMethodAndSchemes:async(merchant_id,mode)=>{
     let sql = `SELECT submerchant_id, env, GROUP_CONCAT(DISTINCT TRIM(pm) ORDER BY pm SEPARATOR ', ') AS unique_payment_methods, GROUP_CONCAT(DISTINCT TRIM(ps) ORDER BY ps SEPARATOR ', ') AS unique_payment_schemes,domestic,international,psp_id as psp FROM (SELECT submerchant_id, env, SUBSTRING_INDEX(SUBSTRING_INDEX(payment_methods, ',', numbers.n), ',', -1) AS pm, SUBSTRING_INDEX(SUBSTRING_INDEX(payment_schemes, ',', numbers.n), ',', -1) AS ps,domestic,international,psp_id FROM pg_mid JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10) numbers ON CHAR_LENGTH(payment_methods) - CHAR_LENGTH(REPLACE(payment_methods, ',', '')) >= numbers.n - 1 OR CHAR_LENGTH(payment_schemes) - CHAR_LENGTH(REPLACE(payment_schemes, ',', '')) >= numbers.n - 1 WHERE submerchant_id = ${merchant_id} AND env = '${mode}' AND deleted=0)  AS extracted GROUP BY submerchant_id, env;`;
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
     return response?.[0];
  },
  selectAvailableMobileWallet:async (sub_merchant_id, env = "") => {
    let qb = await pool.get_connection();
    let response;
    let query = ``;
    try {
      query = `
        SELECT p.credentials_key as psp_id,p.name,c.dial as code, mid.payment_schemes as mno
        FROM ${config.table_prefix}mid as mid LEFT JOIN ${config.table_prefix}psp p ON mid.psp_id = p.id
        LEFT JOIN ${config.table_prefix}country c ON mid.country_id = c.id
        WHERE mid.submerchant_id = ${sub_merchant_id} AND mid.deleted = 0 AND mid.env = '${env}' AND p.payment_methods LIKE '%Mobile Wallet%'
        GROUP BY p.id, p.name
    `;
     
      console.log(query);
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    console.log(query);
    return response;
  },
  checkMerchantPaymentMethodsBatch: async (paymentMethodsToCheck) => {
    if (!paymentMethodsToCheck || paymentMethodsToCheck.length === 0) {
        return new Set();
    }
    console.log(`here payment method to check`);
    console.log(paymentMethodsToCheck);
    let qb = await pool.get_connection();
    try {
        // Build WHERE conditions using node-querybuilder's where methods
         qb.select('sub_merchant_id,methods,mode').from('pg_merchant_payment_methods').where(paymentMethodsToCheck);
        const results = await qb.get();
        console.log(qb.last_query());
        // Return as Set for O(1) lookup
        return new Set(
            results.map(row => `${row.mode}_${row.sub_merchant_id}_${row.methods}`)
        );
    } catch (error) {
        console.error('Error in checkMerchantPaymentMethodsBatch:', error);
        throw error;
    }finally{
      qb.release();``
    }
  },

  checkMerchantDraftPaymentMethodsBatch: async (draftPaymentMethodsToCheck) => {
    if (!draftPaymentMethodsToCheck || draftPaymentMethodsToCheck.length === 0) {
        return new Set();
    }

    try {
        let query = db.select(['submerchant_id', 'payment_method', 'mode'])
                     .from('merchant_draft_payment_methods');

        // Add OR conditions for each draft payment method to check
        query = query.where(function() {
            draftPaymentMethodsToCheck.forEach((item, index) => {
                const whereMethod = index === 0 ? 'where' : 'or_where';
                this[whereMethod](function() {
                    this.where('submerchant_id', item.submerchant_id)
                        .where('payment_method', item.payment_method)
                        .where('mode', item.mode);
                });
            });
        });

        const results = await query.get();
        
        return new Set(
            results.map(row => `${row.mode}_${row.submerchant_id}_${row.payment_method}`)
        );
    } catch (error) {
        console.error('Error in checkMerchantDraftPaymentMethodsBatch:', error);
        throw error;
    }
  },

  addMerchantPaymentMethodsBatch: async (paymentMethods) => {
      if (!paymentMethods || paymentMethods.length === 0) {
          return null;
      }

      try {
          // Prepare data for batch insert
          const insertData = paymentMethods.map(item => ({
              submerchant_id: item.submerchant_id,
              payment_method: item.payment_method,
              mode: item.mode,
              others: item.others || null,
              created_at: new Date(),
              updated_at: new Date()
          }));

          const result = await db.insert_batch('merchant_payment_methods', insertData);
          console.log(`Batch inserted ${paymentMethods.length} payment methods`);
          return result;
      } catch (error) {
          console.error('Error in addMerchantPaymentMethodsBatch:', error);
          throw error;
      }
  },

  addMerchantDraftPaymentMethodsBatch: async (draftPaymentMethods) => {
      if (!draftPaymentMethods || draftPaymentMethods.length === 0) {
          return null;
      }

      try {
          // Prepare data for batch insert
          const insertData = draftPaymentMethods.map(item => ({
              submerchant_id: item.submerchant_id,
              payment_method: item.payment_method,
              mode: item.mode,
              others: item.others || null,
              created_at: new Date(),
              updated_at: new Date()
          }));

          const result = await db.insert_batch('merchant_draft_payment_methods', insertData);
          console.log(`Batch inserted ${draftPaymentMethods.length} draft payment methods`);
          return result;
      } catch (error) {
          console.error('Error in addMerchantDraftPaymentMethodsBatch:', error);
          throw error;
      }
  },

  checkMerchantDraftsBatch: async (merchantIds) => {
      if (!merchantIds || merchantIds.length === 0) {
          return new Set();
      }

      try {
          const query = db.select(['submerchant_id'])
                        .distinct()
                        .from('merchant_drafts')
                        .where_in('submerchant_id', merchantIds);

          const results = await query.get();
          return new Set(results.map(row => row.submerchant_id));
      } catch (error) {
          console.error('Error in checkMerchantDraftsBatch:', error);
          throw error;
      }
  },
  addMerchantPaymentMethodsBulk : async (paymentMethodsData) => {
  // let qb = await pool.get_connection();
  let response;
  
  try {
    if (!paymentMethodsData || paymentMethodsData.length === 0) {
      return { success: false, message: 'No data provided' };
    }

    console.log(`Processing ${paymentMethodsData.length} payment methods for bulk insert`);

    // Start transaction for consistency
    // await qb.beginTransaction();

    // Method 1: Single query with ROW_NUMBER() - Most Efficient (MySQL 8.0+)
    response =   await bulkInsertWithBatching(paymentMethodsData);


    // await qb.commit();
    console.log(`Successfully inserted ${paymentMethodsData.length} payment methods`);
    
    return response;

  } catch (error) {
    // await qb.rollback();
    console.error("Bulk insert failed, trying alternative approach:", error.message);
    
    // Fallback to batched approach
    // return await bulkInsertWithBatching(paymentMethodsData);
    
  } finally {
    // qb.release();
  }
  },
  addMerchantPaymentMethodsBulkDraft:async (paymentMethodsData) => {
  // let qb = await pool.get_connection();
  let response;
  
  try {
    if (!paymentMethodsData || paymentMethodsData.length === 0) {
      return { success: false, message: 'No data provided' };
    }

    console.log(`Processing ${paymentMethodsData.length} payment methods for bulk insert`);

    // Start transaction for consistency
    // await qb.beginTransaction();

    // Method 1: Single query with ROW_NUMBER() - Most Efficient (MySQL 8.0+)
    response =   await bulkInsertWithBatchingDraft(paymentMethodsData);


    // await qb.commit();
    console.log(`Successfully inserted ${paymentMethodsData.length} payment methods`);
    
    return response;

  } catch (error) {
    // await qb.rollback();
    console.error("Bulk insert failed, trying alternative approach:", error.message);
    
    // Fallback to batched approach
    // return await bulkInsertWithBatching(paymentMethodsData);
    
  } finally {
    // qb.release();
  }
  },
  selectIneritedMids: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(mid_dbtable);
      console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  bulkDeletePaymentMethods: async (merchant_ids, mode) => {
  if (!merchant_ids || !Array.isArray(merchant_ids) || merchant_ids.length === 0) {
    throw new Error('merchant_ids must be a non-empty array');
  }
  
  const merchantIdList = merchant_ids.join(',');
  let sql = `DELETE FROM pg_merchant_payment_methods WHERE sub_merchant_id IN (${merchantIdList}) AND mode = '${mode}'`;
  let response;
  let qb = await pool.get_connection();
  
  try {
    response = await qb.query(sql);
    return response;
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
    throw error;
  } finally {
    qb.release();
  }
  },


bulkDeleteDraftPaymentMethods: async (merchant_ids, mode) => {
  if (!merchant_ids || !Array.isArray(merchant_ids) || merchant_ids.length === 0) {
    throw new Error('merchant_ids must be a non-empty array');
  }
  
  const merchantIdList = merchant_ids.join(',');
  let sql = `DELETE FROM pg_merchant_draft_payment_methods WHERE submerchant_id IN (${merchantIdList}) AND mode = '${mode}'`;
  let response;
  let qb = await pool.get_connection();
  
  try {
    response = await qb.query(sql);
    return response;
  } catch (error) {
    logger.error(500,{message: error,stack: error.stack}); 
    throw error;
  } finally {
    qb.release();
  }
},
get_bulk_count_mid: async (merchant_ids) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query =`select count(*) as count,submerchant_id from pg_mid WHERE submerchant_id IN (${merchant_ids}) AND deleted=0 GROUP BY submerchant_id;`
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectPSPListBySuperMerchant:async(super_merchant_id)=>{
     let qb = await pool.get_connection();
    let response;
    try {
      let query =`SELECT DISTINCT p.id AS psp_id, p.name AS psp_name,p.country FROM pg_psp p JOIN pg_mid m ON m.psp_id = p.id JOIN ( SELECT MIN(mid.id) AS min_mid_id FROM pg_mid mid JOIN pg_master_merchant mm ON mm.id = mid.submerchant_id WHERE mm.super_merchant_id = ${super_merchant_id} AND mid.deleted = 0 GROUP BY mid.psp_id ) x ON x.min_mid_id = m.id;`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  }

};

module.exports = dbModel;
async function bulkInsertWithBatching(paymentMethodsData) {
  let qb = await pool.get_connection();
  let totalInserted = 0;

  try {

    // Group by sub_merchant_id and mode
    const groupedData = {};
    paymentMethodsData.forEach(item => {
      const key = `${item.sub_merchant_id}_${item.mode}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item);
    });

    // Process each group
    for (const [key, items] of Object.entries(groupedData)) {
      const [sub_merchant_id, mode] = key.split('_');
      
      // Get current max sequence for this merchant and mode
      const maxSeqSql = `
        SELECT COALESCE(MAX(sequence), 0) as max_sequence 
        FROM pg_merchant_payment_methods 
        WHERE sub_merchant_id = ${sub_merchant_id} AND mode = '${mode}'
      `;
      
      const maxSeqResult = await qb.query(maxSeqSql);
      let currentSequence = maxSeqResult[0]?.max_sequence || 0;

      // Prepare bulk insert for this group
      const values = items.map(item => {
        currentSequence++;
        return `(${sub_merchant_id}, '${item.method}', '${item.others}', ${currentSequence}, 1, '${mode}', NOW())`;
      }).join(', ');

      const insertSql = `
        INSERT INTO pg_merchant_payment_methods 
        (sub_merchant_id, methods, others, sequence, is_visible, mode, created_at) 
        VALUES ${values}
      `;

      const result = await qb.query(insertSql);
      totalInserted += result.affectedRows || items.length;
    }

    return {
      success: true,
      affectedRows: totalInserted,
      message: `Bulk inserted ${totalInserted} payment methods`
    };

  } catch (error) {
    console.error("Batched bulk insert failed:", error);
    throw error;
  } finally {
    qb.release();
  }
}
async function bulkInsertWithBatchingDraft(paymentMethodsData) {
  let qb = await pool.get_connection();
  let totalInserted = 0;

  try {

    // Group by sub_merchant_id and mode
    const groupedData = {};
    paymentMethodsData.forEach(item => {
      const key = `${item.sub_merchant_id}_${item.mode}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item);
    });

    // Process each group
    for (const [key, items] of Object.entries(groupedData)) {
      const [sub_merchant_id, mode] = key.split('_');
      
      // Get current max sequence for this merchant and mode
      const maxSeqSql = `
        SELECT COALESCE(MAX(sequence), 0) as max_sequence 
        FROM pg_merchant_draft_payment_methods 
        WHERE submerchant_id = ${sub_merchant_id} AND mode = '${mode}'
      `;
      
      const maxSeqResult = await qb.query(maxSeqSql);
      let currentSequence = maxSeqResult[0]?.max_sequence || 0;

      // Prepare bulk insert for this group
      const values = items.map(item => {
        currentSequence++;
        return `(${sub_merchant_id}, '${item.method}', '${item.others}', ${currentSequence}, 1, '${mode}', NOW())`;
      }).join(', ');

      const insertSql = `
        INSERT INTO pg_merchant_draft_payment_methods 
        (submerchant_id, methods, others, sequence, is_visible, mode, created_at) 
        VALUES ${values}
      `;

      const result = await qb.query(insertSql);
      totalInserted += result.affectedRows || items.length;
    }

    return {
      success: true,
      affectedRows: totalInserted,
      message: `Bulk inserted ${totalInserted} payment methods`
    };

  } catch (error) {
    console.error("Batched bulk insert failed:", error);
    throw error;
  } finally {
    qb.release();
  }
}
