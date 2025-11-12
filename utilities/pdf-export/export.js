const fs = require("fs");
const PDFDocument = require("pdfkit-table");

var PDF_Exporter = {
    invoice: async (req, res) => {
        // InvoiceModel.select({ user_id: req.user.id }).then(async (result) => {
        //     result.map(function (element) {
        //         element.type = 'Invoice';
        //         let date = new Date(element.invoice_date);
        //         element.invoice_date = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
        //     })
        //     const table = {
        //         subtitle: "Invoices",
        //         headers: [
        //             { label: "Invoice Sequence Id", property: 'invoice_no', width: 60, renderer: null },
        //             { label: "Recipient Name", property: 'company_name', width: 150, renderer: null },
        //             { label: "Email ID", property: 'email', width: 100, renderer: null },
        //             { label: "Mobile No", property: 'mobile', width: 100, renderer: null },
        //             { label: "Invoice Date", property: 'invoice_date', width: 80, renderer: null },
        //             { label: "Net Amount", property: "total", width: 80, renderer: null },
        //             { label: "Invoice Type", property: "type", width: 80, renderer: null },
        //             { label: "Invoice Status", property: "status", width: 80, renderer: null }
        //         ],
        //         divider: {
        //             label: { disabled: false, width: 2, opacity: 1 },
        //             horizontal: { disabled: false, width: 0.5, opacity: 0.5 },
        //         },
        //         datas: result,

        //     };
        //     var myDoc = new PDFDocument({ bufferPages: true, layout: 'landscape', margins: { top: 50, left: 50, right: 50, bottom: 50 }, size: 'A4' });
        //     myDoc.pipe(res);
        //     myDoc.font('Times-Roman')
        //         .fontSize(12)
        //         .table(table);
        //     myDoc.end();
        //     // res.setHeader("Content-Type", "application/pdf");
        //     res.setHeader("Content-Disposition", "attachment; filename=invoice.pdf");
        //     myDoc.pdf.write(res).then(function () {
        //         res.status(200).end();
        //     });
        // })
    }

}
module.exports = PDF_Exporter;