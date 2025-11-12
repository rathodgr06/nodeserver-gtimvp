const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const merchantOrderModel = require("../models/merchantOrder");
const routingModel = require("../models/routingModel");
const helpers = require("../utilities/helper/general_helper");

var apple={
    routing: async (req, res) => {
        try {
            let data_response = await apple.check(req);
            if(data_response.terminal_id){
                res.status(statusCode.ok).send(response.successdatamsg(data_response,"Proceed with transaction"));
            }else{
                res.status(statusCode.badRequest).send(response.errorMsgWithData("No route found",data_response));
            }
        } catch (error) {
            res.status(statusCode.internalError).send(response.errorMsgWithData(error.message));
        }
    } ,
    check:async (req)=>{
        let payment_mode = req.body.env
        let table_name = "orders"
        if (payment_mode == "test") {
            table_name = "test_orders";
        }
        const order_details = await merchantOrderModel.selectOne("merchant_id,currency", { order_id: req.body?.order_id, }, table_name);
        const routing_order_ap = await routingModel.get({ sub_merchant_id: order_details.merchant_id, payment_method: "apple_pay", mode: payment_mode }, "routing_order");
        let data_response = { psp: "", terminal_id: "" }

        if (routing_order_ap.length > 0) {
            const mid_data = await merchantOrderModel.selectOne("psp_id,terminal_id,id", { id: routing_order_ap[0].mid_id }, "mid");
            data_response.psp = await helpers.get_psp_key_by_id(mid_data.psp_id);
            data_response.terminal_id = mid_data.terminal_id
            data_response.mid = mid_data.id
        } else {
            let mid_data = await helpers.get_apple_mid_by_merchant_id(
                order_details?.merchant_id, order_details.currency, payment_mode
            );
            mid_data.forEach(element => {
                if (element.payment_methods.includes("Apple Pay")) {
                    data_response.psp = element.psp;
                    data_response.terminal_id = element.terminal_id
                    data_response.mid_id = element.midId
                }
            });
        }
        return data_response;
    }
}


module.exports=apple