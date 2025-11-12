const excel = require("exceljs");

var Excel_Exporter = {
    exp: async (req, res) => {
        // db_model.select({ user_id: req.user.id }).then(async (result) => {
        //     result.map(function (element) {
        //         element.type = '__yourExportEntryTopic__';
        //         let date = new Date(element.__yourExportEntryTopic___date);
        //         element.__yourExportEntryTopic___date = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
        //     })
        //     let workbook = new excel.Workbook();
        //     let worksheet = workbook.addWorksheet("__yourExportEntryTopic__s");
        //     worksheet.columns = [
        //         { header: "__yourExportEntryTopic__ Sequence No", key: "__yourExportEntryTopic___no", width: 5 },
        //         { header: "Recipient Name", key: "company_name", width: 25 },
        //         { header: "Email ID", key: "email", width: 25 },
        //         { header: "Mobile No", key: "mobile", width: 10 },
        //         { header: "__yourExportEntryTopic__ Date", key: "__yourExportEntryTopic___date", width: 10 },
        //         { header: "Net Amount", key: "total", width: 10 },
        //         { header: "Type", key: "type", width: 10 },
        //         { header: "Status", key: "status", width: 10 },
        //     ];
        //     worksheet.addRows(result);

        //     res.setHeader(
        //         "Content-Type",
        //         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        //     );

        //     res.setHeader(
        //         "Content-Disposition",
        //         "attachment; filename=" + "__yourExportEntryTopic__.xlsx"
        //     );

        //     res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        //     res.setHeader("Content-Disposition", "attachment; filename=__yourExportEntryTopic__.xlsx");

        //     workbook.xlsx.write(res).then(function () {
        //         res.status(200).end();
        //     });

        // }).catch((error) => {
        //     res.status(statusCode.internalError)
        //         .send(response.errormsg(error.message));
        // })
    }
}
module.exports = Excel_Exporter;