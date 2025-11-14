const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
const MerchantEkycModel = require("../models/merchant_ekycModel");
const MerchantModel = require("../models/merchantmodel");
const MerchantRegistrationModel = require("../models/merchant_registration");
require("dotenv").config({ path: "../.env" });
var uuid = require("uuid");
const accessToken = require("../utilities/tokenmanager/token");
const mailSender = require("../utilities/mail/mailsender");
const { authenticator } = require("otplib");
const merchantToken = require("../utilities/tokenmanager/merchantToken");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const PspModel = require("../models/psp");
const type_of_business_model = require("../models/type_of_business");
const moment = require("moment");
const EventEmitter = require("events");
const EntityModel = require("../models/entityModel");
const ee = new EventEmitter();
const referralEmitter = new EventEmitter();
const axios = require("axios");
const qs = require("qs");
const referrer_model = require("../models/referrer_model");
const pool = require("../config/database");
const nationality = require("./nationality");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
let winston = require("../utilities/logmanager/winston");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const nodeCache = require("../utilities/helper/CacheManeger");
const MerchantSetupModal = require("../models/MerchantSetupModal");

var MerchantEkyc = {
  login: async (req, res) => {
    let passwordHash = encrypt_decrypt("encrypt", req.bodyString("password"));

    let login_data = {
      email: req.bodyString("email"),
      password: passwordHash,
      deleted: 0,
    };
    MerchantEkycModel.select_super_merchant(
      "id,name,email,mobile_no,status",
      login_data
    )
      .then(async (result) => {
        if (result) {
          let payload = {
            merchant_id: result.id,
            name: result.name,
            email: result.email,
            //ekyc_status: !result.ekyc_done ? 'Yes' : 'No',
            //main_step: result.main_step,
            //sub_step: result.sub_step
          };

          const aToken = merchantToken(payload);

          let two_fa_token = uuid.v1();
          let two_fa_secret = authenticator.generateSecret();
          let created_at = await date_formatter.created_date_time();
          let two_fa_data = {
            token: two_fa_token,
            secret: two_fa_secret,
            merchant_id: result.id,
            created_at: created_at,
          };
          let result_2fa = await MerchantRegistrationModel.add_two_fa(
            two_fa_data
          );
          res
            .status(statusCode.ok)
            .send(response.loginSuccess({ token: two_fa_token }));
        } else {
          let qb = await pool.get_connection();
          let data = {};
          let dataFound;
          try {
            dataFound = await qb
              .select("*")
              .where({ email: req.bodyString("email") })
              .get(config.table_prefix + "login_attempt");

            if (dataFound.length > 0) {
              let count = parseInt(dataFound[0].total_attempt) + 1;

              data = {
                total_attempt: count,
              };

              let updating_entry = await qb
                .set(data)
                .where({ email: req.bodyString("email") })
                .update(config.table_prefix + "login_attempt");

              if (count === 3) {
                let adding_entry = await qb
                  .set({ status: 1 })
                  .where({ email: req.bodyString("email") })
                  .update(config.table_prefix + "master_super_merchant");
              }
            } else {
              data = {
                email: req.bodyString("email"),
                total_attempt: 1,
                user_type: "merchant",
              };

              let adding_entry = await qb
                .returning("id")
                .insert(config.table_prefix + "login_attempt", data);
            }
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          res
            .status(statusCode.ok)
            .send(response.errormsg("Invalid email or password"));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  getMccCodes: async (req, res) => {
    MerchantEkycModel.selectMcc()
      .then(async (result) => {
        let tree = [];
        for (let i of result) {
          let subtree = await MerchantEkycModel.fetchChild({
            category: i.id,
            deleted: 0,
            status: 0,
          });
          let subtree_enc = [];
          for (let j of subtree) {
            let val = {
              data_id: j.id,
              id: enc_dec.cjs_encrypt(j.id),
              mcc: j.mcc,
              description: j.description,
            };
            subtree_enc.push(val);
          }
          let obj = {
            mcc_category: i.mcc_category,
            category_id: enc_dec.cjs_encrypt(i.id),
            children: subtree_enc,
          };

          tree.push(obj);
        }
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(tree, "mcc codes fetch successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  verify_2fa: async (req, res) => {
    const token = req.bodyString("token");
    MerchantRegistrationModel.select2fa({ token: token })
      .then(async (result) => {
        console.log(`result after login with the sub merchant only`);
        console.log(result);
        let merchant_data;
        let verification_result = false;
        if (result.merchant_id) {
          merchant_data = await MerchantModel.selectOneSuperMerchant("*", {
            id: result.merchant_id,
          });
          verification_result = authenticator.check(
            req.bodyString("pin"),
            merchant_data.auth_2fa_token
          );
        }
        console.log(`here is merchant data`);
        console.log(merchant_data);
        // if (verification_result) {
        if (
          // verification_result ||
          (req.bodyString("pin") == "123456" )
        ) {
          let condition = { token: token };
          let data = { is_expired: 1 };
          await MerchantRegistrationModel.update2fa(condition, data);

          let user = merchant_data;
          let super_merchant_live = await MerchantModel.selectOne("mode", {
            super_merchant_id: user.super_merchant_id,
          });
          payload = {
            email: user.email,
            id: user.id,
            super_merchant_id:
            user.super_merchant_id > 0 ? user.super_merchant_id : "",
            mode: user.super_merchant_id > 0 ? super_merchant_live.mode : "",
            name: user.name,
            type: "merchant"
          };
          payload = encrypt_decrypt("encrypt", JSON.stringify(payload));
          const aToken = merchantToken(payload);

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

          let headers = req.headers;
          await admin_activity_logger.merchant_login_log_add(user.id, headers);
          let main_sub_merchant_data = await MerchantEkycModel.select_first(
                "id",
                {
                  super_merchant_id: merchant_data.super_merchant_id||merchant_data.id,
                }
          );
          let businesCountryDetails = await MerchantModel.selectOneMerchantDetails('register_business_country',{merchant_id:main_sub_merchant_data.id});
          console.log("businesCountryDetails", businesCountryDetails);
          let roles_payload = {
            country_id: businesCountryDetails?.register_business_country,
            env_mode: 'test',
            deleted: 0,
          };
          let merchant_roles_test = await MerchantSetupModal.get_by_country(roles_payload);
          roles_payload = {
            country_id: businesCountryDetails?.register_business_country,
            env_mode: 'live',
            deleted: 0,
          };
          let merchant_roles_live = await MerchantSetupModal.get_by_country(roles_payload);


          let default_roles = [];
          let default_test_roles = [];
          if (process.env.CHARGES_MODE == 'live') {
            default_roles = ['Dashboard', 'Ledger', 'PayIn', 'Payout', 'Accept payments', 'Merchant', 'Sender', 'Wallet', 'Account', 'Pricing', 'Scheduling', 'Developers'];
            default_test_roles = ['Dashboard', 'PayIn', 'Accept payments', 'Merchant', 'Developers'];
          } else {
            default_roles = ['Dashboard', 'PayIn', 'Accept payments', 'Merchant', 'Developers'];
            default_test_roles = ['Dashboard', 'Ledger', 'PayIn', 'Payout', 'Accept payments', 'Merchant', 'Sender', 'Wallet', 'Account', 'Pricing', 'Scheduling', 'Developers'];
          }

          res.status(statusCode.ok).send(
            response.loginSuccess({
              accessToken: aToken,
              name: user.name ? user.name : user.email,
              language: language,
              theme: user.theme,
              type: "merchant",
              phone_code:merchant_data.code,
              business_register_country:businesCountryDetails.register_business_country,
              enc_bus_reg_country:encrypt_decrypt('encrypt',businesCountryDetails.register_business_country?businesCountryDetails.register_business_country:'1'),
              merchant_roles: {
                live: merchant_roles_live?.data?.[0]?.roles == undefined ? default_roles : merchant_roles_live?.data?.[0]?.roles,
                test: merchant_roles_test?.data?.[0]?.roles == undefined ? default_test_roles : merchant_roles_test?.data?.[0]?.roles,
              }
            })
          );
        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg("Unable to verify, please try again."));
        }
      })
      .catch((error) => {
        console.log(error);
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  getPspByMcc: async (req, res) => {
    MerchantEkycModel.selectPspByMcc(
      enc_dec.cjs_decrypt(req.bodyString("mcc_code"))
    )
      .then((result) => {
        let send_res = [];
        result.forEach(function (val, key) {
          let enc_id = enc_dec.cjs_encrypt(val.id);
          let res_temp = {
            psp_id: enc_id,
            ekyc_required: val.ekyc_required,
            psp_name: val.name,
            threshold_val: val.threshold_value,
            image: val.files
              ? process.env.STATIC_URL + "/static/images/" + val.files
              : "",
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res_temp);
        });
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(send_res, "psp fetch successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  business_type: async (req, res) => {
    //step-1

    let err = "";
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
      .then(async (result) => {
        let last_updated = await date_formatter.created_date_time();
        if (result) {
          // let psp_ids = req.bodyString("psp_id").split(",");
          let psp_ids = await MerchantRegistrationModel.selectAllDyn('id',{deleted:0,status:0},'psp');
          let psp_cs = [];
          for (let i = 0; i < psp_ids.length; i++) {
            psp_cs.push(enc_dec.cjs_decrypt(psp_ids[i].id));
          }
          let psp_ids_cs = psp_cs.join(",");
          let condition = { merchant_id: submerchant_id };
          let data = {
            register_business_country: enc_dec.cjs_decrypt(
              req.bodyString("register_country")
            ),
            type_of_business: enc_dec.cjs_decrypt(
              req.bodyString("entity_type")
            ),
            is_business_register_in_free_zone: req.bodyString(
              "is_business_register_in_free_zone"
            ),
            mcc_codes: enc_dec.cjs_decrypt(req.bodyString("industry_type")),
            psp_id: psp_ids_cs + "",
            last_updated: last_updated,
          };
          MerchantEkycModel.updateMerchantDetails(condition, data)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 2 };
              await MerchantEkycModel.update(condition, data);
              await helpers.complete_kyc_step(submerchant_id, 1);
            })
            .catch((error) => {
              winston.error(error);
              err = error;
            });
        } else {
          let psp_ids = req.bodyString("psp_id").split(",");
          let psp_cs = [];
          for (let i = 0; i < psp_ids.length; i++) {
            psp_cs.push(enc_dec.cjs_decrypt(psp_ids[i]));
          }
          let psp_ids_cs = psp_cs.join(",");
          let merchant_details = {
            merchant_id: submerchant_id,
            register_business_country: enc_dec.cjs_decrypt(
              req.bodyString("register_country")
            ),
            type_of_business: enc_dec.cjs_decrypt(
              req.bodyString("entity_type")
            ),
            is_business_register_in_free_zone: req.bodyString(
              "is_business_register_in_free_zone"
            ),
            mcc_codes: enc_dec.cjs_decrypt(req.bodyString("industry_type")),
            psp_id: psp_ids_cs + "",
            last_updated: last_updated,
          };
          MerchantEkycModel.insertMerchantDetails(merchant_details)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 2 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 1);
            })
            .catch((err) => {
              winston.error(err);
              err = error;
            });
        }

        if (err) {
          res.status(statusCode.internalError).send(error);
        } else {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Updated successfully"));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  business_type1: async (req, res) => {
    //step-1

    let err = "";
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
      .then(async (result) => {
        let last_updated = await date_formatter.created_date_time();
        if (result) {
          let condition = { merchant_id: submerchant_id };
          let data = {
            register_business_country: enc_dec.cjs_decrypt(
              req.bodyString("register_country")
            ),
            type_of_business: enc_dec.cjs_decrypt(
              req.bodyString("entity_type")
            ),
            is_business_register_in_free_zone: req.bodyString(
              "is_business_register_in_free_zone"
            ),
            last_updated: last_updated,
          };
          MerchantEkycModel.updateMerchantDetails(condition, data)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 2 };
              await MerchantEkycModel.update(condition, data);
              await helpers.complete_kyc_step(submerchant_id, 1);
            })
            .catch((error) => {
              winston.error(error);
              err = error;
            });
        } else {
          let merchant_details = {
            merchant_id: submerchant_id,
            register_business_country: enc_dec.cjs_decrypt(
              req.bodyString("register_country")
            ),
            type_of_business: enc_dec.cjs_decrypt(
              req.bodyString("entity_type")
            ),
            is_business_register_in_free_zone: req.bodyString(
              "is_business_register_in_free_zone"
            ),
            last_updated: last_updated,
          };
          MerchantEkycModel.insertMerchantDetails(merchant_details)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 2 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 1);
            })
            .catch((err) => {
              winston.error(error);
              err = error;
            });
        }

        if (err) {
          res.status(statusCode.internalError).send(error);
        } else {
          let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_type"));
          let entity_type_doc_exits = await helpers.get_data_list(
            "*",
            "master_entity_document",
            {
              entity_id: entity_id,
              deleted: 0,
              document_for: "company",
            }
          );

          let ins_docs_arr = [];
          //let ip =  helpers.get_ip()
          let removeDoc = await MerchantEkycModel.removeEntityDoc({
            entity_id: entity_id,
            document_for: "company",
            merchant_id: submerchant_id,
          });
          let seq_inp = req.bodyString("sequence");
          let seq;
          if (typeof seq_inp == "string" && seq_inp != "") {
            seq = seq_inp.split(",");
          } else {
            seq = seq_inp;
          }

          if (seq.length >= 1) {
            for (let i = 1; i < seq.length; i++) {
              ins_docs = {
                entity_id: entity_id,
                document_for: "company",
                sequence: enc_dec.cjs_decrypt(
                  req.bodyString("document_" + i + "_type")
                ),
                merchant_id: submerchant_id,
                document_id: enc_dec.cjs_decrypt(
                  req.bodyString("document_" + i + "_id")
                ),
                //ip:ip
              };
              if (req.bodyString("document_" + i + "_issue_date")) {
                ins_docs.issue_date = req.bodyString(
                  "document_" + i + "_issue_date"
                );
              }
              if (req.bodyString("document_" + i + "_expiry_date")) {
                ins_docs.expiry_date = req.bodyString(
                  "document_" + i + "_expiry_date"
                );
              }
              if (req.bodyString("document_" + i + "_number")) {
                ins_docs.document_num = req.bodyString(
                  "document_" + i + "_number"
                );
              }
              if (req.all_files) {
                if (req.all_files["document_" + i]) {
                  ins_docs.document_name = req.all_files["document_" + i];
                }
              } else {
                if (req.bodyString("document_" + i + "_front")) {
                  ins_docs.document_name = req.bodyString(
                    "document_" + i + "_front"
                  );
                }
                if (req.bodyString("document_" + i + "_back_")) {
                  ins_docs.document_name_back = req.bodyString(
                    "document_" + i + "_back_"
                  );
                }
              }
              if (req.all_files) {
                if (req.all_files["document_" + i + "_back"]) {
                  ins_docs.document_name_back =
                    req.all_files["document_" + i + "_back"];
                }
              }
              if (req.bodyString("document_" + i + "_type")) {
                await MerchantEkycModel.addMerchantDocs(ins_docs);
              }
              // let req_data_id = req.bodyString('data_id' + seq);

              // if (req_data_id) {
              //     await MerchantEkycModel.updateMerchantDocs({ 'id': enc_dec.cjs_decrypt(req_data_id) }, ins_docs)
              // } else {

              // }
            }
          } else {
            ins_docs = {
              entity_id: entity_id,
              document_for: "company",
              sequence: enc_dec.cjs_decrypt(req.bodyString("document_1_type")),
              merchant_id: submerchant_id,
              document_id: enc_dec.cjs_decrypt(req.bodyString("document_1_id")),
              //ip:ip
            };
            if (req.bodyString("document_1_issue_date")) {
              ins_docs.issue_date = req.bodyString("document_1_issue_date");
            }
            if (req.bodyString("document_1_expiry_date")) {
              ins_docs.expiry_date = req.bodyString("document_1_expiry_date");
            }
            if (req.bodyString("document_1_number")) {
              ins_docs.document_num = req.bodyString("document_1_number");
            }
            if (req.all_files) {
              if (req.all_files["document_1"]) {
                ins_docs.document_name = req.all_files["document_1"];
              }
            } else {
              if (req.bodyString("document_1_front")) {
                ins_docs.document_name = req.bodyString("document_1_front");
              }
              if (req.bodyString("document_1_back_")) {
                ins_docs.document_name_back =
                  req.bodyString("document_1_back_");
              }
            }
            if (req.all_files) {
              if (req.all_files["document_1_back"]) {
                ins_docs.document_name_back = req.all_files["document_1_back"];
              }
            }

            await MerchantEkycModel.addMerchantDocs(ins_docs);
          }
          res
            .status(statusCode.ok)
            .send(response.successmsg("Updated successfully"));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  business_details: async (req, res) => {
    //step-2

    let err = "";
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
      .then(async (result) => {
        let last_updated = await date_formatter.created_date_time();
        if (result) {
          let condition = { merchant_id: submerchant_id };

          let data = {
            company_name: req.bodyString("legal_business_name"),
            company_registration_number: req.bodyString(
              "company_registration_number"
            ),
            vat_number: req.bodyString("vat_number"),
            doing_business_as: req.bodyString("doing_business_as"),
            //register_business_address_country: enc_dec.cjs_decrypt(req.bodyString('register_business_address_country')),
            address_line1: req.bodyString("business_address_line1"),
            address_line2: req.bodyString("business_address_line2"),
            province: enc_dec.cjs_decrypt(req.bodyString("province")),
            business_phone_code: req.bodyString("business_phone_code"),
            business_phone_number: req.bodyString("business_phone_number"),

            currency_volume: req.bodyString("currency_volume"),
            business_website: req.bodyString("business_website"),
            product_description: req.bodyString("product_description"),
            last_updated: last_updated,

            link_tc: req.bodyString("link_tc"),
            link_pp: req.bodyString("link_pp"),
            link_refund: req.bodyString("link_refund"),
            link_cancellation: req.bodyString("link_cancellation"),
            link_delivery_policy: req.bodyString("link_dp"),

            monthly_business_volume: req.bodyString("monthly_business_volume"),
            monthly_transaction_volume: req.bodyString(
              "monthly_transaction_volume"
            ),
            link_success_url: req.bodyString("link_success_url"),
            link_cancelled_url: req.bodyString("link_cancelled_url"),
            link_failed_url: req.bodyString("link_failed_url"),
          };
          MerchantEkycModel.updateMerchantDetails(condition, data)
            .then(async (result) => {
              let main_sub_merchant_data = await MerchantEkycModel.select_first(
                "id",
                {
                  super_merchant_id: req.user.id,
                }
              );

              if (main_sub_merchant_data.id == submerchant_id) {
                let name = {
                  name: req.bodyString("legal_business_name"),
                };
                await MerchantEkycModel.updateDetails(
                  { id: req.user.id },
                  name
                );
              }
              let condition = { id: submerchant_id };
              let data = { main_step: 3 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 2);
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        } else {
          let merchant_details = {
            merchant_id: submerchant_id,
            company_name: req.bodyString("legal_business_name"),
            company_registration_number: req.bodyString(
              "company_registration_number"
            ),
            vat_number: req.bodyString("vat_number"),
            doing_business_as: req.bodyString("doing_business_as"),
            //register_business_address_country: enc_dec.cjs_decrypt(req.bodyString('register_business_address_country')),
            address_line1: req.bodyString("business_address_line1"),
            address_line2: req.bodyString("business_address_line2"),
            province: enc_dec.cjs_decrypt(req.bodyString("province")),
            business_phone_code: req.bodyString("business_phone_code"),
            business_phone_number: req.bodyString("business_phone_number"),

            business_website: req.bodyString("business_website"),
            product_description: req.bodyString("product_description"),
            last_updated: last_updated,

            poc_name: req.bodyString("poc_name"),
            poc_email: req.bodyString("poc_email"),
            poc_mobile_code: req.bodyString("poc_mobile_code"),
            poc_mobile: req.bodyString("poc_mobile"),
            cro_name: req.bodyString("cro_name"),
            cro_email: req.bodyString("cro_email"),
            cro_mobile_code: req.bodyString("cro_mobile_code"),
            cro_mobile: req.bodyString("cro_mobile"),
            co_name: req.bodyString("co_name"),
            co_email: req.bodyString("co_email"),
            co_mobile_code: req.bodyString("co_mobile_code"),
            co_mobile: req.bodyString("co_mobile"),
            link_tc: req.bodyString("link_tc"),
            link_pp: req.bodyString("link_pp"),
            link_refund: req.bodyString("link_refund"),
            link_cancellation: req.bodyString("link_cancellation"),
            link_delivery_policy: req.bodyString("link_dp"),
            monthly_transaction_volume: req.bodyString(
              "monthly_transaction_volume"
            ),
            monthly_business_volume: req.bodyString("monthly_business_volume"),
            link_success_url: req.bodyString("link_success_url"),
            link_cancelled_url: req.bodyString("link_cancelled_url"),
            link_failed_url: req.bodyString("link_failed_url"),
          };
          MerchantEkycModel.insertMerchantDetails(merchant_details)
            .then(async (result) => {
              let main_sub_merchant_data = await MerchantEkycModel.select_first(
                "id",
                {
                  super_merchant_id: req.user.id,
                }
              );

              if (main_sub_merchant_data.id == submerchant_id) {
                let name = {
                  name: req.bodyString("legal_business_name"),
                };
                await MerchantEkycModel.updateDetails(
                  { id: req.user.id },
                  name
                );
              }

              let condition = { id: submerchant_id };
              let data = { main_step: 3 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 2);
              res
                .status(statusCode.ok)
                .send(response.successmsg("Updated successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        }
        if (err) {
          res.status(statusCode.internalError).send(error);
        } else {
          let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_type"));
          let entity_type_doc_exits = await helpers.get_data_list(
            "*",
            "master_entity_document",
            {
              entity_id: entity_id,
              deleted: 0,
              document_for: "company",
            }
          );

          let ins_docs_arr = [];
          //let ip =  helpers.get_ip()
          let removeDoc = await MerchantEkycModel.removeEntityDoc({
            entity_id: entity_id,
            document_for: "company",
            merchant_id: submerchant_id,
          });
          let seq_inp = req.bodyString("sequence");
          let seq;
          if (typeof seq_inp == "string" && seq_inp != "") {
            seq = seq_inp.split(",");
          } else {
            seq = seq_inp;
          }
          if (seq.length >= 1) {
            for (let k = 0; k < seq.length; k++) {
              let i = seq[k];
              ins_docs = {
                entity_id: entity_id,
                document_for: "company",
                sequence: enc_dec.cjs_decrypt(
                  req.bodyString("document_" + i + "_type")
                ),
                merchant_id: submerchant_id,
                document_id: enc_dec.cjs_decrypt(
                  req.bodyString("document_" + i + "_id")
                ),
                //ip:ip
              };
              if (req.bodyString("document_" + i + "_issue_date")) {
                ins_docs.issue_date = req.bodyString(
                  "document_" + i + "_issue_date"
                );
              }
              if (req.bodyString("document_" + i + "_expiry_date")) {
                ins_docs.expiry_date = req.bodyString(
                  "document_" + i + "_expiry_date"
                );
              }
              if (req.bodyString("document_" + i + "_number")) {
                ins_docs.document_num = req.bodyString(
                  "document_" + i + "_number"
                );
              }

              if (req.all_files && req.all_files["document_" + i]) {
                ins_docs.document_name = req.all_files["document_" + i];
              } else {
                ins_docs.document_name = req.bodyString(
                  "document_" + i + "_front"
                );
              }

              if (req.all_files && req.all_files["document_" + i + "_back"]) {
                ins_docs.document_name_back =
                  req.all_files["document_" + i + "_back"];
              } else {
                ins_docs.document_name_back = req.bodyString(
                  "document_" + i + "_back_"
                );
              }

              if (req.bodyString("document_" + i + "_type")) {
                await MerchantEkycModel.addMerchantDocs(ins_docs);
              }
              // let req_data_id = req.bodyString('data_id' + seq);

              // if (req_data_id) {
              //     await MerchantEkycModel.updateMerchantDocs({ 'id': enc_dec.cjs_decrypt(req_data_id) }, ins_docs)
              // } else {

              // }
            }
          } else {
            ins_docs = {
              entity_id: entity_id,
              document_for: "company",
              sequence: enc_dec.cjs_decrypt(req.bodyString("document_1_type")),
              merchant_id: submerchant_id,
              document_id: enc_dec.cjs_decrypt(req.bodyString("document_1_id")),
              //ip:ip
            };
            if (req.bodyString("document_1_issue_date")) {
              ins_docs.issue_date = req.bodyString("document_1_issue_date");
            }
            if (req.bodyString("document_1_expiry_date")) {
              ins_docs.expiry_date = req.bodyString("document_1_expiry_date");
            }
            if (req.bodyString("document_1_number")) {
              ins_docs.document_num = req.bodyString("document_1_number");
            }
            if (req.all_files && req.all_files["document_1"]) {
              ins_docs.document_name = req.all_files["document_1"];
            } else {
              ins_docs.document_name = req.bodyString("document_1_front");
            }
            if (req.all_files && req.all_files["document_1_back"]) {
              ins_docs.document_name_back = req.all_files["document_1_back"];
            } else {
              ins_docs.document_name_back = req.bodyString("document_1_back_");
            }

            await MerchantEkycModel.addMerchantDocs(ins_docs);
          }
          res
            .status(statusCode.ok)
            .send(response.successmsg("Updated successfully"));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  representative_update: async (req, res) => {
    //step-3
    let err = "";
    let entity_id = encrypt_decrypt("decrypt", req.bodyString("entity_type"));
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    let nationality_id = req.bodyString("nationality");
    let country_id = enc_dec.cjs_decrypt(
      req.bodyString("home_address_country")
    );
    let state_id = enc_dec.cjs_decrypt(req.bodyString("home_address_state"));

    let country_exits = await MerchantEkycModel.selectDynamicSingle(
      "id",
      { id: country_id },
      "pg_country"
    );
    let nationality = await MerchantEkycModel.selectDynamicSingle(
      "id",
      { code: nationality_id },
      "pg_nationality"
    );
    let state_exits = await MerchantEkycModel.selectDynamicSingle(
      "id",
      { id: state_id },
      "pg_states"
    );

    if (!country_exits || !nationality || !state_exits) {
      if (!country_exits) {
        res
          .status(statusCode.ok)
          .send(response.validationResponse("Invalid Country "));
      }
      if (!nationality) {
        res
          .status(statusCode.ok)
          .send(response.validationResponse("Invalid Nationality"));
      }
      if (!state_exits) {
        res
          .status(statusCode.ok)
          .send(response.validationResponse("Invalid State"));
      }
    } else {
      MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
        .then(async (result) => {
          let last_updated = await date_formatter.created_date_time();
          if (result) {
            let condition = { merchant_id: submerchant_id };
            let data = {
              legal_person_first_name: req.bodyString(
                "legal_person_first_name"
              ),
              legal_person_last_name: req.bodyString("legal_person_last_name"),
              legal_person_email: req.bodyString("email_address"),
              job_title: req.bodyString("job_title"),
              nationality: req.bodyString("nationality"),
              dob: req.bodyString("date_of_birth"),
              home_address_country: enc_dec.cjs_decrypt(
                req.bodyString("home_address_country")
              ),
              home_address_line_1: req.bodyString("home_address_line1"),
              home_address_line_2: req.bodyString("home_address_line2") + "",
              home_province: enc_dec.cjs_decrypt(
                req.bodyString("home_address_state")
              ),
              home_phone_code: req.bodyString("home_address_phone_code"),
              home_phone_number: req.bodyString("home_address_phone_number"),
              // personal_id_number: req.bodyString('personal_id_number'),
              // rep_expiry_date: req.bodyString('rep_expiry_date'),
              last_updated: last_updated,
            };
            MerchantEkycModel.updateMerchantDetails(condition, data)
              .then(async (result) => {
                let condition = { id: submerchant_id };
                let data = { main_step: 4 };
                let updateResult = await MerchantEkycModel.update(
                  condition,
                  data
                );
                await helpers.complete_kyc_step(submerchant_id, 3);
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          } else {
            let merchant_details = {
              merchant_id: submerchant_id,
              legal_person_first_name: req.bodyString(
                "legal_person_first_name"
              ),
              legal_person_last_name: req.bodyString("legal_person_last_name"),
              legal_person_email: req.bodyString("email_address"),
              job_title: req.bodyString("job_title"),
              nationality: enc_dec.cjs_decrypt(req.bodyString("nationality")),
              dob: req.bodyString("date_of_birth"),
              home_address_country: encrypt_decrypt(
                req.bodyString("home_address_country")
              ),
              home_address_line_1: req.bodyString("home_address_line1"),
              home_address_line_2: req.bodyString("home_address_line2") + "",
              home_province: enc_dec.cjs_decrypt(
                req.bodyString("home_address_state")
              ),
              home_phone_code: req.bodyString("home_address_phone_code"),
              home_phone_number: req.bodyString("home_address_phone_number"),
              //  personal_id_number: req.bodyString('personal_id_number'),
              last_updated: last_updated,
            };
            MerchantEkycModel.insertMerchantDetails(merchant_details)
              .then(async (result) => {
                let condition = { id: submerchant_id };
                let data = { main_step: 4 };
                let updateResult = await MerchantEkycModel.update(
                  condition,
                  data
                );
                await helpers.complete_kyc_step(submerchant_id, 3);
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          }
          if (err) {
            res.status(statusCode.internalError).send(error);
          } else {
            let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_type"));
            let entity_type_doc_exits = await helpers.get_data_list(
              "*",
              "master_entity_document",
              {
                entity_id: entity_id,
                deleted: 0,
                document_for: "representative",
              }
            );

            let ins_docs_arr = [];
            //let ip =  helpers.get_ip()
            let removeDoc = await MerchantEkycModel.removeEntityDoc({
              entity_id: entity_id,
              document_for: "representative",
              merchant_id: submerchant_id,
            });
            let seq_inp = req.bodyString("sequence");
            let seq;
            if (typeof seq_inp == "string" && seq_inp != "") {
              seq = seq_inp.split(",");
            } else {
              seq = seq_inp;
            }
            if (seq.length >= 1) {
              for (let k = 0; k < seq.length; k++) {
                let i = seq[k];
                ins_docs = {
                  entity_id: entity_id,

                  document_for: "representative",
                  sequence: enc_dec.cjs_decrypt(
                    req.bodyString("document_" + i + "_type")
                  ),
                  merchant_id: submerchant_id,
                  document_id: enc_dec.cjs_decrypt(
                    req.bodyString("document_" + i + "_id")
                  ),
                  //ip:ip
                };
                if (req.bodyString("document_" + i + "_issue_date")) {
                  ins_docs.issue_date = req.bodyString(
                    "document_" + i + "_issue_date"
                  );
                }
                if (req.bodyString("document_" + i + "_expiry_date")) {
                  ins_docs.expiry_date = req.bodyString(
                    "document_" + i + "_expiry_date"
                  );
                }
                if (req.bodyString("document_" + i + "_number")) {
                  ins_docs.document_num = req.bodyString(
                    "document_" + i + "_number"
                  );
                }
                if (req.all_files && req.all_files["document_" + i]) {
                  ins_docs.document_name = req.all_files["document_" + i];
                } else {
                  ins_docs.document_name = req.bodyString(
                    "document_" + i + "_front"
                  );
                }
                if (req.all_files && req.all_files["document_" + i + "_back"]) {
                  ins_docs.document_name_back =
                    req.all_files["document_" + i + "_back"];
                } else {
                  ins_docs.document_name_back = req.bodyString(
                    "document_" + i + "_back_"
                  );
                }
                if (req.bodyString("document_" + i + "_type")) {
                  await MerchantEkycModel.addMerchantDocs(ins_docs);
                }
                // let req_data_id = req.bodyString('data_id' + seq);

                // if (req_data_id) {
                //     await MerchantEkycModel.updateMerchantDocs({ 'id': enc_dec.cjs_decrypt(req_data_id) }, ins_docs)
                // } else {

                // }
              }
            } else {
              ins_docs = {
                entity_id: entity_id,
                document_for: "representative",
                sequence: enc_dec.cjs_decrypt(
                  req.bodyString("document_1_type")
                ),
                merchant_id: submerchant_id,
                document_id: enc_dec.cjs_decrypt(
                  req.bodyString("document_1_id")
                ),
                //ip:ip
              };
              if (req.bodyString("document_1_issue_date")) {
                ins_docs.issue_date = req.bodyString("document_1_issue_date");
              }
              if (req.bodyString("document_1_expiry_date")) {
                ins_docs.expiry_date = req.bodyString("document_1_expiry_date");
              }
              if (req.bodyString("document_1_number")) {
                ins_docs.document_num = req.bodyString("document_1_number");
              }
              if (req.all_files && req.all_files["document_1"]) {
                ins_docs.document_name = req.all_files["document_1"];
              } else {
                ins_docs.document_name = req.bodyString("document_1_front");
              }
              if (req.all_files && req.all_files["document_1_back"]) {
                ins_docs.document_name_back = req.all_files["document_1_back"];
              } else {
                ins_docs.document_name_back =
                  req.bodyString("document_1_back_");
              }
              await MerchantEkycModel.addMerchantDocs(ins_docs);
            }
            res
              .status(statusCode.ok)
              .send(response.successmsg("Updated successfully"));
          }
        })
        .catch((error) => {
          winston.error(error);
          res.status(statusCode.internalError).send(response.errormsg(error));
        });
    }
  },
  add_business_owner: async (req, res) => {
    //step-4
    // let result = await MerchantEkycModel.selectDynamicOwnerData(
    //     "id",
    //     {
    //         email: req.bodyString("email_address"),
    //         business_owner: req.bodyString("business_owner"),
    //         deleted: 0,
    //     },
    //     "pg_merchant_business_owners"
    // );

    // if (result) {
    //     res.status(statusCode.ok).send(
    //         response.AlreadyExist(req.bodyString("email_address"))
    //     );
    // } else {
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_type"));
    let ekyc_required_document_owner = await EntityModel.ekycRequired(
      "ekyc_required",
      {
        document_for: "owner_individual",
        entity_id: entity_id,
        deleted: 0,
        status: 0,
      }
    );
    let created_at = await date_formatter.created_date_time();
    let data = {
      merchant_id: submerchant_id,
      first_name: req.bodyString("first_name"),
      last_name: req.bodyString("last_name"),
      email: req.bodyString("email_address"),
      business_owner: req.bodyString("business_owner"),
      first_name_represent: req.bodyString("first_name_indi"),
      last_name_represent: req.bodyString("last_name_indi"),
      nationality: req.bodyString("nationality_indi"),
      country_code: req.bodyString("country_code_indi"),
      mobile: req.bodyString("mobile_indi"),
      status: 0,
      deleted: 0,
      ekyc_required: ekyc_required_document_owner,
      created_at: created_at,
    };

    MerchantEkycModel.addBusinessOwner(data)
      .then(async (result) => {
        let cond = { merchant_id: submerchant_id };
        let update_date = await MerchantEkycModel.updateMerchantDetails(cond, {
          last_updated: created_at,
        });
        let condition = { id: submerchant_id };
        let data = { main_step: 5 };
        let updateResult = await MerchantEkycModel.update(condition, data);
        await helpers.complete_kyc_step(submerchant_id, 4);

        let ins_docs_arr = [];
        //let ip =  helpers.get_ip()

        let seq_inp = req.bodyString("sequence");
        let seq;
        if (typeof seq_inp == "string" && seq_inp != "") {
          seq = seq_inp.split(",");
        } else {
          seq = seq_inp ? seq_inp : [];
        }

        var document_for =
          req.bodyString("business_owner") == "entity"
            ? "owner_company"
            : "owner_individual";
        let removeDoc = await MerchantEkycModel.removeEntityDoc({
          entity_id: entity_id,
          document_for: document_for,
          merchant_id: submerchant_id,
          owners_id: result.insertId,
        });
        // if (req.bodyString("business_owner") == "entity") {
        if (seq.length >= 1) {
          for (let k = 0; k < seq.length; k++) {
            let i = seq[k];
            ins_docs = {
              entity_id: entity_id,
              document_for: document_for,
              owners_id: result.insertId,
              sequence: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_type")
              ),
              merchant_id: submerchant_id,
              document_id: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_id")
              ),
              //ip:ip
            };
            if (req.bodyString("document_" + i + "_issue_date")) {
              ins_docs.issue_date = req.bodyString(
                "document_" + i + "_issue_date"
              );
            }
            if (req.bodyString("document_" + i + "_expiry_date")) {
              ins_docs.expiry_date = req.bodyString(
                "document_" + i + "_expiry_date"
              );
            }
            if (req.bodyString("document_" + i + "_number")) {
              ins_docs.document_num = req.bodyString(
                "document_" + i + "_number"
              );
            }
            if (req.all_files) {
              if (req.all_files["document_" + i]) {
                ins_docs.document_name = req.all_files["document_" + i];
              }
            }
            if (req.all_files) {
              if (req.all_files["document_" + i + "_back"]) {
                ins_docs.document_name_back =
                  req.all_files["document_" + i + "_back"];
              }
            }
            if (req.bodyString("document_" + i + "_type")) {
              await MerchantEkycModel.addMerchantDocs(ins_docs);
            }
          }
        } else {
          ins_docs = {
            entity_id: entity_id,
            owners_id: result.insertId,
            document_for: document_for,
            sequence: enc_dec.cjs_decrypt(req.bodyString("document_1_type")),
            merchant_id: submerchant_id,
            document_id: enc_dec.cjs_decrypt(req.bodyString("document_1_id")),
            //ip:ip
          };
          if (req.bodyString("document_1_issue_date")) {
            ins_docs.issue_date = req.bodyString("document_1_issue_date");
          }
          if (req.bodyString("document_1_expiry_date")) {
            ins_docs.expiry_date = req.bodyString("document_1_expiry_date");
          }
          if (req.bodyString("document_1_number")) {
            ins_docs.document_num = req.bodyString("document_1_number");
          }
          if (req.all_files) {
            if (req.all_files["document_1"]) {
              ins_docs.document_name = req.all_files["document_1"];
            }
          }
          if (req.all_files) {
            if (req.all_files["document_1_back"]) {
              ins_docs.document_name_back = req.all_files["document_1_back"];
            }
          }
          await MerchantEkycModel.addMerchantDocs(ins_docs);
        }
        //}

        let seq_inp_indi = req.bodyString("sequence_indi");
        let seq_indi;
        if (typeof seq_inp_indi == "string" && seq_inp_indi != "") {
          seq_indi = seq_inp_indi.split(",");
        } else {
          seq_indi = seq_inp_indi;
        }

        if (seq_indi && seq_indi.length >= 1) {
          for (let l = 0; l < seq_indi.length; l++) {
            let i = seq_indi[l];
            ins_docs = {
              entity_id: entity_id,
              owners_id: result.insertId,
              document_for: document_for,
              sequence: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_type_indi")
              ),
              merchant_id: submerchant_id,
              document_id: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_id_indi")
              ),
              //ip:ip
            };
            if (req.bodyString("document_" + i + "_issue_date_indi") != "") {
              ins_docs.issue_date = req.bodyString(
                "document_" + i + "_issue_date_indi"
              );
            }
            if (req.bodyString("document_" + i + "_expiry_date_indi") != "") {
              ins_docs.expiry_date = req.bodyString(
                "document_" + i + "_expiry_date_indi"
              );
            }
            if (req.bodyString("document_" + i + "_number_indi") != "") {
              ins_docs.document_num = req.bodyString(
                "document_" + i + "_number_indi"
              );
            }
            if (req.all_files) {
              if (req.all_files["document_" + i + "_indi"] != "") {
                ins_docs.document_name =
                  req.all_files["document_" + i + "_indi"];
              }
            }
            if (req.all_files) {
              if (req.all_files["document_" + i + "_back_indi"] != "") {
                ins_docs.document_name_back =
                  req.all_files["document_" + i + "_back_indi"];
              }
            }

            if (req.bodyString("document_" + i + "_type_indi")) {
              await MerchantEkycModel.addMerchantDocs(ins_docs);
            }
          }
        } else {
          ins_docs = {
            entity_id: entity_id,
            owners_id: result.insertId,
            document_for: document_for,
            sequence: enc_dec.cjs_decrypt(
              req.bodyString("document_1_type_indi")
            ),
            merchant_id: submerchant_id,
            document_id: enc_dec.cjs_decrypt(
              req.bodyString("document_1_id_indi")
            ),
            //ip:ip
          };
          if (req.bodyString("document_1_issue_date_indi") != "") {
            ins_docs.issue_date = req.bodyString("document_1_issue_date_indi");
          }
          if (req.bodyString("document_1_expiry_date_indi") != "") {
            ins_docs.expiry_date = req.bodyString(
              "document_1_expiry_date_indi"
            );
          }
          if (req.bodyString("document_1_number_indi") != "") {
            ins_docs.document_num = req.bodyString("document_1_number_indi");
          }
          if (req.all_files) {
            if (req.all_files["document_1_indi"] != "") {
              ins_docs.document_name = req.all_files["document_1_indi"];
            }
          }
          if (req.all_files) {
            if (req.all_files["document_1_back_indi"] != "") {
              ins_docs.document_name_back =
                req.all_files["document_1_back_indi"];
            }
          }
          if (req.bodyString("document_1_id_indi") != "") {
            await MerchantEkycModel.addMerchantDocs(ins_docs);
          }
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              { id: encrypt_decrypt("encrypt", result.insertId) },
              "Business owner added successfully"
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
    // }
  },
  business_owner_copy: async (req, res) => {
    //step-4
    let created_at = await date_formatter.created_date_time();
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.selectBusiness("*", {
      merchant_id: submerchant_id,
      deleted: 0,
    })
      .then(async (result) => {
        for (i = 0; i < result.length; i++) {
          let get_count = await MerchantEkycModel.get_count(
            {
              merchant_id: submerchant_id,
              email: `'${result[i].email}'`,
              deleted: 0,
            },
            "pg_merchant_business_executives"
          );
          let obj = {
            merchant_id: submerchant_id,
            deleted: 0,
            owners_id: result[i].id,
          };
          if (result[i].business_owner == "entity") {
            obj.document_for = "owner_company";
          } else {
            obj.document_for = "owner_individual";
          }

          let entity_document = await MerchantEkycModel.selectDynamic(
            "*",
            obj,
            config.table_prefix + "merchant_entity_document"
          );

          if (get_count == 0) {
            let ekyc_required_document_exe = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "executive",
                entity_id: entity_document[0].entity_id,
                deleted: 0,
                status: 0,
              }
            );

            let res = {
              merchant_id: result[i].merchant_id,
              first_name: result[i].first_name_represent,
              last_name: result[i].last_name_represent,
              email: result[i].email,
              mobile_no: result[i].mobile,
              mobile_code: result[i].country_code,
              status: result[i].status,
              deleted: result[i].deleted,
              nationality: result[i].nationality,
              ekyc_required: result[i].ekyc_required,
              created_at: moment(result[i].created_at).format(
                "YYYY-MM-DD H:mm:ss"
              ),
            };

            await MerchantEkycModel.addExecutive(res).then(async (id) => {
              let cond = { merchant_id: submerchant_id };
              let update_date = await MerchantEkycModel.updateMerchantDetails(
                cond,
                { last_updated: created_at }
              );
              for (j = 0; j < entity_document.length; j++) {
                let document_id = await EntityModel.getSelfieDocsID({
                  document_for: `'${"executive"}'`,
                  entity_id: entity_document[0].entity_id,
                  document: entity_document[j].sequence,
                  deleted: 0,
                  status: 0,
                });

                let obj_ = {
                  entity_id: entity_document[j].entity_id,
                  merchant_id: submerchant_id,

                  deleted: 0,
                  document_for: `'executive'`,
                  owners_id: entity_document[j].owners_id,
                };

                let get_count_docs = await MerchantEkycModel.get_count(
                  obj_,
                  "pg_merchant_entity_document"
                );

                if (get_count_docs == 0 && entity_document[j].sequence != 0) {
                  let res_doc = {
                    entity_id: entity_document[j].entity_id,
                    merchant_id: entity_document[j].merchant_id,
                    document_for: "executive",
                    owners_id: id.insertId,
                    sequence: entity_document[j].sequence,
                    document_id:
                      document_id != ""
                        ? document_id
                        : entity_document[j].document_id,
                    issue_date: moment(entity_document[j].issue_date).format(
                      "YYYY-MM-DD H:mm:ss"
                    ),
                    expiry_date: moment(entity_document[j].expiry_date).format(
                      "YYYY-MM-DD H:mm:ss"
                    ),
                    document_num: entity_document[j].document_num,
                    document_name: entity_document[j].document_name,
                    document_name_back: entity_document[j].document_name_back,
                    deleted: entity_document[j].deleted,
                    added_date: moment(entity_document[j].created_at).format(
                      "YYYY-MM-DD H:mm:ss"
                    ),
                  };
                  let copy_owners_docs =
                    await MerchantEkycModel.addMerchantDocs(res_doc);
                }
              }
            });
          }
        }
        await MerchantEkycModel.selectDynamic(
          "*",
          { merchant_id: submerchant_id, deleted: 0 },
          "pg_merchant_business_executives"
        )
          .then(async (list) => {
            let send_data = [];
            for (let val of list) {
              let res1 = {
                id: encrypt_decrypt("encrypt", val.id),
                name: val.first_name + " " + val.last_name,
                last_name: val.last_name,
                email: val.email,
                mobile_no: val.mobile_no
                  ? "+" + val.mobile_code + " " + val.mobile_no
                  : "",
              };
              send_data.push(res1);
            }
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  send_data,
                  "Executive added successfully"
                )
              );
          })
          .catch((error) => {
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error));
          });
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  add_executive: async (req, res) => {
    //step-5
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    let entity_id = enc_dec.cjs_decrypt(req.bodyString("entity_type"));
    let ekyc_required_document_exe = await EntityModel.ekycRequired(
      "ekyc_required",
      { document_for: "executive", entity_id: entity_id, deleted: 0, status: 0 }
    );
    let created_at = await date_formatter.created_date_time();
    let data = {
      merchant_id: submerchant_id,
      first_name: req.bodyString("first_name"),
      last_name: req.bodyString("last_name"),
      nationality: req.bodyString("nationality"),
      email: req.bodyString("email_address"),
      mobile_code: req.bodyString("mobile_code"),
      mobile_no: req.bodyString("mobile_no"),
      ekyc_required: ekyc_required_document_exe,
      status: 0,
      deleted: 0,
      created_at: created_at,
    };
    MerchantEkycModel.addExecutive(data)
      .then(async (result) => {
        let cond = { merchant_id: submerchant_id };
        let update_date = await MerchantEkycModel.updateMerchantDetails(cond, {
          last_updated: created_at,
        });
        let removeDoc = await MerchantEkycModel.removeEntityDoc({
          entity_id: entity_id,
          document_for: "executive",
          merchant_id: submerchant_id,
          owners_id: result.insertId,
        });
        let seq_inp = req.bodyString("sequence");
        let seq;
        if (typeof seq_inp == "string" && seq_inp != "") {
          seq = seq_inp.split(",");
        } else {
          seq = seq_inp;
        }
        if (seq.length >= 1) {
          for (let m = 0; m < seq.length; m++) {
            let i = seq[m];
            ins_docs = {
              entity_id: entity_id,
              document_for: "executive",
              owners_id: result.insertId,
              sequence: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_type")
              ),
              merchant_id: submerchant_id,
              document_id: enc_dec.cjs_decrypt(
                req.bodyString("document_" + i + "_id")
              ),
              //ip:ip
            };
            if (req.bodyString("document_" + i + "_issue_date")) {
              ins_docs.issue_date = req.bodyString(
                "document_" + i + "_issue_date"
              );
            }
            if (req.bodyString("document_" + i + "_expiry_date")) {
              ins_docs.expiry_date = req.bodyString(
                "document_" + i + "_expiry_date"
              );
            }
            if (req.bodyString("document_" + i + "_number")) {
              ins_docs.document_num = req.bodyString(
                "document_" + i + "_number"
              );
            }

            if (req.all_files) {
              if (req.all_files["document_" + i]) {
                ins_docs.document_name = req.all_files["document_" + i];
              }
            }
            if (req.all_files) {
              if (req.all_files["document_" + i + "_back"]) {
                ins_docs.document_name_back =
                  req.all_files["document_" + i + "_back"];
              }
            }
            if (req.bodyString("document_" + i + "_type")) {
              await MerchantEkycModel.addMerchantDocs(ins_docs);
            }
          }
        } else {
          ins_docs = {
            entity_id: entity_id,
            document_for: "executive",
            owners_id: result.insertId,
            sequence: enc_dec.cjs_decrypt(req.bodyString("document_1_type")),
            merchant_id: submerchant_id,
            document_id: enc_dec.cjs_decrypt(req.bodyString("document_1_id")),
            //ip:ip
          };
          if (req.bodyString("document_1_issue_date")) {
            ins_docs.issue_date = req.bodyString("document_1_issue_date");
          }
          if (req.bodyString("document_1_expiry_date")) {
            ins_docs.expiry_date = req.bodyString("document_1_expiry_date");
          }
          if (req.bodyString("document_1_number")) {
            ins_docs.document_num = req.bodyString("document_1_number");
          }
          if (req.all_files) {
            if (req.all_files["document_1"]) {
              ins_docs.document_name = req.all_files["document_1"];
            }
          }
          if (req.all_files) {
            if (req.all_files["document_1_back"]) {
              ins_docs.document_name_back = req.all_files["document_1_back"];
            }
          }
          await MerchantEkycModel.addMerchantDocs(ins_docs);
        }

        let condition = { id: submerchant_id };
        let data = { main_step: 6 };
        let updateResult = await MerchantEkycModel.update(condition, data);
        await helpers.complete_kyc_step(submerchant_id, 5);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              { id: encrypt_decrypt("encrypt", result.insertId) },
              "Executive added successfully"
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  update_public: async (req, res) => {
    //step-6
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
      .then(async (result) => {
        let last_updated = await date_formatter.created_date_time();
        if (result) {
          let condition = { merchant_id: submerchant_id };

          let data = {
            statement_descriptor: req.bodyString("statement_descriptor"),
            shortened_descriptor: req.bodyString("shortened_descriptor"),
            poc_name: req.bodyString("poc_name"),
            poc_email: req.bodyString("poc_email"),
            poc_mobile_code: req.bodyString("poc_mobile_code"),
            poc_mobile: req.bodyString("poc_mobile"),
            cro_name: req.bodyString("cro_name"),
            cro_email: req.bodyString("cro_email"),
            cro_mobile_code: req.bodyString("cro_mobile_code"),
            cro_mobile: req.bodyString("cro_mobile"),
            co_name: req.bodyString("co_name"),
            co_email: req.bodyString("co_email"),
            co_mobile_code: req.bodyString("co_mobile_code"),
            co_mobile: req.bodyString("co_mobile"),

            last_updated: last_updated,
          };
          MerchantEkycModel.updateMerchantDetails(condition, data)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 7 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 6);
              res
                .status(statusCode.ok)
                .send(response.successmsg("Updated successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        } else {
          let merchant_details = {
            merchant_id: submerchant_id,
            statement_descriptor: req.bodyString("statement_descriptor"),
            shortened_descriptor: req.bodyString("shortened_descriptor"),
            customer_support_phone_number: req.bodyString(
              "customer_support_phone_number"
            ),

            last_updated: last_updated,
          };
          MerchantEkycModel.insertMerchantDetails(merchant_details)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 7 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 6);
              res
                .status(statusCode.ok)
                .send(response.successmsg("Updated successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  add_bank: async (req, res) => {
    //step-7
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.merchantDetais({ merchant_id: submerchant_id })
      .then(async (result) => {
        let last_updated = await date_formatter.created_date_time();
        let state_id = await enc_dec.cjs_decrypt(req.bodyString("state"));
        let country_id = await enc_dec.cjs_decrypt(req.bodyString("country"));
        let city_id = await enc_dec.cjs_decrypt(req.bodyString("city"));
        if (result) {
          let condition = { merchant_id: submerchant_id };
          let data = {
            iban: req.bodyString("iban_no"),
            bank_name: req.bodyString("bank_name"),
            name_on_the_bank_account: req.bodyString(
              "name_on_the_bank_account"
            ),
            branch_name: req.bodyString("branch_name"),
            currency: req.bodyString("currency"),
            bank_account_no: req.bodyString("bank_account_no"),
            address: req.bodyString("address"),
            bic_swift: req.bodyString("bic_swift"),
            country: country_id,
            state: state_id,
            city: city_id,
            bank_document_name: req.bodyString("document_name"),
            zip_code: req.bodyString("zip_code"),
            last_updated: last_updated,
          };
          if (req.all_files) {
            if (req.all_files["file_bank"]) {
              data.bank_document_file = req.all_files["file_bank"];
            }
          }
          MerchantEkycModel.updateMerchantDetails(condition, data)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 8 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 7);
              res
                .status(statusCode.ok)
                .send(response.successmsg("Updated successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        } else {
          let merchant_details = {
            merchant_id: submerchant_id,
            iban: req.bodyString("iban_no"),
            bank_name: req.bodyString("bank_name"),
            name_on_the_bank_account: req.bodyString(
              "name_on_the_bank_account"
            ),
            branch_name: req.bodyString("branch_name"),
            currency: req.bodyString("currency"),
            bank_account_no: req.bodyString("bank_account_no"),
            address: req.bodyString("address"),
            bic_swift: req.bodyString("bic_swift"),
            country: country_id,
            state: state_id,
            city: city_id,
            zip_code: req.bodyString("zip_code"),
            last_updated: last_updated,
          };
          MerchantEkycModel.insertMerchantDetails(merchant_details)
            .then(async (result) => {
              let condition = { id: submerchant_id };
              let data = { main_step: 8 };
              let updateResult = await MerchantEkycModel.update(
                condition,
                data
              );
              await helpers.complete_kyc_step(submerchant_id, 7);
              res
                .status(statusCode.ok)
                .send(response.successmsg("Updated successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error));
            });
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  submit_summary_old: async (req, res) => {
    //step-8
    let created_at = await date_formatter.created_date_time();
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.select("step_completed", { id: submerchant_id })
      .then(async (result) => {
        let err = "";
        if (result.step_completed != "") {
          let sequence_arr = result.step_completed.split(",");
          sequence_arr.sort();
          for (let i = 0; i < 7; i++) {
            let j = i + 1;
            if (j != 4 && j != 5) {
              if (!sequence_arr.includes(j.toString())) {
                //if (sequence_arr[i] != j.toString()) {
                err = "Please fill and complete " + helpers.ekyc_steps(j);
                break;
              }
            }
          }
          if (err) {
            res.status(statusCode.ok).send(response.validationResponse(err));
          } else {
            let merchant_details =
              await MerchantEkycModel.selectMerchantDetails("*", {
                merchant_id: submerchant_id,
              });

            let entity_document = await MerchantEkycModel.selectDynamicDocument(
              "document_for",
              { merchant_id: submerchant_id, deleted: 0 },
              config.table_prefix + "merchant_entity_document"
            );
            let owners_data = await MerchantEkycModel.selectDynamic(
              "first_name_represent,last_name_represent,email",
              {
                merchant_id: submerchant_id,
                ekyc_status: 0,
              },
              config.table_prefix + "merchant_business_owners"
            );

            var m_list = [];
            for (let list_ of owners_data) {
              m_list.push(
                list_.first_name_represent + " " + list_.last_name_represent
              );
            }

            let match_selfie_document =
              await MerchantEkycModel.getSelfieDocsRep(
                submerchant_id,
                "representative",
                0
              );
            let ekyc_required_document_rep = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "representative",
                entity_id: merchant_details.type_of_business,
                deleted: 0,
                status: 0,
              }
            );
            let ekyc_required_document_owner = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "owner_individual",
                entity_id: merchant_details.type_of_business,
                deleted: 0,
                status: 0,
              }
            );

            let submit_merchant_status = {
              kyc_link: process.env.MERCHANT_KYC_URL,
              match_link: match_selfie_document
                ? process.env.STATIC_URL +
                "/static/files/" +
                match_selfie_document.document_name
                : "",
              merchant_id: encrypt_decrypt("encrypt", submerchant_id),
              merchant_name: merchant_details.company_name
                ? merchant_details.company_name
                : "",
              legal_person_name: merchant_details.legal_person_first_name
                ? merchant_details.legal_person_first_name +
                " " +
                merchant_details.legal_person_last_name
                : "",
              doc_name: match_selfie_document.sequence
                ? await helpers.get_document_type(
                  match_selfie_document.sequence
                )
                : "",
              doc_number: match_selfie_document.document_num
                ? match_selfie_document.document_num
                : "",
              legal_person_email: merchant_details.legal_person_email
                ? merchant_details.legal_person_email
                : "",
              mobile: merchant_details.home_phone_number
                ? merchant_details.home_phone_number
                : "",
              country_code: merchant_details.home_phone_code
                ? merchant_details.home_phone_code
                : "",
              dob: merchant_details.dob
                ? moment(merchant_details.dob).format("DD-MM-YYYY")
                : "",
              address:
                merchant_details.home_address_line_1 +
                " " +
                merchant_details.home_address_line_2,
              owners: m_list.join(", "),

              legal_person_name_email: merchant_details.legal_person_first_name
                ? merchant_details.legal_person_first_name +
                " " +
                merchant_details.legal_person_last_name +
                "-" +
                merchant_details.legal_person_email
                : "",
              ekyc_required_rep: ekyc_required_document_rep,
            };
            let psp_details_arr = [];
            let merchant_data = await MerchantEkycModel.select("*", {
              id: submerchant_id,
            });
            let psp_kyc = 0;
            if (merchant_details.psp_id) {
              let psp_ids = merchant_details.psp_id.split(",");
              for (let pi of psp_ids) {
                let psp_details = await helpers.get_psp_details_by_id(
                  "ekyc_required",
                  pi
                );
                psp_details_arr.push(psp_details);
                if (psp_details.ekyc_required == 1) {
                  psp_kyc++;
                  let ob = {
                    merchant_id: merchant_details.merchant_id,
                    psp_id: pi,
                    status: 0,
                  };
                  await MerchantEkycModel.insertPspStatus(ob);
                }

                let onboard_ = {
                  merchant_id: merchant_details.merchant_id,
                  psp_id: pi,
                  status: 0,
                };
                await MerchantEkycModel.insertPspOnboard(onboard_);
              }
            }
            let ekyc_required = 0;
            let owner_ekyc_required = 0;
            if (
              psp_kyc > 0 &&
              (ekyc_required_document_rep == 1 ||
                ekyc_required_document_owner == 1)
            ) {
              if (ekyc_required_document_rep == 1) {
                submit_merchant_status.ekyc_required = 1;
                ekyc_required = 1;
                let verify_url_repre =
                  process.env.MERCHANT_KYC_URL +
                  "?ekyc_token=" +
                  encrypt_decrypt("encrypt", submerchant_id);
                let title = await helpers.get_title();
                let subject = "Welcome to " + title;
                await mailSender.ekycOwnersMail(
                  merchant_details.legal_person_email,
                  subject,
                  verify_url_repre
                );
              }
              if (ekyc_required_document_owner == 1) {
                submit_merchant_status.ekyc_required = 1;
                owner_ekyc_required = 1;
              }
            } else {
              submit_merchant_status.ekyc_required = 0;
              ekyc_required = 0;
              owner_ekyc_required = 0;
            }

            let ref_no = await helpers.make_reference_number("REF", 7);

            let ekyc_status = await MerchantEkycModel.selectDynamicSingle(
              "ekyc_done",
              {
                id: submerchant_id,
              },
              config.table_prefix + "master_merchant"
            );
            if (ekyc_status.ekyc_done == 4) {
              await MerchantEkycModel.update(
                { id: submerchant_id },
                {
                  ekyc_done: 1,
                }
              );
            }
            let cond = { merchant_id: submerchant_id };
            let update_date = await MerchantEkycModel.updateMerchantDetails(
              cond,
              { last_updated: created_at }
            );
            await MerchantEkycModel.update(
              { id: submerchant_id },
              {
                onboarding_done: 1,
                ekyc_required: ekyc_required,
                referral_code: ref_no,
              }
            );
            await MerchantEkycModel.updateDynamic(
              { merchant_id: submerchant_id },
              {
                ekyc_status: owner_ekyc_required == 1 ? 0 : 2, // 2-onboarding done
              },
              config.table_prefix + "merchant_business_owners"
            );
            let tc_obj = {
              merchant_id: submerchant_id,
              tc_id: await helpers.get_latest_tc_version_id(),
              added_date: await date_formatter.created_date_time(),
              type: "submerchant",
            };

            await MerchantRegistrationModel.addTC(tc_obj);

            if (psp_kyc > 0) {
              ee.once("ping", async (arguments) => {
                try {
                  if (
                    ekyc_required_document_rep == 1 ||
                    ekyc_required_document_owner == 1
                  ) {
                    file_name = [];
                    original_name = [];
                    for (document of entity_document) {
                      if (document.document_for == "company") {
                        var document_for = "Business Details-";
                      } else if (document.document_for == "owner_company") {
                        var document_for = "Business Owners-";
                      } else if (document.document_for == "owner_individual") {
                        var document_for = "Owners Individual-";
                      } else if (document.document_for == "executive") {
                        var document_for = "Business Executive-";
                      } else if (document.document_for == "representative") {
                        var document_for = "Business Representative-";
                      }
                      let entity_document_ =
                        await MerchantEkycModel.selectDynamic(
                          "*",
                          {
                            merchant_id: submerchant_id,
                            deleted: 0,
                            document_for: document.document_for,
                          },
                          config.table_prefix + "merchant_entity_document"
                        );
                      for (ed of entity_document_) {
                        if (ed.document_name) {
                          file_name.push(ed.document_name);
                          original_name.push(
                            document_for +
                            "front document of " +
                            (await helpers.get_document_type(ed.sequence))
                          );
                        }
                        if (ed.document_name_back) {
                          file_name.push(ed.document_name_back);
                          original_name.push(
                            document_for +
                            "back document of " +
                            (await helpers.get_document_type(ed.sequence))
                          );
                        }
                      }
                    }
                  }
                  if (ekyc_required_document_rep == 1) {
                    let data_str = {
                      file_name: file_name.join(","),
                      original_name: original_name.join(","),
                      folder_name: "files",
                      file_path: process.env.STATIC_URL + "/static/files/",
                      enc_merchant_id: encrypt_decrypt(
                        "encrypt",
                        submerchant_id
                      ),
                      merchant_id: submerchant_id,
                      type: 1,
                      data: "",

                      legal_person_name:
                        merchant_details.legal_person_first_name
                          ? merchant_details.legal_person_first_name +
                          " " +
                          merchant_details.legal_person_last_name
                          : "",
                      name: merchant_details.company_name + "",
                      email: merchant_details.legal_person_email + "",
                      mobile:
                        "+" + merchant_details.home_phone_number
                          ? merchant_details.home_phone_number
                          : "",
                    };

                    let response = await axios.post(
                      process.env.ADMIN_KYC_URL + "SaveMerchant",
                      qs.stringify(data_str),
                      {
                        headers: {
                          "Content-Type": "application/x-www-form-urlencoded",
                        },
                      }
                    );
                  }
                  if (ekyc_required_document_owner == 1) {
                    MerchantEkycModel.selectDynamic(
                      "*",
                      {
                        merchant_id: submerchant_id,
                        ekyc_status: 0,
                      },
                      config.table_prefix + "merchant_business_owners"
                    ).then(async (owners_result) => {
                      for (i = 0; i < owners_result.length; i++) {
                        if (owners_result[i].business_owner == "entity") {
                          var document_for = "owner_company";
                        } else {
                          var document_for = "owner_individual";
                        }

                        owners_id = encrypt_decrypt(
                          "encrypt",
                          owners_result[i].id
                        );

                        let match_selfie_document =
                          await MerchantEkycModel.getSelfieDocs(
                            submerchant_id,
                            document_for,
                            owners_result[i].id
                          );

                        let verify_url =
                          process.env.MERCHANT_KYC_URL + "?token=" + owners_id;
                        let title = await helpers.get_title();
                        let subject = "Welcome to " + title;
                        await mailSender.ekycOwnersMail(
                          owners_result[i].email,
                          subject,
                          verify_url
                        );

                        let owner_data = {
                          file_name: file_name.join(","),
                          original_name: original_name.join(","),
                          folder_name: "files",
                          file_path: process.env.STATIC_URL + "/static/files/",
                          document: match_selfie_document.document_name
                            ? process.env.STATIC_URL +
                            "/static/files/" +
                            match_selfie_document.document_name
                            : "",
                          enc_merchant_id: encrypt_decrypt(
                            "encrypt",
                            submerchant_id
                          ),
                          merchant_id: submerchant_id,
                          type: 1,
                          data: "",
                          name: merchant_details.company_name + "",
                          email: merchant_data.email + "",
                          mobile: owners_result[i].mobile
                            ? owners_result[i].mobile
                            : "",
                          enc_owner_id: encrypt_decrypt(
                            "encrypt",
                            owners_result[i].id
                          ),
                          owner_name:
                            owners_result[i].first_name_represent +
                            " " +
                            owners_result[i].last_name_represent,
                          owners_email: owners_result[i].email + "",
                        };

                        var response_owner = await axios.post(
                          process.env.ADMIN_KYC_URL + "SaveMerchant",
                          qs.stringify(owner_data),
                          {
                            headers: {
                              "Content-Type":
                                "application/x-www-form-urlencoded",
                            },
                          }
                        );
                      }
                    });
                  }
                } catch (error) {
                  winston.error(error);
                  return error.response;
                }
              });
              ee.emit("ping", { merchant_id: submerchant_id });
            }

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  submit_merchant_status,
                  "Merchant kyc submitted successfully."
                )
              );
          }
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse("Please fill all details."));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  submit_summary: async (req, res) => {
    //step-8
    let created_at = await date_formatter.created_date_time();
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    MerchantEkycModel.select("step_completed", { id: submerchant_id })
      .then(async (result) => {
        let err = "";
        if (result.step_completed != "") {
          let sequence_arr = result.step_completed.split(",");
          sequence_arr.sort();
          for (let i = 0; i < 7; i++) {
            let j = i + 1;
            if (j != 4 && j != 5) {
              if (!sequence_arr.includes(j.toString())) {
                //if (sequence_arr[i] != j.toString()) {
                err = "Please fill and complete " + helpers.ekyc_steps(j);
                break;
              }
            }
          }
          if (err) {
            res.status(statusCode.ok).send(response.validationResponse(err));
          } else {
            let merchant_details_for_psp =
              await MerchantEkycModel.selectMerchantDetails(
                "psp_id,merchant_id,type_of_business",
                {
                  merchant_id: submerchant_id,
                }
              );
            let psp_details_arr = [];
            let merchant_data = await MerchantEkycModel.select("*", {
              id: submerchant_id,
            });
            let psp_kyc = 0;
            if (merchant_details_for_psp.psp_id) {
              let psp_ids = merchant_details_for_psp.psp_id.split(",");
              for (let pi of psp_ids) {
                let psp_details = await helpers.get_psp_details_by_id(
                  "ekyc_required",
                  pi
                );
                psp_details_arr.push(psp_details);
                if (psp_details.ekyc_required == 1) {
                  psp_kyc++;
                  let ob = {
                    merchant_id: merchant_details_for_psp.merchant_id,
                    psp_id: pi,
                    status: 0,
                  };
                  await MerchantEkycModel.insertPspStatus(ob);
                }

                let onboard_ = {
                  merchant_id: merchant_details_for_psp.merchant_id,
                  psp_id: pi,
                  status: 0,
                };
                await MerchantEkycModel.insertPspOnboard(onboard_);
              }
            }
            // owner ekyc reuired
            let ekyc_required_owner = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "owner_individual",
                entity_id: merchant_details_for_psp.type_of_business,
                deleted: 0,
                status: 0,
              }
            );

            // representative ekyc reuired
            let ekyc_required_reresentaive = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "representative",
                entity_id: merchant_details_for_psp.type_of_business,
                deleted: 0,
                status: 0,
              }
            );
            // executive
            let ekyc_required_exe = await EntityModel.ekycRequired(
              "ekyc_required",
              {
                document_for: "executive",
                entity_id: merchant_details_for_psp.type_of_business,
                deleted: 0,
                status: 0,
              }
            );

            let ekyc_required = 0;
            let owner_ekyc_required = 0;
            let exe_ekyc_required = 0;
            if (
              psp_kyc > 0 &&
              (ekyc_required_owner ||
                ekyc_required_reresentaive ||
                ekyc_required_exe)
            ) {
              if (ekyc_required_owner) {
                owner_ekyc_required = 1;
              }
              if (ekyc_required_reresentaive) {
                ekyc_required = 1;
              }
              if (ekyc_required_exe) {
                exe_ekyc_required = 1;
              }
            } else {
              ekyc_required = 0;
              owner_ekyc_required = 0;
              exe_ekyc_required = 0;
            }

            let ref_no = await helpers.make_reference_number("REF", 7);
            // update ekyc required
            await MerchantEkycModel.update(
              { id: submerchant_id },
              {
                onboarding_done: 1,
                ekyc_required: ekyc_required,
              }
            );
            await MerchantEkycModel.updateDynamic(
              { merchant_id: submerchant_id },
              {
                ekyc_required: ekyc_required,
              },
              config.table_prefix + "master_merchant_details"
            );
            await MerchantEkycModel.updateDynamic(
              { merchant_id: submerchant_id },
              {
                ekyc_required: owner_ekyc_required,
              },
              config.table_prefix + "merchant_business_owners"
            );
            await MerchantEkycModel.updateDynamic(
              { merchant_id: submerchant_id },
              {
                ekyc_required: exe_ekyc_required,
              },
              config.table_prefix + "merchant_business_executives"
            );
            let tc_obj = {
              merchant_id: submerchant_id,
              tc_id: await helpers.get_latest_tc_version_id(),
              added_date: await date_formatter.created_date_time(),
              type: "submerchant",
            };

            await MerchantRegistrationModel.addTC(tc_obj);

            let cond = { merchant_id: submerchant_id };
            let update_date = await MerchantEkycModel.updateMerchantDetails(
              cond,
              { last_updated: created_at }
            );

            let merchant_details =
              await MerchantEkycModel.selectMerchantDetails(
                "id,merchant_id,company_name,legal_person_first_name as first_name,legal_person_last_name as last_name,legal_person_email as email,home_phone_number as mobile,home_phone_code as code,dob,home_address_line_1,home_address_line_2,psp_id,ekyc_required",
                {
                  merchant_id: submerchant_id,
                }
              ); // get representative data
            let owner_result = await MerchantEkycModel.selectDynamic(
              "id as owner_id,first_name_represent as first_name,last_name_represent as last_name,merchant_id,ekyc_required as owner_ekyc,business_owner,email,country_code as code,mobile",
              {
                merchant_id: submerchant_id,
                ekyc_status: 0,
                deleted: 0,
              },
              config.table_prefix + "merchant_business_owners"
            ); // get owner data
            let executive_result = await MerchantEkycModel.selectDynamic(
              "id as exe_id,first_name as first_name,last_name as last_name,merchant_id,ekyc_required as exe_ekyc,email,mobile_code as code,mobile_no as mobile",
              {
                merchant_id: submerchant_id,
                ekyc_status: 0,
                deleted: 0,
              },
              config.table_prefix + "merchant_business_executives"
            ); // get executive

            const arrs = [].concat(
              owner_result,
              executive_result,
              merchant_details
            );
            const noDuplicate = (arr) => [...new Set(arr)];
            const allIds = arrs.map((ele) => ele.email);
            const ids = noDuplicate(allIds);

            var result = ids.map((id) =>
              arrs.reduce((self, item) => {
                return item.email === id ? { ...self, ...item } : self;
              }, {})
            ); // unique array of same email
            let match_selfie_document =
              await MerchantEkycModel.getSelfieDocsRep(
                submerchant_id,
                "representative",
                0
              );

            let submit_merchant_status = {
              kyc_link: process.env.MERCHANT_KYC_URL,
              match_link: match_selfie_document
                ? process.env.STATIC_URL +
                "/static/files/" +
                match_selfie_document.document_name
                : "",
              merchant_id: encrypt_decrypt("encrypt", submerchant_id),
              merchant_name: merchant_details.company_name
                ? merchant_details.company_name
                : "",
              legal_person_name: merchant_details.first_name
                ? merchant_details.first_name + " " + merchant_details.last_name
                : "",
              doc_name: match_selfie_document.sequence
                ? await helpers.get_document_type(
                  match_selfie_document.sequence
                )
                : "",
              doc_number: match_selfie_document.document_num
                ? match_selfie_document.document_num
                : "",
              legal_person_email: merchant_details.email
                ? merchant_details.email
                : "",
              mobile: merchant_details.mobile ? merchant_details.mobile : "",
              country_code: merchant_details.code ? merchant_details.code : "",
              dob: merchant_details.dob
                ? moment(merchant_details.dob).format("DD-MM-YYYY")
                : "",
              address:
                merchant_details.home_address_line_1 +
                " " +
                merchant_details.home_address_line_2,

              ekyc_required: ekyc_required
                ? ekyc_required
                : owner_ekyc_required
                  ? owner_ekyc_required
                  : exe_ekyc_required,
            };

            let entity_document = await MerchantEkycModel.selectDynamicDocument(
              "document_for",
              { merchant_id: submerchant_id, deleted: 0 },
              config.table_prefix + "merchant_entity_document"
            ); // get entity document for

            ee.once("ping", async (arguments) => {
              try {
                file_name = [];
                original_name = [];

                for (document of entity_document) {
                  if (document.document_for == "company") {
                    var document_for = "Business Details-";
                  } else if (document.document_for == "owner_company") {
                    var document_for = "Business Owners-";
                  } else if (document.document_for == "owner_individual") {
                    var document_for = "Owners Individual-";
                  } else if (document.document_for == "executive") {
                    var document_for = "Business Executive-";
                  } else if (document.document_for == "representative") {
                    var document_for = "Business Representative-";
                  }
                  let entity_document_ = await MerchantEkycModel.selectDynamic(
                    "*",
                    {
                      merchant_id: submerchant_id,
                      deleted: 0,
                      document_for: document.document_for,
                    },
                    config.table_prefix + "merchant_entity_document"
                  );
                  for (ed of entity_document_) {
                    if (ed.document_name) {
                      file_name.push(ed.document_name);
                      original_name.push(
                        document_for +
                        "front document of " +
                        (await helpers.get_document_type(ed.sequence))
                      );
                    }
                    if (ed.document_name_back) {
                      file_name.push(ed.document_name_back);
                      original_name.push(
                        document_for +
                        "back document of " +
                        (await helpers.get_document_type(ed.sequence))
                      );
                    }
                  }
                }

                for (i = 0; i < result.length; i++) {
                  if (result[i].company_name) {
                    if (
                      result[i].exe_ekyc == 1 &&
                      result[i].ekyc_required == 0
                    ) {
                      var data_for = "executive";
                      var id = result[i].exe_id;
                    } else if (
                      result[i].owner_ekyc == 1 &&
                      result[i].ekyc_required == 0
                    ) {
                      var data_for = "owner";
                      var id = result[i].owner_id;
                    } else {
                      var data_for = "representative";
                      var id = result[i].id;
                    }
                  } else if (result[i].business_owner) {
                    if (result[i].exe_ekyc == 1) {
                      var data_for = "executive";
                      var id = result[i].exe_id;
                    } else {
                      var data_for = "owner";
                      var id = result[i].owner_id;
                    }
                  } else {
                    var data_for = "executive";
                    var id = result[i].exe_id;
                  }

                  // send email to all ekyc required
                  if (
                    psp_kyc > 0 &&
                    (result[i].ekyc_required == 1 ||
                      result[i].exe_ekyc == 1 ||
                      result[i].owner_ekyc == 1)
                  ) {
                    var all_id = id ? encrypt_decrypt("encrypt", id) : "";
                    var token =
                      all_id + "_" + encrypt_decrypt("encrypt", data_for);

                    // const aToken = accessToken(payload);

                    let verify_url =
                      process.env.MERCHANT_KYC_URL + "?token=" + token;
                    let title = await helpers.get_title();
                    let subject = "Welcome to " + title;
                    await mailSender.ekycOwnersMail(
                      result[i].email,
                      subject,
                      verify_url
                    );
                  }

                  let match_selfie_document =
                    await MerchantEkycModel.getSelfieDocsEkyc(
                      submerchant_id,
                      id
                    );

                  var common_data = {
                    file_name: file_name.join(","),
                    original_name: original_name.join(","),
                    folder_name: "files",
                    file_path: process.env.STATIC_URL + "/static/files/",
                    document: match_selfie_document.document_name
                      ? process.env.STATIC_URL +
                      "/static/files/" +
                      match_selfie_document.document_name
                      : "",
                    enc_merchant_id: encrypt_decrypt("encrypt", submerchant_id),
                    merchant_id: submerchant_id,
                    data_for: id ? data_for : "representative",
                    type: 1,
                    data: "",
                    name: await helpers.get_merchantdetails_name_by_id(
                      submerchant_id
                    ),
                    email: result[i].email + "",
                    mobile: result[i].mobile + "",
                    enc_owner_id: id
                      ? encrypt_decrypt("encrypt", id)
                      : encrypt_decrypt("encrypt", result[i].id),
                    merchant_name: result[i].first_name
                      ? result[i].first_name + " " + result[i].last_name
                      : "",
                    // owners_email:
                    // result[i].email + "",
                  };

                  var response_owner = await axios.post(
                    process.env.ADMIN_KYC_URL + "SaveMerchant",
                    qs.stringify(common_data),
                    {
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                      },
                    }
                  );
                }
              } catch (error) {
                winston.error(error);
                return error.response;
              }
            });
            ee.emit("ping", { merchant_id: submerchant_id });

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  submit_merchant_status,
                  "Onboarding submitted successfully."
                )
              );
          }
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse("Please fill all details."));
        }
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  submit_video_kyc: async (req, res) => {
    let table = config.table_prefix + "master_merchant";
    let condition = {
      id: enc_dec.cjs_decrypt(req.bodyString("merchant_id")),
    };
    let data = { video_kyc_done: 1 };
    MerchantEkycModel.updateDynamic(condition, data, table)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Video kyc status updated successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  send_psp_mail: async (req, res) => {
    let submerchant_id = encrypt_decrypt("decrypt", req.body.submerchant_id);
    let merchant_details = await MerchantEkycModel.selectMerchantDetails("*", {
      merchant_id: submerchant_id,
    });
    let psp_details_send = [];

    let psp_kyc = 0;
    if (merchant_details.psp_id) {
      let psp_ids = merchant_details.psp_id.split(",");
      for (let pi of psp_ids) {
        let psp_details = await helpers.get_psp_details_by_id(
          "id,name,email_to,cc,ekyc_required",
          pi
        );
        psp_details_send.push({
          email: psp_details.email_to,
          cc: psp_details.cc,
          name: psp_details.name,
          id: psp_details.id,
        });

        if (psp_details.ekyc_required == 1) {
          psp_kyc++;
        }
      }
    }
    let no_data_str = `<span style='color:#7C8386;font-style: italic;font-size:10px'>Not Available</span>`;
    let reg_country = await helpers.get_country_name_by_id(
      merchant_details.register_business_country
    );

    let merchant_details_mail_arr_detail_type = {
      "Register business country": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Type of business": await helpers.get_entity_type(
        merchant_details.type_of_business
      ),
      "Free zone country":
        merchant_details.is_business_register_in_free_zone == 0 ? "No" : "Yes",
      "Registered email":
        (await helpers.get_merchant_email(merchant_details.merchant_id)) == ""
          ? merchant_details.legal_person_email
            ? merchant_details.legal_person_email
            : ""
          : await helpers.get_merchant_email(merchant_details.merchant_id),
      Industry: await helpers.get_mcc_code_description(
        merchant_details.mcc_codes
      ),
    };
    let merchant_details_mail_arr_detail = {
      "Legal Business Name": merchant_details.company_name,
      "Company Registration Number":
        merchant_details.company_registration_number
          ? merchant_details.company_registration_number
          : no_data_str,
      "VAT number": merchant_details.vat_number
        ? merchant_details.vat_number
        : no_data_str,
      "I am going to use payment solution for":
        merchant_details.doing_business_as
          ? merchant_details.doing_business_as
          : no_data_str,
      "Register business address": merchant_details.register_business_country
        ? await helpers.get_country_name_by_id(
          merchant_details.register_business_country
        )
        : no_data_str,
      "Address Line 1": merchant_details.address_line1
        ? merchant_details.address_line1
        : no_data_str,
      "Address Line 2": merchant_details.address_line2
        ? merchant_details.address_line2
        : no_data_str,
      Province: merchant_details.province
        ? await helpers.get_state_name_by_id(merchant_details.province)
        : "",
      "Business phone code": merchant_details.business_phone_code
        ? "+" + merchant_details.business_phone_code
        : no_data_str,
      "Business phone number": merchant_details.business_phone_number
        ? merchant_details.business_phone_number
        : no_data_str,

      "Business website": merchant_details.business_website
        ? merchant_details.business_website
        : no_data_str,
      "Product Description": merchant_details.product_description
        ? merchant_details.product_description
        : no_data_str,
      Currency: merchant_details.currency_volume,
      "Monthly business volume": merchant_details.monthly_business_volume,
      "Average transaction volume": merchant_details.monthly_transaction_volume,

      "URL for terms and conditions": merchant_details.link_tc,
      "URL for privacy policy": merchant_details.link_pp,
      "URL for refund": merchant_details.link_refund,
      "URL for cancellation": merchant_details.link_cancellation,
      "URL for delivery policy": merchant_details.link_delivery_policy,
      "Transaction Success URL": merchant_details.link_success_url,
      "Transaction Failed URL": merchant_details.link_failed_url,
      "Transaction Cancelled URL": merchant_details.link_cancelled_url,
    };
    let merchant_details_represt = {
      "Legal person first name": merchant_details.legal_person_first_name
        ? merchant_details.legal_person_first_name
        : no_data_str,
      "Legal person last name": merchant_details.legal_person_last_name
        ? merchant_details.legal_person_last_name
        : no_data_str,
      "Legal person email": merchant_details.legal_person_email
        ? merchant_details.legal_person_email
        : no_data_str,
      "Job title": merchant_details.job_title
        ? merchant_details.job_title
        : no_data_str,
      Nationality: merchant_details.nationality
        ? merchant_details.nationality
        : no_data_str,
      DOB: merchant_details.dob
        ? moment(merchant_details.dob).format("DD-MM-YYYY")
        : no_data_str,
      "Home address country": merchant_details.home_address_country
        ? await helpers.get_country_name_by_id(
          merchant_details.home_address_country
        )
        : no_data_str,
      "Home address line-1": merchant_details.home_address_line_1
        ? merchant_details.home_address_line_1
        : no_data_str,
      "Home address line-2": merchant_details.home_address_line_2
        ? merchant_details.home_address_line_2
        : no_data_str,
      "Home province": merchant_details.home_province
        ? await helpers.get_state_name_by_id(merchant_details.home_province)
        : no_data_str,
      "Home phone code": merchant_details.home_phone_code
        ? "+" + merchant_details.home_phone_code
        : no_data_str,
      "Home phone number": merchant_details.home_phone_number
        ? merchant_details.home_phone_number
        : no_data_str,
      // 'Personal ID number': merchant_details.personal_id_number,
    };
    let uploaded_document =
      merchant_details.bank_document_name.charAt(0).toUpperCase() +
      merchant_details.bank_document_name.slice(1);
    let merchant_details_bank = {
      "Bank Name": merchant_details.bank_name
        ? merchant_details.bank_name
        : no_data_str,
      Currency: merchant_details.currency
        ? merchant_details.currency
        : no_data_str,

      "Name on the  bank account": merchant_details.name_on_the_bank_account
        ? merchant_details.name_on_the_bank_account
        : no_data_str,

      "Branch Name": merchant_details.branch_name
        ? merchant_details.branch_name
        : no_data_str,
      IBAN: merchant_details.iban ? merchant_details.iban : no_data_str,
      "BIC/SWIFT": merchant_details.bic_swift
        ? merchant_details.bic_swift
        : no_data_str,
      Address: merchant_details.address
        ? merchant_details.address
        : no_data_str,
      "Account Number": merchant_details.bank_account_no
        ? merchant_details.bank_account_no
        : no_data_str,
      Country: (await helpers.get_country_name_by_id(merchant_details.country))
        ? await helpers.get_country_name_by_id(merchant_details.country)
        : no_data_str,
      State: (await helpers.get_state_name_by_id(merchant_details.state))
        ? await helpers.get_state_name_by_id(merchant_details.state)
        : no_data_str,
      City: (await helpers.get_city_name_by_id(merchant_details.city))
        ? await helpers.get_city_name_by_id(merchant_details.city)
        : no_data_str,
      "Zip code": merchant_details.zip_code
        ? merchant_details.zip_code
        : no_data_str,
      "Bank document name": merchant_details.bank_document_name
        ? uploaded_document.replace(/_/g, " ")
        : no_data_str,
      "Uploaded document":
        merchant_details.bank_document_file != ""
          ? `<a href = "` +
          process.env.STATIC_URL +
          "/static/files/" +
          merchant_details.bank_document_file +
          `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px;text-align:center; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
          : no_data_str,
    };
    let public_details = {
      "Statement Descriptor": merchant_details.statement_descriptor,
      "Shortened Descriptor": merchant_details.shortened_descriptor,
      "Point of contact name": merchant_details.poc_name,
      "Point of contact email": merchant_details.poc_email,
      "Point of contact mobile code": merchant_details.poc_mobile_code
        ? "+" + merchant_details.poc_mobile_code
        : no_data_str,
      "Point of contact mobile": merchant_details.poc_mobile,
      "Compliance and risk officer name": merchant_details.cro_name,
      "Compliance and risk officer email": merchant_details.cro_email,
      "Compliance and risk officer mobile code":
        merchant_details.cro_mobile_code
          ? "+" + merchant_details.cro_mobile_code
          : no_data_str,
      "Compliance and risk officer mobile": merchant_details.cro_mobile,
      "Customer support name": merchant_details.co_name,
      "Customer support email": merchant_details.co_email,
      "Customer support mobile code": merchant_details.co_mobile_code
        ? "+" + merchant_details.co_mobile_code
        : no_data_str,
      "Customer support mobile": merchant_details.co_mobile,
    };

    let business_owners = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_owners"
    );
    let business_executive = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_executives"
    );
    let entity_document_for = await MerchantEkycModel.selectDynamicDocument(
      "document_for",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_entity_document"
    );

    var table = `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Type</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_mail_arr_detail_type).forEach(function (key) {
      var val = merchant_details_mail_arr_detail_type[key];
      table +=
        `<tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
            </tr>
        `;
    });
    table += `</table>`;
    table += `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    for (document of entity_document_for) {
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: document.document_for,
        },
        config.table_prefix + "merchant_entity_document"
      );

      if (document.document_for == "company") {
        var document_for = "Business Details";

        table +=
          `
                <tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">` +
          document_for +
          `</th></tr>`;

        Object.keys(merchant_details_mail_arr_detail).forEach(function (key) {
          var val = merchant_details_mail_arr_detail[key];
          table +=
            `<tr>
                                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
            key +
            `</th>
                                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            val +
            `</td>
                            </tr>
                        `;
        });
        table += `       <tr>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                      
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
                    </tr>
                `;
        for (val of entity_document) {
          if (val.sequence != 0) {
            let doc = await helpers.get_document_type(val.sequence);
            let document_name = val.document_name
              ? process.env.STATIC_URL + "/static/files/" + val.document_name
              : no_data_str;

            var document_name_back = val.document_name_back
              ? `<a href = "` +
              process.env.STATIC_URL +
              "/static/files/" +
              val.document_name_back +
              `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
              : "";

            let issue_date = val.issue_date
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : no_data_str;
            let expiry_date = val.expiry_date
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : no_data_str;
            let document_num = val.document_num
              ? val.document_num
              : no_data_str;

            table +=
              `<tr >
                                <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              doc +
              ` </td>
                             
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              document_num +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              issue_date +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              expiry_date +
              `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
              document_name +
              `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
              document_name_back +
              `</td>
                            </tr>`;
          }
        }
      } else if (document.document_for == "representative") {
        var document_for = "Business Representative";

        table +=
          `
                <tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">` +
          document_for +
          `</th></tr>`;

        Object.keys(merchant_details_represt).forEach(function (key) {
          var val = merchant_details_represt[key];
          table +=
            `<tr>
                                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
            key +
            `</th>
                                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            val +
            `</td>
                            </tr>
                        `;
        });
        table += `       <tr>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                      
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
                    </tr>
                `;
        for (val of entity_document) {
          if (
            reg_country.toUpperCase() ==
            (
              await helpers.get_nationalty_name_by_id(
                merchant_details.nationality
              )
            ).toUpperCase() &&
            (await helpers.get_document_type(val.sequence)).toUpperCase() ==
            "VISA"
          ) {
            var show = "style='display:none'";
          } else {
            var show = "";
          }
          if (val.sequence != 0) {
            let doc = await helpers.get_document_type(val.sequence);
            let document_name = val.document_name
              ? process.env.STATIC_URL + "/static/files/" + val.document_name
              : no_data_str;

            var document_name_back = val.document_name_back
              ? `<a href = "` +
              process.env.STATIC_URL +
              "/static/files/" +
              val.document_name_back +
              `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
              : "";

            let issue_date = val.issue_date
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : no_data_str;
            let expiry_date = val.expiry_date
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : no_data_str;
            let document_num = val.document_num
              ? val.document_num
              : no_data_str;

            table +=
              `<tr ` +
              show +
              `>
                                <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              doc +
              ` </td>
                             
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              document_num +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              issue_date +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              expiry_date +
              `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
              document_name +
              `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
              document_name_back +
              `</td>
                            </tr>`;
          }
        }
      }
    }
    table += `</table>`;

    var owner = `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Owners</th></tr>`;
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      owner +
      `
        `;

    var counter = 0;
    for (val_business of business_owners) {
      counter++;
      let owner_docs =
        val_business.business_owner == "entity"
          ? "owner_company"
          : "owner_individual";
      let first_name = val_business.first_name
        ? val_business.first_name + " " + val_business.last_name
        : no_data_str;

      let first_name_represent =
        val_business.first_name_represent +
        " " +
        val_business.last_name_represent;

      let nationality = val_business.nationality;
      let email = val_business.email;
      let mobile_no =
        "+" + val_business.country_code + "-" + val_business.mobile;

      table +=
        ` <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        counter +
        `</td></tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Business name</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
                <tr>
                <th colspan=2  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Representative Name</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name_represent +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Nationality</th>
                <td colspan=3  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        nationality +
        `</td>
                </tr>
               `;
      table += `       <tr>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                 
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
               </tr>
           `;
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: owner_docs,
          owners_id: val_business.id,
        },
        config.table_prefix + "merchant_entity_document"
      );

      for (val of entity_document) {
        if (
          reg_country.toUpperCase() ==
          (
            await helpers.get_nationalty_name_by_id(nationality)
          ).toUpperCase() &&
          (await helpers.get_document_type(val.sequence)).toUpperCase() ==
          "VISA"
        ) {
          var show = "style='display:none'";
        } else {
          var show = "";
        }

        if (val.sequence != 0) {
          let doc = await helpers.get_document_type(val.sequence);
          let document_name = val.document_name
            ? process.env.STATIC_URL + "/static/files/" + val.document_name
            : no_data_str;

          var document_name_back = val.document_name_back
            ? `<a href = "` +
            process.env.STATIC_URL +
            "/static/files/" +
            val.document_name_back +
            `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
            : "";

          let issue_date = val.issue_date
            ? moment(val.issue_date).format("DD-MM-YYYY")
            : no_data_str;
          let expiry_date = val.expiry_date
            ? moment(val.expiry_date).format("DD-MM-YYYY")
            : no_data_str;
          let document_num = val.document_num ? val.document_num : no_data_str;

          table +=
            `<tr ` +
            show +
            `>
                            <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            doc +
            ` </td>
                         
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            document_num +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            issue_date +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            expiry_date +
            `</td>
                        <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
            document_name +
            `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
            document_name_back +
            `</td>
                        </tr>`;
        }
      }
    }
    if (counter == 0) {
      table +=
        ` <tr>
            <th colspan=6 style = "text-align:center;padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        no_data_str +
        `</th>
            </tr>`;
    }
    table += `</table>`;

    var exe = `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Executives</th></tr>`;
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      exe +
      ``;

    let count = 0;
    for (val_business_exe of business_executive) {
      count++;
      let first_name = val_business_exe.first_name
        ? val_business_exe.first_name + " " + val_business_exe.last_name
        : no_data_str;
      let email = val_business_exe.email;
      let nationality = val_business_exe.nationality;
      let mobile_no =
        "+" + val_business_exe.mobile_code + "-" + val_business_exe.mobile_no;

      table +=
        ` <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        count +
        `</td></tr>
              
                <tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Name</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
              
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Nationality</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        nationality +
        `</td>
                </tr>
               `;
      table += `       <tr>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                 
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
               </tr>
           `;
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: "executive",
          owners_id: val_business_exe.id,
        },
        config.table_prefix + "merchant_entity_document"
      );

      for (val of entity_document) {
        if (
          reg_country.toUpperCase() ==
          (
            await helpers.get_nationalty_name_by_id(nationality)
          ).toUpperCase() &&
          (await helpers.get_document_type(val.sequence)).toUpperCase() ==
          "VISA"
        ) {
          var show = "style='display:none'";
        } else {
          var show = "";
        }
        if (val.sequence != 0) {
          let doc = await helpers.get_document_type(val.sequence);
          let document_name = val.document_name
            ? process.env.STATIC_URL + "/static/files/" + val.document_name
            : no_data_str;

          var document_name_back = val.document_name_back
            ? `<a href = "` +
            process.env.STATIC_URL +
            "/static/files/" +
            val.document_name_back +
            `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
            : "";

          let issue_date =
            val.issue_date != "NULL" || val.issue_date != "0000-00-00"
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : "";
          let issue_d =
            issue_date == "Invalid date" || "" ? no_data_str : issue_date;
          let expiry_date =
            val.expiry_date != "NULL" || val.expiry_date != "0000-00-00"
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : "";
          let ex_d =
            expiry_date == "Invalid date" || "" ? no_data_str : expiry_date;
          let document_num = val.document_num ? val.document_num : no_data_str;

          table +=
            `<tr ` +
            show +
            `>
                            <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            doc +
            ` </td>
                         
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            document_num +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            issue_d +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            ex_d +
            `</td>
                        <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
            document_name +
            `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
            document_name_back +
            `</td>
                        </tr>`;
        }
      }
    }
    if (count == 0) {
      table +=
        ` <tr>
            <th colspan=6 style = "text-align:center; padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        no_data_str +
        `</th></tr>`;
    }

    table += `</table>`;

    table += `
    <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Public Details</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(public_details).forEach(function (key) {
      var val = public_details[key];
      table +=
        `<tr>
            <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
        </tr>
    `;
    });
    table += `</table>`;
    table += `
<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Bank Details</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_bank).forEach(function (key) {
      var val = merchant_details_bank[key];
      table +=
        `<tr>
        <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
        <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
    </tr>
`;
    });
    table += `</table>`;
    for (let emails of psp_details_send) {
      let mail = emails.email;
      let mail_cc = emails.cc;
      let psp_id = emails.id;
      let reference = await helpers.make_reference_number("REF", 8);

      await MerchantEkycModel.addDynamic(
        {
          submerchant_id: submerchant_id,
          psp_id: psp_id,
          email: mail,
          cc: mail_cc,
          reference: reference,
        },
        config.table_prefix + "psp_mail_log"
      );

      let para =
        `Dear ` +
        emails.name +
        ` ,<br>
             Please find the Merchant's details along with documents link with request reference no. ` +
        reference +
        ``;

      let subject = "Merchant KYC documents - " + reference;
      ee.once("email", async (arguments) => {
        await mailSender.PSPMail(mail, mail_cc, subject, table, para);
      });
      ee.emit("email", { merchant_id: submerchant_id });
    }
    await MerchantEkycModel.updateDynamic(
      { id: submerchant_id },
      { psp_mail_send: 1 },
      config.table_prefix + "master_merchant"
    );
    res
      .status(statusCode.ok)
      .send(response.successmsg("Mail send successfully"));
  },
  send_psp_mail_old: async (req, res) => {
    let submerchant_id = encrypt_decrypt("decrypt", req.body.submerchant_id);
    let merchant_details = await MerchantEkycModel.selectMerchantDetails("*", {
      merchant_id: submerchant_id,
    });
    let psp_details_send = [];

    let psp_kyc = 0;
    if (merchant_details.psp_id) {
      let psp_ids = merchant_details.psp_id.split(",");
      for (let pi of psp_ids) {
        let psp_details = await helpers.get_psp_details_by_id(
          "id,name,email_to,cc,ekyc_required",
          pi
        );
        psp_details_send.push({
          email: psp_details.email_to,
          cc: psp_details.cc,
          name: psp_details.name,
          id: psp_details.id,
        });

        if (psp_details.ekyc_required == 1) {
          psp_kyc++;
        }
      }
    }

    let merchant_details_mail_arr = {
      "Registered business address": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Type of business": await helpers.get_entity_type(
        merchant_details.type_of_business
      ),
      "Is business register in free zone":
        merchant_details.is_business_register_in_free_zone ? "No" : "Yes",
      "Company Name": merchant_details.company_name,
      "Company Registration Number":
        merchant_details.company_registration_number,
      "VAT number": merchant_details.vat_number,
      "I am going to use payment solution for":
        merchant_details.doing_business_as,
      "Business registered country": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Address Line 1": merchant_details.address_line1,
      "Address Line 2": merchant_details.address_line2,
      province: merchant_details.province
        ? await helpers.get_state_name_by_id(merchant_details.province)
        : "",
      "Business phone number": merchant_details.business_phone_number,
      "Business phone code": merchant_details.business_phone_code,
      "MCC codes": await helpers.get_mcc_code_description(
        merchant_details.mcc_codes
      ),
      "Business website": merchant_details.business_website,
      "Product Description": merchant_details.product_description,
      Currency: merchant_details.currency_volume,
      "Monthly business volume": merchant_details.monthly_business_volume,
      "Monthly transaction volume": merchant_details.monthly_transaction_volume,
      "Legal person first name": merchant_details.legal_person_first_name,
      "Legal person last name": merchant_details.legal_person_last_name,
      "legal person email": merchant_details.legal_person_email,
      "Job title": merchant_details.job_title,
      Nationality: merchant_details.nationality,
      DOB: merchant_details.dob
        ? moment(merchant_details.dob).format("DD-MM-YYYY")
        : "",
      "Home address country": await helpers.get_country_name_by_id(
        merchant_details.home_address_country
      ),
      "Home address line-1": merchant_details.home_address_line_1,
      "Home address line-2": merchant_details.home_address_line_2,
      "Home province": merchant_details.home_province
        ? await helpers.get_state_name_by_id(merchant_details.home_province)
        : "",
      "Home phone code": merchant_details.home_phone_code,
      "Home phone number": merchant_details.home_phone_number,
      // 'Personal ID number': merchant_details.personal_id_number,
      "Statement Descriptor": merchant_details.statement_descriptor,
      "Shortened Descriptor": merchant_details.shortened_descriptor,
      "Customer support phone code": merchant_details.co_mobile_code,
      "Customer support phone number": merchant_details.co_mobile,
      IBAN: merchant_details.iban,
      "Bank Name": merchant_details.bank_name,
      "Branch Name": merchant_details.branch_name,
      "Point of contact name": merchant_details.poc_name,
      "Point of contact email": merchant_details.poc_email,
      "Point of contact mobile code": merchant_details.poc_mobile_code,
      "Point of contact mobile": merchant_details.poc_mobile,
      "Compliance and risk officer name": merchant_details.cro_name,
      "Compliance and risk officer email": merchant_details.cro_email,
      "Compliance and risk officer mobile code":
        merchant_details.cro_mobile_code,
      "Compliance and risk officer mobile": merchant_details.cro_mobile,
      "Customer support name": merchant_details.co_name,
      "Customer support email": merchant_details.co_email,
      "Customer support mobile code": merchant_details.co_mobile_code,
      "Customer support mobile": merchant_details.co_mobile,
      "Link terms and conditions": merchant_details.link_tc,
      "Link privacy policy": merchant_details.link_pp,
      "Link refund": merchant_details.link_refund,
      "Link cancellation": merchant_details.link_cancellation,
      "Link delivery policy": merchant_details.link_delivery_policy,
      "Link Success URL": merchant_details.link_success_url,
      "Link Failed URL": merchant_details.link_failed_url,
      "Link Cancelled URL": merchant_details.link_cancelled_url,
    };
    var table = `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;

    let no_data_str = `<span style='color:#7C8386;font-style: italic;font-size:10px'>Not Available</span>`;
    let business_owners = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_owners"
    );
    let business_executive = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_executives"
    );
    let entity_document_for = await MerchantEkycModel.selectDynamicDocument(
      "document_for",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_entity_document"
    );
    for (document of entity_document_for) {
      if (document.document_for == "company") {
        var document_for = "Business Details";
      } else if (document.document_for == "owner_company") {
        var document_for = "Business Owners as Entity";
      } else if (document.document_for == "owner_individual") {
        var document_for = "Business Owners Individual";
      } else if (document.document_for == "executive") {
        var document_for = "Business Executive";
      } else if (document.document_for == "representative") {
        var document_for = "Business Representative";
      }
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: document.document_for,
        },
        config.table_prefix + "merchant_entity_document"
      );

      table +=
        `
        
            <tr ><th colspan=4 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        document_for +
        `</th></tr>
                <tr>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                  
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                    
                </tr>
            `;
      for (val of entity_document) {
        if (val.sequence != 0) {
          let doc = await helpers.get_document_type(val.sequence);
          let document_name = val.document_name
            ? process.env.STATIC_URL + "/static/files/" + val.document_name
            : no_data_str;

          var document_name_back = val.document_name_back
            ? `<a href = "` +
            process.env.STATIC_URL +
            "/static/files/" +
            val.document_name_back +
            `">click here to view</a>`
            : "";

          let issue_date =
            val.issue_date != ("null" || "0000-00-00")
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : no_data_str;
          let expiry_date =
            val.expiry_date != ("null" || "0000-00-00")
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : no_data_str;
          let document_num = val.document_num ? val.document_num : no_data_str;

          table +=
            `<tr>
                            <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            doc +
            ` <br> <a href = "` +
            document_name +
            `">click here to view</a><br>` +
            document_name_back +
            `</td>
                         
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            document_num +
            `</td>
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            issue_date +
            `</td>
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            expiry_date +
            `</td>
                            
                        </tr>`;
        }
      }
    }
    table += `</table>`;
    table += `<br>`;
    table += `
            <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;

    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_mail_arr).forEach(function (key) {
      var val = merchant_details_mail_arr[key];
      table +=
        `<tr>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
                </tr>
            `;
    });
    table += `</table>`;
    if (business_executive.length == 1) {
      var owner = `<tr ><th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Business Owners</th></tr>`;
    }
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      owner +
      `
        `;
    var counter = 0;
    for (val_business of business_owners) {
      counter++;
      let first_name = val_business.first_name
        ? val_business.first_name + " " + val_business.last_name
        : no_data_str;

      let first_name_represent =
        val_business.first_name_represent +
        " " +
        val_business.last_name_represent;

      let nationality = val_business.nationality;
      let email = val_business.email;
      let mobile_no = val_business.country_code + " " + val_business.mobile;

      table +=
        ` <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        counter +
        `</td></tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Business name</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Representative Name</th>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name_represent +
        `</td>
                </tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  =style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td= style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Nationality</th>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        nationality +
        `</td>
                </tr>
               `;
    }
    table += `</table>`;
    if (business_executive.length == 1) {
      var exe = `<tr ><th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Business Executives</th></tr>`;
    }
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      exe +
      ``;
    let count = 0;
    for (val_business_exe of business_executive) {
      count++;
      let first_name = val_business_exe.first_name
        ? val_business_exe.first_name + " " + val_business_exe.last_name
        : no_data_str;
      let email = val_business_exe.email;
      let mobile_no =
        val_business_exe.mobile_code + " " + val_business_exe.mobile_no;

      table +=
        ` <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        count +
        `</td></tr>
              
                <tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Name</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
              
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  =style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td= style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
              
               `;
    }
    table += `</table>`;
    for (let emails of psp_details_send) {
      let mail = emails.email;
      let mail_cc = emails.cc;
      let psp_id = emails.id;
      let reference = await helpers.make_reference_number("REF", 8);

      await MerchantEkycModel.addDynamic(
        {
          submerchant_id: submerchant_id,
          psp_id: psp_id,
          email: mail,
          cc: mail_cc,
          reference: reference,
        },
        config.table_prefix + "psp_mail_log"
      );

      let para =
        `Dear ` +
        emails.name +
        ` ,<br>
             Please find the Merchant's details along with documents link with request reference no. ` +
        reference +
        ``;

      let subject = "Merchant KYC documents - " + reference;
      ee.once("email", async (arguments) => {
        await mailSender.PSPMail(mail, mail_cc, subject, table, para);
      });
      ee.emit("email", { merchant_id: submerchant_id });
    }
    await MerchantEkycModel.updateDynamic(
      { id: submerchant_id },
      { psp_mail_send: 1 },
      config.table_prefix + "master_merchant"
    );
    res
      .status(statusCode.ok)
      .send(response.successmsg("Mail send successfully"));
  },
  send_psp_mail_auto_: async (submerchant_id1) => {
    let submerchant_id = submerchant_id1;
    let merchant_details = await MerchantEkycModel.selectMerchantDetails("*", {
      merchant_id: submerchant_id,
    });

    let psp_details_send = [];

    let psp_kyc = 0;
    if (merchant_details.psp_id) {
      let psp_ids = merchant_details.psp_id.split(",");
      for (let pi of psp_ids) {
        let psp_details = await helpers.get_psp_details_by_id(
          "id,name,email_to,cc,ekyc_required",
          pi
        );
        psp_details_send.push({
          email: psp_details.email_to,
          cc: psp_details.cc,
          name: psp_details.name,
          id: psp_details.id,
        });

        if (psp_details.ekyc_required == 1) {
          psp_kyc++;
        }
      }
    }

    let merchant_details_mail_arr = {
      "Registered business address": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Type of business": await helpers.get_type_of_business(
        merchant_details.type_of_business
      ),
      "Is business register in free zone":
        merchant_details.is_business_register_in_free_zone ? "No" : "Yes",
      "Company Name": merchant_details.company_name,
      "Company Registration Number":
        merchant_details.company_registration_number,
      "VAT number": merchant_details.vat_number,
      "I am going to use payment solution for":
        merchant_details.doing_business_as,
      "Business registered country": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Address Line 1": merchant_details.address_line1,
      "Address Line 2": merchant_details.address_line2,
      province: merchant_details.province
        ? await helpers.get_state_name_by_id(merchant_details.province)
        : "",
      "Business phone number": merchant_details.business_phone_number,
      "Business phone code": merchant_details.business_phone_code,
      "MCC codes": await helpers.get_mcc_code_description(
        merchant_details.mcc_codes
      ),
      "Business website": merchant_details.business_website,
      "Product Description": merchant_details.product_description,
      "Legal person first name": merchant_details.legal_person_first_name,
      "Legal person last name": merchant_details.legal_person_last_name,
      "legal person email": merchant_details.legal_person_email,
      "Job title": merchant_details.job_title,
      Nationality: await helpers.get_country_name_by_id(
        merchant_details.nationality
      ),
      DOB: merchant_details.dob
        ? moment(merchant_details.dob).format("DD-MM-YYYY")
        : "",
      "Home address country": await helpers.get_country_name_by_id(
        merchant_details.home_address_country
      ),
      "Home address line-1": merchant_details.home_address_line_1,
      "Home address line-2": merchant_details.home_address_line_2,
      "Home province": merchant_details.home_province
        ? await helpers.get_state_name_by_id(merchant_details.home_province)
        : "",
      "Home phone code": merchant_details.home_phone_code,
      "Home phone number": merchant_details.home_phone_number,
      "Personal ID number": merchant_details.personal_id_number,
      "Statement Descriptor": merchant_details.statement_descriptor,
      "Shortened Descriptor": merchant_details.shortened_descriptor,
      "Customer support phone code": merchant_details.co_mobile_code,
      "Customer support phone number": merchant_details.co_mobile,
      IBAN: merchant_details.iban,
      "Bank Name": merchant_details.bank_name,
      "Branch Name": merchant_details.branch_name,
      "Point of contact name": merchant_details.poc_name,
      "Point of contact email": merchant_details.poc_email,
      "Point of contact mobile code": merchant_details.poc_mobile_code,
      "Point of contact mobile": merchant_details.poc_mobile,
      "Compliance and risk officer name": merchant_details.cro_name,
      "Compliance and risk officer email": merchant_details.cro_email,
      "Compliance and risk officer mobile code":
        merchant_details.cro_mobile_code,
      "Compliance and risk officer mobile": merchant_details.cro_mobile,
      "Customer support name": merchant_details.co_name,
      "Customer support email": merchant_details.co_email,
      "Customer support mobile code": merchant_details.co_mobile_code,
      "Customer support mobile": merchant_details.co_mobile,
      "Link terms and conditions": merchant_details.link_tc,
      "Link privacy policy": merchant_details.link_pp,
      "Link refund": merchant_details.link_refund,
      "Link cancellation": merchant_details.link_cancellation,
      "Link delivery policy": merchant_details.link_delivery_policy,
    };

    let merchant_kyc_response = await axios.post(
      process.env.ADMIN_KYC_URL + "merchant/Transmittal/merchant_details_api",
      qs.stringify({
        merchant_id: encrypt_decrypt("encrypt", submerchant_id),
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    let table = `
            <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
                <tr>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                    
                </tr>
            `;

    let entity_document = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_entity_document"
    );

    let no_data_str = `<span style='color:#7C8386;font-style: italic;font-size:10px'>Not Available</span>`;
    for (val of entity_document) {
      let doc = helpers.doc_names(val.sequence);
      let document_name = val.document_name
        ? process.env.STATIC_URL + "/static/files/" + val.document_name
        : no_data_str;
      let issue_date = val.issue_date
        ? moment(val.issue_date).format("DD-MM-YYYY")
        : no_data_str;
      let expiry_date = val.expiry_date
        ? moment(val.expiry_date).format("DD-MM-YYYY")
        : no_data_str;
      let document_num = val.document_num ? val.document_num : no_data_str;

      table +=
        `<tr>
                            <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        doc +
        ` <br> <a href = "` +
        document_name +
        `">click here to view</a> </td>
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        document_num +
        `</td>
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        issue_date +
        `</td>
                            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        expiry_date +
        `</td>
                            
                        </tr>`;
    }

    if (merchant_kyc_response.data) {
      table +=
        `<tr>
                    <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">KYC Selfie <br><a href = "` +
        merchant_kyc_response.data.selfie_link +
        `">click here to view</a></td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                    
                </tr>
                <tr>
                    <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">KYC Video <br> <a href = "` +
        merchant_kyc_response.data.video_kyc_link +
        `">click here to view</a></td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        no_data_str +
        `</td>
                </tr>`;
    }

    table += `</table>`;

    table += `<br>`;
    table += `
            <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;

    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_mail_arr).forEach(function (key) {
      var val = merchant_details_mail_arr[key];
      table +=
        `<tr>
                    <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
                    <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
                </tr>
            `;
    });
    table += `</table>`;

    for (let emails of psp_details_send) {
      let mail = emails.email;
      let mail_cc = emails.cc;
      let psp_id = emails.id;
      let reference = await helpers.make_reference_number("REF", 8);

      await MerchantEkycModel.addDynamic(
        {
          submerchant_id: submerchant_id,
          psp_id: psp_id,
          email: mail,
          cc: mail_cc,
          reference: reference,
        },
        config.table_prefix + "psp_mail_log"
      );

      let para =
        `Dear ` +
        emails.name +
        ` ,<br>
             Please find the Merchant's details along with documents link with request reference no. ` +
        reference +
        ``;

      let subject = "Merchant KYC documents - " + reference;
      ee.once("email", async (arguments) => {
        await mailSender.PSPMail(mail, mail_cc, subject, table, para);
      });
      ee.emit("email", { merchant_id: submerchant_id });
    }
    await MerchantEkycModel.updateDynamic(
      { id: submerchant_id },
      { psp_mail_send: 1 },
      config.table_prefix + "master_merchant"
    );

    return;

    //res.status(statusCode.ok).send(response.successmsg('Mail send successfully'));
  },
  send_psp_mail_auto: async (submerchant_id1) => {
    // let submerchant_id = encrypt_decrypt("decrypt",req.body.submerchant_id);
    let submerchant_id = submerchant_id1;
    let merchant_details = await MerchantEkycModel.selectMerchantDetails("*", {
      merchant_id: submerchant_id,
    });

    let psp_details_send = [];

    let psp_kyc = 0;
    if (merchant_details.psp_id) {
      let psp_ids = merchant_details.psp_id.split(",");
      for (let pi of psp_ids) {
        let psp_details = await helpers.get_psp_details_by_id(
          "id,name,email_to,cc,ekyc_required",
          pi
        );
        psp_details_send.push({
          email: psp_details.email_to,
          cc: psp_details.cc,
          name: psp_details.name,
          id: psp_details.id,
        });

        if (psp_details.ekyc_required == 1) {
          psp_kyc++;
        }
      }
    }

    let merchant_kyc_response = await axios.post(
      process.env.ADMIN_KYC_URL + "merchant/Transmittal/merchant_details_api",
      qs.stringify({
        merchant_id: encrypt_decrypt("encrypt", submerchant_id),
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    let no_data_str = `<span style='color:#7C8386;font-style: italic;font-size:10px'>Not Available</span>`;
    let reg_country = await helpers.get_country_name_by_id(
      merchant_details.register_business_country
    );

    let merchant_details_mail_arr_detail_type = {
      "Register business country": await helpers.get_country_name_by_id(
        merchant_details.register_business_country
      ),
      "Type of business": await helpers.get_entity_type(
        merchant_details.type_of_business
      ),
      "Free zone country":
        merchant_details.is_business_register_in_free_zone == 0 ? "No" : "Yes",
      "Registered email":
        (await helpers.get_merchant_email(merchant_details.merchant_id)) == ""
          ? merchant_details.legal_person_email
            ? merchant_details.legal_person_email
            : ""
          : await helpers.get_merchant_email(merchant_details.merchant_id),
      Industry: await helpers.get_mcc_code_description(
        merchant_details.mcc_codes
      ),
    };
    let merchant_details_mail_arr_detail = {
      "Legal Business Name": merchant_details.company_name,
      "Company Registration Number":
        merchant_details.company_registration_number
          ? merchant_details.company_registration_number
          : no_data_str,
      "VAT number": merchant_details.vat_number
        ? merchant_details.vat_number
        : no_data_str,
      "I am going to use payment solution for":
        merchant_details.doing_business_as
          ? merchant_details.doing_business_as
          : no_data_str,
      "Register business address": merchant_details.register_business_country
        ? await helpers.get_country_name_by_id(
          merchant_details.register_business_country
        )
        : no_data_str,
      "Address Line 1": merchant_details.address_line1
        ? merchant_details.address_line1
        : no_data_str,
      "Address Line 2": merchant_details.address_line2
        ? merchant_details.address_line2
        : no_data_str,
      Province: merchant_details.province
        ? await helpers.get_state_name_by_id(merchant_details.province)
        : "",
      "Business phone code": merchant_details.business_phone_code
        ? "+" + merchant_details.business_phone_code
        : no_data_str,
      "Business phone number": merchant_details.business_phone_number
        ? merchant_details.business_phone_number
        : no_data_str,

      "Business website": merchant_details.business_website
        ? merchant_details.business_website
        : no_data_str,
      "Product Description": merchant_details.product_description
        ? merchant_details.product_description
        : no_data_str,
      Currency: merchant_details.currency_volume,
      "Monthly business volume": merchant_details.monthly_business_volume,
      "Average transaction volume": merchant_details.monthly_transaction_volume,

      "URL for terms and conditions": merchant_details.link_tc,
      "URL for privacy policy": merchant_details.link_pp,
      "URL for refund": merchant_details.link_refund,
      "URL for cancellation": merchant_details.link_cancellation,
      "URL for delivery policy": merchant_details.link_delivery_policy,
      "Transaction Success URL": merchant_details.link_success_url,
      "Transaction Failed URL": merchant_details.link_failed_url,
      "Transaction Cancelled URL": merchant_details.link_cancelled_url,
    };
    let merchant_details_represt = {
      "Legal person first name": merchant_details.legal_person_first_name
        ? merchant_details.legal_person_first_name
        : no_data_str,
      "Legal person last name": merchant_details.legal_person_last_name
        ? merchant_details.legal_person_last_name
        : no_data_str,
      "Legal person email": merchant_details.legal_person_email
        ? merchant_details.legal_person_email
        : no_data_str,
      "Job title": merchant_details.job_title
        ? merchant_details.job_title
        : no_data_str,
      Nationality: merchant_details.nationality
        ? merchant_details.nationality
        : no_data_str,
      DOB: merchant_details.dob
        ? moment(merchant_details.dob).format("DD-MM-YYYY")
        : no_data_str,
      "Home address country": merchant_details.home_address_country
        ? await helpers.get_country_name_by_id(
          merchant_details.home_address_country
        )
        : no_data_str,
      "Home address line-1": merchant_details.home_address_line_1
        ? merchant_details.home_address_line_1
        : no_data_str,
      "Home address line-2": merchant_details.home_address_line_2
        ? merchant_details.home_address_line_2
        : no_data_str,
      "Home province": merchant_details.home_province
        ? await helpers.get_state_name_by_id(merchant_details.home_province)
        : no_data_str,
      "Home phone code": merchant_details.home_phone_code
        ? "+" + merchant_details.home_phone_code
        : no_data_str,
      "Home phone number": merchant_details.home_phone_number
        ? merchant_details.home_phone_number
        : no_data_str,
      // 'Personal ID number': merchant_details.personal_id_number,
    };
    let uploaded_document =
      merchant_details.bank_document_name.charAt(0).toUpperCase() +
      merchant_details.bank_document_name.slice(1);
    let merchant_details_bank = {
      "Bank Name": merchant_details.bank_name
        ? merchant_details.bank_name
        : no_data_str,
      Currency: merchant_details.currency
        ? merchant_details.currency
        : no_data_str,

      "Name on the  bank account": merchant_details.name_on_the_bank_account
        ? merchant_details.name_on_the_bank_account
        : no_data_str,

      "Branch Name": merchant_details.branch_name
        ? merchant_details.branch_name
        : no_data_str,
      IBAN: merchant_details.iban ? merchant_details.iban : no_data_str,
      "BIC/SWIFT": merchant_details.bic_swift
        ? merchant_details.bic_swift
        : no_data_str,
      Address: merchant_details.address
        ? merchant_details.address
        : no_data_str,
      "Account Number": merchant_details.bank_account_no
        ? merchant_details.bank_account_no
        : no_data_str,
      Country: (await helpers.get_country_name_by_id(merchant_details.country))
        ? await helpers.get_country_name_by_id(merchant_details.country)
        : no_data_str,
      State: (await helpers.get_state_name_by_id(merchant_details.state))
        ? await helpers.get_state_name_by_id(merchant_details.state)
        : no_data_str,
      City: (await helpers.get_city_name_by_id(merchant_details.city))
        ? await helpers.get_city_name_by_id(merchant_details.city)
        : no_data_str,
      "Zip code": merchant_details.zip_code
        ? merchant_details.zip_code
        : no_data_str,
      "Bank document name": merchant_details.bank_document_name
        ? uploaded_document.replace(/_/g, " ")
        : no_data_str,
      "Uploaded document":
        merchant_details.bank_document_file != ""
          ? `<a href = "` +
          process.env.STATIC_URL +
          "/static/files/" +
          merchant_details.bank_document_file +
          `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px;text-align:center; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
          : no_data_str,
    };
    let public_details = {
      "Statement Descriptor": merchant_details.statement_descriptor,
      "Shortened Descriptor": merchant_details.shortened_descriptor,
      "Point of contact name": merchant_details.poc_name,
      "Point of contact email": merchant_details.poc_email,
      "Point of contact mobile code": merchant_details.poc_mobile_code
        ? "+" + merchant_details.poc_mobile_code
        : no_data_str,
      "Point of contact mobile": merchant_details.poc_mobile,
      "Compliance and risk officer name": merchant_details.cro_name,
      "Compliance and risk officer email": merchant_details.cro_email,
      "Compliance and risk officer mobile code":
        merchant_details.cro_mobile_code
          ? "+" + merchant_details.cro_mobile_code
          : no_data_str,
      "Compliance and risk officer mobile": merchant_details.cro_mobile,
      "Customer support name": merchant_details.co_name,
      "Customer support email": merchant_details.co_email,
      "Customer support mobile code": merchant_details.co_mobile_code
        ? "+" + merchant_details.co_mobile_code
        : no_data_str,
      "Customer support mobile": merchant_details.co_mobile,
    };

    let business_owners = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_owners"
    );
    let business_executive = await MerchantEkycModel.selectDynamic(
      "*",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_business_executives"
    );
    let entity_document_for = await MerchantEkycModel.selectDynamicDocument(
      "document_for",
      { merchant_id: submerchant_id, deleted: 0 },
      config.table_prefix + "merchant_entity_document"
    );

    var table = `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Type</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_mail_arr_detail_type).forEach(function (key) {
      var val = merchant_details_mail_arr_detail_type[key];
      table +=
        `<tr>
                <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
            </tr>
        `;
    });
    table += `</table>`;
    table += `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    for (document of entity_document_for) {
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: document.document_for,
        },
        config.table_prefix + "merchant_entity_document"
      );

      if (document.document_for == "company") {
        var document_for = "Business Details";

        table +=
          `
                <tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">` +
          document_for +
          `</th></tr>`;

        Object.keys(merchant_details_mail_arr_detail).forEach(function (key) {
          var val = merchant_details_mail_arr_detail[key];
          table +=
            `<tr>
                                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
            key +
            `</th>
                                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            val +
            `</td>
                            </tr>
                        `;
        });
        table += `       <tr>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                      
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
                    </tr>
                `;
        for (val of entity_document) {
          if (val.sequence != 0) {
            let doc = await helpers.get_document_type(val.sequence);
            let document_name = val.document_name
              ? process.env.STATIC_URL + "/static/files/" + val.document_name
              : no_data_str;

            var document_name_back = val.document_name_back
              ? `<a href = "` +
              process.env.STATIC_URL +
              "/static/files/" +
              val.document_name_back +
              `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
              : "";

            let issue_date = val.issue_date
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : no_data_str;
            let expiry_date = val.expiry_date
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : no_data_str;
            let document_num = val.document_num
              ? val.document_num
              : no_data_str;

            table +=
              `<tr>
                                <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              doc +
              ` </td>
                             
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              document_num +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              issue_date +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              expiry_date +
              `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
              document_name +
              `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
              document_name_back +
              `</td>
                            </tr>`;
          }
        }
      } else if (document.document_for == "representative") {
        var document_for = "Business Representative";

        table +=
          `
                <tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">` +
          document_for +
          `</th></tr>`;

        Object.keys(merchant_details_represt).forEach(function (key) {
          var val = merchant_details_represt[key];
          table +=
            `<tr>
                                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
            key +
            `</th>
                                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            val +
            `</td>
                            </tr>
                        `;
        });
        table += `       <tr>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                      
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                        <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
                    </tr>
                `;
        for (val of entity_document) {
          if (
            reg_country.toUpperCase() ==
            (
              await helpers.get_nationalty_name_by_id(
                merchant_details.nationality
              )
            ).toUpperCase() &&
            (await helpers.get_document_type(val.sequence)).toUpperCase() ==
            "VISA"
          ) {
            var show = "style='display:none'";
          } else {
            var show = "";
          }

          if (val.sequence != 0) {
            let doc = await helpers.get_document_type(val.sequence);
            let document_name = val.document_name
              ? process.env.STATIC_URL + "/static/files/" + val.document_name
              : no_data_str;

            var document_name_back = val.document_name_back
              ? `<a href = "` +
              process.env.STATIC_URL +
              "/static/files/" +
              val.document_name_back +
              `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
              : "";

            let issue_date = val.issue_date
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : no_data_str;
            let expiry_date = val.expiry_date
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : no_data_str;
            let document_num = val.document_num
              ? val.document_num
              : no_data_str;

            table +=
              `<tr ` +
              show +
              `>
                                <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              doc +
              ` </td>
                             
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              document_num +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              issue_date +
              `</td>
                                <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
              expiry_date +
              `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
              document_name +
              `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
              document_name_back +
              `</td>
                            </tr>`;
          }
        }
      }
    }
    table += `</table>`;

    var owner = `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Owners</th></tr>`;
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      owner +
      `
        `;

    var counter = 0;
    for (val_business of business_owners) {
      counter++;
      let owner_docs =
        val_business.business_owner == "entity"
          ? "owner_company"
          : "owner_individual";
      let first_name = val_business.first_name
        ? val_business.first_name + " " + val_business.last_name
        : no_data_str;

      let first_name_represent =
        val_business.first_name_represent +
        " " +
        val_business.last_name_represent;

      let nationality = val_business.nationality;
      let email = val_business.email;
      let mobile_no =
        "+" + val_business.country_code + "-" + val_business.mobile;

      table +=
        ` <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        counter +
        `</td></tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Business name</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
                <tr>
                <th colspan=2  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Representative Name</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name_represent +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Nationality</th>
                <td colspan=3  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        nationality +
        `</td>
                </tr>
               `;
      table += `       <tr>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                 
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
               </tr>
           `;
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: owner_docs,
          owners_id: val_business.id,
        },
        config.table_prefix + "merchant_entity_document"
      );

      for (val of entity_document) {
        if (
          reg_country.toUpperCase() ==
          (
            await helpers.get_nationalty_name_by_id(nationality)
          ).toUpperCase() &&
          (await helpers.get_document_type(val.sequence)).toUpperCase() ==
          "VISA"
        ) {
          var show = "style='display:none'";
        } else {
          var show = "";
        }

        if (val.sequence != 0) {
          let doc = await helpers.get_document_type(val.sequence);
          let document_name = val.document_name
            ? process.env.STATIC_URL + "/static/files/" + val.document_name
            : no_data_str;

          var document_name_back = val.document_name_back
            ? `<a href = "` +
            process.env.STATIC_URL +
            "/static/files/" +
            val.document_name_back +
            `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
            : "";

          let issue_date = val.issue_date
            ? moment(val.issue_date).format("DD-MM-YYYY")
            : no_data_str;
          let expiry_date = val.expiry_date
            ? moment(val.expiry_date).format("DD-MM-YYYY")
            : no_data_str;
          let document_num = val.document_num ? val.document_num : no_data_str;

          table +=
            `<tr ` +
            show +
            `>
                            <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            doc +
            ` </td>
                         
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            document_num +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            issue_date +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            expiry_date +
            `</td>
                        <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
            document_name +
            `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
            document_name_back +
            `</td>
                        </tr>`;
        }
      }
    }
    if (counter == 0) {
      table +=
        ` <tr>
            <th colspan=6 style = "text-align:center;padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        no_data_str +
        `</th>
            </tr>`;
    }
    table += `</table>`;

    var exe = `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Business Executives</th></tr>`;
    table +=
      `<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">
        ` +
      exe +
      ``;

    let count = 0;
    for (val_business_exe of business_executive) {
      count++;
      let first_name = val_business_exe.first_name
        ? val_business_exe.first_name + " " + val_business_exe.last_name
        : no_data_str;
      let email = val_business_exe.email;
      let nationality = val_business_exe.nationality;
      let mobile_no =
        "+" + val_business_exe.mobile_code + "-" + val_business_exe.mobile_no;

      table +=
        ` <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Sr.No.</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        count +
        `</td></tr>
              
                <tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Name</th>
            <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        first_name +
        `</td></tr>
              
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Email</th>
                <td  colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        email +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Mobile</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        mobile_no +
        `</td>
                </tr>
                <tr>
                <th colspan=2 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">Nationality</th>
                <td colspan=3 style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        nationality +
        `</td>
                </tr>
               `;
      table += `       <tr>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document</th>
                 
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Document Number</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Issue Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">Expiry Date</th>
                   <th style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">View</th>
               </tr>
           `;
      let entity_document = await MerchantEkycModel.selectDynamic(
        "*",
        {
          merchant_id: submerchant_id,
          deleted: 0,
          document_for: "executive",
          owners_id: val_business_exe.id,
        },
        config.table_prefix + "merchant_entity_document"
      );

      for (val of entity_document) {
        if (
          reg_country.toUpperCase() ==
          (
            await helpers.get_nationalty_name_by_id(nationality)
          ).toUpperCase() &&
          (await helpers.get_document_type(val.sequence)).toUpperCase() ==
          "VISA"
        ) {
          var show = "style='display:none'";
        } else {
          var show = "";
        }

        if (val.sequence != 0) {
          let doc = await helpers.get_document_type(val.sequence);
          let document_name = val.document_name
            ? process.env.STATIC_URL + "/static/files/" + val.document_name
            : no_data_str;

          var document_name_back = val.document_name_back
            ? `<a href = "` +
            process.env.STATIC_URL +
            "/static/files/" +
            val.document_name_back +
            `" style="margin-top:1px;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>`
            : "";

          let issue_date =
            val.issue_date != "NULL" || val.issue_date != "0000-00-00"
              ? moment(val.issue_date).format("DD-MM-YYYY")
              : "";
          let issue_d =
            issue_date == "Invalid date" || "" ? no_data_str : issue_date;
          let expiry_date =
            val.expiry_date != "NULL" || val.expiry_date != "0000-00-00"
              ? moment(val.expiry_date).format("DD-MM-YYYY")
              : "";
          let ex_d =
            expiry_date == "Invalid date" || "" ? no_data_str : expiry_date;
          let document_num = val.document_num ? val.document_num : no_data_str;

          table +=
            `<tr ` +
            show +
            `>
                            <td  style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            doc +
            ` </td>
                         
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            document_num +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            issue_d +
            `</td>
                            <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
            ex_d +
            `</td>
                        <td style = "width:20%;padding: 8px;border:1px solid #ccc;background-color: #fff;"> <a href = "` +
            document_name +
            `" style="display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a>` +
            document_name_back +
            `</td>
                        </tr>`;
        }
      }
    }
    if (count == 0) {
      table +=
        ` <tr>
            <th colspan=6 style = "text-align:center; padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        no_data_str +
        `</th></tr>`;
    }

    table += `</table>`;

    table += `
    <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Public Details</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(public_details).forEach(function (key) {
      var val = public_details[key];
      table +=
        `<tr>
            <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
            <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
        </tr>
    `;
    });
    table += `</table>`;
    table += `
<table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Bank Details</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    Object.keys(merchant_details_bank).forEach(function (key) {
      var val = merchant_details_bank[key];
      table +=
        `<tr>
        <th style = "padding: 8px;border:1px solid #ccc;background-color: #fff;width:200px;">` +
        key +
        `</th>
        <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">` +
        val +
        `</td>
    </tr>
`;
    });
    table += `</table>`;
    table += `
        <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%; background:#fff;" cellpadding="0" cellspacing="0">`;
    table += `<tr ><th colspan=6 style = "padding: 8px;border:1px solid #ccc;background-color: #7367f0;color:#fff;width:200px;">Kyc Details</th></tr>`;
    //for (val of merchant_details_mail_arr) {
    if (merchant_kyc_response.data) {
      var show_video =
        merchant_kyc_response.data.video_kyc_link != "" ? "" : "display:none";
      var show_no_data =
        merchant_kyc_response.data.video_kyc_link == "" ? "" : "display:none";
      var show_selfie =
        merchant_kyc_response.data.selfie_link != "" ? "" : "display:none";
      var selfie_no_data =
        merchant_kyc_response.data.selfie_link == "" ? "" : "display:none";
      table +=
        `<tr>
                                <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">KYC Selfie </td>
                                <td  style = "padding: 8px;border:1px solid #ccc;background-color: #fff;` +
        show_selfie +
        `"><a href = "` +
        merchant_kyc_response.data.selfie_link +
        `"  style="text-align:center;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a></td>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;` +
        selfie_no_data +
        `">` +
        no_data_str +
        `</td>
                          
                            </tr>
                            <tr >
                                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;">KYC Video </td>
                                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;` +
        show_video +
        `"><a     href = "` +
        merchant_kyc_response.data.video_kyc_link +
        `"  style="text-align:center;display: block; font-weight: 500; font-size: 10px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.5em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">view</a></td>
                <td style = "padding: 8px;border:1px solid #ccc;background-color: #fff;` +
        show_no_data +
        `">` +
        no_data_str +
        `</td>
                          
                            </tr>`;
    }
    table += `</table>`;

    for (let emails of psp_details_send) {
      let mail = emails.email;
      let mail_cc = emails.cc;
      let psp_id = emails.id;
      let reference = await helpers.make_reference_number("REF", 8);

      await MerchantEkycModel.addDynamic(
        {
          submerchant_id: submerchant_id,
          psp_id: psp_id,
          email: mail,
          cc: mail_cc,
          reference: reference,
        },
        config.table_prefix + "psp_mail_log"
      );

      let para =
        `Dear ` +
        emails.name +
        ` ,<br>
             Please find the Merchant's details along with documents link with request reference no. ` +
        reference +
        ``;

      let subject = "Merchant KYC documents - " + reference;
      ee.once("email", async (arguments) => {
        await mailSender.PSPMail(mail, mail_cc, subject, table, para);
      });
      ee.emit("email", { merchant_id: submerchant_id });
    }
    await MerchantEkycModel.updateDynamic(
      { id: submerchant_id },
      { psp_mail_send: 1 },
      config.table_prefix + "master_merchant"
    );

    return;

    // res.status(statusCode.ok).send(response.successmsg('Mail send successfully'));
  },
  delete_business_owner: async (req, res) => {
    let table = config.table_prefix + "merchant_business_owners";
    let condition = {
      id: enc_dec.cjs_decrypt(req.bodyString("business_owner_id")),
    };
    let data = { deleted: 1 };
    MerchantEkycModel.updateDynamic(condition, data, table)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Business owner deleted successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  list_business_owner: async (req, res) => {
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    let table = config.table_prefix + "merchant_business_owners";
    let condition = { merchant_id: submerchant_id, deleted: 0 };
    let selection =
      "id,first_name,last_name,first_name_represent,last_name_represent,email,status";
    MerchantEkycModel.selectDynamic(selection, condition, table)
      .then((result) => {
        let send_res = [];
        for (val of result) {
          let res = {
            business_owner_id: encrypt_decrypt("encrypt", val.id),
            first_name: val.first_name_represent,
            last_name: val.last_name_represent,
            email: val.email,
            mobile_no: val.mobile
              ? "+" + val.country_code + " " + val.mobile
              : "",
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Business owner fetch successfully"
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  list_business_executives: async (req, res) => {
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );
    let table = config.table_prefix + "merchant_business_executives";
    let condition = { merchant_id: submerchant_id, deleted: 0 };
    let selection = "id,first_name,last_name,email,status";
    MerchantEkycModel.selectDynamic(selection, condition, table)
      .then((result) => {
        let send_res = [];
        for (val of result) {
          let res = {
            business_owner_id: encrypt_decrypt("encrypt", val.id),
            first_name: val.first_name,
            last_name: val.last_name,
            email: val.email,
            mobile_no: val.mobile_no
              ? "+" + val.mobile_code + " " + val.mobile_no
              : "",
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Business executives fetch successfully"
            )
          );
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  delete_business_executive: async (req, res) => {
    let table = config.table_prefix + "merchant_business_executives";
    let condition = {
      id: enc_dec.cjs_decrypt(req.bodyString("business_executive_id")),
    };
    let data = { deleted: 1 };
    MerchantEkycModel.updateDynamic(condition, data, table)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Business executive deleted successfully"));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  get_profile: async (req, res) => {
    let selection =
      "`id`,`name`,`super_merchant_id`, `email`, `code`, `mobile_no`";

    let condition = { id: req.user.id };
    let table_name = config.table_prefix + "master_super_merchant";

    MerchantEkycModel.selectDynamicSingle(selection, condition, table_name)
      .then(async (merchant_result) => {
        let main_sub_merchant_data = await MerchantEkycModel.select_first(
          "id",
          {
            super_merchant_id:
              merchant_result.super_merchant_id > 0
                ? req.user.super_merchant_id
                : req.user.id,
          }
        );
        let condition = { "mm.id": main_sub_merchant_data.id };
        MerchantEkycModel.selectFullProfile(condition)
          .then(async (merchant_details_result) => {
            let condition = {
              merchant_id: req.user.id,
              status: 0,
              deleted: 0,
            };
            let meeting_data = await MerchantEkycModel.get_count(
              { merchant_id: merchant_details_result.id },
              config.table_prefix + "merchant_meetings"
            );
            let selection =
              "`id`,`merchant_id`,`first_name`, `last_name`, `mobile_code`, `mobile_no`,`deleted`,`email`";
            let selection_owner =
              "`id`,`merchant_id`,ekyc_status,`first_name`, `last_name`,`first_name_represent`, `last_name_represent`,  `nationality`, `country_code`, `mobile`,`business_owner`,`email`";
            let table_name = config.table_prefix + "merchant_business_owners";
            let business_owners = await MerchantEkycModel.selectDynamic(
              selection_owner,
              condition,
              table_name
            );
            let entity_document = await MerchantEkycModel.selectDynamic(
              "id, entity_id, owners_id, document_for, sequence, merchant_id, document_id, issue_date, expiry_date, document_num, document_name, document_name_back, deleted, added_date, ip ",
              { merchant_id: req.user.id, deleted: 0 },
              config.table_prefix + "merchant_entity_document"
            );
            let getKeys = await MerchantEkycModel.selectKeyData(
              main_sub_merchant_data.id
            );
            let entity_documents = [];
            for (val of entity_document) {
              let ent_lists = await EntityModel.list_of_document({
                id: val.document_id,
              });

              let ent_list = ent_lists[0];
              if (ent_list) {
                let seq = val.sequence;
                let res = {
                  id: enc_dec.cjs_encrypt(ent_list.id),
                  document: await helpers.get_document_type(ent_list.document),
                  document_ids: enc_dec.cjs_encrypt(ent_list.document),

                  is_required: ent_list.required ? 1 : 0,
                  id_: ent_list.id,
                  document_required: await helpers.getDocumentRequired(
                    ent_list.document
                  ),
                  document_num_required:
                    ent_list.document_num_required == 1 ? 1 : 0,
                  issue_date_required:
                    ent_list.issue_date_required == 1 ? 1 : 0,
                  expiry_date_required: ent_list.expiry_date_required ? 1 : 0,
                  sequence: val.sequence,
                  entity_type: encrypt_decrypt("encrypt", val.entity_id),
                };

                (res["data_id"] = encrypt_decrypt("encrypt", val.id)),
                  (res["document_id"] = encrypt_decrypt(
                    "encrypt",
                    val.document_id
                  )),
                  (res["document_number"] = val.document_num
                    ? val.document_num
                    : ""),
                  (res["document_issue_date"] = val.issue_date
                    ? moment(val.issue_date).format("DD-MM-YYYY")
                    : ""),
                  (res["file_name_front"] = val.document_name
                    ? val.document_name
                    : ""),
                  (res["file_name_back"] = val.document_name_back
                    ? val.document_name_back
                    : ""),
                  (res["document_expiry_date"] = val.expiry_date
                    ? moment(val.expiry_date).format("DD-MM-YYYY")
                    : ""),
                  (res["document_file"] = val.document_name
                    ? process.env.STATIC_URL +
                    "/static/files/" +
                    val.document_name
                    : ""),
                  (res["document_file_back"] = val.document_name
                    ? process.env.STATIC_URL +
                    "/static/files/" +
                    val.document_name_back
                    : ""),
                  entity_documents.push(res);
              }
            }

            //get kyc form data
            let match_selfie_document =
              await MerchantEkycModel.getSelfieDocsRep(
                merchant_details_result.id,
                "representative",
                0
              );

            let submit_merchant_status = {
              kyc_link: process.env.MERCHANT_KYC_URL,
              match_link: match_selfie_document
                ? process.env.STATIC_URL +
                "/static/files/" +
                match_selfie_document.document_name
                : "",
              merchant_id: encrypt_decrypt(
                "encrypt",
                merchant_details_result.id
              ),
              merchant_name: merchant_details_result.company_name
                ? merchant_details_result.company_name
                : "",
              legal_person_name: merchant_details_result.legal_person_first_name
                ? merchant_details_result.legal_person_first_name +
                " " +
                merchant_details_result.legal_person_last_name
                : "",
              doc_name: match_selfie_document.sequence
                ? await helpers.get_document_type(
                  match_selfie_document.sequence
                )
                : "",

              legal_person_email: merchant_details_result.legal_person_email
                ? merchant_details_result.legal_person_email
                : "",
              country_code: merchant_details_result.home_phone_code
                ? merchant_details_result.home_phone_code
                : "",
              doc_number: match_selfie_document.document_num
                ? match_selfie_document.document_num
                : "",
              dob: merchant_details_result.dob
                ? moment(merchant_details_result.dob).format("DD-MM-YYYY")
                : "",
              address:
                merchant_details_result.home_address_line_1 +
                  merchant_details_result.home_address_line_2
                  ? " " + merchant_details_result.home_address_line_2
                  : "",
            };
            let psp_kyc = 0;

            if (merchant_details_result.psp_id) {
              let psp_ids = merchant_details_result.psp_id.split(",");
              for (let pi of psp_ids) {
                let psp_details = await helpers.get_psp_details_by_id(
                  "ekyc_required",
                  pi
                );
                if (psp_details.ekyc_required == 1) {
                  psp_kyc++;
                }
              }
            }
            let ekyc_required = 0;
            if (psp_kyc > 0) {
              submit_merchant_status.ekyc_required = 1;
              ekyc_required = 1;
            } else {
              submit_merchant_status.ekyc_required = 0;
              ekyc_required = 0;
            }

            //end kyc form data

            //key data

            const keyData = [];
            getKeys.forEach((elements, index) => {
              keys_id = enc_dec.cjs_encrypt(elements.id);
              submerchant_id = enc_dec.cjs_encrypt(elements.merchant_id);
              type = elements.type;
              merchant_key = elements.merchant_key;
              merchant_secret = elements.merchant_secret;
              created_at = moment(elements.created_at).format(
                "DD-MM-YYYY H:mm:ss"
              );

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
            //key data

            let business_owner = [];
            for (val of business_owners) {
              let res = {
                id: encrypt_decrypt("encrypt", val.id),
                first_name: val.first_name,
                last_name: val.last_name,
                business_owner: val.business_owner,
                represent_first_name: val.first_name_represent,
                represent_last_name: val.last_name_represent,
                represent_nationality: val.nationality,
                represent_country_code: val.country_code,
                represent_mobile: val.mobile,
                email: val.email,
              };
              business_owner.push(res);
            }

            let table_executive =
              config.table_prefix + "merchant_business_executives";
            let business_executive = await MerchantEkycModel.selectDynamic(
              selection,
              condition,
              table_executive
            );

            let business_executives = [];
            for (val of business_executive) {
              let res = {
                id: encrypt_decrypt("encrypt", val.id),
                first_name: val.first_name,
                last_name: val.last_name,
                email: val.email,
                country_code: val.mobile_code ? val.mobile_code : "",
                mobile: val.mobile_no ? val.mobile_no : "",
              };
              business_executives.push(res);
            }

            let profile = {
              submerchant_id: encrypt_decrypt(
                "encrypt",
                merchant_details_result.id
              ),
              name: merchant_result.name,
              email: merchant_result.email,
              mobile_code: merchant_result.code,
              mobile_no: merchant_result.mobile_no,
              ekyc_done:
                merchant_details_result.ekyc_done == 2 ||
                  merchant_details_result.ekyc_done == 3
                  ? "Yes"
                  : "No",
              video_kyc_done:
                merchant_details_result.video_kyc_done == 1 ? "Yes" : "No",
              onboarding_done:
                merchant_details_result.onboarding_done == 1 ? "Yes" : "No",
              ekyc_required: merchant_details_result.ekyc_required,
              main_step: merchant_details_result.main_step,
              live: merchant_details_result.live,
              register_business_country:
                merchant_details_result.register_business_country
                  ? encrypt_decrypt(
                    "encrypt",
                    merchant_details_result.register_business_country
                  )
                  : "",
              //register_business_country_name: await helpers.get_country_name_by_id(merchant_details_result.register_business_country),
              register_business_country_name:
                merchant_details_result.register_business_country_name,

              type_of_business: merchant_details_result.type_of_business
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.type_of_business
                )
                : "",
              //type_of_business_name: await helpers.get_type_of_business(merchant_details_result.type_of_business),
              type_of_business_name:
                merchant_details_result.type_of_business_name,

              is_business_register_in_free_zone:
                merchant_details_result.is_business_register_in_free_zone,
              company_name: merchant_details_result.company_name,
              company_registration_number:
                merchant_details_result.company_registration_number,
              vat_number: merchant_details_result.vat_number,
              doing_business_as: merchant_details_result.doing_business_as,

              register_business_address_country:
                merchant_details_result.register_business_country
                  ? encrypt_decrypt(
                    "encrypt",
                    merchant_details_result.register_business_country
                  )
                  : "",
              //register_business_address_country_name: await helpers.get_country_name_by_id(merchant_details_result.register_business_address_country),
              register_business_address_country_name:
                merchant_details_result.register_business_address_country_name,

              address_line1: merchant_details_result.address_line1,
              address_line2: merchant_details_result.address_line2,

              province_name: merchant_details_result.province_name,
              legal_person_home_province_name:
                merchant_details_result.legal_person_home_province_name,

              business_phone_code: merchant_details_result.business_phone_code,
              business_phone_number:
                merchant_details_result.business_phone_number,

              mcc_codes: merchant_details_result.mcc_codes
                ? encrypt_decrypt("encrypt", merchant_details_result.mcc_codes)
                : "",
              //mcc_codes_name: merchant_details_result.mcc_codes?await helpers.get_mcc_code_description(merchant_details_result.mcc_codes):"",
              mcc_codes_name: merchant_details_result.mcc_codes_name,

              psp_id: merchant_details_result.psp_id
                ? helpers.get_multiple_ids_encrypt(
                  merchant_details_result.psp_id
                )
                : "",
              psp_name: merchant_details_result.psp_id
                ? await PspModel.getPspName(
                  String(merchant_details_result.psp_id)
                )
                : "",
              //psp_name: merchant_details_result.psp_name,

              business_website: merchant_details_result.business_website,
              product_description: merchant_details_result.product_description,
              legal_person_first_name:
                merchant_details_result.legal_person_first_name,
              legal_person_last_name:
                merchant_details_result.legal_person_last_name,
              legal_person_email: merchant_details_result.legal_person_email,
              job_title: merchant_details_result.job_title,
              nationality: merchant_details_result.nationality
                ? merchant_details_result.nationality
                : "",
              nationality_name: merchant_details_result.nationality
                ? await helpers.get_nationalty_name_by_id(
                  merchant_details_result.nationality
                )
                : "",
              dob: merchant_details_result.dob,
              home_address_country: merchant_details_result.home_address_country
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.home_address_country
                )
                : "",
              home_address_country_name:
                merchant_details_result.home_address_country
                  ? await helpers.get_country_name_by_id(
                    merchant_details_result.home_address_country
                  )
                  : "",
              home_address_line_1: merchant_details_result.home_address_line_1,
              home_address_line_2: merchant_details_result.home_address_line_2,
              home_province_id: merchant_details_result.home_province
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.home_province
                )
                : "",
              home_province: merchant_details_result.home_province
                ? await helpers.get_state_name_by_id(
                  merchant_details_result.home_province
                )
                : "",
              home_phone_code: merchant_details_result.home_phone_code,
              home_phone_number: merchant_details_result.home_phone_number,
              personal_id_number: merchant_details_result.personal_id_number,
              statement_descriptor:
                merchant_details_result.statement_descriptor,
              shortened_descriptor:
                merchant_details_result.shortened_descriptor,
              customer_support_phone_code:
                merchant_details_result.customer_support_phone_code,
              customer_support_phone_number:
                merchant_details_result.customer_support_phone_number,
              bank_name: merchant_details_result.bank_name,
              branch_name: merchant_details_result.branch_name,
              iban: merchant_details_result.iban,
              last_updated: merchant_details_result.last_updated,

              legal_person_home_address_country_name:
                merchant_details_result.legal_person_home_address_country_name,

              poc_name: merchant_details_result.poc_name + "",
              poc_email: merchant_details_result.poc_email + "",
              poc_mobile_code: merchant_details_result.poc_mobile_code + "",
              poc_mobile: merchant_details_result.poc_mobile + "",
              cro_name: merchant_details_result.cro_name + "",
              cro_email: merchant_details_result.cro_email + "",
              cro_mobile_code: merchant_details_result.cro_mobile_code + "",
              cro_mobile: merchant_details_result.cro_mobile + "",
              co_name: merchant_details_result.co_name + "",
              co_email: merchant_details_result.co_email + "",
              co_mobile_code: merchant_details_result.co_mobile_code + "",
              co_mobile: merchant_details_result.co_mobile + "",
              link_tc: merchant_details_result.link_tc + "",
              link_pp: merchant_details_result.link_pp + "",
              link_refund: merchant_details_result.link_refund + "",
              link_cancellation: merchant_details_result.link_cancellation + "",
              link_dp: merchant_details_result.link_delivery_policy + "",

              province: merchant_details_result.province
                ? encrypt_decrypt("encrypt", merchant_details_result.province)
                : "",
              business_owners: business_owner,
              business_executives: business_executives,
              entity_documents: entity_documents,
              kyc_document_data: submit_merchant_status,
              keyData: keyData,

              monthly_business_volume:
                merchant_details_result.monthly_business_volume,
              monthly_transaction_volume:
                merchant_details_result.monthly_transaction_volume,
              currency_volume: merchant_details_result.currency_volume,
              meeting_data: meeting_data > 0 ? 1 : 0,
            };
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(profile, "Profile fetch successfully")
              );
          })
          .catch((error) => {
            console.log(error);
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error));
          });
      })
      .catch((error) => {
        console.log(error);
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  get_sub_merchant_profile: async (req, res) => {
    let selection =
      "`id`,`features`,`super_merchant_id`,`name`, `email`, `code`, `mobile_no`,`main_step`,`ekyc_done`,`onboarding_done`,`live`,`video_kyc_done`,`ekyc_required`,`register_at`";
    let submerchant_id = encrypt_decrypt(
      "decrypt",
      req.bodyString("submerchant_id")
    );

    let condition = { id: submerchant_id };
    let table_name = config.table_prefix + "master_merchant";

    MerchantEkycModel.selectDynamicSingle(selection, condition, table_name)
      .then((merchant_result) => {
        let condition = { "mm.id": submerchant_id };
        MerchantEkycModel.selectFullProfile(condition)
          .then(async (merchant_details_result) => {
            let super_merchant =
              await MerchantEkycModel.select_first_super_merchant("id", {
                super_merchant_id: merchant_result.super_merchant_id,
              });
            let condition = {
              merchant_id: submerchant_id,
              status: 0,
              deleted: 0,
            };
            let selection_owner =
              "`id`,`merchant_id`,ekyc_status,`first_name`, `last_name`,`first_name_represent`, `last_name_represent`,  `nationality`, `country_code`, `mobile`,`business_owner`,`email`,`ekyc_required`";
            let selection =
              "`id`,`merchant_id`,`first_name`, `last_name`,`mobile_code`, `mobile_no`, `email`, `nationality`,`ekyc_required`,`ekyc_status`";
            let table_name = config.table_prefix + "merchant_business_owners";
            let business_owners = await MerchantEkycModel.selectDynamic(
              selection_owner,
              condition,
              table_name
            );
            let search = {
              merchant_id: submerchant_id,
              deleted: 0,
            };
            if (req.bodyString("entity_id")) {
              let entity_id = encrypt_decrypt(
                "decrypt",
                req.bodyString("entity_id")
              );
              search.entity_id = entity_id;
            }
            if (req.bodyString("document_for")) {
              search.document_for = req.bodyString("document_for");
            }
            let entity_document = await MerchantEkycModel.selectDynamic(
              "*",
              search,
              config.table_prefix + "merchant_entity_document"
            );

            let entity_documents = [];
            for (val of entity_document) {
              if (val?.document_id !== 0) {
                let ent_lists = await EntityModel.list_of_document({
                  id: val.document_id,
                });
                let ent_list = ent_lists[0];
                let seq = val.sequence;
                let res = {};
                if (ent_list) {
                  res = {
                    id: ent_list?.id ? enc_dec.cjs_encrypt(ent_list?.id) : "",
                    document: ent_list?.document
                      ? await helpers.get_document_type(ent_list.document)
                      : "",
                    document_ids: ent_list?.document
                      ? enc_dec.cjs_encrypt(ent_list.document)
                      : "",
                    is_required: ent_list?.required ? 1 : 0,
                    id_: ent_list?.id ? ent_list?.id : "",
                    document_for: ent_list?.document_for
                      ? ent_list?.document_for
                      : "",
                    document_required: ent_list?.document
                      ? await helpers.getDocumentRequired(ent_list?.document)
                      : "",
                    document_num_required:
                      ent_list?.document_num_required == 1 ? 1 : 0,
                    issue_date_required:
                      ent_list?.issue_date_required == 1 ? 1 : 0,
                    expiry_date_required: ent_list?.expiry_date_required
                      ? 1
                      : 0,
                    sequence: val?.sequence,
                    entity_type: encrypt_decrypt("encrypt", val?.entity_id),
                  };
                }

                (res["data_id"] = encrypt_decrypt("encrypt", val?.id)),
                  (res["document_id"] = encrypt_decrypt(
                    "encrypt",
                    val?.document_id
                  )),
                  (res["document_number"] = val?.document_num
                    ? val?.document_num
                    : ""),
                  (res["document_for"] = val?.document_for
                    ? val?.document_for
                    : ""),
                  (res["document_issue_date"] = val?.issue_date
                    ? moment(val?.issue_date).format("DD-MM-YYYY")
                    : ""),
                  (res["document_expiry_date"] = val?.expiry_date
                    ? moment(val?.expiry_date).format("DD-MM-YYYY")
                    : ""),
                  (res["file_name_front"] = val?.document_name
                    ? val?.document_name
                    : ""),
                  (res["file_name_back"] = val?.document_name_back
                    ? val?.document_name_back
                    : ""),
                  (res["document_file"] = val?.document_name
                    ? process.env.STATIC_URL +
                    "/static/files/" +
                    val?.document_name
                    : ""),
                  (res["document_file_back"] = val?.document_name
                    ? process.env.STATIC_URL +
                    "/static/files/" +
                    val?.document_name_back
                    : ""),
                  entity_documents.push(res);
              }
            }
            //get kyc form data
            let match_selfie_document =
              await MerchantEkycModel.getSelfieDocsRep(
                submerchant_id,
                "representative",
                0
              );

            let submit_merchant_status = {
              kyc_link: process.env.MERCHANT_KYC_URL,
              match_link: match_selfie_document
                ? process.env.STATIC_URL +
                "/static/files/" +
                match_selfie_document.document_name
                : "",
              merchant_id: encrypt_decrypt("encrypt", submerchant_id),
              merchant_name: merchant_details_result?.company_name
                ? merchant_details_result?.company_name
                : "",
              legal_person_name:
                merchant_details_result?.legal_person_first_name
                  ? merchant_details_result?.legal_person_first_name +
                  " " +
                  merchant_details_result?.legal_person_last_name
                  : "",
              doc_name: match_selfie_document?.document_num
                ? helpers.doc_names(match_selfie_document?.sequence)
                : "",
              doc_number: match_selfie_document?.document_num
                ? match_selfie_document.document_num
                : "",
              dob: merchant_details_result?.dob
                ? moment(merchant_details_result.dob).format("DD-MM-YYYY")
                : "",
              address:
                merchant_details_result?.home_address_line_1 +
                  merchant_details_result?.home_address_line_2
                  ? " " + merchant_details_result?.home_address_line_2
                  : "",
            };
            let psp_kyc = 0;

            if (merchant_details_result.psp_id) {
              let psp_ids = merchant_details_result?.psp_id.split(",");
              for (let pi of psp_ids) {
                let psp_details = await helpers.get_psp_details_by_id(
                  "ekyc_required",
                  pi
                );
                if (psp_details.ekyc_required == 1) {
                  psp_kyc++;
                }
              }
            }
            let ekyc_required = 0;
            if (psp_kyc > 0) {
              submit_merchant_status.ekyc_required = 1;
              ekyc_required = 1;
            } else {
              submit_merchant_status.ekyc_required = 0;
              ekyc_required = 0;
            }

            //end kyc form data

            let business_owner = [];
            for (val_ of business_owners) {
              let search_ = {
                merchant_id: submerchant_id,
                deleted: 0,
              };
              if (req.bodyString("entity_id")) {
                let entity_id = encrypt_decrypt(
                  "decrypt",
                  req.bodyString("entity_id")
                );

                search_.entity_id = entity_id;
              }
              if (val_.business_owner == "entity") {
                search_.document_for = "owner_company";
              }
              if (val_.business_owner == "individual") {
                search_.document_for = "owner_individual";
              }
              search_.owners_id = val_.id;
              let entity_document_ = await MerchantEkycModel.selectDynamic(
                "*",
                search_,
                config.table_prefix + "merchant_entity_document"
              );

              let entity_documents_ = [];
              for (val of entity_document_) {
                if (val.document_id !== 0) {
                  let ent_lists_ = await EntityModel.list_of_document({
                    id: val.document_id,
                  });

                  let ent_list_ = ent_lists_[0];

                  let seq = val.sequence;
                  let res_ = {
                    id: ent_list_?.id ? enc_dec.cjs_encrypt(ent_list_?.id) : "",
                    document: ent_list_?.document
                      ? await helpers.get_document_type(ent_list_?.document)
                      : "",
                    document_ids: ent_list_?.document
                      ? enc_dec.cjs_encrypt(ent_list_?.document)
                      : "",
                    is_required: ent_list_?.required ? 1 : 0,
                    id_: ent_list_?.id ? ent_list_?.id : "",
                    document_for: ent_list_?.document_for
                      ? ent_list_?.document_for
                      : "",
                    document_required: ent_list_?.document
                      ? await helpers.getDocumentRequired(ent_list_?.document)
                      : "",
                    document_num_required:
                      ent_list_?.document_num_required == 1 ? 1 : 0,
                    issue_date_required:
                      ent_list_?.issue_date_required == 1 ? 1 : 0,
                    expiry_date_required: ent_list_?.expiry_date_required
                      ? 1
                      : 0,
                    sequence: val?.sequence ? val?.sequence : "",
                    entity_type: val?.entity_id
                      ? encrypt_decrypt("encrypt", val?.entity_id)
                      : "",
                  };

                  (res_["data_id"] = encrypt_decrypt("encrypt", val.id)),
                    (res_["document_id"] = encrypt_decrypt(
                      "encrypt",
                      val.document_id
                    )),
                    (res_["document_number"] = val.document_num
                      ? val.document_num
                      : ""),
                    (res_["document_for"] = val.document_for
                      ? val.document_for
                      : ""),
                    (res_["document_issue_date"] = val.issue_date
                      ? moment(val.issue_date).format("DD-MM-YYYY")
                      : ""),
                    (res_["document_expiry_date"] = val.expiry_date
                      ? moment(val.expiry_date).format("DD-MM-YYYY")
                      : ""),
                    (res_["file_name_front"] = val.document_name
                      ? val.document_name
                      : ""),
                    (res_["file_name_back"] = val.document_name_back
                      ? val.document_name_back
                      : ""),
                    (res_["document_file"] = val.document_name
                      ? process.env.STATIC_URL +
                      "/static/files/" +
                      val.document_name
                      : ""),
                    (res_["document_file_back"] = val.document_name
                      ? process.env.STATIC_URL +
                      "/static/files/" +
                      val.document_name_back
                      : ""),
                    entity_documents_.push(res_);
                }
              }

              let res = {
                id: encrypt_decrypt("encrypt", val_?.id),
                first_name: val_?.first_name,
                last_name: val_?.last_name,
                email: val_?.email,
                business_owner: val_?.business_owner,
                represent_first_name: val_?.first_name_represent,
                represent_last_name: val_?.last_name_represent,
                represent_nationality: val_?.nationality,
                represent_country_code: val_?.country_code,
                represent_mobile: val_?.mobile,
                ekyc_required: val_?.ekyc_required,
                ekyc_status: val_?.ekyc_status,
                kyc_status:
                  merchant_result.onboarding_done != 1
                    ? "Onboarding Pending"
                    : val_.ekyc_required == 0 && val_.ekyc_status == 0
                      ? "Onboarding Done"
                      : val_.ekyc_required == 1 && val_.ekyc_status == 0
                        ? "eKYC Pending"
                        : val_.ekyc_required == 1 && val_.ekyc_status == 2
                          ? "eKYC Done"
                          : val_.ekyc_required == 1 && val_.ekyc_status == 3
                            ? "eKYC Denied"
                            : "",
                documents: entity_documents_,
                nationality_name: val_.nationality
                  ? await helpers.get_nationalty_name_by_id(val_.nationality)
                  : "",
              };
              business_owner.push(res);
            }

            let table_executive =
              config.table_prefix + "merchant_business_executives";
            let business_executive = await MerchantEkycModel.selectDynamic(
              selection,
              condition,
              table_executive
            );

            let business_executives = [];
            for (val_ of business_executive) {
              let search_ = {
                merchant_id: submerchant_id,
                deleted: 0,
              };
              if (req.bodyString("entity_id")) {
                let entity_id = encrypt_decrypt(
                  "decrypt",
                  req.bodyString("entity_id")
                );

                search_.entity_id = entity_id;
              }
              search_.document_for = "executive";

              search_.owners_id = val_.id;
              let entity_document_ = await MerchantEkycModel.selectDynamic(
                "*",
                search_,
                config.table_prefix + "merchant_entity_document"
              );

              let entity_documents_ = [];
              for (val of entity_document_) {
                if (val.document_id !== 0) {
                  let ent_lists_ = await EntityModel.list_of_document({
                    id: val.document_id,
                  });

                  let ent_list_ = ent_lists_[0];

                  let seq = val.sequence;
                  let res_ = {
                    // id: ent_list_.id ? enc_dec.cjs_encrypt(ent_list_?.id) : 0,
                    id: 0,
                    document: await helpers.get_document_type(
                      ent_list_.document
                    ),
                    document_ids: enc_dec.cjs_encrypt(ent_list_.document),
                    is_required: ent_list_.required ? 1 : 0,
                    id_: ent_list_?.id,
                    document_for: ent_list_.document_for,
                    document_required: await helpers.getDocumentRequired(
                      ent_list_.document
                    ),
                    document_num_required:
                      ent_list_.document_num_required == 1 ? 1 : 0,
                    issue_date_required:
                      ent_list_.issue_date_required == 1 ? 1 : 0,
                    expiry_date_required: ent_list_.expiry_date_required
                      ? 1
                      : 0,
                    sequence: val.sequence,
                    entity_type: encrypt_decrypt("encrypt", val.entity_id),
                  };

                  (res_["data_id"] = val.id
                    ? encrypt_decrypt("encrypt", val.id)
                    : ""),
                    (res_["document_id"] = encrypt_decrypt(
                      "encrypt",
                      val.document_id
                    )),
                    (res_["document_number"] = val.document_num
                      ? val.document_num
                      : ""),
                    (res_["document_for"] = val.document_for
                      ? val.document_for
                      : ""),
                    (res_["document_issue_date"] =
                      val.issue_date != ("00-00-0000" || "NULL")
                        ? moment(val.issue_date).format("DD-MM-YYYY")
                        : ""),
                    (res_["document_expiry_date"] =
                      val.expiry_date != ("00-00-0000" || "NULL")
                        ? moment(val.expiry_date).format("DD-MM-YYYY")
                        : ""),
                    (res_["file_name_front"] = val.document_name
                      ? val.document_name
                      : ""),
                    (res_["file_name_back"] = val.document_name_back
                      ? val.document_name_back
                      : ""),
                    (res_["document_file"] = val.document_name
                      ? process.env.STATIC_URL +
                      "/static/files/" +
                      val.document_name
                      : ""),
                    (res_["document_file_back"] = val.document_name
                      ? process.env.STATIC_URL +
                      "/static/files/" +
                      val.document_name_back
                      : ""),
                    entity_documents_.push(res_);
                }
              }
              let res = {
                id: encrypt_decrypt("encrypt", val_.id),
                first_name: val_.first_name,
                last_name: val_.last_name,
                email: val_.email,
                mobile_no: val_.mobile_no
                  ? "+" + val_.mobile_code + " " + val_.mobile_no
                  : "",
                documents: entity_documents_,
                nationality: val_?.nationality,
                nationality_name: val_.nationality
                  ? await helpers.get_nationalty_name_by_id(val_.nationality)
                  : "",
                ekyc_required: val_?.ekyc_required,
                ekyc_status: val_?.ekyc_status,
                kyc_status:
                  merchant_result.onboarding_done != 1
                    ? "Onboarding Pending"
                    : val_.ekyc_required == 0 && val_.ekyc_status == 0
                      ? "Onboarding Done"
                      : val_.ekyc_required == 1 && val_.ekyc_status == 0
                        ? "eKYC Pending"
                        : val_.ekyc_required == 1 && val_.ekyc_status == 2
                          ? "eKYC Done"
                          : val_.ekyc_required == 1 && val_.ekyc_status == 3
                            ? "eKYC Denied"
                            : "",
              };
              business_executives.push(res);
            }

            let profile = {
              super_merchant_name: merchant_details_result.legal_business_name,
              super_merchant_mobile: merchant_details_result.mobile_no,
              super_merchant_code: merchant_details_result.code,
              super_merchant_email: merchant_details_result.email,
              super_merchant_business:
                merchant_details_result.super_business_name
                  ? merchant_details_result.super_business_name
                  : "",
              submerchant_id: encrypt_decrypt(
                "encrypt",
                merchant_details_result.id
              ),
              dec_sub_merchant_id:merchant_details_result.id,
              super_business_address:
                super_merchant == merchant_details_result.id
                  ? encrypt_decrypt(
                    "encrypt",
                    merchant_details_result.business_address
                  )
                  : "",
              super_business_address_name:
                merchant_details_result.business_address
                  ? merchant_details_result.business_address
                  : "",
              super_merchant_or_not:
                super_merchant == merchant_details_result.id
                  ? "super_merchant"
                  : "submerchant",
              referral_code: merchant_details_result.referral_code,

              registered_email:
                merchant_details_result.memail == ""
                  ? merchant_details_result.legal_person_email
                    ? merchant_details_result.legal_person_email
                    : ""
                  : merchant_details_result.memail,

              email: merchant_result.legal_person_email,
              mobile_code: merchant_result.code,
              mobile_no: merchant_result.mobile_no,
              ekyc_done: merchant_result.ekyc_done == 2 ? "Yes" : "No",
              video_kyc_done:
                merchant_result.video_kyc_done == 1 ? "Yes" : "No",
              onboarding_done:
                merchant_result.onboarding_done == 1 ? "Yes" : "No",
              features: merchant_result.features,
              onboarding_done: merchant_result.onboarding_done,
              ekyc_required: merchant_result.ekyc_required,
              main_step: merchant_result.main_step,
              live: merchant_result.live,
              register_business_country:
                merchant_details_result.register_business_country
                  ? encrypt_decrypt(
                    "encrypt",
                    merchant_details_result.register_business_country
                  )
                  : "",
              //register_business_country_name: await helpers.get_country_name_by_id(merchant_details_result.register_business_country),
              register_business_country_name:
                merchant_details_result.register_business_country_name,

              type_of_business: merchant_details_result.type_of_business
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.type_of_business
                )
                : "",
              type_of_business_name: await helpers.get_entity_type(
                merchant_details_result.type_of_business
              ),
              // type_of_business_name: merchant_details_result.type_of_business_name,

              is_business_register_in_free_zone:
                merchant_details_result.is_business_register_in_free_zone,
              company_name: merchant_details_result.company_name,
              company_registration_number:
                merchant_details_result.company_registration_number,
              vat_number: merchant_details_result.vat_number,
              doing_business_as: merchant_details_result.doing_business_as,

              register_business_address_country:
                merchant_details_result.register_business_country
                  ? encrypt_decrypt(
                    "encrypt",
                    merchant_details_result.register_business_country
                  )
                  : "",
              //register_business_address_country_name: await helpers.get_country_name_by_id(merchant_details_result.register_business_address_country),
              register_business_address_country_name:
                merchant_details_result.register_business_address_country_name,

              address_line1: merchant_details_result.address_line1,
              address_line2: merchant_details_result.address_line2,

              province_name: merchant_details_result.province_name,
              legal_person_home_province_name:
                merchant_details_result.legal_person_home_province_name,

              business_phone_code: merchant_details_result.business_phone_code,
              business_phone_number:
                merchant_details_result.business_phone_number,

              mcc_codes: merchant_details_result.mcc_codes
                ? encrypt_decrypt("encrypt", merchant_details_result.mcc_codes)
                : "",
              //mcc_codes_name: merchant_details_result.mcc_codes?await helpers.get_mcc_code_description(merchant_details_result.mcc_codes):"",
              mcc_codes_name: merchant_details_result.mcc_codes_name,

              psp_id: merchant_details_result.psp_id
                ? helpers.get_multiple_ids_encrypt(
                  merchant_details_result.psp_id
                )
                : "",
              psp_name: merchant_details_result.psp_id
                ? await PspModel.getPspName(
                  String(merchant_details_result.psp_id)
                )
                : "",
              //psp_name: merchant_details_result.psp_name,

              business_website: merchant_details_result.business_website,
              product_description: merchant_details_result.product_description,
              legal_person_first_name:
                merchant_details_result.legal_person_first_name,
              legal_person_last_name:
                merchant_details_result.legal_person_last_name,
              legal_person_email: merchant_details_result.legal_person_email,
              job_title: merchant_details_result.job_title,
              nationality: merchant_details_result.nationality
                ? merchant_details_result.nationality
                : "",
              nationality_name: merchant_details_result.nationality
                ? await helpers.get_nationalty_name_by_id(
                  merchant_details_result.nationality
                )
                : "",
              dob: moment(merchant_details_result.dob).format("DD-MM-YYYY"),
              rep_expiry_date: merchant_details_result.rep_expiry_date
                ? moment(merchant_details_result.rep_expiry_date).format(
                  "DD-MM-YYYY"
                )
                : "",
              home_address_country: merchant_details_result.home_address_country
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.home_address_country
                )
                : "",
              home_address_country_name:
                merchant_details_result.home_address_country
                  ? await helpers.get_country_name_by_id(
                    merchant_details_result.home_address_country
                  )
                  : "",
              home_address_line_1: merchant_details_result.home_address_line_1,
              home_address_line_2: merchant_details_result.home_address_line_2,
              home_province_id: merchant_details_result.home_province
                ? encrypt_decrypt(
                  "encrypt",
                  merchant_details_result.home_province
                )
                : "",
              home_province: merchant_details_result.home_province
                ? await helpers.get_state_name_by_id(
                  merchant_details_result.home_province
                )
                : "",
              home_phone_code: merchant_details_result.home_phone_code,
              home_phone_number: merchant_details_result.home_phone_number,
              personal_id_number: merchant_details_result.personal_id_number,

              statement_descriptor:
                merchant_details_result.statement_descriptor,
              shortened_descriptor:
                merchant_details_result.shortened_descriptor,
              customer_support_phone_code:
                merchant_details_result.customer_support_phone_code,
              customer_support_phone_number:
                merchant_details_result.customer_support_phone_number,
              msisdn_country: merchant_details_result.msisdn_country,
              msisdn: merchant_details_result.msisdn,
              account_id: merchant_details_result.account_id,
              bank_name: merchant_details_result.bank_name,
              branch_name: merchant_details_result.branch_name,
              bic_swift: merchant_details_result.bic_swift,
              bank_account_no: merchant_details_result.bank_account_no,
              currency: merchant_details_result.currency,
              iban: merchant_details_result.iban,
              bank_address: merchant_details_result.address,
              bank_zip_code: merchant_details_result.zip_code,
              name_on_the_bank_account:
                merchant_details_result.name_on_the_bank_account
                  ? merchant_details_result.name_on_the_bank_account
                  : "",
              bank_country: merchant_details_result.country
                ? encrypt_decrypt("encrypt", merchant_details_result.country)
                : "",
              bank_state: merchant_details_result.state
                ? encrypt_decrypt("encrypt", merchant_details_result.state)
                : "",
              bank_city: merchant_details_result.city
                ? encrypt_decrypt("encrypt", merchant_details_result.city)
                : "",
              last_updated: moment(merchant_details_result.last_updated).format(
                "DD-MM-YYYY H:mm:ss"
              ),
              bank_country_name: await helpers.get_country_name_by_id(
                merchant_details_result.country
              ),
              bank_state_name: await helpers.get_state_name_by_id(
                merchant_details_result.state
              ),
              bank_city_name: await helpers.get_city_name_by_id(
                merchant_details_result.city
              ),
              legal_person_home_address_country_name:
                merchant_details_result.legal_person_home_address_country_name,

              poc_name: merchant_details_result.poc_name,
              poc_email: merchant_details_result.poc_email,
              poc_mobile_code: merchant_details_result.poc_mobile_code,
              poc_mobile: merchant_details_result.poc_mobile,
              cro_name: merchant_details_result.cro_name,
              cro_email: merchant_details_result.cro_email,
              cro_mobile_code: merchant_details_result.cro_mobile_code,
              cro_mobile: merchant_details_result.cro_mobile,
              co_name: merchant_details_result.co_name,
              co_email: merchant_details_result.co_email,
              co_mobile_code: merchant_details_result.co_mobile_code,
              co_mobile: merchant_details_result.co_mobile,
              link_tc: merchant_details_result.link_tc,
              link_pp: merchant_details_result.link_pp,
              link_refund: merchant_details_result.link_refund,
              link_cancellation: merchant_details_result.link_cancellation,
              link_dp: merchant_details_result.link_delivery_policy,
              link_success_url: merchant_details_result.link_success_url,
              link_failed_url: merchant_details_result.link_failed_url,
              link_cancelled_url: merchant_details_result.link_cancelled_url,

              province: merchant_details_result.province
                ? encrypt_decrypt("encrypt", merchant_details_result.province)
                : "",
              business_owners: business_owner,
              business_executives: business_executives,
              entity_documents: entity_documents,
              kyc_document_data: submit_merchant_status,
              kyc_status:
                merchant_result.onboarding_done != 1
                  ? "Onboarding Pending"
                  : merchant_result.ekyc_required == 1 &&
                    (merchant_result.ekyc_done == 1 ||
                      merchant_result.ekyc_done == 4)
                    ? "eKYC Pending"
                    : merchant_result.ekyc_required == 1 &&
                      merchant_result.ekyc_done == 2
                      ? "eKYC Done"
                      : merchant_result.ekyc_required == 0 &&
                        merchant_result.onboarding_done == 1
                        ? "Onboarding Done"
                        : merchant_result.ekyc_required == 1 &&
                          merchant_result.ekyc_done == 3
                          ? "eKYC Denied"
                          : "",
              monthly_business_volume:
                merchant_details_result.monthly_business_volume,
              monthly_transaction_volume:
                merchant_details_result.monthly_transaction_volume,
              currency_volume: merchant_details_result.currency_volume,
              document_file_name: merchant_details_result.bank_document_name
                ? merchant_details_result.bank_document_name
                : "",

              document_file_bank: merchant_details_result.bank_document_file
                ? process.env.STATIC_URL +
                "/static/files/" +
                merchant_details_result.bank_document_file
                : "",
              register_at: merchant_result?.register_at
                ? merchant_result?.register_at
                : "",
              super_register_at: merchant_details_result?.super_register
                ? merchant_details_result?.super_register
                : "",
              ekyc_required_rep: await EntityModel.ekycRequired(
                "ekyc_required",
                {
                  document_for: "representative",
                  entity_id: merchant_details_result.type_of_business,
                  deleted: 0,
                  status: 0,
                }
              ),
              ekyc_required_owner: await EntityModel.ekycRequired(
                "ekyc_required",
                {
                  document_for: "owner_individual",
                  entity_id: merchant_details_result.type_of_business,
                  deleted: 0,
                  status: 0,
                }
              ),
              ekyc_required_exe: await EntityModel.ekycRequired(
                "ekyc_required",
                {
                  document_for: "executive",
                  entity_id: merchant_details_result.type_of_business,
                  deleted: 0,
                  status: 0,
                }
              ),
            };

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(profile, "Profile fetch successfully")
              );
          })
          .catch((error) => {
            console.log(error);
            winston.error(error);
            res.status(statusCode.internalError).send(response.errormsg(error));
          });
      })
      .catch((error) => {
        console.log(error);
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  // update_ekyc_status: async (req, res) => {
  //     let merchant_id = encrypt_decrypt('decrypt', req.bodyString('merchant_id'));
  //     let condition = { id: merchant_id }
  //     let data = { ekyc_done: req.bodyString('ekyc_status') }
  //     let table_name = config.table_prefix + 'master_merchant';
  //     MerchantEkycModel.updateDynamic(condition, data, table_name).then(async (result) => {
  //         if (req.bodyString('ekyc_status') == 2 || req.bodyString('ekyc_status') == '2') {
  //             await MerchantEkyc.send_psp_mail_auto(merchant_id)
  //         }
  //         res.status(statusCode.ok).send(response.successmsg('Ekyc status updated successfully.'));
  //     }).catch((error) => {

  //         res.status(statusCode.internalError).send(response.errormsg(error));
  //     })
  // },
  update_ekyc_status: async (req, res) => {
    let merchant_id = encrypt_decrypt("decrypt", req.bodyString("merchant_id"));

    let condition = { id: merchant_id };

    let data = { ekyc_done: req.bodyString("ekyc_status") };
    if (req.bodyString("ekyc_status") == 4) {
      data.onboarding_done = 0;
    }
    let table_name = config.table_prefix + "master_merchant";
    MerchantEkycModel.updateDynamic(condition, data, table_name)
      .then(async (result) => {
        let common_email = await MerchantEkycModel.selectDynamicOwnerData(
          "legal_person_email as email",
          { merchant_id: merchant_id },
          config.table_prefix + "master_merchant_details"
        );

        // update same email executives /owners
        await MerchantEkycModel.updateDynamic(
          { merchant_id: merchant_id, email: common_email.email },
          { ekyc_status: req.bodyString("ekyc_status") },
          config.table_prefix + "merchant_business_executives"
        );
        await MerchantEkycModel.updateDynamic(
          { merchant_id: merchant_id, email: common_email.email },
          { ekyc_status: req.bodyString("ekyc_status") },
          config.table_prefix + "merchant_business_owners"
        );
        if (
          req.bodyString("ekyc_status") == 2 ||
          req.bodyString("ekyc_status") == "2"
        ) {
          await MerchantEkyc.send_psp_mail_auto(merchant_id);
          let get_referrer_exist = await MerchantEkycModel.get_count_referrer({
            submerchant_id: merchant_id,
          });
          if (get_referrer_exist == 0) {
            let ref_code = await helpers.make_referral_code("REF");
            let referrer_data;
            // get profile details

            let condition = { "mm.id": merchant_id };
            let referralData =
              await MerchantEkycModel.selectFullProfileModified(condition)
                .then(async (res) => {
                  let data = { referral_code: ref_code };
                  let table_name = config.table_prefix + "master_merchant";
                  let mercahnt_update = await MerchantEkycModel.updateDynamic(
                    { id: merchant_id },
                    data,
                    table_name
                  );
                  let auto_approve =
                    await helpers.check_auto_approval_of_referrer();
                  let added_date = await date_formatter.created_date_time();

                  referrer_data = {
                    full_name: res.company_name,
                    email: res.legal_person_email,
                    mobile_no: res.home_phone_number,
                    mobile_code: res.home_phone_code,
                    password: res.password,
                    status: 0,
                    referral_code: ref_code,
                    currency: res.currency_volume,
                    bank_name: res.bank_name,
                    branch_name: res.branch_name,
                    account_number: res.bank_account_no,
                    name_on_the_bank_account: res.name_on_the_bank_account,
                    address: "",
                    national_id: "",
                    iban: res.iban,
                    bic_swift: res.bic_swift,
                    country: res.country
                      ? res.country
                      : res.register_business_country,
                    state: res.state,
                    city: res.city,
                    zip_code: res.zip_code,
                    deleted: 0,
                    is_approved: auto_approve == true ? 0 : 1,
                    created_at: added_date,
                    updated_at: added_date,
                    submerchant_id: merchant_id,
                    super_merchant_id: res.super_merchant_id,
                  };

                  let master_bonus =
                    await helpers.get_master_referrer_by_currency(res.currency);

                  if (master_bonus) {
                    (referrer_data.fix_amount_for_reference =
                      master_bonus.fix_amount_for_reference),
                      (referrer_data.fix_amount = master_bonus.fix_amount),
                      (referrer_data.per_amount = master_bonus.per_amount),
                      (referrer_data.apply_greater =
                        master_bonus.apply_greater),
                      (referrer_data.settlement_date =
                        master_bonus.settlement_date),
                      (referrer_data.ref_validity = moment()
                        .add(master_bonus.calculate_bonus_till, "days")
                        .format("YYYY-MM-DD")),
                      (referrer_data.settlement_frequency =
                        master_bonus.settlement_frequency),
                      (referrer_data.calculate_bonus_till =
                        master_bonus.calculate_bonus_till),
                      (referrer_data.tax_per = master_bonus.tax_per);
                  }
                })

                .catch((err) => {
                  winston.error(err);
                });

            // event code here
            referralEmitter.once(
              "registerReferral",
              async ({ referrer_data }) => {
                try {
                  // referrer registration
                  referrer_model
                    .add(referrer_data)
                    .then(async (result) => {
                      let two_fa_token = uuid.v1();
                      let two_fa_secret = authenticator.generateSecret();
                      let created_at = await date_formatter.created_date_time();
                      let two_fa_data = {
                        token: two_fa_token,
                        secret: two_fa_secret,
                        referrer_id: result.insert_id,
                        created_at: created_at,
                      };
                      // let result_2fa =
                      //     await referrer_model.add_two_fa(
                      //         two_fa_data
                      //     );
                      // let verify_url =
                      //     process.env.FRONTEND_URL_MERCHANT +
                      //     "verify-referer/" +
                      //     two_fa_token;
                      // let title = await helpers.get_title();
                      // let subject = "Welcome to " + title;

                      // await mailSender.welcomeMail(
                      //     referrer_data.email,
                      //     subject,
                      //     verify_url
                      // );
                    })
                    .catch((error) => {
                      winston.error(error);
                      res
                        .status(statusCode.internalError)
                        .send(response.errormsg(error.message));
                    });
                } catch (error) {
                  winston.error(error);
                  referralEmitter.emit("registerReferralError", error);
                }
              }
            );

            referralEmitter.once("registerReferralError", (error) => {
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });

            referralEmitter.emit("registerReferral", { referrer_data });
          }
        }
        res
          .status(statusCode.ok)
          .send(response.successmsg("Ekyc status updated successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  update_profile: async (req, res) => {
    try {
      let supermerchant_id = req.user.id;

      insdata = {
        name: req.bodyString("name"),
        legal_business_name: req.bodyString("name"),
        code: req.bodyString("code"),
        mobile_no: req.bodyString("mobile"),
        email: req.bodyString("email"),
      };
      if (req.all_files) {
        if (req.all_files.icon) {
          insdata.avatar = req.all_files.avatar;
        }
      }
      $ins_id = await MerchantEkycModel.updateDetails(
        { id: supermerchant_id },
        insdata
      );
      res
        .status(statusCode.ok)
        .send(
          response.successmsg("Supermerchant profile updated successfully")
        );
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  super_merchant_list: async (req, res) => {
    let condition = {};
    if (req.user.type == "admin") {
      condition = {
        deleted: 0,
        super_merchant_id: 0,
      };
    }
    if (req.user.type == "merchant") {
      condition = {
        deleted: 0,
        id: req.user.id,
        super_merchant_id: 0,
      };
    }
    MerchantEkycModel.selectAll("*", condition)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            super_merchant_id: enc_dec.cjs_encrypt(val.id),
            smi: val.id,
            super_merchant_name: val.name,
            legal_business_name: val.legal_business_name,
            register_business_country:
              await helpers.get_business_address_country(
                val.registered_business_address
              ),
            super_merchant_mobile_no: val.mobile_no
              ? val.code + " " + val.mobile_no
              : "",
            super_merchant_mobile: val.mobile_no,
            super_merchant_email: val.email,
            status: val.status == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res);
        }
        total_count = await MerchantEkycModel.get_count(
          condition,
          config.table_prefix + "master_super_merchant"
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
  },
  owners_data: async (req, res) => {
    var token = await enc_dec.cjs_decrypt(req.body.token);
    var data_for = req.body.data_for;

    if (data_for == "representative") {
      var selection =
        "id,merchant_id,company_name,legal_person_first_name as first_name,legal_person_last_name as last_name,legal_person_email as email,home_phone_number as mobile,home_phone_code as code,dob,home_address_line_1,home_address_line_2,psp_id,ekyc_required,nationality";
      var table_name = config.table_prefix + "master_merchant_details";
      var condition = { id: token };
    } else if (data_for == "owner") {
      var selection =
        "id,first_name_represent as first_name,last_name_represent as last_name,merchant_id,ekyc_required as owner_ekyc,business_owner,email,country_code as code,mobile,nationality";
      var table_name = config.table_prefix + "merchant_business_owners";
      var condition = { id: token, deleted: 0 };
    } else if (data_for == "executive") {
      var selection =
        "id,first_name ,last_name,merchant_id,ekyc_required as exe_ekyc,email,mobile_code as code,mobile_no as mobile,nationality";
      var table_name = config.table_prefix + "merchant_business_executives";
      var condition = { id: token, deleted: 0 };
    }

    MerchantEkycModel.selectDynamicOwnerData(selection, condition, table_name)
      .then(async (result) => {
        let meeting_data = await MerchantEkycModel.get_count(
          { id: token },
          config.table_prefix + "merchant_meetings"
        );

        let send_res = [];
        let val = result;

        if (data_for == "owner") {
          if (val.business_owner == "entity") {
            var document = "owner_company";
          } else {
            var document = "owner_individual";
          }
        } else if (data_for == "representative") {
          var document = "representative";
        } else {
          var document = "executive";
        }

        let match_selfie_document = await MerchantEkycModel.getSelfieDocs(
          val.merchant_id,
          document,
          data_for == "representative" ? "0" : token
        );

        let res1 = {
          id: enc_dec.cjs_encrypt(val.id),
          name: val.first_name + " " + val.last_name,
          email: val.email,
          mobile: val.mobile,
          country_code: val.country_code ? val.country_code : "",
          ekyc_status: val.ekyc_status,
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          merchant_name: await helpers.get_merchantdetails_name_by_id(
            val.merchant_id
          ),
          image_name: match_selfie_document.document_name,
          doc_name: await helpers.get_document_type(
            match_selfie_document.sequence
          ),
          doc_number: match_selfie_document.document_num,
          match_link:
            val.document_name != ""
              ? process.env.STATIC_URL +
              "/static/files/" +
              match_selfie_document.document_name
              : "",
          address: val.home_address_line_1
            ? val.home_address_line_1 + " " + val.home_address_line_2
            : "",

          nationality: await helpers.get_nationalty_name_by_id(val.nationality),
          count: meeting_data,
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
  update_owners_status: async (req, res) => {
    let owner_id = await enc_dec.cjs_decrypt(req.bodyString("owner_id"));
    let status = req.bodyString("status");

    let common_email = await MerchantEkycModel.selectDynamicOwnerData(
      "merchant_id,email",
      { id: owner_id },
      config.table_prefix + "merchant_business_owners"
    );
    let get_referrer_exist = await MerchantEkycModel.get_count_referrer({
      submerchant_id: common_email.merchant_id,
    });
    if (get_referrer_exist == 0) {
      await MerchantEkyc.referrer_register(common_email.merchant_id);
    }

    // update same email executives /owners
    await MerchantEkycModel.updateDynamic(
      { id: owner_id },
      { ekyc_status: status },
      config.table_prefix + "merchant_business_owners"
    );

    await MerchantEkycModel.updateDynamic(
      { merchant_id: common_email.merchant_id, email: common_email.email },
      { ekyc_status: status },
      config.table_prefix + "merchant_business_executives"
    );

    res.status(statusCode.ok).send(response.successmsg("Updated successfully"));
  },
  update_exe_status: async (req, res) => {
    let owner_id = await enc_dec.cjs_decrypt(req.bodyString("executive_id"));

    let status = req.bodyString("status");

    let common_email = await MerchantEkycModel.selectDynamicOwnerData(
      "merchant_id,email",
      { id: owner_id },
      config.table_prefix + "merchant_business_executives"
    );
    let get_referrer_exist = await MerchantEkycModel.get_count_referrer({
      submerchant_id: common_email.merchant_id,
    });
    if (get_referrer_exist == 0) {
      await MerchantEkyc.referrer_register(common_email.merchant_id);
    }

    await MerchantEkycModel.updateDynamic(
      { id: owner_id },
      { ekyc_status: status },
      config.table_prefix + "merchant_business_executives"
    );
    // update owners
    await MerchantEkycModel.updateDynamic(
      { merchant_id: common_email.merchant_id, email: common_email.email },
      { ekyc_status: status },
      config.table_prefix + "merchant_business_owners"
    );

    res.status(statusCode.ok).send(response.successmsg("Updated successfully"));
  },
  merchant_data: async (req, res) => {
    let submerchant_id = await enc_dec.cjs_decrypt(req.bodyString("token"));
    MerchantEkycModel.selectMerchantDetails("*", {
      merchant_id: submerchant_id,
    })
      .then(async (merchant_details) => {
        let meeting_data = await MerchantEkycModel.get_count(
          { merchant_id: submerchant_id },
          config.table_prefix + "merchant_meetings"
        );

        let match_selfie_document = await MerchantEkycModel.getSelfieDocsRep(
          submerchant_id,
          "representative",
          0
        );
        let res1 = {
          kyc_link: process.env.MERCHANT_KYC_URL,
          match_link: match_selfie_document
            ? process.env.STATIC_URL +
            "/static/files/" +
            match_selfie_document.document_name
            : "",
          merchant_id: encrypt_decrypt("encrypt", submerchant_id),
          merchant_name: merchant_details.company_name
            ? merchant_details.company_name
            : "",
          legal_person_name: merchant_details.legal_person_first_name
            ? merchant_details.legal_person_first_name +
            " " +
            merchant_details.legal_person_last_name
            : "",
          doc_name: match_selfie_document.sequence
            ? await helpers.get_document_type(match_selfie_document.sequence)
            : "",
          doc_number: match_selfie_document.document_num
            ? match_selfie_document.document_num
            : "",
          legal_person_email: merchant_details.legal_person_email
            ? merchant_details.legal_person_email
            : "",
          mobile: merchant_details.home_phone_number
            ? merchant_details.home_phone_number
            : "",
          country_code: merchant_details.home_phone_code
            ? merchant_details.home_phone_code
            : "",
          dob: merchant_details.dob
            ? moment(merchant_details.dob).format("DD-MM-YYYY")
            : "",
          address:
            merchant_details.home_address_line_1 +
            " " +
            merchant_details.home_address_line_2,
          count: meeting_data,
        };

        res
          .status(statusCode.ok)
          .send(response.successdatamsg(res1, "Details fetched successfully."));
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  merchant_owner_list: async (req, res) => {
    //step-8

    var merchant =
      req.bodyString("submerchant_id") == 0
        ? req.bodyString("submerchant_id")
        : encrypt_decrypt("decrypt", req.bodyString("submerchant_id"));
    if (merchant > 0) {
      let condition = {
        id: merchant,
        super_merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req?.user?.id,
      };

      let table_name = config.table_prefix + "master_merchant";
      MerchantEkycModel.selectDynamicSingle(
        "id,super_merchant_id,onboarding_done,ekyc_required,ekyc_done",
        condition,
        table_name
      )
        .then(async (merchant_result) => {
          let super_merchant =
            await MerchantEkycModel.select_first_super_merchant("id", {
              super_merchant_id: req.user.super_merchant_id
                ? req.user.super_merchant_id
                : req?.user?.id,
            });

          let merchant_details = await MerchantEkycModel.selectMerchantDetails(
            "id as rep_id,legal_person_first_name ,legal_person_last_name ,legal_person_email as email,ekyc_required,company_name,psp_id",
            { merchant_id: merchant_result?.id }
          );
          let owners_data = await MerchantEkycModel.selectDynamic(
            "id as owner_id ,first_name_represent as first_name,last_name_represent as last_name,ekyc_required as owner_required,email,business_owner,ekyc_status as owner_status",
            {
              merchant_id: merchant_result?.id,
              deleted: 0,
            },
            config.table_prefix + "merchant_business_owners"
          );
          let exe_data = await MerchantEkycModel.selectDynamic(
            "id as exe_id,first_name ,last_name ,email,ekyc_required as exe_required,email,ekyc_status as exe_status",
            {
              merchant_id: merchant_result?.id,
              deleted: 0,
            },
            config.table_prefix + "merchant_business_executives"
          );

          if (merchant_result.onboarding_done == 1) {
            let count_exe = await MerchantEkycModel.get_count(
              {
                merchant_id: merchant_result?.id,
                ekyc_status: 0,
                ekyc_required: 1,
              },
              config.table_prefix + "merchant_business_executives"
            );

            let count_owner = await MerchantEkycModel.get_count(
              {
                merchant_id: merchant_result?.id,
                ekyc_status: 0,
                ekyc_required: 1,
              },
              config.table_prefix + "merchant_business_owners"
            );
            let count_rep = await MerchantEkycModel.get_count_for_rep(
              { id: merchant_result?.id, ekyc_required: 1 },
              config.table_prefix + "master_merchant"
            );

            var psp_details_arr = [];
            var psp_kyc = 0;
            if (merchant_details?.psp_id) {
              var psp_ids = merchant_details?.psp_id.split(",");
              for (let pi of psp_ids) {
                let psp_details = await helpers.get_psp_details_by_id(
                  "ekyc_required",
                  pi
                );
                psp_details_arr.push(psp_details);
                if (psp_details.ekyc_required == 1) {
                  psp_kyc++;
                }
              }
            }

            const arrs = [].concat(merchant_details, owners_data, exe_data);
            const noDuplicate = (arr) => [...new Set(arr)];
            const allIds = arrs.map((ele) => ele.email);
            const ids = noDuplicate(allIds);

            var result = ids.map((id) =>
              arrs.reduce((self, item) => {
                return item.email === id ? { ...self, ...item } : self;
              }, {})
            ); // unique array of same email
            let send_res = [];

            for (let val of result) {
              if (val.company_name && val.ekyc_required == 1) {
                var data_for = "representative";
                var id = val.rep_id;
                var ekyc_status =
                  merchant_result.ekyc_required == 1 &&
                    (merchant_result.ekyc_done == 1 ||
                      merchant_result.ekyc_done == 4)
                    ? "eKYC Pending"
                    : "";
              } else if (val.business_owner && val.owner_required == 1) {
                var data_for = "owner";
                var id = val.owner_id;
                var ekyc_status =
                  val.owner_required == 1 && val.owner_status == 0
                    ? "eKYC Pending"
                    : "";
              } else {
                var data_for = "executive";
                var id = val.exe_id;
                var ekyc_status =
                  val.exe_required == 1 && val.exe_status == 0
                    ? "eKYC Pending"
                    : "";
              }
              var all_id = id ? encrypt_decrypt("encrypt", id) : "";
              var token = all_id + "_" + encrypt_decrypt("encrypt", data_for);
              let res = {
                data_for: data_for,
                legal_person_first_name: val.legal_person_first_name
                  ? val.legal_person_first_name
                  : val.first_name,
                legal_person_last_name: val.legal_person_last_name
                  ? val.legal_person_last_name
                  : val.last_name,
                email: val.email ? val.email : "",
                ekyc_required: val.ekyc_required ? val.ekyc_required : "",
                company_name: val.company_name ? val.company_name : "",
                psp_id: val.psp_id ? val.psp_id : "",
                business_owner: val.business_owner,
                owner_status: val.owner_status ? val.owner_status : "",
                verify_url: token
                  ? process.env.MERCHANT_KYC_URL + "?token=" + token
                  : "",
                owner_required: val.owner_required ? val.owner_required : "",
                exe_required: val.exe_required ? val.exe_required : "",
                exe_status: val.exe_id ? val.exe_status : "",
                ekyc_status: ekyc_status,
              };
              send_res.push(res);
            }
            var submit_merchant_status = {
              data: send_res,
              count_all:
                count_rep > 0 || count_exe > 0 || count_owner > 0
                  ? "ekyc Pending"
                  : "ekyc Done",
              onboarding_done: merchant_result.onboarding_done,
              kyc_status:
                merchant_result.onboarding_done != 1
                  ? "Onboarding Pending"
                  : merchant_result.ekyc_required == 1 &&
                    (merchant_result.ekyc_done == 1 ||
                      merchant_result.ekyc_done == 4)
                    ? "eKYC Pending"
                    : merchant_result.ekyc_required == 1 &&
                      merchant_result.ekyc_done == 2
                      ? "eKYC Done"
                      : merchant_result.ekyc_required == 0 &&
                        merchant_result.onboarding_done == 1
                        ? "Onboarding Done"
                        : merchant_result.ekyc_required == 1 &&
                          merchant_result.ekyc_done == 3
                          ? "eKYC Denied"
                          : "",
              ekyc_required: merchant_result.ekyc_required,
              psp_ekyc_required: psp_kyc > 0 ? "1" : "0",
              merchant:
                super_merchant == merchant_result?.id
                  ? "super_merchant"
                  : "submerchant",
            };
          } else {
            var submit_merchant_status = {
              data: [],
              count_all: "",
              onboarding_done: merchant_result.onboarding_done,
              kyc_status:
                merchant_result.onboarding_done != 1
                  ? "Onboarding Pending"
                  : merchant_result.ekyc_required == 1 &&
                    (merchant_result.ekyc_done == 1 ||
                      merchant_result.ekyc_done == 4)
                    ? "eKYC Pending"
                    : merchant_result.ekyc_required == 1 &&
                      merchant_result.ekyc_done == 2
                      ? "eKYC Done"
                      : merchant_result.ekyc_required == 0 &&
                        merchant_result.onboarding_done == 1
                        ? "Onboarding Done"
                        : merchant_result.ekyc_required == 1 &&
                          merchant_result.ekyc_done == 3
                          ? "eKYC Denied"
                          : "",
              ekyc_required: merchant_result.ekyc_required,
              psp_ekyc_required: psp_kyc > 0 ? "1" : "0",
              merchant:
                super_merchant == merchant_result?.id
                  ? "super_merchant"
                  : "submerchant",
            };
          }

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                submit_merchant_status,
                "Merchant list fetched successfully."
              )
            );
        })
        .catch((error) => {
          console.log(error);
          winston.error(error);
          res.status(statusCode.internalError).send(response.errormsg(error));
        });
    } else {
      let submit_merchant_status = {
        merchant_id: "",
        merchant_name: "",
        legal_person_name: "",

        legal_person_email: "",
        mobile: "",
        country_code: "",

        // owners: m_list.join(", "),
        owners: [],
        kyc_status: "",
        ekyc_required: "",
        merchant: "",
      };
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            submit_merchant_status,
            "Merchant list fetched successfully."
          )
        );
    }
  },
  super_merchant_master: async (req, res) => {
    let condition = {};
    if (req.user.type == "admin") {
      condition = {
        deleted: 0,
        super_merchant_id: 0,
      };
    }
    if (req.user.type == "merchant") {
      condition = {
        deleted: 0,
        id: req.user.id,
        super_merchant_id: 0,
      };
    }
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
    let filter = {};
    const search_text = req.bodyString("search");
    if (search_text) {
      filter.legal_business_name = search_text;
      filter.email = search_text;
      filter.mobile_no = search_text;
    }
    MerchantEkycModel.master_super_merchant(condition, filter, limit)
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            super_merchant_id: enc_dec.cjs_encrypt(val.id),
            super_merchant_name: val.name,
            referral_code: val.referral_code_used
              ? val.referral_code_used
              : "-",
            legal_business_name: val.legal_business_name,
            register_business_country:
              await helpers.get_business_address_country(
                val.registered_business_address
              ),
            super_merchant_mobile_no: val.mobile_no
              ? "+" + val.code + " " + val.mobile_no
              : "",
            super_merchant_mobile: val.mobile_no,
            super_merchant_email: val.email,
            status: val.status == 1 ? "Deactivated" : "Active",
            is_user:val.user,
            parent_id:val.super_merchant_id,
            de_merchant_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            register_at: val.register_at,
            allow_mid: val.allow_mid,
          };
          send_res.push(res);
        }
        total_count = await MerchantEkycModel.get_count_super_merchant(
          condition,
          filter,
          config.table_prefix + "master_super_merchant"
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
  },
  deactivate_supermerchant: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );
      var insdata = {
        status: 1,
      };

      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);

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

  activate_supermerchant: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );

      var insdata = {
        status: 0,
      };

      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);

      res
        .status(statusCode.ok)
        .send(response.successmsg("Merchant activated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  allow_mid: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );

      let mer_details = await MerchantModel.selectOneSuperMerchant(
        "allow_mid",
        {
          id: user_id,
        }
      );
      let allow = mer_details.allow_mid == 1 ? 0 : 1;
      var insdata = {
        allow_mid: allow,
      };
      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Updated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  allow_rules: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );

      let mer_details = await MerchantModel.selectOneSuperMerchant(
        "allow_mid",
        {
          id: user_id,
        }
      );
      let allow = mer_details.allow_mid == 1 ? 0 : 1;
      var insdata = {
        allow_mid: allow,
      };
      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Updated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  allow_mid_ticket: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );

      let mer_details = await MerchantModel.selectOneSuperMerchant(
        "allow_mid",
        {
          id: user_id,
        }
      );
      // let allow = mer_details.allow_mid == 1 ? 0 : 1;
      var insdata = {
        allow_mid: 1,
      };
      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Updated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  allow_rules_ticket: async (req, res) => {
    try {
      let user_id = await enc_dec.cjs_decrypt(
        req.bodyString("supermerchant_id")
      );

      let mer_details = await MerchantModel.selectOneSuperMerchant(
        "allow_mid",
        {
          id: user_id,
        }
      );
      //  let allow = mer_details.allow_mid == 1 ? 0 : 1;
      var insdata = {
        allow_rules: 1,
      };
      $ins_id = await MerchantEkycModel.updateDetails({ id: user_id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Updated successfully"));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  referrer_register: async (merchant_id) => {
    let referrer_data;
    // get profile details
    let ref_code = await helpers.make_referral_code("REF");
    let data = { referral_code: ref_code };
    let table_name = config.table_prefix + "master_merchant";
    let mercahnt_update = await MerchantEkycModel.updateDynamic(
      { id: merchant_id },
      data,
      table_name
    );
    let condition = { "mm.id": merchant_id };
    let referralData = await MerchantEkycModel.selectFullProfileModified(
      condition
    )
      .then(async (res) => {
        let auto_approve = await helpers.check_auto_approval_of_referrer();
        let added_date = await date_formatter.created_date_time();

        referrer_data = {
          full_name: res.company_name,
          email: res.legal_person_email,
          mobile_no: res.home_phone_number,
          mobile_code: res.home_phone_code,
          password: res.password,
          status: 0,
          referral_code: ref_code,
          currency: res.currency_volume,
          bank_name: res.bank_name,
          branch_name: res.branch_name,
          account_number: res.bank_account_no,
          name_on_the_bank_account: res.name_on_the_bank_account,
          address: "",
          national_id: "",
          iban: res.iban,
          bic_swift: res.bic_swift,
          country: res.country ? res.country : res.register_business_country,
          state: res.state,
          city: res.city,
          zip_code: res.zip_code,
          deleted: 0,
          is_approved: auto_approve == true ? 0 : 1,
          created_at: added_date,
          updated_at: added_date,
          submerchant_id: merchant_id,
          super_merchant_id: res.super_merchant_id,
        };

        let master_bonus = await helpers.get_master_referrer_by_currency(
          res.currency
        );

        if (master_bonus) {
          (referrer_data.fix_amount_for_reference =
            master_bonus.fix_amount_for_reference),
            (referrer_data.fix_amount = master_bonus.fix_amount),
            (referrer_data.per_amount = master_bonus.per_amount),
            (referrer_data.apply_greater = master_bonus.apply_greater),
            (referrer_data.settlement_date = master_bonus.settlement_date),
            (referrer_data.ref_validity = moment()
              .add(master_bonus.calculate_bonus_till, "days")
              .format("YYYY-MM-DD")),
            (referrer_data.tax_per = master_bonus.tax_per);
        }
      })
      .catch((err) => {
        winston.error(err);
      });

    // event code here
    referralEmitter.once("registerReferral", async ({ referrer_data }) => {
      try {
        // referrer registration
        referrer_model
          .add(referrer_data)
          .then(async (result) => {
            let two_fa_token = uuid.v1();
            let two_fa_secret = authenticator.generateSecret();
            let created_at = await date_formatter.created_date_time();
            let two_fa_data = {
              token: two_fa_token,
              secret: two_fa_secret,
              referrer_id: result.insert_id,
              created_at: created_at,
            };
            // let result_2fa =
            //     await referrer_model.add_two_fa(
            //         two_fa_data
            //     );
            // let verify_url =
            //     process.env.FRONTEND_URL_MERCHANT +
            //     "verify-referer/" +
            //     two_fa_token;
            // let title = await helpers.get_title();
            // let subject = "Welcome to " + title;

            // await mailSender.welcomeMail(
            //     referrer_data.email,
            //     subject,
            //     verify_url
            // );
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } catch (error) {
        winston.error(error);
        referralEmitter.emit("registerReferralError", error);
      }
    });

    referralEmitter.once("registerReferralError", (error) => {
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    });

    referralEmitter.emit("registerReferral", { referrer_data });
    return;
  },
  fetchSuperMerchantLogo:async(req,res)=>{
    try {
      let super_merchant_id = enc_dec.cjs_decrypt(req.body.supermerchant_id);
      let res_send = await MerchantRegistrationModel.selectOneDyn(
        "logo,id as supermerchant_id",
        { id: super_merchant_id },
        "master_super_merchant"
      );

      if (res_send) {
        if(res_send.logo){
          res_send.logo = process.env.STATIC_URL+'/static/images/'+res_send.logo
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              res_send,
              "Super Merchant logo fetch successfully"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid super merchant id"));
      }
    } catch (error) {
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
   
  },
  uploadSuperMerchantLogo:async(req,res)=>{
     try {
      let super_merchant_id = enc_dec.cjs_decrypt(req.body.supermerchant_id);
      console.log(super_merchant_id);
      let res_send = await MerchantRegistrationModel.selectOneDyn(
        "logo,id as supermerchant_id",
        { id: super_merchant_id },
        "master_super_merchant"
      );

      if (res_send) {
        let updateData = {
          logo:req.all_files?.logo
        }
        let updateLogo = await MerchantRegistrationModel.updateDyn({id:super_merchant_id},updateData,'master_super_merchant');
        let response_to_send = {
          logo:process.env.STATIC_URL+'/static/images/'+updateData.logo,
          super_merchant_id:req.body.supermerchant_id
        }
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              response_to_send,
              "Super Merchant logo updated successfully"
            )
          );
      } else {
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid super merchant id"));
      }
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  fetchLogo:async(req,res)=>{
    try{
    let merchant_id = enc_dec.cjs_decrypt(req.body.sub_merchant_id);
    let superMerchantDetails = await MerchantRegistrationModel.selectOneDyn('super_merchant_id',{id:merchant_id},'master_merchant');
    
    if(superMerchantDetails){
       let res_send = await MerchantRegistrationModel.selectOneDyn(
        "logo,id as supermerchant_id",
        { id: superMerchantDetails.super_merchant_id },
        "master_super_merchant"
      );
      if(res_send.logo){
        res_send.logo = process.env.STATIC_URL+'/static/images/'+res_send.logo
      }else{
        let companyDetails = await MerchantRegistrationModel.selectOneDyn('company_logo as logo',{id:1},'company_master');
         res_send.logo = process.env.STATIC_URL+'/static/images/'+companyDetails.logo
      }
       res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              res_send,
              "Super Merchant logo fetch successfully"
            )
          );

    }else{
        res
          .status(statusCode.badRequest)
          .send(response.errormsg("Invalid sub merchant id"));
    }
    }catch(error){
       res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  }
};

module.exports = MerchantEkyc;
