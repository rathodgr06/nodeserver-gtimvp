var CryptoJS = require("crypto-js");
const { v4: uuidv4 } = require("uuid");
 
 const  RequestMaker = (method, url, body,key,secret)=> {
    var ClientRequestId = uuidv4();
    var time = new Date().getTime();
    var requestBody = JSON.stringify(body);
    if(method === 'GET') {
      requestBody = '';
    }  
    var rawSignature = key + ClientRequestId + time + requestBody;
    var computedHash = CryptoJS.algo.HMAC.create(
      CryptoJS.algo.SHA256,
      secret.toString()
    );
    computedHash.update(rawSignature);
    computedHash = computedHash.finalize();
    var computedHmac = CryptoJS.enc.Base64.stringify(computedHash);
  
    var options = {
      method: method,
      url,
      headers: {
        "Content-Type": "application/json",
        "Client-Request-Id": ClientRequestId,
        "Api-Key": key,
        "Timestamp": time.toString(),
        "Message-Signature": computedHmac
      },
      body: JSON.stringify(body),
    };
  
    return options;
  }
  module.exports = RequestMaker;