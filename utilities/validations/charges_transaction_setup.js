const Joi = require('joi').extend(require('@joi/date'));
const ServerResponse = require('../response/ServerResponse');
const StatusCode = require('../statuscode/index');
const checkEmpty = require('./emptyChecker');
const checkifrecordexist = require('./checkifrecordexist')
const enc_dec = require("../decryptor/decryptor");
const { required } = require('joi');
const checkerwithcolumn = require('./checkerwithcolumn');
const checktransaction = require('./check_transaction');
const checkerpaymentMode = require('./check_paymentmode');
const checkmcc = require("./checkechatgesType")


const transaction = {
    add: async (req, res, next) => {

        if (req.body.charges_type == "Slab" || req.body.charges_type == "volume_Base") {
            if (checkEmpty(req.body, ["psp", "mcc", "currency", "payment_mode","card_scheme","mcp_activation_fee", "mid_setup_fee", " mid_annual_fee", "monthly_tpv", "monthly_margin", "charges_type"])) {
                const schema = Joi.object().keys({
                    plan_name: Joi.string().min(1).max(100).trim().required().error(() => {
                        return new Error("Plan name required")
                    }),
                    psp: Joi.string().min(1).max(100).trim().required().error(() => {
                        return new Error("PSP required")
                    }),
                    mcc: Joi.string().min(1).max(500).trim().required().error(() => {
                        return new Error("MCC required")
                    }),
                    currency: Joi.string().min(1).max(10).trim().required().error(() => {
                        return new Error("currency required")
                    }),
                    payment_mode: Joi.string().min(1).max(1000).trim().required().error(() => {
                        return new Error("payment mode required")
                    }),
                    card_scheme: Joi.string().min(1).max(1000).trim().optional().allow('').error(() => {
                        return new Error("card scheme required.")
                    }),
                    mcp_activation_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MCP activation fee required")
                    }),
                    mid_setup_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID setup fee required")
                    }),
                    mid_annual_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID annual fee required")
                    }),
                    per_of_tr_val_fraud: Joi.number().greater(0).less(100).required().error(() => {
                        return new Error("percent of transaction value in fraud engine required")
                    }),
                    fixed_amount_fraud: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in fraud engine required")
                    }),
                    per_of_tr_val_refund: Joi.string().required().error(() => {
                        return new Error("percent of transaction value in refund required")
                    }),
                    fixed_amount_refund: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in refund required")
                    }),
                    per_of_tr_val_processing: Joi.number().greater(0).less(100).required().error(() => {
                        return new Error("percent of transaction value in processing fee required")
                    }),
                    fixed_amount_processing: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in processing fee required")
                    }),
                    monthly_tpv: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("monthly tpv required")
                    }),
                    monthly_margin: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("monthly margin required")
                    }),
                    charges_type: Joi.string().min(1).max(15).valid("Slab", "Flat", "volume_Base").required().error(() => {
                        return new Error("charges type ('Slab or Flat or volume_Base') required")
                    }),
                    // transaction_type: Joi.string().min(1).max(20).valid("Domestic", "International").required().error(() => {
                    //     return new Error("Valid transaction type ('Domestic or International') required")
                    // }),
                    max_international_transaction_volume: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("international transaction volume required")
                    }),
                    buy_sell: Joi.array().items({
                        buy_from_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("from amount required")
                        }),
                        buy_to_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("to amount required")
                        }),
                        buy_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        buy_fix_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        buy_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        buy_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("buy max charges required")
                        }),
                        buy_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("buy tax charges should be greater than 1 and less than 100")
                        }),
                        transaction_type: Joi.string().min(1).max(20).required().error(() => {
                            return new Error("transaction type required")
                        }),
                        sell_from_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("from amount required")
                        }),
                        sell_to_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("to amount required")
                        }),
                        sell_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        sell_fixed_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        sell_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        sell_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("sell max charges required")
                        }),
                        sell_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("sell tax charges should be greater than 1 and less than 100")
                        }),
                    }),
                    // sell: Joi.array().items({
                    //     sell_from_amount: Joi.string().min(1).max(7).required().error(() => {
                    //         return new Error("Valid from amount required")
                    //     }),
                    //     sell_to_amount: Joi.string().min(1).max(7).required().error(() => {
                    //         return new Error("Valid to amount required")
                    //     }),
                    //     sell_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                    //         return new Error("Valid charges in percent required")
                    //     }),
                    //     sell_fixed_amount: Joi.string().min(1).max(7).required().error(() => {
                    //         return new Error("Valid fixed amount required")
                    //     }),
                    //     sell_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                    //         return new Error("Valid min charges required")
                    //     }),
                    //     sell_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                    //         return new Error("Valid max charges required")
                    //     }),
                    //     sell_tax: Joi.number().greater(1).less(100).required().error(() => {
                    //         return new Error("Valid max charges required")
                    //     }),
                    //     transaction_type: Joi.string().min(1).max(20).required().error(() => {
                    //         return new Error("Valid transaction type required")
                    //     }),
                    // }),
                })
                try {
                    const result = schema.validate(req.body);

                    if (result.error) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                    } else {
                        let psp = await enc_dec.cjs_decrypt(req.bodyString('psp'))
                        // let plan_exist = await checkifrecordexist({ 'psp': req.bodyString('psp') }, 'charges_transaction_setup');
                        // let mcc_id = await enc_dec.cjs_decrypt(req.bodyString('mcc'));
                        let mcc = req.bodyString("mcc");
                        let textParts = mcc.split(',');
                        let textParts1;
                        let mcc_id=[];
                        for (let i = 0; i < textParts.length; i++) {
                            textParts1 = await enc_dec.cjs_decrypt(textParts[i]);
                            // let spl = (textParts1.shift());
                            
                            mcc_id.push(textParts1);
                        }
                        let mcc_exist = await checktransaction(mcc_id, psp, req.bodyString("charges_type"),req.bodyString("payment_mode") );
                        

                        let payment_mode_exist = await checkerpaymentMode(req.bodyString("payment_mode"), psp)
                        // let charges_type_exist = await checkchargesType({ 'charges_type': req.bodyString('charges_type')}, 'charges_transaction_setup');
                        if (!mcc_exist) {
                            next();
                        } else {
                            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(mcc_exist ? 'mcc code already exist' : ""));
                        }
                    }
                } catch (error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
                }

            } else {
                res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
            }
        }
        else if (req.body.charges_type == "Flat") {
            if (checkEmpty(req.body, ["psp", "mcc", "currency", "payment_mode", "mcp_activation_fee", "mid_setup_fee", " mid_annual_fee", "monthly_tpv", "monthly_margin", "charges_type"])) {
                const schema = Joi.object().keys({
                    plan_name: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("Plan name required")
                    }),
                    psp: Joi.string().min(1).max(100).trim().required().error(() => {
                        return new Error("PSP required")
                    }),
                    mcc: Joi.string().min(1).max(500).trim().required().error(() => {
                        return new Error("MCC required")
                    }),
                    currency: Joi.string().min(1).max(10).trim().required().error(() => {
                        return new Error("currency required")
                    }),
                    payment_mode: Joi.string().min(1).max(1000).trim().required().error(() => {
                        return new Error("payment mode required")
                    }),
                    mcp_activation_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MCP activation fee required")
                    }),
                    mid_setup_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID setup fee required")
                    }),
                    mid_annual_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID annual fee required")
                    }),
                    per_of_tr_val_fraud: Joi.number().greater(0).less(100).required().error(() => {
                        return new Error("percent of transaction value in fraud engine required")
                    }),
                    fixed_amount_fraud: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in fraud engine required")
                    }),
                    per_of_tr_val_refund: Joi.number().greater(0).less(100).required().error(() => {
                        return new Error("percent of transaction value in refund required")
                    }),
                    fixed_amount_refund: Joi.string().min(1).max(4).trim().required().error(() => {
                        return new Error("fixed amount in refund required")
                    }),
                    per_of_tr_val_processing: Joi.number().greater(0).less(100).required().error(() => {
                        return new Error("percent of transaction value in processing fee required")
                    }),
                    fixed_amount_processing: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in processing fee required")
                    }),
                    monthly_tpv: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("monthly tpv required")
                    }),
                    monthly_margin: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("monthly margin required")
                    }),
                    charges_type: Joi.string().min(1).max(15).valid("Slab", "Flat", "Volume_Base").required().error(() => {
                        return new Error("charges type ('Slab or Flat or volume_Base') required")
                    }),
                    // transaction_type: Joi.string().min(1).max(20).valid("Domestic", "International").required().error(() => {
                    //     return new Error("Valid transaction type ('Domestic or International') required")
                    // }),
                    max_international_transaction_volume: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("international transaction volume required")
                    }),
                    buy_sell: Joi.array().items({
                        buy_from_amount: Joi.string().optional().allow(""),
                        buy_to_amount: Joi.string().optional().allow(""),
                        buy_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        buy_fix_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        buy_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        buy_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        buy_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("buy tax  charges should be greater than 1 and less than 100")
                        }),
                        transaction_type: Joi.string().min(1).max(20).required().error(() => {
                            return new Error("transaction type required")
                        }),
                        sell_from_amount: Joi.string().optional().allow(""),
                        sell_to_amount: Joi.string().optional().allow(""),
                        sell_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        sell_fixed_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        sell_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        sell_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        sell_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("sell tax charges should be greater than 1 and less than 100")
                        }),
                    }),
                })
                try {
                    const result = schema.validate(req.body);

                    if (result.error) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                    } else {
                        let psp = await enc_dec.cjs_decrypt(req.bodyString('psp'))
                        // let plan_exist = await checkifrecordexist({ 'psp': req.bodyString('psp'), "charges_type": req.bodyString("charges_type") }, 'charges_transaction_setup');
                        // let mcc_id = await enc_dec.cjs_decrypt(req.bodyString('mcc'));

                        let mcc = req.bodyString("mcc");
                        let textParts = mcc.split(',');
                        let textParts1;
                        let mcc_id=[];
                        for (let i = 0; i < textParts.length; i++) {
                            textParts1 = await enc_dec.cjs_decrypt(textParts[i]);
                            // let spl = (textParts1.shift());
                            
                            mcc_id.push(textParts1);
                        }

                        let mcc_exist = await checktransaction(mcc_id, psp, req.bodyString("charges_type"), req.bodyString("payment_mode"));
                      

                        let payment_mode_exist = await checkerpaymentMode(req.bodyString("payment_mode"), psp, req.bodyString("charges_type"))

                        
                        // let charges_type_exist = await checkchargesType({ 'charges_type': req.bodyString('charges_type')}, 'charges_transaction_setup');
                        if (!mcc_exist ) {
                            next();
                        } else {
                            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(mcc_exist ? 'mcc code already exist' : " "));
                        }
                    }
                } catch (error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
                }

            } else {
                res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
            }
        }

    },

    details: async (req, res, next) => {
        if (checkEmpty(req.body, ["setup_id"])) {

            const schema = Joi.object().keys({
                setup_id: Joi.string().min(2).max(100).required().error(() => {
                    return new Error("Setup id Required")
                })
            })

            try {
                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {
                    let record_exist = await checkifrecordexist({ 'id': enc_dec.cjs_decrypt(req.bodyString('setup_id'))}, 'charges_transaction_setup');

                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found.'));
                    }
                }

            } catch (error) {

                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    update: async (req, res, next) => {

        if (req.body.charges_type == "Slab" || req.body.charges_type == "volume_Base") {
            if (checkEmpty(req.body, ["psp", "mcc", "currency", "payment_mode", "card_scheme","mcp_activation_fee", "mid_setup_fee", " mid_annual_fee", "monthly_tpv", "monthly_margin", "charges_type"])) {

                const schema = Joi.object().keys({
                    setup_id: Joi.string().min(2).max(300).required().error(() => {
                        return new Error("transaction setup id Required")
                    }),
                    plan_name: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("Plan name Required")
                    }),
                    psp: Joi.string().min(1).max(100).trim().required().error(() => {
                        return new Error("PSP Required")
                    }),
                    mcc: Joi.string().min(1).max(500).trim().required().error(() => {
                        return new Error("MCC required.")
                    }),
                    currency: Joi.string().min(1).max(20).trim().required().error(() => {
                        return new Error("currency required.")
                    }),
                    payment_mode: Joi.string().min(1).max(1000).trim().required().error(() => {
                        return new Error("payment mode required.")
                    }),
                    card_scheme: Joi.string().min(1).max(1000).trim().optional().allow('').error(() => {
                        return new Error("card scheme required.")
                    }),
                    mcp_activation_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MCP activation fee required")
                    }),
                    mid_setup_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID setup fee required")
                    }),
                    mid_annual_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID annual fee required")
                    }),
                    per_of_tr_val_fraud: Joi.string().min(1).max(3).trim().required().error(() => {
                        return new Error("percent of transaction value in fraud engine required")
                    }),
                    fixed_amount_fraud: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in fraud engine required")
                    }),
                    per_of_tr_val_refund: Joi.string().min(1).max(3).trim().required().error(() => {
                        return new Error("percent of transaction value in refund required")
                    }),
                    fixed_amount_refund: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in refund required")
                    }),
                    per_of_tr_val_processing: Joi.number().max(100).required().error(() => {
                        return new Error("percent of transaction value in processing fee required")
                    }),
                    fixed_amount_processing: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in processing fee required")
                    }),
                    monthly_tpv: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("monthly tpv required")
                    }),
                    monthly_margin: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("monthly margin required")
                    }),
                    charges_type: Joi.string().min(1).max(4).valid("Slab", "Flat", "volume_Base").required().error(() => {
                        return new Error("charges type required")
                    }),
                    // transaction_type: Joi.string().min(1).max(20).valid("Domestic", "International").required().error(() => {
                    //     return new Error("Valid transaction type required")
                    // }),
                    max_international_transaction_volume: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("international transaction volume required")
                    }),
                    buy_sell: Joi.array().items({
                        id: Joi.string().optional().allow("").error(() => {
                            return new Error("id Required")
                        }),
                        buy_from_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("from amount required")
                        }),
                        buy_to_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("to amount required")
                        }),
                        buy_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        buy_fix_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        buy_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        buy_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        buy_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("buy tax charges should be greater than 1 and less than 100")
                        }),
                        transaction_type: Joi.string().min(1).max(20).required().error(() => {
                            return new Error("transaction type required")
                        }),
                        sell_from_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("from amount required")
                        }),
                        sell_to_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("to amount required")
                        }),
                        sell_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        sell_fixed_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        sell_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        sell_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        sell_tax: Joi.number().greater(-1).less(100).required().error(() => {
                            return new Error("sell-tax charges should be greater than or equal to 0 and less than 100")
                        }),
                    }),
                })
                try {
                    const result = schema.validate(req.body);
                    if (result.error) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                    } else {
                        let mcc_id = await enc_dec.cjs_decrypt(req.bodyString('mcc'));
                        record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                        let psp = await enc_dec.cjs_decrypt(req.bodyString('psp'));
                        let record_exist = await checkifrecordexist({ 'id': record_id }, 'charges_transaction_setup');
                        // let psp_exist = await checkifrecordexist({ 'psp': psp, "charges_type": req.bodyString("charges_type"), 'id !=': record_id }, 'charges_transaction_setup');
                        

                        let mcc_exist = await checkmcc(record_id, 'mcc', mcc_id, 'payment_mode', req.bodyString('payment_mode'), 'psp', psp, 'charges_transaction_setup');

                        // let payment_mode_exist = await checkmcc(record_id, 'payment_mode', req.bodyString('payment_mode'), 'charges_transaction_setup');

                        if (record_exist && !mcc_exist) {
                            next();
                        } else {
                            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse( mcc_exist ? 'MCC already exist' : 'Invalid id.'));
                        }
                    }

                } catch (error) {
                    
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
                }
            } else {
                res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
            }
        }
        else  {
            if (checkEmpty(req.body, ["psp", "mcc", "currency", "payment_mode", "mcp_activation_fee", "mid_setup_fee", " mid_annual_fee", "monthly_tpv", "monthly_margin", "charges_type"])) {

                const schema = Joi.object().keys({
                    setup_id: Joi.string().min(2).max(300).required().error(() => {
                        return new Error("transaction setup id Required")
                    }),
                    plan_name: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("Plan name Required")
                    }),
                    psp: Joi.string().min(1).max(100).trim().required().error(() => {
                        return new Error("PSP Required")
                    }),
                    mcc: Joi.string().min(1).max(500).trim().required().error(() => {
                        return new Error("MCC required.")
                    }),
                    currency: Joi.string().min(1).max(20).trim().required().error(() => {
                        return new Error("currency required.")
                    }),
                    payment_mode: Joi.string().min(1).max(1000).trim().required().error(() => {
                        return new Error("payment_mode required.")
                    }),
                    mcp_activation_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MCP activation fee required")
                    }),
                    mid_setup_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID setup fee required")
                    }),
                    mid_annual_fee: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("MID annual fee required")
                    }),
                    per_of_tr_val_fraud: Joi.string().min(1).max(3).trim().required().error(() => {
                        return new Error("percent of transaction value in fraud engine required")
                    }),
                    fixed_amount_fraud: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in fraud engine required")
                    }),
                    per_of_tr_val_refund: Joi.string().required().error(() => {
                        return new Error("percent of transaction value in refund required")
                    }),
                    fixed_amount_refund: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in refund required")
                    }),
                    per_of_tr_val_processing: Joi.string().min(1).max(3).trim().required().error(() => {
                        return new Error("percent of transaction value in processing fee required")
                    }),
                    fixed_amount_processing: Joi.string().min(1).max(7).trim().required().error(() => {
                        return new Error("fixed amount in processing fee required")
                    }),
                    monthly_tpv: Joi.string().min(1).max(50).trim().required().error(() => {
                        return new Error("monthly tpv required")
                    }),
                    monthly_margin: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("monthly margin required")
                    }),
                    charges_type: Joi.string().min(1).max(4).valid("Slab", "Flat", "volume_Base").required().error(() => {
                        return new Error("charges type required")
                    }),
                    // transaction_type: Joi.string().min(1).max(20).valid("Domestic", "International").required().error(() => {
                    //     return new Error("Valid transaction type required")
                    // }),
                    max_international_transaction_volume: Joi.string().min(1).max(4).required().error(() => {
                        return new Error("international transaction volume required")
                    }),
                    buy_sell: Joi.array().items({
                        id: Joi.string().optional().allow("").error(() => {
                            return new Error("id Required")
                        }),
                        buy_from_amount: Joi.string().optional().allow(""),
                        buy_to_amount: Joi.string().optional().allow(""),
                        buy_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        buy_fix_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        buy_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        buy_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        buy_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("buy tax  charges should be greater than 1 and less than 100")
                        }),
                        transaction_type: Joi.string().min(1).max(20).required().error(() => {
                            return new Error("transaction type required")
                        }),
                        sell_from_amount: Joi.string().optional().allow(""),
                        sell_to_amount: Joi.string().optional().allow(""),
                        sell_per_charges: Joi.number().greater(0).less(100).required().error(() => {
                            return new Error("charges in percent required")
                        }),
                        sell_fixed_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("fixed amount required")
                        }),
                        sell_min_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("min charges required")
                        }),
                        sell_max_charge_amount: Joi.string().min(1).max(7).required().error(() => {
                            return new Error("max charges required")
                        }),
                        sell_tax: Joi.number().greater(1).less(100).required().error(() => {
                            return new Error("sell tax charges should be greater than 1 and less than 100")
                        }),
                    }),
                })
                try {
                    const result = schema.validate(req.body);
                    if (result.error) {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                    } else {
                        let mcc_id = await enc_dec.cjs_decrypt(req.bodyString('mcc'));
                        record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                        let psp = await enc_dec.cjs_decrypt(req.bodyString('psp'));
                        let record_exist = await checkifrecordexist({ 'id': record_id }, 'charges_transaction_setup');
                        let psp_exist = await checkifrecordexist({ 'psp': psp, "charges_type": req.bodyString("charges_type"), 'id !=': record_id }, 'charges_transaction_setup');

                        let mcc_exist = await checkmcc(record_id, 'mcc', mcc_id, 'payment_mode', req.bodyString('payment_mode'), 'psp', psp, 'charges_transaction_setup');

                        let payment_mode_exist = await checkmcc(record_id, 'payment_mode', req.bodyString('payment_mode'), 'charges_transaction_setup');

                        if (record_exist && !mcc_exist ) {
                            next();
                        } else {
                            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse( mcc_exist ? 'MCC already exist' : 'Invalid id'));
                        }
                    }

                } catch (error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
                }
            } else {
                res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
            }
        }
    },
    deactivate: async (req, res, next) => {

        if (checkEmpty(req.body, ["setup_id"])) {

            const schema = Joi.object().keys({
                setup_id: Joi.string().min(10).required().error(() => {
                    return new Error("transaction setup id required")
                }),
            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 0 }, 'charges_transaction_setup');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already deactivated.'));
                    }
                }

            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    slab_deactivate: async (req, res, next) => {

        if (checkEmpty(req.body, ["id"])) {

            const schema = Joi.object().keys({
                id: Joi.string().min(10).required().error(() => {
                    return new Error("id required")
                }),
            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    record_id = enc_dec.cjs_decrypt(req.bodyString('id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 0 }, 'charges_transaction_slab');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already deactivated.'));
                    }
                }

            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },


    activate: async (req, res, next) => {

        if (checkEmpty(req.body, ["setup_id"])) {

            const schema = Joi.object().keys({
                setup_id: Joi.string().min(10).required().error(() => {
                    return new Error("transaction setup id required")
                }),
            })

            try {

                const result = schema.validate(req.body);
                if (result.error) {
                    res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
                } else {

                    record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                    let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 1 }, 'charges_transaction_setup');
                    if (record_exist) {
                        next();
                    } else {
                        res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already activated.'));
                    }
                }
            } catch (error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error));
            }

        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.badRequest);
        }
    },

    slab_range: async (req, res, next) => {
        const schema = Joi.object().keys({

            buy: Joi.array().items(

                Joi.object().keys({
                    from_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("valid from amount required")
                    }),
                    to_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("valid to amount required")
                    }),
                    charges_in_percent: Joi.string().optional().allow(""),
                    fixed_amount: Joi.string().optional().allow(""),
                    min_charges: Joi.string().optional().allow(""),
                    max_charges: Joi.string().optional().allow(""),
                    tax_in_percent: Joi.string().optional().allow(""),
                })

            ),
            sell: Joi.array().items(

                Joi.object().keys({
                    from_amount: Joi.number().required().error(() => {
                        return new Error("from amount in sell required")
                    }),
                    to_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("to amount in sell required")
                    }),
                    charges_in_percent: Joi.string().optional().allow(""),
                    fixed_amount: Joi.string().optional().allow(""),
                    min_charges: Joi.string().optional().allow(""),
                    max_charges: Joi.string().optional().allow(""),
                    tax_in_percent: Joi.string().optional().allow(""),
                })

            ),
            setup_id: Joi.string().min(10).required().error(() => {
                return new Error("Valid transaction setup id required")
            }),

        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {

                // record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                // let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 1 }, 'charges_transaction_setup');
                // if (record_exist) {
                next();
                // } else {
                //     res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already activated.'));
                // }
            }


        } catch (error) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error.message));
        }
    },

    slab_update: async (req, res, next) => {
        const schema = Joi.object().keys({
            buy: Joi.array().items(

                Joi.object().keys({
                    id: Joi.string().min(1).max(20).required().error(() => {
                        return new Error("ID required")
                    }),
                    from_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("from amount required")
                    }),
                    to_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("to amount required")
                    }),
                    charges_in_percent: Joi.string().optional().allow(""),
                    fixed_amount: Joi.string().optional().allow(""),
                    min_charges: Joi.string().optional().allow(""),
                    max_charges: Joi.string().optional().allow(""),
                    tax_in_percent: Joi.string().optional().allow(""),
                })

            ),
            sell: Joi.array().items(

                Joi.object().keys({
                    id: Joi.string().min(1).max(20).trim().required().error(() => {
                        return new Error("ID required")
                    }),
                    from_amount: Joi.number().required().error(() => {
                        return new Error("from amount in sell required")
                    }),
                    to_amount: Joi.string().min(1).max(7).required().error(() => {
                        return new Error("to amount in sell required")
                    }),
                    charges_in_percent: Joi.string().optional().allow(""),
                    fixed_amount: Joi.string().optional().allow(""),
                    min_charges: Joi.string().optional().allow(""),
                    max_charges: Joi.string().optional().allow(""),
                    tax_in_percent: Joi.string().optional().allow(""),
                })

            ),
            setup_id: Joi.string().min(10).required().error(() => {
                return new Error("Valid transaction setup id required")
            }),



        })
        try {
            const result = schema.validate(req.body);
            if (result.error) {
                res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(result.error.message));
            } else {

                // record_id = enc_dec.cjs_decrypt(req.bodyString('setup_id'));
                // let record_exist = await checkifrecordexist({ 'id': record_id, 'status': 1 }, 'charges_transaction_setup');
                // if (record_exist) {
                next();
                // } else {
                //     res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Record not found or already activated.'));
                // }
            }


        } catch (error) {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse(error.message));
        }
    },

}
module.exports = transaction