const express = require("express");
const router = express.Router();
const siteSettingsController = require("../Controllers/siteSettings.controller");
const Auth = require("../Middlewares/auth");
const { upload } = require("../Utils/multer");

// Public route to get settings
router.get("/", siteSettingsController.getSettings);

// Admin route to update settings
router.put("/", Auth.VerifyAdmin, upload.single("fitMixImage"), siteSettingsController.updateSettings);

module.exports = router;
