const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");

function allAttribute() {
  const attributes = [
    "amount",
    "merchant_country",
    "card_country",
    "card_type",
    "currency",
    "mode",
    "card_scheme",
    "transaction_type",//domestic and international,
    "bin",
    "channel",
    "3ds_version"
  ];
  return attributes.sort();
}

function countryAttribute() {
  const attributes = [
    "merchant_country",
    "card_country",
  ];

  return attributes;
}

module.exports = {
  allAttribute,
  countryAttribute
};
