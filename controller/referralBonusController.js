const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const referralBonusModel = require("../models/referral_bonusModel");
const moment = require("moment");
const mailSender = require("../utilities/mail/mailsender");

require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const winston = require("../utilities/logmanager/winston");

var referralBonusController = {
  list: async (req, res) => {
    let limit = {
      perpage: 10,
      start: 0,
      page: 1,
    };

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let and_filter_obj = {};
    let date_condition = {};

    if (req.bodyString("referrer_id")) {
      let referrer_id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
      and_filter_obj.referrer_id = referrer_id;
    }

    if (req.bodyString("status")) {
      and_filter_obj.status = req.bodyString("status");
    }

    if (req.bodyString("currency")) {
      and_filter_obj.currency = req.bodyString("currency");
    }

    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    referralBonusModel
      .select(and_filter_obj, date_condition, limit)
      .then(async (result) => {
        let send_res = [];
        let qb = await pool.get_connection();
        try {
          for (let val of result) {
            let country = await qb
              .select("country_code")
              .where({ currency: val.currency })
              .get(config.table_prefix + "country");

            let res = {
              data_id: await enc_dec.cjs_encrypt(val.id),
              referrer_id: await enc_dec.cjs_encrypt(val.referrer_id),
              currency: val.currency,
              country: country[0].country_code,
              amount: val.amount,
              remark: val.remark,
              status: val.status === 0 ? "Pending" : "Settled",
              created_at: moment(val.created_at).format("DD-MM-YYYY H:mm:ss"),
            };
            send_res.push(res);
          }
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "List fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  pending: async (req, res) => {
    try {
      let referral_bonus_id = await enc_dec.cjs_decrypt(
        req.bodyString("referral_bonus_id")
      );
      var insdata = {
        status: 0,
      };

      await referralBonusModel
        .updateDetails(
          {
            id: referral_bonus_id,
          },
          insdata
        )
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg("Referral-bonus status changed successfully.")
            );
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  settled: async (req, res) => {
    try {
      let referral_bonus_id = await enc_dec.cjs_decrypt(
        req.bodyString("referral_bonus_id")
      );
      var insdata = {
        status: 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      let qb = await pool.get_connection();
      let referrer_info;
      let referrer_email;
      try {
        referrer_info = await qb
          .select("referrer_id,amount,currency,status,ref_no")
          .where({ id: referral_bonus_id })
          .get(config.table_prefix + "referral_bonus");
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }

      qb = await pool.get_connection();
      try {
        referrer_email = await qb
          .select("email, full_name")
          .where({ id: referrer_info[0].referrer_id })
          .get(config.table_prefix + "referrers");
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }

      await referralBonusModel
        .updateDetails(
          {
            id: referral_bonus_id,
          },
          insdata
        )
        .then(async (result) => {
          let mailData = {
            currency: referrer_info[0].currency,
            amount: referrer_info[0].amount,
            status: "Settled",
            order_id: referrer_info[0].ref_no,
            full_name: referrer_email[0].full_name,
          };
          await mailSender.ReferralBonusSettledMail(
            referrer_email[0].email,
            mailData
          );

          res
            .status(statusCode.ok)
            .send(response.successmsg("Referral-bonus settled successfully."));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

module.exports = referralBonusController;
