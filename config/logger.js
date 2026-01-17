const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const enumerateErrorFormat = winston.format((info) => {
    if (info.message instanceof Error) {
        info.message = {
            message: info.message.message,
            stack: info.message.stack,
            ...info.message,
        };
    }

    if (info instanceof Error) {
        return { message: info.message, stack: info.stack, ...info };
    }

    return info;
});

const transport = new DailyRotateFile({
    filename: 'public/logs/%DATE%-app-log.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '3',
    prepend: true,
    level: 'info',
});

transport.on('rotate', (oldFilename, newFilename) => {
    // call function like upload to s3 or on cloud
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        enumerateErrorFormat(), 
        winston.format.json()
    ),
    transports: [transport],
    // Handle exceptions and rejections
    exceptionHandlers: [
        new DailyRotateFile({
            filename: 'public/logs/%DATE%-exceptions.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '3',
        })
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            filename: 'public/logs/%DATE%-rejections.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '3',
        })
    ]
});

// Add stream for Morgan
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

module.exports = logger;