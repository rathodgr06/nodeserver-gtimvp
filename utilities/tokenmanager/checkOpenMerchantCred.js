const StatusCode = require("../statuscode/index");
const ServerResponse = require("../response/ServerResponse");
const path = require("path");
require("dotenv").config({ path: "../../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

module.exports = async (req, res, next) => {
    const authHeader = req.headers;
    let merchant_key = req.headers['merchant-key'] || authHeader.merchant_key;
    let merchant_secret = req.headers['merchant-secret'] || authHeader.merchant_secret;
    if (!merchant_secret && !merchant_key) {
        res.status(StatusCode.unauthorized).send(
            ServerResponse.validationResponse("Unauthorized request", "E0001")
        );
    } else {
        let qb = await pool.get_connection();
        let response;
        try {
            response = await qb
                .select(
                    "merchant_id,type,super_merchant_id"
                )
                .where({
                    "merchant_key": merchant_key,
                    "merchant_secret": merchant_secret,
                    "deleted": 0,
                })
                .get(config.table_prefix + "master_merchant_key_and_secret");
                console.log(qb.last_query());
        } catch (error) {
            console.error('Database query failed:', error);
        } finally {
            qb.release();
        }
      
        // .join(
        //     config.table_prefix + "master_merchant md",
        //     "mk.merchant_id=md.id",
        //     "inner"
        // )
        // .join(
        //     config.table_prefix + "master_merchant_details mde",
        //     "mk.merchant_id=mde.merchant_id",
        //     "left"
        // )
        // .join(
        //     config.table_prefix + "mcc_codes mcc",
        //     "mde.mcc_codes=mcc.id",
        //     "left"
        // )
        // .join(
        //     config.table_prefix + "master_mcc_category mcc_cat",
        //     "mcc.category=mcc_cat.id",
        //     "left"
        // )

        let merchant_details = response[0];
        // console.log(`Checking response and type of that ${response}`)
        //console.log(response[0]?.type == "live" || response[0]?.type == "test")
        if (response[0]?.type == "live" || response[0]?.type == "test") {
            req.credentials = merchant_details;
            console.log(`going next`);
            next();
        } else {
            res.status(StatusCode.unauthorized).send(
                ServerResponse.validationResponse(
                    "Invalid merchant key or secret",
                    401
                )
            );
        }
    }
};
