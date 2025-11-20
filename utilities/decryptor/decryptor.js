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
var base64 = require('base-64');
const logger = require('../../config/logger');

var protector = {
    cjs_encrypt: (nor_text) => {
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
    },
    cjs_decrypt: (cipher_text) => {
        // let bytes  = CryptoJS.AES.decrypt(cipher_text, sk);
        // let originalText = bytes.toString(CryptoJS.enc.Utf8);
        // return originalText;
        try {
            let string = cipher_text.toString();
            let secret_key = process.env.SECRET_KEY;
            let secret_iv = process.env.SECRET_IV;
            var key = Sha256(secret_key).toString(Hex).substr(0, 32); // Use the first 32 bytes (see 2.)
            var iv = Sha256(secret_iv).toString(Hex).substr(0, 16);
            var output = false;

            string = base64.decode(string);

            output = AES.decrypt(string, Utf8.parse(key), {
                iv: Utf8.parse(iv),
            }).toString(Utf8);
            return output;
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            return false;
        }
    },

    encrypt_card: (cardNumber) => {
        const algorithm = "aes-256-cbc";
        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
        const iv = Buffer.alloc(16, 0);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        cipher.setAutoPadding(true);
        let encrypted = cipher.update(cardNumber, "utf8", "hex");
        encrypted += cipher.final("hex");
        const encryptedDigits = encrypted
            .match(/\d/g)
            .join("")
            .substring(0, 20);
        return encryptedDigits;
    },
    dynamic_encryption: async (normalText,cipherId,keys)=>{
        let secret_keys;
        if(cipherId){
            secret_keys = await cipherModel.selectOne('private_key,private_iv',{id:cipherId,is_active:1})
        }else{
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
    },
    dynamic_decryption: async (cipher_text,cipherId) => {
        try {
            let secret_keys = await cipherModel.selectOne('private_key,private_iv',{id:cipherId})
            let string = cipher_text.toString();
            let secret_key = protector.key_decrypt(secret_keys.private_key);
            let secret_iv = protector.key_decrypt(secret_keys.private_iv);
            var key = Sha256(secret_key).toString(Hex).substr(0, 32); // Use the first 32 bytes (see 2.)
            var iv = Sha256(secret_iv).toString(Hex).substr(0, 16);
            let output = false;
            string = base64.decode(string);
            output = AES.decrypt(string, Utf8.parse(key), {
                iv: Utf8.parse(iv),
            }).toString(Utf8);
            return output;
        } catch (error) {
            logger.error(500,{message: error,stack: error?.stack});
            return false;
        }
    },
    key_encrypt: (nor_text) => {
        nor_text = nor_text.toString()
        let c_encrypted = CryptoJS.AES.encrypt(nor_text, sk).toString();
        return c_encrypted;
    },
    key_decrypt: (cipher_text) => {
        let bytes  = CryptoJS.AES.decrypt(cipher_text, sk);
        let originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText;
    },
};
module.exports = protector;