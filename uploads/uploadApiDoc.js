const multer = require("multer");
const path = require("path");
const fs = require("fs");
const httpStatus = require("http-status");

const fileStorage = multer.diskStorage({

    destination: function (req, file, cb) {
        const dir = "public/images/";

        if (!fs.existsSync(dir)) {
            console.log("📂 Directory not found, creating...");
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: function (req, file, cb) {

        const filename =
            "doc-" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        req.uploadedFile = filename;

        cb(null, filename);
    },
});

const fileFilter = (req, file, cb) => {

    const allowedTypes = ["image/png", "image/jpg", "image/jpeg"];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {

        const err = new Error("Only PNG/JPG/JPEG images are allowed");
        err.statusCode = httpStatus.BAD_REQUEST; // 🔥 REQUIRED for your error.js

        cb(err, false);
    }
};

const uploadApiDoc = (req, res, next) => {
    multer({
        storage: fileStorage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: fileFilter,
    }).single("filename")(req, res, function (err) {

        if (err) {

            err.statusCode = err.statusCode || httpStatus.BAD_REQUEST;
            return next(err);
        }

        next();
    });
};

module.exports = uploadApiDoc;
