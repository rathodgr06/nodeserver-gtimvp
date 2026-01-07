const BannerModel = require("../models/bannerModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const logger = require("../config/logger");

var resp = {

  add: async (req, res) => {
    try {
      const pageName = req.bodyString("page_name");
      const slug = req.bodyString("slug");

      if (!pageName || !slug) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("page_name and slug are required"));
      }

      if (!req.all_files || !req.all_files.banner_image) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Banner image is required"));
      }

      const ins_body = {
        page_name: pageName,
        slug: slug,
        status: req.bodyString("status") || "Active",
        file_name: req.all_files.banner_image,
      };

      await helpers.common_add(ins_body, "banners");
      const module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Banner Management",
      };

      await admin_activity_logger.add(module_and_user, "Banner Management", req.headers);
      return res
        .status(statusCode.ok)
        .send(response.successmsg("Banner added successfully."));
    } catch (error) {
      console.log(error);
      logger.error(500, {
        message: error.message || error,
        stack: error.stack,
      });

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message || "Internal server error"));
    }
  },

  list: async (req, res) => {
    try {
      let limit = {
        perpage: 0,
        start: 0,
      };

      if (req.bodyString("perpage") && req.bodyString("page")) {
        let perpage = parseInt(req.bodyString("perpage"));
        let start = parseInt(req.bodyString("page"));

        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      let filter_arr = {};
      if (req.bodyString("page_name")) {
        filter_arr.page_name = req.bodyString("page_name");
      }

      BannerModel.select(filter_arr, limit)
        .then(async (result) => {
          let send_res = [];

          if (Array.isArray(result)) {
            result.forEach((val) => {
              send_res.push({
                banner_id: enc_dec.cjs_encrypt(val.id),
                page_name: val.page_name,
                slug: val.slug,
                file_name: val.file_name,
                status: val.status,
              });
            });
          }

          let total_count = await BannerModel.get_count(filter_arr);

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
              )
            );
        })
        .catch((error) => {
          logger.error(500, { message: error, stack: error.stack });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  details: async (req, res) => {
    try {
      let banner_id = enc_dec.cjs_decrypt(req.bodyString("banner_id"));

      BannerModel.selectOne("id,page_name,slug,file_name,status", {
        id: banner_id,
      })
        .then((val) => {
          if (!val) {
            return res
              .status(statusCode.badRequest)
              .send(response.errormsg("Record not found"));
          }

          res.status(statusCode.ok).send(
            response.successdatamsg(
              {
                banner_id: enc_dec.cjs_encrypt(val.id),
                page_name: val.page_name,
                slug: val.slug,
                file_name: val.file_name,
                status: val.status,
              },
              "Details fetched successfully."
            )
          );
        })
        .catch((error) => {
          logger.error(500, { message: error, stack: error.stack });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  update: async (req, res) => {
    try {
      let banner_id = enc_dec.cjs_decrypt(req.bodyString("banner_id"));

      let insdata = {
        page_name: req.bodyString("page_name"),
        slug: req.bodyString("slug"),
        status: req.bodyString("status"),
      };

      // get updated banner file (same pattern as add)
      if (req.all_files && req.all_files.banner_image) {
        insdata.file_name = req.all_files.banner_image;
      }

      await BannerModel.updateDetails({ id: banner_id }, insdata);

      admin_activity_logger
        .edit(
          {
            user: req.user.id,
            admin_type: req.user.type,
            module: "Banner Management",
            sub_module: "Auth Pages",
          },
          banner_id,
          req.headers
        )
        .then(() => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Banner updated successfully"));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  delete: async (req, res) => {
    try {
      let banner_id = enc_dec.cjs_decrypt(req.bodyString("banner_id"));

      // Optional safety check
      const banner = await BannerModel.selectOne(["id"], { id: banner_id });
      if (!banner) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Banner not found"));
      }

      // Hard delete
      await BannerModel.deleteById({ id: banner_id });

      admin_activity_logger
        .delete(
          {
            user: req.user.id,
            admin_type: req.user.type,
            module: "Banner Management",
            sub_module: "Auth Pages",
          },
          banner_id,
          req.headers
        )
        .then(() => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Banner deleted successfully"));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  changeStatus: async (req, res) => {
    try {
      const banner_id = enc_dec.cjs_decrypt(req.bodyString("banner_id"));
      const status = req.bodyString("status"); // Active | Inactive

      /* =====================
       VALIDATE STATUS
    ===================== */
      if (!["Active", "Inactive"].includes(status)) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid status value"));
      }

      /* =====================
       CHECK BANNER EXISTS
    ===================== */
      const banner = await BannerModel.selectOne(["id", "status"], {
        id: banner_id,
      });

      if (!banner) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Banner not found"));
      }

      /* =====================
       UPDATE STATUS
    ===================== */
      await BannerModel.updateDetails({ id: banner_id }, { status });

      /* =====================
       ACTIVITY LOG (SAFE)
       ❗ WILL NOT BREAK API
    ===================== */
      try {
        if (
          admin_activity_logger &&
          typeof admin_activity_logger === "function"
        ) {
          await admin_activity_logger({
            user: req.user.id,
            admin_type: req.user.type,
            module: "Banner Management",
            sub_module: "Auth Pages",
            action: "CHANGE_STATUS",
            reference_id: banner_id,
            old_status: banner.status,
            new_status: status,
            headers: req.headers,
          });
        }
      } catch (logError) {
        logger.warn("Activity log failed", logError.message);
        // ❗ DO NOT throw
      }

      /* =====================
       SUCCESS RESPONSE
    ===================== */
      return res
        .status(statusCode.ok)
        .send(
          response.successmsg(`Banner ${status.toLowerCase()} successfully`)
        );
    } catch (error) {
      logger.error(500, {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

module.exports = resp;
