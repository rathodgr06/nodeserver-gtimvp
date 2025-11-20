const { executablePath } = require("puppeteer");
const pool = require("../config/database");
const logger = require('../config/logger');
let DBRun = {
  exec_query: async (query) => {
    if (!query) {
      throw "Error Message: invalid query";
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  exec_condition: async (select, where, table_name) => {
    if (!select) {
      throw "Error Message: Select table column";
    }
    if (!where) {
      throw "Error Message: Where condition is missing";
    }
    if (!table_name) {
      throw "Error Message: Table name is missing";
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select(select).where(where).get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  exec_condition_limit: async (select, where, limit, table_name) => {
    if (!select) {
      throw "Error Message: Select table column";
    }
    if (!where) {
      throw "Error Message: Where condition is missing";
    }
    if (!table_name) {
      throw "Error Message: Table name is missing";
    }
    if (!limit || limit < 1) {
      return await this.exec_condition(select, where, table_name);
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(select)
        .where(where)
        .limit(limit)
        .get(table_name);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  exec_builder: async (dbQuery) => {
    let response;
    try {
      response = dbQuery?.run();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
};
module.exports = DBRun;
