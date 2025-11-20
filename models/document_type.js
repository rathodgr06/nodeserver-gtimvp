const console = require("console");
const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_document_type";
const doctable = config.table_prefix + "master_entity_document";
const countrytable = config.table_prefix + "pg_country";
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");

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
  addDocument: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.insert(doctable, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (filter, limit) => {
    let qb = await pool.get_connection();
    // let condition1 = await helpers.get_and_conditional_string(filter);

    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select("*")
          .where(filter)
          .order_by("group_required", "desc")
          .order_by("document_type", "asc")
          .limit(limit.perpage, limit.start)
          .get(dbtable);
      } else {
        response = await qb
          .select("*")
          .where(filter)
          .order_by("id", "desc")
          .get(dbtable);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  select_document: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      if (limit.perpage) {
        response = await qb
          .select(
            "e.id, e.entity,e.status,d.document,d.required, d.issue_date_required, d.expiry_date_required"
          )
          .where(condition)
          .from(config.table_prefix + "master_entity_type e")
          .join(
            config.table_prefix + "master_entity_document  d",
            "d.entity_id = e.id"
          )
          .limit(limit.perpage, limit.start);
      } else {
        response = await qb
          .select(
            "e.id, e.entity,e.status,d.document,d.required, d.issue_date_required, d.expiry_date_required"
          )
          .where(condition)
          .from(config.table_prefix + "master_entity_type e")
          .join(
            config.table_prefix + "master_entity_document  d",
            "d.entity_id = e.id"
          );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;
  },

  list_of_document: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(doctable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
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
  selectSome: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  selectUserDetails: async (condition) => {
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
  updateDetails: async (condition, data) => {
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

  update_document: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(doctable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  get_count: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);

    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count('id') as count from " + dbtable + " where " + condition
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
};

module.exports = dbModel;
