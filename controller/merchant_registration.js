const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const protector = require("../utilities/decryptor/decryptor");
const helpers = require("../utilities/helper/general_helper");
const MerchantRegistrationModel = require("../models/merchant_registration");
const ReferralBonusModel = require("../models/referral_bonusModel");
const MerchantModel = require("../models/merchantmodel");
const ReferrerInvoicePayoutModel = require("../models/referrer_invoice_payout_model");
const merchantToken = require("../utilities/tokenmanager/merchantToken");
const shortid = require("shortid");
const { reset } = require("express-useragent");
require("dotenv").config({ path: "../.env" });
const referrer_model = require("../models/referrer_model");
const port = process.env.SERVER_PORT;
var uuid = require("uuid");
const mailSender = require("../utilities/mail/mailsender");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const logger = require("../config/logger");

require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const moment = require("moment");
const checkifrecordexistandexpiration = require("../utilities/validations/checkifrecordexistandexpiration");

const MerchantReferrer = require("../utilities/add-merchant-referrer/index");
const CurrencyModel = require("../models/currency");
const SubmerchantModel = require("../models/submerchantmodel");
const SequenceUUID = require("sequential-uuid");
const qrGenerateModel = require("../models/qrGenerateModule");
var MerchantRegistration = {
  register: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    // let password = shortid.generate();
    // let passwordHash = enc_dec.cjs_encrypt(password.toString());
    let registered_business_address = await encrypt_decrypt(
      "decrypt",
      req.bodyString("registered_business_address")
    );
    let currency = await helpers.get_referrer_currency_by_country(
      registered_business_address
    );
    let ref_code = await helpers.make_referral_code("REF");
    let auto_approve = await helpers.check_auto_approval_of_referrer();
    let psp_data = {
      name: "",
      email: req.bodyString("email"),
      mobile_no: req.bodyString("mobile_no"),
      registered_business_address: registered_business_address,
      legal_business_name: req.bodyString("legal_business_name"),
      code: req.bodyString("code"),
      referral_code_used: req.bodyString("referral_code"),
      referral_code: ref_code,
      role: "dashboard,transactions,accept_payments,payment_links,my_static_qr,subscription,plans,subscriber_list,invoice,list,item,inv_customers,users,customers,submerchant,clients,accounts,charges_invoice,support,settings,security_and_password,profile,api_reference,webhook_settings,api_key,expired_cards,subscription_setup,about_to_expire,declined_cards,referrer_list,referrer_invoice,,referrer_plan,referrer_bonus,referrer,integrations,contract,routing,rules_list,lists",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      deleted: 0,
      status: 0,
      user: 0,
      register_at: register_at,

      auth_2fa_token: "asd",
      super_merchant_id: 0,
      address: "",
      country: 0,
      province: 0,
      city: 0,
      zipcode: "123456",
    };

    MerchantRegistrationModel.register(psp_data)
      .then(async (result) => {
        let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let tc_obj = {
          merchant_id: result.insert_id,
          tc_id: await helpers.get_latest_tc_version_id(),
          added_date: created_at,
          type: "merchant",
        };
        await MerchantRegistrationModel.addTC(tc_obj);

        // merchant as referrer register
        MerchantReferrer.addMerchantReferrer({
          currency,
          full_name: req.bodyString("legal_business_name"),
          email: req.bodyString("email"),
          mobile_no: req.bodyString("mobile_no"),
          code: req.bodyString("code"),
          registered_business_address,
          ref_code,
          auto_approve,
          insert_id: result.insert_id,
        });
        // end merchant as referrer register

        // referral bonus codes here
        if (req.bodyString("referral_code")) {
          //
          let qb = await pool.get_connection();
          let referrer;
          try {
            referrer = await qb
              .select("*")
              .where({
                referral_code: req.bodyString("referral_code"),
              })
              .get(config.table_prefix + "referrers");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          /* let referral_bonus_data = await qb
                         .select("fix_amount_for_reference")
                         .where({ currency: referrer[0].currency })
                         .get(config.table_prefix + "master_referral_bonus");
                     qb.release();
                     
                     */

          // record data
          let tax =
            (referrer[0].tax_per / 100) * referrer[0]?.fix_amount_for_reference;
          let amount_to_settle = referrer[0]?.fix_amount_for_reference - tax;
          let bonusData = {
            referrer_id: referrer[0]?.id,
            currency: await helpers.get_referrer_currency_by_country(
              referrer[0]?.country
            ),
            amount: referrer[0]?.fix_amount_for_reference
              ? referrer[0]?.fix_amount_for_reference
              : 0.0,
            tax: tax,
            amount_to_settle: amount_to_settle,
            remark: `Benefit for referring ${req.bodyString("email")}`,
            ref_no: await helpers.make_referral_txn_ref_no(),
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            super_merchant_id: result.insert_id,
          };

          // Adding bonus data
          let bonus_result = await ReferralBonusModel.addBonus(bonusData);
          let current_date = moment();
          const settlement_frequency = referrer[0].settlement_frequency;
          const settlement_interval = referrer[0].settlement_date;
          let nextDueDate = await helpers.calculateDate(
            current_date,
            settlement_interval,
            settlement_frequency
          );
          const payoutData = {
            referrer_id: referrer[0]?.id,
            payout_date: nextDueDate,
          };
          let newPayoutResult = await ReferrerInvoicePayoutModel.selectPayout({
            referrer_id: referrer[0]?.id,
          });

          if (newPayoutResult.length === 0) {
            ReferrerInvoicePayoutModel.addPayout(payoutData);
          }
          // referral bonus codes here
        }

        let token = uuid.v1();
        let resetData = {
          merchant_id: result.insert_id,
          token: token,
          is_expired: 0,
          created_at: created_at,
        };
        MerchantRegistrationModel.addResetPassword(resetData).then(
          async (result_add_reset) => {
            // let merchant_details = {
            // merchant_id: result.insert_id,
            // }
            // let merchant_details_insert_result = await MerchantRegistrationModel.addDetails(merchant_details)
            let verify_url =
              process.env.FRONTEND_URL_MERCHANT + "create-password/" + token;

            let emailres = await mailSender.welcomeMail(
              req.bodyString("email"),
              verify_url
            );
            console.log(emailres);
            res
              .status(statusCode.ok)
              .send(
                response.successmsg(
                  "Register successfully, please verify your email."
                )
              );
          }
        );
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  /**
   * Register merchant using open API
   * @param {*} req
   * @param {*} res
   */
  merchant_register: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let registered_business_address =
      await helpers.get_busi_address_country_id_by_code(
        req.bodyString("registered_business_address")
      );
    if (!registered_business_address) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Invalid country iso code"));
    }
    console.log(`register business address ${registered_business_address}`);
    let currency = await helpers.get_referrer_currency_by_country(
      registered_business_address
    );

    let ref_code = await helpers.make_referral_code("REF");
    let auto_approve = await helpers.check_auto_approval_of_referrer();
    let psp_data = {
      name: "",
      email: req.bodyString("email"),
      mobile_no: req.bodyString("mobile_no"),
      registered_business_address: registered_business_address,
      legal_business_name: req.bodyString("legal_business_name"),
      code: req.bodyString("code"),
      referral_code_used: req.bodyString("referral_code"),
      referral_code: ref_code,
      role: "dashboard,transactions,accept_payments,payment_links,my_static_qr,subscription,plans,subscriber_list,invoice,list,item,inv_customers,users,customers,submerchant,clients,accounts,charges_invoice,support,settings,security_and_password,profile,api_reference,webhook_settings,api_key,expired_cards,subscription_setup,about_to_expire,declined_cards,referrer_list,referrer_invoice,,referrer_plan,referrer_bonus,referrer,integrations,contract,routing,rules_list,lists",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      deleted: 0,
      status: 0,
      user: 0,
      register_at: register_at,

      auth_2fa_token: "asd",
      super_merchant_id: 0,
      address: "",
      country: registered_business_address,
      province: 0,
      city: 0,
      zipcode: "123456",
    };

    let resetData = "";

    /**
     * Register merchant
     */
    MerchantRegistrationModel.register(psp_data)
      .then(async (result) => {
        let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
        let tc_obj = {
          merchant_id: result.insert_id,
          tc_id: await helpers.get_latest_tc_version_id(),
          added_date: created_at,
          type: "merchant",
        };
        await MerchantRegistrationModel.addTC(tc_obj);

        // merchant as referrer register
        MerchantReferrer.addMerchantReferrer({
          currency,
          full_name: req.bodyString("legal_business_name"),
          email: req.bodyString("email"),
          mobile_no: req.bodyString("mobile_no"),
          code: req.bodyString("code"),
          registered_business_address,
          ref_code,
          auto_approve,
          insert_id: result.insert_id,
        });
        // end merchant as referrer register

        // referral bonus codes here
        if (req.bodyString("referral_code")) {
          //
          let qb = await pool.get_connection();
          let referrer;
          try {
            referrer = await qb
              .select("*")
              .where({
                referral_code: req.bodyString("referral_code"),
              })
              .get(config.table_prefix + "referrers");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          // record data
          let tax =
            (referrer[0].tax_per / 100) * referrer[0]?.fix_amount_for_reference;
          let amount_to_settle = referrer[0]?.fix_amount_for_reference - tax;
          let bonusData = {
            referrer_id: referrer[0]?.id,
            currency: await helpers.get_referrer_currency_by_country(
              referrer[0]?.country
            ),
            amount: referrer[0]?.fix_amount_for_reference
              ? referrer[0]?.fix_amount_for_reference
              : 0.0,
            tax: tax,
            amount_to_settle: amount_to_settle,
            remark: `Benefit for referring ${req.bodyString("email")}`,
            ref_no: await helpers.make_referral_txn_ref_no(),
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            super_merchant_id: result.insert_id,
          };

          // Adding bonus data
          let bonus_result = await ReferralBonusModel.addBonus(bonusData);
          let current_date = moment();
          const settlement_frequency = referrer[0].settlement_frequency;
          const settlement_interval = referrer[0].settlement_date;
          let nextDueDate = await helpers.calculateDate(
            current_date,
            settlement_interval,
            settlement_frequency
          );
          const payoutData = {
            referrer_id: referrer[0]?.id,
            payout_date: nextDueDate,
          };
          let newPayoutResult = await ReferrerInvoicePayoutModel.selectPayout({
            referrer_id: referrer[0]?.id,
          });

          if (newPayoutResult.length === 0) {
            ReferrerInvoicePayoutModel.addPayout(payoutData);
          }
          // referral bonus codes here
        }

        //--------------------------------------------------------------

        let token = uuid.v1();
        resetData = {
          merchant_id: result.insert_id,
          token: token,
          is_expired: 0,
          created_at: created_at,
        };

        MerchantRegistrationModel.addResetPassword(resetData).then(
          async (result_add_reset) => {
            //-----------------------Set Password---------------------------------------

            /**
             * Generate and set random password
             */
            let password = helpers.generateRandomString();
            let merchant_id = "";
            await MerchantRegistrationModel.select({ token: token })
              .then(async (result_password_reset) => {
                let passwordHash = await encrypt_decrypt("encrypt", password);
                let merchant_data = {
                  password: passwordHash,
                  live: 0,
                };
                let condition = {
                  id: result_password_reset.merchant_id,
                };
                MerchantRegistrationModel.update_super_merchant(
                  condition,
                  merchant_data
                )
                  .then(async (result) => {
                    let merchant_data = {
                      is_expired: 1,
                    };
                    let condition = {
                      token: token,
                    };

                    let result1 =
                      await MerchantRegistrationModel.updateResetPassword(
                        condition,
                        merchant_data
                      );

                    let two_fa_token = uuid.v1();
                    let two_fa_secret = authenticator.generateSecret();
                    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                    let two_fa_data = {
                      token: two_fa_token,
                      secret: two_fa_secret,
                      merchant_id: result_password_reset.merchant_id,
                      created_at: created_at,
                    };
                    let result_2fa = await MerchantRegistrationModel.add_two_fa(
                      two_fa_data
                    );
                    //"Password set successfully."

                    if (result_2fa) {
                      //--------------------------------------------------------------
                      let title = await helpers.get_title();
                      QRCode.toDataURL(
                        authenticator.keyuri(
                          req.bodyString("email"),
                          title,
                          two_fa_secret
                        ),
                        (err, url) => {
                          if (err) {
                            console.log("Error: ", err);
                          }

                          //Qr code generated successfully.

                          //----------------------verify_2fa----------------------------------------
                          let key_data = "";
                          MerchantRegistrationModel.select2fa({
                            token: token,
                          })
                            .then(async (result) => {
                              let ref_no = await helpers.make_reference_number(
                                "REF",
                                7
                              );
                              let condition = { token: token };
                              let data = { is_expired: 1 };
                              let two_fa_update =
                                await MerchantRegistrationModel.update2fa(
                                  condition,
                                  data
                                );
                              let mer_condition = {
                                id: result_password_reset.merchant_id,
                              };
                              let mer_data = {
                                email_verified: 1,
                                mobile_no_verified: 0,
                                auth_2fa_token: two_fa_secret,
                                live: 1,
                                allow_mid: 1,
                              };
                              let merchant_update =
                                await MerchantRegistrationModel.update_super_merchant(
                                  mer_condition,
                                  mer_data
                                );

                              let super_merchant =
                                await MerchantRegistrationModel.selectWithSelection(
                                  "*",
                                  {
                                    id: result_password_reset.merchant_id,
                                  }
                                );

                              let count_merchant =
                                await MerchantRegistrationModel.countMerchant(
                                  result_password_reset.merchant_id
                                );

                              if (
                                count_merchant.count == 0 &&
                                super_merchant.super_merchant_id == 0
                              ) {
                                let mer_obj = {
                                  email: super_merchant.email,
                                  super_merchant_id: super_merchant.id,
                                  code: super_merchant.code,
                                  mobile_no: super_merchant.mobile_no,
                                  referral_code_used:
                                    super_merchant.referral_code_used,
                                  referral_code: super_merchant.referral_code,
                                  my_referral_code: ref_no,
                                  register_at: moment(
                                    super_merchant.register_at
                                  ).format("YYYY-MM-DD HH:mm:ss"),
                                  mode: "test",
                                };

                                let merc_id = await MerchantModel.add(mer_obj);
                                merchant_id = merc_id;
                                let mer_obj_details = {
                                  merchant_id: merc_id.insertId,
                                  company_name:
                                    super_merchant.legal_business_name,
                                  register_business_country:
                                    super_merchant.registered_business_address,
                                };
                                let merc_id_details =
                                  await MerchantRegistrationModel.insertMerchantDetails(
                                    mer_obj_details
                                  );
                                /****** ADD Payment Method******/
                                // let addPaymentMethodRes = await MerchantRegistrationModel.insertMerchantPaymentMethodsForOnboardedMerchant(merc_id.insertId);
                                let addMasterMerchantDraft =
                                  await MerchantRegistrationModel.addDefaultDraft(
                                    merc_id.insertId
                                  );
                                /****** ADD Payment Method END******/
                                let update_selected_mer =
                                  await MerchantRegistrationModel.update_super_merchant(
                                    mer_condition,
                                    {
                                      selected_submerchant: merc_id.insertId,
                                    }
                                  );
                                let update_mer =
                                  await referrer_model.updateDetails(
                                    {
                                      referral_code:
                                        super_merchant.referral_code,
                                    },
                                    { submerchant_id: merc_id.insertId }
                                  );
                                let update_referral =
                                  await referrer_model.update_referral_bonus(
                                    {
                                      super_merchant_id: super_merchant.id,
                                    },
                                    { submerchant_id: merc_id.insertId }
                                  );

                                //------------------------------------------

                                /**
                                 * Add Test Key
                                 */
                                key_data = {
                                  super_merchant_id: super_merchant.id,
                                  merchant_id: merc_id.insertId,
                                  type: "test",
                                  merchant_key: await helpers.make_order_number(
                                    "test-"
                                  ),
                                  merchant_secret:
                                    await helpers.make_order_number("sec-"),
                                  created_at: moment().format(
                                    "YYYY-MM-DD HH:mm:ss"
                                  ),
                                };
                                await MerchantModel.add_key(key_data);

                                //------------------------------------------

                                /**
                                 * Add Live Key
                                 */
                                key_data = {
                                  super_merchant_id: super_merchant.id,
                                  merchant_id: merc_id.insertId,
                                  type: "live",
                                  merchant_key: await helpers.make_order_number(
                                    "live-"
                                  ),
                                  merchant_secret:
                                    await helpers.make_order_number("sec-"),
                                  created_at: moment().format(
                                    "YYYY-MM-DD HH:mm:ss"
                                  ),
                                };
                                await MerchantModel.add_key(key_data);

                                //------------------------------------------

                                //await addTestMid(merc_id.insertId,super_merchant.id)

                                /**
                                 * dd onboarding code
                                 * */
                                company_details = await helpers.company_details(
                                  {
                                    id: 1,
                                  }
                                );
                                //if onboarding is true then do the self onboarding
                                if (company_details.self_onboarding === 1) {
                                  let mer_obj_details = {
                                    id: merc_id.insertId,
                                  };
                                  const updateData = {
                                    onboarding_done: 1,
                                    video_kyc_done: 1,
                                    ekyc_done: 3,
                                    live: 1,
                                  };
                                  await MerchantModel.updateDetails(
                                    mer_obj_details,
                                    updateData
                                  );
                                }
                              }

                              //Verified successfully, please login.

                              //------------------------------------------

                              let key_response = await MerchantModel.get_key({
                                super_merchant_id: resetData.merchant_id,
                              });

                              //------------------------------------------

                              // payload = {
                              //   email: super_merchant.email,
                              //   id: key_data.merchant_id,
                              //   super_merchant_id:
                              //     super_merchant.id > 0
                              //       ? super_merchant.id
                              //       : "",
                              //   mode: "",
                              //   name: "",
                              //   type: "merchant",
                              // };
                              // payload = encrypt_decrypt(
                              //   "encrypt",
                              //   JSON.stringify(payload)
                              // );
                              // const aToken = merchantToken(payload);

                              //------------------------------------------

                              /* Start webhook details inerstion*/
                              let webhook_token = "";
                              if (req.bodyString("webhook_url") != "") {
                                const uuid = new SequenceUUID({
                                  valid: true,
                                  dashes: false,
                                  unsafeBuffer: true,
                                });
                                webhook_token = uuid.generate();
                                let webhook_data = {
                                  enabled: 0,
                                  merchant_id: merchant_id.insert_id,
                                  notification_url:
                                    req.bodyString("webhook_url"),
                                  notification_secret: webhook_token,
                                  created_at: moment().format(
                                    "YYYY-MM-DD hh:mm:ss"
                                  ),
                                };
                                let insertWebhook =
                                  await MerchantModel.addWebhook(webhook_data);
                              }
                              /* End webhook details insertion*/

                              let registrationResponse = {
                                merchant_id: helpers.formatNumber(
                                  resetData.merchant_id + ""
                                ),
                                sub_merchant_id: merchant_id.insert_id,
                                super_merchant_id: resetData.merchant_id,
                                business_name: req.bodyString(
                                  "legal_business_name"
                                ),
                                business_address: req.bodyString(
                                  "registered_business_address"
                                ),
                                business_email: req.bodyString("email"),
                                business_country_code: req.bodyString("code"),
                                business_mobile_no: req.bodyString("mobile_no"),
                                referral_code: req.bodyString("referral_code"),
                                // access_token: aToken,
                                access: key_response,
                                webhook_secret: webhook_token,
                              };

                              res
                                .status(statusCode.ok)
                                .send(
                                  response.registrationDataResponse(
                                    registrationResponse,
                                    "Register successfully!"
                                  )
                                );
                            })
                            .catch((error) => {
                              logger.error(500, {
                                message: error,
                                stack: error.stack,
                              });
                              console.log("Error: ", error);
                            });
                          //--------------------------------------------------------------
                        }
                      );
                    }
                  })
                  .catch((error) => {
                    logger.error(500, { message: error, stack: error.stack });
                    console.log("Error: ", error);
                  });
              })
              .catch((error) => {
                logger.error(500, { message: error, stack: error.stack });
                console.log("Error: ", error);
              });

            //--------------------------------------------------------------
          }
        );

        //--------------------------------------------------------------
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },

  resend_link: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
    };
    MerchantRegistrationModel.selectWithSelection("id,email", condition)
      .then((result) => {
        if (result) {
          let reset_condition = { merchant_id: result.id };
          let reset_data = { is_expired: 1 };
          MerchantRegistrationModel.updateResetPassword(
            reset_condition,
            reset_data
          )
            .then((result_reset) => {
              let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
              let token = uuid.v1();
              let resetData = {
                merchant_id: result.id,
                token: token,
                is_expired: 0,
                created_at: created_at,
              };
              MerchantRegistrationModel.addResetPassword(resetData).then(
                async (result) => {
                  let verify_url =
                    process.env.FRONTEND_URL_MERCHANT +
                    "reset-password/" +
                    token;
                  console.log(verify_url);
                  await mailSender.welcomeMail(
                    req.bodyString("email"),
                    verify_url
                  );
                  res
                    .status(statusCode.ok)
                    .send(
                      response.successmsg(
                        "Email sent successfully, please verify your email."
                      )
                    );
                }
              );
            })
            .catch((error) => {
              logger.error(500, { message: error, stack: error.stack });
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
      .catch((error) => {
        logger.error(500, { message: err, stack: err.stack });
        res.status(statusCode.internalError).send(response.errormsg(err));
      });
  },

  reset_forgot_password: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
    };
    MerchantRegistrationModel.selectWithSelection("id,email", condition)
      .then((result) => {
        if (result) {
          let reset_condition = { merchant_id: result.id };
          let reset_data = { is_expired: 1 };
          MerchantRegistrationModel.updateResetPassword(
            reset_condition,
            reset_data
          )
            .then((result_reset) => {
              let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
              let token = uuid.v1();
              let resetData = {
                merchant_id: result.id,
                token: token,
                is_expired: 0,
                created_at: created_at,
              };
              MerchantRegistrationModel.addResetPassword(resetData).then(
                async (result) => {
                  let verify_url =
                    process.env.FRONTEND_URL_MERCHANT +
                    "reset-password/" +
                    token;
                  await mailSender.forgotMail(
                    req.bodyString("email"),
                    verify_url
                  );
                  res
                    .status(statusCode.ok)
                    .send(
                      response.successmsg(
                        "If your account is identified, you will be receiving an email to change your password."
                      )
                    );
                }
              );
            })
            .catch((error) => {
              logger.error(500, { message: error, stack: error.stack });
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
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  reset_password: async (req, res) => {
    MerchantRegistrationModel.select({ token: req.bodyString("token") })
      .then(async (result_password_reset) => {
        let ref_email = await helpers.get_supermerchant_email(
          result_password_reset.merchant_id
        );
        let passwordHash = await encrypt_decrypt(
          "encrypt",
          req.bodyString("password")
        );
        let merchant_data = {
          password: passwordHash,
        };
        let condition = {
          id: result_password_reset.merchant_id,
        };
        MerchantRegistrationModel.update_super_merchant(
          condition,
          merchant_data
        )
          .then(async (result) => {
            let merchant_data = {
              is_expired: 1,
            };
            let condition = {
              token: req.bodyString("token"),
            };

            let result1 = await MerchantRegistrationModel.updateResetPassword(
              condition,
              merchant_data
            );

            let two_fa_token = uuid.v1();
            let two_fa_secret = authenticator.generateSecret();
            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let two_fa_data = {
              token: two_fa_token,
              secret: two_fa_secret,
              merchant_id: result_password_reset.merchant_id,
              created_at: created_at,
            };
            let result_2fa = await MerchantRegistrationModel.add_two_fa(
              two_fa_data
            );
            // let update_referrer = await MerchantRegistrationModel.updateReferrer(
            //     {email:ref_email},
            //     {  password: passwordHash}
            // );
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  { token: two_fa_token },
                  "Password set successfully."
                )
              );
          })
          .catch((error) => {
            logger.error(500, { message: error, stack: error.stack });
            res.status(statusCode.internalError).send(response.errormsg(error));
          });
      })
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  generate_2fa_qr: async (req, res) => {
    const token = req.bodyString("token");
    MerchantRegistrationModel.select2fa({ token: token })
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
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  verify_2fa: async (req, res) => {
    const token = req.bodyString("token");
    MerchantRegistrationModel.select2fa({ token: token })
      .then(async (result) => {
        let verification_result = authenticator.check(
          req.bodyString("pin"),
          result.secret
        );
        if (verification_result) {
          let ref_no = await helpers.make_reference_number("REF", 7);
          let condition = { token: token };
          let data = { is_expired: 1 };
          let two_fa_update = await MerchantRegistrationModel.update2fa(
            condition,
            data
          );
          let mer_condition = { id: result.merchant_id };
          let mer_data = {
            email_verified: 1,
            mobile_no_verified: 0,
            auth_2fa_token: result.secret,
            live: 0,
            allow_mid: 1,
          };
          let merchant_update =
            await MerchantRegistrationModel.update_super_merchant(
              mer_condition,
              mer_data
            );
          // let update_referrer = await MerchantRegistrationModel.updateReferrer(
          //     {email:result.email},
          //     {  two_fa_secret: result.secret}
          // );
          let super_merchant =
            await MerchantRegistrationModel.selectWithSelection("*", {
              id: result.merchant_id,
            });

          let count_merchant = await MerchantRegistrationModel.countMerchant(
            result.merchant_id
          );

          if (
            count_merchant.count == 0 &&
            super_merchant.super_merchant_id == 0
          ) {
            let mer_obj = {
              email: super_merchant.email,
              super_merchant_id: super_merchant.id,
              code: super_merchant.code,
              mobile_no: super_merchant.mobile_no,
              referral_code_used: super_merchant.referral_code_used,
              referral_code: super_merchant.referral_code,
              my_referral_code: ref_no,
              register_at: moment(super_merchant.register_at).format(
                "YYYY-MM-DD HH:mm:ss"
              ),
              mode: "test",
            };

            let merc_id = await MerchantModel.add(mer_obj);

            let mer_obj_details = {
              merchant_id: merc_id.insertId,
              company_name: super_merchant.legal_business_name,
              register_business_country:
                super_merchant.registered_business_address,
              last_updated: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            let merc_id_details =
              await MerchantRegistrationModel.insertMerchantDetails(
                mer_obj_details
              );
            /****** ADD Payment Method******/
            //let addPaymentMethodRes = await MerchantRegistrationModel.insertMerchantPaymentMethods(merc_id.insertId);
            /****** ADD Payment Method END******/
            let update_selected_mer =
              await MerchantRegistrationModel.update_super_merchant(
                mer_condition,
                { selected_submerchant: merc_id.insertId }
              );
            let update_mer = await referrer_model.updateDetails(
              { referral_code: super_merchant.referral_code },
              { submerchant_id: merc_id.insertId }
            );
            let update_referral = await referrer_model.update_referral_bonus(
              { super_merchant_id: super_merchant.id },
              { submerchant_id: merc_id.insertId }
            );
            let kay_data = {
              super_merchant_id: super_merchant.id,
              merchant_id: merc_id.insertId,
              type: "test",
              merchant_key: await helpers.make_order_number("test-"),
              merchant_secret: await helpers.make_order_number("sec-"),
              created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            await MerchantModel.add_key(kay_data);
            //await addTestMid(merc_id.insertId,super_merchant.id)

            //add onboarding code
            company_details = await helpers.company_details({ id: 1 });
            //if onboarding is true then do the self onboarding
            if (company_details.self_onboarding === 1) {
              let mer_obj_details = {
                id: merc_id.insertId,
              };
              const updateData = {
                onboarding_done: 1,
                video_kyc_done: 1,
                ekyc_done: 3,
                live: 1,
              };
              await MerchantModel.updateDetails(mer_obj_details, updateData);
            }
          }
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
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  forgot_2fa: async (req, res) => {
    let condition = {
      email: req.bodyString("email"),
      deleted: 0,
      status: 0,
    };
    MerchantRegistrationModel.selectWithSelection(
      "id,email,password",
      condition
    )
      .then((result) => {
        if (result) {
          if (result.password != " " && result.password != "") {
            MerchantRegistrationModel.select2fa({
              email: req.bodyString("email"),
            })
              .then(async (result_2fa) => {
                let two_fa_token = uuid.v1();
                let two_fa_secret = authenticator.generateSecret();
                let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
                let two_fa_data = {
                  token: two_fa_token,
                  secret: two_fa_secret,
                  merchant_id: result_2fa.merchant_id,
                  created_at: created_at,
                };
                await MerchantRegistrationModel.add_two_fa(two_fa_data);
                let verify_url =
                  process.env.FRONTEND_URL_MERCHANT +
                  "merchant-2fa/" +
                  two_fa_token;
                await mailSender.forgot2fa(
                  req.bodyString("email"),
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
                logger.error(500, { message: error, stack: error.stack });
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          } else {
            let reset_condition = { merchant_id: result.id };
            let reset_data = { is_expired: 1 };

            let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
            let token = uuid.v1();
            let resetData = {
              merchant_id: result.id,
              token: token,
              is_expired: 0,
              created_at: created_at,
            };

            MerchantRegistrationModel.addResetPassword(resetData)
              .then(async (result) => {
                let verify_url = process.env.FRONTEND_URL_MERCHANT + "reset-password/" + token;

                await mailSender.forgotMail(
                  req.bodyString("email"),
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
                logger.error(500, { message: error, stack: error.stack });
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
      .catch((error) => {
        logger.error(500, { message: error, stack: error.stack });
        res.status(statusCode.internalError).send(response.errormsg(error));
      });
  },
  notificationUpdate: async (req, res) => {
    let id = enc_dec.cjs_decrypt(req.bodyString("meeting_id"));
    try {
      await MerchantRegistrationModel.updateMeeting({ id: id }, { is_seen: 1 });
      let meeting_count = await MerchantRegistrationModel.get_count_meetings({
        super_merchant_id:
          req.user.super_merchant_id > 0
            ? req.user.super_merchant_id
            : req.user.id,
        is_seen: 0,
        status: 0,
        deleted: 0,
      });

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            [],
            "Notification Updated successfully.",
            meeting_count
          )
        );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  AllnotificationUpdate: async (req, res) => {
    let super_merchant_id =
      req.user.super_merchant_id > 0 ? req.user.super_merchant_id : req.user.id;

    try {
      await MerchantRegistrationModel.updateMeeting(
        { super_merchant_id: super_merchant_id },
        { is_seen: 1 }
      );
      let meeting_count = await MerchantRegistrationModel.get_count_meetings({
        super_merchant_id:
          req.user.super_merchant_id > 0
            ? req.user.super_merchant_id
            : req.user.id,
        is_seen: 0,
      });

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            [],
            "Notification Updated successfully.",
            meeting_count
          )
        );
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  register_submerchant: async (req, res) => {
  let merchantId = null;

  try {
    const inheritMid = helpers.toBoolean(helpers.body(req, "inherit_mid"));
    const superMerchantId = helpers.body(req, "super_merchant_id");
    const firstSubMerchant = await MerchantModel.selectFistSubmentchant({
      super_merchant_id: superMerchantId,
    });

    if (!firstSubMerchant) {
      return res
        .status(statusCode.badRequest)
        .send(response.validationResponse("Invalid super merchant"));
    }

    const password = Math.random().toString(36).slice(-8);

    // STEP 1: create merchant
    const merchant = await MerchantModel.add({
      email: helpers.body(req, "email"),
      super_merchant_id: superMerchantId,
      code: helpers.body(req, "code"),
      mobile_no: helpers.body(req, "mobile_no"),
      register_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      password: enc_dec.cjs_encrypt(password),
      ip: helpers.getClientIp(req),
      email_verified: 1,
      mobile_no_verified: 1,
      status: 0,
      deleted: 0,
      mode: "test",
      onboarding_done: 1,
      inherit_mid: inheritMid ? 1 : 0,
      video_kyc_done: 1,
      ekyc_done: 3,
      onboarded_through_api: 1,
      brand_color: inheritMid ? firstSubMerchant.brand_color : "#FFFFFF",
      accent_color: inheritMid ? firstSubMerchant.accent_color : "#4c64e6",
      font_name: inheritMid ? firstSubMerchant.font_name : "",
    });

    merchantId = merchant.insertId;

    // STEP 2: details
    const countryId = await helpers.get_busi_address_country_id_by_code(
      helpers.body(req, "registered_business_address"),
    );

    await MerchantRegistrationModel.insertMerchantDetails({
      merchant_id: merchantId,
      company_name: helpers.body(req, "legal_business_name"),
      register_business_country: countryId || 0,
      address_line1: helpers.body(req, "full_address"),
      last_updated: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    // STEP 3: keys
    await MerchantModel.add_key({
      super_merchant_id: superMerchantId,
      merchant_id: merchantId,
      type: "test",
      merchant_key: await helpers.make_order_number("test-"),
      merchant_secret: await helpers.make_order_number("sec-"),
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    await MerchantModel.add_key({
      super_merchant_id: superMerchantId,
      merchant_id: merchantId,
      type: "live",
      merchant_key: await helpers.make_order_number("live-"),
      merchant_secret: await helpers.make_order_number("sec-"),
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    // STEP 4: webhook
    let webhookSecret = "";
    const webhookUrl = helpers.body(req, "webhook_url");
    if (webhookUrl) {
      webhookSecret = uuid.v4();
      await MerchantModel.addWebhook({
        enabled: 0,
        merchant_id: merchantId,
        notification_url: webhookUrl,
        notification_secret: webhookSecret,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      });
    }
    // Fetch access keys (IMPORTANT)
    const accessKeys = await MerchantModel.get_key({
      merchant_id: merchantId,
    });
    let midsResponse = { test: [], live: [] };

    // STEP 5: inherit logic
    if (inheritMid) {
      await inheritMerchantResources(
        firstSubMerchant.id,
        merchantId,
        superMerchantId,
      );
      const testMid = await MerchantModel.selectMid({
        "mid.submerchant_id": merchantId,
        "mid.env": "test",
        "mid.status": 0,
        "mid.deleted": 0,
      });

      const liveMid = await MerchantModel.selectMid({
        "mid.submerchant_id": merchantId,
        "mid.env": "live",
        "mid.status": 0,
        "mid.deleted": 0,
      });

      midsResponse = {
        test: testMid || [],
        live: liveMid || [],
      };
    }
    const registrationResponse = {
      merchant_id: helpers.formatNumber(String(merchantId)),
      sub_merchant_id: merchantId,
      super_merchant_id: superMerchantId,
      business_name: helpers.body(req, "legal_business_name"),
      business_address: helpers.body(req, "registered_business_address"),
      business_email: helpers.body(req, "email"),
      business_country_code: helpers.body(req, "code"),
      business_mobile_no: helpers.body(req, "mobile_no"),
      referral_code: helpers.body(req, "referral_code") || "",
      access: accessKeys,
      mids: midsResponse,
      webhook_secret: webhookSecret,
    };
    // SUCCESS
    return res
      .status(statusCode.ok)
      .send(
        response.registrationDataResponse(
          registrationResponse,
          "Register successfully!",
        ),
      );
  } catch (err) {
    // MANUAL ROLLBACK
    await rollbackMerchant(merchantId);

    logger.error('Register submerchant failed', {
      message: err.message,
      stack: err.stack,
      merchantId
    });

    return res
      .status(statusCode.internalError)
      .send(response.errormsg('Unable to register merchant'));
  }
  },
  get_receiver_details: async (req, res) => {
    const { sub_merchant_id } = req.body;
    try {
      let result = await MerchantRegistrationModel.get_receiver_details(
        sub_merchant_id
      );
      var response = {
        message: "done",
        status: "success",
        ...result,
        code: "00",
      };
      res.status(statusCode.ok).send(response);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  get_receivers_by_filters: async (req, res) => {
    const { sub_merchant_id, currency, country_iso_code } = req.body;
    try {
      let result =
        await MerchantRegistrationModel.get_receivers_details_by_filters(req);
      var response = {
        message: "done",
        status: "success",
        data: result,
        code: "00",
      };
      res.status(statusCode.ok).send(response);
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  updateMrechantProfile: async (req, res) => {
    const {
      email,
      sub_merchant_id,
      code,
      mobile_no,
      registered_business_address,
      full_address,
      legal_business_name,
    } = req.body;
    try {
      // fetch merchant data
      let merchant = await MerchantRegistrationModel.selectOneDyn(
        "id,super_merchant_id,email,code,mobile_no",
        { id: sub_merchant_id },
        "master_merchant"
      );
      // fetch merchant data
      if (!merchant) throw new Error("Merchant not found");
      // check if email change case
      if (merchant.email != email) {
        let existingEmail = await MerchantRegistrationModel.selectOneDyn(
          "email,id",
          { email: email },
          "master_merchant"
        );
        if (existingEmail && existingEmail.id !== sub_merchant_id) {
          throw new Error("Email already in use");
        }
      }

      // check if country code is valid or not
      let registered_business_address =
        await helpers.get_busi_address_country_id_by_code(
          req.bodyString("registered_business_address")
        );
      if (!registered_business_address) {
        throw new Error("Invalid country code");
      }
      // fetch merchant details
      let merchant_details = await MerchantRegistrationModel.selectOneDyn(
        "register_business_country,company_name",
        { merchant_id: sub_merchant_id },
        "master_merchant_details"
      );
      //make a data to insert in histroy table
      let profile_history = {
        merchant_id: sub_merchant_id,
        legal_business_name: merchant_details.company_name,
        legal_business_country: merchant_details.register_business_country,
        email: merchant.email,
        code: merchant.code,
        mobile_no: merchant.mobile_no,
        created_at: moment().format("YYYY-MM-DD HH:mm"),
      };
      let insert_history = await MerchantRegistrationModel.addProfileHistory(
        profile_history
      );
      // update master merchant
      let merchant_data = {
        email: email,
        code: code,
        mobile_no: mobile_no,
      };
      let update_master_merchant = await MerchantRegistrationModel.updateDyn(
        { id: sub_merchant_id },
        merchant_data,
        "master_merchant"
      );
      // update master merchant details
      let details = {
        register_business_country: registered_business_address,
        company_name: legal_business_name,
        last_updated: moment().format("YYYY-MM-DD HH:mm:ss"),
      };
      if (full_address) {
        details.address_line1 = full_address;
      }
      let update_master_merchant_details =
        await MerchantRegistrationModel.updateDyn(
          { merchant_id: sub_merchant_id },
          details,
          "master_merchant_details"
        );

      // update super merchant
      let super_merchant_data = {
        email: email,
        code: code,
        mobile_no: mobile_no,
        name: legal_business_name,
      };
      let update_super_merchant = await MerchantRegistrationModel.updateDyn(
        { email: merchant.email },
        super_merchant_data,
        "master_super_merchant"
      );

      // send the response
      delete profile_history.merchant_id;
      delete req.body.sub_merchant_id;
      delete profile_history.created_at;
      delete profile_history.legal_business_country;
      profile_history["registered_business_address"] =
        await helpers.get_business_address_code(
          merchant_details.register_business_country
        ); //(merchant_details.register_business_country),
      let res_data = {
        sub_merchant_id: sub_merchant_id,
        old_data: profile_history,
        new_data: req.body,
      };
      res
        .status(statusCode.ok)
        .send(response.successansmsg(res_data, "Profile updated successfully"));
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
      res
        .status(statusCode.badRequest)
        .send(response.validationResponse(error.message));
    }
  },
};
module.exports = MerchantRegistration;
async function addTestMid(merchant_id, super_merchant_id) {
  try {
    console.log("Test MID add function call");
    let psp_id = 1;
    let currency_id = await helpers.get_currency_id_by_name("AED");
    let country_id = await helpers.get_country_id_by_name(
      "United Arab Emirates"
    );
    let country_name = "United Arab Emirates";
    let currency = await CurrencyModel.selectOne("currency,code", {
      id: currency_id,
    });
    let test_mid_credentials = [
      {
        psp: "NI",
        mid: "256c04c4-2da4-404a-8ac3-8f1e5563d19f",
        password:
          "OGQ5OWE5MjQtMzA5Ni00YzhmLTg2YjYtNDRiMzhhNzE2ZWE1OmYzZWFmMjc3LWY0OTgtNDZjYi1iMzY2LTJjZmE1Yjg0YWU2ZQ",
      },
      {
        psp: "TELR",
        mid: "27759",
        password: "HnLp#pxk2W@r7C4c",
      },
      {
        psp: "PAYTABS",
        mid: "110599",
        password: "SKJNHKJ29T-JG9T69KL29-9M69226KKG",
      },
    ];
    let testMID = [];
    for (i = 0; i < 3; i++) {
      var _terminalid = await helpers.cerate_terminalid();
      let temp = {
        mode: "AUTH",
        MID: test_mid_credentials[i].mid,
        password: test_mid_credentials[i].password,
        psp_id: i + psp_id,
        currency_id: currency_id,
        submerchant_id: super_merchant_id,
        terminal_id: _terminalid,
        payment_methods: "Debit Card,Credit Card",
        payment_schemes: "VISA,MASTERCARD,DINERS CLUB INTERNATIONAL",
        country_id: country_id,
        country_name: country_name,
        statementDescriptor: "",
        shortenedDescriptor: "",
        is3DS: 0,
        allowRefunds: 0,
        allowVoid: 0,
        international: 1,
        domestic: 1,
        voidWithinTime: 6,
        autoCaptureWithinTime: 6,
        minTxnAmount: 1,
        maxTxnAmount: 1000,
        failure_url: process.env.PAYMENT_URL + "/status",
        cancel_url: process.env.PAYMENT_URL + "/status",
        success_url: process.env.PAYMENT_URL + "/status",
        env: "test",
      };
      testMID.push(temp);
    }
    const created_mid = await SubmerchantModel.add_bulk_mid(testMID, "mid");
    return true;
  } catch (error) {
    logger.error(500, { message: error, stack: error.stack });
    return false;
  }
}
async function rollbackMerchant(merchantId) {
  try {
    if (!merchantId) return;

    await MerchantModel.deleteMerchant({ id: merchantId });
    await MerchantModel.deleteMerchantDetails({ merchant_id: merchantId });
    await MerchantModel.deleteKeys({ merchant_id: merchantId });
    await MerchantModel.deleteWebhook({ merchant_id: merchantId });

    logger.warn('Rolled back merchant creation', { merchantId });
  } catch (err) {
    logger.error('Rollback failed', {
      merchantId,
      error: err.message
    });
  }
}
async function inheritMerchantResources(
  sourceSubMerchantId,
  newMerchantId,
  superMerchantId
) {
  try {
    // STEP 1: fetch MIDs
    const testMids = await MerchantModel.selectMid({
      'mid.submerchant_id': sourceSubMerchantId,
      'mid.env': 'test',
      'mid.status': 0,
      'mid.deleted': 0
    });

    const liveMids = await MerchantModel.selectMid({
      'mid.submerchant_id': sourceSubMerchantId,
      'mid.env': 'live',
      'mid.status': 0,
      'mid.deleted': 0
    });

    // STEP 2: update merchant live flag if live MID exists
    if (liveMids.length > 0) {
      await MerchantRegistrationModel.updateDyn(
        { id: newMerchantId },
        { live: 1 },
        'master_merchant'
      );
    }

    const allMids = [...testMids, ...liveMids];

    // STEP 3: inherit each MID
    for (const mid of allMids) {
      if (!mid?.mid_id || !mid?.currency_id) continue;

      const terminalId = await helpers.cerate_terminalid();

      const inheritedMid = await MerchantModel.inheritMid(
        mid.mid_id,
        newMerchantId,
        terminalId
      );

      if (!inheritedMid?.insert_id) continue;

      // STEP 4: generate QR
      const currencyCode = await helpers.get_currency_name_by_id(
        mid.currency_id
      );

      const qrId = uuid.v4();
      const timeStamp = moment().format('YYYY-MM-DD HH:mm:ss');

      const qrData = {
        mid_id: inheritedMid.insert_id,
        merchant_id: superMerchantId || 0,
        sub_merchant_id: newMerchantId,
        currency: currencyCode,
        qr_id: qrId,
        created_at: timeStamp,
        type_of_qr_code: 'Static_QR',
        mode: mid.env
      };

      const addedQr = await qrGenerateModel.add(qrData);

      // STEP 5: QR logs
      if (addedQr?.insertId) {
        await qrGenerateModel.add_logs({
          merchant_id: superMerchantId || 0,
          sub_merchant_id: newMerchantId,
          currency: currencyCode,
          qr_id: addedQr.insertId,
          created_at: timeStamp,
          updated_at: timeStamp,
          type_of_qr_code: 'Static_QR',
          activity: 'Created',
          created_by: 0
        });
      }
    }

    // STEP 6: inherit payment methods
    await MerchantModel.inheritPaymentMethod(
      sourceSubMerchantId,
      newMerchantId
    );

    // STEP 7: inherit payment method drafts
    await MerchantModel.inheritPaymentMethodDraft(
      sourceSubMerchantId,
      newMerchantId
    );

    // STEP 8: inherit merchant draft
    await MerchantRegistrationModel.addDefaultDraftInherited(
      newMerchantId,
      sourceSubMerchantId
    );

    return true;

  } catch (err) {
    logger.error('inheritMerchantResources failed', {
      sourceSubMerchantId,
      newMerchantId,
      message: err.message,
      stack: err.stack
    });

    throw err; // IMPORTANT: let caller handle rollback
  }
}

