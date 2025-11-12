const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const maintenanceModule = require("../models/charges_transaction_setup_Module");
const enc_dec = require("../utilities/decryptor/decryptor");
const submerchantModel = require("../models/submerchantmodel");
const { encrypt_mobile_no_and_code } = require("./auth");
require("dotenv").config({ path: "../.env" });
const moment = require("moment");
const winston = require("../utilities/logmanager/winston");

const transaction = {
  transaction_add: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    // let charges_type = req.bodyString("charges_type");
    const resp = [];
    const respo = [];
    let document = req.body.buy_sell;
    let sell = req.body.sell;
    let mcc = req.bodyString("mcc");
    let textParts = mcc.split(",");
    let textParts1;
    let encryptedText = "";
    let mcc_id;
    for (let i = 0; i < textParts.length; i++) {
      textParts1 = await enc_dec.cjs_decrypt(textParts[i]);
      encryptedText += textParts1 + ",";
    }
    let transaction_data = {
      plan_name: req.bodyString("plan_name"),
      psp: await enc_dec.cjs_decrypt(req.bodyString("psp")),
      mcc: encryptedText,
      currency: req.bodyString("currency"),
      payment_mode: req.bodyString("payment_mode"),
      card_scheme: req.bodyString("card_scheme"),
      international_transaction_volume: req.bodyString(
        "max_international_transaction_volume"
      ),
      mcp_fee: req.bodyString("mcp_activation_fee"),
      mid_setup_fee: req.bodyString("mid_setup_fee"),
      mid_annual_fee: req.bodyString("mid_annual_fee"),
      per_tr_val_fraud: req.bodyString("per_of_tr_val_fraud"),
      fixed_amount_fraud: req.bodyString("fixed_amount_fraud"),
      fraud_engine:
        parseFloat(req.bodyString("per_of_tr_val_fraud")) +
        parseFloat(req.bodyString("fixed_amount_fraud")),
      per_tr_val_refund: req.bodyString("per_of_tr_val_refund"),
      fixed_amount_refund: req.bodyString("fixed_amount_refund"),
      refund_fee:
        parseFloat(req.bodyString("per_of_tr_val_refund")) +
        parseFloat(req.bodyString("fixed_amount_refund")),
      per_tr_val_processing: req.bodyString("per_of_tr_val_processing"),
      fixed_amount_processing: req.bodyString("fixed_amount_processing"),
      chargeback_processing_fee:
        parseFloat(req.bodyString("per_of_tr_val_processing")) +
        parseFloat(req.bodyString("fixed_amount_processing")),
      monthly_tpv: req.bodyString("monthly_tpv"),
      monthly_margin: req.bodyString("monthly_margin"),
      onboarding_fee: req.bodyString("onboarding_fee"),
      charges_type: req.bodyString("charges_type"),
      // transaction_type: req.bodyString("transaction_type"),
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      added_date: register_at,
      status: 0,
      added_by: req.user.id,
    };
    maintenanceModule
      .register(transaction_data)
      .then(async (result) => {
        let result_type = await maintenanceModule.selectOne({
          id: result.insertId,
        });
        let type = result_type.charges_type;
        let resp = [];
        let resp1 = [];
        let rtl = [];
        if (type == "Slab" || type == "volume_Base") {
          let slab_data;
          let sell_data;
          for (i = 0; i < document.length; i++) {
            slab_data = {
              transaction_setup_id: result.insertId,
              transaction_type: document[i].transaction_type,
              buy_from_amount: document[i].buy_from_amount,
              buy_to_amount: document[i].buy_to_amount,
              buy_per_charges: document[i].buy_per_charges,
              buy_fix_amount: document[i].buy_fix_amount,
              buy_min_charge_amount: document[i].buy_min_charge_amount,
              buy_max_charge_amount: document[i].buy_max_charge_amount,
              buy_tax: document[i].buy_tax,

              sell_from_amount: document[i].sell_from_amount,
              sell_to_amount: document[i].sell_to_amount,
              sell_per_charges: document[i].sell_per_charges,
              sell_fixed_amount: document[i].sell_fixed_amount,
              sell_min_charge_amount: document[i].sell_min_charge_amount,
              sell_max_charge_amount: document[i].sell_max_charge_amount,
              sell_tax: document[i].sell_tax,
            };
            resp.push(slab_data);
          }

          await maintenanceModule.add_slab(resp);
        } else if (result_type.charges_type == "Flat") {
          let slab_data;
          for (i = 0; i < document.length; i++) {
            slab_data = {
              transaction_setup_id: result.insertId,
              transaction_type: document[i].transaction_type,
              buy_per_charges: document[i].buy_per_charges,
              buy_fix_amount: document[i].buy_fix_amount,
              buy_min_charge_amount: document[i].buy_min_charge_amount,
              buy_max_charge_amount: document[i].buy_max_charge_amount,
              buy_tax: document[i].buy_tax,

              sell_per_charges: document[i].sell_per_charges,
              sell_fixed_amount: document[i].sell_fixed_amount,
              sell_min_charge_amount: document[i].sell_min_charge_amount,
              sell_max_charge_amount: document[i].sell_max_charge_amount,
              sell_tax: document[i].sell_tax,
            };
            resp.push(slab_data);
          }
          await maintenanceModule.add_slab(resp);
          // for (i = 0; i < sell.length; i++) {
          //    sell_data = {
          //       "transaction_setup_id": result.insertId,
          //       "transaction_type": sell[i].transaction_type,
          //       "sell_per_charges": sell[i].sell_per_charges,
          //       "sell_fixed_amount": sell[i].sell_fixed_amount,
          //       "sell_min_charge_amount": sell[i].sell_min_charge_amount,
          //       "sell_max_charge_amount": sell[i].sell_max_charge_amount,
          //       "sell_tax": sell[i].sell_tax,

          //    }
          //    resp1.push(sell_data)
          // }
          // await maintenanceModule.add_slab(resp1);
        } else {
          res
            .status(statusCode.internalError)
            .send(response.errormsg("Select Valid Charges Type"));
        }

        res
          .status(statusCode.ok)
          .send(response.successmsg("Added successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  transaction_list: async (req, res) => {
    const psp_name = await maintenanceModule.getPSPName();
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
    let like_search = {};

    if (req.bodyString("search")) {
      like_search.psp = req.bodyString("search");
    }
    let result = await maintenanceModule.select("*", limit, like_search);

    let send_res = [];
    for (let val of result) {
      let res = {
        setup_id: enc_dec.cjs_encrypt(val.id),
        plan_name: val.plan_name,
        psp: val.psp,
        psp_name: psp_name[val.psp],
        mcc: val.mcc,
        mcc_code: await maintenanceModule.getMCCName(val.mcc),
        currency: val.currency,
        payment_mode: val.payment_mode.split(",").join(", "),
        card_scheme: val.card_scheme,
        mcp_activation_fee: val.mcp_fee,
        mid_setup_fee: val.mid_setup_fee,
        mid_annual_fee: val.mid_annual_fee,
        fraud_engine: val.fraud_engine,
        refund_fee: val.refund_fee,
        processing_fee: val.chargeback_processing_fee,
        monthly_tpv: val.monthly_TPV,
        monthly_margin: val.monthly_margin,
        charges_type: val.charges_type,
        status: val.status == 1 ? "Deactivated" : "Activated",
      };
      send_res.push(res);
    }
    let total_count = await maintenanceModule.get_counts(like_search);
    res
      .status(statusCode.ok)
      .send(
        response.successdatamsg(
          send_res,
          "List fetched successfully.",
          total_count
        )
      );
  },

  transaction_details: async (req, res) => {
    let id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    const psp_name = await maintenanceModule.getPSPName();
    maintenanceModule
      .selectOne({ id: id })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let res1 = {
          setup_id: enc_dec.cjs_encrypt(val.id),
          plan_name: val.plan_name,
          psp: enc_dec.cjs_encrypt(val.psp),
          psp_name: psp_name[val.psp],
          mcc: enc_dec.cjs_encrypt(val.mcc),
          mcc_code: await maintenanceModule.getMCCName(val.mcc),
          currency: val.currency,
          payment_mode: val.payment_mode,
          card_scheme: val.card_scheme ? val.card_scheme : "",
          payment_mode_name: await maintenanceModule.getPaymentMode(
            val.payment_mode
          ),
          mcp_activation_fee: val.mcp_fee,
          mid_setup_fee: val.mid_setup_fee,
          mid_annual_fee: val.mid_annual_fee,
          per_tr_val_fraud: val.per_tr_val_fraud,
          fixed_amount_fraud: val.fixed_amount_fraud,
          fraud_engine: val.fraud_engine,
          per_of_tr_val_refund: val.per_tr_val_refund,
          fixed_amount_refund: val.fixed_amount_refund,
          refund_fee: val.refund_fee,
          per_of_tr_val_processing: val.per_tr_val_processing,
          fixed_amount_processing: val.fixed_amount_processing,
          processing_fee: val.chargeback_processing_fee,

          monthly_tpv: val.monthly_tpv,
          monthly_margin: val.monthly_margin,
          onboarding_fee: val.onboarding_fee,
          max_international_transaction_volume:
            val.international_transaction_volume,
          charges_type: val.charges_type,
          status: val.status == 1 ? "Deactivated" : "Activated",
          buy: await maintenanceModule.list_of_document({
            transaction_setup_id: val.id,
            status: 0,
          }),
          // sell: await maintenanceModule.list_of_sell({ transaction_setup_id: val.id, "status": 0 }),
        };

        send_res = res1;
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

  transaction_update: async (req, res) => {
    let setup_id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    let charges_type = req.bodyString("charges_type");
    let buy = req.body.buy_sell;
    let sell = req.body.sell;

    let dec_mcc_arr = [];
    let mcc_arr = req.bodyString("mcc").split(",");
    for (let item of mcc_arr) {
      dec_mcc_arr.push(await enc_dec.cjs_decrypt(item));
    }

    // let document = req.body.buy;
    // let sell = req.body.sell;
    var setup_data = {
      plan_name: req.bodyString("plan_name"),
      psp: await enc_dec.cjs_decrypt(req.bodyString("psp")),
      mcc: dec_mcc_arr.join(),
      // mcc: await enc_dec.cjs_decrypt(req.bodyString('mcc')),
      currency: req.bodyString("currency"),
      payment_mode: req.bodyString("payment_mode"),
      card_scheme: req.bodyString("card_scheme"),
      mcp_fee: req.bodyString("mcp_activation_fee"),
      mid_setup_fee: req.bodyString("mid_setup_fee"),
      mid_annual_fee: req.bodyString("mid_annual_fee"),
      per_tr_val_fraud: req.bodyString("per_of_tr_val_fraud"),
      fixed_amount_fraud: req.bodyString("fixed_amount_fraud"),
      fraud_engine:
        parseFloat(req.bodyString("per_of_tr_val_fraud")) +
        parseFloat(req.bodyString("fixed_amount_fraud")),
      per_tr_val_refund: req.bodyString("per_of_tr_val_refund"),
      fixed_amount_refund: req.bodyString("fixed_amount_refund"),
      refund_fee:
        parseFloat(req.bodyString("per_of_tr_val_refund")) +
        parseFloat(req.bodyString("fixed_amount_refund")),
      per_tr_val_processing: req.bodyString("per_of_tr_val_processing"),
      fixed_amount_processing: req.bodyString("fixed_amount_processing"),

      chargeback_processing_fee:
        parseFloat(req.bodyString("per_of_tr_val_processing")) +
        parseFloat(req.bodyString("fixed_amount_processing")),
      monthly_TPV: req.bodyString("monthly_tpv"),
      monthly_margin: req.bodyString("monthly_margin"),
      onboarding_fee: req.bodyString("onboarding_fee"),
      charges_type: charges_type,
      // transaction_type: req.bodyString("transaction_type"),
      international_transaction_volume: req.bodyString(
        "max_international_transaction_volume"
      ),
    };
    maintenanceModule
      .updateDetails({ id: setup_id }, setup_data)
      .then(async (result) => {
        let result_type = await maintenanceModule.selectOne({ id: setup_id });
        let type = result_type.charges_type;
        let resp = [];
        let resp1 = [];
        try {
          if (type == "Slab" || type == "volume_Base") {
            let slab_data;
            let sell_data;
            for (i = 0; i < buy.length; i++) {
              if (buy[i].id) {
                document_obj = {
                  transaction_type: buy[i].transaction_type,
                  buy_from_amount: buy[i].buy_from_amount,
                  "buy_to_amount	": buy[i].buy_to_amount,
                  buy_per_charges: buy[i].buy_per_charges,
                  buy_fix_amount: buy[i].buy_fix_amount,
                  "buy_min_charge_amount	": buy[i].buy_min_charge_amount,
                  buy_max_charge_amount: buy[i].buy_max_charge_amount,
                  buy_tax: buy[i].buy_tax,

                  sell_from_amount: buy[i].sell_from_amount,
                  "sell_to_amount	": buy[i].sell_to_amount,
                  sell_per_charges: buy[i].sell_per_charges,
                  sell_fixed_amount: buy[i].sell_fixed_amount,
                  sell_min_charge_amount: buy[i].sell_min_charge_amount,
                  sell_max_charge_amount: buy[i].sell_max_charge_amount,
                  sell_tax: buy[i].sell_tax,
                };
              }

              if (buy[i].id == "") {
                document_obj = {
                  transaction_setup_id: setup_id,
                  transaction_type: buy[i].transaction_type,
                  buy_from_amount: buy[i].buy_from_amount,
                  "buy_to_amount	": buy[i].buy_to_amount,
                  buy_per_charges: buy[i].buy_per_charges,
                  buy_fix_amount: buy[i].buy_fix_amount,
                  "buy_min_charge_amount	": buy[i].buy_min_charge_amount,
                  buy_max_charge_amount: buy[i].buy_max_charge_amount,
                  buy_tax: buy[i].buy_tax,

                  sell_from_amount: buy[i].sell_from_amount,
                  "sell_to_amount	": buy[i].sell_to_amount,
                  sell_per_charges: buy[i].sell_per_charges,
                  sell_fixed_amount: buy[i].sell_fixed_amount,
                  sell_min_charge_amount: buy[i].sell_min_charge_amount,
                  sell_max_charge_amount: buy[i].sell_max_charge_amount,
                  sell_tax: buy[i].sell_tax,
                };
                await maintenanceModule.add_slab(document_obj);
              } else {
                await maintenanceModule.updateSlab(
                  { id: enc_dec.cjs_decrypt(buy[i].id) },
                  document_obj
                );
              }
            }
          } else if (type == "Flat") {
            for (let i = 0; i < buy.length; i++) {
              if (buy[i].id) {
                document_obj = {
                  transaction_type: buy[i].transaction_type,
                  buy_per_charges: buy[i].buy_per_charges,
                  buy_fix_amount: buy[i].buy_fix_amount,
                  buy_min_charge_amount: buy[i].buy_min_charge_amount,
                  buy_max_charge_amount: buy[i].buy_max_charge_amount,
                  buy_tax: buy[i].buy_tax,

                  sell_per_charges: buy[i].sell_per_charges,
                  sell_fixed_amount: buy[i].sell_fixed_amount,
                  sell_min_charge_amount: buy[i].sell_min_charge_amount,
                  sell_max_charge_amount: buy[i].sell_max_charge_amount,
                  sell_tax: buy[i].sell_tax,
                };
                await maintenanceModule.updateSlab(
                  { id: enc_dec.cjs_decrypt(buy[i].id) },
                  document_obj
                );
              }
            }
          } else {
            res
              .status(statusCode.internalError)
              .send(response.errormsg("Select Valid Charges Type"));
          }
        } catch (error) {
          winston.error(error);
          res.status(statusCode.internalError).send(response.errormsg(error));
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Record updated successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  transaction_deactivate: async (req, res) => {
    let setup_id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    try {
      var insdata = {
        status: "1",
      };
      var ins_id = await maintenanceModule.updateDetails(
        { id: setup_id },
        insdata
      );
      let ins_doc = await maintenanceModule.updateSlab(
        { transaction_setup_id: setup_id },
        insdata
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Record deactivated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  transaction_activate: async (req, res) => {
    try {
      let setup_id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
      var insdata = {
        status: "0",
      };
      var ins_id = await maintenanceModule.updateDetails(
        { id: setup_id },
        insdata
      );
      let ins_doc = await maintenanceModule.updateSlab(
        { transaction_setup_id: setup_id },
        insdata
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Record activated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  slab_deactivate: async (req, res) => {
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    try {
      var insdata = {
        status: 1,
      };
      let ins_doc = await maintenanceModule.updateSlab({ id: id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Record deactivated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  slab_add: async (req, res) => {
    let setup_id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let type = req.bodyString("charges_type");
    let buy = req.body.buy;
    let sell = req.body.sell;
    let check_data = await maintenanceModule
      .selectOne({ id: setup_id })
      .then(async (result) => {
        let resp = [];
        let resp1 = [];
        let sell_data;
        let lb = [];
        let ub = [];
        let buy_data;
        if (result.charges_type == "Slab") {
          for (i = 0; i < buy.length; i++) {
            buy_data = {
              transaction_setup_id: result.id,
              transaction_type: document[i].transaction_type,
              buy_from_amount: document[i].buy_from_amount,
              buy_to_amount: document[i].buy_to_amount,
              buy_per_charges: document[i].buy_per_charges,
              buy_fix_amount: document[i].buy_fix_amount,
              buy_min_charge_amount: document[i].buy_min_charge_amount,
              buy_max_charge_amount: document[i].buy_max_charge_amount,
              buy_tax: document[i].buy_tax,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp.push(buy_data);
          }

          await maintenanceModule.add_slab(resp);
          for (i = 0; i < sell.length; i++) {
            sell_data = {
              transaction_type: sell[i].transaction_type,
              sell_from_amount: sell[i].sell_from_amount,
              sell_to_amount: sell[i].sell_to_amount,
              sell_per_charges: sell[i].sell_per_charges,
              sell_fixed_amount: sell[i].sell_fixed_amount,
              sell_min_charge_amount: sell[i].sell_min_charge_amount,
              sell_max_charge_amount: sell[i].sell_max_charge_amount,
              sell_tax: sell[i].sell_tax,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp1.push(sell_data);
          }

          await maintenanceModule.add_slab(resp1);
        } else if (result.charges_type == "Flat") {
          for (i = 0; i < buy.length; i++) {
            buy_data = {
              transaction_setup_id: result.id,
              transaction_type: document[i].transaction_type,
              // "from": buy[i].from_amount,
              // "to": buy[i].to_amount,
              buy_per_charges: document[i].buy_per_charges,
              buy_fix_amount: document[i].buy_fix_amount,
              buy_min_charge_amount: document[i].buy_min_charge_amount,
              buy_max_charge_amount: document[i].buy_max_charge_amount,
              buy_tax: document[i].buy_tax,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp.push(buy_data);
          }
          await maintenanceModule.add_slab(resp);
          for (i = 0; i < sell.length; i++) {
            sell_data = {
              transaction_setup_id: result.id,
              transaction_type: sell[i].transaction_type,
              // "sell_from_amount": sell[i].from_amount,
              // "sell_to_amount": sell[i].to_amount,
              sell_per_charges: sell[i].sell_per_charges,
              sell_fixed_amount: sell[i].sell_fixed_amount,
              sell_min_charge_amount: sell[i].sell_min_charge_amount,
              sell_max_charge_amount: sell[i].sell_max_charge_amount,
              sell_tax: sell[i].sell_tax,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp1.push(sell_data);
          }
          await maintenanceModule.add_slab(resp1);
        } else if (result.charges_type == "volume_Base") {
          for (i = 0; i < buy.length; i++) {
            buy_data = {
              transaction_setup_id: result.id,
              transaction_type: result.transaction_type,
              from: buy[i].from_amount,
              to: buy[i].to_amount,
              per_charges: buy[i].charges_in_percent,
              fix_amt: buy[i].fixed_amount,
              min: buy[i].min_charges,
              max: buy[i].max_charges,
              per_tax: buy[i].tax_in_percent,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp.push(buy_data);
          }
          await maintenanceModule.add_slab(resp);
          for (i = 0; i < sell.length; i++) {
            sell_data = {
              transaction_setup_id: result.id,
              transaction_type: result.transaction_type,
              sell_from_amount: sell[i].from_amount,
              sell_to_amount: sell[i].to_amount,
              sell_per_charges: sell[i].charges_in_percent,
              sell_fixed_amount: sell[i].fixed_amount,
              sell_min_charges: sell[i].min_charges,
              sell_max_charges: sell[i].max_charges,
              sell_per_tax: sell[i].tax_in_percent,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp1.push(sell_data);
          }
          await maintenanceModule.add_slab(resp1);
        } else {
          res
            .status(statusCode.internalError)
            .send(response.errormsg("Not valid charges type"));
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Added successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  slab_list: async (req, res) => {
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
    maintenanceModule
      .select_slab(limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          // result.forEach(async function (val, key) {
          let res = {
            transaction_id: enc_dec.cjs_encrypt(val.id),
            buy: await maintenanceModule.list_of_document({
              transaction_setup_id: val.id,
            }),
            sell: await maintenanceModule.list_of_sell({
              transaction_setup_id: val.id,
            }),
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
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

  slab_update: async (req, res) => {
    try {
      let transaction_id = enc_dec.cjs_decrypt(req.bodyString("setup_id"));
      let match_data = await maintenanceModule.selectOne({
        id: transaction_id,
      });
      let buy = req.body.buy;
      let sell = req.body.sell;
      if (match_data) {
        // let document = req.body.data;

        let document_obj;
        let document_add = [];
        if (
          match_data.charges_type == "Slab" ||
          match_data.charges_type == "volume_Base"
        ) {
          for (let i = 0; i < buy.length; i++) {
            if (buy[i].id) {
              document_obj = {
                buy_from_amount: buy[i].from_amount,
                "buy_to_amount	": buy[i].to_amount,
                transaction_type: buy[i].transaction_type,
                buy_per_charges: buy[i].charges_in_percent,
                buy_fix_amount: buy[i].fixed_amount,
                "buy_min_charge_amount	": buy[i].min_charges,
                buy_max_charge_amount: buy[i].max_charges,
                buy_tax: buy[i].tax_in_percent,
              };
              await maintenanceModule.updateSlab(
                { id: enc_dec.cjs_decrypt(buy[i].id) },
                document_obj
              );
            }
          }
          for (let i = 0; i < sell.length; i++) {
            if (sell[i].id) {
              document_obj = {
                sell_from_amount: sell[i].from_amount,
                "sell_to_amount	": sell[i].to_amount,
                transaction_type: sell[i].transaction_type,
                sell_per_charges: sell[i].charges_in_percent,
                sell_fixed_amount: sell[i].fixed_amount,
                sell_min_charge_amount: sell[i].min_charges,
                sell_max_charge_amount: sell[i].max_charges,
                sell_tax: sell[i].tax_in_percent,
              };
              await maintenanceModule.updateSlab(
                { id: enc_dec.cjs_decrypt(sell[i].id) },
                document_obj
              );
            }
          }
        } else if (match_data.charges_type == "Flat") {
          for (let i = 0; i < buy.length; i++) {
            if (buy[i].id) {
              document_obj = {
                transaction_type: buy[i].transaction_type,
                buy_per_charges: buy[i].charges_in_percent,
                buy_fix_amount: buy[i].fixed_amount,
                buy_min_charge_amount: buy[i].min_charges,
                buy_max_charge_amount: buy[i].max_charges,
                buy_tax: buy[i].tax_in_percent,
              };
              await maintenanceModule.updateSlab(
                { id: enc_dec.cjs_decrypt(buy[i].id) },
                document_obj
              );
            }
          }
          for (let i = 0; i < sell.length; i++) {
            if (sell[i].id) {
              document_obj = {
                transaction_type: sell[i].transaction_type,
                sell_per_charges: sell[i].charges_in_percent,
                sell_fixed_amount: sell[i].fixed_amount,
                sell_min_charge_amount: sell[i].min_charges,
                sell_max_charge_amount: sell[i].max_charges,
                sell_tax: sell[i].tax_in_percent,
              };
              await maintenanceModule.updateSlab(
                { id: enc_dec.cjs_decrypt(sell[i].id) },
                document_obj
              );
            }
          }
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Record updated successfully"));
      } else {
        res
          .status(statusCode.internalError)
          .send(response.errormsg("Details not available."));
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  slab_sell_add: async (req, res) => {
    let setup_id = await enc_dec.cjs_decrypt(req.bodyString("setup_id"));
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let type = req.bodyString("charges_type");
    let buy = req.body.buy;
    let sell = req.body.sell;
    let check_data = await maintenanceModule
      .selectOne({ id: setup_id })
      .then(async (result) => {
        let resp = [];
        let resp1 = [];
        let sell_data;
        let buy_data;
        if (result.charges_type == "Slab") {
          for (i = 0; i < sell.length; i++) {
            sell_data = {
              transaction_setup_id: result.id,
              transaction_type: result.transaction_type,
              sell_from_amount: sell[i].from_amount,
              sell_to_amount: sell[i].to_amount,
              sell_per_charges: sell[i].charges_in_percent,
              sell_fixed_amount: sell[i].fixed_amount,
              sell_min_charges: sell[i].min_charges,
              sell_max_charges: sell[i].max_charges,
              sell_per_tax: sell[i].tax_in_percent,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp1.push(sell_data);
          }
          await maintenanceModule.add_slab(resp1);
        } else if (result.charges_type == "Flat") {
          for (i = 0; i < sell.length; i++) {
            sell_data = {
              transaction_setup_id: result.id,
              transaction_type: result.transaction_type,
              sell_per_charges: sell[i].charges_in_percent,
              sell_fixed_amount: sell[i].fixed_amount,
              sell_min_charges: sell[i].min_charges,
              sell_max_charges: sell[i].max_charges,
              sell_per_tax: sell[i].tax_in_percent,
              charges_type: result.charges_type,
              added_date: register_at,
              added_by: req.user.id,
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            };
            resp1.push(sell_data);
          }
          await maintenanceModule.add_slab(resp1);
        } else {
          res
            .status(statusCode.internalError)
            .send(response.errormsg("Not valid charges type"));
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Added successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  payment_mode_list: async (req, res) => {
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
    let like_search = {};

    if (req.bodyString("search")) {
      like_search.plan_name = req.bodyString("search");
    }
    let env = "";
    if (req.bodyString("env")) {
      env = req.bodyString("env");
    }
    let payment_result = [];
    if (env !== "") {
      payment_result = await submerchantModel.selectAvailablePaymentMethod(
        req?.user?.id,
        env
      );
      payment_result = payment_result
        .split(",")
        .map((item) => item.toLowerCase());
    }

    let result = await maintenanceModule.select_payment_mode(
      "*",
      limit,
      like_search
    );
    let send_res = [];
    let total_count = 0;
    for (let val of result) {
      let testmode = val?.payment_mode.toLowerCase();
      if (env !== "" && payment_result.includes(testmode)) {
        let res = {
          mode_id: enc_dec.cjs_encrypt(val.id),
          payment_mode: val.payment_mode,
        };

        send_res.push(res);
      }

      if (env == "") {
        let res = {
          mode_id: enc_dec.cjs_encrypt(val.id),
          payment_mode: val.payment_mode,
        };

        send_res.push(res);

        total_count = await maintenanceModule.get_counts_payment_mode(
          like_search
        );
      }
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
  },
  card_scheme: async (req, res) => {
    let like_search = {};

    like_search.deleted = req.bodyString("deleted");

    let result = await maintenanceModule.selectCard(like_search);
    let send_res = [];
    for (let val of result) {
      let res = {
        card_id: enc_dec.cjs_encrypt(val.id),
        card_scheme: val.card_scheme,
      };
      send_res.push(res);
    }

    res
      .status(statusCode.ok)
      .send(response.successdatamsg(send_res, "List fetched successfully."));
  },
};
module.exports = transaction;
