const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (document_ids) => {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(
      "SELECT med.document,mdt.group_required,mdt.document_type FROM " +
        config.table_prefix +
        "master_entity_document as med INNER JOIN " +
        config.table_prefix +
        "master_document_type as mdt on mdt.id = med.document  WHERE med.id IN (" +
        document_ids.join(",") +
        ")"
    );
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }
  return response;
};
