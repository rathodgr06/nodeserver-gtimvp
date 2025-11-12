const jwt = require('jsonwebtoken');
module.exports = function generateAccessToken(payload,time) {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: time }); //time in seconds
}