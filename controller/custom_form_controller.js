const CityModel = require("../models/city");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");
const CustomFormModal = require("../models/custom_form");
const { address } = require("ip");

var custom_form_controller = {
  add: async (req, res) => {},
  list: async (req, res) => {
    const { merchant_id, mode } = req.body;
    let new_merchant_id = enc_dec.cjs_decrypt(merchant_id);
    CustomFormModal.selectSpecific("*", {
      merchant_id: new_merchant_id,
      mode: mode,
    })
      .then(async (result) => {
        // console.log("🚀 ~ .then ~ result:", result);
        let send_res = [];

        if (result.length < 1) {
          for (let payment_type = 1; payment_type < 3; payment_type++) {
            let payload = {
              super_merchant_id: new_merchant_id,
              merchant_id: new_merchant_id,
              payment_type: payment_type,
              mode: mode,
              full_name: payment_type == 2 ? 1 : 0,
              address: 0,
              email: 1,
              country: 0,
              city: 0,
              mobile: 0,
              remark: 0,
            };

            let insertResult = await CustomFormModal.add(payload);
            // console.log(
            //   "🚀 ~ .then ~ insertResult:",
            //   insertResult.affectedRows
            // );

            if (insertResult.affectedRows > 0) {
              let row = {
                merchant_id: enc_dec.cjs_encrypt(payload.merchant_id),
                super_merchant_id: enc_dec.cjs_encrypt(
                  payload.super_merchant_id
                ),
                payment_type: payload.payment_type,
                full_name: payload.full_name == 0 ? false : true,
                address: payload.address == 0 ? false : true,
                email: payload.email == 0 ? false : true,
                country: payload.country == 0 ? false : true,
                city: payload.city == 0 ? false : true,
                mobile: payload.mobile == 0 ? false : true,
                remark: payload.remark == 0 ? false : true,
              };

              send_res.push(row);
            }
          }

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(send_res, "Details fetched successfully.")
            );

          return;
        }

        result.forEach((val) => {
          let row = {
            merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
            super_merchant_id: enc_dec.cjs_encrypt(val.super_merchant_id),
            payment_type: val.payment_type,
            full_name: val.full_name == 0 ? false : true,
            address: val.address == 0 ? false : true,
            email: val.email == 0 ? false : true,
            country: val.country == 0 ? false : true,
            city: val.city == 0 ? false : true,
            mobile: val.mobile == 0 ? false : true,
            remark: val.remark == 0 ? false : true,
          };
          send_res.push(row);
        });
        // console.log("🚀 ~ .then ~ send_res:", send_res);

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get: async (req, res) => {
    const { merchant_id, mode, payment_type } = req.body;
    let new_merchant_id = enc_dec.cjs_decrypt(merchant_id);
    CustomFormModal.selectOne("*", {
      merchant_id: new_merchant_id,
      mode: mode,
      payment_type: payment_type,
    })
      .then(async (result) => {
        // console.log("🚀 ~ .then ~ result:", result);

        let send_res = [];
        let val = result;
        if (result == undefined) {

          for (let pt = 1; pt < 3; pt++) {
            let payload = {
              super_merchant_id: new_merchant_id,
              merchant_id: new_merchant_id,
              payment_type: pt,
              mode: mode,
              full_name: pt == 2 ? 1 : 0,
              address: 0,
              email: 1,
              country: 0,
              city: 0,
              mobile: 0,
              remark: 0,
            };

            // Insert Records
            let insertResult = await CustomFormModal.add(payload);
            if (insertResult.affectedRows > 0) {
              let row = {
                merchant_id: enc_dec.cjs_encrypt(payload.merchant_id),
                super_merchant_id: enc_dec.cjs_encrypt(
                  payload.super_merchant_id
                ),
                payment_type: payload.payment_type,
                full_name: payload.full_name == 0 ? false : true,
                address: payload.address == 0 ? false : true,
                email: payload.email == 0 ? false : true,
                country: payload.country == 0 ? false : true,
                city: payload.city == 0 ? false : true,
                mobile: payload.mobile == 0 ? false : true,
                remark: payload.remark == 0 ? false : true,
              };

              send_res.push(row);
            }
          }

          res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res[0], "Details fetched successfully.")
          );

          return;
        }

        let row = {
          merchant_id: enc_dec.cjs_encrypt(val.merchant_id),
          super_merchant_id: enc_dec.cjs_encrypt(val.super_merchant_id),
          payment_type: val.payment_type,
          full_name: val.full_name == 0 ? false : true,
          address: val.address == 0 ? false : true,
          email: val.email == 0 ? false : true,
          country: val.country == 0 ? false : true,
          city: val.city == 0 ? false : true,
          mobile: val.mobile == 0 ? false : true,
          remark: val.remark == 0 ? false : true,
        };
        send_res = row;
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    const { merchant_id, mode, payment_type, field, value } = req.body;
    console.log("🚀 ~ update: ~ req.body:", req.body);

    var condition = {
      merchant_id: enc_dec.cjs_decrypt(merchant_id),
      mode: mode,
      payment_type: payment_type,
    };

    var data = {};
    if (field === "full_name") {
      data.full_name = value == 1 ? 0 : 1;
    } else if (field === "address") {
      data.address = value == 1 ? 0 : 1;
    } else if (field === "email") {
      data.email = value == 1 ? 0 : 1;
    } else if (field === "country") {
      data.country = value == 1 ? 0 : 1;
    } else if (field === "city") {
      data.city = value == 1 ? 0 : 1;
    } else if (field === "mobile") {
      data.mobile = value == 1 ? 0 : 1;
    } else if (field === "remark") {
      data.remark = value == 1 ? 0 : 1;
    }

    try {
      var result = await CustomFormModal.updateDetails(condition, data);
      console.log("🚀 ~ update: ~ result:", result);
      //   var data = await custom_form_controller.get(req, res);
      if (result.affectedRows > 0) {
        res
          .status(statusCode.ok)
          .send(response.successdatamsg({}, "Settings changed successfully!"));
      } else {
        res
          .status(statusCode.ok)
          .send(response.successdatamsg({}, "Settings changed failed!"));
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};
module.exports = custom_form_controller;
