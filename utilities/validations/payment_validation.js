const Joi = require("joi").extend(require("@joi/date"));
const ServerResponse = require("../response/ServerResponse");
const StatusCode = require("../statuscode/index");
const checkEmpty = require("./emptyChecker");
const idChecker = require("./idchecker");
const checkifrecordexist = require("./checkifrecordexist");
const checkIfrecordexitWithJoin = require("./checkifrecordexistwithjoin");
const enc_dec = require("../../utilities/decryptor/decryptor");
const helpers = require("../helper/general_helper");
// const { response } = require("../../app");
const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const pool = require("../../config/database");
let moment = require("moment");
const logger = require('../../config/logger');

const payment_validation = {
  refund: async (req, res, next) => {
    const schema = Joi.object({
      remark: Joi.string().allow("").optional(),
      order_id: Joi.string()
        .required()
        .error(new Error("Order id not valid/not supplied")),
      amount: Joi.object({
        currencyCode: Joi.string()
          .pattern(/^[A-Z]{3}$/)
          .required()
          .error(new Error("Currency not valid/not supplied")),
        value: Joi.number()
          .required()
          .error(new Error("Amount not valid/not supplied")),
      }).required(),
    });
    try {
      const result = schema.validate(req.body);
      let order_exist = await checkifrecordexist(
        { order_id: req.bodyString("order_id") },
        "orders"
      );
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        if (common_err.message) {
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.message,
                common_err.code
              )
            );
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code
            )
          );
      } else {
        if (order_exist) {
          next();
        } else {
          let payload = {
            psp_name: "paydart",
            psp_response_details: "Order id not valid/not supplied",
          };
          let common_err = await helpers.get_common_response(payload);
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.response[0].response_details,
                common_err.response[0].response_code
              )
            );
        }
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },

  test_refund: async (req, res, next) => {
    const schema = Joi.object({
      order_id: Joi.string()
        .required()
        .error(new Error("Order id not valid/not supplied")),
      amount: Joi.string()
        .required()
        .error(new Error("Amount not valid/not supplied")),
    });
    try {
      const result = schema.validate(req.body);
      let order_exist = await checkifrecordexist(
        { order_id: req.bodyString("order_id") },
        "test_orders"
      );
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        if (common_err.message) {
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.message,
                common_err.code
              )
            );
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code
            )
          );
      } else {
        if (order_exist) {
          next();
        } else {
          let payload = {
            psp_name: "paydart",
            psp_response_details: "Order id not valid/not supplied",
          };
          let common_err = await helpers.get_common_response(payload);
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.response[0].response_details,
                common_err.response[0].response_code
              )
            );
        }
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },

  tr_void: async (req, res, next) => {
    const schema = Joi.object({
      remark: Joi.string().allow("").optional(),
      order_id: Joi.string()
        .required()
        .error(new Error("Order id not valid/not supplied")),
    });
    try {
      const result = schema.validate(req.body);
      let order_exist = await checkifrecordexist(
        { order_id: req.bodyString("order_id") },
        "orders"
      );
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        if (common_err.message) {
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.message,
                common_err.code
              )
            );
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code
            )
          );
      } else {
        if (order_exist) {
          next();
        } else {
          let payload = {
            psp_name: "paydart",
            psp_response_details: "Order id not valid/not supplied",
          };
          let common_err = await helpers.get_common_response(payload);
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.response[0].response_details,
                common_err.response[0].response_code
              )
            );
        }
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },

  test_void: async (req, res, next) => {
    const schema = Joi.object({
      order_id: Joi.string()
        .required()
        .error(new Error("Order id not valid/not supplied")),
    });
    try {
      const result = schema.validate(req.body);
      let order_exist = await checkifrecordexist(
        { order_id: req.bodyString("order_id") },
        "test_orders"
      );
      if (result.error) {
        let payload = {
          psp_name: "paydart",
          psp_response_details: result.error.message,
        };
        let common_err = await helpers.get_common_response(payload);
        if (common_err.message) {
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.message,
                common_err.code
              )
            );
        }
        return res
          .status(StatusCode.ok)
          .send(
            ServerResponse.common_error_msg(
              common_err.response[0].response_details,
              common_err.response[0].response_code
            )
          );
      } else {
        if (order_exist) {
          next();
        } else {
          let payload = {
            psp_name: "paydart",
            psp_response_details: "Order id not valid/not supplied",
          };
          let common_err = await helpers.get_common_response(payload);
          return res
            .status(StatusCode.ok)
            .send(
              ServerResponse.common_error_msg(
                common_err.response[0].response_details,
                common_err.response[0].response_code
              )
            );
        }
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error?.message));
    }
  },

  transaction_validation: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        action: Joi.string()
          .valid("CAPTURE", "VOID", "REFUND", "RECURRING")
          .required()
          .error(() => {
            throw new Error("Action is not valid/not supplied");
          }),

        transaction_id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Transaction id is not valid/not supplied");
          }),
        amount: Joi.object().keys({
          currencyCode: Joi.string()
            .required()
            .error(() => {
              throw new Error("Currency is not valid/not supplied");
            }),
          value: Joi.number()
            .required()
            .error(() => {
              throw new Error("Amount is not valid/not supplied");
            }),
        }),
        reason: Joi.string().allow(""),
      });

      const { error } = schema.validate(req.body);
      if (error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(error.message));
      } else {
        let mode = req?.credentials?.type || req?.body?.mode;
        let checkTransactionAuth;
        if (mode == "test") {
          checkTransactionAuth = await checkIfrecordexitWithJoin(
            {
              "t2.txn": req.body.transaction_id,
              "t1.merchant_id": req.credentials.merchant_id,
            },
            "test_orders",
            "test_order_txn",
            "order_id",
            "order_id"
          );
        } else {
          checkTransactionAuth = await checkIfrecordexitWithJoin(
            {
              "t2.txn": req.body.transaction_id,
              "t1.merchant_id": req.credentials.merchant_id,
            },
            "orders",
            "order_txn",
            "order_id",
            "order_id"
          );
        }
        if (!checkTransactionAuth) {
          return res
            .status(StatusCode.badRequest)
            .send(ServerResponse.errormsg("Invalid transaction id"));
        }
        let transaction_exits = await checkifrecordexist(
          { txn: req.bodyString("transaction_id") },
          mode == "test" ? "test_order_txn" : "order_txn"
        );
        if (transaction_exits) {
          next();
        } else {
          res
            .status(StatusCode.badRequest)
            .send(ServerResponse.errormsg("Invalid transaction id"));
        }
      }
    } catch (error) {
      logger.error(400,{message: error,stack: error?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(error.message));
    }
  },

  transaction_details: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        // action: Joi.string().required().error(() => {
        //     throw new Error("Action is not valid/not supplied")
        // }),
        order_id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Order id is not valid/not supplied");
          }),
        m_order_id: Joi.string().allow(""),
        p_order_id: Joi.string().allow(""),
        txn_id: Joi.string().allow(""),
        // amount: Joi.object().keys({
        //     currencyCode: Joi.string().required().error(() => {
        //         throw new Error("Currency is not valid/not supplied")
        //     }),
        //     value: Joi.number().required().error(() => {
        //         throw new Error("Amount is not valid/not supplied")
        //     })
        // }),
        // reason: Joi.string().allow('')
      });

      const { error } = schema.validate(req.body);
      if (error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(error.message));
      } else {
        next();
      }
    } catch (err) {
      logger.error(400,{message: err,stack: err?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },
  transaction_validation_capture: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Id is not valid/not supplied");
          }),
        amount: Joi.string()
          .required()
          .error(() => {
            throw new Error("Amount is not valid/not supplied");
          }),
        reason: Joi.string().allow(""),
        mode: Joi.string().optional().allow(""),
        transaction_id: Joi.string().optional().allow(""),
      });

      const { error } = schema.validate(req.body);
      if (error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(error.message));
      } else {
        next();
      }
    } catch (err) {
      logger.error(400,{message: err,stack: err?.stack});
      console.log(err);
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },
  transaction_validation_refund_void: async (req, res, next) => {
    try {
      const schema = Joi.object().keys({
        order_id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Id is not valid/not supplied");
          }),
        amount: Joi.string().allow(""),
        txn_id: Joi.string()
          .required()
          .error(() => {
            throw new Error("Transaction is not valid/not supplied");
          }),
        action: Joi.string()
          .required()
          .error(() => {
            throw new Error("Action is not valid/not supplied");
          }),
        mode: Joi.string().optional().allow(""),
      });

      const { error } = schema.validate(req.body);
      if (error) {
        res
          .status(StatusCode.badRequest)
          .send(ServerResponse.errormsg(error.message));
      } else {
        let action = req.body.action;
        let txn = req.body.txn_id;
        let mode = req.body.mode;
        let action_allowed = false;
        if (action == "VOID") {
          let txn_and_void_datetime_details = await getTxnTimeAndVoidTime(
            mode,
            txn
          );
          console.log(`Void time and txn time details`);
          console.log(txn_and_void_datetime_details);
          let void_calculated = moment(
            txn_and_void_datetime_details.created_at
          ).add(txn_and_void_datetime_details.voidWithinTime, "hours");
          let void_time = moment(void_calculated).format("YYYY-MM-DD HH:mm");
          let now = moment().format("YYYY-MM-DD HH:mm");
          console.log(now, void_time);
          if (moment(now).isSameOrBefore(void_time)) {
            action_allowed = await checkIfrecordexitWithJoin(
              { "t1.order_id": req.body.order_id, "t2.allowVoid": 1 },
              mode == "test" ? "test_orders" : "orders",
              "mid",
              "terminal_id",
              "terminal_id"
            );
            if (action_allowed) {
              next();
            } else {
              res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "Action void is disabled for this MID."
                  )
                );
            }
          } else {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  `Transaction can't be void after ${txn_and_void_datetime_details.voidWithinTime} hours.`
                )
              );
          }
        } else {
          action_allowed = await checkIfrecordexitWithJoin(
            { "t1.order_id": req.body.order_id, "t2.allowRefunds": 1 },
            mode == "test" ? "test_orders" : "orders",
            "mid",
            "terminal_id",
            "terminal_id"
          );
          if (action_allowed) {
            next();
          } else {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Action refund is disabled for this MID."
                )
              );
          }
        }
      }
    } catch (err) {
      logger.error(400,{message: err,stack: err?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },
  checkTransactionStateAndValidAction: async (req, res, next) => {
    let txn = req.body.transaction_id;
    let mode = req.credentials.type;
    try {
      let action = req.body.action;
      switch (action) {
        case "VOID":
          let validVoidableTxn = await checkifrecordexist(
            { "type <>": "VOID", status: "AUTHORISED", is_voided: 0, txn: txn },
            mode == "test" ? "test_order_txn" : "order_txn"
          );
          if (!validVoidableTxn) {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Transaction can't be void, already voided or not in state of to be void"
                )
              );
          } else {
            let txn_and_void_datetime_details = await getTxnTimeAndVoidTime(
              mode,
              txn
            );
            console.log(`Void time and txn time details`);
            console.log(txn_and_void_datetime_details);
            let void_calculated = moment(
              txn_and_void_datetime_details.created_at
            ).add(txn_and_void_datetime_details.voidWithinTime, "hours");
            let void_time = moment(void_calculated).format("YYYY-MM-DD HH:mm");
            let now = moment().format("YYYY-MM-DD HH:mm");
            console.log(now, void_time);
            if (moment(now).isSameOrBefore(void_time)) {
              let allowVoid = await checkActionAllowed(mode, txn, action);
              if (allowVoid) {
                next();
              } else {
                res
                  .status(StatusCode.badRequest)
                  .send(
                    ServerResponse.errormsg(
                      "Transaction can't be void, void is not enable for this MID"
                    )
                  );
              }
            } else {
              res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    `Transaction can't be void after ${txn_and_void_datetime_details.voidWithinTime} hours.`
                  )
                );
            }
          }

          break;
        case "REFUND":
          let validRefundableTxn = await checkifrecordexist(
            {
              type: ["CAPTURE", "PARTIALLY_CAPTURE"],
              status: "AUTHORISED",
              is_voided: 0,
              txn: txn,
            },
            mode == "test" ? "test_order_txn" : "order_txn"
          );
          if (!validRefundableTxn) {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Transaction can't be refunded, already voided or not in state of to be refunded"
                )
              );
          } else {
            let allowVoid = await checkActionAllowed(mode, txn, action);
            if (allowVoid) {
              next();
            } else {
              res
                .status(StatusCode.badRequest)
                .send(
                  ServerResponse.errormsg(
                    "Transaction can't be refund, refund is not enable for this MID"
                  )
                );
            }
          }
          break;
        case "CAPTURE":
          let validCapturableTxn = await checkifrecordexist(
            { type: "AUTH", status: "AUTHORISED", is_voided: 0, txn: txn },
            mode == "test" ? "test_order_txn" : "order_txn"
          );
          if (!validCapturableTxn) {
            res
              .status(StatusCode.badRequest)
              .send(
                ServerResponse.errormsg(
                  "Transaction can't be captured, already voided or not in state of to be captured"
                )
              );
          } else {
            next();
          }
          break;
        case "RECURRING":
          next();
          break;
      }
    } catch (err) {
      logger.error(400,{message: err,stack: err?.stack});
      res
        .status(StatusCode.badRequest)
        .send(ServerResponse.validationResponse(err.message));
    }
  },
};
async function checkActionAllowed(mode, txn, action) {
  let txn_table = mode == "test" ? "test_order_txn" : "order_txn";
  let action_str = action == "VOID" ? "allowVoid" : "allowRefunds";
  let order_table = mode == "test" ? "test_orders" : "orders";
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("t1.id")
      .from(config.table_prefix + txn_table + " t1")
      .join(
        config.table_prefix + order_table + " t2",
        "t1.order_id=t2.order_id",
        "inner"
      )
      .join(
        config.table_prefix + "mid t3",
        "t2.terminal_id=t3.terminal_id",
        "inner"
      )
      .where({ "t1.txn": txn, [action_str]: 1 })
      .get();
  } catch (error) {
    logger.error(400,{message: error,stack: error?.stack});
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  if (response.length > 0) {
    return true;
  } else {
    return false;
  }
}
async function getTxnTimeAndVoidTime(mode, txn) {
  let txn_table = mode == "test" ? "test_order_txn" : "order_txn";
  let order_table = mode == "test" ? "test_orders" : "orders";
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("t1.created_at,t3.voidWithinTime")
      .from(config.table_prefix + txn_table + " t1")
      .join(
        config.table_prefix + order_table + " t2",
        "t1.order_id=t2.order_id",
        "inner"
      )
      .join(
        config.table_prefix + "mid t3",
        "t2.terminal_id=t3.terminal_id",
        "inner"
      )
      .where({ "t1.txn": txn })
      .get();
  } catch (error) {
    logger.error(400,{message: error,stack: error?.stack});
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response[0];
}
module.exports = payment_validation;
