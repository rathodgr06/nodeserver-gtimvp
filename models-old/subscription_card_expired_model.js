const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const moment = require("moment");

const subscription_recurring_table =
  config.table_prefix + "subscription_recurring";

var dbModel = {
  get_subscription_data: async (subscription_id) => {
    const subscription_table = config.table_prefix + "subscription";
    const plan_table = config.table_prefix + "subs_plans";
    let sql = `SELECT
                        s.subscription_id,
                        s.email,
                        s.name,
                        s.last_payment_date,
                        s.successful_payment_date,
                        s.last_payment_status,
                        p.*
                    FROM
                    ${subscription_table} s
                    LEFT JOIN ${plan_table} p ON
                        s.plan_id = p.id
                    WHERE s.subscription_id = ${subscription_id}`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_subscription_next_due_amount: async (subscription_id) => {
    let sql = `SELECT amount FROM ${subscription_recurring_table} WHERE subscription_id = '${subscription_id}' AND plan_id != 0 AND is_paid = 0 ORDER BY id ASC LIMIT 1`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_subscription_recurring_exists: async (subscription_id) => {
    let sql = `SELECT * FROM ${subscription_recurring_table} WHERE subscription_id = '${subscription_id}' LIMIT 1`;

    let qb = await pool.get_connection();
    console.log(sql);
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  get_subscription_recurring: async (plan_id) => {
    let plan_tem_table = config.table_prefix + "plan_terms";
    let sql = `SELECT * FROM ${plan_tem_table} WHERE plan_id = '${plan_id}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateRecurring: async (order_id, subscription_id, payment_id) => {
    const sql1 = `SELECT id, order_id FROM ${subscription_recurring_table} WHERE subscription_id = '${subscription_id}' AND plan_id != 0 AND is_paid = 0 ORDER BY id ASC LIMIT 1`;

    let response1;
    let qb = await pool.get_connection();
    try {
      response1 = await qb.query(sql1);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    if (order_id !== response1?.[0]?.order_id) {
      const sql3 = `UPDATE ${subscription_recurring_table} SET order_id=${order_id} WHERE subscription_id = '${subscription_id}' AND is_paid = 0`;
      qb = await pool.get_connection();
      try {
        await qb.query(sql3);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    }
    const sql2 = `UPDATE ${subscription_recurring_table} SET is_paid = 1, is_failed = 0, order_id=${order_id}, payment_id='${payment_id}' WHERE id = '${response1[0].id}'`;

    let response;
    qb = await pool.get_connection();
    try {
      response = await qb.query(sql2);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateExpiredCardStatus: async (order_id, subscription_id) => {
    let customers_cards_table = config.table_prefix + "customers_cards";

    let sql2 = `SELECT
    o.cid
    FROM
    ${config.table_prefix}orders o
                    LEFT JOIN ${config.table_prefix}subs_payment sp ON
                        o.order_id = sp.order_no
                        WHERE
                        o.order_id = '${order_id}' AND sp.subscription_id = '${subscription_id}'
                    LIMIT 1`;

    let response2;
    let qb = await pool.get_connection();
    try {
      response2 = await qb.query(sql2);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    const sql = `UPDATE ${customers_cards_table} SET deleted = 1 WHERE
                    STR_TO_DATE(
                        CONCAT(
                            SUBSTRING(card_expiry, 1, 2),
                            '/01/',
                            SUBSTRING(card_expiry, 4, 4)
                        ),
                        '%m/%d/%Y'
                    ) < DATE_FORMAT(NOW(), '%Y-%m-01')
                    AND cid = '${response2?.[0].cid}'`;

    qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  getSubscriptionPlan: async (subscription_id) => {
    let sql = `SELECT
                        p.terms
                    FROM
                        ${config.table_prefix}subscription s
                    LEFT JOIN ${config.table_prefix}subs_plans p ON
                        s.plan_id = p.id
                    WHERE
                        s.subscription_id = '${subscription_id}'`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  updateDeclinedCard: async (subscription_id) => {
    let sql = `UPDATE ${config.table_prefix}declined_cards SET deleted = 1 WHERE subscription_id = '${subscription_id}'`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
  },
  getPlanInstallment: async (plan_id) => {
    let sql = `SELECT * FROM ${config.table_prefix}plan_terms WHERE plan_id=${plan_id}`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  saveSubscriptionInstallment: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = qb.insert_batch(
        `${config.table_prefix}subscription_recurring`,
        data
      );
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
  },
  updateLastSubscribed: async (id) => {
    const date = moment().format("YYYY-MM-DD hh:mm");
    let sql = `UPDATE ${config.table_prefix}subs_plans SET last_subscribe_date = '${date}' WHERE id = ${id}`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
  },
  lastSubscriptionPayment: async (subscription_id, payment_status) => {
    const date = moment().format("YYYY-MM-DD hh:mm");
    let successful_payment_date = payment_status != "FAILED" ? date : null;
    let sql = `UPDATE ${config.table_prefix}subscription SET last_payment_status = '${payment_status}', last_payment_date='${date}',successful_payment_date='${successful_payment_date}' WHERE subscription_id = '${subscription_id}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
  },
};

module.exports = dbModel;
