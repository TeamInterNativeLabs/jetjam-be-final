const mongoose = require("mongoose");
const Package = require("./src/Models/package.model");

mongoose.connect("mongodb://127.0.0.1:27017/jetjams", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("Connected to DB");
    const pkgs = await Package.find({});
    console.log("Packages:", pkgs.map(p => p.title));
    process.exit(0);
  })
  .catch(err => {
    console.error("DB Error:", err);
    process.exit(1);
  });
