const path = require("path");
const dotenv = require("dotenv");
const moment = require("moment");
const transacationChargesModel = require("../../models/charges_invoice_models");
const currency = require("../../controller/currency");

module.exports = async () => {
  console.log("Wallet Snap  Started");

  try {
    // fetch wallets from the database
    let fetchWallets = await transacationChargesModel.getWallets();
    // if the wallets are fetched successfully, you can process them as needed
    if (fetchWallets.length > 0) {
      for (let row of fetchWallets) {
        // fetch last snap for the particular wallet if no data then it return total,available and pending balance is 0 and last_snap date is 1970-01-01
        let lastSnapDetails = await transacationChargesModel.getLastSnapDate(
          row.wallet_id
        );
        let currentDate = moment()
          .subtract(1, "days")
          .format("YYYY-MM-DD 23:59:59");
        let snapDate = moment().subtract(1, "days").format("YYYY-MM-DD");

        let pendingDate = lastSnapDetails.last_snap_date// === "1970-01-01 00:00:00" ? moment().subtract(1, "day").format("YYYY-MM-DD 23:59:59") : lastSnapDetails.last_snap_date;
        let pendingBalancePayload = {
          receiver_id: row?.beneficiary_id,
          sub_merchant_id: row?.sub_merchant_id,
          currency: row?.currency,
          last_cut_off_date: moment(pendingDate).format("YYYY-MM-DD 23:59:59"),
          current_date: currentDate,
        };
        // fetch the pending balance
        let pending_balance = await transacationChargesModel.getPendingBalance(
          pendingBalancePayload
        );
        // fetch the sum of the net amount transaction which are in pending but turned to Failed Or Completed
        let pendingTurnedBalancePayload = {
          receiver_id: row?.beneficiary_id,
          sub_merchant_id: row?.sub_merchant_id,
          currency: row?.currency
        };
         let pendingTurnedBalance = await transacationChargesModel.getPendingTurnedBalance(
          pendingBalancePayload
        );

        // update the pending turned balance as counted 
        let updateRes = await transacationChargesModel.updatePendingTurnedBalance(pendingTurnedBalancePayload);

        // calculate total pending balance 
        let lastSnapPendingBalance = isNaN(parseFloat(lastSnapDetails.pending_balance)) ? 0 : parseFloat(lastSnapDetails.pending_balance);
        let totalPendingBalance = lastSnapPendingBalance+pending_balance-pendingTurnedBalance;
        // fetch the transaction charges after the snap
         let conditionForSum = {
          receiver_id: row.beneficiary_id,
          sub_merchant_id: row.sub_merchant_id,
          currency: row.currency,
          last_cut_off_date: moment(pendingDate).format("YYYY-MM-DD 23:59:59"),
          currentDate: currentDate,
        };
         let sum = await transacationChargesModel.getSumOfWallets(
          conditionForSum
        );
        //  calculate total balance
        let lastTotalBalance = isNaN(parseFloat(lastSnapDetails.total_balance)) ? 0 : parseFloat(lastSnapDetails.total_balance);
        let totalBalance = lastTotalBalance+sum;
        // calculate total available balance
        let totalAvailableBalance = totalBalance-totalPendingBalance;
        if(sum>0 || pending_balance>0 || pendingTurnedBalance>0){
        //prepare data to insert 
          let snapData = {
            wallet_id: row.wallet_id,
            total_balance: totalBalance,
            balance:totalAvailableBalance,
            pending_balance: totalPendingBalance,
            snap_date: snapDate,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          };
          //insert the data
          let snapResult = await transacationChargesModel.addWalletSnap(
            snapData
          );
        }
        
  }
    
  }
    return;
  } catch (error) {
    console.error("Error in auto capture:", error);
  }
  console.log("Wallet Snap  Ended");
};
