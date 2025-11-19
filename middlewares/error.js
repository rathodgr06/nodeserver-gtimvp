const httpStatus = require('http-status');
const logger = require('../config/logger');
const ApiError = require('../helper/ApiError');

const errorConverter = (err, req, res, next) => {
    let error = err;
    
    if (!(error instanceof ApiError)) {
        // Fix: This was the bug - it was setting BAD_REQUEST when statusCode EXISTS
        // It should use the existing statusCode or default to INTERNAL_SERVER_ERROR
        const statusCode = error.statusCode || error.status || httpStatus.INTERNAL_SERVER_ERROR;
        const message = error.message || httpStatus[statusCode];
        error = new ApiError(statusCode, message, false, err.stack);
    }
    
    next(error);
};

const errorHandler = (err, req, res, next) => {
    let { statusCode, message } = err;

    // Ensure statusCode is valid and is a number
    if (!statusCode || typeof statusCode !== 'number' || statusCode < 100 || statusCode > 599) {
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    }

    // Ensure message is defined
    if (!message) {
        message = httpStatus[statusCode] || 'Internal Server Error';
    }

    res.locals.errorMessage = err.message;

    const response = {
        code: statusCode,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    // Log all errors (not just in development)
    const logData = {
        statusCode: statusCode,
        message: message,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
        ...(err.stack && { stack: err.stack })
    };

    // Log based on status code severity
    if (statusCode >= 500) {
        logger.error('Server Error:', logData);
    } else if (statusCode === 404) {
        logger.warn('Route Not Found:', logData);
    } else if (statusCode >= 400) {
        logger.warn('Client Error:', logData);
    } else {
        logger.info('Request Error:', logData);
    }

    res.status(statusCode).send(response);
};

module.exports = {
    errorConverter,
    errorHandler,
};