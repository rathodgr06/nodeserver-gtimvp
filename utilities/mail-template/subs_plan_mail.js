module.exports = function (data, logo, title) {
    return (
        `<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

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
        <link href="https://fonts.googleapis.com/css?family=Montserrat:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700" rel="stylesheet" media="screen">
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
        </style>
    </head>
    
    <body style="margin: 0; padding: 0; width: 100%; word-break: break-word; -webkit-font-smoothing: antialiased; --bg-opacity: 1; background-color: #eceff1; background-color: rgba(236, 239, 241, var(--bg-opacity));">
    
        <div role="article" aria-roledescription="email" aria-label="Welcome to ` +
        title +
        `" lang="en">
            <table style="font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; width: 100%;" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tbody>
                    <tr>
                        <td align="center" style="--bg-opacity: 1; background-color: #eceff1; background-color: rgba(236, 239, 241, var(--bg-opacity)); font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif;" bgcolor="rgba(236, 239, 241, var(--bg-opacity))">
                            <table class="sm-w-full" style="font-family: 'Montserrat',Arial,sans-serif; width: 600px; border: solid 1px #ccc; border-radius: 10px;" width="600" cellpadding="0" cellspacing="0" role="presentation">
                                <tbody>
                                    <tr>
                                        <td>
                                            <img src="${data.merchant_logo}" style="margin-left: 20px; height: 50px; text-align: left;" alt="${data.merchant_name}">
                                        </td>
                                        <td class="sm-py-32 sm-px-24" style="font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; padding: 20px 20px 20px 10px; text-align: right;" align="center">
                                            <a href="javascript:;">
                                                <img src="` +
        logo +
        `" width="155" alt="` +
        title +
        `" style="border: 0; max-width: 100%; line-height: 100%; vertical-align: middle;">
                                            </a>
                                        </td>
    
                                    </tr>
                                    <tr>
                                        <td colspan="2" style="text-align: center;">
                                            <h2>Subscription plan details</h2>
                                        </td>
    
                                    </tr>
    
                                    <tr>
                                        <td align="center" colspan="2" class="sm-px-24" style="font-family: 'Montserrat',Arial,sans-serif;">
                                            <table style="font-family: 'Montserrat',Arial,sans-serif; width: 100%;border:1px solid #ccc;border-radius:5px;" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                                <tbody>
                                                    <tr>
                                                        <td style="padding: 10px 48px 10px 20px; width: 50%;">
                                                            <p style="margin: 24px 0;">
                                                                <b style="color: #263238 !important;">Plan Name</b>
                                                                <br><br> ${data.plan_name}
                                                            </p>
                                                        </td>
                                                        <td style="vertical-align: middle; text-align: right; padding-right: 20px;">
                                                        <b style="color: #263238 !important;">Installment amount</b> <br><br>
                                                          ${data.currency} ${data.amount}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colspan="2" class="sm-px-24" style="--bg-opacity: 1; background-color: #ffffff; background-color: rgba(255, 255, 255, var(--bg-opacity)); border-radius: 4px; font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 24px; padding: 10px 48px 48px 20px; text-align: left; --text-opacity: 1; color: #626262; color: rgba(98, 98, 98, var(--text-opacity));"
                                                            bgcolor="rgba(255, 255, 255, var(--bg-opacity))" align="left">
    
                                                            <p class="sm-leading-32" style="font-weight: 600; font-size: 20px; margin: 0 0 24px; --text-opacity: 1; color: #263238; color: rgba(38, 50, 56, var(--text-opacity));">
                                                            </p>
    
                                                          
                                                            ${data.message_text}
                                                           
    
                                                            <p style="margin: 24px 0;">
                                                                <b style="color: #263238 !important;">Initial Payment Amount</b>
                                                                <br> ${data.currency} ${data.initial_payment_amount}
                                                            </p>
    
                                                            <p style="margin: 24px 0;">
                                                                <b style="color: #263238 !important;">Final Payment Amount</b>
                                                                <br> ${data.currency} ${data.final_payment_amount}
    
    
                                                            </p>
                                                            <p style="margin: 24px 0;">
                                                            <b style="color: #263238 !important;">Billing Frequency</b>
                                                            <br> ${data.plan_billing_frequency}

                                                        </p>
                                        
    
                                                            <p style="margin: 24px 0;">
                                                                <b style="color: #263238 !important;">Total Terms (how many payments to take)</b>
                                                                <br> ${data.terms}
    
                                                            </p>
                                                            <p style="margin: 24px 0;">
                                                            <b style="color: #263238 !important;">Discounted Terms </b>
                                                            <br> ${data.discounted_terms}

                                                        </p>
                                                        <p style="margin: 24px 0;">
                                                            <b style="color: #263238 !important;">Discounted Amount</b>
                                                            <br> ${data.discounted_amount}

                                                        </p>
                                                         ${data.note_text}
    
                                                           
                                                            <p style="margin: 24px 0;">
                                                                <b style="color: #263238 !important;">Start Date</b>
                                                                <br> ${data.start_date}
    
                                                            </p>
                                                            <p style="margin: 24px 0;">
                                                            <b style="color: #263238 !important;">Expiry Date</b>
                                                            <br> ${data.expiry_date}

                                                             </p>
                                                            <table style="margin-top: 30px;font-family: 'Montserrat',Arial,sans-serif;" cellpadding="0" cellspacing="0" role="presentation">
                                                            <tbody><tr>
                                                        
                                                              <td style="margin-top:10px;mso-padding-alt: 16px 24px; --bg-opacity: 1; background-color: #00389D;border-radius: 4px; font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif;" >
                                                            <a href="${data.pay_url}" style="display: block; font-weight: 600; font-size: 14px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.8em 30px;border: 1px solid #ccc;background-color:#00389D ;">Subscribe Now →</a>                         
                                                            </td>
                                                            </tr>
                                                          </tbody></table><hr>

                                                            <p style=" margin: 25px 0 -30px; ">Thanks, <br>` +
        title +
        ` Team</p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Montserrat',Arial,sans-serif; height: 20px; " height="20 "></td>
                                                    </tr>
                                                    <tr>
                                                        <td colspan="2 " style="font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif; font-size: 12px; padding-left: 48px; padding-right: 48px; --text-opacity: 1; color: #eceff1; color: rgba(236,
                                                                    239, 241, var(--text-opacity)); ">
    
                                                            <p style="--text-opacity: 1; color: #263238; color: rgba(38, 50, 56, var(--text-opacity)); ">
                                                                Use of our service and website is subject to our
                                                                <a href="`+data.tc_url+`" class="hover-underline " style="--text-opacity: 1; color: #7367f0; color: rgba(115, 103, 240, var(--text-opacity)); text-decoration: none; ">Terms
                                                                    of Use</a> and
                                                                <a href="`+data.pp_url+`" class="hover-underline " style="--text-opacity: 1; color: #7367f0; color: rgba(115, 103, 240, var(--text-opacity)); text-decoration: none; ">Privacy
                                                                    Policy</a>.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Montserrat',Arial,sans-serif; height: 16px; " height="16 "></td>
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
