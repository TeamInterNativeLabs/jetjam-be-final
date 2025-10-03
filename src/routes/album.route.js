const express = require("express");
const router = express.Router();

const albumController = require("../controllers/album.controller");
const { AuthVerifier, ByPass } = require("../middlewares/auth.middleware");

router.post("/create", AuthVerifier, albumController.createAlbum);

router.post(
  "/create-paid-album",
  AuthVerifier,
  albumController.createPaidAlbum
);

router.get("/get", ByPass, albumController.getAlbum);

router.get("/get-paid-album", ByPass, albumController.getPaidAlbum);

router.get("/get-all-paid-album", ByPass, albumController.getAllPaidAlbum);

router.get("/get/:id", ByPass, albumController.getAlbumById);

router.patch("/handle-status/:id", AuthVerifier, albumController.handleStatus);

router.delete("/delete/:id", AuthVerifier, albumController.deleteAlbum);

router.post("/create-album-order", albumController.create_album_order);

router.post("/capture-album-order", albumController.capture_album_order);

module.exports = router;
