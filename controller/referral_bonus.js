const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const referral_bonus_model = require("../models/referral_bonus_model");
const moment = require("moment");
const date_formatter = require("../utilities/date_formatter/index");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const table_name = "country";
const mailSender = require("../utilities/mail/mailsender");
const winston = require("../utilities/logmanager/winston");

var referral_bonus = {
  add: async (req, res) => {
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");

    // let qb = await pool.get_connection();
    // let country = await qb
    //     .select("currency")
    //     .where({ country_code: req.bodyString("country") })
    //     .get(config.table_prefix + table_name);
    // qb.release();

    let ins_data = {
      settlement_frequency: req.bodyString("settlement_frequency"),
      currency: req.bodyString("currency"),
      country: req.bodyString("country"),
      fix_amount_for_reference: req.bodyString("fix_amount_for_reference"),
      fix_amount: req.bodyString("fix_amount"),
      per_amount: req.bodyString("per_amount"),
      apply_greater: req.bodyString("apply_greater"),
      settlement_date: req.bodyString("settlement_date"),
      calculate_bonus_till: req.bodyString("calculate_bonus_till"),
      tax_per: req.bodyString("tax_per"),
      deleted: 0,
      created_at: added_date,
      updated_at: added_date,
    };
    referral_bonus_model
      .add(ins_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referral bonus added successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

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
    let condition = { deleted: 0 };
    let condition_for_count = { deleted: 0 };
    if (req.bodyString("currency")) {
      condition.currency = req.bodyString("currency");
    }
    if (req.bodyString("currency")) {
      condition_for_count.currency = `'${req.bodyString("currency")}'`;
    }
    let search = "";
    // if (req.bodyString('search_string')) {
    //     search = req.bodyString('search_string');
    // }
    referral_bonus_model
      .select(condition, limit, search)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let country;
          let qb = await pool.get_connection();
          try {
            country = await qb
              .select("country_name")
              .where({ currency: val.currency })
              .get(config.table_prefix + "country");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let temp = {
            referral_bonus_id: enc_dec.cjs_encrypt(val.id),
            currency: val.currency,
            country: val.country ? val.country : country[0].country_name,
            fix_amount_for_reference: val.fix_amount_for_reference.toFixed(2),
            fix_amount: val.fix_amount.toFixed(2),
            per_amount: val.per_amount.toFixed(2),
            apply_greater: val.apply_greater,
            settlement_date: val.settlement_date,
            calculate_bonus_till: val.calculate_bonus_till,
            tax_per: val.tax_per.toFixed(2),
          };
          send_res.push(temp);
        }

        let total_count = await referral_bonus_model.get_count(
          condition_for_count
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Referral bonus list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  list_fetch: async (req, res) => {
    let condition = { deleted: 0 };
    let condition_for_count = { deleted: 0 };
    if (req.bodyString("currency")) {
      condition.currency = req.bodyString("currency");
    }
    if (req.bodyString("currency")) {
      condition_for_count.currency = `'${req.bodyString("currency")}'`;
    }

    referral_bonus_model
      .selectSpecificDetails(condition)
      .then(async (result) => {
        let send_res = [];

        for (val of result) {
          let country;
          let qb = await pool.get_connection();
          try {
            country = await qb
              .select("country_name")
              .where({ currency: val.currency })
              .get(config.table_prefix + "country");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let temp = {
            referral_bonus_id: enc_dec.cjs_encrypt(val.id),
            currency: val.currency,
            country: country[0].country_name,
            fix_amount_for_reference: val.fix_amount_for_reference.toFixed(2),
            fix_amount: val.fix_amount.toFixed(2),
            per_amount: val.per_amount.toFixed(2),
            apply_greater: val.apply_greater,
            settlement_date: val.settlement_date,
            calculate_bonus_till: val.calculate_bonus_till,
            tax_per: val.tax_per.toFixed(2),
            settlement_frequency: val.settlement_frequency,
          };
          send_res.push(temp);
        }

        let total_count = await referral_bonus_model.get_count(
          condition_for_count
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Referral bonus list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  get: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referral_bonus_id"));
    referral_bonus_model
      .selectOne(
        "id, currency,country,fix_amount_for_reference, fix_amount,  per_amount, apply_greater, settlement_date, calculate_bonus_till, tax_per, settlement_frequency",
        { id: id }
      )
      .then((result) => {
        let send_res = {
          settlement_frequency: result.settlement_frequency
            ? result.settlement_frequency
            : "",
          referral_bonus_id: result.id ? enc_dec.cjs_encrypt(result.id) : "",
          currency: result.currency ? result.currency : "",
          country: result.country ? result.country : "",
          fix_amount_for_reference:
            result.fix_amount_for_reference ||
            result.fix_amount_for_reference === 0
              ? result.fix_amount_for_reference.toFixed(2)
              : "",
          fix_amount:
            result.fix_amount || result.fix_amount === 0
              ? result.fix_amount.toFixed(2)
              : "",
          per_amount:
            result.per_amount || result.per_amount === 0
              ? result.per_amount.toFixed(2)
              : "",
          apply_greater: result.apply_greater
            ? result.apply_greater.toFixed(2)
            : "",
          settlement_date: result.settlement_date ? result.settlement_date : "",
          calculate_bonus_till: result.calculate_bonus_till
            ? result.calculate_bonus_till
            : "",
          tax_per: result.tax_per || result.tax_per === 0 ? result.tax_per : "",
        };
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  delete: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referral_bonus_id"));
    let update_data = { deleted: 1 };
    referral_bonus_model
      .updateDetails({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referral bonus deleted successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    let referral_bonus_id = enc_dec.cjs_decrypt(
      req.bodyString("referral_bonus_id")
    );
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let ins_data = {
      settlement_frequency: req.bodyString("settlement_frequency"),
      currency: req.bodyString("currency"),
      country: req.bodyString("country"),
      fix_amount_for_reference: req.bodyString("fix_amount_for_reference"),
      fix_amount: req.bodyString("fix_amount"),
      per_amount: req.bodyString("per_amount"),
      apply_greater: req.bodyString("apply_greater"),
      settlement_date: req.bodyString("settlement_date"),
      calculate_bonus_till: req.bodyString("calculate_bonus_till"),
      tax_per: req.bodyString("tax_per"),
      updated_at: added_date,
    };
    referral_bonus_model
      .updateDetails({ id: referral_bonus_id }, ins_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referral bonus updated successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  invoice_mail: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    referral_bonus_model
      .select_invoice_data({ id: id })
      .then(async (inv_data) => {
        let email = req.bodyString("email");
        let subject = req.bodyString("subject");
        let msg = req.bodyString("message");
        let data = {
          message: msg,
          message_text:
            msg != ""
              ? '<p style="margin: 4px 0;"><b style="color: #263238 !important;">Description</b></p>' +
                msg
              : "",
          mail_to: email,
          referral_code: await helpers.get_referral_code(inv_data.referrer_id),
          referrer_name: await helpers.get_referrer_name_by_id(
            inv_data.referrer_id
          ),
          subject: subject,
          total_tax: inv_data.total_tax,
          total_bonus: inv_data.total_bonus.toFixed(2),
          successful_referral:
            inv_data.bonus_earned_from_successful_referral.toFixed(2),
          payout_date: await date_formatter.get_date(inv_data.payout_date),
        };
        let mail_response = await mailSender.referral_mail(data);
        res
          .status(statusCode.ok)
          .send(response.successmsg("Mail sent successfully"));
      })
      .catch((error) => {
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};

module.exports = referral_bonus;
