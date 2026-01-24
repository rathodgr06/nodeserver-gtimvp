const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const httpTransport = new DailyRotateFile({
  filename: 'public/logs/%DATE%-http.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '7d', // keep 7 days
  level: 'info'
});

const httpLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [httpTransport]
});

module.exports = httpLogger;
