const path = require("path");
const dotenv = require("dotenv");
const momentDatePicker = require('../date_formatter');
const helper = require('../helper/general_helper');

//config file
dotenv.config({ path: "../.env" });

//model table
const SubmerchantModel = require('../../models/submerchantmodel');
const MerchantRegistrationModel = require("../../models/merchant_registration");

// Batch version for processing multiple merchants
module.exports.processMerchantsBatch = async (merchantsData) => {
  let merchantPaymentMethod = [];
  let merchantPaymentMethodDraft = [];
  for(let method of merchantsData){
    let {submerchant_id,psp,req_payment_method,payment_scheme,mode,domestic,international,update=false}=method;
    let payment_method = req_payment_method.split(',');
        for (let pay_method of payment_method) {
            let isMechantPaymentMethodAdded = false;
            let isMerchantDraftPaymentMethodAdded = false;

            switch (pay_method.trim()) {
                case 'mobile_wallet':
                    merchantPaymentMethod.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});
                    merchantPaymentMethodDraft.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});
                    break;
                case 'Apple Pay':
                    merchantPaymentMethod.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});
                    merchantPaymentMethodDraft.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});
                    break;
                case 'Samsung Pay':
                    merchantPaymentMethod.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});
                    merchantPaymentMethodDraft.push({sub_merchant_id:submerchant_id,mode:mode,method:pay_method,others:''});

                    break;
                case 'Debit Card':
                case 'Credit Card':
                    // card scheme
                    let others = payment_scheme;
                    if (!update) {
                        if (international) others += ',INTERNATIONAL CARD';
                        if (domestic) others += ',DOMESTIC CARD';
                    }
                    //for card
                    merchantPaymentMethod.push({sub_merchant_id:submerchant_id,mode:mode,method:'card_payment',others:others});
                    merchantPaymentMethodDraft.push({sub_merchant_id:submerchant_id,mode:mode,method:'card_payment',others:others});
                    // for stored card
                    merchantPaymentMethod.push({sub_merchant_id:submerchant_id,mode:mode,method:'stored_card',others:others});
                    merchantPaymentMethodDraft.push({sub_merchant_id:submerchant_id,mode:mode,method:'stored_card',others:others});
                    break;
            }
        }

  }
  merchantPaymentMethod = removeDuplicates(merchantPaymentMethod);
  merchantPaymentMethodDraft = removeDuplicates(merchantPaymentMethodDraft);
  await SubmerchantModel.addMerchantPaymentMethodsBulk(merchantPaymentMethod);
  await SubmerchantModel.addMerchantPaymentMethodsBulkDraft(merchantPaymentMethodDraft);
//   await 
   
};

// Method 1: Using Map with composite key - FASTEST
function removeDuplicates(merchantPaymentMethod) {
  const uniqueMap = new Map();
  
  merchantPaymentMethod.forEach(item => {
    const key = `${item.sub_merchant_id}_${item.mode}_${item.method}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });
  
  return Array.from(uniqueMap.values());
}
