
const response = require("../../utilities/response/ServerResponse");
const statusCode = require("../../utilities/statuscode/index");
const PDFDocument = require("pdfkit");
const fs = require('fs');
const nodemailer = require("nodemailer");
require('dotenv').config({ path: "../../.env" });
var Download = {
    selfDetails: async (req, res, next) => {
        // CompanyModel.findsingle({ user_id: req.user.id})
        //     .then((result) => {
        //         let company_details = {};
        //         company_details.name = result.name;
        //         company_details.email = result.email;
        //         company_details.mobile = result.mobile_no;
        //         company_details.address = result.address_line1;
        //         company_details.city = result.city_name;
        //         company_details.state = result.state_name;
        //         company_details.pincode = result.pincode;
        //         company_details.logo = './public/files/' + result.logo;
        //         req.company = company_details;
        //         next();

        //     })
        //     .catch((error) => {
        //         res
        //             .status(statusCode.internalError)
        //             .send(response.errormsg(error.message));
        //     });
    }
 
}
module.exports = Download;
function generateHeader(doc, company) {
    doc
        .image(company.logo, 50, 45, { width: 50 })
        .fillColor("#444444")
        .fontSize(20)
        .text(company.name, 110, 57)
        .fontSize(10)
        .text(company.name, 200, 50, { align: "right" })
        .text(company.address, 200, 65, { align: "right" })
        .text(company.city + ',' + company.state + ',' + company.pincode, 200, 80, { align: "right" })
        .moveDown();
}
function generateCustomerInformation(doc, invoice, type) {
    doc
        .fillColor("#444444")
        .fontSize(20)
        .text(type, 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .text(type + " No:", 50, customerInformationTop)
        .font("Helvetica-Bold")
        .text(invoice.invoice_no, 150, customerInformationTop)
        .font("Helvetica")
        .text("Date:", 50, customerInformationTop + 15)
        .text(formatDate(new Date(invoice.invoice_date)), 150, customerInformationTop + 15)
        .text("Total:", 50, customerInformationTop + 30)
        .text(
            formatCurrency(invoice.total),
            150,
            customerInformationTop + 30
        )

        .font("Helvetica-Bold")
        .text(invoice.company_name, 300, customerInformationTop)
        .moveDown();

    generateHr(doc, 252);
}
function generateHr(doc, y) {
    doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}
function formatCurrency(cents) {
    return (cents).toFixed(2) + " INR";
}

function formatDate(date) {
    if(date!='0000-00-00'){
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return day + '/' + month + '/' + year;
    }else{
        return ' ';
    }

    
}


function generateInvoiceTable(doc, invoice, meta) {

    let i;
    const invoiceTableTop = 330;

    doc.font("Helvetica-Bold");
    generateTableRow(
        doc,
        invoiceTableTop,
        "Item",
        "Rate",
        "Quantity",
        "Disc(%)",
        "Subtotal"
    );
    generateHr(doc, invoiceTableTop + 20);
    doc.font("Helvetica");

    for (i = 0; i < meta.length; i++) {
        const item = meta[i];
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
            doc,
            position,
            item.item_name,
            formatCurrency(item.rate),
            item.qty,
            item.dis_percentage,
            formatCurrency(item.rate * item.qty-(item.dis_percentage>0?item.dis_percentage/100*item.rate*item.qty:0))
        );

        generateHr(doc, position + 20);
    }

    const subtotalPosition = invoiceTableTop + (i + 1) * 30;
    generateTableRow(
        doc,
        subtotalPosition,
        "",
        "",
        "Subtotal",
        "",
        formatCurrency(invoice.total)
    );

    const paidToDatePosition = subtotalPosition + 0;
    // generateTableRow(
    //     doc,
    //     paidToDatePosition,
    //     "",
    //     "",
    //     "Paid To Date",
    //     "",
    //     formatCurrency(invoice.total)
    // );

    const duePosition = paidToDatePosition + 25;
    doc.font("Helvetica-Bold");
    generateTableRow(
        doc,
        duePosition,
        "",
        "",
        "Total",
        "",
        formatCurrency(invoice.total)
    );
    doc.font("Helvetica");
}

function generateFooter(doc) {
    doc
        .fontSize(10)
        .text(
            "Thank you for your business.",
            50,
            780,
            { align: "center", width: 500 }
        );
}

function generateTableRow(
    doc,
    y,
    item,
    description,
    unitCost,
    quantity,
    lineTotal
) {
    doc
        .fontSize(10)
        .text(item, 50, y)
        .text(description, 150, y)
        .text(unitCost, 280, y, { width: 90, align: "right" })
        .text(quantity, 370, y, { width: 90, align: "right" })
        .text(lineTotal, 0, y, { align: "right" });
}
