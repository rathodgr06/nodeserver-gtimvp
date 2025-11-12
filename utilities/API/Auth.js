const StatusCode = require('../statuscode/index');
const ServerResponse = require('../response/ServerResponse');
const path = require('path')
require('dotenv').config({ path: "../../.env" });
const env = process.env.ENVIRONMENT
const config = require('../../config/config.json')[env];
const X_Username =process.env.X_Username;
const X_Password =process.env.X_Password;
const pool = require("../../config/database");
const axios = require('axios');

module.exports = async (req, res, next) => {
    try{
    let authHeader = req.headers;
    let username=authHeader.xusername;
    let password=authHeader.xpassword;
    let receiver_key = authHeader?.['receiver-key'];
    let receiver_secret = authHeader?.['receiver-secret'];
    let merchant_key = authHeader?.['merchant-key'];
    let merchant_secret = authHeader?.['merchant-secret'];
    let user = {type:'',id:'',mode:''}
    // check if header exits
    if(username && password){
        console.log(`inside the Admin`);
        // checking the username and password are valid
        if(username==X_Username && password == X_Password){
            user.type = 'Admin';
            user.id = 0;
            req.user  = user;
            next();
        }else{
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Unauthorized request','E0001'));
        }
    }else if(receiver_key && receiver_secret){
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        if(receiver_credentials_response?.data?.status==200){
            let receiverData = receiver_credentials_response.data;
             //  test a receiver environment with CHARGES MODE ENV
            if (receiver_credentials_response?.data?.data?.type !==process.env.CHARGES_MODE) {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }

            let providedReceiverId = req.bodyString('receiver_id');
            if(providedReceiverId){
               if (providedReceiverId == receiverData?.data?.receiver_id) {
                 user.type = "Receiver";
                 user.id = receiverData?.data?.receiver_id;
                 user.mode = receiverData?.data?.type;
                 req.user = user;
                 next();
               } else {
                 res
                   .status(StatusCode.unauthorized)
                   .send(
                     ServerResponse.validationResponse(
                       "Invalid receiver key or secret",
                       401
                     )
                   );
               }
            }else{
               user.type = "Receiver";
               user.id = receiverData?.data?.receiver_id;
               user.mode = receiverData?.data?.type;
               req.user = user;
               next();
            }
           
        }else{
            res.status(StatusCode.unauthorized).send(ServerResponse.validationResponse("Invalid receiver key or secret",401));
        }
        
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
            let providedMerchantId = req.bodyString('sub_merchant_id') || req.bodyString('submerchant_id');
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
    }catch(error){
        console.log(error);
        res.status(StatusCode.internalError).send(ServerResponse.validationResponse('Something went wrong','E0001'));
    }

}