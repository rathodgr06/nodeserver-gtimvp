const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const referral_invoice_model = require("../models/referral_bonus_invoice_model");
const enc_dec = require("../utilities/decryptor/decryptor");
require("dotenv").config({ path: "../.env" });
const moment = require("moment");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const helpers = require("../utilities/helper/general_helper");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const { log } = require("winston");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");

//model
const referrerPayoutModel = require("../models/referrer_invoice_payout_model");

//table
const referrer_invoice_payout_table =
  config.table_prefix + "referrer_invoice_payout";
const referral_bonus_invoice = {
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
    if (req.bodyString("status")) {
      condition.status = req.bodyString("status") == "Paid" ? 1 : 0;
    }
    if (req.bodyString("referral_code")) {
      condition.referrer_id = await helpers.get_referrer_id_by_referral_code(
        req.bodyString("referral_code")
      );
    }
    if (req.bodyString("month_year")) {
      condition.month = '"' + req.bodyString("month_year") + '"';
    }
    let date_condition = {};
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }
    referral_invoice_model
      .select_list(condition, limit, date_condition)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let settlement_data = await helpers.get_settlement(val.referrer_id);
          const settlementFrequency = settlement_data.settlement_frequency;
          const settlementInterval = settlement_data.settlement_date;
          const preDueDate = await helpers.calculatePreDate(
            moment(val.payout_date).format("YYYY-MM-DD"),
            settlementInterval,
            settlementFrequency
          );
          let from_date = preDueDate;
          let to_date = val.payout_date;
          let temp = {
            invoice_no: val?.id ? await helpers.formatNumber(val?.id) : "",
            data_id: enc_dec.cjs_encrypt(val.id),
            referrer_id: enc_dec.cjs_encrypt(val.referrer_id),
            referral_code: await helpers.get_referral_code(val.referrer_id),
            referrer_name: await helpers.get_referrer_name_by_id(
              val.referrer_id
            ),
            month: val.month,
            from_date: moment(from_date).format("DD-MM-YYYY"),
            to_date: moment(to_date).format("DD-MM-YYYY"),
            no_of_successful_referral: val.no_of_successful_referral,
            bonus_earned_from_successful_referral:
              val.bonus_earned_from_successful_referral,
            total_tax: val.total_tax,
            total_bonus: val.total_bonus,
            status: val.status == 0 ? "Pending" : "Paid",
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
            payout_date: moment(to_date).format("DD-MM-YYYY"),
          };
          send_res.push(temp);
        }
        let total_row = await referral_invoice_model.get_count(
          condition,
          date_condition
        );
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
          payout_date: moment(val.payout_date).format("yyyy-MM-DD hh:mm"),
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
  update_invoice: async (req, res) => {
    try {
      let referral_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("referral_invoice_id")
      );

      let status = req.bodyString("status");
      var insdata = {
        status: status === "pending" ? 0 : 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        reference_number: req.bodyString("reference_number")
          ? req.bodyString("reference_number")
          : null,
        remark: req.bodyString("remark") ? req.bodyString("remark") : null,
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
  referrer_bonus_invoice: async (req, res) => {
    try {
      let referral_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("referral_invoice_id")
      );

      let sql = `select status, reference_number from ${config.table_prefix}referral_bonus_monthly_invoice where id = ${referral_invoice_id}`;

      let qb = await pool.get_connection();
      let response_res;
      try {
        response_res = await qb.query(sql);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }

      const send_res = {
        id: enc_dec.cjs_encrypt(referral_invoice_id),
        status: response_res[0].status == 0 ? "pending" : "paid",
        number: response_res[0].reference_number,
      };
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(send_res, "Invoice data."));
    } catch (error) {
      winston.error(error);

      res
        .status(statusCode.ok)
        .send(response.successdatamsg([], "Invoice data."));
    }
  },
  referral_bonus_list: async (req, res) => {
    let qb = await pool.get_connection();
    try {
      let limit = {
        perpage: 0,
        page: 0,
      };
      let search = {};
      let like_search = {};
      let date_condition = {};

      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));
        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      if (req.bodyString("from_date")) {
        date_condition.from_date = req.bodyString("from_date");
        date_condition.to_date = req.bodyString("to_date");
      }

      if (req.bodyString("country")) {
        search.country = await encrypt_decrypt(
          "decrypt",
          req.bodyString("country")
        );
      }

      if (req.bodyString("referral_code")) {
        search.referral_code = req.bodyString("referral_code");
      }

      if (req.bodyString("mobile_no")) {
        like_search.mobile_no = req.bodyString("mobile_no");
      }
      if (req.bodyString("referrer_name")) {
        like_search.full_name = req.bodyString("referrer_name");
      }
      if (req.bodyString("referrer_email")) {
        like_search.email = req.bodyString("referrer_email");
      }

      let total_Count = await referral_invoice_model.get_referral_earning_count(
        date_condition,
        search,
        like_search
      );

      referral_invoice_model
        .select_referral_list(date_condition, limit, search, like_search)
        .then(async (result) => {
          let send_res = [];

          for (val of result) {
            let needed_info = await qb
              .select("*")
              .where({ referral_code_used: val.referral_code })
              .get(config.table_prefix + "master_super_merchant");

            let referral_count = needed_info.length;

            let total_amount = await qb.query(
              "SELECT SUM(amount_to_settle) AS total_amount FROM pg_referral_bonus WHERE referrer_id = " +
                val.id
            );

            let country_name = await referral_invoice_model.get_name(
              "country",
              val?.country
            );

            let state_name = await referral_invoice_model.get_name(
              "states",
              val?.state
            );
            let city_name = await referral_invoice_model.get_name(
              "city",
              val?.city
            );

            let temp = {
              referrer_name: val?.full_name ? val?.full_name : "",
              referrer_email: val?.email ? val?.email : "",
              mobile_code: val?.mobile_code ? val?.mobile_code : "",
              mobile_no: val?.mobile_no ? val?.mobile_no : "",
              currency: val?.currency ? val?.currency : "",
              country: country_name[0]?.country_name
                ? country_name[0]?.country_name
                : "",
              state: state_name[0]?.state_name ? state_name[0]?.state_name : "",
              city: city_name[0]?.city_name ? city_name[0]?.city_name : "",
              referral_code: val?.referral_code ? val?.referral_code : "",
              total_referrals: referral_count,
              total_earning: total_amount[0].total_amount
                ? total_amount[0].total_amount
                : 0,
              created_at: moment(val.created_at).format("DD-MM-YYYY HH:mm:ss"),
            };
            send_res.push(temp);
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
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
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

    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
      date_condition.to_date = req.bodyString("to_date");
    }

    let total_count = await referral_invoice_model.total_details_count(
      condition,
      date_condition
    );

    referral_invoice_model
      .select_referral_details(condition, date_condition, limit)
      .then(async (result) => {
        let send_res = [];

        for (val of result) {
          let temp = {
            dec_merchant_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            name: val?.legal_business_name
              ? val?.legal_business_name
              : val?.name,
            email: val?.email ? val?.email : "",
            code: val?.code ? val?.code : "",
            mobile_no: val?.mobile_no ? val?.mobile_no : "",
            register_date: val?.register_at
              ? moment(val?.register_at).format("DD-MM-YYYY HH:mm:ss")
              : "",
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
  merchant_referral_bonus_details: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    let condition = {};
    let date_condition = {};
    let like_search = {};
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    if (req.bodyString("referral_code")) {
      condition["ref.referral_code"] = req.bodyString("referral_code");
    }
    if (req.bodyString("search")) {
      like_search["mm.company_name"] = req.bodyString("search");
      like_search["mm.legal_person_email"] = req.bodyString("search");
      like_search["mm.home_phone_number"] = req.bodyString("search");
    }
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
      date_condition.to_date = req.bodyString("to_date");
    }

    let total_count =
      await referral_invoice_model.get_merchant_referral_bonus_count(
        condition,
        date_condition,
        like_search
      );

    referral_invoice_model
      .get_merchant_referral_bonus(
        condition,
        date_condition,
        limit,
        like_search
      )
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let qb = await pool.get_connection();
          let total_amount;
          try {
            total_amount = await qb.query(
              "SELECT rb.amount_to_settle AS total_amount FROM pg_referral_bonus as rb left join pg_orders as ord on ord.order_id=rb.order_id  WHERE merchant_id = " +
                val.id
            );
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let temp = {
            dec_super_merchant_id: val?.supermerchant_id
              ? await helpers.formatNumber(val?.supermerchant_id)
              : "",
            dec_merchant_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            super_merchant: val?.legal_business_name
              ? val?.legal_business_name
              : "",
            super_merchant_email: val?.email ? val?.email : "",
            name: val?.company_name ? val?.company_name : "",
            email: val?.legal_person_email ? val?.legal_person_email : "",
            code: val?.home_phone_code ? val?.home_phone_code : "",
            mobile_no: val?.home_phone_number ? val?.home_phone_number : "",
            register_date: val?.register_at
              ? moment(val?.register_at).format("DD-MM-YYYY HH:mm:ss")
              : "",
            super_merchant_register_date: val?.super_merchant_register_date
              ? moment(val?.super_merchant_register_date).format(
                  "DD-MM-YYYY HH:mm:ss"
                )
              : "",
            referral_code_used: val?.referral_code ? val?.referral_code : "",
            total_earning: total_amount[0]
              ? total_amount[0].total_amount.toFixed(2)
              : 0.0,
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
  // referral_bonus_list_marchent: async (req, res) => {
  //     let limit = {
  //         perpage: 0,
  //         page: 0,
  //     };
  //     let condition = {};
  //     let date_condition = {};

  //     if (req.bodyString("perpage") && req.bodyString("page")) {
  //         perpage = parseInt(req.bodyString("perpage"));
  //         start = parseInt(req.bodyString("page"));
  //         limit.perpage = perpage;
  //         limit.start = (start - 1) * perpage;
  //     }

  //
  // },
  merchant_invoice_list: async (req, res) => {
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

    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );

    let condition = {
      ["r.super_merchant_id"]: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    if (selected_merchant != 0) {
      condition["r.submerchant_id"] = selected_merchant;
    }

    if (req.bodyString("month_year")) {
      condition.month = '"' + req.bodyString("month_year") + '"';
    }

    referral_invoice_model
      .merchant_invoice_list(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let settlement_data = await helpers.get_settlement(val.referrer_id);
          const settlementFrequency = settlement_data.settlement_frequency;
          const settlementInterval = settlement_data.settlement_date;
          const nextDueDate = await helpers.calculateDate(
            moment(val.payout_date).format("YYYY-MM-DD"),
            settlementInterval,
            settlementFrequency
          );
          let from_date = val.payout_date;
          let to_date = nextDueDate;
          let temp = {
            invoice_no: val?.id ? await helpers.formatNumber(val?.id) : "",
            data_id: enc_dec.cjs_encrypt(val.id),
            referrer_id: enc_dec.cjs_encrypt(val.referrer_id),
            referrer_name: val.full_name,
            month: val.month,
            from_date: moment(from_date).format("DD-MM-YYYY"),
            to_date: moment(to_date).format("DD-MM-YYYY"),
            no_of_successful_referral: val.no_of_successful_referral,
            bonus_earned_from_successful_referral:
              val.bonus_earned_from_successful_referral,
            total_tax: val.total_tax,
            total_bonus: val.total_bonus,
            status: val.status == 0 ? "Pending" : "Paid",
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
            payout_date: moment(val.payout_date).format("DD-MM-YYYY"),
          };
          send_res.push(temp);
        }
        let total_row = await referral_invoice_model.merchant_invoice_count(
          condition
        );

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

  merchant_referrer_list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    let condition = {};
    let search_string = {};

    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    if (req.user.type == "merchant") {
      let selected_merchant = enc_dec.cjs_decrypt(
        req.bodyString("selected_merchant")
      );
      condition["mm.super_merchant_id"] = req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id;
      if (selected_merchant != 0) {
        condition["mm.id"] = selected_merchant;
      }
    }
    if (req.bodyString("referral_code")) {
      condition["s.referral_code_used"] = req.bodyString("referral_code");
    }
    if (req.bodyString("merchant_id")) {
      condition["s.id"] = parseInt(req.bodyString("merchant_id"), 10);
    }

    if (req.bodyString("search")) {
      search_string["s.email"] = req.bodyString("search");
      search_string["s.mobile_no"] = req.bodyString("search");
      search_string["s.legal_business_name"] = req.bodyString("search");
    }
    let total_count = await referral_invoice_model.merchant_referral_count(
      condition,
      search_string
    );

    referral_invoice_model
      .get_merchant_referral_list(condition, search_string, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            dec_merchant_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            name: val?.legal_business_name
              ? val?.legal_business_name
              : val?.name,
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
  generateCron: async () => {
    await generate();
    return;
  },
  generateRequest: async (req, res) => {
    const result = await generate();
    return res.status(statusCode.ok).send(response.successdatamsg([], result));
  },
};

async function generate() {
  async function executeQuery(sql) {
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }

    return response;
  }

  async function insertIfNotExists(table, data, conditionSql) {
    const checkResult = await executeQuery(conditionSql);
    if (checkResult[0].record_count === 0) {
      let qb = await pool.get_connection();
      try {
        await qb.returning("id").insert(table, data);
      } catch (error) {
        console.error("Database query failed:", error);
      } finally {
        qb.release();
      }
    }
  }

  async function updateRecords(updateSql) {
    await executeQuery(updateSql);
  }

  function bonusSql(referrer_id) {
    return `SELECT
                                    currency,
                                    SUM(bonus) as bonus,
                                    GROUP_CONCAT(bonus_table_ids) as referrer_id_str,
                                    SUM(referring_amount) AS total_referred_amount,
                                    SUM(captured_amount) AS total_captured_amount,
                                    SUM(void_credit_amount) AS total_void_credit_amount,
                                    SUM(void_debit_amount) AS total_void_debit_amount,
                                    SUM(refund_amount) AS total_refund_amount
                                FROM
                                    (
                                    SELECT
                                        count(id) as bonus,
                                        currency,
                                        GROUP_CONCAT(id SEPARATOR ',') AS bonus_table_ids,
                                        SUM(
                                                    CASE WHEN txn_type IS NULL AND order_status IS NULL THEN amount ELSE 0
                                                END
                                        ) AS referring_amount,
                                        SUM(
                                            CASE WHEN txn_type = 'CAPTURE' THEN amount ELSE 0
                                        END
                                ) AS captured_amount,
                                SUM(
                                    CASE WHEN txn_type = 'VOID' AND void_status = 'CREDIT' THEN amount ELSE 0
                                END
                                ) AS void_credit_amount,
                                SUM(
                                    CASE WHEN txn_type = 'VOID' AND void_status = 'DEBIT' THEN amount ELSE 0
                                END
                                ) AS void_debit_amount,
                                SUM(
                                    CASE WHEN txn_type = 'PARTIAL_REFUND' || txn_type = 'REFUND' THEN amount ELSE 0
                                END
                                ) AS refund_amount
                                FROM
                                    ${config.table_prefix}referral_bonus
                                WHERE
                                    referrer_id = ${referrer_id} AND
                                STATUS = 0
                                GROUP BY
                                    txn_type,
                                    txn_id
                                ) subquery`;
  }

  let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let current_date = moment().format("YYYY-MM-DD");

  try {
    const payoutReferrerResult = await referrerPayoutModel.selectPayoutReferrer(
      current_date
    );

    if (payoutReferrerResult.length === 0) {
      return `No data found for the ${current_date}`;
    }

    const promises = payoutReferrerResult.map(async (refObject) => {
      const refInvoiceSql = `SELECT * FROM ${config.table_prefix}referral_bonus_monthly_invoice WHERE payout_date = "${current_date}" AND referrer_id = ${refObject.id} AND status=1`;
      const referrerBonusResult = await executeQuery(refInvoiceSql);

      if (!referrerBonusResult || referrerBonusResult.length === 0) {
        const referrerResult = await executeQuery(
          `SELECT * FROM ${config.table_prefix}referrers WHERE id = ${refObject.id}`
        );

        const settlementFrequency = referrerResult[0].settlement_frequency;
        const settlementInterval = referrerResult[0].settlement_date;
        const is_approved = referrerResult[0].is_approved;

        const referrerId = referrerResult[0].id;
        const taxPer = referrerResult[0].tax_per;
        const nextDueDate = await helpers.calculateDate(
          current_date,
          settlementInterval,
          settlementFrequency
        );

        const referrerPayoutResult = await referrerPayoutModel.selectPayout({
          referrer_id: referrerId,
          status: 0,
          payout_date: current_date,
        });

        if (referrerPayoutResult.length > 0) {
          const referrerBonusResult = await executeQuery(bonusSql(referrerId));
          const {
            bonus,
            currency,
            referrer_id_str,
            total_referred_amount,
            total_captured_amount,
            total_void_credit_amount,
            total_void_debit_amount,
            total_refund_amount,
          } = referrerBonusResult[0];

          if (bonus > 0 && is_approved === 0) {
            // 0 = approved
            const totalAmount =
              total_referred_amount +
              total_captured_amount +
              total_void_credit_amount -
              (total_void_debit_amount + total_refund_amount);
            const totalTax = totalAmount * (taxPer / 100);
            const totalBonus = totalAmount - totalTax;

            const invData = {
              referrer_id: referrerId,
              no_of_successful_referral: bonus,
              bonus_earned_from_successful_referral: totalAmount,
              total_tax: totalTax,
              total_bonus: totalBonus,
              created_at: created_at,
              payout_date: current_date,
            };

            const checkInvoiceSql = `SELECT count(id) as record_count FROM ${config.table_prefix}referral_bonus_monthly_invoice WHERE referrer_id = ${referrerId} AND payout_date = '${current_date}'`;
            await insertIfNotExists(
              `${config.table_prefix}referral_bonus_monthly_invoice`,
              invData,
              checkInvoiceSql
            );

            const updateSql = `UPDATE ${config.table_prefix}referral_bonus SET status = 1, updated_at = '${created_at}' WHERE id in(${referrer_id_str})`;
            await updateRecords(updateSql);
          }

          await referrerPayoutModel.updatePayout(
            { status: 1, updated_at: moment().format("YYYY-MM-DD HH:mm") },
            { id: referrerPayoutResult[0].id }
          );

          const payoutSql = `SELECT count(id) as record_count FROM ${config.table_prefix}referrer_invoice_payout WHERE referrer_id = ${referrerId} AND payout_date = '${nextDueDate}'`;
          const payoutResult = await executeQuery(payoutSql);

          if (payoutResult[0].record_count === 0) {
            await referrerPayoutModel.addPayout({
              referrer_id: referrerId,
              payout_date: nextDueDate,
            });
          }
        }
      }
    });

    await Promise.all(promises);

    return "Referral-bonus invoice generated successfully.";
  } catch (error) {
    winston.error(error);

    return `Something went wrong while invoice calculation: ${error.message}`;
  }

  /*
    let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
    let current_date = moment().format('YYYY-MM-DD');
    let qb = await pool.get_connection();

    
    try {
        let payoutReferrer_result = await referrerPayoutModel.selectPayoutReferrer(current_date);
        if (payoutReferrer_result.length === 0) {
            
            return `No data found for the ${current_date}`;
        }
        for (const refObject of payoutReferrer_result) {
            let refInvoiceSql = `SELECT * FROM ${config.table_prefix}referral_bonus_monthly_invoice WHERE payout_date = "${current_date}" AND referrer_id = ${refObject.id} AND status=1`;
            let referrer_bonus_result = await qb.query(refInvoiceSql);
            if (referrer_bonus_result && referrer_bonus_result.length === 0) {
                let total_amount = 0.0;
                let total_tax = 0.0;
                let total_bonus = 0.0;

                let referrer_result = await qb
                    .select("*")
                    .where({ id: refObject.id })
                    .get(config.table_prefix + "referrers");

                const settlement_frequency = referrer_result[0].settlement_frequency;
                const settlement_interval = referrer_result[0].settlement_date;
                const referrer_id = referrer_result[0].id;
                const tax_per = referrer_result[0].tax_per;
                let nextDueDate = await helpers.calculateDate(current_date, settlement_interval, settlement_frequency);
                

                let referrer_payout_result = await referrerPayoutModel.selectPayout({
                    referrer_id: referrer_id,
                    status: 0,
                    payout_date: current_date
                });
                if (referrer_payout_result.length > 0) {
                    //find the bonus 
                    let sql = `SELECT
                                    currency,
                                    count(bonus) as bonus,
                                    GROUP_CONCAT(bonus_table_ids) as referrer_id_str,
                                    SUM(referring_amount) AS total_referred_amount,
                                    SUM(captured_amount) AS total_captured_amount,
                                    SUM(void_credit_amount) AS total_void_credit_amount,
                                    SUM(void_debit_amount) AS total_void_debit_amount,
                                    SUM(refund_amount) AS total_refund_amount
                                FROM
                                    (
                                    SELECT
                                        count(id) as bonus,
                                        currency,
                                        GROUP_CONCAT(id SEPARATOR ',') AS bonus_table_ids,
                                        SUM(
                                                    CASE WHEN txn_type IS NULL AND order_status IS NULL THEN amount ELSE 0
                                                END
                                        ) AS referring_amount,
                                        SUM(
                                            CASE WHEN txn_type = 'CAPTURE' THEN amount ELSE 0
                                        END
                                ) AS captured_amount,
                                SUM(
                                    CASE WHEN txn_type = 'VOID' AND void_status = 'CREDIT' THEN amount ELSE 0
                                END
                                ) AS void_credit_amount,
                                SUM(
                                    CASE WHEN txn_type = 'VOID' AND void_status = 'DEBIT' THEN amount ELSE 0
                                END
                                ) AS void_debit_amount,
                                SUM(
                                    CASE WHEN txn_type = 'PARTIAL_REFUND' || txn_type = 'REFUND' THEN amount ELSE 0
                                END
                                ) AS refund_amount
                                FROM
                                    ${config.table_prefix}referral_bonus
                                WHERE
                                    referrer_id = ${referrer_id} AND
                                STATUS = 0
                                GROUP BY
                                    txn_type,
                                    txn_id
                                ) subquery`;
                    // let sql = `SELECT 
                    //         COUNT(id) AS bonus,
                    //         SUM(amount) AS total_bonus_sum,
                    //         currency,
                    //         GROUP_CONCAT(id SEPARATOR ',') AS referrer_id_str 
                    //        FROM ${config.table_prefix}referral_bonus 
                    //        WHERE  referrer_id = ${referrer_id} 
                    //        AND status = 0`;// 0= pending
                    let referrer_bonus_result = await qb.query(sql);
                    const { bonus, currency, referrer_id_str, total_referred_amount, total_captured_amount, total_void_credit_amount, total_void_debit_amount, total_refund_amount } = referrer_bonus_result[0];
                    if (bonus > 0) {
                        // let tax_per = await qb
                        //     .select("tax_per")
                        //     .where({ currency: currency, deleted: 0 })
                        //     .get(config.table_prefix + "master_referral_bonus");
                        

                        total_amount = ((total_referred_amount + total_captured_amount + total_void_credit_amount) - (total_void_debit_amount + total_refund_amount));
                        total_tax = total_amount * (tax_per / 100);
                        total_bonus = total_amount - total_tax;

                        let inv_data = {
                            referrer_id: referrer_id,
                            no_of_successful_referral: bonus,
                            bonus_earned_from_successful_referral: total_amount,
                            total_tax: total_tax,
                            total_bonus: total_bonus,
                            created_at: created_at,
                            payout_date: current_date
                        };

                        // add invoice data
                        let checkInvoice_sql = `SELECT  count(id) as record_count  FROM ${config.table_prefix}referral_bonus_monthly_invoice WHERE referrer_id = ${referrer_id} AND payout_date = '${current_date}'`;
                        let checkInvoiceResult = await qb.query(checkInvoice_sql);
                        if (checkInvoiceResult[0].record_count === 0) {
                            await qb.returning("id").insert(`${config.table_prefix}referral_bonus_monthly_invoice`, inv_data);
                        }
                       

                        //update all bonus which are calculated
                        let updateSql = `UPDATE ${config.table_prefix}referral_bonus
                                SET status = 1, updated_at = '${created_at}'
                                WHERE id in(${referrer_id_str})`;// 1=Invoice calculated
                        await qb.query(updateSql);
                    }
                    //update old date status
                    await referrerPayoutModel.updatePayout({ status: 1, updated_at: moment().format('YYYY-MM-DD HH:mm') }, { id: referrer_payout_result[0].id });

                    //added new payout date 
                    let payout_sql = `SELECT  count(id) as record_count  FROM ${config.table_prefix}referrer_invoice_payout WHERE referrer_id = ${referrer_id} AND payout_date = '${nextDueDate}'`;
                    let payout_result = await qb.query(payout_sql);
                    if (payout_result[0].record_count === 0) {
                        await referrerPayoutModel.addPayout({
                            referrer_id: referrer_id,
                            payout_date: nextDueDate,
                        });
                    }
                }
            }
        }
        qb.release();
        
        return 'Referral-bonus invoice generated successfully.';
    } catch (error) {
        qb.release();
        
        
        return "Something went wrong while invoice calculation".error.message;
    }*/

  /* old code start from here
    // let merchant_id = enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    and_filter_obj.referrer_id = referrer_id[0].id;

    let month_year = req.bodyString("month_year"); // format will be Name Year ( Jan-2023 )
    const date = moment(month_year, "MMM-YYYY");
    const firstDayOfMonth = date.startOf("month").format("YYYY-MM-DD");
    date_condition.from_date = firstDayOfMonth;
    const lastDayOfMonth = date.endOf("month").format("YYYY-MM-DD");
    date_condition.to_date = lastDayOfMonth;

    let dataFound = await qb
        .select("*")
        .where({ referrer_id: referrer_id[0].id, month: month_year })
        .get(config.table_prefix + "referral_bonus_monthly_invoice");

    
    try {
        if (dataFound.length === 0) {
            let currency = await qb
                .select("currency")
                .where({ referrer_id: referrer_id[0].id })
                .get(config.table_prefix + "referral_bonus");

            

            let tax_per = await qb
                .select("tax_per")
                .where({ currency: currency[0].currency })
                .get(config.table_prefix + "master_referral_bonus");

            

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
                        referrer_id: enc_dec.cjs_encrypt(
                            inv_data.referrer_id
                        ),
                        month: inv_data.month,
                        from_date: inv_data.from_date,
                        to_date: inv_data.to_date,
                        no_of_successful_referral:
                            inv_data.no_of_successful_referral,
                        bonus_earned_from_successful_referral:
                            inv_data.bonus_earned_from_successful_referral,
                        total_tax: inv_data.total_tax,
                        total_bonus: inv_data.total_bonus,
                        status: inv_data.status == 0 ? "Pending" : "Paid",
                        created_at: inv_data.created_at,
                    };
                    send_res.push(temp);

                    res.status(statusCode.ok).send(
                        response.successdatamsg(
                            send_res,
                            "Referral-bonus invoice generated successfully."
                        )
                    );
                })
                .catch((error) => {
                    
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });
        } else {
            res.status(statusCode.ok).send(
                response.errormsg(
                    "No data available for currency or month."
                )
            );
        }
    } catch (error) {
            winston.error(error);
        res.status(statusCode.ok).send(
            response.errormsg("No data available for currency or month.")
        );
    }
    */
}

module.exports = referral_bonus_invoice;
