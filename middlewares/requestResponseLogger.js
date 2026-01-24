const httpLogger = require('../config/httpLogger');

module.exports = function requestResponseLogger(req, res, next) {
  const startTime = Date.now();

  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (body) {
    safeLogResponse(req, res, body, startTime);
    return originalSend.call(this, body);
  };

  res.json = function (body) {
    safeLogResponse(req, res, body, startTime);
    return originalJson.call(this, body);
  };

  next();
};

function safeLogResponse(req, res, body, startTime) {
  try {
    const logData = {
      ip: getClientIp(req),
      method: req?.method,
      endpoint: req?.originalUrl,
      statusCode: res?.statusCode,
      requestBody: safeBody(req?.body),
      responseBody: safeBody(body),
      responseTimestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime
    };

    httpLogger.info(logData);
  } catch (err) {
    // ABSOLUTELY NEVER throw from logger
    console.error('Logging failed:', err.message);
  }
}

function getClientIp(req) {
  return (
    req?.ip ||
    req?.get?.('x-forwarded-for') ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    'unknown'
  );
}

function safeBody(body) {
  try {
    if (!body) return body;
    const str = JSON.stringify(body);
    return str.length > 5000 ? '[TRUNCATED]' : body;
  } catch {
    return '[UNSERIALIZABLE BODY]';
  }
}
