const jwt = require('jsonwebtoken');
const statusCode = require('../statuscode/index');
const response = require('../response/ServerResponse');
module.exports = function refreshToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if(token == null){
        res.json({ message: 'Invalid refresh token'});
    }
    
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err,payload) => {
        if(err){
            res.json({ msg: 'Invalid refresh token' });
        }
        else{
            const accessToken = generateAccessToken(payload)		
            res.json({ accessToken: accessToken , msg: 'Welcome back'});
        }
    });
}
function generateAccessToken(payload){
	return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2m'});
}