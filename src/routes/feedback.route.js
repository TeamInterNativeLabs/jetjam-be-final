const express = require('express')
const router = express.Router()

const feedbackController = require('../controllers/feedback.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', feedbackController.createFeedback)

router.get('/get', AuthVerifier, feedbackController.getFeedback)

router.get('/get/:id', AuthVerifier, feedbackController.getFeedbackById)

module.exports = router