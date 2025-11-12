const multer = require('multer');
const path = require('path');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
   
      cb(null, 'public/files');
    
  },
  filename: (req, file, cb) => { 
    let filename = file.fieldname+"-"+Date.now() + '-' + Math.round(Math.random() * 1E9)+path.extname(file.originalname);
    if(req.all_files){
      req.all_files[file.fieldname] = filename
    }else{
      req.all_files = {}
      req.all_files[file.fieldname] = filename
    }
    cb(null, filename);
   
  }
});

const fileFilter = (req, file, cb) => {
  
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'application/pdf'
      ) {
     
      cb(null, true);
    } else {
      cb(null, false); // else fails
    }
  
};

let upload = multer({storage: fileStorage, limits: { fileSize: 2097152 },fileFilter: fileFilter}).any()

module.exports = upload