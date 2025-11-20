const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const { default: axios } = require("axios");
const dbtable = config.table_prefix + "merchant_roles";
var MerchantSetupModal = {
  add: async (data, checkdata) => {
    console.log("🚀 ~ checkdata:", checkdata);
    console.log("🚀 ~ data:", data);
    let qb = await pool.get_connection();
    let response;
    let isError;
    try {
      // Check if the record already exists
      let qb = await pool.get_connection();
      try {
        response = await qb.select("id").where(checkdata).get(dbtable);
      } catch (error) {
        console.error("Database query failed:", error);
        isError = error;
      } finally {
        qb.release();
      }

      if (isError) {
        return { status: 400, message: isError.message };
      }

      let existing = response?.length > 0;

      if (existing) {
        return { status: 400, message: "Country already added" };
      } else {
        // If not, insert and return the new record's ID
        response = await qb.returning("id").insert(dbtable, data);
        let where = { id: response?.insertId };
        response = await qb.select("*").where(where).get(dbtable);
      }
    } catch (error) {
      console.error("Database query failed:", error);
      isError = error;
    } finally {
      qb.release();
    }

    if (isError) {
      return { status: 200, message: isError.message };
    }

    return {
      status: 200,
      message: "Country added successfully",
      data: response?.[0],
    };
  },
  list: async (condition, page, limit) => {
    console.log("🚀 ~ condition:", condition);
    let response;
    let totalCount = 0;
    let data;
    let qb = await pool.get_connection();
    try {
      page = parseInt(page);
      limit = parseInt(limit);

      let offset = (page - 1) * limit;

      // 1. Get total count
      const countResult = await qb
        .select("COUNT(*) AS total", false)
        .where(condition)
        .get(dbtable);

      totalCount = countResult[0]?.total || 0;

      // 2. Reset query builder for the main query
      // qb = await pool.get_connection();

      // 3. Get paginated data
      const whereClause = Object.entries(condition)
        .map(
          ([key, value]) =>
            `${key} = ${typeof value === "string" ? `'${value}'` : value}`
        )
        .join(" AND ");

      const query = ` SELECT * FROM pg_merchant_roles WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}; `;
      data = await qb.query(query);

      response = {
        status: 200,
        message: "Data fetched successfully",
        data,
        totalCount,
        page,
        limit,
      };
    } catch (error) {
      console.error("Database query failed:", error);
      response = { status: 400, message: error.message };
    } finally {
      qb.release();
    }
    return response;
  },
  update: async (data, checkdata) => {
    let qb;
    let response;
    let isError;

    try {
      // Get a connection once
      qb = await pool.get_connection();

      // Perform the update query
      response = await qb.set(data).where(checkdata).update(dbtable);
    } catch (error) {
      console.error("Database query failed:", error);
      isError = error;
    } finally {
      // Always release the connection if it exists
      if (qb) qb.release();
    }

    // Handle errors cleanly
    if (isError) {
      return { status: 400, message: isError.message };
    }

    // Successful response
    return {
      status: 200,
      message: "Record updated successfully", // <-- adjust message
      data: response?.[0],
    };
  },
  get_by_country: async (condition) => {
    console.log("🚀 ~ condition:", condition);
    let response;
    let data;
    let qb = await pool.get_connection();
    try {

      const whereClause = Object.entries(condition)
        .map(
          ([key, value]) =>
            `${key} = ${typeof value === "string" ? `'${value}'` : value}`
        )
        .join(" AND ");

      const query = ` SELECT * FROM pg_merchant_roles WHERE ${whereClause} ORDER BY created_at DESC;`;
      console.log("🚀 ~ query:", query)
      data = await qb.query(query);
      console.log("🚀 ~ data:", data)

      response = {
        status: 200,
        message: "Data fetched successfully",
        data: data
      };
    } catch (error) {
      console.error("Database query failed:", error);
      response = { status: 400, message: error.message };
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = MerchantSetupModal;
