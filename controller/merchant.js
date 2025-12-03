const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const MerchantModel = require("../models/merchantmodel");
const SubmerchantModel = require("../models/submerchantmodel");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const moment = require("moment");
const logger = require('../config/logger');

var data_set = {
  add: async (req, res) => {
    try {
      let country_id = await enc_dec.cjs_decrypt(req.bodyString("country_id"));
      let hashPassword = await encrypt_decrypt(
        "encrypt",
        req.bodyString("password")
      );
      let username = await encrypt_decrypt(
        "encrypt",
        req.bodyString("username")
      );

      userData = {
        merchant_name: req.bodyString("merchant_name"),
        partner_id: req.user.id,
        business_name: req.bodyString("business_name"),
        pg_mid: req.bodyString("api_key"),
        pg_merchant_key: req.bodyString("merchant_key"),
        currency: req.bodyString("currency"),
        username: username,
        password: hashPassword,
        business_email: req.bodyString("email"),
        mobile_code: req.bodyString("country_code"),
        business_contact: req.bodyString("mobile_no"),
        country: country_id,
        business_address: req.bodyString("business_address"),
        added_by: req.user.id,
        added_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        ip: await helpers.get_ip(req),
      };

      if (req.bodyString("state")) {
        userData.state = req.bodyString("state");
      }
      if (req.bodyString("city")) {
        userData.city = req.bodyString("city");
      }
      if (req.bodyString("zipcode")) {
        userData.zipcode = req.bodyString("zipcode");
      }

      ins_id = await MerchantModel.add(userData);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant registered successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
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
    const search_text = req.bodyString("search");
    const status = helpers.get_status(req.bodyString("status"));
    const country = await helpers.get_country_id_by_name(
      req.bodyString("country")
    );
    const state = `'${req.bodyString("state")}'`;
    const city = `'${req.bodyString("city")}'`;

    if (req.user.type == "merchant") {
      let mer_details = await SubmerchantModel.main_merchant_details({
        "mm.super_merchant_id": req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
      });
      search = {
        ["s.deleted"]: 0,
        ["s.super_merchant_id"]: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        ["s.live"]: mer_details.mode == "live" ? 1 : 0,
      };
      search_count = {
        ["deleted"]: 0,
        ["super_merchant_id"]: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        ["live"]: mer_details.mode == "live" ? 1 : 0,
      };
    } else {
      search = { ["s.deleted"]: 0 };
      search_count = { deleted: 0 };
    }
    const filter = {};
    if (req.bodyString("country")) {
      search.country = country;
    }
    if (req.bodyString("city")) {
      search.city = city;
    }
    if (req.bodyString("state")) {
      search.state = state;
    }
    if (req.bodyString("status")) {
      search.status = status;
    }
    if (search_text) {
      filter.name = search_text;
      filter.email = search_text;
      filter.mobile_no = search_text;
    }

    MerchantModel.select(search, filter, limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            merchant_id: enc_dec.cjs_encrypt(val.id),
            show_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            merchant_name: val.company_name,
            email: val.email,
            country_code: val.code,
            mobile_no: val.mobile_no,
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }

        total_count = await MerchantModel.get_count(search_count, filter);
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

  filter_list: async (req, res) => {
    let search = { deleted: 0, super_merchant: 0 };
    if (req.user.type == "partner") {
      if (req.user.id) {
        search.partner_id = req.user.id;
      }
    } else if (req.user.type == "admin") {
      if (req.bodyString("partner_id")) {
        search.partner_id = await encrypt_decrypt(
          "decrypt",
          req.bodyString("partner_id")
        );
      }
    }

    MerchantModel.selectSpecific("id,merchant_name", search)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            id: await encrypt_decrypt("encrypt", val.id),
            merchant_name: val.merchant_name,
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  details: async (req, res) => {
    let rec_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    MerchantModel.selectOne("*", { id: rec_id, deleted: 0 })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let resp = {
          merchant_id: enc_dec.cjs_encrypt(val.id),
          merchant_name: val.merchant_name,
          api_key: val.pg_mid,
          merchant_name: await helpers.get_merchant_name_by_id(val.id),
          merchant_key: val.pg_merchant_key,
          business_name: val.business_name,
          username: await encrypt_decrypt("decrypt", val.username),
          email: val.business_email,
          currency: val.currency,
          country_code: val.mobile_code,
          mobile_no: val.business_contact,
          country_id: enc_dec.cjs_encrypt(val.country),
          country_name: await helpers.get_country_name_by_id(val.country),
          business_address: val.business_address,
          state: val.state,
          city: val.city,
          zipcode: val.zipcode,
          status: val.status == 1 ? "Deactivated" : "Active",
          blocked_status: val.is_blocked == 1 ? "Blocked" : "Active",
        };
        send_res = resp;

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
  update: async (req, res) => {
    try {
      let data_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      let country_id = await enc_dec.cjs_decrypt(req.bodyString("country_id"));

      let username = await encrypt_decrypt(
        "encrypt",
        req.bodyString("username")
      );

      userData = {
        merchant_name: req.bodyString("merchant_name"),

        business_name: req.bodyString("business_name"),
        pg_mid: req.bodyString("api_key"),
        pg_merchant_key: req.bodyString("merchant_key"),
        currency: req.bodyString("currency"),
        username: username,
        business_email: req.bodyString("email"),
        mobile_code: req.bodyString("country_code"),
        business_contact: req.bodyString("mobile_no"),
        country: country_id,
        business_address: req.bodyString("business_address"),
      };

      if (req.bodyString("password")) {
        userData.password = await encrypt_decrypt(
          "encrypt",
          req.bodyString("password")
        );
      }
      if (req.bodyString("state")) {
        userData.state = req.bodyString("state");
      }
      if (req.bodyString("city")) {
        userData.city = req.bodyString("city");
      }
      if (req.bodyString("zipcode")) {
        userData.zipcode = req.bodyString("zipcode");
      }

      $ins_id = await MerchantModel.updateDetails({ id: data_id }, userData);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant updated successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  deactivate: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      var insdata = {
        status: 1,
      };

      $ins_id = await MerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant deactivated successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  activate: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      var insdata = {
        status: 0,
      };

      $ins_id = await MerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant activated successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  delete: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await MerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant deleted successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
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

      $ins_id = await MerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant blocked successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
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

      $ins_id = await MerchantModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant unblocked successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  password: async (req, res) => {
    let user_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    MerchantModel.selectOne("password", { id: user_id, deleted: 0 })
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  branding_update: async (req, res) => {
    try {
      let merchant_id = req.user.id;

      insdata = {
        use_logo: req.bodyString("use_logo_instead_icon"),
        brand_color: req.bodyString("brand_color"),
        accent_color: req.bodyString("accent_color"),
      };
      if (req.all_files) {
        if (req.all_files.icon) {
          insdata.icon = req.all_files.icon;
        }
        if (req.all_files.logo) {
          insdata.logo = req.all_files.logo;
        }
      }
      $ins_id = await MerchantModel.updateDetails({ id: merchant_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant branding updated successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  branding_details: async (req, res) => {
    let merchant_id = req.user.id;
    MerchantModel.selectOne("*", { id: merchant_id, deleted: 0 })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let resp = {
          merchant_id: enc_dec.cjs_encrypt(val.id),
          merchant_name: val.merchant_name,
          icon: server_addr + "/static/files/" + val.icon,
          logo: server_addr + "/static/files/" + val.logo,
          use_logo_instead_icon: val.use_logo,
          brand_color: val.brand_color,
          accent_color: val.accent_color,
        };
        send_res = resp;

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

  pricing_plan: async (req, res) => {
    let merchant_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));
    let feature_plan_id = await enc_dec.cjs_decrypt(
      req.bodyString("feature_plan_id")
    );
    let transaction_plan_id = await enc_dec.cjs_decrypt(
      req.bodyString("transaction_plan_id")
    );

    var insdata = {
      feature_plan_id: feature_plan_id,
      transaction_plan_id: transaction_plan_id,
    };

    try {
      $ins_id = await MerchantModel.updateDetails({ id: merchant_id }, insdata);
      res
        .status(statusCode.ok)
        .send(
          response.successmsg("Merchant pricing plan updated successfully")
        );
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  pricing_plan_details: async (req, res) => {
    let merchant_id = await enc_dec.cjs_decrypt(req.bodyString("merchant_id"));

    try {
      MerchantModel.select_pricing_plan({ merchant_id })
        .then((result) => {
          let data = {};
          if (result.feature_plan_id) {
            data = {
              merchant_id: req.bodyString("merchant_id"),
              feature_plan_id: enc_dec.cjs_encrypt(result.feature_plan_id),
              transaction_plan_id: enc_dec.cjs_encrypt(
                result.transaction_plan_id
              ),
            };
          }
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                data,
                "Merchant pricing plan details fetched successfully"
              )
            );
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
  list_merchant: async (req, res) => {
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

    condition = { ["s.deleted"]: 0 };

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

    if (req.bodyString("ekyc_status") == "ekyc_pending") {
      condition["s.ekyc_done"] = 1; //1=pending, 2= Approved
      condition["s.onboarding_done"] = 1;
    }
    if (req.bodyString("ekyc_status") == "onboarding_pending") {
      condition["s.onboarding_done"] = 0;
    }
    if (req.bodyString("ekyc_status") == "ekyc_done") {
      condition["s.ekyc_done"] = 2;
    }
    if (req.bodyString("ekyc_status") == "onboarding_done") {
      condition["s.ekyc_required"] = 0;
      condition["s.onboarding_done"] = 1;
    }
    if (req.bodyString("ekyc_status") == "ekyc_denied") {
      condition["s.ekyc_required"] = 1;
      condition["s.ekyc_done"] = 3;
    }

    const search_text = req.bodyString("search");
    const filter = {};
    if (search_text) {
      filter["m.company_name"] = search_text;
      filter["s.email"] = search_text;
      filter["m.legal_person_email"] = search_text;
      filter["m.business_phone_number"] = search_text;
    }

    SubmerchantModel.select(condition, filter, limit, condition2)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let owner_ekyc_details = await SubmerchantModel.ownerEkycCount(
            val.id
          );
          let res = {
            submerchant_id: enc_dec.cjs_encrypt(val.id),
            rep_id: enc_dec.cjs_encrypt(val.rep_id),
            ekyc_done: val.ekyc_done == 2 ? "Yes" : "No",
            ekyc_required: val.ekyc_required == 1 ? "Yes" : "No",
            onboarding_done:
              owner_ekyc_details.total == owner_ekyc_details.ekyc_done &&
              val.onboarding_done == 1
                ? "Yes"
                : "No",
            mail_send_to_psp: val.psp_mail_send == 1 ? "Yes" : "No",
            register_business_country: await helpers.get_country_name_by_id(
              val.register_business_country
            ),
            type_of_business: await helpers.get_entity_type(
              val.type_of_business
            ),
            company_registration_number: val.company_registration_number,
            legal_business_name: val.company_name,
            representative:
              val.legal_person_first_name + " " + val.legal_person_last_name,
            email:
              val.email == ""
                ? val.legal_person_email
                  ? val.legal_person_email
                  : ""
                : val.email,
            kyc_status:
              val.onboarding_done != 1
                ? "Onboarding Pending"
                : val.ekyc_required == 1 && val.ekyc_done == 1
                ? "EKYC Pending"
                : val.ekyc_required == 1 && val.ekyc_done == 2
                ? "EKYC Done"
                : val.ekyc_required == 0 && val.onboarding_done == 1
                ? "Onboarding Done"
                : val.ekyc_required == 1 && val.ekyc_done == 3
                ? "EKYC Denied"
                : "",
            status: val.status == 1 ? "Deactivated" : "Active",
            live: val.live,
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
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  add_meeting: async (req, res) => {
    try {
      let merchant_id = await enc_dec.cjs_decrypt(
        req.bodyString("merchant_id")
      );

      let owner_id = req.bodyString("owner_id")
        ? encrypt_decrypt("decrypt", req.bodyString("owner_id"))
        : "";
      var delete_data = {
        deleted: 1,
      };

      var delete_room = await MerchantModel.update_meeting(
        { room_id: req.bodyString("prev_room_id") },
        delete_data
      );
      userData = {
        super_merchant_id: await helpers.get_super_merchant_id(merchant_id),
        merchant_id: merchant_id,
        owner_id: owner_id,
        room_id: req.bodyString("room_id"),
        name: req.bodyString("name"),
        meeting_url: req.bodyString("meeting_url"),
        start_time: req.bodyString("start_time"),
        end_time: req.bodyString("end_time"),
        time_zone: req.bodyString("time_zone"),
        status: 0,
      };

      ins_id = await MerchantModel.add_meeting(userData);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Meeting added successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  meeting_details: async (req, res) => {
    let rec_id = await enc_dec.cjs_decrypt(req.bodyString("submerchant_id"));
    MerchantModel.selectMeetingOne("*", {
      merchant_id: rec_id,
      deleted: 0,
      status: 0,
    })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let resp = {
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          merchant_name: await helpers.get_submerchant_name_by_id(
            val.merchant_id
          ),
          room_id: val.room_id,
          meeting_url: val.meeting_url,
          owner_id: val.owner_id ? enc_dec.cjs_encrypt(val.owner_id) : "",
          timing:
            moment(val.start_time).format("DD-MM-YYYY") +
            " " +
            moment(val.start_time).format("HH:mm") +
            " - " +
            moment(val.end_time).format("HH:mm") +
            " GST",
          start_time: moment(val.start_time).format("DD-MM-YYYY HH:mm"),
          end_time: moment(val.end_time).format("DD-MM-YYYY HH:mm"),
          status: val.status == 0 ? "Pending" : "Done",
          deleted: val.deleted,
        };
        send_res = resp;

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
  list_merchant_meeting: async (req, res) => {
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

    condition = {
      super_merchant_id: req.user.super_merchant_id
        ? req.user.super_merchant_id
        : req.user.id,
      status: 0,
      deleted: 0,
    };

    MerchantModel.selectMeeting(condition)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
            merchant_name: await helpers.get_submerchant_name_by_id(
              val.merchant_id
            ),
            room_id: val.room_id,
            meeting_url: val.meeting_url,
            owner_id: val.owner_id ? enc_dec.cjs_encrypt(val.owner_id) : "",
            timing:
              moment(val.start_time).format("DD-MM-YYYY") +
              " " +
              moment(val.start_time).format("HH:mm") +
              " - " +
              moment(val.end_time).format("HH:mm") +
              " GST",
            start_time: moment(val.start_time).format("DD-MM-YYYY HH:mm"),
            end_time: moment(val.end_time).format("DD-MM-YYYY HH:mm"),
            status: val.status,
            deleted: val.deleted,
          };

          send_res.push(res);
        }

        total_count = await MerchantModel.get_count_meetings(condition);
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
  update_meeting: async (req, res) => {
    try {
      var delete_data = {
        status: 1,
      };

      var delete_room = await MerchantModel.update_meeting(
        { room_id: req.bodyString("room_id") },
        delete_data
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Meeting updated successfully"));
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errormsg(error));
    }
  },
  dropdown_list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("per_page") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("per_page"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    const search_text = req.bodyString("search");
    const status = helpers.get_status(req.bodyString("status"));
    const country = await helpers.get_country_id_by_name(
      req.bodyString("country")
    );
    const state = `'${req.bodyString("state")}'`;
    const city = `'${req.bodyString("city")}'`;

    let search = '';
    if (req.user.type == "merchant") {
      let mer_details = await SubmerchantModel.main_merchant_details({
        "mm.super_merchant_id": req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
      });
      search = {
        ["s.deleted"]: 0,
        ["s.super_merchant_id"]: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
        // ["s.live"]: mer_details.mode == "live" ? 1 : 0,
      };
      search_count = {
        ["deleted"]: 0,
        ["super_merchant_id"]: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
        // ["live"]: mer_details.mode == "live" ? 1 : 0,
      };
    } else {
      search = { ["s.deleted"]: 0 };
      search_count = { deleted: 0 };
    }
    const filter = {};
    if (req.bodyString("submerchant_id") && req.bodyString("submerchant_id") != '' && req.bodyString("submerchant_id") != 0) {
      let submerchant_id = req.bodyString("submerchant_id");
      if (submerchant_id?.length > 10) {
        submerchant_id = await enc_dec.cjs_decrypt(submerchant_id);
      }
      search["s.id"] = submerchant_id;
    }
    if (req.bodyString("super_merchant_id") && req.bodyString("super_merchant_id") != '' && req.bodyString("super_merchant_id") != 0) {
      let super_merchant_id = req.bodyString("super_merchant_id");
      if (super_merchant_id?.length > 10) {
        super_merchant_id = await enc_dec.cjs_decrypt(super_merchant_id);
      }
      search["s.super_merchant_id"] = super_merchant_id;
    }
    if (req.bodyString("country")) {
      search.country = country;
    }
    if (req.bodyString("city")) {
      search.city = city;
    }
    if (req.bodyString("state")) {
      search.state = state;
    }
    if (req.bodyString("status")) {
      search.status = status;
    }
    if (search_text) {
      filter.company_name = search_text;
      filter.email = search_text;
      filter.legal_person_email = search_text;
      filter.business_phone_number = search_text;
    }

    MerchantModel.dropdownselect(search, filter, limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            submerchant_id: enc_dec.cjs_encrypt(val?.id),
            show_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            merchant_name: val?.company_name,
            legal_business_name: val?.company_name,
            // email: val.email,
            // country_code: val.code,
            // mobile_no: val.mobile_no,
            status: val?.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }

        total_count = await MerchantModel.dropdownselect_count(search, filter);
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
       console.log("🚀 ~ error:", error)
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  mid_dropdown_list: async (req, res) => {
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("per_page") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("per_page"));
      start = parseInt(req.bodyString("page"));

      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }
    const search_text = req.bodyString("search");
    const status = helpers.get_status(req.bodyString("status"));
    const country = await helpers.get_country_id_by_name(
      req.bodyString("country")
    );
    const state = `'${req.bodyString("state")}'`;
    const city = `'${req.bodyString("city")}'`;

    let search = '';
    if (req.user.type == "merchant") {
      let mer_details = await SubmerchantModel.main_merchant_details({
        "mm.super_merchant_id": req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id, });
      search = {
        ["s.deleted"]: 0,
        ["s.super_merchant_id"]: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
        // ["s.live"]: mer_details.mode == "live" ? 1 : 0,
      };
      search_count = {
        ["deleted"]: 0,
        ["super_merchant_id"]: req.user.super_merchant_id ? req.user.super_merchant_id : req.user.id,
        // ["live"]: mer_details.mode == "live" ? 1 : 0,
      };
    } else {
      search = { ["s.deleted"]: 0 };
      search_count = { deleted: 0 };
    }
    const filter = {};
    if (req.bodyString("submerchant_id") && req.bodyString("submerchant_id") != '' && req.bodyString("submerchant_id") != 0) {
      let submerchant_id = req.bodyString("submerchant_id");
      if (submerchant_id?.length > 10) {
        submerchant_id = await enc_dec.cjs_decrypt(submerchant_id);
      }
      search["s.id"] = submerchant_id;
    }
    if (req.bodyString("country")) {
      search.country = country;
    }
    if (req.bodyString("city")) {
      search.city = city;
    }
    if (req.bodyString("state")) {
      search.state = state;
    }
    if (req.bodyString("status")) {
      search.status = status;
    }
    if (search_text) {
      filter.company_name = search_text;
      filter.email = search_text;
      filter.legal_person_email = search_text;
      filter.business_phone_number = search_text;
    }

    MerchantModel.middropdownselect(search, filter, limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            submerchant_id: enc_dec.cjs_encrypt(val?.id),
            show_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            merchant_name: val?.company_name,
            legal_business_name: val?.company_name,
            // email: val.email,
            // country_code: val.code,
            // mobile_no: val.mobile_no,
            status: val?.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }

        total_count = await MerchantModel.middropdownselect_count(search, filter);
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
       console.log("🚀 ~ error:", error)
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};

module.exports = data_set;
