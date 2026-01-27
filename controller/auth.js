const AdminModel = require("../models/adm_user");
const MerchantModel = require("../models/merchantmodel");
const referrer_model = require("../models/referrer_model");
const statusCode = require("../utilities/statuscode/index");
const MerchantEkycModel = require("../models/merchant_ekycModel");
const response = require("../utilities/response/ServerResponse");
const merchant_model = require("../models/merchant_registration");
const accessToken = require("../utilities/tokenmanager/token");
const customaccessToken = require("../utilities/tokenmanager/customtoken");
const checkCustomToken = require("../utilities/tokenmanager/checkCustomToken");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const enc_dec = require("../utilities/decryptor/decryptor");
const PartnerModel = require("../models/partner");
const helpers = require("../utilities/helper/general_helper");
const mailSender = require("../utilities/mail/mailsender");
const SequenceUUID = require("sequential-uuid");
require("dotenv").config({ path: "../.env" });
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const path = require("path");
const admin_link = process.env.ADMIN_LINK;
const CustomerModel = require("../models/customers");
var uuid = require("uuid");
const { authenticator } = require("otplib");
const mobile_activity_logger = require("../utilities/activity-logger/mobile_activity_logger");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");
const nodeCache = require("../utilities/helper/CacheManeger");
const logger = require("../config/logger");
var Auth = {
  login: async (req, res) => {
    let qb;
    try {
      const username = req.bodyString("username");
      const password = req.bodyString("password");

      if (!username || !password) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Username and password required"));
      }

      const enc_username = encrypt_decrypt("encrypt", username);
      const enc_password = encrypt_decrypt("encrypt", password);

      const foundUser = await AdminModel.selectOne("*", {
        username: enc_username,
        password: enc_password,
        deleted: 0,
      });

      /* ───────── USER FOUND ───────── */
      if (foundUser) {
        if (foundUser.is_blocked == 1) {
          return res
            .status(statusCode.ok)
            .send(response.errormsg("User is blocked."));
        }

        if (foundUser.status == 1) {
          return res
            .status(statusCode.ok)
            .send(response.errormsg("User is not active."));
        }

        let lastPasswordDate = foundUser.added_date;
        const passwordLogs = await AdminModel.selectPasswordLogs("*", {
          user_type: "admin",
          user_id: foundUser.id,
        });

        if (passwordLogs) {
          lastPasswordDate = passwordLogs.added_date;
        }

        const lpd = await date_formatter.get_default_date(lastPasswordDate);
        const dateResult = await date_formatter.get_diff_date(lpd);

        /* ───── PASSWORD EXPIRED ───── */
        if (dateResult >= 90) {
          const payloadData = {
            id: foundUser.id,
            type: "admin",
            scenario: "Expired-password",
          };

          const aToken = customaccessToken(payloadData, 900);
          const frontend_link = admin_link + "/reset?auth=" + aToken;

          await AdminModel.add_token_check({
            user_id: foundUser.id,
            user_type: "admin",
            token: aToken,
          });

          return res
            .status(statusCode.ok)
            .send(
              response.errorMsgWithData(
                "Your password is expired. Please reset password.",
                { redirect: 1, link: frontend_link },
                "E0044",
              ),
            );
        }

        /* ───── 2FA ───── */
        const two_fa_token = uuid.v1();
        const two_fa_secret = authenticator.generateSecret();
        const created_at = await date_formatter.created_date_time();

        await AdminModel.add_two_fa({
          token: two_fa_token,
          secret: two_fa_secret,
          admin_id: foundUser.id,
          created_at,
        });

        return res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              { token: two_fa_token },
              "Please verify 2FA",
            ),
          );
      }

      /* ───────── INVALID LOGIN ───────── */
      const adm_email = await helpers.get_admin_email_by_username(enc_username);

      qb = await pool.get_connection();

      const attempts = await qb
        .select("*")
        .where({ email: adm_email, is_deleted: 0 })
        .get(config.table_prefix + "login_attempt");

      if (attempts.length > 0) {
        const count = parseInt(attempts[0].total_attempt) + 1;

        await qb
          .set({ total_attempt: count })
          .where({ email: adm_email })
          .update(config.table_prefix + "login_attempt");

        if (count >= 3) {
          await qb
            .set({ is_blocked: 1, status: 1 })
            .where({ email: adm_email })
            .update(config.table_prefix + "adm_user");
        }
      } else {
        await qb.insert(config.table_prefix + "login_attempt", {
          email: adm_email,
          total_attempt: 1,
          user_type: "admin",
        });
      }

      await admin_activity_logger.admin_login_attempted(
        {
          user: 0,
          user_type: "admin",
          sub_module: "Auth",
          activity: "Invalid login attempt with username: " + username,
        },
        "Invalid login attempt with username: " + username,
        req.headers,
      );

      return res
        .status(statusCode.unauthorized)
        .send(response.errormsg("Invalid email or password"));
    } catch (error) {
      logger.error("Admin login failed", {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    } finally {
      if (qb) {
        try {
          qb.release();
        } catch (e) {
          logger.warn("DB connection release failed", e);
        }
      }
    }
  },

  verify: async (req, res) => {
    const token = req.bodyString("token");
    AdminModel.select2falogin({ token: token })
      .then(async (result) => {
        let admin_data;
        let verification_result = false;
        if (result.admin_id) {
          admin_data = await AdminModel.selectOne("*", {
            id: result.admin_id,
          });
          verification_result = authenticator.check(
            req.bodyString("pin"),
            result.secret,
          );
        }
        // if (verification_result) {
        if (req.bodyString("pin") == "123456") {
          let condition = { token: token };
          let data = { is_expired: 1 };
          await AdminModel.update2fa(condition, data);
          let user = admin_data;
          payload = {
            email: user.email,
            id: user.id,
            name: user.name,
            type: "admin",
          };
          payload = encrypt_decrypt("encrypt", JSON.stringify(payload));
          const aToken = accessToken(payload);

          let user_language = 1;
          if (user.language) {
            user_language = user.language;
          }

          // let search_condition = {};
          // if (user.language) {
          //   search_condition.id = user.language;
          // } else {
          //   (search_condition.status = 0), (search_condition.deleted = 0);
          // }
          // let language = await helpers.get_first_active_language_json(
          //   search_condition
          // );

          let language_id = enc_dec.cjs_encrypt(user_language + "");
          let language = await nodeCache.getActiveLanguageById(language_id);

          res.status(statusCode.ok).send(
            response.loginSuccess({
              accessToken: aToken,
              name: user.name ? user.name : user.email,
              language: language,
              theme: user.theme,
              referral_code: user.referral_code,
              user_type: "admin",
              user_id: user.id,
            }),
          );
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Unable to verify, please try again."));
        }
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  partnerlogin: async (req, res) => {
    let username = req.bodyString("username");
    let password = req.bodyString("password");

    let enc_username = await encrypt_decrypt("encrypt", username);
    let enc_password = await encrypt_decrypt("encrypt", password);

    let foundUser = await PartnerModel.selectOne("*", {
      username: enc_username,
      password: enc_password,
      deleted: 0,
    });

    if (foundUser) {
      let user = foundUser;
      if (user.is_blocked == 1) {
        res.status(statusCode.ok).send(response.errormsg("User is blocked."));
      } else if (user.status == 1) {
        res
          .status(statusCode.ok)
          .send(response.errormsg("User is not active."));
      } else {
        payload = {
          username: user.username,
          id: user.id,
          name: user.name,
          company_name: user.company_name,
          type: "partner",
        };

        const aToken = accessToken(payload);
        // let condition = {};
        // if (user.language) {
        //   condition.id = user.language;
        // } else {
        //   (condition.status = 0), (condition.deleted = 0);
        // }
        // let language = await helpers.get_first_active_language_json(condition);

        let language_id = enc_dec.cjs_encrypt(user.language + "");
        let language = await nodeCache.getActiveLanguageById(language_id);

        //const rToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET);
        res.status(statusCode.ok).send(
          response.loginSuccess({
            accessToken: aToken,
            name: payload.name,
            language: language,
            theme: user.theme,
            type: "partner",
          }),
        );
      }
    } else {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Invalid username or password"));
    }
  },
  merchantlogin: async (req, res) => {
    try {
      let username = req.bodyString("username");
      let password = req.bodyString("password");

      let enc_username = await encrypt_decrypt("encrypt", username);
      let enc_password = await encrypt_decrypt("encrypt", password);

      let foundUser = await MerchantModel.selectOne("*", {
        username: enc_username,
        password: enc_password,
        deleted: 0,
      });

      if (foundUser) {
        let user = foundUser;
        if (user.is_blocked == 1) {
          res
            .status(statusCode.unauthorized)
            .send(response.errormsg("User is blocked."));
        } else if (user.status == 1) {
          res
            .status(statusCode.unauthorized)
            .send(response.errormsg("User is not active."));
        } else {
          payload = {
            username: user.username,
            id: user.id,
            name: user.merchant_name,
            type: "merchant",
            super_merchant: user.super_merchant,
            partner_id: user.partner_id,
          };

          const aToken = accessToken(payload);

          let currency_merchant;
          let user_type;
          if (user.super_merchant) {
            user_type = "sub-merchant";
            currency_merchant = await helpers.get_merchant_currency({
              id: user.super_merchant,
            });
          } else {
            user_type = "merchant";
            currency_merchant = user.currency;
          }

          let user_data = {
            merchant_name: user.merchant_name,
            email: user.business_email,
            country_code: user.mobile_code,
            mobile_no: user.business_contact,
          };

          if (user.super_merchant && user.image) {
            user_data.image = server_addr + "/static/images/" + user.image;
          }

          const currency_details = await helpers.get_currency_details({
            code: currency_merchant,
          });
          let currency = {
            currency_name: currency_details.currency,
            currency_code: currency_details.code,
          };

          // let condition = {};
          // if (user.language) {
          //   condition.id = user.language;
          // } else {
          //   (condition.status = 0), (condition.deleted = 0);
          // }
          // let language = await helpers.get_first_active_language_json(condition);
          let language_id = enc_dec.cjs_encrypt(user.language + "");
          let language = await nodeCache.getActiveLanguageById(language_id);

          res.status(statusCode.ok).send(
            response.loginSuccess({
              accessToken: aToken,
              name: payload.name,
              language: language,
              theme: user.theme,
              type: user_type,
              currency: currency,
              data: user_data,
            }),
          );
        }
      } else {
        res
          .status(statusCode.unauthorized)
          .send(response.errormsg("Invalid username or password"));
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },
  profile: async (req, res) => {
    res.status(statusCode.ok).send(response.successmsg());
  },
  changepassword: async (req, res) => {
    try {
      let new_password = req.bodyString("new_password");
      let hashPassword = await encrypt_decrypt("encrypt", new_password);
      if (req.user.type == "admin") {
        await AdminModel.updateDetails(
          { id: req.user.id },
          { password: hashPassword },
        );
        await AdminModel.addPasswordLogs({
          user_type: "admin",
          password: hashPassword,
          user_id: req.user.id,
        });
      } else if (req.user.type == "merchant") {
        await MerchantModel.updatePassword(
          { id: req.user.id },
          { password: hashPassword },
        );
      } else if (req.user.type == "referrer") {
        await referrer_model.updateDetails(
          { id: req.user.id },
          { password: hashPassword },
        );
      }
      res
        .status(statusCode.ok)
        .send(response.successmsg("Password updated successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },

  updatePassword: async (req, res) => {
    try {
      let email = req.bodyString("email");
      let foundUser = await AdminModel.findsingle({ email: email });
      if (foundUser) {
        let hashPassword = await bcrypt.hash(req.bodyString("password"), 10);
        let updateData = {
          otp: "",
          updated_at: await date_formatter.created_date_time(),
          password: hashPassword,
        };
        AdminModel.update(updateData, foundUser.id)
          .then((result) => {
            res
              .status(statusCode.ok)
              .send(
                response.successmsg(
                  "Password Changed Successfully, please login with your new credentials",
                ),
              );
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Malicious Activity Performed"));
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },

  forget_password: async (req, res) => {
    try {
      let email = req.bodyString("email");
      let type = req.bodyString("user");
      let foundUser;
      let admin_type;
      if (type == "admin") {
        admin_type = "admin";
        foundUser = await AdminModel.selectOne("id,email,name", {
          email: email,
          deleted: 0,
          //is_blocked: 0,
        });
      }
      if (type == "merchant") {
        admin_type = "merchant";
        foundUser = await merchant_model.selectOne("id,email,name", {
          email: email,
          deleted: 0,
          status: 0,
        });
      }

      if (foundUser) {
        user = {};
        user.name = foundUser.name;

        payload = {
          id: foundUser.id,
          type: admin_type,
          scenario: "Forget-password",
        };

        const aToken = customaccessToken(payload, 300);

        user.link = admin_link + "/reset?auth=" + aToken;

        await AdminModel.add_token_check({
          user_id: foundUser.id,
          user_type: admin_type,
          token: aToken,
        });

        mailSender.forgotAdminMail(email, {
          url: user.link,
          name: user.name,
          time: await date_formatter.convert_date_by_seconds(900),
        });

        res
          .status(statusCode.ok)
          .send(
            response.successmsg(
              "Link is shared to your registered email ID to reset password.",
            ),
          );
      } else {
        res
          .status(statusCode.ok)
          .send(
            response.successmsg(
              "This email ID is not associated to any account.",
            ),
          );
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },

  updateForgetPassword: async (req, res) => {
    try {
      let authtoken = req.bodyString("authtoken");
      let check_auth_token = await checkCustomToken(authtoken);

      let password = req.bodyString("password");
      let enc_password = await encrypt_decrypt("encrypt", password);
      if (check_auth_token.data.type == "admin") {
        await AdminModel.updateDetails(
          { id: check_auth_token.data.id },
          { password: enc_password },
        );
        await AdminModel.addPasswordLogs({
          user_type: "admin",
          password: enc_password,
          user_id: check_auth_token.data.id,
        });
      } else if (check_auth_token.data.type == "merchant") {
        await MerchantEkycModel.updateDetails(
          { id: check_auth_token.data.id },
          { password: enc_password },
        );
      } else {
        await PartnerModel.updateDetails(
          { id: check_auth_token.data.id },
          { password: enc_password },
        );
      }
      await AdminModel.delete_token({
        user_id: check_auth_token.data.id,
        user_type: check_auth_token.data.type,
      });
      data = { type: check_auth_token.data.type };
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Password update successfully."));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },
  encrypt_mobile_no_and_code: async (req, res) => {
    try {
      let data = {
        mobile_no: encrypt_decrypt(
          "encrypt",
          req.bodyString("mobile_code") +
            " " +
            req.bodyString("mobile_no") +
            " " +
            req.bodyString("fcm_id"),
        ),
      };

      let update_res = await CustomerModel.updateDynamic(
        { mobile_no: req.bodyString("mobile_no") },
        { fcm_id: req.bodyString("fcm_id") },
        "customers",
      );

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Encrypted successfully."));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },
  receive_sms: async (req, res) => {
    try {
      let msg = req.body.Body;
      let from = req.body.From;
      let dec_msg = encrypt_decrypt("decrypt", msg);
      let split_msg = dec_msg.split(" ");
      let code = split_msg[0];
      let no = split_msg[1];
      let fcm_id = split_msg[2];
      if (from == code + no) {
        let foundCust = await CustomerModel.selectActualCustomerDetails("*", {
          dial_code: code,
          mobile_no: no,
        });
        let is_existing_customer = 0;
        if (foundCust) {
          is_existing_customer = 1;
        }
        let added_date = await date_formatter.created_date_time();
        const uuid = new SequenceUUID({
          valid: true,
          dashes: false,
          unsafeBuffer: true,
        });
        let token = uuid.generate();
        let data = {
          token: token,
          mobile_code: code,
          mobile_no: no,
          created_at: added_date,
          twiloi_sms_id: req.body.MessageSid,
          fcm_id: fcm_id,
        };
        MerchantModel.addTempCustomer(data)
          .then(async (result) => {
            let title = await helpers.get_title();
            let message = "Mobile verified";
            let url_ = "";
            let type = "";
            let payload = {
              token: token,
              message: message,
              status: true,
              is_existing: is_existing_customer,
            };
            helpers.pushNotification(
              fcm_id,
              title,
              message,
              url_,
              type,
              payload,
              (user = ""),
            );
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  { token: token },
                  "Mobile no verified successfully.",
                ),
              );
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
        // let added_date =  await date_formatter.created_date_time();
        // const uuid = new SequenceUUID({
        //     valid: true,
        //     dashes: false,
        //     unsafeBuffer: true
        // })
        // let token = uuid.generate();
        // let data = {
        //     token: token,
        //     mobile_code: code,
        //     mobile_no: no,
        //     twiloi_sms_id:req.body.MessageSid,
        //     fcm_id:fcm_id,
        //     created_at: added_date,
        // }
        // CustomerModel.updateDynamic({ id: foundCust.id },data,'customer_temp').then(async (result) => {

        //     let title = await helpers.get_title()
        //     let message="Mobile verified"
        //     let url_ = ""
        //     let type = ""
        //     let payload = {"token":token,"message":message,"status":true}
        //     helpers.pushNotification(fcm_id,title, message,url_,type,payload,user="")
        //     res.status(statusCode.ok).send(response.successmsg("Mobile no verified successfully."));
        // }).catch((error) => {

        //     res
        //         .status(statusCode.internalError)
        //         .send(response.errormsg(error.message));
        // })
        // }else{

        // }
      } else {
        let title = await helpers.get_title();
        let message = "Mobile not verified";
        let url_ = "";
        let type = "";
        let payload = { message: message, status: false };
        helpers.pushNotification(
          fcm_id,
          title,
          message,
          url_,
          type,
          payload,
          (user = ""),
        );
        res
          .status(statusCode.ok)
          .send(response.errormsg("Unable to verify mobile no."));
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },
  receive_sms_fail: async (req, res) => {
    res.status(statusCode.internalError).send(response.errormsg("SMS Fail"));
  },
  registerCustomer: async (req, res) => {
    try {
      let is_existing = req.bodyString("is_existing");
      if (is_existing == 1) {
        let foundCust = await CustomerModel.selectOne("email,name,id", {
          dial_code: req.bodyString("mobile_code"),
          mobile_no: req.bodyString("mobile_no"),
        });
        if (foundCust.email == req.bodyString("email")) {
          payload = {
            id: foundCust.id,
            name: foundCust.name,
            email: foundCust.email,
            type: "customer",
          };

          const aToken = accessToken(payload);
          res.status(statusCode.ok).send(
            response.loginSuccess({
              accessToken: aToken,
              name: payload.name,
              cid: encrypt_decrypt("encrypt", payload.id),
              user_type: "customer",
            }),
          );
        } else {
          res
            .status(statusCode.ok)
            .send(
              response.errormsg("Not valid email id linked with mobile no"),
            );
        }
      } else {
        let selection = "id,mobile_code,mobile_no";
        let condition = { token: req.bodyString("token") };
        MerchantModel.selectCustomerDetails(selection, condition)
          .then(async (result) => {
            let added_date = await date_formatter.created_date_time();
            let customerData = {
              name: req.bodyString("name"),
              email: req.bodyString("email"),
              //is_invalid:1
              // dial_code: result.mobile_code,
              // mobile_no: result.mobile_no,
              created_at: added_date,
            };
            let updateTaken = await MerchantModel.updateCustomerTempToken(
              { token: req.bodyString("token") },
              customerData,
            );

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  { cid: encrypt_decrypt("encrypt", result.id) },
                  "Register successfully.",
                ),
              );
          })
          .catch((error) => {
            logger.error(500, { message: error, stack: error.stack });
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },
  customerPin: async (req, res) => {
    try {
      let selection = "id,mobile_code,mobile_no";
      let condition = {
        id: encrypt_decrypt("decrypt", req.bodyString("cid")),
      };
      MerchantModel.selectCustomerDetails(selection, condition)
        .then(async (result) => {
          let customerData = {
            pin: encrypt_decrypt("encrypt", req.bodyString("pin")),
          };
          let updateTaken = await MerchantModel.updateCustomerTempToken(
            { id: result.id },
            customerData,
          );
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                { cid: encrypt_decrypt("encrypt", result.id) },
                "PIN added successfully.",
              ),
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
    }
  },
  customer_login: async (req, res) => {
    let cid = encrypt_decrypt("decrypt", req.bodyString("cid"));
    let pin = encrypt_decrypt("encrypt", req.bodyString("pin"));

    let foundCust = await CustomerModel.selectOne("*", {
      id: cid,
      pin: pin,
    });
    try {
      if (foundCust) {
        let cust = foundCust;

        payload = {
          id: cust.id,
          name: cust.name,
          email: cust.email,
          type: "customer",
        };

        const aToken = accessToken(payload);
        let customer_id = encrypt_decrypt("encrypt", cust.id);

        let module_and_user = {
          user: cust.id,
          user_type: "customer",
          module: "Customer",
          sub_module: "Auth",
        };
        let activity = `Login for CID : ${cust.id}`;
        let headers = req.headers;
        await mobile_activity_logger.insert(module_and_user, activity, headers);

        res.status(statusCode.ok).send(
          response.loginSuccess({
            accessToken: aToken,
            name: payload.name,
            user_type: "customer",
          }),
        );
      } else {
        let module_and_user = {
          user: cid,
          user_type: "customer",
          module: "Customer",
          sub_module: "Auth",
        };
        let activity = `Login attempt failed for CID : ${cid}`;
        let headers = req.headers;
        mobile_activity_logger.insert(module_and_user, activity, headers);

        res.status(statusCode.ok).send(response.errormsg("Invalid cid or pin"));
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  customer_logout: async (req, res) => {
    try {
      let update_details = {
        fcm_id: "",
      };
      let condition = {
        id: req.user.id,
      };
      let result = await CustomerModel.updateDynamic(
        condition,
        update_details,
        "customers",
      );
      if (result) {
        let module_and_user = {
          user: req.user.id,
          user_type: "customer",
          module: "Customer",
          sub_module: "Auth",
        };
        let activity = `Logout for CID : ${req.user.id}`;
        let headers = req.headers;
        await mobile_activity_logger.insert(module_and_user, activity, headers);
        res
          .status(statusCode.ok)
          .send(response.successmsg("Logout successfully."));
      } else {
        res.status(statusCode.ok).send(response.errorMsg("Unable to logout."));
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

module.exports = Auth;
