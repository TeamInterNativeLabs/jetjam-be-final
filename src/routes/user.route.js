const express = require('express')
const router = express.Router()

const userController = require('../controllers/user.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', userController.createUser)

router.get('/get', AuthVerifier, userController.getUser)

router.get('/get/:id', AuthVerifier, userController.getUserById)

router.put('/update/:id?', AuthVerifier, userController.updateUser)

router.delete('/delete/:id', AuthVerifier, userController.deleteUser)

router.post('/change-password', AuthVerifier, userController.changePassword)

router.get('/my-profile', AuthVerifier, userController.getMyProfile)

module.exports = router