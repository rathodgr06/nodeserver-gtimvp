const logger = require("../config/logger");
require("dotenv").config({ path: "../.env" });

const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");

const tctable = config.table_prefix + "mail_templates";

const dbModel = {
  add: async (data) => {
    const qb = await pool.get_connection();
    try {
      return await qb.returning("id").insert(tctable, data);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  select: async (condition = {}, limit = {}) => {
    const qb = await pool.get_connection();

    try {
      qb.select("*").from(tctable).order_by("id", "asc");

      if (condition.template_name) {
        qb.where("template_name", condition.template_name);
      }

      if (condition.subject) {
        qb.where("subject", condition.subject);
      }

      if (Number.isInteger(limit.perpage) && limit.perpage > 0) {
        qb.limit(limit.perpage, limit.start || 0);
      }

      return await qb.get();
    } catch (error) {
      logger.error(500, {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectSpecific: async (selection, condition) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select(selection);

      if (condition && Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      return await query.get(tctable);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectOne: async (selection, condition) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select(selection).order_by("id", "asc");

      if (condition && Object.keys(condition).length > 0) {
        for (const key in condition) {
          const value = condition[key];

          if (
            typeof value === "object" &&
            value !== null &&
            value.ne !== undefined
          ) {
            query = query.where(`${key} !=`, value.ne);
          } else {
            query = query.where(key, value);
          }
        }
      }

      const result = await query.get(tctable);
      return result?.[0] || null;
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectOneLatest: async (selection, condition) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select(selection).order_by("id", "DESC");

      if (condition && Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      const result = await query.get(tctable);
      return result?.[0] || null;
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  updateDetails: async (condition, data) => {
    const qb = await pool.get_connection();
    try {
      if (!condition || Object.keys(condition).length === 0) {
        throw new Error("Update condition is required");
      }

      return await qb.set(data).where(condition).update(tctable);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  get_count: async (condition = {}) => {
    const qb = await pool.get_connection();

    try {
      qb.select("COUNT(id) AS count", false).from(tctable);

      if (condition.template_name) {
        qb.where("template_name", condition.template_name);
      }

      if (condition.subject) {
        qb.where("subject", condition.subject);
      }

      const result = await qb.get();
      return result?.[0]?.count || 0;
    } catch (error) {
      logger.error(500, {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      qb.release();
    }
  },

  deleteById: async (condition) => {
    const qb = await pool.get_connection();
    try {
      if (!condition || Object.keys(condition).length === 0) {
        throw new Error("Delete condition is required");
      }

      return await qb.where(condition).delete(tctable);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  changeStatus: async (condition, status) => {
    return await dbModel.updateDetails(condition, { status });
  },
};

module.exports = dbModel;
