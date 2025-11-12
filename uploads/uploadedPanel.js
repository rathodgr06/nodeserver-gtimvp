const FormData = require('form-data');
const fs = require('fs');
const ServerResponse = require('../utilities/response/ServerResponse');
const StatusCode = require('../utilities/statuscode/index');
const uploadedPanel = {
    profile_pic: async (req, res, next) => {
        if (!req.file) {
            next();
        } else {
            req.body.profile_pic = req.file.filename;
            next();
        }
    },
    uploadlogo: async (req, res, next) => {

        if (!req.file) {
            next();
        } else {
            req.body.logo = req.file.filename
            next();
        }
    },
    files: async (req, res, next) => {
        
        if (req.all_files.files) {
            next();
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Please upload valid file. Only .json file accepted (size: upto 1MB)'));
        }
    },
    flag:async(req,res,next)=>{
        if (req.all_files.flag) {
            next();
        } else {
            res.status(StatusCode.badRequest).send(ServerResponse.validationResponse('Please upload valid flag file. Only .jpg,.png file accepted (size: upto 1MB)'));
        }
        next();
    },
    file2:async(req,res,next)=>{
        if (!req.file) {
            next();
        } else {
            req.body.file2 = req.file.filename
            next();
        }
        next();
    },
    file3:async(req,res,next)=>{
        if (!req.file) {
            next();
        } else {
            req.body.file3 = req.file.filename
            next();
        }
        next();
    },
    file4:async(req,res,next)=>{
        if (!req.file) {
            next();
        } else {
            req.body.file4 = req.file.filename
            next();
        }
        next();
    },
    captureFilename:async(req,res,next)=>{
        if (!req.file) {
            next();
        } else {
            req.body.files = req.file.filename
            next();
        }
    }
}
module.exports = uploadedPanel;
