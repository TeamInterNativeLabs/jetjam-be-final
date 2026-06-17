const express = require("express");
const router = express.Router();

const albumController = require("../controllers/album.controller");
const { AuthVerifier, ByPass } = require("../middlewares/auth.middleware");

router.post("/create", AuthVerifier, albumController.createAlbum);

router.post("/create-paid-album", AuthVerifier, albumController.createPaidAlbum);

router.get("/get-paid-album", ByPass, albumController.getPaidAlbum);

router.get("/get-paid-album/:id", ByPass, albumController.getPaidAlbumById);

router.put("/update-paid/:id", AuthVerifier, albumController.updatePaidAlbum);

router.delete("/delete-paid/:id", AuthVerifier, albumController.deletePaidAlbum);

router.patch("/handle-paid-status/:id", AuthVerifier, albumController.handlePaidAlbumStatus);

router.get("/get", ByPass, albumController.getAlbum);

router.get("/get-paid-album", ByPass, albumController.getPaidAlbum);

router.get("/get-all-paid-album", ByPass, albumController.getAllPaidAlbum);

router.get("/get/:id", ByPass, albumController.getAlbumById);

router.patch("/handle-status/:id", AuthVerifier, albumController.handleStatus);

router.put("/update/:id", AuthVerifier, albumController.updateAlbum);

router.delete("/delete/:id", AuthVerifier, albumController.deleteAlbum);

// Album purchase — create-album-order now requires auth so we can record userId
router.post("/create-album-order", ByPass, albumController.create_album_order);

router.post("/capture-album-order", ByPass, albumController.capture_album_order);

// Get all albums purchased by the logged-in user
router.get("/my-purchases", AuthVerifier, albumController.getMyPurchases);

// Secure download by token — no login required, works forever
router.get("/download-by-token/:token", albumController.downloadByToken);

// Secure download by user account
router.get("/download/:albumId", AuthVerifier, albumController.downloadAlbum);

module.exports = router;
