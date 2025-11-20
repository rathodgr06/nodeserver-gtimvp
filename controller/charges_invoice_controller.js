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
const charges_invoice_models = require("../models/charges_invoice_models");
const submerchantmodel = require("../models/submerchantmodel");
const logger = require('../config/logger');
const currency = require("./currency");
const { sub_merchant_list } = require("../models/merchantmodel");

const charges_invoice_controller = {
  generate: async (req, res) => {
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let and_filter_obj = { status: "Completed" };
    let date_condition = {
      from_date: "",
      to_date: "",
    };
    let total_count = 0;
    let total_amount = 0.0;
    let total_tax = 0.0;

    let merchant_id = enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    and_filter_obj.merchant_id = merchant_id;

    let month_year = req.bodyString("month_year"); // format will be Name Year ( Jan-2023 )
    const date = moment(month_year, "MMM-YYYY");
    const firstDayOfMonth = date.startOf("month").format("YYYY-MM-DD");
    date_condition.from_date = firstDayOfMonth;
    const lastDayOfMonth = date.endOf("month").format("YYYY-MM-DD");
    date_condition.to_date = lastDayOfMonth;

    let dataFound;
    let qb = await pool.get_connection();
    try {
      dataFound = await qb
        .select("*")
        .where({ merchant_id: merchant_id, month: month_year })
        .get(config.table_prefix + "charges_invoice");
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
    } finally {
      qb.release();
    }

    if (dataFound.length === 0) {
      await charges_invoice_models
        .select(and_filter_obj, date_condition)
        .then((res) => {
          total_count = res.length;
          for (item of res) {
            total_amount = total_amount + item.sale_charge;
            total_tax = total_tax + item.sale_tax;
          }
        })
        .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        });

      let inv_data = {
        merchant_id: merchant_id,
        month: month_year,
        from_date: firstDayOfMonth,
        to_date: lastDayOfMonth,
        no_of_completed_orders: total_count,
        sale_charges: total_amount,
        sale_tax: total_tax,
        status: "Pending",
        created_at: created_at,
      };

      charges_invoice_models
        .addInvoice(inv_data)
        .then((result) => {
          inv_data.data_id = result.insertId;
          let send_res = [];
          let temp = {
            data_id: enc_dec.cjs_encrypt(result.insertId),
            merchant_id: enc_dec.cjs_encrypt(inv_data.merchant_id),
            month: inv_data.month,
            from_date: inv_data.from_date,
            to_date: inv_data.to_date,
            no_of_completed_orders: inv_data.no_of_completed_orders,
            sale_charges: inv_data.sale_charges,
            sale_tax: inv_data.sale_tax,
            status: inv_data.status,
            created_at: inv_data.created_at,
          };
          send_res.push(temp);

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "Charges invoice generated successfully."
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
      let send_res = [];
      for (val of dataFound) {
        let temp = {
          data_id: enc_dec.cjs_encrypt(val.id),
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          month: val.month,
          from_date: moment(val.from_date).format("yyyy-MM-DD"),
          to_date: moment(val.to_date).format("yyyy-MM-DD"),
          no_of_completed_orders: val.no_of_completed_orders,
          sale_tax: val.sale_tax,
          sale_charges: val.sale_charges,
          status: val.status,
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
        };
        send_res.push(temp);
      }
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            send_res,
            "Charges invoice generated successfully."
          )
        );
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

    if (req.bodyString("merchant_id")) {
      condition.merchant_id = enc_dec.cjs_decrypt(
        req.bodyString("merchant_id")
      );
    }

    if (req.bodyString("month_year")) {
      condition.month = '"' + req.bodyString("month_year") + '"';
    }

    if (req.bodyString("status")) {
      condition.status = '"' + req.bodyString("status") + '"';
    }

    charges_invoice_models
      .select_list(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            data_id: enc_dec.cjs_encrypt(val.id),
            merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
            merchant_name: await helpers.get_merchant_name_by_id_from_details(
              val.merchant_id
            ),
            month: val.month,
            from_date: moment(val.from_date).format("yyyy-MM-DD"),
            to_date: moment(val.to_date).format("yyyy-MM-DD"),
            no_of_completed_orders: val.no_of_completed_orders,
            sale_charges: val.sale_charges,
            sale_tax: val.sale_tax,
            status: val.status,
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
          };
          send_res.push(temp);
        }
        let total_row = await charges_invoice_models.get_count(condition, "");
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  new_invoice_list: async (req, res) => {
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

    let merchant_name = null;

    if (req.bodyString("submerchant_id")) {
      condition.submerchant_id = req.bodyString("submerchant_id");
    }

    // if (req.bodyString("merchant_id")) {
    //     condition.merchant_id = enc_dec.cjs_decrypt(
    //         req.bodyString("merchant_id")
    //     );
    // }

    // if (req.bodyString("month_year")) {
    //     condition.month = '"' + req.bodyString("month_year") + '"';
    // }

    // if (req.bodyString("status")) {
    //     condition.status = '"' + req.bodyString("status") + '"';
    // }

    charges_invoice_models
      .new_select_list(condition, limit, merchant_name)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let temp = {
            data_id: enc_dec.cjs_encrypt(val.id),
            merchant_id: enc_dec.cjs_encrypt(val.submerchant_id),
            sub_merchant_id: await helpers.formatNumber(val?.submerchant_id),
            merchant_name:
              await helpers.get_merchant_name_by_merchant_id_from_details(
                val.submerchant_id
              ),
            feature_total_charges: val.feature_total_charges
              ? val.feature_total_charges.toFixed(3)
              : "0.000",
            transaction_total_charges: val.transaction_total_charges
              ? val.transaction_total_charges.toFixed(3)
              : "0.000",
            setup_total_total_charges: val.setup_total_total_charges
              ? val.setup_total_total_charges.toFixed(3)
              : "0.000",
            mid_total_charges: val.mid_total_charges
              ? val.mid_total_charges.toFixed(3)
              : "0.000",
            total_charges: val.total_charges
              ? val.total_charges.toFixed(3)
              : "0.000",
            // month: val.month,
            // from_date: moment(val.from_date).format("yyyy-MM-DD"),
            // to_date: moment(val.to_date).format("yyyy-MM-DD"),
            // no_of_completed_orders: val.no_of_completed_orders,
            // sale_charges: val.sale_charges,
            // sale_tax: val.sale_tax,
            status: val.status === 0 ? "Pending" : "Paid",
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
            updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
          };
          send_res.push(temp);
        }
        let total_row = await charges_invoice_models.new_get_count(
          condition,
          ""
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  view: async (req, res) => {
    charges_invoice_models
      .select_one({ id: enc_dec.cjs_decrypt(req.bodyString("id")) })
      .then(async (val) => {
        let send_res = {
          data_id: enc_dec.cjs_encrypt(val.id),
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          merchant_name: await helpers.get_merchant_name_by_id_from_details(
            val.merchant_id
          ),
          month: val.month,
          from_date: moment(val.from_date).format("yyyy-MM-DD"),
          to_date: moment(val.to_date).format("yyyy-MM-DD"),
          no_of_completed_orders: val.no_of_completed_orders,
          sale_charges: val.sale_charges,
          sale_tax: val.sale_tax,
          status: val.status,
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
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
  new_view: async (req, res) => {
    charges_invoice_models
      .new_select_one(
        { id: enc_dec.cjs_decrypt(req.bodyString("id")) },
        "submercahnt_invoice_charges"
      )
      .then(async (val) => {
        let send_res = {
          data_id: enc_dec.cjs_encrypt(val.id),
          merchant_id: enc_dec.cjs_encrypt(val.submerchant_id),
          merchant_name:
            await helpers.get_merchant_name_by_merchant_id_from_details(
              val.submerchant_id
            ),
          feature_total_charges: val.feature_total_charges,
          transaction_total_charges: val.transaction_total_charges,
          setup_total_total_charges: val.setup_total_total_charges,
          mid_total_charges: val.mid_total_charges,
          total_charges: val.total_charges,
          status: val.status === 0 ? "Pending" : "Paid",
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
          updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
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
  invoice_list_supermerchant: async (req, res) => {
    charges_invoice_models
      .selectSubMerchantBySuperMerchant({
        super_merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
      })
      .then((result) => {
        let sub_merchant = result.map((a) => a.id);
        let condition = { merchant_id: sub_merchant };
        if (req.user.type == "merchant") {
          if (req.bodyString("selected_merchant") != 0) {
            condition.merchant_id = enc_dec.cjs_decrypt(
              req.bodyString("selected_merchant")
            );
          }
        }
        let limit = {
          perpage: 10,
          start: 0,
          page: 1,
        };
        charges_invoice_models
          .select_list(condition, limit)
          .then(async (result) => {
            let send_res = [];
            for (val of result) {
              let temp = {
                data_id: enc_dec.cjs_encrypt(val.id),
                merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
                merchant_name:
                  await helpers.get_merchant_name_by_id_from_details(
                    val.merchant_id
                  ),
                month: val.month,
                from_date: moment(val.from_date).format("yyyy-MM-DD"),
                to_date: moment(val.to_date).format("yyyy-MM-DD"),
                no_of_completed_orders: val.no_of_completed_orders,
                sale_charges: val.sale_charges,
                sale_tax: val.sale_tax,
                status: val.status,
                created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
              };
              send_res.push(temp);
            }
            let total_row = await charges_invoice_models.get_count_by_sub_mer(
              condition,
              ""
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
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
    // let limit = {
    //     perpage: 10,
    //     start: 0,
    //     page: 1,
    // };

    // if (req.bodyString("perpage") && req.bodyString("page")) {
    //     perpage = parseInt(req.bodyString("perpage"));
    //     start = parseInt(req.bodyString("page"));

    //     limit.perpage = perpage;
    //     limit.start = (start - 1) * perpage;
    // }

    // if (req.bodyString("merchant_id")) {
    //     condition.merchant_id = enc_dec.cjs_decrypt(
    //         req.bodyString("merchant_id")
    //     );
    // }

    // if (req.bodyString("month_year")) {
    //     condition.month = req.bodyString("month_year");
    // }

    // if (req.bodyString("status")) {
    //     condition.status = req.bodyString("status");
    // }

    // charges_invoice_models
    //     .select_list(condition, limit)
    //     .then(async (result) => {
    //         let send_res = [];
    //         for (val of result) {
    //             let temp = {
    //                 data_id: enc_dec.cjs_encrypt(val.id),
    //                 merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
    //                 merchant_name:await helpers.get_merchant_name_by_id_from_details(val.merchant_id),
    //                 month: val.month,
    //                 from_date: moment(val.from_date).format("yyyy-MM-DD"),
    //                 to_date: moment(val.to_date).format("yyyy-MM-DD"),
    //                 no_of_completed_orders: val.no_of_completed_orders,
    //                 sale_charges: val.sale_charges,
    //                 sale_tax: val.sale_tax,
    //                 status: val.status,
    //                 created_at: moment(val.created_at).format(
    //                     "yyyy-MM-DD hh:mm"
    //                 ),
    //             };
    //             send_res.push(temp);
    //         }
    //         let total_row = await charges_invoice_models.get_count(condition, '');
    //         res.status(statusCode.ok).send(
    //             response.successdatamsg(
    //                 send_res,
    //                 "List fetched successfully.",total_row
    //             )
    //         );
    //     })
    //     .catch((error) => {

    //         res.status(statusCode.internalError).send(
    //             response.errormsg(error.message)
    //         );
    //     });
  },

  update: async (req, res) => {
    try {
      let charges_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("charges_invoice_id")
      );

      var insdata = {
        status: "Paid",
      };

      await charges_invoice_models
        .updateDetails(
          {
            id: charges_invoice_id,
          },
          insdata
        )
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg(
                "Charges invoice status changed successfully."
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
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  new_update: async (req, res) => {
    try {
      let charges_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("charges_invoice_id")
      );

      var insdata = {
        status: 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await charges_invoice_models
        .newUpdateDetails(
          {
            id: charges_invoice_id,
          },
          insdata,
          "submercahnt_invoice_charges"
        )
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg(
                "Charges invoice status changed successfully."
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
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  transactions_list: async (req, res) => {
    console.log("🚀 ~ req:", req.body)
    try {
      // Input validation and sanitization
      const perpage = Math.min(parseInt(req.bodyString("perpage")) || 25, 100); // Max 100 per page
      const page = Math.max(parseInt(req.bodyString("page")) || 1, 1);
      const offset = (page - 1) * perpage;

      // Build filter conditions
      const filters = {
        super_merchant_id: req.user.type === "merchant" ? req.user.id : null,
        sub_merchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")) || null,
        from_date: req.bodyString("from_date") || null,
        to_date: req.bodyString("to_date") || null,
        status: req.bodyString("status") || null,
        payment_method: req.bodyString("payment_method") || null,
      };
      console.log("🚀 ~ filters:", filters)

      // Remove null values
      Object.keys(filters).forEach(
        (key) => filters[key] === null && delete filters[key]
      );

      // Debug log the filters
      console.log("Controller filters:", filters);
      console.log(
        "Date filters - from_date:",
        filters.from_date,
        "to_date:",
        filters.to_date
      );

      // Get transactions with count in single query when possible
      const [transactions, totalCount] = await Promise.all([
        charges_invoice_models.select_transactions_list_optimized(filters, {
          limit: perpage,
          offset,
        }),
        charges_invoice_models.get_transactions_count_optimized(filters),
      ]);

      // Transform data efficiently
      const transformedData = transactions.map((val) => ({
        order_id: val.order_id || "",
        status: val.order_status || "",
        transaction_id: val.transaction_id || "",
        txn_reference_no: val.txn_reference || "NA",
        wallet_id: val.wallet_id,
        receiver_id: val.receiver_id,
        sub_merchant_id: val.sub_merchant_id,
        super_merchant: val.super_merchant,
        submerchant_name: val.sub_merchant,
        txn: val.order_status || "",
        currency: val.currency || "",
        amount: parseFloat(val.amount || 0).toFixed(2),
        txn_status: val.order_status || "",
        fee:
          parseFloat(val.sale_rate_fix_charge || 0) +
          parseFloat(val.sale_rate_percent_charge || 0),
        tax: val.sale_rate_tax || 0,
        calculated_fee: parseFloat(val.calculated_fee || 0).toFixed(2),
        applied_fee: parseFloat(val.applied_fee || 0).toFixed(2),
        applied_tax: parseFloat(val.applied_tax || 0).toFixed(2),
        net_amount: parseFloat(
          (val.amount || 0) -
            (parseFloat(val.sale_rate_fix_charge || 0) +
              parseFloat(val.sale_rate_percent_charge || 0) +
              parseFloat(val.sale_rate_tax || 0))
        ).toFixed(2),
        txn_date: val.created_at
          ? moment(val.created_at).format("DD-MM-YYYY HH:mm:ss")
          : "",
        payment_method: val.payment_method,
        txn_type: val.txn_type,
      }));

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            transformedData,
            "List fetched successfully.",
            totalCount
          )
        );
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Failed to fetch transactions"));
    }
  },
  export_transactions_list: async (req, res) => {
    console.log("🚀 ~ req:", req.body)
    try {
      // Input validation and sanitization
      const perpage = Math.min(parseInt(req.bodyString("perpage")) || 25, 100); // Max 100 per page
      const page = Math.max(parseInt(req.bodyString("page")) || 1, 1);
      const offset = (page - 1) * perpage;

      // Build filter conditions
      const filters = {
        super_merchant_id: req.user.type === "merchant" ? req.user.id : null,
        sub_merchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")) || null,
        from_date: req.bodyString("from_date") || null,
        to_date: req.bodyString("to_date") || null,
        status: req.bodyString("status") || null,
        payment_method: req.bodyString("payment_method") || null,
      };
      console.log("🚀 ~ filters:", filters)

      // Remove null values
      Object.keys(filters).forEach(
        (key) => filters[key] === null && delete filters[key]
      );

      // Debug log the filters
      console.log("Controller filters:", filters);
      console.log(
        "Date filters - from_date:",
        filters.from_date,
        "to_date:",
        filters.to_date
      );

      // Get transactions with count in single query when possible
      const transactions = await charges_invoice_models.select_transactions_list_optimized_export(filters, {
          limit: perpage,
          offset,
        });

      // Transform data efficiently
      const transformedData = transactions.map((val) => ({
        order_id: val.order_id || "",
        status: val.order_status || "",
        transaction_id: val.transaction_id || "",
        txn_reference_no: val.txn_reference || "NA",
        wallet_id: val.wallet_id,
        receiver_id: val.receiver_id,
        sub_merchant_id: val.sub_merchant_id,
        super_merchant: val.super_merchant,
        submerchant_name: val.sub_merchant,
        txn: val.order_status || "",
        currency: val.currency || "",
        amount: parseFloat(val.amount || 0).toFixed(2),
        txn_status: val.order_status || "",
        fee:
          parseFloat(val.sale_rate_fix_charge || 0) +
          parseFloat(val.sale_rate_percent_charge || 0),
        tax: val.sale_rate_tax || 0,
        calculated_fee: parseFloat(val.calculated_fee || 0).toFixed(2),
        applied_fee: parseFloat(val.applied_fee || 0).toFixed(2),
        applied_tax: parseFloat(val.applied_tax || 0).toFixed(2),
        net_amount: parseFloat(
          (val.amount || 0) -
            (parseFloat(val.sale_rate_fix_charge || 0) +
              parseFloat(val.sale_rate_percent_charge || 0) +
              parseFloat(val.sale_rate_tax || 0))
        ).toFixed(2),
        txn_date: val.created_at
          ? moment(val.created_at).format("DD-MM-YYYY HH:mm:ss")
          : "",
        payment_method: val.payment_method,
        txn_type: val.txn_type,
      }));

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            transformedData,
            "List fetched successfully.",
            ''
          )
        );
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Failed to fetch transactions"));
    }
  },
  feature_list: async (req, res) => {
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
    let condition = {};
    let date_condition = {};

    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    if (req.bodyString("submerchant_id")) {
      condition.submerchant_id = parseInt(req.bodyString("submerchant_id"), 10);
    }
    charges_invoice_models
      .select_feature_list(condition, date_condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let super_merchant_id = await helpers.get_super_merchant_id(
            val.submerchant_id
          );
          let txn_id = val.order_id
            ? await helpers.getPaymentRefID(val.order_id)
            : "";
          let temp = {
            dec_submerchant_id: val?.submerchant_id
              ? await helpers.formatNumber(val?.submerchant_id)
              : "",
            super_merchant: super_merchant_id
              ? await helpers.get_super_merchant_name(super_merchant_id)
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_sub_merchant_name_by_id(val?.submerchant_id)
              : "",
            feature_name: val?.feature_id
              ? await helpers.get_feature_name_by_id(val?.feature_id)
              : "-",
            order_id: val.order_id ? val.order_id : "",
            status: val.order_status ? val.order_status : "-",
            currency: val.currency ? val.currency : "",
            amount: val.order_amount ? val.order_amount.toFixed(2) : "0.00",
            transaction_id: val.transaction_id ? val.mobile_no : "",
            sell_fix_charge: val.sale_rate_fix
              ? val.sale_rate_fix.toFixed(2)
              : "0.00",
            sell_percent_charge: val.sell_rate_per
              ? val.sell_rate_per.toFixed(2)
              : "0.00",
            sell_tax: val.sell_rate_tax ? val.sell_rate_tax : "0.00",
            sell_rate_setup_fee: val.sell_rate_set_up_fee
              ? val.sell_rate_set_up_fee
              : "0.00",
            sell_rate_mid_fee: val.sell_rate_mid_fee
              ? val.sell_rate_mid_fee
              : "0.00",
            sell_total_charge: val.sell_rate_total_fee
              ? val.sell_rate_total_fee
              : "0.00",
            payment_id: txn_id,
            created_at: val.created_at
              ? moment(val.created_at).format("DD-MM-YYYY HH:mm:ss")
              : "-",
            updated_at: val.updated_at
              ? moment(val.updated_at).format("DD-MM-YYYY HH:mm:ss")
              : "-",
            buy_rate_setup_fee: val.buy_rate_set_up_fee
              ? val.buy_rate_set_up_fee
              : "0.00",
            buy_rate_mid_fee: val.buy_rate_mid_fee
              ? val.buy_rate_mid_fee.toFixed(2)
              : "0.00",
            buy_total_charge: val.buy_rate_total_fee
              ? val.buy_rate_total_fee
              : "0.00",
          };
          send_res.push(temp);
        }
        total_count = await charges_invoice_models.feature_count(
          condition,
          date_condition
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
  invoice_to_merchant_list: async (req, res) => {
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

    if (req.bodyString("submerchant_id")) {
      condition.sub_merchant_id = req.bodyString("submerchant_id");
    }

    // if (req.bodyString("merchant_id")) {
    //     condition.merchant_id = enc_dec.cjs_decrypt(
    //         req.bodyString("merchant_id")
    //     );
    // }

    // if (req.bodyString("month_year")) {
    //     condition.month = '"' + req.bodyString("month_year") + '"';
    // }

    // if (req.bodyString("status")) {
    //     condition.status = '"' + req.bodyString("status") + '"';
    // }

    charges_invoice_models
      .invoice_to_merchant_list(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let super_merchant_id = await helpers.get_super_merchant_id(
            val.sub_merchant_id
          );
          let merchant_email = await helpers.get_submerchant_email(
            val.sub_merchant_id
          );
          const date = new Date(val.created_at);
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          let temp = {
            data_id: enc_dec.cjs_encrypt(val.id),
            invoice_no: await helpers.formatNumberEight(val?.id),
            super_merchant: await helpers.get_super_merchant_name(
              super_merchant_id
            ),
            merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
            submerchant_id: await helpers.formatNumber(val?.sub_merchant_id),
            merchant_email: merchant_email
              ? merchant_email
              : await helpers.get_supermerchant_email(super_merchant_id),
            merchant_name:
              await helpers.get_merchant_name_by_merchant_id_from_details(
                val.sub_merchant_id
              ),
            feature_total: val.feature_total
              ? val.feature_total.toFixed(3)
              : "0.000",
            setup_fee_total: val.setup_fee_total
              ? val.setup_fee_total.toFixed(3)
              : "0.000",
            mid_fee_total: val.mid_fee_total
              ? val.mid_fee_total.toFixed(3)
              : "0.000",
            paydart_fee_total: val.paydart_fee_total
              ? val.paydart_fee_total.toFixed(3)
              : "0.000",
            account_fee_total: val.account_fee_total
              ? val.account_fee_total.toFixed(3)
              : "0.000",
            total: val.total ? val.total.toFixed(3) : "0.000",
            start_date: moment(firstDay).format("DD-MM-YYYY"),
            end_date: moment(lastDay).format("DD-MM-YYYY"),
            // month: val.month,
            // from_date: moment(val.from_date).format("yyyy-MM-DD"),
            // to_date: moment(val.to_date).format("yyyy-MM-DD"),
            // no_of_completed_orders: val.no_of_completed_orders,
            // sale_charges: val.sale_charges,
            // sale_tax: val.sale_tax,
            status: val.status === 0 ? "Pending" : "Paid",
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
            updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
          };

          send_res.push(temp);
        }
        let total_row = await charges_invoice_models.invoice_to_merchant_count(
          condition,
          ""
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  invoice_to_merchant_view: async (req, res) => {
    charges_invoice_models
      .new_select_one(
        { id: enc_dec.cjs_decrypt(req.bodyString("id")) },
        "invoice_to_merchant"
      )
      .then(async (val) => {
        let send_res = {
          data_id: enc_dec.cjs_encrypt(val.id),
          merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
          merchant_name:
            await helpers.get_merchant_name_by_merchant_id_from_details(
              val.sub_merchant_id
            ),
          feature_total: val.feature_total
            ? val.feature_total.toFixed(3)
            : "0.000",
          setup_fee_total: val.setup_fee_total
            ? val.setup_fee_total.toFixed(3)
            : "0.000",
          mid_fee_total: val.mid_fee_total
            ? val.mid_fee_total.toFixed(3)
            : "0.000",
          paydart_fee_total: val.paydart_fee_total
            ? val.paydart_fee_total.toFixed(3)
            : "0.000",
          account_fee_total: val.account_fee_total
            ? val.account_fee_total.toFixed(3)
            : "0.000",
          total: val.total ? val.total.toFixed(3) : "0.000",
          status: val.status === 0 ? "Pending" : "Paid",
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
          updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
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
  invoice_to_merchant_update: async (req, res) => {
    try {
      let charges_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("invoice_id")
      );

      var insdata = {
        status: 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await charges_invoice_models
        .newUpdateDetails(
          {
            id: charges_invoice_id,
          },
          insdata,
          "invoice_to_merchant"
        )
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Invoice status changed successfully."));
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

  invoice_to_psp_list: async (req, res) => {
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

    if (req.bodyString("submerchant_id")) {
      condition.sub_merchant_id = req.bodyString("submerchant_id");
    }
    // if (req.bodyString("merchant_id")) {
    //     condition.merchant_id = enc_dec.cjs_decrypt(
    //         req.bodyString("merchant_id")
    //     );
    // }

    // if (req.bodyString("month_year")) {
    //     condition.month = '"' + req.bodyString("month_year") + '"';
    // }

    // if (req.bodyString("status")) {
    //     condition.status = '"' + req.bodyString("status") + '"';
    // }

    charges_invoice_models
      .invoice_to_psp_list(condition, limit)
      .then(async (result) => {
        let send_res = [];
        for (val of result) {
          let super_merchant_id = await helpers.get_super_merchant_id(
            val.sub_merchant_id
          );
          const date = new Date(val.created_at);
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          let temp = {
            data_id: enc_dec.cjs_encrypt(val.id),
            merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
            invoice_no: await helpers.formatNumberEight(val?.id),
            super_merchant: await helpers.get_super_merchant_name(
              super_merchant_id
            ),
            sub_merchant_id: await helpers.formatNumber(val?.sub_merchant_id),
            merchant_name:
              await helpers.get_merchant_name_by_merchant_id_from_details(
                val.sub_merchant_id
              ),
            buy_setup_fee_total: val.buy_setup_fee_total
              ? val.buy_setup_fee_total.toFixed(3)
              : "0.000",
            buy_mid_fee_total: val.buy_mid_fee_total
              ? val.buy_mid_fee_total.toFixed(3)
              : "0.000",
            buy_account_fee: val.buy_account_fee
              ? val.buy_account_fee.toFixed(3)
              : "0.000",
            total: val.total ? val.total.toFixed(3) : "0.000",
            status: val.status === 0 ? "Pending" : "Paid",
            start_date: moment(firstDay).format("DD-MM-YYYY"),
            end_date: moment(lastDay).format("DD-MM-YYYY"),
            created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
            updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
          };
          send_res.push(temp);
        }
        let total_row = await charges_invoice_models.invoice_to_psp_count(
          condition,
          ""
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  invoice_to_psp_view: async (req, res) => {
    charges_invoice_models
      .new_select_one(
        { id: enc_dec.cjs_decrypt(req.bodyString("id")) },
        "invoice_to_psp"
      )
      .then(async (val) => {
        let send_res = {
          data_id: enc_dec.cjs_encrypt(val.id),
          merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
          merchant_name:
            await helpers.get_merchant_name_by_merchant_id_from_details(
              val.sub_merchant_id
            ),
          buy_setup_fee_total: val.buy_setup_fee_total
            ? val.buy_setup_fee_total.toFixed(3)
            : "0.000",
          buy_mid_fee_total: val.buy_mid_fee_total
            ? val.buy_mid_fee_total.toFixed(3)
            : "0.000",
          buy_account_fee: val.buy_account_fee
            ? val.buy_account_fee.toFixed(3)
            : "0.000",
          total: val.total ? val.total.toFixed(3) : "0.000",
          status: val.status === 0 ? "Pending" : "Paid",
          created_at: moment(val.created_at).format("yyyy-MM-DD hh:mm"),
          updated_at: moment(val.updated_at).format("yyyy-MM-DD hh:mm"),
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
  invoice_to_psp_update: async (req, res) => {
    try {
      let charges_invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("invoice_id")
      );

      var insdata = {
        status: 1,
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await charges_invoice_models
        .newUpdateDetails(
          {
            id: charges_invoice_id,
          },
          insdata,
          "invoice_to_psp"
        )
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Invoice status changed successfully."));
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
  walletSummary: async (req, res) => {
    console.log(`Transaction summary API called`);

    let super_merchant_id = req.bodyString("super_merchant_id");
    let sub_merchant_id = req.bodyString("sub_merchant_id");
    let currency = req.bodyString("currency");
    let wallet_id = req.bodyString("wallet_id");
    let start_date = req.bodyString("start_date");
    let end_date = req.bodyString("end_date");
    let page = parseInt(req.bodyString("page") - 1) || 0;
    let per_page = parseInt(req.bodyString("per_page")) || 50;

    try {
      let condition = {};
      let limit = { per_page, page };
      let dateRange = {};

      // Build date range for performance optimization
      if (start_date && end_date) {
        dateRange.start_date = start_date;
        dateRange.end_date = end_date;
      }

      // Build conditions with table aliases
      if (super_merchant_id) {
        let dec_super_merchant_id = enc_dec.cjs_decrypt(super_merchant_id);
        condition["m.super_merchant_id"] = dec_super_merchant_id;
      }
      if (sub_merchant_id) {
        let dec_sub_merchant_id = enc_dec.cjs_decrypt(sub_merchant_id);
        condition["t.sub_merchant_id"] = dec_sub_merchant_id;
      }
      if (currency) {
        condition["t.currency"] = currency;
      }
      if (wallet_id) {
        condition["w.wallet_id"] = wallet_id;
      }

      console.log("Final condition:", condition);
      console.log("Date range:", dateRange);

      // Execute queries in parallel
      const [result, total_res] = await Promise.all([
        charges_invoice_models.fetchWalletSummary(condition, limit, dateRange),
        charges_invoice_models.fetchWalletSummaryCount(condition, dateRange),
      ]);

      console.log(
        `Total records: ${total_res}, Current page records: ${
          result?.length || 0
        }`
      );

      const pagination = {
        current_page: page,
        per_page: per_page,
        total_records: total_res,
        total_pages: Math.ceil(total_res / per_page),
        has_next: (page + 1) * per_page < total_res,
        has_previous: page > 0,
      };

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            result,
            "Transaction summary fetched successfully.",
            total_res
          )
        );
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(
          response.errormsg(
            error.message || "Failed to fetch transaction summary"
          )
        );
    }
  },
  walletBalance: async (req, res) => {
    console.log(`fetch wallet balance from API or Payout service`);
    const ip = req.headers['x-forwarded-for'];
    console.log(ip);
    let condition = {
      currency: req.bodyString("currency"),
      sub_merchant_id: req.bodyString("sub_merchant_id"),
      wallet_id: req.bodyString("wallet_id"),
      receiver_id: req.bodyString("receiver_id"),
    };
    try {
      let result = await charges_invoice_models.fetchWalletBalance(condition);

      if (result)
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(result, "List fetched successfully."));
      else
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("No wallet found with the given details."));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  addPayout: async (req, res) => {
    let submerchant_id = req.bodyString("submerchant_id");
    let order_id = req.bodyString("order_id");
    console.log("🚀 ~ submerchant_id:", submerchant_id);
    let receiver_id = req.bodyString("receiver_id");
    try {
      let result;
      if (submerchant_id) {
        result = await charges_invoice_models.new_select_one(
          { id: submerchant_id, deleted: 0, status: 0 },
          "master_merchant"
        );
      } else if (receiver_id) {
        result = await charges_invoice_models.validate_receiver(receiver_id);
      }
      // check if order id exits and it is pending 
      let orderExits = await charges_invoice_models.new_select_one({order_id:order_id,order_status:'PENDING',status:0},'payout_pending_transactions');
      // if(!orderExits){
      //   return res
      //     .status(statusCode.badRequest)
      //     .send(response.errormsg("Invalid order id"));
      // }
      if (result) {
        // lets check the order status
        let order_status = req.bodyString("order_status");
        let amt = req.bodyString("amount");
        switch (order_status) {
          case "COMPLETED":
            order_status = "PAID";
            let data = {
              sub_merchant_id: null == submerchant_id ? 0 : submerchant_id,
              receiver_id: null == receiver_id ? 0 : receiver_id,
              order_id: req.bodyString("order_id"),
              order_status: "PAID",
              transaction_id: req.bodyString("transaction_id"),
              currency: req.bodyString("currecny"),
              amount: -amt,
              net_amount: -amt,
              transaction_status: "AUTHORISED",
              status: 0,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await charges_invoice_models.addCharges(data);

            let completedData = {
              sub_merchant_id: null == submerchant_id ? 0 : submerchant_id,
              receiver_id: null == receiver_id ? 0 : receiver_id,
              order_id: req.bodyString("order_id"),
              order_status: "COMPLETED",
              transaction_id: req.bodyString("transaction_id"),
              currency: req.bodyString("currecny"),
              amount: amt,
              status: 0,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await charges_invoice_models.addPendingPayoutTransaction(
              completedData
            );
            break;

          case "FAILED":
            //  order_status = "PAYOUT-REVERSAL";
            // let dataCharges = {
            //   sub_merchant_id: null == submerchant_id ? 0 : submerchant_id,
            //   receiver_id: null == receiver_id ? 0 : receiver_id,
            //   order_id: req.bodyString("order_id"),
            //   order_status: "PAYOUT-REVERSAL",
            //   transaction_id: req.bodyString("transaction_id"),
            //   currency: req.bodyString("currecny"),
            //   amount: amt,
            //   net_amount: amt,
            //   transaction_status: "AUTHORISED",
            //   status: 0,
            //   created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            //   updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            // };
            // await charges_invoice_models.addCharges(dataCharges);
            order_status = "FAILED";
            let failedData = {
              sub_merchant_id: null == submerchant_id ? 0 : submerchant_id,
              receiver_id: null == receiver_id ? 0 : receiver_id,
              order_id: req.bodyString("order_id"),
              order_status: "FAILED",
              transaction_id: req.bodyString("transaction_id"),
              currency: req.bodyString("currecny"),
              amount: amt,
              status: 0,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await charges_invoice_models.addPendingPayoutTransaction(
              failedData
            );
            break;

          case "PENDING":
            let pendingData = {
              sub_merchant_id: null == submerchant_id ? 0 : submerchant_id,
              receiver_id: null == receiver_id ? 0 : receiver_id,
              order_id: req.bodyString("order_id"),
              order_status: "PENDING",
              transaction_id: req.bodyString("transaction_id"),
              currency: req.bodyString("currecny"),
              amount: amt,
              status: 0,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await charges_invoice_models.addPendingPayoutTransaction(
              pendingData
            );
            break;
        }

        res
          .status(statusCode.ok)
          .send(response.successmsg("Payout details updated successfully."));
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid sub merchant id"));
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  fetchWalletList: async (req, res) => {
    try {
      let currency = req.bodyString("currency");
      let country = req.bodyString("country");
      let amount = req.bodyString("amount");
      let country_id = await helpers.get_country_id_by_code(country);
      console.log(country_id);
      if (country_id != "") {
        let result = await charges_invoice_models.fetchWalletList(
          country_id,
          currency,
          amount,
          country
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(result, "Wallet List fetched successfully.")
          );
      } else {
        return res
          .status(statusCode.ok)
          .send(
            response.errormsg(
              "Invalid country ISO code please check and retry."
            )
          );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  merchantWalletList: async (req, res) => {
    console.log(`merchant wallet list api`);

    let super_merchant_id = req.bodyString("super_merchant_id");
    let sub_merchant_id = req.bodyString("sub_merchant_id");
    let currency = req.bodyString("currency");
    let page = parseInt(req.bodyString("page") - 1) || 0; // Convert to number, default to 0
    let per_page = parseInt(req.bodyString("per_page")) || 50; // Convert to number, default to 50

    console.log(`page and per_page:`, { page, per_page });

    try {
      let condition = {};
      let limit = {
        per_page: per_page,
        page: page,
      };

      // Build conditions
      if (super_merchant_id) {
        let dec_super_merchant_id = enc_dec.cjs_decrypt(super_merchant_id);
        condition["mm.super_merchant_id"] = dec_super_merchant_id;
      }
      if (sub_merchant_id) {
        let dec_sub_merchant_id = enc_dec.cjs_decrypt(sub_merchant_id);
        condition["naf.sub_merchant_id"] = dec_sub_merchant_id;
      }
      if (currency) {
        condition["naf.currency"] = currency;
      }

      console.log("Final condition:", condition);
      console.log("Final limit:", limit);

      // Fetch data and count in parallel for better performance
      const [result, total_res] = await Promise.all([
        charges_invoice_models.fetchWallets(condition, limit),
        charges_invoice_models.fetchWalletCount(condition),
      ]);

      console.log(
        `Total records: ${total_res}, Current page records: ${
          result?.length || 0
        }`
      );

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            result,
            "Wallets fetched successfully.",
            total_res
          )
        );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message || "Failed to fetch wallets"));
    }
  },
  fetchSubMerchantList: async (req, res) => {
    let super_merchant_id = req.bodyString("super_merchant_id");
    try {
      let dec_super_merchant_id = enc_dec.cjs_decrypt(super_merchant_id);
      let result = await charges_invoice_models.fetchSubMerchant({
        super_merchant_id: dec_super_merchant_id,
      });
      let send_res = [];
      for (let row of result) {
        let temp = {
          sub_merchant_id: enc_dec.cjs_encrypt(row.merchant_id),
          smi: row.merchant_id,
          sub_merchant_name: row.company_name,
        };
        send_res.push(temp);
      }
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(send_res, "Merchant fetched successfully.")
        );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  updateCharges: async (req, res) => {
    try {
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let receiver_id = req.bodyString("receiver_id");

      let result = await updateChargesFunction(sub_merchant_id, receiver_id);
      if (result?.status == 200) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(result?.data, "Charges update successfully.")
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg(result?.message));
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  updateCharges2: async (sub_merchant_id, receiver_id) => {
    return await updateChargesFunction(sub_merchant_id, receiver_id);
  },
  get_charges_analytics: async (req, res) => {
    console.log("🚀 ~ req.body:", req.body)

    let limit = 30;
    let condition = {};

    if (req.bodyString("currency")) {
      condition.currency = req.bodyString("currency");
    }

    if (req.bodyString("country")) {
      condition.country = req.bodyString("country");
    }

    if (req.bodyString("receivers_ids")) {
      condition.receivers_ids = req.bodyString("receivers_ids");
    }

    if (req.bodyString("from_date") && req.bodyString("to_date")) {
      condition.from_date = req.bodyString("from_date");
      condition.to_date = req.bodyString("to_date");
    }else{
      condition.from_date = moment().subtract(7,'days').format("YYYY-MM-DD");
      condition.to_date = moment().format("YYYY-MM-DD");
    }

    if (req.bodyString("from_date") && req.bodyString("to_date")) {
      condition.from_date = req.bodyString("from_date");
      condition.to_date = req.bodyString("to_date");
    }

    if (req.bodyString("order_status")) {
      condition.order_status = req.bodyString("order_status");
    }

    charges_invoice_models.get_charges_analytics(condition, limit).then(async (result) => {
        let total_row = 100;

        let formatted = result.map((row) => ({
          date: row.transaction_date,
          amount: row.total_day_amount,
          transactions: row.total_transactions,
        }));
        
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              formatted,
              "List fetched successfully.",
              total_row
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
  subMerchantCount: async (req, res) => {
    try {
      let result = await submerchantmodel.get_count_mid("master_merchant", {deleted: 0});
      console.log("🚀 ~ result:", result)
      if (result) {
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(result, "Merchant fetched successfully.")
        );
      }else{
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(0, "Merchant fetched successfully.")
        );
      }
      
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  walletCount: async (req, res) => {
    try {
      let result = await submerchantmodel.get_count_mid("wallet", {deleted: 0});
      if (result) {
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(result, "Wallet fetched successfully.")
        );
      }else{
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(0, "Wallet fetched successfully.")
        );
      }
      
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  accountCount: async (req, res) => {
    try {
      let result = await submerchantmodel.get_count_mid("merchant_accounts", {deleted: 0});
      if (result) {
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(result, "Accounts fetched successfully.")
        );
      }else{
        res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(0, "Accounts fetched successfully.")
        );
      }
      
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

async function updateChargesFunction(sub_merchant_id, receiver_id){
    try {

      if (!sub_merchant_id) {
        return {status: 400, message: "Submerchant ID required!"};
      }

      if (!receiver_id) {
        return {status: 400, message: "Receiver ID required!"};
      }

      let data = {
        receiver_id: receiver_id,
      };
      let result = await charges_invoice_models.updateCharges(
        data,
        sub_merchant_id
      );
      console.log("🚀 ~ updateCharges-result:", result);
      if (result) {
        let response_data = {
          receiver_id: receiver_id,
          sub_merchant_id: sub_merchant_id
        }
        return {status: 200, message: "Charges update successfully.", data: response_data};
      } else {
        return {status: 400, message: "Error: on charges update..."};
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return {status: 400, message: error.message};
    }
  };

module.exports = charges_invoice_controller;
