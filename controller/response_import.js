const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const response_import_model = require("../models/response_import_model");
require("dotenv").config({ path: "../.env" });
const xlsx = require("xlsx");
const winston = require('../utilities/logmanager/winston');

const inv = {
    import: async (req, res) => {
        try {
            var workbook = xlsx.readFile("public/docs/" + req.body.doc, {
                dateNF: "yyyy-mm-dd",
            });
            var worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            let data = xlsx.utils.sheet_to_json(worksheet, {
                raw: false,
                defval: "",
            });

            console.log(data);
            let data_array = [];
           for(let record of data){
            let temp = {
                response_code:record.response_code,
                response_details:record.response_details,
                response_type:record.response_type,
                soft_hard_decline:record.soft_hard_decline,
                psp_name: record.psp_name,
                psp_response_code: record.psp_response_code,
                psp_response_details: record.psp_response_details,
                category:record.category
            }
            data_array.push(temp);
           }
            let uploadRes = await response_import_model.add(data_array);
            res.status(statusCode.ok).send(
                response.successmsg("Data imported successfully.")
            );
           
            // for (let i = 0; i < data.length; i++) {
            //     await response_import_model
            //         .add(data[i])
            //         .then((result) => {
                        
            //         })
            //         .catch((error) => {
            //             winston.error(error);
            //         });
            // }
            
        } catch (error) {
            winston.error(error);
            res.status(statusCode.internalError).send(
                response.errormsg(error.message)
            );
        }
    },
};

module.exports = inv;
