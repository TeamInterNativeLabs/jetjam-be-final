const express = require('express')
const router = express.Router()

const subscriptionController = require('../controllers/subscription.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.get('/get', AuthVerifier, subscriptionController.getSubscription)

router.get('/get-current-subscription', AuthVerifier, subscriptionController.getCurrentSubscription)

router.post('/cancel', AuthVerifier, subscriptionController.cancelSubscription)

module.exports = router