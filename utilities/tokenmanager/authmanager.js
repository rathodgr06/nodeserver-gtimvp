
const StatusCode = require('../statuscode/index');
const ServerResponse = require('../response/ServerResponse');
module.exports = function AuthenticateAccessToken(req, res, next) {
    
    if (1) {
        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Do not have access','E0001'));
    } else {
        req.user = user;
        next();
    }
}