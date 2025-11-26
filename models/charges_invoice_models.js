require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const { default: axios } = require("axios");
const pool = require("../config/database");
const dbtable = config.table_prefix + "orders";
const dbtable2 = config.table_prefix + "charges_invoice";
const dbtable3 = config.table_prefix + "submercahnt_invoice_charges";
const transaction_charges = config.table_prefix + "transaction_charges";
const feature_charges = config.table_prefix + "feature_charges";

const invoice_to_psp = config.table_prefix + "invoice_to_psp";
const invoice_to_merchant = config.table_prefix + "invoice_to_merchant";

const helpers = require("../utilities/helper/general_helper");
const { add } = require("./cipher_models");
const logger = require('../config/logger');
var charges_invoice_models = {
  addInvoice: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.returning("id").insert(dbtable2, data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  select: async (and_condition, date_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }

    let query = "select * from " + dbtable + final_cond + " order BY ID DESC ";
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
  select_one: async (condition) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  new_select_one: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(dbtable3);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  new_select_one: async (condition, table) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");
      qb.where(condition);
      response = await qb.get(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },
  select_list: async (condition, limit) => {
    let qb = await pool.get_connection();
    let response;
    if (limit.perpage) {
      if (Object.keys(condition).length !== 0) {
        try {
          qb.select("*");
          qb.where(condition).order_by("id", "asc");
          qb.limit(limit.perpage, limit.start);
          response = await qb.get(dbtable2);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          qb.select("*");
          qb.order_by("id", "asc");
          qb.limit(limit.perpage, limit.start);
          response = await qb.get(dbtable2);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }

      return response;
    } else {
      if (condition) {
        try {
          qb.select("*");
          qb.where(condition).order_by("id", "asc");
          response = await qb.get(dbtable2);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      } else {
        try {
          qb.select("*");
          qb.order_by("id", "asc");
          response = await qb.get(dbtable2);
        } catch (error) {
          logger.error(500,{message: error,stack: error.stack}); 
        } finally {
          qb.release();
        }
      }

      return response;
    }
  },

  new_select_list: async (condition, limit, merchant_name) => {
    let response;
    let qb = await pool.get_connection();

    // if (merchant_name) {
    //     id = await helpers.get_merchant_id_by_name_from_details_id(merchant_name);
    //     condition.submerchant_id = id;
    // }

    try {
      qb.select("*").from(dbtable3).order_by("id", "desc");

      if (condition && Object.keys(condition).length !== 0) {
        qb.where(condition);
      }

      if (limit && limit.perpage) {
        qb.limit(limit.perpage, limit.start);
      }
      response = await qb.get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;

    // if (limit.perpage) {
    //     if (Object.keys(condition).length !== 0) {
    //         qb.select("*");
    //         qb.where(condition).order_by("id", "asc");
    //         qb.limit(limit.perpage, limit.start);
    //         response = await qb.get(dbtable3);
    //         qb.release();
    //     } else {
    //         qb.select("*");
    //         qb.order_by("id", "asc");
    //         qb.limit(limit.perpage, limit.start);
    //         response = await qb.get(dbtable3);
    //         qb.release();
    //     }

    //     return response;
    // } else {
    //     if (condition) {
    //         qb.select("*");
    //         qb.where(condition).order_by("id", "asc");
    //         response = await qb.get(dbtable3);
    //         qb.release();
    //     } else {
    //         qb.select("*");
    //         qb.order_by("id", "asc");
    //         response = await qb.get(dbtable3);
    //         qb.release();
    //     }

    //     return response;
    // }
  },

  updateDetails: async (condition, data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.set(data).where(condition).update(dbtable2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  newUpdateDetails: async (condition, data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .set(data)
        .where(condition)
        .update(config.table_prefix + table);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  get_count: async (condition_obj, table_name) => {
    var output_string = "";
    for (var key in condition_obj) {
      if (condition_obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + condition_obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    let response;
    let qb = await pool.get_connection();

    try {
      if (output_string1 != "") {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable2 +
            " where " +
            output_string1
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable2
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  new_get_count: async (condition_obj, table_name) => {
    var output_string = "";
    for (var key in condition_obj) {
      if (condition_obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + condition_obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    let response;
    let qb = await pool.get_connection();

    try {
      if (output_string1 != "") {
        response = await qb.query(
          "select count('id') as count from " +
            dbtable3 +
            " where " +
            output_string1
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + dbtable3
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  get_count_by_sub_mer: async (condition_obj, table_name) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("count(id) as count", false);
      qb.where(condition_obj);
      response = await qb.get(dbtable2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  selectSubMerchantBySuperMerchant: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("id");
      qb.where(condition);
      response = await qb.get(config.table_prefix + "master_merchant");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  select_transactions_list_optimized: async (filters, pagination) => {
    console.log(`here is filter value`);
    console.log(filters);
    const qb = await pool.get_connection();

    try {
      // Start building the query with node-querybuilder
      let query = qb
        .select([
          "txn_charge.id",
          "txn_charge.order_id",
          "txn_charge.transaction_id",
          "txn_charge.txn_reference",
          "txn_charge.order_status",
          "txn_charge.currency",
          "txn_charge.amount",
          "txn_charge.sale_rate_fix_charge",
          "txn_charge.sale_rate_percent_charge",
          "txn_charge.sale_rate_tax",
          "txn_charge.calculated_fee",
          "txn_charge.applied_fee",
          "txn_charge.applied_tax",
          "txn_charge.created_at",
          "txn_charge.payment_method",
          "txn_charge.txn_type",
          "txn_charge.sub_merchant_id",
          "sm.legal_business_name as super_merchant",
          "md.company_name as sub_merchant",
          "wt.wallet_id",
          "wt.beneficiary_id as receiver_id",
        ])
        .from(`${transaction_charges} txn_charge`)
        .join(
          "pg_master_merchant mm",
          "mm.id = txn_charge.sub_merchant_id",
          "left"
        )
        .join(
          "pg_master_super_merchant sm",
          "sm.id = mm.super_merchant_id",
          "left"
        )
        .join("pg_master_merchant_details md", "md.merchant_id = mm.id", "left")
        .join(
          "pg_wallet wt",
          "wt.sub_merchant_id = txn_charge.sub_merchant_id AND wt.beneficiary_id = txn_charge.receiver_id AND wt.currency = txn_charge.currency",
          "left"
        );

      // .join(
      //   "pg_wallet wt",
      //   "(wt.sub_merchant_id != 0 AND wt.sub_merchant_id = txn_charge.sub_merchant_id AND wt.currency = txn_charge.currency" +
      //     ") OR (" +
      //     "wt.beneficiary_id != 0 AND wt.beneficiary_id = txn_charge.receiver_id AND wt.currency = txn_charge.currency)",
      //   "left"
      // )

      // Apply filters
      if (filters.super_merchant_id) {
        query = query.where("sm.id", filters.super_merchant_id);
      }
      if (filters.sub_merchant_id) {
        query = query.where("`txn_charge`.`sub_merchant_id`", filters.sub_merchant_id);
      }

      // Date range filters - Fixed for node-querybuilder
      if (filters.from_date && filters.to_date) {
        // Ensure proper date format
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";

        console.log("Date range filter:", fromDate, "to", toDate);

        // Use raw where clause for date range
        query = query
          .where(`txn_charge.created_at >= '${fromDate}'`)
          .where(`txn_charge.created_at <= '${toDate}'`);
      } else if (filters.from_date) {
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        console.log("From date filter:", fromDate);
        query = query.where(`txn_charge.created_at >= '${fromDate}'`);
      } else if (filters.to_date) {
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";
        console.log("To date filter:", toDate);
        query = query.where(`txn_charge.created_at <= '${toDate}'`);
      }

      // Additional filters
      if (filters.status) {
        query = query.where("txn_charge.order_status", filters.status);
      }

      if (filters.payment_method) {
        query = query.where(
          "txn_charge.payment_method",
          filters.payment_method
        );
      }

      // Ordering and pagination
      query = query
        .order_by("txn_charge.created_at", "DESC")
        .order_by("txn_charge.id", "DESC")
        .limit(pagination.limit)
        .offset(pagination.offset);

      console.log("Generated Query:", query.get_compiled_select());

      const result = await query.get();
      return result;
    } catch (error) {
      console.error("Optimized query failed:", error);
      throw error;
    } finally {
      qb.release();
    }
  },
  select_transactions_list_optimized_export: async (filters, pagination) => {
    console.log(`here is filter value`);
    console.log(filters);
    const qb = await pool.get_connection();

    try {
      // Start building the query with node-querybuilder
      let query = qb
        .select([
          "txn_charge.id",
          "txn_charge.order_id",
          "txn_charge.transaction_id",
          "txn_charge.txn_reference",
          "txn_charge.order_status",
          "txn_charge.currency",
          "txn_charge.amount",
          "txn_charge.sale_rate_fix_charge",
          "txn_charge.sale_rate_percent_charge",
          "txn_charge.sale_rate_tax",
          "txn_charge.calculated_fee",
          "txn_charge.applied_fee",
          "txn_charge.applied_tax",
          "txn_charge.created_at",
          "txn_charge.payment_method",
          "txn_charge.txn_type",
          "txn_charge.sub_merchant_id",
          "sm.legal_business_name as super_merchant",
          "md.company_name as sub_merchant",
          "wt.wallet_id",
          "wt.beneficiary_id as receiver_id",
        ])
        .from(`${transaction_charges} txn_charge`)
        .join(
          "pg_master_merchant mm",
          "mm.id = txn_charge.sub_merchant_id",
          "left"
        )
        .join(
          "pg_master_super_merchant sm",
          "sm.id = mm.super_merchant_id",
          "left"
        )
        .join("pg_master_merchant_details md", "md.merchant_id = mm.id", "left")
        .join(
          "pg_wallet wt",
          "wt.sub_merchant_id = txn_charge.sub_merchant_id AND wt.beneficiary_id = txn_charge.receiver_id AND wt.currency = txn_charge.currency",
          "left"
        );

      // .join(
      //   "pg_wallet wt",
      //   "(wt.sub_merchant_id != 0 AND wt.sub_merchant_id = txn_charge.sub_merchant_id AND wt.currency = txn_charge.currency" +
      //     ") OR (" +
      //     "wt.beneficiary_id != 0 AND wt.beneficiary_id = txn_charge.receiver_id AND wt.currency = txn_charge.currency)",
      //   "left"
      // )

      // Apply filters
      if (filters.super_merchant_id) {
        query = query.where("sm.id", filters.super_merchant_id);
      }
      if (filters.sub_merchant_id) {
        query = query.where("`txn_charge`.`sub_merchant_id`", filters.sub_merchant_id);
      }

      // Date range filters - Fixed for node-querybuilder
      if (filters.from_date && filters.to_date) {
        // Ensure proper date format
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";

        console.log("Date range filter:", fromDate, "to", toDate);

        // Use raw where clause for date range
        query = query
          .where(`txn_charge.created_at >= '${fromDate}'`)
          .where(`txn_charge.created_at <= '${toDate}'`);
      } else if (filters.from_date) {
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        console.log("From date filter:", fromDate);
        query = query.where(`txn_charge.created_at >= '${fromDate}'`);
      } else if (filters.to_date) {
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";
        console.log("To date filter:", toDate);
        query = query.where(`txn_charge.created_at <= '${toDate}'`);
      }

      // Additional filters
      if (filters.status) {
        query = query.where("txn_charge.order_status", filters.status);
      }

      if (filters.payment_method) {
        query = query.where(
          "txn_charge.payment_method",
          filters.payment_method
        );
      }

      // Ordering and pagination
      query = query
        .order_by("txn_charge.created_at", "DESC")
        .order_by("txn_charge.id", "DESC")
        .limit(2000)
        // .offset(pagination.offset);

      console.log("Generated Query:", query.get_compiled_select());

      const result = await query.get();
      return result;
    } catch (error) {
      console.error("Optimized query failed:", error);
      throw error;
    } finally {
      qb.release();
    }
  },

  get_transactions_count_optimized: async (filters) => {
    const qb = await pool.get_connection();

    try {
      // Start with count query
      let query = qb
        .select("COUNT(txn_charge.id) as total", false)
        .from(`${transaction_charges} txn_charge`);

      // Only join tables needed for filtering
      if (filters.super_merchant_id) {
        query = query
          .join(
            "pg_master_merchant mm",
            "mm.id = txn_charge.sub_merchant_id",
            "left"
          )
          .join(
            "pg_master_super_merchant sm",
            "sm.id = mm.super_merchant_id",
            "left"
          )
          .where("sm.id", filters.super_merchant_id);
      }

      // Apply same filters as main query - Fixed for node-querybuilder
      if (filters.from_date && filters.to_date) {
        // Ensure proper date format
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";

        console.log("Count Date range filter:", fromDate, "to", toDate);

        // Use raw where clause for date range
        query = query
          .where(`txn_charge.created_at >= '${fromDate}'`)
          .where(`txn_charge.created_at <= '${toDate}'`);
      } else if (filters.from_date) {
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        console.log("Count From date filter:", fromDate);
        query = query.where(`txn_charge.created_at >= '${fromDate}'`);
      } else if (filters.to_date) {
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";
        console.log("Count To date filter:", toDate);
        query = query.where(`txn_charge.created_at <= '${toDate}'`);
      }

      if (filters.status) {
        query = query.where("txn_charge.order_status", filters.status);
      }

      if (filters.sub_merchant_id) {
        query = query.where("`txn_charge`.`sub_merchant_id`", filters.sub_merchant_id);
      }

      if (filters.payment_method) {
        query = query.where(
          "txn_charge.payment_method",
          filters.payment_method
        );
      }

      console.log("Count Query:", query.get_compiled_select());

      const result = await query.get();
      return result[0]?.total || 0;
    } catch (error) {
      console.error("Count query failed:", error);
      throw error;
    } finally {
      qb.release();
    }
  },

  // Alternative: Use cursor-based pagination for better performance with large datasets
  select_transactions_cursor_based: async (filters, cursor, limit = 25) => {
    const qb = await pool.get_connection();

    try {
      let query = qb
        .select([
          "txn_charge.id",
          "txn_charge.created_at",
          "txn_charge.order_id",
          "txn_charge.transaction_id",
          "txn_charge.txn_reference",
          "txn_charge.order_status",
          "txn_charge.currency",
          "txn_charge.amount",
          "txn_charge.sale_rate_fix_charge",
          "txn_charge.sale_rate_percent_charge",
          "txn_charge.sale_rate_tax",
          "txn_charge.calculated_fee",
          "txn_charge.applied_fee",
          "txn_charge.applied_tax",
          "txn_charge.payment_method",
          "txn_charge.txn_type",
          "sm.legal_business_name as super_merchant",
          "md.company_name as sub_merchant",
          "wt.wallet_id",
          "wt.beneficiary_id as receiver_id",
        ])
        .from(`${transaction_charges} txn_charge`)
        .join(
          "pg_master_merchant mm",
          "mm.id = txn_charge.sub_merchant_id",
          "left"
        )
        .join(
          "pg_master_super_merchant sm",
          "sm.id = mm.super_merchant_id",
          "left"
        )
        .join("pg_master_merchant_details md", "md.merchant_id = mm.id", "left")
        .join(
          "pg_wallet wt",
          "wt.sub_merchant_id = txn_charge.sub_merchant_id AND wt.currency = txn_charge.currency",
          "left"
        );

      // Apply filters
      if (filters.super_merchant_id) {
        query = query.where("sm.id", filters.super_merchant_id);
      }

      // Apply date filters - Fixed for node-querybuilder
      if (filters.from_date && filters.to_date) {
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";

        // Use raw where clause for date range
        query = query
          .where(`txn_charge.created_at >= '${fromDate}'`)
          .where(`txn_charge.created_at <= '${toDate}'`);
      } else if (filters.from_date) {
        const fromDate = filters.from_date.includes(" ")
          ? filters.from_date
          : filters.from_date + " 00:00:00";
        query = query.where(`txn_charge.created_at >= '${fromDate}'`);
      } else if (filters.to_date) {
        const toDate = filters.to_date.includes(" ")
          ? filters.to_date
          : filters.to_date + " 23:59:59";
        query = query.where(`txn_charge.created_at <= '${toDate}'`);
      }

      if (filters.status) {
        query = query.where("txn_charge.order_status", filters.status);
      }

      if (filters.payment_method) {
        query = query.where(
          "txn_charge.payment_method",
          filters.payment_method
        );
      }

      // Cursor-based pagination
      if (cursor) {
        query = query.where(function () {
          this.where("txn_charge.created_at", "<", cursor.date).or_where(
            function () {
              this.where("txn_charge.created_at", cursor.date).where(
                "txn_charge.id",
                "<",
                cursor.id
              );
            }
          );
        });
      }

      query = query
        .order_by("txn_charge.created_at", "DESC")
        .order_by("txn_charge.id", "DESC")
        .limit(limit + 1); // Get one extra to check if there's a next page

      console.log("Cursor Query:", query.get_compiled_select());

      const result = await query.get();
      const hasNextPage = result.length > limit;

      if (hasNextPage) {
        result.pop(); // Remove the extra record
      }

      const nextCursor =
        hasNextPage && result.length > 0
          ? {
              date: result[result.length - 1].created_at,
              id: result[result.length - 1].id,
            }
          : null;

      return { data: result, nextCursor, hasNextPage };
    } catch (error) {
      console.error("Cursor-based query failed:", error);
      throw error;
    } finally {
      qb.release();
    }
  },
  get_order_charges: async (order_id) => {
    var query =
      "select txn_charge.*,sm.name as super_merchant,md.company_name as sub_merchant from pg_transaction_charges txn_charge LEFT JOIN pg_master_merchant mm ON txn_charge.sub_merchant_id=mm.id LEFT JOIN pg_master_super_merchant sm ON mm.super_merchant_id=sm.id LEFT JOIN pg_master_merchant_details md ON mm.id=md.merchant_id WHERE txn_charge.order_id=" +
      order_id +
      ";";
    console.log(query);
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
  transactions_count: async (and_condition, date_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      final_cond = final_cond + "sm.id=" + and_condition.super_merchant_id;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "txn_charge.created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }
    var query =
      "select count(txn_charge.id) as count from " +
      transaction_charges +
      " txn_charge LEFT JOIN pg_master_merchant mm ON txn_charge.sub_merchant_id=mm.id LEFT JOIN pg_master_super_merchant sm ON mm.super_merchant_id=sm.id";
    final_cond + " order BY txn_charge.ID DESC LIMIT ";
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  select_feature_list: async (and_condition, date_condition, limit) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }
    if (limit.perpage) {
      var query =
        "select * from " +
        feature_charges +
        final_cond +
        " order BY ID DESC LIMIT " +
        limit.start +
        "," +
        limit.perpage;
    } else {
      var query =
        "select * from " + feature_charges + final_cond + " order BY ID DESC ";
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
  feature_count: async (and_condition, date_condition) => {
    let final_cond = " where ";
    if (Object.keys(and_condition).length) {
      let condition = await helpers.get_and_conditional_string(and_condition);
      final_cond = final_cond + condition;
    }
    if (Object.keys(date_condition).length) {
      let date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "created_at"
      );
      if (final_cond == " where ") {
        final_cond = final_cond + date_condition_str;
      } else {
        final_cond = final_cond + " and " + date_condition_str;
      }
    }
    if (final_cond == " where ") {
      final_cond = "";
    }
    var query =
      "select count(id) as count from " +
      feature_charges +
      final_cond +
      " order BY ID DESC ";

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  invoice_to_merchant_list: async (condition, limit) => {
    console.log("condition", condition);
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select("*");

      if (Object.keys(condition).length !== 0) {
        qb.where(condition);
      }

      if (limit.perpage) {
        qb.limit(limit.perpage, limit.start);
      }
      response = await qb.get(invoice_to_merchant);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;

    /*
        if (limit.perpage) {
            if (Object.keys(condition).length !== 0) {
                qb.select("*");
                qb.where(condition).order_by("id", "asc");
                qb.limit(limit.perpage, limit.start);
                response = await qb.get(dbtable3);
                qb.release();
            } else {
                qb.select("*");
                qb.order_by("id", "asc");
                qb.limit(limit.perpage, limit.start);
                response = await qb.get(dbtable3);
                qb.release();
            }

            return response;
        } else {
            if (condition) {
                qb.select("*");
                qb.where(condition).order_by("id", "asc");
                response = await qb.get(dbtable3);
                qb.release();
            } else {
                qb.select("*");
                qb.order_by("id", "asc");
                response = await qb.get(dbtable3);
                qb.release();
            }

            return response;
        }
        */
  },
  invoice_to_merchant_count: async (condition_obj, table_name) => {
    var output_string = "";
    for (var key in condition_obj) {
      if (condition_obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + condition_obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    let response;
    let qb = await pool.get_connection();

    try {
      if (output_string1 != "") {
        response = await qb.query(
          "select count('id') as count from " +
            invoice_to_merchant +
            " where " +
            output_string1
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + invoice_to_merchant
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },

  invoice_to_psp_list: async (condition, limit) => {
    let response;
    let qb = await pool.get_connection();

    try {
      qb.select("*");

      if (Object.keys(condition).length !== 0) {
        qb.where(condition);
      }

      if (limit.perpage) {
        qb.limit(limit.perpage, limit.start);
      }
      response = await qb.get(invoice_to_psp);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response;

    /*
        if (limit.perpage) {
            if (Object.keys(condition).length !== 0) {
                qb.select("*");
                qb.where(condition).order_by("id", "asc");
                qb.limit(limit.perpage, limit.start);
                response = await qb.get(dbtable3);
                qb.release();
            } else {
                qb.select("*");
                qb.order_by("id", "asc");
                qb.limit(limit.perpage, limit.start);
                response = await qb.get(dbtable3);
                qb.release();
            }

            return response;
        } else {
            if (condition) {
                qb.select("*");
                qb.where(condition).order_by("id", "asc");
                response = await qb.get(dbtable3);
                qb.release();
            } else {
                qb.select("*");
                qb.order_by("id", "asc");
                response = await qb.get(dbtable3);
                qb.release();
            }

            return response;
        }
        */
  },
  invoice_to_psp_count: async (condition_obj, table_name) => {
    var output_string = "";
    for (var key in condition_obj) {
      if (condition_obj.hasOwnProperty(key)) {
        output_string += "and " + key + " = " + condition_obj[key] + " ";
      }
    }

    let words = output_string.split(" ");
    let output_string1 = words.slice(1).join(" ");
    let response;
    let qb = await pool.get_connection();

    try {
      if (output_string1 != "") {
        response = await qb.query(
          "select count('id') as count from " +
            invoice_to_psp +
            " where " +
            output_string1
        );
      } else {
        response = await qb.query(
          "select count('id') as count from " + invoice_to_psp
        );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0].count;
  },
  fetchWalletSummary: async (condition, limit, dateRange = {}) => {
    console.log(
      `Fetching transaction summary with limit:`,
      JSON.stringify(limit)
    );
    console.log(`Date range:`, dateRange);

    let condition_string = await helpers.get_and_conditional_string(condition);
    console.log("Generated condition string:", condition_string);

    let response;
    let qb = await pool.get_connection();

    try {
      const offset = parseInt(limit.page) * parseInt(limit.per_page);
      const per_page = parseInt(limit.per_page);

      // Build date filter for performance
      let dateFilter = "";
      if (dateRange.start_date && dateRange.end_date) {
        dateFilter = `t.created_at >= '${dateRange.start_date}' AND t.created_at <= '${dateRange.end_date}'`;
      } else {
        // Default to last 365 days
        dateFilter = `t.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 365 DAY)`;
      }

      const baseQuery = `
        SELECT 
            t.sub_merchant_id, 
            d.company_name AS sub_merchant_name, 
            m.super_merchant_id, 
            s.legal_business_name AS super_merchant_name, 
            t.currency, 
            w.wallet_id,
            w.beneficiary_id AS receiver_id,
            SUM(t.net_amount) AS total_net_amount, 
            d.account_id, 
            DATE(t.created_at) AS txn_date, 
            COUNT(*) AS transaction_count
        FROM pg_transaction_charges t
        INNER JOIN pg_master_merchant m ON t.sub_merchant_id = m.id
        INNER JOIN pg_master_super_merchant s ON m.super_merchant_id = s.id
        INNER JOIN pg_master_merchant_details d ON d.merchant_id = t.sub_merchant_id
        LEFT JOIN pg_wallet w ON (w.sub_merchant_id != 0 AND w.sub_merchant_id = t.sub_merchant_id AND w.currency = t.currency)
        WHERE ${dateFilter}
        GROUP BY t.sub_merchant_id, t.currency, DATE(t.created_at), d.company_name, m.super_merchant_id, s.legal_business_name, d.account_id, w.wallet_id
    `;

      const unionQuery = `
        UNION ALL
        SELECT 
            NULL AS sub_merchant_id, 
            NULL AS sub_merchant_name, 
            NULL AS super_merchant_id, 
            NULL AS super_merchant_name, 
            t.currency, 
            w.wallet_id,
            w.beneficiary_id AS receiver_id,
            SUM(t.net_amount) AS total_net_amount, 
            NULL AS account_id, 
            DATE(t.created_at) AS txn_date, 
            COUNT(*) AS transaction_count
        FROM pg_transaction_charges t
        LEFT JOIN pg_wallet w ON (w.beneficiary_id != 0 AND t.receiver_id = w.beneficiary_id AND t.currency = w.currency)
        WHERE ${dateFilter}
        GROUP BY t.currency, DATE(t.created_at), w.wallet_id
    `;

      let query = "";
      if (condition_string.trim() !== "") {
        query = `
            ${baseQuery}
            ${unionQuery}
            AND ${condition_string}
            ORDER BY txn_date DESC
            LIMIT ${offset}, ${per_page}
        `;
      } else {
        query = `
            ${baseQuery}
            ${unionQuery}
            ORDER BY txn_date DESC
            LIMIT ${offset}, ${per_page}
        `;
      }

      console.log("Optimized transaction query:", query);
      response = await qb.query(query);
    } catch (error) {
      console.error("Transaction summary query failed:", error);
      throw error;
    } finally {
      qb.release();
    }

    return response || [];
  },
  fetchWalletBalanceOld: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `WITH latest_snap AS (
    SELECT
        w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
        s.balance, s.snap_date
    FROM pg_wallet w
    LEFT JOIN (
        SELECT
            s1.wallet_id, s1.balance, s1.snap_date
        FROM pg_wallet_snap s1
        JOIN (
            SELECT wallet_id, MAX(snap_date) AS snap_date
            FROM pg_wallet_snap
            GROUP BY wallet_id
        ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
    ) s ON w.wallet_id = s.wallet_id
),
net_amounts_filtered AS (
    SELECT
        ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
        ls.balance, ls.snap_date, ls.beneficiary_id,
        SUM(
            CASE
                WHEN ls.snap_date IS NOT NULL AND tc.created_at >= TIMESTAMP(ls.snap_date, '23:59:59') THEN tc.net_amount
                WHEN ls.snap_date IS NULL THEN tc.net_amount
                ELSE 0
            END
        ) AS net_amount_after_snapshot
    FROM latest_snap ls
    LEFT JOIN pg_transaction_charges tc ON (
        -- Only match when sub_merchant_id is not null and not 0
        (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 AND tc.sub_merchant_id = ls.sub_merchant_id AND tc.currency = ls.currency)
        OR 
        -- Only match on receiver_id when sub_merchant_id is null or 0, and beneficiary_id is not null and not 0
        ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 AND tc.receiver_id = ls.beneficiary_id AND tc.currency = ls.currency)
    )
    GROUP BY
        ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
        ls.balance, ls.snap_date, ls.beneficiary_id
),
pending_payouts AS (
    SELECT
        sub_merchant_id, receiver_id, currency,
        SUM(amount) AS pending_amount
    FROM pg_payout_pending_transactions
    WHERE status = 0 AND order_status = 'PENDING'
    GROUP BY sub_merchant_id, receiver_id, currency
)
SELECT
    naf.wallet_id, 
    CASE WHEN naf.sub_merchant_id = 0 THEN 'null' ELSE naf.sub_merchant_id END as sub_merchant_id,
    CASE WHEN naf.beneficiary_id = 0 THEN 'null' ELSE naf.beneficiary_id END as receiver_id, 
    naf.currency,
    COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) AS total_balance,
    COALESCE(pp.pending_amount, 0) AS pending_balance,
    COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) - COALESCE(pp.pending_amount, 0) AS balance
FROM net_amounts_filtered naf
LEFT JOIN pending_payouts pp ON (
    -- Only match when sub_merchant_id is not null and not 0
    (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 AND pp.sub_merchant_id = naf.sub_merchant_id AND pp.currency = naf.currency)
    OR 
    -- Only match on receiver_id when sub_merchant_id is null or 0, and beneficiary_id is not null and not 0
    ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 AND pp.receiver_id = naf.beneficiary_id AND pp.currency = naf.currency)
)`;

      // if (!condition.sub_merchant_id) {

      //     query = `WITH latest_snap AS (
      //     SELECT
      //       w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
      //       s.balance, s.snap_date
      //     FROM pg_wallet w
      //     LEFT JOIN (
      //       SELECT
      //         s1.wallet_id, s1.balance, s1.snap_date
      //       FROM pg_wallet_snap s1
      //       JOIN (
      //         SELECT wallet_id, MAX(snap_date) AS snap_date
      //         FROM pg_wallet_snap
      //         GROUP BY wallet_id
      //       ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
      //     ) s ON w.wallet_id = s.wallet_id
      //   ),
      //   net_amounts_filtered AS (
      //     SELECT
      //       ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
      //       ls.balance, ls.snap_date, ls.beneficiary_id,
      //       SUM(
      //         CASE
      //           WHEN ls.snap_date IS NOT NULL AND tc.created_at >= TIMESTAMP(ls.snap_date, '23:59:59') THEN tc.net_amount
      //           WHEN ls.snap_date IS NULL THEN tc.net_amount
      //           ELSE 0
      //         END
      //       ) AS net_amount_after_snapshot
      //     FROM latest_snap ls
      //     LEFT JOIN pg_transaction_charges tc
      //       ON (tc.receiver_id = ls.beneficiary_id AND tc.currency = ls.currency)
      //     GROUP BY
      //       ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
      //       ls.balance, ls.snap_date, ls.beneficiary_id
      //   ),
      //   pending_payouts AS (
      //     SELECT
      //       sub_merchant_id, currency, receiver_id,
      //       SUM(amount) AS pending_amount
      //     FROM pg_payout_pending_transactions
      //     WHERE status = 0 AND order_status = 'PENDING'
      //     GROUP BY sub_merchant_id, currency, receiver_id
      //   )
      //   SELECT
      //     naf.wallet_id, naf.sub_merchant_id, naf.beneficiary_id, naf.currency,
      //     COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) AS total_balance,
      //     COALESCE(pp.pending_amount, 0) AS pending_balance,
      //     COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) - COALESCE(pp.pending_amount, 0) AS balance
      //   FROM net_amounts_filtered naf
      //   LEFT JOIN pending_payouts pp
      //     ON (pp.receiver_id = naf.beneficiary_id AND pp.currency = naf.currency)`;

      // }

      let conditionsArr = [];

      // add conditions dynamically
      if (condition.sub_merchant_id && condition.currency) {
        conditionsArr.push(
          `naf.sub_merchant_id = '${condition.sub_merchant_id}' AND naf.currency = '${condition.currency}'`
        );
      }
      if (condition.wallet_id) {
        conditionsArr.push(`naf.wallet_id = '${condition.wallet_id}'`);
      }
      if (condition.receiver_id) {
        conditionsArr.push(
          `naf.beneficiary_id = '${condition.receiver_id}' AND naf.currency = '${condition.currency}'`
        );
      }

      // only add WHERE if there are conditions
      if (conditionsArr.length > 0) {
        query += ` WHERE ${conditionsArr.join(" OR ")}`;
      }

      query += ` ORDER BY naf.id LIMIT 1;`;

      // let query = `WITH latest_snap AS (SELECT w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id, s.balance, s.snap_date FROM pg_wallet w LEFT JOIN (SELECT s1.wallet_id, s1.balance, s1.snap_date FROM pg_wallet_snap s1 JOIN (SELECT wallet_id, MAX(snap_date) AS snap_date FROM pg_wallet_snap GROUP BY wallet_id) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date) s ON w.wallet_id = s.wallet_id WHERE (w.sub_merchant_id='${condition.sub_merchant_id}' AND w.currency='${condition.currency}') OR w.wallet_id='${condition.wallet_id}' OR (w.beneficiary_id='${condition.receiver_id}' AND w.currency="${condition.currency}")), net_amounts_filtered AS (SELECT ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency, ls.balance, ls.snap_date, ls.beneficiary_id, SUM(CASE WHEN ls.snap_date IS NOT NULL AND tc.created_at >= TIMESTAMP(ls.snap_date, '23:59:59') THEN tc.net_amount WHEN ls.snap_date IS NULL THEN tc.net_amount ELSE 0 END) AS net_amount_after_snapshot FROM latest_snap ls LEFT JOIN pg_transaction_charges tc ON tc.sub_merchant_id = ls.sub_merchant_id AND tc.currency = ls.currency GROUP BY ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency, ls.balance, ls.snap_date, ls.beneficiary_id), pending_payouts AS (SELECT sub_merchant_id, currency, SUM(amount) AS pending_amount FROM pg_payout_pending_transactions WHERE status = 0 AND order_status = 'PENDING' GROUP BY sub_merchant_id, currency) SELECT naf.wallet_id, naf.sub_merchant_id, naf.beneficiary_id, naf.currency, COALESCE(naf.balance,0)+COALESCE(naf.net_amount_after_snapshot,0) AS total_balance, COALESCE(pp.pending_amount, 0) AS pending_balance, COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) - COALESCE(pp.pending_amount, 0) AS balance FROM net_amounts_filtered naf LEFT JOIN pending_payouts pp ON pp.sub_merchant_id = naf.sub_merchant_id AND pp.currency = naf.currency ORDER BY naf.id LIMIT 1;`;
      console.log(query);
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response.length > 0 ? response?.[0] : false;
  },
 fetchWalletBalanceBefore: async (condition) => {
  let qb;
  try {
    qb = await pool.get_connection();
    
    // Helper function to safely escape values
    const escapeValue = (value) => {
      if (value === null || value === undefined) {
        return 'NULL';
      }
      if (typeof value === 'number') {
        return value;
      }
      // Escape string values
      return qb.escape(value);
    };
    
    // Build WHERE conditions
    const conditionsArr = [];
    
    if (condition.sub_merchant_id && condition.currency) {
      conditionsArr.push(
        `naf.sub_merchant_id = ${escapeValue(condition.sub_merchant_id)} AND naf.currency = ${escapeValue(condition.currency)}`
      );
    }
    
    if (condition.wallet_id) {
      conditionsArr.push(`naf.wallet_id = ${escapeValue(condition.wallet_id)}`);
    }
    
    if (condition.receiver_id && condition.currency && !condition.sub_merchant_id) {
      conditionsArr.push(
        `naf.beneficiary_id = ${escapeValue(condition.receiver_id)} AND naf.currency = ${escapeValue(condition.currency)}`
      );
    }
    
    // Require at least one condition
    if (conditionsArr.length === 0) {
      throw new Error('At least one condition (sub_merchant_id, wallet_id, or receiver_id) is required');
    }
    
    const whereClause = `WHERE ${conditionsArr.join(' OR ')}`;
    
    // Build complete query
    const query = `
      WITH latest_snap AS (
        SELECT
          w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
          s.balance, s.snap_date, s.total_balance, s.pending_balance
        FROM pg_wallet w
        LEFT JOIN (
          SELECT
            s1.wallet_id, s1.balance, s1.snap_date, s1.total_balance, s1.pending_balance
          FROM pg_wallet_snap s1
          INNER JOIN (
            SELECT wallet_id, MAX(snap_date) AS snap_date
            FROM pg_wallet_snap
            GROUP BY wallet_id
          ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
        ) s ON w.wallet_id = s.wallet_id
      ),
      transaction_charges_after_snap AS (
        SELECT
          ls.id, 
          ls.wallet_id, 
          ls.sub_merchant_id, 
          ls.currency,
          ls.balance AS snap_balance, 
          ls.total_balance AS snap_total_balance,
          ls.pending_balance AS snap_pending_balance,
          ls.snap_date, 
          ls.beneficiary_id,
          COALESCE(SUM(
            CASE
              WHEN ls.snap_date IS NOT NULL AND tc.created_at > CONCAT(ls.snap_date, '23:59:59') 
                THEN tc.net_amount
              WHEN ls.snap_date IS NULL 
                THEN tc.net_amount
              ELSE 0
            END
          ), 0) AS transaction_charges_after_snap
        FROM latest_snap ls
        LEFT JOIN pg_transaction_charges tc ON (
          tc.currency = ls.currency
          AND (
            (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 
              AND tc.sub_merchant_id = ls.sub_merchant_id)
            OR 
            ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) 
              AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 
              AND tc.receiver_id = ls.beneficiary_id)
          )
        )
        GROUP BY
          ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
          ls.balance, ls.total_balance, ls.pending_balance, ls.snap_date, ls.beneficiary_id
      ),
      pending_payouts_after_snap AS (
        SELECT
          naf.id,
          COALESCE(SUM(
            CASE
              WHEN naf.snap_date IS NOT NULL AND pp.created_at > CONCAT(naf.snap_date, '23:59:59')
                THEN pp.amount
              WHEN naf.snap_date IS NULL
                THEN pp.amount
              ELSE 0
            END
          ), 0) AS pending_payouts_after_snap
        FROM transaction_charges_after_snap naf
        LEFT JOIN pg_payout_pending_transactions pp ON (
          pp.status = 0 
          AND pp.order_status = 'PENDING'
          AND pp.currency = naf.currency
          AND (
            (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 
              AND pp.sub_merchant_id = naf.sub_merchant_id)
            OR 
            ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) 
              AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 
              AND pp.receiver_id = naf.beneficiary_id)
          )
          AND NOT EXISTS (
            SELECT 1 
            FROM pg_transaction_charges tx
            WHERE tx.order_id = pp.order_id
              AND tx.currency = pp.currency
              AND (
                (pp.sub_merchant_id != 0 AND tx.sub_merchant_id = pp.sub_merchant_id)
                OR
                (pp.sub_merchant_id = 0 AND pp.receiver_id != 0 AND tx.receiver_id = pp.receiver_id)
              )
          )
        )
        GROUP BY naf.id
      )
      SELECT
        naf.wallet_id, 
        CASE WHEN naf.sub_merchant_id = 0 THEN NULL ELSE naf.sub_merchant_id END as sub_merchant_id,
        CASE WHEN naf.beneficiary_id = 0 THEN NULL ELSE naf.beneficiary_id END as receiver_id, 
        naf.currency,
        COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap AS total_balance,
        COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0) AS pending_balance,
        (COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap) 
          - (COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0)) AS balance
      FROM transaction_charges_after_snap naf
      LEFT JOIN pending_payouts_after_snap pp ON naf.id = pp.id
      ${whereClause}
      ORDER BY naf.id 
      LIMIT 1
    `.trim();
    console.log('Executing wallet balance query with conditions:', condition);
    const response = await qb.query(query);
    
    if (response.length === 0) {
      console.log('No wallet found for conditions:', condition);
      return null;
    }
    
    return response?.[0];
    
  } catch (error) {
    console.error('Failed to fetch wallet balance:', {
      error: error.message,
      condition,
      stack: error.stack
    });
    throw new Error(`Wallet balance fetch failed: ${error.message}`);
  } finally {
      qb.release();
  }
},
fetchWalletBalance: async (condition) => {
  let qb;
  try {
    qb = await pool.get_connection();
    
    let walletId = condition.wallet_id;
    
    // Step 1: If wallet_id not provided, fetch it first (fast lookup)
    if (!walletId) {
      let lookupQuery;
      
      if (condition.sub_merchant_id && condition.currency) {
        lookupQuery = `
          SELECT wallet_id 
          FROM pg_wallet 
          WHERE sub_merchant_id = ${qb.escape(condition.sub_merchant_id)} 
            AND currency = ${qb.escape(condition.currency)}
            AND active = 1
            AND deleted = 0
          LIMIT 1
        `;
      } 
      else if (condition.receiver_id && condition.currency) {
        lookupQuery = `
          SELECT wallet_id 
          FROM pg_wallet 
          WHERE beneficiary_id = ${qb.escape(condition.receiver_id)} 
            AND currency = ${qb.escape(condition.currency)}
            AND active = 1
            AND deleted = 0
          LIMIT 1
        `;
      } 
      else {
        throw new Error('Invalid condition: provide wallet_id OR (sub_merchant_id + currency) OR (receiver_id + currency)');
      }
      
      console.log('Fetching wallet_id with lookup query');
      const lookupResult = await qb.query(lookupQuery);
      
      if (!lookupResult || lookupResult.length === 0) {
        console.log('No wallet found for conditions:', condition);
        return null;
      }
      
      walletId = lookupResult[0].wallet_id;
      console.log('Found wallet_id:', walletId);
    }
    
    // Step 2: Fetch balance using wallet_id (fastest path)
    const query = `
      WITH latest_snap AS (
        SELECT
          w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
          s.balance, s.snap_date, s.total_balance, s.pending_balance
        FROM pg_wallet w
        LEFT JOIN (
          SELECT
            s1.wallet_id, s1.balance, s1.snap_date, s1.total_balance, s1.pending_balance
          FROM pg_wallet_snap s1
          INNER JOIN (
            SELECT wallet_id, MAX(snap_date) AS snap_date
            FROM pg_wallet_snap
            GROUP BY wallet_id
          ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
        ) s ON w.wallet_id = s.wallet_id
        WHERE w.wallet_id = ${qb.escape(walletId)}
      ),
      transaction_charges_after_snap AS (
        SELECT
          ls.id, 
          ls.wallet_id, 
          ls.sub_merchant_id, 
          ls.currency,
          ls.balance AS snap_balance, 
          ls.total_balance AS snap_total_balance,
          ls.pending_balance AS snap_pending_balance,
          ls.snap_date, 
          ls.beneficiary_id,
          COALESCE(SUM(
            CASE
              WHEN ls.snap_date IS NOT NULL AND tc.created_at > TIMESTAMP(ls.snap_date, '23:59:59') 
                THEN tc.net_amount
              WHEN ls.snap_date IS NULL 
                THEN tc.net_amount
              ELSE 0
            END
          ), 0) AS transaction_charges_after_snap
        FROM latest_snap ls
        LEFT JOIN pg_transaction_charges tc ON (
          tc.currency = ls.currency
          AND (
            (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 
              AND tc.sub_merchant_id = ls.sub_merchant_id)
            OR 
            ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) 
              AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 
              AND tc.receiver_id = ls.beneficiary_id)
          )
        )
        GROUP BY
          ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
          ls.balance, ls.total_balance, ls.pending_balance, ls.snap_date, ls.beneficiary_id
      ),
      pending_payouts_after_snap AS (
        SELECT
          naf.id,
          COALESCE(SUM(
            CASE
              WHEN naf.snap_date IS NOT NULL AND pp.created_at > TIMESTAMP(naf.snap_date, '23:59:59')
                THEN pp.amount
              WHEN naf.snap_date IS NULL
                THEN pp.amount
              ELSE 0
            END
          ), 0) AS pending_payouts_after_snap
        FROM transaction_charges_after_snap naf
        LEFT JOIN pg_payout_pending_transactions pp ON (
          pp.status = 0 
          AND pp.order_status = 'PENDING'
          AND pp.currency = naf.currency
          AND (
            (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 
              AND pp.sub_merchant_id = naf.sub_merchant_id)
            OR 
            ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) 
              AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 
              AND pp.receiver_id = naf.beneficiary_id)
          )
          AND NOT EXISTS (
            SELECT 1 
            FROM pg_transaction_charges tx
            WHERE tx.order_id = pp.order_id
              AND tx.currency = pp.currency
              AND (
                (pp.sub_merchant_id != 0 AND tx.sub_merchant_id = pp.sub_merchant_id)
                OR
                (pp.sub_merchant_id = 0 AND pp.receiver_id != 0 AND tx.receiver_id = pp.receiver_id)
              )
          )
        )
        GROUP BY naf.id
      )
      SELECT
        naf.wallet_id, 
        CASE WHEN naf.sub_merchant_id = 0 THEN NULL ELSE naf.sub_merchant_id END as sub_merchant_id,
        CASE WHEN naf.beneficiary_id = 0 THEN NULL ELSE naf.beneficiary_id END as receiver_id, 
        naf.currency,
        COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap AS total_balance,
        COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0) AS pending_balance,
        (COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap) 
          - (COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0)) AS balance
      FROM transaction_charges_after_snap naf
      LEFT JOIN pending_payouts_after_snap pp ON naf.id = pp.id
      LIMIT 1
    `.trim();
    
    console.log('Executing wallet balance query for wallet_id:', walletId);
    console.log(query);
    const response = await qb.query(query);
    
    if (response.length === 0) {
      console.log('No balance data found for wallet_id:', walletId);
      return null;
    }
    
    return response[0];
    
  } catch (error) {
    console.error('Failed to fetch wallet balance:', {
      error: error.message,
      condition,
      stack: error.stack
    });
    throw new Error(`Wallet balance fetch failed: ${error.message}`);
  } finally {
    qb.release();
  }
},
fetchWalletBalances: async (walletIds) => {
  let qb;
  try {
    qb = await pool.get_connection();
    
    // Validate input
    if (!walletIds || walletIds.length === 0) {
      console.log('No wallet IDs provided');
      return [];
    }
    
    // Escape wallet IDs for safe SQL
    const escapedIds = walletIds.map(id => qb.escape(id)).join(',');
    
    // Build complete query
    const query = `
      WITH latest_snap AS (
        SELECT
          w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
          s.balance, s.snap_date, s.total_balance, s.pending_balance
        FROM pg_wallet w
        LEFT JOIN (
          SELECT
            s1.wallet_id, s1.balance, s1.snap_date, s1.total_balance, s1.pending_balance
          FROM pg_wallet_snap s1
          INNER JOIN (
            SELECT wallet_id, MAX(snap_date) AS snap_date
            FROM pg_wallet_snap
            GROUP BY wallet_id
          ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
        ) s ON w.wallet_id = s.wallet_id
        WHERE w.wallet_id IN (${escapedIds})
      ),
      transaction_charges_after_snap AS (
        SELECT
          ls.id, 
          ls.wallet_id, 
          ls.sub_merchant_id, 
          ls.currency,
          ls.balance AS snap_balance, 
          ls.total_balance AS snap_total_balance,
          ls.pending_balance AS snap_pending_balance,
          ls.snap_date, 
          ls.beneficiary_id,
          COALESCE(SUM(
            CASE
              WHEN ls.snap_date IS NOT NULL AND tc.created_at > TIMESTAMP(ls.snap_date, '23:59:59') 
                THEN tc.net_amount
              WHEN ls.snap_date IS NULL 
                THEN tc.net_amount
              ELSE 0
            END
          ), 0) AS transaction_charges_after_snap
        FROM latest_snap ls
        LEFT JOIN pg_transaction_charges tc ON (
          tc.currency = ls.currency
          AND (
            (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 
              AND tc.sub_merchant_id = ls.sub_merchant_id)
            OR 
            ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) 
              AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 
              AND tc.receiver_id = ls.beneficiary_id)
          )
        )
        GROUP BY
          ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
          ls.balance, ls.total_balance, ls.pending_balance, ls.snap_date, ls.beneficiary_id
      ),
      pending_payouts_after_snap AS (
        SELECT
          naf.id,
          COALESCE(SUM(
            CASE
              WHEN naf.snap_date IS NOT NULL AND pp.created_at > TIMESTAMP(naf.snap_date, '23:59:59')
                THEN pp.amount
              WHEN naf.snap_date IS NULL
                THEN pp.amount
              ELSE 0
            END
          ), 0) AS pending_payouts_after_snap
        FROM transaction_charges_after_snap naf
        LEFT JOIN pg_payout_pending_transactions pp ON (
          pp.status = 0 
          AND pp.order_status = 'PENDING'
          AND pp.currency = naf.currency
          AND (
            (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 
              AND pp.sub_merchant_id = naf.sub_merchant_id)
            OR 
            ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) 
              AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 
              AND pp.receiver_id = naf.beneficiary_id)
          )
          AND NOT EXISTS (
            SELECT 1 
            FROM pg_transaction_charges tx
            WHERE tx.order_id = pp.order_id
              AND tx.currency = pp.currency
              AND (
                (pp.sub_merchant_id != 0 AND tx.sub_merchant_id = pp.sub_merchant_id)
                OR
                (pp.sub_merchant_id = 0 AND pp.receiver_id != 0 AND tx.receiver_id = pp.receiver_id)
              )
          )
        )
        GROUP BY naf.id
      )
      SELECT
        naf.wallet_id, 
        CASE WHEN naf.sub_merchant_id = 0 THEN NULL ELSE naf.sub_merchant_id END as sub_merchant_id,
        CASE WHEN naf.beneficiary_id = 0 THEN NULL ELSE naf.beneficiary_id END as receiver_id, 
        naf.currency,
        COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap AS total_balance,
        COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0) AS pending_balance,
        (COALESCE(naf.snap_total_balance, 0) + naf.transaction_charges_after_snap) 
          - (COALESCE(naf.snap_pending_balance, 0) + COALESCE(pp.pending_payouts_after_snap, 0)) AS balance
      FROM transaction_charges_after_snap naf
      LEFT JOIN pending_payouts_after_snap pp ON naf.id = pp.id
      ORDER BY naf.wallet_id
    `.trim();
    
    console.log(`Executing wallet balance query for ${walletIds.length} wallets`);
    const response = await qb.query(query);
    
    console.log(`Fetched balances for ${response.length} wallets`);
    return response;
    
  } catch (error) {
    console.error('Failed to fetch wallet balances:', {
      error: error.message,
      walletCount: walletIds?.length,
      stack: error.stack
    });
    throw new Error(`Wallet balance fetch failed: ${error.message}`);
  } finally {
    if (qb) {
      qb.release();
    }
  }
},
  addCharges: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "transaction_charges", data);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  updateCharges: async (data, sub_merchant_id) => {
    let qb = await pool.get_connection();
    let response;
    try {
        response = await qb
        .set(data)
        .where({sub_merchant_id: sub_merchant_id, receiver_id: 0})
        .update(config.table_prefix + "transaction_charges");
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  fetchWalletList: async (country_id, currency, amount, country) => {
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `SELECT tc.sub_merchant_id, SUM(tc.net_amount) - COALESCE(ppt.amount, 0) AS total_net_amount, tc.currency, '${country}' AS country, w.wallet_id AS wallet_id FROM pg_transaction_charges tc JOIN pg_master_merchant m ON tc.sub_merchant_id = m.id JOIN pg_master_merchant_details md ON m.id = md.merchant_id LEFT JOIN (SELECT sub_merchant_id, currency, SUM(amount) AS amount FROM pg_payout_pending_transactions WHERE status = 0 AND order_status = 'PENDING' GROUP BY sub_merchant_id, currency) ppt ON tc.sub_merchant_id = ppt.sub_merchant_id AND tc.currency = ppt.currency JOIN pg_wallet w ON tc.sub_merchant_id = w.sub_merchant_id AND tc.currency = w.currency WHERE tc.currency = '${currency}' AND tc.status = 0 AND md.register_business_country = ${country_id} GROUP BY tc.sub_merchant_id, tc.currency, w.id HAVING total_net_amount >= ${amount};`;
      console.log("🚀 ~ fetchWalletList: ~ query:", query);
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  // Fixed fetchWallets function with proper pagination
  fetchWallets: async (condition, limit) => {
    console.log(`inside the fetch wallet models to printing limit`);
    console.log(JSON.stringify(limit));

    let condition_string = await helpers.get_and_conditional_string(condition);
    console.log(condition_string);

    let response;
    let qb = await pool.get_connection();

    try {
      // Calculate proper OFFSET: (page - 1) * per_page for 1-based pagination
      // Or use page * per_page for 0-based pagination
      const offset = parseInt(limit.page) * parseInt(limit.per_page); // Assuming 0-based pagination
      const per_page = parseInt(limit.per_page);

      console.log(`Calculated offset: ${offset}, per_page: ${per_page}`);

      let query = "";

      // Base query without pagination for both conditions
      const baseQuery = `
     WITH latest_snap AS (
    SELECT 
        w.id, w.wallet_id, w.sub_merchant_id, w.currency, w.beneficiary_id,
        s.balance, s.snap_date
    FROM pg_wallet w
    LEFT JOIN (
        SELECT 
            s1.wallet_id, s1.balance, s1.snap_date,
            ROW_NUMBER() OVER (PARTITION BY s1.wallet_id ORDER BY s1.snap_date DESC, s1.id DESC) as rn
        FROM pg_wallet_snap s1
    ) s ON w.wallet_id = s.wallet_id AND s.rn = 1
),
net_amounts_filtered AS (
    SELECT
        ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
        ls.balance, ls.snap_date, ls.beneficiary_id,
        SUM(
            CASE
                WHEN ls.snap_date IS NOT NULL AND tc.created_at >= TIMESTAMP(ls.snap_date, '23:59:59') THEN tc.net_amount
                WHEN ls.snap_date IS NULL THEN tc.net_amount
                ELSE 0
            END
        ) AS net_amount_after_snapshot
    FROM latest_snap ls
    LEFT JOIN pg_transaction_charges tc ON (
        -- Only match when sub_merchant_id is not null and not 0
        (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 AND tc.sub_merchant_id = ls.sub_merchant_id AND tc.currency = ls.currency)
        OR 
        -- Only match on receiver_id when sub_merchant_id is null or 0, and beneficiary_id is not null and not 0
        ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 AND tc.receiver_id = ls.beneficiary_id AND tc.currency = ls.currency)
    )
    GROUP BY
        ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency,
        ls.balance, ls.snap_date, ls.beneficiary_id
),
pending_payouts AS (
    SELECT
        sub_merchant_id, receiver_id, currency,
        SUM(amount) AS pending_amount
    FROM pg_payout_pending_transactions
    WHERE status = 0 AND order_status = 'PENDING'
    GROUP BY sub_merchant_id, receiver_id, currency
),
merchant_details AS (
    SELECT DISTINCT merchant_id, company_name
    FROM pg_master_merchant_details
),
master_merchant AS (
    SELECT DISTINCT id, super_merchant_id
    FROM pg_master_merchant
),
super_merchant AS (
    SELECT DISTINCT id, legal_business_name
    FROM pg_master_super_merchant
)
SELECT DISTINCT
    naf.id, 
    naf.wallet_id, 
    CASE WHEN naf.sub_merchant_id = 0 THEN 'null' ELSE naf.sub_merchant_id END as sub_merchant_id,
    mm.super_merchant_id AS super_merchant_id,
    CASE WHEN naf.beneficiary_id = 0 THEN 'null' ELSE naf.beneficiary_id END as receiver_id,
    md.company_name AS submerchant_name,
    sm.legal_business_name AS super_merchant_name,
    naf.currency, 
    naf.snap_date,
    COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) AS total_balance,
    COALESCE(pp.pending_amount, 0) AS pending_payout_amount,
    COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) - COALESCE(pp.pending_amount, 0) AS wallet_balance
FROM net_amounts_filtered naf
LEFT JOIN pending_payouts pp ON (
    -- Only match when sub_merchant_id is not null and not 0
    (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 AND pp.sub_merchant_id = naf.sub_merchant_id AND pp.currency = naf.currency)
    OR 
    -- Only match on receiver_id when sub_merchant_id is null or 0, and beneficiary_id is not null and not 0
    ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 AND pp.receiver_id = naf.beneficiary_id AND pp.currency = naf.currency)
)
LEFT JOIN merchant_details md ON naf.sub_merchant_id = md.merchant_id
LEFT JOIN master_merchant mm ON naf.sub_merchant_id = mm.id
LEFT JOIN super_merchant sm ON mm.super_merchant_id = sm.id`;

      if (condition_string.trim() !== "") {
        query = `${baseQuery} WHERE ${condition_string} ORDER BY naf.id LIMIT ${per_page} OFFSET ${offset}`;
      } else {
        query = `${baseQuery} ORDER BY naf.id DESC LIMIT ${per_page} OFFSET ${offset}`;
      }

      console.log(`Final query with pagination:`);
      console.log(query);

      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      throw error; // Re-throw to handle in controller
    } finally {
      qb.release();
    }

    console.log(`Response length: ${response?.length || 0}`);
    return response || [];
  },

  // Optimized fetchWalletCount function
  fetchWalletCount: async (condition) => {
    let condition_string = await helpers.get_and_conditional_string(condition);
    let response;
    let qb = await pool.get_connection();

    try {
      let query = "";

      // Optimized count query - only select necessary columns for counting
      const countQuery = `
      WITH latest_snap AS (
        SELECT w.id, w.sub_merchant_id, w.currency
        FROM pg_wallet w 
        LEFT JOIN (
          SELECT s1.wallet_id, s1.snap_date 
          FROM pg_wallet_snap s1 
          INNER JOIN (
            SELECT wallet_id, MAX(snap_date) AS snap_date 
            FROM pg_wallet_snap 
            GROUP BY wallet_id
          ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
        ) s ON w.wallet_id = s.wallet_id
      ), 
      net_amounts_filtered AS (
        SELECT ls.id, ls.sub_merchant_id, ls.currency
        FROM latest_snap ls 
        LEFT JOIN pg_transaction_charges tc 
          ON tc.sub_merchant_id = ls.sub_merchant_id AND tc.currency = ls.currency
        GROUP BY ls.id, ls.sub_merchant_id, ls.currency
      )
      SELECT COUNT(DISTINCT naf.id) AS total
      FROM net_amounts_filtered naf 
      LEFT JOIN pg_master_merchant mm 
        ON naf.sub_merchant_id = mm.id`;

      if (condition_string.trim() !== "") {
        query = `${countQuery} WHERE ${condition_string}`;
      } else {
        query = countQuery;
      }

      console.log(`Count query: ${query}`);
      response = await qb.query(query);
    } catch (error) {
      console.error("Database count query failed:", error);
      throw error; // Re-throw to handle in controller
    } finally {
      qb.release();
    }

    return response?.[0]?.total || 0;
  },
  fetchSubMerchant: async (condition) => {
    let condition_string = await helpers.get_and_conditional_string(condition);
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `SELECT d.merchant_id, d.company_name FROM pg_master_merchant m JOIN pg_master_merchant_details d ON d.merchant_id = m.id WHERE m.super_merchant_id = ${condition.super_merchant_id} AND m.deleted=0 AND m.status=0;`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  fetchWalletSummaryCount: async (condition, dateRange = {}) => {
    let condition_string = await helpers.get_and_conditional_string(condition);
    let response;
    let qb = await pool.get_connection();

    try {
      // Build date filter
      let dateFilter = "";
      if (dateRange.start_date && dateRange.end_date) {
        dateFilter = `t.created_at >= '${dateRange.start_date}' AND t.created_at <= '${dateRange.end_date}'`;
      } else {
        dateFilter = `t.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 365 DAY)`;
      }

      const countQuery = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT 
          t.sub_merchant_id, t.currency, DATE(t.created_at) AS txn_date, w.wallet_id, w.beneficiary_id AS receiver_id
        FROM pg_transaction_charges t
        INNER JOIN pg_master_merchant m ON t.sub_merchant_id = m.id
        INNER JOIN pg_master_merchant_details d ON d.merchant_id = t.sub_merchant_id
        LEFT JOIN pg_wallet w ON (w.sub_merchant_id != 0 AND w.sub_merchant_id = t.sub_merchant_id AND w.currency = t.currency)
        WHERE ${dateFilter}`;

      const unionQuery = `
        UNION ALL
        SELECT 
            NULL AS sub_merchant_id, 
            t.currency, 
            DATE(t.created_at) AS txn_date, 
            w.wallet_id,
            w.beneficiary_id AS receiver_id
        FROM pg_transaction_charges t
        LEFT JOIN pg_wallet w ON (w.beneficiary_id != 0 AND t.receiver_id = w.beneficiary_id AND t.currency = w.currency)
        WHERE ${dateFilter}
    `;

      let query = "";
      if (condition_string.trim() !== "") {
        query = `${countQuery} ${unionQuery} AND ${condition_string}
               GROUP BY t.sub_merchant_id, t.currency, DATE(t.created_at), w.wallet_id
             ) AS grouped_transactions`;
      } else {
        query = `${countQuery} ${unionQuery} 
               GROUP BY t.sub_merchant_id, t.currency, DATE(t.created_at), w.wallet_id
             ) AS grouped_transactions`;
      }

      console.log(`Count query:`, query);
      response = await qb.query(query);
    } catch (error) {
      console.error("Transaction summary count query failed:", error);
      throw error;
    } finally {
      qb.release();
    }

    return response?.[0]?.total || 0;
  },
  addPendingPayoutTransaction: async (data) => {
    let isExist = await checkIfOrderExists(data?.order_id);
    console.log("🚀 ~ addPendingPayoutTransaction: ~ isExist:", isExist);
    if (isExist) {
      return await updateOrderStatus(
        data?.order_id,
        data?.order_status,
        data?.status
      );
    }

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "payout_pending_transactions", data);
      console.log("payout_pending_transactions...", qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getWallets: async () => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = qb.select("*").from("pg_wallet").order_by("id", "desc").get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getLastSnapDate: async (wallet_id) => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("snap_date,balance,pending_balance,total_balance")
        .from("pg_wallet_snap")
        .where({ wallet_id: wallet_id })
        .order_by("snap_date", "desc")
        .limit(1)
        .get();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return {
      last_snap_date: response?.[0]?.snap_date || "1970-01-01 00:00:00",
      balance: response?.[0]?.balance || 0,
      pending_balance: response?.[0]?.pending_balance || 0,
      total_balance: response?.[0]?.total_balance || 0,
    };
  },
  getSumOfWallets: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      qb.select_sum("net_amount");

      // Apply sub_merchant_id filter only if it has a numeric value
    const subMerchantId = Number(condition.sub_merchant_id);

    if (Number.isFinite(subMerchantId) && subMerchantId > 0) {
      qb.where("sub_merchant_id", subMerchantId);
    }

    // Apply beneficiary_id filter only if it has a numeric value
    const beneficiary_id = Number(condition.receiver_id);
    if (Number.isFinite(beneficiary_id) && beneficiary_id > 0) {
      qb.where("receiver_id", beneficiary_id);
    }

      // Apply other filters
      qb.where("currency", condition.currency)
        .where("status", 0)
        .where("created_at >=", condition.last_cut_off_date)
        .where("created_at <=", condition.currentDate);

       response = await qb.get("pg_transaction_charges");
       console.log(qb.last_query());


//       let query = `WITH latest_snap AS (
//     SELECT
//         w.id,
//         w.wallet_id,
//         w.sub_merchant_id,
//         w.currency,
//         w.beneficiary_id,
//         s.balance,
//         s.snap_date
//     FROM pg_wallet w
//     LEFT JOIN (
//         SELECT s1.wallet_id, s1.balance, s1.snap_date
//         FROM pg_wallet_snap s1
//         JOIN (
//             SELECT wallet_id, MAX(snap_date) AS snap_date
//             FROM pg_wallet_snap
//             GROUP BY wallet_id
//         ) s2 ON s1.wallet_id = s2.wallet_id AND s1.snap_date = s2.snap_date
//     ) s ON w.wallet_id = s.wallet_id
//     WHERE 
//         w.currency = '${condition.currency}'
//         AND (
//             (w.sub_merchant_id = ${condition.sub_merchant_id} AND ${condition.sub_merchant_id} != 0)
//             OR
//             (w.sub_merchant_id = 0 AND w.beneficiary_id = ${condition.receiver_id})
//         )
// ),
// net_amounts_filtered AS (
//     SELECT
//         ls.id,
//         ls.wallet_id,
//         ls.sub_merchant_id,
//         ls.currency,
//         ls.balance,
//         ls.snap_date,
//         ls.beneficiary_id,
//         SUM(
//             CASE
//     WHEN ls.snap_date IS NOT NULL AND tc.created_at >= DATE_ADD(ls.snap_date, INTERVAL 86399 SECOND) THEN tc.net_amount
//     WHEN ls.snap_date IS NULL THEN tc.net_amount
//     ELSE 0
// END
//         ) AS net_amount_after_snapshot
//     FROM latest_snap ls
//     LEFT JOIN pg_transaction_charges tc ON (
//         (ls.sub_merchant_id IS NOT NULL AND ls.sub_merchant_id != 0 AND tc.sub_merchant_id = ls.sub_merchant_id AND tc.currency = ls.currency)
//         OR
//         ((ls.sub_merchant_id IS NULL OR ls.sub_merchant_id = 0) AND ls.beneficiary_id IS NOT NULL AND ls.beneficiary_id != 0 AND tc.receiver_id = ls.beneficiary_id AND tc.currency = ls.currency)
//     )
//     GROUP BY
//         ls.id, ls.wallet_id, ls.sub_merchant_id, ls.currency, ls.balance, ls.snap_date, ls.beneficiary_id
// ),
// pending_payouts AS (
//     SELECT
//         sub_merchant_id,
//         receiver_id,
//         currency,
//         SUM(amount) AS pending_amount
//     FROM pg_payout_pending_transactions
//     WHERE status = 0 AND order_status = 'PENDING'
//     GROUP BY sub_merchant_id, receiver_id, currency
// ),
// txn_sum AS (
//     SELECT
//         COALESCE(SUM(net_amount), 0) AS total_amount,
//         sub_merchant_id,
//         receiver_id,
//         currency
//     FROM pg_transaction_charges
//     WHERE status = 0
//         AND sub_merchant_id = ${condition.sub_merchant_id}
//         AND receiver_id = ${condition.receiver_id}
//         AND currency = '${condition.currency}'
//         AND created_at >= '${condition.last_cut_off_date}'
//         AND created_at <= '${condition.currentDate}'
//     GROUP BY sub_merchant_id, receiver_id, currency
// )
// SELECT
//     naf.wallet_id,
//     CASE WHEN naf.sub_merchant_id = 0 THEN NULL ELSE naf.sub_merchant_id END AS sub_merchant_id,
//     CASE WHEN naf.beneficiary_id = 0 THEN NULL ELSE naf.beneficiary_id END AS receiver_id,
//     naf.currency,
//     COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) AS total_balance,
//     COALESCE(pp.pending_amount, 0) AS pending_balance,
//     COALESCE(naf.balance, 0) + COALESCE(naf.net_amount_after_snapshot, 0) - COALESCE(pp.pending_amount, 0) AS balance,
//     ts.total_amount
// FROM net_amounts_filtered naf
// LEFT JOIN pending_payouts pp ON (
//     (naf.sub_merchant_id IS NOT NULL AND naf.sub_merchant_id != 0 AND pp.sub_merchant_id = naf.sub_merchant_id AND pp.currency = naf.currency)
//     OR
//     ((naf.sub_merchant_id IS NULL OR naf.sub_merchant_id = 0) AND naf.beneficiary_id IS NOT NULL AND naf.beneficiary_id != 0 AND pp.receiver_id = naf.beneficiary_id AND pp.currency = naf.currency)
// )
// LEFT JOIN txn_sum ts ON 
//     ts.sub_merchant_id = naf.sub_merchant_id
//     AND ts.receiver_id = naf.beneficiary_id
//     AND ts.currency = naf.currency
// WHERE
//     naf.sub_merchant_id = ${condition.sub_merchant_id}
//     AND naf.beneficiary_id = ${condition.receiver_id}
//     AND naf.currency = '${condition.currency}'
// LIMIT 1;
// `;

      // console.log("Database query failed:", query);
      // response = await qb.query(query);
      // console.log("🚀 ~ response:", response)

    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    // return response.length > 0 ? response[0] : null;
    return response.length > 0 ? response[0].net_amount || 0 : 0;
  },
  addWalletSnap: async (data) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .returning("id")
        .insert(config.table_prefix + "wallet_snap", data);
        console.log(qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },
  getLastSnapDetails: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("ws.snap_date,ws.balance")
        .from("pg_wallet_snap ws")
        .join("pg_wallet w", "ws.wallet_id=w.id", "left")
        .where(condition)
        .order_by("ws.snap_date", "desc")
        .limit(1)
        .get();
      console.log("Last snap date query:", qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    console.log("Last snap date response:", response);
    return {
      last_snap_date: response?.[0]?.snap_date || "1970-01-01 00:00:00",
      balance: response?.[0]?.balance || 0,
    };
  },
  getLastSnapDetails2: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb
        .select("snap_date as last_snap_date,balance")
        .from("pg_wallet_snap")
        .where("wallet_id",condition?.wallet_id)
        // .where("snap_date >=",condition?.snap_date)
        .order_by("snap_date", "desc")
        .limit(1)
        .get();
      console.log("Last snap date query:", qb.last_query());
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    console.log("Last snap date response:", response);
    return {
      last_snap_date: response?.[0]?.snap_date || "1970-01-01 00:00:00",
      balance: response?.[0]?.balance || 0,
    };
  },
  validate_receiver: async (receiver_id) => {
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
  },
  get_wallet_statement: async (condition) => {
    console.log("🚀 ~ condition:", condition);
    let response;
    let qb = await pool.get_connection();
    let message = "";
    let totalRecordCount = 0;
    try {
      let query = `
      SELECT w.wallet_id, t.sub_merchant_id, t.receiver_id, t.order_id, t.transaction_id, t.order_status, t.transaction_status, t.currency, t.amount, t.net_amount, t.txn_reference, t.reason, t.created_at FROM pg_transaction_charges t
      LEFT JOIN pg_wallet w ON ((w.sub_merchant_id != 0 AND t.sub_merchant_id = w.sub_merchant_id AND t.currency = w.currency) OR (w.beneficiary_id != 0 AND t.receiver_id = w.beneficiary_id AND t.currency = w.currency))
      `;

      if (condition.wallet_id) {
        query = query + `WHERE w.wallet_id = "${condition.wallet_id}"`;
      } else if (condition.sub_merchant_id && condition.currency) {
        query =
          query +
          `WHERE t.sub_merchant_id = "${condition.sub_merchant_id}" AND t.currency = "${condition.currency}"`;
      } else if (condition.receiver_id && condition.currency) {
        query =
          query +
          `WHERE t.receiver_id = "${condition.receiver_id}" AND t.currency = "${condition.currency}"`;
      } else if (condition.receiver_id) {
        query = query + `WHERE t.receiver_id = "${condition.receiver_id}"`;
      } else if (condition.sub_merchant_id) {
        query =
          query + `WHERE t.sub_merchant_id = "${condition.sub_merchant_id}"`;
      } else if (condition.currency) {
        query =
          query + `WHERE t.currency = "${condition.currency}"`;
      }

      let whereString = "";
      let andString = "";
      if (!query.includes("WHERE")) {
        whereString = "WHERE";
      } else {
        andString = " AND ";
      }

      const date1 = new Date(condition.from_date);
      const date2 = new Date(condition.to_date);
      let start_date = "";
      let end_date = "";
      if (date1 > date2) {
        console.log("date1 is greater");
        end_date = condition.from_date;
        start_date = condition.to_date;
      } else if (date1 < date2) {
        console.log("date2 is greater");
        start_date = condition.from_date;
        end_date = condition.to_date;
      } else {
        console.log("Both dates are equal");
        start_date = condition.from_date;
        end_date = condition.to_date;
      }

      // if (condition.from_date && condition.to_date) {
      //   query =
      //     query +
      //     `${whereString}${andString} t.created_at BETWEEN '${start_date}' AND '${end_date}'`;
      // }
      if (condition.from_date && condition.to_date) {
        const date1 = new Date(condition.from_date);
        const date2 = new Date(condition.to_date);

        if (isNaN(date1) || isNaN(date2)){
          // throw new Error("Invalid date format");
          console.log("Invalid date format:", date1, date2);
        }

        let start_date = date1 <= date2 ? date1 : date2;
        let end_date = date1 <= date2 ? date2 : date1;

        // Add one day to include the entire 'to_date' day
        end_date.setDate(end_date.getDate() + 1);

        query += `${whereString}${andString} t.created_at >= '${start_date.toISOString()}' AND t.created_at < '${end_date.toISOString()}'`;
      }

      query = query + ` ORDER BY t.created_at DESC`;

      // Count Total Records
      let countResult = await qb.query(query);
      // console.log("🚀 ~ countResult:", countResult)
      totalRecordCount = countResult?.length || 0;

      // Apply pagination
      const page = parseInt(condition.page, 10) || 1;
      const perPage = parseInt(condition.per_page, 10) || 10;
      const offset = (page - 1) * perPage;

      query += ` LIMIT ${perPage} OFFSET ${offset}`;

      console.log("get_wallet_statement query:", query);

      response = await qb.query(query);
      console.log("🚀 ~ response:", response)
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return {
      status: 200,
      message: "",
      data: response,
      pagination: {
        page: condition.page,
        per_page: condition.per_page,
        total: totalRecordCount,
      },
    };
  },
  get_snapshot_balance: async (condition) => {
    let response;
    let qb = await pool.get_connection();
    let message = "";
    let totalRecordCount = 0;
    try {
      let query = `SELECT ws.wallet_id, w.sub_merchant_id, w.beneficiary_id as receiver_id, w.currency, ws.total_balance, ws.balance, ws.pending_balance, ws.snap_date, ws.created_at FROM pg_wallet_snap ws LEFT JOIN pg_wallet w ON ws.wallet_id = w.wallet_id `;

      if (condition.wallet_id) {
        query = query + `WHERE w.wallet_id = "${condition.wallet_id}"`;
      } else if (condition.sub_merchant_id && condition.currency) {
        query =
          query +
          `WHERE w.sub_merchant_id = "${condition.sub_merchant_id}" AND w.currency = "${condition.currency}"`;
      } else if (
        condition.sub_merchant_id &&
        condition.sub_merchant_id !== "null"
      ) {
        query =
          query + `WHERE w.sub_merchant_id = "${condition.sub_merchant_id}"`;
      } else if (condition.receiver_id && condition.currency) {
        query =
          query +
          `WHERE w.beneficiary_id = "${condition.receiver_id}" AND w.currency = "${condition.currency}"`;
      } else if (condition.receiver_id) {
        query = query + `WHERE w.beneficiary_id = "${condition.receiver_id}"`;
      } else if (condition.currency) {
        query = query + `WHERE w.currency = "${condition.currency}"`;
      }

      let whereString = "";
      let andString = "";
      if (!query.includes("WHERE")) {
        whereString = "WHERE";
      } else {
        andString = " AND ";
      }

      if (condition.snap_date) {
        query =
          query +
          `${whereString}${andString}ws.snap_date LIKE "${condition.snap_date}"`;
      }

      if (!query.includes("WHERE")) {
        whereString = "WHERE";
      } else {
        andString = " AND ";
      }

      const date1 = new Date(condition.from_date);
      const date2 = new Date(condition.to_date);
      let start_date = "";
      let end_date = "";
      if (date1 > date2) {
        console.log("date1 is greater");
        end_date = condition.from_date;
        start_date = condition.to_date;
      } else if (date1 < date2) {
        console.log("date2 is greater");
        start_date = condition.from_date;
        end_date = condition.to_date;
      } else {
        console.log("Both dates are equal");
        start_date = condition.from_date;
        end_date = condition.to_date;
      }

      if (condition.from_date && condition.to_date) {
        query =
          query +
          `${whereString}${andString} ws.created_at BETWEEN '${start_date}' AND '${end_date}'`;
      }

      query = query + ` ORDER BY ws.created_at DESC`;

      // Count Total Records
      let countResult = await qb.query(query);
      totalRecordCount = countResult?.length || 0;

      // Apply pagination
      const page = parseInt(condition.page, 10) || 1;
      const perPage = parseInt(condition.per_page, 10) || 10;
      const offset = (page - 1) * perPage;

      query += ` LIMIT ${perPage} OFFSET ${offset}`;

      console.log("get_wallet_statement query:", query);

      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return {
      status: 200,
      message: "",
      data: response,
      pagination: {
        page: condition.page,
        per_page: condition.per_page,
        total: totalRecordCount,
      },
    };
  },
  getPendingBalance: async (condition) => {
    if (!condition?.receiver_id) {
      return 0;
    }
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `SELECT SUM(amount) AS pending_balance FROM pg_payout_pending_transactions WHERE sub_merchant_id = ${condition.sub_merchant_id} AND receiver_id = ${condition.receiver_id} AND currency = '${condition.currency}' AND order_status = 'PENDING' AND status = 0 AND created_at >= '${condition.last_cut_off_date}' AND created_at <= '${condition.current_date}';`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response.length > 0) {
      return response[0]?.pending_balance || 0;
        }else{
      return 0;
    }
  },
   getPendingTurnedBalance: async (condition) => {
    if (!condition?.receiver_id) {
      return 0;
    }
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `SELECT SUM(amount) AS pending_turned_balance FROM pg_payout_pending_transactions WHERE sub_merchant_id = ${condition.sub_merchant_id} AND receiver_id = ${condition.receiver_id} AND currency = '${condition.currency}' AND (order_status = 'COMPLETED' OR order_status='FAILED') AND status = 0`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (response.length > 0) {
      return response[0]?.pending_turned_balance || 0;
        }else{
      return 0;
    }
  },
  updatePendingTurnedBalance: async (condition) => {
    if (!condition?.receiver_id) {
      return 0;
    }
    let response;
    let qb = await pool.get_connection();
    try {
      let query = `UPDATE pg_payout_pending_transactions SET status=1 WHERE sub_merchant_id = ${condition.sub_merchant_id} AND receiver_id = ${condition.receiver_id} AND currency = '${condition.currency}' AND (order_status = 'COMPLETED' OR order_status='FAILED') AND status = 0`;
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return true;
  },
  get_charges_analytics: async (condition, date_condition) => {
    
    let page = condition?.page || 1;
    let per_page = condition?.per_page || 7;
    let OFFSET = (page - 1) * per_page;

    let where = "";
    if (condition.currency) {
      where = " AND t.currency = '" + condition.currency + "'";
    }

    if (condition.receivers_ids) {
      where = where + " AND t.receiver_id IN (" + condition.receivers_ids + ")";
    }
    
    // if (condition.order_status) {
    //   where = where + "order_status = " + condition.order_status;
    // }
    // if (condition.from_date && condition.to_date) {
    //   where = where + " AND created_at BETWEEN '" + condition.from_date + "' AND '" + condition.to_date + "'";
    // }

    // var query = "SELECT DATE(created_at) AS transaction_date, SUM(amount) AS total_day_amount, COUNT(amount) as total_transactions FROM pg_transaction_charges " 
    // + where
    // + " GROUP BY DATE(created_at) ORDER BY created_at DESC;";

    var query;
    if(condition.order_status && condition.order_status == 'CAPTURED'){
      query =
       "WITH RECURSIVE date_range AS ( SELECT DATE('" + condition.from_date + "') AS dt UNION ALL SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM date_range WHERE dt < DATE('" + condition.to_date + "') ) SELECT dr.dt AS transaction_date,  mmd.merchant_id, mmd.register_business_country, cm.country_name, cm.country_code, COALESCE(SUM(t.amount), 0) AS total_day_amount, COALESCE(COUNT(t.amount), 0) AS total_transactions FROM date_range dr LEFT JOIN pg_transaction_charges t ON DATE(t.created_at) = dr.dt AND t.order_status = '" + condition.order_status + "'" + where + " LEFT JOIN pg_master_merchant_details mmd ON t.sub_merchant_id = mmd.merchant_id LEFT JOIN pg_bus_reg_country_master cm ON mmd.register_business_country = cm.id WHERE cm.country_code = '" + condition.country + "'" + " GROUP BY dr.dt ORDER BY dr.dt DESC;"
    }else{
      // query =
      //  "WITH RECURSIVE date_range AS ( SELECT DATE('" + condition.from_date + "') AS dt UNION ALL SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM date_range WHERE dt < DATE('" + condition.to_date + "') ) SELECT dr.dt AS transaction_date, COALESCE(SUM(t.amount), 0) AS total_day_amount, COALESCE(COUNT(t.amount), 0) AS total_transactions FROM date_range dr LEFT JOIN pg_transaction_charges t ON DATE(t.created_at) = dr.dt AND t.order_status = '" + condition.order_status + "'" + where + " GROUP BY dr.dt ORDER BY dr.dt DESC;";
      
       query = "WITH RECURSIVE date_range AS ( SELECT DATE('" + condition.from_date + "') AS dt UNION ALL SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM date_range WHERE dt < DATE('" + condition.to_date + "') ) SELECT dr.dt AS transaction_date, COALESCE(SUM(t.amount), 0) AS total_day_amount, COALESCE(COUNT(t.id), 0) AS total_transactions, COALESCE(COUNT(DISTINCT t.sub_merchant_id), 0) AS unique_merchants FROM date_range dr LEFT JOIN pg_transaction_charges t ON DATE(t.created_at) = dr.dt AND t.order_status = 'PAID' AND t.currency = '" + condition.currency + "' LEFT JOIN pg_master_merchant_details mmd ON t.sub_merchant_id = mmd.merchant_id LEFT JOIN pg_bus_reg_country_master cm ON mmd.register_business_country = cm.id AND cm.country_code = '" + condition.country + "' WHERE cm.country_code = '" + condition.country + "'" + " GROUP BY dr.dt ORDER BY dr.dt DESC;"
    }

    // var query ='
    //   "WITH RECURSIVE date_range AS ( SELECT DATE('" + condition.from_date + "') AS dt UNION ALL SELECT DATE_ADD(dt, INTERVAL 1 DAY) FROM date_range WHERE dt < DATE('" + condition.to_date + "') ) SELECT dr.dt AS transaction_date, COALESCE(SUM(t.amount), 0) AS total_day_amount, COALESCE(COUNT(t.amount), 0) AS total_transactions FROM date_range dr LEFT JOIN pg_transaction_charges t ON DATE(t.created_at) = dr.dt AND t.order_status = '" + condition.order_status + "'" + where + " GROUP BY dr.dt ORDER BY dr.dt DESC;";

    console.log("🚀 ~ query:", query)

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
};
async function checkIfOrderExists(orderId) {
  let qb = await pool.get_connection();
  let result;
  try {
    let query = `SELECT * FROM pg_payout_pending_transactions WHERE order_id = '${orderId}';`;
    result = await qb.query(query);
    console.log("Check query:", query);
  } catch (error) {
    console.error("Database check failed:", error);
  } finally {
    qb.release();
  }

  return result.length > 0; // Return true if at least one record exists
}

async function updateOrderStatus(order_id, newStatus, status) {
  let qb = await pool.get_connection();
  let response;
  try {
    let query = `UPDATE pg_payout_pending_transactions SET order_status = '${newStatus}', status = ${status} WHERE order_id = '${order_id}'`;
    response = await qb.query(query);
    console.log("Updated order_status query:", query);
  } catch (error) {
    console.error("Database update failed:", error);
  } finally {
    qb.release();
  }
  return response;
}

module.exports = charges_invoice_models;
