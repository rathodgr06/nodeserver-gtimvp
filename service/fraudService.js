const axios = require("axios");

class fraudServiceClass {

    async make3dsFraudCheck(fraudCheckBody){
        const config = {
            method: "post",
            url: `${process.env.FRAUD_URL}/api/v1/merchant/check-3ds-rule`,
            headers: {
              xusername: '074E1F9E8KF87HJDF8DF09DDD3A377760',
              xpassword: '54607074E1F9E8KF87HJDF8DF09DDD',
            },
            data: fraudCheckBody,
          };
      
          const makeRequest = await axios(config);
          return makeRequest?.data
    }


    async voidTransaction(requestBody){
        const config = {
            method: "post",
            url: `${process.env.STATIC_URL}/api/v1/orders/refund-void-new`,
            headers: {
              xusername: process.env.X_Username,
              xpassword: process.env.X_Password,
            },
            data: requestBody,
          };
      
          const makeRequest = await axios(config);
          return makeRequest?.data
    }
}

const fraudService = new fraudServiceClass();
module.exports = fraudService;
