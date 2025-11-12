const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const SubmerchantModel = require("../models/submerchantmodel");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
require("dotenv").config({ path: "../.env" });
const moment = require("moment");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const server_address = server_addr + ":" + port;
const SequenceUUID = require("sequential-uuid");
const qrGenerateModel = require("../models/qrGenerateModule");
const checkifrecordexist = require("../utilities/validations/checkifrecordexist");
const CurrencyModel = require("../models/currency");
const PspModel = require("../models/psp");
const MerchantRegistrationModel = require("../models/merchant_registration");
const fontModel = require("../models/fonts");
const submerchatDraftModel = require("../models/master_merchant_draft");
//const setUpCharges = require("../utilities/charges/setup-charges/index");
const winston = require("../utilities/logmanager/winston");

const brandingCreateOrUpdate = require("../utilities/branding/create");
const brandingDelete = require("../utilities/branding/delete");
const RoutingModel = require("../models/routingModel");
const MerchantOrder = require("./merchantOrder");
const MerchantModel = require("../models/merchantmodel");
const CustomFormModal = require("../models/custom_form");
const addMidBranding = require("../utilities/branding/add_mid_add_branding");
const MerchantEkycModel = require("../models/merchant_ekycModel");
const credentials = require("../config/credientials");
const axios = require('axios');
const {processMerchantsBatch} = require("../utilities/branding/add_batch_branding");
const currency = require("./currency");

var all_data = {
  add: async (req, res) => {
    const data = req.bodyString("email") + req.bodyString("name");
    try {
      userData = {
        super_merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        register_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        font_name:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Roboto","Helvetica Neue","Ubuntu",sans-serif',
        ip: await helpers.get_ip(req),
      };
      ins_id = await SubmerchantModel.add(userData);

      let mer_details = {
        merchant_id: ins_id.insertId,
        company_name: req.body.legal_business_name,
        last_updated: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await SubmerchantModel.add_merchant_details(mer_details);

      let kay_data = {
        merchant_id: ins_id.insertId,
        super_merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        type: "test",
        merchant_key: await helpers.make_order_number("test-"),
        merchant_secret: await helpers.make_order_number("sec-"),
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      await SubmerchantModel.add_key(kay_data);
      // let addPaymentMethodRes =
      //   await MerchantRegistrationModel.insertMerchantPaymentMethods(
      //     ins_id.insertId
      //   );
      let add_selected_merchant = await SubmerchantModel.updateDetailsModified(
        {
          id: req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
        },
        { selected_submerchant: ins_id.insertId }
      );
      let add_mode = await SubmerchantModel.update_merchant(
        {
          super_merchant_id: req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
        },
        { mode: "test" }
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            { id: enc_dec.cjs_encrypt(ins_id.insertId) },
            "Sub-merchant registered successfully"
          )
        );
    } catch (error) {
      winston.error(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },

  /* Old submerchant list function 
 list: async (req, res) => {
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
    let condition2 = {};
    if (req.user.type == "merchant") {
      let selected_merchant = await SubmerchantModel.getSelectedMerchantId(
        req.user.id
      );

      // let mer_details = await SubmerchantModel.main_merchant_details({
      //   "mm.super_merchant_id": req.user.super_merchant_id
      //     ? req.user.super_merchant_id
      //     : req.user.id,
      // });
      condition = {
        ["s.deleted"]: 0,
        ["s.super_merchant_id"]: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        // ["s.live"]: mer_details.mode == "live" ? 1 : 0,
      };
      if (selected_merchant != 0) {
        condition = {
          ["m.merchant_id"]: selected_merchant,
        };
      }
    } else {
      condition = { ["s.deleted"]: 0 };
    }

    if (req.bodyString("registration_number")) {
      condition["m.company_registration_number"] = req.bodyString(
        "registration_number"
      );
    }

    if (req.bodyString("business_address")) {
      let str = req.bodyString("business_address");
      if (str.includes(",")) {
        let finalStr = [];
        const arr = str.split(",");
        for (let val of arr) {
          finalStr.push(enc_dec.cjs_decrypt(val));
        }
        condition2["m.register_business_country"] = finalStr.join(",");
      } else {
        condition["m.register_business_country"] = enc_dec.cjs_decrypt(
          req.bodyString("business_address")
        );
      }
    }

    if (req.bodyString("type_of_business")) {
      let str = req.bodyString("type_of_business");
      if (str.includes(",")) {
        let finalStr = [];
        const arr = str.split(",");
        for (let val of arr) {
          finalStr.push(enc_dec.cjs_decrypt(val));
        }
        condition2["m.type_of_business"] = finalStr.join(",");
      } else {
        condition["m.type_of_business"] = enc_dec.cjs_decrypt(
          req.bodyString("type_of_business")
        );
      }
    }

    if (req.bodyString("industry_type")) {
      let str = req.bodyString("industry_type");
      if (str.includes(",")) {
        let finalStr = [];
        const arr = str.split(",");
        for (let val of arr) {
          finalStr.push(enc_dec.cjs_decrypt(val));
        }
        condition2["m.mcc_codes"] = finalStr.join(",");
      } else {
        condition["m.mcc_codes"] = enc_dec.cjs_decrypt(
          req.bodyString("industry_type")
        );
      }
    }

    if (req.bodyString("super_merchant")) {
      let str = req.bodyString("super_merchant");
      if (str.includes(",")) {
        let finalStr = [];
        const arr = str.split(",");
        for (let val of arr) {
          finalStr.push(enc_dec.cjs_decrypt(val));
        }
        condition2["s.super_merchant_id"] = finalStr.join(",");
      } else {
        condition["s.super_merchant_id"] = enc_dec.cjs_decrypt(
          req.bodyString("super_merchant")
        );
      }
    }

    if (req.bodyString("status")) {
      if (req.bodyString("status") == "Deactivated") {
        condition["s.status"] = 1;
      } else if (req.bodyString("status") == "Active") {
        condition["s.status"] = 0;
      }
    }
    if (req.bodyString("company_name")) {
      condition["m.company_name"] = req.bodyString("company_name");
    }

    // if (req.bodyString("ekyc_status")) {
    //     if (req.bodyString("ekyc_status") == "ekyc_pending") {
    //         condition["s.ekyc_required"] = 1;
    //         condition["s.ekyc_done"] = 1; //1=pending, 2= Approved
    //         condition["s.onboarding_done"] = 1;
    //     }
    //     if (req.bodyString("ekyc_status") == "onboarding_pending") {
    //         condition["s.onboarding_done"] = 0;
    //     }
    //     if (req.bodyString("ekyc_status") == "ekyc_done") {
    //         condition["s.ekyc_done"] = 2;
    //     }
    //     if (req.bodyString("ekyc_status") == "onboarding_done") {
    //         condition["s.ekyc_required"] = 0;
    //         condition["s.onboarding_done"] = 1;
    //     }
    //     if (req.bodyString("ekyc_status") == "ekyc_denied") {
    //         condition["s.ekyc_required"] = 1;
    //         condition["s.ekyc_done"] = 3;
    //     }
    // }

    if (req.bodyString("ekyc_status")) {
      let str = req.bodyString("ekyc_status");

      if (str.includes(",")) {
        const arr = str.split(",");
        for (let val of arr) {
          if (val === "ekyc_pending") {
            if (condition2["s.ekyc_required"]) {
              condition2["s.ekyc_required"] =
                condition2["s.ekyc_required"] + "," + "1";
            } else {
              condition2["s.ekyc_required"] = "1";
            }

            if (condition2["s.ekyc_done"]) {
              condition2["s.ekyc_done"] = condition2["s.ekyc_done"] + "," + "1";
            } else {
              condition2["s.ekyc_done"] = "1";
            }

            if (condition2["s.onboarding_done"]) {
              condition2["s.onboarding_done"] =
                condition2["s.onboarding_done"] + "," + "1";
            } else {
              condition2["s.onboarding_done"] = "1";
            }
          }

          if (val === "onboarding_pending") {
            if (condition2["s.onboarding_done"]) {
              condition2["s.onboarding_done"] =
                condition2["s.onboarding_done"] + "," + "0";
            } else {
              condition2["s.onboarding_done"] = "0";
            }
          }

          if (val === "ekyc_done") {
            if (condition2["s.ekyc_done"]) {
              condition2["s.ekyc_done"] = condition2["s.ekyc_done"] + "," + "2";
            } else {
              condition2["s.ekyc_done"] = "2";
            }
          }

          if (val === "onboarding_done") {
            if (condition2["s.ekyc_required"]) {
              condition2["s.ekyc_required"] =
                condition2["s.ekyc_required"] + "," + "0";
            } else {
              condition2["s.ekyc_required"] = "0";
            }

            if (condition2["s.onboarding_done"]) {
              condition2["s.onboarding_done"] =
                condition2["s.onboarding_done"] + "," + "1";
            } else {
              condition2["s.onboarding_done"] = "1";
            }
          }

          if (val === "ekyc_denied") {
            if (condition2["s.ekyc_required"]) {
              condition2["s.ekyc_required"] =
                condition2["s.ekyc_required"] + "," + "1";
            } else {
              condition2["s.ekyc_required"] = "1";
            }

            if (condition2["s.ekyc_done"]) {
              condition2["s.ekyc_done"] = condition2["s.ekyc_done"] + "," + "3";
            } else {
              condition2["s.ekyc_done"] = "3";
            }
          }
        }
      } else {
        if (req.bodyString("ekyc_status") == "ekyc_pending") {
          condition["s.ekyc_required"] = 1;
          condition["s.ekyc_done"] = 1; //1=pending, 2= Approved
          condition["s.onboarding_done"] = 1;
        }
        if (req.bodyString("ekyc_status") == "onboarding_pending") {
          condition["s.onboarding_done"] = 0;
        }
        if (req.bodyString("ekyc_status") == "ekyc_done") {
          condition["s.ekyc_done"] = 2;
          condition["s.ekyc_required"] = 1;
          condition["s.onboarding_done"] = 1;
        }
        if (req.bodyString("ekyc_status") == "onboarding_done") {
          condition["s.ekyc_required"] = 0;
          condition["s.onboarding_done"] = 1;
        }
        if (req.bodyString("ekyc_status") == "ekyc_denied") {
          condition["s.ekyc_required"] = 1;
          condition["s.ekyc_done"] = 3;
        }
      }
    }

    const search_text = req.bodyString("search");
    const filter = {};
    if (search_text) {
      filter["m.company_name"] = search_text;
      filter["s.email"] = search_text;
      filter["m.legal_person_email"] = search_text;
      filter["m.business_phone_number"] = search_text;
    }

    console.log(condition);

    SubmerchantModel.select(condition, filter, limit, condition2)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let owner_ekyc_details = await SubmerchantModel.ownerEkycCount(
            val.id
          );
          let meeting_data = await SubmerchantModel.get_count_meetings({
            merchant_id: val.id,
          });
          let count_mid_data = await SubmerchantModel.get_count_mid("mid", {
            submerchant_id: val.id,
            deleted: 0,
          });
          let res = {
            show_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            submerchant_id: enc_dec.cjs_encrypt(val.id),
            ekyc_done: val.ekyc_done == 2 ? "Yes" : "No",
            ekyc_required: val.ekyc_required == 1 ? "Yes" : "No",
            onboarding_done:
              owner_ekyc_details.total == owner_ekyc_details.ekyc_done &&
              val.onboarding_done == 1
                ? "Yes"
                : "No",
            currency: val?.currency ? val?.currency : "",
            mail_send_to_psp: val.psp_mail_send == 1 ? "Yes" : "No",
            register_business_country: await helpers.get_country_name_by_id(
              val.register_business_country
            ),
            register_business_country_id: val.register_business_country,
            type_of_business: await helpers.get_entity_type(
              val.type_of_business
            ),
            merchant_name: val.company_name, //await helpers.get_super_merchant_name(val.super_merchant_id),
            company_registration_number: val.company_registration_number,
            legal_business_name: await helpers.get_super_merchant_name(
              val.super_merchant_id
            ),
            email:
              val.email == ""
                ? val.legal_person_email
                  ? val.legal_person_email
                  : ""
                : val.email,
            kyc_status:
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
            status: val.status == 1 ? "Deactivated" : "Active",
            live: val.live,
            meeting_data: meeting_data > 0 ? 1 : 0,
            mid_count: count_mid_data > 0 ? 1 : 0,
            last_modified_date: val.last_updated
              ? moment(val.last_updated).format("DD-MM-YYYY HH:mm:ss")
              : " ",
          };
          send_res.push(res);
        }

        total_count = await SubmerchantModel.get_sub_merchant_count(
          condition,
          filter,
          condition2
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
        winston.error(error);

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  }, */
  /* Optimise list function is below */
  list: async (req, res) => {
    try {
      // 1. Extract and validate pagination parameters
      const { perpage, page } = extractPaginationParams(req);
      const limit = calculatePagination(perpage, page);

      // 2. Build conditions using helper functions
      const { condition, condition2 } = await buildQueryConditions(req);

      // 3. Build search filter
      const filter = buildSearchFilter(req.bodyString("search"));

      console.log(condition);

      // 4. Fetch data and total count in parallel
      const [result, total_count] = await Promise.all([
        SubmerchantModel.select(condition, filter, limit, condition2),
        SubmerchantModel.get_sub_merchant_count(condition, filter, condition2),
      ]);

      // 5. Process results efficiently
      const send_res = await processResultsInParallel(result);

      // 6. Send response
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            send_res,
            "List fetched successfully.",
            total_count
          )
        );
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  psp_list: async (req, res) => {
    let rec_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));

    SubmerchantModel.selectpspList({ merchant_id: rec_id })

      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            data_id: enc_dec.cjs_encrypt(val.id),
            submerchant_id: enc_dec.cjs_encrypt(val.merchant_id),
            psp_id: enc_dec.cjs_encrypt(val.psp_id),
            psp_name: await helpers.get_psp_name_by_id(val.psp_id),
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

  details: async (req, res) => {
    let rec_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
    SubmerchantModel.selectOneDetails({ merchant_id: rec_id })

      .then(async (result) => {
        list = await SubmerchantModel.selectdata(rec_id);
        getKeys = await SubmerchantModel.selectKeyData(rec_id);

        const data = [];
        let index = 0;
        for (elements of list) {
          //list.forEach((elements, index) => {
          mid_id = enc_dec.cjs_encrypt(elements.id);
          submerchant_id = enc_dec.cjs_encrypt(elements.submerchant_id);
          psp_id = enc_dec.cjs_encrypt(elements.psp_id);
          psp_name = await helpers.get_psp_name_by_id(elements.psp_id);
          currency_id = enc_dec.cjs_encrypt(elements.currency_id);
          currency_code = await helpers.get_currency_name_by_id(
            elements.currency_id
          );
          legal_business_name = elements.company_name;
          var temp = {};
          temp = {
            mid_id: mid_id,
            submerchant_id: submerchant_id,
            psp_id: psp_id,
            psp_name: psp_name,
            currency_id: currency_id,
            currency_code: currency_code,
            MID: elements.MID,

            payment_methods: elements.payment_methods,
            payment_schemes: elements.payment_schemes,
            transaction_allowed_daily: elements.transaction_allowed_daily,
            status: elements.deleted == 1 ? "Deactivated" : "Active",
          };
          data[index] = temp;

          index++;
        }

        const keyData = [];
        getKeys.forEach((elements, index) => {
          keys_id = enc_dec.cjs_encrypt(elements.id);
          submerchant_id = enc_dec.cjs_encrypt(elements.merchant_id);
          type = elements.type;
          merchant_key = elements.merchant_key;
          merchant_secret = elements.merchant_secret;
          created_at = moment(elements.created_at).format("DD-MM-YYYY H:mm:ss");

          var temp = {};
          temp = {
            keys_id: keys_id,
            submerchant_id: submerchant_id,
            type: type,
            merchant_key: merchant_key,
            merchant_secret: merchant_secret,
            created_date: created_at,
          };
          keyData[index] = temp;
        });

        count_data = await SubmerchantModel.get_mid_count(
          { submerchant_id: rec_id, deleted: 0 },
          0
        );

        let val = result;

        let resp = {
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          merchant_details_id: enc_dec.cjs_encrypt(val.id),
          legal_business_name: val.company_name,
          mid_data: data,
          key_data: keyData,
          count_mid: count_data,
        };
        send_res = resp;

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
  update: async (req, res) => {
    try {
      let data_id = await enc_dec.cjs_decrypt(req.bodyString("id"));

      userData = {
        company_name: req.bodyString("legal_business_name"),
      };

      $ins_id = await SubmerchantModel.updateDetails({ id: data_id }, userData);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant updated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  deactivate: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
      var insdata = {
        status: 1,
      };

      $ins_id = await SubmerchantModel.update_merchant(
        { id: user_id },
        insdata
      );
      let super_merchant_id = await helpers.get_super_merchant_id(user_id);

      $ins_id = await SubmerchantModel.updateDetailsModified(
        { id: super_merchant_id },
        insdata
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant deactivated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  activate: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
      var insdata = {
        status: 0,
      };

      $ins_id = await SubmerchantModel.update_merchant(
        { id: user_id },
        insdata
      );

      let super_merchant_id = await helpers.get_super_merchant_id(user_id);

      $ins_id = await SubmerchantModel.updateDetailsModified(
        { id: super_merchant_id },
        insdata
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant activated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  delete: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await SubmerchantModel.update_merchant(
        { id: user_id },
        insdata
      );
      let super_merchant_id = await helpers.get_super_merchant_id(user_id);

      $ins_id = await SubmerchantModel.updateDetailsModified(
        { id: super_merchant_id },
        insdata
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant deleted successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  branding_details: async (req, res) => {
    let rec_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
    console.log(`at branding details`);
    console.log(`request body is here`);
    let env = req.bodyString("env");
    const routing = req.body.routing;

    const condition = {
      submerchant_id: rec_id,
    };
    console.log(rec_id, env);
    const card_result = await SubmerchantModel.get_card_payment_method(
      rec_id,
      env
    );
    const check_bank_transfer = await helpers.getBankTransfer(rec_id);
    const draft_count = await submerchatDraftModel.get_count(condition);

    let company_details = await helpers.company_details({ id: 1 });
    let company_logo = company_details?.company_logo;

    if (draft_count > 0 && routing === "no") {
      console.log("inside if");
      const draft_result = await submerchatDraftModel.selectOne(condition);
      const val = draft_result;
      let send_res = [];
      let available_payment_method_details =
        await SubmerchantModel.selectAvailablePaymentMethod(rec_id, env);
      let array_method = available_payment_method_details.split(",");
      let available_payment_method = [...new Set(array_method)];
      let resp = {
        submerchant_id: enc_dec.cjs_encrypt(val.submerchant_id),
        merchant_name: await helpers.get_merchantdetails_name_by_id(
          val.submerchant_id
        ),
        icon_name: val.icon,
        // logo_name: "",
        logo_name: company_logo,
        language: await enc_dec.cjs_encrypt(val.language),
        icon: process.env.STATIC_URL + "/static/files/" + val.icon,
        payment_methods: await submerchatDraftModel.selectPaymentMethod(
          rec_id,
          env
        ),
        available_payment_method: available_payment_method,
        // logo: "",
        logo: process.env.STATIC_URL + "/static/images/" + company_logo,
        accept_image:
          val.we_accept_image != ""
            ? process.env.STATIC_URL + "/static/files/" + val.we_accept_image
            : process.env.STATIC_URL + "/static/files/" + "payment-list.png",
        use_logo_instead_icon: 0,
        brand_color: val.brand_color,
        accent_color: val.accent_color,
        card_payment_scheme: val.card_payment,
        stored_card_scheme: val.stored_card,
        fonts: await fontModel.select(),
        font_name: val.font_name,
        card_payment_methods: card_result,
        is_back_transfer: check_bank_transfer,
        test_card_payment_scheme: val.test_card_payment_scheme,
        test_stored_card_scheme: val.test_stored_card_scheme,
      };

      send_res = resp;

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(send_res, "Details fetched successfully.")
        );
    } else {
      console.log(`inside the else`);
      SubmerchantModel.selectOne("*", { id: rec_id, deleted: 0 })
        .then(async (result) => {
          let send_res = [];
          let val = result;
          console.log(result, val);
          let available_payment_method_details =
            await SubmerchantModel.selectAvailablePaymentMethod(rec_id, env);
          let array_method = available_payment_method_details.split(",");
          let available_payment_method = [...new Set(array_method)];

          let resp = {
            super_merchant_id: val
              ? enc_dec.cjs_encrypt(val.super_merchant_id)
              : 0,
            submerchant_id: val ? enc_dec.cjs_encrypt(val.id) : 0,
            merchant_name: val
              ? await helpers.get_merchantdetails_name_by_id(val.id)
              : "",
            icon_name: val ? val.icon : "",
            logo_name: val.logo !== null ? val.logo : company_logo,
            language: val
              ? await enc_dec.cjs_encrypt(val.default_language)
              : "",
            accept_image_name: val ? val.we_accept_image : "",
            icon: val
              ? process.env.STATIC_URL + "/static/files/" + val.icon
              : "",
            logo:
              val.logo !== null
                ? process.env.STATIC_URL + "/static/files/" + val.logo
                : process.env.STATIC_URL + "/static/images/" + company_logo,
            payment_methods: await SubmerchantModel.selectPaymentMethod(
              rec_id,
              env
            ),
            available_payment_method: available_payment_method,
            accept_image: val
              ? val.we_accept_image != ""
                ? process.env.STATIC_URL +
                  "/static/files/" +
                  val.we_accept_image
                : process.env.STATIC_URL + "/static/files/" + "payment-list.png"
              : process.env.STATIC_URL + "/static/files/" + "payment-list.png",
            use_logo_instead_icon: val ? val.use_logo : "",
            brand_color: val ? val.brand_color : "",
            accent_color: val ? val.accent_color : "",
            card_payment_scheme: val ? val.card_payment_scheme : "",
            stored_card_scheme: val ? val.stored_card_scheme : "",
            fonts: await fontModel.select(),
            font_name: val ? val.font_name : "",
            card_payment_methods: card_result,
            is_back_transfer: check_bank_transfer,
            test_card_payment_scheme: val ? val.test_card_payment_scheme : "",
            test_stored_card_scheme: val ? val.test_stored_card_scheme : "",
          };
          send_res = resp;

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(send_res, "Details fetched successfully.")
            );
        })
        .catch((error) => {
          console.log(error);
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    }
  },
  branding_update: async (req, res) => {
    try {
      let submerchant_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      let language = await enc_dec.cjs_decrypt(req.bodyString("language"));
      insdata = {
        use_logo: req.bodyString("use_logo_instead_icon"),
        brand_color: req.bodyString("brand_color"),
        accent_color: req.bodyString("accent_color"),
        default_language: language,
        //card_payment_scheme: req.bodyString("card_payment"),
        //stored_card_scheme: req.bodyString("stored_card"),
        font_name: req.bodyString("font_name"),
      };
      if (req.all_files) {
        if (req.all_files.icon) {
          insdata.icon = req.all_files.icon;
        }
        if (req.all_files.logo) {
          insdata.logo = req.all_files.logo;
        }
        // if (req.all_files.accept_image) {
        //     insdata.we_accept_image = req.all_files.accept_image;
        // }
      }
      const mode_obj = {
        test: "test",
        live: "live",
      };
      const mode = req.body.env === "test" ? "test" : "live";

      if (mode_obj.test === mode) {
        insdata.test_card_payment_scheme = req.bodyString("card_payment");
        insdata.test_stored_card_scheme = req.bodyString("stored_card");
      } else {
        insdata.card_payment_scheme = req.bodyString("card_payment");
        insdata.stored_card_scheme = req.bodyString("stored_card");
      }

      $ins_id = await SubmerchantModel.update_merchant(
        { id: submerchant_id },
        insdata
      );
      let payment_methods = req.bodyString("payment_methods");
      let new_card = req.bodyString("card_payment");
      let stored_card = req.bodyString("stored_card");
      let show = req.bodyString("show");
      let split_payment_methods = payment_methods.split(",");
      let split_show = show.split(",");
      let merchant_payment_methods = [];
      let i = 1;
      let count = 0;

      for (let method of split_payment_methods) {
        let temp = {
          sub_merchant_id: submerchant_id,
          methods: method,
          sequence: i,
          is_visible: split_show[count],
          created_at: moment().format("YYYY-MM-DD HH:mm:s"),
          mode: mode,
        };
        i++;
        count++;
        merchant_payment_methods.push(temp);
      }
      const removeOldMethods = await SubmerchantModel.removeOldPaymentMethod({
        sub_merchant_id: submerchant_id,
        mode: mode,
      });
      const all_insert = merchant_payment_methods.map((val) => {
        if (val.methods === "stored_card") {
          val.others =
            req.body.env === mode
              ? insdata.test_stored_card_scheme
              : insdata.stored_card_scheme;
        }

        if (val.methods === "card_payment") {
          val.others =
            req.body.env === mode
              ? insdata.test_card_payment_scheme
              : insdata.card_payment_scheme;
        }

        SubmerchantModel.add_payment_method(
          {
            sub_merchant_id: submerchant_id,
            methods: val.methods,
            mode: mode,
          },
          val
        );
      });

      Promise.all(all_insert);

      // let update_payment_method = await SubmerchantModel.add_payment_method(
      //   merchant_payment_methods,
      //   submerchant_id,
      //   mode
      // );

      // if (stored_card) {
      //   let update_data = {
      //     others: stored_card,
      //   };
      //   await SubmerchantModel.update_payment_methods(
      //     {
      //       sub_merchant_id: submerchant_id,
      //       methods: "stored_card",
      //       mode:mode
      //     },
      //     update_data,
      //     "merchant_payment_methods"
      //   );
      // }
      // if (new_card) {
      //   let update_data = {
      //     others: new_card,
      //   };
      //   await SubmerchantModel.update_payment_methods(
      //     {
      //       sub_merchant_id: submerchant_id,
      //       methods: "card_payment",
      //       mode: mode
      //     },
      //     update_data,
      //     "merchant_payment_methods"
      //   );
      // }
      // branding inheritance start from here
      let submerchant_array = [];
      let super_merchant_details =
        await MerchantRegistrationModel.selectSuperMerchant({
          id: submerchant_id,
        });
      let first_submerchant_details =
        await MerchantModel.selectFistSubmentchant({
          super_merchant_id: super_merchant_details,
        });
      if (submerchant_id == first_submerchant_details.id) {
        let fetchAllSubMerchant = await MerchantModel.selectAllSubMerchant({
          super_merchant_id: super_merchant_details,
          onboarded_through_api: 1,
          inherit_mid: 1,
        });

        for (let s of fetchAllSubMerchant) {
          submerchant_array.push(s.id);
        }
      }
      if (submerchant_array.length > 0) {
        delete insdata.submerchant_id;
        await submerchatDraftModel.update(
          { submerchant_id: submerchant_array },
          insdata
        );
        let branding_data = {
          brand_color: first_submerchant_details.brand_color,
          accent_color: first_submerchant_details.accent_color,
          font_name: first_submerchant_details.font_name,
        };
        await submerchatDraftModel.updateMerchant(
          { id: submerchant_array },
          branding_data
        );
      }
      // branding inheritance end here
      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant branding updated successfully"));
    } catch (error) {
      console.log(error);
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  draftSave: async (req, res) => {
    try {
      let submerchant_id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      let language = await enc_dec.cjs_decrypt(req.bodyString("language"));

      insdata = {
        submerchant_id: submerchant_id,
        brand_color: req.bodyString("brand_color"),
        accent_color: req.bodyString("accent_color"),
        language: language,

        font_name: req.bodyString("font_name"),
        card_show: req.bodyString("show"),
      };

      let mode = req.body.env === "test" ? "test" : "live";

      if (req.body.env === mode) {
        insdata.test_card_payment_scheme =
          req.bodyString("card_payment") == ""
            ? null
            : req.bodyString("card_payment");
        insdata.test_stored_card_scheme =
          req.bodyString("stored_card") == ""
            ? null
            : req.bodyString("stored_card");
      } else {
        insdata.card_payment =
          req.bodyString("card_payment") == ""
            ? null
            : req.bodyString("card_payment");
        insdata.stored_card =
          req.bodyString("stored_card") == ""
            ? null
            : req.bodyString("stored_card");
      }

      let payment_methods = req.bodyString("payment_methods");
      //let new_card = req.bodyString("new_card");
      //let stored_card = req.bodyString("stored_card");
      let show = req.bodyString("show");
      let split_payment_methods = payment_methods.split(",");
      let split_show = show.split(",");
      let merchant_payment_methods = [];
      let count = 0;
      let i = 1;
      for (let method of split_payment_methods) {
        let temp = {
          submerchant_id: submerchant_id,
          methods: method,
          sequence: i,
          is_visible: split_show[count] == '' ? 1 : split_show[count],
          created_at: moment().format("YYYY-MM-DD HH:mm:s"),
          mode: mode,
        };
        i++;
        count++;
        merchant_payment_methods.push(temp);
      }

      const condition = {
        submerchant_id: submerchant_id,
      };
      const all_insert = merchant_payment_methods.map((val) => {
        if (val.methods === "apple_pay") {
          val.methods = "Apple Pay";
        }
        if (val.methods === "samsung_pay") {
          val.methods = "Samsung Pay";
        }
        if (val.methods === "stored_card") {
          val.others =
            req.body.env === mode
              ? insdata.test_stored_card_scheme
              : insdata.stored_card;
        }

        if (val.methods === "card_payment") {
          val.others =
            req.body.env === mode
              ? insdata.test_card_payment_scheme
              : insdata.card_payment;
        }

        submerchatDraftModel.add_draft_payment_method(
          {
            submerchant_id: submerchant_id,
            methods: val.methods,
            mode: mode,
          },
          val
        );
      });
      console.log(
        "🚀 ~ constall_insert=merchant_payment_methods.map ~ all_insert:",
        merchant_payment_methods
      );

      Promise.all(all_insert);

      if (req.all_files) {
        if (req.all_files.icon) {
          insdata.icon = req.all_files.icon;
        }
      }
      const saveResult = await submerchatDraftModel.get_count(condition);
      //console.log('insdata', insdata, saveResult);
      let message = "Submerchant branding draft save successfully";
      if (saveResult === 0) {
        $ins_id = await submerchatDraftModel.add(insdata);
      } else {
        $ins_id = await submerchatDraftModel.update(condition, insdata);
        message = "Submerchant branding draft updated successfully";
      }
      // branding inheritance start from here
      let submerchant_array = [];
      let super_merchant_details =
        await MerchantRegistrationModel.selectSuperMerchant({
          id: submerchant_id,
        });
      let first_submerchant_details =
        await MerchantModel.selectFistSubmentchant({
          super_merchant_id: super_merchant_details,
        });
      if (submerchant_id == first_submerchant_details.id) {
        let fetchAllSubMerchant = await MerchantModel.selectAllSubMerchant({
          super_merchant_id: super_merchant_details,
          onboarded_through_api: 1,
          inherit_mid: 1,
        });

        for (let s of fetchAllSubMerchant) {
          submerchant_array.push(s.id);
        }
      }
      if (submerchant_array.length > 0) {
        delete insdata.submerchant_id;
        await submerchatDraftModel.update(
          { submerchant_id: submerchant_array },
          insdata
        );
        let branding_data = {
          brand_color: first_submerchant_details.brand_color,
          accent_color: first_submerchant_details.accent_color,
          font_name: first_submerchant_details.font_name,
        };
        await submerchatDraftModel.updateMerchant(
          { id: submerchant_array },
          branding_data
        );
      }
      // branding inheritance end here

      res.status(statusCode.ok).send(response.successmsg(message));
    } catch (error) {
      console.log(error);
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  blocked: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      var insdata = {
        is_blocked: 1,
      };

      $ins_id = await SubmerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant blocked successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  unblocked: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      var insdata = {
        is_blocked: 0,
      };

      $ins_id = await SubmerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant unblocked successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  password: async (req, res) => {
    let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    SubmerchantModel.selectOne("password", { id: user_id, deleted: 0 })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let res1 = {
          password: await encrypt_decrypt("decrypt", val.password),
        };
        send_res = res1;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Password fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  add_mid: async (req, res) => {
    try {
      const v_submerchant_id = enc_dec.cjs_decrypt(
        req.body.data[0].submerchant_id
      );
      let ins_data = req.body.data;

      var fault = 0;
      var pass = 0;

      for (let i = 0; i < ins_data.length; i++) {
        // updating MID
        if (ins_data[i].mid_id) {
          MID_data = `'${ins_data[i].MID_up}'`;
          let data_id = await enc_dec.cjs_decrypt(ins_data[i].mid_id);
          let user_id = await enc_dec.cjs_decrypt(
            ins_data[i].submerchant_id_up
          );
          let psp_id = await enc_dec.cjs_decrypt(ins_data[i].psp_id_up);
          let currency_id = await enc_dec.cjs_decrypt(
            ins_data[i].currency_id_up
          );

          let payment_methods = ins_data[i].payment_methods;
          let payment_schemes = ins_data[i].payment_schemes;
          let transaction_allowed_daily = ins_data[i].transaction_allowed_daily;

          count_data = await SubmerchantModel.get_mid_count(
            {
              submerchant_id: user_id,
              psp_id: psp_id,
              currency_id: currency_id,
              MID: MID_data,

              payment_methods: `'${payment_methods}'`,
              payment_schemes: `'${payment_schemes}'`,
              transaction_allowed_daily: transaction_allowed_daily,
              deleted: 0,
            },
            data_id
          );

          if (count_data > 0) {
            fault++;
            // res.status(statusCode.ok).send({
            //     status: false,
            //     message: "Data exist",
            // });
          } else {
            temp = {
              submerchant_id: user_id,
              psp_id: psp_id,
              currency_id: currency_id,
              MID: ins_data[i].MID_up,

              payment_methods: payment_methods,
              payment_schemes: payment_schemes,
              transaction_allowed_daily: transaction_allowed_daily,
            };

            await SubmerchantModel.update_mid({ id: data_id }, temp);
            pass++;

            // res.status(statusCode.ok).send({
            //     status: true,
            //     message: "MID Updated successfully",
            // });
          }
        }

        // adding MID
        if (ins_data[i].psp_id) {
          MID_data = `'${ins_data[i].MID}'`;
          let user_id = await enc_dec.cjs_decrypt(ins_data[i].submerchant_id);
          let psp_id = await enc_dec.cjs_decrypt(ins_data[i].psp_id);
          let currency_id = await enc_dec.cjs_decrypt(ins_data[i].currency_id);
          let payment_methods = ins_data[i].payment_methods;
          let payment_schemes = ins_data[i].payment_schemes;
          let transaction_allowed_daily = ins_data[i].transaction_allowed_daily;
          let telr_v2_key = ins_data[i].telr_v2_key;

          count_data = await SubmerchantModel.get_mid_count(
            {
              submerchant_id: user_id,
              psp_id: psp_id,
              currency_id: currency_id,
              MID: MID_data,
              payment_methods: `'${payment_methods}'`,
              payment_schemes: `'${payment_schemes}'`,
              transaction_allowed_daily: transaction_allowed_daily,

              deleted: 0,
            },
            0
          );

          if (count_data === 0) {
            let temp = {
              submerchant_id: user_id,
              psp_id: psp_id,
              currency_id: currency_id,
              MID: ins_data[i].MID,
              payment_methods: payment_methods,
              payment_schemes: payment_schemes,
              transaction_allowed_daily: transaction_allowed_daily,
              v2_telr_kry: telr_v2_key,
              added_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            console.log("tem", temp);
            await SubmerchantModel.add_mid(temp).then(async (result) => {
              // pass++;
              let live_key_exits = await SubmerchantModel.checkLiveKeyExits({
                merchant_id: user_id,
                type: "live",
              });

              if (!live_key_exits) {
                let kay_data = {
                  merchant_id: user_id,
                  type: "live",
                  merchant_key: await helpers.make_order_number("live-"),
                  merchant_secret: await helpers.make_order_number("sec-"),
                  created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                };
                await SubmerchantModel.add_key(kay_data);
              }

              let add_live_data = {
                live: 1,
              };

              await SubmerchantModel.update_merchant(
                { id: user_id },
                add_live_data
              );

              const getsupermerchant = await SubmerchantModel.selectOne(
                "super_merchant_id",
                {
                  id: v_submerchant_id,
                }
              );
              await SubmerchantModel.updateSupermerchant(
                { id: getsupermerchant.super_merchant_id },
                add_live_data
              );
              let merchant_id = "";
              // let merchant_id = "123456";
              if (req.user.type == "admin") {
                merchant_id = await SubmerchantModel.getMerchantIdBySubMerchant(
                  { id: temp.submerchant_id }
                );
              } else {
                merchant_id = req.user.id;
              }

              let currency = await SubmerchantModel.fetchCurrencyName(
                temp.currency_id
              );
              let plan_exist = await checkifrecordexist(
                {
                  sub_merchant_id: temp.submerchant_id,
                  currency: currency.code,
                  status: 0,
                },
                "merchant_qr_codes"
              );
              if (!plan_exist) {
                const uuid = new SequenceUUID({
                  valid: true,
                  dashes: false,
                  unsafeBuffer: true,
                });
                let qr_id = uuid.generate();

                let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                let qr_data = {
                  mid_id: result.insertId,
                  merchant_id: merchant_id,
                  sub_merchant_id: temp.submerchant_id,
                  currency: currency.code,
                  qr_id: qr_id,
                  created_at: created_at,
                  type_of_qr_code: "Static_QR",
                };
                await qrGenerateModel
                  .add(qr_data)
                  .then(async (result_qr_add) => {
                    pass++;
                    // res.status(statusCode.ok).send({
                    //     status: true,
                    //     message: "Added successfully",
                    // });
                  })
                  .then((error) => {
                    fault++;
                    // res.status(
                    //     statusCode.internalError
                    // ).send(
                    //     response.errormsg(
                    //         "Something went wrong"
                    //     )
                    // );
                  });
              } else {
                pass++;
                // res.status(statusCode.ok).send({
                //     status: true,
                //     message: "Added successfully",
                // });
              }
            });
          } else {
            fault++;
            // res.status(statusCode.ok).send({
            //     status: false,
            //     message: "Data exist",
            // });
          }
        }

        //add
      }
      if (fault > 0 && pass === 0) {
        res.status(statusCode.ok).send({
          status: false,
          message: "Data exist",
        });
      } else {
        res.status(statusCode.ok).send({
          status: true,
          message: "MID added successfully",
        });
      }
    } catch (error) {
      winston.error(error);

      res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    }
  },

  delete_mid: async (req, res) => {
    try {
      let mid_id = await enc_dec.cjs_decrypt(req.bodyString("mid_id"));
      let find = await SubmerchantModel.selectOneMID("*", { id: mid_id });

      var insdata = {
        deleted: 1,
      };
      $ins_id = await SubmerchantModel.update_mid({ id: mid_id }, insdata);
      var qr = {
        status: 1,
      };

      $ins = await SubmerchantModel.update_qr({ mid_id: mid_id }, qr);
      res
        .status(statusCode.ok)
        .send(response.successmsg("MID deleted successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  create_mid: async (req, res) => {
    try {
      // decoding the data for mid
      const submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      const created_at = moment().format("YYYY-MM-DD HH:mm:ss");
      const psp_id = enc_dec.cjs_decrypt(req.bodyString("psp"));
      const currency_id = enc_dec.cjs_decrypt(req.bodyString("currency"));
      const country_id = enc_dec.cjs_decrypt(req.bodyString("country"));
      const country_name = await helpers.get_country_name_by_id(country_id);
      const currency = await CurrencyModel.selectOne("currency,code", {
        id: currency_id,
      });
      const req_payment_method = req.bodyString("payment_methods");
      const payment_scheme = req.bodyString("payment_schemes");
      console.log(req.body);
      if (!currency) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("invalid currency code!!"));
      }
      // make a mid data which will be inserted for all the mids
      let midData = {
        mode: req.bodyString("mode"),
        MID: req.bodyString("username"),
        password: req.bodyString("password"),
        psp_id: psp_id,
        currency_id: currency_id,
        supported_currency:req.body.supported_currency,
        submerchant_id: submerchant_id,
        payment_methods: req_payment_method,
        payment_schemes: req.bodyString("payment_schemes"),
        country_id: country_id,
        country_name: country_name,
        statementDescriptor: req.bodyString("statementDescriptor"),
        shortenedDescriptor: req.bodyString("shortenedDescriptor"),
        is3DS: req.bodyString("is3DS"),
        international: req.bodyString("international"),
        domestic: req.bodyString("domestic"),
        autoCaptureWithinTime: req.bodyString("autoCaptureWithinTime"),
        minTxnAmount: req.bodyString("minTxnAmount"),
        maxTxnAmount: req.bodyString("maxTxnAmount"),
        failure_url: req.bodyString("failure_url"),
        cancel_url: req.bodyString("cancel_url"),
        success_url: req.bodyString("success_url"),
        env: req.bodyString("env"),
        class: req.bodyString("class"),
        label: req.bodyString("label"),
        v2_telr_key: req.bodyString("telr_v2_key"),
        primary_key: req.bodyString("mid_primary_key") ?? "",
        is_inherited: 0,
        terminal_id: await helpers.make_sequential_no(),
      };
      if (req.user.type == "admin") {
        midData.allowRefunds = req.bodyString("allowRefunds");
        midData.allowVoid = req.bodyString("allowVoid");
        midData.voidWithinTime = req.bodyString("voidWithinTime");
      } else {
        midData.allowRefunds = 1;
        midData.allowVoid = 1;
        midData.voidWithinTime = 12;
      }
      console.log(`mid data`);
      console.log(midData);
      // find out super merchant by sub merchant id
      let super_merchant_details =
        await MerchantRegistrationModel.selectSuperMerchant({
          id: submerchant_id,
        });
      let first_submerchant_details =
        await MerchantModel.selectFistSubmentchant({
          super_merchant_id: super_merchant_details,
        });
      let submerchant_array = [{ id: submerchant_id }];
      if (submerchant_id == first_submerchant_details.id) {
        let fetchAllSubMerchant = await MerchantModel.selectAllSubMerchant({
          super_merchant_id: super_merchant_details,
          onboarded_through_api: 1,
          inherit_mid: 1,
        });

        for (let s of fetchAllSubMerchant) {
          submerchant_array.push({ id: s.id });
        }
      }

      // prepare routing order data for stored card and card payment
      //add to routing order//
      const routing_order_result = await RoutingModel.get(
        {
          sub_merchant_id: submerchant_id,
          payment_method: "stored_card",
          mode: midData.env,
        },
        "routing_order"
      );
      routing_order_result.reverse();
      let order_routing_stored_card_data;
      if (routing_order_result.length > 0) {
        order_routing_stored_card_data = {
          sub_merchant_id: submerchant_id,
          mode: midData.env,
          payment_method: "stored_card",
          mid_id: 0,
          retry: routing_order_result[0]?.retry,
          cascade: routing_order_result[0].cascade,
          routing_order: routing_order_result[0].routing_order + 1,
          created_at: created_at,
          updated_at: created_at,
        };
        // await RoutingModel.add(data, "routing_order");
      }

      const routing_order_re = await RoutingModel.get(
        {
          sub_merchant_id: submerchant_id,
          payment_method: "card_payment",
          mode: midData.env,
        },
        "routing_order"
      );
      let order_routing_card_payment_data;
      routing_order_re.reverse();
      if (routing_order_re.length > 0) {
        const order_routing_card_payment_data = {
          sub_merchant_id: submerchant_id,
          mode: midData.env,
          payment_method: "card_payment",
          mid_id: 0,
          retry: routing_order_re[0]?.retry,
          cascade: routing_order_re[0].cascade,
          routing_order: routing_order_re[0].routing_order + 1,
          created_at: created_at,
          updated_at: created_at,
        };
        // await RoutingModel.add(data, "routing_order");
      }
      // Now prepare the data for all the sub merchants

      // add mids in batch
      let midsBatch = [];
      let arrayOfMerchantWithIds = [];
      arrayOfMerchantWithIds.push(submerchant_id);
      for (let sub of submerchant_array) {
        let updatedMidData = { ...midData };
        updatedMidData.submerchant_id = sub.id;
        updatedMidData.is_inherited = sub.id != submerchant_id ? 1 : 0;
        updatedMidData.terminal_id = await helpers.make_sequential_no();
        midsBatch.push(updatedMidData);
        arrayOfMerchantWithIds.push(sub.id);
      }
      let midinsertedId = await SubmerchantModel.create(midsBatch, "mid");
      //  add mids end
      // make a mid id array
      let midsInserted = Array.from(
        { length: midinsertedId.affected_rows },
        (_, i) => midinsertedId.insertId + i
      );
      console.log(`mid insert id array is here`);
      console.log(midsInserted);
      // add order routing order start
      let storedCardRoutingOrderData = [];
      let cardPaymentRoutingOrderData = [];

      let bacthQRLogs = [];
      let i = 0;
      for (let sub of submerchant_array) {
        if (routing_order_result.length > 0) {
          let storeCard = { ...order_routing_stored_card_data };
          storeCard.sub_merchant_id = sub.id;
          storeCard.mid_id = midsInserted?.[i];
          storedCardRoutingOrderData.push(storeCard);
        }
        if (routing_order_re.length > 0) {
          let cardPayment = { ...order_routing_card_payment_data };
          cardPayment.sub_merchant_id = sub.id;
          cardPayment.mid_id = midsInserted?.[i];
          cardPaymentRoutingOrderData.push(cardPayment);
        }
        i++;
      }
      if (storedCardRoutingOrderData.length > 0) {
        await RoutingModel.add(storedCardRoutingOrderData, "routing_order");
      }
      if (cardPaymentRoutingOrderData.length > 0) {
        await RoutingModel.add(cardPaymentRoutingOrderData, "routing_order");
      }
      // add order routing order end
      // add Static QR start
      let batchQRCodes = [];
      let k = 0;
      for (let sub of submerchant_array) {
        const uuid = new SequenceUUID({
          valid: true,
          dashes: false,
          unsafeBuffer: true,
        });
        const qr_id = uuid.generate();
        let qr_data = {
          mid_id: midsInserted?.[k],
          merchant_id: super_merchant_details || 0,
          sub_merchant_id: sub.id,
          currency: currency.code,
          qr_id: qr_id,
          created_at: created_at,
          type_of_qr_code: "Static_QR",
          mode: req.bodyString("env"),
        };
        batchQRCodes.push(qr_data);
        k++;
      }
      let staticQrInserted = await qrGenerateModel.add(batchQRCodes);
      // add Static QR Ends
      // add static QR Logs
      let qrInsertedid = Array.from(
        { length: staticQrInserted.affected_rows },
        (_, i) => staticQrInserted.insertId + i
      );
      let batchQRLogs = [];
      let j = 0;
      for (let sub of submerchant_array) {
        let logs_data = {
          merchant_id: super_merchant_details || 0,
          sub_merchant_id: sub.id,
          currency: currency.code,
          qr_id: qrInsertedid[j],
          created_at: created_at,
          updated_at: created_at,
          type_of_qr_code: "Static_QR",
          activity: "Created",
          created_by: req.user.id,
        };
        batchQRLogs.push(logs_data);
        j++;
      }
      await qrGenerateModel.add_logs(batchQRLogs);
      // add QR logs End
      // if live mid then make merchant to live
      if (super_merchant_details && req.bodyString("env") == "live") {
        let check_live = await SubmerchantModel.get_super_merchant_count(
          { live: 0 },
          super_merchant_details
        );
        var insert_data = {
          live: 1,
          updated_at: created_at,
        };
        await SubmerchantModel.update(
          { id: super_merchant_details },
          insert_data,
          "master_super_merchant"
        );
      }
      // prepare batch inserting the data of branding
      const merchantsData = submerchant_array.map((merchant) => ({
        submerchant_id: merchant.id,
        psp: psp_id,
        req_payment_method: req_payment_method,
        payment_scheme: payment_scheme,
        mode: req.bodyString("env"),
        domestic: req.bodyString("domestic") || 0,
        international: req.bodyString("international") || 0,
        update: false,
      }));
      await processMerchantsBatch(merchantsData);

      return res
        .status(statusCode.ok)
        .send(response.successmsg("MID added successfully"));
    } catch (error) {
      console.log(error);
      winston.error(error);

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error));
    }
  },

  update_mid: async (req, res) => {
    try {
      const id = enc_dec.cjs_decrypt(req.body.mid_id);
      const submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      const psp = enc_dec.cjs_decrypt(req.bodyString("psp"));
      // console.log('update_mid');
      //console.log('psp', psp);
      const currency_id = enc_dec.cjs_decrypt(req.bodyString("currency"));
      const country_id = enc_dec.cjs_decrypt(req.bodyString("country"));
      const country_name = await helpers.get_country_name_by_id(country_id);
      const currency = CurrencyModel.selectOne("currency", {
        id: currency_id,
      });
      const req_payment_method = req.bodyString("payment_methods");
      if (!currency) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("invalid currency code!!"));
      }
      let mid_Data = {
        mode: req.bodyString("mode"),
        MID: req.bodyString("username"),
        password: req.bodyString("password"),
        //psp_id: psp,
        currency_id: currency_id,
        supported_currency:req.body.supported_currency,
        // submerchant_id: submerchant_id,
        payment_methods: req_payment_method,
        payment_schemes: req.bodyString("payment_schemes"),
        // transaction_allowed_daily: req.bodyString(
        //     "transaction_allowed_daily"
        // ),

        country_id: country_id,
        country_name: country_name,
        statementDescriptor: req.bodyString("statementDescriptor"),
        shortenedDescriptor: req.bodyString("shortenedDescriptor"),
        is3DS: req.bodyString("is3DS"),

        international: req.bodyString("international"),
        domestic: req.bodyString("domestic"),

        minTxnAmount: req.bodyString("minTxnAmount"),
        maxTxnAmount: req.bodyString("maxTxnAmount"),
        failure_url: req.bodyString("failure_url"),
        cancel_url: req.bodyString("cancel_url"),
        success_url: req.bodyString("success_url"),
        class: req.bodyString("class"),
        label: req.bodyString("label"),
        v2_telr_key: req.bodyString("telr_v2_key"),
        autoCaptureWithinTime: req.bodyString("autoCaptureWithinTime"),
        primary_key: req.bodyString("mid_primary_key"),
      };

      if (req.user.type == "admin") {
        mid_Data.allowRefunds = req.bodyString("allowRefunds");
        mid_Data.allowVoid = req.bodyString("allowVoid");
        mid_Data.voidWithinTime = req.bodyString("voidWithinTime");
      }

      await SubmerchantModel.update({ id: id }, mid_Data, "mid");
      /* Old branding*/
      // await brandingCreateOrUpdate(submerchant_id, psp, req_payment_method, req);
      // delete merchant payment method
      let deletePaymentMethod = await SubmerchantModel.deletePaymentMethod(
        submerchant_id,
        req.bodyString("env")
      );
      // delete merchant draft payment method
      let deleteDraftPaymentMethod =
        await SubmerchantModel.deleteDraftPaymentMethod(
          submerchant_id,
          req.bodyString("env")
        );
      // fetch  available payment methods and payment scheme overall mid
      let midDetails = await SubmerchantModel.fetchPaymentMethodAndSchemes(
        submerchant_id,
        req.bodyString("env")
      );
      let payment_methods = "";
      let payment_schemes = "";
      if (midDetails) {
        payment_methods = midDetails.unique_payment_methods;
        payment_schemes = midDetails.unique_payment_schemes;
        req.body.payment_schemes = payment_schemes;
      }
      // add available payment methods
      let addUpdatePaymentMethods = await addMidBranding(
        submerchant_id,
        "",
        payment_methods,
        req,
        true
      );

      // // find out its immediate sub merchant of super merchant
      let super_merchant_details =
        await MerchantRegistrationModel.selectSuperMerchant({
          id: submerchant_id,
        });

      let first_submerchant_details =
        await MerchantModel.selectFistSubmentchant({
          super_merchant_id: super_merchant_details,
        });
      if (submerchant_id == first_submerchant_details.id) {
        //find out all the sub merchant of super merchant
        let fetchAllSubMerchant = await MerchantModel.selectAllSubMerchant({
          super_merchant_id: super_merchant_details,
          onboarded_through_api: 1,
          inherit_mid: 1,
        });
        let fetchSuperMerchantMidDetails = await SubmerchantModel.selectOneMID(
          "psp_id,env,currency_id,country_id",
          { id: id }
        );
        let super_mid = fetchSuperMerchantMidDetails?.[0];
        /*************************************  Updated code START  ******************************************/
        //making merchant array
        let sub_merchant_array = [];
        sub_merchant_array.push(submerchant_id);
        for (let mer of fetchAllSubMerchant) {
          sub_merchant_array.push(mer.id);
        }
        //find out inherited mids
        let mids = await SubmerchantModel.selectIneritedMids("id", {
          submerchant_id: sub_merchant_array,
          psp_id: super_mid.psp_id,
          env: super_mid.env,
          country_id: super_mid.country_id,
          is_inherited: 1,
          deleted: 0,
        });
        let midIdArray = [];
        if (mids.length > 0) {
          const midIdArray = mids.map((obj) => obj.id);
          // bulk update the mid
          await SubmerchantModel.update({ id: midIdArray }, mid_Data, "mid");
          //delete the payment methods
          await SubmerchantModel.bulkDeletePaymentMethods(
            sub_merchant_array,
            req.bodyString("env")
          );
          //delete the draft payment methods
          await SubmerchantModel.bulkDeleteDraftPaymentMethods(
            sub_merchant_array,
            req.bodyString("env")
          );
          //insert payment method and draft payment method
          // prepare batch inserting the data of branding
          //fetch the updated payment method, payment schemes, domestic and international
          let midDetails = await SubmerchantModel.fetchPaymentMethodAndSchemes(
            submerchant_id,
            req.bodyString("env")
          );
          const merchantsData = sub_merchant_array.map((merchant) => ({
            submerchant_id: merchant,
            psp: midDetails.psp,
            req_payment_method: midDetails.unique_payment_methods,
            payment_scheme: midDetails.unique_payment_schemes,
            mode: req.bodyString("env"),
            domestic: midDetails.domestic || 0,
            international: midDetails.international || 0,
            update: false,
          }));
          await processMerchantsBatch(merchantsData);
        }

        /*************************************  Updated code ENDS  ******************************************/

        /*************************************  OLD CODE START FROM HERE  ******************************************/
        /* if (super_mid) {
          for (let mer of fetchAllSubMerchant) {
            let isInheritedMid = await SubmerchantModel.selectOneMID("id", {
              submerchant_id: mer.id,
              psp_id: super_mid.psp_id,
              env: super_mid.env,
              country_id: super_mid.country_id,
              is_inherited: 1,
              deleted: 0,
            });
            let inheritedMidID = isInheritedMid?.[0]?.id;
            if (inheritedMidID) {
              mid_Data.submerchant_id = mer.id;
              console.log(
                `inside the inherited mid ${inheritedMidID} and merchant id below`
              );
              console.log(mer.id);
              console.log(mid_Data);
              await SubmerchantModel.update(
                { id: inheritedMidID },
                mid_Data,
                "mid"
              );
            }
            // await brandingCreateOrUpdate(mer.id, psp, req_payment_method, req);
            // delete merchant payment method
            deletePaymentMethod = await SubmerchantModel.deletePaymentMethod(
              mer.id,
              req.bodyString("env")
            );
            // delete merchant draft payment method
            deleteDraftPaymentMethod =
              await SubmerchantModel.deleteDraftPaymentMethod(
                mer.id,
                req.bodyString("env")
              );
            // fetch  available payment methods and payment scheme overall mid
            midDetails = await SubmerchantModel.fetchPaymentMethodAndSchemes(
              mer.id,
              req.bodyString("env")
            );
            let payment_methods = "";
            let payment_schemes = "";
            if (midDetails) {
              payment_methods = midDetails.unique_payment_methods;
              payment_schemes = midDetails.unique_payment_schemes;
              req.body.payment_schemes = payment_schemes;
            }
            // add available payment methods
            let addUpdatePaymentMethods = await addMidBranding(
              mer.id,
              "",
              payment_methods,
              req,
              true
            );
          }
        } */
      }

      return res
        .status(statusCode.ok)
        .send(response.successmsg("MID updated successfully"));
    } catch (error) {
      console.log(error);
      winston.error(error);

      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },

  delete_mid_new: async (req, res) => {
    try {
      const id = enc_dec.cjs_decrypt(req.bodyString("mid_id"));
      const sub_merchant = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );

      let userData = { deleted: 1 };
      await SubmerchantModel.update({ id: id }, userData, "mid");
      let count = await SubmerchantModel.get_count_mid("mid", {
        submerchant_id: sub_merchant,
        deleted: 0,
      });

      await SubmerchantModel.delete_payment_method("routing_order", {
        mid_id: id,
        sub_merchant_id: sub_merchant,
      });
      let fetchSuperMerchantMidDetails = await SubmerchantModel.selectOneMID(
        "psp_id,env,currency_id,country_id",
        { id: id }
      );
      let super_mid = fetchSuperMerchantMidDetails?.[0];
      // await brandingDelete(id, sub_merchant);

      /* Update payment method and other things for merchant*/
      let deletePaymentMethod = await SubmerchantModel.deletePaymentMethod(
        sub_merchant,
        super_mid.env
      );
      // delete merchant draft payment method
      let deleteDraftPaymentMethod =
        await SubmerchantModel.deleteDraftPaymentMethod(
          sub_merchant,
          super_mid.env
        );
      // fetch  available payment methods and payment scheme overall mid
      let midDetails = await SubmerchantModel.fetchPaymentMethodAndSchemes(
        sub_merchant,
        super_mid.env
      );
      let payment_methods = "";
      let payment_schemes = "";
      if (midDetails) {
        payment_methods = midDetails.unique_payment_methods;
        payment_schemes = midDetails.unique_payment_schemes;
        req.body.payment_schemes = payment_schemes;
      }
      // add available payment methods
      req.body.env = super_mid.env;
      let addUpdatePaymentMethods = await addMidBranding(
        sub_merchant,
        "",
        payment_methods,
        req,
        true
      );

      /* End here*/

      if (count == 0) {
        await SubmerchantModel.update(
          { sub_merchant_id: sub_merchant, type_of_qr_code: "Static_QR" },
          { is_reseted: 1, is_expired: 1 },
          "merchant_qr_codes"
        );
      }
      //fetch super merchant details
      let super_merchant_details =
        await MerchantRegistrationModel.selectSuperMerchant({
          id: sub_merchant,
        });
      //find out first merchant details
      let first_submerchant_details =
        await MerchantModel.selectFistSubmentchant({
          super_merchant_id: super_merchant_details,
        });
      //check if immediate sub merchant
      if (sub_merchant == first_submerchant_details.id) {
        //find out all the sub merchant of super merchant
        let fetchAllSubMerchant = await MerchantModel.selectAllSubMerchant({
          super_merchant_id: super_merchant_details,
          onboarded_through_api: 1,
          inherit_mid: 1,
        });
        //get mid details

        if (super_mid) {
          /********************  NEW CODE START ********************************************/
          let sub_merchant_array = [];
          for (let mer of fetchAllSubMerchant) {
            sub_merchant_array.push(mer.id);
          }
          //find out inherited mids
          if (sub_merchant_array.length > 0) {
            let mids = await SubmerchantModel.selectIneritedMids("id", {
              submerchant_id: sub_merchant_array,
              psp_id: super_mid.psp_id,
              env: super_mid.env,
              country_id: super_mid.country_id,
              is_inherited: 1,
              deleted: 0,
            });
            let midIdArray = [];
            if (mids.length > 0) {
              const midIdArray = mids.map((obj) => obj.id);
              // bulk update the mid
              await SubmerchantModel.update(
                { id: midIdArray },
                { deleted: 1 },
                "mid"
              );
              //delete the payment methods
              await SubmerchantModel.bulkDeletePaymentMethods(
                sub_merchant_array,
                req.bodyString("env")
              );
              //delete the draft payment methods
              await SubmerchantModel.bulkDeleteDraftPaymentMethods(
                sub_merchant_array,
                req.bodyString("env")
              );
              //insert payment method and draft payment method
              // prepare batch inserting the data of branding
              // fetch other payment methods available with other mids
              let midDetails =
                await SubmerchantModel.fetchPaymentMethodAndSchemes(
                  sub_merchant,
                  super_mid.env
                );
              if (midDetails) {
                const merchantsData = sub_merchant_array.map((merchant) => ({
                  submerchant_id: merchant,
                  psp: midDetails.psp,
                  req_payment_method: midDetails.unique_payment_methods,
                  payment_scheme: midDetails.unique_payment_schemes,
                  mode: midDetails.env,
                  domestic: midDetails.domestic || 0,
                  international: midDetails.international || 0,
                  update: false,
                }));
                await processMerchantsBatch(merchantsData);
                // check for mid count if zero then remove QR codes
                let countMidDetails = await SubmerchantModel.get_bulk_count_mid(
                  sub_merchant_array
                );
                console.log(countMidDetails);

                if (countMidDetails.length > 0) {
                  let merchantMidCountZero = countMidDetails
                    .filter((item) => item.count == 0)
                    .map((item) => item.submerchant_id);
                  if (merchantMidCountZero.length > 0) {
                    await SubmerchantModel.update(
                      { sub_merchant_id: merchantMidCountZero },
                      { is_reseted: 1, is_expired: 1 },
                      "merchant_qr_codes"
                    );
                  }
                }
              }
            }
          }

          /********************  NEW CODE END ********************************************/

          /********************  OLD CODE START ********************************************/
          /*  for (let mer of fetchAllSubMerchant) {
            let isInheritedMid = await SubmerchantModel.selectOneMID("id", {
              submerchant_id: mer.id,
              psp_id: super_mid.psp_id,
              env: super_mid.env,
              country_id: super_mid.country_id,
              is_inherited: 1,
              deleted: 0,
            });
            console.log(`isInheritedMid`);
            let inheritedMidID = isInheritedMid?.[0]?.id;
            if (inheritedMidID) {
              let updatedMidData = { deleted: 1 };
              await SubmerchantModel.update(
                { id: inheritedMidID },
                updatedMidData,
                "mid"
              );
              await SubmerchantModel.delete_payment_method("routing_order", {
                mid_id: inheritedMidID,
                sub_merchant_id: mer.id,
              });

              // await brandingDelete(inheritedMidID, mer.id);
            }

            let countMid = await SubmerchantModel.get_count_mid("mid", {
              submerchant_id: mer.id,
              deleted: 0,
            });

            if (countMid == 0) {
              await SubmerchantModel.update(
                { sub_merchant_id: mer.id, type_of_qr_code: "Static_QR" },
                { is_reseted: 1, is_expired: 1 },
                "merchant_qr_codes"
              );
            }

            // Update payment method and other things for merchant 
            deletePaymentMethod = await SubmerchantModel.deletePaymentMethod(
              mer.id,
              super_mid.env
            );
            // delete merchant draft payment method
            deleteDraftPaymentMethod =
              await SubmerchantModel.deleteDraftPaymentMethod(
                mer.id,
                super_mid.env
              );
            // fetch  available payment methods and payment scheme overall mid
            midDetails = await SubmerchantModel.fetchPaymentMethodAndSchemes(
              mer.id,
              super_mid.env
            );
            payment_methods = "";
            payment_schemes = "";
            if (midDetails) {
              payment_methods = midDetails.unique_payment_methods;
              payment_schemes = midDetails.unique_payment_schemes;
              req.body.payment_schemes = payment_schemes;
            }
            // add available payment methods
            addUpdatePaymentMethods = await addMidBranding(
              mer.id,
              "",
              payment_methods,
              req,
              true
            );

            // End here
          } */
        }
      }

      return res
        .status(statusCode.ok)
        .send(response.successmsg("MID deleted successfully"));
    } catch (error) {
      console.log(error);
      winston.error(error);

      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },

  activated_mid_new: async (req, res) => {
    try {
      const id = enc_dec.cjs_decrypt(req.bodyString("mid_id"));
      let userData = { status: 0 };
      await SubmerchantModel.update({ id: id }, userData, "mid");
      return res
        .status(statusCode.ok)
        .send(response.successmsg("MID activated successfully"));
    } catch (error) {
      winston.error(error);

      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  deactivated_mid_new: async (req, res) => {
    try {
      const id = enc_dec.cjs_decrypt(req.bodyString("mid_id"));
      let userData = { status: 1 };
      await SubmerchantModel.update({ id: id }, userData, "mid");
      return res
        .status(statusCode.ok)
        .send(response.successmsg("MID deactivated successfully"));
    } catch (error) {
      winston.error(error);

      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },

  list_mid_new: async (req, res) => {
    try {
      const submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      let condition = {
        status: 0,
        deleted: 0,
      };
      if (req.user.type == "merchant") {
        condition["env"] = req.bodyString("env");
      }
      let limit = {
        perpage: 0,
        start: 0,
      };
      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));
        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      if (submerchant_id) {
        condition["submerchant_id"] = submerchant_id;
      }

      const totalCount = await SubmerchantModel.get_count_mid("mid", condition);

      await SubmerchantModel.selectOneMID("*", condition)
        .then(async (result) => {
          // console.log("result", result);
          let send_res = [];
          for (val of result) {
            const sell_rate_count = await SubmerchantModel.get_count_sell_mid(
              "master_mid_sellrate",
              { mid: val.id, deleted: 0 }
            );
            let temp = {
              id: val?.id ? enc_dec.cjs_encrypt(val.id) : "",
              sub_merchant_id: val.submerchant_id
                ? enc_dec.cjs_encrypt(val.submerchant_id)
                : "",
              username: val?.MID ? val?.MID : "",
              password: val?.password ? val?.password : "",
              psp: val?.psp_id ? val?.psp_id : "",
              psp_name: val?.psp_id
                ? await helpers.get_psp_name_by_id(val.psp_id)
                : "",
              payment_methods: val?.payment_methods || "",
              payment_schemes: val?.payment_schemes || "",
              // transaction_allowed_daily:
              //     val?.transaction_allowed_daily || "",
              currency: val?.currency_id ? val?.currency_id : "",
              currency_name: val?.currency_id
                ? await helpers.get_currency_name_by_id(val.currency_id)
                : "",
              supported_currency:val.supported_currency,  
              status: parseInt(val?.deleted) === 0 ? "Active" : "Inactive",

              country_id: val?.country_id
                ? enc_dec.cjs_encrypt(val?.country_id)
                : "",
              country_name: val?.country_name ? val?.country_name : "",
              statementDescriptor: val?.statementDescriptor
                ? val?.statementDescriptor
                : "",
              shortenedDescriptor: val?.shortenedDescriptor
                ? val?.shortenedDescriptor
                : "",
              is3DS: val?.is3DS == 0 ? 0 : 1,
              allowRefunds: val?.allowRefunds == 0 ? 0 : 1,
              allowVoid: val?.allowVoid == 0 ? 0 : 1,
              international: val?.international == 0 ? 0 : 1,
              domestic: val?.domestic == 0 ? 0 : 1,
              voidWithinTime: val?.voidWithinTime ? val?.voidWithinTime : "",
              autoCaptureWithinTime: val?.autoCaptureWithinTime
                ? val?.autoCaptureWithinTime
                : "",
              minTxnAmount: val?.minTxnAmount ? val?.minTxnAmount : "",
              maxTxnAmount: val?.maxTxnAmount ? val?.maxTxnAmount : "",
              failure_url: val?.failure_url ? val?.failure_url : "",
              cancel_url: val?.cancel_url ? val?.cancel_url : "",
              success_url: val?.success_url ? val?.success_url : "",
              sell_rate_count: sell_rate_count,
              env: val?.env,
              class: val?.class,
              mode: val?.mode,
              label: val?.label,
              v2_telr_key: val?.v2_telr_key,
              terminal_id: val?.terminal_id,
              primary_key: val?.primary_key,
            };
            send_res.push(temp);
          }
          return res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "List fetched successfully.",
                totalCount
              )
            );
        })
        .catch((error) => {
          winston.error(error);
          console.log("error", error);
          return res
            .status(statusCode.internalError)
            .send(response.errormsg(error));
        });
    } catch (error) {
      winston.error(error);

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error));
    }
  },

  get_list_mid: async (req, res) => {
    const submerchant_id = enc_dec.cjs_decrypt(
      req.bodyString("submerchant_id")
    );
    let condition = {
      status: 0,
      deleted: 0,
    };

    if (submerchant_id !== "") {
      condition["submerchant_id"] = submerchant_id;
    }

    await SubmerchantModel.selectOneMID("*", condition)
      .then(async (result) => {
        // console.log("🚀 ~ .then ~ result:", result);
        let send_res = [];
        for (val of result) {
          let temp = {
            id: val?.id ? enc_dec.cjs_encrypt(val.id) : "",
            sub_merchant_id: val.submerchant_id
              ? enc_dec.cjs_encrypt(val.submerchant_id)
              : "",
            username: val?.MID ? val?.MID : "",
            password: val?.password ? val?.password : "",
            psp: val?.psp_id ? val?.psp_id : "",
            psp_name: val?.psp_id
              ? await helpers.get_psp_name_by_id(val.psp_id)
              : "",
            payment_methods: val?.payment_methods || "",
            payment_schemes: val?.payment_schemes || "",
            // transaction_allowed_daily:
            //     val?.transaction_allowed_daily || "",
            currency: val?.currency_id ? val?.currency_id : "",

            status: parseInt(val?.deleted) === 0 ? "Active" : "Inactive",

            country_id: val?.country_id
              ? enc_dec.cjs_encrypt(val?.country_id)
              : "",
            country_name: val?.country_name ? val?.country_name : "",
            statementDescriptor: val?.statementDescriptor
              ? val?.statementDescriptor
              : "",
            shortenedDescriptor: val?.shortenedDescriptor
              ? val?.shortenedDescriptor
              : "",
            is3DS: val?.is3DS == 0 ? 0 : 1,
            allowRefunds: val?.allowRefunds == 0 ? 0 : 1,
            allowVoid: val?.allowVoid == 0 ? 0 : 1,
            international: val?.international == 0 ? 0 : 1,
            domestic: val?.domestic == 0 ? 0 : 1,
            voidWithinTime: val?.voidWithinTime ? val?.voidWithinTime : "",
            autoCaptureWithinTime: val?.autoCaptureWithinTime
              ? val?.autoCaptureWithinTime
              : "",
            minTxnAmount: val?.minTxnAmount ? val?.minTxnAmount : "",
            maxTxnAmount: val?.maxTxnAmount ? val?.maxTxnAmount : "",
            failure_url: val?.failure_url ? val?.failure_url : "",
            cancel_url: val?.cancel_url ? val?.cancel_url : "",
            success_url: val?.success_url ? val?.success_url : "",
            env: val?.env,
            class: val?.class,
            mode: val?.mode,
            label: val?.label,
            v2_telr_key: val?.v2_telr_key,
            terminal_id: val?.terminal_id,
          };
          send_res.push(temp);
        }
        return res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "List fetched successfully.", 0)
          );
      })
      .catch((error) => {
        winston.error(error);
        console.log("error", error);
        return res
          .status(statusCode.internalError)
          .send(response.errormsg(error));
      });
  },
  list_mid_psp: async (req, res) => {
    try {
      const submerchant_id = req?.user?.id;
      let condition = {
        "midp.status": 0,
        "midp.deleted": 0,
        "midp.submerchant_id": submerchant_id,
      };

      if (req?.user?.type == "merchant") {
        condition["env"] = req.bodyString("env");
      }
      const mid_psp = await SubmerchantModel.list_mid_psp(condition);
      let send_res = [mid_psp];

      return res
        .status(statusCode.ok)
        .send(response.successdatamsg(send_res, "List fetched successfully."));
    } catch (error) {
      winston.error(error);

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error));
    }
  },
  list_details: async (req, res) => {
    try {
      const mid = enc_dec.cjs_decrypt(req.bodyString("mid"));
      let condition = {
        deleted: 0,
        id: mid,
      };
      SubmerchantModel.selectOneMID("*", condition)
        .then(async (result) => {
          const data = result[0];
          const getpsp = await PspModel.selectOne("*", {
            id: data.psp_id,
          });

          const currency = await CurrencyModel.selectOne("currency,code", {
            id: data?.currency_id,
          });
          const temp = {
            id: data?.id ? enc_dec.cjs_encrypt(data?.id) : "",
            sub_merchant_id: data?.submerchant_id
              ? enc_dec.cjs_encrypt(data?.submerchant_id)
              : "",
            psp_id: data?.psp_id ? enc_dec.cjs_encrypt(data?.psp_id) : "",
            psp_name: getpsp?.name || "",
            MID: data?.MID || "",
            password: data?.password || "",
            primary_key: data?.primary_key || "",
            currency: currency?.code || "",
            supported_currency:data.supported_currency,
            mode: data?.mode || "",
            payment_methods: data?.payment_methods || "",
            payment_schemes: data?.payment_schemes || "",
            // transaction_allowed_daily:
            //     data?.transaction_allowed_daily
            //         ? data?.transaction_allowed_daily
            //         : "",
            status: parseInt(data?.deleted) === 0 ? "Active" : "Inactive",

            country_id: data?.country_id
              ? enc_dec.cjs_encrypt(data?.country_id)
              : "",
            country_name: data?.country_name ? data?.country_name : "",
            statementDescriptor: data?.statementDescriptor
              ? data?.statementDescriptor
              : "",
            shortenedDescriptor: data?.shortenedDescriptor
              ? data?.shortenedDescriptor
              : "",
            is3DS: data?.is3DS == 0 ? 0 : 1,
            allowRefunds: data?.allowRefunds == 0 ? 0 : 1,
            allowVoid: data?.allowVoid == 0 ? 0 : 1,
            international: data?.international == 0 ? 0 : 1,
            domestic: data?.domestic == 0 ? 0 : 1,
            voidWithinTime: data?.voidWithinTime ? data?.voidWithinTime : "",
            autoCaptureWithinTime: data?.autoCaptureWithinTime
              ? data?.autoCaptureWithinTime
              : "",
            minTxnAmount: data?.minTxnAmount ? data?.minTxnAmount : "",
            maxTxnAmount: data?.maxTxnAmount ? data?.maxTxnAmount : "",
            failure_url: data?.failure_url ? data?.failure_url : "",
            cancel_url: data?.cancel_url ? data?.cancel_url : "",
            success_url: data?.success_url ? data?.success_url : "",
            env: data?.env ? data?.env : "",
            class: data?.class ? data?.class : "",
            label: data?.label ? data?.label : "",
            v2_telr_key: data?.v2_telr_key ? data?.v2_telr_key : "",
          };

          return res
            .status(statusCode.ok)
            .send(response.successdatamsg(temp, "List fetched successfully."));
        })
        .catch((error) => {
          winston.error(error);

          return res
            .status(statusCode.internalError)
            .send(response.errormsg(error));
        });
    } catch (error) {
      winston.error(error);

      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error));
    }
  },
  add_secret_key: async (req, res) => {
    try {
      const submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      const type = req.bodyString("type") == "sandbox" ? "test" : "live";
      const key = await helpers.make_order_number(type + "-");
      const secret = await helpers.make_order_number("sec-");
      kay_data = {
        super_merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        merchant_id: submerchant_id,
        type: type,
        merchant_key: key,
        merchant_secret: secret,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      let ins_id = await SubmerchantModel.add_key(kay_data);

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            { id: enc_dec.cjs_encrypt(ins_id.insertId) },
            "Generated successfully"
          )
        );
    } catch (error) {
      winston.error(error);

      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  secret_key_list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    const super_merchant = req.user.super_merchant_id
      ? req.user.super_merchant_id
      : req.user.id;
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let filter_arr = { super_merchant_id: super_merchant };

    if (req.bodyString("status") == "Active") {
      filter_arr.deleted = 0;
    }
    if (req.bodyString("status") == "Deactivated") {
      filter_arr.deleted = 1;
    }
    if (req.bodyString("submerchant_id")) {
      filter_arr.merchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
    }
    SubmerchantModel.select_list(
      filter_arr,
      limit,
      "master_merchant_key_and_secret"
    )
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            key_id: enc_dec.cjs_encrypt(val.id),
            super_merchant: enc_dec.cjs_encrypt(val.super_merchant_id),
            submerchant_id: enc_dec.cjs_encrypt(val.merchant_id),
            submerchant_name: await helpers.get_sub_merchant_name_by_id(
              val.merchant_id
            ),
            type: val.type == "test" ? "Sandbox" : "Live",
            merchant_key: val.merchant_key,
            merchant_secret: val.merchant_secret,
            status: val.deleted == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }
        total_count = await SubmerchantModel.get_key_count(filter_arr);
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
  deactive_key: async (req, res) => {
    try {
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await SubmerchantModel.update_key({ id: id }, insdata);

      res
        .status(statusCode.ok)
        .send(response.successmsg("Deactivated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  mid_currency: async (req, res) => {
    try {
      const submerchant_id = await enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );

      const selection = "msc.currency , msc.code";
      const condition = {
        "mi.submerchant_id": submerchant_id,
        "mi.deleted": 0,
        "mi.env": req.body.mode,
      };
      const ins_id = await SubmerchantModel.fetch_Currency_Select(
        selection,
        condition
      );
      const arrs = [].concat(ins_id);
      const noDuplicate = (arr) => [...new Set(arr)];
      const allIds = arrs.map((ele) => ele.currency);
      const ids = noDuplicate(allIds);

      var result = ids.map((id) =>
        arrs.reduce((self, item) => {
          return item.currency === id ? { ...self, ...item } : self;
        }, {})
      );
      let send_res = [];
      for (let val of result) {
        let resp = {
          code: val.code ? val.code : "",
          currency: val.currency ? val.currency : "",
        };
        send_res.push(resp);
      }
      res.status(statusCode.ok).send(response.successdatamsg(send_res));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  submerchant_features_add: async (req, res) => {
    try {
      let data_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
      let check_feature = await SubmerchantModel.selectDynamic(
        "features",
        { id: data_id },
        "master_merchant"
      );
      let feature_id = req.bodyString("feature_id").split(",");
      let feature_array = [];
      for (val of feature_id) {
        feature_array.push(enc_dec.cjs_decrypt(val));
      }

      userData = {
        features: feature_array.join(","),
      };

      $ins_id = await SubmerchantModel.update(
        { id: data_id },
        userData,
        "master_merchant"
      );

      if (check_feature.features.length == 0) {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Features added successfully"));
      } else {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Features updated successfully"));
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_add_mid: async (req, res) => {
    try {
      let mid_id = req.bodyString("mid_id");
      if (mid_id != "") {
        let mid_data = await SubmerchantModel.selectDynamic(
          "*",
          { id: req.bodyString("mid_id") },
          "mid"
        );
        mid_data.submerchant_id = req.credentials.merchant_id;
        mid_data.terminal_id = await helpers.cerate_terminalid();
        mid_data.added_at = moment().format("YYYY-MM-DD HH:mm:ss");
        delete mid_data["id"];
        let addMid = await SubmerchantModel.add_mid(mid_data);
        res
          .status(statusCode.ok)
          .send(
            response.registrationDataResponse([], "Mid added successfully!")
          );
      } else {
        let psp_details = await SubmerchantModel.selectDynamic(
          "*",
          { credentials_key: req.bodyString("psp") },
          "psp"
        );
        if (psp_details) {
          let currency = await helpers.get_currency_details({
            code: req.bodyString("currency"),
            deleted: 0,
          });
          if (currency) {
            let country_details = await helpers.get_country_details_by_code(
              req.bodyString("country")
            );
            if (country_details) {
              // country, currency and psp is valid add mid now
              console.log(req.credentials);
              console.log(currency, country_details, psp_details);
              let label =
                country_details.country_name +
                "-" +
                psp_details.name +
                "-" +
                currency.code;
              let mid_details = {
                submerchant_id: req.credentials.merchant_id,
                terminal_id: await helpers.cerate_terminalid(),
                currency_id: currency.id,
                psp_id: psp_details.id,
                MID: req.bodyString("key"),
                password: req.bodyString("secret"),
                payment_methods: psp_details.payment_methods,
                payment_schemes: psp_details.payment_schemes,
                transaction_allowed_daily: 0,
                status: 0,
                deleted: 0,
                added_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                country_id: country_details.id,
                country_name: country_details.country_name,
                statementDescriptor: "",
                shortenedDescriptor: "",
                is3DS: 0,
                allowRefunds: 1,
                allowVoid: 1,
                domestic: 1,
                international: 1,
                voidWithinTime: 1,
                autoCaptureWithinTime: 0,
                minTxnAmount: 1,
                maxTxnAmount: 999999,
                failure_url: "",
                cancel_url: "",
                success_url: "",
                mode: "SALE",
                env: req.credentials.type,
                class: "ecom",
                label: label.toUpperCase(),
              };
              let addMid = await SubmerchantModel.add_mid(mid_details);
              // check if static qr is present
              let isStaticQRExits = await checkifrecordexist(
                {
                  sub_merchant_id: req.credentials.merchant_id,
                  type_of_qr_code: "Static_QR",
                  mode: req.credentials.type,
                },
                "merchant_qr_codes"
              );
              console.log(`isStaticQRExits`);
              console.log(isStaticQRExits);
              console.log(req.credentials);
              if (!isStaticQRExits) {
                const uuid = new SequenceUUID({
                  valid: true,
                  dashes: false,
                  unsafeBuffer: true,
                });
                let qr_id = uuid.generate();
                let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                let qr_data = {
                  mid_id: addMid.insertId,
                  merchant_id: req.credentials.super_merchant_id,
                  sub_merchant_id: req.credentials.merchant_id,
                  currency: currency.code,
                  qr_id: qr_id,
                  created_at: created_at,
                  type_of_qr_code: "Static_QR",
                  mode: req.credentials.type,
                };
                await qrGenerateModel.add(qr_data);
              }
              res
                .status(statusCode.ok)
                .send(
                  response.registrationDataResponse(
                    [],
                    "Mid added successfully!"
                  )
                );
            } else {
              res
                .status(statusCode.ok)
                .send(response.errormsg("Invalid country details"));
            }
          } else {
            res
              .status(statusCode.ok)
              .send(response.errormsg("Invalid currency details"));
          }
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Invalid psp details"));
        }
      }
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    }
  },
  resetBranding: async (req, res) => {
    try {
      const { id, env } = req.body;

      console.log("🚀 ~ resetBranding: ~ req.body:", req.body);

      for (let index = 1; index < 3; index++) {
        var condition = {
          merchant_id: enc_dec.cjs_decrypt(id),

          mode: env,

          payment_type: index,
        };

        var data = {};

        if (index == 1) {
          // QR Code

          data.full_name = 0;

          data.address = 0;

          data.email = 1;

          data.country = 0;

          data.city = 0;

          data.mobile = 0;

          data.remark = 0;
        } else if (index == 2) {
          // Payment Link

          data.full_name = 1;

          data.address = 0;

          data.email = 1;

          data.country = 0;

          data.city = 0;

          data.mobile = 0;

          data.remark = 0;
        }

        var result = await CustomFormModal.updateDetails(condition, data);

        // console.log("🚀 ~ update: ~ result:", result);

        //   var data = await custom_form_controller.get(req, res);

        if (result.affectedRows > 0) {
          console.log("Payment type " + index + " reset successfully!");
        } else {
          console.log("Payment type " + index + " reset failed!");
        }
      }

      //----------------------------------------------------------------------------

      let submerchant_id = await enc_dec.cjs_decrypt(req.bodyString("id"));

      insdata = {
        brand_color: "#FFFFFF",

        accent_color: "#4C64E6",

        language: 1,

        //card_payment_scheme: req.bodyString("card_payment"),

        //stored_card_scheme: req.bodyString("stored_card"),

        font_name: "Proxima Nova Regular",
      };

      // insdata.icon = "icon-1744282356460-346721263.png";

      const mode_obj = {
        test: "test",

        live: "live",
      };

      let mode = req.body.env === "test" ? "test" : "live";

      if (req.body.env === mode) {
        insdata.test_card_payment_scheme =
          req.bodyString("card_payment") == ""
            ? null
            : req.bodyString("card_payment");

        insdata.test_stored_card_scheme =
          req.bodyString("stored_card") == ""
            ? null
            : req.bodyString("stored_card");
      } else {
        insdata.card_payment =
          req.bodyString("card_payment") == ""
            ? null
            : req.bodyString("card_payment");

        insdata.stored_card =
          req.bodyString("stored_card") == ""
            ? null
            : req.bodyString("stored_card");
      }

      // ---------------------------- Draft Save ----------------------------------------

      const get_count_condition = {
        submerchant_id: submerchant_id,
      };

      const saveResult = await submerchatDraftModel.get_count(
        get_count_condition
      );

      //console.log('insdata', insdata, saveResult);

      let message = "Submerchant branding draft save successfully";

      if (saveResult === 0) {
        $ins_id = await submerchatDraftModel.add(insdata);
      } else {
        $ins_id = await submerchatDraftModel.update(
          get_count_condition,
          insdata
        );

        message = "Submerchant branding draft updated successfully";
      }

      console.log("🚀 ~ resetBranding: ~ message:", message);

      // ------------------------------ Publish ---------------------------------------

      insdata.use_logo = 0;

      insdata.default_language = 1;

      insdata.logo = "";

      $ins_id = await SubmerchantModel.update_merchant(
        { id: submerchant_id },

        insdata
      );

      // let payment_methods = "card_payment,stored_card,apple_pay,samsung_pay";

      let payment_methods = req.bodyString("payment_methods");

      // let new_card = req.bodyString("card_payment");

      // let stored_card = req.bodyString("stored_card");

      let show = req.bodyString("show");

      let split_payment_methods = payment_methods.split(",");

      let split_show = show.split(",");

      let merchant_payment_methods = [];

      let i = 1;

      let count = 0;

      for (let method of split_payment_methods) {
        let temp = {
          sub_merchant_id: submerchant_id,

          methods: method,

          sequence: i,

          is_visible: split_show[count],

          created_at: moment().format("YYYY-MM-DD HH:mm:s"),

          mode: mode,
        };

        i++;

        count++;

        merchant_payment_methods.push(temp);
      }

      const removeOldMethods = await SubmerchantModel.removeOldPaymentMethod({
        sub_merchant_id: submerchant_id,

        mode: mode,
      });

      const all_insert = merchant_payment_methods.map((val) => {
        if (val.methods === "stored_card") {
          val.others =
            req.body.env === mode
              ? insdata.test_stored_card_scheme
              : insdata.stored_card_scheme;
        }

        if (val.methods === "card_payment") {
          val.others =
            req.body.env === mode
              ? insdata.test_card_payment_scheme
              : insdata.card_payment_scheme;
        }

        SubmerchantModel.add_payment_method(
          {
            sub_merchant_id: submerchant_id,

            methods: val.methods,

            mode: mode,
          },

          val
        );
      });

      res

        .status(statusCode.ok)

        .send(response.successdatamsg({}, "Settings changed successfully!"));
    } catch (error) {
      winston.error(error);

      res

        .status(statusCode.internalError)

        .send(response.errormsg(error.message));
    }
  },

  get_merchant_payment_methods: async (req, res) => {
    try {
      let company_details = await helpers.company_details({ id: 1 });
      let company_logo = company_details?.company_logo;
      let submerchant_id = enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );

      let env = req.body.env;

      const condition = {
        submerchant_id: submerchant_id,
      };
      console.log(condition);
      // console.log(submerchant_id, env);

      const card_result = await SubmerchantModel.get_card_payment_method(
        submerchant_id,
        env
      );
      // console.log("card_result...", card_result);

      const check_bank_transfer = await helpers.getBankTransfer(submerchant_id);

      // console.log("inside if");

      const draft_result = await submerchatDraftModel.selectOne(condition);

      console.log(draft_result);

      const val = draft_result;

      let send_res = [];

      let available_payment_method_details =
        await SubmerchantModel.selectAvailablePaymentMethod(submerchant_id);

      let array_method = available_payment_method_details.split(",");

      let available_payment_method = [...new Set(array_method)];

      let payment_methods = await submerchatDraftModel.selectPaymentMethod(
        submerchant_id,
        env
      );

      console.log(
        "🚀 ~ get_merchant_payment_methods: ~ payment_methods:",
        payment_methods
      );

      let resp = {
        submerchant_id: enc_dec.cjs_encrypt(req.bodyString("submerchant_id")),

        merchant_name: await helpers.get_merchantdetails_name_by_id(
          submerchant_id
        ),

        icon_name: val?.icon?val?.icon:'',

        // logo_name: "",
        logo_name: company_logo,

        language: val?.language?enc_dec.cjs_encrypt(val?.language):enc_dec.cjs_encrypt(1),

       
        payment_methods: payment_methods,

        available_payment_method: available_payment_method,

        // logo: "",
        logo: process.env.STATIC_URL + "/static/images/" + company_logo,

        accept_image:
          val?.we_accept_image
            ? process.env.STATIC_URL + "/static/files/" + val?.we_accept_image
            : process.env.STATIC_URL + "/static/files/" + "payment-list.png",

        use_logo_instead_icon: 0,

        brand_color: val?.brand_color,

        accent_color: val?.accent_color,

        card_payment_scheme: val?.card_payment,

        stored_card_scheme: val?.stored_card,

        font_name: val?.font_name,

        card_payment_methods: card_result,

        is_back_transfer: check_bank_transfer,

        test_card_payment_scheme: val?.test_card_payment_scheme?val?.test_card_payment_scheme:"",

        test_stored_card_scheme: val?.test_stored_card_scheme?val?.test_stored_card_scheme:"",
      };
    if (val?.icon) {
      resp.icon = `${process.env.STATIC_URL}/static/files/${val.icon}`;
    }else{
       resp.icon = ``;
    }
      send_res = resp;

      res

        .status(statusCode.ok)

        .send(
          response.successdatamsg(send_res, "Details fetched successfully.")
        );
    } catch (error) {
      console.log(error);
      res

        .status(statusCode.ok)

        .send(error?.message);
    }
  },
  addFundingMethod: async (req, res) => {
    try {
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = req.bodyString("receiver_id");
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver id"));
          }
          break;
        case "Merchant":
          let merchant_id =
            req.bodyString("sub_merchant_id")
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant id"));
          }
          break;
        case "Admin":
          break;
      }
      let submerchant_id = req.bodyString("sub_merchant_id");
      let account_id = await helpers.make_sequential_no("ORD");
      let customer_type = req.bodyString("customer_type");
      let receiver_id = req.bodyString("receiver_id");
      let funding_source_type = req.bodyString("funding_source_type");
      let currency = req.bodyString("currency");
      let country = req.bodyString("country_iso_code");
      let type = 0; // 0 for individual, 1 for business
      let transaction_type = "B2C";
      let payer_id = req.bodyString("payer_id");
      let is_active = req.bodyString("is_active");
      let is_verified = req.bodyString("is_verified");
      let account_for = req.bodyString("account_for");
      if (customer_type.toLowerCase() == "business") {
        type = 1;
        transaction_type = "B2B";
      }
      let fundingData = req.body;
      delete fundingData.sub_merchant_id;
      delete fundingData.customer_type;
      delete fundingData.receiver_id;
      delete fundingData.funding_source_type;
      delete fundingData.payer_id;
      delete fundingData.currency;
      delete fundingData.is_verified;
      delete fundingData.is_active;
      delete fundingData.account_for;

      let fundingDetails = {
        account_id: account_id,
        type: type,
        submerchant_id: submerchant_id ? submerchant_id : 0,
        account_type: funding_source_type,
        account_for: account_for,
        payer_id: payer_id,
        currency: currency,
        country: country,
        account_details: JSON.stringify(fundingData),
        deleted: 0,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        bank_verified: is_verified ? is_verified : 0,
        beneficiary_id: receiver_id ? receiver_id : 0, // Default receiver id, can be updated later
        status: is_active ? is_active : 1,
      };
      console.log("🚀 ~ fundingDetails:", fundingDetails)
      let store = await MerchantEkycModel.storeFundingDetails(fundingDetails);

      if (store) {
        let send_res = {
          sub_merchant_id: submerchant_id ? submerchant_id : null,
          receiver_id: receiver_id ? receiver_id : null,
          customer_type: customer_type,
          account_id: account_id,
          funding_source_type: funding_source_type,
          currency: currency,
          payer_id: payer_id,
          transaction_type: transaction_type,
          account_details: fundingData,
          is_verified: is_verified ? is_verified : 0,
          is_active: is_active ? is_active : 1,
          created_at: moment().format("YYYY-MM-DD HH:mm"),
          updated_at: moment().format("YYYY-MM-DD HH:mm"),
        };
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Funding details added successfully"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.successdatamsg([], "Unable to add funding details."));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  updateFundingMethod: async (req, res) => {
    let account_id = req.bodyString("account_id");
    try {
      let account_details = await MerchantEkycModel.fetchSingleMerchantAccounts(
        { account_id: account_id }
      );
      console.log(account_details);
      if (!account_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid account id"));
      }
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = account_details.beneficiary_id;
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver key and secret"));
          }
          break;
        case "Merchant":
          let merchant_id = account_details.submerchant_id;
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant key and secret"));
          }
          break;
        case "Admin":
          break;
      }
      let customer_type = req.bodyString("customer_type");
      let funding_source_type = req.bodyString("funding_source_type");
      let currency = req.bodyString("currency");
      let country = req.bodyString("country_iso_code");
      let type = 0; // 0 for individual, 1 for business
      let transaction_type = "B2C";
      let payer_id = req.bodyString("payer_id");
      let is_active = req.bodyString("is_active");
      let is_verified = req.bodyString("is_verified");
      if (customer_type == "business") {
        type = 1;
        transaction_type = "B2B";
      }
      let fundingData = req.body;
      delete fundingData.customer_type;
      delete fundingData.account_id;
      delete fundingData.funding_source_type;
      delete fundingData.payer_id;
      delete fundingData.currency;
      delete fundingData.is_verified;
      delete fundingData.is_active;
      let fundingDetails = {
        type: type,
        account_type: funding_source_type,
        payer_id: payer_id,
        currency: currency,
        country: country,
        account_details: JSON.stringify(fundingData),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        bank_verified: is_verified ? 1 : 0,
        status: is_active ? is_active : 1,
      };
      let store = await MerchantEkycModel.updateFundingDetails(
        { account_id: account_id },
        fundingDetails
      );
      if (store) {
        let send_res = {
          account_id: account_id,
          sub_merchant_id:
            account_details?.submerchant_id == 0
              ? null
              : account_details?.submerchant_id,
          receiver_id:
            account_details?.beneficiary_id == 0
              ? null
              : account_details?.beneficiary_id,
          customer_type: customer_type,
          funding_source_type: funding_source_type,
          currency: currency,
          payer_id: payer_id,
          transaction_type: transaction_type,
          account_details: fundingData,
          is_verified: is_verified ? is_verified : 0,
          is_active: is_active ? is_active : 0,
          created_at: moment(account_details?.created_at).format(
            "YYYY-MM-DD HH:mm"
          ),
          updated_at: moment().format("YYYY-MM-DD HH:mm"),
        };
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Funding details updated successfully"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(
            response.successdatamsg([], "Unable to update funding details.")
          );
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
    /*  try {
      console.log("Update Funding Method");
      console.log(req.body);
      console.log(req.bodyString("customer_type"));
      let submerchant_id = req.bodyString("submerchant_id");
      let account_id = req.bodyString("account_id");
      let customer_type = req.bodyString("customer_type");
      let type = 0; // 0 for individual, 1 for business
      if (customer_type == "business") {
        type = 1;
      }
      let fundingData = req.body;
      delete fundingData.submerchant_id;
      delete fundingData.customer_type;
      delete fundingData.account_id;
      let fundingDetails = {
        type: type,
        account_type: req.bodyString("funding_source_type"),
        payer_id: req.bodyString("payer_id"),
        currency: req.bodyString("currency"),
        country: req.bodyString("funding_source_country"),
        account_details: JSON.stringify(fundingData),
        deleted: 0,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        beneficiary_id: 0, // Default beneficiary id, can be updated later
        status: 0,
        bank_verified: 0,
      };
      let store = await MerchantEkycModel.updateFundingDetails(
        { account_id: account_id, submerchant_id: submerchant_id },
        fundingDetails
      );
      let result = {
        customer_type: customer_type,
        submerchant_id: submerchant_id,
        account_id: account_id,
        account_details: fundingData,
      };
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            result,
            "Funding details updated successfully"
          )
        );
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    } */
  },
  verifyFundingDetails: async (req, res) => {
    let account_id = req.bodyString("account_id");
    let verificationStatus = 1; // 1 for verified, 0 for unverified

    try {
      let account_details = await MerchantEkycModel.fetchSingleMerchantAccounts(
        { account_id: account_id }
      );
      if (!account_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid account id"));
      }
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = account_details.beneficiary_id;
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver key and secret"));
          }
          break;
        case "Merchant":
          let merchant_id = account_details.submerchant_id;
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant key and secret"));
          }
          break;
        case "Admin":
          break;
      }
      let updateData = {
        bank_verified: verificationStatus,
        updated_at: moment().format("YYYY-MM-DD HH:mm"),
        status:1
      };
      let result = await MerchantEkycModel.updateFundingDetails(
        { account_id: account_id },
        updateData
      );
      if (result.affectedRows > 0) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              {
                account_id: account_id,
                is_verified: 1,
                deleted: account_details?.deleted,
                is_active: account_details?.status,
                created_at: moment(account_details?.created_at).format(
                  "YYYY-MM-DD HH:mm"
                ),
                updated_at: moment().format("YYYY-MM-DD HH:mm"),
              },
              "Funding details verification status updated successfully."
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid account id."));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  manageFundingDetails: async (req, res) => {
    let account_id = req.bodyString("account_id");
    let status = req.bodyString("is_active"); // 1 for verified, 0 for unverified

    try {
      let account_details = await MerchantEkycModel.fetchSingleMerchantAccounts(
        { account_id: account_id }
      );
      if (!account_details) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid account id"));
      }
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = account_details.beneficiary_id;
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver key and secret"));
          }
          break;
        case "Merchant":
          let merchant_id = account_details.submerchant_id;
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant key and secret"));
          }
          break;
        case "Admin":
          break;
      }
      let updateData = {
        status: status,
        updated_at: moment().format("YYYY-MM-DD HH:mm"),
      };
      let result = await MerchantEkycModel.updateFundingDetails(
        { account_id: account_id },
        updateData
      );
      if (result.affectedRows > 0) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              {
                account_id: account_id,
                is_verified: account_details?.bank_verified,
                deleted: account_details?.deleted,
                is_active: status,
                created_at: moment(account_details?.created_at).format(
                  "YYYY-MM-DD HH:mm"
                ),
                updated_at: moment().format("YYYY-MM-DD HH:mm"),
              },
              "Funding details  status updated successfully."
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid account id."));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  fetchPayer: async (req, res) => {
    let country_iso_code = req.bodyString("country_iso_code");
    console.log("🚀 ~ country_iso_code:", country_iso_code)
    let service_id =
      req.bodyString("fundingType") || req.bodyString("funding_source_type");
    let currency = req.bodyString("currency");
    let transaction_type = req.bodyString("transaction_type");

    try {
      let result;
      if (country_iso_code != "LBR" && country_iso_code != "GHA") {
        const axios = require("axios");
        const username =
          process.env.THUNES_MODE == "test"
            ? "a0895b2a-b05c-45cc-b218-6c103d3d67e9"
            : "7a15c7bc-d2b4-4290-905c-a601a58b8705";
        const password =
          process.env.THUNES_MODE == "test"
            ? "fcc52714-1d66-4f63-8aec-aeaae62299f3"
            : "97f3164f-5f83-40a3-adef-8cc6ac3eb113";
        const base64Credentials = Buffer.from(
          `${username}:${password}`
        ).toString("base64");

        let send_res = [];
        let page = 1; // Start from page 0
        let per_page = 100; // Maximum records per page
        let hasMoreData = true;
        let totalFetched = 0;

        console.log("🚀 Starting to fetch all payers...");

        while (hasMoreData) {
          try {
            let filter_url = helpers.generateQueryURL(
              service_id,
              country_iso_code,
              currency,
              transaction_type,
              page,
              per_page
            );

            let config = {
              method: "get",
              maxBodyLength: Infinity,
              url:
                process.env.THUNES_MODE == "test"
                  ? `${credentials["thunes"]["test_url"]}/v2/money-transfer/payers${filter_url}`
                  : `${credentials["thunes"]["url"]}/v2/money-transfer/payers${filter_url}`,
              headers: {
                Authorization: `Basic ${base64Credentials}`,
              },
            };

            let result = await axios.request(config);
            console.log(`🚀 ~ Page ${page} result:`, {
              status: result.status,
              dataLength: result.data ? result.data.length : 0,
              totalSoFar: totalFetched,
            });
            // Check if we got data
            if (
              result.data &&
              Array.isArray(result.data) &&
              result.data.length > 0
            ) {
              // Process each row from current page
              for (let row of result.data) {
                let temp = {
                  country_iso_code: row.country_iso_code,
                  country: row.country_iso_code,
                  currency: row.currency,
                  funding_type: row.service.id,
                  funding_source_type: row.service.id,
                  id: row.id,
                  name: row.name,
                  payer_id: row.id,
                  payer_name: row.name,
                };
                send_res.push(temp);
              }

              totalFetched += result.data.length;

              // Check if we should continue fetching
              if (result.data.length < per_page) {
                // Less than expected results means we've reached the end
                hasMoreData = false;
              } else {
                // Move to next page
                page++;

                // Optional: Add small delay to be API-friendly
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } else {
              // No data returned, we've reached the end
              hasMoreData = false;
            }
          } catch (pageError) {
            hasMoreData = false; // Stop pagination on error

            // If this is the first page and we get an error, throw it
            if (page === 0) {
              throw pageError;
            }
            // Otherwise, just stop pagination but return what we have
            break;
          }
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, `Payer list fetch successfully.`)
          );
      } else if (country_iso_code == "GHA") {
        let send_res = [];
        console.log(`the service id is here`);
        console.log(service_id);
        send_res = await alpay_payer_list(service_id);
        // send_res = [
        //     {
        //       country_iso_code: country_iso_code,
        //       country: country_iso_code,
        //       currency: currency,
        //       funding_type: service_id,
        //       funding_source_type: service_id,
        //       id: "AL_PAY",
        //       name: "AL PAY",
        //       payer_id: "AL_PAY",
        //       payer_name: "AL PAY",
        //     },
        //   ];
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Payer list fetch successfully.")
          );
      } else {
        let send_res = [];
        // LBR country handling remains the same
        if (service_id == "1") {
          console.log(`the service id is here`);
          console.log(service_id);
          send_res = [
            {
              country_iso_code: country_iso_code,
              country: country_iso_code,
              currency: currency,
              funding_type: service_id,
              funding_source_type: service_id,
              id: "MTN_MOMO",
              name: "MTN MOMO",
              payer_id: "MTN_MOMO",
              payer_name: "MTN MOMO",
            },
            // {
            //   country_iso_code: country_iso_code,
            //   country: country_iso_code,
            //   currency: currency,
            //   funding_type: service_id,
            //   funding_source_type: service_id,
            //   id: "MTN",
            //   name: "MTN",
            //   payer_id: "MTN",
            //   payer_name: "MTN",
            // },
            {
              country_iso_code: country_iso_code,
              country: country_iso_code,
              currency: currency,
              funding_type: service_id,
              funding_source_type: service_id,
              id: "ORANGE_MONEY",
              name: "Orange Money",
              payer_id: "ORANGE_MONEY",
              payer_name: "Orange Money",
            },
            // {
            //   country_iso_code: country_iso_code,
            //   country: country_iso_code,
            //   currency: currency,
            //   funding_type: service_id,
            //   funding_source_type: service_id,
            //   id: "ORANGE",
            //   name: "ORANGE",
            //   payer_id: "ORANGE",
            //   payer_name: "ORANGE",
            // },
          ];
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Payer list fetch successfully.")
          );
      }
    } catch (error) {
      console.error("🔥 Error in payers function:", error);
      res
        .status(statusCode.badRequest)
        .send(
          response.successdatamsg(
            [],
            "Unable to fetch payers please check your inputs."
          )
        );
    }
  },
  fetchPayerDetails: async (req, res) => {
    console.log("🚀 ~ req:", req.body)
    let payer_id = req.bodyString("payer_id");
    let transaction_type = req.bodyString("transaction_type");
    let customer_type = req.bodyString("customer_type");
    let transaction_attachment_type =  ["invoice","purchase_order","delivery_slip","contract","customs_declaration","bill_of_lading","others","identification_documents","proof_of_address","proof_of_source_of_funds","registration_documents"];
    try {
      if (payer_id == "MTN_MOMO" || payer_id == "MTN" || payer_id == "ORANGE_MONEY" || payer_id == "ORANGE") {
        res.status(statusCode.ok).send({
          payer_id: payer_id,
          payer_name: payer_id.split("_").join(" "),
          transaction_type: transaction_type,
          funding_source_type: 1,
          funding_source_name: "MobileWallet",
          customer_type: customer_type,
          country_iso_code: "LBR",
          currency: ["LRD", "USD"],
          precision: null,
          increment: null,
          maximum_transaction_amount: null,
          minimum_transaction_amount: null,
          data: "MSISDN,country_iso_code",
          required_documents: [],
          purpose_of_remittance: [],
          transaction_attachment_type: transaction_attachment_type,
          message: "Payer details fetch successfully.",
          status: "success",
          code: "00",
        });
      } else if (payer_id.includes("AP")) {
        let payer = await get_alpay_payer_by_id(payer_id);
        console.log("🚀 ~ payer:", payer)
        res.status(statusCode.ok).send({
          payer_id: payer_id,
          payer_name: payer?.name,
          transaction_type: transaction_type,
          funding_source_type: payer?.funding_type,
          funding_source_name: payer?.funding_type == 1 ? "MobileWallet" : "BankAccount",
          customer_type: customer_type,
          country_iso_code: "GHA",
          currency: ["GHS"],
          precision: null,
          increment: null,
          maximum_transaction_amount: null,
          minimum_transaction_amount: null,
          data: "accountNumber",
          required_documents: [],
          purpose_of_remittance: [],
          transaction_attachment_type: transaction_attachment_type,
          message: "Payer details fetch successfully.",
          status: "success",
          code: "00",
        });
      } else {
        let result;
        const axios = require("axios");
        const username = process.env.THUNES_MODE=='test'?"a0895b2a-b05c-45cc-b218-6c103d3d67e9":"7a15c7bc-d2b4-4290-905c-a601a58b8705";
        const password = process.env.THUNES_MODE=='test'?"fcc52714-1d66-4f63-8aec-aeaae62299f3":"97f3164f-5f83-40a3-adef-8cc6ac3eb113";
        const base64Credentials = Buffer.from(
          `${username}:${password}`
        ).toString("base64");
        let config = {
          method: "get",
          maxBodyLength: Infinity,
          url: process.env.THUNES_MODE=='test'?`${credentials["thunes"]["test_url"]}/v2/money-transfer/payers/${payer_id}`:`${credentials["thunes"]["url"]}/v2/money-transfer/payers/${payer_id}`,
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
          validateStatus: function (status) {
            return status < 500; // Don't throw for 4xx errors
          },
        };
        result = await axios.request(config);

        if (result.status === 400) {
          console.log("400 Error:", result.data);
          return res
            .status(statusCode.badRequest)
            .send(response.errormsg("Invalid payer ID or parameters"));
        }

        let purpose_of_remittance_values_accepted =
          result?.data?.transaction_types?.B2B
            ?.purpose_of_remittance_values_accepted;
        let required_fields = result.data.transaction_types?.B2B;
        let errorMessage = "Business account is not available for this payer";
        if (
          transaction_type != undefined &&
          transaction_type != null &&
          transaction_type !== ""
        ) {
          if (transaction_type === "B2C") {
            required_fields = result.data.transaction_types?.B2C;
            purpose_of_remittance_values_accepted =
              result?.data?.transaction_types?.B2C
                ?.purpose_of_remittance_values_accepted;
            errorMessage = "Consumer account is not available for this payer";
          } else if (transaction_type === "C2C") {
            required_fields = result.data.transaction_types?.C2C;
            purpose_of_remittance_values_accepted =
              result?.data?.transaction_types?.C2C
                ?.purpose_of_remittance_values_accepted;
            errorMessage = "Consumer account is not available for this payer";
          } else if (transaction_type === "C2B") {
            required_fields = result.data.transaction_types?.C2B;
            purpose_of_remittance_values_accepted =
              result?.data?.transaction_types?.C2B
                ?.purpose_of_remittance_values_accepted;
            errorMessage = "Business account is not available for this payer";
          }
        }

        if (required_fields == undefined) {
          return res
            .status(statusCode.badRequest)
            .send(response.errormsg(errorMessage));
        }
        let minimum_transaction_amount = 0;
        let maximum_transaction_amount = 0;
        let required_documents = "";
        switch (transaction_type) {
          case "B2B":
            maximum_transaction_amount =
              result?.data?.transaction_types?.B2B?.maximum_transaction_amount;
            minimum_transaction_amount =
              result?.data?.transaction_types?.B2B?.minimum_transaction_amount;
            required_documents =
              result?.data?.transaction_types?.B2B?.required_documents[0];

            break;
          case "B2C":
            maximum_transaction_amount =
              result?.data?.transaction_types?.B2C?.maximum_transaction_amount;
            minimum_transaction_amount =
              result?.data?.transaction_types?.B2C?.minimum_transaction_amount;
            required_documents =
              result?.data?.transaction_types?.B2C?.required_documents[0];
            break;
        }
        console.log(`after switch`);
        console.log(minimum_transaction_amount);
        let fields = required_fields.credit_party_identifiers_accepted[0] + ",";
        fields += required_fields.required_receiving_entity_fields[0];
        // fields +=
        //   "," +
        //   "funding_source_country,funding_source_type,country_iso_code,payer_id,currency";
        res.status(statusCode.ok).send({
          payer_id: result?.data?.id,
          payer_name: result?.data?.name,
          transaction_type: transaction_type,
          funding_source_type: result?.data?.service?.id,
          funding_source_name: result?.data?.service?.name,
          customer_type: customer_type,
          country_iso_code: result?.data?.country_iso_code,
          currency: result?.data?.currency,
          precision: result?.data?.precision,
          increment: result?.data?.increment,
          maximum_transaction_amount: maximum_transaction_amount,
          minimum_transaction_amount: minimum_transaction_amount,
          data: fields,
          required_documents: required_documents,
          purpose_of_remittance: purpose_of_remittance_values_accepted,
          transaction_attachment_type: transaction_attachment_type,
          message: "Payer details fetch successfully.",
          status: "success",
          code: "00",
        });
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  getFundingDetails: async (req, res) => {
    try {
      let submerchant_id = req.bodyString("submerchant_id");
      let account_id = req.bodyString("account_id");
      let currency = req.bodyString("currency");
      let receiver_id = req.bodyString("receiver_id");

      let merchantResult = await MerchantEkycModel.fetchSingleMerchantAccounts({
        account_id: account_id,
        submerchant_id: submerchant_id,
        receiver_id: receiver_id,
        currency: currency,
      });
      console.log("🚀 ~ merchantResult:", merchantResult)
      if (!merchantResult) {
        return res
          .status(statusCode.badRequest)
          .send(response.errormsg("No active account found"));
      }
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = merchantResult.beneficiary_id;
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver key and secret"));
          }
          break;
        case "Merchant":
          let merchant_id = merchantResult.submerchant_id;
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant key and secret"));
          }
          break;
        case "Admin":
          break;
      }
      console.log(merchantResult);
      if (merchantResult) {
        let receiver_id;
        if (merchantResult?.beneficiary_id == 0) {
          receiver_id = await get_receiver_by_sub_merchant_id_api_call(
            merchantResult.submerchant_id
          );
        }
        let result = {
          customer_type: merchantResult.type == 0 ? "Individual" : "Business",
          sub_merchant_id:
            merchantResult.submerchant_id == "0"
              ? null
              : merchantResult.submerchant_id,
          receiver_id:
            merchantResult?.beneficiary_id == 0
              ? receiver_id || null
              : merchantResult?.beneficiary_id,
          account_id: merchantResult.account_id,
          funding_source_type: merchantResult.account_type,
          country: merchantResult.country,
          currency: merchantResult.currency,
          payer_id: merchantResult.payer_id,
          transaction_type: merchantResult.type == 0 ? "B2C" : "B2B",
          account_details:
            (merchantResult.account_details || "").trim() == ""
              ? {}
              : JSON.parse(merchantResult.account_details),
          is_verified: merchantResult.bank_verified,
          is_active: merchantResult.status,
          deleted: merchantResult.deleted,
          created_at: moment(merchantResult.created_at).format(
            "YYYY-MM-DD HH:mm"
          ),
          updated_at: moment(merchantResult.updated_at).format(
            "YYYY-MM-DD HH:mm"
          ),
        };
        console.log(result);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result,
              "Funding details fetch successfully"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Account not found"));
      }
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to fetch funding details."));
    }
  },
  getFundingDetailsList: async (req, res) => {
    console.log("🚀 ~ req:", req.body)
    try {
      let submerchant_id = req.bodyString("sub_merchant_id");
      let receiver_id = req.bodyString("receiver_id");
      let currency = req.bodyString("currency");
      let user_type = req.user.type;
      console.log(req.user);
      switch (user_type) {
        case "Receiver":
          let receiver_id = req.bodyString("receiver_id");
          if (receiver_id != req.user.id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid receiver id"));
          }
          break;
        case "Merchant":
          let merchant_id =
            req.bodyString("sub_merchant_id") ||
            req.bodyString("submerchant_id");
          let id = req.user.id.toString();
          if (merchant_id != id) {
            return res
              .status(statusCode.unauthorized)
              .send(response.errormsg("Invalid sub merchant id"));
          }
          break;
        case "Admin":
          break;
      }
      // let currency = req.bodyString("currency");
      /* let merchant_details = await MerchantModel.selectOneMerchant({ id: submerchant_id });
      if (merchant_details) {
        let merchantResult = await MerchantEkycModel.fetchMerchantDetails({ merchant_id: submerchant_id });
        let result = {
          customer_type: merchantResult.customer_type,
          submerchant_id: merchantResult.merchant_id,
          account_id: merchantResult.account_id,
          business_regiter_country_iso: await helpers.get_country_code_by_id(merchantResult.register_business_country),
          account_details: (merchantResult.funding_details|| "").trim()==""?{}:JSON.parse(merchantResult.funding_details),


        } 
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(result, 'Funding details fetch successfully'));
      } else {
         res
          .status(statusCode.badRequest)
          .send(response.errormsg('Invalid sub merchant id.'));
      } */

      let merchantResult = await MerchantEkycModel.fetchMerchantAccounts({
        submerchant_id: submerchant_id,
        beneficiary_id: receiver_id,
        currency: currency,
      });

      console.log("funding-details-list", merchantResult);
      if (merchantResult) {
        for (let index = 0; index < merchantResult.length; index++) {
          const account = merchantResult[index];
          let final_response = {
            customer_type: account?.type == 1 ? "Business" : "Individual",
            sub_merchant_id:
              account?.submerchant_id == 0 ? null : account?.submerchant_id,
            receiver_id:
              account?.receiver_id == 0 ? null : account?.receiver_id,
            account_id: account?.account_id,
            funding_source_type: account?.account_type,
            country: account?.country,
            currency: account?.currency,
            payer_id: account?.payer_id,
            transaction_type: account?.type == 1 ? "B2B" : "B2C",
            account_details: (() => {
              try {
                return JSON.parse(account?.account_details || "{}");
              } catch {
                return {};
              }
            })(),
            is_verified: account?.bank_verified,
            is_active: account?.status,
            deleted: account?.deleted,
            created_at: moment(account?.created_at).format("YYYY-MM-DD HH:mm"),
            updated_at: moment(account?.updated_at).format("YYYY-MM-DD HH:mm"),
          };
          merchantResult[index] = final_response;
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              merchantResult,
              "Funding details fetch successfully"
            )
          );
      }
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to fetch funding details."));
    }
  },
  getPayoutCountries: async (req, res) => {
    let countries=[];
    try {
      const axios = require("axios");
      const username = process.env.THUNES_MODE=="test"?"a0895b2a-b05c-45cc-b218-6c103d3d67e9":"7a15c7bc-d2b4-4290-905c-a601a58b8705";
      const password = process.env.THUNES_MODE=="test"?"fcc52714-1d66-4f63-8aec-aeaae62299f3":"97f3164f-5f83-40a3-adef-8cc6ac3eb113";
      const base64Credentials = Buffer.from(`${username}:${password}`).toString(
        "base64"
      );
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: process.env.THUNES_MODE=='test'?`${credentials["thunes"]["test_url"]}/v2/money-transfer/countries`:`${credentials["thunes"]["url"]}/v2/money-transfer/countries`,
        headers: {
          Authorization: `Basic ${base64Credentials}`,
        },
      };

      let result = await axios.request(config);
      console.log("🚀 ~ result:", result)
       countries = result.data.map(({ iso_code, ...rest }) => ({
        country_iso_code: iso_code,
        ...rest,
      }));
      countries.push({ country_iso_code: "LBR", name: "Liberia" });
      countries.push({ country_iso_code: "GHA", name: "Ghana" });
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            countries,
            "Payout country details fetch successfully"
          )
        );
    } catch (error) {
      console.log(error);
        countries.push({ country_iso_code: "LBR", name: "Liberia" });
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            countries,
            "Payout country details fetch successfully"
          )
        );
    }
  },
  getCurrencyByCountry: async (req, res) => {
    try {
      let country_iso_code = req.bodyString("country");
      let currency = await helpers.get_currency_details_by_country_iso(
        country_iso_code
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            currency,
            "Payout currency details fetch successfully"
          )
        );
    } catch (error) {
      res
        .status(statusCode.ok)
        .send(response.successdatamsg("", "Unable to fetch."));
    }
  },
  getAllFundingDetails: async (req, res) => {
    try {
      let page = req.bodyString("page") || 0;
      let per_page = req.bodyString("per_page") || 50;
      let sub_merchant_id = req.bodyString("sub_merchant_id") || null;

      let where = {
        page: page,
        per_page: per_page,
        deleted: 0
      };

      if (sub_merchant_id) {
        if (sub_merchant_id.length > 10) {
          sub_merchant_id = await enc_dec.cjs_decrypt(sub_merchant_id);
        }
        where.submerchant_id = sub_merchant_id;
      }

      let merchantResult = await MerchantEkycModel.fetchAllMerchantDetails(
        where
      );

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            merchantResult,
            "Funding details fetch successfully"
          )
        );
    } catch (error) {
      res
        .status(statusCode.ok)
        .send(response.successdatamsg([], "Unable to fetch funding details."));
    }
  },
  fetchIPList: async (req, res) => {
    try {
      let submerchant_id = req.bodyString("submerchant_id");
      let ipList = await MerchantModel.fetchIpList({
        sub_merchant_id: submerchant_id,
        status: 0,
      });
      let send_res = ipList;
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(send_res, "IP list fetch successfully."));
    } catch (error) {
      console.log(error);
      res.status(statusCode.ok).send(response.errormsg("Unable to IP list."));
    }
  },
  updateIp: async (req, res) => {
    console.log(req.body);
    try {
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let removeOldRecord = await MerchantModel.removeOldIp({
        sub_merchant_id: sub_merchant_id,
      });
      let ip = req.body.ip;
      let ipData = [];
      if (ip) {
        for (row of ip) {
          let temp = {
            sub_merchant_id: sub_merchant_id,
            ip: row,
            status: 0,
            created_at: moment().format("YYYY-MM-DD HH:mm"),
          };
          ipData.push(temp);
        }
        console.log(`ip data is here`);
        console.log(ipData);
        if (ipData.length > 0) {
          await MerchantModel.addIpList(ipData);
        }
      }
      res
        .status(statusCode.ok)
        .send(response.successdatamsg([], "IP list updated successfully."));
    } catch (error) {
      res
        .status(statusCode.ok)
        .send(response.errormsg("Unable to update IP list."));
    }
  },
  deleteFundingDetails: async (req, res) => {
    try {
      let account_id = req.bodyString("account_id");
      let merchantResult = await MerchantEkycModel.fetchSingleMerchantAccounts({
        account_id: account_id,
      });
      if (account_id) {
        let result = await MerchantEkycModel.updateFundingDetails(
          { account_id: account_id },
          { deleted: 1, status: 0 }
        );
        if (result.affectedRows > 0) {
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                {
                  account_id: account_id,
                  deleted: 1,
                  status: 1,
                  is_verified: merchantResult.bank_verified,
                },
                "Funding details deleted successfully."
              )
            );
        } else {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg("Unable to delete funding details."));
        }
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid sub merchant id or account id."));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  addBulkFundingMethod: async (req, res) => {
    try {
      let results = [];
      for (const request of req.body) {
        console.log(`add funding method`);
        // if(req.bodyString('beneficiary_id')){
        //   const beneficiary_response = await axios.get(
        //     process.env.PAYOUT_SERVER_URL +
        //       "/v1/payout/receiver/get-receiver-by-id/"+req.bodyString('beneficiary_id'),
        //     {
        //       headers: {
        //         xusername: process.env.X_Username,
        //         xpassword: process.env.X_Password,
        //       },
        //     }
        //   );
        //   console.log(beneficiary_response);
        // }
        let submerchant_id = request.submerchant_id;
        let account_id = await helpers.make_sequential_no("ORD");
        let customer_type = request.customer_type;
        let receiver_id = request.receiver_id;
        let type = 0; // 0 for individual, 1 for business
        if (customer_type == "business") {
          type = 1;
        }
        let fundingData = request;
        delete fundingData.submerchant_id;
        delete fundingData.customer_type;
        delete fundingData.receiver_id;
        let fundingDetails = {
          account_id: account_id,
          type: type,
          submerchant_id: submerchant_id ? submerchant_id : 0,
          account_type: request.funding_source_type,
          payer_id: request.payer_id,
          currency: request.currency,
          country: request.funding_source_country,
          account_details: JSON.stringify(fundingData),
          deleted: 0,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          beneficiary_id: receiver_id ? receiver_id : 0, // Default beneficiary id, can be updated later
          status: 0,
        };
        let store = await MerchantEkycModel.storeFundingDetails(fundingDetails);
        if (store) {
          let result = {
            customer_type: customer_type,
            submerchant_id: submerchant_id,
            receiver_id: receiver_id ? receiver_id : "",
            account_id: account_id,
            account_details: fundingData,
          };
          results.push(result);
        } else {
          res
            .status(statusCode.badRequest)
            .send(
              response.successdatamsg(result, "Unable to add funding details.")
            );
        }
      }

      console.log("🚀 ~ results:", results);
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(results, "Funding details added successfully")
        );
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  verifyBulkFundingDetails: async (req, res) => {
    try {
      let results = [];
      for (const request of req.body) {
        let account_id = request.account_id;
        let verificationStatus = 1; // 1 for verified, 0 for unverified
        let updateData = {
          bank_verified: verificationStatus,
        };
        let result = await MerchantEkycModel.updateFundingDetails(
          { account_id: account_id },
          updateData
        );
        if (result.affectedRows > 0) {
          results.push({
            account_id: account_id,
            verified: "Yes",
            message: "Account verified successfully.",
          });
        } else {
          results.push({
            account_id: account_id,
            verified: "No",
            message: "Invalid account id.",
          });
        }
      }
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            results,
            "Funding details verification status updated successfully."
          )
        );
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  get_submerchant_details: async (req, res) => {
    try {
      let submerchant_id = req.body.submerchant_id;
      let result = await MerchantRegistrationModel.get_submerchant_details(
        submerchant_id
      );
      console.log("🚀 ~ result:", result);
      if (result) {
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(result, "Merchant details found"));
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Merchant details not found"));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  get_company_details: async (req, res) => {
    try {
      let company_details = await helpers.company_details({ id: 1 });
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(company_details, "Company details found")
        );
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  check_merchant_keys: async (req, res) => {
    try {
      let result = await SubmerchantModel.checkLiveKeyExits({
        merchant_key: req.body.merchant_key,
        merchant_secret: req.body.merchant_secret,
      });
      if (result) {
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(result, "Found"));
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Not Found"));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  get_ghana_payers_list: async (req, res) => {
    try {
      let bank_list = await alpay_payer_list(req.body.funding_type);
      if (bank_list) {
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(bank_list, "Payers list"));
      } else {
        res
          .status(statusCode.ok)
          .send(response.errormsg("Payers not found"));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  update_merchant_onboarding_status: async (req, res) => {
    try {
      let sub_merchant_id = await enc_dec.cjs_decrypt(req.body.sub_merchant_id);
      if (sub_merchant_id) {
        const condition = { id: sub_merchant_id };
        const data = { onboarding_done: 1, ekyc_done: 3, video_kyc_done: 1 };
        const table = "master_merchant";
        let result = await SubmerchantModel.update(condition, data, table)
        res
          .status(statusCode.ok)
          .send(response.successdatamsg({}, "Merchant onboarding status changed"));
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Submerchant ID required"));
      }
    } catch (error) {
      console.log(error);
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
};
module.exports = all_data;

function extractPaginationParams(req) {
  const perpage = req.bodyString("perpage");
  const page = req.bodyString("page");
  
  return {
    perpage: perpage ? parseInt(perpage) : 0,
    page: page ? parseInt(page) : 0
  };
}
function calculatePagination(perpage, page) {
  if (!perpage || !page) {
    return { perpage: 0, page: 0 };
  }
  
  return {
    perpage,
    start: (page - 1) * perpage
  };
}
async function buildQueryConditions(req) {
  let condition = {};
  let condition2 = {};

  // Base condition based on user type
  if (req.user.type === "merchant") {
    const selected_merchant = await SubmerchantModel.getSelectedMerchantId(req.user.id);
    
    if (selected_merchant !== 0) {
      condition = { ["m.merchant_id"]: selected_merchant };
    } else {
      condition = {
        ["s.deleted"]: 0,
        ["s.super_merchant_id"]: req.user.super_merchant_id || req.user.id,
      };
    }
  } else {
    condition = { ["s.deleted"]: 0 };
  }

  // Apply filters using helper functions
  applyStringFilter(req, condition, condition2, "registration_number", "m.company_registration_number", false);
  applyStringFilter(req, condition, condition2, "business_address", "m.register_business_country", true);
  applyStringFilter(req, condition, condition2, "type_of_business", "m.type_of_business", true);
  applyStringFilter(req, condition, condition2, "industry_type", "m.mcc_codes", true);
  applyStringFilter(req, condition, condition2, "super_merchant", "s.super_merchant_id", true);
  applyStatusFilter(req, condition);
  applyStringFilter(req, condition, condition2, "company_name", "m.company_name", false);
  applyEkycStatusFilter(req, condition, condition2);

  return { condition, condition2 };
}
function applyStringFilter(req, condition, condition2, paramName, dbField, needsDecryption) {
  const value = req.bodyString(paramName);
  if (!value) return;

  if (value.includes(",")) {
    const processedValues = value.split(",").map(val => 
      needsDecryption ? enc_dec.cjs_decrypt(val) : val
    );
    condition2[dbField] = processedValues.join(",");
  } else {
    condition[dbField] = needsDecryption ? enc_dec.cjs_decrypt(value) : value;
  }
}
function applyStatusFilter(req, condition) {
  const status = req.bodyString("status");
  if (!status) return;

  condition["s.status"] = status === "Deactivated" ? 1 : 0;
}
const EKYC_STATUS_MAPPING = {
  ekyc_pending: { ekyc_required: 1, ekyc_done: 1, onboarding_done: 1 },
  onboarding_pending: { onboarding_done: 0 },
  ekyc_done: { ekyc_done: 2, ekyc_required: 1, onboarding_done: 1 },
  onboarding_done: { ekyc_required: 0, onboarding_done: 1 },
  ekyc_denied: { ekyc_required: 1, ekyc_done: 3 }
};
function applyEkycStatusFilter(req, condition, condition2) {
  const ekycStatus = req.bodyString("ekyc_status");
  if (!ekycStatus) return;

  if (ekycStatus.includes(",")) {
    const statusArray = ekycStatus.split(",");
    const aggregatedConditions = {};

    statusArray.forEach(status => {
      const mapping = EKYC_STATUS_MAPPING[status];
      if (mapping) {
        Object.entries(mapping).forEach(([key, value]) => {
          const dbField = `s.${key}`;
          aggregatedConditions[dbField] = aggregatedConditions[dbField] 
            ? `${aggregatedConditions[dbField]},${value}`
            : value.toString();
        });
      }
    });

    Object.assign(condition2, aggregatedConditions);
  } else {
    const mapping = EKYC_STATUS_MAPPING[ekycStatus];
    if (mapping) {
      Object.entries(mapping).forEach(([key, value]) => {
        condition[`s.${key}`] = value;
      });
    }
  }
}

function buildSearchFilter(searchText) {
  if (!searchText) return {};

  return {
    "m.company_name": searchText,
    "s.email": searchText,
    "m.legal_person_email": searchText,
    "m.business_phone_number": searchText
  };
}

// Process results with parallel execution for better performance
async function processResultsInParallel(result) {
  // Batch all async operations for parallel execution
  const batchPromises = result.map(async (val) => {
    const [
      owner_ekyc_details,
      meeting_data,
      count_mid_data,
      formatted_id,
      country_name,
      entity_type,
      merchant_name
    ] = await Promise.all([
      SubmerchantModel.ownerEkycCount(val.id),
      SubmerchantModel.get_count_meetings({ merchant_id: val.id }),
      SubmerchantModel.get_count_mid("mid", { submerchant_id: val.id, deleted: 0 }),
      helpers.formatNumber(val.id),
      helpers.get_country_name_by_id(val.register_business_country),
      helpers.get_entity_type(val.type_of_business),
      helpers.get_super_merchant_name(val.super_merchant_id)
    ]);

    return transformResultItem(val, {
      owner_ekyc_details,
      meeting_data,
      count_mid_data,
      formatted_id,
      country_name,
      entity_type,
      merchant_name
    });
  });

  return Promise.all(batchPromises);
}

function transformResultItem(val, asyncData) {
  const { owner_ekyc_details, meeting_data, count_mid_data, formatted_id, country_name, entity_type, merchant_name } = asyncData;

  return {
    show_id: formatted_id || "",
    submerchant_id: enc_dec.cjs_encrypt(val.id),
    ekyc_done: val.ekyc_done === 2 ? "Yes" : "No",
    ekyc_required: val.ekyc_required === 1 ? "Yes" : "No",
    onboarding_done: (owner_ekyc_details.total === owner_ekyc_details.ekyc_done && val.onboarding_done === 1) ? "Yes" : "No",
    currency: val.currency || "",
    mail_send_to_psp: val.psp_mail_send === 1 ? "Yes" : "No",
    register_business_country: country_name,
    register_business_country_id: val.register_business_country,
    type_of_business: entity_type,
    merchant_name: val.company_name,
    company_registration_number: val.company_registration_number,
    legal_business_name: merchant_name,
    email: val.email || val.legal_person_email || "",
    kyc_status: determineKycStatus(val),
    status: val.status === 1 ? "Deactivated" : "Active",
    live: val.live,
    meeting_data: meeting_data > 0 ? 1 : 0,
    mid_count: count_mid_data > 0 ? 1 : 0,
    last_modified_date: val.last_updated 
      ? moment(val.last_updated).format("DD-MM-YYYY HH:mm:ss") 
      : " ",
  };
}

function determineKycStatus(val) {
  if (val.onboarding_done !== 1) return "Onboarding Pending";
  if (val.ekyc_required === 1) {
    if (val.ekyc_done === 1 || val.ekyc_done === 4) return "eKYC Pending";
    if (val.ekyc_done === 2) return "eKYC Done";
    if (val.ekyc_done === 3) return "eKYC Denied";
  }
  if (val.ekyc_required === 0 && val.onboarding_done === 1) return "Onboarding Done";
  return "";
}

async function get_receiver_by_sub_merchant_id_api_call(sub_merchant_id) {
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/receiver/get-receiver-by-sub-id/" +
        sub_merchant_id,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
    };

    let response = await axios.request(config);
    let receiver_id = response?.data?.receiver?.receiver_id ||0
    return receiver_id;
  } catch (error) {
    console.log(error);
    return 0;
  }
}
async function get_alpay_payer_by_id(payer_id) {
console.log("🚀 ~ get_alpay_payer_by_id ~ payer_id:", payer_id)

  let list = await  alpay_payer_list();


    if (payer_id) {
      // Filter based on both conditions
      const filteredData = list.filter(
        (item) =>
          item.id == payer_id
      );
      console.log("🚀 ~ get_alpay_payer_by_id ~ filteredData:", filteredData)

      return filteredData?.[0];
    }

    return null;
}

async function alpay_payer_list(funding_type) {
  try {
    let payer_list = [
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300302",
        name: "STANDARD CHARTERED BANK",
        payer_id: "AP_300302",
        payer_name: "STANDARD CHARTERED BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300303",
        name: "ABSA BANK GHANA LIMITED",
        payer_id: "AP_300303",
        payer_name: "ABSA BANK GHANA LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300304",
        name: "GCB BANK LIMITED",
        payer_id: "AP_300304",
        payer_name: "GCB BANK LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300305",
        name: "NATIONAL INVESTMENT BANK",
        payer_id: "AP_300305",
        payer_name: "NATIONAL INVESTMENT BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300306",
        name: "ARB APEX BANK LIMITED",
        payer_id: "AP_300306",
        payer_name: "ARB APEX BANK LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300307",
        name: "AGRICULTURAL DEVELOPMENT BANK",
        payer_id: "AP_300307",
        payer_name: "AGRICULTURAL DEVELOPMENT BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300308",
        name: "SOCIETE GENERALE GHANA",
        payer_id: "AP_300308",
        payer_name: "SOCIETE GENERALE GHANA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300309",
        name: "UNIVERSAL MERCHANT BANK",
        payer_id: "AP_300309",
        payer_name: "UNIVERSAL MERCHANT BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300310",
        name: "REPUBLIC BANK LIMITED",
        payer_id: "AP_300310",
        payer_name: "REPUBLIC BANK LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300311",
        name: "ZENITH BANK GHANA LTD",
        payer_id: "AP_300311",
        payer_name: "ZENITH BANK GHANA LTD",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300312",
        name: "ECOBANK GHANA LTD",
        payer_id: "AP_300312",
        payer_name: "ECOBANK GHANA LTD",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300313",
        name: "CAL BANK LIMITED",
        payer_id: "AP_300313",
        payer_name: "CAL BANK LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300316",
        name: "FIRST ATLANTIC BANK",
        payer_id: "AP_300316",
        payer_name: "FIRST ATLANTIC BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300317",
        name: "PRUDENTIAL BANK LTD",
        payer_id: "AP_300317",
        payer_name: "PRUDENTIAL BANK LTD",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300318",
        name: "STANBIC BANK",
        payer_id: "AP_300318",
        payer_name: "STANBIC BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300319",
        name: "FIRST BANK OF NIGERIA",
        payer_id: "AP_300319",
        payer_name: "FIRST BANK OF NIGERIA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300320",
        name: "BANK OF AFRICA",
        payer_id: "AP_300320",
        payer_name: "BANK OF AFRICA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300322",
        name: "GUARANTY TRUST BANK",
        payer_id: "AP_300322",
        payer_name: "GUARANTY TRUST BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300323",
        name: "FIDELITY BANK LIMITED",
        payer_id: "AP_300323",
        payer_name: "FIDELITY BANK LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300324",
        name: "SAHEL SAHARA BANK",
        payer_id: "AP_300324",
        payer_name: "SAHEL SAHARA BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300325",
        name: "UNITED BANK OF AFRICA",
        payer_id: "AP_300325",
        payer_name: "UNITED BANK OF AFRICA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300328",
        name: "BANK OF GHANA",
        payer_id: "AP_300328",
        payer_name: "BANK OF GHANA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300329",
        name: "ACCESS BANK LTD",
        payer_id: "AP_300329",
        payer_name: "ACCESS BANK LTD",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300331",
        name: "CONSOLIDATED BANK GHANA",
        payer_id: "AP_300331",
        payer_name: "CONSOLIDATED BANK GHANA",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300333",
        name: "BAYPORT SAVINGS AND LOANS",
        payer_id: "AP_300333",
        payer_name: "BAYPORT SAVINGS AND LOANS",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300334",
        name: "FIRST NATIONAL BANK",
        payer_id: "AP_300334",
        payer_name: "FIRST NATIONAL BANK",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300345",
        name: "ADEHYEMAN SAVINGS AND LOANS",
        payer_id: "AP_300345",
        payer_name: "ADEHYEMAN SAVINGS AND LOANS",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300349",
        name: "OPPORTUNITY INTERNALTIONALSAVINGS AND LOANS",
        payer_id: "AP_300349",
        payer_name: "OPPORTUNITY INTERNALTIONALSAVINGS AND LOANS",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300356",
        name: "SINAPI ABA SAVINGS AND LOANS",
        payer_id: "AP_300356",
        payer_name: "SINAPI ABA SAVINGS AND LOANS",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300361",
        name: "SERVICES INTEGRITY SAVINGS &LOANS",
        payer_id: "AP_300361",
        payer_name: "SERVICES INTEGRITY SAVINGS &LOANS",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 2,
        funding_source_type: 2,
        id: "AP_300362",
        name: "GHL Bank",
        payer_id: "AP_300362",
        payer_name: "GHL Bank",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300479",
        name: "ZEEPAY GHANA LIMITED",
        payer_id: "AP_300479",
        payer_name: "ZEEPAY GHANA LIMITED",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300574",
        name: "G-MONEY",
        payer_id: "AP_300574",
        payer_name: "G-MONEY",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300591",
        name: "MTN",
        payer_id: "AP_300591",
        payer_name: "MTN",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300592",
        name: "AIRTELTIGO MONEY",
        payer_id: "AP_300592",
        payer_name: "AIRTELTIGO MONEY",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300594",
        name: "VODAFONE CASH",
        payer_id: "AP_300594",
        payer_name: "VODAFONE CASH",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300595",
        name: "GHANAPAY",
        payer_id: "AP_300595",
        payer_name: "GHANAPAY",
      },
      {
        country_iso_code: "GHA",
        country: "GHA",
        currency: "GHS",
        funding_type: 1,
        funding_source_type: 1,
        id: "AP_300597",
        name: "YUP GHANA LIMITED",
        payer_id: "AP_300597",
        payer_name: "YUP GHANA LIMITED",
      },
    ];

    if (funding_type) {
      // Filter based on both conditions
      const filteredData = payer_list.filter(
        (item) =>
          item.funding_type == funding_type &&
          item.funding_source_type == funding_type
      );

      return filteredData;
    }

    return payer_list;
    
  } catch (error) {
    console.log(error);
    return [];
  }
}
