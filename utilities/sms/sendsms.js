const axios = require('axios');
const tlClient = axios.create({
    baseURL: "https://api.textlocal.in/",
    params: {

    }
});
let smsSender = {

    sendOtp: async (mobile,otp,ref_no1,ref_no2) => {
        const params = new URLSearchParams();
        params.append('username','---');
        params.append('hash','---');
        params.append(
            "message",
            otp+` is the verification code to sign up with FDS. Ref. #`+ref_no1+`. DO NOT share this code with anyone including our agents. @ www.fds.in `+ref_no2
        );
        params.append('sender','SMSSENDER')
        params.append("numbers", "91" + mobile);
        params.append("test",'0');
        tlClient.post("/send", params).then((response)=>{
        }).catch((error)=>{ 
           
        });
    }
}
module.exports = smsSender;