const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { uploadDirectory } = require('../config/environment');
module.exports = multer({
 storage: multer.diskStorage({ destination(req,file,cb) { const dir=path.join(uploadDirectory(),'imports'); fs.mkdirSync(dir,{recursive:true}); cb(null,dir); }, filename(req,file,cb) { cb(null,randomUUID()+'.xlsx'); } }),
 limits: { fileSize: 5*1024*1024, files:1, fields:8 },
 fileFilter(req,file,cb) { cb(/\.xlsx$/i.test(file.originalname) ? null : new Error('Only .xlsx files are accepted'), /\.xlsx$/i.test(file.originalname)); }
});
