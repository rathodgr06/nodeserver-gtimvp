const jwt = require('jsonwebtoken');
const statusCode = require('../statuscode/index');
const response = require('../response/ServerResponse');
const excluded_url = ['/get-company-proof', '/get-kyc-step', '/update-ekyc-step', '/update-pan', '/update-adhar', '/get-city', '/get-state', '/get-industry-type','/get-business-entity','/dashboard'];
const encrypt_decrypt = require('../decryptor/encrypt_decrypt');
module.exports = function AuthenticateAccessToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        res.status(statusCode.expired).send(response.errormsg('Invalid access token','E0060'));
    } else {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
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
                let decrypted_payload = encrypt_decrypt('descrypt',payload.payload);
                req.user = JSON.parse(decrypted_payload);
                next();
            }
        });
    }
}