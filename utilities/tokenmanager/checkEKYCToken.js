const jwt = require('jsonwebtoken');
const statusCode = require('../statuscode/index');
const response = require('../response/ServerResponse');
const enc_dec = require("../decryptor/decryptor");
module.exports = function AuthenticateAccessToken(req, res, next) {
    const token =req.body.token;
 
    if (token == null) {
        res.status(statusCode.expired).send(response.errormsg('Invalid access token','E0060'));
    } else {
        jwt.verify(token, process.env.EKYC_TOKEN_SECRET, (err, user) => {
            if (err) {
                if (err.message == "jwt expired") {
                    res
                        .status(statusCode.expired)
                        .send(response.errormsg('Token Expired Please Login',"E0059"));
                } else {
                    res
                        .status(statusCode.expired)
                        .send(response.errormsg('Unable To Validate Token','E0060'));
                }
            } else {
                
                req.user = user;
                next();
            }
        });
    }
}