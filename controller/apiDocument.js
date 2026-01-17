const apiDocumentModel = require("../models/apiDocumentModel");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

var resp = {
    getApiDocumentationOld: async (req, res) => {
        try {
            apiDocumentModel
                .selectForDocumentation()
                .then((result) => {
                    let send_res = [];
                    console.log("API Documentation records fetched:", result);
                    if (Array.isArray(result)) {
                        result.forEach((val) => {
                            send_res.push({
                                type: val.type,
                                url: val.url,
                                urlTest: val.urlTest,
                                title: val.title,
                                name: val.name,
                                description: val.description,
                                group: val.group,
                                version: val.version,
                                filename: val.filename,
                                groupTitle: val.groupTitle,
                                header: val.header,
                                parameter: val.parameter,
                                examples: val.examples,
                                success: val.success,
                                error: val.error,
                            });
                        });
                    }

                    res
                        .status(statusCode.ok)
                        .send(
                            response.successdatamsg(
                                send_res,
                                "API documentation data fetched successfully."
                            )
                        );
                })
                .catch((error) => {
                    logger.error(500, { message: error.message, stack: error.stack });
                    res
                        .status(statusCode.internalError)
                        .send(response.errormsg(error.message));
                });
        } catch (error) {
            logger.error(500, { message: error.message, stack: error.stack });
            res
                .status(statusCode.internalError)
                .send(response.errormsg("Internal server error"));
        }
    },

    getApiDocumentation: async (req, res) => {
        try {
            const result = await apiDocumentModel.selectForDocumentation();

            const safeParse = (value) => {
                if (!value) return null;
                if (typeof value === "object") return value;
                try {
                    return JSON.parse(value);
                } catch (e) {
                    logger.error("JSON parse failed", { value });
                    return null;
                }
            };

            const send_res = Array.isArray(result)
                ? result.map((val) => ({
                    type: val.type || "",
                    url: val.url || "",
                    urlTest: val.urlTest || "",
                    title: val.title || "",
                    name: val.name || "",
                    description: val.description || "",
                    group: val.group || "",
                    version: val.version || "1.0.0",
                    filename: val.filename || "",
                    groupTitle: val.groupTitle || "",

                    // 🔑 parsed fields
                    header: safeParse(val.header),
                    parameter: safeParse(val.parameter),
                    examples: safeParse(val.examples),
                    success: safeParse(val.success),
                    error: safeParse(val.error),
                }))
                : [];

            return res
                .status(statusCode.ok)
                .send(
                    response.successdatamsg(
                        send_res,
                        "API documentation data fetched successfully."
                    )
                );
        } catch (error) {
            logger.error(500, { message: error.message, stack: error.stack });
            return res
                .status(statusCode.internalError)
                .send(response.errormsg("Internal server error"));
        }
    },

    add: async (req, res) => {
        try {
            const getJsonField = (data) => {
                if (!data) return null;
                if (typeof data === 'object') return JSON.stringify(data);
                if (typeof data === 'string') {
                    try {
                        JSON.parse(data);
                        return data;
                    } catch (e) {
                        console.error("Invalid JSON string:", data);
                        return null;
                    }
                }
                return null;
            };

            const ins_body = {
                name: req.bodyString("name"),
                title: req.bodyString("title"),
                description: req.bodyString("description"),
                method: req.bodyString("method"),
                url: req.bodyString("url"),
                url_test: req.bodyString("url_test"),
                api_group: req.bodyString("api_group"),
                group_title: req.bodyString("group_title"),
                version: req.bodyString("version"),
                filename: req.file ? req.file.filename : req.bodyString("filename"),
                headers: getJsonField(req.body.headers),
                parameters: getJsonField(req.body.parameters),
                examples: getJsonField(req.body.examples),
                success_response: getJsonField(req.body.success_response),
                error_response: getJsonField(req.body.error_response),
                status: 1,
            };

            await apiDocumentModel.add(ins_body);
            await admin_activity_logger.add(
                {
                    user: req.user.id,
                    admin_type: req.user.type,
                    module: "Settings",
                    sub_module: "API Documentation",
                },
                "API Documentation",
                req.headers
            );
            return res
                .status(statusCode.ok)
                .send(response.successmsg("API Document added successfully."));
        } catch (error) {
            logger.error(500, { message: error.message, stack: error.stack });
            return res
                .status(statusCode.internalError)
                .send(response.errormsg("Internal server error"));
        }
    },

    list: async (req, res) => {
        console.log("ApiDocument Controller: list called", req.body);
        try {
            let limit = {
                perpage: 0,
                start: 0,
            };

            const perpageRaw = req.bodyString("perpage");
            const pageRaw = req.bodyString("page");

            if (perpageRaw && pageRaw) {
                let perpage = parseInt(perpageRaw);
                let start = parseInt(pageRaw);

                limit.perpage = perpage;
                limit.start = (start - 1) * perpage;
            }

            let filter_arr = {};

            if (req.bodyString("name")) {
                filter_arr.name = req.bodyString("name");
            }

            apiDocumentModel
                .select(filter_arr, limit)
                .then(async (result) => {
                    let send_res = [];

                    if (Array.isArray(result)) {
                        result.forEach((val) => {
                            send_res.push({
                                id: enc_dec.cjs_encrypt(val.id),
                                name: val.name,
                                title: val.title,
                                method: val.method,
                                url: val.url,
                                group_title: val.group_title,
                                status: val.status == 1 ? "Active" : "Inactive",
                                updated_at: val.updated_at,
                            });
                        });
                    }

                    let total_count = await apiDocumentModel.get_count(filter_arr);
                    res
                        .status(statusCode.ok)
                        .send(
                            response.successdatamsg(
                                send_res,
                                "List fetched successfully.",
                                total_count
                            )
                        );
                })
                .catch((error) => {
                    logger.error(500, { message: error, stack: error.stack });
                    res
                        .status(statusCode.internalError)
                        .send(response.errormsg(error.message));
                });
        } catch (error) {
            logger.error(500, { message: error, stack: error.stack });
            res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
        }
    },

    details: async (req, res) => {
        try {
            let id = enc_dec.cjs_decrypt(req.bodyString("id"));

            apiDocumentModel
                .selectOne("*", {
                    id: id,
                })
                .then((val) => {
                    if (!val) {
                        return res
                            .status(statusCode.badRequest)
                            .send(response.errormsg("Record not found"));
                    }

                    if (val.headers) val.headers = JSON.parse(val.headers);
                    if (val.parameters) val.parameters = JSON.parse(val.parameters);
                    if (val.examples) val.examples = JSON.parse(val.examples);
                    if (val.success_response)
                        val.success_response = JSON.parse(val.success_response);
                    if (val.error_response)
                        val.error_response = JSON.parse(val.error_response);

                    res.status(statusCode.ok).send(
                        response.successdatamsg(
                            {
                                id: enc_dec.cjs_encrypt(val.id),
                                name: val.name,
                                title: val.title,
                                description: val.description,
                                method: val.method,
                                url: val.url,
                                url_test: val.url_test,
                                api_group: val.api_group,
                                group_title: val.group_title,
                                version: val.version,
                                filename: val.filename,
                                headers: JSON.stringify(val.headers),
                                parameters: JSON.stringify(val.parameters),
                                examples: JSON.stringify(val.examples),
                                success_response: JSON.stringify(val.success_response),
                                error_response: JSON.stringify(val.error_response),
                                status: val.status == 1 ? "Active" : "Inactive",
                            },
                            "Details fetched successfully."
                        )
                    );
                })
                .catch((error) => {
                    logger.error(500, { message: error, stack: error.stack });
                    res
                        .status(statusCode.internalError)
                        .send(response.errormsg(error.message));
                });
        } catch (error) {
            logger.error(500, { message: error, stack: error.stack });
            res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
        }
    },

    update: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            const oldDoc = await apiDocumentModel.selectOne("id,filename", {
                id: id,
            });

            if (!oldDoc) {
                return res
                    .status(statusCode.badRequest)
                    .send(response.errormsg("Record not found"));
            }

            const getJsonField = (data) => {
                if (!data) return null;
                if (typeof data === 'object') return JSON.stringify(data);
                if (typeof data === 'string') {
                    try {
                        JSON.parse(data);
                        return data;
                    } catch (e) {
                        console.error("Invalid JSON string:", data);
                        return null;
                    }
                }
                return null;
            };

            let insdata = {
                name: req.bodyString("name"),
                title: req.bodyString("title"),
                description: req.bodyString("description"),
                method: req.bodyString("method"),
                url: req.bodyString("url"),
                url_test: req.bodyString("url_test"),
                api_group: req.bodyString("api_group"),
                group_title: req.bodyString("group_title"),
                version: req.bodyString("version"),
                headers: getJsonField(req.body.headers),
                parameters: getJsonField(req.body.parameters),
                examples: getJsonField(req.body.examples),
                success_response: getJsonField(req.body.success_response),
                error_response: getJsonField(req.body.error_response),
            };

            if (req.file) {
                insdata.filename = req.file.filename;

                if (oldDoc.filename) {
                    const oldPath = path.join(
                        process.cwd(),
                        "public/images",
                        oldDoc.filename
                    );
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
            }

            await apiDocumentModel.updateDetails({ id: id }, insdata);

            await admin_activity_logger.edit(
                {
                    user: req.user.id,
                    admin_type: req.user.type,
                    module: "Settings",
                    sub_module: "API Documentation",
                },
                id,
                req.headers
            );

            return res
                .status(statusCode.ok)
                .send(response.successmsg("API Document updated successfully"));
        } catch (error) {
            logger.error(500, { message: error.message, stack: error.stack });
            return res
                .status(statusCode.internalError)
                .send(response.errormsg("Internal server error"));
        }
    },

    delete: async (req, res) => {
        try {
            let id = enc_dec.cjs_decrypt(req.bodyString("id"));

            const doc = await apiDocumentModel.selectOne(["id"], { id: id });
            if (!doc) {
                return res
                    .status(statusCode.badRequest)
                    .send(response.errormsg("Record not found"));
            }

            await apiDocumentModel.deleteById({ id: id });

            admin_activity_logger
                .delete(
                    {
                        user: req.user.id,
                        admin_type: req.user.type,
                        module: "Settings",
                        sub_module: "API Documentation",
                    },
                    id,
                    req.headers
                )
                .then(() => {
                    res
                        .status(statusCode.ok)
                        .send(response.successmsg("API Document deleted successfully"));
                });
        } catch (error) {
            logger.error(500, { message: error, stack: error.stack });
            res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
        }
    },

    changeStatus: async (req, res) => {
        try {
            const id = enc_dec.cjs_decrypt(req.bodyString("id"));
            const status = req.bodyString("status"); // Active | Inactive

            if (!["Active", "Inactive"].includes(status)) {
                return res
                    .status(statusCode.badRequest)
                    .send(response.errormsg("Invalid status value"));
            }

            const doc = await apiDocumentModel.selectOne(["id", "status"], {
                id: id,
            });

            if (!doc) {
                return res
                    .status(statusCode.badRequest)
                    .send(response.errormsg("Record not found"));
            }

            const statusInt = status === "Active" ? 1 : 0;
            await apiDocumentModel.updateDetails({ id: id }, { status: statusInt });

            try {
                if (
                    admin_activity_logger &&
                    typeof admin_activity_logger === "function"
                ) {
                    await admin_activity_logger({
                        user: req.user.id,
                        admin_type: req.user.type,
                        module: "Settings",
                        sub_module: "API Documentation",
                        action: "CHANGE_STATUS",
                        reference_id: id,
                        old_status: doc.status == 1 ? "Active" : "Inactive",
                        new_status: status,
                        headers: req.headers,
                    });
                }
            } catch (logError) {
                logger.warn("Activity log failed", logError.message);
            }

            return res
                .status(statusCode.ok)
                .send(
                    response.successmsg(
                        `API Document ${status.toLowerCase()} successfully`
                    )
                );
        } catch (error) {
            logger.error(500, {
                message: error.message,
                stack: error.stack,
            });

            return res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
        }
    },
};

module.exports = resp;
