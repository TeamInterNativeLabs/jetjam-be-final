const mongoose = require("mongoose");

const SiteSettingsSchema = new mongoose.Schema(
  {
    fitMixMessageHTML: {
      type: String,
      default: "",
    },
    fitMixVideoUrl: {
      type: String,
      default: "",
    },
    fitMixImage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const SiteSettings = mongoose.model("SiteSettings", SiteSettingsSchema);
module.exports = SiteSettings;
