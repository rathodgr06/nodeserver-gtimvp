const WalletModel = require("../models/wallet");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");
const { promises } = require("fs");
const moment = require("moment");
const charges_invoice_models = require("../models/charges_invoice_models");
const currency = require("./currency");
const walletDBModel = require("../models/wallet");
const MerchantSetupModal = require("../models/MerchantSetupModal");
const transacationChargesModel = require("../models/charges_invoice_models");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");

var MerchantSetup = {
  add: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let country_id = req.bodyString("country_id");
    let country_name = req.bodyString("country_name");
    let country_code = req.bodyString("country_code");
    let merchant_roles = req.bodyString("merchant_roles");
    let env_mode = req.bodyString("env_mode");

    let create_payload = {
      country_id: await encrypt_decrypt("decrypt", country_id),
      country_name: country_name,
      country_code: country_code,
      roles: merchant_roles,
      env_mode: env_mode,
    };

    let checkdata = {
      country_id: await encrypt_decrypt("decrypt", country_id),
      env_mode: env_mode,
      deleted: 0,
    };

    MerchantSetupModal.add(create_payload, checkdata)
      .then((result) => {
        console.log("🚀 ~ result:", result);
        if (result?.status == 200) {
          let response_payload = {
            id: result?.data?.id,
            country_id: result?.data?.country_id,
            country_name: result?.data?.country_name,
            country_code: result?.data?.country_code,
            merchant_roles: result?.data?.roles,
            created_at: moment(result?.data.created_at).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
            updated_at: moment(result?.data.updated_at).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          };

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                response_payload,
                "Merchant setup created successfully."
              )
            );
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let id = req.bodyString("id");
    let merchant_roles = req.bodyString("merchant_roles");

    let update_payload = {
      roles: merchant_roles,
    };

    let checkdata = {
      id: await encrypt_decrypt("decrypt", id),
      deleted: 0,
    };

    MerchantSetupModal.update(update_payload, checkdata)
      .then((result) => {
        console.log("🚀 ~ result:", result);
        if (result?.status == 200) {
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                {},
                "Merchant setup updated successfully."
              )
            );
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  list: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let page = req.bodyString("page");
    let per_page = req.bodyString("per_page");
    try {
      let condition = {
        deleted: 0,
      };
      let limit = {
        page: 1, // Default Values
        per_page: 20, // Default Values
      };
      // filters and pagination
      if (page) {
        limit.page = page;
      }
      if (per_page) {
        limit.per_page = per_page;
      }
      MerchantSetupModal.list(condition, page, per_page)
        .then(async (result) => {
          if (result?.status == 400) {
            res
              .status(statusCode.badRequest)
              .send(response.successmsg(result?.message));
          } else {
            let merchant_setup_list;
            try {
              merchant_setup_list = await Promise.all(
                result?.data?.map(async (merchant_setup) => {
                  merchant_setup.id = encrypt_decrypt( "encrypt", merchant_setup.id );
                  merchant_setup.country_id = encrypt_decrypt( "encrypt", merchant_setup.country_id );
                   return merchant_setup;
                })
              );
            } catch (err) {
              console.error("Failed to edit wallets:", err);
            }

            let final_response = {
              list: merchant_setup_list,
              total_count: result?.totalCount,
              page: result?.page,
              per_page: result?.limit,
            };

            res
              .status(statusCode.ok)
              .send(response.successdatamsg(final_response, "Wallet list"));
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  delete: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let id = req.bodyString("id");

    if (!id) {
      return res
        .status(statusCode.badRequest)
        .send(response.validationResponse("Invalid request id missing"));
    }

    let update_payload = {
      id: await encrypt_decrypt("decrypt", id),
      deleted: 1,
    };
    console.log("🚀 ~ update_payload:", update_payload);

    let where = {
      id: await encrypt_decrypt("decrypt", id),
      deleted: 0,
    };

    MerchantSetupModal.update(update_payload, where)
      .then((result) => {
        console.log("🚀 ~ result:", result);
        if (result?.status == 200) {
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                result?.data,
                "Merchant setup deleted successfully."
              )
            );
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get_by_country: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let country_id = req.bodyString("country_id");
    let env_mode = req.bodyString("env_mode");
    try {
      let condition = {
        country_id: country_id,
        env_mode: env_mode,
        deleted: 0,
      };

      MerchantSetupModal.get_by_country(condition)
        .then(async (result) => {
          if (result?.status == 400) {
            res
              .status(statusCode.badRequest)
              .send(response.successmsg(result?.message));
          } else {
            let merchant_setup_list;
            try {
              merchant_setup_list = await Promise.all(
                result?.data?.map(async (merchant_setup) => {
                  merchant_setup.id = encrypt_decrypt(
                    "encrypt",
                    merchant_setup.id
                  );
                  merchant_setup.country_id = encrypt_decrypt(
                    "encrypt",
                    merchant_setup.country_id
                  );
                  return merchant_setup;
                })
              );
            } catch (err) {
              console.error("Merchant roles:", err);
            }

            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(merchant_setup_list, "Merchant roles")
              );
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

function getRandom8to10DigitNumber() {
  const min = 10000000; // 8-digit minimum
  const max = 9999999999; // 10-digit maximum
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = MerchantSetup;
