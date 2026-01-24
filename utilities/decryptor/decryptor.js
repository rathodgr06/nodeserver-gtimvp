const path = require('path')
require('dotenv').config({ path: "../.env" });
const sk = process.env.SECRET
const crypto = require('crypto');
const CryptoJS = require("crypto-js")
const cipherModel = require("../../models/cipher_models");
var Sha256 = require("crypto-js/sha256");
var Hex = require('crypto-js/enc-hex');
var Utf8 = require('crypto-js/enc-utf8');
var Base64 = require('crypto-js/enc-base64');
var AES = require("crypto-js/aes");
// var base64 = require('base-64');
const logger = require('../../config/logger');

var protector = {
  cjs_encrypt: (nor_text) => {
    try {
      // nor_text = nor_text.toString()
      // let c_encrypted = CryptoJS.AES.encrypt(nor_text, sk).toString();
      // return c_encrypted;

      let string = nor_text.toString();
      let secret_key = process.env.SECRET_KEY;
      let secret_iv = process.env.SECRET_IV;
      var key = Sha256(secret_key).toString(Hex).substr(0, 32); // Use the first 32 bytes (see 2.)
      var iv = Sha256(secret_iv).toString(Hex).substr(0, 16);
      var output = false;

      output = AES.encrypt(string, Utf8.parse(key), {
        iv: Utf8.parse(iv),
      }).toString();
      output = Utf8.parse(output).toString(Base64);
      return output;
    } catch (error) {
      logger.error("cjs_encrypt: unexpected error", {
        message: error.message,
        stack: error.stack,
      });
      return null;
    }
  },
  cjs_decrypt: (cipher_text) => {
    try {
      if (!cipher_text || typeof cipher_text !== "string") {
        return null;
      }

      // Strong Base64 validation (optional but safe)
      if (!isValidBase64(cipher_text)) {
        logger.error("Invalid Base64 input", { cipher_text });
        return null;
      }

      const secret_key = process.env.SECRET_KEY;
      const secret_iv = process.env.SECRET_IV;

      const key = Sha256(secret_key).toString(Hex).substr(0, 32);
      const iv = Sha256(secret_iv).toString(Hex).substr(0, 16);

      // ✅ STEP 1: Remove OUTER Base64 (undo Utf8 → Base64)
      const innerBase64 = CryptoJS.enc.Base64.parse(cipher_text).toString(
        CryptoJS.enc.Utf8,
      );

      if (!innerBase64) {
        logger.error("cjs_decrypt: outer base64 decode failed");
        return null;
      }

      // ✅ STEP 2: Decrypt EXACTLY like old working code
      const decrypted = AES.decrypt(innerBase64, Utf8.parse(key), {
        iv: Utf8.parse(iv),
      }).toString(Utf8);

      return decrypted || null;
    } catch (err) {
      logger.error("cjs_decrypt failed", {
        message: err.message,
        stack: err.stack,
      });
      return null;
    }
  },

  encrypt_card: (cardNumber) => {
    try{
    const algorithm = "aes-256-cbc";
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    cipher.setAutoPadding(true);
    let encrypted = cipher.update(cardNumber, "utf8", "hex");
    encrypted += cipher.final("hex");
    const encryptedDigits = encrypted.match(/\d/g).join("").substring(0, 20);
    return encryptedDigits;
    }catch(error){
      logger.error("encrypt_card: unexpected error", {
        message: error.message,
        stack: error.stack,
      });
      return null;
    }
  },
  dynamic_encryption: async (normalText, cipherId, keys) => {
    try {
      let secret_keys;
      if (cipherId) {
        secret_keys = await cipherModel.selectOne("private_key,private_iv", {
          id: cipherId,
          is_active: 1,
        });
      } else {
        secret_keys = keys;
      }

      let string = normalText.toString();
      let secret_key = protector.key_decrypt(secret_keys.private_key);
      let secret_iv = protector.key_decrypt(secret_keys.private_iv);
      var key = Sha256(secret_key).toString(Hex).substr(0, 32); // Use the first 32 bytes (see 2.)
      var iv = Sha256(secret_iv).toString(Hex).substr(0, 16);
      var output = false;

      output = AES.encrypt(string, Utf8.parse(key), {
        iv: Utf8.parse(iv),
      }).toString();
      output = Utf8.parse(output).toString(Base64);
      return output;
    } catch (error) {
      logger.error("dynamic_encryption failed", {
        message: err.message,
        stack: err.stack,
      });
      return null;
    }
  },
  dynamic_decryption: async (cipher_text, cipherId) => {
    try {
      // 1️⃣ Input validation
      if (!cipher_text || typeof cipher_text !== "string") {
        logger.error("dynamic_decryption: invalid cipher_text");
        return null;
      }

      if (!cipherId) {
        logger.error("dynamic_decryption: cipherId missing");
        return null;
      }

      // 2️⃣ Fetch cipher keys
      const secret_keys = await cipherModel.selectOne(
        "private_key, private_iv",
        { id: cipherId },
      );

      if (!secret_keys?.private_key || !secret_keys?.private_iv) {
        logger.error("dynamic_decryption: cipher keys not found", { cipherId });
        return null;
      }

      // 3️⃣ Decrypt stored keys
      const secret_key = protector.key_decrypt(secret_keys.private_key);
      const secret_iv = protector.key_decrypt(secret_keys.private_iv);

      if (!secret_key || !secret_iv) {
        logger.error("dynamic_decryption: key decrypt failed", { cipherId });
        return null;
      }

      // 4️⃣ Prepare AES key & IV
      const key = Sha256(secret_key).toString(Hex).substr(0, 32);
      const iv = Sha256(secret_iv).toString(Hex).substr(0, 16);

      // 5️⃣ FIRST: decode outer Base64 (undo Utf8 → Base64)
      const innerBase64 = CryptoJS.enc.Base64.parse(cipher_text).toString(
        CryptoJS.enc.Utf8,
      );

      if (!innerBase64) {
        logger.error("dynamic_decryption: outer base64 decode failed");
        return null;
      }

      // 6️⃣ NOW decrypt exactly like old working code
      const decrypted = AES.decrypt(innerBase64, Utf8.parse(key), {
        iv: Utf8.parse(iv),
      }).toString(Utf8);

      if (!decrypted) {
        logger.error("dynamic_decryption: empty decrypt output", { cipherId });
        return null;
      }

      return decrypted;
    } catch (error) {
      logger.error("dynamic_decryption: unexpected error", {
        message: error.message,
        stack: error.stack,
      });
      return null;
    }
  },

  key_encrypt: (nor_text) => {
    nor_text = nor_text.toString();
    let c_encrypted = CryptoJS.AES.encrypt(nor_text, sk).toString();
    return c_encrypted;
  },
  key_decrypt: (cipher_text) => {
    let bytes = CryptoJS.AES.decrypt(cipher_text, sk);
    let originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  },
};
module.exports = protector;

function isValidBase64(str) {
  if (typeof str !== 'string') return false;
  if (!str.length || str.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str);
}