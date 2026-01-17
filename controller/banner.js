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
      const ins_body = {
        page_name: req.bodyString("page_name"),
        slug: req.bodyString("slug"),
        status: req.bodyString("status") || "Active",
        file_name: req.file.filename,
      };

      await helpers.common_add(ins_body, "banners");

      await admin_activity_logger.add(
        {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Banner Management",
        },
        "Banner Management",
        req.headers
      );

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Banner added successfully."));
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Internal server error"));
    }
  },

  list: async (req, res) => {
    try {
      let image_path = process.env.STATIC_URL + "/static/images/";

      let limit = {
        perpage: 0,
        start: 0,
      };

      const perpageRaw = req.bodyString("perpage");
      const pageRaw = req.bodyString("page");

      if (perpageRaw && pageRaw) {
        let perpage = parseInt(perpageRaw);
        let start = parseInt(pageRaw);

        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      let filter_arr = {};

      if (req.bodyString("page_name")) {
        filter_arr.page_name = req.bodyString("page_name");
      }

      const actorRaw = req.body?.actor;

      if (actorRaw !== undefined && actorRaw !== null && actorRaw !== "") {
        filter_arr.actor = Number(actorRaw);
      }

      BannerModel.select(filter_arr, limit)
        .then(async (result) => {
          let send_res = [];

          if (Array.isArray(result)) {
            result.forEach((val) => {
              send_res.push({
                banner_id: enc_dec.cjs_encrypt(val.id),
                id: val.id,
                page_name: val.page_name,
                slug: val.slug,
                actor: val.actor,
                banner_image: val.file_name ? image_path + val.file_name : "",
                status: val.status,
                updated_at: val.updated_at,
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
      let image_path = process.env.STATIC_URL + "/static/images/";
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

                // ✅ FULL IMAGE URL
                banner_image: val.file_name ? image_path + val.file_name : "",

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
      const banner_id = enc_dec.cjs_decrypt(req.bodyString("banner_id"));

      // DB safety check (must stay)
      const oldBanner = await BannerModel.selectOne("id,file_name", {
        id: banner_id,
      });
      console.log(req);

      if (!oldBanner) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Record not found"));
      }

      let insdata = {
        page_name: req.bodyString("page_name"),
      };

      if (req.file) {
        insdata.file_name = req.file.filename;

        // delete old image
        const fs = require("fs");
        const path = require("path");
        const oldPath = path.join(
          process.cwd(),
          "public/images",
          oldBanner.file_name
        );

        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await BannerModel.updateDetails({ id: banner_id }, insdata);

      await admin_activity_logger.edit(
        {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Banner Management",
        },
        banner_id,
        req.headers
      );

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Banner updated successfully"));
    } catch (error) {
      logger.error(500, { message: error.message, stack: error.stack });
      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Internal server error"));
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
            module: "Settings",
            sub_module: "Banner Management",
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
