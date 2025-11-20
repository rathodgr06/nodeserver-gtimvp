const LanguageModel = require("../models/language");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const moment = require("moment");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');
const nodeCache = require("../utilities/helper/CacheManeger");

var language = {
  add: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let language_name = req.bodyString("language");
    let direction = req.bodyString("direction");

    let ins_body = {
      name: language_name,
      direction: direction,
      file: req.all_files.file,
      flag: req.all_files.flag,
      added_date: added_date,
      ip: await helpers.get_ip(req),
      added_by: req.user.id,
    };
    LanguageModel.add(ins_body)
      .then((result) => {
        let module_and_user = {
          user: req.user.id,
          admin_type: req.user.type,
          module: "Settings",
          sub_module: "Language",
        };
        let added_name = req.bodyString("language");
        let headers = req.headers;
        admin_activity_logger
          .add(module_and_user, added_name, headers)
          .then(async (result) => {
            //Refresh Cache
            await nodeCache.reload();
            res
              .status(statusCode.ok)
              .send(response.successmsg("Added successfully."));
          })
          .catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack});
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let filter_arr = { deleted: 0 };

    if (req.bodyString("status") == "Active") {
      filter_arr.status = 0;
    }
    if (req.bodyString("status") == "Deactivated") {
      filter_arr.status = 1;
    }
    LanguageModel.select(filter_arr, limit)
      .then(async (result) => {
        let send_res = [];
        result.forEach(function (val, key) {
          let res = {
            language_id: enc_dec.cjs_encrypt(val.id),
            language: val.name,
            direction: val.direction,
            file: server_addr + "/static/language/" + val.file,
            flag: server_addr + "/static/language/" + val.flag,
            status: val.status ? "Deactivated" : "Active",
          };
          send_res.push(res);
        });
        total_count = await LanguageModel.get_count({ deleted: 0 });
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
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  details: async (req, res) => {
    let language = await nodeCache.getActiveLanguageById(
      req.bodyString("language_id")
    );
    if (language !== null) {
      let send_res = {
        language_id: language.language_id,
        language: language.name,
        direction: language.direction,
        file: language.file,
        flag: language.flag,
        status: language.status,
        content: language.data,
      };
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(send_res, "Details fetched successfully.")
        );
    } else {
      res.status(statusCode.ok).send(response.successdatamsg([], "Not found"));
    }

    // let language_id = await enc_dec.cjs_decrypt(req.bodyString("language_id"));
    // LanguageModel.selectOne("*", { id: language_id })
    //   .then(async (result) => {
    //     let send_res = [];
    //     let val = result;
    //     let res1 = {
    //       language_id: enc_dec.cjs_encrypt(val.id),
    //       language: val.name,
    //       direction: val.direction,
    //       file: server_addr + "/static/language/" + val.file,
    //       flag: server_addr + "/static/language/" + val.flag,
    //       status: val.status ? "Deactivated" : "Active",
    //       content: await helpers.get_language_json({ id: val.id }),
    //     };
    //     send_res = res1;

    //     res
    //       .status(statusCode.ok)
    //       .send(
    //         response.successdatamsg(send_res, "Details fetched successfully.")
    //       );
    //   })
    //   .catch((error) => {
    //     logger.error(500,{message: error,stack: error.stack}); 
    //     res
    //       .status(statusCode.internalError)
    //       .send(response.errormsg(error.message));
    //   });
  },
  update: async (req, res) => {
    try {
      let language_id = await enc_dec.cjs_decrypt(
        req.bodyString("language_id")
      );
      let language = req.bodyString("language");
      let direction = req.bodyString("direction");
      var insdata = {
        name: language,
        direction: direction,
      };

      if (req.all_files) {
        if (req.all_files.file) {
          insdata.file = req.all_files.file;
        }
        if (req.all_files.flag) {
          insdata.flag = req.all_files.flag;
        }
      }

      $ins_id = await LanguageModel.updateDetails({ id: language_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Language",
      };
      let headers = req.headers;
      admin_activity_logger
        .edit(module_and_user, language_id, headers)
        .then(async (result) => {
          //Reload cache
          await nodeCache.reload();
          res
            .status(statusCode.ok)
            .send(response.successmsg("Language updated successfully"));
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  deactivate: async (req, res) => {
    try {
      let language_id = await enc_dec.cjs_decrypt(
        req.bodyString("language_id")
      );
      var insdata = {
        status: 1,
      };

      $ins_id = await LanguageModel.updateDetails({ id: language_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Language",
      };
      let headers = req.headers;
      admin_activity_logger
        .deactivate(module_and_user, language_id, headers)
        .then(async (result) => {
          //Reload cache
          await nodeCache.reload();
          res
            .status(statusCode.ok)
            .send(response.successmsg("Language deactivated successfully"));
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  activate: async (req, res) => {
    try {
      let language_id = await enc_dec.cjs_decrypt(
        req.bodyString("language_id")
      );
      var insdata = {
        status: 0,
      };

      $ins_id = await LanguageModel.updateDetails({ id: language_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Language",
      };
      let headers = req.headers;
      admin_activity_logger
        .activate(module_and_user, language_id, headers)
        .then(async (result) => {
          //Reload cache
          await nodeCache.reload();
          res
            .status(statusCode.ok)
            .send(response.successmsg("Language activated successfully"));
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  delete: async (req, res) => {
    try {
      let language_id = await enc_dec.cjs_decrypt(
        req.bodyString("language_id")
      );
      var insdata = {
        deleted: 1,
      };

      $ins_id = await LanguageModel.updateDetails({ id: language_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Language",
      };
      let headers = req.headers;
      admin_activity_logger
        .delete(module_and_user, language_id, headers)
        .then(async (result) => {
          //Reload cache
          await nodeCache.reload();
          res
            .status(statusCode.ok)
            .send(response.successmsg("Language deleted successfully"));
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};
module.exports = language;
