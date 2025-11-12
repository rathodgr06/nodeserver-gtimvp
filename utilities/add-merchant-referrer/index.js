const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

const referrer_model = require("../../models/referrer_model");
const moment = require("moment");
const helpers = require("../helper/general_helper");

async function addMerchantReferrer(data) {
  let added_date = moment().format("YYYY-MM-DD HH:mm:ss");

  referrer_data = {
    full_name: data.full_name,
    email: data.email,
    mobile_no: data.mobile_no,
    mobile_code: data.code,
    password: "",
    referral_code: data.ref_code,
    currency: data.currency ?? "",
    bank_name: "",
    branch_name: "",
    account_number: "",
    name_on_the_bank_account: "",
    address: "",
    national_id: "",
    iban: "",
    bic_swift: "",
    country: data.registered_business_address,
    state: 0,
    city: 0,
    is_approved: data.auto_approve == true ? 0 : 1,
    zip_code: "",
    deleted: 0,
    created_at: added_date,
    updated_at: added_date,
    super_merchant_id: data.insert_id,
  };

  let master_bonus = await helpers.get_master_referrer_by_currency(
    data.currency
  );

  if (master_bonus) {
    (referrer_data.fix_amount_for_reference =
      master_bonus.fix_amount_for_reference),
      (referrer_data.fix_amount = master_bonus.fix_amount),
      (referrer_data.per_amount = master_bonus.per_amount),
      (referrer_data.apply_greater = master_bonus.apply_greater),
      (referrer_data.settlement_date = master_bonus.settlement_date),
      (referrer_data.ref_validity = moment()
        .add(master_bonus.calculate_bonus_till, "days")
        .format("YYYY-MM-DD")),
      (referrer_data.settlement_frequency = master_bonus.settlement_frequency),
      (referrer_data.calculate_bonus_till = master_bonus.calculate_bonus_till),
      (referrer_data.tax_per = master_bonus.tax_per);
  }
  let insert_referrer = await referrer_model.add(referrer_data);
}

module.exports = {
  addMerchantReferrer,
};
