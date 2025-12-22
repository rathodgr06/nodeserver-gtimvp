const express = require("express");
const jwt = require("jsonwebtoken");   // npm install jsonwebtoken
const { v4: uuidv4 } = require("uuid"); // npm install uuid

const router = express.Router();



// In-memory transaction store
const transactions = new Map();

// Helper: generate TXNID like MP250917.1530.12345
// Helper: generate TXNID like MP250806.1557.A00408
function generateTxnId() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const time =
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000)
    .toString()
    .slice(0, 5);
  return `MP${date.slice(2)}.${time}.${rand}`;
}

// Helper: check auth
function isValidAuth(auth) {
  return (
    auth?.user === "GTISwitch" &&
    auth?.pwd === "Jr7javyC0GCatAaNT8FRipcs"
  );
}

// Helper: validate TXNID format
function isValidTxnId(txnId) {
  return /^MP\d{6}\.\d{4}\.\d{5}$/.test(txnId);
}

// ================================
// POST /TIMM/v1/Subscriber/Billers/OM/PayStart
// ================================
router.post("/Subscriber/Billers/OM/PayStart", (req, res) => {
  const { auth, param, callback } = req.body;

  if (!isValidAuth(auth)) {
    return res
      .status(401)
      .json({ exec_code: 401, exec_msg: "Invalid credentials" });
  }

  const { msisdn, Amount, Currency, ExternalID } = param || {};

  if (!msisdn || !Amount || !Currency || !ExternalID) {
    return res
      .status(400)
      .json({ exec_code: 400, exec_msg: "Missing parameters" });
  }

  const txnId = generateTxnId();

  transactions.set(txnId, {
    msisdn,
    amount: Amount,
    currency: Currency, // store original pay currency
    externalId: ExternalID,
    callbackUrl: callback?.url,
    status: "TI", // In progress
    createdAt: Date.now(),
  });
  return res.status(200).json({
    exec_code: 200,
    exec_msg: "Success",
    resultset: {
      TXNID: txnId,
    },
  });
});

// ================================
// GET /TIMM/v1/OM/Transaction/Status
// ================================
router.get("/OM/Transaction/Status", (req, res) => {
  console.log(transactions);
  const { auth, param } = req.body;

  if (!isValidAuth(auth)) {
    return res
      .status(401)
      .json({ exec_code: 401, exec_msg: "Invalid credentials" });
  }

  const { TXNID, Currency } = param || {};

  if (!TXNID || !Currency) {
    return res
      .status(400)
      .json({ exec_code: 400, exec_msg: "Missing parameters" });
  }

  const tx = transactions.get(TXNID);
  if (!tx) {
    return res
      .status(404)
      .json({ exec_code: 404, exec_msg: "Transaction not found" });
  }

  // Ensure currency matches the one used during PayStart
  if (tx.currency !== Currency) {
    return res.status(400).json({
      exec_code: 400,
      exec_msg: `Currency mismatch. Transaction was created in ${tx.currency}`,
    });
  }

  // Force specific MSISDN status rules
  const msisdnRules = {
    TS: ["233800900111", "233800900112", "233800900113"],
    TF: ["233800900114", "233800900115"],
    TI: ["233800900116", "233800900117"],
  };
  console.log(tx.msisdn);
  if (msisdnRules.TS.includes(tx.msisdn)) {
    tx.status = "TS";
  } else if (msisdnRules.TF.includes(tx.msisdn)) {
    tx.status = "TF";
  } else if (msisdnRules.TI.includes(tx.msisdn)) {
    tx.status = "TI";
  } else {
    // Fallback: auto-update if still TI
    if (tx.status === "TI") {
      tx.status = Math.random() < 0.8 ? "TS" : "TF"; // 80% success
    }
  }

  transactions.set(TXNID, tx);

  return res.status(200).json({
    exec_code: 200,
    exec_msg: "Success",
    resultset: {
      TXNSTATUS: tx.status,
    },
  });
});


// ================================
// GET /CRM/Subscriber/Detail/Identification
// ================================
router.get("/CRM/Subscriber/Detail/Identification", (req, res) => {
   const auth = req.query.auth ? JSON.parse(req.query.auth) : req.body.auth;
  const param = req.query.param ? JSON.parse(req.query.param) : req.body.param;

  if (!isValidAuth(auth)) {
    return res
      .status(401)
      .json({ exec_code: 401, exec_msg: "Invalid credentials" });
  }

  const { msisdn } = param || {};
  if (!msisdn) {
    return res
      .status(400)
      .json({ exec_code: 400, exec_msg: "Missing msisdn" });
  }

  // Return static mock data
  return res.status(200).json({
    exec_code: 0,
    exec_msg: "Success",
    resultset: {
      FullName: "Sand Box",
      Active: true,
    },
  });
});

module.exports = router;

