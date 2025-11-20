require('express-async-errors'); 
var cors = require('cors');
var isMultipart = /^multipart\//i;
const express = require('express');
const app = express();
const morgan = require("morgan");
const winston = require("./utilities/logmanager/winston");
const { prettyString } = require("./utilities/logmanager/utils");
const httpStatus = require('http-status');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./helper/ApiError');

app.use(morgan("short", { stream: winston.stream }));
var useragent = require('express-useragent');

var path = require('path');
const sanitizer  = require('express-html-sanitizer')
config = {
	allowedTags:  [  'b',  'i',  'em',  'strong',  'a'  ],
	allowedAttributes:  {'a':  [  'href'  ] },
	allowedIframeHostnames:  ['']
}
const sanitizeReqBody = sanitizer(config);
app.use(require('body-parser').json());
process.env.TZ = 'Africa/Accra';
var urlencodedMiddleware = express.urlencoded({ extended: true, limit: '50mb' });

app.use(cors())
app.use(require('sanitize').middleware);
app.use(useragent.express());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(function (req, res, next) {
   var type = req.get('Content-Type');
    if (isMultipart.test(type)){
        app.use(sanitizeReqBody);
        return next();
    } 
    return urlencodedMiddleware(req, res, next); 
});
app.set('trust proxy', 1); 
// app.use(sanitizeReqBody);
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});
app.use((req, res, next) => {
res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
// logger before route
// Add response logging middleware HERE (before routes)
app.use((req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override res.send
    res.send = function (data) {
        // Log before sending
        logResponse(req, res, data);
        originalSend.call(this, data);
    };

    // Override res.json
    res.json = function (data) {
        // Log before sending
        logResponse(req, res, data);
        originalJson.call(this, data);
    };

    function logResponse(req, res, body) {
        const statusCode = res.statusCode;
        
        // Parse body if it's a string
        let parsedBody = body;
        if (typeof body === 'string') {
            try {
                parsedBody = JSON.parse(body);
            } catch (e) {
                parsedBody = body;
            }
        }

        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: statusCode,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString(),
            responseBody: parsedBody
        };
        // console.log(`the status code of ${statusCode}`)
        // Log based on status code
        if (statusCode >= 500) {
            winston.error('Server Error Response:', logData);
            logger.error(statusCode, logData);
        } else if (statusCode >= 400) {
            winston.warn('Client Error Response:', logData);
            logger.error(statusCode, logData);
        } else if (statusCode >= 300) {
            winston.info('Redirect Response:', logData);
            logger.error(statusCode, logData);
        } else {
            winston.info('Success Response:', logData);
        }
    }

    next();
});

// using static files 
app.use('/static', express.static(path.join(__dirname, 'public')))
// using static files ends
const route = require('./routes/api/v1/index');
const mtnRoute = require("./utilities/sandbox/mtn/mtn_routes");
const orangeRoute = require("./utilities/sandbox/orange/index");
const alpayRoute = require("./utilities/sandbox/alpay");
const logger = require('./config/logger');
app.use('/momo-sandbox',mtnRoute);
app.use('/orange',orangeRoute);
app.use('/al',alpayRoute);
app.use('/api/v1', route);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
    next(new ApiError(404, 'Not found'));
});

app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;