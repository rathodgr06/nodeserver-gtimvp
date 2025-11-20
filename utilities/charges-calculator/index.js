const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
const logger = require('../../config/logger');

module.exports = async (req, res, next) => {
  let charges = {
    sell_charges: 0.0,
    buy_charges: 0.0,
    sell_tax: 0.0,
    buy_tax: 0.0,
  };
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("transaction_setup_id")
      .where({ id: req.orpder.merchant_id })
      .get(config.table_refix + "master_merchant");
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }

  let transaction_setup_id = response?.[0].transaction_setup_id;
  let payment_amount = req.order.amount;
  let selection =
    "cmm.currency,cmm.charges_type,cmm.payment_mode,cts.buy_per_charges,cts.buy_fix_amount,buy_min_charge_amount,cts.buy_max_charge_amount,cts.buy_tax,cts.sell_per_charges,cts.sell_min_charge_amount,cts.sell_max_charge_amount,cts.sell_fixed_amount,cts.sell_tax";

  qb = await pool.get_connection();
  let transaction_slab_response;
  try {
    transaction_slab_response = await qb
      .select(selection)
      .from(config.table_prefix + "charges_transaction_setup cmm")
      .join(
        config.table_prefix + "charges_transaction_slab cts",
        "cmm.id=cts.transaction_setup_id",
        "inner"
      )
      .where({ "cmm.id": transaction_setup_id })
      .where({ "cts.buy_from_amount <=": payment_amount })
      .where({ "cts.buy_to_amount >=": payment_amount })
      .get();
  } catch (error) {
    console.error("Database query failed:", error);
    logger.error(500,{message: error,stack: error?.stack});
  } finally {
    qb.release();
  }

  // meta part
  let charges_data = transaction_slab_response?.[0];
  if (charges_data) {
    let allowed_currency = charges_data.currency;
    let allowed_payment_mode = charges_data.payment_mode.replace(/'/g, "");
    let charges_type = charges_data.charges_type;
    let payment_currency = req.order.currency;
    let payment_mode_array = allowed_payment_mode.split(",");
    let currency_array = allowed_currency.split(",");
    let payment_mode = req.bodyString("payment_mode");
    // amounts part
    if (charges_type != "Volume_Base") {
      if (
        currency_array.includes(payment_currency) &&
        payment_mode_array.includes(payment_mode)
      ) {
        // sell charges
        let sell_charge_per = charges_data.sell_per_charges;
        let sell_fix_amount = charges_data.sell_fixed_amount;
        let sell_min_charge = charges_data.sell_min_charge;
        let sell_max_charge_amount = charges_data.sell_max_charge_amount;
        let sell_charge_tax = charges_data.sell_tax;
        // sell charge by percentage
        let sell_charge = (sell_charge_per / 100) * payment_amount;
        //add fix amount to it
        sell_charge = sell_charge + sell_fix_amount;
        //check if its less than min
        if (sell_charge <= sell_min_charge) {
          sell_charge = sell_min_charge;
        }
        //check if its greater than max
        if (sell_charge >= sell_max_charge_amount) {
          sell_charge = sell_max_charge_amount;
        }
        //calculate tax

        let sell_tax = (sell_charge_tax / 100) * sell_charge;

        //Buy Charges
        let buy_charge_per = charges_data.buy_per_charges;
        let buy_fix_amount = charges_data.buy_fix_amount;
        let buy_min_charge = charges_data.buy_min_charge_amount;
        let buy_max_charge_amount = charges_data.buy_max_charge_amount;
        let buy_charge_tax = charges_data.buy_tax;
        // sell charge by percentage
        let buy_charge = (buy_charge_per / 100) * payment_amount;
        //add fix amount to it
        buy_charge = buy_charge_per + buy_fix_amount;
        //check if its less than min
        if (buy_charge <= buy_min_charge) {
          buy_charge = buy_min_charge;
        }
        //check if its greater than max
        if (buy_charge >= buy_max_charge_amount) {
          buy_charge = buy_max_charge_amount;
        }
        //calculate tax
        let buy_tax = (buy_charge_tax / 100) * buy_charge;
        charges.sell_charges = sell_charge;
        charges.buy_charges = buy_charge;
        charges.sell_tax = sell_tax;
        charges.buy_tax = buy_tax;
        req.charges = charges;
        next();
      } else {
        req.charges = charges;
        next();
      }
    } else {
      req.charges = charges;
      next();
    }
  } else {
    req.charges = charges;
    next();
  }
};
