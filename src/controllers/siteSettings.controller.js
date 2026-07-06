const SiteSettings = require("../Models/siteSettings.model");
const CustomError = require("../Utils/customError");

exports.getSettings = async (req, res, next) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    return res.status(200).json({ status: true, data: settings });
  } catch (error) {
    return next(new CustomError(error.message, 500));
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
    } else if (fitMixImage !== undefined) {
      settings.fitMixImage = fitMixImage; // allow clearing or setting from body
    }

    await settings.save();

    return res.status(200).json({ status: true, message: "Settings updated successfully", data: settings });
  } catch (error) {
    return next(new CustomError(error.message, 500));
  }
};
