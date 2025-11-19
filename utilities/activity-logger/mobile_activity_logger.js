const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const moment = require("moment");
const logger = require('../../config/logger');
var MobileActivityLogger = {
  add: async (module_and_user, title, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name, email, mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0]?.name,
      user_type: module_and_user?.user_type,
      email: needed_info[0]?.email,
      mobile_no: needed_info[0]?.mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Added new " + module_and_user.sub_module + " : " + title,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    let response = await qb
      .returning("id")
      .insert(config.table_prefix + "cst_logs", data);
    qb.release();
    return response;
  },

  insert: async (module_and_user, activity, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name, email, mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0].name,
      user_type: module_and_user.user_type,
      email: needed_info[0].email,
      mobile_no: needed_info[0].mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: activity,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    let response = await qb
      .returning("id")
      .insert(config.table_prefix + "cst_logs", data);
    qb.release();
    return response;
  },

  edit: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name, email, mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0].name,
      user_type: module_and_user.user_type,
      email: needed_info[0].email,
      mobile_no: needed_info[0].mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Updated " + module_and_user.sub_module + " : " + id,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    let response = await qb
      .returning("id")
      .insert(config.table_prefix + "cst_logs", data);
    qb.release();
    return response;
  },

  delete: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name, email, mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0].name,
      user_type: module_and_user.user_type,
      email: needed_info[0].email,
      mobile_no: needed_info[0].mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Deleted " + module_and_user.sub_module + " : " + id,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    let response = await qb
      .returning("id")
      .insert(config.table_prefix + "cst_logs", data);
    qb.release();
    return response;
  },

  activate: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name, email, mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0].name,
      user_type: module_and_user.user_type,
      email: needed_info[0].email,
      mobile_no: needed_info[0].mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Activated " + module_and_user.sub_module + " : " + id,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "cst_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }
    return response;
  },

  deactivate: async (module_and_user, id, headers) => {
    let added_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let qb = await pool.get_connection();
    let needed_info;
    try {
      needed_info = await qb
        .select("name,email,mobile_no")
        .where({ id: module_and_user.user })
        .get(config.table_prefix + "customers");
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }

    let data = {
      user: module_and_user.user,
      user_name: needed_info[0].name,
      user_type: module_and_user.user_type,
      email: needed_info[0].email,
      mobile_no: needed_info[0].mobile_no,
      module: module_and_user.module,
      sub_module: module_and_user.sub_module,
      activity: "Deactivated " + module_and_user.sub_module + " : " + id,
      platform: headers.platform,
      platform_version: headers.platform_version,
      ip: headers.ip,
      is_mobile: headers.ismobile,
      mobile_brand: headers.mobile_brand,
      mobile_model: headers.mobile_model,
      is_robot: headers.isrobot,
      is_referral: headers.isreferral,
      app_version: headers.app_version,
      added_at: added_at,
    };

    qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "cst_logs", data);
    } catch (error) {
      console.error("Database query failed:", error);
      logger.error(500,{message: error,stack: error.stack});
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = MobileActivityLogger;
