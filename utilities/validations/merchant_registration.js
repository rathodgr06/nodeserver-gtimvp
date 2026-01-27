const Joi = require("joi").extend(require("@joi/date")).extend(require('joi-currency-code'));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const date_formatter = require("../date_formatter");
const idChecker = require("./idchecker");
const checkifrecordexist = require("./checkifrecordexist");
const check_expiry = require("./checkexpiery_referral");
const validate_mobile = require("./validate_mobile");
const MerchantRegistrationModel = require("../../models/merchant_registration");
const enc_dec = require("../../utilities/decryptor/decryptor");
const checkifrecordexistandexpiration = require("../../utilities/validations/checkifrecordexistandexpiration");
const helpers = require("../helper/general_helper");
const country = require("../../controller/country");
const logger = require('../../config/logger');

const MerchantRegister = {
  api_register: async (req, res, next) => {
    const schema = Joi.object({
      email: Joi.string()
        .email()
        .required()
        .error(() => new Error("Valid email required")),

      mobile_no: Joi.string()
        .pattern(/^[0-9]+$/)
        .required()
        .error(() => new Error("Valid mobile required")),

      code: Joi.string()
        .required()
        .error(() => new Error("Valid mobile code required")),

      registered_business_address: Joi.string()
        .required()
        .error(() => new Error("Business registered country required")),

      legal_business_name: Joi.string()
        .required()
        .error(() => new Error("Business name required")),

      referral_code: Joi.string()
        .optional()
        .allow("")
        .error(() => new Error("Invalid referral code")),

      webhook_url: Joi.string()
        .uri()
        .optional()
        .allow("")
        .error(() => new Error("Valid webhook url required")),
    });

    try {
      /* ───── Joi Validation ───── */
      const { error } = schema.validate(req.body);
      if (error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(error.message));
      }

      const email = req.bodyString("email");
      const mobileNo = req.bodyString("mobile_no");
      const code = req.bodyString("code");
      const referralCode = req.bodyString("referral_code");

      /* ───── Referral Code Hard Validation (SECURITY FIX) ───── */
      if (referralCode && !/^[A-Za-z0-9_-]+$/.test(referralCode)) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid referral code"));
      }

      /* ───── Validate Mobile Country ───── */
      const code_country = await validate_mobile(code, "country", mobileNo);
      if (!code_country.status) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(code_country.message));
      }

      /* ───── Email Exists Check ───── */
      const emailExists = await checkifrecordexist(
        {
          email,
          mobile_no_verified: 0,
          email_verified: 1,
        },
        "master_super_merchant",
      );

      if (emailExists) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              `Merchant with email ${email} already exits`,
            ),
          );
      }

      /* ───── Referral Validation (Only if Provided) ───── */
      if (referralCode) {
        const referralExists = await checkifrecordexist(
          {
            referral_code: referralCode,
            status: 0,
            deleted: 0,
          },
          "referrers",
        );

        if (!referralExists) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid referral code"));
        }

        const referralExpired = await check_expiry(referralCode, "referrers");
        if (referralExpired) {
          return res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Referral code has expired"),
            );
        }
      }

      /* ───── All checks passed ───── */
      return next();
    } catch (error) {
      logger.error("API_REGISTER_VALIDATION_FAILED", {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse("Invalid request"));
    }
  },
  register: async (req, res, next) => {
    const schema = Joi.object({
      email: Joi.string()
        .email()
        .required()
        .error(() => new Error("Valid email required")),

      mobile_no: Joi.string()
        .pattern(/^[0-9]+$/)
        .required()
        .error(() => new Error("Valid mobile required")),

      code: Joi.string()
        .required()
        .error(() => new Error("Valid mobile code required")),

      registered_business_address: Joi.string()
        .required()
        .error(() => new Error("Business registered country required")),

      legal_business_name: Joi.string()
        .required()
        .error(() => new Error("Business name required")),

      referral_code: Joi.string()
        .optional()
        .allow("")
        .error(() => new Error("Invalid referral code")),
    });

    try {
      /* ───── Joi Validation ───── */
      const { error } = schema.validate(req.body);
      if (error) {
        return res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(error.message));
      }

      const email = req.bodyString("email");
      const mobileNo = req.bodyString("mobile_no");
      const code = req.bodyString("code");
      const referralCode = req.bodyString("referral_code");

      /* ───── Referral Code HARD BLOCK (SECURITY) ───── */
      if (referralCode && !/^[A-Za-z0-9_-]+$/.test(referralCode)) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid referral code"));
      }

      /* ───── Validate Mobile Country ───── */
      const code_country = await validate_mobile(code, "country", mobileNo);
      if (!code_country.status) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(code_country.message));
      }

      /* ───── Email Checks ───── */
      const emailExists = await checkifrecordexist(
        {
          email,
          mobile_no_verified: 0,
          email_verified: 1,
        },
        "master_super_merchant",
      );

      if (emailExists) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              `Merchant with email ${email} already exists`,
            ),
          );
      }

      const verifyLinkPending = await checkifrecordexist(
        {
          email,
          mobile_no_verified: 1,
          email_verified: 1,
        },
        "master_super_merchant",
      );

      if (verifyLinkPending) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              "This email is pending for verification, please check your email inbox",
            ),
          );
      }

      /* ───── Referral Checks (ONLY if provided) ───── */
      if (referralCode) {
        const referralExists = await checkifrecordexist(
          {
            referral_code: referralCode,
            status: 0,
            deleted: 0,
          },
          "referrers",
        );

        if (!referralExists) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid referral code"));
        }

        const referralExpired = await check_expiry(referralCode, "referrers");
        if (referralExpired) {
          return res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Referral code has expired"),
            );
        }
      }

      /* ───── All validations passed ───── */
      return next();
    } catch (error) {
      logger.error("REGISTER_VALIDATION_FAILED", {
        message: error.message,
        stack: error.stack,
      });

      return res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse("Invalid request"));
    }
  },
  resend_link: async (req, res, next) => {
    const schema = Joi.object().keys({
      email: Joi.string()
        .email()
        .required()
        .error(() => {
          return new Error("Valid email required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let email_exits = await checkifrecordexist(
          { email: req.bodyString("email") },
          "master_super_merchant",
        );
        if (!email_exits) {
          res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse(
                `Merchant with email ${req.bodyString("email")} is not exits`,
              ),
            );
        } else {
          let rec_exits = await checkifrecordexist(
            { email: req.bodyString("email"), password: "" },
            "master_super_merchant",
          );
          if (rec_exits) {
            next();
          } else {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.validationResponse(
                  `Merchant with email ${req.bodyString(
                    "email",
                  )} has already set password. Please Login.`,
                ),
              );
          }
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  verify_link: async (req, res, next) => {
    const schema = Joi.object().keys({
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid token required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let link_valid = await checkifrecordexistandexpiration(
          { token: req.bodyString("token"), is_expired: 0 },
          "master_merchant_password_reset",
        );
        if (link_valid) {
          res
            .status(StatusCode.ok)
            .send(
              ServerResponse.successmsg("link is valid, please reset password"),
            );
        } else {
          res
            .status(StatusCode.ok)
            .send(ServerResponse.errormsg("link expired or invalid token"));
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  reset_password: async (req, res, next) => {
    const schema = Joi.object().keys({
      password: Joi.string()
        .min(8)
        .max(15)
        .required()
        .pattern(
          new RegExp(
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$_!%*?&])[A-Za-z\d$@$_!%*#?&]{8,}$/,
          ),
        )
        .messages({
          "string.pattern.base":
            "Password should contain at least 8 characters long, one alphabet, one number and one special character,no white-spaces.",
          "string.empty": "Password should not be an empty",
          "any.required": "Password required",
          "string.max": "Password must have a maximum of 15 characters",
        }),
      confirm_password: Joi.any()
        .equal(Joi.ref("password"))
        .required()
        .label("Confirm password")
        .options({
          messages: { "any.only": "{{#label}} does not match" },
        }),
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Valid token required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let link_valid = await checkifrecordexistandexpiration(
          { token: req.bodyString("token"), is_expired: 0 },
          "master_merchant_password_reset",
        );
        if (link_valid) {
          next();
        } else {
          res
            .status(StatusCode.ok)
            .send(ServerResponse.errormsg("link expired or invalid token"));
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },

  reset_merchant_password: async (req, res, next) => {
    const schema = Joi.object().keys({
      email: Joi.string()
        .email()
        .required()
        .error(() => {
          return new Error("Valid email required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let email_exits = await checkifrecordexist(
          { email: req.bodyString("email") },
          "master_super_merchant",
        );
        if (!email_exits) {
          res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.successmsg(
                `If your account is identified, you will be receiving an email to change your password.`,
              ),
            );
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  forgot_2fa: async (req, res, next) => {
    const schema = Joi.object().keys({
      email: Joi.string()
        .email()
        .required()
        .error(() => {
          return new Error("Valid email required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let email_exits = await checkifrecordexist(
          { email: req.bodyString("email") },
          "master_super_merchant",
        );
        if (!email_exits) {
          res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.successmsg(
                `If your account is identified, you will be receiving an email to reset 2fa.`,
              ),
            );
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  twoFA: async (req, res, next) => {
    const schema = Joi.object().keys({
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Token required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let link_valid = await checkifrecordexistandexpiration(
          { token: req.bodyString("token"), is_expired: 0 },
          "twofa_authenticator",
        );
        if (link_valid) {
          next();
        } else {
          res
            .status(StatusCode.ok)
            .send(ServerResponse.errormsg("Token is not valid or expired."));
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  verify_2fa: async (req, res, next) => {
    const schema = Joi.object().keys({
      token: Joi.string()
        .required()
        .error(() => {
          return new Error("Token required");
        }),
      pin: Joi.string()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
        .error(() => {
          return new Error("Valid Pin Required");
        }),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        let link_valid = await checkifrecordexistandexpiration(
          { token: req.bodyString("token"), is_expired: 0 },
          "twofa_authenticator",
        );
        if (link_valid) {
          next();
        } else {
          res
            .status(StatusCode.ok)
            .send(ServerResponse.errormsg("Token is not valid or expired."));
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  api_register_submerchant: async (req, res, next) => {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        mobile_no: Joi.string()
          .pattern(/^[0-9]+$/)
          .required(),
        code: Joi.string().required(),
        registered_business_address: Joi.string().required(),
        full_address: Joi.string().allow("").optional(),
        legal_business_name: Joi.string().required(),
        referral_code: Joi.string().allow("").optional(),
        webhook_url: Joi.string().uri().allow("").optional(),
        super_merchant_id: Joi.string().required(),
        inherit_mid: Joi.boolean()
          .truthy("1", "true", 1)
          .falsy("0", "false", 0)
          .required(),
      });

      const { error } = schema.validate(req.body, { abortEarly: true });
      if (error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(error.message));
      }

      // SAFE reads
      const email = helpers.safeBody(req, "email");
      const mobileNo = helpers.safeBody(req, "mobile_no");
      const code = helpers.safeBody(req, "code");
      const referralCode = helpers.safeBody(req, "referral_code");
      const superMerchantId = helpers.safeBody(req, "super_merchant_id");

      // Super merchant validation
      const validSuperMerchantId = await checkifrecordexist(
        { id: superMerchantId },
        "master_super_merchant",
      );
      if (!validSuperMerchantId) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Invalid super merchant id"));
      }

      // Email check
      const emailExists = await checkifrecordexist(
        { email },
        "master_merchant",
      );
      if (emailExists) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              `Merchant with email ${email} already exists`,
            ),
          );
      }

      // Mobile validation
      const codeCountry = await validate_mobile(code, "country", mobileNo);
      if (!codeCountry?.status) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              codeCountry?.message || "Invalid mobile",
            ),
          );
      }

      // Referral validation
      if (referralCode) {
        const referralExists = await checkifrecordexist(
          { referral_code: referralCode, status: 0, deleted: 0 },
          "referrers",
        );
        if (!referralExists) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid referral code"));
        }

        const isExpired = await check_expiry(referralCode, "referrers");
        if (isExpired) {
          return res
            .status(StatusCode.badRequest)
            .send(
              ServerResponse.validationResponse("Referral code has expired"),
            );
        }
      }

      // ✔ All validations passed
      return next();
    } catch (err) {
      // NEVER crash from validation
      logger.error("Submerchant validation failed", {
        message: err?.message,
        stack: err?.stack,
      });

      return res
        .status(StatusCode.internalError)
        .send(ServerResponse.errormsg("Unable to process request"));
    }
  },
  add_mid: async (req, res, next) => {
    const schema = Joi.object().keys({
      mid_id: Joi.string()
        .optional()
        .allow("")
        .error(() => {
          return new Error("Valid mid id required");
        }),
      psp: Joi.alternatives().conditional("mid_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("valid psp required");
          }),
        otherwise: Joi.optional(""),
      }),
      key: Joi.alternatives().conditional("mid_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("valid key required");
          }),
        otherwise: Joi.optional(""),
      }),
      secret: Joi.alternatives().conditional("mid_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("valid secret required");
          }),
        otherwise: Joi.optional(""),
      }),
      currency: Joi.alternatives().conditional("mid_id", {
        is: "",
        then: Joi.string()
          .currency()
          .required()
          .error(() => {
            return new Error("valid currency required");
          }),
        otherwise: Joi.optional(""),
      }),
      country: Joi.alternatives().conditional("mid_id", {
        is: "",
        then: Joi.string()
          .required()
          .error(() => {
            return new Error("valid country required");
          }),
        otherwise: Joi.optional(""),
      }),
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        if (req.bodyString("mid_id") != "") {
          let mid_exits = await checkifrecordexist(
            { id: req.bodyString("mid_id"), status: 0, deleted: 0 },
            "mid",
          );
          if (!mid_exits) {
            res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse(`mid id is not valid`));
          } else {
            next();
          }
        } else {
          next();
        }
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      console.log(error);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  updateProfile: async (req, res, next) => {
    const subMerchantSchema = Joi.object({
      sub_merchant_id: Joi.string().pattern(/^\d+$/).required().messages({
        "string.pattern.base": "Sub merchant ID must contain only numbers",
        "any.required": "Sub merchant ID is required",
      }),
      legal_business_name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
          "string.empty": "Legal business name is required",
          "string.min":
            "Legal business name must be at least 2 characters long",
          "string.max": "Legal business name cannot exceed 100 characters",
        }),
      registered_business_address: Joi.string()
        .trim()
        .min(3)
        .max(3)
        .required()
        .messages({
          "string.empty": "Registered business address is required",
          "string.min": "Address must be at least 3 characters long",
          "string.max": "Address cannot exceed 3 characters",
        }),
      full_address: Joi.string()
        .allow("")
        .optional()
        .error(() => {
          return new Error("Business full address");
        }),
      email: Joi.string().email().required().messages({
        "string.email": "Email must be a valid email address",
        "any.required": "Email is required",
      }),
      code: Joi.string()
        .pattern(/^\d{1,4}$/)
        .required()
        .messages({
          "string.pattern.base": "Code must be a valid country code (e.g., 91)",
          "any.required": "Code is required",
        }),
      mobile_no: Joi.string()
        .pattern(/^\d{7,15}$/)
        .required()
        .messages({
          "string.pattern.base":
            "Mobile number must be between 7 and 15 digits",
          "any.required": "Mobile number is required",
        }),
    });
    try {
      const result = subMerchantSchema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.ok)
          .send(ServerResponse.errormsg(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      logger.error(400, { message: error, stack: error?.stack });
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
};
module.exports = MerchantRegister;
