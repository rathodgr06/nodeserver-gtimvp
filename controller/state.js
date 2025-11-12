const StatesModel = require("../models/states");
const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
const helpers = require("../utilities/helper/general_helper");
const enc_dec = require("../utilities/decryptor/decryptor");
const admin_activity_logger = require("../utilities/activity-logger/admin_activity_logger");
const moment = require("moment");
const winston = require("../utilities/logmanager/winston");

var states = {
  add: async (req, res) => {
    let added_date = moment().format("YYYY-MM-DD HH:mm:ss");
    let state_name = req.bodyString("state_name");
    let state_code = req.bodyString("state_code");
    let country_id = enc_dec.cjs_decrypt(req.bodyString("country_id"));
    let result;
    result = StatesModel.selectOne("id", { state_name: state_name });
    if (result.length > 0) {
      res.status(statusCode.ok).send(response.AlreadyExist(state_name));
    } else {
      let ins_body = {
        state_name: state_name,
        state_code: state_code,
        ref_country: country_id,
        updated_at: added_date,
        ip: await helpers.get_ip(req),
      };
      StatesModel.add(ins_body)
        .then((result) => {
          let module_and_user = {
            user: req.user.id,
            admin_type: req.user.type,
            module: "Locations",
            sub_module: "States",
          };
          let added_name = req.bodyString("state_name");
          let headers = req.headers;
          admin_activity_logger
            .add(module_and_user, added_name, headers)
            .then((result) => {
              res
                .status(statusCode.ok)
                .send(response.successmsg("State added successfully."));
            })
            .catch((error) => {
              winston.error(error);
              res
                .status(statusCode.internalError)
                .send(response.errormsg(error.message));
            });
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    }
  },
  list: async (req, res) => {
    try {
      let limit = {
        perpage: 0,
        page: 0,
      };
      if (req.bodyString("perpage") && req.bodyString("page")) {
        perpage = parseInt(req.bodyString("perpage"));
        start = parseInt(req.bodyString("page"));

        limit.perpage = perpage;
        limit.start = (start - 1) * perpage;
      }
      const country = await helpers.get_country_id_by_name(
        req.bodyString("country_name")
      );
      const country_code = await helpers.get_country_id_by_code(
        req.bodyString("country_code")
      );
      let search_obj = {};
      search_obj.deleted = 0;

      if (req.bodyString("status") == "Active") {
        search_obj.status = 0;
      }
      if (req.bodyString("status") == "Deactivated") {
        search_obj.status = 1;
      }

      if (req.bodyString("country_id")) {
        in_country_id = enc_dec.cjs_decrypt(req.bodyString("country_id"));
        search_obj.ref_country = in_country_id;
      }
      if (req.bodyString("country_id_ref")) {
        in_country_id = req.bodyString("country_id_ref");
        search_obj.ref_country = in_country_id;
      }
      if (req.bodyString("country_name")) {
        search_obj.ref_country = country;
      }
      if (req.bodyString("country_code")) {
        search_obj.ref_country = country_code;
      }
      let search_state = { state_name: "" };
      if (req.bodyString("state_name")) {
        search_state.state_name = req.bodyString("state_name");
      }
      StatesModel.select(search_obj, search_state, limit)
        .then(async (result) => {
          let send_res = [];

          for (let val of result) {
            let res = {
              country_id: enc_dec.cjs_encrypt(val.ref_country),
              country_name: await helpers.get_country_name_by_id(
                val.ref_country
              ),
              state_id: enc_dec.cjs_encrypt(val.id),
              state_name: val.state_name,
              state_code: val.state_code,
              dial: val.dial,
              status: val.status == 1 ? "Deactivated" : "Active",
            };
            send_res.push(res);
          }
          //console.log('here333')
          // total_count = await StatesModel.get_count(search_obj, search_state)
          total_count = 10;
          return res
            .status(statusCode.ok)
            .send(
              response.successdatamsg(
                send_res,
                "List fetched successfully.",
                total_count
              )
            );
        })
        .catch((error) => {
          console.log(error);
          winston.error(error);
          return res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      console.log(error);
      return res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  details: async (req, res) => {
    let states_id = await enc_dec.cjs_decrypt(req.bodyString("state_id"));
    StatesModel.selectOne("*", { id: states_id })
      .then(async (result) => {
        let send_res = [];
        let val = result;
        let res1 = {
          country_id: enc_dec.cjs_encrypt(val.ref_country),
          country_name: await helpers.get_country_name_by_id(val.ref_country),
          state_id: enc_dec.cjs_encrypt(val.id),
          state_name: val.state_name,
          state_code: val.state_code,
          dial: val.dial,
          status: val.status == 1 ? "Deactivated" : "Active",
        };
        send_res = res1;

        res
          .status(statusCode.ok)
          .send(
            response.successdatamsg(send_res, "Details fetched successfully.")
          );
      })
      .catch((error) => {
        winston.error(error);
        res
          .status(statusCode.internalError)
          .send(response.errormsg(error.message));
      });
  },
  update: async (req, res) => {
    try {
      let state_id = await enc_dec.cjs_decrypt(req.bodyString("state_id"));
      let country_id = await enc_dec.cjs_decrypt(req.bodyString("country_id"));
      let state_name = req.bodyString("state_name");
      let state_code = req.bodyString("state_code");

      var insdata = {
        state_name: state_name,
        state_code: state_code,
        ref_country: country_id,
      };

      $ins_id = await StatesModel.updateDetails({ id: state_id }, insdata);

      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Locations",
        sub_module: "States",
      };
      let headers = req.headers;
      admin_activity_logger
        .edit(module_and_user, state_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("State updated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  states_deactivate: async (req, res) => {
    try {
      let state_id = await enc_dec.cjs_decrypt(req.bodyString("state_id"));
      var insdata = {
        status: 1,
      };

      $ins_id = await StatesModel.updateDetails({ id: state_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Locations",
        sub_module: "States",
      };
      let headers = req.headers;
      admin_activity_logger
        .deactivate(module_and_user, state_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("State deactivated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  states_activate: async (req, res) => {
    try {
      let state_id = await enc_dec.cjs_decrypt(req.bodyString("state_id"));
      var insdata = {
        status: 0,
      };

      $ins_id = await StatesModel.updateDetails({ id: state_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Locations",
        sub_module: "States",
      };
      let headers = req.headers;
      admin_activity_logger
        .activate(module_and_user, state_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("State activated successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
  states_delete: async (req, res) => {
    try {
      let state_id = await enc_dec.cjs_decrypt(req.bodyString("state_id"));
      var insdata = {
        deleted: 1,
      };

      $ins_id = await StatesModel.updateDetails({ id: state_id }, insdata);
      let module_and_user = {
        user: req.user.id,
        admin_type: req.user.type,
        module: "Locations",
        sub_module: "States",
      };
      let headers = req.headers;
      admin_activity_logger
        .delete(module_and_user, state_id, headers)
        .then((result) => {
          res
            .status(statusCode.ok)
            .send(response.successmsg("State deleted successfully"));
        })
        .catch((error) => {
          winston.error(error);
          res
            .status(statusCode.internalError)
            .send(response.errormsg(error.message));
        });
    } catch (error) {
      winston.error(error);
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};
module.exports = states;
