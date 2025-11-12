
const winston = require("winston");
const TIMEZONE= 'Asia/Dubai';

// Transports
const transportDefinitions = {
  // Normal file logger
  console: {
    level: "info",
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
  },
  console: {
    level: "error",
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
  },
  console: {
    level: "warning",
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
  },
  // Logging to console
 
};

// timezone function winston calls to get timezone
const timezoned = () =>
  new Date().toLocaleString("en-AR", {
    timeZone: TIMEZONE,
  });

// logger object with above defined options
const logger = winston.createLogger({
  transports: [
    // new winston.transports.File(transportDefinitions.file),
    new winston.transports.Console(transportDefinitions.console),
  ],
  exceptionHandlers: [
    new winston.transports.Console(transportDefinitions.console)
  ], 
  format: winston.format.combine(
    winston.format.simple(),
    winston.format.timestamp({
      format: timezoned,
    }),
    winston.format.printf((logObject) => {
      return `[${logObject.timestamp}] ${logObject.level}: ${logObject.message.trim()}`;
    })
  ),
  exitOnError: false,
});

logger.stream = {
  write(message) {
    logger.info(message);
  },
};

module.exports = logger;
