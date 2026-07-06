const multer = require("multer");
const fs = require("fs");

const upload = (path) => {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = `./uploads/${path}`;
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                let filename = file.originalname.split(".");
                cb(null, filename[0] + "_" + new Date().getTime() + "." + filename[1]);
            },
        })
    })
}

module.exports = upload;
