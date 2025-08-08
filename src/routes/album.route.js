const express = require('express')
const router = express.Router()

const albumController = require('../controllers/album.controller')
const { AuthVerifier, ByPass } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, albumController.createAlbum)

router.get('/get', ByPass, albumController.getAlbum)

router.get('/get/:id', ByPass, albumController.getAlbumById)

router.patch('/handle-status/:id', AuthVerifier, albumController.handleStatus)

router.delete('/delete/:id', AuthVerifier, albumController.deleteAlbum)

module.exports = router