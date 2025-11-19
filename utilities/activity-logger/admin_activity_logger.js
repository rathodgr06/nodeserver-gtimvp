const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
const logger = require('../../config/logger');
var AdminActivityLogger = {
  admin_login_attempted: async (module_and_user, title, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: "admin",
      module: "Admin",
      sub_module: "Auth",
      activity: title,
      os: headers.os ? headers.os : "",
      browser: headers.browser ? headers.browser : "",
      browser_version: headers.browserversion ? headers.browserversion : "",
      ip: headers.ip ? headers.ip : "",
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand ? headers.mobile_brand : "",
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }
    return response;
  },
  add: async (module_and_user, title, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: module_and_user.user_type,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Added new " + module_and_user.sub_module + " : " + title,
      os: headers.os ? headers.os : "",
      browser: headers.browser ? headers.browser : "",
      browser_version: headers.browserversion ? headers.browserversion : "",
      ip: headers.ip ? headers.ip : "",
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand ? headers.mobile_brand : "",
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  edit: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: module_and_user.admin_type,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Updated " + module_and_user.sub_module + " : " + id,
      os: headers.os,
      browser: headers.browser,
      browser_version: headers.browserversion,
      ip: headers.ip,
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand,
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  delete: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: module_and_user.admin_type,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Deleted " + module_and_user.sub_module + " : " + id,
      os: headers.os,
      browser: headers.browser,
      browser_version: headers.browserversion,
      ip: headers.ip,
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand,
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  activate: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: module_and_user.admin_type,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Activated " + module_and_user.sub_module + " : " + id,
      os: headers.os ? headers.os : "",
      browser: headers.browser ? headers.browser : "",
      browser_version: headers.browserversion ? headers.browserversion : "",
      ip: headers.ip ? headers.ip : "",
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand ? headers.mobile_brand : "",
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  deactivate: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: module_and_user.user,
      admin_type: module_and_user.admin_type,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Deactivated " + module_and_user.sub_module + " : " + id,
      os: headers.os,
      browser: headers.browser,
      browser_version: headers.browserversion,
      ip: headers.ip,
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand,
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  merchant_login_log_add: async (super_merchant_id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let data = {
      user: super_merchant_id,
      admin_type: "merchant",
      module: "Login",
      sub_module: "Login",
      activity: "Login perform by merchant",
      os: headers.os ? headers.os : "",
      browser: headers.browser ? headers.browser : "",
      browser_version: headers.browserversion ? headers.browserversion : "",
      ip: headers.ip ? headers.ip : "",
      is_mobile: headers.ismobile ? 1 : 0,
      mobile_brand: headers.mobile_brand ? headers.mobile_brand : "",
      is_robot: headers.isrobot ? 1 : 0,
      is_referral: headers.isreferral ? 1 : 0,
      added_at: added_at,
    };

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "admin_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
};
module.exports = AdminActivityLogger;
