const statusCode = require("../utilities/statuscode/index");
const response = require("../utilities/response/ServerResponse");
// const { exec } = require("child_process");

var snapshot_wallets = {
  rollout_wallets: async (req, res) => {
    try {
      //  await walletRollout();
      // exec("./rollout_wallet.sh", (error, stdout, stderr) => {
      //   if (error) {
      //     console.error(`Error executing script: ${error.message}`);
      //     return;
      //   }

      //   if (stderr) {
      //     console.error(`Script error output: ${stderr}`);
      //   }

      //   console.log(`Script output:\n${stdout}`);
      // });
       res.status(statusCode.ok).send(response.successansmsg("Wallet rollout completed"));
    } catch (error) {
      logger.error(500,{message: error,stack: error.stack});
      res
        .status(statusCode.internalError)
        .send(response.errormsg(error.message));
    }
  },
};

module.exports = snapshot_wallets;
