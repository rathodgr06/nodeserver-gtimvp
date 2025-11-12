const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
module.exports = async (mcc, psp, charges_type, payment_mode) => {
  let qb = await pool.get_connection();
  let query =
    "select * from " +
    config.table_prefix +
    "charges_transaction_setup where psp =" +
    psp +
    " AND charges_type =" +
    "'" +
    charges_type +
    "'" +
    " AND mcc IN" +
    "(" +
    mcc +
    ")" +
    " AND payment_mode IN " +
    "(" +
    "'" +
    payment_mode +
    "'" +
    ")";
  let response;
  try {
    response = await qb.query(query);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  if (response.length > 0) {
    return true;
  } else {
    return false;
  }
};

// get_count: async (condition_obj,search_city) => {
//     let qb = await pool.get_connection();
//     let condition = await helpers.get_conditional_string(condition_obj);
//     if(search_city.city_name !=""){
//         let city_condition = await helpers.get_conditional_like_string(search_city);
//         response = await qb
//         .query("select count('id') as count from "+dbtable+" where "+condition +city_condition);
//     }else{
//     response = await qb
//     .query("select count('id') as count from "+dbtable+" where "+condition);
//     }
//         qb.release();
//     return response[0].count;
// },
