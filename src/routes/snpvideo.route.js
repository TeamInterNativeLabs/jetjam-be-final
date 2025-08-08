const express = require('express')
const router = express.Router()

const snpvideoController = require('../controllers/snpvideo.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, snpvideoController.createSnpVideo)

router.get('/get', snpvideoController.getSnpVideo)

router.get('/get/:id', snpvideoController.getSnpVideoById)

router.delete('/delete/:id', AuthVerifier, snpvideoController.deleteSnpVideo)

module.exports = router