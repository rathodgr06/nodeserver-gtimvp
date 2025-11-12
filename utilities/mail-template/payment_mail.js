module.exports = function (data, logo, title) {
    
    
    return (
        `
    <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

    <head>
        <meta charset="utf-8">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="x-ua-compatible" content="ie=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
        <!--[if mso]>
        <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
        <style>
          td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
        </style>
      <![endif]-->
        <title>` +
        title +
        `</title>
        <link
            href="https://fonts.googleapis.com/css?family=Montserrat:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700"
            rel="stylesheet" media="screen">
        <style>
            .hover-underline:hover {
                text-decoration: underline !important;
            }
    
            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
    
            @keyframes ping {
    
                75%,
                100% {
                    transform: scale(2);
                    opacity: 0;
                }
            }
    
            @keyframes pulse {
                50% {
                    opacity: .5;
                }
            }
    
            @keyframes bounce {
    
                0%,
                100% {
                    transform: translateY(-25%);
                    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
                }
    
                50% {
                    transform: none;
                    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
                }
            }
    
            @media (max-width: 600px) {
                .sm-leading-32 {
                    line-height: 32px !important;
                }
    
                .sm-px-24 {
                    padding-left: 24px !important;
                    padding-right: 24px !important;
                }
    
                .sm-py-32 {
                    padding-top: 32px !important;
                    padding-bottom: 32px !important;
                }
    
                .sm-w-full {
                    width: 100% !important;
                }
            }
            .paydart-logo
            {
                height: 50px;
                margin-top: 10px;
            }
              .merchant-logo
            {
                height: 50px;
                margin-top: 10px;
            }
        .qr_div_main
        {
            width: 400px;
            margin: auto;
            border: solid 1px #7367f0 !important;
            border-radius: 0.5em;
            background-color: #7367f0;
        }
        .qr_div_main .wrap
        {
            text-align: center !important;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        .qr_div
        {
            width: 70%;
            margin: auto;
            background-color: white;
            border-radius: 0.5em;
        }
        .accept_title
        {
            margin-top: 10px;
            margin-bottom: 10px;
            color: #7367f0;
        }
        .qr_image
        {
            height: 200px;
            margin-bottom: 10px;
        }
        .currency_div
        {
            background-color: #100495;
           font-size: 20px;
            margin: auto;
            padding: 10px;
            color: white;
        }
        h5.note
        {
            color: white !important;
            text-align: justify !important;
            padding: 10px;
        }
        .m-a-10 {
            margin: 10px !important;
        }
        .sub_merchant
        {
            color: white;
        }
        .m-a-10 {
            margin: 10px !important;
        }
        </style>
    </head>
    
    <body
        style="margin: 0; padding: 0; width: 100%; word-break: break-word; -webkit-font-smoothing: antialiased; --bg-opacity: 1; background-color: #eceff1; background-color: rgba(236, 239, 241, var(--bg-opacity));">
    
        <div role="article" aria-roledescription="email" aria-label="Welcome to ` +
        title +
        `" lang="en">
            <table style="font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; width: 100%;" width="100%"
                cellpadding="0" cellspacing="0" role="presentation">
                <tbody>
                    <tr>
                        <td align="center"
                            style="--bg-opacity: 1; background-color: #eceff1; background-color: rgba(236, 239, 241, var(--bg-opacity)); font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif;"
                            bgcolor="rgba(236, 239, 241, var(--bg-opacity))">
                            <table class="sm-w-full" style="font-family: 'Montserrat',Arial,sans-serif; width: 600px; border: solid 1px #ccc; border-radius: 10px;"
                                width="600" cellpadding="0" cellspacing="0" role="presentation">
                                <tbody>
                                  
                              
                                  
    
                                 
                                    <tr>
                                        <td align="center" colspan="2" class="sm-px-24"
                                            style="font-family: 'Montserrat',Arial,sans-serif;">
                                            <table
                                                style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px; margin-top:29px;"
                                                width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                                <tbody>
                                              
                                                    <tr>
                                                        <td class="sm-px-24"
                                                            style="--bg-opacity: 1; background-color: #ffffff; background-color: rgba(255, 255, 255, var(--bg-opacity)); border-radius: 4px; font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 24px; padding: 48px; text-align: left; --text-opacity: 1; color: #626262; color: rgba(98, 98, 98, var(--text-opacity));"
                                                            bgcolor="rgba(255, 255, 255, var(--bg-opacity))" align="left">
    
                                                      
                                                          
                                                            <h5 style="text-align:center">${data.merchant_name}</h5>
    
                                                         

<div class="qr_div_main" style="margin-top:5%">
  <div class="wrap" style="border: 4px solid white;border-radius: 10px;margin: 10px;padding: 10px;">
      <div class="qr_div" style="width: 80%;">
        <img class="merchant-logo" src="${data.merchant_logo}" alt="merchant logo" />
        <h2 class="accept_title m-a-10" >Scan and Pay</h2>
        <img src='${data.qr_image}' style="height: 250px;" alt="QR image" />
            <div class="currency_div">
            ${data.currency}  ${data.amount}
            </div>
    </div> 
        <div style="margin-top: 10px;color: black;">
            Powered by <br>
            <img src="` +
        logo +
        `" alt="logo" style="height: 36px; margin-top: 10px;">
        </div>

    </div>
    
</div>  

    <table style="margin-top: 30px; font-family: 'Montserrat',Arial,sans-serif;"
    cellpadding="0" cellspacing="0" role="presentation" width= "100%">
    
    <tr>
        <td style="text-align: center">
            <a href="${data.pay_url}"
            style="font-weight: 600; font-size: 14px; line-height: 100%; --text-opacity: 1;  color: #fff ;border-radius:3px; text-decoration: none;padding: 0.8em 30px;border: 1px solid #ccc;background-color:#7367f0 ;">Click here to pay </a>
        </td>
    </tr>
    
    <tr>
        <td>
            <p style="margin: 24px 0;">
                ${data.message_text}
            </p>
        </td>
    </tr>

    </table>
                                                            
                                                            
                                                            <table style="margin-top: 30px;font-family: 'Montserrat',Arial,sans-serif; border-top: solid 1px #cccccc5c !important; width: 100%;"
                                                                cellpadding="0" cellspacing="0" role="presentation">
                                                                <tbody>
                                                                    <tr>
                                                                        <td 
                                                                            style="margin-top:10px; width: 100% !important; mso-padding-alt: 16px 24px; --bg-opacity: 1; text-align: center; border-radius: 4px; font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; ">
    
                                                                        
                                                                        </td>
                                                                       
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                         
                                                            <p style="margin: 0 0 16px;">
    
                                                            </p>
                                                            <p style="margin: 0 0 16px;">Thanks, <br>` +
        title +
        ` Team</p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Montserrat',Arial,sans-serif; height: 20px;"
                                                            height="20"></td>
                                                    </tr>
                                                    <tr>
                                                        <td
                                                            style="font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; font-size: 12px; padding-left: 48px; padding-right: 48px; --text-opacity: 1; color: #eceff1; color: rgba(236, 239, 241, var(--text-opacity));">
    
                                                            <p
                                                                style="--text-opacity: 1; color: #263238; color: rgba(38, 50, 56, var(--text-opacity));">
                                                                Use of our service and website is subject to our
                                                                <a href="`+data.tc_url+`" class="hover-underline"
                                                                    style="--text-opacity: 1; color: #7367f0; color: rgba(115, 103, 240, var(--text-opacity)); text-decoration: none;">Terms
                                                                    of Use</a> and
                                                                <a href="`+data.pp_url+`" class="hover-underline"
                                                                    style="--text-opacity: 1; color: #7367f0; color: rgba(115, 103, 240, var(--text-opacity)); text-decoration: none;">Privacy
                                                                    Policy</a>.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Montserrat',Arial,sans-serif; height: 16px;"
                                                            height="16"></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    
    
    </body>
    
    </html>`
    );
};
