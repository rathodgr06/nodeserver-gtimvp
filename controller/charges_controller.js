const invoiceChargesModel = require('../models/Invoice_charges_model');
const momentUtil = require('../utilities/date_formatter');
const winston = require('../utilities/logmanager/winston');
const logger = require('../config/logger');

const account_type = {
    month: 'monthly',
    year: 'yearly'
}

async function checkObjectIsEmpty(objectName) {
    return (
        objectName &&
        Object.keys(objectName).length === 0 &&
        objectName.constructor === Object
    );
}
async function invoiceToMerchant(merchant, feature_result, created_at, current_date) {
    try {
      const invoice_to_merchant =
        await invoiceChargesModel.getInvoiceToMerchant(merchant, current_date);
      if (checkObjectIsEmpty(invoice_to_merchant)) {
        const transaction_paydart_result =
          await invoiceChargesModel.getTransactionPayDartChargesData(merchant);
        const merchant_result = await invoiceChargesModel.getSubMerchantData(
          merchant
        );
        let account_fee_total = 0;
        let account_fee_type = null;

        if (
          merchant_result &&
          merchant_result.sell_account_fee_type === account_type.month
        ) {
          account_fee_total = merchant_result.sell_account_fee;
          account_fee_type = account_type.month;
        } else if (
          merchant_result &&
          merchant_result.sell_account_fee_type === account_type.year
        ) {
          const invoice_merchant =
            await invoiceChargesModel.checkInvoiceToMerchant(
              merchant,
              account_type.year
            );
          if (checkObjectIsEmpty(invoice_merchant)) {
            account_fee_total = merchant_result.sell_account_fee;
            account_fee_type = account_type.year;
          } else {
            if (invoice_merchant.created_at < created_at) {
              account_fee_total = merchant_result.sell_account_fee;
              account_fee_type = account_type.year;
            }
          }
        }
        let total = 0;
        total += feature_result.total_feature_fee ?? 0;
        total += feature_result.total_set_up_fee ?? 0;
        total += feature_result.total_mid_fee ?? 0;
        total += transaction_paydart_result.total_fee ?? 0;
        total += account_fee_total ?? 0;

        let data = {
          sub_merchant_id: merchant,
          feature_total: feature_result.total_feature_fee,
          setup_fee_total: feature_result.total_set_up_fee,
          mid_fee_total: feature_result.total_mid_fee,
          paydart_fee_total: transaction_paydart_result.total_fee ?? 0,
          account_fee_total: account_fee_total,
          account_fee_type,
          total: total,
          created_at,
          updated_at: created_at,
        };

        await invoiceChargesModel.create_invoice(data, "invoice_to_merchant");
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
}

async function invoiceToPsp(merchant, feature_set, created_at, current_date) {
    try {
      const invoice_to_merchant = await invoiceChargesModel.getInvoiceToPsp(
        merchant,
        current_date
      );
      if (checkObjectIsEmpty(invoice_to_merchant)) {
        const transaction_paydart_result =
          await invoiceChargesModel.getTransactionBuyRateAndSellRateDiff(
            merchant
          );
        const feature_result = await invoiceChargesModel.getFeatureBuyData(
          merchant
        );
        const merchant_result = await invoiceChargesModel.getSubMerchantData(
          merchant
        );
        let account_fee_total = 0;
        let account_fee_type = null;

        if (merchant_result.buy_account_fee_type === account_type.month) {
          account_fee_total = merchant_result.buy_account_fee;
          account_fee_type = account_type.month;
        } else if (merchant_result.buy_account_fee_type === account_type.year) {
          const invoice_merchant = await invoiceChargesModel.checkInvoiceToPsp(
            merchant,
            account_type.year
          );
          if (checkObjectIsEmpty(invoice_merchant)) {
            account_fee_total = merchant_result.buy_account_fee;
            account_fee_type = account_type.year;
          } else {
            if (invoice_merchant.created_at < created_at) {
              account_fee_total = merchant_result.buy_account_fee;
              account_fee_type = account_type.year;
            }
          }
        }

        let total =
          transaction_paydart_result.txn_total_difference +
          transaction_paydart_result.total_refund_difference -
          (feature_result.total_set_up_fee +
            feature_result.total_mid_fee +
            account_fee_total);

        let data = {
          sub_merchant_id: merchant,
          buy_setup_fee_total: feature_result.total_set_up_fee,
          buy_mid_fee_total: feature_result.total_mid_fee,
          buy_account_fee: account_fee_total,
          buy_account_fee_type: account_fee_type,
          total: total,
          created_at,
          updated_at: created_at,
        };
        await invoiceChargesModel.create_invoice(data, "invoice_to_psp");
      }
    } catch (error) {
      logger.error(500, { message: error, stack: error.stack });
    }
}

async function calculateMerchantInvoice(merchant, feature_merchant_arr, transaction_merchant_arr) {
    try {
        const current_date = await momentUtil.current_date();
        const charges_invoice_result = await invoiceChargesModel.sub_merchantInvoice(merchant, current_date);
        if (checkObjectIsEmpty(charges_invoice_result)) {
            const hasFeature = feature_merchant_arr.includes(merchant);
            const hasTransaction = transaction_merchant_arr.includes(merchant);
            const created_at = await momentUtil.created_date_time();


            let transaction_total_charges = null;
            let feature_total_charges = null;
            let setup_total_total_charges = null;
            let mid_total_charges = null;

            if (hasFeature && hasTransaction) {
                const transaction_result = await invoiceChargesModel.getTransactionData(merchant);

                const feature_result = await invoiceChargesModel.getFeatureData(merchant);
                transaction_total_charges = transaction_result.total ?? 0;
                feature_total_charges = feature_result.total_feature_fee ?? 0;
                setup_total_total_charges = feature_result.total_set_up_fee ?? 0;
                mid_total_charges = feature_result.total_mid_fee ?? 0;
                await invoiceToMerchant(merchant, feature_result, created_at, current_date);
                await invoiceToPsp(merchant, feature_result, created_at, current_date);
            } else if (hasFeature && !hasTransaction) {
                const feature_result = await invoiceChargesModel.getTransactionData(merchant);
                feature_total_charges = feature_result.total_feature_fee ?? 0;
                setup_total_total_charges = feature_result.total_set_up_fee ?? 0;
                mid_total_charges = feature_result.total_mid_fee ?? 0;
                await invoiceToMerchant(merchant, feature_result, created_at, current_date);
            } else if (!hasFeature && hasTransaction) {
                const transaction_result = await invoiceChargesModel.getTransactionData(merchant);
                transaction_total_charges = transaction_result.total;
                await invoiceToPsp(merchant, feature_result, created_at, current_date);
            }

            const data = {
                submerchant_id: merchant,
                transaction_total_charges,
                feature_total_charges,
                setup_total_total_charges,
                mid_total_charges,
                total_charges: transaction_total_charges + feature_total_charges + setup_total_total_charges + mid_total_charges,
                created_at,
                updated_at: created_at,
            };

            if (data.total_charges !== 0) {
                //await invoiceChargesModel.create_invoice(data);
                // Use Promise.all to parallelize the mail sending tasks
                await Promise.all([
                    invoiceChargesModel.create_invoice(data, 'submercahnt_invoice_charges'),
                    // invoiceChargesModel.update_transaction_status(merchant),
                    // invoiceChargesModel.update_feature_status(merchant)
                ]);
            }
        }
        return `Invoice calculation done for merchant: ${merchant}`;
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        throw error; // Rethrow the error for higher-level handling
    }
}

async function create_invoice() {
    try {

        // Get all merchants who have charges
        const merchant_object = await invoiceChargesModel.getAllMerchant();
        const feature_merchant_arr = merchant_object.feature_merchant;
        const transaction_merchant_arr = merchant_object.transaction_merchant;

        if (feature_merchant_arr.length === 0 && feature_merchant_arr.length === 0) {
            return "No data found";
        }

        // Create an array of unique merchants
        const unique_merchant_array = [...new Set([...feature_merchant_arr, ...transaction_merchant_arr])];

        // Create an array of promises
        const promise_array = unique_merchant_array.map(
            (merchant) => calculateMerchantInvoice(merchant, feature_merchant_arr, transaction_merchant_arr)
        );

        // Wait for all promises to settle
        await Promise.all(promise_array);

        return "Merchant invoice charges calculation done";
    } catch (error) {
         logger.error(500,{message: error,stack: error.stack}); 
        throw error;
    }
}

async function create_invoice_request(req, res) {
    try {
        create_invoice();
        return res.status(200).send('Invoice generated successfully');
    } catch (error) {
        logger.error(500,{message: error,stack: error.stack}); 
        return res.status(200).send('something went wrong', error);
    }

}
async function create_invoice_cron() {
    create_invoice();
    return true;
}
module.exports = {
    create_invoice_cron,
    create_invoice_request,
};