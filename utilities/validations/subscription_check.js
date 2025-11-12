const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

const subscription_recurring_table =
  config.table_prefix + "subscription_recurring";
const subscription_table = config.table_prefix + "subscription";

async function checkForSubscriptionRecurring(subscription_id) {
  let sql = `SELECT
                    COUNT(id) as unpaid_recurring
                FROM
                    ${subscription_recurring_table}
                WHERE subscription_id = ${subscription_id}
                AND is_paid = 0`;

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
}

async function getSubscription(email, plan_id) {
  let sql = `SELECT subscription_id FROM ${subscription_table} WHERE email = '${email}' AND plan_id = ${plan_id}`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  if (response === undefined) {
    return undefined;
  } else {
    return response?.[0];
  }
}

module.exports = {
  checkForSubscriptionRecurring,
  getSubscription,
};
