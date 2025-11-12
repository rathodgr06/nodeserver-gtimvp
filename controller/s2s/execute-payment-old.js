const axios = require("axios");
const credentials = require("../../config/credientials");
const helpers = require("../../utilities/helper/general_helper");
const merchantOrderModel = require("../../models/merchantOrder");
const moment = require("moment");
const order_transactionModel = require("../../models/order_transaction");
const enc_dec = require("../../utilities/decryptor/decryptor");
const statusCode = require("../../utilities/statuscode/index"); 
const response = require("../../utilities/response/ServerResponse");
const { v4: uuidv4 } = require("uuid");
const { countryToAlpha3 } = require("country-to-iso");
const { send_webhook_data } = require("../webhook_settings");
const PspModel = require("../../models/psp");
const credientials = require("../../config/credientials");
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const RoutingModel = require('../../models/routingModel');
const MerchantOrder = require("../merchantOrder");
const cipherModel = require("../../models/cipher_models");
const execuatePayment = async (req, res) => {
  try {
    req.body.data = req.body;
    let old_req_body = req.body;
    console.log(old_req_body)
    /* Add or Update Customer*/
    let customer_id = await addOrUpdateCustomerOpenCreate(req);
    /* Create Order*/
    req.customer_id = customer_id;
    let order_id = await createOrder(req);
    console.log(order_id);
    let mode = req.credentials.type;
    if (order_id) {
      // call look up bin 
      let saveCardResponse = await saveCard(req, order_id, mode);
      if (saveCardResponse) {
        let lookupResult = await binLookUp(req, order_id, mode);
        if (lookupResult.status == 'success') {
          req.card_details = lookupResult.data;
          let brandingResult = await checkbrandingcard(req, order_id, mode);
          if (brandingResult.status == "success") {
            let orderRoutingDetails = await orderrouting(req, order_id, mode);
            console.log(orderRoutingDetails);
            if (orderRoutingDetails.status == "success") {
              let terminalAndPSPDetails = orderRoutingDetails.data;
              let authenticationResult = {};
              switch (terminalAndPSPDetails.psp_name) {
                case 'mpgs_gti':
                case 'mpgs':  
                case 'mpgs_meps':
                  authenticationResult = await mpgsSessionAndAuth(req, order_id, mode, terminalAndPSPDetails.psp_name);
                  break;
              }
              return res.status(statusCode.ok).send(response.successansmsg(authenticationResult));

            } else {
              return res.status(statusCode.badRequest).send(response.errorMsgWithData(`${orderRoutingDetails.message}`, []));
            }

          } else {
            return res.status(statusCode.badRequest).send(response.errorMsgWithData(`${brandingResult.message}`, []));
          }

        } else {
          return res.status(statusCode.badRequest).send(response.errorMsgWithData(`${lookupResult.message}`, []));
        }
      } else {
        return res.status(statusCode.badRequest).send(response.errorMsgWithData(`Something went wrong`, []));
      }

    } else {
      return res.status(statusCode.badRequest).send(response.errorMsgWithData(`Unable to create order something went wrong`, []));
    }

  } catch (error) {
    console.log(error);
    return res.status(statusCode.badRequest).send(response.errorMsgWithData(`Unable to create order something went wrong`, []));
  }
  /* Call To Routing Bin */

};


module.exports = execuatePayment;

async function addOrUpdateCustomerOpenCreate(req) {
  let customer_details = req.body.data.customer_details;
  let email = customer_details.email;
  try {
    let result = await merchantOrderModel.selectOne("*", { email: email, merchant_id: req.credentials.super_merchant_id, sub_merchant_id: req.credentials.merchant_id, }, "customers");
    let customer_id = "";
    let enc_customer_id = "";
    if (result) {
      customer_id = result.id;
      enc_customer_id = enc_dec.cjs_encrypt(customer_id);

      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
      let customer = {
        email: email,
        name: customer_details.name,
        dial_code: customer_details.code,
        mobile_no: customer_details.mobile,
        updated_at: updated_at,
        merchant_id: req.credentials.super_merchant_id,
        sub_merchant_id: req.credentials.merchant_id,
      };
      await merchantOrderModel.updateDynamic(customer, { id: result.id, }, "customers");
      return enc_customer_id;
    } else {
      let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
      let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
      let customer = {
        email: email,
        name: customer_details.name,
        dial_code: customer_details.code,
        mobile_no: customer_details.mobile,
        updated_at: updated_at,
        merchant_id: req.credentials.super_merchant_id,
        sub_merchant_id: req.credentials.merchant_id,
        created_at: created_at,
        updated_at: updated_at,
      };
      let resultInc = await merchantOrderModel.addDynamic(customer, "customers");
      enc_customer_id = enc_dec.cjs_encrypt(result.insertId);
      return enc_customer_id;
    }
  } catch (error) {
    console.log(error);
    return '';
  }
}

async function createOrder(req) {
  let classType = req.body.data.class;
  let client = {
    os: req.headers.os,
    browser: req.headers.browser ? req.headers.browser : "",
    ip: req.headers.ip ? req.headers.ip : "",
    browser_version: req.headers["x-browser-version"],
  };
  let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let customer_details = req.body.data.customer_details;
  let order_details = req.body.data.order_details;
  let billing_details = req.body.data.billing_details;
  let shipping_details = req.body.data.shipping_details;
  let mode = "";
  if (req.credentials.type == "test") {
    mode = "test";
  } else {
    mode = "live";
  }
  let order_id = await helpers.make_sequential_no(
    mode == "live" ? "ORD" : "TST_ORD"
  );
  let payment_token = req.body.data.payment_token;
  let urls = req.body.data.urls;
  let status = "PENDING";
  let expiry = req.body.data.paymentMethod.paymentCard.expiryDate.split('/');
  let expiryDate = expiry[1] + '-' + expiry[0];
  let ins_body = {
    merchant_id: req.credentials.merchant_id,
    mcc: req.credentials.mcc_id,
    mcc_category: req.credentials.mcc_cat_id,
    super_merchant: req.credentials.super_merchant_id,
    customer_name: customer_details.name,
    customer_email: customer_details.email,
    customer_code: customer_details.code,
    customer_mobile: customer_details.mobile,
    billing_address_line_1: billing_details.address_line1
      ? billing_details.address_line1
      : "",
    billing_address_line_2: billing_details.address_line2
      ? billing_details.address_line2
      : "",
    billing_city: billing_details.city ? billing_details.city : "",
    billing_pincode: billing_details.pin ? billing_details.pin : "",
    billing_province: billing_details.province
      ? billing_details.province
      : "",
    billing_country: billing_details.country ? billing_details.country : "",
    shipping_address_line_1: shipping_details.address_line1
      ? shipping_details.address_line1
      : "",
    shipping_address_line_2: shipping_details.address_line2
      ? shipping_details.address_line2
      : "",
    shipping_city: shipping_details.city ? shipping_details.city : "",
    shipping_country: shipping_details.country
      ? shipping_details.country
      : "",
    shipping_province: shipping_details.province
      ? shipping_details.province
      : "",
    shipping_pincode: shipping_details.pin ? shipping_details.pin : "",
    amount: order_details.amount,
    amount_left: order_details.amount,
    currency: order_details.currency,
    // return_url: order_details.return_url,
    description: order_details?.description,
    other_description: order_details?.description,
    status: status,
    origin: "REMOTE",
    order_id: order_id,
    browser: client.browser,
    ip: client.ip,
    os: client.os,
    browser_version: client.browser_version,
    created_at: created_at,
    updated_at: updated_at,
    action: req.body.data.action,
    capture_method: req.body.data.capture_method
      ? req.body.data.capture_method
      : "MANUAL",
    merchant_order_id: order_details.m_order_id,
    payment_token_id: payment_token,
    success_url: req.body.data.urls.callback,
    cancel_url: req.body.data.urls.callback,
    failure_url: req.body.data.urls.callback,
    merchant_customer_id: customer_details.m_customer_id,
    pan: maskCardNumber(req.body.data.paymentMethod.paymentCard.number),
    expiry: expiryDate
  };

  try {
    let result = await merchantOrderModel.add(ins_body, mode);
    let p_request_id = await helpers.make_sequential_no("REQ");
    let request = req.body.data;
    let order_req = {
      merchant_id: req.credentials.merchant_id,
      order_id: order_id,
      request_id: p_request_id,
      request: JSON.stringify(request, replacerFunc()),
    };
    await helpers.common_add(order_req, "generate_request_id");
    return order_id;
  } catch (error) {
    console.log(error);
    return false;
  }

}

function maskCardNumber(cardNumber) {
  // Check if the input is a string and contains at least 4 characters
  if (typeof cardNumber === 'string' && cardNumber.length >= 4) {
    const last4Digits = cardNumber.slice(-4); // Get the last 4 digits
    const maskedDigits = '*'.repeat(cardNumber.length - 4); // Create stars for the rest
    return maskedDigits + last4Digits; // Combine stars and last 4 digits
  }
}

const replacerFunc = () => {
  const visited = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (visited.has(value)) {
        return;
      }
      visited.add(value);
    }
    return value;
  };
};

async function binLookUp(req, order_id, mode) {
  try {
    let card_no;
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
      return { status: 'failed', message: `ecom not supported by merchant` }
    }
    card_no = req.body.paymentMethod.paymentCard.number;
    bin_number = req.body.paymentMethod.paymentCard.number.substring(0, 6);

    const params = { bin_number: bin_number };
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
      return { status: 'failed', message: `${cardType_show} not supported by merchant` }
    } else if (!DICheck) {
      return { status: 'failed', message: `${DIType_show} not supported by merchant` }
    } else if (!isSupportedScheme) {
      return { status: 'failed', message: "Card scheme/ class not supported by merchant" }
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
      return { status: 'failed', message: "Card not supported by merchant" }
    }
    return { status: 'success', message: '', data: lookup_result }
  } catch (error) {
    console.log(error);
    return { status: 'failed', message: "Something went wrong" }
  }
}
async function checkbrandingcard(req, order_id, mode) {
  try {
    let bin_number;
    let card_no;
    const lookup_result = req.card_details;
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
      if (bradingDetails[0].test_card_payment_scheme) {
        const cardArr =
          bradingDetails[0].test_card_payment_scheme.split(",");
        if (!cardArr.includes(DIType_show)) {
          return { status: 'failed', message: `${DIType_show} not supported by merchant` }
        }
        if (!cardArr.includes(lookup_result.card_brand)) {
          return { status: 'failed', message: "Card scheme not supported by merchant" }
        }

        if (
          lookup_result?.is_commercial &&
          !cardArr.includes("CORPORATE CARD")
        ) {
          return { status: 'failed', message: "Corporate card is not supported by merchant" }
        }

        if (
          lookup_result?.is_prepaid &&
          !cardArr.includes("PREPAID CARD")
        ) {
          return { status: 'failed', message: "Prepaid card is not supported by merchant" }
        }
      }
    } else {

      if (bradingDetails[0].card_payment_scheme) {
        const cardArr = bradingDetails[0].card_payment_scheme.split(",");
        if (!cardArr.includes(DIType_show)) {
          return { status: 'failed', message: `${DIType_show} not supported by merchant` }
        }
        if (!cardArr.includes(lookup_result.card_brand)) {
          return { status: 'failed', message: "Card scheme not supported by merchant" }
        }

        if (
          lookup_result?.is_commercial &&
          !cardArr.includes("CORPORATE CARD")
        ) {
          return { status: 'failed', message: "Corporate card is not supported by merchant" }
        }

        if (
          lookup_result?.is_prepaid &&
          !cardArr.includes("PREPAID CARD")
        ) {
          return { status: 'failed', message: "Prepaid card is not supported by merchant" }
        }

      }
    }
    return { status: 'success', message: "" }
  } catch (error) {
    console.log(error);
    return { status: 'failed', message: "something went wrong" }
  }
}

async function checkMidIsValid(mid, card_details, order_details) {
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
}

async function orderrouting(req, order_id, payment_mode) {
  try {
    let saved_card = false;
    let change_card = false;
    let table_name = "orders";

    if (req.body.card_id && req.body.card_id !== '') { saved_card = true }
    if (payment_mode === "test") { table_name = "test_orders" }
    const order_details = await merchantOrderModel.selectOne("*", { order_id: order_id }, table_name);
    let first_selected_mid = false;
    let isOrderAlreadyRouted = await merchantOrderModel.selectDynamicONE('*', { order_id: order_id, mode: payment_mode }, 'order_life_cycle');


    let checkForHardSoftDeclinedStatus = await helpers.checkForHardOrSoftDeclined({ order_id: order_id, mode: payment_mode });

    // if (req.body.type == "check_routing") {
    var last_transaction = await helpers.lastTwoCardUsed({ order_id: order_id, mode: payment_mode })
    update_retry(last_transaction)
    //}

    if (isOrderAlreadyRouted?.id > 0) {
      // console.log("isOrderAlreadyRouted", isOrderAlreadyRouted);
      first_selected_mid = await findOutWhereToRoute(isOrderAlreadyRouted);
      change_card = await helpers.checkOrderWasRejected({ status_code: ['47'], order_id: order_id, mode: payment_mode });

      //console.log("first_selected_mid", first_selected_mid)
      // console.log("checkForHardSoftDeclinedStatus", checkForHardSoftDeclinedStatus);

      if (checkForHardSoftDeclinedStatus) {
        change_card = true;
      }


      if (first_selected_mid) {
        //console.log("yes111111");
      } else {

        //console.log("hskdksdhkhsdkfhskdfhksdhf");
        let new_res = {
          m_order_id: order_details.merchant_order_id,
          p_order_id: req.bodyString("order_id"),
          p_request_id: "",
          psp_ref_id: "",
          psp_txn_id: "",
          transaction_id: last_transaction[0].txn,
          status: "FAILED",
          status_code: last_transaction[0].status_code,
          remark: last_transaction[0].description,
          paydart_category: "Invalid card",
          currency: order_details.currency,
          amount: order_details?.amount ? order_details?.amount : "",
          m_customer_id: order_details.merchant_customer_id,
          psp: "",
          payment_method: order_details.payment_mode,
          m_payment_token: order_details?.card_id
            ? order_details?.card_id
            : "",
          transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
          return_url: order_details.failure_url,
          payment_method_data: {
            scheme: order_details?.scheme ? order_details?.scheme : "",
            card_country: order_details?.card_country
              ? order_details?.card_country
              : "",
            card_type: order_details?.cardType
              ? order_details?.cardType
              : "",
            mask_card_number: order_details?.pan ? order_details?.pan : "",
          },
          apm_name: "",
          apm_identifier: "",
          sub_merchant_identifier: order_details?.merchant_id
            ? await helpers.formatNumber(order_details?.merchant_id)
            : "",
        };
        let res_obj = {
          order_status: "FAILED",
          reference: "",
          order_reference: "",
          payment_id: last_transaction[0].txn,
          order_id: order_details.order_id,
          new_res: new_res,
          amount: order_details.amount,
          currency: order_details.currency,
          // token: browser_token_enc,
          "3ds": "",
        };

        return { status: 'failed', message: 'Transaction failed', res_obj };
      }

    } else {
      const payment_method = 'card_payment';
      const condition = {
        payment_method,
        mode: payment_mode,
        sub_merchant_id: order_details.merchant_id,
        rule_status: 1,
        deleted: 0
      }

      const rule_result = await RoutingModel.getRule(condition, 'routing_rule');
      const routing_order = await RoutingModel.getOrderRoutingList('mid_id,retry,cascade', {
        payment_method,
        mode: payment_mode,
        sub_merchant_id: order_details.merchant_id,
      }, 'routing_order')

      const match_rule = [];
      let rule_evaulation = [];
      for (const rules of rule_result) {
        let rule_json = []
        try {
          rule_json = JSON.parse(rules.rule);
        } catch (error) {
          console.log(error);
        }

        let mid_list = rules.rule_string.split('then');

        let rule_eval_obj = {
          rule_id: rules.id,
          rule_name: rules.rule_name,
          no_of_attributes: rule_json.length,
          no_of_rule_pass: 0,
          no_of_rule_fail: 0,
          mid_list: mid_list[1].trim().replace(/[[\]]/g, '')
        }
        //find operator 
        let string_rule = mid_list[0].toLowerCase();
        let array_of_attributes = string_rule.split('and');
        let operator = [];
        for (let df of array_of_attributes) {
          let isSplit = false;
          let opne = df.split('!=')
          if (opne.length > 1 && !isSplit) {
            operator.push('!=')
            isSplit = true;
          }
          let oplte = df.split('<=')
          if (oplte.length > 1 && !isSplit) {
            operator.push('<=');
            isSplit = true;
          }
          let opgte = df.split('>=')
          if (opgte.length > 1 && !isSplit) {
            operator.push('>=');
            isSplit = true;

          }
          let oplt = df.split('<')
          if (oplt.length > 1 && !isSplit) {
            operator.push('<')
            isSplit = true;
          }
          let opgt = df.split('>')
          if (opgt.length > 1 && !isSplit) {
            operator.push('>')
            isSplit = true;
          }
          let ope = df.split("=");
          if (ope.length > 1 && !isSplit) {
            operator.push('=')
            isSplit = true;
          }

        }

        let rule_json_with_operator = [];
        let i = 0;
        for (let rl of rule_json) {
          rl.operator = operator[i];
          rule_json_with_operator.push(rl);
          i++;
        }

        for (const rule of rule_json_with_operator) {

          let { key, value } = rule;

          // console.log("value",value);

          if (key.trim() === 'amount') {
            switch (rule.operator) {
              case '<=':
                if (order_details.amount <= value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;

                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;

                }
                break;
              case '>=':
                if (order_details.amount >= value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
                break;
              case '<':
                if (order_details.amount < value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
                break;
              case '>':
                if (order_details.amount > value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
                break;
              case '=':
                if (order_details.amount == value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
                break;
              case "!=":
                if (order_details.amount != value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
                break;
            }

          }
          if (key.trim() == 'merchant_country') {
            let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
            let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');
            /*  if(value==country_details.country_code){
               rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
             }else{
              rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
             }  */
            if (rule.operator == '=') {
              let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
              let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');
              if (value.toUpperCase() == country_details.country_code.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
              let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');
              if (value.toUpperCase() != country_details.country_code.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }

          }
          if (key.trim() == 'card_country') {
            //   if(req.card_details.country_code3==value){
            //     rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
            // }else{
            //  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
            // } 
            if (rule.operator == '=') {
              if (req.card_details.country_code3.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (req.card_details.country_code3.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }

          }
          if (key.trim() == 'card_type') {

            if (rule.operator == '=') {
              if (req.card_details.card_type.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (req.card_details.card_type.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }

          }
          if (key.trim() == 'card_scheme') {

            if (rule.operator == '=') {
              if (req.card_details.card_brand.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (req.card_details.card_brand.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }

          }

          if (key.trim() == 'currency') {
            if (rule.operator == '=') {
              if (order_details.currency == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (order_details.currency != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }
          }

          if (key.trim() == 'transaction_type') {

            let type = '';
            let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
            let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');
            //  if("ARE"==req.card_details.country_code3){
            if (country_details.country_code == req.card_details.country_code3) {
              type = 'DOMESTIC';
            } else {
              type = 'INTERNATIONAL';
            }

            // console.log("transaction_type",type)

            if (rule.operator == '=') {
              if (type.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (type.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }
          }
          if (key.trim() == 'mode') {
            if (rule.operator == '=') {
              if (order_details.action.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (order_details.action.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }
          }
          if (key.trim() == 'channel') {

            if (rule.operator == '=') {
              if (order_details.origin.toUpperCase() == value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (order_details.origin.toUpperCase() != value.toUpperCase()) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }
          }
          if (key.trim() == 'bin') {
            let card_bin = card.substring(0, 6);
            if (req.body.card_id !== '') {
              card_bin = card_number.substring(0, 6)
            }
            if (rule.operator == '=') {
              // console.log("value",value);
              /// console.log("card.substring(0, 6)", card_bin);
              if (card_bin == value) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            } else {
              if (card_bin != value) {
                rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
              } else {
                rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
              }
            }
          }
          if (key.trim() == '3ds_version') {
            let card_proxy = await getCardProxyByCardIdOrCardNo(enc_dec.cjs_decrypt(card_id), card);


            // console.log("card_proxy", card_proxy);

            let versionDetails = await helpers.fetch3dsVersion({ card_proxy: card_proxy });

            if (versionDetails.result) {
              if (rule.operator == '=') {
                if (versionDetails.version == value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;

                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;

                }
              } else {
                if (versionDetails.version != value) {
                  rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
                } else {
                  rule_eval_obj.no_of_rule_fail = rule_eval_obj.no_of_rule_fail + 1;
                }
              }

            } else {
              rule_eval_obj.no_of_rule_pass = rule_eval_obj.no_of_rule_pass + 1;
            }


          }



        }

        rule_evaulation.push(rule_eval_obj);

      }
      first_selected_mid = await decideRuleRouting(rule_evaulation, routing_order, order_details.order_id, payment_mode, req.card_details, order_details);
    }


    if (first_selected_mid) {
      const _terminal_details = await merchantOrderModel.selectDynamicONE('*', { id: first_selected_mid }, 'mid');
      const getpsp = await PspModel.selectOne("*", {
        id: _terminal_details.psp_id,
      });
      let redirect_url = {
        success: '',
        failure: '',
        cancel: ''
      }
      let order_urls = {
        success: order_details.success_url,
        failure: order_details.failure_url,
        cancel: order_details.cancel_url
      }
      const psp_name = getpsp.credentials_key.toLowerCase();
      const psp_credentials = credientials[psp_name];
      const base_url = payment_mode == 'test' ? psp_credentials.test_url : psp_credentials?.base_url;
      if (order_urls.success != '' && order_urls.success != null && order_urls.success != 'undefined') {
        // redirect_url.success = order_urls.success
      } else if (_terminal_details?.success_url != '' && _terminal_details?.success_url != null && _terminal_details?.success_url != 'undefined') {
        redirect_url.success = _terminal_details?.success_url
      } else {
        // redirect_url.success = process.env.DEFAULT_SUCCESS_URL
      }
      if (order_urls.failure != '' && order_urls.failure != null && order_urls.failure != 'undefined') {
        // redirect_url.failure = order_urls.failure
      } else if (_terminal_details?.failure_url != '' && _terminal_details?.failure_url != null && _terminal_details?.failure_url != 'undefined') {
        // redirect_url.failure = _terminal_details?.failure_url
      } else {
        // redirect_url.failure = process.env.DEFAULT_FAILED_URL
      }
      if (order_urls.cancel != '' && order_urls.cancel != null && order_urls.cancel != 'undefined') {
        // redirect_url.cancel = order_urls.cancel
      } else if (_terminal_details?.cancel_url != '' && _terminal_details?.cancel_url != null && _terminal_details?.cancel_url != 'undefined') {
        // redirect_url.cancel = _terminal_details?.cancel_url
      } else {
        // redirect_url.cancel = process.env.DEFAULT_CANCEL_URL
      }

      // description:
      //   order_details.remark == ""
      //     ? psp_name.toUpperCase()
      //     : order_details.description,

      console.log("order_details?.origin", order_details?.origin)
      console.log("order_details?.action", order_details?.action)
      console.log("_terminal_details?.mode", _terminal_details?.mode)


      // if (req.body.type == 'routing') {
      let updateorder = {
        remark:
          order_details.remark == ""
            ? psp_name.toUpperCase()
            : order_details.remark,
        action: order_details?.origin == "REMOTE" ? order_details?.action : _terminal_details?.mode,
        terminal_id: _terminal_details?.terminal_id,
        psp_id: _terminal_details?.psp_id,
        payment_mode: req.card_details.card_type + " CARD",
        is_one_click: saved_card ? 1 : 0,

        issuer: req.card_details.issuer,
        card_bin: req.card_details.bin_number,
        issuer_website: req.card_details.issuer_website,
        issuer_phone_number: req.card_details.issuer_phone,
        cardCategory: req.card_details.card_category,
        cardholderName: req?.card_details?.card_holder_name,
        success_url: redirect_url.success,
        cancel_url: redirect_url.cancel,
        failure_url: redirect_url.failure
      };

      await merchantOrderModel.updateDynamic(
        updateorder,
        { order_id: order_details.order_id },
        table_name
      );

      // }


      // request id table entry
      let p_request_id = await helpers.make_sequential_no(payment_mode == 'test' ? "TST_REQ" : "REQ");

      let order_req = {
        merchant_id: order_details.merchant_id,
        order_id: order_id,
        request_id: p_request_id,
        request: '',
      };
      await helpers.common_add(order_req, payment_mode == 'test' ? "test_generate_request_id" : "generate_request_id");



      let retry_txn = true;
      if (req.body.type == "routing") {

        /// check if card is blocked
        retry_txn = await this.checkCardIfBlocked(req);

        let last_transaction_r = await helpers.lastTwoCardUsed({ order_id: order_id, mode: payment_mode })
        let isOrderRetry = await merchantOrderModel.selectDynamicONE('*', { order_id: order_id, mode: payment_mode }, 'order_life_cycle');

        //console.log("order_details", order_details)

        if (isOrderRetry.retry == 0 && !retry_txn) {
          let new_res_f = {
            m_order_id: order_details.merchant_order_id,
            p_order_id: req.bodyString("order_id"),
            p_request_id: "",
            psp_ref_id: "",
            psp_txn_id: "",
            transaction_id: last_transaction_r[0].txn,
            status: "FAILED",
            status_code: last_transaction_r[0].status_code,
            remark: last_transaction_r[0].description,
            paydart_category: "Invalid card",
            currency: order_details.currency,
            amount: order_details?.amount ? order_details?.amount : "",
            m_customer_id: order_details.merchant_customer_id,
            psp: "",
            payment_method: order_details.payment_mode,
            m_payment_token: order_details?.card_id
              ? order_details?.card_id
              : "",
            transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
            return_url: process.env.DEFAULT_FAILED_URL,
            payment_method_data: {
              scheme: order_details?.scheme ? order_details?.scheme : "",
              card_country: order_details?.card_country
                ? order_details?.card_country
                : "",
              card_type: order_details?.cardType
                ? order_details?.cardType
                : "",
              mask_card_number: order_details?.pan ? order_details?.pan : "",
            },
            apm_name: "",
            apm_identifier: "",
            sub_merchant_identifier: order_details?.merchant_id
              ? await helpers.formatNumber(order_details?.merchant_id)
              : "",
          };
          let res_obj_f = {
            order_status: "FAILED",
            reference: "",
            order_reference: "",
            payment_id: last_transaction_r[0].txn,
            order_id: order_details.order_id,
            new_res: new_res_f,
            amount: order_details.amount,
            currency: order_details.currency,
            // token: browser_token_enc,
          };
          return res
            .status(StatusCode.ok)
            .send(ServerResponse.errorMsgWithData("Transaction failed.", res_obj_f));
        }


      }
      if (retry_txn) {
        let psp_details = {
          psp_name: psp_name.toLowerCase(),
          merchant_url: base_url,
          terminal_no: _terminal_details?.terminal_id,
          change_card: change_card
        };
        return { status: "success", message: "payment psp found successfully", data: psp_details }
      } else {
        let res_obj = {
          retry: 1,
        };
        return { status: 'failed', message: 'transaction failed', data: res_obj }
      }
    } else {
      let pspData = await terminalRouting(req, order_id, payment_mode);
      return pspData;
    }



  } catch (error) {
    console.log(error);
    return { status: 'failed', message: "Something went wrong" }

  }
}

async function findOutWhereToRoute(orderLifeCycle) {
  let transactionLifeCycle = await merchantOrderModel.selectAllDynamic('id,status', { order_id: orderLifeCycle.order_id, status: 1 }, 'order_life_cycle_logs');

  let retry_no = orderLifeCycle.retry;
  let cascade_no = orderLifeCycle.cascade;
  let mid_list = orderLifeCycle.mid_list.split(',');
  let original_mid_list = orderLifeCycle?.original_mid_list?.split(',');


  console.log(transactionLifeCycle.length)
  console.log(retry_no, cascade_no, mid_list)

  switch (transactionLifeCycle.length) {
    case 0:
      console.log("retry0")
      return mid_list[0];
      break;
    case 1:
      console.log("retry1")
      if (retry_no > 0 && cascade_no > 0) {
        //update_retry(last_transaction)
        if (retry_no - transactionLifeCycle.length >= 0) {
          return mid_list[0];
        } else {
          if (mid_list.length > 1) {
            return mid_list[1];
          } else {
            return false;
          }

        }
      } else if (retry_no > 0) {
        return mid_list[0];
      }
      break;
    default:
      console.log("retry2")
      let last_transaction = await helpers.lastTwoCardUsed({ order_id: orderLifeCycle.order_id, mode: orderLifeCycle.mode })
      update_retry(last_transaction)

      if (retry_no > transactionLifeCycle.length) {
        console.log("retry2.1")
        return mid_list[0];
      } else {

        console.log("retry2.2")

        if ((retry_no + 1 + cascade_no * retry_no) - transactionLifeCycle.length > 0) {
          let mid_calling_sequence = [];
          for (i = 0; i < mid_list.length; i++) {

            let r = retry_no;
            let c = cascade_no;

            if (i == 0) {
              mid_calling_sequence.push(mid_list[i]);
              while (r) {
                mid_calling_sequence.push(mid_list[i]);
                r--;
              }
            } else {
              mid_calling_sequence.push(mid_list[i]);
              // while(c){
              //   mid_calling_sequence.push(mid_list[i]);
              //   c--;
              // }
            }


          }
          //  console.log("original_mid_list", original_mid_list);
          if (original_mid_list != undefined && original_mid_list != "") {
            return original_mid_list[transactionLifeCycle.length];
          } else {
            return mid_calling_sequence[transactionLifeCycle.length];
          }

          let no_of_cascade_happened = transactionLifeCycle.length - (retry_no + 1);
          if (no_of_cascade_happened > 0) {
            return mid_list[transactionLifeCycle.length - (retry_no * cascade_no - 1)];
          } else {
            return mid_list[transactionLifeCycle.length - retry_no];
          }

        } else {
          return false;
        }

        /* if(mid_list.length>(transactionLifeCycle.length-retry_no)){
           if((retry_no+cascade_no+1*retry_no-transactionLifeCycle.length)>=0)
           let no_of_cascade_happened = transactionLifeCycle.length-retry_no+1;
           return mid_list[transactionLifeCycle.length-retry_no];
           else
           return false;
         }else{
           return false;
         } */
      }

      break;
  }
}

async function decideRuleRouting(rule_evaulation, routing_order, order_id, payment_mode, card_details, order_details) {


  switch (rule_evaulation.length) {
    case 0:
      if (routing_order.length > 0) {
        let firstSelectedMid = await routingOrderBasedMidList(routing_order, order_id, payment_mode, card_details, order_details);
        return firstSelectedMid;
      } else {
        return false;
      }
      break;
    case 1:
      if (rule_evaulation[0].no_of_rule_fail == 0) {
        let firstSelectedMid = await midListFromRule(rule_evaulation[0], routing_order, order_id, payment_mode, card_details, order_details);
        return firstSelectedMid;
      } else {
        if (routing_order.length > 0) {
          let firstSelectedMid = await routingOrderBasedMidList(routing_order, order_id, payment_mode, card_details, order_details);
          return firstSelectedMid;
        } else {
          return false;
        }
      }
      break;
    default:
      let firstSelectedMid = await minFailedRuleMid(rule_evaulation, routing_order, order_id, payment_mode, card_details, order_details);
      if (firstSelectedMid) {
        return firstSelectedMid;
      } else {
        if (routing_order.length > 0) {
          let firstSelectedMid = await routingOrderBasedMidList(routing_order, order_id, payment_mode, card_details, order_details);
          return firstSelectedMid;
        } else {
          return false;
        }
      }

      break;
  }
}
async function update_retry(last_transaction) {
  //console.log("yes");
  if (last_transaction.length == 2) {
    if (last_transaction[0]?.terminal == last_transaction[1]?.terminal) {
      const order_retry = {
        retry_txn: 1,
      };
      await merchantOrderModel.updateDynamic(
        order_retry,
        {
          id: last_transaction[0]?.id,
        },
        'order_life_cycle_logs'
      );
    } else {
      const order_retry = {
        cascade_txn: 1,
      };
      await merchantOrderModel.updateDynamic(
        order_retry,
        {
          id: last_transaction[0]?.id,
        },
        'order_life_cycle_logs'
      );
    }
  }
}

async function terminalRouting(req, order_id, payment_mode) {


  try {
    let table_name = "orders";
    if (payment_mode == "test") {
      table_name = "test_orders";
    }
    const order_details = await merchantOrderModel.selectOne(
      "merchant_id,remark,description,currency,amount,success_url,cancel_url,failure_url,origin,action",
      {
        order_id: order_id,
      },
      table_name
    );

    const card_type = req?.card_details?.card_brand;
    const card_dc = req?.card_details?.card_type + ' CARD';
    const orderData = order_details; //await merchantOrderModel.selectOne('*', { order_id: order_id },table_name);
    const midquery = `SELECT md.* , mc.code , mc.currency  FROM pg_mid md INNER JOIN pg_master_currency mc ON mc.id = md.currency_id WHERE md.submerchant_id = '${parseInt(order_details.merchant_id)}'   AND  md.status = 0 AND md.deleted = 0 AND md.env ='${payment_mode}' AND FIND_IN_SET('${card_type}', md.payment_schemes) AND FIND_IN_SET('${card_dc}',md.payment_methods) AND  mc.code = '${order_details?.currency}';`;
    console.log(midquery);
    const getmid = await merchantOrderModel.order_query(midquery);
    let is_domestic_or_international = "";
    if (req.card_details.country_code3 == "JOR") {
      is_domestic_or_international = "Domestic";
    } else {
      is_domestic_or_international = "International";
    }
    // fetch international and domestic from payment methods
    const branding_query = `SELECT others,is_visible FROM pg_merchant_payment_methods WHERE methods='card_payment' AND sub_merchant_id='${parseInt(order_details.merchant_id)}'`;
    const branding_controls = await merchantOrderModel.order_query(branding_query);

    let redirect_url = {
      success: '',
      failure: '',
      cancel: ''
    }
    let order_urls = {
      success: order_details.success_url,
      failure: order_details.failure_url,
      cancel: order_details.cancel_url
    }

    if (getmid.length > 0) {
      if (getmid.length === 1) {
        if (payment_mode == "live") {
          if (parseInt(getmid[0].minTxnAmount) > parseInt(orderData.amount)) {
            return { status: 'failed', message: "None of the PSP is configured for the amount less than " + getmid[0].minTxnAmount + " " + orderData.currency };
          }
          if (parseInt(getmid[0].maxTxnAmount) < parseInt(orderData.amount)) {
            return { status: 'failed', message: "None of the PSP is configured for the amount greater than " + getmid[0].minTxnAmount + " " + orderData.currency };
          }
          if (
            is_domestic_or_international == "Domestic" &&
            getmid[0].domestic == 1 &&
            !branding_controls[0].others.includes("DOMESTIC CARD") &&
            branding_controls[0].is_visible == 1
          ) {
            return { status: 'failed', message: "Domestic cards is not supported by this merchant!" };

          }
          if (
            is_domestic_or_international == "International" &&
            getmid[0].international == 1 &&
            !branding_controls[0].others.includes("INTERNATIONAL CARD") &&
            branding_controls[0].is_visible == 1
          ) {
            return { status: 'failed', message: "International cards is not supported by this merchant!" };
          }
        }
        const getpsp = await PspModel.selectOne("*", {
          id: getmid[0].psp_id,
        });
        if (!getpsp.credentials_key) {
          return { status: 'failed', message: "No Credentials Found in Selected PSP!!" };
        }
        const psp_name = getpsp.credentials_key.toLowerCase();

        const psp_credentials = credientials[psp_name];
        const base_url = payment_mode == 'test' ? psp_credentials.test_url : psp_credentials?.base_url;


        if (!getmid[0]?.terminal_id || getmid[0]?.terminal_id === "") {
          return { status: 'failed', message: "Card Scheme not Supported" };
        }

        if (order_urls.success != '' && order_urls.success != null && order_urls.success != 'undefined') {
          redirect_url.success = order_urls.success
        } else if (getmid[0]?.success_url != '' && getmid[0]?.success_url != null && getmid[0]?.success_url != 'undefined') {
          redirect_url.success = getmid[0]?.success_url
        } else {
          redirect_url.success = process.env.DEFAULT_SUCCESS_URL
        }
        if (order_urls.failure != '' && order_urls.failure != null && order_urls.failure != 'undefined') {
          redirect_url.failure = order_urls.failure
        } else if (getmid[0]?.failure_url != '' && getmid[0]?.failure_url != null && getmid[0]?.failure_url != 'undefined') {
          redirect_url.failure = getmid[0]?.failure_url
        } else {
          redirect_url.failure = process.env.DEFAULT_FAILED_URL
        }
        if (order_urls.cancel != '' && order_urls.cancel != null && order_urls.cancel != 'undefined') {
          redirect_url.cancel = order_urls.cancel
        } else if (getmid[0]?.cancel_url != '' && getmid[0]?.cancel_url != null && getmid[0]?.cancel_url != 'undefined') {
          redirect_url.cancel = getmid[0]?.cancel_url
        } else {
          redirect_url.cancel = process.env.DEFAULT_CANCEL_URL
        }

        const updateorder = {
          description:
            order_details.remark == ""
              ? psp_name.toUpperCase()
              : order_details.description,
          remark:
            order_details.remark == ""
              ? psp_name.toUpperCase()
              : order_details.remark,
          action: order_details?.origin == "REMOTE" ? order_details?.action : getmid[0]?.mode,
          // action: getmid[0]?.mode,
          terminal_id: getmid[0]?.terminal_id,
          psp_id: getmid[0]?.psp_id,
          payment_mode: req.card_details.card_type + " CARD",
          //is_one_click: saved_card ? 1 : 0,
          issuer: req.card_details.issuer,
          card_bin: req.card_details.bin_number,
          issuer_website: req.card_details.issuer_website,
          issuer_phone_number: req.card_details.issuer_phone,
          cardCategory: req.card_details.card_category,
          cardholderName: req.card_details.card_holder_name,
          success_url:  req.body.data.urls.callback? req.body.data.urls.callback:"",
          cancel_url:  req.body.data.urls.callback? req.body.data.urls.callback:"",
          failure_url:  req.body.data.urls.callback? req.body.data.urls.callback:""
        };
        console.log(`update order`);
        console.log(updateorder)
        if (!orderData.description) {
          updateorder.description = psp_name;
        }
        console.log(getmid[0]?.terminal_id);
        console.log(`update order is here`);
        console.log(updateorder);
        await merchantOrderModel.updateDynamic(
          updateorder,
          { order_id: order_id },
          table_name
        );

        // request id table entry
        let p_request_id = await helpers.make_sequential_no("REQ");
        let merchant_id = await helpers.get_data_list(
          "merchant_id",
          table_name,
          { order_id: order_id }
        );
        let order_req = {
          merchant_id: merchant_id[0].merchant_id,
          order_id: order_id,
          request_id: p_request_id,
          request: '',
        };
        await helpers.common_add(order_req, "generate_request_id");


        const _terminal_details = await merchantOrderModel.selectDynamicONE('MID', { terminal_id: getmid[0]?.terminal_id }, 'mid');
        req.body.mid = _terminal_details?.MID

        let psp_details = {
          psp_name: psp_name.toLowerCase(),
          merchant_url: base_url,
          terminal_no: getmid[0]?.terminal_id,
        }
        return { status: 'success', message: "PSP found successfully.", data: psp_details };
      } else {

        const mid_name = [];
        const avrage = [];
        for (let i = 0; i < getmid.length; i++) {
          const getpspName = await PspModel.selectOne("*", {
            id: getmid[0].psp_id,
          });
          const psp_name = getpspName?.credentials_key?.toLowerCase();
          if (!psp_name) {
            return res
              .status(StatusCode.ok)
              .send(ServerResponse.errormsg("No psp available"));
          }
          let today = moment().format('YYYY-MM-DD');
          let last_week_day = moment().subtract(7, 'days').format('YYYY-MM-DD');
          const query = `SELECT  SUM(CASE WHEN status = 'AUTHORISED' THEN 1 ELSE 0 END) AS success_count, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failure_count FROM ${config.table_prefix + table_name} WHERE psp = '${getpspName.credentials_key.toUpperCase()}' AND DATE(created_at) BETWEEN  '${last_week_day}' AND '${today}'`;
          const orders = await merchantOrderModel.order_query(query);
          const psp_credentials = credientials[psp_name];
          const base_url = payment_mode == 'test' ? psp_credentials?.test_url : psp_credentials?.base_url;

          if (!getmid[i]?.terminal_id || getmid[i]?.terminal_id === "") {
            return res
              .status(StatusCode.ok)
              .send(
                ServerResponse.errorMsgWithData("Card Scheme not Supported")
              );
          }
          if (orders.length === 0) {
            avrage.push({
              avg: 0,
              psp_id: getpspName.id,
              name: getpspName.credentials_key,
              psp_name: getpspName?.name,
              merchant_url: base_url,
              terminal_id: getmid[i]?.terminal_id,
              domestic: getmid[i]?.domestic,
              international: getmid[i]?.international,
              minTxnAmount: getmid[i]?.minTxnAmount,
              maxTxnAmount: getmid[i]?.maxTxnAmount,
              mode: getmid[i]?.mode,
              success_url: getmid[i].success_url,
              failure_url: getmid[i].failure_url,
              cancel_url: getmid[i].cancel_url
            });
          } else {
            const avg =
              (parseInt(orders[0].success_count) /
                (parseInt(orders[0].success_count) +
                  parseInt(orders[0].failure_count))) *
              100;
            avrage.push({
              avg: avg,
              psp_id: getpspName.id,
              name: getpspName.credentials_key,
              psp_name: getpspName?.name,
              merchant_url: base_url,
              terminal_id: getmid[i]?.terminal_id,
              domestic: getmid[i]?.domestic,
              international: getmid[i]?.international,
              mode: getmid[i]?.mode,
              success_url: getmid[i].success_url,
              failure_url: getmid[i].failure_url,
              cancel_url: getmid[i].cancel_url

            });
          }
        }
        const maxObj = avrage.reduce((prev, curr) => {
          let prevVal = Object.values(prev)[0];
          prevVal = prevVal || 0;
          const currVal = Object.values(curr)[0];
          return parseInt(currVal) > parseInt(prevVal) ? curr : prev;
        });
        if (payment_mode == 'live') {
          if (parseInt(maxObj.minTxnAmount) > parseInt(orderData.amount)) {
            return { status: 'failed', message: "None of the PSP is configured for the amount less than " + maxObj.maxTxnAmount + " " + orderData.currency };
          }
          if (parseInt(maxObj.maxTxnAmount) < parseInt(orderData.amount)) {
            return { status: 'failed', message: "None of the PSP is configured for the amount greater than " + maxObj.maxTxnAmount + " " + orderData.currency };

          }
          if (
            is_domestic_or_international == "Domestic" &&
            maxObj.domestic == 1 &&
            !branding_controls[0].others.includes("DOMESTIC CARD") &&
            branding_controls[0].is_visible == 1
          ) {
            return { status: 'failed', message: "Domestic cards is not supported by this merchant!" };
          }
          if (
            is_domestic_or_international == "International" &&
            maxObj.international == 1 &&
            !branding_controls[0].others.includes("INTERNATIONAL CARD") &&
            branding_controls[0].is_visible == 1
          ) {
            return { status: 'failed', message: "International cards is not supported by this merchant!" };
          }

        }
        const getpsp = await PspModel.selectOne("*", {
          id: getmid[0].psp_id,
        });
        if (order_urls.success != '' && order_urls.success != null && order_urls.success != 'undefined') {
          redirect_url.success = order_urls.success
        } else if (maxObj?.success_url != '' && maxObj?.success_url != null && maxObj?.success_url != 'undefined') {
          redirect_url.success = maxObj?.success_url
        } else {
          redirect_url.success = process.env.DEFAULT_SUCCESS_URL
        }
        if (order_urls.failure != '' && order_urls.failure != null && order_urls.failure != 'undefined') {
          redirect_url.failure = order_urls.failure
        } else if (maxObj?.failure_url != '' && maxObj?.failure_url != null && maxObj?.failure_url != 'undefined') {
          redirect_url.failure = maxObj?.failure_url
        } else {
          redirect_url.failure = process.env.DEFAULT_FAILED_URL
        }
        if (order_urls.cancel != '' && order_urls.cancel != null && order_urls.cancel != 'undefined') {
          redirect_url.cancel = order_urls.cancel
        } else if (maxObj?.cancel_url != '' && maxObj?.cancel_url != null && maxObj?.cancel_url != 'undefined') {
          redirect_url.cancel = maxObj?.cancel_url
        } else {
          redirect_url.cancel = process.env.DEFAULT_CANCEL_URL
        }

        console.log("order_details?.origin", order_details?.origin)
        console.log("order_details?.action", order_details?.action)
        console.log("_terminal_details?.mode", maxObj?.mode)

        const updateorder = {
          description:
            order_details.description == ""
              ? maxObj.psp_name.toUpperCase()
              : order_details.description,
          remark:
            order_details.remark == ""
              ? maxObj.psp_name.toUpperCase()
              : order_details.remark,
          //  action: maxObj?.mode,
          action: order_details?.origin == "REMOTE" ? order_details?.action : maxObj?.mode,
          terminal_id: maxObj.terminal_id,
          psp_id: maxObj?.psp_id,
          payment_mode: req.card_details.card_type + " CARD",
          //is_one_click: saved_card ? 1 : 0,
          issuer: req.card_details.issuer,
          card_bin: req.card_details.bin_number,
          issuer_website: req.card_details.issuer_website,
          issuer_phone_number: req.card_details.issuer_phone,
          cardCategory: req.card_details.card_category,
          cardholderName: req.card_details.card_holder_name,
          success_url: redirect_url.success,
          cancel_url: redirect_url.cancel,
          failure_url: redirect_url.failure

        };
        await merchantOrderModel.updateDynamic(
          updateorder,
          { order_id: order_id },
          table_name
        );

        // request id table entry
        let p_request_id = await helpers.make_sequential_no("REQ");
        let merchant_id = await helpers.get_data_list(
          "merchant_id",
          table_name,
          { order_id: order_id }
        );
        let order_req = {
          merchant_id: merchant_id[0].merchant_id,
          order_id: order_id,
          request_id: p_request_id,
          // request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, "generate_request_id");


        const _terminal_details = await merchantOrderModel.selectDynamicONE('MID', { terminal_id: maxObj?.terminal_id }, 'mid');
        req.body.mid = _terminal_details?.MID
        let psp_details = {
          psp_name: maxObj.name.toLowerCase(),
          merchant_url: maxObj.merchant_url,
          terminal_no: maxObj?.terminal_id,
        }
        return { status: 'success', message: "PSP found successfully.", data: psp_details };
      }
    } else {
      return { status: 'failed', message: "Card scheme not supported by merchant." };
    }
  } catch (error) {
    console.log(error)
    return { status: 'failed', message: 'Something went wrong' };
  }
}

async function mpgsSessionAndAuth(req, order_id, mode, psp_name) {
  let payment_id;
  let order_table = mode == "live" ? "orders" : "test_orders";
  let txn_table = mode == "live" ? "order_txn" : "test_order_txn";
  let txn_response_dump =
    mode == "live" ? "txn_response_dump" : "test_txn_response_dump";
  let body_date = {
    ...req.body,
  };
  var updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
  let card_no = "";
  let enc_customer_id = "";
  let card_details;
  let full_card_no = "";
  let name_on_card = "";
  let expiry = "";
  let generate_request_id_table = mode === 'live' ? 'generate_request_id' : 'test_generate_request_id';
  full_card_no = req.body.paymentMethod.paymentCard.number;
  enc_customer_id = req.customer_id;
  name_on_card = req.body.customer_details.name;
  expiry = req.body.paymentMethod.paymentCard.expiryDate.split("/").reverse().join("-");
  let order_data = {
    browser_version: req.headers["x-browser-version"],
    os: req.headers.os,
    ip: req.headers.ip,
    ip_country: req.headers.ipcountry,
    cid: enc_customer_id,
    updated_at: updated_at,
    card_country: req.card_details.country,
    cardType: req.card_details.card_type,
    scheme: req.card_details.card_brand,
    pan: `${full_card_no.substring(0, 6)}****${full_card_no.substring(
      full_card_no.length - 4
    )}`,
    cardholderName: name_on_card,
    expiry: expiry,
  };
  const order_date_update = await merchantOrderModel.updateDynamic(
    order_data,
    {
      order_id: order_id,
    },
    order_table
  );

  const order_details = await merchantOrderModel.selectOne(
    "*",
    {
      order_id: order_id,
    },
    order_table
  );
  const mid_details = await merchantOrderModel.selectOne(
    "MID,password,psp_id,is3DS,autoCaptureWithinTime,allowVoid,voidWithinTime",
    {
      terminal_id: order_details.terminal_id,
    },
    "mid"
  );
  const getpsp = await PspModel.selectOne("*", {
    id: mid_details.psp_id,
  });
  if (!mid_details) {
    return { status: 'failed', message: "No Terminal Available" };
  }

  const autoCaptureHours = parseInt(mid_details.autoCaptureWithinTime);
  // Get the current date and time using moment.
  const currentDate = moment();
  // Add autoCaptureHours to the current date to get the new date and time.
  const newDateTime = currentDate.add(autoCaptureHours, "hours");
  // Format the newDateTime as "YYYY-MM-DD HH:mm"
  const capture_datetime = newDateTime.format("YYYY-MM-DD HH:mm");

  let voidWithinDatetime = "";

  if (mid_details.allowVoid == 1) {
    const voidWithinTimeHours = parseInt(mid_details?.voidWithinTime);
    const newVoidDateTime = currentDate.add(voidWithinTimeHours, "hours");
    // Format the newDateTime as "YYYY-MM-DD HH:mm"
    voidWithinDatetime = newVoidDateTime.format("YYYY-MM-DD HH:mm");
  }

  const _pspid = await merchantOrderModel.selectOne(
    "*",
    {
      id: mid_details.psp_id,
    },
    "psp"
  );


  let mpgs_req = {
    action: order_details.action,
    value: order_details.amount,
    order_id: order_id,
    card_no: req.body.paymentMethod.paymentCard.number,
    expiry_date: req.body.paymentMethod.paymentCard.expiryDate.split("/").reverse().join("-"),
    cvv: req.body.paymentMethod.paymentCard.securityCode,
    cardholderName: req.body.customer_details.name,
    currency: order_details.currency,
  }

  const username = `merchant.${mid_details.MID}`
  const password = mid_details.password;
  const basicAuthToken = await helpers.createBasicAuthToken(username, password);
  const data1 = {
    correlationId: uuidv4(),
    session: {
      authenticationLimit: 5,
    },
  };

  try {
    let url = mode == "live" ? credentials[getpsp.credentials_key].base_url : credentials[getpsp.credentials_key].test_url;
    const config1 = {
      method: "post",
      url: url + `merchant/${mid_details.MID}/session`,
      headers: {
        Authorization: basicAuthToken,
        "Content-Type": "application/json",
      },
      maxBodyLength: Infinity,
      data: data1,
      maxRedirects: 10,
      timeout: 0,
    };
    const response = await axios(config1);
    const sessionId = response.data.session.id;
    console.log("Session ID:", sessionId);
    //update the session in table
    const session = { session: sessionId };
    const condition = {
      order_id: order_id,
    };

    const session_update = await merchantOrderModel.updateDynamic(
      session,
      condition,
      order_table
    );

    payment_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_TXN" : "TXN"
    );
    const pay_request_id = await helpers.make_sequential_no(
      mode == "test" ? "TST_REQ" : "REQ"
    );

    const [year, month] = mpgs_req.expiry_date.split("-");
    let payload = {
      sourceOfFunds: {
        type: "CARD",
        provided: {
          card: {
            number: mpgs_req.card_no,
            expiry: {
              month: month,
              year: year.slice(-2),
            },
            securityCode: mpgs_req.cvv,
            storedOnFile: "NOT_STORED",
          },
        },
      },
      transaction: {
        id: uuidv4(),
      },
      order: {
        amount: order_details.amount,
        currency: order_details.currency,
        id: order_id,
      },
      authentication: {
        channel: "PAYER_BROWSER",
        redirectResponseUrl: process.env.SERVER_LOAD+':4008/api/v1/status-mpgs?order_id=' + order_id + '&mode=' + mode
      },
    };

    let data = JSON.stringify(payload);
    console.log(`data is here`);
    console.log(data);
    let config = {
      method: "put",
      maxBodyLength: Infinity,
      url: `${url}merchant/${mid_details.MID}/session/${sessionId}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthToken,
      },
      data: data,
    };
    const final_response = await axios(config);
    console.log(`the response is here`);
    console.log(JSON.stringify(final_response.data));
    // Call updateDynamic to store sessionId in the database
    await merchantOrderModel.updateDynamic(
      { payment_id: payment_id, psp: _pspid.name },
      { order_id: order_id },
      order_table
    );
    let temp_card = {
      card_no: req.body.paymentMethod.paymentCard.number,
      expiry_date: req.body.paymentMethod.paymentCard.expiryDate.split("/").reverse().join("-"),
      cvv: req.body.paymentMethod.paymentCard.securityCode,
    }
    await merchantOrderModel.updateDynamic(
      { session: JSON.stringify(temp_card) },
      {
        order_id: order_id,
      },
      order_table
    );
    const insertFunction =
      mode === "live"
        ? order_transactionModel.add
        : order_transactionModel.test_txn_add;
    const insert_to_txn_table = await insertFunction({
      order_id: order_id,
      txn: payment_id.toString(),
      type: order_details.action.toUpperCase(),
      status: "AWAIT_3DS",
      amount: order_details.amount,
      currency: order_details.currency,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      payment_id: payment_id.toString(),
    });


    let billingCountryIso3 = countryToAlpha3(order_details.billing_country);
    let b_token = {
      os: req.headers?.os,
      browser: req.headers?.browser,
      browser_fingerprint: req.headers?.fp,
    };
    let auth_res = {
      threeds_url:process.env.PAYMENT_URL+'mpgs-process-threeds?session_id='+sessionId+'&order_id='+order_id+'&transaction_id='+payment_id+'&mid='+mid_details.MID,
      mpgs_url: url, // from config file
      session_id: sessionId, // from meps api
      order_id: order_id, // paydart order id
      transaction_id: payment_id.toString(),
      mid: mid_details.MID, // From routing,
      billing_address: "",
      city: "",
      billing_country: ""
    };
    return { status: 'success', message: "Authentication done", data: auth_res }
  } catch (error) {
    console.log(error?.response?.data?.error);
    return { status: 'failed', message: "Something went wrong" }
  }
}

async function routingOrderBasedMidList(routing_order, order_id, mode, card_details, order_details) {
  let mid_list_arr = [];
  for (let ro of routing_order) {
    let checkMidIsValidForTxn = await checkMidIsValid(ro.mid_id, card_details, order_details);
    if (checkMidIsValidForTxn) {
      mid_list_arr.push(ro.mid_id);
    }
  }
  mid_list_arr.length = routing_order[0].cascade + 1 // remove mids for cascade length


  let order_life_cycle_data = {
    order_id: order_id,
    mid_list: mid_list_arr.join(','),
    retry: routing_order[0].retry,
    cascade: routing_order[0].cascade,
    mode: mode
  }

  console.log(routing_order[0].cascade, mid_list_arr);

  let add_res = await RoutingModel.add(order_life_cycle_data, 'order_life_cycle');
  return mid_list_arr[0];
}
async function saveCard(req, order_id, mode) {

  try {
    let secret_key = await cipherModel.selectOne("id", {
      ["expiry_date >= "]: moment().format("YYYY-MM-DD"),
      is_active: 1,
    });
    let created_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let card_number = await enc_dec.dynamic_encryption(
      req.body.paymentMethod.paymentCard.number,
      secret_key.id,
      ""
    );
    let cvv = await enc_dec.dynamic_encryption(
      req.body.paymentMethod.paymentCard.securityCode,
      secret_key.id,
      ""
    );
    let card_proxy = enc_dec.encrypt_card(req.body.paymentMethod.paymentCard.number);
    let card = {
      name_on_card: req.body.customer_details.name,
      email: req.body.customer_details.email,
      card_number: card_number,
      card_expiry: req.body.paymentMethod.paymentCard.expiryDate,
      last_4_digit: req.body.paymentMethod.paymentCard.number.slice(-4),
      cid: req.customer_id,
      created_at: created_at,
      updated_at: updated_at,
      card_proxy: card_proxy,
      cipher_id: secret_key.id,
      is_save: req.body.paymentMethod.tokenize,
    };
    let temp_card_storage_data = {
      order_id: order_id,
      mode: mode,
      card: card_number,
      expiry: req.body.paymentMethod.paymentCard.expiryDate,
      card_holder_name: req.body.customer_details.name,
      cipher_id: secret_key.id,
      card_proxy: card_proxy,
      cvv: cvv,
    };

    let addTempCardRes = await helpers.addTempCard(temp_card_storage_data);


    let result = await merchantOrderModel.addCustomerCards(card);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }

}