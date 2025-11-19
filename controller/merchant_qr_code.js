const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
const qrGenerateModule = require("../models/qrGenerateModule");
const enc_dec = require("../utilities/decryptor/decryptor");
const SequenceUUID = require("sequential-uuid");
const QRCode = require("qrcode");
const mailSender = require("../utilities/mail/mailsender");
require("dotenv").config({ path: "../.env" });
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const qr_link_url = process.env.QR_PAY_URL;
const moment = require("moment");
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const { EventEmitter } = require("events");
const mailEventEmitter = new EventEmitter();
const winston = require("../utilities/logmanager/winston");

mailEventEmitter.on("email", async ({ data }) => {
  try {
    const mail_response = await mailSender.PaymentMail(data);

    mailEventEmitter.emit("emailSent");
  } catch (error) {
    winston.error(error);
    console.error(error);
    mailEventEmitter.emit("emailError", error);
  }
});

const qr_generate = {
  add: async (req, res) => {
    // let register_at = new Date()
    //     .toJSON()
    //     .substring(0, 19)
    //     .replace("T", " ");
    // let start_date = new Date().toISOString().slice(0, 10);

    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let start_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let type_of_qr = req.bodyString("type_of_qr");
    let mode = req.bodyString("mode");
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let qr_id = uuid.generate();
    if (type_of_qr == "Static_QR") {
      let qr_data = {
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        sub_merchant_id: await enc_dec.cjs_decrypt(
          req.bodyString("sub_merchant_id")
        ),
        currency: req.bodyString("currency"),
        qr_id: qr_id,
        created_at: register_at,
        updated_at: register_at,
        type_of_qr_code: "Static_QR",
        error_message: req.bodyString("error_msg"),
        mode: mode,
      };
      qrGenerateModule
        .add(qr_data)
        .then(async (result) => {
          if (result) {
            let logs_data = {
              merchant_id: req.user.super_merchant_id
                ? req.user.super_merchant_id
                : req.user.id,
              sub_merchant_id: await enc_dec.cjs_decrypt(
                req.bodyString("sub_merchant_id")
              ),
              currency: req.bodyString("currency"),
              qr_id: qr_id,
              created_at: register_at,
              updated_at: register_at,
              type_of_qr_code: "Static_QR",
              error_message: req.bodyString("error_msg"),
              activity: "Created",
              created_by: req.user.id,
            };
            let qr_logs = await qrGenerateModule.add_logs(logs_data);
            let id = result.insertId;
            qrGenerateModule
              .selectOne({ id: id })
              .then(async (result) => {
                let qrid = await enc_dec.cjs_encrypt(result.qr_id);
                let datalink = qr_link_url + result.qr_id;

                QRCode.toDataURL(datalink, (err, url) => {
                  if (err) {
                    res
                      .status(statusCode.internalError)
                      .send(response.errormsg(err));
                  }
                  res
                    .status(statusCode.ok)
                    .send(
                      response.successdatamsg(
                        { qr_url: url },
                        "QR code generated successfully."
                      )
                    );
                });
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else {
            res
              .status(statusCode.internalError)
              .send(
                response.errormsg("User details not found, please try again")
              );
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else if (type_of_qr == "Dynamic_QR") {
      let data_link = {
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
        sub_merchant_id: await enc_dec.cjs_decrypt(
          req.bodyString("sub_merchant_id")
        ),
        qr_id: qr_id,
        currency: req.bodyString("currency"),
        quantity: req.bodyString("quantity"),
        amount: req.bodyString("amount"),
        no_of_collection: req.bodyString("no_of_collection"),
        total_collection: req.bodyString("total_collection"),
        overall_qty_allowed: req.bodyString("overall_qty_allowed"),
        qty_frq: req.bodyString("qty_frq"),
        start_date: moment().format("YYYY-MM-DD"),
        end_date: req.bodyString("end_date"),
        is_expiry: req.bodyString("is_expiry"),
        description: req.bodyString("description"),
        type_of_qr_code: type_of_qr,
        created_at: register_at,
        updated_at: register_at,
        error_message: req.bodyString("error_msg"),
        created_by: req.user.id,
        mode: mode,
      };
      qrGenerateModule
        .add(data_link)
        .then(async (result) => {
          let link_d = await encrypt_decrypt("encrypt", result.insertId);
          let logs_data = {
            merchant_id: req.user.super_merchant_id
              ? req.user.super_merchant_id
              : req.user.id,
            sub_merchant_id: await enc_dec.cjs_decrypt(
              req.bodyString("sub_merchant_id")
            ),
            qr_id: result.insertId,
            currency: req.bodyString("currency"),
            quantity: req.bodyString("quantity"),
            amount: req.bodyString("amount"),
            no_of_collection: req.bodyString("no_of_collection"),
            total_collection: req.bodyString("total_collection"),
            overall_qty_allowed: req.bodyString("overall_qty_allowed"),
            qty_frq: req.bodyString("qty_frq"),
            start_date: moment().format("YYYY-MM-DD"),
            end_date: req.bodyString("end_date"),
            is_expiry: req.bodyString("is_expiry"),
            description: req.bodyString("description"),
            type_of_qr_code: type_of_qr,
            created_at: register_at,
            updated_at: register_at,
            error_message: req.bodyString("error_msg"),
            activity: "Created",
            created_by: req.user.id,
          };
          let qr_logs = await qrGenerateModule.add_logs(logs_data);

          qrGenerateModule
            .selectOne({ id: result.insertId })
            .then(async (result) => {
              let payment_link = qr_link_url + result.qr_id;
              let data1 = { payment_link: payment_link };

              QRCode.toDataURL(payment_link, (err, data) => {
                if (err) {
                  res
                    .status(statusCode.internalError)
                    .send(response.errormsg(err));
                }
                // res.status(statusCode.ok).send(response.successdatamsg({ qr_url: url }, 'Qr code generated successfully.'))

                res
                  .status(statusCode.ok)
                  .send(
                    response.success_linkmsg(
                      data,
                      payment_link,
                      "Payment link generated successfully"
                    )
                  );
              });
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });

          // await qrGenerateModule.updateDetails({ id: result.insertId }, data)
          // res.status(statusCode.ok).send(response.successdatamsg(data, 'Payment link generated successfully'));
        })
        .catch((error) => {
          console.log(error);
          winston.error(error);

          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Valid type of qr required."));
    }
  },

  update: async (req, res) => {
    let date = moment().format("YYYY-MM-DD HH:mm:ss");
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    let check_data = await qrGenerateModule.selectOne({ id: id });
    if (check_data) {
      if (check_data.type_of_qr_code == "Dynamic_QR") {
        if (check_data.is_expiry == 1) {
          let exp_date = moment(check_data.end_date).format("YYYY-MM-DD");

          if (check_data) {
            let type_of_qr = check_data.type_of_qr_code;
            if (type_of_qr == "Dynamic_QR") {
              let data_link = {
                merchant_id: req.user.super_merchant_id
                  ? req.user.super_merchant_id
                  : req.user.id,
                sub_merchant_id: await enc_dec.cjs_decrypt(
                  req.bodyString("sub_merchant_id")
                ),
                currency: req.bodyString("currency"),
                quantity: req.bodyString("quantity"),
                amount: req.bodyString("amount"),
                no_of_collection: req.bodyString("no_of_collection"),
                overall_qty_allowed: req.bodyString("overall_qty_allowed"),
                total_collection: req.bodyString("total_collection"),
                qty_frq: req.bodyString("qty_frq"),
                is_expiry: req.bodyString("is_expiry"),
                // start_date: req.bodyString("start_date"),
                end_date: req.bodyString("end_date"),
                description: req.bodyString("description"),
                error_message: req.bodyString("error_msg"),
                // created_at: register_at,
                updated_at: date,
              };
              qrGenerateModule
                .updateDetails({ id: id }, data_link)
                .then(async (result) => {
                  let logs_data = {
                    merchant_id: req.user.super_merchant_id
                      ? req.user.super_merchant_id
                      : req.user.id,
                    sub_merchant_id: await enc_dec.cjs_decrypt(
                      req.bodyString("sub_merchant_id")
                    ),
                    qr_id: id,
                    currency: req.bodyString("currency"),
                    quantity: req.bodyString("quantity"),
                    amount: req.bodyString("amount"),
                    no_of_collection: req.bodyString("no_of_collection"),
                    total_collection: req.bodyString("total_collection"),
                    overall_qty_allowed: req.bodyString("overall_qty_allowed"),
                    qty_frq: req.bodyString("qty_frq"),
                    start_date: moment().format("YYYY-MM-DD"),
                    end_date: req.bodyString("end_date"),
                    is_expiry: req.bodyString("is_expiry"),
                    description: req.bodyString("description"),
                    type_of_qr_code: type_of_qr,
                    created_at: date,
                    updated_at: date,
                    error_message: req.bodyString("error_msg"),
                    created_by: req.user.id,
                    activity: "Updated",
                  };
                  let qr_logs = await qrGenerateModule.add_logs(logs_data);
                  let link_d = await encrypt_decrypt(
                    "encrypt",
                    result.insertId
                  );
                  let payment_link = qr_link_url + link_d;
                  let data = {
                    payment_link: payment_link,
                  };
                  await qrGenerateModule.updateDetails({ id: id }, data);

                  res
                    .status(statusCode.ok)
                    .send(
                      response.successdatamsg(
                        data,
                        "Payment link updated successfully"
                      )
                    );
                })
                .catch((error) => {
                  winston.error(error);
                  res
                    .status(statusCode.internalError)
                    .send(response.errormsg(error.message));
                });
            } else {
              res
                .status(statusCode.internalError)
                .send(response.errormsg("Please select other type of qr"));
            }
          } else {
            res
              .status(statusCode.internalError)
              .send(response.errormsg("Details not found, please try again"));
          }
        } else {
          let type_of_qr = check_data.type_of_qr_code;
          let data_link = {
            merchant_id: req.user.super_merchant_id
              ? req.user.super_merchant_id
              : req.user.id,
            sub_merchant_id: await enc_dec.cjs_decrypt(
              req.bodyString("sub_merchant_id")
            ),
            currency: req.bodyString("currency"),
            quantity: req.bodyString("quantity"),
            amount: req.bodyString("amount"),
            no_of_collection: req.bodyString("no_of_collection"),
            overall_qty_allowed: req.bodyString("overall_qty_allowed"),
            qty_frq: req.bodyString("qty_frq"),
            total_collection: req.bodyString("total_collection"),
            is_expiry: req.bodyString("is_expiry"),
            start_date: req.bodyString("start_date"),
            end_date: req.bodyString("end_date"),
            description: req.bodyString("description"),
            error_message: req.bodyString("error_msg"),
            // created_at: register_at,
            updated_at: date,
          };

          qrGenerateModule
            .updateDetails({ id: id }, data_link)
            .then(async (result) => {
              let logs_data = {
                merchant_id: req.user.super_merchant_id
                  ? req.user.super_merchant_id
                  : req.user.id,
                sub_merchant_id: await enc_dec.cjs_decrypt(
                  req.bodyString("sub_merchant_id")
                ),
                qr_id: id,
                currency: req.bodyString("currency"),
                quantity: req.bodyString("quantity"),
                amount: req.bodyString("amount"),
                no_of_collection: req.bodyString("no_of_collection"),
                total_collection: req.bodyString("total_collection"),
                overall_qty_allowed: req.bodyString("overall_qty_allowed"),
                qty_frq: req.bodyString("qty_frq"),
                start_date: moment().format("YYYY-MM-DD"),
                end_date: req.bodyString("end_date"),
                is_expiry: req.bodyString("is_expiry"),
                description: req.bodyString("description"),
                type_of_qr_code: type_of_qr,
                created_at: date,
                updated_at: date,
                error_message: req.bodyString("error_msg"),
                created_by: req.user.id,
                activity: "Updated",
              };
              let qr_logs = await qrGenerateModule.add_logs(logs_data);
              let link_d = await encrypt_decrypt("encrypt", result.insertId);
              let payment_link = qr_link_url + link_d;
              let data = { payment_link: payment_link };

              res
                .status(statusCode.ok)
                .send(
                  response.successdatamsg(
                    data,
                    "Payment link updated successfully"
                  )
                );
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      } else {
        res
          .status(statusCode.internalError)
          .send(response.errormsg("Update only dynamic qr"));
      }
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id"));
    }
  },

  details: async (req, res) => {
    const merchant_name = await qrGenerateModule.getMerchantName();
    // const merchant_code = await qrGenerateModule.getMerchantcode();
    // const merchant_mobile = await qrGenerateModule.getMerchantmobile();
    // const merchant_logo = await qrGenerateModule.getMerchantlogo();
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));

    let result;
    if (req.user.type == "admin") {
      result = await qrGenerateModule.selectOne({
        id: id,
        is_reseted: 0,
        is_expired: 0,
      });
    } else {
      result = await qrGenerateModule.selectOne({
        id: id,
        is_reseted: 0,
        is_expired: 0,
        merchant_id: req.user.super_merchant_id
          ? req.user.super_merchant_id
          : req.user.id,
      });
    }

    let resp;
    let send_res;
    if (result) {
      const merchantData = await qrGenerateModule.get_merchant_data(
        result.sub_merchant_id
      );

      const merchantName = await qrGenerateModule.get_merchant_name(
        result.sub_merchant_id
      );

      if (result.type_of_qr_code == "Static_QR") {
        let datalink = await QRCode.toDataURL(qr_link_url + result.qr_id);
        resp = {
          id: enc_dec.cjs_encrypt(result.id),
          sub_merchant_id: await enc_dec.cjs_encrypt(result.sub_merchant_id),
          sub_merchant_name: merchantName?.company_name
            ? merchantName?.company_name
            : "",
          merchant_name: await helpers.get_super_merchant_name(val.merchant_id),
          // sub_merchant_name: merchant_name[result.sub_merchant_id],
          country_code: merchantData?.code ? merchantData?.code : "",
          // country_code: merchant_code[result.sub_merchant_id],
          business_mobile_number: merchantData?.mobile_no
            ? merchantData?.mobile_no
            : "",
          // business_mobile_number:
          //     merchant_mobile[result.sub_merchant_id],
          logo_url: merchantData?.icon
            ? process.env.STATIC_URL + "/static/files/" + merchantData?.icon
            : "",
          logo_file: merchantData?.icon ? merchantData?.icon : "",
          // logo_url:
          //     server_addr +
          //     ":" +
          //     port +
          //     "/static/files/" +
          //     merchant_logo[result.sub_merchant_id],
          // logo_file: merchant_logo[result.sub_merchant_id]
          //     ? merchant_logo[result.sub_merchant_id]
          //     : "",
          currency: result.currency,
          type_of_qr: result.type_of_qr_code,
          qr_id: result.qr_id,
          datalink: datalink,
          merchant_id: result.merchant_id,
          reseted_qr: result.is_reseted,
          is_expiry: result.is_expiry,
          description: result.description,
          status: result.status == 1 ? "Deactivated" : "Activated",
          payment_list: await qrGenerateModule.list_of_payment({
            merchant_qr_id: result.id,
          }),
          error_message: result.error_message,
        };
      } else if (result.type_of_qr_code == "Dynamic_QR") {
        let date = moment().format("YYYY-MM-DD");
        let exp;
        let count_payment;
        let per_day_count;
        per_day_count = await qrGenerateModule.get_count_payment({
          merchant_qr_id: id,
          type_of_qr_code: "'Dynamic_QR'",
          payment_status: "'completed'",
          transaction_date: "'" + date + "'",
        });
        count_payment = await qrGenerateModule.get_count_payment({
          merchant_qr_id: id,
          type_of_qr_code: "'Dynamic_QR'",
          payment_status: "'completed'",
        });
        let day = moment().format("YYYY-MM-DD");
        let datalink = await QRCode.toDataURL(qr_link_url + result.qr_id);
        resp = {
          id: enc_dec.cjs_encrypt(result.id),
          sub_merchant_id: await enc_dec.cjs_encrypt(result.sub_merchant_id),
          sub_merchant_name: merchantName?.company_name
            ? merchantName?.company_name
            : "",
          // sub_merchant_name: merchant_name[result.sub_merchant_id],
          country_code: merchantData?.code ? merchantData?.code : "",
          // country_code: merchant_code[result.sub_merchant_id],
          business_mobile_number: merchantData?.mobile_no
            ? merchantData?.mobile_no
            : "",
          // business_mobile_number:
          //     merchant_mobile[result.sub_merchant_id],
          logo_url: merchantData?.icon
            ? process.env.STATIC_URL + "/static/files/" + merchantData?.icon
            : "",
          // logo_url:
          //     server_addr +
          //     ":" +
          //     port +
          //     "/static/files/" +
          //     merchant_logo[result.sub_merchant_id],
          logo_file: merchantData?.icon ? merchantData?.icon : "",
          // logo_file: merchant_logo[result.sub_merchant_id]
          //     ? merchant_logo[result.sub_merchant_id]
          //     : "",
          type_of_qr: result.type_of_qr_code,
          qr_id: result.qr_id,
          qr_link: datalink,
          currency: result.currency,
          quantity: result.quantity,
          amount: result.amount,
          no_of_collection: result.no_of_collection,
          total_collection: result.total_collection,
          overall_qty_allowed: result.overall_qty_allowed,
          qty_frq: result.qty_frq,
          todays_collection: per_day_count,
          overall_collection: count_payment,
          payment_link: qr_link_url + result.qr_id,
          is_expiry: result.is_expiry,
          start_date: moment(result.start_date).format("DD-MM-YYYY"),
          end_date:
            result.end_date != "1969-12-31"
              ? moment(result.end_date).format("DD-MM-YYYY")
              : "",
          description: result.description,
          merchant_name: await helpers.get_super_merchant_name(val.merchant_id),
          expiry_status: result.end_date < day ? "Expired" : "No expiry",
          status: result.status == 1 ? "Deactivated" : "Activated",
          payment_list: await qrGenerateModule.list_of_payment({
            merchant_qr_id: result.id,
          }),
          error_message: result.error_message,
        };
      }
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(resp, "Details fetched successfully."));
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id."));
    }
  },

  link_details: async (req, res) => {
    const merchant_name = await qrGenerateModule.getMerchantName();
    const merchant_code = await qrGenerateModule.getMerchantcode();
    const merchant_mobile = await qrGenerateModule.getMerchantmobile();
    const merchant_logo = await qrGenerateModule.getMerchantlogo();
    let result;
    let qr_id = req.bodyString("qr_id");
    // if (req.user.type == "admin") {
    //    result = await qrGenerateModule.selectOne({ 'qr_id': qr_id, 'is_reseted': 0, 'is_expired': 0 });
    // }
    // else {
    result = await qrGenerateModule.selectOne({
      qr_id: qr_id,
      is_reseted: 0,
      is_expired: 0,
    });
    // }

    let resp;
    let send_res;
    if (result) {
      if (result.type_of_qr_code == "Static_QR") {
        let datalink = await QRCode.toDataURL(qr_link_url + result.qr_id);

        // https://dev.paydart.pay.ulis.live/qr/fjhjhsdjkhkjsdh
        resp = {
          id: enc_dec.cjs_encrypt(result.id),
          sub_merchant_id: await enc_dec.cjs_encrypt(result.sub_merchant_id),
          sub_merchant_name: merchant_name[result.sub_merchant_id],
          country_code: merchant_code[result.sub_merchant_id],
          business_mobile_number: merchant_mobile[result.sub_merchant_id],
          currency: result.currency,
          type_of_qr: result.type_of_qr_code,
          qr_id: result.qr_id,
          datalink: datalink,
          merchant_id: result.merchant_id,
          reseted_qr: result.is_reseted,
          status: result.status == 1 ? "Deactivated" : "Activated",
          payment_list: await qrGenerateModule.list_of_payment({
            merchant_qr_id: result.id,
          }),
        };
      } else if (result.type_of_qr_code == "Dynamic_QR") {
        let id = result.id;

        let date = moment().format("YYYY-MM-DD");
        let exp;
        let count_payment;
        let per_day_count;
        per_day_count = await qrGenerateModule.get_count_payment({
          merchant_qr_id: id,
          type_of_qr_code: "'Dynamic_QR'",
          payment_status: "'completed'",
          transaction_date: "'" + date + "'",
        });
        count_payment = await qrGenerateModule.get_count_payment({
          merchant_qr_id: id,
          type_of_qr_code: "'Dynamic_QR'",
          payment_status: "'completed'",
        });
        let datalink = await QRCode.toDataURL(qr_link_url + result.qr_id);
        resp = {
          id: enc_dec.cjs_encrypt(result.id),
          sub_merchant_id: await enc_dec.cjs_encrypt(result.sub_merchant_id),
          sub_merchant_name: merchant_name[result.sub_merchant_id],
          country_code: merchant_code[result.sub_merchant_id],
          business_mobile_number: merchant_mobile[result.sub_merchant_id],
          logo_url:
            server_addr +
            "/static/files/" +
            merchant_logo[result.sub_merchant_id],
          logo_file: merchant_logo[result.sub_merchant_id]
            ? merchant_logo[result.sub_merchant_id]
            : "",
          type_of_qr: result.type_of_qr_code,
          qr_id: result.qr_id,
          qr_link: datalink,
          currency: result.currency,
          quantity: result.quantity,
          amount: result.amount,
          no_of_collection: result.no_of_collection,
          overall_qty_allowed: result.overall_qty_allowed,
          qty_frq: result.qty_frq,
          todays_collection: per_day_count,
          overall_collection: count_payment,
          payment_link: qr_link_url + result.qr_id,
          is_expiry: result.is_expiry,
          start_date: moment(result.start_date).format("DD-MM-YYYY"),
          end_date:
            result.is_expiry == 0
              ? result.end_date
              : moment(result.end_date).format("DD-MM-YYYY"),
          description: result.description,
          status: result.status == 1 ? "Deactivated" : "Activated",
          payment_list: await qrGenerateModule.list_of_payment({
            merchant_qr_id: result.id,
          }),
        };
      }
      res
        .status(statusCode.ok)
        .send(response.successdatamsg(resp, "Details fetched successfully."));
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id."));
    }
  },
  payment_link_details: async (req, res) => {
    let company_name = await qrGenerateModule.get_company_name();
    let company_details = await helpers.company_details({ id: 1 });
    let image_path = server_addr + ":4008/static/images/";
    let data = {
      merchant_details: {},
      order_details: {},
      prefer_lang: "",
    };
    let qr_id = req.bodyString("qr_id");
    let result = await qrGenerateModule.selectOne({
      qr_id: qr_id,
      is_reseted: 0,
      is_expired: 0,
    });
    qrGenerateModule
      .selectOneMerchant({ id: result.sub_merchant_id })
      .then(async (rlt) => {
        let tc = await helpers.get_terms_and_condition();
        let currencies = await helpers.get_sub_merchant_currency_from_mid_env(
          result.sub_merchant_id, result?.mode
        );
        data.merchant_details = {
          theme: rlt?.theme,
          icon: process.env.STATIC_URL + "/static/files/" + rlt?.icon,
          logo: process.env.STATIC_URL + "/static/files/" + rlt?.logo,
          use_logo: rlt?.use_logo,
          we_accept_image:
            process.env.STATIC_URL + "/static/files/" + rlt?.we_accept_image,
          brand_color: rlt?.brand_color,
          accent_color: rlt?.accent_color,
          font_name: rlt?.font_name,
          sub_merchant_id: await enc_dec.cjs_encrypt(result.sub_merchant_id),
          merchant_name: company_name[result.sub_merchant_id]
            ? company_name[result.sub_merchant_id]
            : "",
          use_logo_instead_icon: rlt?.use_logo,
          branding_language: rlt?.branding_language?enc_dec.cjs_encrypt(rlt?.branding_language):'',
          currencies: currencies,
          company_details: {
            fav_icon: image_path + company_details.fav_icon,
            logo: image_path + company_details.company_logo,
            letter_head: image_path + company_details.letter_head,
            footer_banner: image_path + company_details.footer_banner,
            title: await helpers.get_title(),
            terms_and_condition: tc,
          },
          mode: result?.mode,
        };

        data.order_details = {
          qr_id: result.qr_id,
          amount: result.amount ? result.amount : 0,
          quantity: result.quantity ? result.quantity : 0,
          currency: result.currency,
          type: result.type_of_qr_code,
        };

        data.prefer_lang =rlt?.branding_language? enc_dec.cjs_encrypt(rlt.branding_language):"",
          res
            .status(statusCode.ok)
            .send(response.successansmsg(data, "Details fetch successfully."));
      })
      .catch((error) => {
        console.log(error);
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  list: async (req, res) => {
    try {
      const merchant_name = await qrGenerateModule.getMerchantName();
      let limit = {
        perpage: 0,
        page: 0,
      };
      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));
        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }

      // let type = req.bodyString("type");
      // if (type == "static") {
      //    let sub_merchant_name = await enc_dec.cjs_decrypt(req.bodyString('sub_merchant_id'));
      //    let search;
      //    if (req.user.type == "admin") {
      //    search = { 'is_reseted': 0 }
      //    }
      //    else {
      //       search = { 'is_reseted': 0, 'is_expired': 0, 'merchant_id': req.user.id }
      //    }
      // }
      // let sub_merchant_name = await enc_dec.cjs_decrypt(
      //     req.bodyString("sub_merchant_id")
      // );
      // let type_of_qr = req.bodyString('type_of_qr');

      let type = "";
      let qr_type = req.bodyString("type");
      if (qr_type == "static") {
        type = "Static_QR";
        limit.perpage=1;
        // type = "'" + "Static_QR" + "'";
      } else if (qr_type == "dynamic") {
        type = "Dynamic_QR";
        // type = "'" + "Dynamic_QR" + "'";
      }

      let search;

      if (req.user.type == "admin") {
        search = { is_reseted: 0, is_expired: 0 };
        // search = { is_reseted: 0, status: 0, is_expired: 0 };
      } else {
        if (req.bodyString("type") == "static") {
          search = {
            is_reseted: 0,
            merchant_id: req.user.super_merchant_id
              ? req.user.super_merchant_id
              : req.user.id,
          };
          // search = { is_reseted: 0, status: 0, merchant_id: req.user.id };
        } else {
          search = {
            is_reseted: 0,
            // is_expired: 0,
            merchant_id: req.user.super_merchant_id
              ? req.user.super_merchant_id
              : req.user.id,
          };
        }
        if (req.user.type == "merchant") {
          if (req.bodyString("selected_merchant") != 0) {
            search.sub_merchant_id = await enc_dec.cjs_decrypt(
              req.bodyString("selected_merchant")
            );
          }
        }
        if (req.bodyString("id")) {
          search.qr_id = req.bodyString("id");
          // type = "'" + "Static_QR" + "'";
        }
      }

      // const filter = {};
      if (req.bodyString("sub_merchant_id")) {
        search.sub_merchant_id = await enc_dec.cjs_decrypt(
          req.bodyString("sub_merchant_id")
        );
      }
      if (req.bodyString("type")) {
        search.type_of_qr_code = type;
      }

      if (req.bodyString("currency")) {
        search.currency = `${req.bodyString("currency")}`;
      }

      if (req.bodyString("is_expired")) {
        search.is_expiry = req.bodyString("is_expired");
      }

      if (req.bodyString("mode")) {
        search.mode = req.bodyString("mode");
      }

      // console.log(search);

      let status_condition = {};
      if (req.bodyString("status") === "Active") {
        status_condition.status = "Active";
      }
      if (req.bodyString("status") === "Deactivated") {
        status_condition.status = "Deactivated";
      }
      if (req.bodyString("status") === "Expired") {
        status_condition.status = "Expired";
      }
      // if (req.bodyString('type_of_qr')) { search.type_of_qr_code = type_of_qr }

      let date_condition = {};
      if (req.bodyString("from_date")) {
        date_condition.from_date = req.bodyString("from_date");
      }
      if (req.bodyString("to_date")) {
        date_condition.to_date = req.bodyString("to_date");
      }

      const like_condition = { description: "" };
      if (req.bodyString("description")) {
        like_condition.description = req.bodyString("description");
      }

      let amount_condition = {};
      if (req.bodyString("amount_condition") && req.bodyString("amount")) {
        let symbol_name = req.bodyString("amount_condition");

        if (symbol_name === "equal_to") {
          amount_condition.condition = "=";
        } else if (symbol_name === "greater_then") {
          amount_condition.condition = ">";
        } else if (symbol_name === "less_then") {
          amount_condition.condition = "<";
        } else if (symbol_name === "greater_then_equal") {
          amount_condition.condition = ">=";
        } else if (symbol_name === "less_then_equal") {
          amount_condition.condition = "<=";
        }

        // amount_condition.condition = req.bodyString("amount_condition");
        amount_condition.amount = req.bodyString("amount");
      }

      let result = await qrGenerateModule.select_qr_list(
        search,
        limit,
        like_condition,
        date_condition,
        status_condition,
        amount_condition
      );
      let send_res = [];

      for (val of result) {
        const merchantData = await qrGenerateModule.get_merchant_data(
          val.sub_merchant_id
        );

        let res;
        if (val.type_of_qr_code == "Static_QR") {
          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          const itemCount = await qrGenerateModule.get_counts_qr_payments(
            val.qr_id
          );

          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),
            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            // order_no: order_ids ? order_ids : "",
            order_count: itemCount ? itemCount : 0,
            currency: val.currency,
            currency_symbol: await helpers.get_currency_symbol_by_currency_code(
              val.currency
            ),
            logo_url: merchantData?.icon
              ? server_addr + "/static/files/" + merchantData?.icon
              : "",
            logo_file: merchantData?.icon ? merchantData?.icon : "",
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            status: val.status == 1 ? "Deactivated" : "Active",
            total_collection: val.total_collection,
            overall_qty_allowed: val.overall_qty_allowed,
            qty_frq: val.qty_frq,
            description: val.description,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
            payment_link: qr_link_url + val.qr_id,
            de_qr_id: val?.id ? await helpers.formatNumber(val?.id) : "",
          };
        } else if (val.type_of_qr_code == "Dynamic_QR") {
          // let count_payment =
          //     await qrGenerateModule.get_count_payment({
          //         merchant_qr_id: val.id,
          //         type_of_qr_code: "'Dynamic_QR'",
          //     });
          let day = moment().format("YYYY-MM-DD");

          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          let qb = await pool.get_connection();
          let needed_info;
          try {
            let table =
              req.bodyString("mode") == "test" ? "test_orders o" : "orders o";
            let query =
              'SELECT SUM(qp.quantity) as quantity,SUM(qp.total_amount) as total_amount,SUM(refunded_amount) as refunded, GROUP_CONCAT(qp.order_no SEPARATOR ",") as order_no FROM ' +
              config.table_prefix +
              "qr_payment qp INNER JOIN " +
              config.table_prefix +
              table +
              ' ON qp.order_no=o.order_id WHERE qp.payment_id="' +
              val.qr_id +
              '" AND (qp.payment_status="CAPTURED" || qp.payment_status="AUTHORISED") AND o.status<>"VOID" GROUP BY qp.payment_id';
            needed_info = await qb.query(query);
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          if (needed_info.length > 0) {
            needed_info = needed_info[0];
          } else {
            needed_info = {
              quantity: 0,
              total_amount: 0.0,
              order_no: "",
            };
          }

          const itemCount = await qrGenerateModule.get_counts_qr_payments(
            val.qr_id
          );

          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),

            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            sub_merchant_logo: (await qrGenerateModule.getSubMerchantlogo(
              val.sub_merchant_id
            ))
              ? server_addr +
                "/static/files/" +
                (await qrGenerateModule.getSubMerchantlogo(val.sub_merchant_id))
              : "",
            merchant_name: await helpers.get_super_merchant_name(
              val.merchant_id
            ),
            currency: val.currency,
            // order_no: needed_info.order_no,
            order_count: itemCount ? itemCount : 0,
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            quantity: val.quantity,
            amount: val.amount,
            no_of_collection: val.no_of_collection,
            collection_done: needed_info.quantity ? needed_info.quantity : 0,
            payment_link: qr_link_url + val.qr_id,
            is_expiry: val.is_expiry,
            start_date: moment(val.start_date).format("DD-MM-YYYY"),
            end_date:
              val.is_expiry == 0
                ? ""
                : moment(val.end_date).format("DD-MM-YYYY"),
            expiry_status:
              val.is_expiry == 1
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Not Expired"
                : "No expiry date",
            status: val.status == 1 ? "Deactivated" : "Active",
            final_status:
              val.is_expiry === 1 && val.status === 0
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Active"
                : val.is_expiry === 1 && val.status === 1
                ? "Deactivated"
                : val.is_expiry === 0 && val.status === 0
                ? "Active"
                : "Deactivated",

            total_collection: val.total_collection,
            overall_qty_allowed: val.overall_qty_allowed,
            qty_frq: val.qty_frq,
            description: val.description,
            total_amount_paid: needed_info.total_amount
              ? needed_info.total_amount - needed_info.refunded
              : 0.0,
            total_quantity_paid: needed_info.quantity
              ? needed_info.quantity
              : 0,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
            de_qr_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            created_by: val.created_by
              ? await helpers.get_super_merchant_name(val.created_by)
              : "",
          };
        }
        send_res.push(res);
      }

      let total_count = await qrGenerateModule.get_count_all_conditions(
        search,
        like_condition,
        date_condition,
        status_condition,
        amount_condition
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            send_res,
            "List fetched successfully.",
            total_count
          )
        );
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  listDeactivated: async (req, res) => {
    try {
      const merchant_name = await qrGenerateModule.getMerchantName();
      let search;
      if (req.user.type == "admin") {
        search = { type_of_qr_code: "Static_QR" };
      } else {
        search = {
          type_of_qr_code: "Static_QR",
          merchant_id: req.user.super_merchant_id
            ? req.user.super_merchant_id
            : req.user.id,
        };
      }
      let sub_merchant_id = enc_dec.cjs_decrypt(
        req.bodyString("selected_merchant")
      );
      if (sub_merchant_id > 0) {
        search.sub_merchant_id = sub_merchant_id;
      }
      if (req.bodyString("id")) {
        search.qr_id = req.bodyString("id");
        // type = "'" + "Static_QR" + "'";
      }
      let result = await qrGenerateModule.select_deactivated_qr_list(search);

      let send_res = [];

      for (val of result) {
        let res;
        if (val.type_of_qr_code == "Static_QR") {
          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select("order_no")
              .where({ payment_id: val.qr_id })
              .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");

          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),
            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            order_no: order_ids ? order_ids : "",
            currency: val.currency,
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            status: val.status == 1 ? "Deactivated" : "Active",
            is_reseted: val.is_reseted,
            total_collection: val.total_collection,
            overall_qty_allowed: val.overall_qty_allowed,
            qty_frq: val.qty_frq,
            description: val.description,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
            payment_link: qr_link_url + val.qr_id,
            de_qr_id: val?.id ? await helpers.formatNumber(val?.id) : "",
            created_by:
              val.activity == "Created"
                ? await helpers.get_admin_name_by_id(val.created_by)
                : await helpers.get_super_merchant_name(val.created_by),
          };
        } else if (val.type_of_qr_code == "Dynamic_QR") {
          let count_payment = await qrGenerateModule.get_count_payment({
            merchant_qr_id: val.id,
            type_of_qr_code: "'Dynamic_QR'",
          });
          let day = moment().format("YYYY-MM-DD");

          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select("order_no")
              .where({ payment_id: val.qr_id })
              .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");

          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),

            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            sub_merchant_logo: (await qrGenerateModule.getSubMerchantlogo(
              val.sub_merchant_id
            ))
              ? process.env.STATIC_URL +
                "/static/files/" +
                (await qrGenerateModule.getSubMerchantlogo(val.sub_merchant_id))
              : "",
            currency: val.currency,
            order_no: order_ids ? order_ids : "",
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            quantity: val.quantity,
            amount: val.amount,
            no_of_collection: val.no_of_collection,
            collection_done: count_payment,
            payment_link: qr_link_url + val.qr_id,
            is_expiry: val.is_expiry,
            start_date: moment(val.start_date).format("DD-MM-YYYY"),
            end_date:
              val.is_expiry == 0
                ? ""
                : moment(val.end_date).format("DD-MM-YYYY"),
            expiry_status:
              val.is_expiry == 1
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Not Expired"
                : "No expiry date",
            status: val.status == 1 ? "Deactivated" : "Active",
            final_status:
              val.is_expiry === 1 && val.status === 0
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Active"
                : val.is_expiry === 1 && val.status === 1
                ? "Deactivated"
                : val.is_expiry === 0 && val.status === 0
                ? "Active"
                : "Deactivated",

            total_collection: val.total_collection,
            overall_qty_allowed: val.overall_qty_allowed,
            qty_frq: val.qty_frq,
            description: val.description,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
          };
        }
        send_res.push(res);
      }

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(send_res, "List fetched successfully."));
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_api_add: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let start_date = moment().format("YYYY-MM-DD");
    // let mode = req.bodyString("mode");

    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let qr_id = uuid.generate();

    let data_link = {
      merchant_id: req.credentials.merchant_id,
      sub_merchant_id: req.credentials.super_merchant_id,
      // sub_merchant_id: await enc_dec.cjs_decrypt(
      //     req.bodyString("sub_merchant_id")
      // ),
      qr_id: qr_id,
      currency: req.bodyString("currency"),
      quantity: req.bodyString("quantity"),
      amount: req.bodyString("amount"),
      no_of_collection: req.bodyString("no_of_collection"),
      total_collection: req.bodyString("total_collection"),
      overall_qty_allowed: req.bodyString("overall_qty_allowed"),
      qty_frq: req.bodyString("qty_frq"),
      start_date: start_date,
      end_date: req.bodyString("end_date"),
      is_expiry: req.bodyString("is_expiry"),
      description: req.bodyString("description"),
      created_at: register_at,
      updated_at: register_at,
      error_message: req.bodyString("error_msg"),
      created_by: "",
      mode: "live",
    };

    qrGenerateModule
      .add(data_link)
      .then(async (result) => {
        let link_d = await encrypt_decrypt("encrypt", result.insertId);
        let logs_data = {
          merchant_id: req.credentials.merchant_id,
          // sub_merchant_id: await enc_dec.cjs_decrypt(
          //     req.bodyString("sub_merchant_id")
          // ),
          sub_merchant_id: req.credentials.super_merchant_id,
          qr_id: result.insertId,
          currency: req.bodyString("currency"),
          quantity: req.bodyString("quantity"),
          amount: req.bodyString("amount"),
          no_of_collection: req.bodyString("no_of_collection"),
          total_collection: req.bodyString("total_collection"),
          overall_qty_allowed: req.bodyString("overall_qty_allowed"),
          qty_frq: req.bodyString("qty_frq"),
          start_date: moment().format("YYYY-MM-DD"),
          end_date: req.bodyString("end_date"),
          is_expiry: req.bodyString("is_expiry"),
          description: req.bodyString("description"),
          type_of_qr_code: "Dynamic_QR",
          created_at: register_at,
          updated_at: register_at,
          error_message: req.bodyString("error_msg"),
          activity: "Created",
          created_by: "",
        };
        let qr_logs = await qrGenerateModule.add_logs(logs_data);
        qrGenerateModule
          .selectOne({ id: result.insertId })
          .then(async (result) => {
            let payment_link = qr_link_url + result.qr_id;
            let data1 = { payment_link: payment_link };

            QRCode.toDataURL(payment_link, (err, data) => {
              if (err) {
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(err));
              }
              res
                .status(statusCode.ok)
                .send(
                  response.success_linkmsg(
                    data,
                    payment_link,
                    "Payment link generated successfully"
                  )
                );
            });
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  open_list: async (req, res) => {
    const merchant_name = await qrGenerateModule.getMerchantName();
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.bodyString("perpage") && req.bodyString("page")) {
      perpage = parseInt(req.bodyString("perpage"));
      start = parseInt(req.bodyString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let search = {
      is_reseted: 0,
      merchant_id: req.credentials.merchant_id,
      sub_merchant_id: req.credentials.super_merchant_id,
      type_of_qr_code: "Dynamic_QR",
    };

    if (req.bodyString("is_expired")) {
      search.is_expiry = req.bodyString("is_expired");
    }

    if (req.bodyString("currency")) {
      search.currency = `${req.bodyString("currency")}`;
    }

    let status_condition = {};
    if (req.bodyString("status")) {
      status_condition.status = req.bodyString("status");
    }

    // if (req.bodyString('type_of_qr')) { search.type_of_qr_code = type_of_qr }
    let date_condition = {};
    if (req.bodyString("from_date")) {
      date_condition.from_date = req.bodyString("from_date");
    }
    if (req.bodyString("to_date")) {
      date_condition.to_date = req.bodyString("to_date");
    }

    const like_condition = { description: "" };
    if (req.bodyString("description")) {
      like_condition.description = req.bodyString("description");
    }

    // let amount_condition = {};
    // if (req.bodyString("amount_condition") && req.bodyString("amount")) {
    //     amount_condition.condition = req.bodyString("amount_condition");
    //     amount_condition.amount = req.bodyString("amount");
    // }

    let amount_condition = {};
    if (req.bodyString("amount_condition") && req.bodyString("amount")) {
      let symbol_name = req.bodyString("amount_condition");

      if (symbol_name === "equal_to") {
        amount_condition.condition = "=";
      } else if (symbol_name === "greater_then") {
        amount_condition.condition = ">";
      } else if (symbol_name === "less_then") {
        amount_condition.condition = "<";
      } else if (symbol_name === "greater_then_equal") {
        amount_condition.condition = ">=";
      } else if (symbol_name === "less_then_equal") {
        amount_condition.condition = "<=";
      }
      // amount_condition.condition = req.bodyString("amount_condition");
      amount_condition.amount = req.bodyString("amount");
    }

    let result = await qrGenerateModule.select_qr_list(
      search,
      limit,
      like_condition,
      date_condition,
      status_condition,
      amount_condition
    );

    let send_res = [];

    for (val of result) {
      let res;
      if (val.type_of_qr_code === "Dynamic_QR") {
        let count_payment = await qrGenerateModule.get_count_payment({
          merchant_qr_id: val.id,
          type_of_qr_code: "'Dynamic_QR'",
        });
        let day = moment().format("YYYY-MM-DD");
        let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

        let needed_info;
        let qb = await pool.get_connection();
        try {
          needed_info = await qb
            .select("order_no")
            .where({ payment_id: val.qr_id })
            .get(config.table_prefix + "qr_payment");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        const order_ids = needed_info.map((item) => item.order_no).join(",");

        res = {
          // id: enc_dec.cjs_encrypt(val.id),
          // sub_merchant_id: await enc_dec.cjs_encrypt(
          //     val.sub_merchant_id
          // ),
          sub_merchant_name: merchant_name[val.sub_merchant_id]
            ? merchant_name[val.sub_merchant_id]
            : "",
          currency: val.currency,
          // order_no: order_ids ? order_ids : "",
          // type_of_qr: val.type_of_qr_code,
          qr_id: val.qr_id,
          qr_url: datalink,
          quantity: val.quantity,
          amount: val.amount,
          no_of_collection: val.no_of_collection,
          collection_done: count_payment,
          payment_link: qr_link_url + val.qr_id,
          is_expiry: val.is_expiry,
          start_date: moment(val.start_date).format("DD-MM-YYYY"),
          end_date:
            val.is_expiry == 0 ? "" : moment(val.end_date).format("DD-MM-YYYY"),
          expiry_status:
            val.is_expiry == 1
              ? moment(val.end_date).format("YYYY-MM-DD") < day
                ? "Expired"
                : "Not Expired"
              : "No expiry date",
          status: val.status == 1 ? "Deactivated" : "Active",
          final_status:
            val.is_expiry === 1 && val.status === 0
              ? moment(val.end_date).format("YYYY-MM-DD") < day
                ? "Expired"
                : "Active"
              : val.is_expiry === 1 && val.status === 1
              ? "Deactivated"
              : val.is_expiry === 0 && val.status === 0
              ? "Active"
              : "Deactivated",

          total_collection: val.total_collection,
          overall_qty_allowed: val.overall_qty_allowed,
          qty_frq: val.qty_frq,
          description: val.description,
          created_at: val.created_at,
        };
      }
      send_res.push(res);
    }

    let total_count = await qrGenerateModule.get_count_all_conditions(
      search,
      like_condition,
      date_condition,
      status_condition,
      amount_condition
    );
    res
      .status(statusCode.ok)
      .send(
        response.successdatamsg(
          send_res,
          "List fetched successfully.",
          total_count
        )
      );
  },

  reset: async (req, res) => {
    const merchant_name = await qrGenerateModule.getMerchantName();
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    let find_data = await qrGenerateModule.selectOne_type({
      id: id,
      type_of_qr_code: "Static_QR",
    });
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let send_res = [];

    if (find_data) {
      qr_data = {
        is_reseted: 1,
      };
      qrGenerateModule
        .updateDetails({ id: id }, qr_data)
        .then(async (result) => {
          let logs_data = {
            qr_id: id,
            merchant_id: find_data.merchant_id,
            sub_merchant_id: find_data.sub_merchant_id,
            currency: find_data.currency,
            type_of_qr_code: find_data.type_of_qr_code,
            updated_at: register_at,
            created_at: moment(find_data.created_at).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
            created_by: req.user.id,
            activity: "Reset",
          };
          let qr_logs = await qrGenerateModule.add_logs(logs_data);
          let find_date = await qrGenerateModule
            .selectOne({ id: id })
            .then(async (result) => {
              const uuid = new SequenceUUID({
                valid: true,
                dashes: false,
                unsafeBuffer: true,
              });
              let qr_id = uuid.generate();
              let qr_data = {
                mode: result.mode,
                qr_id: qr_id,
                type_of_qr_code: "Static_QR",
                sub_merchant_id: result.sub_merchant_id,
                currency: result.currency,
                created_at: register_at,
                updated_at: register_at,
                merchant_id: req.user.id,
              };
              qrGenerateModule.add(qr_data).then(async (result) => {
                if (result) {
                  let id = result.insertId;
                  qrGenerateModule
                    .selectOne({ id: id })
                    .then(async (resut) => {
                      let qrid = await enc_dec.cjs_encrypt(resut.qr_id);
                      //  let payment_link = QRCode.toDataURL(qrid);
                      let datalink = await QRCode.toDataURL(
                        qr_link_url + resut.qr_id
                      );

                      let resp = {
                        id: await enc_dec.cjs_encrypt(resut.id),
                        sub_merchant_id: await enc_dec.cjs_encrypt(
                          resut.sub_merchant_id
                        ),
                        sub_merchant_name: merchant_name[resut.sub_merchant_id]
                          ? merchant_name[resut.sub_merchant_id]
                          : "",
                        currency: resut.currency,
                        type_of_qr: resut.type_of_qr_code,
                        qr_id: resut.qr_id,
                        qr_url: datalink,
                        status: resut.status == 1 ? "Deactivated" : "Active",
                      };
                      // let qrid = await enc_dec.cjs_encrypt(resut.qr_id)
                      // let datalink = await QRCode.toDataURL(server_addr + ':' + port + "/api/v1/qr?code=" + val.qr_id);
                      // QRCode.toDataURL((qrid), (err, url) => {
                      //    if (err) {
                      //       res.status(statusCode.internalError).send(response.errormsg(err));
                      //    }

                      send_res.push(resp);
                      res
                        .status(statusCode.ok)
                        .send(
                          response.successdatamsg(
                            send_res,
                            "QR code generated successfully."
                          )
                        );
                    })
                    .catch((error) => {
                      winston.error(error);
                      res
                        .status(statusCode.internalError)
                        .send(response.errormsg(error.message));
                    });
                } else {
                  res
                    .status(statusCode.internalError)
                    .send(
                      response.errormsg(
                        "User details not found, please try again"
                      )
                    );
                }
              });
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid Id."));
    }
  },
  deactivate: async (req, res) => {
    try {
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      let find_data = await qrGenerateModule.selectOne({ id: id });
      let date = moment().format("YYYY-MM-DD HH:mm:ss");
      if (find_data.type_of_qr_code == "Static_QR") {
        var insdata = {
          status: 1,
        };
        $ins_id = await qrGenerateModule
          .updateDetails({ id: id }, insdata)
          .then(async (result) => {
            let logs_data = {
              qr_id: id,
              merchant_id: find_data.merchant_id,
              sub_merchant_id: find_data.sub_merchant_id,
              currency: find_data.currency,
              type_of_qr_code: find_data.type_of_qr_code,
              updated_at: date,
              created_at: moment(find_data.created_at).format(
                "YYYY-MM-DD HH:mm:ss"
              ),
              created_by: req.user.id,
              activity: "Deactivated",
            };
            let qr_logs = await qrGenerateModule.add_logs(logs_data);
            res
              .status(statusCode.ok)
              .send(
                response.successmsg("Payment link deactivated successfully")
              );
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        var insdata = {
          status: 1,
        };
        $ins_id = await qrGenerateModule
          .updateDetails({ id: id }, insdata)
          .then(async (result) => {
            let logs_data = {
              merchant_id: find_data.merchant_id,
              sub_merchant_id: find_data.sub_merchant_id,
              qr_id: id,
              currency: find_data.currency,
              quantity: find_data.quantity,
              amount: find_data.amount,
              no_of_collection: find_data.no_of_collection,
              total_collection: find_data.total_collection,
              overall_qty_allowed: find_data.overall_qty_allowed,
              qty_frq: find_data.qty_frq,
              start_date: moment(find_data.start_date).format("YYYY-MM-DD"),
              end_date: moment(find_data.end_date).format("YYYY-MM-DD"),
              is_expiry: find_data.is_expiry,
              description: find_data.description,
              type_of_qr_code: find_data.type_of_qr_code,
              created_at: date,
              updated_at: date,
              error_message: find_data.error_msg,
              created_by: req.user.id,
              activity: "Deactivated",
            };
            let qr_logs = await qrGenerateModule.add_logs(logs_data);
            res
              .status(statusCode.ok)
              .send(
                response.successmsg("Payment link deactivated successfully")
              );
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  activate: async (req, res) => {
    try {
      let date_ = moment().format("YYYY-MM-DD HH:mm:ss");
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      let find_data = await qrGenerateModule.selectOne({ id: id });

      if (find_data.type_of_qr_code == "Static_QR") {
        var insdata = {
          status: 0,
        };
        $ins_id = await qrGenerateModule
          .updateDetails({ id: id }, insdata)
          .then(async (result) => {
            let logs_data = {
              merchant_id: find_data.merchant_id,
              sub_merchant_id: find_data.sub_merchant_id,
              qr_id: id,
              currency: find_data.currency,
              type_of_qr_code: find_data.type_of_qr_code,
              updated_at: date_,
              created_at: moment(find_data.created_at).format(
                "YYYY-MM-DD HH:mm:ss"
              ),
              created_by: req.user.id,
              activity: "Activated",
            };
            let qr_logs = await qrGenerateModule.add_logs(logs_data);
            res
              .status(statusCode.ok)
              .send(response.successmsg("Payment link activated successfully"));
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      } else {
        let exp_date = moment(find_data?.end_date).format("YYYY-MM-DD");
        // let exp_date = find_data.end_date;
        // let exp_date = find_data.end_date.toISOString().slice(0, 10);
        let date = moment().format("YYYY-MM-DD");

        if (find_data.is_expiry == 1) {
          if (exp_date < date) {
            res
              .status(statusCode.ok)
              .send(response.successmsg("Payment link expired."));
          } else {
            var insdata = {
              status: 0,
            };
            $ins_id = await qrGenerateModule
              .updateDetails({ id: id }, insdata)
              .then(async (result) => {
                let logs_data = {
                  merchant_id: find_data.merchant_id,
                  sub_merchant_id: find_data.sub_merchant_id,
                  qr_id: id,
                  currency: find_data.currency,
                  quantity: find_data.quantity,
                  amount: find_data.amount,
                  no_of_collection: find_data.no_of_collection,
                  total_collection: find_data.total_collection,
                  overall_qty_allowed: find_data.overall_qty_allowed,
                  qty_frq: find_data.qty_frq,
                  start_date: moment(find_data.start_date).format("YYYY-MM-DD"),
                  end_date: moment(find_data.end_date).format("YYYY-MM-DD"),
                  is_expiry: find_data.is_expiry,
                  description: find_data.description,
                  type_of_qr_code: find_data.type_of_qr_code,
                  created_at: date_,
                  updated_at: date_,
                  error_message: find_data.error_msg,
                  created_by: req.user.id,
                  activity: "Activated",
                };
                let qr_logs = await qrGenerateModule.add_logs(logs_data);
                res
                  .status(statusCode.ok)
                  .send(
                    response.successmsg("Payment link activated successfully")
                  );
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          }
        } else {
          var insdata = {
            status: 0,
          };
          $ins_id = await qrGenerateModule
            .updateDetails({ id: id }, insdata)
            .then(async (result) => {
              let logs_data = {
                merchant_id: find_data.merchant_id,
                sub_merchant_id: find_data.sub_merchant_id,
                qr_id: id,
                currency: find_data.currency,
                quantity: find_data.quantity,
                amount: find_data.amount,
                no_of_collection: find_data.no_of_collection,
                total_collection: find_data.total_collection,
                overall_qty_allowed: find_data.overall_qty_allowed,
                qty_frq: find_data.qty_frq,
                start_date: moment(find_data.start_date).format("YYYY-MM-DD"),
                end_date: moment(find_data.end_date).format("YYYY-MM-DD"),
                is_expiry: find_data.is_expiry,
                description: find_data.description,
                type_of_qr_code: find_data.type_of_qr_code,
                created_at: date_,
                updated_at: date_,
                error_message: find_data.error_msg,
                activity: "Activated",
              };
              let qr_logs = await qrGenerateModule.add_logs(logs_data);
              res
                .status(statusCode.ok)
                .send(
                  response.successmsg("Payment link activated successfully")
                );
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        }
      }
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },

  payment_mail_send: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    const merchant_name = await qrGenerateModule.getMerchantName();
    const merchant_logo = await qrGenerateModule.getMerchantlogo();
    let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
    let qr_data = await qrGenerateModule.selectOne({ id: id });
    if (qr_data) {
      if (qr_data.type_of_qr_code == "Static_QR") {
        let data = {
          id: await enc_dec.cjs_encrypt(id),
          qr_id: qr_data.qr_id,
          merchant_name: merchant_name[qr_data.sub_merchant_id]
            ? merchant_name[qr_data.sub_merchant_id]
            : "",
          message: req.bodyString("message"),
          message_text:
            req.bodyString("message") != ""
              ? '<b style="color: #263238 !important;">Description:</b>' +
                req.bodyString("message")
              : "",
          pay_url: qr_link_url + qr_data.qr_id,
          mail_to: req.bodyString("emails"),
          mail_cc: req.bodyString("cc_email") ? req.bodyString("cc_email") : "",
          currency: qr_data.currency,
          amount:
            qr_data.type_of_qr_code == "Static_QR"
              ? req.bodyString("amount")
              : qr_data.amount,
          send_date: register_at,
          subject: req.bodyString("subject"),
          merchant_logo: merchant_logo[qr_data.sub_merchant_id]
            ? server_addr +
              "/static/files/" +
              merchant_logo[qr_data.sub_merchant_id]
            : "",
          // invoice: inv_response
          qr_image: await QRCode.toDataURL(qr_link_url + qr_data.qr_id),
        };

        payment_data = {
          merchant_id: qr_data.sub_merchant_id,
          emails: req.bodyString("emails"),
          description: req.bodyString("message"),
          currency: qr_data.currency,
          amount:
            qr_data.type_of_qr_code == "Static_QR"
              ? req.bodyString("amount")
              : qr_data.amount,
          // subject: req.bodyString("subject"),
          // message: req.bodyString('message'),
          sending_date: register_at,
          added_by: req.user.id,
        };

        // let mail_response = await mailSender.PaymentMail(data);
        // qrGenerateModule
        //     .addpayMail(payment_data)
        //     .then((result) => {
        //         res.status(statusCode.ok).send(
        //             response.successmsg("Mail sent successfully")
        //         );
        //     })
        //     .catch((error) => {
        //         res.status(statusCode.internalError).send(
        //             response.errormsg(error.message)
        //         );
        //     });

        mailEventEmitter.once("emailSent", () => {
          qrGenerateModule
            .addpayMail(payment_data)
            .then((result) => {
              res
                .status(statusCode.ok)
                .send(response.successmsg("Mail sent successfully"));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        });

        mailEventEmitter.once("emailError", (error) => {
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });

        mailEventEmitter.emit("email", { data });
      } else {
        let url = qr_data.sub_merchant_id
          ? await helpers.get_merchantdetails_url_by_id(qr_data.sub_merchant_id)
          : "";
        if (qr_data.is_expiry == 0) {
          let data = {
            id: await enc_dec.cjs_encrypt(id),
            qr_id: qr_data.qr_id,
            merchant_name: merchant_name[qr_data.sub_merchant_id]
              ? merchant_name[qr_data.sub_merchant_id]
              : "",
            message_text:
              req.bodyString("message") != ""
                ? '<b style="color: #263238 !important;">Description: ' +
                  req.bodyString("message") +
                  "</b>"
                : "",
            message:
              req.bodyString("message") != "" ? req.bodyString("message") : "",
            pay_url: qr_link_url + qr_data.qr_id,
            tc_url: url.link_tc ? url.link_tc : "",
            pp_url: url.link_pp ? url.link_pp : "",
            mail_to: req.bodyString("emails"),
            mail_cc: req.bodyString("cc_email")
              ? req.bodyString("cc_email")
              : "",
            currency: qr_data.currency,
            amount:
              qr_data.type_of_qr_code == "Static_QR"
                ? req.bodyString("amount")
                : qr_data.amount.toFixed(2),
            send_date: register_at,
            subject: req.bodyString("subject"),
            merchant_logo: merchant_logo[qr_data.sub_merchant_id]
              ? process.env.STATIC_URL +
                "/static/files/" +
                merchant_logo[qr_data.sub_merchant_id]
              : "",
            // invoice: inv_response
            qr_image: await QRCode.toDataURL(qr_link_url + qr_data.qr_id),
          };
          payment_data = {
            merchant_id: qr_data.sub_merchant_id,
            emails: req.bodyString("emails"),
            cc_email: req.bodyString("cc_email")
              ? req.bodyString("cc_email")
              : "",
            currency: qr_data.currency,
            amount:
              qr_data.type_of_qr_code == "Static_QR"
                ? req.bodyString("amount")
                : qr_data.amount,
            // subject: req.bodyString("subject"),
            // message: req.bodyString('message'),
            sending_date: register_at,
            added_by: req.user.id,
          };

          // let mail_response = await mailSender.PaymentMail(data);
          // qrGenerateModule
          //     .addpayMail(payment_data)
          //     .then((result) => {
          //         res.status(statusCode.ok).send(
          //             response.successmsg("Mail sent successfully")
          //         );
          //     })
          //     .catch((error) => {
          //         res.status(statusCode.internalError).send(
          //             response.errormsg(error.message)
          //         );
          //     });
          mailEventEmitter.once("emailSent", () => {
            qrGenerateModule
              .addpayMail(payment_data)
              .then((result) => {
                res
                  .status(statusCode.ok)
                  .send(response.successmsg("Mail sent successfully"));
              })
              .catch((error) => {
                winston.error(error);
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          });

          mailEventEmitter.once("emailError", (error) => {
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });

          mailEventEmitter.emit("email", { data });
        } else {
          let exp_date = moment(qr_data.end_date).format("YYYY-MM-DD");
          let date = moment().format("YYYY-MM-DD");
          if (exp_date < date) {
            res
              .status(statusCode.ok)
              .send(response.errormsg("Payment link expired."));
          } else {
            let data = {
              id: await enc_dec.cjs_encrypt(id),
              qr_id: qr_data.qr_id,
              merchant_name: merchant_name[qr_data.sub_merchant_id]
                ? merchant_name[qr_data.sub_merchant_id]
                : "",
              message: req.bodyString("message"),
              message_text:
                req.bodyString("message") != ""
                  ? '<b style="color: #263238 !important;">Description:</b>' +
                    req.bodyString("message")
                  : "",
              pay_url: qr_link_url + qr_data.qr_id,
              tc_url: url.link_tc ? url.link_tc : "",
              pp_url: url.link_pp ? url.link_pp : "",
              mail_to: req.bodyString("emails"),
              mail_cc: req.bodyString("cc_email"),
              currency: qr_data.currency,
              amount:
                qr_data.type_of_qr_code == "Static_QR"
                  ? req.bodyString("amount")
                  : qr_data.amount.toFixed(2),
              send_date: register_at,
              subject: req.bodyString("subject"),
              merchant_logo: merchant_logo[qr_data.sub_merchant_id]
                ? process.env.STATIC_URL +
                  "/static/files/" +
                  merchant_logo[qr_data.sub_merchant_id]
                : "",
              // invoice: inv_response
              qr_image: await QRCode.toDataURL(qr_link_url + qr_data.qr_id),
            };
            payment_data = {
              merchant_id: qr_data.sub_merchant_id,
              emails: req.bodyString("emails"),
              cc_email: req.bodyString("cc_email")
                ? req.bodyString("cc_email")
                : "",
              currency: qr_data.currency,
              amount:
                qr_data.type_of_qr_code == "Static_QR"
                  ? req.bodyString("amount")
                  : qr_data.amount.toFixed(2),
              // subject: req.bodyString("subject"),
              // message: req.bodyString('message'),
              sending_date: register_at,
              added_by: req.user.id,
            };

            // let mail_response = await mailSender.PaymentMail(data);
            // qrGenerateModule
            //     .addpayMail(payment_data)
            //     .then((result) => {
            //         res.status(statusCode.ok).send(
            //             response.successmsg(
            //                 "Mail sent successfully"
            //             )
            //         );
            //     })
            //     .catch((error) => {
            //         res.status(statusCode.internalError).send(
            //             response.errormsg(error.message)
            //         );
            //     });
            mailEventEmitter.once("emailSent", () => {
              qrGenerateModule
                .addpayMail(payment_data)
                .then((result) => {
                  res
                    .status(statusCode.ok)
                    .send(response.successmsg("Mail sent successfully"));
                })
                .catch((error) => {
                  winston.error(error);
                  res
                    .status(statusCode.internalError)
                    .send(response.errormsg(error.message));
                });
            });

            mailEventEmitter.once("emailError", (error) => {
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });

            mailEventEmitter.emit("email", { data });
          }
        }
      }
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id"));
    }
  },

  view_transaction: async (req, res) => {
    let id = req.bodyString("id");
    qrGenerateModule
      .selectTransactions({
        "qr.payment_id": id,
        "qr.payment_status": "Completed",
      })
      .then(async (result) => {
        let send_res = [];
        for (let val of result) {
          let res = {
            transactions_id: val.payment_id,
            order_id: val.order_no,

            merchant_name: await helpers.get_merchantdetails_name_by_id(
              val.merchant_id
            ),
            order_amount: val.currency + " " + val.amount.toFixed(2),
            order_currency: val.currency,
            customer_email: val.email,
            customer_mobile: "+" + val.code + " " + val.mobile,
            status: val.status,
            card_no: val.card_no ? "XXXX XXXX XXXX " + val.card_no : "-",
            payment_mode: val.payment_mode,
            transaction_date: moment(val.transaction_date).format(
              "DD-MM-YYYY H:mm:ss"
            ),
          };
          send_res.push(res);
        }

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "List fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  logs_list: async (req, res) => {
    try {
      const merchant_name = await qrGenerateModule.getMerchantName();
      let limit = {
        perpage: 0,
        page: 0,
      };
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));
        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }
      let type = "";
      let qr_type = req.bodyString("type");
      if (qr_type == "static") {
        type = "Static_QR";
        // type = "'" + "Static_QR" + "'";
      } else if (qr_type == "dynamic") {
        type = "Dynamic_QR";
        // type = "'" + "Dynamic_QR" + "'";
      }

      let search;

      search = {
        qr_id: id,
      };

      if (req.user.type == "merchant") {
        if (req.bodyString("selected_merchant") > 0) {
          search.sub_merchant_id = await enc_dec.cjs_decrypt(
            req.bodyString("selected_merchant")
          );
        }
      }

      if (req.bodyString("type")) {
        search.type_of_qr_code = type;
      }

      if (req.bodyString("currency")) {
        search.currency = `${req.bodyString("currency")}`;
      }

      if (req.bodyString("is_expired")) {
        search.is_expiry = req.bodyString("is_expired");
      }

      let status_condition = {};
      if (req.bodyString("status") === "Active") {
        status_condition.status = "Active";
      }
      if (req.bodyString("status") === "Deactivated") {
        status_condition.status = "Deactivated";
      }
      if (req.bodyString("status") === "Expired") {
        status_condition.status = "Expired";
      }
      // if (req.bodyString('type_of_qr')) { search.type_of_qr_code = type_of_qr }

      let date_condition = {};
      if (req.bodyString("from_date")) {
        date_condition.from_date = req.bodyString("from_date");
      }
      if (req.bodyString("to_date")) {
        date_condition.to_date = req.bodyString("to_date");
      }

      const like_condition = { description: "" };
      if (req.bodyString("description")) {
        like_condition.description = req.bodyString("description");
      }
      let amount_condition = {};

      let result = await qrGenerateModule.select_qr_logs(
        search,
        limit,
        like_condition,
        date_condition,
        status_condition,
        amount_condition
      );
      let send_res = [];

      for (val of result) {
        let res;
        if (val.type_of_qr_code == "Static_QR") {
          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select("order_no")
              .where({ payment_id: val.qr_id })
              .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");
          let status = await helpers.getQRStatus(val.qr_id);
          let reset_status = await helpers.getQRReset(val.qr_id);
          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),
            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            order_no: order_ids ? order_ids : "",
            currency: val.currency,
            currency_symbol: await helpers.get_currency_symbol_by_currency_code(
              val.currency
            ),
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            status: status == 1 ? "Deactivated" : "Active",
            is_reseted: reset_status,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
            payment_link: qr_link_url + val.qr_id,

            de_qr_id: val?.qr_id ? await helpers.formatNumber(val?.qr_id) : "",
            created_by:
              val.activity == "Created"
                ? await helpers.get_admin_name_by_id(val.created_by)
                : await helpers.get_super_merchant_name(val.created_by),
            logs_activity: val.activity,
          };
        } else if (val.type_of_qr_code == "Dynamic_QR") {
          let count_payment = await qrGenerateModule.get_count_payment({
            merchant_qr_id: val.id,
            type_of_qr_code: "'Dynamic_QR'",
          });
          let day = moment().format("YYYY-MM-DD");

          let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

          let qb = await pool.get_connection();
          let needed_info;
          try {
            needed_info = await qb
              .select_sum("quantity")
              .select_sum("total_amount")
              .select("order_no")
              .where({
                payment_id: val.qr_id,
                payment_status: "CAPTURED",
              })
              .get(config.table_prefix + "qr_payment");
          } catch (error) {
            console.error("Database query failed:", error);
          } finally {
            qb.release();
          }

          const order_ids = needed_info.map((item) => item.order_no).join(",");

          let status = await helpers.getQRStatus(val.qr_id);
          res = {
            id: await enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.sub_merchant_id),

            sub_merchant_name: merchant_name[val.sub_merchant_id]
              ? merchant_name[val.sub_merchant_id]
              : "",
            sub_merchant_logo: (await qrGenerateModule.getSubMerchantlogo(
              val.sub_merchant_id
            ))
              ? server_addr +
                "/static/files/" +
                (await qrGenerateModule.getSubMerchantlogo(val.sub_merchant_id))
              : "",
            merchant_name: await helpers.get_super_merchant_name(
              val.merchant_id
            ),
            currency: val.currency,
            order_no: order_ids ? order_ids : "",
            type_of_qr: val.type_of_qr_code,
            qr_id: val.qr_id,
            qr_url: datalink,
            quantity: val.quantity,
            amount: val.amount,
            no_of_collection: val.no_of_collection,
            collection_done: count_payment,
            payment_link: qr_link_url + val.qr_id,
            is_expiry: val.is_expiry,
            start_date: moment(val.start_date).format("DD-MM-YYYY"),
            end_date:
              val.is_expiry == 0
                ? ""
                : moment(val.end_date).format("DD-MM-YYYY"),
            expiry_status:
              val.is_expiry == 1
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Not Expired"
                : "No expiry date",
            status: status,
            final_status:
              val.is_expiry === 1 && status === 0
                ? moment(val.end_date).format("YYYY-MM-DD") < day
                  ? "Expired"
                  : "Active"
                : val.is_expiry === 1 && status === 1
                ? "Deactivated"
                : val.is_expiry === 0 && status === 0
                ? "Active"
                : "Deactivated",

            total_collection: val.total_collection,
            overall_qty_allowed: val.overall_qty_allowed,
            qty_frq: val.qty_frq,
            description: val.description,
            total_amount_paid: needed_info[0].total_amount
              ? needed_info[0].total_amount
              : 0.0,
            total_quantity_paid: needed_info[0].quantity
              ? needed_info[0].quantity
              : 0,
            created_at: await date_formatter.get_date_time(val.created_at),
            updated_at: await date_formatter.get_date_time(val.updated_at),
            de_qr_id: val?.qr_id ? await helpers.formatNumber(val?.qr_id) : "",
            created_by: val.created_by
              ? await helpers.get_super_merchant_name(val.created_by)
              : "",
            logs_activity: val.activity,
          };
        }
        send_res.push(res);
      }

      let total_count = await qrGenerateModule.get_count_all_logs_conditions(
        search,
        like_condition,
        date_condition,
        status_condition,
        amount_condition
      );
      res
        .status(statusCode.ok)
        .send(
          response.successdatamsg(
            send_res,
            "List fetched successfully.",
            total_count
          )
        );
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_paymentLink_add: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let start_date = moment().format("YYYY-MM-DD");
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "test";
    } else {
      mode = "live";
    }
    let no_of_transactions_per_user = req.body.no_of_transactions_per_user;
    let total_quantity_allowed = req.body.total_quantity_allowed;
    let link_expiry = req.body.link_expiry;
    let amount = req.body.amount;
    const uuid = new SequenceUUID({
      valid: true,
      dashes: false,
      unsafeBuffer: true,
    });
    let qr_id = uuid.generate();

    let data_link = {
      sub_merchant_id: req.credentials.merchant_id,
      merchant_id: req.credentials.super_merchant_id,
      qr_id: qr_id,
      currency: amount.currency,
      quantity: req.bodyString("no_quantity_per_transaction"),
      amount: amount.value,
      no_of_collection:
        no_of_transactions_per_user.no_limit == "yes"
          ? 9999999
          : no_of_transactions_per_user.quantity,
      total_collection: no_of_transactions_per_user.frequency,
      overall_qty_allowed:
        total_quantity_allowed.no_limit == "yes"
          ? 9999999
          : total_quantity_allowed.quantity,
      qty_frq: total_quantity_allowed.frequency,
      start_date: start_date,
      end_date: link_expiry.end_date,
      is_expiry: link_expiry.is_expiry == "yes" ? 1 : 0,
      description: req.bodyString("description"),
      created_at: register_at,
      updated_at: register_at,
      error_message: req.bodyString("error_msg"),
      created_by: req.credentials.super_merchant_id,
      mode: mode,
    };

    qrGenerateModule
      .add(data_link)
      .then(async (result) => {
        let de_qr_id = helpers.formatNumber(result.insertId);
        let link_d = await encrypt_decrypt("encrypt", result.insertId);
        let logs_data = {
          sub_merchant_id: req.credentials.merchant_id,
          merchant_id: req.credentials.super_merchant_id,
          qr_id: result.insertId,
          currency: amount.currency,
          quantity: req.bodyString("no_quantity_per_transaction"),
          amount: amount.value,
          no_of_collection:
            no_of_transactions_per_user.no_limit == "yes"
              ? 9999999
              : no_of_transactions_per_user.quantity,
          total_collection: no_of_transactions_per_user.frequency,
          overall_qty_allowed:
            total_quantity_allowed.no_limit == "yes"
              ? 9999999
              : total_quantity_allowed.quantity,
          qty_frq: total_quantity_allowed.frequency,
          start_date: start_date,
          end_date: link_expiry.end_date,
          is_expiry: link_expiry.is_expiry == "yes" ? 1 : 0,
          description: req.bodyString("description"),
          type_of_qr_code: "Dynamic_QR",
          created_at: register_at,
          updated_at: register_at,
          error_message: req.bodyString("error_msg"),
          activity: "Created",
          created_by: req.credentials.super_merchant_id,
        };
        let qr_logs = await qrGenerateModule.add_logs(logs_data);
        qrGenerateModule
          .selectOne({ id: result.insertId })
          .then(async (result) => {
            let payment_link = qr_link_url + result.qr_id;
            let data_id = result.qr_id;
            let data1 = { payment_link: payment_link };
            QRCode.toDataURL(payment_link, (err, data) => {
              if (err) {
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(err));
              }
              res
                .status(statusCode.ok)
                .send(
                  response.success_payLinkmsg(
                    data,
                    payment_link,
                    "Payment link generated successfully",
                    data_id,
                    de_qr_id
                  )
                );
            });
          })
          .catch((error) => {
            winston.error(error);
            res
              .status(statusCode.internalError)
              .send(response.errormsg(error.message));
          });
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_paymentLink_update: async (req, res) => {
    let register_at = moment().format("YYYY-MM-DD HH:mm:ss");
    let start_date = moment().format("YYYY-MM-DD");
    let mode = "";
    if (req.credentials.type == "test") {
      mode = "test";
    } else {
      mode = "live";
    }
    let no_of_transactions_per_user = req.body.no_of_transactions_per_user;
    let total_quantity_allowed = req.body.total_quantity_allowed;
    let link_expiry = req.body.link_expiry;
    let amount = req.body.amount;

    let data_link = {
      sub_merchant_id: req.credentials.merchant_id,
      merchant_id: req.credentials.super_merchant_id,
      currency: amount.currency,
      quantity: req.bodyString("no_quantity_per_transaction"),
      amount: amount.value,
      no_of_collection:
        no_of_transactions_per_user.no_limit == "yes"
          ? 9999999
          : no_of_transactions_per_user.quantity,
      total_collection: no_of_transactions_per_user.frequency,
      overall_qty_allowed:
        total_quantity_allowed.no_limit == "yes"
          ? 9999999
          : total_quantity_allowed.quantity,
      qty_frq: total_quantity_allowed.frequency,
      start_date: start_date,
      end_date: link_expiry.end_date,
      is_expiry: link_expiry.is_expiry == "yes" ? 1 : 0,
      description: req.bodyString("description"),
      updated_at: register_at,
      error_message: req.bodyString("error_msg"),
      created_by: req.credentials.super_merchant_id,
      mode: mode,
    };

    qrGenerateModule
      .updateDetails({ qr_id: req.body.data_id }, data_link)
      .then(async (result) => {
        let logs_data = {
          qr_id: await helpers.getQRID(req.bodyString("data_id")),
          sub_merchant_id: req.credentials.merchant_id,
          merchant_id: req.credentials.super_merchant_id,
          currency: amount.currency,
          quantity: req.bodyString("no_quantity_per_transaction"),
          amount: amount.value,
          no_of_collection:
            no_of_transactions_per_user.no_limit == "yes"
              ? 9999999
              : no_of_transactions_per_user.quantity,
          total_collection: no_of_transactions_per_user.frequency,
          overall_qty_allowed:
            total_quantity_allowed.no_limit == "yes"
              ? 9999999
              : total_quantity_allowed.quantity,
          qty_frq: total_quantity_allowed.frequency,
          start_date: start_date,
          end_date: link_expiry.end_date,
          is_expiry: link_expiry.is_expiry == "yes" ? 1 : 0,
          description: req.bodyString("description"),
          type_of_qr_code: "Dynamic_QR",
          created_at: register_at,
          updated_at: register_at,
          error_message: req.bodyString("error_msg"),
          activity: "Updated",
          created_by: req.credentials.super_merchant_id,
        };
        let qr_logs = await qrGenerateModule.add_logs(logs_data);

        let payment_link = qr_link_url + req.bodyString("data_id");
        let data_id = req.bodyString("data_id");
        let data1 = { payment_link: payment_link };

        QRCode.toDataURL(payment_link, (err, data) => {
          if (err) {
            res.status(statusCode.internalError).send(response.errormsg(err));
          }
          res
            .status(statusCode.ok)
            .send(
              response.success_payLinkmsg(
                data,
                payment_link,
                "Payment link updated successfully"
              )
            );
        });
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  open_paymentLink_list: async (req, res) => {
    const merchant_name = await qrGenerateModule.getMerchantName();
    let limit = {
      perpage: 0,
      page: 0,
    };
    if (req.queryString("perpage") && req.queryString("page")) {
      perpage = parseInt(req.queryString("perpage"));
      start = parseInt(req.queryString("page"));
      limit.perpage = perpage;
      limit.start = (start - 1) * perpage;
    }

    let search = {
      is_reseted: 0,
      merchant_id: req.credentials.super_merchant_id,
      sub_merchant_id: req.credentials.merchant_id,
      type_of_qr_code: "Dynamic_QR",
      mode: req.credentials.type,
    };

    if (req.queryString("is_expiry")) {
      search.is_expiry = req.queryString("is_expiry") == "yes" ? 1 : 0;
    }

    if (req.queryString("currency")) {
      search.currency = `${req.queryString("currency")}`;
    }

    let status_condition = {};
    if (req.queryString("status")) {
      status_condition.status = req.queryString("status");
    }

    // if (req.bodyString('type_of_qr')) { search.type_of_qr_code = type_of_qr }
    let date_condition = {};
    if (req.queryString("from_date")) {
      date_condition.from_date = req.queryString("expiry_from_date");
    }
    if (req.queryString("to_date")) {
      date_condition.to_date = req.queryString("expiry_to_date");
    }

    const like_condition = { description: "" };
    if (req.queryString("description")) {
      like_condition.description = req.queryString("description");
    }

    // let amount_condition = {};
    // if (req.bodyString("amount_condition") && req.bodyString("amount")) {
    //     amount_condition.condition = req.bodyString("amount_condition");
    //     amount_condition.amount = req.bodyString("amount");
    // }

    let amount_condition = {};
    if (req.queryString("amount_condition") && req.queryString("amount")) {
      let symbol_name = req.queryString("amount_condition");

      if (symbol_name === "equal_to") {
        amount_condition.condition = "=";
      } else if (symbol_name === "greater_then") {
        amount_condition.condition = ">";
      } else if (symbol_name === "less_then") {
        amount_condition.condition = "<";
      } else if (symbol_name === "greater_then_equal") {
        amount_condition.condition = ">=";
      } else if (symbol_name === "less_then_equal") {
        amount_condition.condition = "<=";
      }
      // amount_condition.condition = req.bodyString("amount_condition");
      amount_condition.amount = req.queryString("amount");
    }

    let result = await qrGenerateModule.select_qr_list(
      search,
      limit,
      like_condition,
      date_condition,
      status_condition,
      amount_condition
    );

    let send_res = [];
    for (val of result) {
      let res;
      if (val.type_of_qr_code === "Dynamic_QR") {
        let de_qr_id = helpers.formatNumber(val.id);

        let count_payment = await qrGenerateModule.get_count_payment({
          merchant_qr_id: val.id,
          type_of_qr_code: "'Dynamic_QR'",
        });
        let day = moment().format("YYYY-MM-DD");
        let datalink = await QRCode.toDataURL(qr_link_url + val.qr_id);

        let needed_info;
        let qb = await pool.get_connection();
        try {
          needed_info = await qb
            .select("order_no")
            .where({ payment_id: val.qr_id })
            .get(config.table_prefix + "qr_payment");
        } catch (error) {
          console.error("Database query failed:", error);
        } finally {
          qb.release();
        }

        const order_ids = needed_info.map((item) => item.order_no).join(",");

        res = {
          data_id: val.qr_id,
          link_id: de_qr_id,
          amount: {
            currency: val.currency,
            value: val.amount,
          },
          no_quantity_per_transaction: val.quantity,
          no_of_transactions_per_user: {
            no_limit: val.no_of_collection == 9999999 ? "yes" : "no",
            frequency: val.total_collection,
            quantity:
              val.no_of_collection == 9999999
                ? "No Limit"
                : val.no_of_collection,
          },
          total_quantity_allowed: {
            no_limit: val.overall_qty_allowed == 9999999 ? "yes" : "no",
            frequency: val.qty_frq,
            quantity:
              val.overall_qty_allowed == 9999999
                ? "No Limit"
                : val.overall_qty_allowed,
          },

          link_expiry: {
            start_date: moment(val.start_date).format("DD-MM-YYYY"),
            is_expiry: val.is_expiry == "0" ? "no" : "yes",
            end_date:
              val.is_expiry == 0
                ? "No expiry"
                : moment(val.end_date).format("YYYY-MM-DD"),
          },
          payment_link: qr_link_url + val.qr_id,
          expiry_status:
            val.is_expiry == 1
              ? moment(val.end_date).format("YYYY-MM-DD") < day
                ? "Expired"
                : "Not Expired"
              : "No expiry date",
          status: val.status == 1 ? "Deactivated" : "Active",
          final_status:
            val.is_expiry === 1 && val.status === 0
              ? moment(val.end_date).format("YYYY-MM-DD") < day
                ? "Expired"
                : "Active"
              : val.is_expiry === 1 && val.status === 1
              ? "Deactivated"
              : val.is_expiry === 0 && val.status === 0
              ? "Active"
              : "Deactivated",
          qr_code: datalink,
          description: val.description,
          error_msg: val.error_message,
          created_at: moment(val.created_at).format("DD-MM-YYYY HH:mm:ss"),
          updated_at: moment(val.updated_at).format("DD-MM-YYYY HH:mm:ss"),
        };
      }
      send_res.push(res);
    }

    let total_count = await qrGenerateModule.get_count_all_conditions(
      search,
      like_condition,
      date_condition,
      status_condition,
      amount_condition
    );
    res
      .status(statusCode.ok)
      .send(
        response.successdatamsg(
          send_res,
          "List fetched successfully.",
          total_count
        )
      );
  },
  open_deactivate: async (req, res) => {
    try {
      let id = req.bodyString("data_id");
      let find_data = await qrGenerateModule.selectOne({ qr_id: id });
      let date = moment().format("YYYY-MM-DD HH:mm:ss");

      var insdata = {
        status: 1,
      };
      $ins_id = await qrGenerateModule
        .updateDetails({ qr_id: id }, insdata)
        .then(async (result) => {
          let logs_data = {
            merchant_id: find_data.merchant_id,
            sub_merchant_id: find_data.sub_merchant_id,
            qr_id: await helpers.getQRID(id),
            currency: find_data.currency,
            quantity: find_data.quantity,
            amount: find_data.amount,
            no_of_collection: find_data.no_of_collection,
            total_collection: find_data.total_collection,
            overall_qty_allowed: find_data.overall_qty_allowed,
            qty_frq: find_data.qty_frq,
            start_date: moment(find_data.start_date).format("YYYY-MM-DD"),
            end_date: moment(find_data.end_date).format("YYYY-MM-DD"),
            is_expiry: find_data.is_expiry,
            description: find_data.description,
            type_of_qr_code: find_data.type_of_qr_code,
            created_at: date,
            updated_at: date,
            error_message: find_data.error_msg,
            created_by: req.credentials.super_merchant_id,
            activity: "Deactivated",
          };
          let qr_logs = await qrGenerateModule.add_logs(logs_data);
          res
            .status(statusCode.ok)
            .send(response.successmsg("Payment link deactivated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_activate: async (req, res) => {
    try {
      let id = req.bodyString("data_id");
      let find_data = await qrGenerateModule.selectOne({ qr_id: id });
      let date = moment().format("YYYY-MM-DD HH:mm:ss");

      var insdata = {
        status: 0,
      };
      $ins_id = await qrGenerateModule
        .updateDetails({ qr_id: id }, insdata)
        .then(async (result) => {
          let logs_data = {
            merchant_id: find_data.merchant_id,
            sub_merchant_id: find_data.sub_merchant_id,
            qr_id: await helpers.getQRID(id),
            currency: find_data.currency,
            quantity: find_data.quantity,
            amount: find_data.amount,
            no_of_collection: find_data.no_of_collection,
            total_collection: find_data.total_collection,
            overall_qty_allowed: find_data.overall_qty_allowed,
            qty_frq: find_data.qty_frq,
            start_date: moment(find_data.start_date).format("YYYY-MM-DD"),
            end_date: moment(find_data.end_date).format("YYYY-MM-DD"),
            is_expiry: find_data.is_expiry,
            description: find_data.description,
            type_of_qr_code: find_data.type_of_qr_code,
            created_at: date,
            updated_at: date,
            error_message: find_data.error_msg,
            created_by: req.credentials.super_merchant_id,
            activity: "Deactivated",
          };
          let qr_logs = await qrGenerateModule.add_logs(logs_data);
          res
            .status(statusCode.ok)
            .send(response.successmsg("Payment link activated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  open_paymentLink_details: async (req, res) => {
    let qr_id = req.queryString("data_id");

    result = await qrGenerateModule.selectOne({
      qr_id: qr_id,
      is_reseted: 0,
      is_expired: 0,
    });

    let resp;
    let send_res;
    if (result) {
      let id = result.id;
      let de_qr_id = helpers.formatNumber(id);

      let payment_list = await qrGenerateModule.list_of_paymentLinks(
        {
          merchant_qr_id: result.id,
        },
        req.credentials.type
      );

      count_payment = await qrGenerateModule.get_count_payment({
        merchant_qr_id: id,
        type_of_qr_code: "'Dynamic_QR'",
        payment_status: "'completed'",
      });
      let datalink = await QRCode.toDataURL(qr_link_url + result.qr_id);
      resp = {
        data_id: result.qr_id,
        link_id: de_qr_id,
        amount: {
          currency: result.currency,
          value: result.amount,
        },
        no_quantity_per_transaction: result.quantity,
        no_of_transactions_per_user: {
          no_limit: result.no_of_collection == 9999999 ? "yes" : "no",
          frequency: result.total_collection,
          quantity:
            result.no_of_collection == 9999999
              ? "No Limit"
              : result.no_of_collection,
        },
        total_quantity_allowed: {
          no_limit: result.overall_qty_allowed == 9999999 ? "yes" : "no",
          frequency: result.qty_frq,
          quantity:
            result.overall_qty_allowed == 9999999
              ? "No Limit"
              : result.overall_qty_allowed,
        },
        link_expiry: {
          is_expiry: result.is_expiry == "0" ? "no" : "yes",
          end_date:
            result.is_expiry == 0
              ? "No expiry"
              : moment(result.end_date).format("YYYY-MM-DD"),
        },
        payment_link: qr_link_url + result.qr_id,
        // start_date: moment(result.start_date).format("DD-MM-YYYY"),
        description: result.description,
        error_msg: result.error_message,
        status: result.status == 1 ? "Deactivated" : "Activated",
        payment_list: payment_list,
        qr_code: datalink,
      };

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(resp, "Details fetched successfully."));
    } else {
      res
        .status(statusCode.internalError)
        .send(response.errormsg("Invalid id."));
    }
  },
  open_view_static_qr:async(req,res)=>{
    console.log(req.credentials);
    let result = await qrGenerateModule.selectOpenStaticQR({
      'qr.deleted':0,
      'qr.status':0,
      'qr.is_reseted':0,
      // 'qr.merchant_id':req.credentials.super_merchant_id,
      'qr.sub_merchant_id':req.credentials.merchant_id,
      'qr.type_of_qr_code':"Static_QR",
      "qr.mode":req.credentials.type,
      'mid.status':0,
      'mid.deleted':0
    },'merchant_qr_codes','mid');
    if(result.length>0){
      let data = [];
      for(let row of result){
        let obj = {
          payment_link:process.env.QR_PAY_URL+row.qr_id,
          qr_code: await QRCode.toDataURL(qr_link_url + row.qr_id)
        }
        data.push(obj);
      }
      res
      .status(statusCode.ok)
      .send(response.successdatamsg(data, "Details fetched successfully."));
    }else{
      res
      .status(statusCode.ok)
      .send(response.successdatamsg(result, "Mid is not added."));
    }
   
  }
};

module.exports = qr_generate;
