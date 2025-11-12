require("dotenv").config({ path: "../.env" });
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
var axios = require("axios");
const xml2js = require("xml2js");
const winston = require("../utilities/logmanager/winston");

// const telr_credentials = JSON.parse(process.env.PAYMENT_URL);
var telr = {
  createSession: async (values, _terminalcred, mode) => {
    let txn_test = mode == "test" ? 1 : 0;
    let payload = ` <?xml version="1.0" encoding="UTF-8"?>
            <remote>
                <store>${_terminalcred.MID}</store>
                <key>${_terminalcred.password}</key>
                <method>setup</method>
                <tran>
                    <type>${values?.type}</type>
                    <class>ecom</class>
                    <description>${values?.description}</description>
                    <currency>${values.currency}</currency>
                    <amount>${values.amount}</amount>
                    <test>${txn_test}</test>
                    <cartid>${values.order_id}</cartid>
                </tran>
                <card>
                    <number>${values.card}</number>
                    <expiry>
                        <month>${values.expiry_month}</month>
                        <year>${values.expiry_year}</year>
                    </expiry>
                    <cvv>${values.cvv}</cvv>
                </card>
                <browser>
                    <agent>${values.agent}</agent>
                    <height>${values.height}</height>
                    <width>${values.agent}</width>
                    <accept>*/*</accept>
                </browser>
                <billing>
                    <name>
                        <title>${
                          values?.billingNameTitle
                            ? values?.billingNameTitle
                            : ""
                        }</title>
                        <first>${values.billingNameFirst}</first>
                        <last>${values.billingNameLast}</last>
                    </name>
                    <address>
                        <line1>${values.billingLine1}</line1>
                        <line2>${values.billingLine2}</line2>
                        <line3>${
                          values?.billingLine3 ? values?.billingLine3 : ""
                        }</line3>
                        <city>${values.billingCity}</city>
                        <region>${values.billingRegion}</region>
                        <country>${values.billingCountry}</country>
                        <zip>${values.billingZip}</zip>
                    </address>
                    <email>${values.email}</email>
                    <ip>${values.ip || "3.28.86.219"}</ip>
                </billing>
                <mpi>
                    <returnurl>${
                      process.env.PAYMENT_URL +
                      "result/telr/" +
                      mode +
                      "/" +
                      values.order_id
                    }</returnurl>
                </mpi>
            </remote>`;

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: _terminalcred.baseurl,
      headers: {
        "Content-Type": "application/xml",
      },
      data: payload,
    };
    console.log(`config at session`);
    console.log(config);
    const response = await axios.request(config);
    console.log(`this is payload`)
    console.log(payload);
    console.log(`this is response`);
    console.log(response.data);

    const parser = new xml2js.Parser();
    let responseObj = await parser.parseStringPromise(response.data);
    console.log(`this is response obj`);
    console.log(responseObj);

    // Extract the `session` value from the response object
    const session = responseObj?.remote?.mpi[0]?.session[0];
    //  const xid = responseObj?.remote?.mpi[0]?.xid[0];
    const scheme = responseObj?.remote?.mpi[0]?.scheme[0];

    const acsurl = responseObj?.remote?.mpi[0]?.acsurl
      ? responseObj?.remote?.mpi[0]?.acsurl[0]
      : "";
    const pareq = responseObj?.remote?.mpi[0]?.pareq
      ? responseObj?.remote?.mpi[0]?.pareq[0]
      : "";
    const level = responseObj?.remote?.mpi[0]?.level
      ? responseObj?.remote?.mpi[0]?.level[0]
      : "";
    const trace = responseObj?.remote?.mpi[0]?.trace[0];
    const redirecthtml = responseObj?.remote.mpi[0]?.redirecthtml?.[0];
    const action = responseObj?.remote.mpi[0]?.action?.[0];

    let telr_res = {
      session,
      scheme,
      level,
      trace,
      acsurl,
      pareq,
      redirecthtml,
      action
    };

    return telr_res; 
  },

  createAuth: async (values, _terminalcred, mode, session_id) => {
    let txn_test = mode == "test" ? 1 : 0;
    let payload = `
            <?xml version="1.0" encoding="UTF-8"?>
            <remote>
                <store>${_terminalcred.MID}</store>
                <key>${_terminalcred.password}</key>
                <method>authenticate</method>
                <tran>
                    <type>${values?.type}</type>
                    <class>ecom</class>
                    <description>${values?.description}</description>
                    <currency>${values.currency}</currency>
                    <amount>${values.amount}</amount>
                    <test>${txn_test}</test>
                    <cartid>${values.order_id}</cartid>
                </tran>
                <browser>
                    <agent>${values.agent}</agent>
                    <height>${values.height}</height>
                    <width>${values.agent}</width>
                    <accept>*/*</accept>
                </browser>
                <mpi>
                    <returnurl>${
                      process.env.PAYMENT_URL +
                      "result/telr/" +
                      mode +
                      "/" +
                      values.order_id
                    }</returnurl>
                </mpi>
                <card>
                    <number>${values.card}</number>
                    <expiry>
                        <month>${values.expiry_month}</month>
                        <year>${values.expiry_year}</year>
                    </expiry>
                    <cvv>${values.cvv}</cvv>
                </card>
                <billing>
                    <name>
                        <title>${
                          values?.billingNameTitle
                            ? values?.billingNameTitle
                            : ""
                        }</title>
                        <first>${values.billingNameFirst}</first>
                        <last>${values.billingNameLast}</last>
                    </name>
                    <address>
                        <line1>${values.billingLine1}</line1>
                        <line2>${values.billingLine2}</line2>
                        <line3>${
                          values?.billingLine3 ? values?.billingLine3 : ""
                        }</line3>
                        <city>${values.billingCity}</city>
                        <region>${values.billingRegion}</region>
                        <country>${values.billingCountry}</country>
                        <zip>${values.billingZip}</zip>
                    </address>
                    <email>${values.email}</email>
                    <ip>${values.ip || "3.28.86.219"}</ip>
                </billing>
                <mpi>
                    <session>${session_id}</session>
                </mpi>
            </remote>`;
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: _terminalcred.baseurl,
      headers: {
        "Content-Type": "application/xml",
      },
      data: payload,
    };
    const response = await axios.request(config);
   return response;
  },

  makeSaleRequest: async (values, _terminalcred, mode) => {
    let txn_test = mode == "test" ? 1 : 0;
    let data = `
        <?xml version="1.0" encoding="UTF-8"?>
        <remote>
            <store>${_terminalcred.MID}</store>
            <key>${_terminalcred.password}</key>
            <tran>
                <type>${values.type}</type>
                <class>${values.classValue}</class>
                <description>${values.description}</description>
                <currency>${values.currency}</currency>
                <amount>${values.amount}</amount>
                <test>${txn_test}</test>
                <cartid>${values.order_id}</cartid>
            </tran>
            <card>
                <number>${values.card}</number>
                <expiry>
                    <month>${values.expiry_month}</month>
                    <year>${values.expiry_year}</year>
                </expiry>
                <cvv>${values.cvv}</cvv>
            </card>
            <billing>
                <name>
                    <title>${
                      values?.billingNameTitle ? values?.billingNameTitle : ""
                    }</title>
                    <first>${values.billingNameFirst}</first>
                    <last>${values.billingNameLast}</last>
                </name>
                <address>
                    <line1>${values.billingLine1}</line1>
                    <line2>${values.billingLine2}</line2>
                    <line3>${
                      values?.billingLine3 ? values?.billingLine3 : ""
                    }</line3>
                    <city>${values.billingCity}</city>
                    <region>${values.billingRegion}</region>
                    <country>${values.billingCountry}</country>
                    <zip>${values.billingZip}</zip>
                </address>
                <email>${values.email}</email>
                <ip>${values.ip || "3.28.86.219"}</ip>
            </billing>
            <mpi>
                <session>${values.session}</session>
            </mpi>
        </remote>`;
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: _terminalcred.baseurl,
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };
   // console.log("🚀 ~ makeSaleRequest: ~ config:", JSON.stringify(config))
    const response = await axios.request(config);
    const parsedData = await xml2js.parseStringPromise(response.data);
   // console.log(JSON.stringify(parsedData));
    let telr_sale_res = {
      status: parsedData.remote.auth[0]?.status[0],
      code: parsedData.remote.auth[0]?.code[0],
      message: parsedData.remote.auth[0]?.message[0],
      tranref: parsedData.remote.auth[0]?.tranref[0],
      cvv: parsedData.remote.auth[0]?.cvv[0],
      trace: parsedData.remote.auth[0]?.trace[0],
      // code: parsedData.remote.payment[0]?.code[0],
      description: parsedData.remote.payment[0]?.description[0],
      card_end: parsedData.remote.payment[0]?.card_end
        ? parsedData.remote.payment[0]?.card_end[0]
        : "",
      card_bin: parsedData.remote.payment[0]?.card_bin
        ? parsedData.remote.payment[0]?.card_bin[0]
        : "",
    };

    return telr_sale_res;
  },

  make3DSSaleRequest: async (values, _terminalcred, mode) => {
    let txn_test = mode == "test" ? 1 : 0;
    let data = `<?xml version="1.0" encoding="UTF-8"?>
                        <remote>
                            <store>${_terminalcred.MID}</store>
                            <key>${_terminalcred.password}</key>
                            <tran>
                                <type>${values.type}</type>
                                <class>${values.classValue}</class>
                                <description>${values.description}</description>
                                <currency>${values.currency}</currency>
                                <amount>${values.amount}</amount>
                                <test>${txn_test}</test>
                                <cartid>${values.order_id}</cartid>
                            </tran>
                            <card>
                                <number>${values.card}</number>
                                <expiry>
                                    <month>${values.expiry_month}</month>
                                    <year>${values.expiry_year}</year>
                                </expiry>
                                <cvv>${values.cvv}</cvv>
                            </card>
                            <mpi>
                                <session>${values.session}</session>
                            </mpi>
                            <billing>
                                <name>
                                    <title>${
                                      values?.billingNameTitle
                                        ? values?.billingNameTitle
                                        : ""
                                    }</title>
                                    <first>${values.billingNameFirst}</first>
                                    <last>${values.billingNameLast}</last>
                                </name>
                                <address>
                                    <line1>${values.billingLine1}</line1>
                                    <line2>${values.billingLine2}</line2>
                                    <line3>${
                                      values?.billingLine3
                                        ? values?.billingLine3
                                        : ""
                                    }</line3>
                                    <city>${values.billingCity}</city>
                                    <region>${values.billingRegion}</region>
                                    <country>${values.billingCountry}</country>
                                    <zip>${values.billingZip}</zip>
                                </address>
                                <email>${values.email}</email>
                                <ip>${values.ip || "3.28.86.219"}</ip>
                            </billing>
                        </remote>`;

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: _terminalcred.baseurl,
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };

    try {
     // console.log(config);
      const response = await axios.request(config);
      //console.log(response.data);
      const parsedData = await xml2js.parseStringPromise(response.data);
      let telr_sale_res = {
        status: parsedData.remote.auth[0]?.status[0],
        code: parsedData.remote.auth[0]?.code[0],
        message: parsedData.remote.auth[0]?.message[0],
        tranref: parsedData.remote.auth[0]?.tranref[0],
        cvv: parsedData.remote.auth[0]?.cvv[0],
        trace: parsedData.remote.auth[0]?.trace[0],
        //code: parsedData.remote.payment[0]?.code[0],
        description: parsedData.remote.payment[0]?.description[0],
        card_end: parsedData.remote.payment[0]?.card_end
          ? parsedData.remote.payment[0]?.card_end[0]
          : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
          ? parsedData.remote.payment[0]?.card_bin[0]
          : "",
      };
      return telr_sale_res;
    } catch (error) {
      winston.error(error);

      return null;
    }
  },

  makeRecurringRequest: async (values, _terminalcred) => {
    let data = `<?xml version="1.0" encoding="UTF-8"?>
                        <remote>
                            <store>${_terminalcred.MID}</store>
                            <key>${_terminalcred.password}</key>
                            <tran>
                                <type>${values.type}</type>
                                <class>${values.classValue}</class>
                                <currency>${values.currency}</currency>
                                <cartid>${values.order_id}</cartid>
                                <amount>${values.amount}</amount>
                                <ref>${values.tranref}</ref>
                                <test>1</test>
                            </tran>
                        </remote>`;
                        
    console.log("🚀 ~ makeRecurringRequest: ~ data:", data)

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://secure.telr.com/gateway/remote.xml",
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };

    try {
      const response = await axios.request(config);

      const parsedData = await xml2js.parseStringPromise(response.data);

      let telr_refund_res = {
        status: parsedData.remote.auth[0]?.status
          ? parsedData.remote.auth[0]?.status[0]
          : "",
        auth_code: parsedData.remote.auth[0]?.code
          ? parsedData.remote.auth[0]?.code[0]
          : "",
        message: parsedData.remote.auth[0]?.message
          ? parsedData.remote.auth[0]?.message[0]
          : "",
        tranref: parsedData.remote.auth[0]?.tranref
          ? parsedData.remote.auth[0]?.tranref[0]
          : "",
        cvv: parsedData.remote.auth[0]?.cvv
          ? parsedData.remote.auth[0]?.cvv[0]
          : "",
        payment_code: parsedData.remote.payment[0]?.code
          ? parsedData.remote.payment[0]?.code[0]
          : "",
        description: parsedData.remote.payment[0]?.description
          ? parsedData.remote.payment[0]?.description[0]
          : "",
        card_end: parsedData.remote.payment[0]?.card_end
          ? parsedData.remote.payment[0]?.card_end[0]
          : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
          ? parsedData.remote.payment[0]?.card_bin[0]
          : "",
      };

      return telr_refund_res;
    } catch (error) {
      winston.error(error);

      return null;
    }
  },

  makeRefundRequest: async (values, _terminalcred) => {
    let data = `<?xml version="1.0" encoding="UTF-8"?>
                        <remote>
                            <store>${_terminalcred.MID}</store>
                            <key>${_terminalcred.password}</key>
                            <tran>
                                <type>${values.type}</type>
                                <class>${values.classValue}</class>
                                <currency>${values.currency}</currency>
                                <amount>${values.amount}</amount>
                                <ref>${values.tranref}</ref>
                                <test>1</test>
                            </tran>
                        </remote>`;

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://secure.telr.com/gateway/remote.xml",
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };

    try {
      const response = await axios.request(config);

      const parsedData = await xml2js.parseStringPromise(response.data);

      let telr_refund_res = {
        status: parsedData.remote.auth[0]?.status
          ? parsedData.remote.auth[0]?.status[0]
          : "",
        auth_code: parsedData.remote.auth[0]?.code
          ? parsedData.remote.auth[0]?.code[0]
          : "",
        message: parsedData.remote.auth[0]?.message
          ? parsedData.remote.auth[0]?.message[0]
          : "",
        tranref: parsedData.remote.auth[0]?.tranref
          ? parsedData.remote.auth[0]?.tranref[0]
          : "",
        cvv: parsedData.remote.auth[0]?.cvv
          ? parsedData.remote.auth[0]?.cvv[0]
          : "",
        payment_code: parsedData.remote.payment[0]?.code
          ? parsedData.remote.payment[0]?.code[0]
          : "",
        description: parsedData.remote.payment[0]?.description
          ? parsedData.remote.payment[0]?.description[0]
          : "",
        card_end: parsedData.remote.payment[0]?.card_end
          ? parsedData.remote.payment[0]?.card_end[0]
          : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
          ? parsedData.remote.payment[0]?.card_bin[0]
          : "",
      };

      return telr_refund_res;
    } catch (error) {
      winston.error(error);

      return null;
    }
  },

  makeVoidRequest: async (values, _terminalcred) => {
    let data = `<?xml version="1.0" encoding="UTF-8"?>
                        <remote>
                            <store>${_terminalcred.MID}</store>
                            <key>${_terminalcred.password}</key>
                            <tran>
                                <type>${values.type}</type>
                                <class>${values.class}</class>
                                <currency>${values.currency}</currency>
                                <amount>${values.amount}</amount>
                                <ref>${values.tranref}</ref>
                                <test>1</test>
                            </tran>
                        </remote>`;

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://secure.telr.com/gateway/remote.xml",
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };

    try {
      const response = await axios.request(config);

      const parsedData = await xml2js.parseStringPromise(response.data);

      let telr_void_res = {
        status: parsedData.remote.auth[0]?.status
          ? parsedData.remote.auth[0]?.status[0]
          : "",
        auth_code: parsedData.remote.auth[0]?.code
          ? parsedData.remote.auth[0]?.code[0]
          : "",
        message: parsedData.remote.auth[0]?.message
          ? parsedData.remote.auth[0]?.message[0]
          : "",
        tranref: parsedData.remote.auth[0]?.tranref
          ? parsedData.remote.auth[0]?.tranref[0]
          : "",
        cvv: parsedData.remote.auth[0]?.cvv
          ? parsedData.remote.auth[0]?.cvv[0]
          : "",
        trace: parsedData.remote.auth[0]?.trace
          ? parsedData.remote.auth[0]?.trace[0]
          : "",
        payment_code: parsedData.remote.payment[0]?.code
          ? parsedData.remote.payment[0]?.code[0]
          : "",
        description: parsedData.remote.payment[0]?.description
          ? parsedData.remote.payment[0]?.description[0]
          : "",
        card_end: parsedData.remote.payment[0]?.card_end
          ? parsedData.remote.payment[0]?.card_end[0]
          : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
          ? parsedData.remote.payment[0]?.card_bin[0]
          : "",
      };

      return telr_void_res;
    } catch (error) {
      winston.error(error);

      return null;
    }
  },

  makeCaptureRequest: async (values, _terminalcred) => {
    let data = `<?xml version="1.0" encoding="UTF-8"?>
                        <remote>
                            <store>${_terminalcred.MID}</store>
                            <key>${_terminalcred.password}</key>
                            <tran>
                                <type>${values.type}</type>
                                <class>${values.class}</class>
                                <currency>${values.currency}</currency>
                                <amount>${values.amount}</amount>
                                <ref>${values.tranref}</ref>
                                <test>1</test>
                            </tran>
                        </remote>`;

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://secure.telr.com/gateway/remote.xml",
      headers: {
        "Content-Type": "application/xml",
      },
      data: data,
    };

    try {
      const response = await axios.request(config);

      const parsedData = await xml2js.parseStringPromise(response.data);

      let telr_void_res = {
        status: parsedData.remote.auth[0]?.status
          ? parsedData.remote.auth[0]?.status[0]
          : "",
        auth_code: parsedData.remote.auth[0]?.code
          ? parsedData.remote.auth[0]?.code[0]
          : "",
        message: parsedData.remote.auth[0]?.message
          ? parsedData.remote.auth[0]?.message[0]
          : "",
        tranref: parsedData.remote.auth[0]?.tranref
          ? parsedData.remote.auth[0]?.tranref[0]
          : "",
        cvv: parsedData.remote.auth[0]?.cvv
          ? parsedData.remote.auth[0]?.cvv[0]
          : "",
        trace: parsedData.remote.auth[0]?.trace
          ? parsedData.remote.auth[0]?.trace[0]
          : "",
        payment_code: parsedData.remote.payment[0]?.code
          ? parsedData.remote.payment[0]?.code[0]
          : "",
        description: parsedData.remote.payment[0]?.description
          ? parsedData.remote.payment[0]?.description[0]
          : "",
        card_end: parsedData.remote.payment[0]?.card_end
          ? parsedData.remote.payment[0]?.card_end[0]
          : "",
        card_bin: parsedData.remote.payment[0]?.card_bin
          ? parsedData.remote.payment[0]?.card_bin[0]
          : "",
      };

      return telr_void_res;
    } catch (error) {
      winston.error(error);

      return null;
    }
  },
};

module.exports = telr;
