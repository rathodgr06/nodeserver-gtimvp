/**
 * Banner Model
 */

const logger = require("../config/logger");
require("dotenv").config({ path: "../.env" });

const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");

// Final table name (already verified)
const tctable = config.table_prefix + "banners";

const dbModel = {
  // ADD
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

  // LIST (SAFE)
  select: async (condition, limit) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select("*").order_by("id", "asc");

      // ✅ apply WHERE only if condition exists
      if (condition && Object.keys(condition).length > 0) {
        query = query.where(condition);
      }

      if (limit && limit.perpage) {
        query = query.limit(limit.perpage, limit.start);
      }

      return await query.get(tctable);
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  // SELECT SPECIFIC FIELDS
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

  // SELECT ONE
  selectOne: async (selection, condition) => {
    const qb = await pool.get_connection();
    try {
      let query = qb.select(selection).order_by("id", "asc");

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

  // SELECT LATEST
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

  // UPDATE
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

  // COUNT (SAFE)
  get_count: async (condition_obj) => {
    const qb = await pool.get_connection();
    try {
      let condition = "1=1";

      if (condition_obj && Object.keys(condition_obj).length > 0) {
        condition = await helpers.get_conditional_string(condition_obj);
      }

      const result = await qb.query(
        `SELECT COUNT(id) AS count FROM ${tctable} WHERE ${condition}`
      );

      return result?.[0]?.count || 0;
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      throw error;
    } finally {
      qb.release();
    }
  },

  // HARD DELETE
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
