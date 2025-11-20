require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const dbtable = config.table_prefix + "master_merchant_draft";
const db_merchant_draft_payment_model =
  config.table_prefix + "merchant_draft_payment_methods";

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
  selectOne: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.where(condition).get(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  update: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateMerchant: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(config.table_prefix+'master_merchant');
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select count('id') as count from " +
          dbtable +
          " where submerchant_id=" +
          condition.submerchant_id
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response[0].count;
  },
  add_draft_payment_method: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      const checkResult = await qb
        .select("*")
        .where(condition)
        .get(db_merchant_draft_payment_model);
      if (checkResult && checkResult.length === 0) {
        response = await qb
          .returning("id")
          .insert(db_merchant_draft_payment_model, data);
      } else {
        response = await qb
          .set(data)
          .where(condition)
          .update(db_merchant_draft_payment_model);
      }
    } catch (error) {
      console.error("Database query failed:", error);
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
        .where({ submerchant_id: sub_merchant_id, mode: mode })
        .get(db_merchant_draft_payment_model);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = dbModel;
