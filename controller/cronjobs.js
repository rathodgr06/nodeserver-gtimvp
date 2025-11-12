const cipherModel = require("../models/cipher_models");
const cardExpiryModel = require("../models/card_expiry_model");
const uuid = require('uuid');
const moment = require('moment');
const enc_dec = require("../utilities/decryptor/decryptor");
const mailSender = require("../utilities/mail/mailsender");
const { log } = require("winston");
const checkSubscription = require('../utilities/validations/subscription_check');
const ServerResponse = require("../utilities/response/ServerResponse");
const axios = require("axios");
const date_formatter = require("../utilities/date_formatter/index"); // date formatter module
let cron = {
  addSecret: async () => {
    const cipher_key = uuid.v4().substring(0, 16) + (Math.random() + 1).toString(36).substring(7);
    let userData = {
      "is_active": 0
    };
    let expiryDate =await date_formatter.current_date();
    await cipherModel.updateInSecret({ ['expiry_date <=']:expiryDate  }, userData);
    const insBody = {
      private_key: enc_dec.key_encrypt(cipher_key),
      private_iv: enc_dec.key_encrypt(cipher_key),
      is_active: 1,
      expiry_date: await date_formatter.add_days_by_days(90) // expiryDate.add(90, 'days').format('YYYY-MM-DD')
    };
    await cipherModel.addInSecreat(insBody, 'secret_key');
    return;
  },
  addSecretTest: async (req, res) => {
    const cipher_key = uuid.v4().substring(0, 16) + (Math.random() + 1).toString(36).substring(7);
    let userData = {
      "is_active": 0
    };
    let expiryDate =await date_formatter.current_date();
    await cipherModel.updateInSecret({ ['expiry_date <=']:expiryDate  }, userData);
    const insBody = {
      private_key: enc_dec.key_encrypt(cipher_key),
      private_iv: enc_dec.key_encrypt(cipher_key),
      is_active: 1,
      expiry_date: await date_formatter.add_days_by_days(90) // expiryDate.add(90, 'days').format('YYYY-MM-DD')
    };
    result = await cipherModel.addInSecreat(insBody, 'secret_key');
    return res.send(result);
  },
  checkCardAboutToExpireRequest: async (req, res) => {
    const result = checkCardAboutToExpire();
    return res.status(200).send(result);
  },
  checkCardAboutToExpireCron: async () => {
    checkCardAboutToExpire();
    return true;
  },
  checkCardExpiredRequest: async (req, res) => {
    const result = checkCardExpired();
    return res.status(200).send(result);
  },
  checkCardExpiredCron: async () => {
    checkCardExpired();
    return true;
  },
 
  sendBlockCardEmail: async (order_id, subject) => {
    const result = await cardExpiryModel.getBlockCardDetail(order_id);
    if (result && Object.keys(result).length) {
      const data = { ...result };
     
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);

      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

      data.html = await blockString(data, false, 'We wanted to give you a heads-up that your card subscription recurring failed.');
      const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
      
      data.payHtml = await payUrl(plan_link_url);
      data.subject = subject;

      await mailSender.CardExpiryMailToCustomer(data);
    }
  },
  sendBlockCardEmailToMerchant: async (order_id, subject) => {
    const result = await cardExpiryModel.getBlockCardDetail(order_id);
    if (result && Object.keys(result).length) {
      const data = { ...result };
     
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);

      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

      data.html = await blockString(data, true, 'We wanted to give you a heads-up that your customer subscription recurring failed.');
      data.subject = subject;

      await mailSender.CardExpiryMailToMerchant(data, false);
    }
  },
  sendCardExpiredEmail: async (subscription_id) => {
    const result = await cardExpiryModel.getExpiredCardDetail(subscription_id);
    if (Object.keys(result).length) {
      const data = { ...result };
     
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);

      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

      data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is set to expired in ');
      const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
      
      data.payHtml = await payUrl(plan_link_url);
      data.subject = 'Card is expired';

      await mailSender.CardExpiryMailToCustomer(data);
    }
  },
  sendCardAboutExpiredEmail: async (subscription_id) => {
    const result = await cardExpiryModel.getExpiredCardDetail(subscription_id);
    if (Object.keys(result).length) {
      const data = { ...result };
     
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);

      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');
      data.company_name = data.company_name
      data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is about to expired in ');
      const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
      
      data.payHtml = await payUrl(plan_link_url);
      data.subject = 'Card is about to expired';

      await mailSender.CardExpiryMailToCustomer(data);
    }
  },
  sendDeclinedCardsEmail: async (subscription_id) => {
    const result = await cardExpiryModel.DeclinedCards(subscription_id);
    if (Object.keys(result).length) {
      const data = { ...result };
     
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);
      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry
      data.company_name = data.company_name
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');
      data.reason = data.remark
      data.html = await DeclinedString(data, true, 'We wanted to give you a heads-up that your card is declined');
      const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
      
      data.payHtml = await payUrl(plan_link_url);
      data.subject = 'Card is declined';

      await mailSender.CardExpiryMailToCustomer(data);
    }
  },
};

function maskCardNumber(cardNumber) {
  // Check if the input is a string and contains at least 4 characters
  if (typeof cardNumber === 'string' && cardNumber.length >= 4) {
    const last4Digits = cardNumber.slice(-4); // Get the last 4 digits
    const maskedDigits = '*'.repeat(cardNumber.length - 4); // Create stars for the rest
    return maskedDigits + last4Digits; // Combine stars and last 4 digits
  }
}

function makeString(data, is_merchant = false, expText = null) {
  return new Promise((resolve, reject) => {
    let text, name;

    if (is_merchant) {
      name = data.company_name;
      text = `To prevent any disruptions to your services, please contact your customer`
    } else {
      name = data.customer_name;
      text = `To prevent any disruptions to your services, please contact your bank or card issuer at your earliest convenience to request a replacement card.`
    }

    const html = `<p>Dear ${name},</p>
      <p>We hope you're doing well.</p>
      <p>${expText}${data.month}.</p>
      <p>Merchant Name: ${data.company_name}</p>
      <p>Cardholder Name: ${data.customer_name}</p>
      <p>Credit Card Number: ${data.card_number}</p>
      <p>Expiry Date: ${data.card_expiry}</p>
      <p>Plan Name: ${data.plan_name}</p>
      <p>${text}</p>
    `;

    if (html) {
      resolve(html);
    } else {
      reject('Failed to generate HTML');
    }
  });
}

function blockString(data, is_merchant = false, expText = null) {
  return new Promise((resolve, reject) => {
    let text, name, merchant_name = '';

    if (is_merchant) {
      name = data.company_name;
      text = `To prevent any disruptions to your services, please contact your customer.`;
    } else {
      merchant_name = `<p>Merchant Name: ${data.company_name}</p>`;
      text = `To prevent any disruptions to your services, please contact your bank or card issuer at your earliest convenience to request a replacement card.`;

      name = data.customer_name;
    }

    const html = `<p>Dear ${name},</p>
      <p>We hope you're doing well.</p>
      <p>${expText}.</p>
      ${merchant_name}
      <p>Cardholder Name: ${data.customer_name}</p>
      <p>Credit Card Number: ${data.card_number}</p>
      <p>Expiry Date: ${data.card_expiry}</p>
      <p>Plan Name: ${data.plan_name}</p>
      <p>${text}</p>
    `;

    if (html) {
      resolve(html);
    } else {
      reject('Failed to generate HTML');
    }
  });
}
function DeclinedString(data, is_merchant = false, expText = null) {
  return new Promise((resolve, reject) => {
    let name;
    name = data.customer_name;
    text = `To prevent any disruptions to your services, please contact your bank or card issuer at your earliest convenience to request a replacement card.`;
    const html = `<p>Dear ${name},</p>
      <p>We hope you're doing well.</p>
      <p>${expText}.</p>
      <p>Merchant Name: ${data.company_name}</p>
      <p>Cardholder Name: ${data.customer_name}</p>
      <p>Credit Card Number: ${data.card_number}</p>
      <p>Expiry Date: ${data.card_expiry}</p>
      <p>Plan Name: ${data.plan_name}</p>
      <p>Reason: ${data.reason}</p>
      <p>${text}</p>
    `;

    if (html) {
      resolve(html);
    } else {
      reject('Failed to generate HTML');
    }
  });




}
async function payUrl(url) {

  return `<td style="margin-top:10px;mso-padding-alt: 16px 24px; --bg-opacity: 1; background-color: #00389D;border-radius: 4px; font-family: Montserrat, -apple-system, 'Segoe UI', sans-serif;" >
  <a href="${url}" style="display: block; font-weight: 600; font-size: 14px; line-height: 100%; --text-opacity: 1;  color: #FFF;border-radius:3px; text-decoration: none;padding: 0.8em 30px;border: 1px solid #ccc;background-color:#00389D ;">Update Now →</a>                         
  </td>`;
}

async function checkCardAboutToExpire() {

  const result = await cardExpiryModel.getAboutToExpireCards();

  if (result.length === 0) {
    return "No data found";
  }

  const promises = result.map(async (data) => {
   
    let subscription_result = await checkSubscription.checkForSubscriptionRecurring(data.subscription_id);

    if (subscription_result && Object.keys(subscription_result).length > 0 && subscription_result.unpaid_recurring > 0) {
      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry;
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

      //send mail to merchant
      data.html = await makeString(data, true, 'We wanted to give you a heads-up that your customer is about to expire in ');
      data.subject = 'Card is about expire'
      await mailSender.CardExpiryMailToMerchant(data);

      //send mail to customer
      data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is about to expire in ');
      await mailSender.CardExpiryMailToCustomer(data);

      // Use Promise.all to parallelize the mail sending tasks
      // await Promise.all([
      //   mailSender.CardExpiryMailToMerchant(data),
      //   mailSender.CardExpiryMailToCustomer(data),
      // ]);
    }
  });

  await Promise.all(promises);

  
  return 'Executed successfully.';



  /*
  //old code
  const result = await cardExpiryModel.getAboutToExpireCards();

  if (result.length == 0) {
    return "No data found";
  }

  for (const key in result) {
    if (Object.hasOwnProperty.call(result, key)) {
      const data = { ...result[key] };
     
      let subscription_result = await checkSubscription.checkForSubscriptionRecurring(data.subscription_id);
      if (subscription_result && Object.keys(subscription_result).length > 0 && subscription_result.unpaid_recurring > 0) {
        card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
        
        data.card_number = maskCardNumber(card_number);
        data.card_expiry = data.card_expiry
        data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

        data.html = await makeString(data, true, 'We wanted to give you a heads-up that your customer is about to expire in ');
        data.subject = 'Card is about expire'
        await mailSender.CardExpiryMailToMerchant(data);
        //send mail to customer
        data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is about to expire in ');
        await mailSender.CardExpiryMailToCustomer(data);
      }
    }
  }
  
  return 'Executed successfully.';
  */
}

async function checkCardExpired() {
  const result = await cardExpiryModel.getExpiredCard();
  if (result.length === 0) {
    return 'No data found';
  }

  const promises = result.map(async (data) => {
   

    const card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
    const subscription = enc_dec.cjs_encrypt(data.subscription_id);
    const subscription_result = await checkSubscription.checkForSubscriptionRecurring(data.subscription_id);
    if (subscription_result && Object.keys(subscription_result).length > 0 && subscription_result.unpaid_recurring > 0) {
      data.card_number = maskCardNumber(card_number);
      data.card_expiry = data.card_expiry;
      data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');

      data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is set to expire in ');
      const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
      
      data.payHtml = await payUrl(plan_link_url);
      data.subject = 'Card is expired';

      await mailSender.CardExpiryMailToCustomer(data);
    }
  });

  await Promise.all(promises);

  
  return 'Executed successfully.';

  /*
  //old code
  
  const result = await cardExpiryModel.getExpiredCard();

  if (result.length == 0) {
    return 'No data found';
  }

  
  for (const key in result) {
    if (Object.hasOwnProperty.call(result, key)) {
      const data = { ...result[key] };
     

      card_number = await enc_dec.dynamic_decryption(data.card_number, data.cipher_id);
      let subscription = enc_dec.cjs_encrypt(data.subscription_id);
      let subscription_result = await checkSubscription.checkForSubscriptionRecurring(data.subscription_id);
      if (subscription_result && Object.keys(subscription_result).length > 0 && subscription_result.unpaid_recurring > 0) {
        
        data.card_number = maskCardNumber(card_number);
        data.card_expiry = data.card_expiry
        data.month = moment(data.card_expiry, 'MM/YYYY').format('MMMM');


        data.html = await makeString(data, false, 'We wanted to give you a heads-up that your card is set to expired in ');
        const plan_link_url = `${process.env.PAYMENT_URL}subscription/update/${subscription}`;
        
        data.payHtml = await payUrl(plan_link_url);
        data.subject = 'Card is expired';

        await mailSender.CardExpiryMailToCustomer(data);
      }
    }
    
  }

  
  return 'Executed successfully.';
  */
}
module.exports = cron;