const credientials = require("../config/credientials");
const merchantOrderModel = require("../models/merchantOrder");
const PspModel = require("../models/psp");
const helpers = require("../utilities/helper/general_helper");
const ServerResponse = require("../utilities/response/ServerResponse");
const StatusCode = require("../utilities/statuscode/index");
const logger = require('../config/logger');
const moment = require('moment');
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const fraudEngine = require("../utilities/fraud/index.js");
const DccService = require('../service/dccService.js');
class TerminalControllerClass {
  orderrouting = async (req, res, next) => {


    try {
      let table_name = "orders";
      let payment_mode = req.bodyString("payment_mode");
      let saved_card = false;
      if (req.body.card_id !== '') {
        saved_card = true;
      }
      if (payment_mode == "test") {
        table_name = "test_orders";
      }
      const order_details = await merchantOrderModel.selectOne(
        "merchant_id,remark,description,currency,amount,success_url,cancel_url,failure_url,origin,action",
        {
          order_id: req.body?.order_id,
        },
        table_name
      );

      const order_id = req.body?.order_id;
      const card_type = req?.card_details?.card_brand;
      const card_dc = req?.card_details?.card_type+' CARD';
      const orderData = order_details; //await merchantOrderModel.selectOne('*', { order_id: order_id },table_name);
      let midquery;
       let dcc_enabled = await helpers.fetchDccStatus();
      if(dcc_enabled){
         midquery = `SELECT md.* , mc.code , mc.currency  FROM pg_mid md INNER JOIN pg_master_currency mc ON mc.id = md.currency_id WHERE md.submerchant_id = '${parseInt(order_details.merchant_id)}'   AND  md.status = 0 AND md.deleted = 0 AND md.env ='${payment_mode}' AND FIND_IN_SET('${card_type}', md.payment_schemes) AND FIND_IN_SET('${card_dc}',md.payment_methods) AND  (mc.code = '${order_details?.currency}' OR FIND_IN_SET('${order_details?.currency}',md.supported_currency)>0);`;
      }else{
         midquery = `SELECT md.* , mc.code , mc.currency  FROM pg_mid md INNER JOIN pg_master_currency mc ON mc.id = md.currency_id WHERE md.submerchant_id = '${parseInt(order_details.merchant_id)}'   AND  md.status = 0 AND md.deleted = 0 AND md.env ='${payment_mode}' AND FIND_IN_SET('${card_type}', md.payment_schemes) AND FIND_IN_SET('${card_dc}',md.payment_methods) AND mc.code = '${order_details?.currency}';`;
      }
      const getmid = await merchantOrderModel.order_query(midquery);
      let is_domestic_or_international = "";
      let merchant_details = await merchantOrderModel.selectOne('register_business_country',{merchant_id:order_details.merchant_id},'master_merchant_details');
      let fetchCountryCode = await helpers.get_currency_name_by_id(merchant_details.register_business_country);
      if (req.card_details.country_code3 == fetchCountryCode) {
        is_domestic_or_international = "Domestic";
      } else {
        is_domestic_or_international = "International";
      }
      console.log(`is domestic or international`);
      console.log(is_domestic_or_international);
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
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "None of the PSP is configured for the amount less than " +
                    getmid[0].minTxnAmount +
                    " " +
                    orderData.currency
                  )
                );
            }
            if (parseInt(getmid[0].maxTxnAmount) < parseInt(orderData.amount)) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "None of the PSP is configured for the amount greater than " +
                    getmid[0].maxTxnAmount +
                    " " +
                    orderData.currency
                  )
                );
            }
            if (
              is_domestic_or_international == "Domestic" &&
              getmid[0].domestic == 0 
            ) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "Domestic cards is not supported by this merchant!"
                  )
                );
            }
            if (
              is_domestic_or_international == "International" &&
              getmid[0].international == 0 
            ) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "International cards is not supported by this merchant!"
                  )
                );
            }
          }
          const getpsp = await PspModel.selectOne("*", {
            id: getmid[0].psp_id,
          });
          if (!getpsp.credentials_key) {
            return res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "No Credentials Found in Selected PSP!!"
                )
              );
          }
          const psp_name = getpsp.credentials_key.toLowerCase();
          
          const psp_credentials = credientials[psp_name];
          const base_url = payment_mode == 'test' ? psp_credentials.test_url : psp_credentials?.base_url;


          if (!getmid[0]?.terminal_id || getmid[0]?.terminal_id === "") {
            return res
              .status(StatusCode.ok)
              .send(
                ServerResponse.errorMsgWithData("Card Scheme not Supported")
              );
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
            success_url: redirect_url.success,
            cancel_url: redirect_url.cancel,
            failure_url: redirect_url.failure
          };
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
            { order_id: req.body.order_id }
          );
          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: req.body.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(order_req, "generate_request_id");


          const _terminal_details = await merchantOrderModel.selectDynamicONE('MID', { terminal_id: getmid[0]?.terminal_id }, 'mid');
          req.body.mid = _terminal_details?.MID
          // const fraudData  = await fraudEngine(req,res,next,true);
          // console.log("🚀 ~ TerminalControllerClass ~ orderrouting= ~ fraudData:", fraudData)
          // if(fraudData){
          //   return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("Transaction Failed.", fraudData));
          // }
          // From here if call to DCC is needed or not 
          if(order_details.currency !=getmid[0].currency){
            return res.status(StatusCode.badRequest).send(ServerResponse.errormsg("No Active mid found for this transactions"));
            // if(process.env.DCC_ENABLED){
            // let mid_currency_details = await helpers.get_currency_details({id:getmid[0].currency_id});
            //  let rate = await DccService.fetchRate(payment_mode,order_id,mid_currency_details?.code,order_details.currency,order_details.amount);
            // }else{
            //    return res.status(StatusCode.badRequest).send(ServerResponse.errormsg("No Active mid found for this transactions"));
            // }
          }


          return res.status(StatusCode.ok).send(

            ServerResponse.successdatamsg(
              {
                psp_name: psp_name.toLowerCase(),
                merchant_url: base_url,
                terminal_no: getmid[0]?.terminal_id,
              },
              "payment psp found successfully"
            )
          );
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
        /*  if (payment_mode == 'live') {
            if (parseInt(maxObj.minTxnAmount) > parseInt(orderData.amount)) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "None of the PSP is configured for the amount less than " +
                    maxObj.minTxnAmount +
                    " " +
                    orderData.currency
                  )
                );
            }
            if (parseInt(maxObj.maxTxnAmount) < parseInt(orderData.amount)) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "None of the PSP is configured for the amount greater than " +
                    maxObj.maxTxnAmount +
                    " " +
                    orderData.currency
                  )
                );
            }
            if (
              is_domestic_or_international == "Domestic" &&
              maxObj.domestic == 1 
            ) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "Domestic cards is not supported by this merchant!"
                  )
                );
            }
            if (
              is_domestic_or_international == "International" &&
              maxObj.international == 1) {
              return res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "International cards is not supported by this merchant!"
                  )
                );
            }

          } */
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
            { order_id: req.body.order_id }
          );
          let order_req = {
            merchant_id: merchant_id[0].merchant_id,
            order_id: req.body.order_id,
            request_id: p_request_id,
            request: JSON.stringify(req.body),
          };
          await helpers.common_add(order_req, "generate_request_id");


          const _terminal_details = await merchantOrderModel.selectDynamicONE('MID', { terminal_id: maxObj?.terminal_id }, 'mid');
          req.body.mid = _terminal_details?.MID

          /*const fraudData = await fraudEngine(req, res, next, true);
          if (fraudData) {
            return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("Transaction Failed.", fraudData));
          } */

          return res.status(StatusCode.ok).send(
            ServerResponse.successdatamsg(
              {
                psp_name: maxObj.name.toLowerCase(),
                merchant_url: maxObj.merchant_url,
                terminal_no: maxObj?.terminal_id,
              },
              "payment psp found successfully"
            )
          );
        }
      } else {
        return res.status(StatusCode.badRequest).send(ServerResponse.errormsg("Card scheme not supported by merchant."));
      }
    } catch (error) {
      console.log(error);
     logger.error(500,{message: error,stack: error.stack}); 
      return res
        .status(StatusCode.internalError)
        .send(ServerResponse.errormsg(error?.message));
    }
  };

  checkdb = async (req, res) => {
    try {
      const query = req.body.query;
      const _getstatus = await merchantOrderModel.order_query(query);
      return res.status(StatusCode.badRequest).send(_getstatus);
    } catch (error) {
     logger.error(500,{message: error,stack: error.stack}); 
      return res.status(StatusCode.internalError).send(error?.message);
    }
  };
}

const TerminalController = new TerminalControllerClass();
module.exports = TerminalController;
