const axios = require("axios");

class telrPaymentServiceClass {
  async authenticationSetup(authsetupBody) {
    const config = {
      method: "post",
      url: `${process.env.STATIC_URL}/api/v1/telr/authentication`,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
      data: authsetupBody,
    };

    const makeRequest = await axios(config);
    return makeRequest?.data
  }  

  async authorizationSetup(authsetupBody) {
    const config = {
      method: "post",
      url: `${process.env.STATIC_URL}/api/v1/telr/authorization`,
      headers: {
        xusername: process.env.X_Username,
        xpassword: process.env.X_Password,
      },
      data: authsetupBody,
    };

    const makeRequest = await axios(config);
    return makeRequest?.data
  }
}

const telrPaymentService = new telrPaymentServiceClass();
module.exports = telrPaymentService;
