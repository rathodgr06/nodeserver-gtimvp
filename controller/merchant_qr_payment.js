const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const encrypt_decrypt = require('../utilities/decryptor/encrypt_decrypt');
const helpers = require("../utilities/helper/general_helper");
const qrGenerateModule = require("../models/qrGenerateModule");
const enc_dec = require("../utilities/decryptor/decryptor");
const SequenceUUID = require('sequential-uuid');
const QRCode = require('qrcode');
require('dotenv').config({ path: "../.env" });
const moment = require('moment');
const logger = require('../config/logger');

const qr_payment = {
   add: async (req, res) => {
      let date =moment().format('YYYY-MM-DD');
      let id = await enc_dec.cjs_decrypt(req.bodyString("id"));
      let find_data = await qrGenerateModule.selectOne({ id: id });
      let count_payment;
      let per_day_count;
      per_day_count = await qrGenerateModule.get_count_payment({
         'merchant_qr_id': id,
         'type_of_qr_code': "'Dynamic_QR'",
         'payment_status': "'completed'",
         'transaction_date': "'" + date + "'",
      })
      count_payment = await qrGenerateModule.get_count_payment({
         'merchant_qr_id': id,
         'type_of_qr_code': "'Dynamic_QR'",
         'payment_status': "'completed'",

      })


      const merchant_name = await qrGenerateModule.getMerchantName();
      const uuid = new SequenceUUID({
         valid: true,
         dashes: false,
         unsafeBuffer: true
      })
      let payment_id = uuid.generate();
      let end = find_data.end_date.toISOString().slice(0, 10);
      if (find_data.is_expiry == '1') {
         if (end < date) {
            res.status(statusCode.internalError).send(response.errormsg("QR/Link is expired."));
         } else {
            if (find_data) {
               if (find_data.type_of_qr_code == 'Static_QR') {
                  if (find_data.is_reseted == 1) {
                     res.status(statusCode.internalError).send(response.errormsg("QR is reseated."));
                  }
                  else {
                     if (find_data.status == 1) {
                        res.status(statusCode.internalError).send(response.errormsg("QR is deactivated."));
                     }
                     else {
                        let amount = req.bodyString("amount");
                        let qr_data = {
                           merchant_qr_id: find_data.id,
                           order_no: await helpers.make_order_number("ORD"),
                           name: req.bodyString("name"),
                           email: req.bodyString("email"),
                           currency: find_data.currency,
                           payment_status: "created",
                           type_of_qr_code: find_data.type_of_qr_code,
                           amount: amount,
                        }
                        
                        if (qr_data.amount == "") {
                           res.status(statusCode.ok).send(response.successmsg('Valid amount required.'))
                        } else {
                           qrGenerateModule.add_collection(qr_data).then(async (result) => {

                              qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                 let qr_pay = {
                                    "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                    "order_no": rtl.order_no,
                                    "name": rtl.name,
                                    "email": rtl.email,
                                    "amount": rtl.amount,
                                    "currency": rtl.currency,
                                    "payment_status": rtl.payment_status,
                                 }
                                 res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                                 res.status(statusCode.internalError).send(response.errormsg(error.message));
                              }).catch((error) => {
                                logger.error(500,{message: error,stack: error.stack}); 
                              })
                              // res.status(statusCode.ok).send(response.successmsg('Payment order created successfully.'))
                              res.status(statusCode.internalError).send(response.errormsg(error.message));
                           }).catch((error) => {
                             logger.error(500,{message: error,stack: error.stack}); 
                           })
                        }
                     }
                  }
               }
               else if (find_data.type_of_qr_code == 'Dynamic_QR') {
                  let date =moment().format('YYYY-MM-DD');
                  let email = req.bodyString("email");
                  let exp_date = find_data.end_date.toISOString().slice(0, 10);
                  let count_per_user;
                  if (find_data.is_expiry == 1) {
                     exp = find_data.end_date.toISOString().slice(0, 10);
                     if (find_data.qty_frq == "till_expiry") {
                        count_payment = await qrGenerateModule.get_count_payment_with_exp({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                        }, exp)

                        count_per_user = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'email': "'" + email + "'"
                        })
                     }
                     else {
                        count_payment = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'transaction_date': "'" + date + "'",
                        })
                        count_per_user = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'email': "'" + email + "'"
                        })
                     }
                  }
                  else {
                     if (find_data.qty_frq == "till_expiry") {
                        count_payment = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                        })
                        count_per_user = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'email': "'" + email + "'"
                        })
                     }
                     else {
                        count_payment = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'transaction_date': "'" + date + "'",
                        })

                        count_per_user = await qrGenerateModule.get_count_payment({
                           'merchant_qr_id': id,
                           'type_of_qr_code': "'Dynamic_QR'",
                           'payment_status': "'completed'",
                           'email': "'" + email + "'"
                        })
                     }
                  }
                  if (find_data.qty_frq == "per_day") {
                     if (find_data.overall_qty_allowed > count_payment) {
                        if (find_data.no_of_collection > count_per_user) {

                           if (find_data.is_expiry == 0) {
                              if (find_data.status == 1) {
                                 res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                              } else {
                                 let quantity = req.bodyString("quantity");
                                 let qr_data = {
                                    merchant_qr_id: find_data.id,
                                    order_no: await helpers.make_order_number("ORD"),
                                    name: req.bodyString("name"),
                                    email: email,
                                    payment_status: "created",
                                    type_of_qr_code: find_data.type_of_qr_code,
                                    amount: find_data.amount,
                                    currency: find_data.currency,
                                    quantity: quantity,
                                    // total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                                 }
                                 
                                 qrGenerateModule.add_collection(qr_data).then(async (result) => {

                                    qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                       let qr_pay = {
                                          "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                          "order_no": rtl.order_no,
                                          "name": rtl.name,
                                          "email": rtl.email,
                                          "amount": rtl.amount,
                                          "currency": rtl.currency,
                                          "payment_status": rtl.payment_status,
                                       }
                                       res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                                    }).catch((error) => {
                                      logger.error(500,{message: error,stack: error.stack}); 
                                       res.status(statusCode.internalError).send(response.errormsg(error.message));
                                    })
                                 }).catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                                 })

                              }
                           }
                           else {
                              if (exp_date >= date) {

                                 if (find_data.status == 1) {
                                    res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                                 } else {

                                    let quantity = req.bodyString("quantity");
                                    let qr_data = {
                                       merchant_qr_id: find_data.id,
                                       order_no: await helpers.make_order_number("ORD"),
                                       name: req.bodyString("name"),
                                       email: req.bodyString("email"),
                                       payment_status: "created",
                                       type_of_qr_code: find_data.type_of_qr_code,
                                       amount: find_data.amount,
                                       currency: find_data.currency,
                                       quantity: quantity,
                                       total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                                    }

                                    qrGenerateModule.add_collection(qr_data).then(async (result) => {
                                       qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                          let qr_pay = {
                                             "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                             "order_no": rtl.order_no,
                                             "name": rtl.name,
                                             "email": rtl.email,
                                             "amount": rtl.amount,
                                             "currency": rtl.currency,
                                             "payment_status": rtl.payment_status,
                                          }
                                          res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                                       }).catch((error) => {
                                         logger.error(500,{message: error,stack: error.stack}); 
                                          res.status(statusCode.internalError).send(response.errormsg(error.message));
                                       })


                                    }).catch((error) => {
                                      logger.error(500,{message: error,stack: error.stack}); 
                                       res.status(statusCode.internalError).send(response.errormsg(error.message));
                                    })

                                 }
                              }
                              else {
                                 res.status(statusCode.internalError).send(response.errormsg("QR link is expired."));
                              }
                           }
                        } else {
                           res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per user collection out of range."));
                        }
                     } else {
                        res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per day collection limit expired.", per_day_count, count_payment));
                     }
                  }
                  else {
                     if (find_data.overall_qty_allowed > count_payment) {
                        if (find_data.no_of_collection > count_per_user) {
                           if (find_data.status == 1) {
                              res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                           } else {
                              let quantity = req.bodyString("quantity");
                              let qr_data = {
                                 merchant_qr_id: find_data.id,
                                 order_no: await helpers.make_order_number("ORD"),
                                 name: req.bodyString("name"),
                                 email: email,
                                 payment_status: "created",
                                 type_of_qr_code: find_data.type_of_qr_code,
                                 amount: find_data.amount,
                                 currency: find_data.currency,
                                 quantity: quantity,
                                 total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                              }
                              qrGenerateModule.add_collection(qr_data).then(async (result) => {

                                 qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                    let qr_pay = {
                                       "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                       "order_no": rtl.order_no,
                                       "name": rtl.name,
                                       "email": rtl.email,
                                       "amount": rtl.amount,
                                       "currency": rtl.currency,
                                       "payment_status": rtl.payment_status,
                                    }
                                    res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                                 }).catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                                 })
                              }).catch((error) => {
                                logger.error(500,{message: error,stack: error.stack}); 
                                 res.status(statusCode.internalError).send(response.errormsg(error.message));
                              })

                           }
                        }
                        else {
                           res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per user collection out of range."));
                        }
                     } else {
                        res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Overall QR payment collection limit is expired.", per_day_count, count_payment));
                     }
                  }
               }
            }
            else {
               res.status(statusCode.internalError).send(response.errormsg("Invalid ID"));
            }
         }
      }
      if (find_data) {
         if (find_data.type_of_qr_code == 'Static_QR') {
            if (find_data.is_reseted == 1) {
               res.status(statusCode.internalError).send(response.errormsg("QR is reseated."));
            }
            else {
               if (find_data.status == 1) {
                  res.status(statusCode.internalError).send(response.errormsg("QR is deactivated."));
               }
               else {
                  let amount = req.bodyString("amount");
                  let qr_data = {
                     merchant_qr_id: find_data.id,
                     order_no: await helpers.make_order_number("ORD"),
                     name: req.bodyString("name"),
                     email: req.bodyString("email"),
                     currency: find_data.currency,
                     payment_status: "created",
                     type_of_qr_code: find_data.type_of_qr_code,
                     amount: amount,
                  }
                  
                  if (qr_data.amount == "") {
                     res.status(statusCode.ok).send(response.successmsg('Valid amount required.'))
                  } else {
                     qrGenerateModule.add_collection(qr_data).then(async (result) => {

                        qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                           let qr_pay = {
                              "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                              "order_no": rtl.order_no,
                              "name": rtl.name,
                              "email": rtl.email,
                              "amount": rtl.amount,
                              "currency": rtl.currency,
                              "payment_status": rtl.payment_status,
                           }
                           res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                        }).catch((error) => {
                          logger.error(500,{message: error,stack: error.stack}); 
                           res.status(statusCode.internalError).send(response.errormsg(error.message));
                        })
                        // res.status(statusCode.ok).send(response.successmsg('Payment order created successfully.'))
                     }).catch((error) => {
                       logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(response.errormsg(error.message));
                     })
                  }
               }
            }
         }
         else if (find_data.type_of_qr_code == 'Dynamic_QR') {
            let date = moment().format('YYYY-MM-DD');
            let email = req.bodyString("email");
            let exp_date = find_data.end_date.toISOString().slice(0, 10);
            let count_per_user;
            if (find_data.is_expiry == 1) {
               exp = find_data.end_date.toISOString().slice(0, 10);
               if (find_data.qty_frq == "till_expiry") {
                  count_payment = await qrGenerateModule.get_count_payment_with_exp({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                  }, exp)

                  count_per_user = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'email': "'" + email + "'"
                  })
               }
               else {
                  count_payment = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'transaction_date': "'" + date + "'",
                  })
                  count_per_user = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'email': "'" + email + "'"
                  })
               }
            }
            else {
               if (find_data.qty_frq == "till_expiry") {
                  count_payment = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                  })
                  count_per_user = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'email': "'" + email + "'"
                  })
               }
               else {
                  count_payment = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'transaction_date': "'" + date + "'",
                  })

                  count_per_user = await qrGenerateModule.get_count_payment({
                     'merchant_qr_id': id,
                     'type_of_qr_code': "'Dynamic_QR'",
                     'payment_status': "'completed'",
                     'email': "'" + email + "'"
                  })
               }
            }
            if (find_data.qty_frq == "per_day") {
               if (find_data.overall_qty_allowed > count_payment) {
                  if (find_data.no_of_collection > count_per_user) {

                     if (find_data.is_expiry == 0) {
                        if (find_data.status == 1) {
                           res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                        } else {
                           let quantity = req.bodyString("quantity");
                           let qr_data = {
                              merchant_qr_id: find_data.id,
                              order_no: await helpers.make_order_number("ORD"),
                              name: req.bodyString("name"),
                              email: email,
                              payment_status: "created",
                              type_of_qr_code: find_data.type_of_qr_code,
                              amount: find_data.amount,
                              currency: find_data.currency,
                              quantity: quantity,
                              total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                           }
                           
                           qrGenerateModule.add_collection(qr_data).then(async (result) => {

                              qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                 let qr_pay = {
                                    "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                    "order_no": rtl.order_no,
                                    "name": rtl.name,
                                    "email": rtl.email,
                                    "amount": rtl.amount,
                                    "currency": rtl.currency,
                                    "payment_status": rtl.payment_status,
                                    "today_collection": per_day_count,
                                    "total_collection": count_payment,
                                 }
                                 res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                              }).catch((error) => {
                                logger.error(500,{message: error,stack: error.stack}); 
                                 res.status(statusCode.internalError).send(response.errormsg(error.message));
                              })
                           }).catch((error) => {
                             logger.error(500,{message: error,stack: error.stack}); 
                              res.status(statusCode.internalError).send(response.errormsg(error.message));
                           })

                        }
                     }
                     else {
                        if (exp_date >= date) {

                           if (find_data.status == 1) {
                              res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                           } else {

                              let quantity = req.bodyString("quantity");
                              let qr_data = {
                                 merchant_qr_id: find_data.id,
                                 order_no: await helpers.make_order_number("ORD"),
                                 name: req.bodyString("name"),
                                 email: req.bodyString("email"),
                                 payment_status: "created",
                                 type_of_qr_code: find_data.type_of_qr_code,
                                 amount: find_data.amount,
                                 currency: find_data.currency,
                                 quantity: quantity,
                                 total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                              }

                              qrGenerateModule.add_collection(qr_data).then(async (result) => {
                                 qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                                    let qr_pay = {
                                       "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                       "order_no": rtl.order_no,
                                       "name": rtl.name,
                                       "email": rtl.email,
                                       "amount": rtl.amount,
                                       "currency": rtl.currency,
                                       "payment_status": rtl.payment_status,
                                       "today_collection": per_day_count,
                                       "total_collection": count_payment,
                                    }
                                    res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                                 }).catch((error) => {
                                   logger.error(500,{message: error,stack: error.stack}); 
                                    res.status(statusCode.internalError).send(response.errormsg(error.message));
                                 })


                              }).catch((error) => {
                                logger.error(500,{message: error,stack: error.stack}); 
                                 res.status(statusCode.internalError).send(response.errormsg(error.message));
                              })

                           }
                        }
                        else {
                           res.status(statusCode.internalError).send(response.errormsg("QR link is expired."));
                        }
                     }
                  } else {
                     res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per user collection out of range."));
                  }
               } else {
                  res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per day collection limit expired.",per_day_count, count_payment));
               }
            }
            else {
               if (find_data.overall_qty_allowed > count_payment) {
                  if (find_data.no_of_collection > count_per_user) {
                     if (find_data.status == 1) {
                        res.status(statusCode.internalError).send(response.errormsg("QR link is deactivated."));
                     } else {
                        let quantity = req.bodyString("quantity");
                        let qr_data = {
                           merchant_qr_id: find_data.id,
                           order_no: await helpers.make_order_number("ORD"),
                           name: req.bodyString("name"),
                           email: email,
                           payment_status: "created",
                           type_of_qr_code: find_data.type_of_qr_code,
                           amount: find_data.amount,
                           currency: find_data.currency,
                           quantity: quantity,
                           total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
                        }
                        qrGenerateModule.add_collection(qr_data).then(async (result) => {

                           qrGenerateModule.selectOne_payment({ id: result.insertId }).then(async (rtl) => {
                              let qr_pay = {
                                 "qr_order_id": enc_dec.cjs_encrypt(rtl.id),
                                 "order_no": rtl.order_no,
                                 "name": rtl.name,
                                 "email": rtl.email,
                                 "amount": rtl.amount,
                                 "currency": rtl.currency,
                                 "payment_status": rtl.payment_status,
                                 "today_collection": per_day_count,
                                 "total_collection": count_payment,
                              }
                              res.status(statusCode.ok).send(response.successansmsg(qr_pay, 'Payment order created successfully.'))

                           }).catch((error) => {
                             logger.error(500,{message: error,stack: error.stack}); 
                              res.status(statusCode.internalError).send(response.errormsg(error.message));
                           })
                        }).catch((error) => {
                          logger.error(500,{message: error,stack: error.stack}); 
                           res.status(statusCode.internalError).send(response.errormsg(error.message));
                        })

                     }
                  }
                  else {
                     res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Per user collection out of range."));
                  }
               } else {
                  res.status(statusCode.internalError).send(response.errormsg("QR payment collection out of range", 'E0044', "Overall QR payment collection limit is expired.", per_day_count, count_payment));
               }
            }
         }
      }
      else {
         res.status(statusCode.internalError).send(response.errormsg("Invalid ID"));
      }
   },

   collection: async (req, res) => {

      let date = moment().format('YYYY-MM-DD');
      let register_at = moment().format('YYYY-MM-DD HH:mm:ss');
      let id = await enc_dec.cjs_decrypt(req.bodyString("qr_order_id"));
      const merchant_name = await qrGenerateModule.getMerchantName();
      let find_data = await qrGenerateModule.selectOne_payment({ id: id });
      if (find_data) {
         if (find_data.type_of_qr_code == "Static_QR") {
            payment_data = {
               payment_id: req.bodyString("payment_id"),
               type_of_qr_code: req.bodyString("type_of_qr"),
               payment_status: req.bodyString("status"),
               amount: req.bodyString("amount"),
               remark: req.bodyString("remark"),
               mode_of_payment: req.bodyString('payment_mode'),
            }
            qrGenerateModule.update_collection({ id: id }, payment_data).then(async (result) => {
            }).catch((error) => {
              logger.error(500,{message: error,stack: error.stack}); 
               res.status(statusCode.internalError).send(response.errormsg(error.message));
            })

         } else if (find_data.type_of_qr_code == "Dynamic_QR") {
            let payment_data = {
               payment_id: req.bodyString("payment_id"),
               type_of_qr_code: req.bodyString("type_of_qr"),
               payment_status: req.bodyString("status"),
               remark: req.bodyString("remark"),
               mode_of_payment: req.bodyString('payment_mode'),
               transaction_date: register_at,
            }

            qrGenerateModule.update_collection({ id: id }, payment_data).then(async (result) => {
               qrGenerateModule.selectOne_payment({ id: id }).then(async (rlt) => {
                  res.status(statusCode.ok).send(response.successmsg("Payment status " + rlt.payment_status))

               }).catch((error) => {
                 logger.error(500,{message: error,stack: error.stack}); 
                  res.status(statusCode.internalError).send(response.errormsg(error.message));
               })
            }).catch((error) => {
              logger.error(500,{message: error,stack: error.stack}); 
               res.status(statusCode.internalError).send(response.errormsg(error.message));
            })
         }

         // res.status(statusCode.ok).send(response.successmsg(find_data))
      } else {
         res.status(statusCode.internalError).send(response.errormsg("Invalid id."));
      }


      // let find_data = await qrGenerateModule.selectOne({ id: find_data1.merchant_qr_id });
      // const uuid = new SequenceUUID({
      //    valid: true,
      //    dashes: false,
      //    unsafeBuffer: true
      // })
      // let payment_id = uuid.generate();
      // let qr_payment_collection = [];

      // if (find_data) {
      //    if (find_data.type_of_qr_code == "Static_QR") {
      //       if (find_data.status == "1" || find_data.is_reseted == "1") {
      //          res.status(statusCode.internalError).send(response.errormsg("QR code deactivated or reseated."));
      //       }
      //       else {
      //          let qr_payment = {
      //             // order_no: await helpers.make_order_number("ORD"),
      //             payment_id: payment_id,
      //             merchant_qr_id: find_data.id,
      //             currency: find_data.currency,
      //             amount: req.bodyString("amount"),
      //             type_of_qr_code: find_data.type_of_qr_code,
      //             payment_status: "completed",
      //             name: req.bodyString("name"),
      //             email: req.bodyString("email"),
      //             mode_of_payment: req.bodyString("mode_of_payment")
      //          }

      //          qrGenerateModule.update_collection({ "id": id }, qr_payment).then(async (result) => {
      //             qrGenerateModule.selectOne_payment({ id: id }).then(async (rlt) => {
      //                
      //                let qr_data = {
      //                   collection_id: await enc_dec.cjs_encrypt(rlt.id),
      //                   order_no: rlt.order_no,
      //                   payment_id: rlt.payment_id,
      //                   sub_merchant_name: merchant_name[find_data.sub_merchant_id],
      //                   currency: rlt.currency,
      //                   amount: rlt.amount,
      //                   payment_status: rlt.payment_status,
      //                   payment_mode: rlt.mode_of_payment,
      //                }
      //                res.status(statusCode.ok).send(response.successdatamsg(qr_data, 'QR payment collection successful.'))
      //             }).catch((error) => {
      //                res.status(statusCode.internalError).send(response.errormsg(error.message));
      //             })
      //          }).catch((error) => {
      //             res.status(statusCode.internalError).send(response.errormsg(error.message));
      //          })
      //       }
      //    } else if (find_data.type_of_qr_code == "Dynamic_QR") {
      //       let exp_date = find_data.end_date.toISOString().slice(0, 10);
      //       if (exp_date < date) {
      //          res.status(statusCode.internalError).send(response.errormsg("Payment link is expired."));
      //       }
      //       else {
      //          let count_payment = await qrGenerateModule.get_count_payment({
      //             'merchant_qr_id': find_data.id,
      //             'type_of_qr_code': "'Dynamic_QR'"
      //          })
      //          if (count_payment < find_data.no_of_collection) {
      //             let quantity = req.bodyString("quantity");
      //             let qr_data = {
      //                merchant_qr_id: find_data.id,
      //                // order_no: await helpers.make_order_number("ORD"),
      //                amount: find_data.amount,
      //                payment_id: payment_id,
      //                currency: find_data.currency,
      //                quantity: quantity,
      //                name: req.bodyString("name"),
      //                email: req.bodyString("email"),
      //                type_of_qr_code: find_data.type_of_qr_code,
      //                // no_of_collection: find_data.no_of_collection,
      //                mode_of_payment: req.bodyString("mode_of_payment"),
      //                total_amount: parseFloat(find_data.amount) * parseFloat(quantity),
      //                payment_status: "created"
      //             }
      //             qrGenerateModule.update_collection({ id: id }, qr_data).then(async (result) => {
      //                qrGenerateModule.selectOne_payment({ id: id }).then(async (rlt) => {
      //                   let qr_data = {
      //                      collection_id: await enc_dec.cjs_encrypt(rlt.id),
      //                      order_no: rlt.order_no,
      //                      payment_id: rlt.payment_id,
      //                      sub_merchant_name: merchant_name[find_data.sub_merchant_id],
      //                      currency: rlt.currency,
      //                      amount: rlt.amount,
      //                      quantity: rlt.quantity,
      //                      payment_mode: rlt.mode_of_payment,
      //                   }
      //                   res.status(statusCode.ok).send(response.successdatamsg(qr_data, 'QR payment collection successful.'))

      //                }).catch((error) => {
      //                   res.status(statusCode.internalError).send(response.errormsg(error.message));
      //                })
      //             }).catch((error) => {
      //                res.status(statusCode.internalError).send(response.errormsg(error.message));
      //             })
      //          } else {
      //             res.status(statusCode.internalError).send(response.errormsg("Payment collection out of range"));
      //          }
      //       }
      //    }
      // } else {
      //    res.status(statusCode.internalError).send(response.errormsg("Invalid id"));
      // }

   },

   payment_list: async (req, res) => {
      try{
      const merchant_name = await qrGenerateModule.getMerchantName();
      let limit = {
         perpage: 0,
         page: 0,
      }
      if (req.bodyString('perpage') && req.bodyString('page')) {
         perpage = parseInt(req.bodyString('perpage'))
         start = parseInt(req.bodyString('page'))
         limit.perpage = perpage
         limit.start = ((start - 1) * perpage)
      }
      let email = req.bodyString('email');
      let date = req.bodyString("date");
      let merchant_id = enc_dec.cjs_decrypt(req.bodyString("sub_merchant_id"));
      search = { "type_of_qr_code": "'Dynamic_QR'" }
      if (date) {
         search.transaction_date = "'" + date + "'";
      }
      if (email) {
         search.email = "'" + email + "'";
      }
      if (merchant_id) {
         search.merchant_qr_id = "'" + merchant_id + "'";
      }
      const filter = {}
      let result = await qrGenerateModule.select_payment_list(search, limit);
      let send_res = [];
      for (val of result) {
         let res;
         res = {
            id: enc_dec.cjs_encrypt(val.id),
            sub_merchant_id: await enc_dec.cjs_encrypt(val.merchant_qr_id),
            sub_merchant_name: merchant_name[val.merchant_qr_id],
            order_no: val.order_no,
            payment_id: val.payment_id,
            email: val.email,
            name: val.name,
            payment_status: val.payment_status,
            payment_date: moment(val.transaction_date).format("DD-MM-YYYY")
         };
         send_res.push(res);
      }
      let total_count = await qrGenerateModule.get_count_payment(search);
      res.status(statusCode.ok).send(response.successdatamsg(send_res, 'List fetched successfully.', total_count));
   }catch(error){
      logger.error(500,{message: error,stack: error.stack}); 
      res.status(statusCode.internalError).send(response.errorMsg("Something went wrong"));
   }
}
}

module.exports = qr_payment;