const SiteSettings = require("../models/siteSettings.model");

exports.getSettings = async (req, res, next) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    return res.status(200).json({ status: true, data: settings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }

    const { fitMixMessageHTML, fitMixVideoUrl, fitMixImage } = req.body;
    
    // update fields
    if (fitMixMessageHTML !== undefined) settings.fitMixMessageHTML = fitMixMessageHTML;
    if (fitMixVideoUrl !== undefined) settings.fitMixVideoUrl = fitMixVideoUrl;
    
    // image upload handle if there is an image in req.file or req.body
    if (req.file) {
      settings.fitMixImage = req.file.filename;
      settings.fitMixVideoUrl = ""; // Clear video URL when image is uploaded
    } else if (fitMixImage !== undefined) {
      settings.fitMixImage = fitMixImage; // allow clearing or setting from body
    }

    await settings.save();

    return res.status(200).json({ status: true, message: "Settings updated successfully", data: settings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
