const path = require("path");
const transactionChargesModel = require("./transactionChargesModel");
const merchantOrderModel = require("../../../models/merchantOrder");
const dotenv = require("dotenv");
const helper = require('../../helper/general_helper');
const momentDatePicker = require('../../date_formatter/index');
const winston = require('../../logmanager/winston');
const walletDBModel = require("../../../models/wallet");
const charges_invoice_controller = require("../../../controller/charges_invoice_controller");

dotenv.config({ path: "../.env" });

const constantOrderStatus = {
    captured: 'CAPTURED',
    partially_captured: 'PARTIALLY_CAPTURED',
    refunded: 'REFUNDED',
    partially_refunded: 'PARTIALLY_REFUNDED',
    void: 'VOID',
};

const constantTXNStatus = {
    capture: 'CAPTURE',
    void: 'VOID',
    refund: 'REFUND',
    partial_refund: 'PARTIAL_REFUND',
};

module.exports = async (order_details) => {
  
    try {
        console.log(`order details mode ${JSON.stringify(order_details)}`)
        if (order_details.mode == 'test' && process.env.CHARGES_MODE=="live") {
            return true;
        }
        const mid_data = await transactionChargesModel.getMidData(order_details);
        console.log('transaction mid_result', mid_data);
       
        
        let merchant_details = await merchantOrderModel.selectDynamicONE('register_business_country', { merchant_id: order_details.merchant_id }, 'master_merchant_details');
         if (mid_data?.country_id) {
            order_details.country_id = merchant_details.register_business_country;
        }
        let country_details = await merchantOrderModel.selectDynamicONE('country_code', { id: merchant_details.register_business_country }, 'country');

        const is_domestic_international = await checkCountry(order_details.card_country, country_details.country_code);

        //-------------- Get receiver id ------------------------------
        let receiver_id =
            await walletDBModel.get_receiver_by_sub_merchant_id_api_call(
              order_details?.merchant_id
            );
          console.log("🚀 ~ receiver_id:", receiver_id)
          if (receiver_id) {
            order_details.receiver_id = receiver_id;
          }

        switch(order_details.order_status){
            case 'CAPTURED':
                const { sellRate } = await calculateRates(order_details, is_domestic_international);
                await storeTransactionData(order_details, sellRate, is_domestic_international);
            break;
            case 'REFUNDED':
                await storeRefundData(order_details,is_domestic_international);
            break;
            case 'CAPTURE-REVERSAL':
                await storeCaptureReversalData(order_details,is_domestic_international);
            break;
            case 'REFUND-REVERSAL':
                await storeRefundReversalData(order_details,is_domestic_international);
            break;
        }
       /* if (order_details.order_status == "CAPTURED") {
          
            const { sellRate } = await calculateRates(order_details, is_domestic_international);
            await storeTransactionData(order_details, sellRate, is_domestic_international);

            return true;
        } else {
            await storeRefundData(order_details,is_domestic_international);
        } */

        if (order_details.order_status == "CAPTURED") {
          const created_date = await momentDatePicker.created_date_time();
          let wallet_id = await helper.make_sequential_no();
          let sub_merchant_id = order_details?.merchant_id;
          let currency = order_details?.currency;

          if (!receiver_id) {
            receiver_id =
              await walletDBModel.get_receiver_by_sub_merchant_id_api_call(
                order_details?.merchant_id
              );
            console.log("🚀 ~ receiver_id:", receiver_id);
          }

          let create_payload = {
            wallet_id: wallet_id,
            sub_merchant_id: sub_merchant_id,
            beneficiary_id: receiver_id,
            currency: currency,
            created_at: created_date,
            updated_at: created_date,
          };

          let checkdata = {
            currency: currency,
          };

          if (sub_merchant_id) {
            checkdata.sub_merchant_id = sub_merchant_id;
          }

            //   if (receiver_id) {
            //     checkdata.beneficiary_id = receiver_id;
            //   }

          walletDBModel
            .checkAndCreate(create_payload, checkdata)
            .then((result) => {
              console.log("🚀 ~ .then ~ result:", result);
            })
            .catch((error) => {
              console.log("🚀 ~ module.exports= ~ error:", error);
              winston.error(error);
            });
        }

        // Update transaction charges old records
        if (order_details?.merchant_id, receiver_id) {
            let result = await charges_invoice_controller.updateCharges2(order_details?.merchant_id, receiver_id);
            console.log("🚀 ~ result:", result)
        }


    } catch (error) {
        // winston.error(err);
        console.log('transaction error', error);
        return true;
    }

};

async function checkCountry(card_country, merchant_business_country) {
    console.log(`card country is ${card_country} and merchant business country is ${merchant_business_country}`);
    const country_code = await helper.get_country_code_by_name(card_country);
    return (merchant_business_country === country_code) ? 'Domestic' : 'International';
}

async function calculateRates(order_details, is_domestic_international) {
    console.log(`calculateRates is called with order_details: ${JSON.stringify(order_details)}`);
    const { amount, order_status, txn_status } = order_details;
    let sellRate = await calculateRate(transactionChargesModel.getMerchantSellRate, order_details, is_domestic_international);
    console.log("🚀 ~ calculateRates ~ sellRate-111:", sellRate)
    const allZero = Object.values(sellRate).every(value => value === 0);
    console.log(`allZero`)
    console.log(allZero);
    console.log(sellRate);
     console.log(`found  overrided pricing plan ${sellRate.pricing_plan_id}`);
    if (sellRate.pricing_plan_id==0) {
        console.log(`no overrided pricing plan found going for default`);
        sellRate = await calculateRate(transactionChargesModel.getMerchantDefaultSellRate, order_details, is_domestic_international);
    }

    
    // console.log(`this is sell rate`);
    // console.log(sellRate);
    // const buyRate = await calculateRate(transactionChargesModel.getMerchantByRate, order_details, is_domestic_international);
    // if (order_status === constantOrderStatus.void && txn_status === constantTXNStatus.void) {
    //     negateRateValues(sellRate);
    //     negateRateValues(buyRate);
    // }
    // if ((order_status === constantOrderStatus.partially_refunded || order_status === constantOrderStatus.refunded) &&
    //     (txn_status === constantTXNStatus.partial_refund || txn_status === constantTXNStatus.refund)) {
    //     negateRateValues(sellRate);
    //     negateRateValues(buyRate);
    //     await setPaydartCharges(amount, sellRate);
    //     await setPaydartCharges(amount, buyRate);

    // }
    return { sellRate };
}

async function calculateRate(getRateFunction, order_details, is_domestic_international) {
    const rateResult = await getRateFunction(order_details, is_domestic_international);
    console.log("🚀 ~ calculateRate ~ rateResult:", rateResult)
    if (Object.keys(rateResult).length === 0) {

        return {};
    }
    const {pricing_plan_id, rate_fix, rate_per, tax, refund_fees_per, refund_fees_fix, paydart_rate_fix, paydart_rate_per,min_amount,max_amount } = rateResult;
    const rate = {
        pricing_plan_id:pricing_plan_id,
        fix_amount: rate_fix,
        percent_amount: (rate_per ? (order_details.amount * (rate_per / 100)) : 0),
        paydart_fix_amount: paydart_rate_fix,
        paydart_percent_amount: (paydart_rate_per ? (order_details.amount * (paydart_rate_per / 100)) : 0),
        total_amount: 0,
        total_tax_amount: 0,
        total_charges: 0,
        paydart_charge: 0,
        refund_fees_per: refund_fees_per,
        refund_fees_fix: refund_fees_fix
    };

    //rate sell rate
    if (rate.fix_amount) rate.total_amount += rate.fix_amount;
    if (rate_per) rate.total_amount += rate.percent_amount;

    //paydart charge
    if (rate.paydart_fix_amount) rate.total_amount += rate.paydart_fix_amount;
    if (paydart_rate_per) rate.total_amount += rate.paydart_percent_amount;

    if(rate.total_amount>=min_amount && rate.total_amount<=max_amount){
    if (tax) rate.total_tax_amount = (tax ? (rate.total_amount * (tax / 100)) : 0);
    rate.total_charges = rate.total_tax_amount + rate.total_amount;
    }
    if(rate.total_amount<min_amount){
        rate.total_amount=min_amount;
    if (tax) rate.total_tax_amount = (tax ? (rate.total_amount * (tax / 100)) : 0);
    rate.total_charges = rate.total_tax_amount + rate.total_amount;
    }
     if(rate.total_amount>max_amount){
        rate.total_amount=max_amount;
    if (tax) rate.total_tax_amount = (tax ? (rate.total_amount * (tax / 100)) : 0);
    rate.total_charges = rate.total_tax_amount + rate.total_amount;
    }

    //calculate tax
    
    return rate;
}

function negateRateValues(rate) {
    rate.fix_amount = rate.fix_amount * (-1);
    rate.percent_amount = rate.percent_amount * (-1);
    rate.paydart_fix_amount = rate.paydart_fix_amount * (-1);
    rate.paydart_percent_amount = rate.paydart_percent_amount * (-1);
    rate.total_amount = rate.total_amount * (-1);
    rate.total_tax_amount = rate.total_tax_amount * (-1);
    rate.total_charges = rate.total_charges * (-1);
}

async function setPaydartCharges(amount, rate) {
    if (rate.refund_fees_per && rate.refund_fees_fix) {
        rate.paydart_charge = (amount * (rate.refund_fees_per / 100)) + rate.refund_fees_fix;
    }
    if (rate.refund_fees_per && !rate.refund_fees_fix) {
        rate.paydart_charge = amount * (rate.refund_fees_per / 100);
    }
    if (rate.refund_fees_fix && !rate.refund_fees_per) {
        rate.paydart_charge = rate.refund_fees_fix;
    }
    rate.total_charges += rate.paydart_charge;
}

async function storeTransactionData(order_details, sellRate/*, buyRate */, is_domestic_international) {
    console.log(`the complete sell rate story is below`);
    console.log(sellRate);
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        receiver_id: order_details?.receiver_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        txn_reference:order_details.payment_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: sellRate.fix_amount,
        sale_rate_percent_charge: sellRate.percent_amount,
        sale_rate_tax: sellRate.total_tax_amount,
        calculated_fee:sellRate.fix_amount+sellRate.percent_amount,
        applied_fee:sellRate.total_amount,
        applied_tax:sellRate.total_tax_amount,
        sale_rate_paydart_charge: sellRate.paydart_charge,
        sale_rate_paydart_fix_charge: sellRate.paydart_fix_amount,
        sale_rate_paydart_percent_charge: sellRate.paydart_percent_amount,
        sell_rate_total_charge: sellRate.total_charges,
        net_amount:order_details.amount-sellRate.total_charges,
        txn_type: "CAPTURE",
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        created_at: created_date,
        updated_at: created_date,
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeRefundData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        receiver_id: order_details?.receiver_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: -order_details.amount,
        net_amount: -order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeRefundReversalData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        receiver_id: order_details?.receiver_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: order_details.amount,
        net_amount: order_details.amount,
        // buyRate: {
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
async function storeCaptureReversalData(order_details,is_domestic_international) {
    const created_date = await momentDatePicker.created_date_time();
    const insert_data = {
        sub_merchant_id: order_details.merchant_id,
        receiver_id: order_details?.receiver_id,
        order_id: order_details.order_id,
        order_status: order_details.order_status,
        transaction_id: order_details.txn_id,
        transaction_status: order_details.txn_status,
        currency: order_details.currency,
        amount: -order_details.amount,
        buy_rate_fix_chareg: 0,//buyRate.fix_amount,
        buy_rate_percent_charge: 0,// buyRate.percent_amount,
        buy_rate_tax: 0,//buyRate.total_tax_amount,
        buy_rate_paydart_charge: 0,// buyRate.paydart_charge,
        buy_rate_total_charge: 0,//buyRate.total_charges,
        sale_rate_fix_charge: 0,
        sale_rate_percent_charge: 0,
        sale_rate_tax: 0,
        sale_rate_paydart_charge: 0,
        sale_rate_paydart_fix_charge: 0,
        sale_rate_paydart_percent_charge: 0,
        sell_rate_total_charge: 0,
        created_at: created_date,
        updated_at: created_date,
        payment_method: order_details.payment_method,
        txn_type: is_domestic_international,
        txn_reference:order_details.txn_ref_id
    };
    await transactionChargesModel.storeTransaction(insert_data);
}
