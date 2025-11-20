require("dotenv").config({ path: "../.env" });
const statusCode = require("../../utilities/statuscode/index");
const response = require("../../utilities/response/ServerResponse");
var axios = require("axios");
const xml2js = require("xml2js");
const winston = require("../../utilities/logmanager/winston");
const helpers = require('../../utilities/helper/general_helper');
const cred = require('../../config/credientials');
const { v4: uuidv4 } = require('uuid')
const logger = require('../../config/logger');

makeRecurringRequest = async (values, _terminalcred) => {
    console.log(`this is the mpgs`);
    console.log(values, _terminalcred);
    const basicAuthToken = await helpers.createBasicAuthToken('merchant.' + _terminalcred.MID, _terminalcred.password);
    console.log(`basic auth token and values are below and cred`);
    console.log(basicAuthToken);
    console.log(values);
    console.log(_terminalcred);
    console.log(cred.mpgs);
    let captureReq = {
        "apiOperation": "PAY",
        "agreement": {
            "id": values.subscription_id
        },
        "order": {
            "amount": values.amount,
            "currency": values.currency,
            "reference": uuidv4()
        },
        "sourceOfFunds": {
            "token": values.tranref
        },
        "transaction": {
            "reference": values.payment_id
        }
    };

    console.log("🚀 ~ makeRecurringRequest: ~ data:", captureReq)

    let config = {
        method: "put",
        maxBodyLength: Infinity,
        url: `${cred.mpgs.test_url}/merchant/${_terminalcred.MID}/order/${values.order_id}/transaction/${values.payment_id}`,
        headers: {
            "Content-Type": "application/json",
            "Authorization": basicAuthToken
        },
        data: JSON.stringify(captureReq),
    };

    try {
        const response = await axios.request(config);
        console.log(response.data);
        return response.data;
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        return null;
    }
};
module.exports = makeRecurringRequest;