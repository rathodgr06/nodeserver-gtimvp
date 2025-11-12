const axios = require('axios')
const response = require('../response/ServerResponse');
const statusCode = require('../statuscode/index');
module.exports = async (req,res) => {
    try {
        const config = {
            method: 'get',
            url: " http://www.geoplugin.net/json.gp?ip="+req.headers.ip,
        }
        let result = await axios(config);
        let prefix= 'geoplugin_'
        var val = Object.assign(
            {},
            ...Object.keys(result.data).map(key => (
                {[key.replace(prefix, "")]: result.data[key]}
            ))
          );
        res.status(statusCode.ok).send(response.successdatamsg(val,'Ip Details fetch successfully.'))
    } catch (error) {
        
        res.status(statusCode.ok).send(response.errormsg('Unable to fetch ip details.'))
    }
}