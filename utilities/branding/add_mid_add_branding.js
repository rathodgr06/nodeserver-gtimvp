const path = require("path");
const dotenv = require("dotenv");
//const momentDatePicker = require('../../date_formatter');
const momentDatePicker = require('../date_formatter');
const helper = require('../helper/general_helper');
//config file
dotenv.config({ path: "../.env" });
const logger = require('../../config/logger');

//model table
const SubmerchantModel = require('../../models/submerchantmodel');
const MerchantRegistrationModel = require("../../models/merchant_registration");

module.exports = async (submerchant_id, psp, req_payment_method, req, update = false) => {
    try {
        let mode = req.body.env == "test" ? "test" : "live";
        let payment_method = req_payment_method.split(',');
        for (let pay_method of payment_method) {
            let isMechantPaymentMethodAdded = false;
            let isMerchantDraftPaymentMethodAdded = false;

            switch (pay_method.trim()) {
                case 'mobile_wallet':
                    isMechantPaymentMethodAdded = await checkPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMechantPaymentMethodAdded) {
                        await add_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }
                    isMerchantDraftPaymentMethodAdded = await checkDraftPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMerchantDraftPaymentMethodAdded) {
                        await add_draft_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }

                    break;
                case 'Apple Pay':
                    isMechantPaymentMethodAdded = await checkPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMechantPaymentMethodAdded) {
                        await add_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }
                    isMerchantDraftPaymentMethodAdded = await checkDraftPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMerchantDraftPaymentMethodAdded) {
                        await add_draft_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }

                    break;
                case 'Samsung Pay':
                    isMechantPaymentMethodAdded = await checkPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMechantPaymentMethodAdded) {
                        await add_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }
                    isMerchantDraftPaymentMethodAdded = await checkDraftPaymentMethodAlreadyAdded(mode, submerchant_id, pay_method);
                    if (!isMerchantDraftPaymentMethodAdded) {
                        await add_draft_payment_method(mode, submerchant_id, pay_method, 'NULL');
                    }

                    break;
                case 'Debit Card':
                case 'Credit Card':
                    // card scheme
                    let payment_scheme = req.bodyString('payment_schemes');
                    if (!update) {
                        if (req.body.international) payment_scheme += ',INTERNATIONAL CARD';
                        if (req.body.domestic) payment_scheme += ',DOMESTIC CARD';
                    }
                    // add for card payment
                    isMechantPaymentMethodAdded = await checkPaymentMethodAlreadyAdded(mode, submerchant_id, 'card_payment');
                    if (!isMechantPaymentMethodAdded) {
                        await add_payment_method(mode, submerchant_id, 'card_payment', payment_scheme);
                    }
                    isMerchantDraftPaymentMethodAdded = await checkDraftPaymentMethodAlreadyAdded(mode, submerchant_id, 'card_payment');
                    if (!isMerchantDraftPaymentMethodAdded) {
                        await add_draft_payment_method(mode, submerchant_id, 'card_payment', payment_scheme);
                    }
                    // add for stored card payment
                    isMechantPaymentMethodAdded = await checkPaymentMethodAlreadyAdded(mode, submerchant_id, 'stored_card');
                    if (!isMechantPaymentMethodAdded) {
                        await add_payment_method(mode, submerchant_id, 'stored_card', payment_scheme);
                    }
                    isMerchantDraftPaymentMethodAdded = await checkDraftPaymentMethodAlreadyAdded(mode, submerchant_id, 'stored_card');
                    if (!isMerchantDraftPaymentMethodAdded) {
                        await add_draft_payment_method(mode, submerchant_id, 'stored_card', payment_scheme);
                    }
                    break;
            }
        }
        let isDraftAdded = await SubmerchantModel.checkMerchantDraft(submerchant_id);
        if (!isDraftAdded) {
            await MerchantRegistrationModel.addDefaultDraft(submerchant_id);
        }


    } catch (error) {
        console.log(error);
        console.log('something went wrong', error);
        logger.error(500,{message: error,stack: error?.stack});
    }

    return true;
};

async function checkPaymentMethodAlreadyAdded(mode, sub_merchant_id, payment_method) {
    let checkMerchantPaymentMethod = await SubmerchantModel.checkMerchantPaymentMethod(sub_merchant_id, payment_method, mode);
    return checkMerchantPaymentMethod;
}
async function checkDraftPaymentMethodAlreadyAdded(mode, sub_merchant_id, payment_method) {
    let checkDraftMerchantPaymentMethod = await SubmerchantModel.checkMerchantDraftPaymentMethod(sub_merchant_id, payment_method, mode);
    return checkDraftMerchantPaymentMethod;
}
async function add_payment_method(mode, sub_merchant_id, payment_method, others) {
    let insertPaymentMethod = await SubmerchantModel.addMerchantPaymentMethod(sub_merchant_id, payment_method, mode, others);
    return insertPaymentMethod;
}

async function add_draft_payment_method(mode, sub_merchant_id, payment_method, others) {
    let insertDraftPaymentMethod = await SubmerchantModel.addMerchantDraftPaymentMethod(sub_merchant_id, payment_method, mode, others);
    return insertDraftPaymentMethod;
}