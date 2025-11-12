const jwt = require('jsonwebtoken');
const statusCode = require('../statuscode/index');
const response = require('../response/ServerResponse');
module.exports = function AuthenticateAccessToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        res.json({ message: 'Invalid access token' });
    } else {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
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
                next()
            }
        });
    }
}