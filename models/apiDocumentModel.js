const logger = require("../config/logger");
require("dotenv").config({ path: "../.env" });

const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");

const tctable = config.table_prefix + "api_document";

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

  select: async (condition = {}, limit) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select("*").from(tctable).order_by("id", "ASC");

      if (Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      if (limit && limit.perpage) {
        query = query.limit(limit.perpage, limit.start || 0);
      }

      return await query.get();
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectSpecific: async (selection, condition = {}) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select(selection).from(tctable);

      if (Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      return await query.get();
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectOne: async (selection, condition = {}) => {
    const qb = await pool.get_connection();
    try {
      let query = qb
        .select(selection)
        .from(tctable)
        .order_by("id", "ASC");

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

      const result = await query.get();
      return result?.[0] || null;
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  selectOneLatest: async (selection, condition = {}) => {
    const qb = await pool.get_connection();
    try {
      let query = qb
        .select(selection)
        .from(tctable)
        .order_by("id", "DESC");

      if (Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      const result = await query.get();
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
      let query = qb
        .select("COUNT(id) AS count", false)
        .from(tctable);

      if (Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      const result = await query.get();
      return result?.[0]?.count || 0;
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
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

  selectForDocumentation: async () => {
    const qb = await pool.get_connection();
    try {
      return await qb
        .select([
          "method AS type",
          "url AS url",
          "url_test AS urlTest",
          "title",
          "name",
          "description",
          "api_group AS `group`",
          "version",
          "filename",
          "group_title AS groupTitle",
          "headers AS header",
          "parameters AS parameter",
          "examples",
          "success_response AS success",
          "error_response AS error"
        ])
        .from(tctable)
        .where({ status: 1 })
        .order_by("id", "ASC")
        .get();
    } finally {
      qb.release();
    }
  },

};

module.exports = dbModel;
