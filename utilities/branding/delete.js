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
const { live } = require("../../controller/recurringController");
const bank_transfer_psp = 4;

module.exports = async (id, submerchant_id) => {
    try {

        //console.log('here in js');
        //console.log('submerchant_id', submerchant_id, 'id', id, 'env', env);
        const delete_mid = await SubmerchantModel.getDeletedRecord(id, submerchant_id)
        console.log('delete_mid', delete_mid);
        const psp_details = await SubmerchantModel.psp_name({id:delete_mid.psp_id});
        const draftTablePayment = 'merchant_draft_payment_methods';
        const publishTablePayment = 'merchant_payment_methods';

        const testMode = 'test';
        const liveMode = 'live';
        const mode = delete_mid.env;



        async function createOrUpdatePaymentMethod(submerchant_id, method, others = null) {

            const paymentData = {
                methods: method,
                is_visible: 1,
                sub_merchant_id: submerchant_id,
                //sequence: sequence,
                others: others,
                mode: mode
            };

            if (others && others.length > 0) {
                const checkResult = await SubmerchantModel.checkPaymentMethod(submerchant_id, method, mode);

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
            } else {
                const condition = {
                    sub_merchant_id: submerchant_id,
                    methods: method,
                    mode: mode
                };
                await SubmerchantModel.delete_payment_method(publishTablePayment, condition);

                delete paymentData.sub_merchant_id;
                paymentData.submerchant_id = submerchant_id;

                //condition
                delete condition.sub_merchant_id;
                condition.submerchant_id = submerchant_id;
                await SubmerchantModel.delete_payment_method(draftTablePayment, condition);
            }
        }

        
         // mobile wallet related changes
        if (delete_mid.payment_methods.includes('mobile_wallet')) {
             await createOrUpdatePaymentMethod(submerchant_id, 'mobile_wallet', '');
        }

        // Payment Card related code
        if (delete_mid.payment_methods.includes('Debit Card') || delete_mid.payment_methods.includes('Credit Card')) {
            const mid_payment_methods = await SubmerchantModel.get_mid_unique_card_payment_method(submerchant_id, mode);

            // let payment_scheme = req.bodyString('payment_schemes');
            // if (req.body.international) payment_scheme += ',INTERNATIONAL CARD';
            // if (req.body.domestic) payment_scheme += ',DOMESTIC CARD';

            // const new_payment_split = payment_scheme.split(',');

            // new_payment_split.forEach(val => {
            //     if (!mid_payment_methods.includes(val)) {
            //         mid_payment_methods.push(val);
            //     }
            // });

            const str = mid_payment_methods.join(',');

            await createOrUpdatePaymentMethod(submerchant_id, 'card_payment', '');
            await createOrUpdatePaymentMethod(submerchant_id, 'stored_card', '');

            //update master merchant of publish data
            if (mode === testMode) {
                await SubmerchantModel.update({ id: submerchant_id }, {
                    test_card_payment_scheme: str,
                    test_stored_card_scheme: str,
                }, 'master_merchant');
            } else {
                await SubmerchantModel.update({ id: submerchant_id }, {
                    card_payment_scheme: str,
                    stored_card_scheme: str,
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
                draftPaymentData.test_card_payment_scheme = str;
                draftPaymentData.test_stored_card_scheme = str;
            } else {
                draftPaymentData.card_payment = str;
                draftPaymentData.stored_card = str;
            }

            // create/update draft table
            if (draft_result && draft_result.length === 0) {
                await SubmerchantModel.create(draftPaymentData, 'master_merchant_draft');
            } else {
                await SubmerchantModel.update({ submerchant_id: submerchant_id }, draftPaymentData, 'master_merchant_draft');
            }
        }

        // Bank Transfer
        if (psp_details.name=='DAPI') {
            console.log('Bank Transfer');
            console.log(`inside the bank transfer`)
            await createOrUpdatePaymentMethod(submerchant_id, 'bank_transfer');
        }

        // Apple Pay
        if (delete_mid.payment_methods.includes('Apple Pay')) {
            await createOrUpdatePaymentMethod(submerchant_id, 'apple_pay');
        }

        // Samsung Pay
        if (delete_mid.payment_methods.includes('Samsung Pay')) {
            await createOrUpdatePaymentMethod(submerchant_id, 'samsung_pay');
        }

    } catch (error) {
        console.log('something went wrong', error);
        logger.error(500,{message: error,stack: error?.stack});
    }

    return true;
};
