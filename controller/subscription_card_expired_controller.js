const enc_dec = require("../utilities/decryptor/decryptor");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");
const ShortUniqueId = require("short-unique-id");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const checkSubscription = require('../utilities/validations/subscription_check');
//models
const subscription_card_expired_model = require('../models/subscription_card_expired_model');
const subs_plan_model = require('../models/subs_plan_model');
const merchantOrderModel = require("../models/merchantOrder");
const accessToken = require("../utilities/tokenmanager/token");
const order_logs = require("../models/order_logs");
const winston = require('../utilities/logmanager/winston');


const subscription_card_expired = {
    get_subscription: async (req, res) => {

        try {
            const subscription_id = enc_dec.cjs_decrypt(req.bodyString("token"));
            const subscription_result = await subscription_card_expired_model.get_subscription_data(subscription_id);
            const subscription_recurring_result = await subscription_card_expired_model.get_subscription_next_due_amount(subscription_id);
            
            let last_date = await helpers.get_recurring_last_due_date({subscription_id:`'${subscription_id}'` ,is_paid:1});
            let subscription_terms = await checkSubscription.checkForSubscriptionRecurring(subscription_id);
            const data = {};

            // let find = await subs_plan_model.selectOne(
            //     "*",
            //     { ref_no: subscription_result.ref_no },
            //     "subs_plans"
            // );

            const rlt = await subs_plan_model.selectOneMerchant({ id: subscription_result.submerchant_id });
            let tc = await helpers.get_terms_and_condition();
            const company_details = await helpers.company_details({ id: 1 });

            let image_path = server_addr + "/static/images/";

            
            data.merchant_details = {
                theme: rlt.theme,
                icon: process.env.STATIC_URL + "/static/files/" + rlt.icon,
                logo: process.env.STATIC_URL + "/static/files/" + rlt.logo,
                use_logo: rlt.use_logo,
                we_accept_image: process.env.STATIC_URL + "/static/files/" + rlt.we_accept_image,
                brand_color: rlt.brand_color,
                accent_color: rlt.accent_color,
                merchant_name: subscription_result.submerchant_id
                    ? await helpers.get_merchantdetails_name_by_id(subscription_result.submerchant_id)
                    : "",
                use_logo_instead_icon: rlt.use_logo,
                branding_language: enc_dec.cjs_encrypt(
                    rlt.branding_language
                ),
                company_details: {
                    fav_icon: image_path + company_details.fav_icon,
                    logo: image_path + company_details.company_logo,
                    letter_head: image_path + company_details.letter_head,
                    footer_banner:
                        image_path + company_details.footer_banner,
                    title: await helpers.get_title(),
                    terms_and_condition: tc,
                },
            };



            data.subscription_details = {
                subs_plan_id: enc_dec.cjs_encrypt(subscription_result.id),
                plan_name: subscription_result.plan_name,
                merchant_name: "",
                plan_description: subscription_result.plan_description,
                pay_url: subscription_result.ref_no,
                plan_billing_frequency:
                    subscription_result.plan_billing_frequency.charAt(0).toUpperCase() +
                    subscription_result.plan_billing_frequency.slice(1),
                status: subscription_result.status == 0 ? "Active" : "Deactivated",
                currency: subscription_result.plan_currency,
                initial_payment_amount:
                    subscription_result.initial_payment_amount.toFixed(2),
                payment_interval: subscription_result.payment_interval,
                final_payment_amount:
                    subscription_result.final_payment_amount.toFixed(2),
                plan_billing_amount: subscription_result.plan_billing_amount.toFixed(2),
                note: subscription_result.note,
                start_date: moment(subscription_result.start_date).format("DD-MM-YYYY"),
                last_payment_date:subscription_result.successful_payment_date?moment(subscription_result.successful_payment_date).format('DD-MM-YYYY HH:mm:ss'):'-',
                pending_terms: subscription_terms.unpaid_recurring,
                terms:subscription_result.terms=='1999'?'Unlimited': subscription_result.terms,
                discounted_terms: subscription_result.discounted_terms?subscription_result.discounted_terms:'-',
                discounted_amount: subscription_result.discounted_amount!='0'? subscription_result.plan_currency +' '+subscription_result.discounted_amount.toFixed(2):'-',
                customer_details: {
                    name: subscription_result.name,
                    email: subscription_result.email,
                    subscription_id: req.bodyString("token"),
                    recurring_amount: subscription_recurring_result.amount ?? ''
                }
            };

            data.prefer_lang = enc_dec.cjs_encrypt(rlt.branding_language);

            return res
                .status(statusCode.ok)
                .send(response.successansmsg(
                    data,
                    "Details fetch successfully."
                ));
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }

    },
    create_order: async (req, res) => {

        let client = {
            os: req.headers.os,
            browser: req.headers.browser ? req.headers.browser : "",
            ip: req.headers.ip ? req.headers.ip : "",
        };
        const logs = [];
        let order_id = await helpers.make_sequential_no("ORD");
        let recurring_amount = req.bodyString("recurring_amount");
        const amount =   parseFloat(recurring_amount).toFixed(2);
        try {
            
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : subscription_card_expired_controller.create_order initiated`
            );

            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : protocol type ${req.protocol
                }`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : httpMethod ${req.method
                }`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : requestedURL ${req.url
                }`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : Request content-type = ${req.headers["content-type"]}`
            );
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : Content length = ${req.headers["content-length"]
                }`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with headers ${JSON.stringify(req.headers)}`
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : request with data ${JSON.stringify(req.body)}`
            );

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : subs_plan_model.selectOneDynamic of id = ${req.bodyString("token")}`
            );

            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let record_id = req.bodyString("token");

            let find = await subs_plan_model.selectOneDynamic(
                "*",
                { ref_no: record_id },
                "subs_plans"
            );
            const uid = new ShortUniqueId({
                length: 10,
            });
            
            
            let mode = "live";
            let status = "PENDING";
            let token_payload = {
                order_id: order_id,
                amount: amount,
                currency: find.plan_currency,
                return_url: process.env.PAYMENT_URL + "status",
                env: mode,
                merchant_id: find.submerchant_id,
            };
            let token = accessToken(token_payload);
            
            let ins_body = {
                action: "SALE",
                merchant_id: find.submerchant_id,
                payment_id: "",
                super_merchant: find.merchant_id,
                customer_name: req.bodyString("name"),
                customer_email: req.bodyString("email"),
                customer_code: req.bodyString("mobile_code"),
                customer_mobile: req.bodyString("mobile_no"),
                billing_address_line_1: req.bodyString("address"),
                billing_address_line_2: "",
                billing_city: req.bodyString("city"),
                billing_pincode: "",
                billing_province: "",
                billing_country: req.bodyString("country"),
                shipping_address_line_1: "",
                shipping_address_line_2: "",
                shipping_city: "",
                shipping_country: "",
                shipping_province: "",
                shipping_pincode: "",
                description: find.plan_description,
                // amount: find.plan_billing_amount,
                amount: amount,
                currency: find.plan_currency,
                return_url: process.env.PAYMENT_URL + "status",
                success_url: process.env.PAYMENT_URL + "status",
                failure_url: process.env.PAYMENT_URL + "status",
                cancel_url: process.env.PAYMENT_URL + "status",
                status: status,
                origin: "Subscription",
                order_id: order_id,
                browser: client.browser,
                ip: client.ip,
                os: client.os,
                created_at: created_at,
                updated_at: updated_at,
            };
            logs.push(
                `${moment().format("DD/MM/YYYY HH:mm:ss.SSS")} : mode ${mode}`
            );

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : subs_plan_model.selectOneDynamic ${JSON.stringify({
                    email: req.bodyString("email"),
                    plan_id: find.id,
                })}`
            );

            let qr_ins_body = {
                merchant_id: find.submerchant_id,
                order_no: order_id,
                payment_status: status,
                subs_email: req.bodyString("email"),
                mode_of_payment: "",
                remark: "",
                super_merchant: find.merchant_id,
                added_date: created_at,
                transaction_date: created_at,
                plan_id: find.id,
            };
            
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : already_subscribe is true`
            );
            qr_ins_body.subscription_id = enc_dec.cjs_decrypt(req.bodyString("subscription_token"));

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.addDynamic with data ${JSON.stringify(
                    qr_ins_body
                )}`
            );

            let add_qr_data = await merchantOrderModel.addDynamic(
                qr_ins_body,
                "subs_payment"
            );
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : merchantOrderModel.add with data ${JSON.stringify(ins_body)}`
            );

            let result = merchantOrderModel
                .add(ins_body, mode);

            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : response received ${JSON.stringify(result)}`
            );
            
            let res_order_details = {
                status: status,
                message: "Order created",
                token: token,
                order_id: order_id,
                amount: find.plan_currency + " " + amount,
                // find.initial_payment_amount.toFixed(2),
                payment_link:
                    process.env.PAYMENT_URL +
                    "initiate/" +
                    order_id +
                    "/" +
                    token,
            };

            
            let logs_payload = {
                order_id: order_id,
                activity: JSON.stringify(logs),
            };

            let log_is = await order_logs.add(logs_payload, "order_logs");
           
            return res.status(statusCode.ok).send(res_order_details);

        } catch (error) {
            winston.error(error);
            
            logs.push(
                `${moment().format(
                    "DD/MM/YYYY HH:mm:ss.SSS"
                )} : received error ${error.message}`
            );
            let logs_payload = {
                order_id: order_id,
                activity: JSON.stringify(logs),
            };
            let log_is = await order_logs.add(logs_payload, "order_logs")
        
            return res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    }
}

module.exports = subscription_card_expired;