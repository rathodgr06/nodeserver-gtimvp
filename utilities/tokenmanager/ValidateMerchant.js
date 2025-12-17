const StatusCode = require('../statuscode/index');
const ServerResponse = require('../response/ServerResponse');
const path = require('path')
const pool = require("../../config/database");
require('dotenv').config({ path: "../../.env" });
const env = process.env.ENVIRONMENT
const config = require('../../config/config.json')[env];
const X_Username =process.env.X_Username;
const X_Password =process.env.X_Password;

module.exports = async (req, res, next) => {
    let authHeader = req.headers;
    let username = authHeader.xusername;
    let password = authHeader.xpassword;
    let merchant_key = req.headers["merchant-key"];
    let merchant_secret = req.headers["merchant-secret"];
    let user = {type:'',id:'',mode:''}

   // return;
    if(username == X_Username && password == X_Password){
        next()  
    }else if(merchant_key && merchant_secret){
        let qb = await pool.get_connection();
        let response;
        try {
          response = await qb
            .select("merchant_id,type,super_merchant_id")
            .where({
              merchant_key: merchant_key,
              merchant_secret: merchant_secret,
              deleted: 0,
            })
            .get(config.table_prefix + "master_merchant_key_and_secret");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }
         let merchant_details = response[0];
        //  test a merchant environment with CHARGES MODE ENV
         if (merchant_details?.type !== process.env.CHARGES_MODE) {
           return res
             .status(StatusCode.unauthorized)
             .send(
               ServerResponse.validationResponse(
                 "Invalid merchant key passed",
                 400
               )
             );
         }
        if (response[0]?.type == "live" || response[0]?.type == "test") {
            let providedMerchantId = req.params.sub_merchant_id;
            if (providedMerchantId) {
              if (providedMerchantId == merchant_details?.merchant_id) {
                user.type = "Merchant";
                user.id = merchant_details?.merchant_id;
                user.mode = merchant_details?.type;
                req.user = user;
                next();
              } else {
                res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid merchant key or secret",
                      401
                    )
                  );
              }
            }else{
                user.type = "Merchant";
                user.id = merchant_details?.merchant_id;
                user.mode = merchant_details?.type;
                req.user = user;
                next();
            }
        } else {
            res.status(StatusCode.unauthorized).send(
                ServerResponse.validationResponse(
                    "Invalid merchant key or secret",
                    401
                )
            );
        }
    }else{
        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Unauthorized request','E0001'));
    }

}