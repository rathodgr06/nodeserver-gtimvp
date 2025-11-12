const bonusCalculate = require('../utilities/referrer-bonus');
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");

var bonusCalculation = {
    calculate: async (req, res) => {
        await bonusCalculate(
            {
                amount: req.bodyString("amount"),
                currency: req.bodyString("currency"),
                order_id: req.bodyString("order_id"),
                super_merchant_id: req.bodyString("super_merchant_id")
            },
            req.bodyString("referral_code_used")
        )
        res.status(statusCode.ok).send(
            response.successmsg("Referrer bonus calculation")
        );
    }
}
module.exports = bonusCalculation;