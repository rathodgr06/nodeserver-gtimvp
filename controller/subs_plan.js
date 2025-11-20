const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const date_formatter = require("../utilities/date_formatter/index");
const enc_dec = require("../utilities/decryptor/decryptor");
const subs_plan_model = require("../models/subs_plan_model");
const mailSender = require("../utilities/mail/mailsender");
const moment = require("moment");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const SUBSCRIPTION_PLAN_URL = process.env.SUBSCRIPTION_PLAN_URL;
const SequenceUUID = require("sequential-uuid");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const plan_link_url = process.env.PLAN_PAY_URL;
const QRCode = require("qrcode");
const accessToken = require("../utilities/tokenmanager/token");
const SendMail = require("./cronjobs");
const checkSubscription = require("../utilities/validations/subscription_check");
const logger = require('../config/logger');

const subs_plan = {
  code: async (req, res) => {
    let data = enc_dec.cjs_encrypt(req.bodyString("code"));
    res
      .status(statusCode.ok)
      .send(response.successdatamsg(data, "this is the actual code."));
  },
  codee: async (req, res) => {
    let data = enc_dec.cjs_decrypt(req.bodyString("code"));
    res
      .status(statusCode.ok)
      .send(response.successdatamsg(data, "this is the actual code."));
  },

  checkResponse: async (req, res) => {
    let body = req.body;
    let data = await helpers.get_common_response(body);

    if (data.status === "success") {
      let res1 = [];
      for (let val of data.response) {
        let temp = {
          response_code: val?.response_code ? val?.response_code : "",
          response_details: val?.response_details ? val?.response_details : "",
          response_type: val?.response_type ? val?.response_type : "",
          soft_hard_decline: val?.soft_hard_decline
            ? val?.soft_hard_decline
            : "",
        };
        res1.push(temp);
      }
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(res1, "Common response fetched."));
    } else {
      res.status(500).json(data);
    }
  },

  add: async (req, res) => {
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let ins_data = {
      plan_name: req.bodyString("plan_name"),
      plan_id: await helpers.get_plan_id(),
      ref_no: uuid.generate(),
      plan_description: req.bodyString("plan_description"),
      plan_billing_frequency: req.bodyString("plan_billing_frequency"),
      plan_currency: req.bodyString("currency"),
      plan_billing_amount: req.bodyString("plan_billing_amount"),
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      note: req.bodyString("note"),
      status: 0,
      deleted: 0,
      created_at: added_date,
      updated_at: added_date,
      payment_interval: req.bodyString("payment_interval"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      start_date: req.bodyString("start_date"),
      terms: req.bodyString("terms"),
      final_payment_amount: req.bodyString("final_payment_amount"),
      mode: 1,
    };
    subs_plan_model
      .add(ins_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Subscription plan added successfully."));
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  create: async (req, res) => {
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let plan_no = await helpers.get_plan_id();
    let req_terms = req.body.payment_terms;
    let added_date = await date_formatter.created_date_time();
    let ins_terms = [];
    for (var i = 1; i <= req.bodyString("terms"); i++) {
      if (i == 1) {
        var rec_amount = parseFloat(req.bodyString("initial_payment_amount"));
        var rec_terms = "Initial Payment";
      } else if (i <= req.bodyString("discounted_terms")) {
        var rec_amount = parseFloat(req.bodyString("discounted_amount"));
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else if (
        i > req.bodyString("discounted_terms") &&
        req.bodyString("terms") > i
      ) {
        var rec_amount = parseFloat(req.bodyString("plan_billing_amount"));
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else {
        var rec_amount = parseFloat(req.bodyString("final_payment_amount"));
        var rec_terms = "Final Payment";
      }
      let temp_terms = {
        plan_id: "",
        amount: rec_amount,
        payment_terms: rec_terms,
        added_date: added_date,
      };
      ins_terms.push(temp_terms);
    }
    let start_date = req.bodyString("start_date");
    let expiry_date =
      req.bodyString("expiry_date") != ""
        ? await date_formatter.insert_date_time(req.bodyString("expiry_date"))
        : null;

    start_date = await date_formatter.insert_date_time(start_date);
    let ins_data = {
      submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),

      plan_name: req.bodyString("plan_name"),
      plan_id: plan_no,
      plan_description: req.bodyString("plan_description"),
      ref_no: uuid.generate(),
      plan_currency: req.bodyString("currency"),
      plan_billing_amount: req.bodyString("plan_billing_amount"),
      plan_billing_frequency: req.bodyString("plan_billing_frequency"),
      payment_interval: req.bodyString("payment_interval"),
      final_payment_amount: req.bodyString("final_payment_amount"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      terms: req.bodyString("terms"),
      start_date: start_date,
      expiry_date: expiry_date,
      discounted_terms: req.bodyString("discounted_terms"),
      discounted_amount: req.bodyString("discounted_amount"),
      created_at: added_date,
      note: req.bodyString("note"),
      mode: req.bodyString("mode") == "test" ? 0 : 1,
    };

    subs_plan_model
      .add(ins_data)
      .then(async (result) => {
        let ins_data_logs = {
          submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
          plan_name: req.bodyString("plan_name"),
          plan_id: result.insert_id,
          plan_no: plan_no,
          plan_description: req.bodyString("plan_description"),
          ref_no: uuid.generate(),
          plan_currency: req.bodyString("currency"),
          plan_billing_amount: req.bodyString("plan_billing_amount"),
          plan_billing_frequency: req.bodyString("plan_billing_frequency"),
          payment_interval: req.bodyString("payment_interval"),
          final_payment_amount: req.bodyString("final_payment_amount"),
          initial_payment_amount: req.bodyString("initial_payment_amount"),
          merchant_id: req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
          terms: req.bodyString("terms"),
          start_date: req.bodyString("start_date"),
          note: req.bodyString("note"),
          created_by: req.user.id,
          activity: "Created",
          expiry_date: expiry_date,
          discounted_terms: req.bodyString("discounted_terms"),
          discounted_amount: req.bodyString("discounted_amount"),
          created_at: added_date,
        };
        let insert_log = await subs_plan_model.add_logs(ins_data_logs);
        for (i = 0; i < ins_terms.length; i++) {
          ins_terms[i].plan_id = result.insertId;
        }
        subs_plan_model
          .add_terms(ins_terms)
          .then((result_meta) => {
            res
              .status(statusCode.ok)
              .send(
                response.successmsg("Subscription plan created successfully.")
              );
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
    let today = await date_formatter.created_date_time();
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
    let condition = {
      deleted: 0,
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition.submerchant_id = selected_merchant;
    }
    if (req.bodyString("mode")) {
      condition.mode = req.bodyString("mode") == "live" ? 1 : 0;
    }
    let date = {};
    if (req.bodyString("from_date")) {
      date.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("modified_to_date")) {
      date.modified_to_date = req.bodyString("modified_to_date");
    }
    if (req.bodyString("modified_from_date")) {
      date.modified_from_date = req.bodyString("modified_from_date");
    }
    if (req.bodyString("subscribe_to_date")) {
      date.subscribe_to_date = req.bodyString("subscribe_to_date");
    }
    if (req.bodyString("subscribe_from_date")) {
      date.subscribe_from_date = req.bodyString("subscribe_from_date");
    }
    if (req.bodyString("to_date")) {
      date.to_date = req.bodyString("to_date");
    }
    if (req.bodyString("currency")) {
      condition["plan_currency"] = req.bodyString("currency");
    }

    if (req.bodyString("terms")) {
      condition["terms"] = req.bodyString("terms");
    }
    if (req.bodyString("interval")) {
      condition["payment_interval"] = req.bodyString("interval");
    }
    if (req.bodyString("billing_frequency")) {
      condition["plan_billing_frequency"] = req.bodyString("billing_frequency");
    }
    if (req.bodyString("amount")) {
      condition["plan_billing_amount"] = req.bodyString("amount");
    }
    if (req.bodyString("submerchant_id")) {
      condition["submerchant_id"] = parseInt(
        req.bodyString("submerchant_id"),
        10
      );
    }
    let like_condition = {
      plan_name: "",
    };

    if (req.bodyString("plan")) {
      like_condition.plan = req.bodyString("plan");
    }
    let expiry_date = "";
    if (req.bodyString("status")) {
      if (req.bodyString("status") == "Active") {
        condition[`status`] = 0;
        expiry_date = `and (expiry_date >= '${today}' or expiry_date is NULL )`;
      } else if (req.bodyString("status") == "Deactivated") {
        condition[`status`] = 1;
        expiry_date = `and (expiry_date >= '${today}' or expiry_date is NULL)`;
      } else if (req.bodyString("status") == "Expired") {
        expiry_date = `'${today}' `;
        expiry_date = `and expiry_date <= '${today}' and expiry_date is not NULL`;
      }
    }
    subs_plan_model
      .select(condition, date, limit, like_condition, expiry_date)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let payLink = "";
          if (val?.ref_no) {
            payLink = plan_link_url + val.ref_no;
          }
          let count_subs = 0;
          let subscribers = await helpers.GetSubscriberID(val.id);
          if (subscribers.length > 0) {
            let ids = [];
            for (let subs of subscribers) {
              ids.push(subs.subscription_id);
            }
            count_subs = await helpers.get_active_subscribers(ids.toString());
          }

          let temp = {
            subs_plan_id: enc_dec.cjs_encrypt(val.id),
            de_submerchant_id: val?.merchant_id
              ? await helpers.formatNumber(val?.submerchant_id)
              : "",
            no_of_subscriber: await helpers.countSubscriber(val.id),
            active_subscribers: count_subs > 0 ? count_subs : 0,
            plan_name: val?.plan_name ? val?.plan_name : "",
            plan_description: val?.plan_description
              ? val?.plan_description
              : "",
            plan_billing_frequency: val?.plan_billing_frequency
              ? val?.plan_billing_frequency
              : "",

            status:
              (await date_formatter.insert_date_time(val.expiry_date)) >=
                today || val.expiry_date == null
                ? val.status == 0
                  ? "Active"
                  : "Deactivated"
                : "Expired",
            // status: val?.status == 0 ? "Active" : "Deactivated",
            currency: val?.plan_currency ? val?.plan_currency : "",
            terms: val?.terms == "1999" ? "Unlimited" : val?.terms,
            payment_interval: val?.payment_interval,
            plan_billing_amount: val?.plan_billing_amount
              ? val?.plan_billing_amount.toFixed(2)
              : "",
            note: val?.note ? val?.note : "",
            start_date: await date_formatter.get_date_time(val.start_date),
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: val.updated_at
              ? await date_formatter.get_date_time(val.updated_at)
              : "",
            subscribe_at: val.last_subscribe_date
              ? await date_formatter.get_date_time(val.last_subscribe_date)
              : "",
            submerchant_id: val?.submerchant_id
              ? enc_dec.cjs_encrypt(val?.submerchant_id)
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
            expiry_date:
              val.expiry_date != null
                ? moment(val.expiry_date).format("DD-MM-YYYY HH:mm:ss")
                : "",
            plan_link: payLink,
            plan_id: val.plan_id ? val.plan_id : "",
            ref_no: val.ref_no ? val.ref_no : "",
          };
          send_res.push(temp);
        }
        let total_count = await subs_plan_model.get_count(
          condition,
          date,
          like_condition,
          expiry_date
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Sub_plan list fetched successfully.",
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

  open_add: async (req, res) => {
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });

    let ref_no = uuid.generate();
    let ins_data = {
      merchant_id: req.credentials.merchant_id,
      submerchant_id: req.credentials.super_merchant_id,
      ref_no: ref_no,
      plan_id: await helpers.get_plan_id(),
      plan_name: req.bodyString("plan_name"),
      plan_description: req.bodyString("plan_description"),
      plan_billing_frequency: req.bodyString("plan_billing_frequency"),
      plan_currency: req.bodyString("currency"),
      plan_billing_amount: req.bodyString("plan_billing_amount"),
      payment_interval: req.bodyString("payment_interval"),
      note: req.bodyString("note"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      start_date: req.bodyString("start_date"),
      terms: req.bodyString("terms"),
      final_payment_amount: req.bodyString("final_payment_amount"),
      status: 0,
      deleted: 0,
      created_at: added_date,
      updated_at: added_date,
    };
    subs_plan_model
      .add(ins_data)
      .then(async (result) => {
        let payLink = plan_link_url + ref_no;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              { payment_link: payLink },
              "Subscription plan added successfully."
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

  get: async (req, res) => {
    let today = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    subs_plan_model
      .selectOne("*", { id: id })
      .then(async (result) => {
        let data = await subs_plan_model.select_terms(
          {
            plan_id: result.id,
          },
          12
        );
        let count_terms = await subs_plan_model.get_count_terms({
          plan_id: result.id,
        });
        let payment_data = [];
        for (val of data) {
          let temp = {
            terms_id: enc_dec.cjs_encrypt(val.id),
            plan_id: enc_dec.cjs_encrypt(val.plan_id),
            payment: val.payment_terms,
            amount: val.amount.toFixed(2),
          };
          payment_data.push(temp);
        }
        let send_res = {
          subs_plan_id: enc_dec.cjs_encrypt(result.id),
          plan_id: result.plan_id,
          plan_name: result.plan_name,
          merchant_name: result.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(
                result.submerchant_id
              )
            : "",
          super_merchant_name: result.merchant_id
            ? await helpers.get_super_merchant_name(result.merchant_id)
            : "",
          submerchant_id: result?.submerchant_id
            ? enc_dec.cjs_encrypt(result?.submerchant_id)
            : "",
          plan_description: result.plan_description,
          plan_billing_frequency: result.plan_billing_frequency,
          status:
            moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") >= today ||
            moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") ==
              "Invalid date"
              ? result.status == 0
                ? "Active"
                : "Deactivated"
              : "Expired",
          currency: result.plan_currency,
          terms: result?.terms == "1999" ? "Unlimited" : result?.terms,
          terms_edit: result?.terms,
          plan_billing_amount: result.plan_billing_amount.toFixed(2),
          payment_interval: result.payment_interval,
          initial_payment_amount: result.initial_payment_amount.toFixed(2),
          final_payment_amount: result.final_payment_amount.toFixed(2),
          note: result.note,
          start_date: moment(result.start_date).format("DD-MM-YYYY HH:mm:ss"),
          expiry_date:
            result.expiry_date != null
              ? moment(result.expiry_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
          discounted_terms: result.discounted_terms,
          discounted_amount: result.discounted_amount.toFixed(2),
          recurring: payment_data,
          terms_count: count_terms,
        };
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

  delete: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    let update_data = { deleted: 1 };
    subs_plan_model
      .updateDetails({ id: id }, update_data)
      .then(async (result) => {
        let insert_log = await subs_plan.add_logs_data(
          id,
          "Deleted",
          req.user.id
        );
        res
          .status(statusCode.ok)
          .send(response.successmsg("Subscription plan deleted successfully."));
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  update: async (req, res) => {
    let subs_plan_id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    let added_date = await date_formatter.created_date_time();
    let req_terms = req.body.payment_terms;
    let ins_terms = [];
    // for (i = 0; i < req_terms.length; i++) {
    //     var rec_amount = parseFloat(req_terms[i].pay_amount);
    //     var rec_terms =req_terms[i].pay_terms
    //     let temp_terms = {
    //         plan_id:subs_plan_id,
    //         amount: rec_amount,
    //         payment_terms: rec_terms,
    //         added_date: added_date,
    //     };
    //     ins_terms.push(temp_terms);
    // }
    for (var i = 1; i <= req.bodyString("terms"); i++) {
      if (i == 1) {
        var rec_amount = parseFloat(req.bodyString("initial_payment_amount"));
        var rec_terms = "Initial Payment";
      } else if (i <= req.bodyString("discounted_terms")) {
        var rec_amount = parseFloat(req.bodyString("discounted_amount"));
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else if (
        i > req.bodyString("discounted_terms") &&
        req.bodyString("terms") > i
      ) {
        var rec_amount = parseFloat(req.bodyString("plan_billing_amount"));
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else {
        var rec_amount = parseFloat(req.bodyString("final_payment_amount"));
        var rec_terms = "Final Payment";
      }
      let temp_terms = {
        plan_id: subs_plan_id,
        amount: rec_amount,
        payment_terms: rec_terms,
        added_date: added_date,
      };
      ins_terms.push(temp_terms);
    }

    let start_date = req.bodyString("start_date");
    let edn_date = req.bodyString("expiry_date");
    start_date = await date_formatter.insert_date_time(start_date);
    edn_date =
      req.bodyString("expiry_date") != ""
        ? await date_formatter.insert_date_time(edn_date)
        : null;
    let ins_data = {
      plan_name: req.bodyString("plan_name"),
      plan_description: req.bodyString("plan_description"),
      plan_billing_frequency: req.bodyString("plan_billing_frequency"),
      plan_currency: req.bodyString("currency"),
      plan_billing_amount: req.bodyString("plan_billing_amount"),
      note: req.bodyString("note"),
      updated_at: added_date,
      payment_interval: req.bodyString("payment_interval"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      start_date: start_date,
      terms: req.bodyString("terms"),
      final_payment_amount: req.bodyString("final_payment_amount"),
      submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      updated_at: added_date,
      expiry_date: edn_date,
      discounted_terms: req.bodyString("discounted_terms"),
      discounted_amount: req.bodyString("discounted_amount"),
    };
    subs_plan_model
      .updateDetails({ id: subs_plan_id }, ins_data)
      .then(async (result) => {
        let logs_data = {
          plan_id: subs_plan_id,
          plan_no: req.bodyString("plan_no"),
          plan_name: req.bodyString("plan_name"),
          plan_description: req.bodyString("plan_description"),
          plan_billing_frequency: req.bodyString("plan_billing_frequency"),
          plan_currency: req.bodyString("currency"),
          plan_billing_amount: req.bodyString("plan_billing_amount"),
          note: req.bodyString("note"),
          updated_at: added_date,
          payment_interval: req.bodyString("payment_interval"),
          initial_payment_amount: req.bodyString("initial_payment_amount"),
          start_date: req.bodyString("start_date"),
          terms: req.bodyString("terms"),
          final_payment_amount: req.bodyString("final_payment_amount"),
          submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
          merchant_id: req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
          activity: "Updated",
          expiry_date: edn_date,
          discounted_terms: req.bodyString("discounted_terms"),
          discounted_amount: req.bodyString("discounted_amount"),
          created_by: req.user.id,
        };
        let ins_data = await subs_plan_model.add_logs(logs_data);
        await subs_plan_model.remove_terms(subs_plan_id);
        subs_plan_model
          .add_terms(ins_terms)
          .then((result_meta) => {
            res
              .status(statusCode.ok)
              .send(
                response.successmsg("Subscription plan updated successfully.")
              );
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

  activate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let update_data = { status: 0, updated_at: added_date };
    subs_plan_model
      .updateDetails({ id: id }, update_data)
      .then(async (result) => {
        let insert_log = await subs_plan.add_logs_data(
          id,
          "Activated",
          req.user.id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription plan activated successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  deactivate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let update_data = { status: 1, updated_at: added_date };
    subs_plan_model
      .updateDetails({ id: id }, update_data)
      .then(async (result) => {
        let insert_log = await subs_plan.add_logs_data(
          id,
          "Deactivated",
          req.user.id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription plan deactivated successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  mail_send: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    subs_plan_model
      .selectOne("*", { id: id })
      .then(async (subs_data) => {
        let dec_msg = req.bodyString("emails");
        let split_msg = dec_msg.split(",");
        for (var i = 0; i < split_msg.length; i++) {
          const uuid = new SequenceUUID({
            valid: true,
            dashes: false,
            unsafeBuffer: true,
          });
          let subs_token = uuid.generate();

          let url = subs_data.submerchant_id
            ? await helpers.get_merchantdetails_url_by_id(
                subs_data.submerchant_id
              )
            : "";
          let data = {
            merchant_name: subs_data.merchant_id
              ? await helpers.get_merchantdetails_name_by_id(
                  await helpers.get_merchant_id(subs_data.merchant_id)
                )
              : "",
            tc_url: url.link_tc ? url.link_tc : "",
            pp_url: url.link_pp ? url.link_pp : "",
            message: subs_data.plan_description,
            message_text:
              subs_data.plan_description != ""
                ? '<p style="margin: 24px 0;"><b style="color: #263238 !important;">Plan Description</b><br>' +
                  subs_data.plan_description +
                  "</p>"
                : "",
            mail_to: split_msg[i],
            plan_name: subs_data.plan_name,
            pay_url: plan_link_url + subs_data.ref_no,
            plan_billing_frequency:
              subs_data.payment_interval +
              " " +
              subs_data.plan_billing_frequency.charAt(0).toUpperCase() +
              subs_data.plan_billing_frequency.slice(1),
            currency: subs_data.plan_currency,
            amount: subs_data.plan_billing_amount.toFixed(2),
            note: subs_data.note,
            note_text:
              subs_data.note != ""
                ? '<p style="margin: 24px 0;"><b style="color: #263238 !important;">Note</b><br>' +
                  subs_data.note +
                  "</p>"
                : "",
            start_date: moment(subs_data.start_date).format(
              "DD-MM-YYYY HH:mm:ss"
            ),
            initial_payment_amount: subs_data.initial_payment_amount.toFixed(2),
            payment_interval: subs_data.payment_interval,
            terms: subs_data.terms == "1999" ? "Unlimited" : subs_data.terms,
            final_payment_amount: subs_data.final_payment_amount.toFixed(2),
            subject: req.bodyString("subject"),
            expiry_date:
              subs_data.expiry_date == null ||
              moment(subs_data.expiry_date).format("DD-MM-YYYY HH:mm:ss") ==
                "01-01-1970 00:00:00"
                ? "No expiry"
                : moment(subs_data.expiry_date).format("DD-MM-YYYY HH:mm:ss"),
            discounted_terms: subs_data.discounted_terms
              ? subs_data.discounted_terms
              : "-",
            discounted_amount:
              subs_data.discounted_amount != "0"
                ? subs_data.plan_currency +
                  " " +
                  subs_data.discounted_amount.toFixed(2)
                : "-",
            merchant_logo: subs_data.merchant_id
              ? server_addr +
                "/static/files/" +
                (await subs_plan_model.getMerchantlogo({
                  id: subs_data.submerchant_id,
                }))
              : "",
            // invoice: inv_response
          };

          let mail_response = await mailSender.subs_plan_mail(data);

          ins_data = {
            merchant_id: subs_data.merchant_id,
            emails: split_msg[i],
            plan_id: id,
            currency: subs_data.plan_currency,
            amount: subs_data.plan_billing_amount.toFixed(2),
            sending_date: register_at,
            token: subs_token,
          };
          subs_plan_model
            .addMail(ins_data)
            .then(async (result) => {
              res
                .status(statusCode.ok)
                .send(response.successmsg("Mail sent successfully"));
            })
            .catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  link_details: async (req, res) => {
    let company_name = await subs_plan_model.get_company_name();

    let company_details = await helpers.company_details({ id: 1 });
    let image_path = server_addr + "/static/images/";
    let data = {
      merchant_details: {},
      subscription_details: {},
      mail_details: {},
      prefer_lang: "",
    };
    let record_id = req.bodyString("token");

    let find = await subs_plan_model.selectOne(
      "*",
      { ref_no: record_id },
      "subs_plans"
    );
    subs_plan_model
      .selectOneMerchant({ id: find.submerchant_id })
      .then(async (rlt) => {
        let tc = await helpers.get_terms_and_condition();
        data.merchant_details = {
          theme: rlt.theme,
          icon: process.env.STATIC_URL + "/static/files/" + rlt.icon,
          logo: process.env.STATIC_URL + "/static/files/" + rlt.logo,
          use_logo: rlt.use_logo,
          we_accept_image:
            process.env.STATIC_URL + "/static/files/" + rlt.we_accept_image,
          brand_color: rlt.brand_color,
          accent_color: rlt.accent_color,
          merchant_name: find.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(find.submerchant_id)
            : "",
          use_logo_instead_icon: rlt.use_logo,
          branding_language: enc_dec.cjs_encrypt(rlt.branding_language),
          company_details: {
            fav_icon: image_path + company_details.fav_icon,
            logo: image_path + company_details.company_logo,
            letter_head: image_path + company_details.letter_head,
            footer_banner: image_path + company_details.footer_banner,
            title: await helpers.get_title(),
            terms_and_condition: tc,
          },
        };
        data.mail_details = {
          email: find.emails,
        };
        let result = await subs_plan_model.selectOne("*", {
          id: find.id,
        });

        data.subscription_details = {
          subs_plan_id: enc_dec.cjs_encrypt(result.id),
          plan_name: result.plan_name,
          merchant_name: "",
          plan_description: result.plan_description,
          pay_url: record_id,
          plan_billing_frequency:
            result.plan_billing_frequency.charAt(0).toUpperCase() +
            result.plan_billing_frequency.slice(1),
          status: result.status == 0 ? "Active" : "Deactivated",
          currency: result.plan_currency,
          initial_payment_amount: result.initial_payment_amount.toFixed(2),
          payment_interval: result.payment_interval,
          terms: result.terms == "1999" ? "Unlimited" : result.terms,
          final_payment_amount: result.final_payment_amount.toFixed(2),
          plan_billing_amount: result.plan_billing_amount.toFixed(2),
          note: result.note,
          start_date: moment(result.start_date).format("DD-MM-YYYY HH:mm:ss"),
          expiry_date:
            find.expiry_date != null
              ? moment(find.expiry_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
          discounted_terms: find.discounted_terms ? find.discounted_terms : "-",
          discounted_amount:
            find.discounted_amount != "0"
              ? result.plan_currency + " " + find.discounted_amount.toFixed(2)
              : "-",
        };

        (data.prefer_lang = enc_dec.cjs_encrypt(rlt.branding_language)),
          res
            .status(statusCode.ok)
            .send(response.successansmsg(data, "Details fetch successfully."));
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  subscriber_list: async (req, res) => {
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

    let date = {};
    if (req.bodyString("from_date")) {
      date.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date.to_date = req.bodyString("to_date");
    }
    if (req.bodyString("payment_to_date")) {
      date.payment_to_date = req.bodyString("payment_to_date");
    }
    if (req.bodyString("payment_from_date")) {
      date.payment_from_date = req.bodyString("payment_from_date");
    }
    // let condition = { super_merchant: 60 };
    let condition = {
      "s.super_merchant": req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      mode: req.bodyString("mode"),
    };
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition["s.merchant_id"] = selected_merchant;
    }

    if (req.bodyString("submerchant_id")) {
      condition["s.merchant_id"] = parseInt(
        req.bodyString("submerchant_id"),
        10
      );
      condition_for_count["s.merchant_id"] = parseInt(
        req.bodyString("submerchant_id"),
        10
      );
    }
    if (req.bodyString("status")) {
      if (req.bodyString("status") === "Active") {
        condition["s.status"] = 1;
      } else if (req.bodyString("status") === "Deactivated") {
        condition["s.status"] = 0;
      }
    }

    if (req.bodyString("subscriber_id")) {
      condition["s.id"] = parseInt(req.bodyString("subscriber_id"), 10);
    }

    let search = "";
    if (req.bodyString("search_string")) {
      search = req.bodyString("search_string");
    }

    let like_condition = {
      email: "",
      plan_name: "",
    };
    if (req.bodyString("email")) {
      like_condition.email = req.bodyString("email");
    }
    if (req.bodyString("plan_name")) {
      like_condition.plan_name = req.bodyString("plan_name");
    }

    subs_plan_model
      .select_subscribers_list(condition, date, limit, like_condition)
      .then(async (result) => {
        let send_res = [];
        let subscription_id = [];
        for (val of result) {
          let common_subscribers_id = await helpers.get_common_subscriber_id(
            val.email,
            req.bodyString("mode"),
            val.id
          );
          let first_txn_date = await subs_plan_model.select_txn_date(
            {
              customer_email: val.email,
              origin: "Subscription",
              super_merchant: val.super_merchant,
            },
            "asc"
          );
          let last_txn_date = await subs_plan_model.select_txn_date(
            {
              customer_email: val.email,
              origin: "Subscription",
              super_merchant: val.super_merchant,
            },
            "desc"
          );
          var country = await subs_plan_model.select_cust_data(
            "billing_country",
            { cid: enc_dec.cjs_encrypt(val.id) }
          );
          var country_code = country.billing_country
            ? country.billing_country
            : "";
          let temp = {
            subscriber_id: enc_dec.cjs_encrypt(val.subscriber_id),
            cust_id: enc_dec.cjs_encrypt(val.id),
            common_subscribers_id: common_subscribers_id
              ? await helpers.formatNumber(common_subscribers_id)
              : "",
            name: val.name,
            mobile_no: val.mobile_no,
            country_code: val.dial_code ? val.dial_code : "",
            email: val.email,
            status: val.status == 0 ? "Deactivated" : "Active",
            added_date: await date_formatter.get_date_time(val.added_date),
            first_txn_date: first_txn_date,
            last_txn_date: last_txn_date,
            country: country_code
              ? await helpers.get_customer_country(country_code, "country")
              : "",
          };
          send_res.push(temp);
          subscription_id.push(val.subscriber_id);
        }
        let join_condition = "";
        if (Object.keys(subscription_id).length) {
          let unpaid_subs_id = subscription_id.toString().split(",");
          const subs_join =
            "(" + unpaid_subs_id.map((item) => `'${item}'`).join(", ") + ")";
          if (subs_join != "()") {
            join_condition = `and s.id IN ${subs_join} `;
          }
        }
        let total_count = await subs_plan_model.select_subscribers_list_count(
          condition,
          date,
          limit,
          like_condition
        );
        // let total_count = await subs_plan_model.get_count_pay(
        //     condition_for_count
        // );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Subscriber list fetched successfully.",
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

  contract_list: async (req, res) => {
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

    let date = {};
    if (req.bodyString("from_date")) {
      date.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date.to_date = req.bodyString("to_date");
    }
    if (req.bodyString("payment_to_date")) {
      date.payment_to_date = req.bodyString("payment_to_date");
    }
    if (req.bodyString("payment_from_date")) {
      date.payment_from_date = req.bodyString("payment_from_date");
    }
    // let condition = { super_merchant: 60 };
    let condition = {
      "s.super_merchant": req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      "s.mode": req.bodyString("mode"),
      "sp.payment_status": "CAPTURED",
    };
    let condition_for_count = {
      super_merchant: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      mode: req.bodyString("mode"),
      is_customer_subscribed: "1",
    };
    if (req.bodyString("subscriber_id")) {
      let subscriber_id = parseInt(req.bodyString("subscriber_id"), 10);
      let common_subscribers_email =
        await helpers.get_common_subscriber_email_by_id(subscriber_id);
      condition["s.email"] = common_subscribers_email;
      condition_for_count["email"] = common_subscribers_email;
    }

    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition["s.merchant_id"] = selected_merchant;
      condition_for_count["merchant_id"] = selected_merchant;
    }
    if (req.bodyString("currency")) {
      condition["s.plan_currency"] = req.bodyString("currency");
      condition_for_count["plan_currency"] = req.bodyString("currency");
    }
    if (req.bodyString("amount")) {
      condition["s.plan_billing_amount"] = req.bodyString("amount");
      condition_for_count["plan_billing_amount"] = req.bodyString("amount");
    }
    if (req.bodyString("submerchant_id")) {
      condition["s.merchant_id"] = parseInt(
        req.bodyString("submerchant_id"),
        10
      );
      condition_for_count["merchant_id"] = parseInt(
        req.bodyString("submerchant_id"),
        10
      );
    }
    if (req.bodyString("status")) {
      if (req.bodyString("status") === "Active") {
        condition["s.status"] = 1;
        condition_for_count["status"] = 1;
      } else if (req.bodyString("status") === "Deactivated") {
        condition["s.status"] = 0;
        condition_for_count["status"] = 0;
      }
    }
    if (req.bodyString("last_payment_status")) {
      condition["s.last_payment_status"] = req.bodyString(
        "last_payment_status"
      );
      condition_for_count["last_payment_status"] = req.bodyString(
        "last_payment_status"
      );
    }
    if (req.bodyString("plan_id")) {
      condition["s.plan_id"] = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
      condition_for_count["plan_id"] = enc_dec.cjs_decrypt(
        req.bodyString("plan_id")
      );
    }
    if (req.bodyString("contract_id")) {
      condition["s.subscription_id"] = req.bodyString("contract_id");
      condition_for_count["subscription_id"] = req.bodyString("contract_id");
    }
    if (req.bodyString("terms")) {
      condition["s.terms"] = req.bodyString("terms");
      condition_for_count["terms"] = req.bodyString("terms");
    }
    if (req.bodyString("interval")) {
      condition["s.payment_interval"] = req.bodyString("interval");
      condition_for_count["payment_interval"] = req.bodyString("interval");
    }
    if (req.bodyString("billing_frequency")) {
      condition["s.plan_billing_frequency"] =
        req.bodyString("billing_frequency");
      condition_for_count["plan_billing_frequency"] =
        req.bodyString("billing_frequency");
    }
    let search = "";
    if (req.bodyString("search_string")) {
      search = req.bodyString("search_string");
    }

    let like_condition = {
      email: "",
      plan_name: "",
    };
    if (req.bodyString("email")) {
      like_condition.email = req.bodyString("email");
    }
    if (req.bodyString("plan_name")) {
      like_condition.plan_name = req.bodyString("plan_name");
    }

    subs_plan_model
      .select_pay(condition, date, limit, like_condition)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let subs_id = val.subscription_id;
          // Recurring data
          let start_date = await helpers.get_recurring_start_next_date(
            { subscription_id: `'${subs_id}'`, is_paid: 1 },
            "asc"
          );
          let next_date = await helpers.get_recurring_start_next_date(
            { subscription_id: `'${subs_id}'`, is_paid: 0, is_failed: 0 },
            "asc"
          );
          //let last_payment_status = await helpers.get_recurring_last_status({subscription_id:`'${subs_id}'`});
          let get_total_count_paid =
            await helpers.get_recurring_count_by_subscription_id({
              subscription_id: `'${subs_id}'`,
              is_paid: 1,
            });
          // let collected_amt = await helpers.get_recurring_sum_amount({subscription_id:`'${subs_id}'`});
          // end recurring data
          let common_subscribers_id = await helpers.get_common_subscriber_id(
            val.email,
            val.mode
          );

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select("order_no")
              .where({ subscription_id: val.subscription_id })
              .get(config.table_prefix + "subs_payment");
            // .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");

          // let extra_info = await subs_plan_model.get_needed_info(
          //     subs_id
          // );
          let get_card_details = await subs_plan_model.selectCardsDetails(
            {
              "sp.subscription_id": subs_id,
              "sp.payment_status": "CAPTURED",
            },
            req.body.mode
          );

          let due_amount_result = await subs_plan_model.getDueAmount(subs_id);
          let due_amount = "-";
          if (due_amount_result.length > 0) {
            due_amount = due_amount_result
              ? due_amount_result[0]?.amount +
                due_amount_result[0]?.failed_amount
              : due_amount;
            due_amount = due_amount.toFixed(2);
          }

          let temp = {
            subscription_id: enc_dec.cjs_encrypt(val.id),
            de_submerchant_id: val?.merchant_id
              ? await helpers.formatNumber(val?.merchant_id)
              : "",
            common_subscribers_id: common_subscribers_id
              ? await helpers.formatNumber(common_subscribers_id)
              : "",
            submerchant_name: val?.merchant_id
              ? await helpers.get_submerchant_name_by_id(val?.merchant_id)
              : "",
            subs_id: val.subscription_id,
            plan_id: await helpers.get_subs_plan_id(val.plan_id),
            plan_name: val.plan_name,
            plan_frequency: val.plan_billing_frequency,
            terms: val.terms == "1999" ? "Unlimited" : val.terms,
            interval: val.payment_interval ? val.payment_interval : 0,
            order_no: order_ids,
            name: val.name,
            mobile_no: val.mobile_no,
            email: val.email,
            status: val.status == 0 ? "Deactivated" : "Active",
            last_payment_status:
              val?.last_payment_status == "FAILED" &&
              val?.last_payment_status != null
                ? "Failed"
                : "Paid",
            currency: val.plan_currency,
            plan_billing_amount: val.plan_billing_amount
              ? val.plan_billing_amount.toFixed(2)
              : "0.00",
            added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),
            start_date: moment(val.start_date).format("DD-MM-YYYY H:mm:ss"),
            subs_start_date: start_date
              ? moment(start_date.next_due_date).format("DD-MM-YYYY")
              : "",
            subs_next_date: next_date
              ? moment(next_date.next_due_date).format("DD-MM-YYYY")
              : "",
            //last_payment_amount: extra_info[0]?.last_payment_amount ? extra_info[0]?.last_payment_amount : "",
            last_payment_term: get_total_count_paid
              ? get_total_count_paid
              : "0",
            last_payment_date: val?.last_payment_date
              ? moment(val?.last_payment_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
            card_no: get_card_details.card_no
              ? "xxxx xxxx xxxx " + get_card_details.card_no
              : "",
            card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
            due_amount: due_amount,
          };
          send_res.push(temp);
        }
        let total_count = await subs_plan_model.get_count_all_conditions(
          condition_for_count,
          like_condition,
          date
        );
        // let total_count = await subs_plan_model.get_count_pay(
        //     condition_for_count
        // );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Subscriber list fetched successfully.",
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
  get_subscriber: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subscriber_id"));
    subs_plan_model
      .selectSubscriber("*", { id: id })
      .then(async (result) => {
        let data = await subs_plan_model.selectSubsPay("*", {
          subscription_id: result.subscription_id,
          payment_status: "CAPTURED",
        });
        let get_card_details = await subs_plan_model.selectCardsDetails(
          {
            "sp.subscription_id": result.subscription_id,
            "sp.payment_status": "CAPTURED",
          },
          req.body.mode
        );
        let card_id = enc_dec.cjs_decrypt(get_card_details?.card_id);
        let card_expiry = "";

        if (card_id) {
          let used_card = await subs_plan_model.getCard(
            {
              id: card_id,
            },
            "customers_cards"
          );

          if (used_card && used_card.length > 0) {
            card_expiry = used_card[0].card_expiry
              ? used_card[0].card_expiry
              : "";
          }
        }

        let get_merchant = await subs_plan_model.selectOneDynamic(
          "submerchant_id,discounted_terms,discounted_amount,expiry_date",
          {
            id: result.plan_id,
            status: 0,
          },
          "subs_plans"
        );
        let payment_data = [];
        for (val of data) {
          let temp = {
            payment_id: enc_dec.cjs_encrypt(val.id),
            payment_status: val.payment_status,
            payment_mode: val.mode_of_payment,
            order_no: val.order_no,
            added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),

            transaction_date: moment(val.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          payment_data.push(temp);
        }
        let recurr_data = await helpers.get_recurring_by_subscription_id(
          result.subscription_id,
          12
        );
        let count_recurring =
          await helpers.get_recurring_count_by_subscription_id({
            subscription_id: result.subscription_id,
          });
        let rec_data = [];
        for (recurring of recurr_data) {
          let resp_recurring = {
            next_due_date: recurring.next_due_date
              ? moment(recurring.next_due_date).format("DD-MM-YYYY")
              : "",
            amount: recurring.amount ? recurring.amount : "",
            is_paid: recurring.is_paid,
            is_failed: recurring.is_failed,
            order_id: recurring.order_id ? recurring.order_id : "",
            payment_id: recurring?.payment_id,
          };
          rec_data.push(resp_recurring);
        }
        let common_subscribers_id = await helpers.get_common_subscriber_id(
          result.email,
          result.mode
        );
        let send_res = {
          subscription_id: result.subscription_id ? result.subscription_id : "",
          plan_name: result.plan_name ? result.plan_name : "",
          plan_id: await helpers.get_subs_plan_id(result.plan_id),
          email: result.email ? result.email : "",
          name: result.name ? result.name : "",
          mobile_no: result.mobile_no ? result.mobile_no : "",
          merchant_name: get_merchant.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(
                get_merchant.submerchant_id
              )
            : "",
          super_merchant_name: result.super_merchant
            ? await helpers.get_super_merchant_name(result.super_merchant)
            : "",
          plan_description: result.plan_description
            ? result.plan_description
            : "",
          plan_billing_frequency: result.plan_billing_frequency
            ? result.plan_billing_frequency
            : "",
          status: result.status == 0 ? "Active" : "De-active",
          currency: result.plan_currency ? result.plan_currency : "",
          payment_status: result.payment_status ? result.payment_status : "",
          initial_payment_amount: result.initial_payment_amount
            ? result.initial_payment_amount.toFixed(2)
            : 0.0,
          payment_interval: result.payment_interval
            ? result.payment_interval
            : 0,
          terms: result.terms == "1999" ? "Unlimited" : result.terms,
          final_payment_amount: result.final_payment_amount
            ? result.final_payment_amount.toFixed(2)
            : 0.0,
          plan_billing_amount:
            result.plan_currency + " " + result.plan_billing_amount.toFixed(2),
          added_date: moment(result.added_date).format("DD-MM-YYYY H:mm:ss"),
          start_date: moment(result.start_date).format("DD-MM-YYYY H:mm:ss"),
          pay_data: payment_data,
          recurring: rec_data,
          customer_email: get_card_details?.email
            ? get_card_details?.email
            : "",
          card_expiry: card_expiry,
          card_no: get_card_details.card_no
            ? "xxxx xxxx xxxx " + get_card_details.card_no
            : "",
          card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
          payment_method: get_card_details.payment_mode
            ? get_card_details.payment_mode
            : "",
          customer_name: get_card_details?.customer_name
            ? get_card_details?.customer_name
            : "",
          expiry_date:
            get_merchant.expiry_date != null
              ? moment(get_merchant.expiry_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
          discounted_terms: get_merchant.discounted_terms
            ? get_merchant.discounted_terms
            : "-",
          discounted_amount:
            get_merchant.discounted_amount != "0"
              ? result.plan_currency +
                " " +
                get_merchant.discounted_amount.toFixed(2)
              : "-",
          count_recurring: count_recurring,
          common_subscribers_id: common_subscribers_id
            ? await helpers.formatNumber(common_subscribers_id)
            : "",
        };
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
  view_subscriber: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subscriber_id"));
    let cust_id = enc_dec.cjs_decrypt(req.bodyString("cust_id"));
    subs_plan_model
      .selectSubscriberCust({ ["s.id"]: id })
      .then(async (result) => {
        let data = await subs_plan_model.selectSubsPay("*", {
          subscription_id: result.subscription_id,
          payment_status: "CAPTURED",
        });
        console.log(`data is here`);
        console.log(data);
        let get_card_details = await subs_plan_model.selectCardsDetails(
          {
            "sp.subscription_id": result.subscription_id,
            "sp.payment_status": "CAPTURED",
          },
          req.bodyString("mode")
        );
        console.log(`data is here`);
        console.log(get_card_details);
        let card_id = enc_dec.cjs_decrypt(get_card_details?.card_id);
        let card_expiry = "";

        if (card_id) {
          let used_card = await subs_plan_model.getCard(
            {
              id: card_id,
            },
            "customers_cards"
          );

          if (used_card && used_card.length > 0) {
            card_expiry = used_card[0].card_expiry
              ? used_card[0].card_expiry
              : "";
          }
        }
        let payment_data = [];
        for (val of data) {
          let temp = {
            payment_id: enc_dec.cjs_encrypt(val.id),
            payment_status: val.payment_status,
            payment_mode: val.mode_of_payment,
            order_no: val.order_no,
            added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),

            transaction_date: moment(val.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          payment_data.push(temp);
        }
        let table = "orders";
        if (req.bodyString("mode") == "test") {
          table = "test_orders";
        }
        let transaction_data = await subs_plan_model.selectCustomerTransaction(
          "*",
          {
            customer_email: result.email,
            origin: "Subscription",
            super_merchant: result.super_merchant,
          },
          table
        );
        let transaction = [];
        for (let val of transaction_data) {
          let res = {
            order_id: val.order_id,
            order_amount: val.currency + " " + val.amount.toFixed(2),
            order_currency: val.currency,
            status: val.status,
            billing_address_1: val.billing_address_line_1,
            billing_address_2: val.billing_address_line_2,
            billing_city: val.billing_city,
            billing_pincode: val.billing_pincode,
            billing_province: val.billing_province,
            billing_country: await helpers.get_customer_country(
              val.billing_country,
              "country"
            ),
            shipping_address_1: val.shipping_address_line_1,
            shipping_address_2: val.shipping_address_line_2,
            shipping_city: val.shipping_city,
            shipping_province: val.shipping_province,
            shipping_country: val.shipping_country,
            shipping_pincode: val.shipping_pincode,
            transaction_date: await date_formatter.get_date_time(
              val.created_at
            ),
          };
          transaction.push(res);
        }

        let common_subscribers_id = await helpers.get_common_subscriber_id(
          result.email,
          result.mode
        );
        let send_res = {
          subscription_id: result.subscription_id ? result.subscription_id : "",
          email: result.email ? result.email : "",
          name: result.name ? result.name : "",
          mobile_no: result.mobile_no ? result.mobile_no : "",
          country_code: result.dial_code ? result.dial_code : "",
          merchant_name: result.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(result.merchant_id)
            : "",
          super_merchant_name: result.super_merchant
            ? await helpers.get_super_merchant_name(result.super_merchant)
            : "",

          status: result.status == 0 ? "Active" : "De-active",

          added_date: moment(result.added_date).format("DD-MM-YYYY H:mm:ss"),
          start_date: moment(result.start_date).format("DD-MM-YYYY H:mm:ss"),
          pay_data: payment_data,
          customer_email: get_card_details?.email
            ? get_card_details?.email
            : "",
          card_expiry: card_expiry,
          card_no: get_card_details.card_no
            ? "xxxx xxxx xxxx " + get_card_details.card_no
            : "",
          card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
          payment_method: get_card_details.payment_mode
            ? get_card_details.payment_mode
            : "",
          customer_name: get_card_details?.customer_name
            ? get_card_details?.customer_name
            : "",
          common_subscribers_id: common_subscribers_id
            ? await helpers.formatNumber(common_subscribers_id)
            : "",
          transaction_data: transaction,
        };
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
  cancel: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subscription_id"));
    let update_data = { status: 0 };
    subs_plan_model
      .updateDynamic({ id: id }, update_data, "subscription")
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Subscription cancelled successfully."));
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  details: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_plan_id"));
    let result;
    if (req.user.type == "admin") {
      result = await subs_plan_model.selectOne("*", {
        id: id,
      });
    } else {
      result = await subs_plan_model.selectOne("*", {
        id: id,
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
      });
    }

    let resp;
    let send_res;
    if (result) {
      let date = moment().format("YYYY-MM-DD HH:mm:ss");
      let exp;
      let day = moment().format("YYYY-MM-DD");
      let merchant_details = await subs_plan_model.select_merchant_details({
        "mm.id": result.submerchant_id,
      });
      let datalink = await QRCode.toDataURL(plan_link_url + result.ref_no);

      resp = {
        id: enc_dec.cjs_encrypt(result.id),
        sub_merchant_id: enc_dec.cjs_encrypt(result.submerchant_id),
        sub_merchant_name: merchant_details.company_name,
        country_code: merchant_details.code,
        business_mobile_number: merchant_details.mobile_no,
        logo_url: server_addr + "/static/files/" + merchant_details.icon,
        logo_file: merchant_details.icon,
        plan_id: result.plan_id,
        ref_no: result.ref_no,
        plan_name: result.plan_name,
        currency: result.plan_currency,
        amount: result.initial_payment_amount,
        payment_link: plan_link_url + result.ref_no,
        qr_code: datalink,
      };
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(resp, "Details fetched successfully."));
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id."));
    }
    /*if (result) {
            if (result.type_of_qr_code == "Static_QR") {
                let datalink = await QRCode.toDataURL(
                    qr_link_url + result.qr_id
                );
                resp = {
                    id: enc_dec.cjs_encrypt(result.id),
                    sub_merchant_id: await enc_dec.cjs_encrypt(
                        result.sub_merchant_id
                    ),
                    sub_merchant_name: merchant_name[result.sub_merchant_id],
                    country_code: merchant_code[result.sub_merchant_id],
                    business_mobile_number:
                        merchant_mobile[result.sub_merchant_id],
                    logo_url:
                        server_addr +
                        ":" +
                        port +
                        "/static/files/" +
                        merchant_logo[result.sub_merchant_id],
                    logo_file: merchant_logo[result.sub_merchant_id]
                        ? merchant_logo[result.sub_merchant_id]
                        : "",
                    currency: result.currency,
                    type_of_qr: result.type_of_qr_code,
                    qr_id: result.qr_id,
                    datalink: datalink,
                    merchant_id: result.merchant_id,
                    reseted_qr: result.is_reseted,
                    is_expiry: result.is_expiry,
                    description: result.description,
                    status: result.status == 1 ? "Deactivated" : "Activated",
                    payment_list: await qrGenerateModule.list_of_payment({
                        merchant_qr_id: result.id,
                    }),
                    error_message: result.error_message,
                };
            } else if (result.type_of_qr_code == "Dynamic_QR") {
                let date = new Date().toISOString().slice(0, 10);
                let exp;
                let count_payment;
                let per_day_count;
                per_day_count = await qrGenerateModule.get_count_payment({
                    merchant_qr_id: id,
                    type_of_qr_code: "'Dynamic_QR'",
                    payment_status: "'completed'",
                    transaction_date: "'" + date + "'",
                });
                count_payment = await qrGenerateModule.get_count_payment({
                    merchant_qr_id: id,
                    type_of_qr_code: "'Dynamic_QR'",
                    payment_status: "'completed'",
                });
                let day = new Date().toLocaleDateString("sv");
                let datalink = await QRCode.toDataURL(
                    qr_link_url + result.qr_id
                );
                resp = {
                    id: enc_dec.cjs_encrypt(result.id),
                    sub_merchant_id: await enc_dec.cjs_encrypt(
                        result.sub_merchant_id
                    ),
                    sub_merchant_name: merchant_name[result.sub_merchant_id],
                    country_code: merchant_code[result.sub_merchant_id],
                    business_mobile_number:
                        merchant_mobile[result.sub_merchant_id],
                    logo_url:
                        server_addr +
                        ":" +
                        port +
                        "/static/files/" +
                        merchant_logo[result.sub_merchant_id],
                    logo_file: merchant_logo[result.sub_merchant_id]
                        ? merchant_logo[result.sub_merchant_id]
                        : "",
                    type_of_qr: result.type_of_qr_code,
                    qr_id: result.qr_id,
                    qr_link: datalink,
                    currency: result.currency,
                    quantity: result.quantity,
                    amount: result.amount,
                    no_of_collection: result.no_of_collection,
                    total_collection: result.total_collection,
                    overall_qty_allowed: result.overall_qty_allowed,
                    qty_frq: result.qty_frq,
                    todays_collection: per_day_count,
                    overall_collection: count_payment,
                    payment_link: qr_link_url + result.qr_id,
                    is_expiry: result.is_expiry,
                    start_date: moment(result.start_date).format("DD-MM-YYYY"),
                    end_date:
                        result.end_date != "1969-12-31"
                            ? moment(result.end_date).format("DD-MM-YYYY")
                            : "",
                    description: result.description,
                    expiry_status:
                        result.end_date < day ? "Expired" : "No expiry",
                    status: result.status == 1 ? "Deactivated" : "Activated",
                    payment_list: await qrGenerateModule.list_of_payment({
                        merchant_qr_id: result.id,
                    }),
                    error_message: result.error_message,
                };
            }
            res.status(statusCode.ok).send(
                response.successdatamsg(resp, "Details fetched successfully.")
            );
        } else {
            res.status(statusCode.internalError).send(
                response.errormsg("Invalid id.")
            );
        } */
  },

  create_plan_order: async (req, res) => {
    let client = {
      os: req.headers.os ? req.headers.os : "",
      browser: req.headers.browser ? req.headers.browser : "",
      ip: req.headers.ip ? req.headers.ip : "",
      browser_version: req.headers["x-browser-version"],
    };
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let customer_details = req.body.data.customer_details;
    let order_details = req.body.data.order_details;
    let billing_details = req.body.data.billing_details;
    let shipping_details = req.body.data.shipping_details;
    let plan_order_data = await subs_plan_model.selectData(
      req.body.data.order_details.planlink_id
    );
    let order_id = await helpers.make_sequential_no("ORD");
    let mode = "live";
    let status = "PENDING";
    let token_payload = {
      order_id: order_id,
      amount: order_details.amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      env: mode,
      merchant_id: plan_order_data.submerchant_id,
    };
    let amount = req.body.data.order_details.amount
      ? req.body.data.order_details.amount
      : 0;
    let quantity = req.body.data.order_details.quantity
      ? req.body.data.order_details.quantity
      : 1;
    let total_amount = amount * quantity;
    let token = accessToken(token_payload);
    let ins_body = {
      merchant_id: plan_order_data.submerchant_id,
      payment_id: "",
      mcc: plan_order_data.mcc_id ? plan_order_data.mcc_id : 0,
      mcc_category: plan_order_data.mcc_cat_id ? plan_order_data.mcc_cat_id : 0,
      super_merchant: plan_order_data.super_merchant_id
        ? plan_order_data.super_merchant_id
        : 0,
      customer_name: customer_details.name ? customer_details.name : "",
      customer_email: customer_details.email,
      customer_code: customer_details.code,
      customer_mobile: customer_details.mobile,
      billing_address_line_1: billing_details.address_line1,
      billing_address_line_2: billing_details.address_line2,
      billing_city: billing_details.city,
      billing_pincode: billing_details.pin,
      billing_province: billing_details.province,
      billing_country: billing_details.country,
      shipping_address_line_1: shipping_details.address_line1,
      shipping_address_line_2: shipping_details.address_line2,
      shipping_city: shipping_details.city,
      shipping_country: shipping_details.country,
      shipping_province: shipping_details.province,
      shipping_pincode: shipping_details.pin,
      amount: total_amount,
      currency: order_details.currency,
      return_url: order_details.return_url,
      status: status,
      origin: "Subscription",
      order_id: order_id,
      browser: client.browser,
      browser_version: client.browser_version,
      ip: client.ip,
      os: client.os,
      created_at: created_at,
      updated_at: updated_at,
      card_no: "",
      cid: "",
      remark: "",
      payment_mode: "",
      sale_charge: 0,
      sale_tax: 0,
      buy_charge: 0,
      buy_tax: 0,
      psp: "",
      expiry: "",
      cardholderName: "",
      scheme: "",
      cardType: "",
      cardCategory: "",
      pan: "",
    };
    let plan_ins_body = {
      merchant_qr_id: plan_order_data.id,
      merchant_id: plan_order_data.submerchant_id,
      order_no: order_id,
      payment_id: req.body.data.order_details.planlink_id,
      name: customer_details.name ? customer_details.name : "",
      email: customer_details.email,
      code: customer_details.code,
      mobile: customer_details.mobile,
      type_of_qr_code: plan_order_data.type_of_qr_code
        ? plan_order_data.type_of_qr_code
        : "Dynamic_QR",
      amount: order_details.amount,
      currency: order_details.currency,
      quantity: order_details.quantity,
      total_amount: total_amount,
      mode_of_payment: "",
      payment_status: status,
      remark: "",
      mcc: plan_order_data.mcc_id ? plan_order_data.mcc_id : 0,
      mcc_category: plan_order_data.mcc_cat_id ? plan_order_data.mcc_cat_id : 0,
      super_merchant: plan_order_data.super_merchant_id
        ? plan_order_data.super_merchant_id
        : 0,
      added_date: created_at,
      transaction_date: created_at,
    };
    let add_plan_data = await subs_plan_model.addDynamic(
      plan_ins_body,
      "plan_payment"
    );
    subs_plan_model
      .add_order(ins_body, mode)
      .then((result) => {
        let res_order_details = {
          status: status,
          message: "Order created",
          token: token,
          order_id: order_id,
          amount: order_details.currency + " " + order_details.amount,
          plan_link:
            process.env.PAYMENT_URL +
            "initiate/" +
            order_id +
            "/" +
            token +
            "/live",
        };
        res.status(statusCode.ok).send(res_order_details);
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  expired_list: async (req, res) => {
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
    let date = {};
    if (req.bodyString("from_date")) {
      date.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date.to_date = req.bodyString("to_date");
    }
    let condition = {
      "sp.super_merchant": req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let search_terms = {};
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition["sp.merchant_id"] = selected_merchant;
    }
    if (req.bodyString("plan_id")) {
      condition["psp.id"] = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
    }
    if (req.bodyString("email")) {
      search_terms[" sp.subscription_id"] = req.bodyString("email");
      search_terms[" o.customer_email"] = req.bodyString("email");
    }
    if (req.bodyString("subscriber_id")) {
      let subscriber_id = parseInt(req.bodyString("subscriber_id"), 10);
      let common_subscribers_email =
        await helpers.get_common_subscriber_email_by_id(subscriber_id);
      condition["s.email"] = common_subscribers_email;
    }
    let expire_con = req.bodyString("is_expired") == "yes" ? "yes" : "no";

    if (req.bodyString("mode") == "live") {
      subs_plan_model
        .selectExpiredCards(condition, limit, expire_con, search_terms, date)
        .then(async (result) => {
          let subscription_id = [];
          let send_res = [];
          for (val of result) {
            let common_subscribers_id = await helpers.get_common_subscriber_id(
              val.customer_email,
              req.bodyString("mode"),
              val.id
            );
            let subscription_result =
              await checkSubscription.checkForSubscriptionRecurring(
                val.subscription_id
              );
            if (
              subscription_result &&
              Object.keys(subscription_result).length > 0 &&
              subscription_result.unpaid_recurring > 0
            ) {
              let recurr_data = await helpers.get_recurring_data(
                { subscription_id: `'${val.subscription_id}'`, is_paid: 0 },
                "asc"
              );
              let next_date = await helpers.get_recurring_start_next_date(
                {
                  subscription_id: `'${val.subscription_id}'`,
                  is_paid: 0,
                  is_failed: 0,
                },
                "asc"
              );
              let plan_data = await helpers.getPlan(val.subscription_id);
              let due_amt = next_date
                ? val?.plan_currency + " " + next_date.amount.toFixed(2)
                : "0.00";
              let terms =
                plan_data.terms === 1999 ? "Unlimited" : plan_data.terms;

              let temp = {
                subscription_id: enc_dec.cjs_encrypt(val.subs_id),
                subs_id: val.subscription_id ? val.subscription_id : "",
                plan_name: val?.plan_name ? val?.plan_name : "",
                plan_id: val?.plan_name ? val?.plan_id : "",
                order_no: val?.order_no ? val?.order_no : "",

                merchant_email: val?.merchant_email ? val?.merchant_email : "",
                merchant_name: val?.company_name ? val?.company_name : "",
                customer_email: val?.customer_email ? val?.customer_email : "",
                card_expiry: val.card_expiry ? val.card_expiry : "",
                card_no: val.card_no ? "xxxx xxxx xxxx " + val.card_no : "",
                customer_name: val?.customer_name ? val?.customer_name : "",
                added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),
                status: val.status == 0 ? "Inactive" : "Active",
                due_amt: due_amt,
                terms: terms,
                due_date: next_date
                  ? moment(next_date.next_due_date).format("DD-MM-YYYY")
                  : "-",
                common_subscribers_id: common_subscribers_id
                  ? await helpers.formatNumber(common_subscribers_id)
                  : "",
              };
              send_res.push(temp);
              subscription_id.push(val.subscription_id);
            }
          }
          let join_condition = "";
          if (Object.keys(subscription_id).length) {
            let unpaid_subs_id = subscription_id.toString().split(",");
            const subs_join =
              "(" + unpaid_subs_id.map((item) => `'${item}'`).join(", ") + ")";
            if (subs_join != "()") {
              join_condition = `and sp.subscription_id IN ${subs_join} `;
            }
          }

          let total_count = await subs_plan_model.selectExpiredCardsCount(
            condition,
            search_terms,
            date,
            expire_con,
            join_condition
          );
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "Sub_plan list fetched successfully.",
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
    } else {
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            (send_res = []),
            "Sub_plan list fetched successfully.",
            (total_count = 0)
          )
        );
    }
  },
  logs: async (req, res) => {
    let today = moment().format("YYYY-MM-DD HH:mm:ss");
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
    let condition = {
      deleted: 0,
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition.submerchant_id = selected_merchant;
    }
    if (req.bodyString("plan_id")) {
      condition.plan_id = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
    }
    let search = "";
    if (req.bodyString("search_string")) {
      search = req.bodyString("search_string");
    }
    subs_plan_model
      .select_logs(condition, limit, search)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let status = await helpers.getSubsStatus(val.plan_id);

          let temp = {
            subs_plan_id: enc_dec.cjs_encrypt(val.id),
            plan_name: val?.plan_name ? val?.plan_name : "",
            plan_description: val?.plan_description
              ? val?.plan_description
              : "",
            plan_billing_frequency: val?.plan_billing_frequency
              ? val?.plan_billing_frequency
              : "",
            plan_interval: val.payment_interval ? val.payment_interval : "",
            status:
              moment(status.expiry_date).format("YYYY-MM-DD HH:mm:ss") >=
                today ||
              moment(status.expiry_date).format("YYYY-MM-DD HH:mm:ss") ==
                "Invalid date"
                ? status.status == 0
                  ? "Active"
                  : "Deactivated"
                : "Expired",
            currency: val?.plan_currency ? val?.plan_currency : "",
            terms: val?.terms == "1999" ? "Unlimited" : val?.terms,
            plan_billing_amount: val?.plan_billing_amount
              ? val?.plan_billing_amount.toFixed(2)
              : "",
            initial_amount: val?.initial_payment_amount
              ? val?.initial_payment_amount.toFixed(2)
              : "",
            final_amount: val?.final_payment_amount
              ? val?.final_payment_amount.toFixed(2)
              : "",
            note: val?.note ? val?.note : "",
            start_date: moment(val.start_date).format("DD-MM-YYYY HH:mm:ss"),
            submerchant_id: val?.submerchant_id
              ? enc_dec.cjs_encrypt(val?.submerchant_id)
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
            expiry_date:
              val.expiry_date != null
                ? moment(val.expiry_date).format("DD-MM-YYYY HH:mm:ss")
                : "",
            discounted_terms: val.discounted_terms ? val.discounted_terms : "-",
            discounted_amount:
              val.discounted_amount != "0"
                ? val.plan_currency + " " + val.discounted_amount.toFixed(2)
                : "-",
            plan_id: val.plan_no ? val.plan_no : "",
            ref_no: val.ref_no ? val.ref_no : "",
            created_by: val.created_by
              ? await helpers.get_super_merchant_name(val.created_by)
              : "",
            logs_activity: val.activity,
            last_update_at: moment(val.updated_at).format(
              "DD-MM-YYYY HH:mm:ss"
            ),
            created_at: moment(val.created_at).format("DD-MM-YYYY HH:mm:ss"),
          };
          send_res.push(temp);
        }
        let total_count = await subs_plan_model.get_count_logs(condition);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Sub_plan list fetched successfully.",
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
  add_logs_data: async (plan_id, activity, user_id) => {
    let condition = {
      id: plan_id,
    };
    await subs_plan_model
      .selectOne("*", condition)
      .then(async (res) => {
        let added_date = moment().format("YYYY-MM-DD HH:mm:ss");

        let logs_data = {
          plan_id: plan_id,
          plan_no: res.plan_id,
          plan_name: res.plan_name,
          plan_description: res.plan_description,
          plan_billing_frequency: res.plan_billing_frequency,
          plan_currency: res.plan_currency,
          plan_billing_amount: res.plan_billing_amount,
          note: res.note,
          updated_at: added_date,
          payment_interval: res.payment_interval,
          initial_payment_amount: res.initial_payment_amount,
          start_date: moment(res.start_date).format("YYYY-MM-DD HH:mm:ss"),
          terms: res.terms,
          final_payment_amount: res.final_payment_amount,
          submerchant_id: res.submerchant_id,
          merchant_id: res.merchant_id,
          activity: activity,
          expiry_date: moment(res.expiry_date).format("YYYY-MM-DD HH:mm:ss"),
          discounted_terms: res.discounted_terms,
          discounted_amount: res.discounted_amount,
          created_by: user_id,
        };
        subs_plan_model
          .add_logs(logs_data)
          .then(async (result) => {})
          .catch((error) => {
           logger.error(500,{message: error,stack: error.stack}); 

            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((err) => {
        winston.error(err);
      });

    return;
  },
  setup_create: async (req, res) => {
    let ins_data = {
      merchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      about_expire_frequency: req.bodyString("about_to_expire"),
      expired_cards_frequency: req.bodyString("expired"),
      time: req.bodyString("time"),
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      added_date: moment().format("YYYY-MM-DD HH:mm:ss"),
      mode: 1, // live
    };
    subs_plan_model
      .add_setup(ins_data)
      .then(async (result) => {
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription setup created successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  subs_setup_list: async (req, res) => {
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
    let condition = {
      deleted: 0,
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition.merchant_id = selected_merchant;
    }
    if (req.bodyString("mode")) {
      condition.mode = req.bodyString("mode") == "live" ? 1 : 0;
    }
    subs_plan_model
      .selectSubscriptionSetup(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            subs_setup_id: enc_dec.cjs_encrypt(val.id),

            expired_cards_frequency: val?.expired_cards_frequency
              ? val?.expired_cards_frequency
              : "",
            about_expire_frequency: val?.about_expire_frequency
              ? val?.about_expire_frequency
              : "",
            time: val?.time ? val?.time : "",
            status: val?.deleted == 0 ? "Active" : "Deactivated",

            submerchant_id: val?.merchant_id
              ? enc_dec.cjs_encrypt(val?.merchant_id)
              : "",
            submerchant_name: val?.merchant_id
              ? await helpers.get_submerchant_name_by_id(val?.merchant_id)
              : "",
          };
          send_res.push(temp);
        }
        let total_count = await subs_plan_model.get_count_setup(condition);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Sub_plan setup list fetched successfully.",
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
  get_setup_details: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subs_setup_id"));
    let result;

    val = await subs_plan_model.selectOneSetup("*", {
      id: id,
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    });
    if (val) {
      let resp = {
        subs_setup_id: enc_dec.cjs_encrypt(val.id),

        expired_cards_frequency: val?.expired_cards_frequency
          ? val?.expired_cards_frequency
          : "",
        about_expire_frequency: val?.about_expire_frequency
          ? val?.about_expire_frequency
          : "",
        time: val?.time ? val?.time : "",
        status: val?.deleted == 0 ? "Active" : "Deactivated",

        submerchant_id: val?.merchant_id
          ? enc_dec.cjs_encrypt(val?.merchant_id)
          : "",
        submerchant_name: val?.merchant_id
          ? await helpers.get_submerchant_name_by_id(val?.merchant_id)
          : "",
      };
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(resp, "Details fetched successfully."));
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id."));
    }
  },
  setup_update: async (req, res) => {
    let setup_id = enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    let ins_data = {
      merchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      about_expire_frequency: req.bodyString("about_to_expire"),
      expired_cards_frequency: req.bodyString("expired"),
      time: req.bodyString("time"),
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    subs_plan_model
      .updateSetup({ id: setup_id }, ins_data)
      .then(async (result) => {
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription setup updated successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  sendSubscriptionExpiredEmail: (req, res) => {
    try {
      const subscription_id = req.bodyString("subscription_id");
      SendMail.sendCardExpiredEmail(subscription_id);

      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail send successfully."));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  sendSubscriptionAboutToExpiredEmail: (req, res) => {
    try {
      const subscription_id = req.bodyString("subscription_id");
      SendMail.sendCardAboutExpiredEmail(subscription_id);
      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail send successfully."));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  declined_cards: async (req, res) => {
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
    let date = {};
    if (req.bodyString("from_date")) {
      date.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date.to_date = req.bodyString("to_date");
    }
    let condition = {
      "sp.super_merchant": req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
    };
    let search_terms = {};
    let selected_merchant = enc_dec.cjs_decrypt(
      req.bodyString("selected_merchant")
    );
    if (selected_merchant != 0) {
      condition["sp.merchant_id"] = selected_merchant;
    }
    if (req.bodyString("plan_id")) {
      condition["psp.id"] = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
    }
    if (req.bodyString("subscriber_id")) {
      let subscriber_id = parseInt(req.bodyString("subscriber_id"), 10);
      let common_subscribers_email =
        await helpers.get_common_subscriber_email_by_id(subscriber_id);
      condition["s.email"] = common_subscribers_email;
    }
    if (req.bodyString("email")) {
      search_terms[" sp.subscription_id"] = req.bodyString("email");
      search_terms[" o.customer_email"] = req.bodyString("email");
    }
    if (req.bodyString("mode") == "live") {
      subs_plan_model
        .selectDeclinedCards(condition, limit, search_terms, date)
        .then(async (result) => {
          let subscription_id = [];
          let send_res = [];
          for (val of result) {
            let common_subscribers_id = await helpers.get_common_subscriber_id(
              val.customer_email,
              val.mode
            );
            let subscription_result =
              await subs_plan_model.checkForSubscriptionRecurring(
                val.subscription_id
              );
            if (
              subscription_result &&
              Object.keys(subscription_result).length > 0 &&
              subscription_result.unpaid_recurring > 0
            ) {
              let recurr_data = await helpers.get_recurring_data(
                { subscription_id: `'${val.subscription_id}'`, is_paid: 0 },
                "asc"
              );
              let next_date = await helpers.get_recurring_start_next_date(
                {
                  subscription_id: `'${val.subscription_id}'`,
                  is_paid: 0,
                  is_failed: 0,
                },
                "asc"
              );
              let plan_data = await helpers.getPlan(val.subscription_id);
              let due_amt = next_date
                ? val?.plan_currency + " " + next_date.amount.toFixed(2)
                : "0.00";
              let terms =
                plan_data.terms == 1999 ? "Unlimited" : plan_data.terms;

              let temp = {
                subscription_id: enc_dec.cjs_encrypt(val.subs_id),
                subs_id: val.subscription_id ? val.subscription_id : "",
                plan_name: val?.plan_name ? val?.plan_name : "",
                plan_id: val?.plan_name ? val?.plan_id : "",
                order_no: val?.order_no ? val?.order_no : "",

                merchant_email: val?.merchant_email ? val?.merchant_email : "",
                merchant_name: val?.company_name ? val?.company_name : "",
                customer_email: val?.customer_email ? val?.customer_email : "",
                card_expiry: val.card_expiry ? val.card_expiry : "",
                card_no: val.card_no ? "xxxx xxxx xxxx " + val.card_no : "",
                customer_name: val?.customer_name ? val?.customer_name : "",
                added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),
                status: val.status == 0 ? "Inactive" : "Active",
                due_amt: due_amt,
                terms: terms,
                due_date: next_date
                  ? moment(next_date.next_due_date).format("DD-MM-YYYY")
                  : "-",
                remark: val?.remark ? val?.remark : "",
                common_subscribers_id: common_subscribers_id
                  ? await helpers.formatNumber(common_subscribers_id)
                  : "",
              };
              send_res.push(temp);
              subscription_id.push(val.subscription_id);
            }
          }
          let join_condition = "";
          if (Object.keys(subscription_id).length) {
            let unpaid_subs_id = subscription_id.toString().split(",");
            const subs_join =
              "(" + unpaid_subs_id.map((item) => `'${item}'`).join(", ") + ")";
            if (subs_join != "()") {
              join_condition = `and sp.subscription_id IN ${subs_join} `;
            }
          }

          let total_count = await subs_plan_model.selectDeclinedCardsCount(
            condition,
            search_terms,
            date,
            join_condition
          );
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "Sub_plan list fetched successfully.",
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
    } else {
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            (send_res = []),
            "Sub_plan list fetched successfully.",
            (total_count = 0)
          )
        );
    }
  },
  sendSubscriptionDeclinedEmail: (req, res) => {
    try {
      const subscription_id = req.bodyString("subscription_id");
      SendMail.sendDeclinedCardsEmail(subscription_id);
      return res
        .status(statusCode.ok)
        .send(response.successmsg("Mail send successfully."));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  get_subscriber_declined_cards: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subscriber_id"));
    subs_plan_model
      .selectSubscriber("*", { id: id })
      .then(async (result) => {
        let data = await subs_plan_model.selectSubsPay("*", {
          subscription_id: result.subscription_id,
          payment_status: "CAPTURED",
        });
        let get_card_details = await subs_plan_model.GetDeclinedCards({
          "sp.subscription_id": result.subscription_id,
        });

        let get_merchant = await subs_plan_model.selectOneDynamic(
          "submerchant_id,discounted_amount,discounted_terms,expiry_date",
          {
            id: result.plan_id,
            status: 0,
          },
          "subs_plans"
        );
        let payment_data = [];
        for (val of data) {
          let temp = {
            payment_id: enc_dec.cjs_encrypt(val.id),
            payment_status: val.payment_status,
            payment_mode: val.mode_of_payment,
            order_no: val.order_no,
            added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),

            transaction_date: moment(val.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          payment_data.push(temp);
        }
        let recurr_data = await helpers.get_recurring_by_subscription_id(
          result.subscription_id,
          12
        );
        let count_recurring =
          await helpers.get_recurring_count_by_subscription_id({
            subscription_id: result.subscription_id,
          });
        let rec_data = [];
        for (recurring of recurr_data) {
          let resp_recurring = {
            next_due_date: recurring.next_due_date
              ? moment(recurring.next_due_date).format("DD-MM-YYYY")
              : "",
            amount: recurring.amount ? recurring.amount : "",
            is_paid: recurring.is_paid,
            is_failed: recurring.is_failed,
            order_id: recurring.order_id ? recurring.order_id : "",
            payment_id: recurring.payment_id ? recurring.payment_id : "",
          };
          rec_data.push(resp_recurring);
        }
        let common_subscribers_id = await helpers.get_common_subscriber_id(
          result.email,
          result.mode
        );
        let send_res = {
          subscription_id: result.subscription_id ? result.subscription_id : "",
          plan_name: result.plan_name ? result.plan_name : "",
          plan_id: await helpers.get_subs_plan_id(result.plan_id),
          email: result.email ? result.email : "",
          name: result.name ? result.name : "",
          mobile_no: result.mobile_no ? result.mobile_no : "",
          merchant_name: get_merchant.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(
                get_merchant.submerchant_id
              )
            : "",
          super_merchant_name: result.super_merchant
            ? await helpers.get_super_merchant_name(result.super_merchant)
            : "",
          plan_description: result.plan_description
            ? result.plan_description
            : "",
          plan_billing_frequency: result.plan_billing_frequency
            ? result.plan_billing_frequency
            : "",
          status: result.status == 0 ? "Active" : "De-active",
          currency: result.plan_currency ? result.plan_currency : "",
          payment_status: result.payment_status ? result.payment_status : "",
          initial_payment_amount: result.initial_payment_amount
            ? result.initial_payment_amount.toFixed(2)
            : 0.0,
          payment_interval: result.payment_interval
            ? result.payment_interval
            : 0,
          terms: result.terms ? result.terms : 0,
          final_payment_amount: result.final_payment_amount
            ? result.final_payment_amount.toFixed(2)
            : 0.0,
          plan_billing_amount:
            result.plan_currency + " " + result.plan_billing_amount.toFixed(2),
          added_date: moment(result.added_date).format("DD-MM-YYYY H:mm:ss"),
          start_date: moment(result.start_date).format("DD-MM-YYYY H:mm:ss"),
          pay_data: payment_data,
          recurring: rec_data,
          customer_email: get_card_details.customer_email
            ? get_card_details.customer_email
            : "",
          card_expiry: get_card_details.card_expiry
            ? get_card_details.card_expiry
            : "",
          card_no: get_card_details.card_no
            ? "xxxx xxxx xxxx " + get_card_details.card_no
            : "",
          card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
          payment_method: get_card_details.payment_mode
            ? get_card_details.payment_mode
            : "",
          customer_name: get_card_details.customer_name
            ? get_card_details.customer_name
            : "",
          expiry_date:
            get_merchant.expiry_date != null
              ? moment(get_merchant.expiry_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
          discounted_terms: get_merchant.discounted_terms
            ? get_merchant.discounted_terms
            : "-",
          discounted_amount:
            get_merchant.discounted_amount != "0"
              ? result.plan_currency +
                " " +
                get_merchant.discounted_amount.toFixed(2)
              : "-",
          count_recurring: count_recurring,
          common_subscribers_id: common_subscribers_id
            ? await helpers.formatNumber(common_subscribers_id)
            : "",
        };
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
  plan_terms_list: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("plan_id"));
    subs_plan_model
      .select_terms({ plan_id: id }, req.bodyString("page"))
      .then(async (data) => {
        let send_res = [];
        for (val of data) {
          let temp = {
            terms_id: enc_dec.cjs_encrypt(val.id),
            plan_id: enc_dec.cjs_encrypt(val.plan_id),
            payment: val.payment_terms,
            amount: val.amount.toFixed(2),
          };
          send_res.push(temp);
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "List fetched successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  subscription_recurring_list: async (req, res) => {
    let id = req.bodyString("id");

    subs_plan_model
      .get_recurring_by_subscription_list(
        { subscription_id: id },
        req.bodyString("page")
      )
      .then(async (data) => {
        let send_res = [];
        for (recurring of data) {
          if (recurring.is_paid == "0" && recurring.is_failed == 0) {
            var is_paid_status = "-";
            var is_paid = await helpers.getStatusColor(is_paid_status);
          } else if (recurring.is_paid == "1") {
            var is_paid_status = "Paid";
            var is_paid = await helpers.getStatusColor("Paid");
          } else if (recurring.is_paid == "0" && recurring.is_failed == 1) {
            var is_paid = await helpers.getStatusColor("Failed");
            var is_paid_status = "Failed";
          }
          let temp = {
            next_due_date: recurring.next_due_date
              ? moment(recurring.next_due_date).format("DD-MM-YYYY")
              : "",
            amount: recurring.amount ? recurring.amount : "",
            is_paid: is_paid,
            is_paid_status: is_paid_status,
            is_failed: recurring.is_failed,
            order_id: recurring.order_id ? recurring.order_id : "",
            payment_id: recurring.payment_id ? recurring.payment_id : "",
          };
          send_res.push(temp);
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "List fetched successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_create: async (req, res) => {
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let plan_no = await helpers.get_plan_id();
    let req_terms = req.body.payment_terms;
    let billing_frequency = req.body.billing_frequency;
    let installment_amount = req.body.installment_amount;
    let terms = req.body.terms;
    let added_date = await date_formatter.created_date_time();
    let ins_terms = [];
    let terms_value = terms.unlimited == "yes" ? "1999" : terms.value;
    for (var i = 1; i <= terms_value; i++) {
      if (i == 1) {
        var rec_amount = parseFloat(req.bodyString("initial_payment_amount"));
        var rec_terms = "Initial Payment";
      } else if (i <= terms.discount_term) {
        var rec_amount = parseFloat(terms.discount_amount);
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else if (i > terms.discount_term && terms_value > i) {
        var rec_amount = parseFloat(installment_amount.value);
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else {
        var rec_amount = parseFloat(
          terms.unlimited == "yes"
            ? installment_amount.value
            : req.bodyString("final_payment_amount")
        );
        var rec_terms = "Final Payment";
      }
      let temp_terms = {
        plan_id: "",
        amount: rec_amount,
        payment_terms: rec_terms,
        added_date: added_date,
      };
      ins_terms.push(temp_terms);
    }
    let start_date = req.bodyString("start_date");
    let expiry_date =
      req.bodyString("expiry_date") != ""
        ? await date_formatter.insert_date_time(req.bodyString("expiry_date"))
        : null;

    start_date = await date_formatter.insert_date_time(start_date);
    let ins_data = {
      submerchant_id: req.credentials.merchant_id,
      plan_name: req.bodyString("plan_name"),
      plan_id: plan_no,
      plan_description: req.bodyString("plan_description"),
      ref_no: uuid.generate(),
      plan_currency: installment_amount.currency,
      plan_billing_amount: installment_amount.value,
      plan_billing_frequency: billing_frequency.frequency,
      payment_interval: billing_frequency.interval,
      final_payment_amount:
        terms.unlimited == "yes"
          ? installment_amount.value
          : req.bodyString("final_payment_amount"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      merchant_id: req.credentials.super_merchant_id,
      terms: terms.unlimited == "yes" ? "1999" : terms.value,
      start_date: start_date,
      expiry_date: expiry_date,
      discounted_terms: terms.discount_term,
      discounted_amount: terms.discount_amount,
      created_at: added_date,
      note: req.bodyString("note"),
      mode: req.credentials.type == "test" ? 0 : 1,
    };

    subs_plan_model
      .add(ins_data)
      .then(async (result) => {
        const subscription_plan_id = helpers.formatNumber(result.insert_id);

        let ins_data_logs = {
          submerchant_id: req.credentials.merchant_id,
          plan_id: result.insert_id,
          merchant_id: req.credentials.super_merchant_id,
          created_by: req.credentials.super_merchant_id,
          activity: "Created",
          plan_name: req.bodyString("plan_name"),
          plan_no: plan_no,
          plan_description: req.bodyString("plan_description"),
          plan_currency: installment_amount.currency,
          plan_billing_amount: installment_amount.value,
          plan_billing_frequency: billing_frequency.frequency,
          payment_interval: billing_frequency.interval,
          final_payment_amount:
            terms.unlimited == "yes"
              ? installment_amount.value
              : req.bodyString("final_payment_amount"),
          initial_payment_amount: req.bodyString("initial_payment_amount"),
          merchant_id: req.credentials.super_merchant_id,
          terms: terms.unlimited == "yes" ? "1999" : terms.value,
          start_date: start_date,
          expiry_date: expiry_date,
          discounted_terms: terms.discount_term,
          discounted_amount: terms.discount_amount,
          created_at: added_date,
          note: req.bodyString("note"),
        };
        let insert_log = await subs_plan_model.add_logs(ins_data_logs);
        for (i = 0; i < ins_terms.length; i++) {
          ins_terms[i].plan_id = result.insertId;
        }
        subs_plan_model
          .add_terms(ins_terms)
          .then(async (result_meta) => {
            let datalink = await QRCode.toDataURL(
              plan_link_url + ins_data.ref_no
            );
            let payment_link = plan_link_url + ins_data.ref_no;
            let plan_id = enc_dec.cjs_encrypt(result.insert_id);
            res
              .status(statusCode.ok)
              .send(
                response.success_planpayLinkmsg(
                  datalink,
                  payment_link,
                  "Subscription plan created successfully.",
                  plan_id,
                  subscription_plan_id
                )
              );
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
  open_plan_details: async (req, res) => {
    let today = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = enc_dec.cjs_decrypt(req.queryString("data_id"));
    subs_plan_model
      .selectOne("*", { id: id })
      .then(async (result) => {
        let data = await subs_plan_model.select_terms(
          {
            plan_id: result.id,
          },
          result.terms
        );

        let payment_data = [];
        var i = 1;
        for (val of data) {
          let temp = {
            sr_no: i,
            // plan_id: enc_dec.cjs_encrypt(val.plan_id),
            payment: val.payment_terms,
            amount: val.amount.toFixed(2),
          };
          i++;
          payment_data.push(temp);
        }
        let send_res = {
          data_id: enc_dec.cjs_encrypt(result.id),
          merchant_name: result.submerchant_id
            ? await helpers.get_merchantdetails_name_by_id(
                result.submerchant_id
              )
            : "",
          super_merchant_name: result.merchant_id
            ? await helpers.get_super_merchant_name(result.merchant_id)
            : "",
          plan_id: result.plan_id,
          plan_name: result.plan_name,
          plan_description: result.plan_description,
          billing_frequency: {
            frequency:
              result.plan_billing_frequency.charAt(0).toUpperCase() +
              result.plan_billing_frequency.slice(1),
            interval: result.payment_interval,
          },
          installment_amount: {
            currency: result.plan_currency,
            value: result.plan_billing_amount.toFixed(2),
          },
          terms: {
            unlimited: result?.terms == "1999" ? "yes" : "no",
            value: result?.terms == "1999" ? "Unlimited" : result?.terms,
            discount_term: result.discounted_terms,
            discount_amount: result.discounted_amount.toFixed(2),
          },

          status:
            moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") >= today ||
            moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") ==
              "Invalid date"
              ? result.status == 0
                ? "Active"
                : "Deactivated"
              : "Expired",
          start_date: moment(result.start_date).format("DD-MM-YYYY HH:mm:ss"),
          expiry_date:
            result.expiry_date != null
              ? moment(result.expiry_date).format("DD-MM-YYYY HH:mm:ss")
              : "",
          initial_payment_amount: result.initial_payment_amount.toFixed(2),
          final_payment_amount: result.final_payment_amount.toFixed(2),
          note: result.note,
          qr_code: await QRCode.toDataURL(plan_link_url + result.ref_no),
          payment_link: plan_link_url + result.ref_no,
          payment_schedule: payment_data,
        };
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
  open_list: async (req, res) => {
    let today = await date_formatter.created_date_time();
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.queryString("perpage") && req.queryString("page")) {
      perpage = parseInt(req.queryString("perpage"));
      start = parseInt(req.queryString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    let condition = {
      deleted: 0,
      merchant_id: req.credentials.super_merchant_id,
      submerchant_id: req.credentials.merchant_id,
    };

    condition.mode = req.credentials.type == "live" ? 1 : 0;

    let date = {};
    if (req.queryString("created_from_date")) {
      date.from_date = req.queryString("created_from_date");
    }
    if (req.queryString("modified_to_date")) {
      date.modified_to_date = req.queryString("modified_to_date");
    }
    if (req.queryString("modified_from_date")) {
      date.modified_from_date = req.queryString("modified_from_date");
    }
    if (req.queryString("subscribe_to_date")) {
      date.subscribe_to_date = req.queryString("subscribe_to_date");
    }
    if (req.queryString("subscribe_from_date")) {
      date.subscribe_from_date = req.queryString("subscribe_from_date");
    }
    if (req.queryString("created_to_date")) {
      date.to_date = req.queryString("created_to_date");
    }
    if (req.queryString("currency")) {
      condition["plan_currency"] = req.queryString("currency");
    }

    if (req.queryString("total_terms")) {
      condition["terms"] = req.queryString("total_terms");
    }
    if (req.queryString("billing_interval")) {
      condition["payment_interval"] = req.queryString("billing_interval");
    }
    if (req.queryString("billing_frequency")) {
      condition["plan_billing_frequency"] =
        req.queryString("billing_frequency");
    }
    if (req.queryString("installment_amount")) {
      condition["plan_billing_amount"] = req.queryString("installment_amount");
    }
    let like_condition = {
      plan_name: "",
    };

    if (req.queryString("plan_id_or_name")) {
      like_condition.plan = req.queryString("plan_id_or_name");
    }
    let expiry_date = "";
    if (req.queryString("status")) {
      if (req.queryString("status") == "Active") {
        condition[`status`] = 0;
        expiry_date = `and (expiry_date >= '${today}' or expiry_date is NULL )`;
      } else if (req.queryString("status") == "Deactivated") {
        condition[`status`] = 1;
        expiry_date = `and (expiry_date >= '${today}' or expiry_date is NULL)`;
      } else if (req.queryString("status") == "Expired") {
        expiry_date = `'${today}' `;
        expiry_date = `and expiry_date <= '${today}' and expiry_date is not NULL`;
      }
    }
    subs_plan_model
      .select(condition, date, limit, like_condition, expiry_date)
      .then(async (val) => {
        let send_res = [];
        for (result of val) {
          let temp = {
            // subs_plan_id: enc_dec.cjs_encrypt(val.id),
            data_id: enc_dec.cjs_encrypt(result.id),
            merchant_name: result.submerchant_id
              ? await helpers.get_merchantdetails_name_by_id(
                  result.submerchant_id
                )
              : "",
            super_merchant_name: result.merchant_id
              ? await helpers.get_super_merchant_name(result.merchant_id)
              : "",
            plan_id: result.plan_id,
            plan_name: result.plan_name,
            plan_description: result.plan_description,
            billing_frequency: {
              frequency:
                result.plan_billing_frequency.charAt(0).toUpperCase() +
                result.plan_billing_frequency.slice(1),
              interval: result.payment_interval,
            },
            installment_amount: {
              currency: result.plan_currency,
              value: result.plan_billing_amount.toFixed(2),
            },
            terms: {
              unlimited: result?.terms == "1999" ? "yes" : "no",
              value: result?.terms == "1999" ? "Unlimited" : result?.terms,
              discount_term: result.discounted_terms,
              discount_amount: result.discounted_amount.toFixed(2),
            },

            status:
              moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") >=
                today ||
              moment(result.expiry_date).format("YYYY-MM-DD HH:mm:ss") ==
                "Invalid date"
                ? result.status == 0
                  ? "Active"
                  : "Deactivated"
                : "Expired",
            start_date: moment(result.start_date).format("DD-MM-YYYY HH:mm:ss"),
            expiry_date:
              result.expiry_date != null
                ? moment(result.expiry_date).format("DD-MM-YYYY HH:mm:ss")
                : "",
            initial_payment_amount: result.initial_payment_amount.toFixed(2),
            final_payment_amount: result.final_payment_amount.toFixed(2),
            create_at: moment(result.created_at).format("DD-MM-YYYY HH:mm:ss"),
            last_modified_date:
              result.updated_at != null
                ? moment(result.updated_at).format("DD-MM-YYYY HH:mm:ss")
                : "",
            note: result.note,
            qr_code: await QRCode.toDataURL(plan_link_url + result.ref_no),
            payment_link: plan_link_url + result.ref_no,
          };
          send_res.push(temp);
        }
        let total_count = await subs_plan_model.get_count(
          condition,
          date,
          like_condition,
          expiry_date
        );
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
  open_plan_update: async (req, res) => {
    let subs_plan_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));

    let req_terms = req.body.payment_terms;
    let billing_frequency = req.body.billing_frequency;
    let installment_amount = req.body.installment_amount;
    let terms = req.body.terms;
    let added_date = await date_formatter.created_date_time();
    let ins_terms = [];
    let terms_value = terms.unlimited == "yes" ? "1999" : terms.value;
    for (var i = 1; i <= terms_value; i++) {
      if (i == 1) {
        var rec_amount = parseFloat(req.bodyString("initial_payment_amount"));
        var rec_terms = "Initial Payment";
      } else if (i <= terms.discount_term) {
        var rec_amount = parseFloat(terms.discount_amount);
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else if (i > terms.discount_term && terms_value > i) {
        var rec_amount = parseFloat(installment_amount.value);
        var rec_terms = (await helpers.getOrdinalWords(i)) + " payment";
      } else {
        var rec_amount = parseFloat(
          terms.unlimited == "yes"
            ? installment_amount.value
            : req.bodyString("final_payment_amount")
        );
        var rec_terms = "Final Payment";
      }
      let temp_terms = {
        plan_id: "",
        amount: rec_amount,
        payment_terms: rec_terms,
        added_date: added_date,
      };
      ins_terms.push(temp_terms);
    }
    let start_date = req.bodyString("start_date");
    let expiry_date =
      req.bodyString("expiry_date") != ""
        ? await date_formatter.insert_date_time(req.bodyString("expiry_date"))
        : null;

    start_date = await date_formatter.insert_date_time(start_date);
    let ins_data = {
      submerchant_id: req.credentials.merchant_id,
      plan_name: req.bodyString("plan_name"),
      plan_description: req.bodyString("plan_description"),
      plan_currency: installment_amount.currency,
      plan_billing_amount: installment_amount.value,
      plan_billing_frequency: billing_frequency.frequency,
      payment_interval: billing_frequency.interval,
      final_payment_amount:
        terms.unlimited == "yes"
          ? installment_amount.value
          : req.bodyString("final_payment_amount"),
      initial_payment_amount: req.bodyString("initial_payment_amount"),
      merchant_id: req.credentials.super_merchant_id,
      terms: terms.unlimited == "yes" ? "1999" : terms.value,
      start_date: start_date,
      expiry_date: expiry_date,
      discounted_terms: terms.discount_term,
      discounted_amount: terms.discount_amount,
      updated_at: added_date,
      note: req.bodyString("note"),
    };

    subs_plan_model
      .updateDetails({ id: subs_plan_id }, ins_data)
      .then(async (result) => {
        let ins_data_logs = {
          submerchant_id: req.credentials.merchant_id,
          plan_id: subs_plan_id,
          merchant_id: req.credentials.super_merchant_id,
          created_by: req.credentials.super_merchant_id,
          activity: "Updated",
          plan_name: req.bodyString("plan_name"),
          plan_no: await helpers.get_subs_plan_id(subs_plan_id),
          plan_description: req.bodyString("plan_description"),
          plan_currency: installment_amount.currency,
          plan_billing_amount: installment_amount.value,
          plan_billing_frequency: billing_frequency.frequency,
          payment_interval: billing_frequency.interval,
          final_payment_amount:
            terms.unlimited == "yes"
              ? installment_amount.value
              : req.bodyString("final_payment_amount"),
          initial_payment_amount: req.bodyString("initial_payment_amount"),
          merchant_id: req.credentials.super_merchant_id,
          terms: terms.unlimited == "yes" ? "1999" : terms.value,
          start_date: start_date,
          expiry_date: expiry_date,
          discounted_terms: terms.discount_term,
          discounted_amount: terms.discount_amount,
          updated_at: added_date,
          created_at: added_date,
          note: req.bodyString("note"),
        };
        let insert_log = await subs_plan_model.add_logs(ins_data_logs);
        await subs_plan_model.remove_terms(subs_plan_id);
        for (i = 0; i < ins_terms.length; i++) {
          ins_terms[i].plan_id = subs_plan_id;
        }

        subs_plan_model
          .add_terms(ins_terms)
          .then(async (result_meta) => {
            res
              .status(statusCode.ok)
              .send(
                response.successmsg("Subscription plan updated successfully.")
              );
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
  open_plan_activate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let update_data = { status: 0, updated_at: added_date };
    subs_plan_model
      .updateDetails({ id: id }, update_data)
      .then(async (result) => {
        let insert_log = await subs_plan.add_logs_data(
          id,
          "Activated",
          req.credentials.super_merchant_id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription plan activated successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  open_plan_deactivate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let update_data = { status: 1, updated_at: added_date };
    subs_plan_model
      .updateDetails({ id: id }, update_data)
      .then(async (result) => {
        let insert_log = await subs_plan.add_logs_data(
          id,
          "Deactivated",
          req.credentials.super_merchant_id
        );
        res
          .status(statusCode.ok)
          .send(
            response.successmsg("Subscription plan deactivated successfully.")
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_subscriber_list: async (req, res) => {
    let limit = {
      perpage: 10,
      start: 0,
      page: 1,
    };
    if (req.queryString("perpage") && req.queryString("page")) {
      perpage = parseInt(req.queryString("perpage"));
      start = parseInt(req.queryString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    let like_condition = {
      email: "",
      plan_name: "",
    };
    let mode = req.credentials.type;
    let date = {};
    let condition = {
      "s.super_merchant": req.credentials.super_merchant_id,
      "s.merchant_id": req.credentials.merchant_id,
      "s.mode": mode,
    };
    if (req.queryString("subscriber_id")) {
      let subscriber_id = parseInt(req.queryString("subscriber_id"), 10);
      let common_subscribers_email =
        await helpers.get_common_subscriber_email_by_id(subscriber_id);
      if (common_subscribers_email) {
        like_condition.email = common_subscribers_email;
      } else {
        condition["s.id"] = parseInt(req.queryString("subscriber_id"), 10);
      }
    }

    let search = "";
    if (req.queryString("subscriber_email_mobile")) {
      search = req.queryString("subscriber_email_mobile");
    }

    if (req.queryString("subscriber_email_mobile")) {
      like_condition.email = req.queryString("subscriber_email_mobile");
    }
    if (req.queryString("plan_name")) {
      like_condition.plan_name = req.queryString("plan_name");
    }

    subs_plan_model
      .select_subscribers_list(condition, date, limit, like_condition)
      .then(async (result) => {
        let send_res = [];
        let subscription_id = [];
        for (val of result) {
          let common_subscribers_id = await helpers.get_common_subscriber_id(
            val.email,
            val.mode
          );
          let first_txn_date = await subs_plan_model.select_open_txn_date(
            {
              customer_email: val.email,
              origin: "Subscription",
              super_merchant: val.super_merchant,
            },
            "asc",
            req.credentials.type
          );
          let last_txn_date = await subs_plan_model.select_open_txn_date(
            {
              customer_email: val.email,
              origin: "Subscription",
              super_merchant: val.super_merchant,
            },
            "desc",
            req.credentials.type
          );
          var country = await subs_plan_model.select_cust_data(
            "billing_country",
            { cid: enc_dec.cjs_encrypt(val.id) }
          );
          var country_code = country.billing_country
            ? country.billing_country
            : "";
          let temp = {
            data_id: enc_dec.cjs_encrypt(val.subscriber_id),
            subscriber_id: common_subscribers_id
              ? await helpers.formatNumber(common_subscribers_id)
              : "",

            name: val.name,
            mobile_no: val.mobile_no,
            country_code: val.dial_code ? val.dial_code : "",
            email: val.email,

            created_date: await date_formatter.get_date_time(val.added_date),
            first_txn_date: first_txn_date,
            last_txn_date: last_txn_date,
            country: country_code
              ? await helpers.get_customer_country(country_code, "country")
              : "",
          };
          send_res.push(temp);
          subscription_id.push(val.subscriber_id);
        }
        let join_condition = "";
        if (Object.keys(subscription_id).length) {
          let unpaid_subs_id = subscription_id.toString().split(",");
          const subs_join =
            "(" + unpaid_subs_id.map((item) => `'${item}'`).join(", ") + ")";
          if (subs_join != "()") {
            join_condition = `and s.id IN ${subs_join} `;
          }
        }
        let total_count = await subs_plan_model.select_subscribers_list_count(
          condition,
          date,
          limit,
          like_condition
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Subscriber list fetched successfully.",
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
  open_subscriber_details: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.queryString("data_id"));
    subs_plan_model
      .selectSubscriberCust({ ["s.id"]: id })
      .then(async (result) => {
        let data = await subs_plan_model.selectSubsPay("*", {
          subscription_id: result.subscription_id,
          payment_status: "CAPTURED",
        });

        let get_card_details = await subs_plan_model.selectCardsDetails({
          "sp.subscription_id": result.subscription_id,
          "sp.payment_status": "CAPTURED",
        });
        let card_id = enc_dec.cjs_decrypt(get_card_details?.card_id);
        let card_expiry = "";

        if (card_id) {
          let used_card = await subs_plan_model.getCard(
            {
              id: card_id,
            },
            "customers_cards"
          );

          if (used_card && used_card.length > 0) {
            card_expiry = used_card[0].card_expiry
              ? used_card[0].card_expiry
              : "";
          }
        }
        let payment_data = [];
        for (value of data) {
          let temp_ = {
            payment_id: enc_dec.cjs_encrypt(value.id),
            payment_status: value.payment_status,
            payment_mode: value.mode_of_payment,
            order_no: value.order_no,
            added_date: moment(value.added_date).format("DD-MM-YYYY H:mm:ss"),

            transaction_date: moment(value.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          payment_data.push(temp_);
        }
        let transaction_data =
          await subs_plan_model.selectOpenCustomerTransaction(
            "*",
            {
              customer_email: result.email,
              origin: "Subscription",
              super_merchant: req.credentials.super_merchant_id,
              merchant_id: req.credentials.merchant_id,
            },
            req.credentials.type
          );
        let transaction = [];
        for (let val of transaction_data) {
          let res = {
            order_id: val.order_id,
            order_amount: val.currency + " " + val.amount.toFixed(2),
            order_currency: val.currency,
            status: val.status,
            transaction_date: await date_formatter.get_date_time(
              val.created_at
            ),
            address:
              val.billing_address_line_1 +
              " ," +
              val.billing_city +
              " ," +
              (await helpers.get_customer_country(
                val.billing_country,
                "country"
              )),
          };
          transaction.push(res);
        }

        let common_subscribers_id = await helpers.get_common_subscriber_id(
          result.email,
          result.mode
        );
        let send_res = {
          data_id: enc_dec.cjs_encrypt(result.subscriber_id),
          subscribers_id: common_subscribers_id
            ? await helpers.formatNumber(common_subscribers_id)
            : "",
          name: result.name ? result.name : "",
          email: result.email ? result.email : "",
          mobile_no: result.mobile_no ? result.mobile_no : "",
          country_code: result.dial_code ? result.dial_code : "",
          created_date: moment(result.added_date).format("DD-MM-YYYY H:mm:ss"),
          payment_list: transaction,
        };
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
  open_contract_list: async (req, res) => {
    let limit = {
      perpage: 10,
      start: 0,
      page: 1,
    };
    if (req.queryString("perpage") && req.queryString("page")) {
      perpage = parseInt(req.queryString("perpage"));
      start = parseInt(req.queryString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let date = {};
    if (req.queryString("subscription_from_date")) {
      date.from_date = req.queryString("subscription_from_date");
    }
    if (req.queryString("subscription_to_date")) {
      date.to_date = req.queryString("subscription_to_date");
    }
    if (req.queryString("payment_to_date")) {
      date.payment_to_date = req.queryString("payment_to_date");
    }
    if (req.queryString("payment_from_date")) {
      date.payment_from_date = req.queryString("payment_from_date");
    }
    // let condition = { super_merchant: 60 };
    let condition = {
      "s.super_merchant": req.credentials.super_merchant_id,
      "s.merchant_id": req.credentials.merchant_id,
      "s.mode": req.credentials.type,
      "sp.payment_status": "CAPTURED",
    };
    let condition_for_count = {
      super_merchant: req.credentials.super_merchant_id,
      merchant_id: req.credentials.merchant_id,
      mode: req.credentials.type,
      is_customer_subscribed: "1",
    };
    if (req.queryString("subscriber_id")) {
      let subscriber_id = parseInt(req.queryString("subscriber_id"), 10);
      let common_subscribers_email =
        await helpers.get_common_subscriber_email_by_id(subscriber_id);
      condition["s.email"] = common_subscribers_email;
      condition_for_count["email"] = common_subscribers_email;
    }

    if (req.queryString("currency")) {
      condition["s.plan_currency"] = req.queryString("currency");
      condition_for_count["plan_currency"] = req.queryString("currency");
    }
    if (req.queryString("installment_amount")) {
      condition["s.plan_billing_amount"] =
        req.queryString("installment_amount");
      condition_for_count["plan_billing_amount"] =
        req.queryString("installment_amount");
    }

    if (req.queryString("status")) {
      if (req.queryString("status") === "Active") {
        condition["s.status"] = 1;
        condition_for_count["status"] = 1;
      } else if (req.queryString("status") === "Deactivated") {
        condition["s.status"] = 0;
        condition_for_count["status"] = 0;
      }
    }
    if (req.queryString("last_payment_status")) {
      condition["s.last_payment_status"] =
        req.queryString("last_payment_status") == "PAID"
          ? "CAPTURED"
          : req.queryString("last_payment_status");
      condition_for_count["last_payment_status"] =
        req.queryString("last_payment_status") == "PAID"
          ? "CAPTURED"
          : req.queryString("last_payment_status");
    }
    if (req.queryString("plan_id")) {
      condition["s.plan_id"] = enc_dec.cjs_decrypt(req.queryString("plan_id"));
      condition_for_count["plan_id"] = enc_dec.cjs_decrypt(
        req.queryString("plan_id")
      );
    }
    if (req.queryString("contract_id")) {
      condition["s.subscription_id"] = req.queryString("contract_id");
      condition_for_count["subscription_id"] = req.queryString("contract_id");
    }
    if (req.queryString("total_terms")) {
      condition["s.terms"] = req.queryString("total_terms");
      condition_for_count["terms"] = req.queryString("total_terms");
    }
    if (req.queryString("billing_interval")) {
      condition["s.payment_interval"] = req.queryString("billing_interval");
      condition_for_count["payment_interval"] =
        req.queryString("billing_interval");
    }
    if (req.queryString("billing_frequency")) {
      condition["s.plan_billing_frequency"] =
        req.queryString("billing_frequency");
      condition_for_count["plan_billing_frequency"] =
        req.queryString("billing_frequency");
    }
    let search = "";
    if (req.queryString("search_string")) {
      search = req.queryString("search_string");
    }

    let like_condition = {
      email: "",
      plan_name: "",
    };
    if (req.queryString("subscriber_email_or_mobile")) {
      like_condition.email = req.queryString("subscriber_email_or_mobile");
    }
    if (req.queryString("plan_name")) {
      like_condition.plan_name = req.queryString("plan_name");
    }

    subs_plan_model
      .select_pay(condition, date, limit, like_condition)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let subs_id = val.subscription_id;
          // Recurring data
          let start_date = await helpers.get_recurring_start_next_date(
            { subscription_id: `'${subs_id}'`, is_paid: 1 },
            "asc"
          );
          let next_date = await helpers.get_recurring_start_next_date(
            { subscription_id: `'${subs_id}'`, is_paid: 0, is_failed: 0 },
            "asc"
          );
          //let last_payment_status = await helpers.get_recurring_last_status({subscription_id:`'${subs_id}'`});
          let get_total_count_paid =
            await helpers.get_recurring_count_by_subscription_id({
              subscription_id: `'${subs_id}'`,
              is_paid: 1,
            });
          // let collected_amt = await helpers.get_recurring_sum_amount({subscription_id:`'${subs_id}'`});
          // end recurring data
          let common_subscribers_id = await helpers.get_common_subscriber_id(
            val.email,
            val.mode
          );

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select("order_no")
              .where({ subscription_id: val.subscription_id })
              .get(config.table_prefix + "subs_payment");
            // .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");

          // let extra_info = await subs_plan_model.get_needed_info(
          //     subs_id
          // );
          let get_card_details = await subs_plan_model.selectCardsDetails(
            {
              "sp.subscription_id": subs_id,
              "sp.payment_status": "CAPTURED",
            },
            req.credentials.type
          );

          let due_amount_result = await subs_plan_model.getDueAmount(subs_id);
          let due_amount = "-";
          due_amount = due_amount_result
            ? due_amount_result[0]?.amount + due_amount_result[0]?.failed_amount
            : due_amount;

          let temp = {
            contract_details: {
              subscription_id: enc_dec.cjs_encrypt(val.id),
              contract_id: val.subscription_id,

              de_submerchant_id: val?.merchant_id
                ? await helpers.formatNumber(val?.merchant_id)
                : "",

              submerchant_name: val?.merchant_id
                ? await helpers.get_submerchant_name_by_id(val?.merchant_id)
                : "",
              status: val.status == 0 ? "Deactivated" : "Active",
              subscription_date: moment(val.added_date).format(
                "DD-MM-YYYY H:mm:ss"
              ),
              order_no: order_ids,

              last_payment_status:
                val?.last_payment_status == "FAILED" &&
                val?.last_payment_status != null
                  ? "FAILED"
                  : "PAID",
              terms_collected: get_total_count_paid
                ? get_total_count_paid
                : "0",
              subscription_start_date: start_date
                ? moment(start_date.next_due_date).format("DD-MM-YYYY")
                : "",
              next_payment_date: next_date
                ? moment(next_date.next_due_date).format("DD-MM-YYYY")
                : "",
              last_payment_date: val?.last_payment_date
                ? moment(val?.last_payment_date).format("DD-MM-YYYY HH:mm:ss")
                : "",
              card_no: get_card_details.card_no
                ? "xxxx xxxx xxxx " + get_card_details.card_no
                : "",
              card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
              due_amount: due_amount.toFixed(2),
            },
            plan_details: {
              plan_id: await helpers.get_subs_plan_id(val.plan_id),
              plan_name: val.plan_name,
              billing_frequency: val.plan_billing_frequency,
              total_terms: val.terms == "1999" ? "Unlimited" : val.terms,
              billing_interval: val.payment_interval ? val.payment_interval : 0,
              currency: val.plan_currency,
              installment_amount: val.plan_billing_amount
                ? val.plan_billing_amount.toFixed(2)
                : "0.00",
              start_date: moment(val.start_date).format("DD-MM-YYYY H:mm:ss"),
            },
            subscriber_details: {
              subscribers_id: common_subscribers_id
                ? await helpers.formatNumber(common_subscribers_id)
                : "",
              name: val.name,
              mobile_no: val.mobile_no,
              email: val.email,
            },
          };
          send_res.push(temp);
        }

        let total_count = await subs_plan_model.get_count_all_conditions(
          condition_for_count,
          like_condition,
          date
        );
        // let total_count = await subs_plan_model.get_count_pay(
        //     condition_for_count
        // );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Subscriber list fetched successfully.",
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
  open_contract_details: async (req, res) => {
    const id = enc_dec.cjs_decrypt(req.queryString("subscription_id"));
    subs_plan_model
      .selectSubscriber("*", { id: id })
      .then(async (result) => {
        let de_qr_id = helpers.formatNumber(id);

        let data = await subs_plan_model.selectSubsPay("*", {
          subscription_id: result.subscription_id,
          payment_status: "CAPTURED",
        });
        let get_card_details = await subs_plan_model.selectCardsDetails({
          "sp.subscription_id": result.subscription_id,
          "sp.payment_status": "CAPTURED",
        });
        let card_id = enc_dec.cjs_decrypt(get_card_details?.card_id);
        let card_expiry = "";

        if (card_id) {
          let used_card = await subs_plan_model.getCard(
            {
              id: card_id,
            },
            "customers_cards"
          );

          if (used_card && used_card.length > 0) {
            card_expiry = used_card[0].card_expiry
              ? used_card[0].card_expiry
              : "";
          }
        }

        let get_merchant = await subs_plan_model.selectOneDynamic(
          "submerchant_id,discounted_terms,discounted_amount,expiry_date",
          {
            id: result.plan_id,
            status: 0,
          },
          "subs_plans"
        );
        let payment_data = [];
        for (val of data) {
          let temp = {
            payment_id: enc_dec.cjs_encrypt(val.id),
            payment_status: val.payment_status,
            payment_mode: val.mode_of_payment,
            order_no: val.order_no,
            added_date: moment(val.added_date).format("DD-MM-YYYY H:mm:ss"),

            transaction_date: moment(val.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          payment_data.push(temp);
        }
        let recurr_data = await helpers.get_recurring_by_subscription_id(
          result.subscription_id,
          12
        );
        let count_recurring =
          await helpers.get_recurring_count_by_subscription_id({
            subscription_id: result.subscription_id,
          });
        let rec_data = [];
        for (recurring of recurr_data) {
          let resp_recurring = {
            next_due_date: recurring.next_due_date
              ? moment(recurring.next_due_date).format("DD-MM-YYYY")
              : "",
            amount: recurring.amount ? recurring.amount : "",
            is_paid: recurring.is_paid,
            is_failed: recurring.is_failed,
            order_id: recurring.order_id ? recurring.order_id : "",
            payment_id: recurring?.payment_id,
          };
          rec_data.push(resp_recurring);
        }
        let common_subscribers_id = await helpers.get_common_subscriber_id(
          result.email,
          result.mode
        );
        let send_res = {
          contract_details: {
            subscription_id: result.subscription_id
              ? result.subscription_id
              : "",
            merchant_name: get_merchant.submerchant_id
              ? await helpers.get_merchantdetails_name_by_id(
                  get_merchant.submerchant_id
                )
              : "",
            super_merchant_name: result.super_merchant
              ? await helpers.get_super_merchant_name(result.super_merchant)
              : "",
            status: result.status == 0 ? "Active" : "Deactivated",
            subscription_date: moment(result.added_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          },
          plan_details: {
            plan_name: result.plan_name ? result.plan_name : "",
            plan_id: await helpers.get_subs_plan_id(result.plan_id),
            plan_description: result.plan_description
              ? result.plan_description
              : "",
            billing_frequency: result.plan_billing_frequency
              ? result.plan_billing_frequency
              : "",
            currency: result.plan_currency ? result.plan_currency : "",
            initial_payment_amount: result.initial_payment_amount
              ? result.initial_payment_amount.toFixed(2)
              : 0.0,
            billing_interval: result.payment_interval
              ? result.payment_interval
              : 0,
            total_terms: result.terms == "1999" ? "Unlimited" : result.terms,
            final_payment_amount: result.final_payment_amount
              ? result.final_payment_amount.toFixed(2)
              : 0.0,
            installment_amount:
              result.plan_currency +
              " " +
              result.plan_billing_amount.toFixed(2),
            discounted_terms: get_merchant.discounted_terms
              ? get_merchant.discounted_terms
              : "-",
            discounted_amount:
              get_merchant.discounted_amount != "0"
                ? result.plan_currency +
                  " " +
                  get_merchant.discounted_amount.toFixed(2)
                : "-",
            start_date: moment(result.start_date).format("DD-MM-YYYY H:mm:ss"),
            expiry_date:
              get_merchant.expiry_date != null
                ? moment(get_merchant.expiry_date).format("DD-MM-YYYY HH:mm:ss")
                : "",
          },
          subscriber_details: {
            subscribers_id: common_subscribers_id
              ? await helpers.formatNumber(common_subscribers_id)
              : "",
            email: result.email ? result.email : "",
            name: result.name ? result.name : "",
            mobile_no: result.mobile_no ? result.mobile_no : "",
          },
          card_details: {
            customer_name: get_card_details?.customer_name
              ? get_card_details?.customer_name
              : "",
            customer_email: get_card_details?.email
              ? get_card_details?.email
              : "",
            card_expiry: card_expiry,
            card_no: get_card_details.card_no
              ? "xxxx xxxx xxxx " + get_card_details.card_no
              : "",
            card_nw: get_card_details.card_nw ? get_card_details.card_nw : "",
            payment_method: get_card_details.payment_mode
              ? get_card_details.payment_mode
              : "",
          },
          payment_data: payment_data,
          payment_schedule: rec_data,
        };
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
  open_mail_send: async (req, res) => {
    console.log(req.body);
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = await enc_dec.cjs_decrypt(req.bodyString("data_id"));
    subs_plan_model
      .selectOne("*", { id: id })
      .then(async (subs_data) => {
        if (
          req.bodyString("client_email") != "" &&
          req.bodyString("email") != ""
        ) {
          var dec_msg =
            req.bodyString("client_email") + "," + req.bodyString("email");
        } else if (req.bodyString("email") != "") {
          var dec_msg = req.bodyString("email");
        } else {
          var dec_msg = req.bodyString("client_email");
        }

        // console.log(req.bodyString("client_email"))
        let split_msg = dec_msg.split(",");
        for (var i = 0; i < split_msg.length; i++) {
          const uuid = new SequenceUUID({
            valid: true,
            dashes: false,
            unsafeBuffer: true,
          });
          let subs_token = uuid.generate();

          let url = subs_data.submerchant_id
            ? await helpers.get_merchantdetails_url_by_id(
                subs_data.submerchant_id
              )
            : "";
          let data = {
            merchant_name: subs_data.merchant_id
              ? await helpers.get_merchantdetails_name_by_id(
                  await helpers.get_merchant_id(subs_data.merchant_id)
                )
              : "",
            tc_url: url.link_tc ? url.link_tc : "",
            pp_url: url.link_pp ? url.link_pp : "",
            message: subs_data.plan_description,
            message_text:
              subs_data.plan_description != ""
                ? '<p style="margin: 24px 0;"><b style="color: #263238 !important;">Plan Description</b><br>' +
                  subs_data.plan_description +
                  "</p>"
                : "",
            mail_to: split_msg[i],
            plan_name: subs_data.plan_name,
            pay_url: plan_link_url + subs_data.ref_no,
            plan_billing_frequency:
              subs_data.payment_interval +
              " " +
              subs_data.plan_billing_frequency.charAt(0).toUpperCase() +
              subs_data.plan_billing_frequency.slice(1),
            currency: subs_data.plan_currency,
            amount: subs_data.plan_billing_amount.toFixed(2),
            note: subs_data.note,
            note_text:
              subs_data.note != ""
                ? '<p style="margin: 24px 0;"><b style="color: #263238 !important;">Note</b><br>' +
                  subs_data.note +
                  "</p>"
                : "",
            start_date: moment(subs_data.start_date).format(
              "DD-MM-YYYY HH:mm:ss"
            ),
            initial_payment_amount: subs_data.initial_payment_amount.toFixed(2),
            payment_interval: subs_data.payment_interval,
            terms: subs_data.terms == "1999" ? "Unlimited" : subs_data.terms,
            final_payment_amount: subs_data.final_payment_amount.toFixed(2),
            subject: req.bodyString("subject"),
            expiry_date:
              subs_data.expiry_date == null ||
              moment(subs_data.expiry_date).format("DD-MM-YYYY HH:mm:ss") ==
                "01-01-1970 00:00:00"
                ? "No expiry"
                : moment(subs_data.expiry_date).format("DD-MM-YYYY HH:mm:ss"),
            discounted_terms: subs_data.discounted_terms
              ? subs_data.discounted_terms
              : "-",
            discounted_amount:
              subs_data.discounted_amount != "0"
                ? subs_data.plan_currency +
                  " " +
                  subs_data.discounted_amount.toFixed(2)
                : "-",
            merchant_logo: subs_data.merchant_id
              ? server_addr +
                "/static/files/" +
                (await subs_plan_model.getMerchantlogo({
                  id: subs_data.submerchant_id,
                }))
              : "",
            // invoice: inv_response
          };

          let mail_response = await mailSender.subs_plan_mail(data);

          ins_data = {
            merchant_id: subs_data.merchant_id,
            emails: split_msg[i],
            plan_id: id,
            currency: subs_data.plan_currency,
            amount: subs_data.plan_billing_amount.toFixed(2),
            sending_date: register_at,
            token: subs_token,
          };
          subs_plan_model
            .addMail(ins_data)
            .then(async (result) => {
              res
                .status(statusCode.ok)
                .send(response.successmsg("Mail sent successfully"));
            })
            .catch((error) => {
             logger.error(500,{message: error,stack: error.stack}); 
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_cancel_subscription: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("subscription_id"));
    let update_data = { status: 0 };
    subs_plan_model
      .updateDynamic({ id: id }, update_data, "subscription")
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Subscription cancelled successfully."));
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};

module.exports = subs_plan;
