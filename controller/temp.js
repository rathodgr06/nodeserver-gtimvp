const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const referral_invoice_model = require("../models/referral_bonus_invoice_model");
const enc_dec = require("../utilities/decryptor/decryptor");
require("dotenv").config({ path: "../.env" });
const moment = require("moment");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");
const winston = require("../utilities/logmanager/winston");

const referral_bonus_invoice = {
  generate: async (req, res) => {
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let and_filter_obj = {};
    let date_condition = {
      from_date: "",
      to_date: "",
    };
    let total_count = 0;
    let total_amount = 0.0;
    let total_tax = 0.0;
    let total_bonus = 0.0;

    let referral_code = req.bodyString("referral_code");
    let qb = await pool.get_connection();
    let referrer_id;
    try {
      referrer_id = await qb
        .select("id")
        .where({ referral_code: referral_code })
        .get(config.table_prefix + "referrers");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    // let merchant_id = enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    and_filter_obj.referrer_id = referrer_id[0].id;

    let month_year = req.bodyString("month_year"); // format will be Name Year ( Jan-2023 )
    const date = moment(month_year, "MMM-YYYY");
    const firstDayOfMonth = date.startOf("month").format("YYYY-MM-DD");
    date_condition.from_date = firstDayOfMonth;
    const lastDayOfMonth = date.endOf("month").format("YYYY-MM-DD");
    date_condition.to_date = lastDayOfMonth;

    qb = await pool.get_connection();
    let dataFound;
    try {
      dataFound = await qb
        .select("*")
        .where({ referrer_id: referrer_id[0].id, month: month_year })
        .get(config.table_prefix + "referral_bonus_monthly_invoice");
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    try {
      if (dataFound.length === 0) {
        let currency;
        try {
          currency = await qb
            .select("currency")
            .where({ referrer_id: referrer_id[0].id })
            .get(config.table_prefix + "referral_bonus");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        let qb = await pool.get_connection();
        let tax_per;
        try {
          tax_per = await qb
            .select("tax_per")
            .where({ currency: currency[0].currency })
            .get(config.table_prefix + "master_referral_bonus");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        await referral_invoice_model
          .select(and_filter_obj, date_condition)
          .then((res) => {
            total_count = res.length;
            for (item of res) {
              total_amount = total_amount + item.amount;
            }
            total_tax = total_amount * (tax_per[0].tax_per / 100);
            total_bonus = total_amount - total_tax;
          })
          .catch((err) => {
            winston.error(err);
          });

        let inv_data = {
          referrer_id: referrer_id[0].id,
          month: month_year,
          from_date: firstDayOfMonth,
          to_date: lastDayOfMonth,
          no_of_successful_referral: total_count,
          bonus_earned_from_successful_referral: total_amount,
          total_tax: total_tax,
          total_bonus: total_bonus,
          created_at: created_at,
        };

        referral_invoice_model
          .addInvoice(inv_data)
          .then((result) => {
            inv_data.data_id = result.insertId;

            let send_res = [];

            let temp = {
              data_id: enc_dec.cjs_encrypt(result.insertId),
              referrer_id: enc_dec.cjs_encrypt(inv_data.referrer_id),
              month: inv_data.month,
              from_date: inv_data.from_date,
              to_date: inv_data.to_date,
              no_of_successful_referral: inv_data.no_of_successful_referral,
              bonus_earned_from_successful_referral:
                inv_data.bonus_earned_from_successful_referral,
              total_tax: inv_data.total_tax,
              total_bonus: inv_data.total_bonus,
              status: inv_data.status == 0 ? "Pending" : "Paid",
              created_at: inv_data.created_at,
            };
            send_res.push(temp);

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  send_res,
                  "Referral-bonus invoice generated successfully."
                )
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
          .send(response.errormsg("No data available for currency or month."));
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.ok)
        .send(response.errormsg("No data available for currency or month."));
    }
  },

  invoice_list: async (req, res) => {
    let limit = {
      perpage: 10,
      start: 0,
      page: 1,
    };
    let condition = {};

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    if (req.bodyString("referrer_id")) {
      condition.referrer_id = enc_dec.cjs_decrypt(
        req.bodyString("referrer_id")
      );
    }

    if (req.bodyString("month_year")) {
      condition.month = '"' + req.bodyString("month_year") + '"';
    }

    referral_invoice_model
      .select_list(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            data_id: enc_dec.cjs_encrypt(val.id),
            referrer_id: enc_dec.cjs_encrypt(val.referrer_id),
            referrer_name: await helpers.get_referrer_name_by_id(
              val.referrer_id
            ),
            month: val.month,
            from_date: moment(val.from_date).format("yyyy-MM-DD"),
            to_date: moment(val.to_date).format("yyyy-MM-DD"),
            no_of_successful_referral: val.no_of_successful_referral,
            bonus_earned_from_successful_referral:
              val.bonus_earned_from_successful_referral,
            total_tax: val.total_tax,
            total_bonus: val.total_bonus,
            status: val.status == 0 ? "Pending" : "Paid",
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
          };
          send_res.push(temp);
        }
        let total_row = await referral_invoice_model.get_count(condition, "");
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "List fetched successfully.",
              total_row
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
  view: async (req, res) => {
    let condition = { id: enc_dec.cjs_decrypt(req.bodyString("id")) };
    referral_invoice_model
      .select_one(condition)
      .then(async (val) => {
        let temp = {
          data_id: enc_dec.cjs_encrypt(val.id),
          referrer_id: enc_dec.cjs_encrypt(val.referrer_id),
          referrer_name: await helpers.get_referrer_name_by_id(val.referrer_id),
          month: val.month,
          from_date: moment(val.from_date).format("yyyy-MM-DD"),
          to_date: moment(val.to_date).format("yyyy-MM-DD"),
          no_of_successful_referral: val.no_of_successful_referral,
          bonus_earned_from_successful_referral:
            val.bonus_earned_from_successful_referral,
          total_tax: val.total_tax,
          total_bonus: val.total_bonus,
          status: val.status == 0 ? "Pending" : "Paid",
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
        };
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(temp, "Details fetched successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    try {
      let referral_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("referral_invoice_id")
      );

      var insdata = {
        status: 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await referral_invoice_model
        .update(
          {
            id: referral_invoice_id,
          },
          insdata
        )
        .then(async (result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg(
                "Referral-invoice status updated successfully."
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
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  referral_bonus_list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    // let condition = {};
    let date_condition = {};

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    if (req.bodyString("month_year")) {
      let month_year = req.bodyString("month_year"); // format will be Name-Year ( Jan-2023 )
      const date = moment(month_year, "MMM-YYYY");
      const firstDayOfMonth = date.startOf("month").format("YYYY-MM-DD");
      date_condition.from_date = firstDayOfMonth;
      const lastDayOfMonth = date.endOf("month").format("YYYY-MM-DD");
      date_condition.to_date = lastDayOfMonth;
    }

    // if (req.bodyString("referrer_id")) {
    //     condition.referrer_id = enc_dec.cjs_decrypt(
    //         req.bodyString("referrer_id")
    //     );
    // }

    let total_Count = await referral_invoice_model.get_referral_earning_count(
      date_condition
    );

    let qb = await pool.get_connection();
    referral_invoice_model
      .select_referral_list(date_condition, limit)
      .then(async (result) => {
        let send_res = [];
        try {
          for (val of result) {
            let needed_info = await qb
              .select("*")
              .where({ referral_code_used: val.referral_code })
              .get(config.table_prefix + "master_super_merchant");

            let referral_count = needed_info.length;

            let total_amount = await qb.query(
              "SELECT SUM(amount) AS total_amount FROM pg_referral_bonus WHERE referrer_id = " +
                val.id
            );

            let temp = {
              referrer_name: val.full_name,
              referral_code: val.referral_code,
              total_referrals: referral_count,
              total_earning: total_amount[0].total_amount
                ? total_amount[0].total_amount
                : 0,
            };
            send_res.push(temp);
          }
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "List fetched successfully.",
              total_Count
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

  referral_bonus_details: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    let condition = {};
    let date_condition = {};

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    if (req.bodyString("referral_code")) {
      condition.referral_code_used = req.bodyString("referral_code");
    }

    let total_count = await referral_invoice_model.total_details_count(
      condition
    );

    referral_invoice_model
      .select_referral_details(condition, date_condition, limit)
      .then(async (result) => {
        let send_res = [];

        for (val of result) {
          let temp = {
            name: val?.name ? val?.name : "",
            email: val?.email ? val?.email : "",
            code: val?.code ? val?.code : "",
            mobile_no: val?.mobile_no ? val?.mobile_no : "",
            referral_code_used: val?.referral_code_used
              ? val?.referral_code_used
              : "",
          };
          send_res.push(temp);
        }

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
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  referral_bonus_list_marchent: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    let condition = {};
    let date_condition = {};

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
  },
};

module.exports = referral_bonus_invoice;
