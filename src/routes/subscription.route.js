const express = require('express')
const router = express.Router()

const subscriptionController = require('../controllers/subscription.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.get('/get', AuthVerifier, subscriptionController.getSubscription)

router.get('/get-current-subscription', AuthVerifier, subscriptionController.getCurrentSubscription)

router.post('/confirm', AuthVerifier, subscriptionController.confirmSubscription)

router.post('/cancel', AuthVerifier, subscriptionController.cancelSubscription)

// PayPal webhook endpoint (no auth required - PayPal calls this)
router.post('/webhook', subscriptionController.handleWebhook)

module.exports = router