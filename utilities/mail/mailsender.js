const nodemailer = require("nodemailer");
const inlineBase64 = require("nodemailer-plugin-inline-base64");
require("dotenv").config({ path: "../../.env" });
const welcome_template = require("../mail-template/welcome");
const welcome_template_admin = require("../mail-template/welcome_admin");
const welcome_template_referrer = require("../mail-template/welcome_referrer");
const forgot_template = require("../mail-template/forget");
const forgot_admin_template = require("../mail-template/forget_admin");
const PSPMail_template = require("../mail-template/PSPMail");
const otp_mail_template = require("../mail-template/otp_sent_mail");
const owners_ekyc_template = require("../mail-template/ownersMail");
const invoice_mail = require("../mail-template/invoice_mail");
const helpers = require("../helper/general_helper");
const payment_mail = require("../mail-template/payment_mail");
const subs_plan_mail = require("../mail-template/subs_plan_mail");
const customer_transaction_mail = require("../mail-template/customer_transaction_mail");
const merchant_transaction_mail = require("../mail-template/merchant_transaction_mail");
const forgot2fa_template = require("../mail-template/forget_2fa");
const referral_bonus_mail = require("../mail-template/referral_bonus_mail");
const invoice_mail_new = require("../mail-template/invoice_mail_new");
const referral_invoice_mail = require("../mail-template/referral_invoice_mail");
const activation_mail = require("../mail-template/activation_mail");
require("dotenv").config({ path: "../../.env" });
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
var html_to_pdf = require('html-pdf-node');
const card_expiry = require("../mail-template/card_expiry");
const logger = require('../../config/logger');

var mailSender = {
    welcomeMail: async (mail, subject, url) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        console.log(`transporter`)
        console.log(transporter);
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: welcome_template({ url: url }, logo, title), // html body
        });
        console.log(`info`)
        console.log(info);
    },
    welcomeMailRef: async (mail, subject, url) => {
        let transporterAndCompanyDetails = await getTransporterDetails();

        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: welcome_template_referrer({ url: url }, logo, title), // html body
        });
    },
    forgotMail: async (mail, subject, url) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;

        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: forgot_template({ url: url }, logo, title), // html body
        });
    },
    forgot2fa: async (mail, subject, url) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;

        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: forgot2fa_template({ url: url }, logo, title), // html body
        });
    },

    forgotAdminMail: async (mail, subject, data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: forgot_admin_template(data, logo, title), // html body
        });
    },

    PSPMail: async (mail, mail_cc, subject, table, para) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details =transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            cc: mail_cc,
            subject: title + " - " + subject, // Subject line
            html: PSPMail_template({ table: table }, logo, title, para), // html body
        });
    },
    otpMail: async (mail, subject, otp) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: otp_mail_template(otp, logo, title), // html body
        });
        
        
    },
    ekycOwnersMail: async (mail, subject, url) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr+ "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: owners_ekyc_template({ url: url }, logo, title), // html body
        });
    },

    InvoiceMail: async (data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        transporter.use("compile", inlineBase64({ cidPrefix: "somePrefix_" }));
        let image_path = server_addr+ "/static/images/";
        let logo = image_path + smtp_details?.company_logo;
        let invoice_pdf_buffer = await generateInvoicePdf(
            invoice_mail_new(data, logo, title)
        );
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.mail_to, // list of receivers
            cc: data.mail_cc,
            subject: data.subject, // Subject line
            html: invoice_mail_new(data, logo, title),
            attachments: [
                {
                    filename: `Merchant Invoice Ref. ${data.invoice.invoice_details.merchant_invoice_no}.pdf`,
                    content: invoice_pdf_buffer,
                    contentType: "application/pdf",
                },
            ],
            // html body
        });
    },

    PaymentMail: async (data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter =transporterAndCompanyDetails.transporter;
        transporter.use("compile", inlineBase64({ cidPrefix: "somePrefix_" }));
        let image_path = server_addr  + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.mail_to, // list of receivers
            cc: data.mail_cc,
            subject: data.subject, // Subject line
            html: payment_mail(data, logo, title), // html body
        });
    },

    CustomerTransactionMail: async (data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr+ "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.customer_email, // list of receivers
            subject: "Transaction Receipt", // Subject line
            html: customer_transaction_mail(data, logo, title), // html body
        });
    },
    MerchantTransactionMail: async (data) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.co_email, // list of receivers
            subject: "Transaction Details", // Subject line
            html: merchant_transaction_mail(data, logo, title), // html body
        });
    },

    ReferralBonusSettledMail: async (to_email, mailData) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details =transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr  + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: to_email, // list of receivers
            subject: "Referral Bonus Settlement Confirmation", // Subject line
            html: referral_bonus_mail(title, logo, mailData), // html body
        });

        
    },

    subs_plan_mail: async (data) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details = transporterAndCompanyDetails.smtp_details
        
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr  + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.mail_to, // list of receivers
            cc: data.mail_cc,
            subject: data.subject, // Subject line
            html: subs_plan_mail(data, logo, title), // html body
        });
    },

    welcomeMailAdmin: async (mail, subject, url) => {
        let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details =transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr  + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: welcome_template_admin({ url: url }, logo, title), // html body
        });
    },
    activationMail: async (mail, subject, url) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details =transporterAndCompanyDetails.smtp_details;
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail, // list of receivers
            subject: title + " - " + subject, // Subject line
            html: activation_mail({ url: url }, logo, title), // html body
        });
    },

    CardExpiryMail: async (data) => {
        try {
          let transporterAndCompanyDetails = await getTransporterDetails();
          let smtp_details = transporterAndCompanyDetails.smtp_details;

          let title = await helpers.get_title();
          let transporter = transporterAndCompanyDetails.transporter;
          let image_path = server_addr + "/static/images/";
          let logo = image_path + smtp_details.company_logo;
          let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.mail_to, // list of receivers
            subject: "Card will expire soon.", // Subject line
            html: "please change your payment method. Card will expire soon. Thanks.", // html body
          });
        } catch (error) {
          logger.error(500, { message: error, stack: error?.stack });
        }
    },
    CardExpiryMailToMerchant: async (data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        try {
          let mail_to = data.email;
          let subject = data.subject;
          let smtp_details = transporterAndCompanyDetails.smtp_details;

          let title = await helpers.get_title();
          let transporter = transporterAndCompanyDetails.transporter;
          let image_path = server_addr + "/static/images/";
          let logo = image_path + smtp_details.company_logo;
          let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail_to, // list of receivers
            subject: subject, // Subject line
            html: card_expiry(data, logo, title), // html body
          });
        } catch (error) {
          logger.error(500, { message: error, stack: error?.stack });
        }
    },
    CardExpiryMailToCustomer: async (data) => {
        try {
          let transporterAndCompanyDetails = await getTransporterDetails();
          let mail_to = data.customer_email;
          let smtp_details = transporterAndCompanyDetails.smtp_details;

          let title = await helpers.get_title();
          let transporter = transporterAndCompanyDetails.transporter;
          let image_path = server_addr + "/static/images/";
          let logo = image_path + smtp_details.company_logo;
          let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: mail_to, // list of receivers
            subject: data.subject, // Subject line
            html: card_expiry(data, logo, title), // html body
          });
        } catch (error) {
          logger.error(500, { message: error, stack: error?.stack });
        }
    },
    referral_mail: async (data) => {
         let transporterAndCompanyDetails = await getTransporterDetails();
        let smtp_details =transporterAndCompanyDetails.smtp_details;
        
        let title = await helpers.get_title();
        let transporter = transporterAndCompanyDetails.transporter;
        let image_path = server_addr + "/static/images/";
        let logo = image_path + smtp_details.company_logo;
        let info = await transporter.sendMail({
            from: smtp_details.smtp_from, // sender address
            to: data.mail_to, // list of receivers
            subject: data.subject, // Subject line
            html: referral_invoice_mail(title, logo, data), // html body
           
        });
        
    },
};

async function generateInvoicePdf(htmlContent) {
    let file = { content: htmlContent };
    let options = {  };
    let pdfBuffer =await html_to_pdf.generatePdf(file, options);
    return pdfBuffer;
}
module.exports = mailSender;

async function getTransporterDetails(){
     let smtp_details = await helpers.company_details({ id: 1 });
    let nodeMailerObj =  nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: smtp_details.smtp_username, // generated ethereal user
                pass: smtp_details.smtp_password, // generated ethereal password
            },
            // SECURITY: Enhanced TLS configuration
            requireTLS: true,
            tls: {
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3', // Allow TLS 1.3 if available
                ciphers: [
                    'TLS_AES_256_GCM_SHA384', // TLS 1.3
                    'TLS_AES_128_GCM_SHA256', // TLS 1.3
                    'ECDHE-RSA-AES256-GCM-SHA384', // TLS 1.2
                    'ECDHE-RSA-AES128-GCM-SHA256'  // TLS 1.2
                ].join(':'),
                honorCipherOrder: true,
                // SECURITY: Enable OCSP stapling if supported
                requestOCSP: true
            },
            
        });

        return {transporter:nodeMailerObj,smtp_details:smtp_details};
}
