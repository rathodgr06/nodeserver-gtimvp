const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const enc_dec = require("../utilities/decryptor/decryptor");
const CustomerModel = require("../models/customers");
const TransactionsModel = require("../models/transactions");
const MccModel = require("../models/mccModel");
const merchantOrderModel = require("../models/merchantOrder");
const PspModel = require("../models/psp");
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");
const helpers = require("../utilities/helper/general_helper");
const mailSender = require("../utilities/mail/mailsender");
const otpSender = require("../utilities/sms/sentotp");
require("dotenv").config({ path: "../.env" });
const SequenceUUID = require("sequential-uuid");
const accessToken = require("../utilities/tokenmanager/token");
const moment = require("moment");
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
var uuid = require("uuid");
require("dotenv").config({ path: "../.env" });
const mobile_activity_logger = require("../utilities/activity-logger/mobile_activity_logger");
const admin_activity_logger = require('../utilities/activity-logger/admin_activity_logger');
const cipherModel = require('../models/cipher_models')
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const logger = require('../config/logger');

var admin_user = {
    list: async (req, res) => {
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
        const name = req.bodyString("name");
        const email = req.bodyString("email");
        const mobile = req.bodyString("mobile");
        const code = req.bodyString("code");
        const search = {};
        let user_type = "";
        let user_id = "";
        
        if (req.user.type == "admin") {
            user_type = "admin";
            user_id=req.user.id
        } else {
            user_type = "merchant";
            user_id=req.user.super_merchant_id?req.user.super_merchant_id:req.user.id
        }
        if (req.bodyString("name")) {
            search.name = name;
        }
        if (req.bodyString("email")) {
            search.email = email;
        }
        if (req.bodyString("mobile")) {
            search.mobile_no = mobile;
        }
        if (req.bodyString("code")) {
            search.dial_code = code;
        }
        let table_name = "";
        if (req.bodyString("mode") != "live") {
            table_name = "test_orders";
        } else {
            table_name = "orders";
        }
        CustomerModel.select(limit, search, user_type, user_id, table_name)
            .then(async (result) => {
                let send_res = [];
               
                for (let val of result) {
                    let first_txn_date = await CustomerModel.select_txn_date({'cid':enc_dec.cjs_encrypt(val.id)} , 'asc');
                    let last_txn_date = await CustomerModel.select_txn_date({'cid': enc_dec.cjs_encrypt(val.id)} , 'desc')
                    if (user_type == "admin") {
                    var country = await CustomerModel.select_cust_data('billing_country',{'cid': enc_dec.cjs_encrypt(val.id)} )
                    var country_code=country.billing_country?country.billing_country:""
                    }else{
                        var country = await CustomerModel.get_customer_country(val.billing_country,'country')
                        var country_code=country !=""?country:"";
                    }
                    let res = {
                        customer_id: enc_dec.cjs_encrypt(val.id),
                        name: val?.name ? val.name : "-",
                        email: val.email,
                        mobile_no: val.mobile_no,
                        country_code: val.dial_code ? val.dial_code : "",
                        profile_pic: val.avatar
                            ? server_addr +
                            "/static/avatar/" +
                            val.avatar
                            : "",
                        image_name: val.avatar ? val.avatar : "",
                        country:country_code,
                        de_customer_id: val?.id
                            ? await helpers.formatNumber(
                                val?.id
                            )
                            : "",
                        created_date: await date_formatter.get_date_time(val.created_at),
                        first_txn_date: first_txn_date ,
                        last_txn_date: last_txn_date ,
                        status: val.status === 1 ? "Deactivated" : "Active",
                    };
                    send_res.push(res);
                }
                if (user_type == "admin") {
                    total_count = await CustomerModel.get_customer_count(
                        search
                    );
                } else {
                    total_count =
                        await CustomerModel.get_merchant_customer_count(
                            search,
                            req.user.id,
                            table_name
                        );
                }

                let module_and_user = {
                    user: req.user.id,
                    user_type: req.user.type,
                    module: "Customer",
                    sub_module: "All-list",
                };
                let activity = "Fetched customer list.";
                let headers = req.headers;

                admin_activity_logger.add(module_and_user, activity, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successdatamsg(
                                send_res,
                                "List fetched successfully.",
                                total_count
                            )
                        );
                    })
                    .catch((error) => {
                        logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });

                // res.status(statusCode.ok).send(
                //     response.successdatamsg(
                //         send_res,
                //         "List fetched successfully.",
                //         total_count
                //     )
                // );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    customer_details: async (req, res) => {
        let cid = req.bodyString("cid");
        let denc_cid = enc_dec.cjs_decrypt(req.bodyString("cid"));
        CustomerModel.selectOne("*", { id: denc_cid })
            .then(async (result) => {
                let transaction_data =
                    await CustomerModel.selectCustomerTransaction(
                        "*",
                        { cid: cid },
                        (date_con = "")
                    );
                let transaction = [];
                for (let val of transaction_data) {
                    let res = {
                        order_id: val.order_id,
                        order_amount:
                            val.currency + " " + val.amount.toFixed(2),
                        order_currency: val.currency,
                        status: val.status,
                        billing_address_1: val.billing_address_line_1,
                        billing_address_2: val.billing_address_line_2,
                        billing_city: val.billing_city,
                        billing_pincode: val.billing_pincode,
                        billing_province: val.billing_province,
                        billing_country: val.billing_country,
                        shipping_address_1: val.shipping_address_line_1,
                        shipping_address_2: val.shipping_address_line_2,
                        shipping_city: val.shipping_city,
                        shipping_province: val.shipping_province,
                        shipping_country: val.shipping_country,
                        shipping_pincode: val.shipping_pincode,
                        transaction_date:await date_formatter.get_date_time(val.created_at),
                    };
                    transaction.push(res);
                }
                let send_res = [];
                let val = result;
                let res1 = {
                    name: val.name,
                    email: val.email,
                    mobile_no: val.mobile_no,
                    country_code: val.dial_code ? val.dial_code : "",
                    profile_pic: val?.avatar
                        ? server_addr+
                          "/static/avatar/" +
                          val.avatar
                        : "",
                    image_name: val?.avatar ? val.avatar : "",
                    transaction_data: transaction,
                };
                send_res = res1;

                let module_and_user = {
                    user: req.user.id,
                    user_type: req.user.type,
                    module: "Customer",
                    sub_module: "Details",
                };
                let activity = `Fetched customer details of CID : ${cid}`;
                let headers = req.headers;
                admin_activity_logger
                    .add(module_and_user, activity, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successdatamsg(
                                send_res,
                                "Details fetched successfully."
                            )
                        );
                    })
                    .catch((error) => {
                        logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });

                // res.status(statusCode.ok).send(
                //     response.successdatamsg(
                //         send_res,
                //         "Details fetched successfully."
                //     )
                // );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    details: async (req, res) => {
        let cid = req.user.payload.id;
        CustomerModel.selectOne("*", { id: cid })
            .then(async (result) => {
                
                let send_res = [];
                let val = result;
                let res1 = {
                    name: val.name,
                    email: val.email,
                    mobile_no: val.mobile_no,
                    country_code: val.dial_code ? val.dial_code : "",
                    profile_pic: val.avatar
                        ? server_addr+
                        "/static/avatar/" +
                        val.avatar
                        : "",
                    image_name: val.avatar ? val.avatar : "",
                };
                send_res = res1;

                let module_and_user = {
                    user: req.user.payload.id,
                    user_type: req.user.payload.type,
                    module: "Profile",
                    sub_module: "Details",
                };
                let activity = `Fetched profile details of CID : ${cid}`;
                let headers = req.headers;
                mobile_activity_logger
                    .insert(module_and_user, activity, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successdatamsg(
                                send_res,
                                "Details fetched successfully."
                            )
                        );
                    })
                    .catch((error) => {
                        logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });

                // res.status(statusCode.ok).send(
                //     response.successdatamsg(
                //         send_res,
                //         "Details fetched successfully."
                //     )
                // );
            })
            .catch((error) => {
                console.log(error);
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    otp_Sent: async (req, res) => {
        try {
          let is_existing = req.bodyString("is_existing");
          let foundCust = await CustomerModel.selectOne("id,email,name", {
            dial_code: req.bodyString("mobile_code"),
            mobile_no: req.bodyString("mobile_no"),
            deleted: 0,
          });
          if (is_existing == 1 && foundCust) {
            if (foundCust.email == req.bodyString("email")) {
              payload = {
                id: foundCust.id,
                name: foundCust.name,
                email: foundCust.email,
                type: "customer",
              };

              const aToken = accessToken(payload);
              res.status(statusCode.ok).send(
                response.loginSuccess({
                  accessToken: aToken,
                  name: payload.name,
                  cid: encrypt_decrypt("encrypt", payload.id),
                  user_type: "customer",
                })
              );
            } else {
              res
                .status(statusCode.ok)
                .send(
                  response.errormsg("Not valid email id linked with mobile no")
                );
            }
          } else {
            let register_at = await date_formatter.created_date_time();
            let token = uuid.v1();
            let otp = await helpers.generateOtp(4);
            let ins_data = {
              email: req.bodyString("email"),
              token: token,
              otp: otp,
              register_at: register_at,
            };
            CustomerModel.add(ins_data)
              .then(async (result_add_reset) => {
                let mail_response = await mailSender.otpMail(
                  req.bodyString("email"),
                  otp
                );

                res
                  .status(statusCode.ok)
                  .send(
                    response.successansmsg(
                      { otp_token: token },
                      "OTP sent, Please Verify your mail"
                    )
                  );
              })
              .catch((error) => {
                logger.error(500, { message: error, stack: error.stack });
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error));
              });
          }
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    otp_Sent_email: async (req, res) => {
        try{
        let register_at =  await date_formatter.created_date_time();
        let token = uuid.v1();
        let otp = await helpers.generateOtp(4);
        let ins_data = {
            email: req.bodyString("email"),
            token: token,
            otp: otp,
            register_at: register_at,
        };

        // let module_and_user = {
        //     user: req.user.id,
        //     user_type: req.user.type,
        //     module: "Users",
        //     sub_module: "OTP_Sent_email",
        // };
        // let activity = `OPT sent for email : ${req.bodyString("email")}`;
        // let headers = req.headers;
        // mobile_activity_logger.insert(module_and_user, activity, headers);

        CustomerModel.add(ins_data)
            .then(async (result_add_reset) => {
                let title = await helpers.get_title();
                let subject = " Verify email account";

                await mailSender.otpMail(req.bodyString("email"), otp);
                res.status(statusCode.ok).send(
                    response.successansmsg(
                        { otp_token: token },
                        "OTP sent, Please Verify your mail"
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }
    },

    otp_verity: async (req, res) => {
        let selection = "id,email";
        let condition = {
            token: req.bodyString("otp_token"),
            otp: req.bodyString("otp"),
        };

        CustomerModel.selectOtpDAta(selection, condition)
            .then(async (result) => {
                let added_date = await date_formatter.created_date_time();
                let customerData = {
                    name: "",
                    email: result.email,
                    created_at: added_date,
                };
                let updateTaken = await CustomerModel.updateCustomerTempToken(
                    { token: req.bodyString("token") },
                    customerData
                );

                let cid = await CustomerModel.selectCustomerDetails("id", {
                    token: req.bodyString("token"),
                });
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        { cid: encrypt_decrypt("encrypt", cid.id) },
                        "Registered successfully."
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    reset_otp_verity: async (req, res) => {
        let selection = "id,email";
        let condition = {
            token: req.bodyString("otp_token"),
            otp: req.bodyString("otp"),
        };

        // let module_and_user = {
        //     user: req.user.id,
        //     user_type: req.user.type,
        //     module: "Users",
        //     sub_module: "Reset_OTP_Verify",
        // };
        // let activity = `Reset OPT verify.`;
        // let headers = req.headers;
        // mobile_activity_logger.insert(module_and_user, activity, headers);

        CustomerModel.selectOtpDAta(selection, condition)
            .then(async (result) => {
                let cid = await CustomerModel.selectCustomer("id", {
                    email: result.email,
                });
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        { cid: encrypt_decrypt("encrypt", cid.id) },
                        "Email verified."
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    customer_ques_list: async (req, res) => {
        let cid =  enc_dec.cjs_decrypt(req.bodyString("cid"));

        CustomerModel.selectAnswer("id,customer_id,question_id", {
            deleted: 0,
            customer_id: cid,
        })
            .then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let res = {
                        id: await enc_dec.cjs_encrypt(val.id),
                        customer_id: await enc_dec.cjs_encrypt(val.customer_id),
                        question_id: await enc_dec.cjs_encrypt(val.question_id),
                        question: await helpers.get_question_by_id(
                            val.question_id
                        ),
                        //   answer: val.answer,
                    };
                    send_res.push(res);
                }
                total_count = await CustomerModel.get_count({
                    deleted: 0,
                    customer_id: cid,
                });

                // let module_and_user = {
                //     user: req.user.id,
                //     user_type: req.user.type,
                //     module: "Customer",
                //     sub_module: "Ques_List",
                // };
                // let activity = "Fetched customer ques list.";
                // let headers = req.headers;
                // mobile_activity_logger
                //     .insert(module_and_user, activity, headers)
                //     .then((result) => {
                //         res.status(statusCode.ok).send(
                //             response.successdatamsg(
                //                 send_res,
                //                 "List fetched successfully.",
                //                 total_count
                //             )
                //         );
                //     })
                //     .catch((error) => {
                
                //         res.status(statusCode.internalError).send(
                //             response.errormsg(error.message)
                //         );
                //     });
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        send_res,
                        "List fetched successfully.",
                        total_count
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    verify_question_answer: async (req, res) => {
        try {
          let verify_data = req.body.data;
          let correct_answer = 0;
          let customer_id = verify_data[0].cid;

          // let module_and_user = {
          //     user: req.user.id,
          //     user_type: req.user.type,
          //     module: "Customer",
          //     sub_module: "Verify_Question",
          // };
          // let activity = `Verify security questions and answers.`;
          // let headers = req.headers;
          // mobile_activity_logger.insert(module_and_user, activity, headers);

          for (let i = 0; i < verify_data.length; i++) {
            let cid = enc_dec.cjs_decrypt(verify_data[i].cid);
            let qid = enc_dec.cjs_decrypt(verify_data[i].question_id);
            let answer = verify_data[i].answer;
            if (answer < 2) {
              res
                .status(statusCode.badRequest)
                .send(
                  response.validationResponse(
                    "Please select at least 2 answers"
                  )
                );
            } else {
              await CustomerModel.selectAnswer("*", {
                deleted: 0,
                customer_id: cid,
                question_id: qid,
                answer: answer,
              }).then((result) => {
                if (result.length > 0) {
                  correct_answer++;
                }
              });
            }
          }
          if (correct_answer >= 2) {
            res
              .status(statusCode.ok)
              .send(
                response.successdatamsg(
                  { cid: customer_id },
                  "Answer matched.You can proceed."
                )
              );
          } else {
            res
              .status(statusCode.badRequest)
              .send(response.validationResponse(`Answer does not match`));
          }
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    reset_pin: async (req, res) => {
        let selection = "id";
        let cid = encrypt_decrypt("decrypt", req.bodyString("cid"));
        let condition = {
            id: encrypt_decrypt("decrypt", req.bodyString("cid")),
        };
        CustomerModel.selectOne(selection, condition)
            .then(async (result) => {
                
                let customerData = {
                    pin: encrypt_decrypt("encrypt", req.bodyString("pin")),
                };
                let updateTaken = await CustomerModel.updateDetails(
                    { id: result.id },
                    customerData
                );

                // let module_and_user = {
                //     user: req.user.id,
                //     user_type: req.user.type,
                //     module: "Users",
                //     sub_module: "Reset_Pin",
                // };
                // let activity = `User pin reset for CID : ${cid}`;
                // let headers = req.headers;
                // mobile_activity_logger
                //     .insert(module_and_user, activity, headers)
                //     .then((result) => {
                //         res.status(statusCode.ok).send(
                //             response.successmsg("PIN reset successfully.")
                //         );
                //     })
                //     .catch((error) => {
                //         res.status(statusCode.internalError).send(
                //             response.errormsg(error.message)
                //         );
                //     });

                res.status(statusCode.ok).send(
                    response.successmsg("PIN reset successfully.")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    update_profile: async (req, res) => {
        try {
            let cid = req.user.payload.id;

            insdata = {
                name: req.bodyString("name"),
            };
            if (req.all_files) {
                if (req.all_files.avatar) {
                    insdata.avatar = req.all_files.avatar;
                }
            }

            $ins_id = await CustomerModel.updateDetails({ id: cid }, insdata);

            let module_and_user = {
                user: req.user.payload.id,
                user_type: req.user.payload.type,
                module: "User",
                sub_module: "Profile",
            };
            let headers = req.headers;
            mobile_activity_logger
                .edit(module_and_user, cid, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg(
                            "Customer profile updated successfully"
                        )
                    );
                })
                .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });

            // res.status(statusCode.ok).send(
            //     response.successmsg("Customer profile updated successfully")
            // );
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    transaction_list: async (req, res) => {
        try {
            let limit = {
                perpage: 10,
                start: 0,
                page: 1,
            };

            if (req.bodyString("perpage") && req.bodyString("page")) {
                perpage = parseInt(req.bodyString("perpage"));
                start = parseInt(req.bodyString("page"));

                limit.perpage = perpage;
                limit.start = (start - 1) * perpage;
            }

            let and_filter_obj = {};
            let date_condition = {};
            let cid = encrypt_decrypt("encrypt", req.user.payload.id);
            and_filter_obj.cid = cid;
            if (req.bodyString("card_no") != '') {
                and_filter_obj.card_no = req.bodyString("card_no");
            }
            if (req.bodyString("from_date") != '') {
                date_condition.from_date = req.bodyString("from_date");
            }

            if (req.bodyString("to_date") != '') {
                date_condition.to_date = req.bodyString("to_date");
            }
            CustomerModel.selectTransaction(
                and_filter_obj,
                date_condition,
                limit
            ).then(async (result) => {
                let send_res = [];
                for (let val of result) {
                    let res = {
                        order_id: val.order_id,
                        transaction_id: await enc_dec.cjs_encrypt(val.id),
                        transaction_date:await date_formatter.get_date_time(val.created_at),
                        order_currency: val.currency,
                        order_amount: val.amount.toFixed(2),
                        status: val.status,
                        card_no: val.card_no,
                    };
                    send_res.push(res);
                }

                let module_and_user = {
                    user: req.user.payload.id,
                    user_type: req.user.payload.type,
                    module: "Transaction",
                    sub_module: "List",
                };
                let activity = "Fetched transaction list.";
                let headers = req.headers;
                mobile_activity_logger
                    .insert(module_and_user, activity, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successdatamsg(
                                send_res,
                                "List fetched successfully"
                            )
                        );
                    })
                    .catch((error) => {
                        logger.error(500,{message: error,stack: error.stack}); 
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });
                // res.status(statusCode.ok).send(
                //     response.successdatamsg(
                //         send_res,
                //         "List fetched successfully"
                //     )
                // );
            });
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    change_pin: async (req, res) => {
        try{
        let new_pin = req.bodyString("new_pin");
        let hashPin = await encrypt_decrypt("encrypt", new_pin);

        await CustomerModel.updateDetails(
            { id: req.user.payload.id },
            { pin: hashPin }
        );
        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "User",
            sub_module: "Change-Pin",
        };
        let headers = req.headers;
        mobile_activity_logger
            .edit(module_and_user, req.user.id, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Pin changed successfully")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }
        // res.status(statusCode.ok).send(
        //     response.successmsg("Pin changed successfully")
        // );
    },

    change_email: async (req, res) => {
        try{
        let cid = req.user.payload.id;
        let selection = "id,email";
        let condition = {
            otp: req.bodyString("otp"),
            token: req.bodyString("otp_token"),
        };
        let old_email = await CustomerModel.selectOne("email", { id: cid });

        let new_email = await CustomerModel.selectOtpDAta(selection, condition);
        let get_count = await CustomerModel.get_count_logs(cid, {
            new_email: `'${new_email.email}'`,
        });
        let customerData = {
            email: new_email.email,
        };
        let updateTaken = await CustomerModel.updateDetails(
            { id: cid },
            customerData
        );
        if (get_count == 0) {
            let added_date = await date_formatter.created_date_time();
            let logs = {
                cid: req.user.payload.id,
                type: "email",
                old_email: old_email.email,
                new_email: new_email.email,
                old_mobile_no: "",
                new_mobile_no: "",
                created_at: added_date,
            };
            CustomerModel.addLogs(logs);
        }
        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "User",
            sub_module: "Change-Email",
        };
        let headers = req.headers;
        mobile_activity_logger
            .edit(module_and_user, req.user.id, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Email updated successfully.")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }
        // res.status(statusCode.ok).send(
        //     response.successmsg("Email updated successfully.")
        // );
    },

    cardList: async (req, res, next) => {
        // let dec_token = req.bodyString('token');
        try {
          let cid = encrypt_decrypt("encrypt", req.user.payload.id);
          if (cid) {
            // let customer_data = JSON.parse(dec_token);
            // let email = customer_data.email;
            // let customer = await merchantOrderModel.selectOne('*', { email: email }, 'customers')
            let customer_cards = await CustomerModel.selectDynamicCard(
              "*",
              { cid: cid, deleted: 0 },
              "customers_cards"
            );

            let module_and_user = {
              user: req.user.payload.id,
              user_type: req.user.payload.type,
              module: "Card",
              sub_module: "List",
            };
            let activity = "Fetched card list.";
            let headers = req.headers;
            mobile_activity_logger.insert(module_and_user, activity, headers);

            if (customer_cards[0]) {
              let cards = [];
              for (let card of customer_cards) {
                let card_obj = {
                  card_id: enc_dec.cjs_encrypt(card.id),
                  name: card.name_on_card,
                  expiryDate: card.card_expiry,
                  card_no: card.card_number,
                  card_last_digit: card.last_4_digit,
                  status: card.status == 1 ? "Hide" : "Show",
                  primary_card: card.primary_card,
                };
                cards.push(card_obj);
              }
              res
                .status(statusCode.ok)
                .send(
                  response.successdatamsg(cards, "List fetched successfully.")
                );
            } else {
              res
                .status(statusCode.ok)
                .send(response.successdatamsg([], "No card found."));
            }
          } else {
            res
              .status(statusCode.ok)
              .send(response.successdatamsg([], "No card found."));
          }
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    card_add: async (req, res) => {
        try{
        let added_date =  await date_formatter.created_date_time();
        let name_on_card = req.bodyString("card_holder_name");
        let expiry_date = req.bodyString("expiry_date");

        let cid = encrypt_decrypt("encrypt", req.user.payload.id);
        let secret_key = await cipherModel.selectOne('id',{['expiry_date >= ']:await date_formatter.current_date(),is_active:1})
        let ins_body = {
            name_on_card: name_on_card,
            browser_token: "",
            card_number: await enc_dec.dynamic_encryption(req.bodyString("card_no"),secret_key.id,''),
            card_proxy: enc_dec.encrypt_card(req.bodyString("card_no")),
            card_nw: req.card_details.card_brand,
            last_4_digit: req.bodyString("card_no").slice(-4),
            cid: cid,
            card_expiry: expiry_date,
            deleted: 0,
            created_at: added_date,
            updated_at: added_date,
            cipher_id: secret_key.id,
        };
        merchantOrderModel.addCustomerCards(ins_body)
            .then((result) => {
                let module_and_user = {
                    user: req.user.payload.id,
                    user_type: req.user.payload.type,
                    module: "Customer",
                    sub_module: "Card",
                };
                let headers = req.headers;
                mobile_activity_logger
                    .add(module_and_user, name_on_card, headers)
                    .then((result) => {
                        res.status(statusCode.ok).send(
                            response.successmsg("Card added successfully.")
                        );
                    })
                    .catch((error) => {
                        logger.error(500,{message: error,stack: error.stack}); 
                        console.log(error)
                        res.status(statusCode.internalError).send(
                            response.errormsg(error.message)
                        );
                    });

                // res.status(statusCode.ok).send(
                //     response.successmsg("Card added successfully.")
                // );
            })
            .catch((error) => {
                console.log(error);
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }
    },

    card_delete: async (req, res) => {
        try{
        let card_id_exist =  enc_dec.cjs_decrypt(
            req.bodyString("card_id")
        );
        await CustomerModel.updateDynamic(
            { id: card_id_exist },
            { deleted: 1 },
            "customers_cards"
        );
        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "Customer",
            sub_module: "Card",
        };
        let headers = req.headers;
        mobile_activity_logger
            .delete(module_and_user, card_id_exist, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Deleted successfully")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }
        // res.status(statusCode.ok).send(
        //     response.successmsg("Deleted successfully")
        // );
    },

    card_hide: async (req, res) => {
        try{
        let card_id_exist = await enc_dec.cjs_decrypt(
            req.bodyString("card_id")
        );
        let visibility = req.bodyString("visibility");
        await CustomerModel.updateDynamic(
            { id: card_id_exist },
            { status: visibility },
            "customers_cards"
        );

        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "Card",
            sub_module: "Hide",
        };
        let activity = `Hide card of id : ${card_id_exist}`;
        let headers = req.headers;
        mobile_activity_logger
            .insert(module_and_user, activity, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Updated successfully")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }

        // res.status(statusCode.ok).send(
        //     response.successmsg("Updated successfully")
        // );
    },

    card_primary: async (req, res) => {
        try{
        let card_id_exist =  enc_dec.cjs_decrypt(
            req.bodyString("card_id")
        );
        let cid =  enc_dec.cjs_encrypt(req.user.payload.id);
        await CustomerModel.updateDynamic(
            { cid: cid, deleted: 0 },
            { primary_card: 0 },
            "customers_cards"
        );
        await CustomerModel.updateDynamic(
            { id: card_id_exist },
            { primary_card: 1 },
            "customers_cards"
        );

        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "Card",
            sub_module: "Primary",
        };
        
        let activity = `Make card as primary of id : ${card_id_exist}`;
        let headers = req.headers;
        mobile_activity_logger
            .insert(module_and_user, activity, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Updated successfully")
                );
            })
            .catch((error) => {
                console.log(error)
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
        }catch(error){
             logger.error(500,{message: error,stack: error.stack}); 
        }

        // res.status(statusCode.ok).send(
        //     response.successmsg("Updated successfully")
        // );
    },

    delete_hide_card: async (req, res) => {
        let verify_data = req.body.card_id;

        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "Card",
            sub_module: "delete",
        };
        let activity = "Delete hidden cards.";
        let headers = req.headers;
        mobile_activity_logger.insert(module_and_user, activity, headers);

        for (let i = 0; i < verify_data.length; i++) {
            let card_id =  enc_dec.cjs_decrypt(verify_data[i].card_id);
            let deleted = verify_data[i].deleted;
            let hide = verify_data[i].hide;
            let primary_card = verify_data[i].primary_card;
            CustomerModel.updateDynamic(
                { id: card_id },
                { deleted: deleted, status: hide, primary_card: primary_card },
                "customers_cards"
            ).then((result) => {
                res.status(statusCode.ok).send(
                    response.successmsg("Updated successfully")
                );
            }).catch((error)=>{
                 logger.error(500,{message: error,stack: error.stack}); 
            });
        }
    },

    encrypt_mobile_no_and_code: async (req, res) => {
        let data = {
            mobile_no: encrypt_decrypt(
                "encrypt",
                req.bodyString("mobile_code") +
                " " +
                req.bodyString("mobile_no") +
                " " +
                req.bodyString("fcm_id") +
                " " +
                req.user.payload.id
            ),
        };

        let module_and_user = {
            user: req.user.payload.id,
            user_type: req.user.payload.type,
            module: "Users",
            sub_module: "Mobile_no",
        };
        let activity = "Encrypt mobile_no and code.";
        let headers = req.headers;
        mobile_activity_logger
            .insert(module_and_user, activity, headers)
            .then((result) => {
                res.status(statusCode.ok).send(
                    response.successdatamsg(data, "Encrypted successfully.")
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });

        // res.status(statusCode.ok).send(
        //     response.successdatamsg(data, "Encrypted successfully.")
        // );
    },

    receive_sms: async (req, res) => {
        try {
          let msg = req.body.Body;
          let from = req.body.From;
          let dec_msg = encrypt_decrypt("decrypt", msg);
          let split_msg = dec_msg.split(" ");
          let code = split_msg[0];
          let no = split_msg[1];
          let fcm_id = split_msg[2];
          let cid = split_msg[3];

          if (from == code + no) {
            let added_date = await date_formatter.created_date_time();
            const uuid = new SequenceUUID({
              valid: true,
              dashes: false,
              unsafeBuffer: true,
            });
            let token = uuid.generate();
            let data = {
              dial_code: code,
              mobile_no: no,
            };
            CustomerModel.updateDetails({ id: cid }, data)
              .then(async (result) => {
                let title = await helpers.get_title();
                let message = "Mobile verified";
                let url_ = "";
                let type = "";
                let user = await helpers.get_customer_name(cid);
                let payload = {
                  token: token,
                  message: message,
                  status: true,
                };
                helpers.pushNotification(
                  fcm_id,
                  title,
                  message,
                  url_,
                  type,
                  payload,
                  (user = user)
                );

                // let module_and_user = {
                //     user: req.user.id,
                //     user_type: req.user.type,
                //     module: "Customer",
                //     sub_module: "Receive_SMS",
                // };
                // let activity = "Mobile_no verified by sms.";
                // let headers = req.headers;
                // mobile_activity_logger
                //     .insert(module_and_user, activity, headers)
                //     .then((result) => {
                //         res.status(statusCode.ok).send(
                //             response.successdatamsg(
                //                 "Mobile no verified successfully."
                //             )
                //         );
                //     })
                //     .catch((error) => {
                //         res.status(statusCode.internalError).send(
                //             response.errormsg(error.message)
                //         );
                //     });

                res
                  .status(statusCode.ok)
                  .send(
                    response.successdatamsg("Mobile no verified successfully.")
                  );
              })
              .catch((error) => {
                logger.error(500, { message: error, stack: error.stack });
                res
                  .status(statusCode.internalError)
                  .send(response.errormsg(error.message));
              });
          } else {
            let title = await helpers.get_title();
            let message = "Mobile not verified";
            let url_ = "";
            let type = "";
            let payload = { message: message, status: false };
            helpers.pushNotification(
              fcm_id,
              title,
              message,
              url_,
              type,
              payload,
              (user = "")
            );
            res
              .status(statusCode.ok)
              .send(response.errormsg("Unable to verify mobile no."));
          }
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    receive_sms_fail: async (req, res) => {
        
        // let module_and_user = {
        //     user: req.user.id,
        //     user_type: req.user.type,
        //     module: "Customer",
        //     sub_module: "Receive_SMS",
        // };
        // let activity = "Mobile SMS Fail.";
        // let headers = req.headers;
        // mobile_activity_logger
        //     .insert(module_and_user, activity, headers)
        //     .then((result) => {
        //         res.status(statusCode.internalError).send(
        //             response.errormsg("SMS Fail")
        //         );
        //     })
        //     .catch((error) => {
        //         res.status(statusCode.internalError).send(
        //             response.errormsg(error.message)
        //         );
        //     });

        res.status(statusCode.internalError).send(
            response.errormsg("SMS Fail")
        );
    },

    dashboard: async (req, res) => {
        let added_date =  await date_formatter.created_date_time();
        if (req.bodyString("from_date") && req.bodyString("to_date")) {
            from_date = req.bodyString("from_date");
            to_date = req.bodyString("to_date");
            var search_date = { from_date: from_date, to_date: to_date };
        }
       // return;

        try {
            var transaction_table = "orders";
            var id = encrypt_decrypt("encrypt", req.user.payload.id);
            var customerbymcc = await CustomerModel.selectDynamicTransaction(
                { cid: id },
                req.bodyString("from_date") ? search_date : false,
                transaction_table
            );

            var get_count = await CustomerModel.get_dynamic_count(
                { cid: id },
                req.bodyString("from_date") ? search_date : {},
                transaction_table
            );
            var total_amount = await CustomerModel.get_volume_dynamic(
                { cid: id },
                req.bodyString("from_date") ? search_date : {},
                transaction_table
            );
            let customer_list = [];
            var total_transactions = await CustomerModel.get_dynamic_count(
                { cid: id },
                req.bodyString("from_date") ? search_date : {},
                transaction_table
            );

            if (customerbymcc.length > 0) {
                for (let val of customerbymcc) {
                    var no_of_transactions =
                        await CustomerModel.get_dynamic_count(
                            { cid: id, mcc_category: val.mcc_category },
                            req.bodyString("from_date") ? search_date : {},
                            transaction_table
                        );
                    var total_amount_mcc =
                        await CustomerModel.get_volume_dynamic(
                            { cid: id, mcc_category: val.mcc_category },
                            req.bodyString("from_date") ? search_date : {},
                            transaction_table
                        );

                    let per_amount =
                        total_amount > 0
                            ? (total_amount_mcc / total_amount) * 100
                            : 0;
                    let res = {
                        category: await helpers.get_mcc_category_name_by_id(
                            val.mcc
                        ),
                        currency: total_amount_mcc.currency,
                        amount: total_amount_mcc.total
                            ? total_amount_mcc.total.toFixed(2)
                            : "0.00",

                        percentage: per_amount.toFixed(2),

                        total_transaction: no_of_transactions,
                    };
                    customer_list.push(res);
                }
            } else {
                var customerbymcc =
                    await CustomerModel.selectDynamicTransaction(
                        { cid: id },
                        {},
                        transaction_table
                    );
                for (let val of customerbymcc) {
                    var no_of_transactions =
                        await CustomerModel.get_dynamic_count(
                            { cid: id, mcc_category: val.mcc_category },
                            req.bodyString("from_date") ? search_date : {},
                            transaction_table
                        );
                    var total_amount_mcc =
                        await CustomerModel.get_volume_dynamic(
                            { cid: id, mcc_category: val.mcc_category },
                            req.bodyString("from_date") ? search_date : {},
                            transaction_table
                        );

                    let per_amount =
                        total_amount > 0
                            ? (total_amount_mcc / total_amount) * 100
                            : 0;
                    let res = {
                        category:
                            val.mcc != ""
                                ? await helpers.get_mcc_category_name_by_id(
                                    val.mcc
                                )
                                : "",
                        // currency:total_amount_mcc.currency,
                        amount: total_amount_mcc.total
                            ? total_amount_mcc.total.toFixed(2)
                            : "0.00",

                        percentage: per_amount.toFixed(2),

                        total_transaction: no_of_transactions,
                    };
                    customer_list.push(res);
                }
            }

            if (get_count == 0) {
                let res = {
                    category: "",

                    amount: "0.00",

                    percentage: "0.00",

                    total_transaction: "0",
                };
                customer_list.push(res);
            }
            let count = {
                total_transaction: total_transactions,
                total_amount: total_amount.total
                    ? total_amount.total.toFixed(2)
                    : "0.00",
            };

            let module_and_user = {
                user: req.user.payload.id,
                user_type: req.user.payload.type,
                module: "Dashboard",
                sub_module: "Details",
            };
            let activity = "Fetched dashboard Details.";
            let headers = req.headers;
            mobile_activity_logger
                .insert(module_and_user, activity, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successdatamsg(
                            customer_list,
                            "Details fetch successfully",
                            count
                        )
                    );
                })
                .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });

            // res.status(statusCode.ok).send(
            //     response.successdatamsg(
            //         customer_list,
            //         "Details fetch successfully",
            //         count
            //     )
            // );
        } catch (error) {
            console.log(error);
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    send_otp_mobile: async (req, res) => {
        const { mobile_code, mobile_no } = req.body;
        try {
            let foundCust = await CustomerModel.selectActualCustomerDetails(
                "*",
                { dial_code: mobile_code, mobile_no: mobile_no }
            );
            let is_existing_customer = 0;
            if (foundCust) {
                is_existing_customer = 1;
            }
            let otp = await helpers.generateOtp(4);
            const title = "PayVault";
            const mobile_number = `${mobile_code}${mobile_no}`;
            const welcomeMessage =
                "Welcome to " +
                title +
                "! Your verification code is: " +
                otp +
                ". Do not share it with anyone.";

            // let module_and_user = {
            //     user: req.user.id,
            //     user_type: req.user.type,
            //     module: "Users",
            //     sub_module: "OTP_Sent_Mobile",
            // };
            // let activity = `OPT sent for mobile : ${mobile_number}`;
            // let headers = req.headers;
            // mobile_activity_logger.insert(module_and_user, activity, headers);

            otpSender(mobile_number, welcomeMessage)
                .then(async (data) => {
                    
                    let register_at =  await date_formatter.created_date_time();
                    const uuid = new SequenceUUID({
                        valid: true,
                        dashes: true,
                        unsafeBuffer: true,
                    });

                    let token = uuid.generate();
                    let ins_data = {
                        mobile_code: mobile_code,
                        mobile_no: mobile_no,
                        otp: otp,
                        token: token,
                        sms_id: data,
                        created_at: register_at,
                    };
                    CustomerModel.addMobileOTP(ins_data)
                        .then(async (result) => {
                            res.status(statusCode.ok).send(
                                response.SentOTPMobile({
                                    otp_token: token,
                                    is_existing: is_existing_customer,
                                })
                            );
                        })
                        .catch((error) => {
                            logger.error(500,{message: error,stack: error.stack}); 
                            res.status(statusCode.internalError).send(
                                response.errormsg(error)
                            );
                        });
                })
                .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error)
                    );
                });
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },

    mobile_otp_verify: async (req, res) => {
        let selection = "id,mobile_code,mobile_no,sms_id";
        let condition = {
            otp: req.bodyString("otp"),
            token: req.bodyString("otp_token"),
        };

        // let module_and_user = {
        //     user: req.user.id,
        //     user_type: req.user.type,
        //     module: "Users",
        //     sub_module: "mobile_otp_verify",
        // };
        // let activity = `Mobile OTP verified`;
        // let headers = req.headers;
        // mobile_activity_logger.insert(module_and_user, activity, headers);

        CustomerModel.selectMobileOtpDAta(selection, condition)
            .then(async (result) => {
                const uuid = new SequenceUUID({
                    valid: true,
                    dashes: false,
                    unsafeBuffer: true,
                });

                let token = uuid.generate();
                let added_date =  await date_formatter.created_date_time();
                let customerData = {
                    token: token,
                    mobile_code: result.mobile_code,
                    mobile_no: result.mobile_no,
                    fcm_id: req.bodyString("fcm_id"),
                    twiloi_sms_id: result.sms_id,
                    created_at: added_date,
                };

                let updateTaken = await CustomerModel.add_customer_tem(
                    customerData
                );
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        { token: token },
                        "Mobile no verified successfully."
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    forgot_otp_verify: async (req, res) => {
        let selection = "id,mobile_code,mobile_no";
        let condition = {
            token: req.bodyString("otp_token"),
            otp: req.bodyString("otp"),
        };

        // let module_and_user = {
        //     user: req.user.id,
        //     user_type: req.user.type,
        //     module: "Users",
        //     sub_module: "forgot_otp_verify",
        // };
        // let activity = `Forgot OTP verify.`;
        // let headers = req.headers;
        // mobile_activity_logger.insert(module_and_user, activity, headers);

        CustomerModel.selectMobileOtpDAta(selection, condition)
            .then(async (result) => {
                let cid = await CustomerModel.selectCustomer("id", {
                    dial_code: result.mobile_code,
                    mobile_no: result.mobile_no,
                });
                res.status(statusCode.ok).send(
                    response.successdatamsg(
                        { cid: encrypt_decrypt("encrypt", cid.id) },
                        "Mobile number verified."
                    )
                );
            })
            .catch((error) => {
                logger.error(500,{message: error,stack: error.stack}); 
                res.status(statusCode.internalError).send(
                    response.errormsg(error.message)
                );
            });
    },

    change_mobile: async (req, res) => {
        try {
          let cid = req.user.id;
          let selection = "id,dial_code,mobile_no";
          let condition = {
            otp: req.bodyString("otp"),
            token: req.bodyString("otp_token"),
          };
          let old_mobile = await CustomerModel.selectOne(selection, {
            id: cid,
          });
          let selection_data = "id,mobile_code,mobile_no";
          let new_mobile = await CustomerModel.selectMobileOtpDAta(
            selection_data,
            condition
          );
          let mobile_no = `'${new_mobile.mobile_code}${new_mobile.mobile_no}'`;
          let get_count = await CustomerModel.get_count_logs(cid, {
            new_mobile_no: mobile_no,
          });
          let customerData = {
            dial_code: new_mobile.mobile_code,
            mobile_no: new_mobile.mobile_no,
          };
          let updateTaken = await CustomerModel.updateDetails(
            { id: cid },
            customerData
          );

          let module_and_user = {
            user: req.user.id,
            user_type: req.user.type,
            module: "User",
            sub_module: "Change-Mobile",
          };
          let headers = req.headers;
          mobile_activity_logger.edit(module_and_user, req.user.id, headers);

          if (get_count == 0) {
            let added_date = await date_formatter.created_date_time();
            let logs = {
              cid: req.user.id,
              type: "mobile",
              old_mobile_no: old_mobile.dial_code + old_mobile.mobile_no,
              new_mobile_no: new_mobile.mobile_code + new_mobile.mobile_no,
              old_email: "",
              new_email: "",
              created_at: added_date,
            };
            CustomerModel.addLogs(logs);
          }
          res
            .status(statusCode.ok)
            .send(response.successmsg("Mobile number updated successfully."));
        } catch (error) {
          logger.error(500, { message: error, stack: error.stack });
        }
    },

    delete: async (req, res) => {
        try {
            let cid = req.user.payload.id;
            insdata = {
                deleted: 1,
            };
            $ins_id = await CustomerModel.updateDetails({ id: cid }, insdata);
            let update_card = await CustomerModel.updateDynamic({ cid: enc_dec.cjs_decrypt(cid) }, { deleted: 1 }, 'customers_cards');
            let module_and_user = {
                user: req.user.payload.id,
                user_type: req.user.payload.type,
                module: "User",
                sub_module: "Account",
            };
            let headers = req.headers;
            mobile_activity_logger
                .delete(module_and_user, req.user.payload.id, headers)
                .then((result) => {
                    res.status(statusCode.ok).send(
                        response.successmsg(
                            "Customer account deleted successfully"
                        )
                    );
                })
                .catch((error) => {
                    logger.error(500,{message: error,stack: error.stack}); 
                    res.status(statusCode.internalError).send(
                        response.errormsg(error.message)
                    );
                });

            // res.status(statusCode.ok).send(
            //     response.successmsg("Customer account deleted successfully")
            // );
        } catch (error) {
            logger.error(500,{message: error,stack: error.stack}); 
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};

module.exports = admin_user;
