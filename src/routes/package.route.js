const express = require('express')
const router = express.Router()

const packageController = require('../controllers/package.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, packageController.createPackage)

router.get('/get', packageController.getPackage)

router.get('/get/:id', packageController.getPackageById)

router.post('/subscribe/:id', AuthVerifier, packageController.subscribe)

module.exports = router