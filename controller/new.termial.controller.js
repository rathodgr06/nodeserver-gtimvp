const credientials = require("../config/credientials");
const merchantOrderModel = require("../models/merchantOrder");
const PspModel = require("../models/psp");
const helpers = require("../utilities/helper/general_helper");
const ServerResponse = require("../utilities/response/ServerResponse");
const StatusCode = require("../utilities/statuscode/index");
const winston = require('../utilities/logmanager/winston');
const RoutingModel = require('../models/routingModel');
const { json } = require("body-parser");
const enc_dec = require('../utilities/decryptor/decryptor');
const moment = require("moment");
const orderTransactionModel = require("../models/order_transaction");
const fraudEngine = require("../utilities/fraud/index.js");
class TerminalControllerClass {
  orderrouting = async (req, res,next) => {


    try {
      const { card_id, order_id, name, email, dial_code, mobile_no, card, expiry_date, cvv, save_card, browserFP, prefer_lang, payment_mode, card_details } = req.body;
     
      let card_number="";
      if (card_id){
        card_number = await getCardBIN(card_id);
      }

    
      // let checkCardForDeclined = await checkCardForHardDeclined(card_proxy);
      let saved_card = false;
      let change_card = false;
      let table_name = "orders";
      
      if (req.body.card_id && req.body.card_id !== '') { saved_card=true}
      if (payment_mode === "test") { table_name = "test_orders" }
      const order_details = await merchantOrderModel.selectOne("*", { order_id: req.body?.order_id, }, table_name);

      
      let first_selected_mid=false;
      let isOrderAlreadyRouted = await merchantOrderModel.selectDynamicONE('*',{order_id:order_id,mode:payment_mode},'order_life_cycle');
      
      
      let checkForHardSoftDeclinedStatus = await helpers.checkForHardOrSoftDeclined({ order_id: order_id, mode: payment_mode });
      
     // if (req.body.type == "check_routing") {
      var last_transaction = await helpers.lastTwoCardUsed({ order_id: order_id, mode: payment_mode })
      update_retry(last_transaction)
      //}

      if(isOrderAlreadyRouted?.id>0){
       // console.log("isOrderAlreadyRouted", isOrderAlreadyRouted);
        first_selected_mid = await findOutWhereToRoute(isOrderAlreadyRouted);
        change_card = await helpers.checkOrderWasRejected({ status_code: ['47'], order_id: order_id, mode: payment_mode });

        //console.log("first_selected_mid", first_selected_mid)
       // console.log("checkForHardSoftDeclinedStatus", checkForHardSoftDeclinedStatus);

        if(checkForHardSoftDeclinedStatus){
          change_card=true;
        }
      

        if(first_selected_mid){
          //console.log("yes111111");
        }else{
          
          //console.log("hskdksdhkhsdkfhskdfhksdhf");
        let  new_res = {
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

          return res
        .status(StatusCode.ok)
            .send(ServerResponse.errorMsgWithData("Transaction failed.", res_obj));
        }

      }else{
      const payment_method = !card_id?'card_payment':'stored_card';
      const condition = {
        payment_method,
        mode: payment_mode,
        sub_merchant_id: order_details.merchant_id,
        rule_status:1,
        deleted:0
      }

      const rule_result = await RoutingModel.getRule(condition, 'routing_rule');
      const routing_order = await RoutingModel.getOrderRoutingList('mid_id,retry,cascade',{
        payment_method,
        mode: payment_mode,
        sub_merchant_id: order_details.merchant_id,
      },'routing_order')

      const match_rule = [];
      let rule_evaulation = [];
      for (const rules of rule_result) {
        let rule_json=[]
       try {
          rule_json = JSON.parse(rules.rule);
       } catch (error) {
        console.log(error);
       }

        let mid_list = rules.rule_string.split('then');
       
        let rule_eval_obj = {
          rule_id:rules.id,
          rule_name:rules.rule_name,
          no_of_attributes:rule_json.length,
          no_of_rule_pass:0,
          no_of_rule_fail:0,
          mid_list:mid_list[1].trim().replace(/[[\]]/g,'')
        }
        //find operator 
        let string_rule = mid_list[0].toLowerCase();
        let array_of_attributes = string_rule.split('and');
        let operator = [];
        for(let df of array_of_attributes){
           let isSplit = false;
           let opne = df.split('!=')
           if(opne.length>1 && !isSplit){
            operator.push('!=')
            isSplit=true;
           } 
           let oplte = df.split('<=')
           if(oplte.length>1 && !isSplit){
            operator.push('<=');
            isSplit=true;
           }
           let opgte = df.split('>=')
           if(opgte.length>1 && !isSplit){
            operator.push('>=');
            isSplit=true;

           }
           let oplt = df.split('<')
           if(oplt.length>1 && !isSplit){
            operator.push('<')
            isSplit=true;
           }
           let opgt = df.split('>')
           if(opgt.length>1 && !isSplit){
            operator.push('>')
            isSplit=true;
           } 
           let ope = df.split("=");
           if(ope.length>1 && !isSplit){
            operator.push('=')
            isSplit=true;
           } 
           
          }

          let rule_json_with_operator = [];
          let i=0;
          for(let rl of rule_json){
            rl.operator = operator[i];
            rule_json_with_operator.push(rl);
            i++;
          }

          for (const rule of rule_json_with_operator) {
            
            let { key, value } = rule;

           // console.log("value",value);
            
            if (key.trim() === 'amount') {
              switch(rule.operator) {
                case '<=':
                 if(order_details.amount<=value){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                 
                 }else{
                  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  
                 } 
                break;
                case '>=':
                  if(order_details.amount>=value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                   }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                   } 
                break;
                case '<':
                  if(order_details.amount<value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                   }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                   } 
                break;
                case '>':
                  if(order_details.amount>value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                   }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                   } 
                break;
                case '=':
                  if(order_details.amount==value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                   }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                   }   
                break;
                case "!=": 
                if(order_details.amount!=value){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                 }else{
                  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                 }   
              break;       
              }
              
            }
            if(key.trim()=='merchant_country'){
             let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country',{merchant_id:order_details.merchant_id},'master_merchant_details');
              let country_details = await merchantOrderModel.selectDynamicONE('country_code',{id:merchant_details.register_business_country},'country');
             /*  if(value==country_details.country_code){
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
               rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              }  */
              if(rule.operator=='='){
                let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country',{merchant_id:order_details.merchant_id},'master_merchant_details');
                let country_details = await merchantOrderModel.selectDynamicONE('country_code',{id:merchant_details.register_business_country},'country');
                if (value.toUpperCase() == country_details.country_code.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                 rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              }else{
                let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country',{merchant_id:order_details.merchant_id},'master_merchant_details');
                let country_details = await merchantOrderModel.selectDynamicONE('country_code',{id:merchant_details.register_business_country},'country');
                if (value.toUpperCase() != country_details.country_code.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                 rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              } 
             
            }
            if(key.trim()=='card_country'){
            //   if(req.card_details.country_code3==value){
            //     rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
            // }else{
            //  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
            // } 
              if(rule.operator=='='){
                if (req.card_details.country_code3.toUpperCase() == value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
               rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              } 
              }else{
                if (req.card_details.country_code3.toUpperCase() != value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
               rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              } 
              } 
             
            }
              if(key.trim()=='card_type'){
               
              if(rule.operator=='='){
                if (req.card_details.card_type.toUpperCase() == value.toUpperCase()){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                  }else{
                  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  } 
                }else{
                if (req.card_details.card_type.toUpperCase() != value.toUpperCase()){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                  }else{
                  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  } 
                } 
                
            }
            if(key.trim()=='card_scheme'){
              
              if(rule.operator=='='){
                if (req.card_details.card_brand.toUpperCase() == value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              }else{
                if (req.card_details.card_brand.toUpperCase() != value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              }
                
            }
            
            if(key.trim()=='currency'){
              if(rule.operator=='='){
                  if(order_details.currency==value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
            }else{
                if (order_details.currency != value.toUpperCase()){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                  }else{
                  rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  } 
                } 
            }
  
            if(key.trim()=='transaction_type'){

              let type = '';
              let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country',{merchant_id:order_details.merchant_id},'master_merchant_details');
              let country_details = await merchantOrderModel.selectDynamicONE('country_code',{id:merchant_details.register_business_country},'country');
            //  if("ARE"==req.card_details.country_code3){
             if(country_details.country_code==req.card_details.country_code3){
                type='DOMESTIC';
              }else{
                type='INTERNATIONAL';
              }

             // console.log("transaction_type",type)

             if(rule.operator=='='){
               if (type.toUpperCase() == value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                    }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  } 
              }else{
               if (type.toUpperCase() != value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                    }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              }
            }
            if(key.trim()=='mode'){
              if(rule.operator=='='){
                if (order_details.action.toUpperCase() == value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              }else{
                if (order_details.action.toUpperCase() != value.toUpperCase()){
                  rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                } 
              } 
            }
            if(key.trim()=='channel'){
            
             if(rule.operator=='='){
               if (order_details.origin.toUpperCase() == value.toUpperCase()){
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              }
             }else{
               if (order_details.origin.toUpperCase() != value.toUpperCase()){
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              }
             } 
            }
            if(key.trim()=='bin'){
              let card_bin = card?.substring(0, 6);
              if (req.body.card_id !== '') { 
                card_bin = card_number.substring(0, 6)
              }
            if(rule.operator=='='){
             // console.log("value",value);
             /// console.log("card.substring(0, 6)", card_bin);
              if (card_bin ==value){
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              }
             }else{
              if (card_bin !=value){
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }else{
                rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
              }
             } 
            }
            if(key.trim()=='3ds_version'){
              let card_proxy = await getCardProxyByCardIdOrCardNo(enc_dec.cjs_decrypt(card_id), card);


             // console.log("card_proxy", card_proxy);

              let versionDetails = await helpers.fetch3dsVersion({card_proxy:card_proxy});
              
              if(versionDetails.result){
                if(rule.operator=='='){
                  if(versionDetails.version==value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                   
                  }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                    
                  }
                }else{
                  if(versionDetails.version!=value){
                    rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
                  }else{
                    rule_eval_obj.no_of_rule_fail =  rule_eval_obj.no_of_rule_fail+1;
                  }
                }

              }else{
                rule_eval_obj.no_of_rule_pass =  rule_eval_obj.no_of_rule_pass+1;
              }
            

            }
            

         
          }
          
          rule_evaulation.push(rule_eval_obj);
         
      }
    first_selected_mid = await decideRuleRouting(rule_evaulation,routing_order,order_details.order_id,payment_mode,req.card_details,order_details);

        //console.log("first_selected_mid2", first_selected_mid);
    
      }

      
      if(first_selected_mid){
        //console.log('yes2');
        const _terminal_details = await merchantOrderModel.selectDynamicONE('*',{id:first_selected_mid},'mid');
        const getpsp = await PspModel.selectOne("*", {
          id: _terminal_details.psp_id,
        });
        let redirect_url = {
          success:'',
          failure:'',
          cancel:''
        }
        let order_urls = {
          success:order_details.success_url,
          failure:order_details.failure_url,
          cancel:order_details.cancel_url
        }
        const psp_name = getpsp.credentials_key.toLowerCase();
        const psp_credentials = credientials[psp_name];
        const base_url = payment_mode=='test'?psp_credentials.test_url:psp_credentials?.base_url;
        if(order_urls.success!='' && order_urls.success!=null && order_urls.success!='undefined'){
          redirect_url.success=order_urls.success
        }else if(_terminal_details?.success_url!='' &&  _terminal_details?.success_url!=null && _terminal_details?.success_url!='undefined'){
          redirect_url.success=_terminal_details?.success_url
        }else{
          redirect_url.success=process.env.DEFAULT_SUCCESS_URL
        }
        if(order_urls.failure!='' && order_urls.failure!=null && order_urls.failure!='undefined'){
          redirect_url.failure=order_urls.failure
        }else if(_terminal_details?.failure_url!='' &&  _terminal_details?.failure_url!=null && _terminal_details?.failure_url!='undefined'){
          redirect_url.failure=_terminal_details?.failure_url
        }else{
          redirect_url.failure=process.env.DEFAULT_FAILED_URL
        }
        if(order_urls.cancel!='' && order_urls.cancel!=null && order_urls.cancel!='undefined'){
          redirect_url.cancel=order_urls.cancel
        }else if(_terminal_details?.cancel_url!='' &&  _terminal_details?.cancel_url!=null && _terminal_details?.cancel_url!='undefined'){
          redirect_url.cancel=_terminal_details?.cancel_url
        }else{
          redirect_url.cancel=process.env.DEFAULT_CANCEL_URL
        }

           // description:
          //   order_details.remark == ""
          //     ? psp_name.toUpperCase()
          //     : order_details.description,

        console.log("order_details?.origin", order_details?.origin)
        console.log("order_details?.action", order_details?.action)
        console.log("_terminal_details?.mode", _terminal_details?.mode)

     
       if (req.body.type == 'routing') {
        let updateorder = {
          remark:
            order_details.remark == ""
              ? psp_name.toUpperCase()
              : order_details.remark,
          action: order_details?.origin=="REMOTE"?order_details?.action:_terminal_details?.mode,
          terminal_id: _terminal_details?.terminal_id,
          psp_id: _terminal_details?.psp_id,
          payment_mode: req.card_details.card_type + " CARD",
          is_one_click: saved_card ? 1 : 0,
          
          issuer:req.card_details.issuer,
          card_bin:req.card_details.bin_number,
          issuer_website:req.card_details.issuer_website,
          issuer_phone_number:req.card_details.issuer_phone,
          cardCategory:req.card_details.card_category,
          cardholderName:req?.card_details?.card_holder_name,
          success_url:redirect_url.success,
          cancel_url:redirect_url.cancel,
          failure_url:redirect_url.failure
        };

         await merchantOrderModel.updateDynamic(
           updateorder,
           { order_id: order_details.order_id },
           table_name
         );

        }

  
        // request id table entry
        let p_request_id = await helpers.make_sequential_no(payment_mode=='test'?"TST_REQ":"REQ");
        
        let order_req = {
          merchant_id: order_details.merchant_id,
          order_id: req.body.order_id,
          request_id: p_request_id,
          request: JSON.stringify(req.body),
        };
        await helpers.common_add(order_req, payment_mode=='test'?"test_generate_request_id":"generate_request_id");
  
        // if(req?.body?.type=="routing"){
        //   req.body.mid = _terminal_details?.MID
        //   const fraudData = await fraudEngine(req, res, next, true);
          

        //   if (fraudData) {
        //     return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("Transaction Failed.", fraudData));
        //   }
        // }
        
        let retry_txn =true;
        if (req.body.type =="routing"){

          /// check if card is blocked
           retry_txn = await this.checkCardIfBlocked(req);

          let last_transaction_r = await helpers.lastTwoCardUsed({ order_id: order_id, mode: payment_mode })
          let isOrderRetry = await merchantOrderModel.selectDynamicONE('*', { order_id: order_id, mode: payment_mode }, 'order_life_cycle');

          //console.log("order_details", order_details)

          if (isOrderRetry.retry==0 && !retry_txn){
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
      
        //console.log("req",req);
        //console.log("retry_txn", retry_txn);

      if (retry_txn){
          return res.status(StatusCode.ok).send(
            ServerResponse.successdatamsg(
              {
                psp_name: psp_name.toLowerCase(),
                merchant_url: base_url,
                terminal_no: _terminal_details?.terminal_id,
                change_card: change_card
              },
              "payment psp found successfully"
            )
          );
      }else{
          let res_obj = {
            retry: 1,
          };
          return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("transaction failed ", res_obj));
      }
        
  
       }else{
        // console.log("next");
        next()
        
       } 


      
    } catch (error) {
      console.log(error);
      winston.error(error);
      return res
        .status(StatusCode.internalError)
        .send(ServerResponse.errormsg(error?.message));
    }
  };

  nextrouting = async(req,res,next) =>{
    const  {order_id , payment_mode,data } = req.body
    let table_name = "orders";
        if (payment_mode === "test") { table_name = "test_orders" }
    let checkForHardSoftDeclinedStatus = await helpers.checkForHardOrSoftDeclined({order_id:order_id,mode:payment_mode});
    let change_card = false;
        if(checkForHardSoftDeclinedStatus){
          change_card=true;
        }


        let res_obj = {
          data:data?.data,
          change_card:change_card
        };
          return res.status(StatusCode.ok).send( ServerResponse.errorMsgWithData("transaction failed ",res_obj)
        );
  }

  checkCardIfBlocked = async (req) => {
    const { order_id, payment_mode, data,card_id,card } = req.body
    let table_name = "orders";
    if (payment_mode === "test") { table_name = "test_orders" }
    let updated_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let card_proxy = await getCardProxyByCardIdOrCardNo(enc_dec.cjs_decrypt(card_id),card);

    let lastCardUsed = await helpers.lastCardUsed({ mode: payment_mode,card_proxy:card_proxy });

    let checkForHardSoftDeclinedStatus = await helpers.checkForHardOrSoftDeclined({ mode: payment_mode,card_proxy:card_proxy });

    if (checkForHardSoftDeclinedStatus){
      const res_order_data = await merchantOrderModel.selectOne("*", { order_id: req.body?.order_id, }, table_name);

      let response_category = await helpers.get_error_category(
        lastCardUsed.status_code,
        lastCardUsed.psp
      );

      let payment_id = await helpers.make_sequential_no(
        payment_mode == "test" ? "TST_TXN" : "TXN"
      );
      let order_txn = {
        status: "FAILED",
        txn: payment_id,
        psp_code: lastCardUsed.status_code,
        paydart_category: response_category.category,
        remark: response_category.response_details,
        // type: res_order_data?.action.toUpperCase()=='SALE'?'CAPTURE':res_order_data?.action.toUpperCase(),
        type: '',
        payment_id: "",
        order_id: res_order_data.order_id,
        amount: res_order_data.amount,
        currency: res_order_data.currency,
        created_at: updated_at,
        order_reference_id: "",
        capture_no: "",
        res_dump : card_proxy
      };
      if (payment_mode == "test") {
        const txn_result = await orderTransactionModel.test_txn_add(
          order_txn
        );
      } else {
        const txn_result = await orderTransactionModel.add(order_txn);
      }

      const order_update_failed = {
        status: "FAILED",
        payment_id: payment_id,
      };
      await merchantOrderModel.updateDynamic(
        order_update_failed,
        {
          order_id: req.bodyString("order_id"),
        },
        table_name
      );

      let txnFailedLog = {
        order_id: res_order_data.order_id,
        terminal: lastCardUsed?.terminal,
        psp: lastCardUsed?.psp,
        req: JSON.stringify(req.body),
        res: JSON.stringify({}),
        status_code: response_category?.response_code,
        description: response_category?.response_details,
        activity: "Transaction failed",
        status: 1,
        paydart: 1,
        mode: payment_mode,
        card_holder_name: lastCardUsed?.card_holder_name,
        card: lastCardUsed?.card,
        expiry: lastCardUsed?.expiry,
        cipher_id: lastCardUsed?.cipher_id,
        card_proxy: lastCardUsed?.card_proxy,
        "3ds_version": lastCardUsed?.['3ds_version'],
        txn: payment_id,
        retry_txn: 1,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      }
      //console.log(txnFailedLog);
      await helpers.addTransactionFailedLogs(txnFailedLog);
      return false;
     // return res.status(StatusCode.ok).send(ServerResponse.errorMsgWithData("transaction failed ", res_obj));
    }else{
     return true
    }
    
  }


}


async function decideRuleRouting(rule_evaulation,routing_order,order_id,payment_mode,card_details,order_details){
  
  
  switch(rule_evaulation.length){
    case 0:
      if(routing_order.length>0){
          let firstSelectedMid = await  routingOrderBasedMidList(routing_order,order_id,payment_mode,card_details,order_details);
          return firstSelectedMid;
      }else{
       return false;
      }
    break;
    case 1:
      if(rule_evaulation[0].no_of_rule_fail==0){
        let firstSelectedMid = await midListFromRule(rule_evaulation[0],routing_order,order_id,payment_mode,card_details,order_details);
        return firstSelectedMid;
      }else{
        if(routing_order.length>0){
          let firstSelectedMid = await  routingOrderBasedMidList(routing_order,order_id,payment_mode,card_details,order_details);
          return firstSelectedMid;
      }else{
       return false;
      }
      }
    break;
    default:
      let firstSelectedMid = await minFailedRuleMid(rule_evaulation,routing_order,order_id,payment_mode,card_details,order_details);
      if(firstSelectedMid){
        return firstSelectedMid;
      }else{
        if(routing_order.length>0){
          let firstSelectedMid = await  routingOrderBasedMidList(routing_order,order_id,payment_mode,card_details,order_details);
          return firstSelectedMid;
      }else{
       return false;
      }
      }
      
    break;    
  }
}
async function routingOrderBasedMidList(routing_order,order_id,mode,card_details,order_details){
  let mid_list_arr =[];
  for(let ro of routing_order){
    let checkMidIsValidForTxn  = await checkMidIsValid(ro.mid_id,card_details,order_details);
    if(checkMidIsValidForTxn){
      mid_list_arr.push(ro.mid_id);
    }  
  }
  mid_list_arr.length = routing_order[0].cascade+1 // remove mids for cascade length


  let order_life_cycle_data = {
    order_id:order_id,
    mid_list:mid_list_arr.join(','),
    retry:routing_order[0].retry,
    cascade:routing_order[0].cascade,
    mode:mode
  }

  console.log(routing_order[0].cascade, mid_list_arr);

 let add_res = await RoutingModel.add(order_life_cycle_data,'order_life_cycle');
 return mid_list_arr[0]; 
}
async function midListFromRule(rule_evaulation,routing_order,order_id,mode,card_details,order_details){

  console.log("rule_evaulation.mid_list", rule_evaulation.mid_list);

  let mid_list_arr = rule_evaulation.mid_list.split(/\s+/);

  
  let mid_list= [];
  for(let mid of mid_list_arr){

    let obj_mid ={}
    try {
       obj_mid = JSON.parse(mid);
    } catch (error) {
      console.log(mid)
      console.log(error)
    }

    let mid_id = enc_dec.cjs_decrypt(obj_mid?.key);

    if(mid_id){
    let checkMidIsValidForTxn  = await checkMidIsValid(mid_id,card_details,order_details);
    if(checkMidIsValidForTxn){
      mid_list.push(mid_id);
    }  
  }
  }
  mid_list.length = routing_order[0].cascade + 1 // remove mids for cascade length
  let order_life_cycle_data = {
    order_id:order_id,
    mid_list:mid_list.join(','),
    retry:routing_order[0]?.retry || 0,
    cascade:routing_order[0]?.cascade || 0,
    mode:mode,
    rule_id: mid_list[0]>0?rule_evaulation.rule_id:0
  }
 let add_res = await RoutingModel.add(order_life_cycle_data,'order_life_cycle');
 return mid_list[0];
}
async function minFailedRuleMid(rule_evaulation,routing_order,order_id,mode,card_details,order_details){
  let non_failed_rules = [];
  for(let rule_eval of rule_evaulation){
    if(rule_eval.no_of_rule_fail==0){
      non_failed_rules.push(rule_eval);
    }
  }
  if(non_failed_rules.length==0){
    return false;
  }else{
    let max_attr_rule = non_failed_rules.reduce((acc, curr) => curr.no_of_attributes > acc.no_of_attributes ? curr : acc, non_failed_rules[0]);
    let mid_list_arr = max_attr_rule.mid_list.split(' ');

    let mid_list= [];
    for(let mid of mid_list_arr){
  
      // mid = mid.replace(/[^\w ]/, '');

      let obj_mid ={}
      try {
       obj_mid = JSON.parse(mid); 
      } catch (error) {
        console.log(error)
      }

      let mid_id = enc_dec.cjs_decrypt(obj_mid.key);
      let checkMidIsValidForTxn  = await checkMidIsValid(mid_id,card_details,order_details);
      if(checkMidIsValidForTxn){
        mid_list.push(mid_id);
      }  
    }
    mid_list.length = routing_order[0].cascade + 1 // remove mids for cascade length
    let order_life_cycle_data = {
      order_id:order_id,
      mid_list:mid_list.join(','),
      retry:routing_order[0].retry,
      cascade:routing_order[0].cascade,
      mode:mode,
      rule_id: mid_list[0]>0?max_attr_rule.rule_id:0
    }
   let add_res = await RoutingModel.add(order_life_cycle_data,'order_life_cycle');
   return mid_list[0];
  }

}
async function findOutWhereToRoute(orderLifeCycle){
  let transactionLifeCycle = await merchantOrderModel.selectAllDynamic('id,status',{order_id:orderLifeCycle.order_id,status:1},'order_life_cycle_logs');

 let retry_no = orderLifeCycle.retry;
 let cascade_no = orderLifeCycle.cascade;
 let mid_list = orderLifeCycle.mid_list.split(',');
 let original_mid_list = orderLifeCycle?.original_mid_list?.split(',');


  console.log(transactionLifeCycle.length)
console.log(retry_no, cascade_no, mid_list)

 switch(transactionLifeCycle.length){
  case 0:
     console.log("retry0")
    return mid_list[0];
  break;
  case 1:
    console.log("retry1")
    if(retry_no>0 && cascade_no>0){
      //update_retry(last_transaction)
      if(retry_no-transactionLifeCycle.length>=0){
        return mid_list[0];
      }else{
        if(mid_list.length>1){
          return mid_list[1];
        }else{
          return false;
        }
        
      }
    } else if (retry_no > 0){
      return mid_list[0];
    }
    break;
  default:
     console.log("retry2")
    let last_transaction = await helpers.lastTwoCardUsed({ order_id: orderLifeCycle.order_id, mode: orderLifeCycle.mode })
    update_retry(last_transaction)
    
    if(retry_no>transactionLifeCycle.length){
      console.log("retry2.1")
      return mid_list[0];
    }else{

      console.log("retry2.2")

      if((retry_no+1+cascade_no*retry_no)-transactionLifeCycle.length>0){
        let mid_calling_sequence = [];
        for(i=0;i<mid_list.length;i++){

          let r = retry_no;
          let c = cascade_no;
         
          if(i==0){
            mid_calling_sequence.push(mid_list[i]);
            while(r){
              mid_calling_sequence.push(mid_list[i]);
              r--;
            }
          }else{  
            mid_calling_sequence.push(mid_list[i]);
            // while(c){
            //   mid_calling_sequence.push(mid_list[i]);
            //   c--;
            // }
          }
          

        }
      //  console.log("original_mid_list", original_mid_list);
        if (original_mid_list != undefined && original_mid_list != ""){
          return original_mid_list[transactionLifeCycle.length];
        }else{
          return mid_calling_sequence[transactionLifeCycle.length];
        }
       
        let no_of_cascade_happened = transactionLifeCycle.length-(retry_no+1);
        if(no_of_cascade_happened>0){
          return mid_list[transactionLifeCycle.length-(retry_no*cascade_no-1)];
        }else{
          return mid_list[transactionLifeCycle.length-retry_no];
        }

      }else{
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

async function update_retry(last_transaction){
  //console.log("yes");
  if (last_transaction.length==2){
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

async function checkMidIsValid(mid,card_details,order_details){
  let mid_details = await merchantOrderModel.selectDynamicONE('payment_methods,payment_schemes,domestic,international,minTxnAmount,maxTxnAmount,currency_id as currency',{id:mid,deleted:0},'mid');
  let currency_details = await merchantOrderModel.selectDynamicONE('code',{id:mid_details?.currency},'master_currency');
  if(!mid_details?.payment_methods.toUpperCase().includes(card_details.card_type)){
    return false;
  }
  if(!mid_details.payment_schemes.toUpperCase().includes(card_details.card_brand)){
   
    return false;
  }
  if(order_details.amount>mid_details.maxTxnAmount || order_details.amount<mid_details.minTxnAmount){
    return false;
  }
  if(currency_details.code!=order_details.currency){
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
  if (is_domestic_or_international == "International" && mid_details.international == 0){
    return false; 
  }
  return true;
}


async function getCardProxyByCardIdOrCardNo(card_id,card_no){


  //console.log(card_id);

    if(card_id==''){
      let card_proxy = enc_dec.encrypt_card(card_no);
      return card_proxy;
    }else{
     let card_details = await merchantOrderModel.selectOne(
        "*",
        {
          id: card_id,
        },
        "customers_cards"
      );

      let full_card_no = await enc_dec.dynamic_decryption(
        card_details.card_number,
        card_details.cipher_id
      );
      let card_proxy = enc_dec.encrypt_card(full_card_no);
      return card_proxy;
    }
}
async function getCardBIN(card_id) {
  //console.log((card_id));
    let card_details = await merchantOrderModel.selectOne(
      "*",
      {
        id: enc_dec.cjs_decrypt(card_id),
      },
      "customers_cards"
    );
    let full_card_no = await enc_dec.dynamic_decryption(
      card_details.card_number,
      card_details.cipher_id
    );
  return full_card_no;
  
}
const TerminalController = new TerminalControllerClass();
module.exports = TerminalController;
