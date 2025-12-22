const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const enc_dec = require("../decryptor/decryptor");
const encrypt_decrypt = require("../decryptor/encrypt_decrypt");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const fs = require("fs");
const axios = require("axios");
const moment = require("moment");
//const merchantOrderModel = require("../models/merchantOrder");
const generateUniqueId = require("generate-unique-id");
const DBRun = require("../../models/DBRun");
const logger = require('../../config/logger');

// Function to generate all dates between two dates
function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  endDate = new Date(endDate);

  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function randomString(length, capslock = 0) {
  let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var result = "";
  for (var i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  if (capslock == 1) {
    return result.toUpperCase();
  } else {
    return result;
  }
}
function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

const calculateNextDueDate = async (
  initialPayDate,
  payment_interval,
  paymentFrequencyType
) => {
  let dueDate = moment(initialPayDate);

  if (paymentFrequencyType === "monthly") {
    dueDate = dueDate.add(1 * payment_interval, "month");
  } else if (paymentFrequencyType === "weekly") {
    dueDate = dueDate.add(1 * payment_interval, "week");
  } else if (paymentFrequencyType === "daily") {
    dueDate = dueDate.add(1 * payment_interval, "day");
  } else if (paymentFrequencyType === "yearly") {
    dueDate = dueDate.add(1 * payment_interval, "year");
  }

  return dueDate.format("YYYY-MM-DD");
};
const calculatePreviousDueDate = async (
  initialPayDate,
  payment_interval,
  paymentFrequencyType
) => {
  let dueDate = moment(initialPayDate);

  if (paymentFrequencyType === "monthly") {
    dueDate = dueDate.subtract(1 * payment_interval, "month");
  } else if (paymentFrequencyType === "weekly") {
    dueDate = dueDate.subtract(1 * payment_interval, "week");
  } else if (paymentFrequencyType === "daily") {
    dueDate = dueDate.subtract(1 * payment_interval, "day");
  } else if (paymentFrequencyType === "yearly") {
    dueDate = dueDate.subtract(1 * payment_interval, "year");
  }

  return dueDate.format("YYYY-MM-DD");
};
let helpers = {
  make_random_key: async (pre) => {
    let today = new Date();
    let day = today.getDate();
    let month = today.getMonth();
    let year = today.getFullYear();
    let str = pre + "_";
    str +=
      randomString(4) +
      year +
      randomString(4) +
      month +
      randomString(4) +
      day +
      randomString(4);
    return str;
  },
  make_order_number: async (pre) => {
    let today = new Date();
    let day = today.getDate();
    let month = today.getMonth();
    let year = today.getFullYear();
    let str = pre;
    str +=
      randomString(2, 1) +
      month +
      randomString(3, 1) +
      day +
      randomString(2, 1);
    return str;
  },
  make_referral_code: async (pre) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(config.table_prefix + "referrers")
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    let max_id = 1;
    if (response?.[0]) {
      max_id = response?.[0].id;
    }
    max_id = 1000000 + parseInt(max_id);
    let str = pre;
    str += max_id;
    return str;
  },
  make_reference_number: async (pre, length) => {
    let str = pre;
    str += randomString(length, 1);
    return str;
  },
  get_ip: async (req) => {
    return req.socket.remoteAddress;
  },
  generateOtp: async (size) => {
    const zeros = "0".repeat(size - 1);
    const x = parseFloat("1" + zeros);
    const y = parseFloat("9" + zeros);
    const confirmationCode = String(Math.floor(x + Math.random() * y));
    return confirmationCode;
  },
  get_merchant_api_key: async (mer_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("api_key")
        .where({ merchant_id: mer_id, deactivated: 0 })
        .get(config.table_prefix + "merchant_api_key");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].api_key;
    } else {
      return "";
    }
  },
  get_question_by_id: async (question_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("question")
        .where({ id: question_id })
        .get(config.table_prefix + "master_security_questions");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].question;
    } else {
      return "";
    }
  },
  get_country_name_by_iso: async (iso) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_name")
        .where({ iso2: iso })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_name;
    } else {
      return "";
    }
  },
  get_mobile_length: async (dial) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mobile_no_length as mob_length")
        .where({ dial: dial, deleted: 0, status: 0 })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].mob_length;
    } else {
      return "";
    }
  },
  get_zero_at_first_place: async (dial) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("accept_zero_at_first_palce as zero_at_first")
        .where({ dial: dial })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].zero_at_first;
    } else {
      return "";
    }
  },
  get_country_id_by_iso: async (iso) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,country_name")
        .where({ iso2: iso, status: 0, deleted: 0 })
        .get(config.table_prefix + "country");
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  find_city_by_country: async (name, code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({
          "LOWER(city_name)": name,
          country_code: code,
          status: 0,
          deleted: 0,
        })
        .get(config.table_prefix + "city");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return true;
    } else {
      return false;
    }
  },
  find_state_id_by_name: async (name, code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({
          "LOWER(state_name)": name,
          country_code: code,
          status: 0,
          deleted: 0,
        })
        .get(config.table_prefix + "states");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  find_city_id_by_name: async (name, code, state) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({
          "LOWER(city_name)": name,
          ref_state: state,
          country_code: code,
          status: 0,
          deleted: 0,
        })
        .get(config.table_prefix + "city");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  add_days_date: async (days) => {
    let day = parseInt(days);
    var result = new Date();
    result.setDate(result.getDate() + day);
    return new Date(result).toJSON().substring(0, 19).replace("T", " ");
  },
  date_format: async (date) => {
    var date_format = new Date(date);
    formatted_date =
      pad2(date_format.getDate()) +
      "-" +
      pad2(parseInt(date_format.getMonth()) + 1) +
      "-" +
      date_format.getFullYear();
    return formatted_date;
  },
  get_country_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_name")
        .where({ id: id })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_name;
    } else {
      return "";
    }
  },
  get_country_name_by_ids: async (idsArr) => {
    if (!idsArr[0]) {
      return {};
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,country_name")
        .where({
          id: idsArr,
        })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response) {
      var result = {};
      response.map(function (entity) {
        result[entity.id] = entity.country_name;
      });
      return result;
    } else {
      return {};
    }
  },
  get_state_name_by_ids: async (idsArr) => {
    if (!idsArr[0]) {
      return {};
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,state_name")
        .where({
          id: idsArr,
        })
        .get(config.table_prefix + "states");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response) {
      var result = {};
      response.map(function (entity) {
        result[entity.id] = entity.state_name;
      });
      return result;
    } else {
      return {};
    }
  },
  get_country_iso2_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("iso2 as code")
        .where({ id: id })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].code;
    } else {
      return "";
    }
  },
  get_nationalty_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("nationality")
        .where({ code: id })
        .get(config.table_prefix + "nationality");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0]?.nationality;
    } else {
      return "";
    }
  },
  get_state_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("state_name")
        .where({ id: id })
        .get(config.table_prefix + "states");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0]?.state_name;
    } else {
      return "";
    }
  },

  get_city_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("city_name")
        .where({ id: id })
        .get(config.table_prefix + "city");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].city_name;
    } else {
      return "";
    }
  },
  get_currency_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("code")
        .where({ id: id })
        .get(config.table_prefix + "master_currency");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].code;
    } else {
      return "";
    }
  },
  get_currency_id_by_name: async (currency) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ code: currency, status: 0, deleted: 0 })
        .get(config.table_prefix + "master_currency");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_submerchant_name: async (id) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },

  get_submerchant_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query = `SELECT ${
        config.table_prefix + "master_merchant_details"
      }.company_name
            FROM ${config.table_prefix + "master_merchant"}
            JOIN ${config.table_prefix + "master_merchant_details"} ON ${
        config.table_prefix + "master_merchant"
      }.id = ${config.table_prefix + "master_merchant_details"}.merchant_id
            WHERE ${config.table_prefix + "master_merchant"}.id = ${id};
            `;
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].company_name;
    } else {
      return "";
    }
  },

  get_currency_details: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .get(config.table_prefix + "master_currency");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_country_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ country_name: name })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_state_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ state_name: name })
        .get(config.table_prefix + "states");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_city_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ city_name: name })
        .get(config.table_prefix + "city");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_designation_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ designation: name, deleted: 0 })
        .get(config.table_prefix + "master_designation");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_department_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ department: name, deleted: 0 })
        .get(config.table_prefix + "master_department");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_business_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ type_of_business: name })
        .get(config.table_prefix + "master_type_of_business");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  getPricingPlan: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("plan_name")
        .where({ id: id })
        .get(config.table_prefix + "master_pricing_plan");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].plan_name;
    } else {
      return "";
    }
  },
  getPSPByPricingPlanID: async (
    id,
    currency,
    dom_int,
    payment_methods,
    payment_schemes
  ) => {
    console.log(
      "🚀 ~ getPSPByPricingPlanID: ~ id, currency, dom_int, payment_methods, payment_schemes:",
      id,
      currency,
      dom_int,
      payment_methods,
      payment_schemes
    );
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("psp")
        .where({
          master_pricing_plan_id: id,
          currency: currency,
          dom_int: dom_int,
          payment_methods: payment_methods,
          payment_schemes: payment_schemes,
        })
        .get(config.table_prefix + "pricing_plan_txn_rate");
      // console.log("🚀 ~ getPSPByPricingPlanID: ~ response:", qb.last_query())
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].psp;
    } else {
      return "";
    }
  },
  get_status: async (name) => {
    if (name === "Deactivated") {
      return 1;
    }
    if (name === "Active") {
      return 0;
    }
  },
  get_conditional_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");

    return output_string1;
  },
  get_join_conditional_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");

    return output_string1;
  },
get_and_conditional_string: async (obj) => {
  let conditions = [];

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      // If value is an array → use IN clause
      if (Array.isArray(value)) {
        if (value.length > 0) {
          const inValues = value
            .map(v => `'${v}'`)
            .join(',');
          conditions.push(`${key} IN (${inValues})`);
        }
      } 
      // Normal value → use =
      else {
        conditions.push(`${key} = '${value}'`);
      }
    }
  }

  // Join with AND
  return conditions.join(' AND ');
},


  get_and_conditional_string_in: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " in (" + obj[key] + ") ";
      }
    }
    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    return output_string1;
  },

  get_or_conditional_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "or " + key + " = '" + obj[key] + "' ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");

    return output_string1;
  },

  get_date_between_condition: async (from_date, to_date, db_date_field) => {
    return (
      "DATE(" +
      db_date_field +
      ") BETWEEN '" +
      from_date +
      "' AND '" +
      to_date +
      "'"
    );
  },

  get_amount_condition: async (from, to, db_date_field) => {
    if (from > 0 && to > 0) {
      return `${db_date_field} >= ${from} AND amount <= ${to}`;
    } else if (from > 0) {
      return `${db_date_field} >= ${from}`;
    } else if (to > 0) {
      return `${db_date_field}<= ${to}`;
    }
  },

  modified_get_date_between_condition: async (
    from_date,
    to_date,
    db_date_field
  ) => {
    return (
      "pg_inv_invoice_master." +
      db_date_field +
      " BETWEEN '" +
      from_date +
      "' AND '" +
      to_date +
      "'"
    );
  },

  get_greater_than_equal_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " >= '" + obj[key] + "' ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");

    return output_string1;
  },
  get_less_than_equal_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " <= '" + obj[key] + "' ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");

    return output_string1;
  },
  get_conditional_like_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += " and " + key + " LIKE '%" + obj[key] + "%'";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(0).join(" ");
    return output_string1;
  },
  get_conditional_like_string_modified: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "and " + key + " LIKE '%" + obj[key] + "%' ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    return output_string1;
  },
  get_conditional_or_like_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "or " + key + " LIKE '%" + obj[key] + "%' ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    return output_string1;
  },
  get_conditional_or_string: async (obj) => {
    var output_string = "";
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        output_string += "or " + key + " = " + obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    return output_string1;
  },
  get_language_json: async (condition) => {
    let response = await DBRun.exec_condition(
      "file,direction,flag,name",
      condition,
      config.table_prefix + "master_language"
    );
    const data = fs.readFileSync(
      path.resolve("public/language/" + response?.[0]?.file)
    );
    return {
      data: JSON.parse(data),
      name: response?.[0]?.name,
      direction: response?.[0]?.direction,
      flag: server_addr + "/static/language/" + response?.[0]?.flag,
    };
  },
  get_first_active_language_json: async (condition) => {
    let response = await DBRun.exec_condition_limit(
      "file,direction,flag,name",
      condition,
      1,
      config.table_prefix + "master_language"
    );
    const data = fs.readFileSync(
      path.resolve("public/language/" + response?.[0]?.file)
    );
    return {
      data: JSON.parse(data),
      name: response?.[0]?.name,
      direction: response?.[0]?.direction,
      flag: server_addr + "/static/language/" + response?.[0]?.flag,
    };
  },
  get_designation_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("designation")
        .where({ id: id })
        .get(config.table_prefix + "master_designation");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0]?.designation;
    } else {
      return "";
    }
  },

  get_subs_ref_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("ref_no")
        .where({ id: id })
        .get(config.table_prefix + "subs_plans");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].ref_no;
    } else {
      return "";
    }
  },

  get_department_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("department")
        .where({ id: id })
        .get(config.table_prefix + "master_department");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].department;
    } else {
      return "";
    }
  },
  company_details: async (condition) => {
    let response = await DBRun.exec_condition(
      "*",
      condition,
      config.table_prefix + "company_master"
    );
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  updateDetails: async (condition, data, dbtable) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_type_of_business: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("type_of_business")
        .where({ id: id })
        .get(config.table_prefix + "master_type_of_business");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].type_of_business;
    } else {
      return "";
    }
  },
  get_entity_type: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("entity")
        .where({ id: id })
        .get(config.table_prefix + "master_entity_type");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].entity;
    } else {
      return "";
    }
  },
  get_psp_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "psp");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },
  get_feature_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("feature")
        .where({ id: id })
        .get(config.table_prefix + "master_features");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].feature;
    } else {
      return "";
    }
  },
  get_psp_key_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("credentials_key")
        .where({ id: id })
        .get(config.table_prefix + "psp");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].credentials_key;
    } else {
      return "";
    }
  },
  get_psp_id_by_mid: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("psp_id")
        .where({ id: id })
        .get(config.table_prefix + "mid");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].psp_id;
    } else {
      return "";
    }
  },
  get_admin_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "adm_user");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },
  get_admin_email_by_username: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email")
        .where({ username: name })
        .get(config.table_prefix + "adm_user");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].email;
    } else {
      return "";
    }
  },
  get_customername_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },
  get_customer_info_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where({ id: id })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_psp_details_by_id: async (selection, id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where({ id: id })
        .get(config.table_prefix + "psp");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_merchant_partner: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("partner_id")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].partner_id;
    } else {
      return "";
    }
  },
  get_merchant_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mercahnt_name")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].mercahnt_name;
    } else {
      return "";
    }
  },
  get_merchant_name_by_id_from_details: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("company_name")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].company_name;
    } else {
      return "";
    }
  },
  get_merchant_name_by_merchant_id_from_details: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("company_name")
        .where({ merchant_id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].company_name;
    } else {
      return "";
    }
  },
  get_merchant_id_by_name_from_details: async (key, value) => {
    if (!key || !value) {
      return "";
    }
    let sql = `SELECT GROUP_CONCAT(merchant_id SEPARATOR ",") AS ids FROM pg_master_merchant_details WHERE company_name ='${value}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response.length > 0) {
      return `${key} IN (${response?.[0]?.ids})`;
    } else {
      return null;
    }
    //return `${key} IN (${valueCondition})`;
  },
  get_merchant_id_by_name_from_details_id: async (value) => {
    let sql = `SELECT merchant_id  FROM pg_master_merchant_details WHERE company_name ='${value}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response.length > 0) {
      return response?.[0]?.merchant_id;
    } else {
      return null;
    }
  },
  get_supermerchant_id_by_name: async (key, value) => {
    if (!key || !value) {
      return "";
    }
    let sql = `SELECT GROUP_CONCAT(id SEPARATOR ",") AS ids FROM pg_master_super_merchant WHERE legal_business_name ='${value}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response.length > 0) {
      return `${key} IN (${response?.[0]?.ids})`;
    } else {
      return null;
    }
    //return `${key} IN (${valueCondition})`;
  },
  get_referrer_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("full_name")
        .where({ id: id })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].full_name;
    } else {
      return "";
    }
  },

  get_referrer_merchant_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id,submerchant_id")
        .where({ id: id })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_captured_date: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("created_at")
        .where({ order_id: id, order_status: "CAPTURED" })
        .get(config.table_prefix + "referral_bonus");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].created_at == "0000-00-00 00:00:00"
        ? ""
        : moment(response?.[0].created_at).format("DD-MM-YYYY HH:mm:ss");
    } else {
      return "";
    }
  },
  get_merchant_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ super_merchant_id: id })
        .limit(1)
        .order_by("id", "asc")
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_merchant_email: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].email;
    } else {
      return "";
    }
  },
  get_merchant_referral_code: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("referral_code")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].referral_code;
    } else {
      return "";
    }
  },
  get_super_merchant_referral_code: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("referral_code")
        .where({ id: id })
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].referral_code;
    } else {
      return "";
    }
  },
  get_referral_code: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("referral_code")
        .where({ id: id })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].referral_code;
    } else {
      return "";
    }
  },
  get_settlement: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("settlement_frequency,settlement_date")
        .where({ id: id })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_monthly_invoice_payout_date: async (condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("payout_date")
        .where(condition)
        .order_by("id", "desc")
        .get(config.table_prefix + "referral_bonus_monthly_invoice");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].payout_date;
    } else {
      return "";
    }
  },
  get_invoice_payout_date: async (condition) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("payout_date")
        .where(condition)
        .order_by("id", "desc")
        .get(config.table_prefix + "referrer_invoice_payout");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].payout_date;
    } else {
      return "";
    }
  },
  get_referrer_id_by_referral_code: async (referral_code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ referral_code: referral_code })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return 0;
    }
  },
  get_supermerchant_email: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email")
        .where({ id: id })
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].email;
    } else {
      return "";
    }
  },
  get_submerchant_email: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].email;
    } else {
      return "";
    }
  },
  get_super_merchant: async (referral_code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ referral_code_used: referral_code })
        .limit(1)
        .order_by("id", "asc")
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_super_merchant_name: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name,legal_business_name")
        .where({ id: id })
        .limit(1)
        .order_by("id", "asc")
        .get(config.table_prefix + "master_super_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].name
        ? response?.[0].name
        : response?.[0].legal_business_name;
    } else {
      return "";
    }
  },

  get_super_merchant_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("super_merchant_id")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].super_merchant_id;
    } else {
      return "";
    }
  },

  get_live_data: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("live")
        .where({ super_merchant_id: id })
        .limit(1)
        .order_by("id", "asc")
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].live;
    } else {
      return "";
    }
  },
  get_sub_merchant_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("company_name")
        .where({ merchant_id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].company_name;
    } else {
      return "";
    }
  },
  get_feature_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("feature")
        .where({ id: id })
        .get(config.table_prefix + "master_features");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].feature;
    } else {
      return "";
    }
  },
  get_sub_merchant_email_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("legal_person_email")
        .where({ merchant_id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].legal_person_email;
    } else {
      return "";
    }
  },
  get_customer_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("prefix,name")
        .where({ id: id })
        .get(config.table_prefix + "inv_customer");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].prefix + " " + response?.[0].name;
    } else {
      return "";
    }
  },
  get_merchantdetails_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("company_name")
        .where({ merchant_id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].company_name;
    } else {
      return "";
    }
  },
  get_fraud_data: async (order_id, mode) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "rule_id,order_id,email,mode,rule_if_fail,message,added_date,scenario"
        )
        .where({ order_id: order_id, mode: mode })
        .get(config.table_prefix1 + "request_list");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0] && response?.[0]?.rule_id) {
      let rule_obj = {
        rule_id: response?.[0].rule_id ? response?.[0].rule_id + 100000 : "",
        order_id: response?.[0].order_id,
        email: response?.[0].email,
        mode: capitalizeFirstLetter(response?.[0].mode),
        rule_if_fail: response?.[0].rule_if_fail,
        message: response?.[0].message,
        added_date: moment(response?.[0].added_date).format(
          "DD-MM-YYYY HH:mm:ss"
        ),
        scenario: capitalizeFirstLetter(response?.[0].scenario),
      };

      return rule_obj;
    } else {
      return {};
    }
  },
  get_response_code: async (psp, psp_code) => {
    if (psp) {
      psp = psp.toLowerCase();
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where({ psp_response_code: psp_code, psp_name: psp })
        .get(config.table_prefix + "response_code");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_last_transaction: async (order_id) => {
    let table = config.table_prefix + "order_txn";
    let sql = `select psp_code from ${table} where order_id = ${order_id} order by id desc limit 1`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_merchantdetails_url_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("link_tc,link_pp")
        .where({ merchant_id: id })
        .get(config.table_prefix + "master_merchant_details");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_title: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("title").get(config.table_prefix + "title");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].title;
    } else {
      return "";
    }
  },
  get_partner_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "master_partners");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },

  insert_data: async (data, dbtable) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + dbtable, data);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },

  get_data_list: async (selection, dbtable, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + dbtable);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_data_list1: async (selection, dbtable, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by("id desc")
        .limit(1)
        .get(config.table_prefix + dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  get_document_data_list: async (selection, dbtable, condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .get(config.table_prefix + dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_merchant_currency: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("currency")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].currency;
    } else {
      return "";
    }
  },
  get_token_check: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "DESC")
        .limit(1)
        .get(config.table_prefix + "password_token_check");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_otp_check: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "DESC")
        .limit(1)
        .get(config.table_prefix + "email_otp_sent");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_mobile_otp_check: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by("id", "DESC")
        .limit(1)
        .get(config.table_prefix + "mobile_otp");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_mcc_category_name_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mcc_category")
        .where({ id: id })
        .get(config.table_prefix + "master_mcc_category");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].mcc_category;
    } else {
      return "";
    }
  },
  get_mcc_category_id_by_name: async (name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ mcc_category: name })
        .get(config.table_prefix + "master_mcc_category");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },

  get_mcc_code_description: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("description")
        .where({ id: id })
        .get(config.table_prefix + "mcc_codes");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].description;
    } else {
      return "";
    }
  },

  get_mcc_category_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mcc_category")
        .where({ id: id })
        .get(config.table_prefix + "master_mcc_category");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].mcc_category;
    } else {
      return "";
    }
  },

  get_document_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ entity_id: id })
        .get(config.table_prefix + "master_entity_document");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_document_type: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("document_type")
        .where({ id: id })
        .get(config.table_prefix + "master_document_type");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.document_type;
    } else {
      return "";
    }
  },
  get_document_group_required: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("group_required")
        .where({ id: id })
        .get(config.table_prefix + "master_document_type");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].group_required;
    } else {
      return "";
    }
  },
  getDocumentRequired: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("is_required")
        .where({ id: id })
        .get(config.table_prefix + "master_document_type");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.is_required;
    } else {
      return "";
    }
  },
  get_multiple_ids_encrypt: (ids_cs) => {
    let ids_css = String(ids_cs);
    let code_array = ids_css.split(",");
    let new_codes_array = [];
    for (i of code_array) {
      new_codes_array.push(encrypt_decrypt("encrypt", i));
    }
    return new_codes_array.join();
  },

  complete_kyc_step: async (merchant_id, step) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("step_completed")
        .where({ id: merchant_id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    let sequence;
    if (response?.[0].step_completed != "") {
      let sequence_arr = response?.[0].step_completed.split(",");

      if (sequence_arr.includes(step.toString())) {
        return;
      } else {
        sequence_arr.push(step);
      }
      sequence_arr.sort();
      sequence = sequence_arr.join(",");
    } else {
      sequence = step;
    }

    qb = await pool.get_connection();
    try {
      await qb
        .set({ step_completed: sequence })
        .where({ id: merchant_id })
        .update(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return;
  },

  doc_names: (seq) => {
    let req = {
      1: "Trade license",
      2: "ID proof",
      3: "ID proof auth sign",
      4: "MOA",
      5: "Proof of bank account",
    };
    return req[seq];
  },
  ekyc_steps: (seq) => {
    let req = {
      1: "Business Type",
      2: "Business details",
      3: "Business representative",
      4: "Business owners",
      5: "Business executives",
      6: "Public details",
      7: "Bank details",
    };
    return req[seq];
  },
  pushNotification: async (
    gcmid,
    title,
    message,
    url_,
    type,
    payload,
    user
  ) => {
    let apiKey = "OTk2NjE4OWItOWJhOC00MTNhLWJlYTktMDczOWQyZTBjN2I0";
    let url = "https://onesignal.com/api/v1/notifications";

    let content = { en: message };
    let headings = { en: title };

    let fields = JSON.stringify({
      include_player_ids: [gcmid],
      app_id: "4ca5a703-bb3d-4504-9a04-14df43d69cde",
      body: message,
      headings: headings,
      contents: content,
      title: title,
      small_icon: "",
      large_icon: "",
      content_available: true,
      data: {
        title: title,
        message: message,
        type: type,
        payload: payload,
      },
    });

    async function makeRequest(res_data, p_url, apiKey) {
      try {
        const config = {
          method: "post",
          data: res_data,
          url: p_url,
          headers: {
            Authorization: "Basic " + apiKey,
            "Content-Type": "application/json",
          },
        };

        let res = await axios(config);
        return res.data;
      } catch (error) {
        logger.error(500, { message: error, stack: error?.stack });
      }
    }
    makeRequest(fields, url, apiKey);
  },

  pushNotificationtesting: async (
    gcmid = "6d422d5d-2dbf-4d44-a21d-6a3eb3594a31",
    title = "testing-title",
    message = "testing message",
    url_ = "testing url",
    type = "testing type",
    payload = { abc: "payload object" },
    user = "test user"
  ) => {
    let apiKey = "MGRhMzM5N2YtNWFkYS00NjgxLTk2OTQtMDBiZjMyNTgzM2Nj";
    url = "https://onesignal.com/api/v1/notifications";

    let content = { en: message };
    let headings = { en: title };

    let fields = JSON.stringify({
      include_player_ids: [gcmid],
      app_id: "3fcfcc5c-70f4-4645-8035-1b71a790e4ce",
      body: message,
      headings: headings,
      contents: content,
      title: "title",
      small_icon: "",
      large_icon: "",
      content_available: true,
      data: {
        title: title,
        message: message,
        type: type,
        payload: payload,
      },
    });

    function makeRequest(res_data, p_url, apiKey) {
      try {
        const config = {
          method: "post",
          data: res_data,
          url: p_url,
          headers: {
            Authorization: "Basic " + apiKey,
            "Content-Type": "application/json",
          },
        };

        let res = axios(config);

        return res.data;
      } catch (error) {
        logger.error(500, { message: error, stack: error?.stack });
      }
    }
    makeRequest(fields, url, apiKey);
  },

  get_latest_tc_version_id: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,version")
        .where({ deleted: 0 })
        .order_by("id", "DESC")
        .get(config.table_prefix + "tc");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  getCustomerID: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({
          deleted: 0,
          email: data.email,
          submerchant_id: data.submerchant_id,
          merchant_id: data.merchant_id,
        })

        .get(config.table_prefix + "inv_customer");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      let response = await qb
        .returning("id")
        .insert(config.table_prefix + "inv_customer", data);
      return response.insertId;
    }
  },
  getInvCustomerName: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({
          deleted: 0,
          id: id,
        })

        .get(config.table_prefix + "inv_customer");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },
  getInvItemRate: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("item_rate")
        .where({
          is_deleted: 0,
          id: id,
        })

        .get(config.table_prefix + "master_items");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].item_rate;
    } else {
      return "";
    }
  },
  getMerchantAndSubMerchantID: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,super_merchant_id")
        .where({ name: data.name })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  getItemId: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({
          item_name: data.name,
          merchant_id: data.merchant_id,
          submerchant_id: data.submerchant_id,
        })
        .get(config.table_prefix + "master_items");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      let qb = await pool.get_connection();
      let response;
      try {
        response = await qb
          .returning("id")
          .insert(config.table_prefix + "master_items", {
            item_name: data.name,
            merchant_id: data.merchant_id,
            item_rate: data.item_rate,
            status: 0,
            is_deleted: 0,
            submerchant_id: data.submerchant_id,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          });
      } catch (error) {
        console.error("Database query failed:", error);
        logger.error(500, { message: error, stack: error?.stack });
      } finally {
        qb.release();
      }
      return response.insertId;
    }
  },

  get_refunded_amount: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select_sum("amount")
        .where({ order_id: order_id, type: "REFUNDED", status: "APPROVED" })
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return 0.0;
    }
  },

  get_refunded_amount_by_txn: async (txn_id, mode = "live") => {
    let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select_sum("amount")
        .where({
          txn_ref_id: txn_id,
          is_voided: 0,
          status: "AUTHORISED",
          type: ["REFUND", "PARTIALLY_REFUND"],
        })
        .get(config.table_prefix + txn_table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return 0.0;
    }
  },
  get_capture_sum_by_order: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select_sum("amount")
        .where({
          order_id: order_id,
          is_voided: 0,
          status: "AUTHORISED",
          type: ["REFUND", "PARTIAL_REFUND"],
        })
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return 0.0;
    }
  },
  get_capture_amount_by_txn: async (txn_id, mode = "live") => {
    let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("amount")
        .where({ txn: txn_id })
        .get(config.table_prefix + txn_table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    //console.log(qb.last_query());
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return 0;
    }
  },
  get_capture_amount_by_order_id: async (order_id, mode = "live") => {
    let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select_sum("amount")
        .where({
          order_id: order_id,
          type: ["CAPTURE", "PARTIALLY_CAPTURE"],
          is_voided: 0,
        })
        .get(config.table_prefix + txn_table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    //console.log(qb.last_query());
    //console.log(response);
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return 0;
    }
  },
  checkTxnVoided: async (txn_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("txn")
        .where({ txn_ref_id: txn_id, is_voided: 1, status: "AUTHORISED" })
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return false;
    } else {
      return true;
    }
  },
  get_latest_type_of_txn: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("type")
        .where({ order_id: order_id })
        .order_by("created_at")
        .limit(1)
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].type;
    } else {
      return "";
    }
  },
  get_high_risk: async (name) => {
    if (name === "suspicious_ip") {
      return "block_for_suspicious_ip";
    }
    if (name === "high_risk_country") {
      return "high_risk_country";
    }
    if (name === "high_risk_transaction") {
      return "high_risk_transaction";
    }
    if (name === "high_volume_transaction") {
      return "block_for_transaction_limit";
    }
    if (name === "suspicious_emails") {
      return "block_for_suspicious_email";
    }
  },
  make_sequential_no: async (pre) => {
    let num = "";
    try {
      num = generateUniqueId({
        length: 12,
        useLetters: false,
      });
      /*
      switch (pre) {
        case "ORD":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "orders");

          break;
        case "TST_ORD":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "test_orders");

          break;
        case "TXN":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "order_txn");
          break;
        case "TST_TXN":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "test_order_txn");
          break;
        case "SUB":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "subscription");
          break;
        case "REQ":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "generate_request_id");
          break;
        case "TST_REQ":
          response = await qb
            .select("id")
            .order_by("id", "desc")
            .limit(1)
            .get(config.table_prefix + "test_generate_request_id");
          break;
      } */
    } catch (error) {
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
    }
    return num;
  },
  fetch_browser_fingerprint: async (card_id) => {
    let condition = { id: enc_dec.cjs_decrypt(card_id) };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("browser_token")
        .where(condition)
        .get(config.table_prefix + "customers_cards");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return parseInt(response?.[0].browser_token);
  },
  last_transactions: async (card_id, status) => {
    let condition = { card_id: card_id, status: status };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get(config.table_prefix + "orders");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0].created_at;
  },
  last_transactions_using_token: async (browser_token, status, table) => {
    let condition = { browser_fingerprint: browser_token, status: status };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.created_at != "" ? response?.[0]?.created_at : "NA";
  },
  get_orders_count: async (browser_token, table) => {
    let condition = { browser_fingerprint: browser_token };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("count(id) as total", false)
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.total != "" ? response?.[0]?.total : 0;
  },
  get_terms_and_condition: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("tc")
        .where({ deleted: 0, type: "customer" })
        .order_by("id", "desc")
        .limit(1)
        .get(config.table_prefix + "tc");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0].tc;
  },
  get_customer_name: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("name")
        .where({ id: id })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].name;
    } else {
      return "";
    }
  },
  getMerchantAndSubMerchant_id_get_company_name: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("md.merchant_id,mm.super_merchant_id")
        .where({ "md.company_name": data })
        .from(config.table_prefix + "master_merchant_details md")
        .join(
          config.table_prefix + "master_merchant mm",
          "md.merchant_id=mm.id",
          "inner"
        )
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  getMerchantAndSubMerchant_id_by_company_name: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("md.merchant_id,mm.super_merchant_id")
        .where({ "md.company_name": data.name })
        .from(config.table_prefix + "master_merchant_details md")
        .join(
          config.table_prefix + "master_merchant mm",
          "md.merchant_id=mm.id",
          "inner"
        )
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  keyByArr: async (obj, key, skip_zero = 1) => {
    var result = [];
    obj.map(function (entity) {
      if (!result.includes(entity[key])) {
        if (skip_zero && !entity[key]) {
          return;
        } else {
          result.push(entity[key]);
        }
      }
    });
    return result;
  },
  get_plan_id: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select_max("id")
        .get(config.table_prefix + "subs_plans");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return 10000000 + response?.[0].id;
    } else {
      return 10000001;
    }
  },
  get_subs_plan_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("plan_id")
        .where({ id: id })
        .get(config.table_prefix + "subs_plans");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].plan_id;
    } else {
      return "";
    }
  },
  cerate_terminalid: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select_max("id").get(config.table_prefix + "mid");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return 10000000 + response?.[0].id;
    } else {
      return 10000001;
    }
  },

  get_mid_by_merchant_id: async (merchant_id, currency, mode) => {
    let condition = {
      "m.submerchant_id": merchant_id,
      "m.deleted": 0,
      "m.env": mode,
      "c.code": currency,
    };
    let qb = await pool.get_connection();
    const class_ = ["ecom"];
    let response;
    try {
      let dcc_enabled = await dccStatusFetch();
      if (dcc_enabled) {
        let queryStr = `SELECT *, m.id as midId FROM pg_mid m INNER JOIN pg_master_currency c ON m.currency_id = c.id WHERE m.submerchant_id = ${merchant_id} AND m.deleted = 0 AND m.env = '${mode}' AND (c.code = '${currency}' OR FIND_IN_SET('${currency}', m.supported_currency) > 0)`;
        response = await qb.query(queryStr);
      } else {
        response = await qb
          .select("*,m.id as midId")
          .from(config.table_prefix + "mid m")
          .join(
            config.table_prefix + "master_currency c",
            "m.currency_id=c.id",
            "inner"
          )
          .where(condition)
          .get();
      }
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_ecom_mid_by_merchant_id: async (merchant_id, currency, mode) => {
    let condition = {
      "m.submerchant_id": merchant_id,
      "m.deleted": 0,
      "m.env": mode,
      "c.code": currency,
    };
    let qb = await pool.get_connection();
    const class_ = ["ecom"];
    let response;
    try {
      let dcc_enabled = await dccStatusFetch();
      if (dcc_enabled) {
        let queryStr = `SELECT *, m.id as midId FROM pg_mid m INNER JOIN pg_master_currency c ON m.currency_id = c.id WHERE m.class LIKE '%ecom%' AND m.submerchant_id = ${merchant_id} AND m.deleted = 0 AND m.env = '${mode}' AND (c.code = '${currency}' OR FIND_IN_SET('${currency}',m.supported_currency)>0)`;
        response = await qb.query(queryStr);
      } else {
        response = await qb
          .select("*,m.id as midId")
          .from(config.table_prefix + "mid m")
          .join(
            config.table_prefix + "master_currency c",
            "m.currency_id=c.id",
            "inner"
          )
          .like("m.class", "ecom")
          // .where_in("m.class",class_)
          .where(condition)
          .get();
      }
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_apple_mid_by_merchant_id: async (merchant_id, currency, mode) => {
    let condition = {
      "m.submerchant_id": merchant_id,
      "m.deleted": 0,
      "m.env": mode,
      "c.code": currency,
    };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*,m.id as midId, p.credentials_key as psp")
        .from(config.table_prefix + "mid m")
        .join(
          config.table_prefix + "master_currency c",
          "m.currency_id=c.id",
          "inner"
        )
        .join(config.table_prefix + "psp p", "m.psp_id=p.id", "inner")
        .like("m.payment_methods", "Apple Pay")
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },

  keyByValue: async (obj, key, skip_zero = 1) => {
    var result = {};
    obj.map(function (entity) {
      if (!result[entity[key]]) {
        if (skip_zero && !entity[key]) {
          return;
        } else {
          result[entity[key]] = entity;
        }
      }
    });
    return result;
  },

  get_cipher_keys_by_ids: async (idsArr) => {
    if (!idsArr[0]) {
      return {};
    }
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("private_key,private_iv,id")
        .where({ id: idsArr })
        .get(config.table_prefix + "secret_key");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response) {
      var result = {};
      response.map(function (entity) {
        result[entity.id] = {
          private_key: entity.private_key,
          private_iv: entity.private_iv,
        };
      });
      return result;
    } else {
      return {};
    }
  },

  checkCardExistByCardNoAndCID: async (condition, card_no) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .get(config.table_prefix + "customers_cards");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      let cipher_keys_ids = await helpers.keyByArr(response, "cipher_id");
      let card_number_arr = await helpers.keyByArr(response, "card_number");
      let card_number_cipher = await helpers.keyByValue(
        response,
        "card_number"
      );

      let cipher_keys = await helpers.get_cipher_keys_by_ids(cipher_keys_ids);
      let card_found = false;
      for (let i = 0; i < card_number_arr.length; i++) {
        let private_key =
          cipher_keys[card_number_cipher[card_number_arr[i]].cipher_id]
            .private_key;
        let private_iv =
          cipher_keys[card_number_cipher[card_number_arr[i]].cipher_id]
            .private_iv;
        let enc_card_no = await enc_dec.dynamic_encryption(card_no, 0, {
          private_key: private_key,
          private_iv: private_iv,
        });
        if (card_number_arr[i] === enc_card_no) {
          card_found = card_number_cipher[card_number_arr[i]];
          break;
        }
      }
      return card_found;
    } else {
      return false;
    }
  },
  GetSubscriberID: async (plan_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("subscription_id")
        .from(config.table_prefix + "subscription")
        .where({ plan_id: plan_id, is_customer_subscribed: 1, status: 1 })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  countSubscriber: async (plan_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("count(id) as total", false)
        .from(config.table_prefix + "subscription")
        .where({ plan_id: plan_id, is_customer_subscribed: 1 })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.total ? response?.[0]?.total : 0;
  },
  LastSubscriberDate: async (plan_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("added_date", false)
        .from(config.table_prefix + "subscription")
        .where({ plan_id: plan_id, is_customer_subscribed: 1 })
        .order_by("id", "desc")
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.added_date
      ? moment(response?.[0]?.added_date).format("DD-MM-YYYY HH:mm:ss")
      : "";
  },
  main_super_merchant_mode: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mode")
        .from(config.table_prefix + "master_merchant")
        .where(condition)
        .order_by("id", "asc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.mode;
  },

  get_common_response: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "response_code,response_details,response_type,soft_hard_decline"
        )
        .where(condition)
        .get(config.table_prefix + "response_code");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return { status: "success", response };
    } else {
      return {
        response: [
          {
            response_code: "",
            response_details: "",
            response_type: "",
            soft_hard_decline: "",
          },
        ],
        message: "Unknown or Exception Error",
        status: "fail",
        code: 100,
      };
    }
  },

  common_add: async (data, table) => {
    console.log(`calling common add function`);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + table, data);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },

  common_fetch: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .limit(1)
        .order_by("id", "desc")
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_referrer_currency_by_country: async (country_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("currency")
        .where({ id: country_id })
        .limit(1)
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.currency;
  },
  get_currency_symbol_by_currency_code: async (currency_code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("symbol")
        .where({ code: currency_code })
        .limit(1)
        .get(config.table_prefix + "master_currency");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.symbol;
  },
  count_no_of_times_invoice_shared: async (invoice_id, type) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,invoice_id,email,cc,created_at")
        .where({ invoice_id: invoice_id })
        .get(config.table_prefix + "invoice_sharing_logs");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (type == "length") {
      return response ? response.length : 0;
    } else {
      return response;
    }
  },
  make_referral_txn_ref_no: async (pre) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(config.table_prefix + "referral_bonus")
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    let max_id = 1;
    if (response?.[0]) {
      max_id = response?.[0]?.id;
    }
    max_id = 8000000000 + parseInt(max_id);
    let str = max_id;
    return str;
  },

  generateTable: async (
    initialPayDate,
    payment_interval,
    paymentFrequencyType,
    followedBy,
    subscription_id,
    customer_email,
    payment_id,
    initial_payment_amount,
    final_payment_amount,
    plan_billing_amount,
    plan_id
  ) => {
    const table = [];
    const subscriptionId = subscription_id;
    const customerEmail = customer_email;
    table.push({
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      next_due_date: initialPayDate,
      is_paid: 1,
      payment_id: payment_id,
      amount: initial_payment_amount,
      plan_id: plan_id,
    });
    let nextDueDate = moment(initialPayDate);
    let payment_interval_counter = 1;
    for (let i = 0; i < followedBy - 2; i++) {
      const calculatedDueDate = await calculateNextDueDate(
        nextDueDate,
        payment_interval,
        paymentFrequencyType
      );
      table.push({
        subscription_id: subscriptionId,
        customer_email: customerEmail,
        next_due_date: calculatedDueDate,
        amount: plan_billing_amount,
        plan_id: plan_id,
      });
      nextDueDate = moment(calculatedDueDate).add(
        payment_interval * payment_interval_counter,
        paymentFrequencyType
      );
      payment_interval_counter++;
    }
    table[table.length - 1].amount = final_payment_amount;
    return table;
  },
  generateTableNew: async (
    initialPayDate,
    payment_interval,
    paymentFrequencyType,
    followedBy,
    subscription_id,
    customer_email,
    payment_id,
    initial_payment_amount,
    final_payment_amount,
    plan_billing_amount,
    plan_id
  ) => {
    const table = [];
    const subscriptionId = subscription_id;
    const customerEmail = customer_email;
    table.push({
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      next_due_date: initialPayDate,
      is_paid: 1,
      payment_id: payment_id,
      amount: initial_payment_amount,
      plan_id: plan_id,
    });
    let nextDueDate = moment(initialPayDate);
    let payment_interval_counter = 1;

    const final_terms = followedBy - 2;
    const payment_due_amount = plan_billing_amount / followedBy;

    for (let i = 1; i <= final_terms; i++) {
      const calculatedDueDate = await calculateNextDueDate(
        nextDueDate,
        payment_interval,
        paymentFrequencyType
      );
      table.push({
        subscription_id: subscriptionId,
        customer_email: customerEmail,
        next_due_date: calculatedDueDate,
        amount: payment_due_amount,
        plan_id: plan_id,
      });
      nextDueDate = moment(calculatedDueDate).add(
        payment_interval * payment_interval_counter,
        paymentFrequencyType
      );
      payment_interval_counter++;
    }

    const calculatedDueDate = await calculateNextDueDate(
      nextDueDate,
      payment_interval,
      paymentFrequencyType
    );
    table.push({
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      next_due_date: calculatedDueDate,
      amount: final_payment_amount,
      plan_id: plan_id,
    });

    //table[table.length - 1].amount = final_payment_amount;
    return table;
  },

  check_auto_approval_of_referrer: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("auto_approve_referrer")
        .from(config.table_prefix + "company_master")
        .where({ id: 1 })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0].auto_approve_referrer == 0) {
      return true;
    } else {
      return false;
    }
  },
  get_master_referrer_by_currency: async (currency) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "master_referral_bonus")
        .where({ deleted: 0, currency: currency })
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_master_id_by_mid: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(config.table_prefix + table)
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0]?.id;
  },
  get_recurring_by_subscription_id: async (subscription_id, limit) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("next_due_date,amount,is_paid,order_id,payment_id, is_failed")
        .from(config.table_prefix + "subscription_recurring")
        .where({ subscription_id: subscription_id })
        .limit(limit)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_recurring_sum_amount: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let is_terms_con = "";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select sum(amount) as amount from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].amount;
    } else {
      return " ";
    }
  },
  get_recurring_count_by_subscription_id: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(
        "select count(id) as total from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0].total;
  },
  get_active_subscribers: async (condition_obj) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.query(
        "select count(DISTINCT subscription_id) as count from " +
          config.table_prefix +
          "subscription_recurring" +
          " where is_paid=0  and subscription_id IN (" +
          condition_obj +
          ")"
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response?.[0].count;
  },
  get_recurring_data: async (condition_obj, order) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let is_terms_con = "";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select  amount,next_due_date,is_paid from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition +
          "order by id " +
          order
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_recurring_start_next_date: async (condition_obj, order) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select id,amount,next_due_date,is_paid,response from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition +
          "order by id " +
          order +
          " LIMIT 1"
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_recurring_last_status: async (condition_obj) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.query(
        "select response,is_paid,is_failed from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition +
          " and ( is_paid=1 or is_failed=1 ) order by id desc limit 1"
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0] ? response?.[0] : "";
  },
  get_recurring_last_due_date: async (condition_obj, order) => {
    let condition = await helpers.get_conditional_string(condition_obj);
    let is_terms_con = "";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select next_due_date from " +
          config.table_prefix +
          "subscription_recurring" +
          " where " +
          condition +
          "order by id desc"
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  get_country_code_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_code")
        .where({ id: id })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_code;
    } else {
      return "";
    }
  },
  get_common_subscriber_id: async (email, mode, id) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("id")
        .where({ email: email, mode: mode })
        .order_by("id", "asc")
        .limit(1)
        .get(config.table_prefix + "subscription");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_common_subscriber_email_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email")
        .where({ id: id })
        .order_by("id", "asc")
        .limit(1)
        .get(config.table_prefix + "subscription");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].email;
    } else {
      return "";
    }
  },
  get_country_id_by_code: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ country_code: id })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  get_country_details_by_code: async (code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id,country_name")
        .where({ country_code: code })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },

  get_country_code_by_name: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_code")
        .where({ "LOWER(country_name)": id })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].country_code;
    } else {
      return "";
    }
  },
  get_payment_mode_by_id: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("payment_mode")
        .where({ id: id })
        .get(config.table_prefix + "payment_mode");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].payment_mode;
    } else {
      return "";
    }
  },

  check_if_currency_value_exist: async (psp, currency, table) => {
    let like_str = "";
    if (currency) {
      const currencyArray = currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = ` ${currencyQuery} `;
    }
    let query =
      `select * from ${
        config.table_prefix + table
      } where psp = ${psp} and deleted = 0 and (` +
      like_str +
      `)`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  check_if_mcc_value_exist: async (psp, mcc, table, master_id) => {
    let like_str = "";
    let master_con = "";
    if (master_id != "") {
      master_con = ` and  id!=` + master_id;
    }
    if (mcc) {
      const mcc_codes = mcc.split(",");
      const mcc_code_array = [];
      for (val of mcc_codes) {
        mcc_code_array.push(enc_dec.cjs_decrypt(val));
      }
      let array_mcc = mcc_code_array.join(",");
      const currencyConditions = mcc_code_array.map(
        (array_mcc) => ` mcc_category LIKE '%${array_mcc}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = ` and ( ${currencyQuery} )`;
    }
    let query =
      `select * from ${
        config.table_prefix + table
      } where psp = ${psp} and deleted = 0 ` +
      master_con +
      like_str +
      ``;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  check_buy_rate: async (
    master_id = null,
    req,
    currency = null,
    mcc = null,
    table
  ) => {
    let { psp, country } = req.body.master_data;
    psp = enc_dec.cjs_decrypt(psp);
    country = enc_dec.cjs_decrypt(country);
    let like_str = "";
    let mcc_str = "";
    if (currency) {
      const currencyConditions = currency
        .split(",")
        .map((currency) => `currency LIKE '%${currency}%'`);
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND (${currencyQuery})`;
    }

    if (mcc) {
      const currencyConditions = mcc.split(",").map((mc) => {
        let id = enc_dec.cjs_decrypt(mc);
        return `FIND_IN_SET('${id}', mcc_category) > 0`;
      });
      const currencyQuery = currencyConditions.join(" OR ");
      mcc_str = `AND (${currencyQuery})`;
    }

    let query = `select * from ${config.table_prefix + table} 
    where deleted = 0
    AND country_id = ${country} AND psp=${psp}
    ${like_str} 
    ${mcc_str} 
    `;
    if (master_id) {
      query += `AND id=${master_id}`;
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  check_if_currency_value_exist_pricing: async (currency, table, plan_name) => {
    let like_str = "";
    if (currency) {
      const currencyArray = currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND (${currencyQuery})`;
    }
    let query =
      `select * from ${
        config.table_prefix + table
      } where deleted = 0 and plan_name = '${plan_name}' ` + like_str;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },

  check_if_data_exist: async (condition, currency, table) => {
    let final_cond = " where ";
    let like_str = "";

    if (currency) {
      const currencyArray = currency.split(",");
      const currencyConditions = currencyArray.map(
        (currency) => `currency LIKE '%${currency}%'`
      );
      const currencyQuery = currencyConditions.join(" OR ");
      like_str = `AND (${currencyQuery})`;
    }

    if (Object.keys(condition).length) {
      let data_condition_str = await helpers.get_and_conditional_string(
        condition
      );
      if (final_cond == " where ") {
        final_cond = final_cond + data_condition_str;
      } else {
        final_cond = final_cond + " and " + data_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query =
      `select * from ${config.table_prefix + table}` + final_cond + like_str;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  check_if_data_currency_exist: async (condition, table) => {
    let final_cond = " where ";
    let like_str = "";

    if (Object.keys(condition).length) {
      let data_condition_str = await helpers.get_and_conditional_string(
        condition
      );
      if (final_cond == " where ") {
        final_cond = final_cond + data_condition_str;
      } else {
        final_cond = final_cond + " and " + data_condition_str;
      }
    }

    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = `select * from ${config.table_prefix + table}` + final_cond;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  get_sub_merchant_currency_from_mid: async (merchant_id) => {
    let response;
    let currency = [];
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("m.currency_id")
        .from(config.table_prefix + "mid m")
        .where({ "m.submerchant_id": merchant_id, "m.deleted": 0 })
        .group_by("m.currency_id")
        .get();
      if (response?.length > 0) {
        for (let record of response) {
          let response1 = await qb
            .select("code")
            .from(config.table_prefix + "master_currency")
            .where({ id: record.currency_id })
            .limit(1)
            .get();
          currency.push(response1?.[0].code);
        }
      } else {
        currency = ["AED", "USD"];
      }
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return currency;
  },
  get_sub_merchant_currency_from_mid_env: async (merchant_id, env) => {
    let response;
    let currency = [];
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("m.currency_id")
        .from(config.table_prefix + "mid m")
        .where({ "m.submerchant_id": merchant_id, env: env, "m.deleted": 0 })
        .group_by("m.currency_id")
        .get();
      if (response?.length > 0) {
        for (let record of response) {
          let response1 = await qb
            .select("code")
            .from(config.table_prefix + "master_currency")
            .where({ id: record.currency_id })
            .limit(1)
            .get();
          currency.push(response1?.[0].code);
        }
      } else {
        currency = ["AED", "USD"];
      }
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return currency;
  },
  get_sub_merchant_currency_from_mid_env: async (merchant_id, env) => {
    let response;
    let currency = [];
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("m.currency_id")
        .from(config.table_prefix + "mid m")
        .where({ "m.submerchant_id": merchant_id, env: env, "m.deleted": 0 })
        .group_by("m.currency_id")
        .get();
      if (response?.length > 0) {
        for (let record of response) {
          let response1 = await qb
            .select("code")
            .from(config.table_prefix + "master_currency")
            .where({ id: record.currency_id })
            .limit(1)
            .get();
          currency.push(response1?.[0].code);
        }
      } else {
        currency = ["AED", "USD"];
      }
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return currency;
  },
  common_delete: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.delete(config.table_prefix + table, condition);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  get_trans_data: async (order_id, mode) => {
    let query = "";
    if (mode === "test") {
      query = `SELECT
                    ORR.order_id,
                    ORR.last_request_id,
                    OT.paydart_category,
                    OT.psp_code,
                    OT.last_psp_txn_id,
                    OT.last_psp_ref_id,
                    OT.last_txn_id
                    FROM
                    (
                        SELECT
                        order_id,
                        MAX(request_id) AS last_request_id
                        FROM
                        pg_test_generate_request_id
                        WHERE
                        order_id = ${order_id}
                        GROUP BY
                        order_id
                    ) AS ORR
                    LEFT JOIN
                    (
                        SELECT
                        order_id,paydart_category,psp_code,
                        order_reference_id AS last_psp_txn_id,
                        payment_id AS last_psp_ref_id,
                        txn AS last_txn_id
                        FROM
                        pg_test_order_txn
                        WHERE
                        order_id = ${order_id} and status!='AWAIT_3DS'
                        order by id asc limit 1
                    ) AS OT
                    ON
                    ORR.order_id = OT.order_id;`;
    } else {
      query = `SELECT
                    ORR.order_id,
                    ORR.last_request_id,
                     OT.paydart_category,
                    OT.psp_code,
                    OT.last_psp_txn_id,
                    OT.last_psp_ref_id
                    FROM
                    (
                        SELECT
                        order_id,
                        MAX(request_id) AS last_request_id
                        FROM
                        pg_generate_request_id
                        WHERE
                        order_id = ${order_id}
                        GROUP BY
                        order_id
                    ) AS ORR
                    LEFT JOIN
                    (
                        SELECT
                         order_id,paydart_category,psp_code,
                         order_reference_id AS last_psp_txn_id,
                         payment_id AS last_psp_ref_id
                        FROM
                        pg_order_txn
                        WHERE
                        order_id = ${order_id}
                        order by id desc limit 1
                    ) AS OT
                    ON
                    ORR.order_id = OT.order_id;`;
    }
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_date_by_order_id: async (condition, table) => {
    let qb = await pool.get_connection();

    let response;
    try {
      response = await qb
        .select("created_at")
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY H:mm:ss");
    } else {
      return " ";
    }
  },
  get_capture_date_by_order_id: async (order_id, table) => {
    let tname = config.table_prefix + table;
    let query =
      "SELECT `created_at` FROM `" +
      tname +
      "` WHERE `order_id` = '" +
      order_id +
      "' AND `status` = 'AUTHORISED' AND (`type` = 'CAPTURE' or type='PARTIALLY_CAPTURE') ";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY H:mm:ss");
    } else {
      return " ";
    }
  },
  get_refund_date_by_order_id: async (order_id, table) => {
    let tname = config.table_prefix + table;
    let query =
      "SELECT `created_at` FROM `" +
      tname +
      "` WHERE `order_id` = '" +
      order_id +
      "' AND `status` = 'AUTHORISED' AND (`type` = 'REFUND' or type='PARTIALLY_REFUND') ";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return moment(response?.[0].created_at).format("DD-MM-YYYY H:mm:ss");
    } else {
      return " ";
    }
  },
  get_partial_refund_date_by_order_id: async (order_id, table) => {
    let tname = config.table_prefix + table;
    let query =
      "SELECT `created_at` FROM `" +
      tname +
      "` WHERE `order_id` = '" +
      order_id +
      "' AND `status` = 'AUTHORISED' AND  type='PARTIALLY_REFUND' ";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]?.created_at != undefined) {
      return "Y";
    } else {
      return "N";
    }
  },
  get_txn_details_by_order_status: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("amount,currency,payment_id")
        .where(condition)
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      if (data == "CAPTURE") {
        return response?.[0].payment_id;
      } else {
        return response?.[0]?.amount.toFixed(2) + " " + response?.[0]?.currency;
      }
    } else {
      return "-";
    }
  },

  get_in_condition: async (key, value) => {
    if (!key || !value) {
      return "";
    }
    const valueArray = value.split(",").map((item) => item.trim());
    const valueCondition = valueArray.map((item) => `'${item}'`).join(",");
    return `${key} IN (${valueCondition})`;
  },

  get_dump_by_payment_ref: async (payment_ref_id, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      let query = `SELECT * FROM ${
        config.table_prefix + table
      } where dump LIKE '%${payment_ref_id}%'`;

      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response;
  },

  get_inv_status_by_order: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("status")
        .where({ order_id: order_id })
        .get(config.table_prefix + "orders");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      if (
        response?.[0].status == "AUTHORISED" ||
        response?.[0].status == "CAPTURED"
      ) {
        return "Paid";
      } else {
        return response?.[0].status;
      }
    } else {
      return "Unpaid";
    }
  },
  get_inv_order_by_cust_id: async (cust_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("order_id")
        .where({ customer_id: cust_id })
        .get(config.table_prefix + "inv_invoice_master");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      response?.[0].order_id;
    } else {
      return "";
    }
  },
  getQRStatus: async (q_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("status")
        .where({ id: q_id })
        .get(config.table_prefix + "merchant_qr_codes");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].status;
    } else {
      return "";
    }
  },
  getQRID: async (q_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ qr_id: q_id })
        .get(config.table_prefix + "merchant_qr_codes");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  getLinkID: async (o_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("merchant_qr_id,payment_id")
        .where({ order_no: o_id })
        .get(config.table_prefix + "qr_payment");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  getInvoiceID: async (o_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("invoice_no,id")
        .where({ order_id: o_id })
        .get(config.table_prefix + "inv_invoice_master");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  getSubsID: async (o_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("subscription_id,plan_id")
        .where({ order_no: o_id })
        .get(config.table_prefix + "subs_payment");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  getPaymentRefID: async (o_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("payment_id")
        .where({ txn: o_id })
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].payment_id;
    } else {
      return "";
    }
  },
  getOrderByRefID: async (payment_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("txn")
        .where({ payment_id: payment_id })
        .get(config.table_prefix + "order_txn");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].txn;
    } else {
      return "";
    }
  },
  getQRReset: async (q_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("is_reseted")
        .where({ id: q_id })
        .get(config.table_prefix + "merchant_qr_codes");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].is_reseted;
    } else {
      return "";
    }
  },
  get_business_address_country: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_name")
        .where({ id: id })
        .get(config.table_prefix + "bus_reg_country_master");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_name;
    } else {
      return "";
    }
  },
  get_business_address_code: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_code")
        .where({ id: id })
        .get(config.table_prefix + "bus_reg_country_master");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_code;
    } else {
      return "";
    }
  },
  get_busi_address_country_id_by_code: async (code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ country_code: code })
        .get(config.table_prefix + "bus_reg_country_master");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].id;
    } else {
      return "";
    }
  },
  generateRandomString: () => {
    const characters =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let randomString = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        randomString += "-";
      } else {
        randomString +=
          characters[Math.floor(Math.random() * characters.length)];
      }
    }
    return randomString;
  },
  get_current_data: async () => {
    const current_date = moment().format("YYYY-MM-DD");
    let query = `SELECT
                        sr.*, s.plan_id,p.mode
                    FROM
                        pg_subscription_recurring as sr
                    INNER JOIN pg_subs_plans as p ON sr.plan_id= p.id    
                    LEFT JOIN pg_subscription as s on sr.subscription_id = s.subscription_id
                    WHERE
                        next_due_date = "${current_date}" 
                        AND is_paid = 0
                        AND is_failed = 0
                        AND s.status=1
                        AND p.mode=1`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response;
  },

  get_current_data_by_orderID: async (orderID) => {
    const current_date = moment().format("YYYY-MM-DD");
    let query = `SELECT
                        sr.*, s.plan_id
                    FROM
                        pg_subscription_recurring as sr
                    INNER JOIN pg_subs_plans as p ON sr.plan_id= p.id    
                    LEFT JOIN pg_subscription as s on sr.subscription_id = s.subscription_id
                    WHERE
                        sr.order_id = "${orderID}" 
                        AND is_paid = 0
                        AND is_failed = 0
                        AND s.status=1
                        AND p.mode=1`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },

  get_current_data_test_by_orderID: async (orderID) => {
    let query = `SELECT
                        sr.*, s.plan_id
                    FROM
                        pg_subscription_recurring as sr
                        INNER JOIN pg_subs_plans as p ON sr.plan_id= p.id        
                    LEFT JOIN pg_subscription as s on sr.subscription_id = s.subscription_id
                    WHERE
                        sr.order_id = "${orderID}" 
                        AND is_paid = 0
                        AND is_failed = 0
                        AND s.status=1
                        AND p.mode=0`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response && response?.[0];
  },

  get_current_data_test: async () => {
    const current_date = moment().format("YYYY-MM-DD");
    let query = `SELECT
                        sr.*, s.plan_id
                    FROM
                        pg_subscription_recurring as sr
                        INNER JOIN pg_subs_plans as p ON sr.plan_id= p.id        
                    LEFT JOIN pg_subscription as s on sr.subscription_id = s.subscription_id
                    WHERE
                        next_due_date = "${current_date}" 
                        AND is_paid = 0
                        AND is_failed = 0
                        AND s.status=1
                        AND p.mode=0`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_order_ids: async (customer_id) => {
    let query = `SELECT order_id FROM pg_inv_invoice_master WHERE customer_id = '${customer_id}'
                    AND order_id IS NOT NULL
                    AND order_id <> '';
                    `;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_expired_list: async () => {
    let query = `SELECT o.*
FROM pg_orders o
JOIN (
    SELECT DISTINCT order_id
    FROM pg_subscription_recurring
    WHERE is_paid = 0
) s ON o.order_id = s.order_id
WHERE CONCAT(SUBSTRING(o.expiry, 1, 4), '-', SUBSTRING(o.expiry, 6, 2))
      = DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%Y-%m');
                    `;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  get_current_order_data: async () => {
    // Get the current datetime in the format 'YYYY-MM-DD HH:mm:ss'
    const currentDateTime = moment().format("YYYY-MM-DD HH:mm:ss");
    // Construct the SQL query
    // const query = `SELECT * FROM pg_orders WHERE status = 'AUTHORISED' AND capture_datetime = '2023-07-20 13:14:00';`;
    const query = `SELECT * FROM pg_orders WHERE status = 'AUTHORISED' AND capture_datetime = '${currentDateTime}';`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  get_error_category: async (code, psp, default_res) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("response_code,category,response_details")
        .where({ psp_response_code: code, psp_name: psp })
        .get(config.table_prefix + "response_code");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response.length > 0) {
      return response?.[0];
    } else {
      return default_res;
    }
  },
  formatNumber: (n) => n.toString().padStart(10, "0"),
  formatNumberNine: (n) => n.toString().padStart(9, "0"),
  formatNumberEight: (n) => n.toString().padStart(8, "0"),
  getSubsStatus: async (plan_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("status,expiry_date")
        .where({ id: plan_id })
        .get(config.table_prefix + "subs_plans");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0];
    } else {
      return "";
    }
  },
  get_card_scheme_img: async (scheme) => {
    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("image")
        .where({ card_scheme: scheme })
        .get(config.table_prefix + "card_scheme");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response?.[0].image;
  },
  calculateDate: async (
    nextDueDate,
    payment_interval,
    paymentFrequencyType
  ) => {
    return await calculateNextDueDate(
      nextDueDate,
      payment_interval,
      paymentFrequencyType
    );
  },
  calculatePreDate: async (
    nextDueDate,
    payment_interval,
    paymentFrequencyType
  ) => {
    return await calculatePreviousDueDate(
      nextDueDate,
      payment_interval,
      paymentFrequencyType
    );
  },
  getCurrency: async (key, value) => {
    if (!key || !value) {
      return "";
    }

    const valueArray = value.split(",").map((item) => item.trim());
    const currency_ids = [];
    for (const currency_id of valueArray) {
      let id = enc_dec.cjs_decrypt(currency_id);
      currency_ids.push(id);
    }

    let sql = `SELECT GROUP_CONCAT(code SEPARATOR "','") AS currency_str FROM pg_master_currency WHERE id in (${currency_ids.join(
      ","
    )})`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return `${key} IN ('${response?.[0]?.currency_str}')`;
    } else {
      return null;
    }
    //return `${key} IN (${valueCondition})`;
  },
  getInvCustomer: async (key, value, submerchant_id) => {
    if (!key || !value) {
      return "";
    }

    const cust_ids = [];
    for (const val of value) {
      let id = await enc_dec.cjs_decrypt(val.customer_id);
      id ? cust_ids.push(id) : "";
    }

    let sql = `SELECT count(id) as total FROM pg_inv_customer WHERE submerchant_id=${submerchant_id} and deleted=0 and status=0  and id in (${cust_ids.join(
      ","
    )})`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0].total > 0) {
      return true;
    } else {
      return false;
    }
    //return `${key} IN (${valueCondition})`;
  },
  getMIDCurrency: async (key, value, submerchant_id, mode) => {
    if (!key || !value) {
      return "";
    }

    const curr_ids = [];
    for (const val of value) {
      let id = await helpers.get_currency_id_by_name(val.currency);
      id ? curr_ids.push(id) : "";
    }

    let sql = `SELECT count(id) as total FROM pg_mid WHERE  submerchant_id=${submerchant_id} and deleted=0 and status=0 and env="${mode}" and currency_id IN (${curr_ids.join(
      ","
    )})`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0].total > 0) {
      return true;
    } else {
      return false;
    }
    //return `${key} IN (${valueCondition})`;
  },
  getInvItems: async (key, value, submerchant_id, action) => {
    if (!key || !value) {
      return "";
    }
    const cust_ids = [];
    if (action == "update") {
      for (const items of value) {
        var id = await enc_dec.cjs_decrypt(items.item_id);
      }
      id ? cust_ids.push(id) : "";
    } else {
      for (const val of value) {
        var items = val.item_data;
        for (const val_item of items) {
          var id = await enc_dec.cjs_decrypt(val_item.item_id);
        }
        id ? cust_ids.push(id) : "";
      }
    }

    let sql = `SELECT count(id) as total FROM pg_master_items WHERE submerchant_id=${submerchant_id} and is_deleted=0 and status=0 and id IN (${cust_ids.join(
      ","
    )})`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    //console.log(sql)
    if (response?.[0].total > 0) {
      return true;
    } else {
      return false;
    }
    //return `${key} IN (${valueCondition})`;
  },
  getAllSubMerchant: async (super_merchant_id) => {
    if (!super_merchant_id) {
      return [];
    }
    let sql = `SELECT GROUP_CONCAT(id SEPARATOR ',') AS sub_merchant_id_str FROM pg_master_merchant WHERE super_merchant_id = ${super_merchant_id}`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response;
  },
  getPSP: async (key, value) => {
    if (!key || !value) {
      return "";
    }

    const valueArray = value.split(",").map((item) => item.trim());
    const ids = [];
    for (const id of valueArray) {
      let psp = await enc_dec.cjs_decrypt(id);
      ids.push(psp);
    }

    let sql = `SELECT GROUP_CONCAT(UPPER(credentials_key) SEPARATOR "','") AS currency_str FROM pg_psp WHERE id in (${ids.join(
      ","
    )})`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      return `${key} IN ('${response?.[0]?.currency_str}')`;
    } else {
      return null;
    }
  },

  getPaymentMode: async (key, value) => {
    if (!key || !value) {
      return "";
    }

    const valueArray = value.split(",").map((item) => item.trim());
    const ids = [];
    for (const id of valueArray) {
      let psp = enc_dec.cjs_decrypt(id);
      ids.push(psp);
    }

    let sql = `SELECT GROUP_CONCAT(UPPER(payment_mode) SEPARATOR "','") AS _str FROM pg_payment_mode WHERE id in (${ids.join(
      ","
    )})`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      var new_str =
        response?.[0]?._str == "APPLE PAY"
          ? response?.[0]?._str.split(" ").join("_")
          : response?.[0]?._str;
      return `${key} IN ('${new_str}')`;
    } else {
      return null;
    }
  },

  getCardSchema: async (key, value) => {
    if (!key || !value) {
      return "";
    }
    const valueArray = value.split(",").map((item) => item.trim());
    const ids = [];
    for (const id of valueArray) {
      let scheme = enc_dec.cjs_decrypt(id);
      ids.push(scheme);
    }

    let sql = `SELECT GROUP_CONCAT(UPPER(card_scheme) SEPARATOR "','") AS _str FROM pg_card_scheme WHERE id in (${ids.join(
      ","
    )})`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response && response.length > 0) {
      function hasWhiteSpace(s) {
        return /\s/.test(s);
      }
      if (hasWhiteSpace(response?.[0]?._str)) {
        var new_str = response?.[0]?._str.split(" ").join("_");
        var new_str1 = response?.[0]?._str;
        new_str = `${new_str}','${new_str1}`;
      } else {
        new_str = response?.[0]?._str;
      }

      return `${key} IN ('${new_str}')`;
    } else {
      return null;
    }
  },
  getSuperMerchantId: async (sub_merchant_id) => {
    let sql = `SELECT sbm.super_merchant_id FROM pg_master_merchant sbm WHERE sbm.id = ${sub_merchant_id}`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getStatusColor: async (status) => {
    if (status == "Paid") {
      return "success";
    } else if (status == "FAILED" || status == "Failed") {
      return "warning";
    } else {
      return "warning";
    }
  },
  getOrdinalWords: async (n) => {
    if (n < 0) return false;
    var special = [
      "",
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
      "Seventh",
      "Eighth",
      "Ninth",
      "Tenth",
      "Eleventh",
      "Twelfth",
      "Thirteenth",
      "Fourteenth",
      "Fifteenth",
      "Sixteenth",
      "Seventeenth",
      "Eighteenth",
      "Nineteenth",
    ];
    var deca = [
      "Twent",
      "Thirt",
      "Fort",
      "Fift",
      "Sixt",
      "Sevent",
      "Eight",
      "Ninet",
    ];
    single_digit = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    double_digit = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    below_hundred = [
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    if (n === 0) return "Zero";

    function translate(n) {
      word = "";

      if (n < 20) {
        word = special[n];
      } else if (n < 100) {
        rem = translate(n % 10);
        word = below_hundred[(n - (n % 10)) / 10 - 2] + " " + rem;
      } else if (n < 1000) {
        word =
          single_digit[Math.trunc(n / 100)] + " Hundred " + translate(n % 100);
      } else if (n < 2000) {
        word =
          single_digit[Math.trunc(n / 1000)] +
          " Thousand " +
          translate(n % 1000);
      }
      return word;
    }
    result = translate(n);
    return result.trim();
  },
  getPlan: async (subscription_id) => {
    let sql = `SELECT sp.terms FROM pg_subs_plans sp LEFT JOIN pg_subscription s on sp.id = s.plan_id WHERE s.subscription_id = '${subscription_id}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  getString: async (str) => {
    var res = str.split(", ");
    var data = "'" + res.join("','") + "'";
    return data;
  },
  getStringJoin: async (str) => {
    var res = str.split(",");
    var data = "'" + res.join("','") + "'";
    return data;
  },
  get_customer_country: async (code, table_name) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(
        "select country_code from " +
          config.table_prefix +
          table_name +
          " where iso2 = '" +
          code +
          "' order by id asc limit 1"
      );
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      return response?.[0].country_code;
    } else {
      return "";
    }
  },
  checkIfArrayIsUnique: async (myArray) => {
    let new_array = [];
    for (let item of myArray) {
      let temp = {
        dom_int: item.dom_int,
        payment_methods: item.payment_methods,
        payment_schemes: item.payment_schemes,
        currency: item.currency,
      };
      new_array.push(temp);
    }
    for (var i = 0; i < new_array.length; i++) {
      for (var j = i + 1; j < new_array.length; j++) {
        if (
          new_array[i].dom_int == new_array[j].dom_int &&
          new_array[i].payment_methods == new_array[j].payment_methods &&
          new_array[i].payment_schemes == new_array[j].payment_schemes &&
          new_array[i].currency == new_array[j].currency
        ) {
          return true; // means there are duplicate values
        }
      }
    }
    return false; // means there are no duplicate values.
  },
  getBankTransfer: async (merchant_id) => {
    let sql = `SELECT *  FROM ${config.table_prefix}mid WHERE submerchant_id = ${merchant_id} AND psp_id = 4 AND deleted=0`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response.length > 0) {
      return 1;
    } else {
      return 0;
    }
  },
  invoice_shared: async (invoice_id, type) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("email,cc,created_at")
        .where({ invoice_id: invoice_id })
        .get(config.table_prefix + "invoice_sharing_logs");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (type == "length") {
      return response ? response.length : 0;
    } else {
      return response;
    }
  },
  get_invoice_status_by_order: async (order_id, mode) => {
    let qb = await pool.get_connection();
    if (mode == "test") {
      table = "test_orders";
    } else {
      table = "orders";
    }

    let response;
    try {
      response = await qb
        .select("status")
        .where({ order_id: order_id })
        .get(config.table_prefix + table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response?.[0]) {
      if (
        response?.[0].status == "AUTHORISED" ||
        response?.[0].status == "CAPTURED"
      ) {
        return "Paid";
      } else {
        return response?.[0].status;
      }
    } else {
      return "Unpaid";
    }
  },
  getExpiryInvoice: async (invoice_id) => {
    let current_date = moment().format("YYYY-MM-DD HH:mm");
    let sql = `SELECT id,
                            CASE
                            WHEN DATE_FORMAT(expiry_date,'%Y-%m-%d') <=  "${current_date}"  THEN 'YES'
                            ELSE 'NO'
                            END AS calculated_expiry_date
                        FROM pg_inv_invoice_master
                        WHERE  id = '${invoice_id}'
                            AND deleted = 0`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  getDistinctPaymentMethod: async (condition) => {
    let sql = `SELECT DISTINCT methods FROM ${config.table_prefix}merchant_payment_methods where sub_merchant_id=${condition.merchant_id} and mode='${condition.env}'`;
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
  buildInsertQuery: async (tableName, data) => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const columnsString = columns.join(", ");
    const valuesString = values.join("', '");
    const query = `INSERT INTO ${tableName} (${columnsString}) VALUES ('${valuesString}')`;
    return query;
  },
  addTransactionFailedLogs: async (data) => {
    let query = await helpers.buildInsertQuery(
      config.table_prefix + "order_life_cycle_logs",
      data
    );
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  addTempCard: async (data) => {
    let query = await helpers.buildInsertQuery(
      config.table_prefix + "temp_cards",
      data
    );
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  fetchTempLastCard: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "temp_cards")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    return response?.[0];
  },
  fetchLastTryData: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          "card_proxy,card,cipher_id,card_holder_name,expiry,status_code,3ds_version"
        )
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  fetchPSPBYTXN: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("psp")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    //console.log(qb.last_query());
    return response?.[0];
  },
  makeValidJson: (rule_string) => {
    rule_string
      .replace(/\\n/g, "\\n")
      .replace(/\\'/g, "\\'")
      .replace(/\\"/g, '\\"')
      .replace(/\\&/g, "\\&")
      .replace(/\\r/g, "\\r")
      .replace(/\\t/g, "\\t")
      .replace(/\\b/g, "\\b")
      .replace(/\\f/g, "\\f");
    // Remove non-printable and other non-valid JSON characters
    rule_string = rule_string.replace(/[\u0000-\u001F]+/g, "");
    rule_string = rule_string.replace(/\n|<br\s*\/?>/gi, "\r");
    return rule_string;
  },
  getRoutingRuleDetails: async (order_id, mode) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("rule_id,mid_list")
        .from(config.table_prefix + "order_life_cycle")
        .where({ order_id: order_id, mode: mode })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }

    if (response && response?.length > 0) {
      if (response?.[0].rule_id > 0) {
        qb = await pool.get_connection();
        let response1;
        try {
          response1 = await qb
            .select("rule_name")
            .from(config.table_prefix + "routing_rule")
            .where({ id: response?.[0].rule_id })
            .get();
        } catch (error) {
          console.error("Database query failed:", error);
          logger.error(500, { message: error, stack: error?.stack });
        } finally {
          qb.release();
        }

        return response1[0]?.rule_name;
      } else if (response?.[0].mid_list == "") {
        return "Routing Order";
      } else if (response?.[0].mid_list != "" && response?.[0].rule_id == 0) {
        return "Routing Order";
      } else {
        qb = await pool.get_connection();
        let response1;
        try {
          response1 = await qb
            .select("rule_name")
            .from(config.table_prefix + "routing_rule")
            .where({ id: response?.[0].rule_id })
            .get();
        } catch (error) {
          console.error("Database query failed:", error);
          logger.error(500, { message: error, stack: error?.stack });
        } finally {
          qb.release();
        }
        return response1[0]?.rule_name;
      }
    } else {
      return "NA";
    }
  },
  getRetryAndCascade: async (order_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("retry,cascade,mid_list")
        .from(config.table_prefix + "order_life_cycle")
        .where({ order_id: order_id })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response?.length > 0) {
      return response?.[0];
    } else {
      return { retry: 0, cascade: 0, mid_list: "" };
    }
  },
  extractAllText: async (str) => {
    const re = /="(.*?)"/g || /!="(.*?)"/g;
    let current;
    let str1 = str;
    while ((current = re.exec(str))) {
      var cString = current.pop();
      str1 = str1.replace(cString, cString.toUpperCase());
    }
    return str1;
  },
  checkOrderWasRejected: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response?.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  orderCycle: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "order_life_cycle")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  lastCardUsed: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  lastTwoCardUsed: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(2)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response;
  },
  midDetails: async (order_id, txn_id, mode) => {
    let sql =
      `SELECT m.label,m.terminal_id,o.psp from pg_mid m join pg_order_life_cycle_logs o on o.terminal=m.terminal_id where o.txn='` +
      txn_id +
      `' and o.mode='` +
      mode +
      `' and o.order_id='` +
      order_id +
      `' `;
    console.log(sql);
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  midDetailsDefault: async (terminal_id) => {
    let sql =
      `SELECT m.label,m.terminal_id from pg_mid m where m.terminal_id='` +
      terminal_id +
      `' `;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  checkForHardOrSoftDeclined: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    let result;
    try {
      response = await qb
        .select("psp,status_code")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response.length > 0) {
      qb = await pool.get_connection();
      let response_code_details;
      try {
        response_code_details = await qb
          .select("soft_hard_decline")
          .from(config.table_prefix + "response_code")
          .where({
            psp_name: response?.[0].psp,
            response_code: response?.[0].status_code,
          })
          .limit(1)
          .get();
      } catch (error) {
        console.error("Database query failed:", error);
        logger.error(500, { message: error, stack: error?.stack });
      } finally {
        qb.release();
      }

      if (
        response_code_details &&
        response_code_details?.length > 0 &&
        response_code_details[0]?.soft_hard_decline.toUpperCase() == "HARD"
      ) {
        result = true;
      } else {
        result = false;
      }
    } else {
      result = false;
    }

    return result;
  },
  checkIfHardDeclined: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response && response?.length > 0) {
      return true;
    } else {
      return false;
    }
  },
  fetch3dsVersion: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("3ds_version")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    let obj = {
      result: false,
      version: 0,
    };
    if (response && response?.length > 0) {
      obj.version = response?.[0]?.["3ds_version"];
      obj.result = true;
      return obj;
    } else {
      return obj;
    }
  },
  check3dsVersion: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("3ds_version")
        .from(config.table_prefix + "order_life_cycle_logs")
        .where(condition)
        .order_by("id", "desc")
        .limit(1)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  updateOrderCycle: async (order_id, mode) => {
    let orderCycle = await helpers.orderCycle({
      order_id: order_id,
      mode: mode,
    });
    let mid_list = orderCycle.mid_list.split(",");
    mid_list.shift();
    let orderLifeCycle = {
      mid_list: mid_list.join(","),
    };
    console.log("orderCycle.original_mid_list", orderCycle.original_mid_list);

    if (
      orderCycle.original_mid_list == "" ||
      orderCycle.original_mid_list == null
    ) {
      orderLifeCycle.original_mid_list = orderCycle?.mid_list;
    }

    let db_table = config.table_prefix + "order_life_cycle";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(orderLifeCycle)
        .where({ order_id: order_id, mode: mode })
        .update(db_table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
  },

  date_wise_rec: async (response, date_column, from_date_, to_date_) => {
    const data = response;
    const from_date = from_date_;
    const to_date = to_date_;
    let blank_keydata = {};
    if (response?.[0]) {
      const keys = Object.keys(data[0]);
      blank_keydata = keys.reduce((acc, key) => {
        acc[key] = typeof data[0][key] === "number" ? 0 : "";
        return acc;
      }, {});
    }

    // Generate all dates between from_date and to_date
    const dateRange = getDateRange(from_date, to_date);

    // Convert data array into a map for easy lookup
    let dataMap = data.reduce((acc, item) => {
      item[date_column] = moment(item[date_column]).format("YYYY-MM-DD");
      acc[moment(item[date_column]).format("YYYY-MM-DD")] = item;
      return acc;
    }, {});

    const output = [];

    for (let i = 0; i < dateRange.length; i++) {
      const date = dateRange[i];
      blank_keydata[date_column] = date;
      let ned = { ...blank_keydata }; // Create a shallow copy of blank_keydata
      ned[date_column] = date;
      output.push(dataMap[date] ? dataMap[date] : ned);
    }

    return output;
  },
  createBasicAuthToken: async (username, password) => {
    const credentials = `${username}:${password}`;
    const token = Buffer.from(credentials).toString("base64");
    return `Basic ${token}`;
  },
  getNutrionoDetails: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("user_id,secret")
        .where({ id: 1 })
        .get(config.table_prefix + "nutrionoapi");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0];
    } else {
      return { user_id: "", secret: "" };
    }
  },
  getSubscriptionFrequencyMap: (unit) => {
    let map_obj = {
      daily: "DAY",
      weekly: "WEEK",
      monthly: "MONTH",
      yearly: "YEAR",
    };
    return map_obj?.[unit];
  },
  fetchIdByCondition: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(selection).where(condition).get(table);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.id;
    } else {
      return 0;
    }
  },
  generateQueryURL: (
    service_id,
    country,
    currency,
    transaction_type,
    page = 1,
    per_page = 100
  ) => {
    const params = new URLSearchParams();

    // Helper function to add param if it has a valid value
    const addParam = (key, value) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    };

    addParam("service_id", service_id);
    addParam("country_iso_code", country);
    addParam("currency", currency);
    addParam("page", page);
    addParam("per_page", per_page);
    addParam("transaction_type", transaction_type);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  },
  get_currency_details_by_country_iso: async (country_iso) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("currency")
        .where({ country_code: country_iso })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].currency;
    } else {
      return "";
    }
  },
  checkMerchantLiveModeStatus: async (user_details) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mid.id")
        .from(config.table_prefix + "mid mid")
        .join(
          config.table_prefix + "master_merchant mm",
          "mid.submerchant_id=mm.id",
          "inner"
        )
        .where({ "mm.super_merchant_id": user_details.id, "mid.env": "live" })
        .get();
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return true;
    } else {
      return false;
    }
  },
  getMTNMOMOCountry: async () => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country")
        .where({ credentials_key: "mtn-momo" })
        .get(config.table_prefix + "psp");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].country;
    } else {
      return "";
    }
  },
  getPaymentSchemeEnc: async (scheme) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("id")
        .where({ card_scheme: scheme })
        .get(config.table_prefix + "card_scheme");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return encrypt_decrypt("encrypt", response?.[0].id);
    } else {
      return "";
    }
  },
  get_country_name_by_dial_code: async (dial_code) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("country_name")
        .where({ dial: dial_code })
        .get(config.table_prefix + "country");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].country_name;
    } else {
      return "NA";
    }
  },
  fetchMerchantEnv: async (id) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("mode")
        .where({ id: id })
        .get(config.table_prefix + "master_merchant");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0].mode;
    } else {
      return "";
    }
  },
  fetchPaydartStatusByPSPStatus: (status, psp) => {
    let data = {
      "MTN-MOMO": {
        CREATED: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        PENDING: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        SUCCESSFUL: {
          status: "SUCCESS",
          order_status: "CAPTURED",
          txn_status: "CAPTURED",
          remark: "Transaction Successfull",
          status_code: "00",
        },
        FAILED: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Transaction FAILED",
          status_code: "01",
        },
      },
      "Orange Money": {
        TI: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        TF: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Transaction FAILED",
          status_code: "01",
        },
        TS: {
          status: "SUCCESS",
          order_status: "CAPTURED",
          txn_status: "CAPTURED",
          remark: "Transaction Successfull",
          status_code: "00",
        },
      },
      ALPAY: {
        1: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Database Error",
          status_code: "01",
        },
        2: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Insufficient Funds MTO",
          status_code: "02",
        },
        3: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "General Error",
          status_code: "03",
        },
        200: {
          status: "SUCCESS",
          order_status: "CAPTURED",
          txn_status: "CAPTURED",
          remark: "Transaction Successful",
          status_code: "00",
        },
        202: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Request is being processed",
          status_code: "02",
        },
        300: {
          status: "FAILED",
          order_status: "REJECTED",
          txn_status: "REJECTED",
          remark: "Request rejected",
          status_code: "03",
        },
        303: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Other error (treated as pending)",
          status_code: "03",
        },
        401: {
          status: "FAILED",
          order_status: "UNAUTHORIZED",
          txn_status: "UNAUTHORIZED",
          remark: "Unauthorized",
          status_code: "01",
        },
        402: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request institution is not found",
          status_code: "02",
        },
        403: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request transaction type not found",
          status_code: "03",
        },
        404: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "No Record found/Account not found",
          status_code: "04",
        },
        405: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Request institution is unavailable (treated as pending)",
          status_code: "05",
        },
        406: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request not accepted for one or more reasons",
          status_code: "06",
        },
        407: {
          status: "FAILED",
          order_status: "UNAUTHORIZED",
          txn_status: "UNAUTHORIZED",
          remark: "Unauthorized",
          status_code: "07",
        },
        408: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Invalid PIN",
          status_code: "08",
        },
        409: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request Expired",
          status_code: "09",
        },
        410: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Insufficient Funds",
          status_code: "10",
        },
        411: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request Failed",
          status_code: "11",
        },
        412: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request Declined",
          status_code: "12",
        },
        413: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request Failed",
          status_code: "13",
        },
        414: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request channel is not found",
          status_code: "14",
        },
        415: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Recipient transaction not permitted",
          status_code: "15",
        },
        416: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "System Defect (treated as pending)",
          status_code: "16",
        },
        417: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Custom Pending Code 417",
          status_code: "17",
        },
        418: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Custom Pending Code 418",
          status_code: "18",
        },
        419: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Request is pending completion",
          status_code: "19",
        },
        420: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Wrong account number",
          status_code: "20",
        },
        424: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Request failed",
          status_code: "24",
        },
        422: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Not processable Entity",
          status_code: "22",
        },
        491: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Custom Pending Code 491",
          status_code: "91",
        },
        500: {
          status: "FAILED",
          order_status: "SYSTEM_ERROR",
          txn_status: "SYSTEM_ERROR",
          remark: "System error",
          status_code: "99",
        },
      },
      "MTN":{
        CREATED: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        PENDING: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        SUCCESSFUL: {
          status: "SUCCESS",
          order_status: "CAPTURED",
          txn_status: "CAPTURED",
          remark: "Transaction Successfull",
          status_code: "00",
        },
        FAILED: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Transaction FAILED",
          status_code: "01",
        },
      },
      "Orange":{
        TI: {
          status: "PENDING",
          order_status: "PENDING",
          txn_status: "PENDING",
          remark: "Transaction Pending",
          status_code: "02",
        },
        TF: {
          status: "FAILED",
          order_status: "FAILED",
          txn_status: "FAILED",
          remark: "Transaction FAILED",
          status_code: "01",
        },
        TS: {
          status: "SUCCESS",
          order_status: "CAPTURED",
          txn_status: "CAPTURED",
          remark: "Transaction Successfull",
          status_code: "00",
        },
      },
    };
    return (
      data[psp][status] || {
        status: "FAILED",
        order_status: "FAILED",
        txn_status: "FAILED",
        remark: "Transaction FAILED",
        status_code: "01",
      }
    );
  },

  // Function to get code by name (case-insensitive search)
  getCodeByName: (name) => {
    const ghanaMNOCodes = [
      { code: "300479", name: "ZEEPAY GHANA LIMITED", type: "MNO" },
      { code: "300574", name: "G-MONEY", type: "MNO" },
      { code: "300591", name: "MTN", type: "MNO" },
      { code: "300592", name: "AIRTELTIGO MONEY", type: "MNO" },
      { code: "300594", name: "VODAFONE CASH", type: "MNO" },
      { code: "300595", name: "GHANAPAY", type: "MNO" },
      { code: "300597", name: "YUP GHANA LIMITED", type: "MNO" },
    ];
    const normalizedName = name.trim().toLowerCase();
    const mnoItem = ghanaMNOCodes.find(
      (item) => item.name.toLowerCase() === normalizedName
    );
    return mnoItem ? mnoItem.code : null;
  },
  normalizeId: (value) => {
    return value == null || value === "" || isNaN(value) ? 0 : value;
  },
  fetchDccStatus: async() => {
     let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("dcc_enabled")
        .where({ id: 1})
        .get("pg_dcc_setup");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.dcc_enabled==1?true:false ;
    } else {
      return false;
    }
  },
  haveAccesstoSuperStore:async(store_id,super_merchant_id)=>{
      let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(`SELECT id FROM pg_master_super_merchant WHERE id=${super_merchant_id} AND FIND_IN_SET('${store_id}', stores) > 0`);
      console.log(`SELECT id FROM pg_master_super_merchant WHERE id=${super_merchant_id} AND FIND_IN_SET('${store_id}', stores) > 0`);
       
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.id?true:false ;
    } else {
      return false;
    }
  },
  checkAllowMidOnSuperMerchant:async(super_merchant_id)=>{
      let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(`SELECT allow_mid FROM pg_master_super_merchant WHERE id=${super_merchant_id}`);
       
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.allow_mid ;
    } else {
      return 0;
    }
  }

};

module.exports = helpers;

 async function dccStatusFetch(){
     let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("dcc_enabled")
        .where({ id: 1})
        .get("pg_dcc_setup");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500, { message: error, stack: error?.stack });
    } finally {
      qb.release();
    }
    if (response?.[0]) {
      return response?.[0]?.dcc_enabled==1?true:false ;
    } else {
      return false;
    }
  };
