const Joi = require("joi").extend(require("@joi/date")).extend(require("joi-currency-code"));;
const { default: axios } = require("axios");
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkifrecordexist = require("./checkifrecordexist");
const logger = require('../../config/logger');

const fundingMethodValidator = {
  update: async (req, res, next) => {
    const schema = Joi.object({
      customer_type: Joi.string().required(),
      account_id: Joi.string()
        .pattern(/^\d{12}$/)
        .required()
        .label("Account id required"),
      funding_source_type: Joi.string().valid("1", "2").required(),
      currency: Joi.string().length(3).required(),
      payer_id: Joi.alternatives()
        .try(Joi.string().valid("ORANGE_MONEY", "MTN_MOMO", "AL_PAY", "MTN", "ORANGE", "AL"), Joi.string().pattern(/AP_/), Joi.number())
        .required()
        .label("Valid Payer id required"),
      MSISDN: Joi.string().when("payer_id", {
        is: Joi.valid("ORANGE_MONEY", "MTN_MOMO", "MTN", "ORANGE"),
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),

      // Optional dynamic fields (can be any other key)
    }).unknown(true); // allows additional unknown keys
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  add: async (req, res, next) => {
    console.log("🚀 ~ req:", req.body)
    const schema = Joi.object({
      customer_type: Joi.string().required(),
      sub_merchant_id: Joi.string().allow("").optional(),
      receiver_id: Joi.string().allow("").optional(),
      // funding_source_country: Joi.string().length(3).required(),  // in new version of API it is not used
      funding_source_type: Joi.string().valid("1", "2", "3").required(),
      currency: Joi.string().length(3).required(),
      payer_id: Joi.alternatives()
        .try(Joi.string().valid("ORANGE_MONEY", "MTN_MOMO", "MTN", "ORANGE"), Joi.number(), Joi.string().pattern(/^AP_\d+$/), Joi.string().pattern(/^MAP_\d+$/))
        .required()
        .label("Valid Payer id required"),
      MSISDN: Joi.string().when("payer_id", {
        is: Joi.valid("ORANGE_MONEY", "MTN_MOMO", "MTN", "ORANGE"),
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    })
      // Ensure at least one of submerchant_id or receiver_id is present
      .custom((value, helpers) => {
        const hasSub =
          value.sub_merchant_id && value.sub_merchant_id.trim() !== "";
        const hasRecv = value.receiver_id && value.receiver_id.trim() !== "";

        if (!hasSub && !hasRecv) {
          return helpers.error("any.custom");
        }

        return value;
      }, "SubMerchant/Receiver Validation")
      .messages({
        "any.custom": "Either sub_merchant_id or receiver_id is required",
      })
      .unknown(true);
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  verify: async (req, res, next) => {
    const schema = Joi.object({
      // isVerified: Joi.string().valid('Yes', 'No').required().label('Verifiication status required'),
      account_id: Joi.string()
        .pattern(/^\d{12}$/)
        .required()
        .label("Account id required"),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  manage_funding: async (req, res, next) => {
    const schema = Joi.object({
      // isVerified: Joi.string().valid('Yes', 'No').required().label('Verifiication status required'),
      account_id: Joi.string()
        .pattern(/^\d{12}$/)
        .required()
        .label("Account id required"),
      is_active:Joi.any().required().valid("1","0").label("Is active required")  
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  list: async (req, res, next) => {
    const schema = Joi.object({
      // isVerified: Joi.string().valid('Yes', 'No').required().label('Verifiication status required'),
      sub_merchant_id: Joi.string().allow("", null).label("Sub merchant id required"),
      receiver_id: Joi.string().allow("", null).label("Receiver id required"),
      currency: Joi.string().allow("", null).label("Currency required"),
    })// Ensure at least one of submerchant_id or receiver_id is present
      .or("sub_merchant_id", "receiver_id")
      .unknown(true);

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  get: async (req, res, next) => {
    const schema = Joi.object({
      submerchant_id: Joi.string().allow("", null).label("Sub merchant id required"),
      currency: Joi.string().allow("", null).label("Currency required"),
      account_id: Joi.string().allow("", null).label("Account id required"),
      receiver_id: Joi.string().allow("", null).label("Receiver id required"),
    });
    try {
      const result = schema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        // Check if request body is completely empty (no keys)
        if (!req.body || Object.keys(req.body).length === 0) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Request body is empty"));
        } else {
          next();
        }
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  add_bulk: async (req, res, next) => {
    const schema = Joi.object({
      customer_type: Joi.string().required(),
      submerchant_id: Joi.string().allow(""),
      receiver_id: Joi.string().allow(""),
      funding_source_country: Joi.string().length(3).required(),
      funding_source_type: Joi.string().valid("1", "2", "3").required(),
      currency: Joi.string().length(3).required(),
      payer_id: Joi.alternatives()
        .try(Joi.string().valid("ORANGE_MONEY", "MTN_MOMO"), Joi.number())
        .required()
        .label("Valid Payer id required"),
      MSISDN: Joi.string().when("payer_id", {
        is: Joi.valid("ORANGE_MONEY", "MTN_MOMO"),
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    })
      .or("submerchant_id", "receiver_id")
      .unknown(true);

    const requestsListSchema = Joi.array().items(schema);

    try {
      // Step 1: Validate input schema
      const { error } = requestsListSchema.validate(req.body);
      if (error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(error.message));
      }

      const X_Username = process.env.X_Username;
      const X_Password = process.env.X_Password;

      const authHeader = req.headers;
      const username = authHeader.xusername;
      const password = authHeader.xpassword;

      let receiver_key = req.headers['receiver-key'];
      let receiver_secret = req.headers['receiver-secret'];

      for (const request of req.body) {
        // Step 2: If submerchant_id is provided, validate it
        if (request.submerchant_id) {
          const isMerchantExist = await checkifrecordexist(
            { id: request.submerchant_id },
            "master_merchant"
          );
          if (!isMerchantExist) {
            return res
              .status(StatusCode.badRequest)
              .send(ServerResponse.validationResponse("Invalid merchant id"));
          }
        }

        // Step 3: If receiver_id is provided, validate access
        if (request.receiver_id) {
          const receiver_response = await axios.get(
            `${process.env.PAYOUT_SERVER_URL}/v1/payout/receiver/get-receiver-by-id/${request.receiver_id}`,
            {
              headers: {
                xusername: X_Username,
                xpassword: X_Password,
              },
            }
          );

          if (receiver_response?.data?.status !== 200) {
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.validationResponse(
                  "Invalid receiver id passed",
                  400
                )
              );
          }

          // Step 4: Validate access keys if headers do not match app credentials
          if (username !== X_Username || password !== X_Password) {
            const receiverAccessList =
              receiver_response?.data?.receiver?.access || [];

            const isAuthorized = receiverAccessList.some(
              (access) =>
                access.receiver_key === receiver_key &&
                access.receiver_secret === receiver_secret
            );

            if (!isAuthorized) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.validationResponse("Unauthorized request")
                );
            }
          }
        }

        // If neither submerchant_id nor receiver_id is valid
        if (!request.submerchant_id && !request.receiver_id) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.validationResponse("Invalid request"));
        }
      }

      // All checks passed for all requests
      return next();
    } catch (error) {
      console.error("Error in add_bulk:", error);
      logger.error(500,{message: error,stack: error?.stack});
      return res
        .status(StatusCode.internalError)
        .send(ServerResponse.validationResponse("Internal Server Error"));
    }
  },
  verify_bulk: async (req, res, next) => {
    const schema = Joi.object({
      // isVerified: Joi.string().valid('Yes', 'No').required().label('Verifiication status required'),
      account_id: Joi.string()
        .pattern(/^\d{12}$/)
        .required()
        .label("Account id required"),
    });
    try {
      const requestsListSchema = Joi.array().items(schema);
      const result = requestsListSchema.validate(req.body);
      if (result.error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      } else {
        next();
      }
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
};
module.exports = fundingMethodValidator;