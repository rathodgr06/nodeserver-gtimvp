const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const response_code_table = config.table_prefix + "response_code";
const helpers = require("../utilities/helper/general_helper");
const psp_table = config.table_prefix + "psp";

const Routing = {
  getMidFromPaymentMethod: async (condition) => {
    let qb = await pool.get_connection();
    let sql = `SELECT * FROM ${config.table_prefix}merchant_payment_methods where sub_merchant_id=${condition.merchant_id} AND methods='${condition.method}' AND mode='${condition.env}'`;

    let response = await qb.query(sql);
    let mid_response = [];
    let mid_array = [];
    
    try {
      //console.log('sql', sql);
      //console.log(`check merchant payment method response `);
      //console.log(response);
      if (response && response.length > 0) {
        response = response?.[0];

        //get all mid for checking
        let checkMidSql = `SELECT mid.* FROM ${config.table_prefix}mid mid
                 WHERE submerchant_id=${condition.merchant_id} 
                 AND deleted = 0
                 AND env ='${condition.env}'`;
        // console.log('checkMidSql', checkMidSql);
        let check_mid_response = await qb.query(checkMidSql);
        //console.log(`check mid response`);
        //console.log(check_mid_response);

        if (
          response.methods === "card_payment" ||
          response.methods === "stored_card"
        ) {
          // const payment_payment_scheme = response.others;
          check_mid_response.filter((val) => {
            //console.log('val', val);
            if (val.psp_id !== 4) {
              mid_array.push(val.id);
              //   mid_payment_scheme = val.payment_schemes.split(",");
              //   mid_payment_scheme.forEach((m_val) => {
              //     if (payment_payment_scheme.includes(m_val)) {
              //     //   mid_array.push(val.id);
              //     }
              //   });
            }
          });
        } else {
          // get payment method
          // const other_payment_method = [];
          // let distinct_payment_method = await helpers.getDistinctPaymentMethod(condition);
          // distinct_payment_method.map(val => other_payment_method.push(val.methods));

          //if (other_payment_method.includes(response.methods)) {

          for (let mid of check_mid_response) {
            mid_payment_method = mid.payment_methods
              .split(",")
              .map((val) => val.toLowerCase().replace(/ /g, "_"));
            for (let m_val of mid_payment_method) {
              if (m_val === response.methods) {
                mid_array.push(mid.id);
                // break;
              }
            }
          }
          // check_mid_response.filter((val) => {
          //     mid_payment_method = val.payment_methods.split(',').map(val => val.toLowerCase().replace(/ /g, "_"));

          //     mid_payment_method.forEach((m_val) => {
          //         if (other_payment_method.includes(m_val) && m_val === response.methods) {
          //             mid_array.push(val.id)
          //         }
          //     });
          // });
          //}
        }

        //get all match mid
        // console.log(`MID ARRAY`)
        // console.log(mid_array);
        let unique = [...new Set(mid_array)];
        let midSql = `SELECT mid.id, mid.psp_id,mid.mid,mid.password, psp.name, mid.label
                 FROM ${config.table_prefix}mid mid
                 JOIN ${config.table_prefix}psp psp on mid.psp_id = psp.id
                 WHERE mid.id in (${unique.join(",")})`;
        if (mid_array.length > 0) {
          mid_response = await qb
            .select(
              "mid.id, mid.psp_id,mid.mid,mid.password, psp.name, mid.label"
            )
            .from(`${config.table_prefix}mid mid`)
            .join(`${config.table_prefix}psp psp`, "mid.psp_id=psp.id", "inner")
            .where("mid.id", mid_array)
            .get();
        }
        //console.log('midSql', midSql);
        // mid_response = await qb.query(midSql);
      }
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return mid_response;
  },
  add: async (data, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      qb.insert(`${config.table_prefix}${table}`, data);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  },
  get: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by(["routing_order"], "asc")
        .get(`${config.table_prefix}${table}`);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  update: async (condition, data, table) => {
    let qb = await pool.get_connection();
    try {
      await qb
        .set(data)
        .where(condition)
        .update(`${config.table_prefix}${table}`);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    //return response;
  },
  getMid: async (sub_merchant_id, env) => {
    let sql = `SELECT label,id FROM ${config.table_prefix}mid WHERE submerchant_id = ${sub_merchant_id} AND env='${env}' and label is NOT null and label !=''`;
    console.log("sql", sql);
    let response;
    let qb = await pool.get_connection();
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  checkCountry: async (country) => {
    // console.log('sql', sql);
    // let response = await qb.query(sql)
    let response;
    let qb = await pool.get_connection();
    try {
      response = qb
        .select("id")
        .from(`${config.table_prefix}country`)
        .where({ country_code: country })
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    // console.log(qb.last_query());
    if (response && response.length === 0) {
      return false;
    } else {
      return true;
    }
  },
  getRuleOrder: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by(["rule_order"], "desc")
        .limit(1)
        .get(`${config.table_prefix}${table}`);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    console.log(qb.last_query(), "response", response);
    let order = 0;
    if (response && response.length > 0) {
      order = response?.[0].rule_order;
    }

    return parseInt(order);
  },
  getRule: async (condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select("*")
        .where(condition)
        .order_by(["rule_order"], "asc")
        .get(`${config.table_prefix}${table}`);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
  getOrderRoutingList: async (selection, condition, table) => {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(selection)
        .where(condition)
        .order_by(["routing_order"], "asc")
        .get(`${config.table_prefix}${table}`);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response;
  },
};

module.exports = Routing;
