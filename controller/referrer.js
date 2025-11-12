let statusCode = require("../utilities/statuscode/index");
let response = require("../utilities/response/ServerResponse");
let helpers = require("../utilities/helper/general_helper");
let enc_dec = require("../utilities/decryptor/decryptor");
let referrer_model = require("../models/referrer_model");
const date_formatter = require("../utilities/date_formatter/index");
var uuid = require("uuid");
let { authenticator } = require("otplib");
let mailSender = require("../utilities/mail/mailsender");
let merchantToken = require("../utilities/tokenmanager/merchantToken");
let QRCode = require("qrcode");
let moment = require("moment");
let env = process.env.ENVIRONMENT;
let config = require("../config/config.json")[env];
let pool = require("../config/database");
let referral_invoice_model = require("../models/referral_bonus_invoice_model");
let currency = require("./currency");
let inv = require("./invoice");
const winston = require("../utilities/logmanager/winston");
const nodeCache = require("../utilities/helper/CacheManeger");

let calc_amount = async (and_filter_obj, date_condition, tax_per) => {
  let total_count = 0;
  let total_amount = 0.0;
  let total_tax = 0.0;
  let total_bonus = 0.0;
  await referral_invoice_model
    .select(and_filter_obj, date_condition)
    .then((res) => {
      total_count = res.length;
      for (item of res) {
        total_amount = total_amount + item.amount_to_settle;
      }
      // total_tax = total_amount * (tax_per / 100);
      total_bonus = total_amount;
    })
    .catch((err) => {
      winston.error(err);
    });

  let inv_data = {
    no_of_successful_referral: total_count,
    bonus_earned_from_successful_referral: total_amount.toFixed(2),
    total_tax: total_tax.toFixed(2),
    total_bonus: total_bonus.toFixed(2),
  };

  return inv_data;
};

var referrer = {
  add: async (req, res) => {
    let state_id = await enc_dec.cjs_decrypt(req.bodyString("state"));
    let country_id = await enc_dec.cjs_decrypt(req.bodyString("country"));
    let city_id = await enc_dec.cjs_decrypt(req.bodyString("city"));
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let currency = await helpers.get_referrer_currency_by_country(country_id);
    let ins_data = {
      full_name: req.bodyString("name"),
      email: req.bodyString("email"),
      mobile_no: req.bodyString("mobile_no"),
      mobile_code: req.bodyString("mobile_code"),
      password: enc_dec.cjs_encrypt(req.bodyString("password")),
      status: 0,
      referral_code: await helpers.make_referral_code("REF"),
      currency: currency,
      bank_name: req.bodyString("bank_name"),
      branch_name: req.bodyString("branch_name"),
      account_number: req.bodyString("bank_account_no"),
      name_on_the_bank_account: req.bodyString("name_on_the_bank_account"),
      address: req.bodyString("address"),
      national_id: req?.all_files?.national_id,
      // national_id: req.bodyString('national_id'),
      iban: req.bodyString("iban"),
      bic_swift: req.bodyString("bic_swift"),
      country: country_id,
      state: state_id,
      city: city_id,
      zip_code: req.bodyString("zip_code"),
      deleted: 0,
      created_at: added_date,
      updated_at: added_date,
      fix_amount_for_reference: null,
      fix_amount: null,
      per_amount: null,
      apply_greater: null,
      settlement_date: null,
      ref_validity: null,
      settlement_frequency: null,
      calculate_bonus_till: null,
      tax_per: null,
    };
    let auto_approve = await helpers.check_auto_approval_of_referrer();
    let master_bonus = await helpers.get_master_referrer_by_currency(currency);

    if (master_bonus) {
      (ins_data.fix_amount_for_reference =
        master_bonus.fix_amount_for_reference),
        (ins_data.fix_amount = master_bonus.fix_amount),
        (ins_data.per_amount = master_bonus.per_amount),
        (ins_data.apply_greater = master_bonus.apply_greater),
        (ins_data.settlement_date = master_bonus.settlement_date),
        (ins_data.ref_validity = moment()
          .add(master_bonus.calculate_bonus_till, "days")
          .format("YYYY-MM-DD")),
        (ins_data.settlement_frequency = master_bonus.settlement_frequency),
        (ins_data.calculate_bonus_till = master_bonus.calculate_bonus_till),
        (ins_data.tax_per = master_bonus.tax_per);
    }
    if (auto_approve == true) {
      ins_data.is_approved = 0;
    } else {
      ins_data.is_approved = 1;
    }

    referrer_model
      .add(ins_data)
      .then(async (result) => {
        let two_fa_token = uuid.v1();
        let two_fa_secret = authenticator.generateSecret();
        let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let two_fa_data = {
          token: two_fa_token,
          secret: two_fa_secret,
          referrer_id: result.insert_id,
          created_at: created_at,
        };
        let result_2fa = await referrer_model.add_two_fa(two_fa_data);
        let verify_url =
          process.env.FRONTEND_URL_MERCHANT + "verify-referer/" + two_fa_token;
        let title = await helpers.get_title();
        let subject = "Welcome to " + title;

        await mailSender.welcomeMailRef(
          req.bodyString("email"),
          subject,
          verify_url
        );
        res
          .status(statusCode.ok)
          .send(
            response.successmsg(
              "Register successfully, please verify your email."
            )
          );
      })
      .catch((error) => {
        winston.error(err);
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
    if (req.bodyString("currency")) {
      condition.currency = req.bodyString("currency");
    }
    let search = {};
    if (req.bodyString("search_string")) {
      condition.referral_code = req.bodyString("search_string");
    }
    if (req.bodyString("search")) {
      search["email"] = req.bodyString("search");
      search["full_name"] = req.bodyString("search");
      search["mobile_no"] = req.bodyString("search");
    }
    referrer_model
      .select(condition, limit, search)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let and_filter_obj = {
            referrer_id: val.id,
          };

          const currentDate = moment().format("YYYY-MM-DD");

          const month_start_date = moment()
            .startOf("month")
            .format("YYYY-MM-DD");

          // Get the start date of the previous month
          const pre_month_start_date = moment()
            .subtract(1, "months")
            .startOf("month")
            .format("YYYY-MM-DD");

          // Get the end date of the previous month
          const pre_month_end_date = moment()
            .subtract(1, "months")
            .endOf("month")
            .format("YYYY-MM-DD");

          // Calculate the "from" date as 1 year ago
          const year_from_date = moment()
            .subtract(1, "year")
            .format("YYYY-MM-DD");

          let tax_per;
          let qb = await pool.get_connection();
          try {
            tax_per = await qb
              .select("tax_per")
              .where({ currency: val.currency })
              .get(config.table_prefix + "master_referral_bonus");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let cur_month_earning_result = await referrer_model.getTotalAmount({
            referrer_id: val.id,
            from_date: month_start_date,
            to_date: currentDate,
          });
          let cur_month_earning = await referrer_model.getBonusData(
            cur_month_earning_result
          );
          // let cur_month_earning = await calc_amount(
          //     and_filter_obj,
          //     {
          //         from_date: month_start_date,
          //         to_date: currentDate,
          //     },
          //     val.tax_per
          // );

          //let cur_month_earning = cur_month_earning_result

          let prev_month_earning_result = await referrer_model.getTotalAmount({
            referrer_id: val.id,
            from_date: pre_month_start_date,
            to_date: pre_month_end_date,
          });
          let prev_month_earning = await referrer_model.getBonusData(
            prev_month_earning_result
          );

          // let prev_month_earning = await calc_amount(
          //     and_filter_obj,
          //     {
          //         from_date: pre_month_start_date,
          //         to_date: pre_month_end_date,
          //     },
          //     val.tax_per
          // );

          let cur_year_earning_result = await referrer_model.getTotalAmount({
            referrer_id: val.id,
            from_date: year_from_date,
            to_date: currentDate,
          });
          let cur_year_earning = await referrer_model.getBonusData(
            cur_year_earning_result
          );

          // let cur_year_earning = await calc_amount(
          //     and_filter_obj,
          //     {
          //         from_date: year_from_date,
          //         to_date: currentDate,
          //     },
          //     val.tax_per
          // );
          var today = await date_formatter.current_date();
          var expiry_date = await date_formatter.insert_date(val.expiry_date);
          if (
            (expiry_date >= today || val.expiry_date == null) &&
            val.status == 0
          ) {
            var status = "Active";
          } else if (
            (expiry_date >= today || val.expiry_date == null) &&
            val.status == 1
          ) {
            var status = "Deactivated";
          } else {
            var status = "Expired";
          }
          let temp = {
            referrer_id: enc_dec.cjs_encrypt(val.id),
            name: val?.full_name ? val?.full_name : "",
            email: val?.email ? val?.email : "",
            mobile_no: val.mobile_code + " " + val.mobile_no,
            status: status,
            is_approved: val.is_approved == 0 ? "Approved" : "Pending",
            referral_code: val?.referral_code ? val?.referral_code : "",
            currency: val.currency,
            referrer_currency: await helpers.get_referrer_currency_by_country(
              val.country
            ),
            bank_name: val?.bank_name ? val?.bank_name : "",
            branch_name: val?.branch_name ? val?.branch_name : "",
            account_no: val?.account_number ? val?.account_number : "",
            address: val?.address ? val?.address : "",
            iban: val?.iban ? val?.iban : "",
            bic_swift: val?.bic_swift ? val?.bic_swift : "",
            name_on_the_bank_account: val?.name_on_the_bank_account
              ? val?.name_on_the_bank_account
              : "",
            country: val?.country ? await enc_dec.cjs_encrypt(val.country) : "",
            state: val?.state ? await enc_dec.cjs_encrypt(val.state) : "",
            city: val?.city ? await enc_dec.cjs_encrypt(val.city) : "",
            country_name: val?.country
              ? await helpers.get_country_name_by_id(val.country)
              : "",
            state_name: val?.state
              ? await helpers.get_state_name_by_id(val.state)
              : "",
            city_name: val?.city
              ? await helpers.get_city_name_by_id(val.city)
              : "",
            zip_code: val?.zip_code ? val?.zip_code : "",
            national_id: val?.national_id
              ? process.env.STATIC_URL + "/static/files/" + val.national_id
              : "",
            cur_month_earning: cur_month_earning,
            prev_month_earning: prev_month_earning,
            cur_year_earning: cur_year_earning,
            expiry_date: val.expiry_date
              ? await date_formatter.get_date(val.expiry_date)
              : "",
          };

          send_res.push(temp);
        }
        let total_count = await referrer_model.get_count(condition, search);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Referrer list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  profile: async (req, res) => {
    referrer_model
      .selectOne("*", { id: req.user.id })
      .then(async (result) => {
        let condition = {
          referral_code_used: result.referral_code,
          email_verified: 1,
          mobile_no_verified: 0,
        };
        let merchant_onboarded = await referrer_model.onboarding_list(
          condition
        );
        let count_onboard = await referrer_model.get_count_data_referrer_(
          result.referral_code,
          0
        );
        let payout_date = await helpers.get_monthly_invoice_payout_date({
          referrer_id: req.user.id,
        });
        let settlement_data = await helpers.get_settlement(req.user.id);
        const settlementFrequency = settlement_data.settlement_frequency;
        const settlementInterval = settlement_data.settlement_date;

        let date_condition = {};
        if (payout_date) {
          const preDueDate = await helpers.calculateDate(
            moment(payout_date).format("YYYY-MM-DD"),
            settlementInterval,
            settlementFrequency
          );
          let from_date = moment(payout_date).format("YYYY-MM-DD");
          let to_date = preDueDate;
          (date_condition.from_date = from_date),
            (date_condition.to_date = to_date);
        }

        let get_amount = await referrer_model.get_due_referral_amount(
          { status: 0, referrer_id: req.user.id },
          date_condition
        );

        var due_amount = 0;

        for (i = 0; i < get_amount.length; i++) {
          // subtotal
          var tot_due_amount = 0;
          if (
            get_amount[i].order_status == "CAPTURED" ||
            get_amount[i].order_status == null
          ) {
            tot_due_amount = parseFloat(get_amount[i].amount_to_settle);
          } else if (get_amount[i].order_status == "VOID") {
            tot_due_amount =
              get_amount[i].void_status == "DEBIT"
                ? -parseFloat(get_amount[i].amount_to_settle)
                : parseFloat(get_amount[i].amount_to_settle);
          } else {
            tot_due_amount = -parseFloat(get_amount[i].amount_to_settle);
          }
          due_amount += tot_due_amount;
        }
        let merchant_onboarded_res = [];
        for (val of merchant_onboarded) {
          let temp = {
            merchant_id: enc_dec.cjs_encrypt(val.id),
            merchant_name: val.legal_business_name
              ? val.legal_business_name
              : await helpers.get_merchantdetails_name_by_id(
                  await helpers.get_merchant_id(val.id)
                ),
            email: val.email,
            mobile_code: val.code,
            mobile: val.mobile_no,
            onboard_date: val.register_at
              ? moment(val.register_at).format("DD-MM-YYYY hh:mm:ss")
              : "",
            email_verified: val.email_verified,
            mobile_verified: val.mobile_no_verified,
            password: val.password ? val.password : "",
          };
          merchant_onboarded_res.push(temp);
        }

        // let search_condition = {};
        // if (result.language) {
        //   search_condition.id = result.language;
        // } else {
        //   (search_condition.status = 0), (search_condition.deleted = 0);
        // }
        // let language = await helpers.get_first_active_language_json(
        //   search_condition
        // );
        let language_id = enc_dec.cjs_encrypt(result.language + "");
        let language = await nodeCache.getActiveLanguageById(language_id);

        var today = await date_formatter.current_date();
        var expiry_date = await date_formatter.insert_date(result.expiry_date);
        if (
          (expiry_date >= today || result.expiry_date == null) &&
          result.status == 0
        ) {
          var status = "Active";
        } else if (
          (expiry_date >= today || result.expiry_date == null) &&
          result.status == 1
        ) {
          var status = "Deactivated";
        } else {
          var status = "Expired";
        }
        let send_res = {
          referrer_id: enc_dec.cjs_encrypt(result.id),
          name: result.full_name,
          email: result.email,
          mobile_code: result.mobile_code,
          mobile_no: result.mobile_no,
          status: result.status == 0 ? "Active" : "Deactivated",
          is_approved: result.is_approved == 0 ? "Approved" : "Pending",
          is_read_notification:
            result.is_read_notification === 1 ? "read" : "unread",
          referral_code: result.referral_code,
          currency: result.currency,
          bank_name: result.bank_name,
          branch_name: result.branch_name,
          account_no: result.account_number != "" ? result.account_number : "",
          address: result.address,
          iban: result.iban,
          bic_swift: result.bic_swift,
          name_on_the_bank_account: result.name_on_the_bank_account,
          country: result.country ? enc_dec.cjs_encrypt(result.country) : "",
          state: result.state ? enc_dec.cjs_encrypt(result.state) : "",
          city: result.city ? enc_dec.cjs_encrypt(result.city) : "",
          country_name: await helpers.get_country_name_by_id(result.country),
          state_name: await helpers.get_state_name_by_id(result.state),
          city_name: await helpers.get_city_name_by_id(result.city),
          zip_code: result.zip_code,
          national_id: result.national_id
            ? process.env.STATIC_URL + "/static/files/" + result.national_id
            : "",
          bank_detail_document: result.bank_detail_document
            ? process.env.STATIC_URL +
              "/static/files/" +
              result.bank_detail_document
            : "",
          national_id_name:
            result.national_id != null ? result.national_id : "",
          total_merchant_onboarded: count_onboard,
          merchant_onboarded: merchant_onboarded_res,
          theme: result.theme,
          language_data: language,
          fix_amount_for_reference:
            result?.fix_amount_for_reference ||
            result?.fix_amount_for_reference === 0
              ? result.fix_amount_for_reference
              : "",
          fix_amount:
            result?.fix_amount || result?.fix_amount === 0
              ? result.fix_amount
              : "",
          per_amount:
            result?.per_amount || result?.per_amount === 0
              ? result.per_amount
              : "",
          apply_greater: result?.apply_greater ? result.apply_greater : "",
          settlement_frequency: result?.settlement_frequency
            ? result?.settlement_frequency
            : "",
          settlement_date:
            result?.settlement_date || result?.settlement_date === 0
              ? result.settlement_date
              : "",
          calculate_bonus_till:
            result?.calculate_bonus_till || result?.calculate_bonus_till === 0
              ? result.calculate_bonus_till
              : "",
          tax_per:
            result?.tax_per || result?.tax_per === 0 ? result.tax_per : "",
          expired_status: status,
          expiry_date: result.expiry_date
            ? await date_formatter.get_date(result.expiry_date)
            : "",
          due_amount: get_amount
            ? result.currency + " " + Number(due_amount).toFixed(2)
            : "0.00",
        };
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Profile details fetched successfully."
            )
          );
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));

    referrer_model
      .selectOne("*", { id: id })
      .then(async (result) => {
        let and_filter_obj = {
          referrer_id: id,
        };

        const currentDate = moment().format("YYYY-MM-DD");

        const month_start_date = moment().startOf("month").format("YYYY-MM-DD");

        // Get the start date of the previous month
        const pre_month_start_date = moment()
          .subtract(1, "months")
          .startOf("month")
          .format("YYYY-MM-DD");

        // Get the end date of the previous month
        const pre_month_end_date = moment()
          .subtract(1, "months")
          .endOf("month")
          .format("YYYY-MM-DD");

        // Calculate the "from" date as 1 year ago
        const year_from_date = moment()
          .subtract(1, "year")
          .format("YYYY-MM-DD");

        let tax_per;
        let qb = await pool.get_connection();
        try {
          tax_per = await qb
            .select("tax_per")
            .where({ currency: result.currency })
            .get(config.table_prefix + "master_referral_bonus");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        let cur_month_earning = await calc_amount(
          and_filter_obj,
          {
            from_date: month_start_date,
            to_date: currentDate,
          },
          result.tax_per
        );

        let prev_month_earning = await calc_amount(
          and_filter_obj,
          {
            from_date: pre_month_start_date,
            to_date: pre_month_end_date,
          },
          result.tax_per
        );

        let cur_year_earning = await calc_amount(
          and_filter_obj,
          {
            from_date: year_from_date,
            to_date: currentDate,
          },
          result.tax_per
        );

        let condition = { referral_code_used: result.referral_code };
        let merchant_onboarded = await referrer_model.onboarding_list(
          condition
        );
        let merchant_onboarded_res = [];
        for (val of merchant_onboarded) {
          let temp = {
            merchant_id: enc_dec.cjs_encrypt(val.id),
            merchant_name: val.legal_business_name,
            email: val.email,
            mobile_code: val.code,
            mobile: val.mobile_no,
            onboard_date: val.register_at,
          };
          merchant_onboarded_res.push(temp);
        }
        var today = await date_formatter.current_date();
        var expiry_date = await date_formatter.insert_date(result.expiry_date);
        if (
          (expiry_date >= today || result.expiry_date == null) &&
          result.status == 0
        ) {
          var status = "Active";
        } else if (
          (expiry_date >= today || result.expiry_date == null) &&
          result.status == 1
        ) {
          var status = "Deactivated";
        } else {
          var status = "Expired";
        }
        let send_res = {
          referrer_id: enc_dec.cjs_encrypt(result.id),
          name: result?.full_name ? result?.full_name : "",
          email: result?.email ? result?.email : "",
          mobile_code: result?.mobile_code ? result?.mobile_code : "",
          mobile_no: result?.mobile_no ? result?.mobile_no : "",
          status: status,
          is_approved: result.is_approved == 0 ? "Approved" : "Pending",
          referral_code: result?.referral_code ? result?.referral_code : "",
          currency: result?.currency ? result?.currency : "",
          bank_name: result?.bank_name ? result?.bank_name : "",
          branch_name: result?.branch_name ? result?.branch_name : "",
          account_no: result.account_number != "" ? result.account_number : "",
          address: result?.address ? result?.address : "",
          iban: result?.iban ? result?.iban : "",
          bic_swift: result?.bic_swift ? result?.bic_swift : "",
          name_on_the_bank_account: result?.name_on_the_bank_account
            ? result?.name_on_the_bank_account
            : "",
          country: result?.country
            ? result?.country
            : ""
            ? enc_dec.cjs_encrypt(result.country)
            : "",
          state: result?.state ? enc_dec.cjs_encrypt(result.state) : "",
          city: result?.city ? enc_dec.cjs_encrypt(result.city) : "",
          country_id: result.country ? enc_dec.cjs_encrypt(result.country) : "",
          country_name: await helpers.get_country_name_by_id(result.country),
          state_name: await helpers.get_state_name_by_id(result.state),
          city_name: await helpers.get_city_name_by_id(result.city),
          zip_code: result?.zip_code ? result?.zip_code : "",
          national_id: result?.national_id
            ? process.env.STATIC_URL + "/static/files/" + result.national_id
            : "",
          bank_detail_document: result?.bank_detail_document
            ? process.env.STATIC_URL +
              "/static/files/" +
              result.bank_detail_document
            : "",
          total_merchant_onboarded: merchant_onboarded_res.length,
          merchant_onboarded: merchant_onboarded_res,
          fix_amount_for_reference:
            result?.fix_amount_for_reference ||
            result?.fix_amount_for_reference === 0
              ? result.fix_amount_for_reference.toFixed(2)
              : "",
          fix_amount:
            result?.fix_amount || result?.fix_amount === 0
              ? result.fix_amount.toFixed(2)
              : "",
          per_amount:
            result?.per_amount || result?.per_amount === 0
              ? result.per_amount.toFixed(2)
              : "",
          apply_greater: result?.apply_greater ? result.apply_greater : "",
          settlement_frequency: result?.settlement_frequency
            ? result?.settlement_frequency
            : "",
          settlement_date:
            result?.settlement_date || result?.settlement_date === 0
              ? result.settlement_date
              : "",
          calculate_bonus_till:
            result?.calculate_bonus_till || result?.calculate_bonus_till === 0
              ? result.calculate_bonus_till
              : "",
          tax_per:
            result?.tax_per || result?.tax_per === 0
              ? result.tax_per.toFixed(2)
              : "",
          cur_month_earning: cur_month_earning,
          prev_month_earning: prev_month_earning,
          cur_year_earning: cur_year_earning,
          register_at: result.created_at
            ? moment(result.created_at).format("DD-MM-YYYY hh:mm:ss")
            : "",
          expiry_date: result.expiry_date
            ? await date_formatter.get_date(result.expiry_date)
            : "",
          expiry_date_edit: result.expiry_date
            ? await date_formatter.insert_date(result.expiry_date)
            : "",
          referrer_validity: result.ref_validity
            ? await date_formatter.get_date(result.ref_validity)
            : "",
        };
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(err);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  delete: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
    let update_data = { deleted: 1 };
    referrer_model
      .updateDetails({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referrer deleted successfully."));
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    let referrer_id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));

    referrer_model
      .selectOne("email,mobile_no,is_approved", { id: referrer_id })
      .then(async (result) => {
        let deactivate_ref = result.is_approved;
        let duplicate_email = false;
        if (result.email != req.bodyString("email")) {
          let email_exits = await referrer_model.selectSome({
            email: req.bodyString("email"),
          });

          if (email_exits) {
            duplicate_email = email_exits.length > 0 ? true : false;
          }
        }
        let duplicate_mobile = false;
        if (result.mobile_no != req.bodyString("mobile_no")) {
          let mobile_exits = await referrer_model.selectSome({
            mobile_no: req.bodyString("mobile_no"),
          });
          if (mobile_exits) {
            duplicate_mobile = mobile_exits.length > 0 ? true : false;
          }
        }
        if (duplicate_email) {
          res
            .status(statusCode.ok)
            .send(
              response.errormsg(
                "Email already exits, please try with another email id."
              )
            );

          //  else {
          //     res.status(statusCode.ok).send(
          //         response.errormsg(
          //             "Mobile no already exits, please try with another mobile no."
          //         )
          //     );
          // }
        } else {
          let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
          let state_id = await enc_dec.cjs_decrypt(req.bodyString("state"));
          let country_id = await enc_dec.cjs_decrypt(req.bodyString("country"));
          let city_id = await enc_dec.cjs_decrypt(req.bodyString("city"));
          let created_at_details = await referrer_model.selectOne(
            "created_at",
            { id: referrer_id }
          );

          let ref_validity = moment(moment(created_at_details.created_at))
            .add(req.body.calculate_bonus_till, "days")
            .format("YYYY-MM-DD");
          let expiry_date =
            req.bodyString("expiry_date") != ""
              ? await date_formatter.insert_date(req.bodyString("expiry_date"))
              : null;
          let ins_data = {
            full_name: req.bodyString("name"),
            email: req.bodyString("email"),
            mobile_no: req.bodyString("mobile_no"),
            mobile_code: req.bodyString("mobile_code"),
            currency: req.bodyString("currency"),
            bank_name: req.bodyString("bank_name"),
            account_number: req.bodyString("bank_account_no"),
            branch_name: req.bodyString("branch_name"),
            name_on_the_bank_account: req.bodyString(
              "name_on_the_bank_account"
            ),
            address: req.bodyString("address"),
            iban: req.bodyString("iban"),
            bic_swift: req.bodyString("bic_swift"),
            country: country_id,
            state: state_id,
            city: city_id,
            zip_code: req.bodyString("zip_code"),
            national_id: req?.all_files?.national_id,
            bank_detail_document: req?.all_files?.bank_detail_document,
            updated_at: added_date,
            ref_validity: ref_validity,
            fix_amount_for_reference: req.bodyString(
              "fix_amount_for_reference"
            ),
            fix_amount: req.bodyString("fix_amount"),
            per_amount: req.bodyString("per_amount"),
            apply_greater: req.bodyString("apply_greater"),
            settlement_date: req.bodyString("settlement_date"),
            settlement_frequency: req.bodyString("settlement_frequency"),
            calculate_bonus_till: req.bodyString("calculate_bonus_till"),
            tax_per: req.bodyString("tax_per"),
            status: req.bodyString("status"),
            is_approved: req.bodyString("referral_status"),
            ref_validity: ref_validity,
            expiry_date: expiry_date,
          };
          referrer_model
            .updateDetails({ id: referrer_id }, ins_data)
            .then(async (result) => {
              if (
                req.bodyString("referral_status") == 0 &&
                deactivate_ref == 1
              ) {
                let activate_url =
                  process.env.FRONTEND_URL_MERCHANT + "referrer-login";
                let title = await helpers.get_title();
                let subject = "Welcome to " + title;

                await mailSender.activationMail(
                  req.bodyString("email"),
                  subject,
                  activate_url
                );
              }

              res
                .status(statusCode.ok)
                .send(response.successmsg("Referrer updated successfully."));
            })
            .catch((error) => {
              winston.error(err);

              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  activate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
    let update_data = { status: 0 };
    referrer_model
      .updateDetails({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referrer activated successfully."));
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  deactivate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
    let update_data = { status: 1 };
    referrer_model
      .updateDetails({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referrer deactivated successfully."));
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  approve: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
    let update_data = { is_approved: 1 };
    referrer_model
      .updateDetails({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Referrer approved successfully."));
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  onboard: async (req, res) => {
    let referral_code = req.bodyString("referral_code");

    let condition = { ["sm.referral_code_used"]: referral_code };
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
    const filter = {};
    const search_by_id = {};
    let date_condition = {};
    if (search_text) {
      filter["sm.legal_business_name"] = search_text;
      filter["sm.email"] = search_text;
      filter["sm.mobile_no"] = search_text;
    }
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }
    if (req.bodyString("ekyc_status")) {
      if (req.bodyString("ekyc_status") == "ekyc_pending") {
        condition["m.ekyc_required"] = 1;
        condition["m.ekyc_done"] = 1; //1=pending, 2= Approved
        condition["m.onboarding_done"] = 1;
      }
      if (req.bodyString("ekyc_status") == "onboarding_pending") {
        condition["m.onboarding_done"] = 0;
      }
      if (req.bodyString("ekyc_status") == "ekyc_done") {
        condition["m.ekyc_done"] = 2;
        condition["m.ekyc_required"] = 1;
        condition["m.onboarding_done"] = 1;
      }
      if (req.bodyString("ekyc_status") == "onboarding_done") {
        condition["m.ekyc_required"] = 0;
        condition["m.onboarding_done"] = 1;
      }
      if (req.bodyString("ekyc_status") == "ekyc_denied") {
        condition["m.ekyc_required"] = 1;
        condition["m.ekyc_done"] = 3;
      }
    }
    if (req.bodyString("submerchant_id")) {
      search_by_id.id = parseInt(req.bodyString("submerchant_id"), 10);
    }
    referrer_model
      .onboarding_select(condition, filter, date_condition, limit, search_by_id)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            merchant_id: await enc_dec.cjs_encrypt(val.id),
            dec_merchant_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            dec_submerchant_id: val?.submerchant_id
              ? await helpers.formatNumber(val?.submerchant_id)
              : "",
            merchant_name: val.legal_business_name
              ? val.legal_business_name
              : await helpers.get_merchantdetails_name_by_id(
                  await helpers.get_merchant_id(val.id)
                ),
            email: val.email ? val.email : "",
            mobile_code: val.code ? val.code : "",
            mobile: val.mobile_no ? "+" + val.code + " " + val.mobile_no : "",
            register_at: val.register_at
              ? moment(val.register_at).format("DD-MM-YYYY HH:mm:ss")
              : "-",
            onboard_date: val.updated_at
              ? moment(val.updated_at).format("DD-MM-YYYY HH:mm:ss")
              : "-",
            email_verified: val.email_verified ? val.email_verified : "",
            mobile_verified: val.mobile_no_verified
              ? val.mobile_no_verified
              : "",
            password: val.password ? val.password : "",
            live: val.live == 1 ? "Onboarded" : "Registered",
            status:
              val.onboarding_done != 1
                ? "Onboarding Pending"
                : val.ekyc_required == 1 &&
                  (val.ekyc_done == 1 || val.ekyc_done == 4)
                ? "eKYC Pending"
                : val.ekyc_required == 1 && val.ekyc_done == 2
                ? "eKYC Done"
                : val.ekyc_required == 0 && val.onboarding_done == 1
                ? "Onboarding Done"
                : val.ekyc_required == 1 && val.ekyc_done == 3
                ? "eKYC Denied"
                : "",
            referral_code_used: val.referral_code_used
              ? val.referral_code_used
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_sub_merchant_name_by_id(val?.submerchant_id)
              : "",
          };
          send_res.push(temp);
        }
        total_count = await referrer_model.get_count_merchant_modified(
          condition,
          filter,
          date_condition,
          search_by_id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Onboarded list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  reset_forgot_password: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
      is_approved: 0,
    };
    referrer_model
      .selectWithSelection("id,email", condition)
      .then((result) => {
        if (result) {
          let reset_condition = { referrer_id: result.id };
          let reset_data = { is_expired: 1 };
          referrer_model
            .updateResetPassword(reset_condition, reset_data)
            .then((result_reset) => {
              let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
              let token = uuid.v1();
              let resetData = {
                referrer_id: result.id,
                token: token,
                is_expired: 0,
                created_at: created_at,
              };
              referrer_model
                .addResetPassword(resetData)
                .then(async (result) => {
                  let verify_url =
                    process.env.FRONTEND_URL_MERCHANT +
                    "referrer/reset-password/" +
                    token;
                  let title = await helpers.get_title();
                  let subject = "Reset your " + title + " password";

                  await mailSender.forgotMail(
                    req.bodyString("email"),
                    subject,
                    verify_url
                  );
                  res
                    .status(statusCode.ok)
                    .send(
                      response.successmsg(
                        "If your account is identified, you will be receiving an email to change your password."
                      )
                    );
                });
            })
            .catch((error) => {
              winston.error(err);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Account is not active or deleted."));
        }
      })
      .catch((err) => {
        winston.error(err);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  forgot_2fa: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
      is_approved: 0,
    };
    referrer_model
      .selectWithSelection("id,email,password", condition)
      .then((result) => {
        if (result) {
          if (result.password != " " && result.password != "") {
            referrer_model
              .select2fa({
                email: req.bodyString("email"),
              })
              .then(async (result_2fa) => {
                let two_fa_token = uuid.v1();
                let two_fa_secret = authenticator.generateSecret();
                let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                let two_fa_data = {
                  token: two_fa_token,
                  secret: two_fa_secret,
                  referrer_id: result_2fa.referrer_id,
                  created_at: created_at,
                };
                await referrer_model.add_two_fa(two_fa_data);
                let verify_url =
                  process.env.FRONTEND_URL_MERCHANT +
                  "referrer-2fa/" +
                  two_fa_token;
                let title = await helpers.get_title();
                let subject = "Reset your " + title + " 2FA";
                await mailSender.forgot2fa(
                  req.bodyString("email"),
                  subject,
                  verify_url
                );
                res
                  .status(statusCode.ok)
                  .send(
                    response.successmsg(
                      "If your account is identified, you will be receiving an email to  set 2FA."
                    )
                  );
              })
              .catch((error) => {
                winston.error(err);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          } else {
            let reset_condition = { referrer_id: result.id };
            let reset_data = { is_expired: 1 };

            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let token = uuid.v1();
            let resetData = {
              referrer_id: result.id,
              token: token,
              is_expired: 0,
              created_at: created_at,
            };

            referrer_model
              .addResetPassword(resetData)
              .then(async (result) => {
                let verify_url =
                  process.env.FRONTEND_URL_MERCHANT +
                  "referrer/reset-password/" +
                  token;
                let title = await helpers.get_title();
                let subject = "Reset your " + title + " 2FA";
                await mailSender.forgotMail(
                  req.bodyString("email"),
                  subject,
                  verify_url
                );
                res
                  .status(statusCode.ok)
                  .send(
                    response.successmsg(
                      "If your account is identified, you will be receiving an email to change password after that you can set 2FA."
                    )
                  );
              })
              .catch((error) => {
                winston.error(err);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          }
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Account is not active or deleted."));
        }
      })
      .catch((err) => {
        winston.error(err);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  resend_2fa: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
    };
    referrer_model
      .selectWithSelection("id,email,password", condition)
      .then((result) => {
        if (result) {
          if (result.password != " " && result.password != "") {
            referrer_model
              .select2fa({
                email: req.bodyString("email"),
              })
              .then(async (result_2fa) => {
                let two_fa_token = uuid.v1();
                let two_fa_secret = authenticator.generateSecret();
                let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                let two_fa_data = {
                  token: two_fa_token,
                  secret: two_fa_secret,
                  referrer_id: result_2fa.referrer_id,
                  created_at: created_at,
                };
                await referrer_model.add_two_fa(two_fa_data);
                let verify_url =
                  process.env.FRONTEND_URL_MERCHANT +
                  "referrer-2fa/" +
                  two_fa_token;
                let title = await helpers.get_title();
                let subject = "Welcome to " + title;
                await mailSender.welcomeMailRef(
                  req.bodyString("email"),
                  subject,
                  verify_url
                );
                res
                  .status(statusCode.ok)
                  .send(
                    response.successmsg(
                      "If your account is identified, you will be receiving an email to  set 2FA."
                    )
                  );
              })
              .catch((error) => {
                winston.error(err);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          } else {
            let reset_condition = { referrer_id: result.id };
            let reset_data = { is_expired: 1 };

            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let token = uuid.v1();
            let resetData = {
              referrer_id: result.id,
              token: token,
              is_expired: 0,
              created_at: created_at,
            };

            referrer_model
              .addResetPassword(resetData)
              .then(async (result) => {
                let verify_url =
                  process.env.FRONTEND_URL_MERCHANT +
                  "referrer/reset-password/" +
                  token;
                let title = await helpers.get_title();
                let subject = "Reset your " + title + " 2FA";
                await mailSender.forgotMail(
                  req.bodyString("email"),
                  subject,
                  verify_url
                );
                res
                  .status(statusCode.ok)
                  .send(
                    response.successmsg(
                      "If your account is identified, you will be receiving an email to change password after that you can set 2FA."
                    )
                  );
              })
              .catch((error) => {
                winston.error(err);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          }
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Account is not active or deleted."));
        }
      })
      .catch((err) => {
        winston.error(err);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  reset_password: async (req, res) => {
    referrer_model
      .select_referrer_id({ token: req.bodyString("token") })
      .then(async (result_password_reset) => {
        let passwordHash = await enc_dec.cjs_encrypt(
          req.bodyString("password")
        );
        let referrer_data = {
          password: passwordHash,
        };
        let condition = {
          id: result_password_reset?.referrer_id,
        };
        referrer_model
          .updateDetails(condition, referrer_data)
          .then(async (result) => {
            let referrer_data = {
              is_expired: 1,
            };
            let condition = {
              token: req.bodyString("token"),
            };
            let result1 = await referrer_model.updateResetPassword(
              condition,
              referrer_data
            );

            let two_fa_token = uuid.v1();
            let two_fa_secret = authenticator.generateSecret();
            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let two_fa_data = {
              token: two_fa_token,
              secret: two_fa_secret,
              referrer_id: result_password_reset?.referrer_id,
              created_at: created_at,
            };
            let result_2fa = await referrer_model.add_two_fa(two_fa_data);
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  { token: two_fa_token },
                  "Password reset successfully."
                )
              );
          })
          .catch((error) => {
            winston.error(err);
            res.status(statusCode.internalError).send(response.errormsg(error));
          });
      })
      .catch((error) => {
        winston.error(err);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  generate2Fa: async (req, res) => {
    const token = req.bodyString("token");
    referrer_model
      .select2fa({ "t.token": token })
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
              response.errormsg("User details not found, please try again")
            );
        }
      })
      .catch((error) => {
        winston.error(err);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  verify_2fa: async (req, res) => {
    const token = req.bodyString("token");
    referrer_model
      .select2fa({ token: token })
      .then(async (result) => {
        let verification_result = authenticator.check(
          req.bodyString("pin"),
          result.secret
        );
        let condition = { id: result.referrer_id };
        let referrer_data = { two_fa_secret: result.secret };
        let referrer_update = await referrer_model.updateDetails(
          condition,
          referrer_data
        );
        if (verification_result) {
          let condition = { token: token };
          let data = { is_expired: 1 };
          let two_fa_update = await referrer_model.update2fa(condition, data);
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
        winston.error(err);

        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  login: async (req, res) => {
    let passwordHash = enc_dec.cjs_encrypt(req.bodyString("password"));
    let login_data = {
      email: req.bodyString("email"),
      password: passwordHash,
      deleted: 0,
    };
    referrer_model
      .select_referrer(
        "id,full_name as name,email,mobile_no,status",
        login_data
      )
      .then(async (result) => {
        if (result) {
          let payload = {
            referrer_id: result.id,
            name: result.name,
            email: result.email,
          };

          const aToken = merchantToken(payload);

          let two_fa_token = uuid.v1();
          let two_fa_secret = authenticator.generateSecret();
          let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
          let two_fa_data = {
            token: two_fa_token,
            secret: two_fa_secret,
            referrer_id: result.id,
            created_at: created_at,
          };
          let result_2fa = await referrer_model.add_two_fa(two_fa_data);
          res
            .status(statusCode.ok)
            .send(response.loginSuccess({ token: two_fa_token }));
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Invalid email or password"));
        }
      })
      .catch((error) => {
        winston.error(err);

        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  verify_and_login: async (req, res) => {
    const token = req.bodyString("token");
    referrer_model
      .select2falogin({ token: token })
      .then(async (result) => {
        let referrer_data;
        let verification_result = false;
        if (result.referrer_id) {
          referrer_data = await referrer_model.selectOne("*", {
            id: result.referrer_id,
          });
          verification_result = authenticator.check(
            req.bodyString("pin"),
            result.secret
          );
        }
        if (verification_result) {
          let condition = { token: token };
          let data = { is_expired: 1 };
          await referrer_model.update2fa(condition, data);

          let user = referrer_data;
          payload = {
            email: user.email,
            id: user.id,
            name: user.name,
            type: "referrer",
          };
          let referrer_token_payload = enc_dec.cjs_encrypt(
            JSON.stringify(payload)
          );
          const aToken = merchantToken(referrer_token_payload);

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
          let language_id = enc_dec.cjs_encrypt(user.language + "");
          let language = await nodeCache.getActiveLanguageById(language_id);

          res.status(statusCode.ok).send(
            response.loginSuccess({
              accessToken: aToken,
              name: user.name ? user.name : user.email,
              language: language,
              theme: user.theme,
              referral_code: user.referral_code,
              user_type: "referrer",
            })
          );
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Unable to verify, please try again."));
        }
      })
      .catch((error) => {
        winston.error(err);

        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  my_rewards: async (req, res) => {
    let limit = {
      perpage: 0,
      start: 0,
      // page: 1,
    };
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    let condition = { referrer_id: req.user.id };
    let search = {};
    let search_by_id = {};
    if (req.bodyString("search")) {
      search["rb.remark"] = req.bodyString("search");
      search["rb.ref_no"] = req.bodyString("search");
    }
    if (req.bodyString("order_no")) {
      condition["rb.order_id"] = req.bodyString("order_no");
    }
    if (req.bodyString("payment_ref_id")) {
      condition["rb.txn_id"] = await helpers.getOrderByRefID(
        req.bodyString("payment_ref_id")
      );
    }
    if (req.bodyString("status")) {
      condition["rb.order_status"] = req.bodyString("status");
    }
    if (req.bodyString("submerchant_id")) {
      search_by_id.id = parseInt(req.bodyString("submerchant_id"), 10);
    }
    if (req.bodyString("name")) {
      search_by_id.name = req.bodyString("name");
    }
    if (req.bodyString("super_merchant_name")) {
      search_by_id.super_merchant_name = req.bodyString("super_merchant_name");
    }
    let date_condition = {};
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }
    referrer_model
      .select_rewards(condition, limit, search, date_condition, search_by_id)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let ord_status = "";
          let amount = Number(val.amount);
          let tax = Number(val.tax);
          let amount_to_settle = Number(val.amount_to_settle);
          let payment_ref_id = "";
          let action_date = "-";

          if (val.order_id) {
            var get_merchant_data = await helpers.get_referrer_merchant_id(
              val.order_id
            );
            var captured_date = await helpers.get_captured_date(val.order_id);
            payment_ref_id = await helpers.getPaymentRefID(val.txn_id);
            if (val.order_status == "CAPTURED") {
              ord_status = "";
            } else if (val.order_status == "VOID") {
              ord_status = val.void_status == "DEBIT" ? "-" : "";
              action_date = moment(val.created_at).format(
                "DD-MM-YYYY HH:mm:ss"
              );
            } else {
              ord_status = "-";
              action_date = moment(val.created_at).format(
                "DD-MM-YYYY HH:mm:ss"
              );
            }
          }
          let super_merchant_id = val?.super_merchant_id
            ? await helpers.formatNumber(val?.super_merchant_id)
            : "";
          let submerchant_name = val?.submerchant_id
            ? await helpers.get_sub_merchant_name_by_id(val?.submerchant_id)
            : "";
          let submerchant_id = val?.submerchant_id
            ? await helpers.formatNumber(val?.submerchant_id)
            : "";
          let temp = {
            reward_id: enc_dec.cjs_encrypt(val.id),
            amount: val.currency + " " + ord_status + "" + amount.toFixed(2),
            amount_for_total: amount.toFixed(2),
            tax_for_total: tax.toFixed(2),
            settle_for_total: amount_to_settle.toFixed(2),
            currency: val.currency,
            tax: val.currency + " " + tax.toFixed(2),
            amount_to_settle:
              val.currency +
              " " +
              ord_status +
              "" +
              amount_to_settle.toFixed(2),
            created_on: moment(val.created_at).format("DD-MM-YYYY hh:mm:ss"),
            order_id: val.order_id ? val.order_id : "",
            status: val.order_id ? val.order_status : "",
            is_val_minus: ord_status,
            description: val.remark,
            ref_no: val.ref_no,
            payment_id: payment_ref_id,
            submerchant_name: submerchant_name ? submerchant_name : "",
            submerchant_id: val?.submerchant_id ? submerchant_id : "",
            mercahnt_name:
              super_merchant_id != ""
                ? await helpers.get_super_merchant_name(super_merchant_id)
                : "",
            super_merchant_id:
              super_merchant_id != "" ? super_merchant_id : submerchant_id,
            captured_date: val.order_id ? captured_date : "",
            action_date: val.order_id ? action_date : "-",
          };
          send_res.push(temp);
        }
        let total_count = await referrer_model.get_reward_count(
          condition,
          search,
          date_condition,
          search_by_id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Reward list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(err);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  notificationUpdate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("referrer_id"));
    try {
      await referrer_model.updateDetails(
        { id: id },
        { is_read_notification: 1 }
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg([], "Notification Updated successfully.")
        );
    } catch (error) {
      winston.error(err);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  merchant_bonus: async (req, res) => {
    try {
      let merchant_id = null;
      merchant_id = req.user.id;
      let limit = {
        perpage: 0,
        page: 0,
      };

      const date_range = {
        start_date: "",
        end_date: "",
      };
      let search;
      let selected_merchant = "";
      let condition = {};

      let search_by_id = {};
      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));

        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      if (req.bodyString("reward_date")) {
        let reward_date = req.bodyString("reward_date");
        let date_array = reward_date.split("-");
        date_range.start_date = moment(
          date_array[0].trim(),
          "DD/MMM/YYYY"
        ).format("YYYY-MM-DD");
        date_range.end_date = moment(
          date_array[1].trim(),
          "DD/MMM/YYYY"
        ).format("YYYY-MM-DD");
        //console.info( 'date_array', date_array,'date_range', date_range);
      }
      if (req.bodyString("order_no")) {
        condition["rb.order_id"] = req.bodyString("order_no");
      }
      if (req.bodyString("payment_ref_id")) {
        condition["rb.txn_id"] = await helpers.getOrderByRefID(
          req.bodyString("payment_ref_id")
        );
      }
      if (req.bodyString("status")) {
        condition["rb.order_status"] = req.bodyString("status");
      }
      if (req.bodyString("submerchant_id")) {
        search_by_id.id = parseInt(req.bodyString("submerchant_id"), 10);
      }
      if (req.bodyString("name")) {
        search_by_id.name = req.bodyString("name");
      }
      if (req.bodyString("super_merchant_name")) {
        search_by_id.super_merchant_name = req.bodyString(
          "super_merchant_name"
        );
      }
      if (req.bodyString("search")) {
        search = req.bodyString("search");
        // console.info( 'search', search);
      }

      let all_referrer_result = "";
      const selected_merchant_id = req.bodyString("selected_merchant");
      if (selected_merchant_id && selected_merchant_id === 0) {
        all_referrer_result = await referrer_model.getAllReferrer(merchant_id);
      } else {
        selected_merchant = enc_dec.cjs_decrypt(
          req.bodyString("selected_merchant")
        );
        all_referrer_result = await referrer_model.getAllReferrer(
          merchant_id,
          selected_merchant
        );
      }

      let db_condition_parm = {
        limit,
        merchant_id,
        date_range,
        search,
        selected_merchant,
        all_referrer_result,
        search_by_id,
        condition,
      };
      let referrer_bonus_result = await referrer_model.getReferrerBonus(
        db_condition_parm
      );

      let sene_response = [];
      const bonus_result_length = referrer_bonus_result.length;

      if (referrer_bonus_result.length === 0) {
        return res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              sene_response,
              "Merchant referrer bonus fetched successfully."
            )
          );
      }

      for (const bonus of referrer_bonus_result) {
        let payment_ref_id = "";
        let action_date = "-";

        if (bonus.order_id) {
          var get_merchant_data = await helpers.get_referrer_merchant_id(
            bonus.referrer_id
          );
          var captured_date = await helpers.get_captured_date(bonus.order_id);
          payment_ref_id = await helpers.getPaymentRefID(bonus.txn_id);
          if (bonus.order_status == "CAPTURED") {
            ord_status = "";
          } else if (bonus.order_status == "VOID") {
            ord_status = bonus.void_status == "DEBIT" ? "-" : "";
            action_date = moment(bonus.created_at).format(
              "DD-MM-YYYY HH:mm:ss"
            );
          } else {
            ord_status = "-";
            action_date = moment(bonus.created_at).format(
              "DD-MM-YYYY HH:mm:ss"
            );
          }
        }
        let super_merchant_id = bonus?.super_merchant_id
          ? await helpers.formatNumber(bonus?.super_merchant_id)
          : "";
        let submerchant_name = bonus?.submerchant_id
          ? await helpers.get_sub_merchant_name_by_id(bonus?.submerchant_id)
          : "";
        let submerchant_id = bonus?.submerchant_id
          ? await helpers.formatNumber(bonus?.submerchant_id)
          : "";
        let temp = { ...bonus };
        temp.created_at = moment(temp.created_at).format("DD-MM-YYYY hh:mm:ss");
        (temp.payment_id = payment_ref_id),
          (temp.submerchant_name = submerchant_name ? submerchant_name : "");
        temp.submerchant_id = bonus?.submerchant_id ? submerchant_id : "";
        temp.mercahnt_name =
          super_merchant_id != ""
            ? await helpers.get_super_merchant_name(super_merchant_id)
            : "";
        super_merchant_id =
          super_merchant_id != "" ? super_merchant_id : submerchant_id;
        temp.captured_date = bonus.order_id ? captured_date : "";
        temp.action_date = bonus.order_id ? action_date : "-";
        sene_response.push(temp);
      }

      let total_count = await referrer_model.get_bonus_count(merchant_id);

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            sene_response,
            "Merchant referrer bonus fetched successfully.",
            total_count
          )
        );
    } catch (error) {
      winston.error(err);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  referrer_plan_list: async (req, res) => {
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
    let condition = {
      deleted: 0,
      is_approved: 0,
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let condition_count = {
      deleted: 0,
      is_approved: 0,
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    if (req.bodyString("currency")) {
      condition.currency = req.bodyString("currency");
      condition_count.currency = `${req.bodyString("currency")}`;
    }
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition.submerchant_id = selected_merchant;
      condition_count.submerchant_id = selected_merchant;
    }
    let search = "";
    if (req.bodyString("search_string")) {
      search = req.bodyString("search_string");
    }
    referrer_model
      .select(condition, limit, search)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            referrer_id: enc_dec.cjs_encrypt(val.id),
            name: val?.full_name ? val?.full_name : "",
            email: val?.email ? val?.email : "",
            mobile_no: val.mobile_code + " " + val.mobile_no,
            status: val.status == 0 ? "Active" : "Deactivated",
            is_approved: val.is_approved == 0 ? "Approved" : "Pending",
            referral_code: val?.referral_code ? val?.referral_code : "",
            currency: val.currency,
            referrer_currency: await helpers.get_referrer_currency_by_country(
              val.country
            ),
            country: val?.country ? await enc_dec.cjs_encrypt(val.country) : "",
            country_name: val?.country
              ? await helpers.get_country_name_by_id(val.country)
              : "",

            fix_amount_for_reference:
              val?.fix_amount_for_reference ||
              val?.fix_amount_for_reference === 0
                ? val.fix_amount_for_reference.toFixed(2)
                : "",
            fix_amount:
              val?.fix_amount || val?.fix_amount === 0
                ? val.fix_amount.toFixed(2)
                : "",
            per_amount:
              val?.per_amount || val?.per_amount === 0
                ? val.per_amount.toFixed(2)
                : "",
            apply_greater: val?.apply_greater ? val.apply_greater : "",
            settlement_frequency: val?.settlement_frequency
              ? val?.settlement_frequency
              : "",
            settlement_date:
              val?.settlement_date || val?.settlement_date === 0
                ? val.settlement_date
                : "",
            calculate_bonus_till:
              val?.calculate_bonus_till || val?.calculate_bonus_till === 0
                ? val.calculate_bonus_till
                : "",
            tax_per: val?.tax_per || val?.tax_per === 0 ? val.tax_per : "",
          };
          send_res.push(temp);
        }
        let total_count = await referrer_model.get_count(
          condition_count,
          search
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Referrer list fetched successfully.",
              total_count
            )
          );
      })
      .catch((error) => {
        winston.error(err);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};
module.exports = referrer;
