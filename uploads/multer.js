/*File upload start*/
var path = require('path')
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const img_file = uniqueSuffix + path.extname(file.originalname)
        if(req.all_files){
            req.all_files[file.fieldname] = img_file
          }else{
            req.all_files = {}
            req.all_files[file.fieldname] = img_file
          }
        cb(null, img_file)
    }
});
const uploadfiles = multer({
    storage: storage, fileFilter: (req, file, cb) => {

        if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg') {
            cb(null, true);
        } else {
            cb(null, false);
            // res.status(StatuCode.badRequest).send()
            return cb(new Error('Only111 .png, .jpg, .pdf, .docx and .jpeg format allowed!'));
        }
    }
});
const fileFilter = (req, file, cb) => {
    if (file.fieldname === "resume") {  if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'    ) { // check file type to be pdf, doc, or docx      cb(null, true);
      } else {
        cb(null, false);  //else fails 
       }
    } else { // else uploading image 
        if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
      ) { 
        cb(null, true); 
      } else {
        cb(null, false); // else fails
      }
    }
  };
const uploadImages = multer({
    storage: storage,  limits:{fileSize:1024 * 1024 * 1},fileFilter: fileFilter
});

const files = uploadfiles.single('files');
const profilepic = uploadImages.single('image');
const logo = uploadImages.single('logo');

var uploader = {
    uploadfile: function (req, res, next) {
        files(req, res, function (err) {
            if (err) {
              
                return res.status(400).send({ message: err.message, status: false })
            } else {
                next();
            }

        })
    },
    uploadUserProfilePic: function (req, res, next) {
        profilepic(req, res, function (err) {
            if (err) {
                return res.status(200).send({ message: err.message, status: false })
            } else {
                next();
            }

        })
    },
    uploadCompanyLogo: function (req, res, next) {
        logo(req, res, function (err) {
            if (err) {
                return res.status(400).send({ message: err.message, status: false })
            } else {
                next();
            }

        })
    }

}



module.exports = uploader;