const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

const enc_dec = require("../decryptor/decryptor");

const RoutingModel = require("../../models/routingModel");
const routingAttribute = require("./routing_rule_attribute");


async function checkForThen(
  inputString,
  is_zero_condition = false,
  is_fist_Condition = false
) {
  var conditions = inputString.split(/\s+then\s+/);

  if (!inputString.includes("then") && conditions.length !== 2) {
    //return "Invalid input format. Please use 'if ... then ...'";
    return false;
  }

  if (is_zero_condition) {
    return conditions[0].trim();
  }

  if (is_fist_Condition) {
    return conditions[1].trim();
  }
  return true;
}

async function validatePatternForAnd(inputString, is_param = false) {
  // Check first condition
  var rule_str = [];
  rule_str = await checkForThen(inputString, true);


  if (rule_str.includes("and")) {
    let and_condition = rule_str.split(/\s+and\s+/);
    
    for (const iterator of and_condition) {
      
      if (iterator.includes("and")) {
        return false;
        break;
      }
    }
  }
  return true;
}

function matchValue(mid_str) {
  const pattern = /"value"\s*:\s*"([^"]+)"/g;
  const matches = [];

  let match;
  while ((match = pattern.exec(mid_str)) !== null) {
    // match[1] contains the captured value

    matches.push(match[1].trim());
  }

  return matches;
}

async function checkMid(req) {
  const { submerchant_id, env, payment_method, routing_rule } = req.body;
  // Check first condition
  var condition1 = [];
  const mid_str = await checkForThen(routing_rule, false, true);

  const matches = matchValue(mid_str);
  

  const sub_merchant_id = await enc_dec.cjs_decrypt(submerchant_id);
  const mid_response = await RoutingModel.getMid(sub_merchant_id, env);

  let mid = [];
  for (const mid1 of mid_response) {
    mid.push(mid1.label);
  }
  let flag = false;
  let res={};
  for (const match of matches) {
    if (mid.includes(match)) {
      flag = true;

    } else {
      flag = false;
    }
  }
  return res = {
    flag: flag,
    mid: matches
  };
}

async function checkAttribute(req) {
  const { submerchant_id, env, payment_method, routing_rule } = req.body;
  const rule_str = await checkForThen(routing_rule, true);

  const matches = matchValue(rule_str);

  const attributes = routingAttribute.allAttribute();

  let flag = false;
  for (const attr of matches) {
    if (attributes.includes(attr)) {
      flag = true;
    } else {
      flag = false;
    }
  }
  return flag;
}

function validateString(inputString) {

  if (inputString.includes("amount")) {
    //var pattern = /\[{"text":"\w+","value":"\w+","prefix":"@"}\]\s*(?:[<>]=?|&gt;|&lt;|=)?\s*\d+/;
    var pattern =  /\[{"text":"\w+","value":"\w+","prefix":"@"}\]\s*(?:[<>]=?|=)?\s*\d+/;
    return pattern.test(inputString);
  } else {
    // Define the regular expression pattern
    //var pattern = /^(\[\[\{"text":"\w+","value":"\w+","prefix":"@"\}\]\])\s*=\s*'\w+'/;
    var pattern = /\[{"text":"\w+","value":"\w+","prefix":"@"}\]\s*=\s*"\w+"/;
    //var pattern = /\{{"text":"\w+","value":"\w+","prefix":"@"}\}\s*=\s*'\w+'/;

    // Test if the input string matches the pattern
    return pattern.test(inputString);
  }
}

async function checkForValidRule(routing_rule) {
  const rule_str = await checkForThen(routing_rule, true);


  if (rule_str.includes("and")) {
    let and_condition = rule_str.split(/\s+and\s+/);
   // console.table('and_condition', and_condition);
    for (const iterator of and_condition) {

      if (!validateString(iterator.trim())) {
        return false;
        break;
      }
    }
  }

  return true;
}

async function getJson(str) {
  // Regular expression to match the string after the equal sign
  let regex = ''// /=(.*)/;
  let operator = ''
  if(str.includes('<=')){
    regex = /<=(.*)/;
    operator='<=';
  }else if(str.includes('>=')){
    regex = />=(.*)/;
    operator='>=';
  }else if(str.includes('<')){
    regex = /<(.*)/;
    operator='<';
  }else if(str.includes('>')){
    regex = />(.*)/;
    operator='>';
  } else if (str.includes('!=')) {
    regex = /!=(.*)/;
    operator = '!=';
  } else{
    regex = /=(.*)/;
    operator = '=';
  }
  // Match the regular expression against the JSON string
  let match = str.match(regex);
  // Extract the string after the equal sign

  let afterEqualSign = match ? match[1].trim() : null;

  //afterEqualSign = afterEqualSign.replaceAll('"', "").trim();
  afterEqualSign = afterEqualSign.replace(/"/g, '').trim();

  let matches = [];
  matches = matchValue(str);

  let key = matches[0];
  let returnObj = {};
  if(operator==''){
    returnObj = {
      key: key,
      value: afterEqualSign
    };
  }else{
    returnObj = {
      key: key,
      value: afterEqualSign,
      operator:operator
    };
  }
  
  //returnObj[key] = afterEqualSign
  
  return returnObj;
}

async function checkCountry(routing_rule) {
  const rule_str = await checkForThen(routing_rule, true);
  
  const json = [];
  if (rule_str.includes("and")) {
    let and_condition = rule_str.split(/\s+and\s+/);
   
    for (const iterator of and_condition) {
      
      const new_json = await getJson(iterator);
      if(new_json)
      json.push(new_json);
    }
  }else{
    const new_json = await getJson(rule_str);
    if (new_json)
      json.push(new_json);
  }

 
  let used_country = [];
  const attribute = await routingAttribute.countryAttribute();
  for (const iterator of json) {
    
    if (attribute.includes(iterator.key)) {
      //check the country code in country table
      used_country.push(iterator.value);
    }
  }
  used_country = [...new Set(used_country)];
 
  const country_result = used_country.length>0?await RoutingModel.checkCountry(used_country):true;
  return { status:country_result,  json};
}

module.exports = {
  checkForThen,
  validatePatternForAnd,
  checkMid,
  checkAttribute,
  checkForValidRule,
  checkCountry,
};
