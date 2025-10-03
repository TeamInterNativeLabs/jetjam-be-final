const express = require("express");
const router = express.Router();

const generalController = require("../controllers/general.controller");
const upload = require("../middlewares/upload.middleware");

router.post(
  "/upload-image",
  upload("images").single("image"),
  generalController.upload
);

router.post(
  "/upload-audio",
  upload("audio").single("file"),
  generalController.upload
);

router.post(
  "/upload-video",
  upload("videos").single("file"),
  generalController.upload
);

router.post(
  "/upload-zip",
  upload("zips").single("file"),
  generalController.upload
);

router.get("/get", generalController.getData);

router.get("/dashboard", generalController.getDashboard);

module.exports = router;
