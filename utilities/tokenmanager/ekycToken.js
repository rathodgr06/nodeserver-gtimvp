const jwt = require('jsonwebtoken');
module.exports = function generateAccessToken(payload) {
    
    return jwt.sign(payload, process.env.EKYC_TOKEN_SECRET, { expiresIn: '20day' });
}