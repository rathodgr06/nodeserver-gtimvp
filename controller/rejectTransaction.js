const moment = require('moment');
const merchantOrderModel = require('../models/order_transaction');
const helpers = require('../utilities/helper/general_helper');
const enc_dec = require("../utilities/decryptor/decryptor");
const { send_webhook_data } = require("./webhook_settings");
const { authCancel,orderCancel } = require("./ni");
const credientials = require("../config/credientials");
const telr_sale = require('./telr');
const axios = require('axios');
module.exports = async function rejectNon3DS(order_details, psp_response, body, browser_token_enc,mode) {
    let payment_id = await helpers.make_sequential_no(mode=='test'?'TST_TXN':"TXN");
    let order_txn = {
        status: 'FAILED',
        txn: payment_id,
        type: '3DS',
        order_id: order_details.order_id,
        amount: order_details.amount,
        currency: order_details.currency,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
    };
    let res_obj = {};
    let order_update = {
        status: 'FAILED',
        psp: order_details.psp.toUpperCase(),
        updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
    }
    let merchant_id = await helpers.get_data_list(
        "merchant_id",
        mode=='test'?'test_orders':"orders",
        { order_id: body.order_id }
    );
    let p_request_id = await helpers.make_sequential_no(mode=='test'?'TST_REQ':"REQ");
    let order_req = {
        merchant_id: order_details.merchant_id,
        order_id: order_details.order_id,
        request_id: p_request_id,
        request: JSON.stringify(body),
    };
    if(mode=='test'){
        await helpers.common_add(order_req, "test_generate_request_id");
    }else{
        await helpers.common_add(order_req, "generate_request_id");
    }
   
    
    
    switch (order_details.psp) {
        case 'NI':
            
            
            order_txn.payment_id = psp_response.reference;
            order_txn.order_reference_id = psp_response.orderReference;
            order_txn.capture_no = '';
            res_obj = {
                order_status: psp_response.state,
                reference: psp_response.reference,
                order_reference: psp_response.reference.orderReference,
                payment_id: payment_id,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                token: browser_token_enc,
                "3ds": psp_response["3ds"] ? psp_response["3ds"] : "",
                new_res: {},
            };
            break;
        case 'Telr':
            order_txn.payment_id = psp_response.tranref;
            order_txn.order_reference_id = '';
            order_txn.capture_no = '';
            res_obj = {
                order_status: 'AUTHORISED',
                reference: psp_response.tranref,
                order_reference: "",
                "3ds": {},
                payment_id: payment_id,
                order_id: order_details.order_id,
                amount: order_details.amount,
                currency: order_details.currency,
                token: browser_token_enc || "",
                new_res: {},
            }
            break;
        case 'Paytabs':
            order_txn.payment_id = psp_response.tran_ref;
            order_txn.order_reference_id = '';
            order_txn.capture_no = '';
            res_obj = {
                order_status: 'AUTHORISED',
                payment_id: psp_response.tran_ref,
                order_id: order_details?.order_id,
                amount: order_details?.amount,
                currency: order_details?.currency,
                return_url: order_details?.return_url,
                token: browser_token_enc,
                new_res: {}
            }
            break;
    }
    // update order status
    let order_update_result = await merchantOrderModel.updateDynamic(order_update, { order_id: order_details.order_id },mode=='test'?'test_orders':'orders');
    // insert txn
    let insertTxn = mode=='test'?await merchantOrderModel.test_txn_add(order_txn): await merchantOrderModel.add(order_txn);
    // call psp to void authorised
    let new_res = {
        m_order_id: order_details.merchant_order_id,
        p_order_id: order_details.order_id,
        p_request_id: p_request_id,
        psp_ref_id: psp_response.orderReference,
        psp_txn_id: psp_response.reference,
        transaction_id: payment_id,
        status: "FAILED",
        status_code: '47',
        remark:'3DSecure authentication rejected',
        currency: order_details.currency,
        amount: order_details?.amount ? order_details?.amount : "",
        m_customer_id: order_details.merchant_customer_id,
        psp: order_details.psp,
        payment_method: order_details.payment_mode,
        m_payment_token: order_details?.card_id ? order_details?.card_id : "",
        transaction_time: moment().format("DD-MM-YYYY hh:mm:ss"),
        return_url: order_details.failure_url,
        payment_method_data: {
            scheme: order_details?.scheme
                ? order_details?.scheme
                : "",
            card_country: order_details?.card_country
                ? order_details?.card_country
                : "",
            card_type: order_details?.cardType
                ? order_details?.cardType
                : "",
            mask_card_number: order_details?.pan
                ? order_details?.pan
                : "",
        },
        apm_name: "",
        apm_identifier: "",
        sub_merchant_identifier: order_details?.merchant_id
            ? await helpers.formatNumber(
                order_details?.merchant_id
            )
            : "",
    };
    res_obj.new_res = new_res;
    // call webhook
    let hook_info = await helpers.get_data_list(
        "*",
        "webhook_settings",
        {
            merchant_id: order_details.merchant_id,
        }
    );
    let web_hook_res = Object.assign({}, res_obj.new_res);
    delete web_hook_res?.return_url;
    if (hook_info[0]) {
        if (hook_info[0].enabled === 0 && hook_info[0].notification_url!='') {
            let url = hook_info[0].notification_url;
            let webhook_res = await send_webhook_data(
                url,
                web_hook_res,
                hook_info[0].notification_secret
            );
        }
    }
    // void Authorization
    const _terminalids = await merchantOrderModel.selectOne(
        "terminal_id",
        {
            order_id: order_details.order_id,
        },
        mode=='test'?'test_orders':"orders",
    );
    console.log(`Terminal Creds`);
    console.log(_terminalids);
    const _getmid = await merchantOrderModel.selectOne(
        "MID,password,psp_id",
        {
            terminal_id: _terminalids.terminal_id,
        },
        "mid"
    );
    const _pspid = await merchantOrderModel.selectOne(
        "*",
        {
            id: _getmid.psp_id,
        },
        "psp"
    );
    const _terminalcred = {
        MID: _getmid.MID,
        password: _getmid.password,
        baseurl: mode=='live'?credientials[_pspid.credentials_key].base_url:credientials[_pspid.credentials_key].test_url,
        psp_id: _getmid.psp_id,
        name: _pspid.name,
    };
    switch (order_details.psp) {

        case 'NI':
            console.log(`PSP RESPONSE`);
            console.log(psp_response)
            let capture_data = {
                orderNo: psp_response.orderReference,
                payment_id: psp_response.reference,
                capture_no: '',
            };
            if(psp_response.state=="CAPTURED"){
                capture_data.capture_no =
                psp_response?._embedded[
                  "cnp:capture"
                ][0]._links?.self?.href.split("/captures/")[1];
            }
            var ni_capture = psp_response.state=='CAPTURED'? await orderCancel(capture_data,_terminalcred): await authCancel(capture_data, _terminalcred);
            break;
        case 'Telr':
            let payload = {
                type: "void",
                class: "ecom",
                currency: order_details?.currency,
                amount: order_details?.amount,
                tranref: psp_response.tranref,
            };
            let telr_void = await telr_sale.makeVoidRequest(payload,_terminalcred);
            break;
        case 'Paytabs':
            // const _Paytabs = JSON.parse(process.env.PAYTABS);
            const body_data = {
                "profile_id": _terminalcred.MID,
                "tran_type": "void",
                "cart_description": order_details?.description,
                "tran_ref": psp_response.tran_ref,
                "cart_id": order_details.order_id,
                "cart_currency": order_details.currency,
                "cart_amount": parseFloat(order_details.amount).toFixed(2),
                "tran_class": "ecom"
            }
            const config = {
                method: "post",
                url: _terminalcred.baseurl,
                headers: {
                    'authorization': _terminalcred.password,
                },
                data: body_data,
            };
            var paytab_void = await axios(config);
            break;

    }
    // share response
    return res_obj;
}