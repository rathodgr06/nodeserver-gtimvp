const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const helper = require('../helper/general_helper');
const moment = require('moment');

const referrerCalculationModel = require('../../models/referrer_bonus_calculation_model');


module.exports = async (order_details = null, referrer_details = null, referrer_currency = null,super_merchant_id=null) => {
    

    if (Object.keys(referrer_details).length === 0) {
        return true;
    }
    
    const { order_id, currency } = order_details;

    
    // Define an inner function to calculate the bonus amount
    async function calculateBonusAmount() {
        let amount = 0;
        let total_fix_amount = referrer_details.fix_amount;
        let total_per_amount = order_details.amount * (referrer_details.per_amount / 100);
        let fixe_amount = null;

        if (order_details.order_status === 'VOID') { 
            if (referrer_details.apply_greater === 1) {
                amount = total_fix_amount > total_per_amount ? total_fix_amount : total_per_amount;
            } else {
                //check first refund void and basis of that give fixed bonus
                
                if (order_details.void_status === 'CREDIT') {
                    let void_result = await referrerCalculationModel.getFirstVoidCreditedData(order_details.order_id, referrer_details.id);
                    if (void_result >= 1) {
                        amount = parseFloat(total_per_amount);
                    } else {
                        amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
                        fixe_amount = total_fix_amount;
                    }
                } else {
                    amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
                    fixe_amount = total_fix_amount;
                }
            }
        }

        if (order_details.order_status === 'REFUNDED') {
            if (referrer_details.apply_greater === 1) {
                amount = total_fix_amount > total_per_amount ? total_fix_amount : total_per_amount;
            } else {
                let partial_result = await referrerCalculationModel.getFirstPartiallyRefundedData(order_details.order_id, referrer_details.id);
                if (partial_result >= 1) {
                    amount = parseFloat(total_per_amount);
                } else {
                    amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
                    fixe_amount = total_fix_amount;
                }
            }
        }
        
        if (order_details.order_status === 'PARTIALLY_REFUNDED') {
            //check for the partially refund first time
                    
            if (referrer_details.apply_greater === 1) {
                amount = total_fix_amount > total_per_amount ? total_fix_amount : total_per_amount;
            } else {
                let partial_result = await referrerCalculationModel.getFirstPartiallyRefundedData(order_details.order_id, referrer_details.id);
                
                if (partial_result >= 1) {
                    amount = parseFloat(total_per_amount);
                } else {
                    amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
                    fixe_amount = total_fix_amount;
                }
            }
        }
        return { amount, fixe_amount, total_per_amount };
    }

    // Define an inner function to generate the message
    function generateMessage() {
        let message = '';

        if (order_details.order_status === 'VOID') {
            if (order_details.void_status === 'DEBIT') {
                message = `Main transaction is canceled. Order id is ${order_details.order_id}`;
            } else if (order_details.void_status === 'CREDIT') {
                message = `Refund transaction is canceled. Order id is ${order_details.order_id}`;
            }
        } else {
            if (order_details.txn_type === 'REFUND') {
                message = `Transaction ${order_details.order_id} is refunded`;
            } else if (order_details.txn_type === 'PARTIAL_REFUND') {
                message = `Transaction ${order_details.order_id} is partially refunded`;
            }
        }

        return message;
    }

    if (referrer_currency.toUpperCase() === currency.toUpperCase()) {
        const result = await calculateBonusAmount();
        
        const message = generateMessage();

        const { amount, fixe_amount, total_per_amount } = result;

        const tax = referrer_details.tax_per / 100 * amount;
        const amount_to_settle = amount - tax;

        const bonusInsData = {
            referrer_id: referrer_details.id,
            currency: referrer_currency,
            amount: amount.toFixed(2),
            tax: tax.toFixed(2),
            amount_to_settle: amount_to_settle.toFixed(2),
            order_id: order_details.order_id,
            order_status: order_details.order_status,
            txn_id: order_details.payment_id,
            txn_type: order_details.txn_type,
            remark: message,
            ref_no: await helper.make_referral_txn_ref_no(),
            earned_fixed: fixe_amount,
            earn_percentage: total_per_amount.toFixed(2),
            bonus_percentage: referrer_details.per_amount,
            created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
            void_status: order_details.void_status || null,
            super_merchant_id:super_merchant_id,
            submerchant_id:order_details.merchant_id
        };

        await referrerCalculationModel.addBonusData(bonusInsData);
    }

    return true;
}



// module.exports = async (order_details = null, referrer_details = null, referrer_currency = null) => {


//     if (Object.keys(referrer_details).length == 0) {
//         return true;
//     }

//     const { order_id, currency } = order_details;

//     //If both referrer and merchant order has same currency then calculate
//     if (referrer_currency.toUpperCase() === currency.toUpperCase()) {
//         let amount = 0;
//         let total_fix_amount = referrer_details.fix_amount;
//         let total_per_amount = order_details.amount * (referrer_details.per_amount / 100);
//         let fixe_amount = null;
//         let message = '';

//         if (order_details.order_status === 'VOID') {
//             if (referrer_details.apply_greater === 1) {
//                 amount = total_fix_amount > total_per_amount ? total_fix_amount : total_per_amount;
//             } else {
//                 amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
//                 fixe_amount = total_fix_amount;
//             }

//             if (order_details.void_status == 'DEBIT') {
//                 message = `Main transaction is canceled. Order id is ${order_details.order_id}`;
//             }

//             if (order_details.void_status == 'CREDIT') {
//                 message = `Refund transaction is canceled. Order id is ${order_details.order_id}`;
//             }
            
//         } else {
//             //check for the partially refund first time
//             let partial_result = await referrerCalculationModel.getFirstPartiallyRefundedData(order_details.order_id, referrer_details.id);
//             
        
//             if (referrer_details.apply_greater === 1) {
//                 amount = total_fix_amount > total_per_amount ? total_fix_amount : total_per_amount;
//             } else {
//                 if (partial_result === 1) {
//                     amount = parseFloat(total_per_amount);
//                 } else {
//                     amount = parseFloat(total_fix_amount) + parseFloat(total_per_amount);
//                     fixe_amount = total_fix_amount;
//                 }
//             }

           
//             if (order_details.txn_type == 'REFUND') {
//                 message = `Transaction ${order_details.order_id} is refunded`;
//             }

//             if (order_details.txn_type == 'PARTIAL_REFUND') {
//                 message = `Transaction ${order_details.order_id} is partially refunded`;
//             }
//         }

//         let tax = referrer_details.tax_per / 100 * amount;
//         let amount_to_settle = amount - tax;
//         let bonusInsData = {
//             referrer_id: referrer_details.id,
//             currency: referrer_currency,
//             amount: amount.toFixed(2),
//             tax: tax.toFixed(2),
//             amount_to_settle: amount_to_settle.toFixed(2),
//             order_id: order_details.order_id,
//             order_status: order_details.order_status,
//             txn_id: order_details.payment_id,
//             txn_type: order_details.txn_type,
//             remark: message,
//             ref_no: await helper.make_referral_txn_ref_no(),
//             earned_fixed: fixe_amount,
//             earn_percentage: total_per_amount.toFixed(2),
//             bonus_percentage: referrer_details.per_amount,
//             created_at: moment().format('YYYY-mm-dd hh:ss'),
//             void_status: order_details.hasOwnProperty('void_status') ? order_details.void_status : null,
//         }
//         
//         await referrerCalculationModel.addBonusData(bonusInsData);
//     }
//     return true;
// }