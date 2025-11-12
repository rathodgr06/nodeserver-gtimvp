const helpers = require("../utilities/helper/general_helper");
const moment = require("moment");
const winston = require("../utilities/logmanager/winston");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const EventEmitter = require("events");
const ee = new EventEmitter();
const crypto = require("crypto");
const path = require("path");
const mpgsTestRecurring = require("./mpgs/recurring");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
let axios = require("axios");
const RequestMaker = require("./fiserv/ReuqestMaker");

const charges_invoice_models = require("../models/charges_invoice_models");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");

let PayoutController = {
  check_payout_schedule: async (req, res) => {
    try {
      const current_date = moment().format("YYYY-MM-DD");
      let schedule_plans = await check_payout_schedule_api_call(current_date);
      console.log("🚀 ~ schedule_plans:", JSON.stringify(schedule_plans));

      if (schedule_plans?.status == 200) {
        let transactions = [];
        let array = schedule_plans?.data || [];

        await Promise.all(
          array.map(async (element) => {
            const { plan, min_amount: amount, currency } = element;
            let country_iso_code = plan?.country_iso_code;

            let country_id = await helpers.get_country_id_by_code(
              country_iso_code
            );
            if (!country_id) {
              throw new Error(`Invalid country ISO code: ${country_iso_code}`);
            }

            
            let wallet_list = await charges_invoice_models.fetchWalletList(
                country_id,
                currency,
                amount,
                country_iso_code,
              );
            console.log("🚀 ~ array.map ~ wallet_list:", wallet_list)


            await Promise.all(
              wallet_list.map(async (wallet) => {

                console.log("🚀 ~ Is Default Plan ? :" + plan?.plan_name , plan?.is_default);

                if (plan?.is_default) {
                  // Check and skip overrided wallets
                  let plan_master = await check_overrided_plan(wallet?.sub_merchant_id);
                  console.log("🚀 ~ wallet_list.map ~ plan_master:", plan_master)
                  if (plan_master?.status == 200) {
                    console.log("🚀 ~ skipped.override.sub_merchant_id:", wallet?.sub_merchant_id);
                    return;
                  }
                }else{
                  // Check and skip wallets with no plan
                  let plan_master = await check_overrided_plan(wallet?.sub_merchant_id);
                  console.log("🚀 ~ wallet_list.map ~ plan_master:", plan_master)
                  if (plan_master?.status !== 200) {
                    console.log("🚀 ~ skipped.default.sub_merchant_id:", wallet?.sub_merchant_id);
                    return;
                  }
                }

                let receiver = await get_receiver_by_sub_merchant_id_api_call(
                  wallet?.sub_merchant_id
                );
                let receiver_id = receiver?.receiver?.receiver_id;
                console.log("🚀 ~ receiver_id:", receiver_id);

                if (!receiver_id) return;

                transactions.push({
                  order_id: "",
                  payout_reference: "Auto Settlement",

                  sub_merchant_id: String(wallet?.sub_merchant_id),
                  receiver_id: "",
                  wallet_id: "",
                  currency: wallet?.currency,

                  account_id: "",

                  amount: wallet?.total_net_amount,
                  debit_amount: "",
                  debit_currency: "",

                  confirmation_required: true,
                  purpose_of_remittance: wallet?.currency !== 'CNY' ? "OTHER_FEES" : "SERVICE_CHARGES",
                  webhook_url: null,
                });
              })
            );
          })
        );


        let payout_result = '';
        if (Array.isArray(transactions) && transactions.length > 0) {

          let payload = {
            transactions,
          };


          console.log("🚀 ~ payout payload:", payload);

          payout_result = await create_batch_payout_api_call(payload);
          console.log("🚀 ~ payout_result:", JSON.stringify(payout_result));

        }


          // Re-schedule Plans
          await Promise.all(
            array.map(async (element) => {
              const {
                min_amount,
                plan_item_id,
                plan_id,
                currency,
                frequency,
                occurrence,
                start,
              } = element;

              let re_schedule_payout = {
                plan_item_id: plan_item_id,
                plan_id: plan_id,
                currency: currency,
                frequency: frequency,
                occurrence: occurrence,
                start: start,
                min_amount: min_amount,
              };

              let re_schedule_payout_result = await re_schedule_payout_api_call(
                re_schedule_payout
              );
              console.log(
                "🚀 ~ array.map ~ re_schedule_payout_result:",
                re_schedule_payout_result
              );
            })
          );

          return response.successdatamsg(payout_result, "Payout is done");
      }
    } catch (error) {
      console.error("Error in payout processing:", error);
      winston.error(error);
      return response.errormsg(error?.message);
    }
  },
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function check_overrided_plan(sub_merchant_id) {
  sub_merchant_id = encrypt_decrypt("encrypt", sub_merchant_id);
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/schedule/get-master-payout-schedule-by-mid/" +
        sub_merchant_id,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
    };
    console.log("🚀 ~ check_overrided_plan ~ URL:", config.url);

    let response = await axios.request(config);

    return {status: response?.status, message: response?.message, data: response?.data};
  } catch (error) {
    console.log(error.message);
    return {status: 400, message: error.message, data: null};
  }
}

async function get_receiver_by_sub_merchant_id_api_call(sub_merchant_id) {
  try {
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/receiver/get-receiver-by-sub-id/" +
        sub_merchant_id,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function check_payout_schedule_api_call(schedule_date) {
  try {
    let data = JSON.stringify({
      schedule_date: schedule_date,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/schedule/check-payout-schedule",
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function create_batch_payout_api_call(payload) {
  try {
    let data = JSON.stringify(payload);

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.PAYOUT_SERVER_URL + "/v1/payout/batch-payout",
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function re_schedule_payout_api_call(payload) {
  try {
    let data = JSON.stringify(payload);

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        process.env.PAYOUT_SERVER_URL +
        "/v1/payout/schedule/payout-re-schedule",
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
        "Content-Type": "application/json",
      },
      data: data,
    };

    let response = await axios.request(config);

    return response?.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = PayoutController;
