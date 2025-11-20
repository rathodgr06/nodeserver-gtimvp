const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const router = express.Router();
const JWT_SECRET = 'alpay_mock_secret_key';
const logger = require('../../../config/logger');

router.use(cors());
// Mock data for different transaction scenarios
const MOCK_DATA = {
  // Mobile money numbers for different scenarios
  msisdn: {
    success: ['233241234567', '233201234567', '233501234567'],
    failed: ['233240000000', '233200000000', '233500000000'],
    pending: ['233249999999', '233209999999', '233509999999']
  },
  // Bank account numbers for different scenarios
  bankAccounts: {
    success: ['1234567890', '0987654321', '1122334455'],
    failed: ['0000000000', '1111111111', '2222222222'],
    pending: ['9999999999', '8888888888', '7777777777']
  },
  // Mock user credentials
  users: [
    { username: 'testuser1', password: 'password123' },
    { username: 'testuser2', password: 'password456' },
    { username: 'demo', password: 'demo123' }
  ]
};

// Mock institution codes and names
const INSTITUTION_CODES = {
  '300302': 'STANDARD CHARTERED BANK',
  '300303': 'ABSA BANK GHANA LIMITED',
  '300304': 'GCB BANK LIMITED',
  '300305': 'NATIONAL INVESTMENT BANK',
  '300591': 'MTN',
  '300592': 'AIRTELTIGO MONEY',
  '300594': 'VODAFONE CASH'
};

// Helper functions
const generateTransactionId = () => {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
};

const getTransactionStatus = (accountNumber, isMobile = false) => {
  const testData = isMobile ? MOCK_DATA.msisdn : MOCK_DATA.bankAccounts;
  
  if (testData.success.includes(accountNumber)) {
    return { status: '200', code: '200', message: 'Request processed successfully.' };
  } else if (testData.failed.includes(accountNumber)) {
    return { status: '424', code: '424', message: 'Request failed' };
  } else if (testData.pending.includes(accountNumber)) {
    return { status: '419', code: '419', message: 'Request is pending completion' };
  } else {
    // Default to success for unlisted accounts
    return { status: '200', code: '200', message: 'Request processed successfully.' };
  }
};

const isMobileNumber = (accountNumber) => {
  return accountNumber.startsWith('233') && accountNumber.length === 12;
};

// Basic Authentication Middleware
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      statusCode: '401',
      statusDesc: 'Unauthorized',
      message: 'Basic authentication required'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  const user = MOCK_DATA.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      statusCode: '401',
      statusDesc: 'Unauthorized',
      message: 'Invalid credentials'
    });
  }

  req.user = user;
  next();
};

// Bearer Token Authentication Middleware
const bearerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      statusCode: '401',
      statusDesc: 'Unauthorized',
      message: 'Bearer token required'
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error(500,{message: error,stack: error?.stack});
    return res.status(401).json({
      statusCode: '401',
      statusDesc: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

// Store for tracking transactions and mandates
const transactionStore = new Map();
const mandateStore = new Map();

// 1. Login API
router.post('/api/Authentication/Login', (req, res) => {
  const { username, password } = req.body;
//  Not provided username and password
  if (!username || !password) {
    return res.status(422).json({
      statusCode: '422',
      statusDesc: 'Not processable Entity',
      message: 'Username and password are required'
    });
  }
// check for valid username or password
const user = MOCK_DATA.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      statusCode: '401',
      statusDesc: 'Unauthorized',
      message: 'Invalid credentials'
    });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30m' });

  res.json({
    token,
    username,
    expires_in: 1800, // 30 minutes
    message: 'Login successful',
    status: '200'
  });
});

// 2. Name Enquiry Service
router.post('/api/NameEnquiry/NameEnquiryService', bearerAuth, (req, res) => {
  const { accountNumber, channel, institutionCode, transactionId } = req.body;

  if (!accountNumber || !transactionId) {
    return res.status(422).json({
      statusCode: '422',
      statusDesc: 'Not processable Entity'
    });
  }

  // Mock account names based on account number
  const mockNames = {
    '233241234567': 'JOHN DOE',
    '233201234567': 'JANE SMITH',
    '233501234567': 'KWAME ASANTE',
    '1234567890': 'BUSINESS ACCOUNT LTD',
    '0987654321': 'MARY JOHNSON',
    '1122334455': 'KOFI MENSAH'
  };

  const accountName = mockNames[accountNumber] || 'TEST ACCOUNT HOLDER';

  res.json({
    statusCode: '200',
    statusDesc: 'Success',
    data: {
      message: 'Name enquiry successful',
      transactionId,
      accountName,
      accountNumber
    }
  });
});





// 5. Debit Money Service
router.post('/api/DebitMoney/DebitMoneyService', bearerAuth, (req, res) => {
  const { accountName, accountNumber, amount, channel, institutionCode, transactionId, debitNarration, currency } = req.body;

  if (!accountNumber || !amount || !transactionId) {
    return res.status(422).json({
      statusCode: '422',
      statusDesc: 'Not processable Entity'
    });
  }

  const status = getTransactionStatus(accountNumber, true); // Mobile money debit

  transactionStore.set(transactionId, {
    status: status.status,
    message: status.message,
    accountNumber,
    accountName: accountName || 'TEST ACCOUNT',
    amount: amount.toString(),
    created_at: new Date().toISOString(),
    transactionId,
    externalTransactionId: 'EXT' + Date.now(),
    isReversed: false,
    type: 'DEBIT'
  });

  setTimeout(() => {
    console.log(`Debit callback would be sent for transaction ${transactionId} with status ${status.status}`);
  }, 2000);

  res.json({
    statusCode: '200',
    statusDesc: 'Request received',
    data: {
      message: 'Request is being processed',
      transactionId
    }
  });
});

// 6. Transaction Status Service
// 6. Transaction Status Service
router.post('/api/TransactionStatus/TransactionStatusService', bearerAuth, (req, res) => {
  const { transactionId, transactionType } = req.body;

  // Validate input
  if (!transactionId) {
    return res.status(422).json({
      statusCode: "422",
      statusDesc: "Not processable Entity"
    });
  }

  // Find transaction
  const transaction = transactionStore.get(transactionId);

  if (!transaction) {
    return res.status(404).json({
      statusCode: "404",
      statusDesc: "No Record found"
    });
  }

  // Success response in expected format
  return res.status(200).json({
    statusCode: "200",
    statusDesc: "SUCCESSFUL",
    data: {
      status: transaction.status || "000",                 // business status (e.g. 420, TS, TF, etc.)
      message: transaction.message || "Transaction found", // friendly message
      accountNumber: transaction.accountNumber || "",
      accountName: transaction.accountName || "",
      amount: transaction.amount || "0",
      created_at: transaction.created_at || new Date().toISOString(),
      transactionId: transaction.transactionId || transactionId,
      externalTransactionId: transaction.externalTransactionId || "",
      isReversed: transaction.isReversed || false,
      institutionApprovalCode: transaction.institutionApprovalCode || ""
    }
  });
});

module.exports = router;







