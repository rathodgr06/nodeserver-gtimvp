require("dotenv").config({ path: "../.env" });
require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const helpers = require("../utilities/helper/general_helper");
const winston = require("../utilities/logmanager/winston");
const momentDataFormater = require("../utilities/date_formatter/index");
const RoutingModel = require("../models/routingModel");
const attributes = require("../utilities/validations/routing_rule_attribute");
const JSON6 = require('json-6')
var Routing = {
  routingAttribute: async (req, res) => {
    //console.log("here ssss");

    const attr = attributes.allAttribute();
    const merchant_id = await enc_dec.cjs_decrypt(
      req.bodyString("submerchant_id")
    );

    const mid_result = await RoutingModel.getMid(merchant_id, req.body.env);
   // console.log('mid_result', mid_result);
    const mid_res = [];
    if (mid_result && mid_result.length > 0) {
      for (const mid of mid_result) {
        mid_res.push({value:mid.id,key:mid.label});
      }
    }    
    
    const send_res = {
      attr: attr,
      mid: mid_res,
    };
    res
      .status(statusCode.ok)
      .send(response.successdatamsg(send_res, "Details fetched successfully."));
  },
  midList: async (req, res) => {
    try {
      const merchant_id = await enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      const env = req.body.env;
      const method = req.body.method;
      const condition = {
        merchant_id,
        env,
        method,
      };
      let mid_data = await RoutingModel.getMidFromPaymentMethod(condition);
      mid_data = mid_data.map((val) => {
        // mid_id: enc_dec.cjs_encrypt(val.id),
        //     psp_id: enc_dec.cjs_encrypt(val.psp_id),
        return {
          mid_id: val.id,
          psp_id: val.psp_id,
          mid: val.label,
          password: val.password,
          name: val.name,
        };
      });

      //create order
      const routing_order_result = await RoutingModel.get(
        {
          sub_merchant_id: merchant_id,
          payment_method: method,
          mode: env,
        },
        "routing_order"
      );

     // console.log("routing_order_result", routing_order_result);
      const new_res = {
        retry: "",
        cascade: "",
        mid_data: [],
      };

      //console.log("mid_data", mid_data);
      if (routing_order_result && routing_order_result.length > 0) {
        routing_order_result.map((order_val) => {
          mid_data.map((val) => {
            if (new_res.retry === "") {
              new_res.retry = order_val.retry;
            }

            if (new_res.cascade === "") {
              new_res.cascade = order_val.cascade;
            }

            if (order_val.mid_id === val.mid_id) {
              (val.mid_id = enc_dec.cjs_encrypt(val.mid_id)),
                (val.psp_id = enc_dec.cjs_encrypt(val.psp_id)),
                new_res.mid_data.push(val);
            }
          });
        });
      } else {
        mid_data.map((val) => {
          (val.mid_id = enc_dec.cjs_encrypt(val.mid_id)),
            (val.psp_id = enc_dec.cjs_encrypt(val.psp_id)),
            new_res.mid_data.push(val);
        });
      }

      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(new_res, "Details fetched successfully.")
        );
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  routingRule: async (req, res) => {
    try {
      //console.log("here");
      const merchant_id = await enc_dec.cjs_decrypt(
        req.bodyString("submerchant_id")
      );
      const env = req.body.env;
      const method = req.body.method;
      const condition = {
        sub_merchant_id: merchant_id,
        mode: env,
        payment_method: method,
        deleted:0
      };
      let rule_data = await RoutingModel.getRule(condition, "routing_rule");
     // console.log("rule_data", rule_data);
      const send_res = [];
      for (const rule of rule_data) {
 
        let data = {
          id: enc_dec.cjs_encrypt(rule.id),
          mode: rule.mode,
          payment_method: rule.payment_method,
          rule: rule.rule,
          rule_name: rule.rule_name,
          rule_order: rule.rule_order,
          rule_string: rule.rule_string,
          final_rule: rule.final_rule,
        //  final_rule: "",
          sub_merchant_id: enc_dec.cjs_encrypt(rule.sub_merchant_id),
          rule_status : rule.rule_status
        };
        send_res.push(data);
      }
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(send_res, "Details fetched successfully.")
        );
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  storeMidOrder: async (req, res) => {
    try {
      const { submerchant_id, env, payment_method, mid_id, retry, cascade } =
        req.body;
      //console.log('store', req.body);
      let i = 1;
      const created_at = await momentDataFormater.created_date_time();
      for (let mid of mid_id) {
        const sub_merchant_id = await enc_dec.cjs_decrypt(submerchant_id);
        const id = await enc_dec.cjs_decrypt(mid);

        const condition = {
          sub_merchant_id,
          mid_id: id,
          payment_method,
          mode: env,
        };
        const routing_order_result = await RoutingModel.get(
          condition,
          "routing_order"
        );

        const data = {
          sub_merchant_id: sub_merchant_id,
          mode: env,
          payment_method: payment_method,
          mid_id: id,
          retry: retry,
          cascade: cascade,
          routing_order: i,
          created_at: created_at,
          updated_at: created_at,
        };
        if (routing_order_result && routing_order_result.length > 0) {
         // console.log("update");
          await RoutingModel.update(condition, data, "routing_order");
        } else {
         // console.log("add", data);
          await RoutingModel.add(data, "routing_order");
        }
        i++;
      }

      res
        .status(statusCode.ok)
        .send(response.successmsg("Routing saved successfully"));
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  storeRoutingRule: async (req, res) => {
    //console.log("req.body",req.body);
    try {
      const routing_rule_table = "routing_rule";
      const created_at = await momentDataFormater.created_date_time();
     // console.log('req.body', req.body);
      const {
        submerchant_id,
        env,
        payment_method,
        routing_rule,
        json,
        rule_name,
      } = req.body;
      const sub_merchant_id = await enc_dec.cjs_decrypt(submerchant_id);
      let routing_rule_order = await RoutingModel.getRuleOrder(
        {
          sub_merchant_id,
          mode: env,
          payment_method,
        },
        routing_rule_table
      );
     // console.log('json', json);
      routing_rule_order = routing_rule_order+1;
      let routing_rule_str = routing_rule.replace(/[^\w ]/, '')
        let rule_string=[];
      json.forEach(element => {
        rule_string.push(element.key + " " + element.operator + " " + element.value)
     });
      let rule_str = rule_string.join(" and ", rule_string) + " then " + req.body.mid_result.mid.join(" ") ;

      let data = {
        sub_merchant_id,
        mode: env,
        payment_method,
        rule_name,
        rule_string: routing_rule_str.replace(/&lt;/g, '<').replace(/&gt;/g, '>'),//await helpers.extractAllText(routing_rule),
        rule: JSON.stringify(json),
        rule_order: routing_rule_order,
        created_at,
        updated_at: created_at,
        final_rule: rule_str,
      };
     // console.log("data", data);
      let message = '';
    //  console.log(`Object keys req body included id`);
    //  console.log(Object.keys(req.body).includes('id'));
      if (Object.keys(req.body).includes('id')) {
        const id =  enc_dec.cjs_decrypt(req.body.id);
        message = 'Rule updated successfully.'
        await RoutingModel.update({id:id}, data, routing_rule_table);
      } else {
        message = 'Rule saved successfully'
        await RoutingModel.add(data, routing_rule_table);
      }

      res
        .status(statusCode.ok)
        .send(response.successmsg(message));
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  updateRoutingRuleOrder: async (req, res) => {
    try {
      const { submerchant_id, env, rule_id } =
        req.body;
      //console.log('store', req.body);
      let i = 1;
      for (let rule of rule_id) {
        
        const id = await enc_dec.cjs_decrypt(rule);
        const data = {
          rule_order: i,
        };
        const condition ={
          id:id
        }
        await RoutingModel.update(condition, data, "routing_rule");
        i++;
      }

      res
        .status(statusCode.ok)
        .send(response.successmsg("Routing saved successfully"));
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  changeRuleStatus: async (req, res) => {
    try {
      const routing_rule_table = "routing_rule";
      const created_at = await momentDataFormater.created_date_time();
      console.log('req.body', req.body);
      const {
        id,
        is_status,
      } = req.body;
      const tid = await enc_dec.cjs_decrypt(id);
      let routing_rule_order = await RoutingModel.update(
        {
          id : tid
        },
        {
          rule_status : is_status
        },
        routing_rule_table
      );

      res
        .status(statusCode.ok)
        .send(response.successmsg("Updated successfully"));
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  ruleDelete: async (req, res) => {
    try {
      const routing_rule_table = "routing_rule";
      const {
        id
      } = req.body;
      const tid = await enc_dec.cjs_decrypt(id);
      let routing_rule_order = await RoutingModel.update(
        {
          id: tid
        },
        {
          deleted: 1
        },
        routing_rule_table
      );
      res
        .status(statusCode.ok)
        .send(response.successmsg("Rule deleted successfully"));
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  getRoutingRule: async (req, res) => {
    try {
      const routing_rule_table = "routing_rule";
      //console.log('req.body', req.body);
      const id = await enc_dec.cjs_decrypt(req.body.id);
      let routing_rule_order = await RoutingModel.getRule({id:id},routing_rule_table);
      routing_rule_order[0].id = enc_dec.cjs_encrypt(id)
      routing_rule_order[0].sub_merchant_id = enc_dec.cjs_encrypt(routing_rule_order[0].sub_merchant_id)
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(routing_rule_order[0], "Details fetched successfully.")
        );
    } catch (error) {
      winston.error(error);
      console.log("error", error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  }
};

module.exports = Routing;
