const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
module.exports = async (dial, table_name, mobile) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("*")
      .where({ dial: dial })
      .get(config.table_prefix + table_name);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  var f_letter = mobile.charAt(0);
  if (response[0].accept_zero_at_first_palce == "Yes") {
    if (parseInt(f_letter) != 0) {
      return {
        status: false,
        message: "Please enter mobile number start with 0",
      };
    }
  } else if (response[0].accept_zero_at_first_palce == "No") {
    if (parseInt(f_letter) == 0) {
      return { status: false, message: "Do not allow 0 at start." };
    }
  }
  if (response[0].mobile_no_length != mobile.length && dial!=231) {
    return {
      status: false,
      message:
        "Please enter " + response[0].mobile_no_length + " digit mobile number",
    };
  }
  return { status: true, message: "Validate" };
};
