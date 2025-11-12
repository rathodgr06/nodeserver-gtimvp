const MerchantModel = require("../../models/merchantmodel");
const StatusCode = require("../statuscode/index");
const ServerResponse = require("../response/ServerResponse");

module.exports = async function AuthenticateAccessToken(req, res, next) {
    const authHeader = req.headers;

    const request_data = {
        secret_key: req.headers['merchant-secret'],
        api_key: req.headers['merchant-key'],
    };
    

    let result = await MerchantModel.select_merchant(request_data);

    

    if (!request_data.api_key && !request_data.secret_key) {
        res.status(StatusCode.badRequest).send(
            ServerResponse.validationResponse("Unauthorized request", "E0001")
        );
    } else if (result[0]) {
        let sup_merchant_id = await MerchantModel.select_super_merchant({
            merchant_id: result[0]?.merchant_id,
        });
        

        user = {
            merchant_id: result[0]?.merchant_id,
            sub_merchant_id: sup_merchant_id[0]?.super_merchant_id,
        };
        
        req.user = user;
        next();
    } else {
        res.status(StatusCode.badRequest).send(
            ServerResponse.validationResponse("Unauthorized request", "E0001")
        );
    }
};
