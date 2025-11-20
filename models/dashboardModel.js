const path = require("path");
const logger = require('../config/logger');
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");

const order_table = config.table_prefix + "orders";
const order_txn_table = config.table_prefix + "order_txn";
const moment = require("moment");
const test_order_table = config.table_prefix + "test_orders";
const test_order_txn_table = config.table_prefix + "test_order_txn";
const cycle_logs_table = config.table_prefix + "order_life_cycle_logs";
const request_table = config.table_prefix1 + "request_list";
async function getTestTables() {
  return {
    order_table: test_order_table,
    order_txn_table: test_order_txn_table,
  };
}

async function getTables() {
  return {
    order_table: order_table,
    order_txn_table: order_txn_table,
  };
}

async function getTableName({ mode, super_merchant_id, type }) {
  if (super_merchant_id !== "" && type === "merchant") {
    return mode === "live" ? getTables() : getTestTables();
  } else {
    return mode === "live" ? getTables() : getTestTables();
  }
}
async function getFinalCondition(and_condition, is_txn = null) {
  let final_cond = " where ";
  if (Object.keys(and_condition).length) {
    if (and_condition.merchant_id === 0) {
      let result = await helpers.getAllSubMerchant(
        and_condition.super_merchant_id
      );

      if (result && result.length > 0) {
        let str = `o.merchant_id in (${result[0]?.sub_merchant_id_str})`;
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + str)
            : (final_cond = final_cond + " and " + str);
      }
    } else {
      let str = `o.merchant_id = ${and_condition.merchant_id}`;
      final_cond =
        final_cond === " where "
          ? (final_cond = final_cond + str)
          : (final_cond = final_cond + " and " + str);
    }
    if (and_condition.currency) {
      let currency_str = await helpers.getCurrency(
        "currency",
        and_condition.currency
      );

      if (currency_str && is_txn) {
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + `txn.${currency_str}`)
            : (final_cond = final_cond + " and " + `txn.${currency_str}`);
      } else {
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + `o.${currency_str}`)
            : (final_cond = final_cond + " and " + `o.${currency_str}`);
      }
    }

    if (and_condition.psp) {
      let psp_str = await helpers.getPSP("psp", and_condition.psp);

      if (psp_str) {
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + `o.${psp_str}`)
            : (final_cond = final_cond + " and " + `o.${psp_str}`);
      }
    }

    if (and_condition.scheme) {
      let scheme_str = await helpers.getCardSchema(
        "scheme",
        and_condition.scheme
      );
      if (scheme_str) {
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + scheme_str)
            : (final_cond = final_cond + " and " + scheme_str);
      }
    }

    if (and_condition.payment_mode) {
      let payment_method_str = await helpers.getPaymentMode(
        "payment_mode",
        and_condition.payment_mode
      );

      if (payment_method_str) {
        final_cond =
          final_cond === " where "
            ? (final_cond = final_cond + payment_method_str)
            : (final_cond = final_cond + " and " + payment_method_str);
      }
    }
    if (and_condition.origin) {
      let payment_origin_str = await helpers.get_in_condition(
        "origin",
        and_condition.origin
      );

      if (final_cond == " where ") {
        final_cond = final_cond + payment_origin_str;
      } else {
        final_cond = final_cond + " and " + payment_origin_str;
      }
    }

    if (and_condition.issuer) {
      if (final_cond == " where ") {
        final_cond =
          final_cond + ` o.issuer in('${and_condition.issuer.join("','")}')`;
      } else {
        final_cond =
          final_cond + `and o.issuer in('${and_condition.issuer.join("','")}')`;
      }
    }
  }

  if (final_cond == " where ") {
    final_cond = " WHERE ";
  } else {
    final_cond = final_cond + " AND ";
  }

  return final_cond;
}
async function getFinalOrderCondition(and_condition, is_txn = null) {
  let final_cond = " and ";
  if (Object.keys(and_condition).length) {
    if (and_condition.merchant_id === 0) {
      let result = await helpers.getAllSubMerchant(
        and_condition.super_merchant_id
      );

      if (result && result.length > 0) {
        let str = `o.merchant_id in (${result[0]?.sub_merchant_id_str})`;
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + str)
            : (final_cond = final_cond + " and " + str);
      }
    } else {
      let str = `o.merchant_id = ${and_condition.merchant_id}`;
      final_cond =
        final_cond === " and "
          ? (final_cond = final_cond + str)
          : (final_cond = final_cond + " and " + str);
    }
    if (and_condition.currency) {
      let currency_str = await helpers.getCurrency(
        "currency",
        and_condition.currency
      );

      if (currency_str && is_txn) {
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + `o.${currency_str}`)
            : (final_cond = final_cond + " and " + `o.${currency_str}`);
      } else {
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + currency_str)
            : (final_cond = final_cond + " and " + currency_str);
      }
    }

    if (and_condition.psp) {
      let psp_str = await helpers.getPSP("psp", and_condition.psp);

      if (psp_str) {
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + `o.${psp_str}`)
            : (final_cond = final_cond + " and " + `o.${psp_str}`);
      }
    }

    if (and_condition.scheme) {
      let scheme_str = await helpers.getCardSchema(
        "scheme",
        and_condition.scheme
      );
      if (scheme_str) {
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + `o.${scheme_str}`)
            : (final_cond = final_cond + " and " + `o.${scheme_str}`);
      }
    }

    if (and_condition.payment_mode) {
      let payment_method_str = await helpers.getPaymentMode(
        "payment_mode",
        and_condition.payment_mode
      );

      if (payment_method_str) {
        final_cond =
          final_cond === " and "
            ? (final_cond = final_cond + payment_method_str)
            : (final_cond = final_cond + " and " + payment_method_str);
      }
    }
    if (and_condition.origin) {
      let payment_origin_str = await helpers.get_in_condition(
        "origin",
        and_condition.origin
      );

      if (final_cond == " and ") {
        final_cond = final_cond + payment_origin_str;
      } else {
        final_cond = final_cond + " and " + payment_origin_str;
      }
    }

    if (and_condition.issuer) {
      if (final_cond == " and ") {
        final_cond =
          final_cond + ` o.issuer in('${and_condition.issuer.join("','")}')`;
      } else {
        final_cond =
          final_cond + `and o.issuer in('${and_condition.issuer.join("','")}')`;
      }
    }
  }

  if (final_cond == " and ") {
    final_cond = " WHERE ";
  } else {
    final_cond = final_cond + " AND ";
  }

  return final_cond;
}
var dbModel = {
  sales: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) AS date, 
                SUM(CASE 
                        WHEN txn.type IN ('AUTH','SALE','CAPTURE') THEN txn.amount 
                        WHEN txn.type IN ('REFUND','PARTIALLY_REFUND') THEN -txn.amount 
                        ELSE 0 
                    END) AS total_amount
            FROM ${tables.order_table} o
            LEFT JOIN ${tables.order_txn_table} txn ON o.order_id = txn.order_id
            
                
                ${final_cond} 
                txn.is_voided = 0  AND  (txn.status = 'AUTHORISED' OR txn.status="CAPTURED") 
                AND DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
            GROUP BY DATE(o.created_at)`;

    console.log(`the sales query is here`);        
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

    if (!response?.[0]) {
      response.push({ total_amount: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );

    return resp;
  },

  oneclick: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);

    let tables = await getTableName(table);

    let query = `SELECT date_list.date AS date, COALESCE(order_totals.total_amount, 0) AS total_amount
                    FROM (
                        SELECT '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY AS date
                        FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                            UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
                        WHERE '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ) date_list
                    LEFT JOIN (
                        SELECT DATE(o.created_at) AS date, SUM(txn.amount) AS total_amount
                        FROM ${tables.order_table} o
                        LEFT JOIN ${tables.order_txn_table} txn ON
                			o.order_id = txn.order_id
                         ${final_cond} 
                         txn.type = 'CAPTURE' 
                         AND txn.status!='FAILED'
                         AND o.is_one_click = 1
                        AND date(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                        GROUP BY DATE(o.created_at)
                    ) order_totals
                    ON date_list.date = order_totals.date
                    WHERE date_list.date BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ORDER BY date_list.date ASC;
                    `;

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
    /*
            //old query

            let query = `SELECT date_list.date AS date, COALESCE(order_totals.total_amount, 0) AS total_amount
                    FROM (
                        SELECT '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY AS date
                        FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                            UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
                        WHERE '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ) date_list
                    LEFT JOIN (
                        SELECT DATE(created_at) AS date, SUM(amount) AS total_amount
                        FROM ${table}
                        ${final_cond}
                        status NOT IN ('FAILED', 'CANCELLED', 'PENDING')
                        AND payment_token_id IS NOT NULL AND TRIM(payment_token_id) <> ''
                        AND date(created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                        GROUP BY DATE(created_at)
                    ) order_totals
                    ON date_list.date = order_totals.date
                    WHERE date_list.date BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ORDER BY date_list.date ASC;
                    `;
        
            */
  },

  transactions: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);

    let tables = await getTableName(table, true);
    console.log(tables);

    let query = `SELECT 
                    DATE(o.created_at) AS date,
                    COUNT(o.id) as transaction_count
                FROM 
                     ${tables.order_table} o 
                    
                    ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                AND o.status IN ('AUTHORISED', 'CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                GROUP BY 
                    DATE(o.created_at)`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({ transaction_count: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );

    return resp;
  },

  refund_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);

    let tables = await getTableName(table);

    let query = `SELECT 
                DATE(o.created_at) AS dates,
                SUM(CASE WHEN txn.type IN ('AUTH','SALE') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED' THEN txn.amount ELSE 0 END) AS captured_amount,
                SUM(CASE WHEN txn.type IN ('PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) AS refunded_amount,
                ROUND((SUM(CASE WHEN txn.type IN ('PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) / 
                SUM(CASE WHEN txn.type IN ('AUTH','SALE') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED' THEN txn.amount ELSE 0 END) * 100),2) AS refund_percentage
            FROM 
                ${tables.order_txn_table} txn LEFT JOIN ${tables.order_table} o ON o.order_id = txn.order_id
                ${final_cond}   
                txn.type IN ('AUTH','SALE','CAPTURE','PARTIALLY_CAPTURE','PARTIALLY_REFUND','REFUND') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED'  AND DATE(o.created_at) >= '${date_condition.from_date}'
                AND DATE(o.created_at) <= '${date_condition.to_date}' 
            GROUP BY 
                DATE(o.created_at)`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        captured_amount: 0,
        refunded_amount: 0,
        refund_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "dates",
      date_condition.from_date,
      date_condition.to_date
    );

    return resp;
  },

  refund_percentage: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);

    let tables = await getTableName(table);

    let query = `SELECT 
                DATE(o.created_at) AS dates,
                SUM(CASE WHEN txn.type IN ('SALE', 'CAPTURE', 'PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) AS captured_amount,
                SUM(CASE WHEN txn.type IN ('PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) AS refunded_amount,
                (SUM(CASE WHEN txn.type IN ('PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) / 
                SUM(CASE WHEN txn.type IN ('SALE', 'CAPTURE', 'PARTIALLY_REFUND', 'REFUND') THEN txn.amount ELSE 0 END) * 100) AS refund_percentage
            FROM 
                ${tables.order_txn_table} txn LEFT JOIN ${tables.order_table} o ON o.order_id = txn.order_id
                ${final_cond}   
                txn.type IN ('SALE','CAPTURE','PARTIALLY_REFUND','REFUND') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED'  AND DATE(o.created_at) >= '${date_condition.from_date}'
                AND DATE(o.created_at) <= '${date_condition.to_date}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  refundGraph: async (selection, and_condition, date_condition) => {
    //     SELECT
    //     calendar.date AS order_date,
    //     COUNT(pg_order_txn.id) AS txn_count
    // FROM
    //     (
    //         SELECT DATE_ADD('2024-01-01', INTERVAL n DAY) AS date
    //         FROM (
    //             SELECT (a.a + (10 * b.a) + (100 * c.a)) AS n
    //             FROM
    //                 (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
    //             CROSS JOIN
    //                 (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
    //             CROSS JOIN
    //                 (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
    //         ) AS numbers
    //         WHERE DATE_ADD('2024-01-01', INTERVAL n DAY) BETWEEN '2024-01-01' AND '2024-04-18'
    //     ) AS calendar
    // LEFT JOIN
    //     pg_order_txn ON DATE(pg_order_txn.created_at) = calendar.date
    //     AND pg_order_txn.status = 'AUTHORISED'
    //     AND pg_order_txn.type IN ('AUTH', 'SALE')
    // GROUP BY
    //     order_date
    // ORDER BY
    //     order_date DESC;
  },

  totalsaleCount: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED')) ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );

      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT COUNT(o.id) AS transactionCount,
    SUM(o.amount) AS totalAmount,
    DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date
    FROM ${tableName} o ${final_cond} GROUP BY DATE(o.created_at) ORDER BY created_at DESC;`;

    const qb = await pool.get_connection();
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

  oneclickCountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      "  WHERE o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, false));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
    COUNT(o.id) AS transactionCount,
    SUM(CASE WHEN o.is_one_click = 1 THEN 1 ELSE 0 END) AS transactiononeclickCount,
    ROUND((SUM(CASE WHEN o.is_one_click = 1 THEN 1 ELSE 0 END) / COUNT(o.id)) * 100,2) AS percentage
    FROM ${tableName} o
    
    ${final_cond}
    GROUP BY DATE(o.created_at)
    ORDER BY o.created_at DESC;`;

    const qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        transactionCount: 0,
        transactiononeclickCount: 0,
        percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );

    return resp;
  },

  oneclickAmountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      "  WHERE o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
    SUM(o.amount) AS totalAmount,
                        SUM(CASE WHEN o.is_one_click =1  THEN o.amount ELSE 0 END) AS totaloneclickAmount,
                        ROUND((SUM(CASE WHEN o.is_one_click =1 THEN o.amount ELSE 0 END) / SUM(o.amount)) * 100,2) AS percentage
                       FROM ${tableName} o
                       
                       ${final_cond}
                       GROUP BY DATE(o.created_at)
                       ORDER BY o.created_at DESC;`;
    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({ totalAmount: 0, totaloneclickAmount: 0, percentage: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );

    return resp;
  },

  oneclickTotalCountPercentage: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      "  WHERE  o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
    COUNT(o.id) AS transactionCount,
                        SUM(CASE WHEN o.is_one_click = 1  THEN 1 ELSE 0 END) AS transactiononeclickCount,
                        ROUND((SUM(CASE WHEN o.is_one_click = 1 THEN 1 ELSE 0 END) / COUNT(o.id)) * 100,2) AS percentage
                       FROM ${tableName} o
                       
                       ${final_cond};`;
    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0]?.percentage ? response?.[0].percentage : 0;
  },

  routingCountData: async (and_condition, date_condition, tableName) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED'))  ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, false));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }

    query = `SELECT 
    DATE(o.created_at) as date, 
    COUNT(o.order_id) as transactionCount,
    COUNT(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.order_id END) as transactionroutingCount,
            ROUND(
                (COUNT(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.order_id END) 
                / COUNT(o.order_id)) * 100, 2
                ) as percentage
        FROM 
            ${tableName} o 
        INNER JOIN 
            pg_order_life_cycle l 
        ON 
        o.order_id = l.order_id 
        ${final_cond}
        
        GROUP BY 
        DATE(o.created_at)`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        transactionCount: 0,
        transactionroutingCount: 0,
        percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  routingAmountData: async (and_condition, date_condition, tableName) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED'))  ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, false));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }

    query = `SELECT 
                DATE(o.created_at) AS date, 
                COALESCE(SUM(o.amount), 0) AS totalAmount,
                COALESCE(SUM(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.amount END), 0) AS totalroutingAmount,
                ROUND(
                    (COALESCE(SUM(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.amount END), 0) 
                    / COALESCE(SUM(o.amount), 1)) * 100, 2
                ) AS percentage
            FROM 
                ${tableName} o 
                INNER JOIN 
                pg_order_life_cycle l 
            ON 
                o.order_id = l.order_id 
                ${final_cond}
                
                GROUP BY 
                DATE(o.created_at)`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({ totalAmount: 0, totalroutingAmount: 0, percentage: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  routingTotalCountData: async (and_condition, date_condition, tableName) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED'))  ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, false));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }

    query = `SELECT 
    COUNT(o.order_id) as transactionCount,
            COUNT(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.order_id END) as transactionroutingCount,
            ROUND(
                (COUNT(CASE WHEN (l.rule_id > 0 OR l.original_mid_list > 0) THEN o.order_id END) 
                / COUNT(o.order_id)) * 100, 2
            ) as percentage
        FROM 
            ${tableName} o 
        INNER JOIN 
            pg_order_life_cycle l 
            ON 
            o.order_id = l.order_id 
            ${final_cond}`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0] ? response?.[0].percentage : 0;
  },

  retryCountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED'))  ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));
    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );

      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    COUNT(DISTINCT o.order_id) AS transactionCount,
    COUNT(DISTINCT CASE WHEN l.retry_txn > 0 THEN o.order_id END) AS transactionretryCount,
    ROUND(
                            COUNT(DISTINCT CASE WHEN l.retry_txn > 0 THEN o.order_id END) * 100.0 / COUNT(DISTINCT o.order_id),
                            2
                        ) AS percentage,
                        DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date
                    FROM 
                        ${tableName} o
                    LEFT JOIN 
                        pg_order_life_cycle_logs l 
                    ON 
                    o.order_id = l.order_id
                       ${final_cond}
                       GROUP BY DATE(o.created_at)
                       ORDER BY o.created_at DESC;`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        transactionCount: 0,
        transactionretryCount: 0,
        percentage: 0,
      });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  retryTotalPercentage: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED')) ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));
    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );

      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    COUNT(DISTINCT o.order_id) AS transactionCount,
                        COUNT(DISTINCT CASE WHEN l.retry_txn > 0 THEN o.order_id END) AS transactionretryCount,
                        ROUND(
                            COUNT(DISTINCT CASE WHEN l.retry_txn > 0 THEN o.order_id END) * 100.0 / COUNT(DISTINCT o.order_id),
                            2
                            ) AS percentage
                        
                    FROM 
                        (SELECT DISTINCT(o.order_id),o.currency,o.psp,o.scheme,o.payment_mode,o.origin,o.issuer, o.amount,o.created_at, o.merchant_id,l.order_id as log_order, l.retry_txn, o.status FROM pg_order_life_cycle_logs l INNER JOIN pg_test_orders o ON o.order_id = l.order_id  ${final_cond}) o
                    INNER JOIN 
                        pg_order_life_cycle_logs l 
                    ON 
                        o.order_id = l.order_id
                       ${final_cond}`;
    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.percentage ? response?.[0].percentage : 0;
  },

  retryAmountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED')) ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));
    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );

      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }

    let query = `SELECT 
                    COALESCE(totalOrders.totalAmount, 0) AS totalAmount,
                    COALESCE(totalRetries.totalretryAmount, 0) AS totalretryAmount,
                    ROUND(
                        COALESCE(totalRetries.totalretryAmount, 0) * 100.0 / COALESCE(totalOrders.totalAmount, 1),
                        2
                    ) AS percentage,
                    DATE_FORMAT(totalOrders.date, '%Y-%m-%d') AS date
                FROM 
                    (
                        
                        SELECT 
                        DATE(o.created_at) AS date,
                        SUM(o.amount) AS totalAmount
                    FROM 
                        ${tableName} o 
                 
                ${final_cond}
                    GROUP BY 
                        DATE(o.created_at)
                    
                        ) AS totalOrders
                LEFT JOIN 
                    (SELECT 
                        DATE(l.created_at) AS date,
                        SUM(CASE WHEN l.retry_txn > 0 THEN o.amount ELSE 0 END) AS totalretryAmount
                    FROM 
                        (SELECT DISTINCT log.order_id,log.retry_txn,o.created_at FROM pg_order_life_cycle_logs as log  left JOIN ${tableName} o ON log.order_id = o.order_id
                 
                ${final_cond} AND log.retry_txn>0) l 
                
                inner JOIN ${tableName} o ON l.order_id = o.order_id
                    GROUP BY 
                        DATE(l.created_at)
                    ) AS totalRetries
                ON 
                    totalOrders.date = totalRetries.date
                ORDER BY 
                    date DESC;`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({ totalAmount: 0, totalretryAmount: 0, percentage: 0 });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  cascadeCountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED')) ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    let query = `SELECT 
    COUNT(DISTINCT o.order_id) AS transactionCount,
                        COUNT(DISTINCT CASE WHEN l.cascade_txn>0 THEN o.order_id END) AS transactioncascadeCount,
                        ROUND(
                            COUNT(DISTINCT CASE WHEN l.cascade_txn>0 THEN o.order_id END) * 100.0 / COUNT(DISTINCT o.order_id),
                            2
                        ) AS percentage,
                        DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date
                    FROM 
                        ${tableName} o
                    LEFT JOIN 
                        pg_order_life_cycle_logs l 
                    ON 
                    o.order_id = l.order_id
                    ${final_cond}
                    GROUP BY DATE(o.created_at)
                    ORDER BY o.created_at DESC;`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  totalCascadeCountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE (o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED')) ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));
    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );

      final_cond = final_cond + " " + date_condition_str;
    }
    if (final_cond == " AND ") {
      final_cond = "";
    }
    const query = `SELECT 
    COUNT(DISTINCT o.order_id) AS transactionCount,
    COUNT(DISTINCT CASE WHEN l.cascade_txn > 0 THEN o.order_id END) AS transactioncascadeCount,
                    ROUND(
                        COUNT(DISTINCT CASE WHEN l.cascade_txn > 0 THEN o.order_id END) * 100.0 / COUNT(DISTINCT o.order_id),
                        2
                    ) AS percentage
                    
                FROM 
                    ${tableName} o
                LEFT JOIN 
                    pg_order_life_cycle_logs l 
                ON 
                    o.order_id = l.order_id
                    ${final_cond}`;

    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0];
  },

  cascadeAmountCountData: async (
    selection,
    and_condition,
    date_condition,
    tableName
  ) => {
    let final_cond =
      " WHERE  o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED') ";
    final_cond =
      final_cond + " " + (await getFinalOrderCondition(and_condition, true));

    if (Object.keys(date_condition).length) {
      const date_condition_str = await helpers.get_date_between_condition(
        date_condition.from_date,
        date_condition.to_date,
        "o.created_at"
      );
      final_cond = final_cond + " " + date_condition_str;
    }

    let query = `SELECT 
    COALESCE(totalOrders.totalAmount, 0) AS totalAmount,
                    COALESCE(totalCascades.totalCascadeAmount, 0) AS totalCascadeAmount,
                    ROUND(
                        COALESCE(totalCascades.totalCascadeAmount, 0) * 100.0 / COALESCE(totalOrders.totalAmount, 1),
                        2
                    ) AS percentage,
                    DATE_FORMAT(totalOrders.date, '%Y-%m-%d') AS date
                FROM 
                    (
                        SELECT  SUM(o.amount) AS totalAmount,DATE(o.created_at) as date FROM  ${tableName} o 
                        ${final_cond} 
                            GROUP BY 
                                DATE(o.created_at)

                        ) AS totalOrders
                LEFT JOIN 
                    (SELECT 
                        DATE(l.created_at) AS date,
                        SUM(CASE WHEN l.cascade_txn > 0 THEN o.amount ELSE 0 END) AS totalCascadeAmount
                    FROM 
                        (SELECT DISTINCT log.order_id,log.cascade_txn,o.created_at FROM pg_order_life_cycle_logs as log  left JOIN ${tableName} o ON log.order_id = o.order_id
                 
                ${final_cond} ) l 
                
                inner JOIN ${tableName} o ON l.order_id = o.order_id
                    GROUP BY 
                        DATE(l.created_at)
                    ) AS totalCascades
                ON 
                    totalOrders.date = totalCascades.date
                ORDER BY 
                    date DESC;`;
    let response;
    const qb = await pool.get_connection();
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  refund_count: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);
    let tables = await getTableName(table);

    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(DISTINCT txn.order_id) as total_count
            FROM 
                ${tables.order_txn_table} txn
            JOIN 
                ${tables.order_table} o 
            ON 
                o.order_id = txn.order_id
                ${final_cond}    
                txn.type IN ('AUTH','SALE') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED' AND DATE(o.created_at) >= '${date_condition.from_date}'
                AND DATE(o.created_at) <= '${date_condition.to_date}' 
            GROUP BY 
                DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let total_count;
    try {
      total_count = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    let query2 = `SELECT 
                DATE(o.created_at) as date,
                COUNT(DISTINCT txn.order_id) as count
            FROM 
                ${tables.order_txn_table} txn
            JOIN 
                ${tables.order_table} o 
            ON 
                o.order_id = txn.order_id
                ${final_cond}    
                txn.type IN ('PARTIALLY_REFUND','REFUND') 
                AND txn.is_voided = 0 AND txn.status = 'AUTHORISED' AND DATE(o.created_at) >= '${date_condition.from_date}'
                AND DATE(o.created_at) <= '${date_condition.to_date}' 
            GROUP BY 
                DATE(o.created_at);`;

    let count;
    qb = await pool.get_connection();
    try {
      count = await qb.query(query2);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    let response = total_count.map((tc) => {
      const formattedDate = moment(tc.date).format("YYYY-MM-DD");
      let matchingCount = count.find(
        (c) => moment(c.date).format("YYYY-MM-DD") === formattedDate
      );
      matchingCount = matchingCount?.count ? matchingCount : 0;
      let percentage = (matchingCount.count / tc.total_count) * 100;

      return {
        dates: formattedDate,
        captured_count: tc.total_count,
        refunded_count: matchingCount.count || 0,
        refund_percentage: percentage ? percentage.toFixed(2) : 0,
      };
    });

    const totalSum = response.reduce(
      (acc, curr) => acc + curr.captured_count,
      0
    );
    const countSum = response.reduce(
      (acc, curr) => acc + curr.refunded_count,
      0
    );
    const overallPercentage = (countSum / totalSum) * 100;
    let total_per = overallPercentage ? overallPercentage.toFixed(2) : 0;

    if (!response?.[0]) {
      response.push({
        captured_count: 0,
        refunded_count: 0,
        refund_percentage: 0,
      });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "dates",
      date_condition.from_date,
      date_condition.to_date
    );
    return { resp: resp, total_per: total_per };
  },

  refund_canceled_count: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);

    let query = `SELECT 
                DATE(o.created_at) as date,
                o.id as refunded_count,
                SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) AS refund_cancel,
                ROUND((SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) * 100.0 / COUNT(o.id)),2) AS refund_cancel_count
            FROM 
                ${tables.order_table} o 
                ${final_cond}    
                o.status IN ('CAPTURED', 'AUTHORISED', 'VOID', 'PARTIALLY_REFUNDED', 'PARTIALLY_CAPTURED', 'REFUNDED', 'CANCELLED') AND DATE(o.created_at) >= '${date_condition.from_date}'
                AND DATE(o.created_at) <= '${date_condition.to_date}' 
            GROUP BY 
                DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        refunded_count: 0,
        refund_cancel: 0,
        refund_cancel_count: 0,
      });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "dates",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  authorised: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);

    let query = `SELECT 
            DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
            COUNT(o.id) AS total_count,
            SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN 1 ELSE 0 END) AS authorized_count,
            ROUND((SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN 1 ELSE 0 END) / COUNT(o.id)) * 100,2) AS authorized_percentage
        FROM ${tables.order_table} o
        
        ${final_cond}  date(o.created_at) >= '${date_condition.from_date}' AND date(o.created_at) <= '${date_condition.to_date}'
        GROUP BY DATE(o.created_at)
        ORDER BY o.created_at DESC;`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_count: 0,
        authorized_count: 0,
        authorized_percentage: 0,
      });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  authorised_value: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);

    let query = `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
        SUM(o.amount) AS total_count,
        SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN o.amount ELSE 0 END) AS authorized_count,
        ROUND((SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN o.amount ELSE 0 END) / SUM(o.amount)) * 100, 2) AS authorized_percentage
        FROM ${tables.order_table} o
        
        ${final_cond}  date(o.created_at) >= '${date_condition.from_date}' AND date(o.created_at) <= '${date_condition.to_date}'
        GROUP BY DATE(o.created_at)
        ORDER BY o.created_at DESC;`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_count: 0,
        authorized_count: 0,
        authorized_percentage: 0,
      });
    }

    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  authorised_total: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);

    let query = `SELECT 
            DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
            COUNT(o.id) AS total_count,
            SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN 1 ELSE 0 END) AS authorized_count,
            ROUND((SUM(CASE WHEN o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED') THEN 1 ELSE 0 END) / COUNT(o.id)) * 100,2) AS authorized_percentage
        FROM ${tables.order_table} o
        
        ${final_cond}  date(o.created_at) >= '${date_condition.from_date}' AND date(o.created_at) <= '${date_condition.to_date}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.authorized_percentage
      ? response?.[0]?.authorized_percentage
      : 0;
  },
  top_customer: async (date_condition, and_condition, table) => {
    let date_str = "";

    if (Object.keys(date_condition).length) {
      date_str = `  DATE(created_at) >= '${date_condition?.from_date}' AND DATE(created_at) <= '${date_condition?.to_date}' `;
    }

    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);
    let query = `SELECT
                    customer_email,
                    COUNT(*) AS transaction_count,
                    SUM(CASE WHEN status = 'CAPTURED' THEN amount ELSE 0 END) AS total_amount
                    FROM
                        ${tables.order_table} o
                      ${final_cond} 
                      customer_email IS NOT NULL AND customer_email != ''
                      AND ${date_str}
                    GROUP BY
                        customer_email
                    HAVING
                        SUM(CASE WHEN status = 'CAPTURED' THEN 1 ELSE 0 END) > 0
                    ORDER BY
                    total_amount DESC
                    LIMIT 10`;

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

  top_country: async (date_condition, and_condition, table) => {
    let date_str = "";

    if (Object.keys(date_condition).length) {
      date_str = `  DATE(created_at) >= '${date_condition?.from_date}' AND DATE(created_at) <= '${date_condition?.to_date}' `;
    }

    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);
    let query = `SELECT 
                    card_country,
                    COUNT(*) AS total_transactions,
                    SUM(amount) AS total_amount
                    FROM 
                        ${tables.order_table} o
                     
                       ${final_cond} 
                       o.status = 'CAPTURED' AND card_country IS NOT NULL AND card_country <> ''
                       AND ${date_str}
                    GROUP BY 
                        card_country
                    ORDER BY 
                    total_amount DESC
                    LIMIT 10;`;
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

  top_payment_method: async (date_condition, and_condition, table) => {
    let date_str = "";

    if (Object.keys(date_condition).length) {
      date_str = `  DATE(created_at) >= '${date_condition?.from_date}' AND DATE(created_at) <= '${date_condition?.to_date}' `;
    }

    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);

    let query = `SELECT
                    payment_mode,
                    COUNT(*) AS total_transaction_count,
                    SUM(amount) AS total_amount
                    FROM
                    ${tables.order_table} o
                    ${final_cond} 
                    payment_mode IS NOT NULL AND payment_mode <> '' 
                    AND ${date_str}
                    GROUP BY
                    payment_mode
                    ORDER BY
                    total_amount DESC
                    LIMIT 10;`;

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

    /*
        let final_cond = " AND ";
        let date_str = "";

        if (Object.keys(date_condition).length) {
            date_str = ` AND DATE(created_at) >= '${date_condition?.from_date}' AND DATE(created_at) <= '${date_condition?.to_date}' `;
        }

        if (Object.keys(and_condition).length) {
            if (and_condition.merchant_id) {
                let str = `merchant_id = ${and_condition.merchant_id}`;
                if (final_cond == " AND ") {
                    final_cond = final_cond + str;
                } else {
                    final_cond = final_cond + " and " + str;
                }
            }
            if (and_condition.currency) {
                let currency_str = await helpers.get_in_condition(
                    "currency",
                    and_condition.currency
                );

                if (final_cond == " AND ") {
                    final_cond = final_cond + currency_str;
                } else {
                    final_cond = final_cond + " and " + currency_str;
                }
            }
            if (and_condition.psp) {
                let psp_str = await helpers.get_in_condition(
                    "psp",
                    and_condition.psp
                );

                if (final_cond == " AND ") {
                    final_cond = final_cond + psp_str;
                } else {
                    final_cond = final_cond + " and " + psp_str;
                }
            }
            if (and_condition.scheme) {
                let scheme_str = await helpers.get_in_condition(
                    "scheme",
                    and_condition.scheme
                );

                if (final_cond == " AND ") {
                    final_cond = final_cond + scheme_str;
                } else {
                    final_cond = final_cond + " and " + scheme_str;
                }
            }
            if (and_condition.payment_mode) {
                let payment_method_str = await helpers.get_in_condition(
                    "payment_mode",
                    and_condition.payment_mode
                );

                if (final_cond == " AND ") {
                    final_cond = final_cond + payment_method_str;
                } else {
                    final_cond = final_cond + " and " + payment_method_str;
                }
            }
            if (and_condition.origin) {
                let payment_origin_str = await helpers.get_in_condition(
                    "origin",
                    and_condition.origin
                );

                if (final_cond == " AND ") {
                    final_cond = final_cond + payment_origin_str;
                } else {
                    final_cond = final_cond + " and " + payment_origin_str;
                }
            }
        }

        if (final_cond == " AND ") {
            final_cond = "";
        } else {
            final_cond = final_cond;
        }

        let query = `SELECT
                    payment_mode,
                    COUNT(*) AS total_transaction_count,
                    SUM(amount) AS total_amount
                    FROM
                    ${table}
                    WHERE
                    payment_mode IS NOT NULL AND payment_mode <> '' ${final_cond} ${date_str}
                    GROUP BY
                    payment_mode
                    ORDER BY
                    total_amount DESC
                    LIMIT 10;`;
        
        let qb = await pool.get_connection();
        let response = await qb.query(query);
        qb.release();
        return response;
        */
  },
  getAllIssuers: async (and_condition, table_condition) => {
    let final_cond = await getFinalCondition(and_condition);
    let tables = await getTableName(table_condition);
    let sql = `SELECT o.issuer
                        FROM ${tables.order_table} o
                         ${final_cond}
                         o.issuer IS NOT null
                         AND o.issuer !='' 
                        GROUP BY issuer`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response;
  },

  retry: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);

    let tables = await getTableName(table);

    let query = `SELECT
                date_list.date AS dates,
                IFNULL(
                    SUM(
                        CASE WHEN txn.status="AUTHORISED"  THEN txn.amount ELSE 0
                    END
            ),
            0
            ) AS retry_amount,
            IFNULL(
                SUM(
                    CASE WHEN (txn.type IN ('CAPTURE','SALE') AND txn.status="AUTHORISED") THEN txn.amount ELSE 0
                END
        ),
        0
        ) AS captured_amount,
        IFNULL(
            (
                IFNULL(
                    SUM(
                        CASE WHEN  txn.status="AUTHORISED" THEN txn.amount ELSE 0
                END
            ),
            0
        ) / IFNULL(
            IFNULL(
                SUM(
                    CASE WHEN (txn.type IN ('CAPTURE','SALE') AND txn.status="AUTHORISED") THEN txn.amount ELSE 0
                END
        ),
        0
        ),
        0
        )
        ) * 100,
        0
        ) AS retry_percentage
            FROM
                (
                SELECT
                    DATE_ADD(
                        '${date_condition.from_date}',
                        INTERVAL units.i + tens.i * 10 + hundreds.i * 100 DAY
                    ) AS DATE
                FROM
                    (
                    SELECT 0 AS i
                    UNION ALL
                SELECT 1
                    UNION ALL
                SELECT 2
                    UNION ALL
            SELECT 3
            UNION ALL
            SELECT 4
            UNION ALL
            SELECT 5
            UNION ALL
            SELECT 6
            UNION ALL
            SELECT 7
            UNION ALL
            SELECT 8
            UNION ALL
            SELECT 9
                ) units
            CROSS JOIN(
                SELECT 0 AS i
                UNION ALL
            SELECT
                1
            UNION ALL
            SELECT
                2
            UNION ALL
            SELECT
                3
            UNION ALL
            SELECT
                4
            UNION ALL
            SELECT
                5
            UNION ALL
            SELECT
                6
            UNION ALL
            SELECT
                7
            UNION ALL
            SELECT
                8
            UNION ALL
            SELECT
                9
            ) tens
            CROSS JOIN(
                SELECT 0 AS i
                UNION ALL
            SELECT
                1
            UNION ALL
            SELECT
                2
            UNION ALL
            SELECT
                3
            UNION ALL
            SELECT
                4
            UNION ALL
            SELECT
                5
            UNION ALL
            SELECT
                6
            UNION ALL
            SELECT
                7
            UNION ALL
            SELECT
                8
            UNION ALL
            SELECT
                9
            ) hundreds
            WHERE
                DATE_ADD(
                    '${date_condition.from_date}',
                    INTERVAL units.i + tens.i * 10 + hundreds.i * 100 DAY
                ) <= '${date_condition.to_date}'
            ) date_list
            LEFT JOIN ${tables.order_table} o ON
                DATE(o.created_at) = date_list.date
                LEFT JOIN ${tables.order_txn_table} txn ON
                o.order_id = txn.order_id
                LEFT JOIN ${config.table_prefix}order_life_cycle_logs cl ON cl.order_id = txn.order_id
                ${final_cond}  
                txn.type IN(
                    'CAPTURE',
                    'SALE'
                )
                AND txn.status='AUTHORISED'
                AND DATE(o.created_at) >= '${date_condition.from_date}' AND DATE(o.created_at) <= '${date_condition.to_date}' AND cl.mode= '${table.mode}' 
            GROUP BY
                date_list.date
            ORDER BY
                date_list.date ASC;`;

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

  allowed: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as allowed_count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as allowed_percentage 
             FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
             AND req.mode = '${table.mode}' AND ps.type = 'allow'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
        GROUP BY 
            DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_count: 0,
        allowed_count: 0,
        allowed_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  allowed_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);

    let tables = await getTableName(table);

    let query = `SELECT 
                        DATE(o.created_at) as date,
                        SUM(o.amount) as total_amount,
                        SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) as allowed_amount,
                        ROUND((SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) / SUM(o.amount)) * 100,2) as allowed_amount_percentage 
                    FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                    AND req.mode = '${table.mode}' AND ps.type = 'allow'
                    ) s ON o.order_id = s.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                GROUP BY 
                    DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_amount: 0,
        allowed_amount: 0,
        allowed_amount_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  allow_total_percentage: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as allowed_count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as allowed_percentage 
            FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
            AND req.mode = '${table.mode}' AND ps.type = 'allow'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0]?.allowed_percentage
      ? response?.[0]?.allowed_percentage
      : 0;
  },
  declined: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as declined_count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as declined_percentage 
             FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
             AND req.mode = '${table.mode}' AND ps.type = 'block'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
        GROUP BY 
            DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_count: 0,
        declined_count: 0,
        declined_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  declined_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                        DATE(o.created_at) as date,
                        SUM(o.amount) as total_amount,
                        SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) as declined_amount,
                        ROUND((SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) / SUM(o.amount)) * 100,2) as declined_amount_percentage 
                    FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                    AND req.mode = '${table.mode}' AND ps.type = 'block'
                    ) s ON o.order_id = s.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                GROUP BY 
                    DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_amount: 0,
        declined_amount: 0,
        declined_amount_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  declined_percentage: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                    COUNT(o.order_id) as total_count,
                    COUNT(s.order_id) as declined_count,
                    ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as declined_percentage 
                FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                AND req.mode = '${table.mode}' AND ps.type = 'block'
                ) s ON o.order_id = s.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    return response?.[0]?.declined_percentage
      ? response?.[0]?.declined_percentage
      : 0;
  },
  reviewed: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as reviewed_count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as reviewed_percentage 
                FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                AND req.mode = '${table.mode}' AND ps.type = 'review'
                ) s ON o.order_id = s.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                GROUP BY 
                DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        total_count: 0,
        reviewed_count: 0,
        reviewed_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  reviewed_total: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as reviewed_count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as reviewed_percentage 
                FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                AND req.mode = '${table.mode}' AND ps.type = 'review'
                ) s ON o.order_id = s.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}';`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.reviewed_percentage
      ? response?.[0].reviewed_percentage
      : 0;
  },
  reviewed_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                    DATE(o.created_at) as date,
                    SUM(o.amount) as total_amount,
                    SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) as reviewed_amount,
                    ROUND((SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) / SUM(o.amount)) * 100,2) as reviewed_amount_percentage 
                    FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                    AND req.mode = '${table.mode}' AND ps.type = 'review'
                    ) s ON o.order_id = s.order_id ${final_cond}    
                    DATE(o.created_at) >= '${date_condition.from_date}' 
                    AND DATE(o.created_at) <= '${date_condition.to_date}'
                    GROUP BY 
                    DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        total_amount: 0,
        reviewed_amount: 0,
        reviewed_amount_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  reviewed_captured: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);

    query = `SELECT 
            DATE(o.created_at) AS date,
            COUNT(o.id) AS total_count,
            COUNT(CASE 
                    WHEN o.fraud_request_type = 'review' 
                        AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED') 
                    THEN o.id 
                    ELSE NULL 
                END) AS reviewed_count,
            ROUND((COUNT(CASE 
                    WHEN o.fraud_request_type = 'review' 
                        AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED') 
                    THEN o.id 
                    ELSE NULL 
                END) * 100.0) / COUNT(o.id),2) AS reviewed_percentage
        FROM 
            ${tables.order_table} AS o
         
            ${final_cond}   
             DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
            AND o.fraud_request_type = 'review' AND o.status IN ('AUTHORISED','CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
        GROUP BY 
            DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({
        total_count: 0,
        reviewed_count: 0,
        reviewed_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  reviewed_total_captured: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);

    query = `SELECT 
            COUNT(o.id) AS total_count,
            COUNT(CASE 
                    WHEN o.fraud_request_type = 'review'  AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                    THEN o.id 
                    ELSE NULL 
                END) AS reviewed_count,
            ROUND((COUNT(CASE 
                    WHEN o.fraud_request_type = 'review'  AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                    THEN o.id 
                    ELSE NULL 
                END) * 100.0) / COUNT(o.id),2) AS reviewed_percentage
        FROM 
            ${tables.order_table} AS o
        
            ${final_cond}   
             DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
            AND fraud_request_type = 'review' AND o.status IN ('AUTHORISED','CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.reviewed_percentage
      ? response?.[0].reviewed_percentage
      : 0;
  },
  reviewed_approved_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
                DATE(o.created_at) AS date,
                SUM(o.amount) AS total_amount,
                SUM(CASE 
                        WHEN o.fraud_request_type = 'review'  AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                           
                        THEN o.amount 
                        ELSE 0 
                    END) AS reviewed_amount,
                ROUND((SUM(CASE 
                        WHEN o.fraud_request_type = 'review'  AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                            
                        THEN o.amount 
                        ELSE 0 
                    END) * 100.0) / SUM(o.amount),2) AS reviewed_amount_percentage
            FROM 
                ${tables.order_table} AS o
           
                ${final_cond}
                 DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                AND o.fraud_request_type = 'review' AND o.status IN ('AUTHORISED','CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
            GROUP BY 
                DATE(o.created_at)`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_amount: 0,
        reviewed_amount: 0,
        reviewed_amount_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  success_3DS: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);

    let query = `SELECT 
            DATE(o.created_at) AS dates,
            COUNT(o.id) as total_count,
            COUNT(CASE WHEN f.status=1  THEN o.id END) as count,
            (COUNT(CASE WHEN f.status=1 THEN o.id END) * 100.0) / COUNT(o.id) as percentage
        FROM 
            ${tables.order_table} o
        INNER JOIN 
            ${request_table} f 
            ON o.order_id = f.order_id 
         
            ${final_cond}
             DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}' AND
            o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED','FAILED','AWAIT_3DS','CANCELLED') AND f.scenario = 'request'
        GROUP BY 
            DATE(o.created_at);
        `;

    query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(s.order_id) as total_count,
                COUNT(CASE 
                    WHEN s.order_id IS NOT NULL 
                    AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED') 
                    THEN o.order_id 
                    END) AS count,
                ROUND((
                    COUNT(CASE 
                        WHEN s.order_id IS NOT NULL 
                        AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED') 
                        THEN o.order_id 
                        END) 
                    / COUNT(s.order_id)
                ) * 100, 2) AS percentage 
            FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
            AND req.mode = '${table.mode}' AND ps.type = 'request'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
        GROUP BY 
            DATE(o.created_at);`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({ total_count: 0, count: 0, percentage: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "dates",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  success_3DS_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);

    let query = `SELECT 
            DATE(o.created_at) AS dates,
            SUM(o.amount) as total_amount,
            SUM(CASE WHEN f.status=1 THEN o.amount END) as amount_3ds_version,
            (SUM(CASE WHEN f.status=1 THEN o.amount END) * 100.0) / SUM(o.amount) as amount_percentage
        FROM 
            ${tables.order_table} o
        INNER JOIN 
            ${request_table} f 
            ON o.order_id = f.order_id 
         
            ${final_cond}
             DATE(o.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}' AND
            o.status IN ('CAPTURED','AUTHORISED','VOID','PARTIALLY_REFUNDED','PARTIALLY_CAPTURED','REFUNDED','FAILED','AWAIT_3DS','CANCELLED') AND f.scenario = 'request'
        GROUP BY 
            DATE(o.created_at);
        `;

    query = `SELECT 
                DATE(o.created_at) AS date,
                SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) AS total_amount,
                SUM(CASE 
                    WHEN s.order_id IS NOT NULL 
                    AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                    THEN o.amount 
                    ELSE 0 
                END) AS amount_3ds_version,
                ROUND((
                    SUM(CASE 
                        WHEN s.order_id IS NOT NULL 
                        AND o.status IN ('CAPTURED', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIALLY_CAPTURED')
                        THEN o.amount 
                        ELSE 0 
                    END) 
                    / SUM(IF(s.order_id IS NOT NULL, o.amount, 0))
                ) * 100, 2) AS amount_percentage
                FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
                AND req.mode = '${table.mode}' AND ps.type = 'request'
                ) s ON o.order_id = s.order_id ${final_cond}    
                DATE(o.created_at) >= '${date_condition.from_date}' 
                AND DATE(o.created_at) <= '${date_condition.to_date}'
            GROUP BY 
                DATE(o.created_at)`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (!response?.[0]) {
      response.push({
        total_amount: 0,
        amount_3ds_version: 0,
        amount_percentage: 0,
      });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "dates",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },
  version_3DS: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition);
    let tables = await getTableName(table);

    let query = `SELECT 
                DATE(o.created_at) as date,
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as percentage 
             FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
             AND req.mode = '${table.mode}' AND ps.type = 'request'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
        GROUP BY 
            DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({ total_count: 0, count: 0, percentage: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  version_3DS_total: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition);
    let tables = await getTableName(table);

    let query = `SELECT 
                COUNT(o.order_id) as total_count,
                COUNT(s.order_id) as count,
                ROUND((COUNT(s.order_id) / COUNT(o.order_id)) * 100,2) as percentage 
             FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
             AND req.mode = '${table.mode}' AND ps.type = 'request'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    return response?.[0]?.percentage ? response?.[0].percentage : 0;
  },
  version_3DS_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, false);
    let tables = await getTableName(table);
    let query = `SELECT 
            DATE(o.created_at) as date,
            SUM(o.amount) as total_amount,
            SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) as amount,
            ROUND((SUM(IF(s.order_id IS NOT NULL, o.amount, 0)) / SUM(o.amount)) * 100,2) as amount_percentage 
            FROM ${tables.order_table} o LEFT JOIN (SELECT DISTINCT(req.order_id), DATE(req.added_date) as created_at FROM ${request_table} as req INNER JOIN fds_rules_pass_status ps ON req.id = ps.request_id INNER JOIN ${tables.order_table} as o ON req.order_id = o.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
            AND req.mode = '${table.mode}' AND ps.type = 'request'
            ) s ON o.order_id = s.order_id ${final_cond}    
            DATE(o.created_at) >= '${date_condition.from_date}' 
            AND DATE(o.created_at) <= '${date_condition.to_date}'
            GROUP BY 
            DATE(o.created_at);`;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }
    if (!response?.[0]) {
      response.push({ total_amount: 0, amount: 0, amount_percentage: 0 });
    }
    let resp = await helpers.date_wise_rec(
      response,
      "date",
      date_condition.from_date,
      date_condition.to_date
    );
    return resp;
  },

  blocked_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);
    let tables = await getTableName(table);
    let query = `SELECT
                    date_list.date AS dates,
                    IFNULL(SUM(txn.amount),0) AS total_amount,
                    IFNULL( SUM(CASE WHEN req.status=3 AND scenario != 'review' THEN txn.amount END),0) AS declined_amount,
                    IFNULL(
                        (SUM(CASE WHEN  req.status=3 AND scenario != 'review' THEN txn.amount END) /
                        SUM(txn.amount)
                        ) * 100,
                    0) AS declined_amount_percentage
                FROM (
                    SELECT
                        DATE_ADD('${date_condition.from_date}', INTERVAL units.i + tens.i * 10 + hundreds.i * 100 DAY) AS date
                    FROM (
                        SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                    ) units
                    CROSS JOIN (
                        SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                    ) tens
                    CROSS JOIN (
                        SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                    ) hundreds
                    WHERE DATE_ADD('${date_condition.from_date}', INTERVAL units.i + tens.i * 10 + hundreds.i * 100 DAY) <= '${date_condition.to_date}'
                ) date_list
                LEFT JOIN ${request_table} req ON
                DATE(req.added_date) = date_list.date
                LEFT JOIN ${tables.order_txn_table} txn ON
                req.order_id = txn.order_id
                LEFT JOIN ${tables.order_table} o ON o.order_id = req.order_id
                 ${final_cond}  
                     DATE(req.added_date) >= '${date_condition.from_date}' 
                    AND DATE(req.added_date) <= '${date_condition.to_date}' AND mode='${table.mode}'
                GROUP BY
                    date_list.date
                ORDER BY
                    date_list.date ASC;`;
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

  high_risk_amount: async (date_condition, and_condition, table) => {
    let final_cond = await getFinalCondition(and_condition, true);

    let tables = await getTableName(table);

    let query = `SELECT date_list.date AS date, COALESCE(order_totals.total_amount, 0) AS total_amount
                    FROM (
                        SELECT '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY AS date
                        FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                            UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
                        CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                    UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
                        WHERE '${date_condition.from_date}' + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ) date_list
                    LEFT JOIN (
                        SELECT DATE(txn.created_at) AS date, SUM(txn.amount) AS total_amount
                        FROM ${tables.order_table} o
                        LEFT JOIN ${tables.order_txn_table} txn ON
                			o.order_id = txn.order_id
                         ${final_cond} 
                         o.high_risk_transaction=1
                         AND date(txn.created_at) BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                        GROUP BY DATE(txn.created_at)
                    ) order_totals
                    ON date_list.date = order_totals.date
                    WHERE date_list.date BETWEEN '${date_condition.from_date}' AND '${date_condition.to_date}'
                    ORDER BY date_list.date ASC;
                    `;

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
  psp_txn: async (date_condition, and_condition, table) => {
    let date_str = "";

    if (Object.keys(date_condition).length) {
      date_str = ` DATE( o.created_at) >= '${date_condition?.from_date}' AND DATE( o.created_at) <= '${date_condition?.to_date}' `;
    }

    let final_cond = await getFinalCondition(and_condition);

    let tables = await getTableName(table);


    let query = `SELECT p.psp,
       COALESCE(SUM(o.amount), 0) AS total_amount,
       COALESCE(COUNT(o.id), 0) AS total_count
FROM (SELECT DISTINCT psp FROM ${tables.order_table} WHERE psp IS NOT NULL) p  -- List of all possible PSPs
LEFT JOIN ${tables.order_table} o ON p.psp = o.psp
                    AND o.status IN ('AUTHORISED','CAPTURED','VOID','PARTIALLY_REFUNDED','REFUNDED','PARTIALLY_CAPTURED')
                    AND  ${date_str}
GROUP BY p.psp;`;

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
module.exports = dbModel;
