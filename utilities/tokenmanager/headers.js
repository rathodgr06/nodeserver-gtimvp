const StatusCode = require('../statuscode/index');
const ServerResponse = require('../response/ServerResponse');
const path = require('path')
require('dotenv').config({ path: "../../.env" });
const env = process.env.ENVIRONMENT
const config = require('../../config/config.json')[env];
const X_Username =process.env.X_Username;
const X_Password =process.env.X_Password;

module.exports = async (req, res, next) => {
    let authHeader = req.headers;
    let username=authHeader.xusername
    let password=authHeader.xpassword

   // return;
    if(username == X_Username && password == X_Password){
        next()  
    }else{
        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Unauthorized request','E0001'));
    }

}