const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const AdminModel = require("../models/adm_user");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
require("dotenv").config({ path: "../.env" });
var uuid = require("uuid");
const { authenticator } = require("otplib");
const mailSender = require("../utilities/mail/mailsender");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const QRCode = require("qrcode");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
require("dotenv").config({ path: "../.env" });
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");
const logger = require('../config/logger');

var admin_user = {
  register: async (req, res) => {
    console.log(`calling the register api`);
    try {
      let hashPassword = encrypt_decrypt("encrypt", req.bodyString("password"));
      let username = await encrypt_decrypt(
        "encrypt",
        req.bodyString("username")
      );
      let designation = await enc_dec.cjs_decrypt(
        req.bodyString("designation")
      );
      let department = await enc_dec.cjs_decrypt(req.bodyString("department"));

      let support_ticket = req.bodyString("support_ticket");
      let support_ticket_category = req.bodyString("support_ticket_category");
      let support_ticket_roles = req.bodyString("support_ticket_roles");
      let support_ticket_password = req.bodyString("support_ticket_password")
        ? await encrypt_decrypt(
            "encrypt",
            req.bodyString("support_ticket_password")
          )
        : "";

      userData = {
        name: req.bodyString("name"),
        admin_type: "admin",
        designation: designation,
        department: department,
        username: username,
        password: hashPassword,
        role: req.bodyString("role") + "," + support_ticket_roles,
        added_date: await date_formatter.created_date_time(),
        ip: await helpers.get_ip(req),

        support_ticket: support_ticket,
        support_ticket_category: support_ticket_category,
        support_ticket_roles: support_ticket_roles,
        support_ticket_password: support_ticket_password,
      };

      if (req.bodyString("email")) {
        userData.email = req.bodyString("email");
      } else {
        userData.email = "";
      }
      if (req.bodyString("mobile_no")) {
        userData.mobile = req.bodyString("mobile_no");
        userData.country_code = req.bodyString("country_code");
      } else {
        userData.mobile = "";
      }
      if (req.all_files) {
        if (req.all_files.image) {
          userData.avatar = req.all_files.image;
        }
      }

      let ins_id = await AdminModel.add(userData);
      let two_fa_token = uuid.v1();
      let two_fa_secret = authenticator.generateSecret();
      let created_at = await date_formatter.created_date_time();
      let two_fa_data = {
        token: two_fa_token,
        secret: two_fa_secret,
        admin_id: ins_id.insertId,
        created_at: created_at,
      };
      let result_2fa = await AdminModel.add_two_fa(two_fa_data);

      await AdminModel.addPasswordLogs({
        user_type: "admin",
        password: hashPassword,
        user_id: ins_id.insertId,
      });

      let verify_url =
        process.env.FRONTEND_URL + "/verify-admin/" + two_fa_token;
      let title = await helpers.get_title();
      let subject = "Welcome to " + title;

      await mailSender.welcomeMailAdmin(
        req.bodyString("email"),
        subject,
        verify_url
      );
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Manage user",
      };
      let added_name = req.bodyString("username");
      let headers = req.headers;
      admin_activity_logger
        .add(module_and_user, added_name, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("User registered successfully"));
        })
        .catch((error) => {
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  generate_2fa_qr: async (req, res) => {
    const token = req.bodyString("token");
    AdminModel.select2fa({ "t.token": token })
      .then(async (result) => {
        if (result) {
          let title = await helpers.get_title();
          QRCode.toDataURL(
            authenticator.keyuri(result.email, title, result.secret),
            (err, url) => {
              if (err) {
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(err));
              }
              res
                .status(statusCode.ok)
                .send(
                  response.successdatamsg(
                    { qr_url: url },
                    "Qr code generated successfully."
                  )
                );
            }
          );
        } else {
          res
            .status(statusCode.internalError)
            .send(
              response.errormsg("Admin details not found, please try again")
            );
        }
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  verify_2fa: async (req, res) => {
    const token = req.bodyString("token");
    AdminModel.select2fa({ token: token })
      .then(async (result) => {
        let verification_result = authenticator.check(
          req.bodyString("pin"),
          result.secret
        );
        let condition = { id: result.admin_id };
        let admin_data = { two_fa_secret: result.secret };
        let admin_update = await AdminModel.updateDetails(
          condition,
          admin_data
        );
        if (verification_result) {
          let condition = { token: token };
          let data = { is_expired: 1 };
          let two_fa_update = await AdminModel.update2fa(condition, data);
          res
            .status(statusCode.ok)
            .send(response.successmsg("Verified successfully, please login."));
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Unable to verify, please try again."));
        }
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res.status(statusCode.internalError).send(response.errormsg(error));
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
    const search_text = req.bodyString("search");
    const designation = await helpers.get_designation_id_by_name(
      req.bodyString("designation")
    );
    const department = await helpers.get_department_id_by_name(
      req.bodyString("department")
    );
    const status = await helpers.get_status(req.bodyString("status"));
    const search = { deleted: 0 };
    const filter = { name: "" };
    if (search_text) {
      filter.name = search_text;
      filter.email = search_text;
      filter.mobile = search_text;
    }
    if (req.bodyString("designation")) {
      search.designation = designation;
    }
    if (req.bodyString("department")) {
      search.department = department;
    }
    if (req.bodyString("status")) {
      if (
        req.bodyString("status") == "Deactivated" ||
        req.bodyString("status") == "Active"
      ) {
        search.status = status;
        search.is_blocked = 0;
      } else {
        search.is_blocked = 1;
      }
    }

    AdminModel.select(search, filter, limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            user_id: enc_dec.cjs_encrypt(val.id),
            name: val.name,
            designation: await helpers.get_designation_by_id(val.designation),
            designation_id: enc_dec.cjs_encrypt(val.designation),
            department: await helpers.get_department_by_id(val.department),
            department_id: enc_dec.cjs_encrypt(val.department),
            username: await encrypt_decrypt("decrypt", val.username),
            email: val.email,
            mobile_no: val.mobile,
            country_code: val.country_code ? val.country_code : "",
            status: val.status == 1 ? "Deactivated" : "Active",
            blocked_status: val.is_blocked == 1 ? "Blocked" : "Active",
          };
          send_res.push(res);
        }
        total_count = await AdminModel.get_count(search, filter);
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
  admin_details: async (req, res) => {
    let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));

    AdminModel.selectOne("*", { id: user_id, deleted: 0 })
      .then(async (result) => {
        let send_res = [];
        let val = result;

        let res1 = {
          user_id: enc_dec.cjs_encrypt(val.id),
          name: val.name,
          designation: await helpers.get_designation_by_id(val.designation),
          designation_id: enc_dec.cjs_encrypt(val.designation),
          department: await helpers.get_department_by_id(val.department),
          department_id: enc_dec.cjs_encrypt(val.department),
          username: await encrypt_decrypt("decrypt", val.username),
          password: await encrypt_decrypt("decrypt", val.password),
          email: val.email,
          mobile_no: val.mobile,
          country_code: val.country_code ? val.country_code : "",
          role: val.role,
          image: val.avatar ? server_addr + "/static/images/" + val.avatar : "",
          status: val.status == 1 ? "Deactivated" : "Active",
          blocked_status: val.is_blocked == 1 ? "Blocked" : "Active",

          support_ticket: val.support_ticket,
          support_ticket_category: val.support_ticket_category,
          support_ticket_password:
            val.support_ticket == 0
              ? await encrypt_decrypt("decrypt", val.password)
              : await encrypt_decrypt("decrypt", val.support_ticket_password),
          support_ticket_roles: val.support_ticket_roles,
        };

        send_res = res1;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  password: async (req, res) => {
    let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
    AdminModel.selectOne("password", { id: user_id, deleted: 0 })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let res1 = {
          password: await encrypt_decrypt("decrypt", val.password),
        };
        send_res = res1;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Password fetched successfully.")
          );
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));

      let username = await encrypt_decrypt(
        "encrypt",
        req.bodyString("username")
      );
      let designation = await enc_dec.cjs_decrypt(
        req.bodyString("designation")
      );
      let department = await enc_dec.cjs_decrypt(req.bodyString("department"));

      let support_ticket = req.bodyString("support_ticket");
      let support_ticket_category = req.bodyString("support_ticket_category");
      let support_ticket_roles = req.bodyString("support_ticket_roles");
      let support_ticket_password = req.bodyString("support_ticket_password")
        ? await encrypt_decrypt(
            "encrypt",
            req.bodyString("support_ticket_password")
          )
        : "";

      userData = {
        name: req.bodyString("name"),
        designation: designation,
        department: department,
        username: username,
        role: req.bodyString("role") + "," + support_ticket_roles,

        support_ticket: support_ticket,
        support_ticket_category: support_ticket_category,
        support_ticket_roles: support_ticket_roles,
        support_ticket_password: support_ticket_password,
      };

      if (req.all_files) {
        if (req.all_files.image) {
          userData.avatar = req.all_files.image;
        }
      }

      if (req.bodyString("password")) {
        userData.password = await encrypt_decrypt(
          "encrypt",
          req.bodyString("password")
        );
      }

      if (req.bodyString("email")) {
        userData.email = req.bodyString("email");
      } else {
        userData.email = "";
      }
      if (req.bodyString("mobile_no")) {
        userData.mobile = req.bodyString("mobile_no");
        userData.country_code = req.bodyString("country_code");
      } else {
        userData.mobile = "";
      }

      await AdminModel.updateDetails({ id: user_id }, userData);

      if (req.bodyString("password")) {
        await AdminModel.addPasswordLogs({
          user_type: "admin",
          password: await encrypt_decrypt(
            "encrypt",
            req.bodyString("password")
          ),
          user_id: user_id,
        });
      }

      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Manage user",
      };
      let headers = req.headers;
      admin_activity_logger
        .edit(module_and_user, user_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("User updated successfully"));
        })
        .catch((error) => {
          winston.error(error);
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
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
      var insdata = {
        status: 1,
        //is_blocked: 1,
      };

      $ins_id = await AdminModel.updateDetails({ id: user_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Manage User",
      };
      let headers = req.headers;
      admin_activity_logger
        .deactivate(module_and_user, user_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("User deactivated successfully"));
        })
        .catch((error) => {
          winston.error(error);
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
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
      var insdata = {
        status: 0,
        is_blocked: 0,
      };

      $ins_id = await AdminModel.updateDetails({ id: user_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Manage user",
      };
      let headers = req.headers;
      admin_activity_logger
        .activate(module_and_user, user_id, headers)
        .then(async (result) => {
          let qb = await pool.get_connection();
          try {
            let emailRes = await qb
              .select("email")
              .where({ id: user_id })
              .get(config.table_prefix + "adm_user");

            let deleteEntry = await qb
              .set({ is_deleted: 1 })
              .where({ email: emailRes[0]?.email })
              .update(config.table_prefix + "login_attempt");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          res
            .status(statusCode.ok)
            .send(response?.successmsg("User activated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response?.errormsg(error.message));
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
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await AdminModel.updateDetails({ id: user_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Manage user",
      };
      let headers = req.headers;
      admin_activity_logger
        .delete(module_and_user, user_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("User deleted successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch {
       logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  blocked: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
      var insdata = {
        is_blocked: 1,
      };

      $ins_id = await AdminModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Record blocked successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  unblocked: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("user_id"));
      var insdata = {
        is_blocked: 0,
      };

      $ins_id = await AdminModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Record unblocked successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  forgot_2fa: async (req, res) => {
    try {
      let two_fa_token = uuid.v1();
      let two_fa_secret = authenticator.generateSecret();
      let created_at = await date_formatter.created_date_time();
      let two_fa_data = {
        token: two_fa_token,
        secret: two_fa_secret,
        admin_id: enc_dec.cjs_decrypt(req.bodyString("user_id")),
        created_at: created_at,
      };
      let admin_user = await AdminModel.selectSpecific("email,name", {
        id: enc_dec.cjs_decrypt(req.bodyString("user_id")),
      });
      let result_2fa = await AdminModel.add_two_fa(two_fa_data);
      let verify_url =
        process.env.FRONTEND_URL_ADMIN + "verify-admin/" + two_fa_token;
      let title = await helpers.get_title();
      let subject = "Welcome to " + title;
      await mailSender.welcomeMailAdmin(
        admin_user[0].email,
        subject,
        verify_url
      );
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Users",
        sub_module: "Reset 2fa",
      };
      let added_name = admin_user[0].name;
      let headers = req.headers;
      admin_activity_logger
        .add(module_and_user, added_name, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg(
                "Link is shared to your registered email ID to reset 2FA"
              )
            );
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  reset_2fa: async (req, res) => {
    try {
      let two_fa_token = uuid.v1();
      let two_fa_secret = authenticator.generateSecret();
      let admin_user = await AdminModel.selectSpecific("id,email,name", {
        email: req.bodyString("email"),
      });
      let created_at = await date_formatter.created_date_time();
      let two_fa_data = {
        token: two_fa_token,
        secret: two_fa_secret,
        admin_id: admin_user[0].id,
        created_at: created_at,
      };
      let result_2fa = await AdminModel.add_two_fa(two_fa_data);
      let verify_url =
        process.env.FRONTEND_URL_ADMIN + "verify-admin/" + two_fa_token;
      let title = await helpers.get_title();
      let subject = "Welcome to " + title;
      await mailSender.welcomeMailAdmin(
        admin_user[0].email,
        subject,
        verify_url
      );
      res
        .status(statusCode.ok)
        .send(
          response.successmsg(
            "Link is shared to your registered email ID to reset 2FA"
          )
        );
    } catch (error) {
       logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
};
module.exports = admin_user;
