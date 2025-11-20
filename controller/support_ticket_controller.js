const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const axios = require("axios");
const FormData = require("form-data");
const logger = require('../config/logger');

const support_ticket_controller = {
  add: async (req, res) => {
    let inputData = {
      trid: req.bodyString("trid"),
      order_no: req.bodyString("order_no"),
      customer_name: req.bodyString("customer_name"),
      customer_email: req.bodyString("customer_email"),
      customer_mobile: req.bodyString("customer_mobile"),
      app_id: 2,
      id: req.bodyString("id"),
      cid: req.bodyString("cid"),
      token: req.bodyString("token"),
      category: req.bodyString("category"),
      sub_category: req.bodyString("sub_category"),
      other: req.bodyString("other"),
      priority: req.bodyString("priority"),
      description: req.bodyString("description"),
      amount: req.bodyString("amount"),
      currency: req.bodyString("currency"),
      file_1: req?.all_files?.file_1,
    };

    var data = new FormData();
    data.append("trid", inputData.trid ? inputData.trid : "");
    data.append("order_no", inputData.order_no ? inputData.order_no : "");
    data.append(
      "customer_name",
      inputData.customer_name ? inputData.customer_name : ""
    );
    data.append(
      "customer_email",
      inputData.customer_email ? inputData.customer_email : ""
    );
    data.append(
      "customer_mobile",
      inputData.customer_mobile ? inputData.customer_mobile : ""
    );
    data.append("app_id", inputData.app_id ? inputData.app_id : "");
    data.append("id", inputData.id ? inputData.id : "");
    data.append("cid", inputData.cid ? inputData.cid : "");
    data.append("token", inputData.token ? inputData.token : "");
    data.append("category", inputData.category ? inputData.category : "");
    data.append(
      "sub_category",
      inputData.sub_category ? inputData.sub_category : ""
    );
    data.append("other", inputData.other ? inputData.other : "");
    data.append("priority", inputData.priority ? inputData.priority : "");
    data.append(
      "description",
      inputData.description ? inputData.description : ""
    );
    data.append("amount", inputData.amount ? inputData.amount : "");
    data.append("currency", inputData.currency ? inputData.currency : "");
    data.append("file_1", inputData.file_1 ? inputData.file_1 : "");

    // var data = new FormData();
    // data.append("order_no", "");
    // data.append("customer_name", "Ashutosh");
    // data.append("customer_email", "ashutosh@gmail.com");
    // data.append("app_id", "2");
    // data.append("id", "0");
    // data.append("category", "Administrative");
    // data.append("sub_category", "General Ticket");
    // data.append("priority", "High");
    // data.append("description", "this is description");

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Saveticket/save",
      headers: {
        Cookie: "ci_session=94a83992e938ff46c5f1fc09072b7490ad2a2d11",
        ...data.getHeaders(),
      },
      // data: inputData,
      data: data,
    };

    await axios(config)
      .then(function (response) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(result.data, "Ticket raised successfully.")
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  list: async (req, res) => {
    let payload = {
      token: req.bodyString("token"),
      reference_no: req.bodyString("reference_no"),
      customer_name: req.bodyString("customer_name"),
      order_no: req.bodyString("order_no"),
      customer_email: req.bodyString("customer_email"),
      customer_mobile: req.bodyString("customer_mobile"),
      app_id: 2,
      category: req.bodyString("category"),
      sub_category: req.bodyString("sub_category"),
      priority: req.bodyString("priority"),
      status: req.bodyString("status"),
    };

    var data = new FormData();
    data.append("token", payload.token ? payload.token : "");
    data.append(
      "reference_no",
      payload.reference_no ? payload.reference_no : ""
    );
    data.append(
      "customer_name",
      payload.customer_name ? payload.customer_name : ""
    );
    data.append("app_id", payload.app_id ? payload.app_id : "");
    data.append("order_no", payload.order_no ? payload.order_no : "");
    data.append(
      "customer_email",
      payload.customer_email ? payload.customer_email : ""
    );
    data.append(
      "customer_mobile",
      payload.customer_mobile ? payload.customer_mobile : ""
    );
    data.append("category", payload.category ? payload.category : "");
    data.append(
      "sub_category",
      payload.sub_category ? payload.sub_category : ""
    );
    data.append("priority", payload.priority ? payload.priority : "");
    data.append("status", payload.status ? payload.status : "");

    // var data = new FormData();
    // data.append("token", "axb2782323GGGJHGvjhgjqsdgyugjge");
    // data.append("reference_no", "202301191856");
    // data.append("customer_name", "Ashutosh");
    // data.append("order_no", "ord_abcXYXV");
    // data.append("customer_email", "ashutosh@ulistechnology.com");
    // data.append("customer_mobile", "");
    // data.append("app_id", "2");
    // data.append("category", "Administrative");
    // data.append("sub_category", "General Ticket");
    // data.append("priority", "High");
    // data.append("status", "Open");

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Ticketlist/list_tikcet",
      headers: {
        Cookie: "ci_session=94a83992e938ff46c5f1fc09072b7490ad2a2d11",
        ...data.getHeaders(),
      },
      data: data,
      // data: payload,
    };

    await axios(config)
      .then(function (response) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data,
              "Ticket list fetched successfully."
            )
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  details: async (req, res) => {
    let payload = {
      token: req.bodyString("token"),
      reference_no: req.bodyString("reference_no"),
      app_id: 2,
      customer_email: req.bodyString("customer_email"),
    };

    var data = new FormData();
    data.append("token", payload.token ? payload.token : "");
    data.append(
      "reference_no",
      payload.reference_no ? payload.reference_no : ""
    );
    data.append("app_id", payload.app_id ? payload.app_id : "");
    data.append(
      "customer_email",
      payload.customer_email ? payload.customer_email : ""
    );

    // var data = new FormData();
    // data.append("token", "axb2782323GGGJHGvjhgjqsdgyugjge");
    // data.append("reference_no", "202301191856");
    // data.append("app_id", "2");
    // data.append("customer_email", "ashutoshsingh@ulistechnology.com");

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Ticketlist/ticket_details",
      headers: {
        Cookie: "ci_session=94a83992e938ff46c5f1fc09072b7490ad2a2d11",
        ...data.getHeaders(),
      },
      data: data,
      // data: payload,
    };

    await axios(config)
      .then(function (response) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data,
              "Ticket details fetched successfully."
            )
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  list_category: async (req, res) => {
    axios
      .post(`https://dev.paydart.support.ulis.live/api/Category/list_category`)
      .then((result) => {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data.data,
              "Category list fetched successfully."
            )
          );
      })
      .catch((error) => {
       logger.error(500,{message: error,stack: error.stack}); 
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  list_subcategory: async (req, res) => {
    let payload = {
      category_id: req.bodyString("category_id"),
    };

    var data = new FormData();
    data.append("category_id", payload.category_id);

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Category/list_subcategory",
      headers: {
        Cookie: "ci_session=94a83992e938ff46c5f1fc09072b7490ad2a2d11",
        ...data.getHeaders(),
      },
      data: data,
      // data: payload,
    };

    await axios(config)
      .then(function (response) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data.data,
              "Sub-Category list fetched successfully."
            )
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  add_comment: async (req, res) => {
    let payload = {
      token: req.bodyString("token"),
      reference_no: req.bodyString("reference_no"),
      app_id: 2,
      customer_email: req.bodyString("customer_email"),
      comment: req.bodyString("comment"),
      ticket_id: req.bodyString("ticket_id"),
      name: req.bodyString("name"),
      email: req.bodyString("email"),
      file: req?.all_files?.file_1,
    };

    var data = new FormData();
    data.append("token", payload.token ? payload.token : "");
    data.append(
      "reference_no",
      payload.reference_no ? payload.reference_no : ""
    );
    data.append("app_id", "2");
    data.append(
      "customer_email",
      payload.customer_email ? payload.customer_email : ""
    );
    data.append("comment", payload.comment ? payload.comment : "");
    data.append("ticket_id", payload.ticket_id ? payload.ticket_id : "");
    data.append("name", payload.name ? payload.name : "");
    data.append("email", payload.email ? payload.email : "");
    data.append("file", payload.file ? payload.file : "");

    // var data = new FormData();
    // data.append("token", "axb2782323GGGJHGvjhgjqsdgyugjge");
    // data.append("reference_no", "202301191856");
    // data.append("app_id", "2");
    // data.append("customer_email", "ashutoshsingh@ulistechnology.com");
    // data.append("comment", "this is ticket comment 02");
    // data.append("ticket_id", "UU4yS3M3eEFUa05CYUpIdko4Yjl4UT09");
    // data.append("name", "Ashutosh");
    // data.append("email", "ashutoshsingh@ulistechnology.com");
    // data.append("file", fs.createReadStream("V7U-wMexy/banner772.png"));

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Ticketlist/add_comment",
      headers: {
        Cookie: "ci_session=94a83992e938ff46c5f1fc09072b7490ad2a2d11",
        ...data.getHeaders(),
      },
      data: data,
      // data: payload,
    };

    await axios(config)
      .then(function (response) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data.data,
              "Comment added successfully."
            )
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },

  open_ticket: async (req, res) => {
    var data = new FormData();
    data.append("token", "axb2782323GGGJHGvjhgjqsdgyugjge");
    data.append("reference_no", "202301191856");
    data.append("email", "ashutosh@ulistechnology.com");

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Ticketlist/reopen_ticket",
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };

    axios(config)
      .then(function (response) {})
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 
      });
  },

  close_ticket: async (req, res) => {
    let payload = {
      token: req.bodyString("token"),
      reference_no: req.bodyString("reference_no"),
      app_id: 2,
      email: req.bodyString("email"),
    };

    var data = new FormData();
    data.append("token", payload.token ? payload.token : "");
    data.append(
      "reference_no",
      payload.reference_no ? payload.reference_no : ""
    );
    data.append("app_id", "2");
    data.append("email", payload.email ? payload.email : "");

    var config = {
      method: "post",
      url: "https://dev.paydart.support.ulis.live/api/Ticketlist/close_ticket",
      // data: payload
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };

    await axios(config)
      .then(function (result) {
        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(
              result.data.data,
              "Ticket closed successfully."
            )
          );
      })
      .catch(function (error) {
       logger.error(500,{message: error,stack: error.stack}); 

        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
};

module.exports = support_ticket_controller;
