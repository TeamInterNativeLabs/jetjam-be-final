const multer = require("multer");

const upload = (path) => {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, `./uploads/${path}`);
                // if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/gif") {
                // } else {
                //     cb({ message: "this file is neither a video or image file" }, false);
                // }
            },
            filename: (req, file, cb) => {
                let filename = file.originalname.split(".");
                cb(null, filename[0] + "_" + new Date().getTime() + "." + filename[1]);
            },
        })
    })
}

module.exports = upload;
