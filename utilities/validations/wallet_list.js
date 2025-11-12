const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");
const enc_dec = require("../decryptor/decryptor");
const merchantOrderModel = require("../../models/merchantOrder");

const path = require("path");
require("dotenv").config({ path: "../../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const { availableMemory } = require("process");
const { default: axios } = require("axios");
const walletDBModel = require("../../models/wallet");
const winston = require("winston/lib/winston/config");
const X_Username = process.env.X_Username;
const X_Password = process.env.X_Password;

const WalletValidator = {
  list: async (req, res, next) => {
    try {
      const schema = Joi.object({
        currency: Joi.string()
          .length(3)
          .uppercase()
          .required()
          .label("Currency"),
        amount: Joi.number().positive().required().label("Amount"),
        country: Joi.string()
          .length(3)
          .uppercase()
          .required()
          .label("Country Code"),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        next();
      }

      // ------------- Check Access Token ----------------------------

      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      // return;
      if (username == X_Username && password == X_Password) {
        next();
      } else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        } else {
          req.body.receiver_id =
            receiver_credentials_response?.data?.data?.receiver_id;
          next();
        }
      } else {
        // --------------- Check Merchant Credentials -------------------------

        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response?.[0];
          console.log("🚀 ~ merchant_details:", merchant_details?.merchant_id);
          req.credentials = merchant_details;

          if (merchant_details?.merchant_id) {
            req.body.sub_merchant_id = merchant_details?.merchant_id;
            next();
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  wallets: async (req, res, next) => {
    try {
      const schema = Joi.object({
        currency: Joi.string().length(3).optional().allow("").label("Currency"),
        super_merchant_id: Joi.string()
          .optional()
          .allow("")
          .label("Super merchant id"),
        sub_merchant_id: Joi.string()
          .optional()
          .allow("")
          .label("Sub merchant id"),
        page: Joi.string().optional().allow("").label("page"),
        per_page: Joi.string().optional().allow("").label("per_page"),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  validate_user: async (req, res, next) => {
    try {
      const schema = Joi.object({
        sub_merchant_id: Joi.string()
          .optional()
          .allow("")
          .label("Sub merchant id"),
        currency: Joi.string().optional().allow("").length(3).label("Currency"),
        wallet_id: Joi.string().optional().allow("").label("Wallet ID"),
        receiver_id: Joi.string().optional().allow("").label("Receiver ID"),
      })
        .custom((value, helpers) => {
          const hasSubMerchantAndCurrency =
            value.currency && value.sub_merchant_id;
          const hasWalletId = value.wallet_id;
          const hasBeneficiaryAndCurrency = value.currency && value.receiver_id;

          if (
            hasSubMerchantAndCurrency ||
            hasWalletId ||
            hasBeneficiaryAndCurrency
          ) {
            return value; // valid
          }

          return helpers.error("any.invalid");
        })
        .messages({
          "any.invalid":
            "Payload must contain (currency and sub_merchant_id), or wallet_id, or (currency and receiver_id)",
        });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(result.error.message));
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let wallet_id = req.bodyString("wallet_id");
      let receiver_id = req.bodyString("receiver_id");
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let currency = req.bodyString("currency");

      // return;
      if (username == X_Username && password == X_Password) {
        next();
      } else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        } else {

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }


          if (wallet_id) {
            const condition = {
              wallet_id: wallet_id,
            };

            walletDBModel
              .get_by_id(condition)
              .then(async (result) => {
                console.log("🚀 ~ result1:", result?.data?.beneficiary_id);
                console.log(
                  "🚀 ~ result2:",
                  receiver_credentials_response?.data?.data?.receiver_id
                );
                if (result?.status == 200) {
                  if (
                    receiver_credentials_response?.data?.data?.receiver_id ==
                    result?.data?.beneficiary_id
                  ) {
                    next();
                  } else {
                    return res
                      .status(StatusCode.unauthorized)
                      .send(
                        ServerResponse.validationResponse(
                          "Invalid receiver key passed",
                          400
                        )
                      );
                  }
                } else {
                  return res
                    .status(400)
                    .send(
                      ServerResponse.validationResponse(result?.message, 400)
                    );
                }
              })
              .catch((error) => {
                winston.error(error);
                return res
                  .status(StatusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          }

          if (receiver_id && currency) {
            console.log(
              "🚀 ~ receiver_credentials:",
              receiver_credentials_response?.data?.data?.receiver_id
            );
            console.log("🚀 ~ receiver_id:", receiver_id);
            if (
              receiver_credentials_response?.data?.data?.receiver_id ==
              receiver_id
            ) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }
          }
        }
      } else {
        // --------------- Check Merchant Credentials -------------------------

        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response?.[0];
          console.log("🚀 ~ merchant_details:", merchant_details?.merchant_id);
          console.log("🚀 ~ sub_merchant_id:", sub_merchant_id);

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }

          req.credentials = merchant_details;

          if (sub_merchant_id && currency) {
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid merchant key passed",
                    400
                  )
                );
            }
          } else if (wallet_id) {
            const condition = {
              wallet_id: wallet_id,
            };

            walletDBModel
              .get_by_id(condition)
              .then(async (result) => {
                console.log(
                  "🚀 ~ wallet result1:",
                  result?.data?.sub_merchant_id
                );
                console.log(
                  "🚀 ~ wallet result2:",
                  merchant_details?.merchant_id
                );
                if (result?.status == 200) {
                  if (
                    merchant_details?.merchant_id ==
                    result?.data?.sub_merchant_id
                  ) {
                    next();
                  } else {
                    return res
                      .status(StatusCode.unauthorized)
                      .send(
                        ServerResponse.validationResponse(
                          "Invalid merchant key passed",
                          400
                        )
                      );
                  }
                } else {
                  return res
                    .status(400)
                    .send(
                      ServerResponse.validationResponse(result?.message, 400)
                    );
                }
              })
              .catch((error) => {
                console.log("🚀 ~ error:", error);
                return res
                  .status(StatusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  create: async (req, res, next) => {
    try {
      const schema = Joi.object({
        currency: Joi.string().length(3).required().label("Currency"),
        sub_merchant_id: Joi.string().allow("", null).label("Sub merchant id"),
        receiver_id: Joi.string().allow("", null).label("Receiver ID"),
        is_active: Joi.number().valid(0, 1).optional().label("Is Active"),
      });

      const result = schema.validate(req.body); // schema validation
      // If both schemas fail, return the first error message (or combine)
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        next();
      }
      // If one of the schemas is valid, continue processing
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    // try {
    //   let authHeader = req.headers;
    //   let username = authHeader.xusername;
    //   let password = authHeader.xpassword;

    //   let receiver_key = req.headers["receiver-key"];
    //   let receiver_secret = req.headers["receiver-secret"];

    //   // return;
    //   if (username == X_Username && password == X_Password) {
    //     const { currency, receiver_id } = req.body;

    //     let sub_merchant_id = req.body.sub_merchant_id;

    //     // Check submerchant id
    //     let where = { deleted: 0 };
    //     if (sub_merchant_id) {
    //       if (sub_merchant_id.length > 10) {
    //         sub_merchant_id = enc_dec.cjs_decrypt(sub_merchant_id);
    //         where.merchant_id = sub_merchant_id;
    //       } else {
    //         where.merchant_id = sub_merchant_id;
    //       }

    //       let qb = await pool.get_connection();
    //       let response;
    //       try {
    //         response = await qb
    //           .select("merchant_id,type,super_merchant_id")
    //           .where(where)
    //           .get(config.table_prefix + "master_merchant_key_and_secret");
    //       } catch (error) {
    //         console.error("Database query failed:", error);
    //       } finally {
    //         qb.release();
    //       }

    //       let merchant_details = response[0];
    //       if (
    //         response?.length > 0 &&
    //         (response[0]?.type == "live" || response[0]?.type == "test")
    //       ) {
    //         req.credentials = merchant_details;
    //         if (merchant_details?.merchant_id != sub_merchant_id) {
    //           return res
    //             .status(StatusCode.badRequest)
    //             .send(
    //               ServerResponse.validationResponse(
    //                 "Invalid submerchant id passed",
    //                 400
    //               )
    //             );
    //         }
    //       } else {
    //         return res
    //           .status(StatusCode.unauthorized)
    //           .send(
    //             ServerResponse.validationResponse(
    //               "Invalid submerchant id passed",
    //               400
    //             )
    //           );
    //       }
    //     }

    //     // Check currency
    //     where = { status: 0, deleted: 0 };
    //     if (currency) {
    //       where.code = currency;
    //       console.log("🚀 ~ get_wallet: ~ where:", where);

    //       let qb = await pool.get_connection();
    //       let response;
    //       try {
    //         response = await qb
    //           .select("code")
    //           .where(where)
    //           .get(config.table_prefix + "master_currency");
    //       } catch (error) {
    //         console.error("Database query failed:", error);
    //       } finally {
    //         qb.release();
    //       }

    //       let currency_code = response?.[0];
    //       if (currency_code == undefined || currency_code?.code !== currency) {
    //         return res
    //           .status(StatusCode.badRequest)
    //           .send(
    //             ServerResponse.validationResponse(
    //               "Currency either disabled or deleted",
    //               400
    //             )
    //           );
    //       }
    //     }

    //     if (receiver_id) {
    //       const beneficiary_response = await axios.get(
    //         process.env.PAYOUT_SERVER_URL +
    //           "/v1/payout/receiver/get-receiver-by-id/" +
    //           receiver_id,
    //         {
    //           headers: {
    //             xusername: process.env.X_Username,
    //             xpassword: process.env.X_Password,
    //           },
    //         }
    //       );

    //       if (beneficiary_response?.data?.status != 200) {
    //         return res
    //           .status(StatusCode.unauthorized)
    //           .send(
    //             ServerResponse.validationResponse(
    //               "Invalid receiver id passed",
    //               400
    //             )
    //           );
    //       }
    //     }

    //     next();
    //   } else if (receiver_key && receiver_secret) {
    //     if (req.bodyString("sub_merchant_id")) {
    //       return res
    //         .status(StatusCode.unauthorized)
    //         .send(
    //           ServerResponse.validationResponse(
    //             "Invalid merchant key passed",
    //             400
    //           )
    //         );
    //     }

    //     const beneficiary_response = await axios.get(
    //       process.env.PAYOUT_SERVER_URL +
    //         "/v1/payout/receiver/get-receiver-by-id/" +
    //         req.bodyString("receiver_id"),
    //       {
    //         headers: {
    //           receiver_key: receiver_key,
    //           receiver_secret: receiver_secret,
    //         },
    //       }
    //     );
    //     // console.log(beneficiary_response?.data);
    //     if (beneficiary_response?.data?.status != 200) {
    //       return res
    //         .status(StatusCode.unauthorized)
    //         .send(
    //           ServerResponse.validationResponse(
    //             "Invalid receiver id passed",
    //             400
    //           )
    //         );
    //     } else {
    //       next();
    //     }
    //   } else {
    //     // --------------- Check Merchant Credentials -------------------------

    //     let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
    //     let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
    //     if (!merchant_secret && !merchant_key) {
    //       return res
    //         .status(StatusCode.unauthorized)
    //         .send(
    //           ServerResponse.validationResponse("Unauthorized request", "E0001")
    //         );
    //     } else {
    //       let qb = await pool.get_connection();
    //       let response;
    //       try {
    //         response = await qb
    //           .select("merchant_id,type,super_merchant_id")
    //           .where({
    //             merchant_key: merchant_key,
    //             merchant_secret: merchant_secret,
    //             deleted: 0,
    //           })
    //           .get(config.table_prefix + "master_merchant_key_and_secret");
    //       } catch (error) {
    //         console.error("Database query failed:", error);
    //       } finally {
    //         qb.release();
    //       }

    //       let merchant_details = response[0];
    //       const { sub_merchant_id } = req.body;
    //       if (response[0]?.type == "live" || response[0]?.type == "test") {
    //         req.credentials = merchant_details;
    //         if (merchant_details?.merchant_id == sub_merchant_id) {
    //           next();
    //         } else {
    //           return res
    //             .status(StatusCode.unauthorized)
    //             .send(
    //               ServerResponse.validationResponse(
    //                 "Invalid submerchant id passed",
    //                 400
    //               )
    //             );
    //         }
    //       } else {
    //         return res
    //           .status(StatusCode.unauthorized)
    //           .send(
    //             ServerResponse.validationResponse(
    //               "Invalid merchant key or secret",
    //               401
    //             )
    //           );
    //       }
    //       // -------------------------------------------------------
    //     }
    //   }
    // } catch (error) {
    //   return res
    //     .status(StatusCode.badRequest)
    //     .send(ServerResponse.validationResponse(error?.message));
    // }
  },
  manage: async (req, res, next) => {
    try {
      const schema = Joi.object({
        action: Joi.string()
          .valid("activate", "deactivate")
          .required()
          .label("Action"),
        currency: Joi.string().length(3).allow("", null).label("Currency"),
        sub_merchant_id: Joi.string().allow("", null).label("Sub merchant id"),
        receiver_id: Joi.string()
          .allow("", null)
          .optional()
          .label("Receiver ID"),
        wallet_id: Joi.string().allow("", null).optional().label("Wallet ID"),
      });
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      // return;
      if (username == X_Username && password == X_Password) {
        next();
      } else {
        return res
          .status(StatusCode.unauthorized)
          .send(
            ServerResponse.validationResponse("Invalid key or secret", 401)
          );
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  get_wallet: async (req, res, next) => {
    try {
      const schema = Joi.object({
        sub_merchant_id: Joi.string()
          .optional()
          .allow("")
          .label("Sub merchant id"),
        receiver_id: Joi.string().optional().allow("").label("Receiver id"),
        currency: Joi.string().length(3).label("Currency"),
        wallet_id: Joi.string().optional().allow("").label("Wallet id"),
      });
      const result = schema.validate(req.body); // schema validation
      console.log("🚀 ~ get_wallet: ~ result:", result);
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.validationResponse(result.error.message));
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      // return;
      if (username == X_Username && password == X_Password) {
        const { sub_merchant_id, receiver_id } = req.body;

        let where = { deleted: 0 };
        if (sub_merchant_id) {
          where.merchant_id = sub_merchant_id;
          console.log("🚀 ~ get_wallet: ~ where:", where);

          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where(where)
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response[0];
          if (response[0]?.type == "live" || response[0]?.type == "test") {
            req.credentials = merchant_details;
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid submerchant id passed",
                    401
                  )
                );
            }
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid submerchant id passed",
                  401
                )
              );
          }
        } else {
          next();
        }
      } else {
        // --------------- Check Merchant Credentials -------------------------

        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response[0];
          const { sub_merchant_id } = req.body;
          if (response[0]?.type == "live" || response[0]?.type == "test") {
            req.credentials = merchant_details;
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid submerchant id passed",
                    401
                  )
                );
            }
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key or secret",
                  401
                )
              );
          }
          // -------------------------------------------------------
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  load_wallet: async (req, res, next) => {
    try {
      const schema = Joi.object({
        wallet_id: Joi.string().required().label("Wallet id"),
        amount: Joi.number().greater(0).required().label("Amount"),
        reference_id: Joi.string().allow("", null).label("Reference ID"),
        reason: Joi.string().allow("", null).label("Reason"),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.validationResponse(result.error.message));
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      // return;
      if (username == X_Username && password == X_Password) {
        next();
      } else {
        return res
          .status(StatusCode.unauthorized)
          .send(
            ServerResponse.validationResponse("Invalid key or secret", 401)
          );
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  unload_wallet: async (req, res, next) => {
    try {
      const schema = Joi.object({
        wallet_id: Joi.string().required().label("Wallet id"),
        amount: Joi.number().greater(0).required().label("Amount"),
        reference_id: Joi.string().allow("", null).label("Reference ID"),
        reason: Joi.string().allow("", null).label("Reason"),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.validationResponse(result.error.message));
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }

    // ------------- Check Access Token ----------------------------

    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      // return;
      if (username == X_Username && password == X_Password) {
        next();
      } else {
        return res
          .status(StatusCode.unauthorized)
          .send(
            ServerResponse.validationResponse("Invalid key or secret", 401)
          );
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  wallet_list: async (req, res, next) => {
    try {
      const schema = Joi.object({
        page: Joi.number().label("page"),
        per_page: Joi.number().label("per_page"),
        sub_merchant_id: Joi.string()
          .optional()
          .allow("", null)
          .label("Sub merchant id"),
        receiver_id: Joi.string()
          .optional()
          .allow("", null)
          .label("Receiver id"),
        currency: Joi.string()
          .length(3)
          .optional()
          .allow("", null)
          .label("Currency"),
      });
      const result = schema.validate(req.body); // schema validation
      if (result.error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      }

      //===================================================================
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let sub_merchant_id = req.body.sub_merchant_id;
      let receiver_id = req.body.receiver_id;
      let currency = req.body.currency;

      // Check Admin Credentials
      if (username == X_Username && password == X_Password) {
        next();
      }
      // Check Receiver Credentials
      else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        } else {

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }
          
          if (receiver_id) {
            if (
              receiver_credentials_response?.data?.data?.receiver_id ==
              receiver_id
            ) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }
          } else if (sub_merchant_id) {
            let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  sub_merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              // console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status != 200) {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
              if (
                receiver_credentials_response?.data?.data?.receiver_id ==
                receiver_response?.receiver?.receiver_id
              ) {
                next();
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }
          } else {
            req.body.receiver_id =
              receiver_credentials_response?.data?.data?.receiver_id;
            next();
          }
        }
      }
      // Check Merchant Credentials
      else {
        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response[0];
          console.log(
            "🚀 ~ merchant_details?.merchant_id:",
            merchant_details?.merchant_id
          );

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }

          req.credentials = merchant_details;

          if (sub_merchant_id) {
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid merchant key passed",
                    400
                  )
                );
            }
          } else if (receiver_id) {
            let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  merchant_details?.merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              // console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status == 200) {
                console.log("🚀 ~ receiver_id_1:", receiver_id);
                console.log( "🚀 ~ receiver_id_2:", receiver_response?.receiver?.receiver_id);
                if (receiver_response?.receiver?.receiver_id == receiver_id) {
                  req.body.receiver_id = receiver_id;
                  next();
                } else {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver id",
                        400
                      )
                    );
                }
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse("Invalid receiver id", 400)
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return receiver_response = {
                status: 400,
                message: "Receiver not found",
              };
            }
          } else {
            req.body.sub_merchant_id = merchant_details?.merchant_id;
            console.log(
              "🚀 ~ req.body.sub_merchant_id:",
              req.body.sub_merchant_id
            );
            next();
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  get_wallet_by_id: async (req, res, next) => {
    try {
      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let wallet_id = req.params.id;

      // Check Admin Credentials
      if (username == X_Username && password == X_Password) {
        next();
      }
      // Check Receiver Credentials
      else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        } else {

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }

          const condition = {
            wallet_id: wallet_id,
          };

          walletDBModel
            .get_by_id(condition)
            .then(async (result) => {
              console.log("🚀 ~ result1:", result?.data?.beneficiary_id);
              console.log(
                "🚀 ~ result2:",
                receiver_credentials_response?.data?.data?.receiver_id
              );
              if (result?.status == 200) {
                if (
                  receiver_credentials_response?.data?.data?.receiver_id ==
                  result?.data?.beneficiary_id
                ) {
                  next();
                } else {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver key passed",
                        400
                      )
                    );
                }
              } else {
                return res
                  .status(400)
                  .send(
                    ServerResponse.validationResponse(result?.message, 400)
                  );
              }
            })
            .catch((error) => {
              winston.error(error);
              return res
                .status(StatusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      }
      // Check Merchant Credentials
      else {
        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response[0];
          console.log(
            "🚀 ~ merchant_details?.merchant_id:",
            merchant_details?.merchant_id
          );

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }


          req.credentials = merchant_details;

          const condition = {
            wallet_id: wallet_id,
          };

          walletDBModel
            .get_by_id(condition)
            .then(async (result) => {
              console.log("🚀 ~ result1:", result?.data);
              if (result?.status == 200) {
                if (
                  merchant_details?.merchant_id == result?.data?.sub_merchant_id
                ) {
                  next();
                } else {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid merchant key passed",
                        400
                      )
                    );
                }
              } else {
                return res
                  .status(400)
                  .send(
                    ServerResponse.validationResponse(result?.message, 400)
                  );
              }
            })
            .catch((error) => {
              winston.error(error);
              return res
                .status(StatusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  create_wallet: async (req, res, next) => {
    try {
      let authHeader = req.headers;
      let env_mode = authHeader.mode;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let receiver_id = req.body.receiver_id;
      let sub_merchant_id = req.body.sub_merchant_id;

      // Check Admin Credentials
      if (username == X_Username && password == X_Password) {

        next();
      }
      // Check Receiver Credentials
      else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        } else {
          console.log("🚀 ~ receiver_id:", receiver_id);
          console.log(
            ">>>>>>",
            receiver_credentials_response?.data?.data?.receiver_id
          );

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }


          if (
            receiver_credentials_response?.data?.data?.receiver_id ==
            receiver_id
          ) {
            next();
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }
        }
      }
      // Check Merchant Credentials
      else {
        let merchant_key = req.headers["merchant-key"];
        let merchant_secret = req.headers["merchant-secret"];
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          let merchant_details = response[0];
          const { sub_merchant_id } = req.body;
          console.log("🚀 ~ sub_merchant_id:", sub_merchant_id);
          console.log( "🚀 ~ merchant_details?.merchant_id:", merchant_details?.merchant_id );

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }

          req.credentials = merchant_details;
          if (merchant_details?.merchant_id == sub_merchant_id) {
            next();
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid submerchant id passed",
                  400
                )
              );
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  get_wallet_statement: async (req, res, next) => {
    try {
      const schema = Joi.object({
        page: Joi.number().required(),
        per_page: Joi.number().required(),
        wallet_id: Joi.string().allow("", null),
        sub_merchant_id: Joi.string().allow("", null),
        receiver_id: Joi.string().allow("", null),
        currency: Joi.string().allow("", null),
        from_date: Joi.string().required().label("From Date"),
        to_date: Joi.string().required().label("To Date"),
      });

      // Step 1: Validate input schema
      const { error } = schema.validate(req.body);
      if (error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(error.message));
      }

      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let wallet_id = req.bodyString("wallet_id");
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let receiver_id = req.bodyString("receiver_id");

      // Check Admin Credentials
      if (username == X_Username && password == X_Password) {
        next();
      }
      // Check Receiver Credentials
      else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        }

        // >>>>>>>>>>>>>>>>>>>>>>>
        // Check Env mode 
        if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        }

        if (wallet_id) {
          const condition = {
            wallet_id: wallet_id,
          };

          walletDBModel
            .get_by_id(condition)
            .then(async (result) => {
              console.log("🚀 ~ result11:", result);
              console.log("🚀 ~ result22:", receiver_credentials_response);
              if (result?.status == 200) {
                if (
                  receiver_credentials_response?.data?.data?.receiver_id !=
                  result?.data?.beneficiary_id
                ) {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver key passed",
                        400
                      )
                    );
                } else {
                  next();
                }
              } else {
                return res
                  .status(400)
                  .send(
                    ServerResponse.validationResponse(result?.message, 400)
                  );
              }
            })
            .catch((error) => {
              winston.error(error);
              return res
                .status(StatusCode.internalError)
                .send(response.errormsg(error.message));
            });
        } else if (receiver_id) {
          if (
            receiver_credentials_response?.data?.data?.receiver_id ==
            receiver_id
          ) {
            next();
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }
        } else if (sub_merchant_id){
          let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  sub_merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status != 200) {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
              if (receiver_credentials_response?.data?.data?.receiver_id ==
                receiver_response?.receiver?.receiver_id
              ) {
                next();
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }
        } else {
          req.body.receiver_id =
            receiver_credentials_response?.data?.data?.receiver_id;
          next();
        }
      }
      // Check Merchant Credentials
      else {
        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }
          let merchant_details = response[0];

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }

          if (wallet_id) {
            const condition = {
              wallet_id: wallet_id,
            };

            walletDBModel
              .get_by_id(condition)
              .then(async (result) => {
                console.log("🚀 ~ result1:", result?.data?.sub_merchant_id);
                console.log("🚀 ~ result2:", merchant_details?.merchant_id);
                if (result?.status == 200) {
                  if (
                    merchant_details?.merchant_id ==
                    result?.data?.sub_merchant_id
                  ) {
                    next();
                  } else {
                    return res
                      .status(StatusCode.unauthorized)
                      .send(
                        ServerResponse.validationResponse(
                          "Invalid merchant key passed",
                          400
                        )
                      );
                  }
                } else {
                  return res
                    .status(400)
                    .send(
                      ServerResponse.validationResponse(result?.message, 400)
                    );
                }
              })
              .catch((error) => {
                winston.error(error);
                return res
                  .status(StatusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else if (sub_merchant_id) {
            req.credentials = merchant_details;
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid submerchant id passed",
                    400
                  )
                );
            }
          } else if(receiver_id){
            let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  merchant_details?.merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              // console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status == 200) {
                console.log("🚀 ~ receiver_id_1:", receiver_id);
                console.log( "🚀 ~ receiver_id_2:", receiver_response?.receiver?.receiver_id);
                if (receiver_response?.receiver?.receiver_id == receiver_id) {
                  req.body.receiver_id = receiver_id;
                  next();
                } else {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver id",
                        400
                      )
                    );
                }
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse("Invalid receiver id", 400)
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return receiver_response = {
                status: 400,
                message: "Receiver not found",
              };
            }
          }else {
            req.body.sub_merchant_id = merchant_details?.merchant_id;
            next();
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
  get_wallet_snapshots: async (req, res, next) => {
    try {
      const schema = Joi.object({
        page: Joi.number().required(),
        per_page: Joi.number().required(),
        wallet_id: Joi.string().allow("", null),
        sub_merchant_id: Joi.string().allow("", null),
        receiver_id: Joi.string().allow("", null),
        currency: Joi.string().allow("", null),
        from_date: Joi.string().allow("", null),
        to_date: Joi.string().allow("", null),
      });

      // Step 1: Validate input schema
      const { error } = schema.validate(req.body);
      if (error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(error.message));
      }

      let authHeader = req.headers;
      let username = authHeader.xusername;
      let password = authHeader.xpassword;

      let receiver_key = req.headers["receiver-key"];
      let receiver_secret = req.headers["receiver-secret"];

      let wallet_id = req.bodyString("wallet_id");
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let receiver_id = req.bodyString("receiver_id");

      // Check Admin Credentials
      if (username == X_Username && password == X_Password) {
        next();
      }
      // Check Receiver Credentials
      else if (receiver_key && receiver_secret) {
        const receiver_credentials_response = await axios.post(
          process.env.PAYOUT_SERVER_URL +
            "/v1/payout/receiver/get-receiver-by-key-secret",
          { receiver_key: receiver_key, receiver_secret: receiver_secret },
          {
            headers: {
              receiver_key: receiver_key,
              receiver_secret: receiver_secret,
            },
          }
        );
        console.log(">>>>>>", receiver_credentials_response?.data);

        if (receiver_credentials_response?.data?.status != 200) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        }

        // >>>>>>>>>>>>>>>>>>>>>>>
        // Check Env mode 
        if (receiver_credentials_response?.data?.data?.type !== process.env.CHARGES_MODE) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse(
                "Invalid receiver key passed",
                400
              )
            );
        }

        if (wallet_id) {
          const condition = {
            wallet_id: wallet_id,
          };

          walletDBModel
            .get_by_id(condition)
            .then(async (result) => {
              console.log("🚀 ~ wallet result1:", result?.data?.beneficiary_id);
              console.log(
                "🚀 ~ key result:",
                receiver_credentials_response?.data?.data?.receiver_id
              );
              if (result?.status == 200) {
                if (
                  receiver_credentials_response?.data?.data?.receiver_id !=
                  result?.data?.beneficiary_id
                ) {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver key passed",
                        400
                      )
                    );
                } else {
                  next();
                }
              } else {
                return res
                  .status(400)
                  .send(
                    ServerResponse.validationResponse(result?.message, 400)
                  );
              }
            })
            .catch((error) => {
              winston.error(error);
              return res
                .status(StatusCode.internalError)
                .send(response.errormsg(error.message));
            });
        } else if (receiver_id) {
          if (
            receiver_credentials_response?.data?.data?.receiver_id ==
            receiver_id
          ) {
            next();
          } else {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver key passed",
                  400
                )
              );
          }
        } else if (sub_merchant_id){
          let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  sub_merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status != 200) {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
              if (receiver_credentials_response?.data?.data?.receiver_id ==
                receiver_response?.receiver?.receiver_id
              ) {
                next();
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse(
                      "Invalid receiver key passed",
                      400
                    )
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid receiver key passed",
                    400
                  )
                );
            }
        } else {
          req.body.receiver_id =
            receiver_credentials_response?.data?.data?.receiver_id;
          next();
        }
      }
      // Check Merchant Credentials
      else {
        let merchant_key = req.headers["merchant-key"]; //authHeader.merchant_key;
        let merchant_secret = req.headers["merchant-secret"]; //authHeader.merchant_secret;
        if (!merchant_secret && !merchant_key) {
          return res
            .status(StatusCode.unauthorized)
            .send(
              ServerResponse.validationResponse("Unauthorized request", "E0001")
            );
        } else {
          let qb = await pool.get_connection();
          let response;
          try {
            response = await qb
              .select("merchant_id,type,super_merchant_id")
              .where({
                merchant_key: merchant_key,
                merchant_secret: merchant_secret,
                deleted: 0,
              })
              .get(config.table_prefix + "master_merchant_key_and_secret");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }
          let merchant_details = response[0];
          console.log("🚀 ~ merchant_details:", merchant_details)

          // >>>>>>>>>>>>>>>>>>>>>>>
          // Check Env mode 
          if (merchant_details?.type !== process.env.CHARGES_MODE) {
            return res
              .status(StatusCode.unauthorized)
              .send(
                ServerResponse.validationResponse(
                  "Invalid merchant key passed",
                  400
                )
              );
          }

          if (wallet_id) {
            const condition = {
              wallet_id: wallet_id,
            };

            walletDBModel
              .get_by_id(condition)
              .then(async (result) => {
                console.log("🚀 ~ result1:", result?.data?.sub_merchant_id);
                console.log("🚀 ~ result2:", merchant_details?.merchant_id);
                if (result?.status == 200) {
                  if (
                    merchant_details?.merchant_id ==
                    result?.data?.sub_merchant_id
                  ) {
                    next();
                  } else {
                    return res
                      .status(StatusCode.unauthorized)
                      .send(
                        ServerResponse.validationResponse(
                          "Invalid merchant key passed",
                          400
                        )
                      );
                  }
                } else {
                  return res
                    .status(400)
                    .send(
                      ServerResponse.validationResponse(result?.message, 400)
                    );
                }
              })
              .catch((error) => {
                winston.error(error);
                return res
                  .status(StatusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else if (sub_merchant_id) {
            req.credentials = merchant_details;
            if (merchant_details?.merchant_id == sub_merchant_id) {
              next();
            } else {
              return res
                .status(StatusCode.unauthorized)
                .send(
                  ServerResponse.validationResponse(
                    "Invalid submerchant id passed",
                    400
                  )
                );
            }
          } else if(receiver_id){
            let receiver_response;
            try {
              receiver_response = await axios.get(
                process.env.PAYOUT_SERVER_URL +
                  "/v1/payout/receiver/get-receiver-by-sub-id/" +
                  merchant_details?.merchant_id,
                {
                  headers: {
                    xusername: X_Username,
                    xpassword: X_Password,
                  },
                }
              );
              receiver_response = receiver_response?.data;
              // console.log("🚀 ~ receiver_response:", receiver_response);
              if (receiver_response?.status == 200) {
                console.log("🚀 ~ receiver_id_1:", receiver_id);
                console.log( "🚀 ~ receiver_id_2:", receiver_response?.receiver?.receiver_id);
                if (receiver_response?.receiver?.receiver_id == receiver_id) {
                  req.body.receiver_id = receiver_id;
                  next();
                } else {
                  return res
                    .status(StatusCode.unauthorized)
                    .send(
                      ServerResponse.validationResponse(
                        "Invalid receiver id",
                        400
                      )
                    );
                }
              } else {
                return res
                  .status(StatusCode.unauthorized)
                  .send(
                    ServerResponse.validationResponse("Invalid receiver id", 400)
                  );
              }
            } catch (error) {
              console.log("Error: ", error?.message);
              return receiver_response = {
                status: 400,
                message: "Receiver not found",
              };
            }
          }else {
            req.body.sub_merchant_id = merchant_details?.merchant_id;
            next();
          }
        }
      }
    } catch (error) {
      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },
};
module.exports = WalletValidator;
