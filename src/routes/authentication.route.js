const express = require('express')
const router = express.Router()

const authController = require('../controllers/authentication.controller')
const { ByPass } = require('../middlewares/auth.middleware')

router.post('/login', authController.login)

router.post('/logout', ByPass, authController.logout)

router.post('/forget-password', authController.forgetPassword)

router.post('/verify-otp', authController.verifyOtp)

router.post('/reset-password', authController.resetPassword)

router.post('/send-verification-email', authController.sendVerificationEmail)

router.post('/verify-email', authController.verifyEmail)

module.exports = router