// =============================
// 🔒 Verify Token Middleware
// =============================
const JWT_SECRET = "mock_secret_key"; // for mock signing
const jwt = require("jsonwebtoken");  

function verifyToken(req, res, next){
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check expiry (your custom "expires" field)
    if (decoded.expires && new Date(decoded.expires) < new Date()) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token expired"
      });
    }

    // Attach session info to request for later use
    req.session = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token"
    });
  }
}
module.exports = verifyToken;