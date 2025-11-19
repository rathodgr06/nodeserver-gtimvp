const WalletModel = require("../models/wallet");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
const winston = require("../utilities/logmanager/winston");
const { promises } = require("fs");
const moment = require("moment");
const charges_invoice_models = require("../models/charges_invoice_models");
const currency = require("./currency");
const walletDBModel = require("../models/wallet");
const transacationChargesModel = require('../models/charges_invoice_models');
const encrypt_decrypt = require("../utilities/decryptor/encrypt_decrypt");

var wallet = {
  create: async (req, res) => {
    let added_date = await date_formatter.created_date_time();
    let wallet_id = await helpers.make_sequential_no();
    let sub_merchant_id = req.bodyString("sub_merchant_id");
    let currency = req.bodyString("currency");
    let receiver_id = req.bodyString("receiver_id");
    let is_active = req.bodyString("is_active");

    let create_payload = {
      wallet_id: wallet_id,
      currency: currency,
      created_at: added_date,
      updated_at: added_date,
      active: is_active
    };

    // Decrypt sub_merchant_id
    if (sub_merchant_id && sub_merchant_id.length > 10) {
      sub_merchant_id = enc_dec.cjs_decrypt(sub_merchant_id);
    }

    if (sub_merchant_id && currency) {
      create_payload.sub_merchant_id = sub_merchant_id;
    }

    if (receiver_id && currency) {
      create_payload.beneficiary_id = receiver_id;
    }

    let checkdata = {
      currency: currency,
    };

    if (sub_merchant_id) {
      checkdata.sub_merchant_id = sub_merchant_id;
    }else{
      if (receiver_id) {
        sub_merchant_id = await walletDBModel.get_receiver_by_id_api_call(receiver_id);
        create_payload.sub_merchant_id = sub_merchant_id;
      }
    }

    if (receiver_id) {
      checkdata.beneficiary_id = receiver_id;
    }else{
      if (sub_merchant_id) {
        receiver_id = await walletDBModel.get_receiver_by_sub_merchant_id_api_call(sub_merchant_id);
        create_payload.beneficiary_id = receiver_id;
      }
    }

    if (!create_payload?.sub_merchant_id) {
      create_payload.sub_merchant_id = 0;
    }

    WalletModel.checkAndCreate(create_payload, checkdata)
      .then((result) => {
        if (result?.status == 200) {
          let response_payload = {
            wallet_id: result?.data?.wallet_id,
            sub_merchant_id:
              result?.data?.sub_merchant_id == 0
                ? null
                : result?.data?.sub_merchant_id,
            receiver_id: result?.data?.beneficiary_id,
            currency: result?.data?.currency,
            total_balance: result?.data?.total_balance,
            available_balance: result?.data?.available_balance,
            pending_balance: result?.data?.pending_balance,
            active: result?.data?.active,
            created_at: moment(result?.data.created_at).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
            updated_at: moment(result?.data.updated_at).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          };

          res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                response_payload,
                "Wallet created successfully."
              )
            );
        } else {
          res
            .status(statusCode.ok)
            .send(response.validationResponse(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  // renamed this function to check the performance of the DB
  list_old: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let receiver_id = req.bodyString("receiver_id");
    let sub_merchant_id = req.bodyString("sub_merchant_id");
    let currency = req.bodyString("currency");
    let page = req.bodyString("page");
    let per_page = 50;
    try {
      let condition = {
        deleted: 0,
      };
      let limit = {
        page: 1, // Default Values
        per_page: 20, // Default Values
      };
      // filters and pagination
      if (sub_merchant_id) {
        if (sub_merchant_id.length > 10) {
          sub_merchant_id = await encrypt_decrypt('decrypt', sub_merchant_id);
        }
        condition.sub_merchant_id = sub_merchant_id;
      }
      if (receiver_id) {
        condition.beneficiary_id = parseInt(receiver_id);
      }
      if (currency) {
        condition.currency = currency;
      }
      if (page) {
        limit.page = page;
      }
      if (per_page) {
        limit.per_page = per_page;
      }
      WalletModel.list(condition, page, per_page)
        .then(async (result) => {
          if (result?.status == 400) {
            res
              .status(statusCode.badRequest)
              .send(response.successmsg(result?.message));
          } else {
            let updatedWallets;
            console.log(`calling from wallet list API`)
            try {
              updatedWallets = await Promise.all(
                result?.data?.map(async (wallet) => {

                  const condition = {
                    wallet_id: wallet?.wallet_id,
                    sub_merchant_id:0,
                    receiver_id:0,
                    currency:null
                  };
                  let balance_result = await charges_invoice_models.fetchWalletBalance(condition);

                  wallet.sub_merchant_id = wallet?.sub_merchant_id == '0' ? null : wallet?.sub_merchant_id;
                  let payload = {
                    wallet_id: wallet?.id,
                    receiver_id: wallet?.beneficiary_id,
                    ...wallet,
                    wallet_id: balance_result?.wallet_id,
                    total_balance: balance_result?.total_balance,
                    available_balance: balance_result?.balance,
                    pending_balance: balance_result?.pending_balance,
                  };
                  delete payload.id;
                  delete payload.beneficiary_id;
                  return payload;
                })
              );
            } catch (err) {
              console.error("Failed to edit wallets:", err);
            }
            console.log(updatedWallets.length);
            let final_response = {
              wallets: updatedWallets,
              total_count: result?.totalCount,
              page: result?.page,
              per_page: result?.limit,
            };

            res
              .status(statusCode.ok)
              .send(response.successdatamsg(final_response, "Wallet list"));
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  // new function with the batch size and other issue fixation
  listWithBatch: async (req, res) => {
    console.log("🚀 ~ req:", req.body);
    let receiver_id = req.bodyString("receiver_id");
    let sub_merchant_id = req.bodyString("sub_merchant_id");
    let currency = req.bodyString("currency");
    let page = req.bodyString("page");
    let per_page = 50;
    
    try {
      let condition = {
        deleted: 0,
      };
      let limit = {
        page: 1,
        per_page: 20,
      };
      
      // filters and pagination
      if (sub_merchant_id) {
        // this needs to also ask to Harshal why we are checking the length of submerchant id
        if (sub_merchant_id.length > 10) {
          sub_merchant_id =  encrypt_decrypt('decrypt', sub_merchant_id);
        }
        condition.sub_merchant_id = sub_merchant_id;
      }
      if (receiver_id) {
        condition.beneficiary_id = parseInt(receiver_id);
      }
      if (currency) {
        condition.currency = currency;
      }
      if (page) {
        limit.page = page;
      }
      if (per_page) {
        limit.per_page = per_page;
      }
      
      const result = await WalletModel.list(condition, page, per_page);
      
      if (result?.status == 400) {
        return res
          .status(statusCode.badRequest)
          .send(response.successmsg(result?.message));
      }
      
      // Process wallets in batches to avoid connection pool exhaustion
      const BATCH_SIZE = 5; // Adjust based on your pool size
      let updatedWallets = [];
      
      console.log(`calling from wallet list API`);
      
      for (let i = 0; i < result?.data?.length; i += BATCH_SIZE) {
        const batch = result.data.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (wallet) => {
            try {
              const condition = {
                wallet_id: wallet?.wallet_id,
                sub_merchant_id: wallet?.sub_merchant_id || null,
                receiver_id: wallet?.beneficiary_id || null,
                currency: wallet?.currency
              };
              
              let balance_result = await charges_invoice_models.fetchWalletBalance(condition);
              
              wallet.sub_merchant_id = wallet?.sub_merchant_id == '0' ? null : wallet?.sub_merchant_id;
              
              return {
                wallet_id: balance_result?.wallet_id || wallet?.wallet_id,
                receiver_id: wallet?.beneficiary_id,
                ...wallet,
                total_balance: balance_result?.total_balance || 0,
                available_balance: balance_result?.balance || 0,
                pending_balance: balance_result?.pending_balance || 0,
              };
            } catch (err) {
              console.error(`Failed to fetch balance for wallet ${wallet?.wallet_id}:`, err);
              // Return wallet with default balances on error
              return {
                wallet_id: wallet?.wallet_id,
                receiver_id: wallet?.beneficiary_id,
                ...wallet,
                total_balance: 0,
                available_balance: 0,
                pending_balance: 0,
                error: true
              };
            }
          })
        );
        
        // Extract fulfilled values
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            const payload = { ...result.value };
            delete payload.id;
            delete payload.beneficiary_id;
            updatedWallets.push(payload);
          }
        });
      }
      
      console.log(updatedWallets.length);
      
      let final_response = {
        wallets: updatedWallets,
        total_count: result?.totalCount,
        page: result?.page,
        per_page: result?.limit,
      };

      res
        .status(statusCode.ok)
        .send(response.successdatamsg(final_response, "Wallet list"));
        
    } catch (error) {
      console.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  // new function with single query instead of 50 queries
  list: async (req, res) => {
  console.log("🚀 ~ req:", req.body);
  let receiver_id = req.bodyString("receiver_id");
  let sub_merchant_id = req.bodyString("sub_merchant_id");
  let currency = req.bodyString("currency");
  let page = req.bodyString("page");
  let per_page = 50;
  
  try {
    let condition = {
      deleted: 0,
    };
    let limit = {
      page: 1, // Default Values
      per_page: 20, // Default Values
    };
    
    // filters and pagination
    if (sub_merchant_id) {
      if (sub_merchant_id.length > 10) {
        sub_merchant_id = await encrypt_decrypt('decrypt', sub_merchant_id);
      }
      condition.sub_merchant_id = sub_merchant_id;
    }
    if (receiver_id) {
      condition.beneficiary_id = parseInt(receiver_id);
    }
    if (currency) {
      condition.currency = currency;
    }
    if (page) {
      limit.page = page;
    }
    if (per_page) {
      limit.per_page = per_page;
    }
    
    const result = await WalletModel.list(condition, page, per_page);
    
    if (result?.status == 400) {
      return res
        .status(statusCode.badRequest)
        .send(response.successmsg(result?.message));
    }
    
    console.log(`calling from wallet list API`);
    
    let updatedWallets = [];
    
    try {
      // Extract all wallet IDs
      const walletIds = result?.data?.map(wallet => wallet?.wallet_id).filter(Boolean);
      
      if (walletIds.length === 0) {
        return res
          .status(statusCode.ok)
          .send(response.successdatamsg({
            wallets: [],
            total_count: result?.totalCount,
            page: result?.page,
            per_page: result?.limit,
          }, "Wallet list"));
      }
      
      // Fetch all balances in a single query
      const balances = await charges_invoice_models.fetchWalletBalances(walletIds);
      
      // Create a map for quick lookup
      const balanceMap = new Map(
        balances.map(balance => [balance.wallet_id, balance])
      );
      
      // Merge wallet data with balance data
      updatedWallets = result?.data?.map(wallet => {
        const balance_result = balanceMap.get(wallet?.wallet_id);
        
        wallet.sub_merchant_id = wallet?.sub_merchant_id == '0' ? null : wallet?.sub_merchant_id;
        
        return {
          wallet_id: balance_result?.wallet_id || wallet?.wallet_id,
          receiver_id: wallet?.beneficiary_id,
          sub_merchant_id: wallet?.sub_merchant_id,
          currency: wallet?.currency,
          total_balance: balance_result?.total_balance || 0,
          available_balance: balance_result?.balance || 0,
          pending_balance: balance_result?.pending_balance || 0,
          active:wallet?.active,
          deleted:wallet?.deleted,  
          created_at: wallet?.created_at,
          updated_at: wallet?.updated_at,
          // Add any other wallet fields you need
        };
      });
      
    } catch (err) {
      console.error("Failed to fetch wallet balances:", err);
      
      // Fallback: return wallets with zero balances
      updatedWallets = result?.data?.map(wallet => {
        wallet.sub_merchant_id = wallet?.sub_merchant_id == '0' ? null : wallet?.sub_merchant_id;
        
        return {
          wallet_id: wallet?.wallet_id,
          receiver_id: wallet?.beneficiary_id,
          sub_merchant_id: wallet?.sub_merchant_id,
          currency: wallet?.currency,
          total_balance: 0,
          available_balance: 0,
          pending_balance: 0,
          created_at: wallet?.created_at,
          updated_at: wallet?.updated_at,
          error: true,
          error_message: "Failed to fetch balance"
        };
      });
    }
    
    console.log(`Processed ${updatedWallets.length} wallets`);
    
    let final_response = {
      wallets: updatedWallets,
      total_count: result?.totalCount,
      page: result?.page,
      per_page: result?.limit,
    };

    res
      .status(statusCode.ok)
      .send(response.successdatamsg(final_response, "Wallet list"));
      
  } catch (error) {
    console.error("Error in wallet list:", error);
    res
      .status(statusCode.internalError)
      .send(response.errormsg(error.message));
  }
},
  manage: async (req, res) => {
    try {
      let action = req.bodyString("action");
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let currency = req.bodyString("currency");
      let receiver_id = req.bodyString("receiver_id");
      let wallet_id = req.bodyString("wallet_id");

      let update_payload = {
        active: action === "activate" ? 1 : 0,
      };

      const condition = {};

      if (wallet_id) {
        condition.wallet_id = wallet_id;
      } else if (sub_merchant_id && currency) {
        condition.sub_merchant_id = sub_merchant_id;
        condition.currency = currency;
      } else if (receiver_id && currency) {
        condition.beneficiary_id = receiver_id;
        condition.currency = currency;
      }

      console.log("🚀 ~ manage: ~ updating:", update_payload);
      console.log("🚀 ~ manage: ~ condition:", condition);

      WalletModel.update(update_payload, condition)
        .then((result) => {
          console.log("🚀 ~ result:", result)
          if (result?.status == 200) {
            res
              .status(statusCode.ok)
              .send(response.successansmsg(result?.data, "Wallet " + action.toLowerCase() +" successfully."));
          } else {
            res
              .status(statusCode.badRequest)
              .send(response.successmsg(result?.message));
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  get_wallet_details_by_id: async (req, res) => {
    let wallet_id = req.params.id;

    const condition = {
      wallet_id: wallet_id,
    };
    WalletModel.get_by_id(condition)
      .then(async (result) => {
        console.log("🚀 ~ result:", result)
        if (result?.status == 200) {

          let balance_result = await charges_invoice_models.fetchWalletBalance(condition);
          console.log("🚀 ~ balance_result:", balance_result)

          if (balance_result) {
            result.data.wallet_id = balance_result?.wallet_id;
            result.data.receiver_id = balance_result?.receiver_id;
            result.data.total_balance = balance_result?.total_balance;
            result.data.available_balance = balance_result?.balance;
            result.data.pending_balance = balance_result?.pending_balance;
          }
          
          result.data.sub_merchant_id = result?.data?.sub_merchant_id == 0 ? null : result?.data?.sub_merchant_id;
          delete result.data.beneficiary_id;

          let final_response = {
            wallet_id: balance_result?.wallet_id,
            sub_merchant_id: result?.data?.sub_merchant_id == 0 ? null : result?.data?.sub_merchant_id,
            receiver_id: balance_result?.receiver_id == 0 ? null : balance_result?.receiver_id,
            currency: balance_result?.currency == undefined ? result?.data?.currency : balance_result?.currency,
            total_balance: balance_result?.total_balance == undefined ? result?.data?.total_balance : balance_result?.total_balance,
            available_balance: balance_result?.balance == undefined ? result?.data?.available_balance : balance_result?.balance,
            pending_balance: balance_result?.pending_balance == undefined ? result?.data?.pending_balance : balance_result?.pending_balance,
            active: result?.data?.active,
            deleted: result?.data?.deleted,
            created_at: result?.data?.created_at,
            updated_at: result?.data?.updated_at,
          };

          res
            .status(statusCode.ok)
            .send(response.successdatamsg(final_response, result?.message));
        } else {
          res
            .status(statusCode.badRequest)
            .send(response.successmsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get_wallet: async (req, res) => {
    const { sub_merchant_id, receiver_id, currency, wallet_id } = req.body;

    let condition = {};
    if (sub_merchant_id) {
      condition = {
        sub_merchant_id: sub_merchant_id,
        currency: currency,
      };
    } else if (receiver_id) {
      condition = {
        beneficiary_id: receiver_id,
        currency: currency,
      };
    } else if (wallet_id) {
      condition = {
        wallet_id: wallet_id,
      };
    }

    if (Object.keys(condition).length === 0) {
      res
        .status(statusCode.badRequest)
        .send(response.errormsg("Invalid request"));
      return;
    }

    WalletModel.get_by_id(condition)
      .then((result) => {
        console.log("🚀 ~ .then ~ result:", result);
        if (result?.status == 200) {
          if (undefined == result?.data) {
            res
              .status(statusCode.badRequest)
              .send(response.errormsg("No wallet found"));
            return;
          }

          let response_payload = result?.data;
          delete response_payload.id;
          delete response_payload.deleted;
          response_payload.receiver_id = result?.data.beneficiary_id;
          response_payload.created_at = moment(result?.data.created_at).format(
            "YYYY-MM-DD HH:mm:ss"
          );
          response_payload.updated_at = moment(result?.data.updated_at).format(
            "YYYY-MM-DD HH:mm:ss"
          );
          delete response_payload.beneficiary_id;
          res
            .status(statusCode.ok)
            .send(response.successdatamsg(response_payload, result?.message));
        } else {
          res
            .status(statusCode.badRequest)
            .send(response.errormsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  load_wallet: async (req, res) => {
    const { wallet_id, amount, reference_id, reason } = req.body;

    const condition = {
      wallet_id: wallet_id,
    };

    WalletModel.get_by_id(condition).then(async (result) => {
        console.log("🚀 ~ .then ~ result:", result);
        if (result?.status == 200) {

          // Check wallet status
          if (result?.data?.active == 0) {
            return res
            .status(statusCode.ok)
            .send(response.errormsg("Wallet is in-active!"));
          }

          let data = {
            sub_merchant_id: result?.data?.sub_merchant_id,
            receiver_id: result?.data?.beneficiary_id,
            order_id: getRandom8to10DigitNumber(),
            order_status: "CREDIT",
            transaction_id: getRandom8to10DigitNumber(),
            currency: result?.data?.currency,
            amount: amount,
            net_amount: amount,
            transaction_status: "AUTHORISED",
            txn_reference: reference_id,
            reason: reason,
            status: 0,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          console.log("🚀 ~ data:", data)

          let load_wallet_result = await charges_invoice_models.addCharges(data);

          let final_response = {
            wallet_id: wallet_id,
            sub_merchant_id: data?.sub_merchant_id != undefined && data?.sub_merchant_id != 0 ? data?.sub_merchant_id : null,
            receiver_id: data?.receiver_id != undefined ? data?.receiver_id : null,
            order_id: data?.order_id,
            order_status: data?.order_status,
            transaction_id: data?.transaction_id,
            currency: data?.currency,
            amount: data?.amount,
            net_amount: data?.amount,
            reference_id: data?.txn_reference == undefined ? null : data?.txn_reference,
            reason: data?.reason == undefined ? null : data?.reason,
            created_at: data?.created_at,
            updated_at: data?.updated_at,
          }

          res
            .status(statusCode.ok)
            .send(response.successansmsg(final_response, "Your wallet has been loaded successfully."));

        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg("Internal server error!"));
      });
  },
  unload_wallet: async (req, res) => {
    const { wallet_id, amount, reference_id, reason } = req.body;
    console.log("🚀 ~ req.body:", req.body)

    const condition = {
      wallet_id: wallet_id,
    };

    let result = await charges_invoice_models.fetchWalletBalance(condition);
    console.log("🚀 ~ result:", result?.balance)
    if (result?.balance < amount) {
      return res
            .status(statusCode.ok)
            .send(response.errormsg("Insufficient balance!"));
    }

    WalletModel.get_by_id(condition).then(async (result) => {
        console.log("🚀 ~ .then ~ result:", result);
        if (result?.status == 200) {

          // Check wallet status
          if (result?.data?.active == 0) {
            return res
            .status(statusCode.ok)
            .send(response.errormsg("Wallet is in-active!"));
          }

          let data = {
            sub_merchant_id: result?.data?.sub_merchant_id,
            receiver_id: result?.data?.beneficiary_id,
            order_id: getRandom8to10DigitNumber(),
            order_status: "DEBIT",
            transaction_id: getRandom8to10DigitNumber(),
            currency: result?.data?.currency,
            amount: -amount,
            net_amount: -amount,
            transaction_status: "AUTHORISED",
            txn_reference : reference_id,
            reason: reason,
            status: 0,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
            updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          console.log("🚀 ~ data:", data)

          let unload_wallet_result = await charges_invoice_models.addCharges(data);

          let final_response = {
            wallet_id: wallet_id,
            sub_merchant_id: data?.sub_merchant_id != undefined && data?.sub_merchant_id != 0 ? data?.sub_merchant_id : null,
            receiver_id: data?.receiver_id != undefined ? data?.receiver_id : null,
            order_id: data?.order_id,
            order_status: data?.order_status,
            transaction_id: data?.transaction_id,
            currency: data?.currency,
            amount: data?.amount,
            net_amount: data?.amount,
            reference_id : data?.reference_id,
            reason: data?.reason,
            created_at: data?.created_at,
            updated_at: data?.updated_at,
          }

          res
            .status(statusCode.ok)
            .send(response.successansmsg(final_response, "Your wallet has been unloaded successfully."));

        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get_wallet_statement: async (req, res) => {
    const { wallet_id, from_date, to_date } = req.body;

    let oneDayAgo;
    let to_date_closing
    try {
      // Subtract 1 day from the current date
      oneDayAgo = moment(from_date, 'YYYY-MM-DD').subtract(1, 'days').format('YYYY-MM-DD');
      const isToday = moment(to_date, 'YYYY-MM-DD').isSame(moment(), 'day');
      if (isToday) {
        to_date_closing = moment(to_date, 'YYYY-MM-DD').subtract(1, 'days').format('YYYY-MM-DD');
      }else{
        to_date_closing = moment(to_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
      }
    } catch (error) {
      console.log("🚀 ~ error:", error)
    }
    

    const condition = req.body;

    charges_invoice_models.get_wallet_statement(condition).then(async (result) => {
        if (result?.status == 200) {

          let final_response_list = [];

          for(let txn of result?.data){
            
            if (!txn?.wallet_id) {
              continue;
            }

            let where = {
              wallet_id: txn?.wallet_id,
              snap_date: moment(from_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
            }
            console.log("🚀 ~ where:", where)

            //Get last snapshot date from "from_date"
            let lastSnapDetails = await transacationChargesModel.getLastSnapDetails2(where);
            console.log(`Last Snap Date for wallet ID ${txn?.wallet_id}: ${lastSnapDetails.last_snap_date}`);

            let where_closing = {
              wallet_id: txn?.wallet_id,
              snap_date: moment(to_date, 'YYYY-MM-DD').format('YYYY-MM-DD')
            }
            console.log("🚀 ~ where:", where)

            //Get last snapshot date from "from_date"
            let lastSnapDetailsClosing = await transacationChargesModel.getLastSnapDetails2(where_closing);
            console.log(`Last closing Snap Date for wallet ID ${txn?.wallet_id}: ${lastSnapDetailsClosing.last_snap_date}`);

            let snapshot_condition = {
              page: 1,
              per_page: 10,
              snap_date: lastSnapDetails?.last_snap_date ? lastSnapDetails?.last_snap_date : '',
              wallet_id: txn?.wallet_id,
            };
            // console.log("🚀 ~ snapshot_condition:", snapshot_condition)
            let snapshot_response1 = await charges_invoice_models.get_snapshot_balance(snapshot_condition);
            // console.log("🚀 ~ snapshot_response for:" + txn?.wallet_id + ' ', snapshot_response1)
            let opening_balance = 0;
            if (snapshot_response1?.status == 200 && snapshot_response1?.data.length > 0) {
              opening_balance = snapshot_response1?.data?.[0]?.balance;
            }

            snapshot_condition = {
              page: 1,
              per_page: 10,
              snap_date: lastSnapDetailsClosing?.last_snap_date ? lastSnapDetailsClosing?.last_snap_date : '',
              wallet_id: txn?.wallet_id,
            };
            // console.log("🚀 ~ snapshot_condition:", snapshot_condition)
            let snapshot_response2 = await charges_invoice_models.get_snapshot_balance(snapshot_condition);
            // console.log("🚀 ~ snapshot_response for:" + txn?.wallet_id + ' ', snapshot_response2)
            let closing_balance = 0;
            if (snapshot_response2?.status == 200 && snapshot_response2?.data.length > 0) {
              closing_balance = snapshot_response2?.data?.[0]?.balance;
            }
            
            let final_response = {
              wallet_id: txn?.wallet_id,
              sub_merchant_id: txn?.sub_merchant_id != undefined && txn?.sub_merchant_id != 0 ? txn?.sub_merchant_id : null,
              receiver_id: txn?.receiver_id != undefined ? txn?.receiver_id : null,
              order_id: txn?.order_id,
              transaction_id: txn?.transaction_id,
              order_status: txn?.order_status,
              transaction_status: txn?.transaction_status,
              currency: txn?.currency,
              amount: txn?.amount,
              net_amount: txn?.net_amount,
              txn_reference: txn?.txn_reference,
              reason: txn?.reason,
              opening_balance: opening_balance,
              closing_balance: closing_balance,
              from_date: from_date,
              to_date: to_date,
              created_at: txn?.created_at,
              updated_at: txn?.updated_at,
            }

            final_response_list.push(final_response);
          }

          var response_obj = {
            message: final_response_list?.length > 0 ? "Found wallet statement" : "No wallet statement found" || "",
            status: "success",
            code: "00",
            data: final_response_list,
            pagination: result?.pagination,
          };

          res
            .status(statusCode.ok)
            .send(response_obj);

        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  get_snapshot_balance: async (req, res) => {

    const condition = req.body;
    console.log("🚀 ~ condition:", condition)

    charges_invoice_models.get_snapshot_balance(condition).then(async (result) => {
        console.log("🚀 ~ .then ~ result:", result);
        if (result?.status == 200) {

          let final_response_list = [];
          console.log("🚀 ~ result?.data:", result?.data?.length)
          for(let txn of result?.data){
            
            let final_response = {
              wallet_id: txn?.wallet_id,
              sub_merchant_id: txn?.sub_merchant_id != undefined && txn?.sub_merchant_id != 0 ? txn?.sub_merchant_id : null,
              receiver_id: txn?.receiver_id != undefined ? txn?.receiver_id : null,
              currency: txn?.currency,
              total_balance: txn?.total_balance,
              balance: txn?.balance,
              pending_balance: txn?.pending_balance,
              snap_date: txn?.snap_date,
              created_at: txn?.created_at,
            }

            final_response_list.push(final_response);
          }

          var response_obj = {
            message: "Snapshot found",
            status: "success",
            code: "00",
            data: final_response_list,
            pagination: result?.pagination,
          };

          res
            .status(statusCode.ok)
            .send(response_obj);

        } else {
          res
            .status(statusCode.ok)
            .send(response.errormsg(result?.message));
        }
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    try {
      let sub_merchant_id = req.bodyString("sub_merchant_id");
      let receiver_id = req.bodyString("receiver_id");

      let update_payload = {
        beneficiary_id: receiver_id,
      };

      const condition = {sub_merchant_id: sub_merchant_id};
      console.log("🚀 ~ manage: ~ updating:", update_payload);
      console.log("🚀 ~ manage: ~ condition:", condition);

      WalletModel.update(update_payload, condition)
        .then((result) => {
          console.log("🚀 ~ result:", result)
          if (result?.status == 200) {
            res
              .status(statusCode.ok)
              .send(response.successansmsg("Wallet update successfully."));
          } else {
            res
              .status(statusCode.badRequest)
              .send(response.successmsg(result?.message));
          }
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

function getRandom8to10DigitNumber() {
  const min = 10000000;       // 8-digit minimum
  const max = 9999999999;     // 10-digit maximum
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = wallet;
