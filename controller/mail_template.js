const mailTemplateModel = require("../models/mailTemplateModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const logger = require("../config/logger");
const Preview = require("twilio/lib/rest/Preview");
const settingModel = require("../models/settingModel");
const static_url = process.env.STATIC_URL;

const resp = {
  // ADD
  add: async (req, res) => {
    try {
      const ins_body = {
        template_name: req.bodyString("template_name"),
        slug: req.bodyString("slug"),
        subject: req.bodyString("subject"),
        template: req.bodyString("template"),
        status: req.bodyString("status") || "0",
      };

      await mailTemplateModel.add(ins_body);

      await admin_activity_logger.add(
        {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Mail Template Management",
        },
        "Mail Template Management",
        req.headers
      );

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail template added successfully."));
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Internal server error"));
    }
  },

  // LIST
  list: async (req, res) => {
    try {
      let limit = { perpage: 0, start: 0 };

      const perpageRaw = req.bodyString("perpage");
      const pageRaw = req.bodyString("page");

      if (perpageRaw && pageRaw) {
        const perpage = Math.max(parseInt(perpageRaw, 10), 1);
        const page = Math.max(parseInt(pageRaw, 10), 1);

        limit.perpage = perpage;
        limit.start = (page - 1) * perpage;
      }

      let filter_arr = {};

      const templateName = req.bodyString("template_name");
      const subject = req.bodyString("subject");

      if (templateName) {
        filter_arr.template_name = templateName.trim();
      }

      if (subject) {
        filter_arr.subject = subject.trim();
      }
      const result = await mailTemplateModel.select(filter_arr, limit);

      const send_res = Array.isArray(result)
        ? result.map((val) => ({
            mail_template_id: enc_dec.cjs_encrypt(val.id),
            template_id: val.id,
            template_name: val.template_name,
            slug: val.slug,
            subject: val.subject,
            template: val.template,
            use_for: val.use_for,
            status: val.status,
            updated_at: val.updated_at,
          }))
        : [];
      const total_count = await mailTemplateModel.get_count(filter_arr);
      return res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            send_res,
            "List fetched successfully.",
            total_count
          )
        );
    } catch (error) {
      logger.error(500, {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong. Please try again."));
    }
  },

  // DETAILS
  detailsold: async (req, res) => {
    try {
      const mail_template_id = enc_dec.cjs_decrypt(
        req.bodyString("mail_template_id")
      );

      const val = await mailTemplateModel.selectOne(
        "id,template_name,slug,subject,template,status",
        { id: mail_template_id }
      );

      if (!val) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      return res.status(statusCode.ok).send(
        response.successdatamsg(
          {
            mail_template_id: enc_dec.cjs_encrypt(val.id),
            template_name: val.template_name,
            slug: val.slug,
            subject: val.subject,
            template: val.template,
            status: val.status,
          },
          "Details fetched successfully."
        )
      );
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  // DETAILS (STYLE ONLY)
  details: async (req, res) => {
    try {
      const mail_template_id = enc_dec.cjs_decrypt(
        req.bodyString("mail_template_id")
      );

      const val = await mailTemplateModel.selectOne(
        "id,template_name,slug,subject,template,status",
        { id: mail_template_id }
      );

      if (!val) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      // 🔹 FETCH CSS SETUP (THEME ONLY)
      const cssSetup = await settingModel.selectOneByTableAndCondition(
        "*",
        { id: 1 },
        "css_setup"
      );

      // 🔹 STYLE VARIABLES ONLY
      const styleVars = {
        button_background_color: cssSetup?.button_background_color || "#7367f0",
        button_border_color: cssSetup?.button_border_color || "#7367f0",
        button_text_color: cssSetup?.button_text_color || "#ffffff",
        button_font_name:
          cssSetup?.button_font_name || "Montserrat, Arial, sans-serif",
        button_font_size: cssSetup?.button_font_size || 14,
      };

      // 🔹 APPLY ONLY STYLE VARIABLES
      const styledTemplate = await helpers.applyPreviewVars(
        val.template,
        styleVars
      );

      return res.status(statusCode.ok).send(
        response.successdatamsg(
          {
            mail_template_id: enc_dec.cjs_encrypt(val.id),
            template_name: val.template_name,
            slug: val.slug,
            subject: val.subject,
            template: styledTemplate, // 🔥 styled template
            status: val.status,
          },
          "Details fetched successfully."
        )
      );
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  // UPDATE
  update: async (req, res) => {
    try {
      const mail_template_id = enc_dec.cjs_decrypt(
        req.bodyString("mail_template_id")
      );

      const oldTemplate = await mailTemplateModel.selectOne(["id"], {
        id: mail_template_id,
      });

      if (!oldTemplate) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      const insdata = {
        template_name: req.bodyString("template_name"),
        subject: req.bodyString("subject"),
        template: req.bodyString("template"),
      };

      console.log("insdata", insdata);
      await mailTemplateModel.updateDetails({ id: mail_template_id }, insdata);

      await admin_activity_logger.edit(
        {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Mail Template Management",
        },
        mail_template_id,
        req.headers
      );
      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail template updated successfully"));
    } catch (error) {
      console.log("🔥 Error during mail template update");
      console.log(error);

      logger.error(500, {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Internal server error"));
    }
  },

  // DELETE
  delete: async (req, res) => {
    try {
      const mail_template_id = enc_dec.cjs_decrypt(
        req.bodyString("mail_template_id")
      );

      const template = await mailTemplateModel.selectOne(["id"], {
        id: mail_template_id,
      });

      if (!template) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      await mailTemplateModel.deleteById({ id: mail_template_id });

      await admin_activity_logger.delete(
        {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Mail Template Management",
        },
        mail_template_id,
        req.headers
      );

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail template deleted successfully"));
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  // CHANGE STATUS
  changeStatus: async (req, res) => {
    try {
      console.log("req.body", req.body);

      const mail_template_id = enc_dec.cjs_decrypt(
        req.bodyString("mail_template_id")
      );
      const status = req.bodyString("status");

      const template = await mailTemplateModel.selectOne(["id", "status"], {
        id: mail_template_id,
      });

      if (!template) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      await mailTemplateModel.updateDetails(
        { id: mail_template_id },
        { status }
      );

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Status updated successfully"));
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  preview: async (req, res) => {
    try {
      const encryptedId = req.bodyString("mail_template_id");
      const mail_template_id = enc_dec.cjs_decrypt(encryptedId);

      const val = await mailTemplateModel.selectOne(
        "id, template_name, slug, subject, template, status",
        { id: mail_template_id }
      );

      if (!val) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      let smtp_details = {};
      try {
        smtp_details = await helpers.company_details({ id: 1 });
      } catch (err) {
        console.warn("company_details failed:", err.message);
      }

      const title = await helpers.get_title();

      const image_path = static_url ? `${static_url}/static/images/` : "";

      const logo = image_path + smtp_details.company_logo;
      console.log("lognbfvbndfjkgggnkkgerguerhgerhghgerjgheriugghuierguerhghrehghreo:", image_path);
      const cssSetup = await settingModel.selectOneByTableAndCondition(
        "*",
        { id: 1 },
        "css_setup"
      );

      const previewVars = {
        title,
        logo,

        button_background_color: cssSetup?.button_background_color,
        button_border_color: cssSetup?.button_border_color,
        button_text_color: cssSetup?.button_text_color,
        button_font_name: cssSetup?.button_font_name,
        button_font_size: cssSetup?.button_font_size,
      };

      const renderedSubject = await helpers.applyPreviewVars(
        val.subject,
        previewVars
      );

      const renderedTemplate = await helpers.applyPreviewVars(
        val.template,
        previewVars
      );

      return res.status(statusCode.ok).send(
        response.successdatamsg(
          {
            mail_template_id: enc_dec.cjs_encrypt(val.id),
            subject: renderedSubject,
            template: renderedTemplate,
          },
          "Preview generated successfully"
        )
      );
    } catch (error) {
      console.error(error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong. Please try again."));
    }
  },
};

module.exports = resp;
