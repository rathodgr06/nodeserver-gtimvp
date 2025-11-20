const env = process.env.ENVIRONMENT;
const moment = require('moment');
const envconfig = require("../config/config.json")[env];
const pool = require('../config/database');
const mailSender = require("../utilities/mail/mailsender");
const logger = require('../config/logger');
sendMail = async (data) => {
    let qb = await pool.get_connection();
    
    let merchant_and_customer_transaction_response;
    try {
        merchant_and_customer_transaction_response = await qb
            .select(
                "md.company_name,mm.email as co_email,mm.logo,o.order_id,o.payment_id,o.customer_name,o.customer_email,o.currency,o.amount,o.card_no,o.payment_mode,o.status,o.updated_at"
            )
            .from(envconfig.table_prefix + data.order_table + " o")
            .join(
                envconfig.table_prefix + "master_merchant_details md",
                "o.merchant_id=md.merchant_id",
                "inner"
            )
            .join(
                envconfig.table_prefix + "master_merchant mm",
                "o.merchant_id=mm.id",
                "inner"
            )
            .where({
                "o.order_id": data.order_id,
            })
            .get();
        //console.log('merchant_and_customer_transaction_response', merchant_and_customer_transaction_response)
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        console.error("Database query failed:", error);
    } finally {
        qb.release();
    }
    //console.log('merchant_and_customer_transaction_response', merchant_and_customer_transaction_response)
    let mail_details = merchant_and_customer_transaction_response?.[0];
    mail_details.logo = mail_details.logo
        ? process.env.STATIC_URL + "/static/files/" + mail_details.logo
        : "";
    let transaction_date_time = new Date(mail_details.updated_at);
    mail_details.updated_at = moment(transaction_date_time).format(
        "DD-MM-YYYY HH:mm"
    );
    let mail_response = await mailSender.CustomerTransactionMail(
        mail_details
    );
    let merchant_mail_response = await mailSender.MerchantTransactionMail(
        mail_details
    );
}

module.exports = sendMail;