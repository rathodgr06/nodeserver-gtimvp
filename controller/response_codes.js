const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const responseCode = require("../models/response_code");
const enc_dec = require("../utilities/decryptor/decryptor");

require("dotenv").config({ path: "../.env" });
var responseCodeRes = {
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

        let like_search = {};

        const selection_fields = [
            "response_code", "category", "response_details", "response_type", "soft_hard_decline", "psp_name", "psp_response_code", " psp_response_details",

        ];

        if (req.bodyString("search")) {
            selection_fields.forEach(element => {
                like_search[element] = req.bodyString("search");
            });
        }

        let psp = '';
        if (req.bodyString("psp")) {
            psp = req.bodyString("psp");
        }

        let result = await responseCode.select(
            selection_fields,
            limit,
            psp,
            like_search
        );
        let send_res = [];
        for (let val of result) {
            let res = {
                response_code_id: enc_dec.cjs_encrypt(val.id),
                response_code: val.response_code,
                category: val.category,
                response_details: val.response_details,
                response_type: val.response_type,
                soft_hard_decline: val.soft_hard_decline,
                psp_name: val.psp_name.toUpperCase(),
                psp_response_code: val.psp_response_code,
                psp_response_details: val.psp_response_details
            };
            send_res.push(res);
        }
        let total_count = await responseCode.get_count(psp);
        res.status(statusCode.ok).send(
            response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
            )
        );
    },
    response_types: async (req, res) => {
        let result = await responseCode.response_types();
        let psp_result = await responseCode.get_psp();
        let send_res = {};
        let types = [];
        let psp = [];

        for (let val of result) {
            types.push(val.response_type);
        }

        for (let val of psp_result) {
            let Snew = {};
            Snew = { name: val.name, key: val.credentials_key };
            psp.push(Snew);
        }

        send_res['types'] = types;
        send_res['psp'] = psp;
        res.status(statusCode.ok).send(
            response.successdatamsg(
                send_res,
                "Response Types."
            )
        );
    },
    response_code_detail: async (req, res) => {
        let response_code_id = await enc_dec.cjs_decrypt(
            req.bodyString("response_code_id")
        );
        const selection_fields = [
            "response_code", "category", "response_details", "response_type", "soft_hard_decline", "psp_name", "psp_response_code", " psp_response_details",

        ];
        let result = await responseCode.response_code_detail(response_code_id, selection_fields);
        result.response_code_id = req.bodyString("response_code_id");
        
        res.status(statusCode.ok).send(
            response.successdatamsg(
                result,
                "Response Types."
            )
        );
    },
    response_code_store: async (req, res) => {
        let id = enc_dec.cjs_decrypt(req.bodyString("response_code_id"));

        let update_data = {
            response_code: req.bodyString("response_code"),
            category: req.bodyString("category"),
            response_details: req.bodyString("response_details"),
            response_type: req.bodyString("response_type"),
            soft_hard_decline: req.bodyString("soft_hard_decline"),
            psp_name: req.bodyString("psp_name"),
            psp_response_code: req.bodyString("psp_response_code"),
            psp_response_details: req.bodyString("psp_response_details"),
        }
        
        let result = await responseCode.response_code_store({ id: id }, update_data);
        res.status(statusCode.ok).send(
            response.successdatamsg(
                result,
                "Response code updated successfully."
            )
        );

    },
    categories: async (req, res) => {
        let result = await responseCode.categories();

        res.status(statusCode.ok).send(
            response.successdatamsg(
                result,
                "Response code updated successfully."
            )
        );
    }
};
module.exports = responseCodeRes;
