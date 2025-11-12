var cors = require('cors');
var isMultipart = /^multipart\//i;
const express = require('express');
const app = express();
const morgan = require("morgan");
const winston = require("./utilities/logmanager/winston");
const { prettyString } = require("./utilities/logmanager/utils");

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
// app.use(sanitizeReqBody);
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});
app.use((req, res, next) => {
res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});


// using static files 
app.use('/static', express.static(path.join(__dirname, 'public')))
// using static files ends
const route = require('./routes/api/v1/index');
const mtnRoute = require("./utilities/sandbox/mtn/mtn_routes");
const orangeRoute = require("./utilities/sandbox/orange/index");
const alpayRoute = require("./utilities/sandbox/alpay");
app.use('/momo-sandbox',mtnRoute);
app.use('/orange',orangeRoute);
app.use('/al',alpayRoute);
app.use('/api/v1', route);

// Logs for error
// Capture 500 errors
app.use((err, _req, res, _next) => {
    winston.error(err);
    // console.log(err);
    // res.status(err.status);
    res.send(err.message);
  });

module.exports = app;