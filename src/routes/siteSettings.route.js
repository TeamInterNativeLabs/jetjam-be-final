const express = require("express");
const router = express.Router();
const siteSettingsController = require("../controllers/siteSettings.controller");
const { AuthVerifier } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

// Public route to get settings
router.get("/", siteSettingsController.getSettings);

// Admin route to update settings
router.put("/", AuthVerifier, upload("settings").single("fitMixImage"), siteSettingsController.updateSettings);

module.exports = router;
