const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const path = require("path");
const userModel = require("../models/adm_user");
const partnerModel = require("../models/partner");
const settingModel = require("../models/settingModel");
const merchantModel = require("../models/merchantmodel");
const languageModel = require("../models/language");
const referrer_model = require("../models/referrer_model");
const fontModel = require("../models/fonts");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const { encrypt } = require("crypto-js/aes");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const moment = require("moment");
require("dotenv").config({ path: "../.env" });
const logger = require("../config/logger");
const nodeCache = require("../utilities/helper/CacheManeger");
const { banner_add } = require("../utilities/validations");

var Setting = {
  change_language: async (req, res) => {
    try {
      let language_id = await enc_dec.cjs_decrypt(
        req.bodyString("language_id")
      );
      console.log("🚀 ~ change_language: ~ language_id:", language_id);
      var insdata = {
        language: language_id,
      };

      if (req.user.type == "merchant") {
        $ins_id = await merchantModel.updateDetails(
          { id: req.user.id },
          insdata
        );
      } else if (req.user.type == "partner") {
        $ins_id = await partnerModel.updateDetails(
          { id: req.user.id },
          insdata
        );
      } else if (req.user.type == "referrer") {
        $ins_id = await referrer_model.updateDetails(
          { id: req.user.id },
          insdata
        );
      } else {
        $ins_id = await userModel.updateDetails({ id: req.user.id }, insdata);
      }

      res
        .status(statusCode.ok)
        .send(response.successmsg("Language changed successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  change_theme: async (req, res) => {
    try {
      let theme = req.bodyString("theme");
      var insdata = {
        theme: theme,
      };
      if (req.user.type == "merchant") {
        $ins_id = await merchantModel.SupermerchantupdateDetails(
          { id: req.user.id },
          insdata
        );
      } else if (req.user.type == "partner") {
        $ins_id = await partnerModel.updateDetails(
          { id: req.user.id },
          insdata
        );
      } else if (req.user.type == "referrer") {
        $ins_id = await referrer_model.updateDetails(
          { id: req.user.id },
          insdata
        );
      } else {
        $ins_id = await userModel.updateDetails({ id: req.user.id }, insdata);
      }

      res
        .status(statusCode.ok)
        .send(response.successmsg("Theme changed successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  header_info: async (req, res) => {
    try {
      let image_path = process.env.STATIC_URL + "/static/images/";
      let file_path = process.env.STATIC_URL + "/static/language/";
      let user_details;
      let mer_details;
      let mer_list;
      let supermerchant_live = "";
      if (req.user.type == "merchant") {
        user_details = await merchantModel.selectOneSuperMerchant("*", {
          id: req.user.id,
        });
        mer_details = await merchantModel.main_merchant_details({
          "mm.super_merchant_id": req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
        });

        supermerchant_live = await merchantModel.selectOneSuperMerchant(
          "live,allow_mid,super_merchant_id,name,stores,selected_submerchant,user",
          {
            id: supermerchant_live.user==0 ? req.user.id :user_details.super_merchant_id
              // user_details.super_merchant_id > 0
              //   ? req.user.super_merchant_id
              //   : req.user.id,
          }
        );
        const today = moment();
        if (supermerchant_live.user == 0) {
          mer_list = await merchantModel.sub_merchant_list({
            "mm.super_merchant_id":
              user_details.super_merchant_id > 0
                ? req.user.super_merchant_id
                : req.user.id,
            "mm.status": 0,
            "mm.deleted": 0,
            // "sm.super_merchant_id":0
          });
        } else {
          mer_list = [
            {
              id: supermerchant_live.selected_submerchant,
              company_name: supermerchant_live.name,
              super_merchant_id:
                user_details.super_merchant_id > 0
                  ? req.user.super_merchant_id
                  : req.user.id,
              live: supermerchant_live.live,
            },
          ];
        }
        mer_meeting_list = await merchantModel.selectMeeting(
          {
            super_merchant_id:
              user_details.super_merchant_id > 0
                ? req.user.super_merchant_id
                : req.user.id,
            is_seen: 0,
            status: 0,
            deleted: 0,
          },
          today.format("YYYY-MM-DD HH:mm:ss")
        );
        meeting_count = await merchantModel.get_count_meetings({
          super_merchant_id:
            user_details.super_merchant_id > 0
              ? req.user.super_merchant_id
              : req.user.id,
          is_seen: 0,
        });
        var m_list = [];
        var meeting_list = [];
        let i = 0;
        let j = 0;
        for (let list_ of mer_list) {
          m_list[i] = {
            submerchant_id: await enc_dec.cjs_encrypt(list_.id),
            legal_business_name: list_.company_name
              ? list_.company_name
              : list_.legal_business_name,
            super_id: await enc_dec.cjs_encrypt(list_.super_merchant_id),
            live: list_.live,
          };
          i++;
        }
        for (let meet_list_ of mer_meeting_list) {
          meeting_list[j] = {
            legal_business: await helpers.get_submerchant_name_by_id(
              meet_list_.merchant_id
            ),
            merchant_name: meet_list_.name,
            room_id: meet_list_.room_id,
            meeting_url: meet_list_.meeting_url,
            time_zone: meet_list_.time_zone,
            owner_id: meet_list_.owner_id
              ? enc_dec.cjs_encrypt(meet_list_.owner_id)
              : "",
            meeting_id: enc_dec.cjs_encrypt(meet_list_.id),
            timing:
              moment(meet_list_.start_time).format("DD-MM-YYYY") +
              " " +
              moment(meet_list_.start_time).format("HH:mm") +
              " - " +
              moment(meet_list_.end_time).format("HH:mm") +
              " (" +
              meet_list_.time_zone +
              ")",
          };
          j++;
        }
      } else if (req.user.type == "admin") {
        user_details = await userModel.selectOne(
          "name,role,language,theme,avatar,designation,support_ticket_password,username",
          { id: req.user.id }
        );
      } else {
        user_details = await referrer_model.selectOne("*", { id: req.user.id });
      }
      let company_details = await helpers.company_details({ id: 1 });
      let title = await helpers.get_title();

      // let lang_id = 1;
      // if (user_details.language) {
      //   lang_id = user_details.language;
      // }
      // let language = await helpers.get_language_json({ id: lang_id });

      // let language = await nodeCache.get_first_active_language_json(
      //   user_details.language
      // );

      //--------------------------------------------------------------------

      let language = await nodeCache.getActiveLanguageById(
        user_details.language
      );

      //--------------------------------------------------------------------

      let language_list = [];
      let get_language_list = await nodeCache.getAllLanguageList();
      let i = 0;
      for (let list of get_language_list) {
        language_list[i] = {
          flag: file_path + list.flag,
          file: file_path + list.file,
          language_id: list.language_id,
          language: list.name,
          direction: list.direction,
        };
        i++;
      }

      //--------------------------------------------------------------------

      var data = {
        theme: user_details.theme,
        language: language,
        company: {
          fav_icon: image_path + company_details.fav_icon,
          logo: image_path + company_details.company_logo,
          letter_head: image_path + company_details.letter_head,
          footer_banner: image_path + company_details.footer_banner,
          logout_time: company_details.default_logout_time,
          batch_size: company_details.batch_size,
          title: title,
        },
      };
      let avatar = "";

      if (req.user.type == "merchant") {
        let encriptedStoreID = enc_dec.cjs_encrypt(mer_details.id);
        let isHaveAccessToSuperStore = await helpers.haveAccesstoSuperStore(
          encriptedStoreID,
          req.user.id
        );
        let isLiveMode = await helpers.checkMerchantLiveModeStatus(req.user);
        let allowMid = user_details.allow_mid;
        if (user_details.super_merchant_id > 0) {
          allowMid = await helpers.checkAllowMidOnSuperMerchant(
            user_details.super_merchant_id
          );
        }
        console.log(`user details`);
        console.log(user_details);
        data.user_detail = {
          is_user: supermerchant_live.user,
          immediateSubmerchant: enc_dec.cjs_encrypt(mer_details.id),
          isHaveAccessToSuperStore: isHaveAccessToSuperStore,
          name: user_details.name
            ? user_details.name
            : mer_details.company_name
              ? mer_details.company_name
              : user_details.legal_business_name,
          roles: user_details.role,
          avatar: image_path + "default.jpg",
          mode:
            user_details.super_merchant_id == 0
              ? mer_details.mode
              : await helpers.main_super_merchant_mode({
                super_merchant_id: req.user.super_merchant_id,
              }),
          live: supermerchant_live.live,
          isLiveMode: isLiveMode,
          allow_mid: allowMid,
          allow_rules: user_details.allow_rules,
          supermerchant_id: enc_dec.cjs_encrypt(req?.user?.id),
          allow_payment_amount:
            user_details.super_merchant_id > 0
              ? user_details.payment_link_amount
              : "",
          theme: user_details.theme,
          selected_submerchant:
            user_details.selected_submerchant != 0
              ? enc_dec.cjs_encrypt(user_details.selected_submerchant)
              : 0,
          list: m_list,
          stores_access:
            user_details.stores == "" ? "All" : user_details.stores,
          submerchant_name:
            user_details.selected_submerchant != 0
              ? (await helpers.get_submerchant_name_by_id(
                user_details.selected_submerchant
              ))
                ? await helpers.get_submerchant_name_by_id(
                  user_details.selected_submerchant
                )
                : user_details.legal_business_name
              : "All",
          user: user_details.super_merchant_id > 0 ? "user" : "super_merchant",
          meeting_list: meeting_list,
          meeting_count: meeting_count,
        };
      } else if (req.user.type == "admin") {
        if (user_details.avatar) {
          avatar = image_path + user_details.avatar;
        } else {
          avatar = image_path + "default.jpg";
        }

        data.user_detail = {
          name: user_details.name,
          roles: user_details.role,
          avatar: avatar,
          designation: await helpers.get_designation_by_id(
            user_details.designation
          ),
          username: user_details.username,
          support_ticket_pwd: user_details.support_ticket_password
            ? user_details.support_ticket_password
            : "",
        };
      } else {
        if (user_details.national_id) {
          avatar = image_path + user_details.national_id;
        } else {
          avatar = image_path + "default.jpg";
        }

        data.user_detail = {
          name: user_details.full_name,
          roles: "",
          email: user_details.email,
          referral_code: user_details.referral_code,
          avatar: avatar,
        };
      }

      data.language.list = language_list;
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Data fetched successfully", null));
    } catch (error) {
      console.log(error);
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  company_info: async (req, res) => {
    try {
      let image_path = process.env.STATIC_URL + "/static/images/";
      let company_details;
      //if (req.user.type == "partner") {
      //company_details = await helpers.company_details({
      //  partner_id: req.user.id,
      //});
      //} else {
      company_details = await helpers.company_details({ id: 1 });
      //}

      var data = {
        company_name: company_details.company_name,
        code: company_details.country_code,
        contact_no: company_details.company_contact,
        email: company_details.company_email,
        logout_time: company_details.default_logout_time,
        country_id: company_details.company_country
          ? await enc_dec.cjs_encrypt(company_details.company_country)
          : "",
        country_name: company_details.company_country
          ? await helpers.get_country_name_by_id(
            company_details.company_country
          )
          : "",
        state_id: company_details.company_state
          ? await enc_dec.cjs_encrypt(company_details.company_state)
          : "",
        state_name: company_details.company_state
          ? await helpers.get_state_name_by_id(company_details.company_state)
          : "",

        city_id: company_details.company_city
          ? await enc_dec.cjs_encrypt(company_details.company_city)
          : "",
        city_name: company_details.company_city
          ? await helpers.get_city_name_by_id(company_details.company_city)
          : "",

        zipcode: company_details.company_pincode
          ? company_details.company_pincode
          : "",
        address: company_details.company_address
          ? company_details.company_address
          : "",

        fav_icon: company_details.fav_icon
          ? image_path + company_details.fav_icon
          : "",
        logo: company_details.company_logo
          ? image_path + company_details.company_logo
          : "",
        letter_head: company_details.letter_head
          ? image_path + company_details.letter_head
          : "",
        footer_banner: company_details.footer_banner
          ? image_path + company_details.footer_banner
          : "",

        currency_id: await enc_dec.cjs_encrypt(
          company_details.company_currency
        ),
        currency_name: company_details.company_currency
          ? await helpers.get_currency_name_by_id(
            company_details.company_currency
          )
          : "",
        batch_size: company_details.batch_size,
        android_link: company_details.android_link,
        ios_link: company_details.ios_link,
        auto_approve_referrer:
          company_details.auto_approve_referrer == 0 ? "Yes" : "No",
        self_onboarding: company_details.self_onboarding === 1 ? "Yes" : "No",
      };

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Dada fetched successfully", null));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  smtp_info: async (req, res) => {
    try {
      let company_details;

      company_details = await helpers.company_details({ id: 1 });

      var data = {
        smtp_host: company_details.smtp_name,
        smtp_port: company_details.smtp_port,
        smtp_username: company_details.smtp_username,
        smtp_password: company_details.smtp_password,
        smtp_from: company_details.smtp_from,
        smtp_from_name: company_details.smtp_fn,
        smtp_tls: company_details.smtp_tls ? "Yes" : "No",
        smtp_reply: company_details.smtp_reply,
      };

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Dada fetched successfully", null));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  company_update: async (req, res) => {
    try {
      console.log("save setting");
      var insdata = {
        company_name: req.bodyString("company_name"),
        country_code: req.bodyString("code"),
        company_contact: req.bodyString("contact_no"),
        company_email: req.bodyString("email"),
        company_currency: await enc_dec.cjs_decrypt(
          req.bodyString("currency_id")
        ),
        default_logout_time: req.bodyString("logout_time"),
        batch_size: req.bodyString("batch_size"),
      };

      if (req.all_files) {
        if (req.all_files.fav_icon) {
          insdata.fav_icon = req.all_files.fav_icon;
        }
        if (req.all_files.logo) {
          insdata.company_logo = req.all_files.logo;
        }
        if (req.all_files.letter_head) {
          insdata.letter_head = req.all_files.letter_head;
        }
        if (req.all_files.footer_banner) {
          insdata.footer_banner = req.all_files.footer_banner;
        }
      }

      if (req.bodyString("country_id")) {
        insdata.company_country = await enc_dec.cjs_decrypt(
          req.bodyString("country_id")
        );
      }
      if (req.bodyString("state_id")) {
        insdata.company_state = await enc_dec.cjs_decrypt(
          req.bodyString("state_id")
        );
      }
      if (req.bodyString("city_id")) {
        insdata.company_city = await enc_dec.cjs_decrypt(
          req.bodyString("city_id")
        );
      }
      if (req.bodyString("zipcode")) {
        insdata.company_pincode = req.bodyString("zipcode");
      }
      if (req.bodyString("address")) {
        insdata.company_address = req.bodyString("address");
      }
      if (req.bodyString("android_link")) {
        insdata.android_link = req.bodyString("android_link");
      }
      if (req.bodyString("ios_link")) {
        insdata.ios_link = req.bodyString("ios_link");
      }

      //insdata.auto_approve_referrer = req.bodyString('auto_approve_referrer');
      insdata.self_onboarding = req.bodyString("self_onboarding");

      if (req.user.type == "partner") {
        await helpers.updateDetails(
          { partner_id: req.user.id },
          insdata,
          "company_master"
        );
      } else {
        await helpers.updateDetails({ id: 1 }, insdata, "company_master");
      }
      let comapnyDetail = await helpers.updateDetails(
        { id: 1 },
        { title: req.body.company_name },
        "title"
      );

      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Organization",
      };
      let headers = req.headers;
      admin_activity_logger
        .edit(module_and_user, 1, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(
              response.successmsg("Organization setup updated successfully")
            );
        })
        .catch((error) => {
          console.log(error);
          logger.error(500, { message: error, stack: error.stack });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  smtp_update: async (req, res) => {
    try {
      var insdata = {
        smtp_name: req.bodyString("smtp_host"),
        smtp_port: req.bodyString("smtp_port"),
        smtp_username: req.bodyString("smtp_username"),
        smtp_password: req.bodyString("smtp_password"),
        smtp_from: req.bodyString("smtp_from"),
        smtp_fn: req.bodyString("smtp_from_name"),
        smtp_reply: req.bodyString("smtp_reply"),
      };
      // if (req.bodyString("smtp_host")) {
      //     insdata.smtp_name =req.bodyString("smtp_host");
      // }
      // if (req.bodyString("smtp_port")) {
      //     insdata.smtp_port = req.bodyString("smtp_port");
      // }
      // if (req.bodyString("smtp_username")) {
      //     insdata.smtp_username = req.bodyString("smtp_username");
      // }
      // if (req.bodyString("smtp_password")) {
      //     insdata.smtp_password = req.bodyString("smtp_password");
      // }
      // if (req.bodyString("smtp_from")) {
      //     insdata.smtp_from = req.bodyString("smtp_from");
      // }
      // if (req.bodyString("smtp_from_name")) {
      //     insdata.smtp_fn = req.bodyString("smtp_from_name");
      // }
      if (req.bodyString("smtp_tls") == "Yes") {
        insdata.smtp_tls = 1;
      } else {
        insdata.smtp_tls = 0;
      }

      // if (req.bodyString("smtp_reply")) {
      //     insdata.smtp_reply = req.bodyString("smtp_reply");
      // }
      if (insdata) {
        await helpers.updateDetails({ id: 1 }, insdata, "company_master");
      }

      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Settings",
        sub_module: "Email smtp",
      };
      let headers = req.headers;
      admin_activity_logger
        .edit(module_and_user, 1, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("Record updated successfully"));
        })
        .catch((error) => {
          logger.error(500, { message: error, stack: error.stack });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  login_info: async (req, res) => {
    try {
      let image_path = process.env.STATIC_URL + "/static/images/";
      let file_path = process.env.STATIC_URL + "/static/language/";
      let title = await helpers.get_title();
      let company_details = await helpers.company_details({ id: 1 });

      // if (req.body.language_id) {
      //   let language_id = enc_dec.cjs_decrypt(req.body.language_id);
      //   // language = await helpers.get_language_json({ id: language_id });
      // } else {
      //   language = await helpers.get_first_active_language_json({
      //     status: 0,
      //     deleted: 0,
      //   });
      //   console.log("🚀 ~ login_info: ~ language2:", language);
      // }

      let storedLanguageList = await nodeCache.getAllLanguageList();
      let language_list = [];
      let i = 0;
      for (let list of storedLanguageList) {
        language_list[i] = {
          flag: file_path + list.flag,
          file: file_path + list.file,
          language_id: enc_dec.cjs_encrypt(list.id + ""),
          language: list.name,
          direction: list.direction,
        };
        i++;
      }


      let language_id = 1;
      if (req.body.language_id) {
        language_id = req.body.language_id;
      }
      language_id = enc_dec.cjs_encrypt(language_id + "");
      let language = await nodeCache.getActiveLanguageById(language_id);


      // banner
      const slug = req.body.slug;

      let storedBanner = await nodeCache.getActiveBannerBySlug(slug);
      let banner = {};

      if (storedBanner && storedBanner.id) {
        banner = {
          banner_id: enc_dec.cjs_encrypt(storedBanner.id + ""),
          page_name: storedBanner.page_name,
          slug: storedBanner.slug,
          status: storedBanner.status,
          image: storedBanner.file_name
            ? image_path + storedBanner.file_name
            : "",
        };
      } else {
        banner = {
          banner_id: null,
          page_name: null,
          slug: null,
          status: 0,
          image: "https://placehold.co/500X400",
        };
      }

      var data = {
        fav_icon: image_path + company_details.fav_icon,
        logo: image_path + company_details.company_logo,
        logo_name: company_details.company_logo,
        letter_head: image_path + company_details.letter_head,
        footer_banner: image_path + company_details.footer_banner,
        title: title,
        language: language,
        language_list: language_list,
        banner: banner,
      };

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(data, "Data fetched successfully", null));
    } catch (error) {
      console.log(error);
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  change_env: async (req, res) => {
    try {
      let old_mode = req.bodyString("env");
      let new_mode = "";
      if (old_mode == "test") {
        new_mode = "live";
      } else {
        new_mode = "test";
      }
      var insdata = {
        mode: new_mode,
      };
      if (req.bodyString("onboarding") == "no") {
        await merchantModel.SupermerchantupdateDetails(
          {
            id:
              req.user.super_merchant_id > 0
                ? req.user.super_merchant_id
                : req.user.id,
          },
          { selected_submerchant: 0 }
        );
      }

      await merchantModel.updateDetails(
        {
          super_merchant_id:
            req.user.super_merchant_id > 0
              ? req.user.super_merchant_id
              : req.user.id,
        },
        insdata
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Environment changed successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  add_transaction_limit: async (req, res) => {
    try {
      let ins_data = req.body.data;
      for (let i = 0; i < ins_data.length; i++) {
        if (ins_data[i].mcc) {
          max_limit = `'${ins_data[i].max_limit}'`;
          high_risk_limit = `'${ins_data[i].high_risk_limit}'`;
          let mcc = await enc_dec.cjs_decrypt(ins_data[i].mcc);
          let currency_id = ins_data[i].currency_id;
          count_data = await settingModel.get_count_check(
            {
              mcc: mcc,
              currency: currency_id,
              max_limit: max_limit,
              high_risk_limit: high_risk_limit,
              deleted: 0,
            },
            0
          );

          if (count_data == 0) {
            temp = {
              mcc: mcc,
              currency: currency_id,
              max_limit: ins_data[i].max_limit,
              high_risk_limit: ins_data[i].high_risk_limit,
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
              ip: await helpers.get_ip(req),
            };
            settingModel.add(temp).then(async (result) => {
              res.status(statusCode.ok).send({
                status: true,
                message: "Transaction limit added successfully",
              });
            });
          } else {
            res
              .status(statusCode.ok)
              .send({ status: false, message: "Data exist" });
          }
        }
        ///update

        if (ins_data[i].id) {
          let data_id = await enc_dec.cjs_decrypt(ins_data[i].id);
          max_limit = ins_data[i].max_limit_update;
          high_risk_limit = ins_data[i].high_risk_limit_up;
          let mcc = await enc_dec.cjs_decrypt(ins_data[i].mcc_up);
          let currency = `'${ins_data[i].currency_up}'`;
          let currency_id = ins_data[i].currency_up;
          count_data = await settingModel.get_count(
            {
              mcc: mcc,
              currency: currency,
              max_limit: max_limit,
              high_risk_limit: high_risk_limit,
              deleted: 0,
            },
            data_id
          );

          if (count_data > 0) {
            res
              .status(statusCode.ok)
              .send({ status: false, message: "Data exist" });
          } else {
            temp = {
              mcc: mcc,
              currency: currency_id,
              max_limit: max_limit,
              high_risk_limit: high_risk_limit,
            };
            settingModel.update({ id: data_id }, temp).then((result) => {
              res
                .status(statusCode.ok)
                .send({ status: true, message: "Updated successfully" });
            });
          }
        }
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    }
  },
  details_transaction_limit: async (req, res) => {
    settingModel
      .select("*")
      .then(async (result) => {
        let send_res = [];

        for (let val of result) {
          let res1 = {
            data_id: enc_dec.cjs_encrypt(val.id),
            mcc: enc_dec.cjs_encrypt(val.mcc),
            currency_id: val.currency,
            max_limit: val.max_limit,
            high_risk_limit: val.high_risk_limit,
            status: val.deleted == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res1);
        }
        count_data = await settingModel.get_count({ deleted: 0 }, 0);
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Details fetched successfully.",
              count_data
            )
          );
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  delete_transaction: async (req, res) => {
    try {
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      var insdata = {
        deleted: 1,
      };
      $ins_id = await settingModel.update({ id: id }, insdata);
      res
        .status(statusCode.ok)
        .send(response.successmsg("Transaction limit deleted successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  suspicious_ip_list: async (req, res) => {
    settingModel
      .selectDynamic("*", "suspicious_ips")
      .then(async (result) => {
        let send_res = [];

        for (let val of result) {
          let res1 = {
            data_id: enc_dec.cjs_encrypt(val.id),
            ip_from: val.ip_from,
            ip_to: val.ip_to,
            status: val.deleted == 1 ? "Deactivated" : "Active",
          };
          send_res.push(res1);
        }
        let count_data = await settingModel.get_dynamic_count(
          { deleted: 0 },
          0,
          "suspicious_ips"
        );
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              send_res,
              "Details fetched successfully.",
              count_data
            )
          );
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  delete_suspicious_ip: async (req, res) => {
    try {
      let id = enc_dec.cjs_decrypt(req.bodyString("id"));
      var insdata = {
        deleted: 1,
      };
      $ins_id = settingModel.update_dynamic(
        { id: id },
        insdata,
        "suspicious_ips"
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Suspicious IP deleted successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  add_suspicious_ip: async (req, res) => {
    try {
      settingModel
        .delete_all("suspicious_ips")
        .then(async (result) => {
          let ins_data = req.body.data;
          for (let i = 0; i < ins_data.length; i++) {
            if (ins_data[i].ip_from) {
              ip_from = `'${ins_data[i].ip_from}'`;
              ip_to = `'${ins_data[i].ip_to}'`;
              let bulk_ins = [];
              temp = {
                ip_from: ins_data[i].ip_from,
                ip_to: ins_data[i].ip_to,
                created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
                ip: await helpers.get_ip(req),
              };
              bulk_ins.push(temp);
              settingModel
                .add_dynamic(bulk_ins, "suspicious_ips")
                .then(async (result) => {
                  res
                    .status(statusCode.ok)
                    .send({ status: true, message: "Updated successfully" });
                })
                .catch((error) => {
                  logger.error(500, { message: error, stack: error.stack });
                  res
                    .status(statusCode.internalError)
                    .send(response.errormsg(error.message));
                });
            }
          }
        })
        .catch((error) => {
          logger.error(500, { message: error, stack: error.stack });
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Something went wrong"));
    }
  },
  get_fraud_detection: async (req, res) => {
    settingModel
      .selectOneByTableAndCondition("*", { id: 1 }, "fraud_detections")
      .then(async (result) => {
        let res1 = {
          data_id: enc_dec.cjs_encrypt(result.id),
          suspicious_emails: result.suspicious_emails,
          suspicious_ips: result.suspicious_ips,
        };
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(res1, "Details fetched successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update_fraud_detections: async (req, res) => {
    settingModel
      .updateDynamic(
        { id: 1 },
        {
          suspicious_emails: req.bodyString("suspicious_emails"),
          suspicious_ips: req.bodyString("suspicious_ips"),
        },
        "fraud_detections"
      )
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Details updated successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update_nutriono: async (req, res) => {
    settingModel
      .updateDynamic(
        { id: 1 },
        {
          user_id: req.bodyString("user_id"),
          secret: req.bodyString("secret"),
        },
        "nutrionoapi"
      )
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Details updated successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  change_sub_merchant: async (req, res) => {
    try {
      if (req.bodyString("submerchant_id") != 0) {
        var sub_id = await enc_dec.cjs_decrypt(
          req.bodyString("submerchant_id")
        );
        var insdata = {
          selected_submerchant: sub_id,
        };
      } else {
        var insdata = {
          selected_submerchant: 0,
        };
      }

      $ins_id = await merchantModel.updatePassword(
        { id: req.user.id },
        insdata
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Submerchant changed successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  get_nutrionoapi_details: async (req, res) => {
    settingModel
      .selectOneByTableAndCondition("*", { id: 1 }, "nutrionoapi")
      .then(async (result) => {
        let res1 = {
          data_id: enc_dec.cjs_encrypt(result.id),
          user_id: result.user_id,
          secret: result.secret,
        };
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(res1, "Details fetched successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  getCssSetupDetails: async (req, res) => {
    settingModel
      .selectOneByTableAndCondition("*", { id: 1 }, "css_setup")
      .then(async (result) => {
        let res1 = {
          data_id: enc_dec.cjs_encrypt(result.id),
          font_name: result.font_name,
          font_size: result.font_size,
          font_color: result.font_color,
          button_background_color: result.button_background_color,
          button_border_color: result.button_border_color,
          button_font_size: result.button_font_size,
          button_font_name: result.button_font_name,
          button_text_color: result.button_text_color,
          fonts: await fontModel.select(),
        };
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(res1, "Details fetched successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  updateCss: async (req, res) => {
    settingModel
      .updateDynamic(
        { id: 1 },
        {
          font_name: req.bodyString("font_name"),
          font_size: req.bodyString("font_size"),
          font_color: req.bodyString("font_color"),
          button_border_color: req.bodyString("button_border_color"),
          button_font_size: req.bodyString("button_font_size"),
          button_font_name: req.bodyString("button_font_name"),
          button_background_color: req.bodyString("button_background_color"),
          button_text_color: req.bodyString("button_text_color"),
        },
        "css_setup"
      )
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("Details updated successfully."));
      })
      .catch((error) => {
        console.log(error);
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  dccDetails: async (req, res) => {
    settingModel
      .selectOneByTableAndCondition("*", { id: 1 }, "dcc_setup")
      .then(async (result) => {
        let res1 = {
          data_id: enc_dec.cjs_encrypt(result.id),
          dcc_enabled: result.dcc_enabled,
          provider: result.provider,
          apikey: result.apikey,
          secret: result.secret,
        };
        res
          .status(statusCode.ok)
          .send(response.successdatamsg(res1, "Details fetched successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  dccUpdate: async (req, res) => {
    let updateData = {
      dcc_enabled: req.bodyString("dcc_enabled"),
      provider: req.bodyString("provider"),
      apikey: req.bodyString("apikey"),
      secret: req.bodyString("secret"),
    };
    settingModel
      .updateDynamic({ id: 1 }, updateData, "dcc_setup")
      .then(async (result) => {
        res
          .status(statusCode.ok)
          .send(response.successmsg("DCC Details updated successfully."));
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};
module.exports = Setting;
