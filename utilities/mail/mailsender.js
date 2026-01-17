const nodemailer = require("nodemailer");
const inlineBase64 = require("nodemailer-plugin-inline-base64");
require("dotenv").config({ path: "../../.env" });
const helpers = require("../helper/general_helper");
const logger = require("../../config/logger");
var html_to_pdf = require("html-pdf-node");

const server_addr = process.env.STATIC_URL;
const port = process.env.SERVER_PORT;

var mailSender = {
  // Welcome Mail - Merchant
  welcomeMail: async (mail, url) => {
    let transporterAndCompanyDetails = await getTransporterDetails();
    let smtp_details = transporterAndCompanyDetails.smtp_details;
    let title = await helpers.get_title();
    let transporter = transporterAndCompanyDetails.transporter;
    let template = await helpers.getSingleMailTemplate("welcomeMailMerchant");
    console.log("URL:", url);
    if (!template) {
      throw new Error("Mail template not found");
    }

    let image_path = server_addr + "/static/images/";
    let logo = image_path + smtp_details.company_logo;
    
    let staticVars = { title, logo };
    let dynamicVars = { url };

    let finalSubject = await helpers.replaceStaticAndDynamicVars(
      template.subject,
      template,
      staticVars,
      dynamicVars
    );

    let finalHtml = await helpers.replaceStaticAndDynamicVars(
      template.template,
      template,
      staticVars,
      dynamicVars
    );

    let info = await transporter.sendMail({
      from: smtp_details.smtp_from,
      to: mail,
      subject: finalSubject,
      html: finalHtml,
    });
  },

  // Welcome Mail - Referral
  welcomeMailRef: async (mail, url) => {
    try {
      console.log("➡️ Referral URL:", url);

      let transporterAndCompanyDetails = await getTransporterDetails();

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("welcomeMailRef");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;

      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = { url };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [welcomeMailRef] Mail sent successfully");
    } catch (error) {
      console.error("error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "welcomeMailRef",
      });
    }
  },

  // Forgot Password Mail
  forgotMail: async (mail, url) => {
    try {
      console.log("➡️ Reset URL:", url);

      let transporterAndCompanyDetails = await getTransporterDetails();
      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      let template = await helpers.getSingleMailTemplate("forgotMail");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };

      let dynamicVars = {
        url: url,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [forgotMail] Mail sent successfully");
    } catch (error) {
      console.error("Error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "forgotMail",
      });
    }
  },

  // Forgot 2FA Mail
  forgot2fa: async (mail, url) => {
    try {
      console.log("➡️ 2FA Reset URL:", url);

      let transporterAndCompanyDetails = await getTransporterDetails();
      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      let template = await helpers.getSingleMailTemplate("forgot2fa");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = { url };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalSubject = `${templateSubject}`;
      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [forgot2fa] Mail sent successfully");
    } catch (error) {
      console.error("❌ [forgot2fa] Error occurred");

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "forgot2fa",
      });
    }
  },

  // Forgot Password - Admin
  forgotAdminMail: async (mail, data) => {
    try {
      console.log("➡️ Admin Data:", data);

      let transporterAndCompanyDetails = await getTransporterDetails();
      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("forgotAdminMail");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        url: data.url,
        name: data.name,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: templateSubject,
        html: finalHtml,
      });

      console.log("✅ [forgotAdminMail] Mail sent successfully");
    } catch (error) {
      console.error("error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "forgotAdminMail",
      });
    }
  },

  // PSP Mail
  PSPMail: async (mail, mail_cc, reference, table, para) => {
    try {
      console.log("📧 [PSPMail] Started");
      console.log("➡️ To Mail:", mail);
      console.log("➡️ CC Mail:", mail_cc);
      console.log("➡️ reference Suffix:", reference);

      let transporterAndCompanyDetails = await getTransporterDetails();
      console.log("✅ Transporter & SMTP details fetched");

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate("PSPMail");
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        table,
        para,
        reference
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalSubject = templateSubject;
      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        cc: mail_cc,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [PSPMail] Mail sent successfully");
    } catch (error) {
      console.error("error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "PSPMail",
      });
    }
  },

  // OTP Mail
  otpMail: async (mail, otp) => {
    try {
      console.log("➡️ OTP Provided:", otp ? "YES" : "NO");

      let transporterAndCompanyDetails = await getTransporterDetails();

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("otpMail");
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = { data: otp };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalSubject = templateSubject;

      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [otpMail] Mail sent successfully");
    } catch (error) {
      console.error("Email", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "otpMail",
      });
    }
  },

  // eKYC Owners Mail
  ekycOwnersMail: async (mail, url) => {
    try {
      console.log("➡️ eKYC URL:", url);

      let transporterAndCompanyDetails = await getTransporterDetails();
      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;
      let title = await helpers.get_title();
      let template = await helpers.getSingleMailTemplate("ekycOwnersMail");
      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = { url };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalSubject = templateSubject;

      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [ekycOwnersMail] Mail sent successfully");
    } catch (error) {
      console.error("❌ [ekycOwnersMail] Error occurred");
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "ekycOwnersMail",
      });
    }
  },

  // Invoice Mail
  InvoiceMail: async (data) => {
    try {
      console.log("📧 [InvoiceMail] Started");
      console.log("➡️ To Mail:", data.mail_to);
      console.log("➡️ CC Mail:", data.mail_cc);
      console.log("➡️ Subject:", data.subject);
      console.log(
        "➡️ Invoice No:",
        data?.invoice?.invoice_details?.merchant_invoice_no
      );

      let transporterAndCompanyDetails = await getTransporterDetails();
      console.log("✅ Transporter & SMTP details fetched");

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      transporter.use("compile", inlineBase64({ cidPrefix: "somePrefix_" }));
      console.log("🧩 inlineBase64 middleware attached");

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate("InvoiceMail");
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details?.company_logo;
      console.log("🖼️ Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {}; // extend later if needed

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Final Subject (template):", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      console.log("📄 Generating invoice PDF...");
      let invoice_pdf_buffer = await generateInvoicePdf(finalHtml);
      console.log(
        "✅ Invoice PDF generated (size):",
        invoice_pdf_buffer?.length
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.mail_to,
        cc: data.mail_cc,
        subject: data.subject || finalSubject,
        html: finalHtml,
        attachments: [
          {
            filename: `Merchant Invoice Ref. ${data.invoice.invoice_details.merchant_invoice_no}.pdf`,
            content: invoice_pdf_buffer,
            contentType: "application/pdf",
          },
        ],
      });

      console.log("✅ [InvoiceMail] Mail sent successfully");
    } catch (error) {
      console.error("❌ [InvoiceMail] Error occurred");
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "InvoiceMail",
      });
    }
  },

  // Payment Mail
  PaymentMail: async (data) => {
    try {
      console.log("📧 [PaymentMail] Started");
      console.log("➡️ To Mail:", data.mail_to);
      console.log("➡️ CC Mail:", data.mail_cc);
      console.log("➡️ Subject:", data.subject);
      console.log("➡️ Amount:", data.amount, data.currency);

      let transporterAndCompanyDetails = await getTransporterDetails();
      console.log("✅ Transporter & SMTP details fetched");

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      transporter.use("compile", inlineBase64({ cidPrefix: "somePrefix_" }));
      console.log("🧩 inlineBase64 middleware attached");

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate("PaymentMail");
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Platform Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        merchant_name: data.merchant_name,
        merchant_logo: data.merchant_logo,
        qr_image: data.qr_image,
        amount: data.amount,
        currency: data.currency,
        pay_url: data.pay_url,
        message_text: data.message_text,
        pp_url: data.pp_url,
        tc_url: data.tc_url,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalSubject = templateSubject;

      console.log("✉️ Final Subject:", finalSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.mail_to,
        cc: data.mail_cc,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [PaymentMail] Mail sent successfully");
    } catch (error) {
      console.error("❌ [PaymentMail] Error occurred");
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "PaymentMail",
      });
    }
  },

  // Customer Transaction Mail
  CustomerTransactionMail: async (data) => {
    try {

      let transporterAndCompanyDetails = await getTransporterDetails();
      console.log("✅ Transporter & SMTP details fetched");

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate(
        "CustomerTransactionMail"
      );
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Platform Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        logo: data.logo,
        company_name: data.company_name,
        currency: data.currency,
        amount: data.amount,
        order_id: data.order_id,
        payment_id: data.payment_id,
        status: data.status,
        payment_mode: data.payment_mode,
        card_sub: data.card_sub,
        updated_at: data.updated_at,
        customer_name: data.customer_name,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Template Subject:", templateSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.customer_email,
        subject: templateSubject || "Transaction Receipt",
        html: finalHtml,
      });

    } catch (error) {
      console.error("Error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "CustomerTransactionMail",
      });
    }
  },

  // Merchant Transaction Mail
  MerchantTransactionMail: async (data) => {
    try {

      let transporterAndCompanyDetails = await getTransporterDetails();

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate(
        "MerchantTransactionMail"
      );
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Platform Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        logo: data.logo,
        company_name: data.company_name,
        customer_name: data.customer_name,
        currency: data.currency,
        amount: data.amount,
        order_id: data.order_id,
        payment_id: data.payment_id,
        status: data.status,
        payment_mode: data.payment_mode,
        card_sub: data.card_sub,
        updated_at: data.updated_at,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Template Subject:", templateSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.co_email,
        subject: templateSubject,
        html: finalHtml,
      });

      console.log("✅ [MerchantTransactionMail] Mail sent successfully");
    } catch (error) {
      console.error("error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "MerchantTransactionMail",
      });
    }
  },

  // Referral Bonus Settled Mail
  ReferralBonusSettledMail: async (to_email, mailData) => {
    try {
      let transporterAndCompanyDetails = await getTransporterDetails();
      console.log("✅ Transporter & SMTP details fetched");

      let smtp_details = transporterAndCompanyDetails.smtp_details;
      let transporter = transporterAndCompanyDetails.transporter;

      let title = await helpers.get_title();
      console.log("✅ Mail title fetched:", title);

      let template = await helpers.getSingleMailTemplate(
        "ReferralBonusSettledMail"
      );
      console.log("📄 Mail template result:", template ? "FOUND" : "NOT FOUND");

      if (!template) {
        throw new Error("Mail template not found");
      }

      let image_path = server_addr + "/static/images/";
      let logo = image_path + smtp_details.company_logo;
      console.log("🖼️ Platform Logo URL:", logo);

      let staticVars = { title, logo };
      let dynamicVars = {
        currency: mailData.currency,
        amount: mailData.amount,
        order_id: mailData.order_id,
        status: mailData.status,
        full_name: mailData.full_name,
      };

      console.log("🔧 Static Vars:", staticVars);
      console.log("🔧 Dynamic Vars:", dynamicVars);

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );
      console.log("✉️ Template Subject:", templateSubject);

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );
      console.log("🧾 Final HTML generated (length):", finalHtml?.length);

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: to_email,
        subject: templateSubject,
        html: finalHtml,
      });

      console.log("✅ [ReferralBonusSettledMail] Mail sent successfully");
    } catch (error) {
      console.error("error:", error);

      logger.error(500, {
        message: error.message,
        stack: error?.stack,
        function: "ReferralBonusSettledMail",
      });
    }
  },

  // Subscription Plan Mail
  subs_plan_mail: async (data) => {
    try {
      console.log("📧 [subs_plan_mail] Started");
      console.log("➡️ To:", data.mail_to);
      console.log("➡️ Subject:", data.subject);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("subs_plan_mail");
      console.log("📄 Template:", template ? "FOUND" : "NOT FOUND");
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { ...data };

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.mail_to,
        cc: data.mail_cc,
        subject: data.subject || templateSubject,
        html: finalHtml,
      });

      console.log("✅ [subs_plan_mail] Sent");
    } catch (error) {
      console.error("❌ [subs_plan_mail]", error.message);
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  // Welcome Mail - Admin
  welcomeMailAdmin: async (mail, subject, url) => {
    try {
      console.log("📧 [welcomeMailAdmin] Started", mail);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("welcomeMailAdmin");
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { url };

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: `${title} - ${subject || templateSubject}`,
        html: finalHtml,
      });

      console.log("✅ [welcomeMailAdmin] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  // Activation Mail
  activationMail: async (mail, subject, url) => {
    try {
      console.log("📧 [activationMail] Started", mail);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("activationMail");
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { url };

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: mail,
        subject: `${title} - ${subject || templateSubject}`,
        html: finalHtml,
      });

      console.log("✅ [activationMail] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  CardExpiryMail: async (data) => {
    try {
      console.log("📧 [CardExpiryMail] Started", data.mail_to);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("CardExpiryMail");
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = {
        user_name: data.user_name || "Customer",
        expiry_date: data.expiry_date || "",
        payHtml: data.payHtml || "",
      };

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.mail_to,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [CardExpiryMail] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  CardExpiryMailToMerchant: async (data) => {
    try {
      console.log("📧 [CardExpiryMailToMerchant] Started", data.email);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate(
        "CardExpiryMailToMerchant"
      );
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { html: data.html, payHtml: data.payHtml || "" };

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.email,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [CardExpiryMailToMerchant] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  CardExpiryMailToCustomer: async (data) => {
    try {
      console.log("📧 [CardExpiryMailToCustomer] Started", data.customer_email);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate(
        "CardExpiryMailToCustomer"
      );
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { html: data.html, payHtml: data.payHtml || "" };

      let finalSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.customer_email,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [CardExpiryMailToCustomer] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },

  // Referral Mail
  referral_mail: async (data) => {
    try {
      console.log("📧 [referral_mail] Started", data.mail_to);

      let { smtp_details, transporter } = await getTransporterDetails();
      let title = await helpers.get_title();

      let template = await helpers.getSingleMailTemplate("referral_mail");
      if (!template) throw new Error("Mail template not found");

      let logo = `${server_addr}/static/images/${smtp_details.company_logo}`;

      let staticVars = { title, logo };
      let dynamicVars = { ...data };

      let templateSubject = await helpers.replaceStaticAndDynamicVars(
        template.subject,
        template,
        staticVars,
        dynamicVars
      );

      let finalHtml = await helpers.replaceStaticAndDynamicVars(
        template.template,
        template,
        staticVars,
        dynamicVars
      );

      await transporter.sendMail({
        from: smtp_details.smtp_from,
        to: data.mail_to,
        subject: finalSubject,
        html: finalHtml,
      });

      console.log("✅ [referral_mail] Sent");
    } catch (error) {
      logger.error(500, { message: error.message, stack: error?.stack });
    }
  },
};

async function generateInvoicePdf(htmlContent) {
  let file = { content: htmlContent };
  let options = {};
  let pdfBuffer = await html_to_pdf.generatePdf(file, options);
  return pdfBuffer;
}

module.exports = mailSender;

async function getTransporterDetails() {
  let smtp_details = await helpers.company_details({ id: 1 });
  let nodeMailerObj = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: smtp_details.smtp_username,
      pass: smtp_details.smtp_password,
    },
    requireTLS: true,
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3",
      ciphers: [
        "TLS_AES_256_GCM_SHA384",
        "TLS_AES_128_GCM_SHA256",
        "ECDHE-RSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES128-GCM-SHA256",
      ].join(":"),
      honorCipherOrder: true,
      requestOCSP: true,
    },
  });

  return { transporter: nodeMailerObj, smtp_details };
}
