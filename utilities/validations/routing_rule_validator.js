const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");

const RoutingRuleFunction = require("./routing_rule_function");
const { type } = require("os");
const helpers = require("../helper/general_helper");
const validator = require('validator');
const { default: axios } = require("axios");

const rule_validation = {
  add: async (req, res, next) => {
    const schema = Joi.object().keys({
      submerchant_id: Joi.string()
        .required()
        .error(() => {
          return new Error("Submerchant id is required");
        }),
      env: Joi.string()
        .required()
        .error(() => {
          return new Error("Env is required");
        }),
      rule_name: Joi.string()
        .required()
        .error(() => {
          return new Error("Rule name is required");
        }),
      payment_method: Joi.string()
        .required()
        .error(() => {
          return new Error("Payment method is required");
        }),
      payment_method: Joi.string()
        .valid("card_payment", "stored_card")
        .required()
        .error(() => {
          return new Error("Rules not applicable for Apple pay and Samsung Pay");
        }),
      routing_rule: Joi.string()
        .required()
        .error(() => {
          return new Error("Routing rule is required");
        }),
      id: Joi.string()
        .optional()
        .error(() => {
          return new Error("Routing rule is required");
        }),
      json: Joi.any()
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      }
      let rule_string = req.body.routing_rule;
      if (rule_string.includes('&lt;')) {
        rule_string = rule_string.replace(/&lt;/g, '<')
      }

      if (rule_string.includes('&gt;')) {
        rule_string = rule_string.replace(/&gt;/g, '>')
      }

      rule_string = helpers.makeValidJson(rule_string)

      let checkAllAttribute = await checkAllAttributeHasValidValue(rule_string);
      if (checkAllAttribute.status) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              checkAllAttribute.message
            )
          );
      }
      // const rule_result = await RoutingRuleFunction.checkForValidRule(
      //   rule_string
      // );
      // if (!rule_result) {
      //   return res
      //     .status(StatusCode.badRequest)
      //     .send(ServerResponse.validationResponse("Rule is missing something, please check again"));
      // }
      const thenCondition = await RoutingRuleFunction.checkForThen(rule_string);

      if (!thenCondition) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse(
              "Missing then keyword in the rule"
            )
          );
      }

      const andCondition = await RoutingRuleFunction.validatePatternForAnd(
        rule_string
      );
      if (!andCondition) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Rule missing and condition")
          );
      }

      const mid_result = await RoutingRuleFunction.checkMid(req);


      if (!mid_result.flag) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse("Selected mid not found."));
      }

      const attribute_result = await RoutingRuleFunction.checkAttribute(req);

      if (!attribute_result) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Selected attribute is not found")
          );
      }

      const countryResult = await RoutingRuleFunction.checkCountry(rule_string);

      if (!countryResult.status) {
        return res
          .status(StatusCode.badRequest)
          .send(
            ServerResponse.validationResponse("Given country is not found")
          );
      }
      req.body.json = countryResult.json
      req.body.mid_result = mid_result
      next();
    } catch (error) {
      console.log(error);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  ruleStatus: async (req, res, next) => {

    const schema = Joi.object().keys({
      id: Joi.string()
        .required()
        .error(() => {
          return new Error("Submerchant id is required");
        }),
      is_status: Joi.string()
        .required()
        .error(() => {
          return new Error("Please change the status is required");
        })
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      }

      next();
    } catch (error) {
      console.log(error);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  ruleDelete: async (req, res, next) => {

    const schema = Joi.object().keys({
      id: Joi.string()
        .required()
        .error(() => {
          return new Error("Data id is required");
        })
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      }

      next();
    } catch (error) {
      console.log(error);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
  get: async (req, res, next) => {

    const schema = Joi.object().keys({
      id: Joi.string()
        .required()
        .error(() => {
          return new Error(" Rule is required");
        })
    });

    try {
      const result = schema.validate(req.body);
      if (result.error) {
        return res
          .status(StatusCode.badRequest)
          .send(ServerResponse.validationResponse(result.error.message));
      }

      next();
    } catch (error) {
      console.log(error);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error));
    }
  },
};
async function checkAllAttributeHasValidValue(ruleString) {
  let rule = ruleString.split('then');
  let rule_string = rule[0];

  let ruleArray = rule_string.toLowerCase().split('and');

  if (ruleArray.length == 0) {
    ruleArray.push(rule_string);
  }

  let formattedArray = [];
  let i = 0;
  let validationResult = {
    status: false,
    message: ''
  }
  var operatorG = "";

  for (let ruleEle of ruleArray) {

    let ruleWithOperatorAndValue = ruleEle.replace(/^[ ]+|[ ]+$/g, '');
    let ruleObj;
    let operator;
    let value;
    let ruleArrayWithValue;

    //console.log(ruleWithOperatorAndValue);

    if (ruleWithOperatorAndValue.includes('>=')) {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('>=');
      operator = '>=';
    } else if (ruleWithOperatorAndValue.includes('<=')) {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('<=');
      operator = '<=';
    } else if (ruleWithOperatorAndValue.includes('>')) {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('>');
      operator = '>';
    } else if (ruleWithOperatorAndValue.includes("<")) {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('<');
      operator = '<';
    } else if (ruleWithOperatorAndValue.includes("!=")) {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('!=');
      operator = '!=';
    } else {
      ruleArrayWithValue = ruleWithOperatorAndValue.split('=');
      operator = '=';
    }
    let temp = ruleArrayWithValue[0].replace(/[\[\]']+/g, '').trim();
    let tempStr = helpers.makeValidJson(temp);
    if (i == 0) {
      tempStr = tempStr.replace(/[^\w ]/, '');
    }
    i++;

    try {
      let tempObj = JSON.parse(tempStr);
      formattedArray.push({ key: tempObj.text, value: ruleArrayWithValue[1].trim(), operator: operator });
    } catch (error) {
      validationResult.status = true;
      validationResult.message = 'Invalid rule, please check and try again.';
    }
    operatorG = operator;
  }


  function isWordWithinQuotes(text, word) {
    // Regular expression to match the word within double quotes
    var regex = new RegExp('("([^"]*\\b' + word + '\\b[^"]*)")', 'g');

    // Check if the word is within double quotes in the text
    return regex.test(text);
  }

  function isWordValid(text) {
    var regex = new RegExp("^[a-zA-Z ]+$");
    return regex.test(text);
  }

  function isNumberValid(text) {
    var regex = new RegExp("^[0-9]+$");
    return regex.test(text);
  }

  for (let ruleObj of formattedArray) {

    let originalValue = ruleObj.value;

    ruleObj.value = ruleObj.value.replace(/['"]+/g, '');

    let card_schemes = ["VISA", "MASTERCARD", "DINERS CLUB INTERNATIONAL", "DISCOVER", "AMERICAN EXPRESS", "CHINA UNION PAY", "MAESTRO UK", "SOLO", "JCB", "MADA"];
    let payment_channel = ["PAYMENT LINK", "SUBSCRIPTION", "REMOTE", "INVOICE"];

    switch (ruleObj.key) {
      case 'amount':
        if (ruleObj.operator != '!=') {
          if (ruleObj.value <= 0) {
            validationResult.status = true;
            validationResult.message = 'Valid amount required';
          }
        }
        break;
      case 'merchant_country':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow merchant country';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for merchant country.';
        } else if (!validator.isISO31661Alpha3(ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Valid merchant country required';
        }
        break;
      case 'card_country':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for card country';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for card country.';
        } else if (!validator.isISO31661Alpha3(ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Valid card country required';
        }
        break;
      case 'currency':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for currency';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for currency.';
        } else if (!validator.isISO4217(ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Valid currency required';
        }
        break;
      case 'mode':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for mode';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for mode.';
        } else if (!validator.contains(ruleObj.value.toUpperCase(), 'SALE') && !validator.contains(ruleObj.value.toUpperCase(), 'AUTH')) {
          validationResult.status = true;
          validationResult.message = 'Valid mode required';
        }
        break;
      case 'card_type':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for card type';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for card type.';
        } else if (!validator.contains(ruleObj.value.toUpperCase(), 'CREDIT') && !validator.contains(ruleObj.value.toUpperCase(), 'DEBIT') && !validator.contains(ruleObj.value.toUpperCase(), 'PREPAID') && !validator.contains(ruleObj.value.toUpperCase(), 'VIRTUAL')) {
          validationResult.status = true;
          validationResult.message = 'Valid card type required';
        }
        break;
      case 'transaction_type':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for transaction type';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for transaction type.';
        } else if (!validator.contains(ruleObj.value.toUpperCase(), 'DOMESTIC') && !validator.contains(ruleObj.value.toUpperCase(), 'INTERNATIONAL')) {
          validationResult.status = true;
          validationResult.message = 'Valid transaction type required';
        }
        break;
      case 'card_scheme':
        if (isWordValid(ruleObj.value) == false) {

          validationResult.status = true;
          validationResult.message = 'Only characters are allow for card scheme';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for card scheme.';
        } else if (!card_schemes.includes(ruleObj.value.toUpperCase())) {
          validationResult.status = true;
          validationResult.message = 'Valid card scheme required';
        }
        break;
      case 'bin':
        if (isNumberValid(ruleObj.value) == false) {
          validationResult.status = true;
          validationResult.message = 'Only numbers are allow for bin';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for bin.';
        } else if (ruleObj.value.length != 6) {
          validationResult.status = true;
          validationResult.message = 'Bin length should be of length 6';
        } else {
          let checkBinStatus = await checkBinResult(ruleObj.value);

          if (checkBinStatus) {
            validationResult.status = true;
            validationResult.message = 'Invalid bin, please check bin and try again';
          }
        }
        break;
      case '3ds_version':
        if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for 3ds version.';
        } else if (ruleObj.value != 0 && ruleObj.value != 1 && ruleObj.value != 2) {
          validationResult.status = true;
          validationResult.message = 'Invalid 3ds version';
        }
        break;
      case 'channel':
        if (isWordValid(ruleObj.value) == false) {
          validationResult.status = true;
          validationResult.message = 'Only characters are allow for channel';
        } else if (!isWordWithinQuotes(originalValue, ruleObj.value)) {
          validationResult.status = true;
          validationResult.message = 'Values should be within double quotes';
        } else if (ruleObj.operator != '!=' && ruleObj.operator != '=') {
          validationResult.status = true;
          validationResult.message = 'Invalid operator for channel.';
        } else if (!payment_channel.includes(ruleObj.value.toUpperCase())) {
          validationResult.status = true;
          validationResult.message = 'Valid payment channel required';
        }
        break;
    }
    if (validationResult.status) {
      return validationResult;
    }
  }
  return validationResult;
}
async function checkBinResult(bin) {
  try {
    const params = {
      bin_number: bin,
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
    let result = await axios(options);
    let lookup_result = {
      country: result.data["country"],
    }
    let lookUpResult = lookup_result.country.length == 0 ? true : false;

    return lookUpResult;
  } catch (error) {
    return false;
  }

}
module.exports = rule_validation;
