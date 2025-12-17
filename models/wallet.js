const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const { default: axios } = require("axios");
const dbtable = config.table_prefix + "wallet";
var walletDBModel = {
  checkAndCreate: async (data, checkdata) => {
    console.log("🚀 ~ checkdata:", checkdata)
    console.log("🚀 ~ data:", data)
    let qb = await pool.get_connection();
    let response;
    let isError;
    try {
      // Check if the record already exists
      let qb = await pool.get_connection();
      try {
        response = await qb.select("id").where(checkdata).get(dbtable);
      } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        isError = error;
      } finally {
        qb.release();
      }

      if (isError) {
        return { status: 400, message: isError.message };
      }

      let existing = response?.length > 0;

      if (existing) {
        return { status: 400, message: "Wallet already exists" };
      } else {
        // If not, insert and return the new record's ID
        response = await qb.returning("id").insert(dbtable, data);
        let where = { id: response?.insertId };
        response = await qb.select("*").where(where).get(dbtable);
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      isError = error;
    } finally {
      qb.release();
    }

    if (isError) {
      return { status: 200, message: isError.message };
    }

    return {
      status: 200,
      message: "Wallet created successfully",
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

      // ----------------------------------------
      // 1. Build WHERE clause safely
      // ----------------------------------------
      let whereParts = [];

      for (let [key, value] of Object.entries(condition)) {
          if (typeof value === "string") {
              whereParts.push(`${key} = '${value}'`);
          } else {
              whereParts.push(`${key} = ${value}`);
          }
      }

      // Add super merchant filter (JOIN condition)
      if (condition.super_merchant_id) {
          whereParts.push(`mm.super_merchant_id = '${condition.super_merchant_id}'`);
      }

      let whereClause = whereParts.length ? whereParts.join(" AND ") : "1=1";

      // ----------------------------------------
      // 2. Total Count with JOIN
      // ----------------------------------------
      const countQuery = `
          SELECT COUNT(*) AS total
          FROM pg_wallet pw
          INNER JOIN pg_master_merchant mm 
              ON pw.sub_merchant_id = mm.id
          WHERE ${whereClause}
      `;

      const countResult = await qb.query(countQuery);
      let totalCount = countResult[0]?.total || 0;

      // ----------------------------------------
      // 3. Fetch paginated records
      // ----------------------------------------
      const dataQuery = `
          SELECT pw.*, mm.super_merchant_id, mmd.company_name
          FROM pg_wallet pw
          INNER JOIN pg_master_merchant mm 
              ON pw.sub_merchant_id = mm.id
          INNER JOIN pg_master_merchant_details mmd 
              ON pw.sub_merchant_id = mmd.merchant_id
          WHERE ${whereClause}
          ORDER BY pw.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
      `;
      console.log("🚀 ~ dataQuery:", dataQuery)

      data = await qb.query(dataQuery);

      console.log("COUNT QUERY:", countQuery);
      console.log("DATA QUERY:", dataQuery);

      response = {
          status: 200,
          message: "Data fetched successfully",
          data,
          totalCount,
          page,
          limit
      };

  } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      response = { status: 400, message: error.message };
  } finally {
      qb.release();
  }
    return response;
  },
  update: async (data, condition) => {
    let response;
    let isError = false;

    let qb = await pool.get_connection();
    try {
      // Check if the record exists
      const existing = await qb.select("wallet_id, sub_merchant_id, currency, beneficiary_id as receiver_id, total_balance, available_balance, pending_balance, active, deleted, created_at, updated_at").where(condition).get(dbtable);
      console.log("🚀 ~ update: ~ existing:", existing);

      if (existing.length > 0) {
        // Record exists, perform update
        if (data && Object.keys(data).length > 0) {
          response = await qb.set(data).where(condition).update(dbtable);
          let response_data = existing[0];
          response_data.active = data?.active;
          response = { status: 200, message: "Record " + (data?.active == 1 ? 'activate' : 'deactivate') + " successfully.", data: response_data};
        } else {
          response = {
            status: 400,
            message: "No valid fields provided to update.",
          };
        }
      } else {
        // Record doesn't exist
        response = {
          status: 400,
          message: "No matching record found to update.",
        };
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      isError = true;
      response = {
        status: 400,
        message: "Database query failed." + error.message,
        details: error,
      };
    } finally {
      qb.release();
    }

    return response;
  },
  get_by_id: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.select("*").where(condition).get(dbtable);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return { status: 400, message: "Error:" + error.message, details: error };
    } finally {
      qb.release();
    }
    if (response?.length > 0) {
      return { status: 200, message: "Wallet found", data: response?.[0] };
    }else{
      return { status: 400, message: "Wallet not found", data: null};
    }
  },
  get_receiver_by_sub_merchant_id_api_call: async (sub_merchant_id) => {
    let receiver = await get_receiver_by_sub_merchant_id_api_call(
      sub_merchant_id
    );
    console.log("🚀 ~ receiver:", receiver)
    return receiver?.receiver?.receiver_id;
  },
  get_receiver_by_id_api_call: async (receiver_id) => {
    let receiver = await get_receiver_by_id_api_call(
      receiver_id
    );
    console.log("🚀 ~ receiver:", receiver)
    return receiver?.receiver?.sub_merchant_id;
  },
};


async function get_receiver_by_sub_merchant_id_api_call(sub_merchant_id) {
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/receiver/get-receiver-by-sub-id/" +
        sub_merchant_id,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function get_receiver_by_id_api_call(receiver_id) {
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/receiver/get-receiver-by-id/" +
        receiver_id,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = walletDBModel;
