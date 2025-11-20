const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const axios = require("axios");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const merchantOrderModel = require("../models/merchantOrder");
const enc_dec = require("../utilities/decryptor/decryptor");
const helpers = require("../utilities/helper/general_helper");
const logger = require('../config/logger');
const { constants } = require("buffer");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];

var lookup = {
  bin: async (req, res) => {
    try {
      const bin_number = req.bodyString("bin_number");
      const order_id = req.bodyString("order_id");
      const mode = req.bodyString("mode") === "test" ? "test" : "live";
      const ord_table = mode === "test" ? "test_orders" : "orders";
      const needed_data = await helpers.get_data_list(
        "merchant_id,currency,amount,origin",
        ord_table,
        { order_id }
      );
      const ecom_exist = await helpers.get_ecom_mid_by_merchant_id(
        needed_data?.[0].merchant_id,
        needed_data?.[0].currency,
        mode
      );

      if (ecom_exist.length == 0) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `ecom not supported by merchant`,
              req.body
            )
          );
      }

      const mid_data = await helpers.get_mid_by_merchant_id(
        needed_data?.[0].merchant_id,
        needed_data?.[0].currency,
        mode
      );

      // console.log("mid_data", mid_data);

      const uniquePaymentSchemes = Array.from(
        new Set(mid_data.flatMap((item) => item.payment_schemes.split(",")))
      );
      const params = { bin_number };
      const data = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
      let nutrionoAPIDetails = await helpers.getNutrionoDetails();
      const options = {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-ID": nutrionoAPIDetails.user_id,
          "API-Key": nutrionoAPIDetails.secret,
        },
        data,
        url: process.env.LOOKUP_URL + "bin-lookup",
      };
      const result = await axios(options);
      console.log(options);
      console.log(result.data);

      const lookup_result = {
        country: result.data["country"],
        country_code: result.data["country-code"],
        card_brand: result.data["card-brand"],
        ip_city: result.data["ip-city"],
        ip_blocklists: result.data["ip-blocklists"],
        ip_country_code3: result.data["ip-country-code3"],
        is_commercial: result.data["is-commercial"],
        ip_country: result.data["ip-country"],
        bin_number: result.data["bin-number"],
        issuer: result.data["issuer"],
        issuer_website: result.data["issuer-website"],
        ip_region: result.data["ip-region"],
        valid: result.data["valid"],
        card_type: result.data["card-type"],
        is_prepaid: result.data["is-prepaid"],
        ip_blocklisted: result.data["ip-blocklisted"],
        card_category: result.data["card-category"],
        issuer_phone: result.data["issuer-phone"],
        currency_code: result.data["currency-code"],
        ip_matches_bin: result.data["ip-matches-bin"],
        country_code3: result.data["country-code3"],
        ip_country_code: result.data["ip-country-code"],
      };

      const cardType_show =
        lookup_result.card_type == "DEBIT" ? "Debit card" : "Credit card";
      const cardType =
        lookup_result.card_type == "DEBIT" ? "Debit Card" : "Credit Card";
      const DIType_show =
        lookup_result.country_code3 == "ARE"
          ? "Domestic card"
          : "International card";
      const DIType =
        lookup_result.country_code3 == "ARE"
          ? "Domestic Card"
          : "International Card";
      const DICheck =
        lookup_result.country_code3 == "ARE"
          ? mid_data.some((mid) => mid.domestic === 1)
          : mid_data.some((mid) => mid.international === 1);
      const supportsCardCheck = mid_data.some((mid) =>
        mid.payment_methods.includes(cardType)
      );
      const isSupportedScheme = uniquePaymentSchemes.some(
        (val) => val === lookup_result.card_brand
      );
      if (needed_data?.[0].origin == "SUBSCRIPTION") {
        
        let classes = mid_data?.[0]?.class;
        if(!classes?.includes("cauth")){
          return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `CAUTH is not enabled for this MID`,
              lookup_result
            )
          );
        }
      }
      if (!supportsCardCheck) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `${cardType_show} not supported by merchant`,
              lookup_result
            )
          );
      } else if (!DICheck) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `${DIType_show} not supported by merchant`,
              lookup_result
            )
          );
      } else if (!isSupportedScheme) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              "Card scheme/ class not supported by merchant",
              lookup_result
            )
          );
      }

      let count = 0;
      for (let index = 0; index < mid_data.length; index++) {
        const midData = mid_data[index];
        const checkmid = await checkMidIsValid(
          midData?.midId,
          lookup_result,
          needed_data[0]
        );
        if (checkmid) {
          count += 1;
        }
      }

      if (count === 0) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              "Card not supported by merchant",
              lookup_result
            )
          );
      }

      return res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            lookup_result,
            "Details fetched successfully."
          )
        );
    } catch (error) {
      console.log(error);
      logger.error(500,{message: error,stack: error.stack}); 
      return res
        .status(statusCode.badRequest)
        .send(response.errormsg(error?.response?.data?.error || error.message));
    }
  },

  ip: async (req, res) => {
    try {
      const params = {
        ip: req.bodyString("ip"),
      };

      const data = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
      let nutrionoAPIDetails = await helpers.getNutrionoDetails();
      const options = {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-ID": nutrionoAPIDetails.user_id,
          "API-Key": nutrionoAPIDetails.secret,
        },
        data,
        url: process.env.LOOKUP_URL + "ip-info",
      };

      axios(options)
        .then((result) => {
          let lookup_result = {
            region_code: result.data["region-code"],
            country_code: result.data["country-code"],
            country: result.data["country"],
            city: result.data["city"],
            timezone: result.data["timezone"],
            ip: result.data["ip"],
            latitude: result.data["latitude"],
            valid: result.data["valid"],
            is_v4_mapped: result.data["is-v4-mapped"],
            hostname: result.data[" hostname"],
            continent_code: result.data["continent-code"],
            host_domain: result.data["host-domain"],
            currency_code: result.data["currency-code"],
            region: result.data["region"],
            is_bogon: result.data["is-bogon"],
            country_code3: result.data["country-code3"],
            is_v6: result.data["is-v6"],
            longitude: result.data["longitude"],
          };
          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                lookup_result,
                "Details fetched successfully."
              )
            );
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          res.status(statusCode.ok).send(response.errormsg(error.message));
        }); // wrap in async function
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.ok).send(response.errormsg(error.message));
    }
  },

  routebin: async (req, res, next) => {
    try {
      const { card_id } = req.body;
      if (card_id) {
        const dec_card_id = encrypt_decrypt("decrypt", card_id);
        const findcard = await merchantOrderModel.selectOne(
          "*",
          { id: dec_card_id },
          "customers_cards"
        );
        if (findcard) {
          let card_no = await enc_dec.dynamic_decryption(
            findcard.card_number,
            findcard.cipher_id
          );
          let lookup_result;
          const bin_number = card_no.substring(0, 6);
          const params = {
            bin_number: bin_number,
          };
          const data = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");
          let nutrionoAPIDetails = await helpers.getNutrionoDetails();
          const options = {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              "User-ID": nutrionoAPIDetails.user_id,
              "API-Key": nutrionoAPIDetails.secret,
            },
            data,
            url: process.env.LOOKUP_URL + "bin-lookup",
          };
          axios(options).then((result) => {
            lookup_result = {
              country: result.data["country"],
              country_code: result.data["country-code"],
              card_brand: result.data["card-brand"],
              ip_city: result.data["ip-city"],
              ip_blocklists: result.data["ip-blocklists"],
              ip_country_code3: result.data["ip-country-code3"],
              is_commercial: result.data["is-commercial"],
              ip_country: result.data["ip-country"],
              bin_number: result.data["bin-number"],
              issuer: result.data["issuer"],
              issuer_website: result.data["issuer-website"],
              ip_region: result.data["ip-region"],
              valid: result.data["valid"],
              card_type: result.data["card-type"],
              is_prepaid: result.data["is-prepaid"],
              ip_blocklisted: result.data["ip-blocklisted"],
              card_category: result.data["card-category"],
              issuer_phone: result.data["issuer-phone"],
              currency_code: result.data["currency-code"],
              ip_matches_bin: result.data["ip-matches-bin"],
              country_code3: result.data["country-code3"],
              ip_country_code: result.data["ip-country-code"],
              card_holder_name: findcard.name_on_card,
              card: card_no,
            };
            req.card_details = lookup_result;

            next();
          });
        } else {
          return res
            .status(statusCode.badRequest)
            .send(response.errormsg("Invalid Card id"));
        }
      } else {
        let lookup_result;
        const bin_number = req.body.card?.substring(0, 6);
        const params = {
          bin_number: bin_number,
        };
        const data = Object.keys(params)
          .map((key) => `${key}=${encodeURIComponent(params[key])}`)
          .join("&");
        let nutrionoAPIDetails = await helpers.getNutrionoDetails();
        const options = {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "User-ID": nutrionoAPIDetails.user_id,
            "API-Key": nutrionoAPIDetails.secret,
          },
          data,
          url: process.env.LOOKUP_URL + "bin-lookup",
        };
        axios(options)
          .then((result) => {
            lookup_result = {
              country: result.data["country"],
              country_code: result.data["country-code"],
              card_brand: result.data["card-brand"],
              ip_city: result.data["ip-city"],
              ip_blocklists: result.data["ip-blocklists"],
              ip_country_code3: result.data["ip-country-code3"],
              is_commercial: result.data["is-commercial"],
              ip_country: result.data["ip-country"],
              bin_number: result.data["bin-number"],
              issuer: result.data["issuer"],
              issuer_website: result.data["issuer-website"],
              ip_region: result.data["ip-region"],
              valid: result.data["valid"],
              card_type: result.data["card-type"],
              is_prepaid: result.data["is-prepaid"],
              ip_blocklisted: result.data["ip-blocklisted"],
              card_category: result.data["card-category"],
              issuer_phone: result.data["issuer-phone"],
              currency_code: result.data["currency-code"],
              ip_matches_bin: result.data["ip-matches-bin"],
              country_code3: result.data["country-code3"],
              ip_country_code: result.data["ip-country-code"],
              card_holder_name: req.bodyString("name"),
              card: req.body.card,
            };
            req.card_details = lookup_result;
            next();
          })
          .catch((error) => {
            logger.error(500,{message: error,stack: error.stack}); 
            return res
              .status(statusCode.ok)
              .send(response.errormsg(error.request.data["api-error-msg"]));
          });
      }
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return res.status(statusCode.ok).send(response.errormsg(error.message));
    }
  },

  routebinNEW: async (req, res, next) => {
    try {
      const { card_id } = req.body;
      let bin_number;
      let card_no;
      const order_id = req.bodyString("order_id");
      const mode =
        req.bodyString("payment_mode") === "test" ||
        req.bodyString("env") === "test"
          ? "test"
          : "live";

      const ord_table = mode === "test" ? "test_orders" : "orders";
      const needed_data = await helpers.get_data_list(
        "merchant_id,currency,amount",
        ord_table,
        { order_id }
      );
      const mid_data = await helpers.get_mid_by_merchant_id(
        needed_data[0].merchant_id,
        needed_data[0].currency,
        mode
      );

      const ecom_exist = await helpers.get_ecom_mid_by_merchant_id(
        needed_data[0].merchant_id,
        needed_data[0].currency,
        mode
      );

      if (ecom_exist.length == 0) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `ecom not supported by merchant`,
              req.body
            )
          );
      }

      if (card_id) {
        const dec_card_id = encrypt_decrypt("decrypt", card_id);
        const findcard = await merchantOrderModel.selectOne(
          "*",
          { id: dec_card_id },
          "customers_cards"
        );
        if (!findcard) {
          return res
            .status(statusCode.badRequest)
            .send(response.errormsg("Invalid Card id"));
        }
        card_no = await enc_dec.dynamic_decryption(
          findcard.card_number,
          findcard.cipher_id
        );
        bin_number = card_no.substring(0, 6);
      } else {
        card_no = req.body.card;
        bin_number = req.body.card?.substring(0, 6);
      }

      const params = { bin_number: bin_number };
      const data = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
        let nutrionoAPIDetails = await helpers.getNutrionoDetails();
      const options = {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-ID":nutrionoAPIDetails.user_id,
          "API-Key": nutrionoAPIDetails.secret,
        },
        data,
        url: process.env.LOOKUP_URL + "bin-lookup",
      };
      const result = await axios(options);
      //   const result = {data:{
      //     "bin-number": "471921",
      //     "card-brand": "VISA",
      //     "card-category": "TRADITIONAL",
      //     "card-type": "CREDIT",
      //     "country": "UNITED STATES",
      //     "country-code": "US",
      //     "country-code3": "USA",
      //     "currency-code": "USD",
      //     "ip-blocklisted": false,
      //     "ip-blocklists": [],
      //     "ip-city": "",
      //     "ip-country": "",
      //     "ip-country-code": "",
      //     "ip-country-code3": "",
      //     "ip-matches-bin": false,
      //     "ip-region": "",
      //     "is-commercial": false,
      //     "is-prepaid": false,
      //     "issuer": "BANK OF AMERICA - CONSUMER CREDIT",
      //     "issuer-phone": "",
      //     "issuer-website": "",
      //     "valid": true
      // }};
      const lookup_result = {
        country: result.data["country"],
        country_code: result.data["country-code"],
        card_brand: result.data["card-brand"],
        ip_city: result.data["ip-city"],
        ip_blocklists: result.data["ip-blocklists"],
        ip_country_code3: result.data["ip-country-code3"],
        is_commercial: result.data["is-commercial"],
        ip_country: result.data["ip-country"],
        bin_number: result.data["bin-number"],
        issuer: result.data["issuer"],
        issuer_website: result.data["issuer-website"],
        ip_region: result.data["ip-region"],
        valid: result.data["valid"],
        card_type: result.data["card-type"],
        is_prepaid: result.data["is-prepaid"],
        ip_blocklisted: result.data["ip-blocklisted"],
        card_category: result.data["card-category"],
        issuer_phone: result.data["issuer-phone"],
        currency_code: result.data["currency-code"],
        ip_matches_bin: result.data["ip-matches-bin"],
        country_code3: result.data["country-code3"],
        ip_country_code: result.data["ip-country-code"],
        card_holder_name: req.bodyString("name"),
        card: card_no,
        type: "",
      };
      req.card_details = lookup_result;

      const cardType_show =
        lookup_result.card_type == "DEBIT" ? "Debit card" : "Credit card";
      const cardType =
        lookup_result.card_type == "DEBIT" ? "Debit Card" : "Credit Card";
      const DIType_show =
        lookup_result.country_code3 == "ARE"
          ? "Domestic card"
          : "International card";
      const DIType =
        lookup_result.country_code3 == "ARE"
          ? "Domestic Card"
          : "International Card";
      const DICheck =
        lookup_result.country_code3 == "ARE"
          ? mid_data.some((mid) => mid.domestic === 1)
          : mid_data.some((mid) => mid.international === 1);
      const supportsCardCheck = mid_data.some((mid) =>
        mid.payment_methods.includes(cardType)
      );
      const uniquePaymentSchemes = Array.from(
        new Set(mid_data.flatMap((item) => item.payment_schemes.split(",")))
      );

      const isSupportedScheme = uniquePaymentSchemes.some(
        (val) => val === lookup_result.card_brand
      );
      if (!supportsCardCheck) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `${cardType_show} not supported by merchant`,
              lookup_result
            )
          );
      } else if (!DICheck) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              `${DIType_show} not supported by merchant`,
              lookup_result
            )
          );
      } else if (!isSupportedScheme) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              "Card scheme/ class not supported by merchant",
              lookup_result
            )
          );
      }

      let count = 0;
      for (let index = 0; index < mid_data.length; index++) {
        const midData = mid_data[index];
        const checkmid = await checkMidIsValid(
          midData?.midId,
          lookup_result,
          needed_data[0]
        );
        if (checkmid) {
          count += 1;
        }
      }

      if (count === 0) {
        return res
          .status(statusCode.badRequest)
          .send(
            response.errorMsgWithData(
              "Card not supported by merchant",
              lookup_result
            )
          );
      }

      next();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return res.status(statusCode.ok).send(response.errormsg(error.message));
    }
  },

  checkbrandingcard: async (req, res, next) => {
    try {
      const { card_id } = req.body;
      let bin_number;
      let card_no;
      const lookup_result = req.card_details;
      const order_id = req.bodyString("order_id");
      const mode =
        req.bodyString("payment_mode") === "test" ||
        req.bodyString("env") === "test"
          ? "test"
          : "live";
      const ord_table = mode === "test" ? "test_orders" : "orders";
      const needed_data = await helpers.get_data_list(
        "merchant_id,currency,amount",
        ord_table,
        { order_id }
      );
      const mid_data = await helpers.get_mid_by_merchant_id(
        needed_data[0].merchant_id,
        needed_data[0].currency,
        mode
      );
      const query = `SELECT * FROM ${config.table_prefix}master_merchant where id = ${needed_data[0].merchant_id}`;
      const bradingDetails = await merchantOrderModel.order_query(query);
      const cardType_show =
        lookup_result.card_type == "DEBIT" ? "DEBIT CARD" : "CREDIT CARD";
      const DIType_show =
        lookup_result.country_code3 == "ARE"
          ? "DOMESTIC CARD"
          : "INTERNATIONAL CARD";

      if (mode === "test") {
        if (req.bodyString("card_id")) {
          if (bradingDetails[0].test_stored_card_scheme) {
            const cardArr =
              bradingDetails[0].test_stored_card_scheme.split(",");
            if (!cardArr.includes(DIType_show)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    `${DIType_show} not supported by merchant`,
                    lookup_result
                  )
                );
            }
            if (!cardArr.includes(lookup_result.card_brand)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Card scheme not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_commercial &&
              !cardArr.includes("CORPORATE CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Corporate card is not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_prepaid &&
              !cardArr.includes("PREPAID CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Prepaid card is not supported by merchant",
                    lookup_result
                  )
                );
            }
          }
        } else {
          if (bradingDetails[0].test_card_payment_scheme) {
            const cardArr =
              bradingDetails[0].test_card_payment_scheme.split(",");
            if (!cardArr.includes(DIType_show)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    `${DIType_show} not supported by merchant`,
                    lookup_result
                  )
                );
            }
            if (!cardArr.includes(lookup_result.card_brand)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Card scheme not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_commercial &&
              !cardArr.includes("CORPORATE CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Corporate card is not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_prepaid &&
              !cardArr.includes("PREPAID CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Prepaid card is not supported by merchant",
                    lookup_result
                  )
                );
            }
          }
        }
      } else {
        if (req.bodyString("card_id")) {
          if (bradingDetails[0].stored_card_scheme) {
            const cardArr = bradingDetails[0].stored_card_scheme.split(",");
            if (!cardArr.includes(DIType_show)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    `${DIType_show} not supported by merchant`,
                    lookup_result
                  )
                );
            }
            if (!cardArr.includes(lookup_result.card_brand)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Card scheme not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_commercial &&
              !cardArr.includes("CORPORATE CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Corporate card is not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_prepaid &&
              !cardArr.includes("PREPAID CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Prepaid card is not supported by merchant",
                    lookup_result
                  )
                );
            }
          }
        } else {
          if (bradingDetails[0].card_payment_scheme) {
            const cardArr = bradingDetails[0].card_payment_scheme.split(",");
            if (!cardArr.includes(DIType_show)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    `${DIType_show} not supported by merchant`,
                    lookup_result
                  )
                );
            }
            if (!cardArr.includes(lookup_result.card_brand)) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Card scheme not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_commercial &&
              !cardArr.includes("CORPORATE CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Corporate card is not supported by merchant",
                    lookup_result
                  )
                );
            }

            if (
              lookup_result?.is_prepaid &&
              !cardArr.includes("PREPAID CARD")
            ) {
              return res
                .status(statusCode.badRequest)
                .send(
                  response.errorMsgWithData(
                    "Prepaid card is not supported by merchant",
                    lookup_result
                  )
                );
            }
          }
        }
      }

      next();
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return res.status(statusCode.ok).send(response.errormsg(error.message));
    }
  },

  mobile_lookup_bin: async (req, res, next) => {
    try {
      const bin_number = req.body.card_no?.substring(0, 6);
      const params = {
        bin_number: bin_number,
      };
      const data = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
      let nutrionoAPIDetails = await helpers.getNutrionoDetails();
      const options = {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-ID": nutrionoAPIDetails.user_id,
          "API-Key": nutrionoAPIDetails.secret,
        },
        data,
        url: process.env.LOOKUP_URL + "bin-lookup",
      };
      axios(options)
        .then((result) => {
          lookup_result = {
            country: result.data["country"],
            country_code: result.data["country-code"],
            card_brand: result.data["card-brand"],
            ip_city: result.data["ip-city"],
            ip_blocklists: result.data["ip-blocklists"],
            ip_country_code3: result.data["ip-country-code3"],
            is_commercial: result.data["is-commercial"],
            ip_country: result.data["ip-country"],
            bin_number: result.data["bin-number"],
            issuer: result.data["issuer"],
            issuer_website: result.data["issuer-website"],
            ip_region: result.data["ip-region"],
            valid: result.data["valid"],
            card_type: result.data["card-type"],
            is_prepaid: result.data["is-prepaid"],
            ip_blocklisted: result.data["ip-blocklisted"],
            card_category: result.data["card-category"],
            issuer_phone: result.data["issuer-phone"],
            currency_code: result.data["currency-code"],
            ip_matches_bin: result.data["ip-matches-bin"],
            country_code3: result.data["country-code3"],
            ip_country_code: result.data["ip-country-code"],
          };
          req.card_details = lookup_result;
          next();
        })
        .catch((error) => {
          logger.error(500,{message: error,stack: error.stack}); 
          return res
            .status(statusCode.ok)
            .send(response.errormsg(error.request.data["api-error-msg"]));
        });
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack}); 
      return res.status(statusCode.ok).send(response.errormsg(error.message));
    }
  },
};

async function checkMidIsValid(mid, card_details, order_details) {
  try{
  const mid_details = await merchantOrderModel.selectDynamicONE(
    "payment_methods,payment_schemes,domestic,international,minTxnAmount,maxTxnAmount,currency_id as currency",
    { id: mid, deleted: 0 },
    "mid"
  );
  const currency_details = await merchantOrderModel.selectDynamicONE(
    "code",
    { id: mid_details?.currency },
    "master_currency"
  );
  if (
    !mid_details?.payment_methods.toUpperCase().includes(card_details.card_type)
  ) {
    return false;
  }
  if (
    !mid_details.payment_schemes.toUpperCase().includes(card_details.card_brand)
  ) {
    return false;
  }
  if (
    order_details.amount > mid_details.maxTxnAmount ||
    order_details.amount < mid_details.minTxnAmount
  ) {
    return false;
  }
  if (currency_details.code != order_details.currency) {
    return false;
  }
  let is_domestic_or_international = "";
  if (card_details.country_code3 == "ARE") {
    is_domestic_or_international = "Domestic";
  } else {
    is_domestic_or_international = "International";
  }
  if (is_domestic_or_international == "Domestic" && mid_details.domestic == 0) {
    return false;
  }
  if (
    is_domestic_or_international == "International" &&
    mid_details.international == 0
  ) {
    return false;
  }
  return true;
}catch(error){
   logger.error(500,{message: error,stack: error.stack}); 
}
}

module.exports = lookup;
