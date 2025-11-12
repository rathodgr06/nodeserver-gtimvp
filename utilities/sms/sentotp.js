require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const sendSms =async (phone, mob_message) => {
  const client = require('twilio')(accountSid, authToken);
    let data= await client.messages.create({
       body: mob_message,
       from: twilioPhone,
       to: phone,
     })
  
      return data.sid
    
}


module.exports = sendSms;