module.exports = function (data, logo, title) {
  
  let status_row = ``;
  if (data.invoice.invoice_details.status == 'Paid' || data.invoice.invoice_details.status == 'paid') {
    status_row = `          
      <tr>
      <td colspan="4" style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important"></td>
      <td style="text-align: right;border-bottom: solid 1px #111; border-left: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">Status: </td>
      <td style="text-align: right;border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${data.invoice.invoice_details.status}</td>
      </tr>`;
  }

  let rowData = "";
  for (val of data.invoice.items) {

    let rows = `<tr>
        <td style="text-align: left; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important;
        -ms-word-break: break-all; /* Be VERY careful with this, breaks normal words wh_erever */ 
word-break: break-all; /* Non standard for webkit */ 
word-break: break-word; 
-webkit-hyphens: auto; 
-moz-hyphens: auto; 
hyphens: auto;">${val.item_name}<br>
        ${val.item_description ? val.item_description : ''}</td>
        <td style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${val.item_rate}</td>
        <td style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${val.quantity}</td>
        <td style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${val.discount_per}</td>
        <td style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${val.tax_per}</td>
        <td style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${val.total_amount}</td>
    </tr>`;
    rowData = rowData + " " + rows;
  }

  
  return `<table style="border: solid 1px #111; width: 100%;" cellspacing="0" cellpadding="0">
    <tr style="border-bottom: solid 1px #111"> 
        <td style="width: 75%; border-bottom: solid 1px #111; text-align: left; padding: 10px;">
<img src="${data.invoice.merchant_details.logo
    }"  alt="${data.invoice.merchant_details.company_name}" style="height: 60px; width: auto;">
        </td>
        <td style="text-align: left; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important" >
        Merchant Invoice Ref.: <b>${data.invoice.invoice_details.merchant_invoice_no}</b><br>
        </td>
        
        </tr>
<tr>
<td style="text-align: left; width: 75%; border-bottom: solid 1px #111; padding: 10px; font-family: arial; font-size: 10px !important">
${data.invoice.merchant_details.company_name}<br>
${data.invoice.merchant_details.address_line1}<br>
${data.invoice.merchant_details.state_name}, ${data.invoice.merchant_details.country_name
    }<br>
${data.invoice.merchant_details.co_email} ,${data.invoice.merchant_details.co_mobile_code
    } ${data.invoice.merchant_details.co_mobile}
</td>
<td style="text-align: left; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">
    Pymt Inv. No.:${data.invoice.invoice_details.invoice_no}<br>
    Issued Date:${data.invoice.invoice_details.issue_date}<br>
    Expiry Date:${data.invoice.invoice_details.expiry_date}
</td>
</tr>
​
<tr>
    <td style="text-align: left; vertical-align: top; width: 75%; border-bottom: solid 1px #111;  padding: 10px; font-family: arial; font-size: 10px !important">
        <b>Invoice To</b>:<br>
        ${data.invoice.invoice_details.customer_title} ${data.invoice.invoice_details.customer_name
    }
      <br>
  ${data.invoice.invoice_details.customer_mobile_code} ${data.invoice.invoice_details.customer_mobile}<br>
  ${data.invoice.invoice_details.customer_email}<br>
      ${data.invoice.invoice_details.billing_address.address ? data.invoice.invoice_details.billing_address.address + ', ' : ' '}${data.invoice.invoice_details.billing_address.city ? data.invoice.invoice_details.billing_address.city : ''}<br>
      ${data.invoice.invoice_details.billing_address.state ? data.invoice.invoice_details.billing_address.state : ''
    }<br>
    ${data.invoice.invoice_details.billing_address.country ? data.invoice.invoice_details.billing_address.country + ', ' : ' '}${data.invoice.invoice_details.billing_address.zip_code ? data.invoice.invoice_details.billing_address.zip_code : ''
    }
    </td>
    <td style="text-align: left; vertical-align: top; border-bottom: solid 1px #111;  padding: 10px; font-family: arial; font-size: 10px !important">
        <b>Shipping Details</b>:<br>
        ${data.invoice.invoice_details.shipping_address.address ? data.invoice.invoice_details.shipping_address.address + ', ' : ''} ${data.invoice.invoice_details.shipping_address.city ? data.invoice.invoice_details.shipping_address.city : ''}<br>
        ${data.invoice.invoice_details.shipping_address.state ? data.invoice.invoice_details.shipping_address.state + ', ' : ' '
    }<br>
      ${data.invoice.invoice_details.shipping_address.country ? data.invoice.invoice_details.shipping_address.country + ', ' : ' '}${data.invoice.invoice_details.shipping_address.zip_code ? data.invoice.invoice_details.shipping_address.zip_code : ' '
    }
    </td>
    </tr>
    <td style="text-align: left; vertical-align: top; " colspan="2">
    <table style="width: 100%;"   cellspacing="0" cellpadding="0">
<tr>
<th style="text-align: left; width: 60%; border-bottom: solid 1px #111;padding: 10px; font-family: arial">ITEM AND DESCRIPTION</th>
<th style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial">RATE</th>
<th style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial">QUANTITY</th>
<th style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial">DISCOUNT%</th>
<th style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial">TAX%</th>
<th style="text-align: right; border-bottom: solid 1px #111;padding: 10px; font-family: arial">TOTAL</th>
</tr>
    ${rowData}
       
<td colspan="3" style="text-align: left;padding: 10px; font-family: arial; font-size: 10px !important"></td>
<td style="text-align: left;border-bottom: solid 1px #111; border-left: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">SUBTOTAL: </td>
<td colspan="2"  style="text-align: right;border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important"> ${data.invoice.invoice_details.currency} ${data.invoice.subtotal
    }</td>
</tr>
<tr>
    <td colspan="3" style="text-align: left;padding: 10px; font-family: arial; font-size: 10px !important"></td>
    <td style="text-align: left;border-bottom: solid 1px #111; border-left: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">DISCOUNT(-): </td>
    <td colspan="2"  style="text-align: right;border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${data.invoice.invoice_details.currency} ${data.invoice.invoice_details.total_discount
    }</td>
    </tr>
    <tr>
        <td colspan="3" style="text-align: left; padding: 10px; font-family: arial; font-size: 10px !important"></td>
        <td style="text-align: left;border-bottom: solid 1px #111; border-left: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">TAX(+): </td>
        <td colspan="2"  style="text-align: right;border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important"> ${data.invoice.invoice_details.currency} ${data.invoice.invoice_details.total_tax
    }</td>
        </tr>
        <tr>
            <td colspan="3" style="text-align: left; border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important"></td>
            <td style="text-align: left;border-bottom: solid 1px #111; border-left: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">TOTAL: </td>
            <td colspan="2"  style="text-align: right;border-bottom: solid 1px #111;padding: 10px; font-family: arial; font-size: 10px !important">${data.invoice.invoice_details.currency} ${Number(data.invoice.invoice_details.total_amount).toFixed(2)
    }</td>
            </tr>
            ${status_row}
           </table>
        </td>
       
        </tr>
        <tr>
        <td colspan="2" style="text-align: left;border-bottom: solid 1px #111; padding: 10px; font-family: arial; font-size: 10px !important">
                <b>Description or summary:</b>${data.invoice.invoice_details.description
      ? data.invoice.invoice_details.description
      : "N/A"
    }
            </td>
        </tr>
        <tr>
            <td colspan="2" style="text-align: left;border-bottom: solid 1px #111; padding: 10px; font-family: arial; font-size: 10px !important">
                <b>Special Note:</b> ${data.invoice.invoice_details.note
      ? data.invoice.invoice_details.note
      : "N/A"
    }
                </td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: left;border-bottom: solid 1px #111; padding: 10px; font-family: arial; font-size: 10px !important">
                    <b>Payment Terms:</b> ${data.invoice.invoice_details.payment_terms
      ? data.invoice.invoice_details.payment_terms
      : "N/A"
    }
                    </td>
                </tr>
<tr>

    
    <td colspan="2" style="text-align: center;padding: 10px; padding-bottom: 20px; font-family: arial; font-size: 10px !important; border-bottom: solid 1px #111;">
       <b>Scan and Pay</b> <br>
        <img src="${data.qr_url
    }" style="height: 150px"><br>
        or <br><br><br>
        <a href="${data.download
    }" style=" margin-top:5px;font-weight: 600; font-size: 14px; line-height: 100%; --text-opacity: 1; color: #FFFFFF; border-radius: 3px; text-decoration: none; padding: 0.8em 30px; border: 1px solid #ccc; background-color: #4C64E6  ; width: 150px; text-align: center;" target="_blank" rel="noreferrer">Download Invoice</a>
        <a href="${data.pay_url
    }" style="  margin-top:5px;font-weight: 600; font-size: 14px; line-height: 100%; --text-opacity: 1; color: #FFFFFF; border-radius: 3px; text-decoration: none; padding: 0.8em 30px; border: 1px solid #ccc; background-color: #4C64E6  ; width: 150px; text-align: center;" target="_blank" rel="noreferrer">Proceed To Pay</a>
    </td>
</tr>

 
<tr>

    
    <td colspan="2" style="text-align: center; padding: 10px; font-family: arial; font-size: 10px !important">
        This invoice is computer generated and therefore does not require any signature.
    </td>
</tr>
</table>`;

};
