const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const helper = require('../helper/general_helper');
const moment = require('moment');
const helpers = require("../helper/general_helper");

const merchantOrderModel = require("../../models/merchantOrder");
const subscription_card_expired_model = require('../../models/subscription_card_expired_model');

module.exports = async (res_order_data, payment_status, updated_at, payment_id,card_token='',mode) => {
   // console.log(`Mode is coming from payment method`)
   // console.log(mode);
    console.log(`debug subscription`);
    console.log(res_order_data,payment_status);

    if (res_order_data.origin !== 'SUBSCRIPTION') { 
        return true;
    }
    
    let subs_payment = await merchantOrderModel.selectOne(
        "id, subscription_id, plan_id",
        { order_no: res_order_data.order_id },
        "subs_payment"
    );

    if (!subs_payment) {
        return true;
    }

    let subs_data = {
        payment_status: payment_status,
        transaction_date: updated_at,
        mode:mode

    };
    //console.log(subs_data);
    await merchantOrderModel
        .updateDynamic(
            subs_data,
            {
                id: subs_payment.id,
            },
            "subs_payment"
        );

    let subs_id = subs_payment.subscription_id;


    // return if plan failed
    if (payment_status === "FAILED") {
        return true;
    }

    //update subscription for the customer
    await merchantOrderModel.updateDynamic({ is_customer_subscribed: 1,mode:mode }, { subscription_id: subs_id }, "subscription");

    let subs_data_result = await helpers.get_data_list(
        "*",
        "subscription",
        { subscription_id: subs_id }
    );
    let {plan_id, payment_interval, plan_billing_frequency, email} = subs_data_result[0];
    //check terms
    let subscription_plan_result = await subscription_card_expired_model.getSubscriptionPlan(subs_id);
    
    let payload = subs_data_result[0];
    if (subscription_plan_result.length > 0 && subscription_plan_result[0].terms === 1) {
        let val = {
            subscription_id: `${subs_id}`,
            customer_email: payload?.email,
            next_due_date: updated_at,
            is_paid: 1,
            payment_id: payment_id,
            amount: payload?.initial_payment_amount,
            plan_id: payload?.plan_id
        }
        val.order_id = res_order_data.order_id;
       await merchantOrderModel
            .addDynamic(
                val,
                "subscription_recurring"
            )
            
        
        return true; // return if terms for plan is one no recurring will generate
    }

    // check if recurring is exist
    let subscription_recurring_result = await subscription_card_expired_model.get_subscription_recurring_exists(subs_id);
   // console.log(`subscription_recurring_result`);
   // console.log(subscription_recurring_result);
    if (!subscription_recurring_result) {
        
        //get the instalment from plan
        let installment_result = await subscription_card_expired_model.getPlanInstallment(plan_id);
        const batch_insert_data = [];
        if (installment_result && installment_result.length > 0) {
            let is_first = true;
            let payment_interval_counter = 1;
            const currentDate = moment().utc().format("YYYY-MM-DD");
            let nextDueDate = moment(currentDate);
            for (const installment of installment_result) {
                let temp = {};
                temp = {
                    subscription_id: subs_id,
                    customer_email: email,
                    amount: installment.amount,
                    plan_id: plan_id,
                    order_id: res_order_data.order_id,
                    mode:mode
                }

                if (is_first) {
                    temp.is_paid = 1;
                    temp.payment_id = payment_id;
                    temp.next_due_date = currentDate,
                    temp.response=card_token
                    //false if first iteration complete
                    is_first = false;
                } else {
                    const calculatedDueDate = await helper.calculateDate(nextDueDate, payment_interval, plan_billing_frequency);
                    
                    temp.is_paid = 0;
                    temp.payment_id =''
                    temp.next_due_date = calculatedDueDate;
                    temp.response='';
                    
                    nextDueDate = moment(calculatedDueDate).add(
                        payment_interval * payment_interval_counter,
                        plan_billing_frequency
                    );
                    payment_interval_counter++;
                }
                batch_insert_data.push(temp);
            }
            //console.log(batch_insert_data);
            await subscription_card_expired_model.saveSubscriptionInstallment(batch_insert_data);
        }
        //update subscription date in plan table
        await subscription_card_expired_model.updateLastSubscribed(plan_id);
        await subscription_card_expired_model.lastSubscriptionPayment(subs_id, payment_status);
    } else {
       // console.log(`res order data`);
       // console.log(res_order_data)
       // console.log(res_order_data.order_id)
        //update the recurring status
        await subscription_card_expired_model.updateRecurring(res_order_data.order_id, subs_id, payment_id);
        //update expired card
        await subscription_card_expired_model.updateExpiredCardStatus(res_order_data.order_id, subs_id);
        //update declined card
        await subscription_card_expired_model.updateDeclinedCard(subs_id);
        await subscription_card_expired_model.lastSubscriptionPayment(subs_id, payment_status);
        
    }

    
    return true;

    // if (subs_payment) {
    //     let subs_data = {
    //         payment_status: _nistatus,
    //         transaction_date: updated_at,
    //     };



    //     await merchantOrderModel
    //         .updateDynamic(
    //             subs_data,
    //             {
    //                 id: subs_payment.id,
    //             },
    //             "subs_payment"
    //         )
    //         .then(async (result) => {
    //             let subscription_id =
    //                 await helpers.get_data_list(
    //                     "subscription_id",
    //                     "subs_payment",
    //                     {
    //                         id: subs_payment.id,
    //                     }
    //                 );
    //             
    //             let subs_id =
    //                 subscription_id[0].subscription_id;

    //             //update subpayment status    
    //             if (ni_sale_request.state !== "FAILED") {
    //                 await merchantOrderModel
    //                     .updateDynamic({ status: 1 }, { subscription_id: subs_id }, "subscription")

    //                     let subs_data = await helpers.get_data_list(
    //                         "*",
    //                         "subscription",
    //                         {
    //                             subscription_id: subs_id,
    //                         }
    //                     );
    //                     
    //                     const currentDate =
    //                         moment().format("YYYY-MM-DD");
    //                     let payload = subs_data[0];

    //                     let next_data = await helpers.generateTable(
    //                         currentDate,
    //                         payload?.payment_interval,
    //                         payload?.plan_billing_frequency,
    //                         payload?.terms,
    //                         payload?.subscription_id,
    //                         payload?.email,
    //                         payment_id,
    //                         payload?.initial_payment_amount,
    //                         payload?.final_payment_amount,
    //                         payload?.plan_billing_amount,
    //                         payload?.plan_id
    //                     );
    //                     

    //                     for (let val of next_data) {
    //                         val.order_id = res_order_data.order_id;
    //                         await merchantOrderModel
    //                             .addDynamic(
    //                                 val,
    //                                 "subscription_recurring"
    //                             )
    //                             .then((result) => {})
    //                             .catch((error) => {
    //                                 
    //                             });
    //                     }    
    //             }     
    //         })
    //         .catch((error) => {
    
    //         });
    // }
}
