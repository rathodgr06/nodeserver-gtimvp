const StatusCode = require("../statuscode/index");
const ServerResponse = require("../response/ServerResponse");
const path = require("path");
require("dotenv").config({ path: "../../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

module.exports = async (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    let clientIp = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    console.log(clientIp);
    console.log(req.credentials);
    if(req.credentials.type=="live"){
     let qb = await pool.get_connection();
        let response;
        try {
            response = await qb
                .select(
                    "id"
                )
                .where({
                    "ip": clientIp,
                    "sub_merchant_id": req.credentials.merchant_id,
                    "status": 0,
                })
                .get(config.table_prefix + "merchants_ip_whitelist");
        } catch (error) {
            console.error('Database query failed:', error);
        } finally {
            qb.release();
        }
        if(response.length>0){
            next();
        }else{
            res.status(StatusCode.unauthorized).send(
                ServerResponse.validationResponse(
                    "Access denied: Your IP address is not authorized to access this service.",
                    403
                )
            );
        }
    }else{
        next();
    }
};
