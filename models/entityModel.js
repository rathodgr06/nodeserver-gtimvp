const console = require("console");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_entity_type";
const doctable = config.table_prefix + "master_entity_document";
const documenttable = config.table_prefix + "master_document_type";
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
      console.error("Database query failed:", error);
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
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  select: async (filter, limit) => {
    let condition1 = await helpers.get_and_conditional_string(filter);

    let qb = await pool.get_connection();
    let response;
    if (limit.perpage) {
      try {
        if (filter.country_id != "") {
          // response = await qb.query("select * from "+ dbtable + " where "+ condition1 );

          response = await qb
            .select("*")
            .where(condition1)
            .order_by("entity", "asc")
            .limit(limit.perpage, limit.start)
            .get(dbtable);
        } else {
          response = await qb
            .select("*")
            .where(condition1)
            .order_by("entity", "asc")
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
        if (filter.country_id != "") {
          // response = await qb.query("select * from "+ dbtable + " where "+ condition1 );
          response = await qb
            .select("*")
            .where(condition1)
            .order_by("entity", "asc")
            .get(dbtable);
        } else {
          response = await qb
            .select("*")
            .where(condition1)
            .order_by("entity", "asc")
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
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },

  list_of_document: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id, entity_id, document_for, ekyc_required, document, required, issue_date_required, expiry_date_required, document_num_required, match_with_selfie, issuing_authority, deleted, user_id, status, added_date, ip").where(condition).get(doctable);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  list_of_document_type: async (condition) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("id").where(condition).get(documenttable);
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
  selectOneDocs: async (selection, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(doctable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].document ? response?.[0].document : "";
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
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0] ? response?.[0].ekyc_required : "";
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

  update_document: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(doctable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  removeEntityDoc: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(doctable, condition);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count_document: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + doctable + " where " + condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  get_count: async (condition_obj) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select count('id') as count from " + dbtable + " where " + condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0].count ? response?.[0].count : 0;
  },

  getSelfieDocs: async (condition_obj) => {
    let qb = await pool.get_connection();

    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select document  from " +
          doctable +
          " where " +
          condition +
          " and status=0 and match_with_selfie=1"
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0] ? response?.[0].document : "";
  },
  getSelfieDocsID: async (condition_obj) => {
    let qb = await pool.get_connection();

    let response;
    try {
      let condition = await helpers.get_conditional_string(condition_obj);
      response = await qb.query(
        "select id  from " + doctable + " where " + condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0] ? response?.[0].id : "";
  },
};

module.exports = dbModel;
