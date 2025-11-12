const axios = require('axios');
const creds = require('../../config/credientials');
const helpers = require('../../utilities/helper/general_helper');
const orderTransactionModel = require('../../models/order_transaction');
const { send_webhook_data } = require("../../controller/webhook_settings");
const statusCode = require("../../utilities/statuscode/index");
const Server_response = require("../../utilities/response/ServerResponse");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require('moment');
const enc_dec = require("../../utilities/decryptor/decryptor");
const { v4: uuidv4 } = require('uuid');
const token = async(data) =>{
    try {
        const req_data = {
            "sourceOfFunds": {
                "provided": {
                    "card": {
                        "expiry": {
                            "month": data.expiry.month,
                            "year": data.expiry.year
                        },
                        "number": data.number
                    }
                },
                "type": "CARD"
            }
        };
        const config = {
            method: 'post',
            url: creds.mpgs.base_url + `merchant/${data.mid}/token`,
            headers: {
                'Authorization': data.authToken,
                'Content-Type': 'application/json'
            },
            maxBodyLength: Infinity,
            data: req_data,
            maxRedirects: 10,
            timeout: 0
        };
        const response = await axios(config);
        console.log(`token response-------------------------->`);
        console.log(response.data.token);
        return response.data.token;
    }
    catch (error) {
        console.log(error);
        console.log(`inside token catch`)
      return '';
    }
}

module.exports = token;
