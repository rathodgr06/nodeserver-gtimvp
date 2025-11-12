const multer = require('multer');
const path = require('path');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "doc") {
      cb(null, 'public/docs');
    } else {
      cb(null, 'public/docs');
    }
  },
  filename: (req, file, cb) => {
    let filename = file.fieldname + "-" + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    
    if (filename) {
      req.body.doc = filename
    } else {
      req.body.doc = ''
    }

    cb(null, filename);

  }
});

const fileFilter = (req, file, cb) => {
  
  if (file.fieldname === "doc") {
    if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.mimetype === 'application/vnd.ms-excel') {

      cb(null, true);
    } else {
      cb(null, false); // else fails
    }
  } else { // else uploading image
    cb(null, false);
  }
};

let upload = multer({ storage: fileStorage, limits: { fileSize: '1mb' }, fileFilter: fileFilter }).fields([
  {
    name: 'doc',
    maxCount: 1
  }
])

module.exports = upload