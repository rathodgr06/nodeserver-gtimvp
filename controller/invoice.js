const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const invModel = require("../models/invoiceModel");
const enc_dec = require("../utilities/decryptor/decryptor");
const helpers = require("../utilities/helper/general_helper");
const SequenceUUID = require("sequential-uuid");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const moment = require("moment");
const { testMobile } = require("express-useragent");
const mailSender = require("../utilities/mail/mailsender");
const xlsx = require("xlsx");
const QRCode = require("qrcode");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');

const inv = {
  add_customer: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let ip = await helpers.get_ip(req);
    let ship_country =  enc_dec.cjs_decrypt(
      req.bodyString("ship_country")
    );
    let bill_country =  enc_dec.cjs_decrypt(
      req.bodyString("bill_country")
    );
    let cust_data = {
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      prefix: req.bodyString("name_prefix"),
      name: req.bodyString("name"),
      logo: req?.all_files?.logo ? req?.all_files?.logo : "",
      code: req.bodyString("country_code"),
      mobile: req.bodyString("mobile"),
      email: req.bodyString("email"),
      ship_address: req.bodyString("ship_address"),
      ship_country: ship_country,
      ship_state: await enc_dec.cjs_decrypt(req.bodyString("ship_state")),
      ship_city: await enc_dec.cjs_decrypt(req.bodyString("ship_city")),
      ship_zip_code: req.bodyString("ship_zip_code")
        ? req.bodyString("ship_zip_code")
        : "",
      bill_address: req.bodyString("bill_address"),
      bill_country: bill_country,
      bill_state: await enc_dec.cjs_decrypt(req.bodyString("bill_state")),
      bill_city: await enc_dec.cjs_decrypt(req.bodyString("bill_city")),
      bill_zip_code: req.bodyString("bill_zip_code")
        ? req.bodyString("bill_zip_code")
        : "",
      added_by: req.user.id,
      ip: ip,
      created_at: added_date,
      submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
    };

    invModel
      .add(cust_data)
      .then(async (result) => {
        let customerData = {
          id: enc_dec.cjs_encrypt(result.insertId),
          name: cust_data.name,
          email: cust_data.email,
          shipping_details: {
            address: req.bodyString("ship_address"),
            city: await helpers.get_city_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("ship_city"))
            ),
            state: await helpers.get_state_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("ship_state"))
            ),
            country: await helpers.get_country_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("ship_country"))
            ),
            zip_code: req.bodyString("ship_zip_code"),
          },
          billing_details: {
            address: req.bodyString("bill_address"),
            city: await helpers.get_city_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("bill_city"))
            ),
            state: await helpers.get_state_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("bill_state"))
            ),
            country: await helpers.get_country_name_by_id(
              enc_dec.cjs_decrypt(req.bodyString("bill_country"))
            ),
            zip_code: req.bodyString("bill_zip_code"),
          },
        };

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(customerData, "Client Added successfully.")
          );
        // }).catch((error) => {
        //       res.status(statusCode.internalError).send(response.errormsg(error.message));
        // })
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  list_customer: async (req, res) => {
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

    let and_filter_obj = {};
    and_filter_obj.deleted = 0;
    let date_condition = {};
    let merchant;
    if (req.user.type === "merchant") {
      merchant = req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id;
      if (req.bodyString("selected_merchant") != 0) {
        and_filter_obj.submerchant_id = enc_dec.cjs_decrypt(
          req.bodyString("selected_merchant")
        );
      }
    }
    if (merchant) {
      and_filter_obj.merchant_id = merchant;
    }
    if (req.bodyString("submerchant_id")) {
      and_filter_obj.submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
    }
    if (req.bodyString("customer_id")) {
      and_filter_obj.id = parseInt(req.bodyString("customer_id"), 10);
    }

    if (req.bodyString("country")) {
      and_filter_obj.bill_country = enc_dec.cjs_decrypt(
        req.bodyString("country")
      );
    }

    let like_search = {};

    if (req.bodyString("search")) {
      like_search.email = req.bodyString("search");
      like_search.name = req.bodyString("search");
      like_search.mobile = req.bodyString("search");
    }

    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    if (req.bodyString("status")) {
      and_filter_obj.status = req.bodyString("status");
    }

    invModel
      .selectCustomer(and_filter_obj, limit, date_condition, like_search)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let first_txn_date = await invModel.select_txn_date(val.id, "asc");
          let last_txn_date = await invModel.select_txn_date(val.id, "desc");
          let res = {
            customer_id: enc_dec.cjs_encrypt(val.id),
            name: val.name,
            email: val.email,
            mobile_no: "+" + val.code + " " + val.mobile,
            shipping_address: val.shipping_address,
            ship_address: val.ship_address,
            ship_country: enc_dec.cjs_encrypt(val.ship_country),
            ship_country_name: await helpers.get_country_name_by_id(
              val.ship_country
            ),
            ship_state: enc_dec.cjs_encrypt(val.ship_state),
            ship_state_name: await helpers.get_state_name_by_id(val.ship_state),
            ship_city: enc_dec.cjs_encrypt(val.ship_city),
            ship_city_name: await helpers.get_city_name_by_id(val.ship_city),
            ship_zip_code: val.ship_zip_code,
            billing_address: val.billing_address,
            bill_country: enc_dec.cjs_encrypt(val.bill_country),
            bill_country_name: await helpers.get_country_name_by_id(
              val.bill_country
            ),
            bill_state: enc_dec.cjs_encrypt(val.bill_state),
            bill_state_name: await helpers.get_state_name_by_id(val.bill_state),
            bill_city: enc_dec.cjs_encrypt(val.bill_city),
            bill_city_name: await helpers.get_city_name_by_id(val.bill_city),
            bill_zip_code: val.bill_zip_code,
            logo: val?.logo ? server_addr + "/static/logo/" + val.logo : "",
            status: val.status === 1 ? "Deactivated" : "Active",
            country: await helpers.get_country_code_by_id(val.bill_country),
            de_customer_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            created_date: await date_formatter.get_date_time(val.created_at),
            first_txn_date: first_txn_date,
            last_txn_date: last_txn_date,
            submerchant_id: val?.submerchant_id
              ? enc_dec.cjs_encrypt(val?.submerchant_id)
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
          };
          send_res.push(res);
        }
        total_count = await invModel.get_count_cust(
          and_filter_obj,
          date_condition,
          like_search
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
  details_customer: async (req, res) => {
    let customer_id = await enc_dec.cjs_decrypt(req.bodyString("customer_id"));
    invModel
      .selectOne({ id: customer_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;

        let res1 = {
          customer_id: enc_dec.cjs_encrypt(val.id),
          prefix: val.prefix,
          name: val.name,
          email: val.email,
          country_code: val.code,
          mobile_no: val.mobile,
          shipping_address: val.shipping_address,
          ship_address: val.ship_address,
          ship_country: enc_dec.cjs_encrypt(val.ship_country),
          ship_country_name: await helpers.get_country_name_by_id(
            val.ship_country
          ),
          ship_state: enc_dec.cjs_encrypt(val.ship_state),
          ship_state_name: await helpers.get_state_name_by_id(val.ship_state),
          ship_city: enc_dec.cjs_encrypt(val.ship_city),
          ship_city_name: await helpers.get_city_name_by_id(val.ship_city),
          ship_zip_code: val.ship_zip_code,
          billing_address: val.bill_address,
          bill_country: enc_dec.cjs_encrypt(val.bill_country),
          bill_country_name: await helpers.get_country_name_by_id(
            val.bill_country
          ),
          bill_state: enc_dec.cjs_encrypt(val.bill_state),
          bill_state_name: await helpers.get_state_name_by_id(val.bill_state),
          bill_city: enc_dec.cjs_encrypt(val.bill_city),
          bill_city_name: await helpers.get_city_name_by_id(val.bill_city),
          bill_zip_code: val.bill_zip_code,
          logo: val?.logo ? server_addr + "/static/logo/" + val.logo : "",
          status: val.status == 1 ? "Deactivated" : "Activated",
          submerchant_id: val?.submerchant_id
            ? enc_dec.cjs_encrypt(val?.submerchant_id)
            : "",
          submerchant_name: val?.submerchant_id
            ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
            : "",
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
  update_customer: async (req, res) => {
    try {
      let added_date = await date_formatter.created_date_time();
      let customer_id = await enc_dec.cjs_decrypt(
        req.bodyString("customer_id")
      );
      var insdata = {
        prefix: req.bodyString("name_prefix"),
        name: req.bodyString("name"),
        code: req.bodyString("country_code"),
        mobile: req.bodyString("mobile"),
        email: req.bodyString("email"),
        shipping_address: req.bodyString("shipping_address"),
        ship_address: req.bodyString("ship_address"),
        ship_country: await enc_dec.cjs_decrypt(req.bodyString("ship_country")),
        ship_state: await enc_dec.cjs_decrypt(req.bodyString("ship_state")),
        ship_city: await enc_dec.cjs_decrypt(req.bodyString("ship_city")),
        ship_zip_code: req.bodyString("ship_zip_code"),
        billing_address: req.bodyString("billing_address"),
        bill_address: req.bodyString("bill_address"),
        bill_country: await enc_dec.cjs_decrypt(req.bodyString("bill_country")),
        bill_state: await enc_dec.cjs_decrypt(req.bodyString("bill_state")),
        bill_city: await enc_dec.cjs_decrypt(req.bodyString("bill_city")),
        bill_zip_code: req.bodyString("bill_zip_code"),
        updated_at: added_date,
        submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      };

      if (req.all_files) {
        if (req.all_files.logo) {
          insdata.logo = req.all_files.logo;
        }
      }

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      let customerData = {
        id: req.bodyString("customer_id"),
        name: req.bodyString("name"),
        email: req.bodyString("email"),
        shipping_details: {
          address: req.bodyString("ship_address"),
          city: await helpers.get_city_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("ship_city"))
          ),
          state: await helpers.get_state_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("ship_state"))
          ),
          country: await helpers.get_country_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("ship_country"))
          ),
          zip_code: req.bodyString("ship_zip_code"),
        },
        billing_details: {
          address: req.bodyString("bill_address"),
          city: await helpers.get_city_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("bill_city"))
          ),
          state: await helpers.get_state_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("bill_state"))
          ),
          country: await helpers.get_country_name_by_id(
            enc_dec.cjs_decrypt(req.bodyString("bill_country"))
          ),
          zip_code: req.bodyString("bill_zip_code"),
        },
      };
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(customerData, "Client Updated successfully.")
        );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  customer_deactivate: async (req, res) => {
    try {
      let customer_id = await enc_dec.cjs_decrypt(
        req.bodyString("customer_id")
      );
      var insdata = {
        status: 1,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client deactivated successfully"));
    } catch {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  customer_activate: async (req, res) => {
    try {
      let customer_id = await enc_dec.cjs_decrypt(
        req.bodyString("customer_id")
      );
      var insdata = {
        status: 0,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client activated successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  customer_delete: async (req, res) => {
    try {
      let customer_id = enc_dec.cjs_decrypt(req.bodyString("customer_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client deleted successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  invoice_add: async (req, res) => {
    let created_at = await date_formatter.created_date_time();
    let ip = await helpers.get_ip(req);
    let total_amount = 0.0;
    let total_discount = 0.0;
    let total_tax = 0.0;
    let items = req.body.items;
    let product_items = [];
    for (i = 0; i < items.length; i++) {
      var rate = parseFloat(items[i].item_rate);
      var qty = parseFloat(items[i].quantity);
      var tax = parseFloat(items[i].tax_per);
      var discount = parseFloat(items[i].discount_per);
      let temp_total = rate * qty;
      let tax_amount = 0;
      let discount_amount = 0;
      if (discount > 0) {
        discount_amount = (discount / 100) * temp_total;
      }
      if (tax > 0) {
        tax_amount = (tax / 100) * (temp_total - discount_amount);
      }

      temp_total = temp_total + tax_amount - discount_amount;
      total_amount = total_amount + temp_total;
      total_discount = total_discount + discount_amount;
      total_tax = total_tax + tax_amount;
      let temp_items = {
        invoice_master_id: "",
        item_id: enc_dec.cjs_decrypt(items[i].item),
        item_rate: rate,
        quantity: qty,
        tax_per: tax,
        discount_per: discount,
        total_amount: temp_total,
        added_by: req.user.id,
        ip: ip,
        status: 0,
        created_at: created_at,
        updated_at: created_at,
      };
      product_items.push(temp_items);
    }
    let inv_data = {
      customer_id: enc_dec.cjs_decrypt(req.bodyString("customer_id")),
      merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      sub_merchant_id: enc_dec.cjs_decrypt(req.bodyString("sub_merchant_id")),
      invoice_no: await helpers.make_order_number("INV"),
      currency: req.bodyString("currency"),
      merchant_full_name: req.bodyString("merchant_full_name"),
      total_amount: total_amount,
      total_tax: total_tax,
      total_discount: total_discount,
      description: req.bodyString("description"),
      special_note: req.bodyString("note"),
      issue_date: req.bodyString("issue_date"),
      expiry_date: req.bodyString("expiry_date"),
      merchant_invoice_no: req.bodyString("merchant_invoice_no"),
      payment_terms: req.bodyString("payment_terms"),
      status: "Draft",
      added_by: req.user.id,
      ip: ip,
      created_at: created_at,
      updated_at: created_at,
      created_by: req.user.id,
      mode: req.bodyString("mode"),
    };
    invModel
      .add_inv(inv_data)
      .then((result) => {
        for (i = 0; i < product_items.length; i++) {
          product_items[i].invoice_master_id = result.insertId;
        }
        invModel
          .add_inv_items(product_items)
          .then(async (result_meta) => {
            let invoice_details = await invModel.selectOneInv({
              id: result.insertId,
            });

            res.status(statusCode.ok).send(
              response.successdatamsg(
                {
                  customer_email: invoice_details.email,
                  invoice_no: invoice_details.invoice_no,
                  merchant_invoice_no: invoice_details.merchant_invoice_no,
                  invoice_id: enc_dec.cjs_encrypt(result.insertId),
                },
                "Invoice saved successfully."
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

  invoice_list: async (req, res) => {
    let today = await date_formatter.current_date();

    const db_table = config.table_prefix + "inv_customer";
    const inv_table = config.table_prefix + "inv_invoice_master";
    // const merchant_name = await qrGenerateModule.getMerchantName();
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
    and_filter_obj[`${inv_table}.deleted`] = 0;
    let date_condition = {};
    let expiry_date = {};
    let merchant;
    if (req.user.type === "merchant") {
      merchant = req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id;
      if (req.bodyString("selected_merchant") != 0) {
        and_filter_obj.sub_merchant_id = enc_dec.cjs_decrypt(
          req.bodyString("selected_merchant")
        );
      }
    }
    // let sub_merchant = enc_dec.cjs_decrypt(req.bodyString("sub_merchant"));
    // let customer = enc_dec.cjs_decrypt(req.bodyString("customer_id"));
    // let currency = req.bodyString("currency");
    // let invoice_no = req.bodyString("invoice_no");

    if (merchant) {
      and_filter_obj[`${inv_table}.merchant_id`] = merchant;
    }
    if (req.bodyString("sub_merchant")) {
      and_filter_obj.sub_merchant_id = enc_dec.cjs_decrypt(
        req.bodyString("sub_merchant")
      );
    }
    if (req.bodyString("customer_id")) {
      and_filter_obj.customer_id = enc_dec.cjs_decrypt(
        req.bodyString("customer_id")
      );
    }
    if (req.bodyString("invoice_no")) {
      and_filter_obj.invoice_no = req.bodyString("invoice_no");
    }
    if (req.bodyString("currency")) {
      and_filter_obj.currency = req.bodyString("currency");
    }
    and_filter_obj.mode = req.bodyString("mode");
    let like_search = {};

    if (req.bodyString("email")) {
      like_search[`${db_table}.email`] = req.bodyString("email");
      // like_search[`${db_table}.name`] = req.bodyString("search");
      //  like_search[`${db_table}.mobile`] = req.bodyString("mobile");
    }
    if (req.bodyString("mobile")) {
      //  like_search[`${db_table}.email`] = req.bodyString("email");
      // like_search[`${db_table}.name`] = req.bodyString("search");
      like_search[`${db_table}.mobile`] = req.bodyString("mobile");
    }

    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }

    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }
    if (req.bodyString("status")) {
      if (
        req.bodyString("status") == "Draft" ||
        req.bodyString("status") == "Pending"
      ) {
        expiry_date = ">=" + `'${today}'`;
        and_filter_obj[`${inv_table}.status`] = req.bodyString("status");
      } else if (req.bodyString("status") == "Expired") {
        expiry_date =
          "<" +
          `'${today}'` +
          " and ( " +
          `${inv_table}` +
          '.status="Draft" or ' +
          `${inv_table}` +
          '.status="Pending" )';
      } else {
        and_filter_obj[`${inv_table}.status`] = req.bodyString("status");
      }
    }

    invModel
      .selectInv(
        and_filter_obj,
        limit,
        date_condition,
        like_search,
        expiry_date
      )
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            invoice_master_id: enc_dec.cjs_encrypt(val.id),
            de_customer_id: val?.customer_id
              ? await helpers.formatNumber(val?.customer_id)
              : "",
            customer_id: enc_dec.cjs_encrypt(val.customer_id),
            customer_country: await helpers.get_country_code_by_id(
              val.bill_country
            ),

            customer_name: val?.name ? val?.name : "",
            customer_email: val?.email ? val?.email : "",
            customer_code: val?.code ? val?.code : "",
            customer_mobile: val?.mobile ? val?.mobile : "",
            payment_status: val.order_id
              ? await helpers.get_invoice_status_by_order(
                  val.order_id,
                  req.bodyString("mode")
                )
              : "Unpaid",
            order_id: val.order_id,
            sub_merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
            sub_merchant_name: await helpers.get_sub_merchant_name_by_id(
              val.sub_merchant_id
            ),
            merchant_name: await helpers.get_super_merchant_name(
              val.merchant_id
            ),
            invoice_no: val.invoice_no,
            merchant_invoice_no: val.merchant_invoice_no,
            issue_date: await date_formatter.get_date(val.issue_date),
            expiry_date: await date_formatter.get_date(val.expiry_date),
            created_date: await date_formatter.get_date_time(val.created_at),
            last_modified_date: await date_formatter.get_date_time(
              val.updated_at
            ),
            currency: val.currency,
            total_amount: val.total_amount ? val.total_amount.toFixed(2) : 0,
            total_tax: val.total_tax ? val.total_tax.toFixed(2) : 0,
            total_discount: val.total_discount
              ? val.total_discount.toFixed(2)
              : 0,
            actual_status: val.status,
            status:
              (await date_formatter.insert_date(val.expiry_date)) >= today ||
              val.status == "Closed"
                ? val.status
                : "Expired",
            no_of_share: await helpers.count_no_of_times_invoice_shared(
              val.id,
              "length"
            ),
            deleted: val.deleted === 1 ? "Deleted" : "Not Deleted",
            created_by: val.created_by
              ? await helpers.get_super_merchant_name(val.created_by)
              : "",
            bulk_upload_data_check:
              val.customer_id &&
              val?.merchant_invoice_no &&
              val.issue_date &&
              val.expiry_date
                ? "data_available"
                : "data_not_found",
          };

          send_res.push(res);
        }
        let total_count = await invModel.get_countInv(
          and_filter_obj,
          date_condition,
          like_search,
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

  invoice_details: async (req, res) => {
    let today = await date_formatter.current_date();
    let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_master_id"));
    invModel
      .selectOneInv({ id: invoice_id })
      .then(async (result) => {
        let merchant_details = await invModel.getMerchantDetails({
          merchant_id: result.sub_merchant_id,
        });

        merchant_details.logo = merchant_details.icon
          ? process.env.STATIC_URL + "/static/files/" + merchant_details.icon
          : "";
        let send_res = [];
        var subtotal = 0.0;
        let val = result;
        let qr_code = await QRCode.toDataURL(
          process.env.FRONTEND_URL_MERCHANT +
            "pay/" +
            req.bodyString("invoice_master_id")
        );
        let sharing_history = await helpers.count_no_of_times_invoice_shared(
          val.id,
          "response"
        );
        let res1 = {
          invoice_master_id: enc_dec.cjs_encrypt(val.id),
          customer_id: enc_dec.cjs_encrypt(val.customer_id),
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          sub_merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
          invoice_no: val?.invoice_no ? val?.invoice_no : "",
          merchant_invoice_no: val?.merchant_invoice_no
            ? val?.merchant_invoice_no
            : "",
          issue_date:
            val.issue_date != "1970-01-01" && val.issue_date != "0000-00-00"
              ? await date_formatter.get_date(val.issue_date)
              : "",
          expiry_date:
            val.expiry_date != "1970-01-01" && val.expiry_date != "0000-00-00"
              ? await date_formatter.get_date(val.expiry_date)
              : "",
          currency: val?.currency ? val?.currency : "",
          merchant_full_name: val?.merchant_full_name
            ? val?.merchant_full_name
            : "",
          currency_symbol: val?.symbol ? val?.symbol : "",
          total_amount: val.total_amount.toFixed(2),
          total_tax: val.total_tax.toFixed(2),
          total_discount: val.total_discount.toFixed(2),
          description: val?.description ? val?.description : "",
          note: val?.special_note ? val?.special_note : "",
          payment_terms: val?.payment_terms ? val?.payment_terms : "",
          status: val?.status ? val?.status : "",
          customer_title: val?.prefix ? val?.prefix : "",
          customer_name: val?.name ? val?.name : "",
          customer_email: val?.email ? val?.email : "",
          customer_mobile: val?.mobile ? val?.mobile : "",
          customer_code: val?.code ? val?.code : "",
          qr_code: qr_code,
          sharing_history: sharing_history,
          payment_link:
            process.env.FRONTEND_URL_MERCHANT +
            "pay/" +
            req.bodyString("invoice_master_id"),
          shipping_address: {
            address: val.ship_address,
            city: await helpers.get_city_name_by_id(val.ship_city),
            state: await helpers.get_state_name_by_id(val.ship_state),
            country: await helpers.get_country_name_by_id(val.ship_country),
            zip_code: val?.ship_zip_code ? val?.ship_zip_code : "",
          },
          billing_address: {
            address: val.bill_address,
            city: await helpers.get_city_name_by_id(val.bill_city),
            state: await helpers.get_state_name_by_id(val.bill_state),
            country: await helpers.get_country_name_by_id(val.bill_country),
            zip_code: val?.bill_zip_code ? val?.bill_zip_code : "",
          },
          payment_status: val.order_id
            ? await helpers.get_inv_status_by_order(val.order_id)
            : "Unpaid",
          actual_status: val.status,
          status:
            (await date_formatter.insert_date(val.expiry_date)) >= today ||
            val.status == "Closed"
              ? val.status
              : "Expired",
          bulk_upload_data_check:
            val.customer_id &&
            val?.merchant_invoice_no &&
            val.issue_date &&
            val.expiry_date
              ? "data_available"
              : "data_not_found",
        };
        send_res = res1;

        let invoice_items = await invModel.getInvoiceItems(invoice_id);
        for (i = 0; i < invoice_items.length; i++) {
          // subtotal
          subtotal += invoice_items[i].item_rate * invoice_items[i].quantity;
          // total_amt
          var total_amt =
            invoice_items[i].item_rate * invoice_items[i].quantity;
          // discount amt
          var dis_amt = (invoice_items[i].discount_per / 100) * total_amt;
          // tax amt
          var tax_amt =
            (invoice_items[i].tax_per / 100) * (total_amt - dis_amt);
          invoice_items[i].item_id = enc_dec.cjs_encrypt(
            invoice_items[i].item_id
          );
          invoice_items[i].item_rate = invoice_items[i].item_rate.toFixed(2);
          invoice_items[i].discount_per =
            invoice_items[i].discount_per.toFixed(2);
          invoice_items[i].tax_per = invoice_items[i].tax_per.toFixed(2);
          invoice_items[i].total_amount =
            invoice_items[i].total_amount.toFixed(2);
          invoice_items[i].inv_dis_amt = dis_amt ? dis_amt.toFixed(2) : "0.00";
          invoice_items[i].inv_tax_amt = tax_amt ? tax_amt.toFixed(2) : "0.00";
        }

        let inv_response = {
          merchant_details: merchant_details,
          invoice_details: res1,
          invoice_items: invoice_items,
          subtotal: subtotal.toFixed(2),
        };

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              inv_response,
              "Details fetched successfully."
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

  invoice_delete: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("invoice_master_id"));
    let update_data = { deleted: 1 };
    invModel
      .updateDetailsInv({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Invoice deleted successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  invoice_update: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      let ip = await helpers.get_ip(req);
      let total_amount = 0.0;
      let total_discount = 0.0;
      let total_tax = 0.0;
      let items = req.body.items;
      let product_items = [];
      let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
      for (i = 0; i < items.length; i++) {
        var rate = parseFloat(items[i].item_rate);
        var qty = parseFloat(items[i].quantity);
        var tax = parseFloat(items[i].tax_per);
        var discount = parseFloat(items[i].discount_per);
        let temp_total = rate * qty;
        let tax_amount = 0;
        let discount_amount = 0;
        if (discount > 0) {
          discount_amount = (discount / 100) * temp_total;
        }
        if (tax > 0) {
          tax_amount = (tax / 100) * (temp_total - discount_amount);
        }

        temp_total = temp_total + tax_amount - discount_amount;
        total_amount = total_amount + temp_total;
        total_discount = total_discount + discount_amount;
        total_tax = total_tax + tax_amount;
        let temp_items = {
          invoice_master_id: invoice_id,
          item_id: enc_dec.cjs_decrypt(items[i].item),
          item_rate: rate,
          quantity: qty,
          tax_per: tax,
          discount_per: discount,
          total_amount: temp_total,
          added_by: req.user.id,
          ip: ip,
          status: 0,
          updated_at: created_at,
        };
        product_items.push(temp_items);
      }
      let inv_data = {
        customer_id: enc_dec.cjs_decrypt(req.bodyString("customer_id")),
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        sub_merchant_id: enc_dec.cjs_decrypt(req.bodyString("sub_merchant_id")),
        invoice_no: await helpers.make_order_number("INV"),
        currency: req.bodyString("currency"),
        merchant_full_name: req.bodyString("merchant_full_name"),
        total_amount: total_amount,
        total_tax: total_tax,
        total_discount: total_discount,
        description: req.bodyString("description"),
        special_note: req.bodyString("note"),
        issue_date: req.bodyString("issue_date"),
        expiry_date: req.bodyString("expiry_date"),
        merchant_invoice_no: req.bodyString("merchant_invoice_no"),
        payment_terms: req.bodyString("payment_terms"),
        status: "Draft",
        added_by: req.user.id,
        ip: ip,
        updated_at: created_at,
      };
      invModel
        .updateDetailsInv({ id: invoice_id }, inv_data)
        .then(async (result) => {
          await invModel.removeItemsOfInvoice(invoice_id);
          invModel
            .add_inv_items(product_items)
            .then((result_meta) => {
              res.status(statusCode.ok).send(
                response.successdatamsg(
                  {
                    invoice_id: enc_dec.cjs_encrypt(invoice_id),
                  },
                  "Invoice updated successfully."
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
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  invoice_deactivate: async (req, res) => {
    try {
      let invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("invoice_master_id")
      );
      var insdata = {
        status: 1,
      };

      $ins_id = await invModel.updateDetails({ id: invoice_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Customer deactivated successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  invoice_activate: async (req, res) => {
    try {
      let invoice_id = await enc_dec.cjs_decrypt(
        req.bodyString("invoice_master_id")
      );
      var insdata = {
        status: 0,
      };

      $ins_id = await invModel.updateDetails({ id: invoice_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Customer activated successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  finalize_and_send: async (req, res) => {
    let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
    let enc_invoice_id = req.bodyString("invoice_id");
    let updateData = {
      status: "Pending",
    };
    invModel
      .updateDetailsInv({ id: invoice_id }, updateData)
      .then(async (result) => {
        let invoice_details = await invModel.selectOneInv({
          id: invoice_id,
        });
        let merchant_details = await invModel.getMerchantDetails({
          merchant_id: invoice_details.sub_merchant_id,
        });
        merchant_details.logo = merchant_details.icon
          ? process.env.STATIC_URL + "/static/files/" + merchant_details.icon
          : "";
        var subtotal = 0.0;
        let val = invoice_details;
        let res1 = {
          invoice_master_id: enc_dec.cjs_encrypt(val.id),
          customer_id: enc_dec.cjs_encrypt(val.customer_id),
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          sub_merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
          invoice_no: val.invoice_no,
          merchant_invoice_no: val.merchant_invoice_no,
          issue_date: await date_formatter.get_date(val.issue_date),
          expiry_date: await date_formatter.get_date(val.expiry_date),
          currency: val.currency,
          currency_symbol: val.symbol,
          total_amount: val.total_amount.toFixed(2),
          total_tax: val.total_tax.toFixed(2),
          total_discount: val.total_discount.toFixed(2),
          description: val.description,
          note: val.special_note,
          payment_terms: val.payment_terms,
          status: val.status,
          customer_title: val.prefix,
          customer_name: val.name,
          customer_email: val.email,
          customer_mobile_code: val.code,
          customer_mobile: val.mobile,
          shipping_address: {
            address: val.ship_address,
            city: await helpers.get_city_name_by_id(val.ship_city),
            state: await helpers.get_state_name_by_id(val.ship_state),
            country: await helpers.get_country_name_by_id(val.ship_country),
            zip_code: val.ship_zip_code,
          },
          billing_address: {
            address: val.bill_address,
            city: await helpers.get_city_name_by_id(val.bill_city),
            state: await helpers.get_state_name_by_id(val.bill_state),
            country: await helpers.get_country_name_by_id(val.bill_country),
            zip_code: val.bill_zip_code,
          },
        };

        let invoice_items = await invModel.getInvoiceItems(invoice_id);
        for (i = 0; i < invoice_items.length; i++) {
          subtotal += invoice_items[i].item_rate * invoice_items[i].quantity;
          invoice_items[i].item_id = enc_dec.cjs_encrypt(
            invoice_items[i].item_id
          );
          invoice_items[i].item_rate = invoice_items[i].item_rate.toFixed(2);
          invoice_items[i].discount_per =
            invoice_items[i].discount_per.toFixed(2);
          invoice_items[i].tax_per = invoice_items[i].tax_per.toFixed(2);
          invoice_items[i].total_amount =
            invoice_items[i].total_amount.toFixed(2);
        }

        let inv_response = {
          merchant_details: merchant_details,
          invoice_details: res1,
          items: invoice_items,
          subtotal: subtotal.toFixed(2),
        };

        await QRCode.toDataURL(
          process.env.FRONTEND_URL_MERCHANT + "pay/" + enc_invoice_id,
          async (err, data) => {
            if (err) {
              res.status(statusCode.internalError).send(response.errormsg(err));
            }

            let dataa = {
              pay_url:
                process.env.FRONTEND_URL_MERCHANT + "pay/" + enc_invoice_id,
              download:
                process.env.FRONTEND_URL_MERCHANT +
                "download-invoice-pdf/" +
                enc_invoice_id,
              qr_url: data,
              mail_to: invoice_details.email,
              mail_cc: req.bodyString("cc_email"),
              currency: invoice_details.symbol,
              amount: invoice_details.total_amount,
              subject: req.bodyString("subject"),
              invoice: inv_response,
            };

            let mail_response = await mailSender.InvoiceMail(dataa);
            let ins_logs = await invModel.add_sharing_logs({
              invoice_id: val.id,
              email: invoice_details.email,
              cc: req.bodyString("cc_email"),
            });
            res
              .status(statusCode.ok)
              .send(
                response.successmsg(
                  "Invoice finalize and mail send successfully."
                )
              );
          }
        );
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  invoice_qr: async (req, res) => {
    let register_at = await date_formatter.created_date_time();
    let start_date = await date_formatter.created_date_time();
    let type_of_qr = req.bodyString("type_of_qr");
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let qr_id = uuid.generate();

    let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_id"));
    let enc_invoice_id = req.bodyString("invoice_id");

    invModel
      .selectOneInv({ id: invoice_id })
      .then(async (result) => {
        let merchant_details = await invModel.getMerchantDetails({
          merchant_id: result.sub_merchant_id,
        });
        merchant_details.logo = merchant_details.icon
          ? server_addr + "/static/files/" + merchant_details.icon
          : "";
        let val = result;
        let res1 = {
          invoice_master_id: enc_dec.cjs_encrypt(val.id),
          customer_id: enc_dec.cjs_encrypt(val.customer_id),
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          sub_merchant_id: enc_dec.cjs_encrypt(val.sub_merchant_id),
          invoice_no: val.invoice_no,
          issue_date: await date_formatter.insert_date(val.issue_date),
          expiry_date: await date_formatter.get_date(val.expiry_date),
          currency: val.currency,
          currency_symbol: val.symbol,
          total_amount: val.total_amount.toFixed(2),
          total_tax: val.total_tax.toFixed(2),
          total_discount: val.total_discount.toFixed(2),
          description: val.description,
          note: val.special_note,
          payment_terms: val.payment_terms,
          status: val.status,
          customer_title: val.prefix,
          customer_name: val.name,
          customer_email: val.email,
          customer_mobile: val.mobile,
        };

        let inv_response = {
          merchant_details: merchant_details,
          invoice_details: res1,
        };

        let dataa = {
          pay_url: process.env.FRONTEND_URL_MERCHANT + "pay/" + enc_invoice_id,
          download_url:
            process.env.FRONTEND_URL_MERCHANT +
            "download-invoice/" +
            enc_invoice_id,
          currency: result.symbol,
          amount: result.total_amount,
          invoice: inv_response,
        };

        QRCode.toDataURL(dataa.pay_url, (err, data) => {
          dataa.qr = data;
          if (err) {
            res.status(statusCode.internalError).send(response.errormsg(err));
          }
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                dataa,
                "Payment link generated successfully"
              )
            );
          // res.status(statusCode.ok).send(
          //     response.success_linkmsg(
          //         data,
          //         dataa.pay_url,
          //         "Payment link generated successfully"
          //     )
          // );
        });
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  cancel_invoice: async (req, res) => {
    let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_master_id"));
    let created_at = await date_formatter.created_date_time();
    let updateData = {
      status: "Cancelled",
      updated_at: created_at,
    };

    invModel
      .updateDetailsInv({ id: invoice_id }, updateData)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Invoice cancelled successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  //invoice item start
  item_add: async (req, res) => {
    try{
    let added_date = await date_formatter.created_date_time();
    let ip = await helpers.get_ip(req);
    let item = req.body.item;
    let invoice_id = enc_dec.cjs_decrypt(req.bodyString("invoice_master_id"));
    let resp = [];
    for (i = 0; i < item.length; i++) {
      slab_data = {
        invoice_master_id: invoice_id,
        item_rate: item[i].item_rate,
        quantity: item[i].quantity,
        tax_per: item[i].tax_per,
        discount_per: item[i].discount_per,
        total_amount: item[i].total_amount,
        added_by: req.user.id,
        ip: ip,
        created_at: added_date,
      };
      resp.push(slab_data);
    }
    await invModel.add_item(resp);
    res.status(statusCode.ok).send(response.successmsg("Added successfully"));
    }catch(error){
      logger.error(500,{message: error,stack: error.stack}); 
    }
    // let item_data={
    //    invoice_master_id: await enc_dec.cjs_decrypt(req.bodyString("invoice_master_id")),
    // }
  },
  //invoice item stop

  item_list: async (req, res) => {
    // const merchant_name = await qrGenerateModule.getMerchantName();
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

    let invoice_master_id = await enc_dec.cjs_decrypt(
      req.bodyString("invoice_master_id")
    );
    let and_filter_obj = {};
    // let date_condition = {};

    if (invoice_master_id) {
      and_filter_obj.invoice_master_id = invoice_master_id;
    }
    // if (req.bodyString('customer_id')) {
    //    and_filter_obj.customer_id = req.bodyString('customer_id')
    // }
    // //   if(req.bodyString('email')){
    // //       and_filter_obj.customer_email = req.bodyString('email')
    // //   }
    // //   if(req.bodyString('mobile')){
    // //       and_filter_obj.customer_mobile = req.bodyString('mobile')
    // //   }
    // if (req.bodyString('from_date')) {
    //    date_condition.from_date = req.bodyString('from_date')
    // }

    // if (req.bodyString('to_date')) {
    //    date_condition.to_date = req.bodyString('to_date')
    // }

    invModel
      .select_item(limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            item_id: await enc_dec.cjs_encrypt(val.id),
            invoice_merchant_id: await enc_dec.cjs_encrypt(
              val.invoice_master_id
            ),
            item_rate: val.item_rate,
            quantity: val.quantity,
            tax_per: val.tax_per,
            discount_per: val.discount_per,
            total_amount: val.total_amount,
          };
          send_res.push(res);
        }

        // let total_count = await invModel.get_countInv(and_filter_obj, date_condition)
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

  item_details: async (req, res) => {
    let invoice_master_id = await enc_dec.cjs_decrypt(
      req.bodyString("invoice_master_id")
    );
    invModel
      .selectOneInv({ id: invoice_master_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;

        let res1 = {
          invoice_master_id: await enc_dec.cjs_encrypt(invoice_master_id),
          customer_id: await enc_dec.cjs_encrypt(val.customer_id),
          invoice_no: val.invoice_no,
          issue_date: await date_formatter.get_date(val.issue_date),
          expiry_date: await date_formatter.get_date(val.expiry_date),
          currency: val.currency,
          total_amount: val.total_amount,
          status: val.status,
          item_list: await invModel.list_of_item({
            invoice_master_id: invoice_master_id,
            status: "0",
          }),
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

  item_update: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let ip = await helpers.get_ip(req);
    let invoice_master_id = await enc_dec.cjs_decrypt(
      req.bodyString("invoice_master_id")
    );
    let item = req.body.item;
    let document_obj;
    invModel
      .selectOne_item({ invoice_master_id: invoice_master_id })
      .then(async (result) => {
        let resp = [];
        for (i = 0; i < item.length; i++) {
          if (item[i].item_id) {
            document_obj = {
              item_rate: item[i].item_rate,
              quantity: item[i].quantity,
              tax_per: item[i].tax_per,
              discount_per: item[i].discount_per,
              total_amount: item[i].total_amount,
              updated_at: added_date,
            };
          }

          if (item[i].item_id == "") {
            document_obj = {
              invoice_master_id: invoice_master_id,
              item_rate: item[i].item_rate,
              quantity: item[i].quantity,
              tax_per: item[i].tax_per,
              discount_per: item[i].discount_per,
              total_amount: item[i].total_amount,
              added_by: req.user.id,
              ip: ip,
              updated_at: added_date,
            };
            await invModel.add_item(document_obj);
          } else {
            await invModel.update_item(
              { id: enc_dec.cjs_decrypt(item[i].item_id) },
              document_obj
            );
          }
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Record updated successfully"));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  item_delete: async (req, res) => {
    try {
      let added_date = await date_formatter.created_date_time();
      let item_id = await enc_dec.cjs_decrypt(req.bodyString("item_id"));
      var insdata = {
        status: 1,
      };
      $ins_id = await invModel.update_item({ id: item_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Item deleted successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  item_master_add: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      var insdata = {
        item_name: req.bodyString("item_name"),
        item_rate: req.bodyString("item_rate"),
        submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
        item_description: req.bodyString("item_description"),
        status: 0,
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        created_at: created_at,
        updated_at: created_at,
      };
      let ins_id = await invModel.item_master_add(insdata);
      res.status(statusCode.ok).send(
        response.successdatamsg(
          {
            item_id: enc_dec.cjs_encrypt(ins_id.insertId),
            item_rate: insdata.item_rate,
            item_name: insdata.item_name,
          },
          "Item added successfully"
        )
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  item_master_list: async (req, res) => {
    let condition = { is_deleted: 0 };
    if (req.user.type == "merchant") {
      condition.merchant_id = req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id;
      if (req.bodyString("selected_merchant") != 0) {
        condition.submerchant_id = enc_dec.cjs_decrypt(
          req.bodyString("selected_merchant")
        );
      }
    }
    if (req.bodyString("submerchant_id")) {
      condition.submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
    }
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

    if (req.bodyString("status") == "Active") {
      condition.status = 0;
    } else if (req.bodyString("status") == 1) {
      condition.status = 1;
    }

    invModel
      .item_master_list(limit, condition)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            item_id: enc_dec.cjs_encrypt(val.id),
            item_rate: val.item_rate,
            item_name: val.item_name,
            item_description: val.item_description,
            status: val.status == 0 ? "Active" : "Deactivated",
            de_item_id: await helpers.formatNumberEight(val.id),
            created_date: await date_formatter.get_date_time(val.created_at),
            last_modified_date:
              (await date_formatter.insert_date(val.updated_at)) == "1970-01-01"
                ? "-"
                : await date_formatter.get_date_time(val.updated_at),
            submerchant_id: val?.submerchant_id
              ? enc_dec.cjs_encrypt(val?.submerchant_id)
              : "",
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
          };
          send_res.push(res);
        }

        let total_count = await invModel.item_master_count(condition);
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
  item_master_details: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    invModel
      .selectOneItem({ id: item_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let res1 = {
          item_id: enc_dec.cjs_encrypt(val.id),
          item_name: val.item_name,
          item_rate: val.item_rate,
          item_description: val.item_description,
          submerchant_id: val?.submerchant_id
            ? enc_dec.cjs_encrypt(val?.submerchant_id)
            : "",
          submerchant_name: val?.submerchant_id
            ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
            : "",
          status: val.status == 1 ? "Deactivated" : "Activated",
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
  item_master_update: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    let update_data = {
      item_rate: req.bodyString("item_rate"),
      item_name: req.bodyString("item_name"),
      submerchant_id: enc_dec.cjs_decrypt(req.bodyString("submerchant_id")),
      item_description: req.bodyString("item_description"),
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item updated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  item_master_activate: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      status: 0,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item activated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  item_master_deactivated: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      status: 1,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item deactivated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  item_master_delete: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      is_deleted: 1,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item deleted successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  import: async (req, res) => {
    console.log(`inside the request`);
    try {
      let created_at = await date_formatter.created_date_time();
      var workbook = xlsx.readFile("public/docs/" + req.body.doc, {
        dateNF: "yyyy-mm-dd",
      });

      var worksheet = workbook.Sheets[workbook.SheetNames[0]];
      let data = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: "",
      });
      let data_filtered = [];
      let temp;
      let tempArr = [];

      for (i = 0; i < data.length; i++) {
        let ids = await helpers.getMerchantAndSubMerchant_id_by_company_name({
          name: data[i].Submerchant_Name,
        });

        const mid_data = await helpers.get_mid_by_merchant_id(
          ids.merchant_id,
          data[i].Currency,
          req.body.mode
        );

        if (ids && mid_data.length > 0) {
          data[i].merchant_id = ids.super_merchant_id;
          data[i].sub_merchant_id = ids.merchant_id;

          data[i].customer_id = await helpers.getCustomerID({
            submerchant_id: data[i].sub_merchant_id,
            name: data[i].Customer_Name,
            code: data[i].Customer_Phone_Code,
            mobile: data[i].Customer_Phone,
            email: data[i].Customer_email,
            merchant_id: data[i].merchant_id,
            created_at: created_at,
          });
          data[i].item_id = await helpers.getItemId({
            submerchant_id: data[i].sub_merchant_id,
            name: data[i].Item_Name,
            merchant_id: data[i].merchant_id,
            item_rate: data[i].Rate,
          });
          data_filtered.push(data[i]);

          let invoiceData = [];
          if (i == 0) {
            let invoice = {
              customer_id: data[i].customer_id,
              merchant_id: data[i].merchant_id,
              sub_merchant_id: data[i].sub_merchant_id,
              // invoice_no: await helpers.make_order_number("INV"),
              mode: req.body.mode,
              merchant_invoice_no: data[i].Invoice,
              currency: data[i].Currency,
              total_amount: 0,
              total_discount: 0,
              total_tax: 0,
              description: data[i].Description,
              special_note: data[i].Note,
              issue_date: data[i].issue_Date,
              expiry_date: data[i].expiry_Date,
              payment_terms: data[i].Payment_Terms,
              status: "Draft",
              items: [
                {
                  item_rate: data[i].Rate,
                  item_id: data[i].item_id,
                  quantity: data[i].Quantity,
                  tax_per: data[i].Tax,
                  dis_per: data[i].Discount,
                },
              ],
            };
            tempArr.push(invoice);
          } else {
            let obj = tempArr.find(
              (o) =>
                o.merchant_invoice_no === data[i].Invoice &&
                o.currency == data[i].Currency &&
                o.sub_merchant_id == data[i].sub_merchant_id &&
                o.issue_date == data[i].issue_Date &&
                o.expiry_date == data[i].expiry_Date &&
                o.description == data[i].Description &&
                o.special_note == data[i].Note &&
                o.payment_terms == data[i].Payment_Terms &&
                o.customer_id == data[i].customer_id
            );
            if (obj) {
              let item = {
                item_rate: data[i].Rate,
                item_id: data[i].item_id,
                quantity: data[i].Quantity,
                tax_per: data[i].Tax,
                dis_per: data[i].Discount,
              };
              obj.items.push(item);
            } else {
              let invoice = {
                customer_id: data[i].customer_id,
                merchant_id: data[i].merchant_id,
                sub_merchant_id: data[i].sub_merchant_id,
                // invoice_no: await helpers.make_order_number("INV"),
                merchant_invoice_no: data[i].Invoice,
                mode: req.body.mode,
                currency: data[i].Currency,
                total_amount: 0,
                total_discount: 0,
                total_tax: 0,
                description: data[i].Description,
                special_note: data[i].Note,
                issue_date: data[i].issue_Date,
                expiry_date: data[i].expiry_Date,
                payment_terms: data[i].Payment_Terms,
                status: "Draft",
                items: [
                  {
                    item_rate: data[i].Rate,
                    item_id: data[i].item_id,
                    quantity: data[i].Quantity,
                    tax_per: data[i].Tax,
                    dis_per: data[i].Discount,
                  },
                ],
              };
              tempArr.push(invoice);
            }
          }
        }
      }
      //  Start Inserting invoice

      for (j = 0; j < tempArr.length; j++) {
        let total_amount = 0.0;
        let total_discount = 0.0;
        let total_tax = 0.0;
        let items = req.body.items;
        let product_items = [];

        for (i = 0; i < tempArr[j].items.length; i++) {
          var rate = parseFloat(tempArr[j].items[i].item_rate);

          var qty = parseInt(tempArr[j].items[i].quantity);
          var tax = parseFloat(tempArr[j].items[i].tax_per);
          var discount = parseFloat(tempArr[j].items[i].dis_per);
          let temp_total = rate * qty;
          let tax_amount = 0;

          let discount_amount = 0;
          if (discount > 0) {
            discount_amount = (discount / 100) * temp_total;
          }
          if (tax > 0) {
            tax_amount = (tax / 100) * (temp_total - discount_amount);
          }

          temp_total = temp_total + tax_amount - discount_amount;
          total_amount = total_amount + temp_total;
          total_discount = total_discount + discount_amount;
          total_tax = total_tax + tax_amount;
          let temp_items = {
            invoice_master_id: "",
            item_id: tempArr[j].items[i].item_id,
            item_rate: rate,
            quantity: qty,
            tax_per: tax,
            discount_per: discount,
            total_amount: temp_total,
            status: 0,
            created_at: created_at,
            updated_at: created_at,
          };
          product_items.push(temp_items);
        }

        let inv_data = {
          customer_id: tempArr[j].customer_id,
          merchant_id: tempArr[j].merchant_id,
          sub_merchant_id: tempArr[j].sub_merchant_id,
          mode: req.body.mode,
          invoice_no: await helpers.make_order_number("INV"),
          currency: tempArr[j].currency,
          total_amount: total_amount,
          total_tax: total_tax,
          total_discount: total_discount,
          description: tempArr[j].description,
          special_note: tempArr[j].special_note,
          issue_date: tempArr[j].issue_date,
          expiry_date: tempArr[j].expiry_date,
          merchant_invoice_no: tempArr[j].merchant_invoice_no,
          payment_terms: tempArr[j].payment_terms,
          status: "Draft",
          created_by: req.user.id,
          // ip: ip,
          created_at: created_at,
          updated_at: created_at,
        };

        if (tempArr[j].sub_merchant_id) {
          let result_insert = await invModel.add_inv(inv_data);

          for (i = 0; i < product_items.length; i++) {
            product_items[i].invoice_master_id = result_insert.insertId;
          }
          let result = await invModel.add_inv_items(product_items);
        }
      }
      // Invoice Inserting End
      if (tempArr.length > 0) {
        res
          .status(statusCode.ok)
          .send(response.successmsg(j + " Invoices imported successfully."));
      } else {
        res
          .status(statusCode.ok)
          .send(response.common_error_msg("No active MID."));
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_import: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      var workbook = xlsx.readFile("public/docs/" + req.body.doc, {
        dateNF: "yyyy-mm-dd",
      });

      var worksheet = workbook.Sheets[workbook.SheetNames[0]];
      let data = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: "",
      });
      let data_filtered = [];
      let temp;
      let tempArr = [];

      for (i = 0; i < data.length; i++) {
        let mid_currency = await helpers.get_currency_id_by_name(
          data[i].Currency
        );

        var count_mid_data = 0;
        if (mid_currency) {
          count_mid_data = await invModel.get_count_mid("mid", {
            submerchant_id: req.credentials.merchant_id,
            currency_id: mid_currency,
            env: req.credentials.type,
          });
        }

        if (count_mid_data > 0) {
          data[i].merchant_id = req.credentials.super_merchant_id;
          data[i].sub_merchant_id = req.credentials.merchant_id;

          data[i].customer_id = await helpers.getCustomerID({
            submerchant_id: data[i].sub_merchant_id,
            name: data[i].Customer_Name,
            code: data[i].Customer_Phone_Code,
            mobile: data[i].Customer_Phone,
            email: data[i].Customer_email,
            merchant_id: data[i].merchant_id,
            created_at: created_at,
          });
          data[i].item_id = await helpers.getItemId({
            submerchant_id: data[i].sub_merchant_id,
            name: data[i].Item_Name,
            merchant_id: data[i].merchant_id,
            item_rate: data[i].Rate,
          });
          data_filtered.push(data[i]);

          let invoiceData = [];
          if (i == 0) {
            let invoice = {
              customer_id: data[i].customer_id,
              merchant_id: data[i].merchant_id,
              sub_merchant_id: data[i].sub_merchant_id,
              // invoice_no: await helpers.make_order_number("INV"),
              merchant_invoice_no: data[i].Invoice,
              currency: data[i].Currency,
              total_amount: 0,
              total_discount: 0,
              total_tax: 0,
              description: data[i].Description,
              special_note: data[i].Note,
              issue_date: data[i].issue_Date,
              expiry_date: data[i].expiry_Date,
              payment_terms: data[i].Payment_Terms,
              status: "Draft",
              items: [
                {
                  item_rate: data[i].Rate,
                  item_id: data[i].item_id,
                  quantity: data[i].Quantity,
                  tax_per: data[i].Tax,
                  dis_per: data[i].Discount,
                },
              ],
            };
            tempArr.push(invoice);
          } else {
            let obj = tempArr.find(
              (o) =>
                o.merchant_invoice_no === data[i].Invoice &&
                o.currency == data[i].Currency &&
                o.sub_merchant_id == data[i].sub_merchant_id &&
                o.issue_date == data[i].issue_Date &&
                o.expiry_date == data[i].expiry_Date &&
                o.description == data[i].Description &&
                o.special_note == data[i].Note &&
                o.payment_terms == data[i].Payment_Terms &&
                o.customer_id == data[i].customer_id
            );
            if (obj) {
              let item = {
                item_rate: data[i].Rate,
                item_id: data[i].item_id,
                quantity: data[i].Quantity,
                tax_per: data[i].Tax,
                dis_per: data[i].Discount,
              };
              obj.items.push(item);
            } else {
              let invoice = {
                customer_id: data[i].customer_id,
                merchant_id: data[i].merchant_id,
                sub_merchant_id: data[i].sub_merchant_id,
                // invoice_no: await helpers.make_order_number("INV"),
                merchant_invoice_no: data[i].Invoice,
                currency: data[i].Currency,
                total_amount: 0,
                total_discount: 0,
                total_tax: 0,
                description: data[i].Description,
                special_note: data[i].Note,
                issue_date: data[i].issue_Date,
                expiry_date: data[i].expiry_Date,
                payment_terms: data[i].Payment_Terms,
                status: "Draft",
                items: [
                  {
                    item_rate: data[i].Rate,
                    item_id: data[i].item_id,
                    quantity: data[i].Quantity,
                    tax_per: data[i].Tax,
                    dis_per: data[i].Discount,
                  },
                ],
              };
              tempArr.push(invoice);
            }
          }
        }
      }
      //  Start Inserting invoice
      for (j = 0; j < tempArr.length; j++) {
        let total_amount = 0.0;
        let total_discount = 0.0;
        let total_tax = 0.0;
        let items = req.body.items;
        let product_items = [];

        for (i = 0; i < tempArr[j].items.length; i++) {
          var rate = parseFloat(tempArr[j].items[i].item_rate);

          var qty = parseInt(tempArr[j].items[i].quantity);
          var tax = parseFloat(tempArr[j].items[i].tax_per);
          var discount = parseFloat(tempArr[j].items[i].dis_per);
          let temp_total = rate * qty;
          let tax_amount = 0;

          let discount_amount = 0;
          if (discount > 0) {
            discount_amount = (discount / 100) * temp_total;
          }
          if (tax > 0) {
            tax_amount = (tax / 100) * (temp_total - discount_amount);
          }

          temp_total = temp_total + tax_amount - discount_amount;
          total_amount = total_amount + temp_total;
          total_discount = total_discount + discount_amount;
          total_tax = total_tax + tax_amount;
          let temp_items = {
            invoice_master_id: "",
            item_id: tempArr[j].items[i].item_id,
            item_rate: rate,
            quantity: qty,
            tax_per: tax,
            discount_per: discount,
            total_amount: temp_total,
            status: 0,
            created_at: created_at,
            updated_at: created_at,
          };
          product_items.push(temp_items);
        }

        let inv_data = {
          customer_id: tempArr[j].customer_id,
          merchant_id: tempArr[j].merchant_id,
          sub_merchant_id: tempArr[j].sub_merchant_id,
          invoice_no: await helpers.make_order_number("INV"),
          currency: tempArr[j].currency,
          total_amount: total_amount,
          total_tax: total_tax,
          total_discount: total_discount,
          description: tempArr[j].description,
          special_note: tempArr[j].special_note,
          issue_date: tempArr[j].issue_date,
          expiry_date: tempArr[j].expiry_date,
          merchant_invoice_no: tempArr[j].merchant_invoice_no,
          payment_terms: tempArr[j].payment_terms,
          status: "Draft",
          created_by: req.credentials.super_merchant_id,
          mode: req.credentials.type,
          created_at: created_at,
          updated_at: created_at,
        };

        if (tempArr[j].sub_merchant_id) {
          let result_insert = await invModel.add_inv(inv_data);

          for (i = 0; i < product_items.length; i++) {
            product_items[i].invoice_master_id = result_insert.insertId;
          }
          let result = await invModel.add_inv_items(product_items);
        }
      }

      // Invoice Inserting End
      if (tempArr.length > 0) {
        res
          .status(statusCode.ok)
          .send(response.successmsg(j + " Invoices imported successfully."));
      } else {
        res
          .status(statusCode.ok)
          .send(response.common_error_msg("No active MID."));
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_item_add: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      var insdata = {
        item_name: req.bodyString("item_name"),
        item_rate: req.bodyString("item_rate_per_unit"),
        submerchant_id: req.credentials.merchant_id,
        item_description: req.bodyString("item_description"),
        status: 0,
        merchant_id: req.credentials.super_merchant_id,
        created_at: created_at,
        updated_at: created_at,
      };
      let ins_id = await invModel.item_master_add(insdata);
      let de_qr_id = helpers.formatNumber(ins_id.insertId);

      res.status(statusCode.ok).send(
        response.successdatamsg(
          {
            item_id: de_qr_id,
            data_id: enc_dec.cjs_encrypt(ins_id.insertId),
          },
          "Item added successfully"
        )
      );
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_item_list: async (req, res) => {
    let condition = { is_deleted: 0 };

    condition.merchant_id = req.credentials.super_merchant_id;
    condition.submerchant_id = req.credentials.merchant_id;

    if (req.queryString("submerchant_id")) {
      condition.submerchant_id = req.credentials.merchant_id;
    }
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

    if (req.queryString("status") == "Active") {
      condition.status = 0;
    } else if (req.queryString("status") == 1) {
      condition.status = 1;
    }

    invModel
      .item_master_list(limit, condition)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let de_qr_id = helpers.formatNumber(val.id);

          let res = {
            item_id: de_qr_id,
            data_id: enc_dec.cjs_encrypt(val.id),
            item_rate: val.item_rate,
            item_name: val.item_name,
            item_description: val.item_description,
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
            status: val.status == 0 ? "Active" : "Deactivated",
            item_no: await helpers.formatNumberEight(val.id),
            created_date: await date_formatter.get_date_time(val.created_at),
            last_modified_date:
              (await date_formatter.insert_date(val.updated_at)) == "1970-01-01"
                ? "-"
                : await date_formatter.get_date_time(val.updated_at),
          };
          send_res.push(res);
        }

        let total_count = await invModel.item_master_count(condition);
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
  open_item_details: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.queryString("data_id"));
    invModel
      .selectOneItem({ id: item_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let de_qr_id = helpers.formatNumber(val.id);

        let res1 = {
          item_id: de_qr_id,
          data_id: enc_dec.cjs_encrypt(val.id),
          item_name: val.item_name,
          item_rate: val.item_rate,
          item_description: val.item_description,
          submerchant_name: val?.submerchant_id
            ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
            : "",
          status: val.status == 1 ? "Deactivated" : "Active",
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
  open_item_update: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let item_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let update_data = {
      item_name: req.bodyString("item_name"),
      item_rate: req.bodyString("item_rate_per_unit"),
      submerchant_id: req.credentials.merchant_id,
      item_description: req.bodyString("item_description"),
      status: 0,
      merchant_id: req.credentials.super_merchant_id,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item updated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_item_activate: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("item_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      status: 0,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item activated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_item_deactivate: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      status: 1,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item deactivated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_item_delete: async (req, res) => {
    let item_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let added_date = await date_formatter.created_date_time();
    let update_data = {
      is_deleted: 1,
      updated_at: added_date,
    };
    invModel
      .itemMasterUpdate(update_data, { id: item_id })
      .then((req) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Item deleted successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_add_customer: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let ip = await helpers.get_ip(req);
    let customer_details = req.body.customer_details;
    let billing_details = req.body.billing_details;
    let shipping_details = req.body.shipping_details;

    let bill_country = await helpers.get_country_id_by_iso(
      billing_details.country
    );
    let ship_country = await helpers.get_country_id_by_iso(
      shipping_details.country
    );
    let bill_state = await helpers.find_state_id_by_name(
      billing_details.state,
      billing_details.country
    );
    let ship_state = await helpers.find_state_id_by_name(
      shipping_details.state,
      shipping_details.country
    );
    let bill_city = await helpers.find_city_id_by_name(
      billing_details.city,
      billing_details.country,
      bill_state
    );
    let ship_city = await helpers.find_city_id_by_name(
      shipping_details.city,
      shipping_details.country,
      ship_state
    );
    let cust_data = {
      merchant_id: req.credentials.super_merchant_id,
      prefix: customer_details.name_prefix,
      name: customer_details.name,
      code: customer_details.code,
      mobile: customer_details.mobile,
      email: customer_details.email,
      shipping_address: shipping_details.same_as_billing_address,
      ship_address:
        shipping_details.same_as_billing_address == "no"
          ? shipping_details.address
          : billing_details.address,
      ship_country:
        shipping_details.same_as_billing_address == "no"
          ? ship_country
          : bill_country,
      ship_state:
        shipping_details.same_as_billing_address == "no"
          ? ship_state
          : bill_state,
      ship_city:
        shipping_details.same_as_billing_address == "no"
          ? ship_city
          : bill_city,
      ship_zip_code:
        shipping_details.same_as_billing_address == "no"
          ? shipping_details.zip_code
          : billing_details.zip_code,
      bill_address: billing_details.address,
      bill_country: bill_country,
      bill_state: bill_state,
      bill_city: bill_city,
      bill_zip_code: billing_details.zip_code ? billing_details.zip_code : "",
      added_by: req.credentials.super_merchant_id,
      ip: ip,
      created_at: added_date,
      submerchant_id: req.credentials.merchant_id,
    };

    invModel
      .add(cust_data)
      .then(async (result) => {
        let de_qr_id = helpers.formatNumber(result.insertId);

        res.status(statusCode.ok).send(
          response.successdatamsg(
            {
              customer_id: de_qr_id,
              data_id: enc_dec.cjs_encrypt(result.insertId),
            },
            "Client Added successfully."
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
  open_customer_details: async (req, res) => {
    let customer_id = await enc_dec.cjs_decrypt(req.queryString("data_id"));
    invModel
      .selectOne({ id: customer_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let de_qr_id = helpers.formatNumber(val.id);

        let res1 = {
          customer_details: {
            customer_id: de_qr_id,
            data_id: enc_dec.cjs_encrypt(val.id),
            name_prefix: val.prefix,
            name: val.name,
            email: val.email,
            code: val.code,
            mobile: val.mobile,
          },
          billing_details: {
            address: val.bill_address,
            country: await helpers.get_country_iso2_by_id(val.bill_country),
            state: await helpers.get_state_name_by_id(val.bill_state),
            city: await helpers.get_city_name_by_id(val.bill_city),
            zip_code: val.bill_zip_code,
          },
          shipping_details: {
            same_as_billing_address: val.shipping_address,
            address: val.ship_address,
            country: await helpers.get_country_iso2_by_id(val.ship_country),
            state: await helpers.get_state_name_by_id(val.ship_state),
            city: await helpers.get_city_name_by_id(val.ship_city),
            zip_code: val.ship_zip_code,
          },

          status: val.status == 1 ? "Deactivated" : "Active",
          submerchant_name: val?.submerchant_id
            ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
            : "",
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
  open_update_customer: async (req, res) => {
    let customer_id = await enc_dec.cjs_decrypt(
      req.body.customer_details.data_id
    );
    let ip = await helpers.get_ip(req);
    let customer_details = req.body.customer_details;
    let billing_details = req.body.billing_details;
    let shipping_details = req.body.shipping_details;

    let bill_country = await helpers.get_country_id_by_iso(
      billing_details.country
    );
    let ship_country = await helpers.get_country_id_by_iso(
      shipping_details.country
    );
    let bill_state = await helpers.find_state_id_by_name(
      billing_details.state,
      billing_details.country
    );
    let ship_state = await helpers.find_state_id_by_name(
      shipping_details.state,
      shipping_details.country
    );
    let bill_city = await helpers.find_city_id_by_name(
      billing_details.city,
      billing_details.country,
      bill_state
    );
    let ship_city = await helpers.find_city_id_by_name(
      shipping_details.city,
      shipping_details.country,
      ship_state
    );
    let cust_data = {
      merchant_id: req.credentials.super_merchant_id,
      prefix: customer_details.name_prefix,
      name: customer_details.name,
      code: customer_details.code,
      mobile: customer_details.mobile,
      email: customer_details.email,
      shipping_address: shipping_details.same_as_billing_address,
      ship_address:
        shipping_details.same_as_billing_address == "no"
          ? shipping_details.address
          : billing_details.address,
      ship_country:
        shipping_details.same_as_billing_address == "no"
          ? ship_country
          : bill_country,
      ship_state:
        shipping_details.same_as_billing_address == "no"
          ? ship_state
          : bill_state,
      ship_city:
        shipping_details.same_as_billing_address == "no"
          ? ship_city
          : bill_city,
      ship_zip_code:
        shipping_details.same_as_billing_address == "no"
          ? shipping_details.zip_code
          : billing_details.zip_code,
      bill_address: billing_details.address,
      bill_country: bill_country,
      bill_state: bill_state,
      bill_city: bill_city,
      bill_zip_code: billing_details.zip_code ? billing_details.zip_code : "",
      added_by: req.credentials.super_merchant_id,
      ip: ip,
      submerchant_id: req.credentials.merchant_id,
    };

    invModel
      .updateDetails({ id: customer_id }, cust_data)
      .then(async (result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Client updated successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_customer_deactivate: async (req, res) => {
    try {
      let customer_id = await enc_dec.cjs_decrypt(req.bodyString("data_id"));
      var insdata = {
        status: 1,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client deactivated successfully"));
    } catch {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_customer_activate: async (req, res) => {
    try {
      let customer_id = await enc_dec.cjs_decrypt(req.bodyString("data_id"));
      var insdata = {
        status: 0,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client activated successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_customer_delete: async (req, res) => {
    try {
      let customer_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await invModel.updateDetails({ id: customer_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Client deleted successfully"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_list_customer: async (req, res) => {
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

    let and_filter_obj = {};
    and_filter_obj.deleted = 0;
    let date_condition = {};
    let merchant;

    merchant = req.credentials.super_merchant_id;
    if (merchant) {
      and_filter_obj.merchant_id = merchant;
      and_filter_obj.submerchant_id = req.credentials.merchant_id;
    }

    if (req.queryString("data_id")) {
      and_filter_obj.id = parseInt(req.queryString("data_id"), 10);
    }

    if (req.queryString("billing_country")) {
      and_filter_obj.bill_country = await helpers.get_country_id_by_iso(
        req.queryString("billing_country")
      );
    }

    let like_search = {};

    if (req.queryString("name_or_email_mobile")) {
      like_search.email = req.queryString("name_or_email_mobile");
      like_search.name = req.queryString("name_or_email_mobile");
      like_search.mobile = req.queryString("name_or_email_mobile");
    }

    if (req.queryString("from_date")) {
      date_condition.from_date = req.queryString("from_date");
    }

    if (req.queryString("to_date")) {
      date_condition.to_date = req.queryString("to_date");
    }

    if (req.queryString("status")) {
      and_filter_obj.status = req.queryString("status") == "Active" ? 0 : 1;
    }

    invModel
      .selectCustomer(and_filter_obj, limit, date_condition, like_search)
      .then(async (result) => {
        let send_res = [];

        for (let val of result) {
          let first_txn_date = await invModel.select_open_txn_date(
            val.id,
            "asc",
            req.credentials.type
          );
          let last_txn_date = await invModel.select_open_txn_date(
            val.id,
            "desc",
            req.credentials.type
          );

          let de_qr_id = helpers.formatNumber(val.id);
          let res = {
            customer_details: {
              customer_id: de_qr_id,
              data_id: enc_dec.cjs_encrypt(val.id),
              de_customer_id: val?.id
                ? await helpers.formatNumber(val?.id)
                : "",
              name_prefix: val.prefix,
              name: val.name,
              email: val.email,
              mobile: "+" + val.code + " " + val.mobile,
            },
            billing_details: {
              address: val.bill_address,
              country: await helpers.get_country_iso2_by_id(val.bill_country),
              state: await helpers.get_state_name_by_id(val.bill_state),
              city: await helpers.get_city_name_by_id(val.bill_city),
              zip_code: val.bill_zip_code,
            },
            shipping_details: {
              same_as_billing_address: val.shipping_address,
              address: val.ship_address,
              country: await helpers.get_country_iso2_by_id(val.ship_country),
              state: await helpers.get_state_name_by_id(val.ship_state),
              city: await helpers.get_city_name_by_id(val.ship_city),
              zip_code: val.ship_zip_code,
            },

            status: val.status === 1 ? "Deactivated" : "Active",
            created_date: await date_formatter.get_date_time(val.created_at),
            first_txn_date: first_txn_date,
            last_txn_date: last_txn_date,
            submerchant_name: val?.submerchant_id
              ? await helpers.get_submerchant_name_by_id(val?.submerchant_id)
              : "",
          };
          send_res.push(res);
        }
        total_count = await invModel.get_count_cust(
          and_filter_obj,
          date_condition,
          like_search
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
  open_invoice_add: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      let ip = await helpers.get_ip(req);

      let data = req.body.data;
      var inv_ids = [];
      let tempArr = 0;
      for (j = 0; j < data.length; j++) {
        let customer_id_exist = await invModel.get_count_cust(
          {
            id: enc_dec.cjs_decrypt(data[j].customer_id),
            submerchant_id: req.credentials.merchant_id,
            deleted: 0,
            status: 0,
          },
          [],
          []
        );
        let mid_currency = await helpers.get_currency_id_by_name(
          data[j].currency
        );
        count_mid_data = await invModel.get_count_mid("mid", {
          submerchant_id: req.credentials.merchant_id,
          currency_id: mid_currency,
          env: req.credentials.type,
          deleted: 0,
          status: 0,
        });
        if (customer_id_exist > 0 && count_mid_data > 0) {
          let items = req.body.data[j].item_data;
          let product_items = [];
          var total_amount = 0.0;
          var total_discount = 0.0;
          var total_tax = 0.0;
          for (i = 0; i < items.length; i++) {
            let item_id_exist = await invModel.item_master_count({
              id: enc_dec.cjs_decrypt(items[i].item_id),
              submerchant_id: req.credentials.merchant_id,
              is_deleted: 0,
              status: 0,
            });
            if (item_id_exist > 0) {
              var rate = parseFloat(items[i].rate);
              var qty = parseFloat(items[i].quantity);
              var tax = parseFloat(items[i].tax);
              var discount = parseFloat(items[i].discount);
              let temp_total = rate * qty;
              let tax_amount = 0;
              let discount_amount = 0;
              if (discount > 0) {
                discount_amount = (discount / 100) * temp_total;
              }
              if (tax > 0) {
                tax_amount = (tax / 100) * (temp_total - discount_amount);
              }

              temp_total = temp_total + tax_amount - discount_amount;
              total_amount = total_amount + temp_total;
              total_discount = total_discount + discount_amount;
              total_tax = total_tax + tax_amount;
              let temp_items = {
                invoice_master_id: "",
                item_id: enc_dec.cjs_decrypt(items[i].item_id),
                item_rate: rate,
                quantity: qty,
                tax_per: tax,
                discount_per: discount,
                total_amount: temp_total,
                added_by: req.credentials.super_merchant_id,
                ip: ip,
                status: 0,
                created_at: created_at,
                updated_at: created_at,
              };
              product_items.push(temp_items);
            }
          }
          if (product_items.length > 0) {
            let inv_data = {
              customer_id: enc_dec.cjs_decrypt(data[j].customer_id),
              merchant_id: req.credentials.super_merchant_id,
              sub_merchant_id: req.credentials.merchant_id,
              invoice_no: await helpers.make_order_number("INV"),
              currency: data[j].currency,
              merchant_full_name: await helpers.getInvCustomerName(
                enc_dec.cjs_decrypt(data[j].customer_id)
              ),
              total_amount: total_amount,
              total_tax: total_tax,
              total_discount: total_discount,
              description: data[j].description,
              special_note: data[j].note,
              issue_date: data[j].issue_date,
              expiry_date: data[j].expiry_date,
              merchant_invoice_no: data[j].merchant_invoice_no,
              payment_terms: data[j].payment_terms,
              status: "Draft",
              added_by: req.credentials.super_merchant_id,
              ip: ip,
              created_at: created_at,
              updated_at: created_at,
              created_by: req.credentials.super_merchant_id,
              mode: req.credentials.type,
            };
            if (total_amount > 0) {
              let result = await invModel.add_inv(inv_data);
              if (result) {
                for (i = 0; i < product_items.length; i++) {
                  product_items[i].invoice_master_id = result.insertId;
                }

                invModel
                  .add_inv_items(product_items)
                  .then(async (result_meta) => {});
                let de_qr_id = helpers.formatNumber(result.insertId);
                inv_ids.push({
                  invoice_id: de_qr_id,
                  data_id: enc_dec.cjs_encrypt(result.insertId),
                });
                tempArr++;
              }
            }
          }
        }
      }

      if (tempArr > 0) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              inv_ids,
              tempArr + " Invoices added successfully."
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(
            response.common_error_msg("Total amount should be greater than 0.")
          );
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
  },

  open_invoice_list: async (req, res) => {
    let today = await date_formatter.current_date();

    const db_table = config.table_prefix + "inv_customer";
    const inv_table = config.table_prefix + "inv_invoice_master";
    // const merchant_name = await qrGenerateModule.getMerchantName();
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

    let and_filter_obj = {};
    and_filter_obj[`${inv_table}.deleted`] = 0;
    let date_condition = {};
    let expiry_date = {};
    merchant = req.credentials.super_merchant_id;
    and_filter_obj.sub_merchant_id = req.credentials.merchant_id;

    if (merchant) {
      and_filter_obj[`${inv_table}.merchant_id`] = merchant;
    }

    if (req.queryString("customer_id")) {
      and_filter_obj.customer_id = enc_dec.cjs_decrypt(
        req.queryString("customer_id")
      );
    }
    if (req.queryString("invoice_no")) {
      and_filter_obj.invoice_no = req.queryString("invoice_no");
    }
    if (req.queryString("currency")) {
      and_filter_obj.currency = req.queryString("currency");
    }
    and_filter_obj.mode = req.credentials.type;
    let like_search = {};

    if (req.queryString("email")) {
      like_search[`${db_table}.email`] = req.queryString("email");
    }
    if (req.queryString("mobile")) {
      like_search[`${db_table}.mobile`] = req.queryString("mobile");
    }

    if (req.queryString("expiry_from_date")) {
      date_condition.from_date = req.queryString("expiry_from_date");
    }

    if (req.queryString("expiry_to_date")) {
      date_condition.to_date = req.queryString("expiry_to_date");
    }
    if (req.queryString("status")) {
      if (
        req.queryString("status") == "Draft" ||
        req.queryString("status") == "Pending"
      ) {
        expiry_date = ">=" + `'${today}'`;
        and_filter_obj[`${inv_table}.status`] = req.queryString("status");
      } else if (req.queryString("status") == "Expired") {
        expiry_date =
          "<" +
          `'${today}'` +
          " and ( " +
          `${inv_table}` +
          '.status="Draft" or ' +
          `${inv_table}` +
          '.status="Pending" )';
      } else {
        and_filter_obj[`${inv_table}.status`] = req.queryString("status");
      }
    }

    invModel
      .selectInv(
        and_filter_obj,
        limit,
        date_condition,
        like_search,
        expiry_date
      )
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let invoice_items = await invModel.getInvoiceItems(val.id);
          subtotal = 0.0;

          for (i = 0; i < invoice_items.length; i++) {
            // subtotal
            subtotal += invoice_items[i].item_rate * invoice_items[i].quantity;
            // total_amt
            var total_amt =
              invoice_items[i].item_rate * invoice_items[i].quantity;
            // discount amt
            var dis_amt = (invoice_items[i].discount_per / 100) * total_amt;
            // tax amt
            var tax_amt =
              (invoice_items[i].tax_per / 100) * (total_amt - dis_amt);
            invoice_items[i].item_id = enc_dec.cjs_encrypt(
              invoice_items[i].item_id
            );
            invoice_items[i].rate = invoice_items[i].item_rate.toFixed(2);
            invoice_items[i].discount =
              invoice_items[i].discount_per.toFixed(2);
            invoice_items[i].tax = invoice_items[i].tax_per.toFixed(2);
            invoice_items[i].total_amount =
              invoice_items[i].total_amount.toFixed(2);
            invoice_items[i].discount_amt = dis_amt
              ? dis_amt.toFixed(2)
              : "0.00";
            invoice_items[i].tax_amt = tax_amt ? tax_amt.toFixed(2) : "0.00";
          }

          let de_qr_id = helpers.formatNumber(val.id);
          let res = {
            invoice_id: de_qr_id,
            data_id: enc_dec.cjs_encrypt(val.id),
            de_customer_id: val?.customer_id
              ? await helpers.formatNumber(val?.customer_id)
              : "",
            customer_id: enc_dec.cjs_encrypt(val.customer_id),
            customer_country: await helpers.get_country_code_by_id(
              val.bill_country
            ),

            customer_name: val?.name ? val?.prefix + " " + val?.name : "",
            customer_email: val?.email ? val?.email : "",
            customer_code: val?.code ? val?.code : "",
            customer_mobile: val?.mobile ? val?.mobile : "",
            order_id: val.order_id,

            sub_merchant_name: await helpers.get_sub_merchant_name_by_id(
              val.sub_merchant_id
            ),
            merchant_name: await helpers.get_super_merchant_name(
              val.merchant_id
            ),
            invoice_no: val.invoice_no,
            merchant_invoice_no: val.merchant_invoice_no,
            issue_date: await date_formatter.get_date(val.issue_date),
            expiry_date: await date_formatter.get_date(val.expiry_date),
            created_date: await date_formatter.get_date_time(val.created_at),
            last_modified_date: await date_formatter.get_date_time(
              val.updated_at
            ),
            currency: val.currency,
            // actual_status: val.status,
            payment_status: val.order_id
              ? await helpers.get_invoice_status_by_order(
                  val.order_id,
                  req.credentials.type
                )
              : "Unpaid",
            status:
              (await date_formatter.insert_date(val.expiry_date)) >= today ||
              val.status == "Closed"
                ? val.status
                : "Expired",

            deleted: val.deleted === 1 ? "Deleted" : "Not Deleted",
            items: invoice_items,

            item_subtotal: subtotal.toFixed(2),
            item_total_tax: val.total_tax ? val.total_tax.toFixed(2) : 0,
            item_total_discount: val.total_discount
              ? val.total_discount.toFixed(2)
              : 0,
            item_total_amount: val.total_amount
              ? val.total_amount.toFixed(2)
              : 0,
          };

          send_res.push(res);
        }
        let total_count = await invModel.get_countInv(
          and_filter_obj,
          date_condition,
          like_search,
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
  open_cancel_invoice: async (req, res) => {
    let created_at = await date_formatter.created_date_time();
    let updateData = {
      status: "Cancelled",
      updated_at: created_at,
    };
    invModel
      .updateDetailsInv(
        { id: enc_dec.cjs_decrypt(req.body.data_id) },
        updateData
      )
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Invoice cancelled successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_invoice_delete: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
    let update_data = { deleted: 1 };
    invModel
      .updateDetailsInv({ id: id }, update_data)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Invoice deleted successfully."));
      })
      .catch((error) => {
        logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_invoice_update: async (req, res) => {
    try {
      let created_at = await date_formatter.created_date_time();
      let ip = await helpers.get_ip(req);
      let total_amount = 0.0;
      let total_discount = 0.0;
      let total_tax = 0.0;
      let items = req.body.item_data;
      let product_items = [];
      let invoice_id = enc_dec.cjs_decrypt(req.bodyString("data_id"));
      for (i = 0; i < items.length; i++) {
        let item_id_exist = await invModel.item_master_count({
          id: enc_dec.cjs_decrypt(items[i].item_id),
          submerchant_id: req.credentials.merchant_id,
          is_deleted: 0,
          status: 0,
        });
        if (item_id_exist > 0) {
          var rate = parseFloat(items[i].rate);
          var qty = parseFloat(items[i].quantity);
          var tax = parseFloat(items[i].tax);
          var discount = parseFloat(items[i].discount);
          let temp_total = rate * qty;
          let tax_amount = 0;
          let discount_amount = 0;
          if (discount > 0) {
            discount_amount = (discount / 100) * temp_total;
          }
          if (tax > 0) {
            tax_amount = (tax / 100) * (temp_total - discount_amount);
          }

          temp_total = temp_total + tax_amount - discount_amount;
          total_amount = total_amount + temp_total;
          total_discount = total_discount + discount_amount;
          total_tax = total_tax + tax_amount;
          let temp_items = {
            invoice_master_id: invoice_id,
            item_id: enc_dec.cjs_decrypt(items[i].item_id),
            item_rate: rate,
            quantity: qty,
            tax_per: tax,
            discount_per: discount,
            total_amount: temp_total,
            added_by: req.credentials.super_merchant_id,
            ip: ip,
            status: 0,
            updated_at: created_at,
          };
          product_items.push(temp_items);
        }
      }
      if (total_amount > 0) {
        let inv_data = {
          customer_id: enc_dec.cjs_decrypt(req.bodyString("customer_id")),
          merchant_id: req.credentials.super_merchant_id,
          sub_merchant_id: req.credentials.merchant_id,
          // invoice_no: await helpers.make_order_number("INV"),
          currency: req.bodyString("currency"),
          merchant_full_name: await helpers.getInvCustomerName(
            enc_dec.cjs_decrypt(req.bodyString("customer_id"))
          ),
          total_amount: total_amount,
          total_tax: total_tax,
          total_discount: total_discount,
          description: req.bodyString("description"),
          special_note: req.bodyString("note"),
          issue_date: req.bodyString("issue_date"),
          expiry_date: req.bodyString("expiry_date"),
          merchant_invoice_no: req.bodyString("merchant_invoice_no"),
          payment_terms: req.bodyString("payment_terms"),
          status: "Draft",
          added_by: req.credentials.super_merchant_id,
          ip: ip,
          updated_at: created_at,
        };

        invModel
          .updateDetailsInv({ id: invoice_id }, inv_data)
          .then(async (result) => {
            await invModel.removeItemsOfInvoice(invoice_id);
            invModel
              .add_inv_items(product_items)
              .then((result_meta) => {
                res.status(statusCode.ok).send(
                  response.successdatamsg(
                    {
                      invoice_id: enc_dec.cjs_encrypt(invoice_id),
                    },
                    "Invoice updated successfully."
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
      } else {
        res
          .status(statusCode.badRequest)
          .send(
            response.common_error_msg("Total amount should be greater than 0.")
          );
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_invoice_details: async (req, res) => {
    let today = await date_formatter.current_date();
    let invoice_id = enc_dec.cjs_decrypt(req.queryString("data_id"));
    invModel
      .selectOneInv({ id: invoice_id })
      .then(async (result) => {
        let merchant_details = await invModel.getMerchantDetails({
          merchant_id: result.sub_merchant_id,
        });
        let payment_list = await invModel.list_of_payment(
          {
            ["o.order_id"]: result.order_id,
          },
          req.credentials.type
        );

        merchant_details.logo = merchant_details.icon
          ? process.env.STATIC_URL + "/static/files/" + merchant_details.icon
          : "";
        let send_res = [];
        var subtotal = 0.0;
        let val = result;
        let qr_code = await QRCode.toDataURL(
          process.env.FRONTEND_URL_MERCHANT +
            "pay/" +
            req.bodyString("invoice_id")
        );
        let sharing_history = await helpers.invoice_shared(val.id, "response");
        let de_qr_id = helpers.formatNumber(val.id);

        let res1 = {
          invoice_id: de_qr_id,
          data_id: enc_dec.cjs_encrypt(val.id),
          customer_id: enc_dec.cjs_encrypt(val.customer_id),
          invoice_no: val?.invoice_no ? val?.invoice_no : "",
          merchant_invoice_no: val?.merchant_invoice_no
            ? val?.merchant_invoice_no
            : "",
          issue_date:
            val.issue_date != "1970-01-01" && val.issue_date != "0000-00-00"
              ? await date_formatter.get_date(val.issue_date)
              : "",
          expiry_date:
            val.expiry_date != "1970-01-01" && val.expiry_date != "0000-00-00"
              ? await date_formatter.get_date(val.expiry_date)
              : "",
          currency: val?.currency ? val?.currency : "",
          description: val?.description ? val?.description : "",
          note: val?.special_note ? val?.special_note : "",
          payment_terms: val?.payment_terms ? val?.payment_terms : "",
          status: val?.status ? val?.status : "",
          customer_name: val?.name ? val?.prefix + " " + val?.name : "",
          customer_email: val?.email ? val?.email : "",
          customer_mobile: val?.mobile ? val?.mobile : "",
          customer_code: val?.code ? val?.code : "",
          customer_shipping_address: {
            address: val.ship_address,
            city: await helpers.get_city_name_by_id(val.ship_city),
            state: await helpers.get_state_name_by_id(val.ship_state),
            country: await helpers.get_country_name_by_id(val.ship_country),
            zip_code: val?.ship_zip_code ? val?.ship_zip_code : "",
          },
          customer_billing_address: {
            address: val.bill_address,
            city: await helpers.get_city_name_by_id(val.bill_city),
            state: await helpers.get_state_name_by_id(val.bill_state),
            country: await helpers.get_country_name_by_id(val.bill_country),
            zip_code: val?.bill_zip_code ? val?.bill_zip_code : "",
          },
          payment_status: val.order_id
            ? await helpers.get_invoice_status_by_order(
                val.order_id,
                req.credentials.type
              )
            : "Unpaid",
          // actual_status: val.status,
          status:
            (await date_formatter.insert_date(val.expiry_date)) >= today ||
            val.status == "Closed"
              ? val.status
              : "Expired",
          qr_code: qr_code,
          sharing_history: sharing_history,
          payment_link:
            process.env.FRONTEND_URL_MERCHANT +
            "pay/" +
            req.bodyString("invoice_id"),
          payment_list: payment_list,
        };
        send_res = res1;

        let invoice_items = await invModel.getInvoiceItems(invoice_id);
        for (i = 0; i < invoice_items.length; i++) {
          // subtotal
          subtotal += invoice_items[i].item_rate * invoice_items[i].quantity;
          // total_amt
          var total_amt =
            invoice_items[i].item_rate * invoice_items[i].quantity;
          // discount amt
          var dis_amt = (invoice_items[i].discount_per / 100) * total_amt;
          // tax amt
          var tax_amt =
            (invoice_items[i].tax_per / 100) * (total_amt - dis_amt);
          invoice_items[i].item_id = enc_dec.cjs_encrypt(
            invoice_items[i].item_id
          );
          invoice_items[i].rate = invoice_items[i].item_rate.toFixed(2);
          invoice_items[i].discount = invoice_items[i].discount_per.toFixed(2);
          invoice_items[i].tax = invoice_items[i].tax_per.toFixed(2);
          invoice_items[i].total_amount =
            invoice_items[i].total_amount.toFixed(2);
          invoice_items[i].discount_amt = dis_amt ? dis_amt.toFixed(2) : "0.00";
          invoice_items[i].tax_amt = tax_amt ? tax_amt.toFixed(2) : "0.00";
        }

        let inv_response = {
          merchant_details: merchant_details,
          invoice_details: res1,
          invoice_items: invoice_items,
          item_subtotal_amount: subtotal.toFixed(2),
          item_discount_amount: val.total_discount.toFixed(2),
          item_tax_amount: val.total_tax.toFixed(2),
          item_total_amount: val.total_amount.toFixed(2),
        };

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              inv_response,
              "Details fetched successfully."
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
};

module.exports = inv;
