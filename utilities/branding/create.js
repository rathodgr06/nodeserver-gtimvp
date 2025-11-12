const path = require("path");
const dotenv = require("dotenv");
//const momentDatePicker = require('../../date_formatter');
const momentDatePicker = require('../date_formatter');
const helper = require('../helper/general_helper');
const winston = require('../logmanager/winston');
//config file
dotenv.config({ path: "../.env" });

//model table
const SubmerchantModel = require('../../models/submerchantmodel');
const { live } = require("../../controller/recurringController");
const bank_transfer_psp = 4;

module.exports = async (submerchant_id, psp, req_payment_method, req) => {
    try {
        const draftTablePayment = 'merchant_draft_payment_methods';
        const publishTablePayment = 'merchant_payment_methods';

        const testMode = 'test';
        const liveMode = 'live';
        const mode = req.body.env === testMode ? testMode : liveMode;

        // mobile wallet related changes
        if (req_payment_method.includes('mobile_wallet')) {
            let payment_scheme = req.bodyString('payment_schemes');
            const published_payment_method = await SubmerchantModel.selectOne("*", { id: submerchant_id });

            const mid_payment_methods = await SubmerchantModel.get_mid_unique_card_payment_method(submerchant_id, mode);
            const new_payment_split = payment_scheme.split(',');

            new_payment_split.forEach(val => {
                if (!mid_payment_methods.includes(val)) {
                    mid_payment_methods.push(val);
                }
            });

            const str = mid_payment_methods.join(',');
            // add mobile wallet as payment method for submerchant
            await createOrUpdatePaymentMethod(submerchant_id, 'mobile_wallet', req, str);
            //Draft changes related to mobile wallet
            const draft_result = await SubmerchantModel.checkDraftPaymentMethod(submerchant_id);
            const draftPaymentData = {
                submerchant_id: submerchant_id,
                language: 1,
                brand_color: '#FFFFFF',
                accent_color: '#4c64e6',
                font_name: 'Proxima Nova Regular',
            };
            // create/update draft table
            if (draft_result && draft_result.length === 0) {
                await SubmerchantModel.create(draftPaymentData, 'master_merchant_draft');
            } else {
                await SubmerchantModel.update({ submerchant_id: submerchant_id }, draftPaymentData, 'master_merchant_draft');
            }
        }
        // Payment Card related code
        if ((req_payment_method.includes('Debit Card') || req_payment_method.includes('Credit Card'))) {

            const published_payment_method = await SubmerchantModel.selectOne("*", { id: submerchant_id });

            const mid_payment_methods = await SubmerchantModel.get_mid_unique_card_payment_method(submerchant_id, mode);

            let payment_scheme = req.bodyString('payment_schemes');
            if (req.body.international) payment_scheme += ',INTERNATIONAL CARD';
            if (req.body.domestic) payment_scheme += ',DOMESTIC CARD';
            if (published_payment_method) {
                if (published_payment_method.card_payment_scheme.includes('CORPORATE CARD')) {
                    payment_scheme += ",CORPORATE CARD"
                }
                if (published_payment_method.card_payment_scheme.includes('PREPAID CARD')) {
                    payment_scheme += ",PREPAID CARD"
                }
                if (published_payment_method.card_payment_scheme.includes('VIRTUAL CARD')) {
                    payment_scheme += ",VIRTUAL CARD"
                }
            }
            // console.log("payment_scheme", published_payment_method.card_payment_scheme);

            const new_payment_split = payment_scheme.split(',');

            new_payment_split.forEach(val => {
                if (!mid_payment_methods.includes(val)) {
                    mid_payment_methods.push(val);
                }
            });

            const str = mid_payment_methods.join(',');


            console.log('payment str', str);
            await createOrUpdatePaymentMethod(submerchant_id, 'card_payment', req, str);
            await createOrUpdatePaymentMethod(submerchant_id, 'stored_card', req, str);

            //update master merchant of publish data
            if (mode === testMode) {
                await SubmerchantModel.update({ id: submerchant_id }, {
                    test_card_payment_scheme: str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD",
                    test_stored_card_scheme: str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD",
                }, 'master_merchant');
            } else {
                await SubmerchantModel.update({ id: submerchant_id }, {
                    card_payment_scheme: str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD",
                    stored_card_scheme: str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD",
                }, 'master_merchant');
            }


            const draft_result = await SubmerchantModel.checkDraftPaymentMethod(submerchant_id);
            const draftPaymentData = {
                submerchant_id: submerchant_id,
                language: 1,
                brand_color: '#FFFFFF',
                accent_color: '#4c64e6',
                font_name: 'Proxima Nova Regular',
            };

            if (mode === testMode) {
                draftPaymentData.test_card_payment_scheme = str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD";
                draftPaymentData.test_stored_card_scheme = str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD";
            } else {
                draftPaymentData.card_payment = str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD";
                draftPaymentData.stored_card = str + ",CORPORATE CARD,PREPAID CARD,VIRTUAL CARD";
            }

            // create/update draft table
            if (draft_result && draft_result.length === 0) {
                await SubmerchantModel.create(draftPaymentData, 'master_merchant_draft');
            } else {
                await SubmerchantModel.update({ submerchant_id: submerchant_id }, draftPaymentData, 'master_merchant_draft');
            }
        }

        // Bank Transfer
        if (parseInt(psp) === bank_transfer_psp) {
            //console.log('Bank Transfer');
            await createOrUpdatePaymentMethod(submerchant_id, 'bank_transfer', req);
        }

        // Apple Pay
        if (req_payment_method.includes('Apple Pay')) {
            await createOrUpdatePaymentMethod(submerchant_id, 'apple_pay', req);
        }

        // Samsung Pay
        if (req_payment_method.includes('Samsung Pay')) {
            await createOrUpdatePaymentMethod(submerchant_id, 'samsung_pay', req);
        }
        if (req_payment_method.includes('mobile_wallet')) {
            await createOrUpdatePaymentMethod(submerchant_id, 'mobile_wallet', req);
        } 

    } catch (error) {
        winston.error(error);
        console.log('something went wrong', error);
    }

    return true;
};

async function createOrUpdatePaymentMethod(submerchant_id, method, req, others = null) {
    const draftTablePayment = 'merchant_draft_payment_methods';
    const publishTablePayment = 'merchant_payment_methods';

    const testMode = 'test';
    const liveMode = 'live';
    const mode = req.body.env === testMode ? testMode : liveMode;


    const paymentData = {
        methods: method,
        is_visible: 1,
        sub_merchant_id: submerchant_id,
        //sequence: sequence,
        others: others,
        mode: mode
    };

    const checkResult = await SubmerchantModel.checkPaymentMethod(submerchant_id, method, mode);

    //console.log("checkResult",checkResult);

    if (checkResult && checkResult.length === 0) {
        const sequence1 = await SubmerchantModel.getSequencePaymentMethod(
            `sub_merchant_id = ${submerchant_id} AND mode='${mode}'`,
            publishTablePayment);
        paymentData.sequence = sequence1;
        await SubmerchantModel.create(paymentData, publishTablePayment);

        delete paymentData.sub_merchant_id;
        paymentData.submerchant_id = submerchant_id;

        const sequence2 = await SubmerchantModel.getSequencePaymentMethod(
            `submerchant_id = ${submerchant_id} AND mode='${mode}'`,
            draftTablePayment);
        paymentData.sequence = sequence2;
        await SubmerchantModel.create(paymentData, draftTablePayment);
    } else {
        const condition = {
            sub_merchant_id: submerchant_id,
            methods: method,
            mode: mode
        };
        await SubmerchantModel.update(
            condition,
            paymentData,
            publishTablePayment);

        delete paymentData.sub_merchant_id;
        paymentData.submerchant_id = submerchant_id;

        //condition
        delete condition.sub_merchant_id;
        condition.submerchant_id = submerchant_id;

        await SubmerchantModel.update(
            condition,
            paymentData,
            draftTablePayment);
    }
}
