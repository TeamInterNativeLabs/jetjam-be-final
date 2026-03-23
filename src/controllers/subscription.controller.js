const { getUserCurrentSubscription, cancelPayPalSubscription } = require('../helpers/paypal')
const Subscription = require('../models/subscription.model')
const Package = require('../models/package.model')
const paypalClient = require('../configs/paypal')
const mongoose = require('mongoose')
const { paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils')

const getSubscription = (async (req, res) => {
    try {

        let { page, rowsPerPage, search, from, to, sortBy, active } = req.query

        let options = paginationHandler(page, rowsPerPage)

        let filter = {}
        let sort = { createdAt: -1 }
        let projection = {}

        if (req.decoded?.id && req.decoded?.role !== ROLES.ADMIN) {
            filter.user = req.decoded.id
        }

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (req.query.hasOwnProperty('active')) {
            filter.active = active === 'true' || active === true
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let subscriptions = await Subscription.find(filter, projection, options).sort(sort).populate("package user")

        let total = await Subscription.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: subscriptions
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getCurrentSubscription = (async (req, res) => {
    try {

        let { decoded } = req

        let current_subscription = await getUserCurrentSubscription(decoded.email)

        return res.status(200).send({
            success: true,
            data: current_subscription
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const cancelSubscription = (async (req, res) => {
    try {
        const { subscriptionId, id } = req.body || {}
        const subId = subscriptionId || id
        if (!subId) {
            return res.status(400).send({
                success: false,
                message: 'subscriptionId or id is required'
            })
        }
        const subscription = await Subscription.findOne({
            $or: [
                ...(mongoose.Types.ObjectId.isValid(subId) ? [{ _id: subId }] : []),
                { method_subscription_id: subId }
            ],
            user: req.decoded.id
        })
        if (!subscription) {
            return res.status(404).send({
                success: false,
                message: 'Subscription not found'
            })
        }
        if (subscription.canceledAt) {
            return res.status(200).send({
                success: true,
                message: 'Subscription already canceled'
            })
        }
        try {
            await cancelPayPalSubscription(subscription.method_subscription_id)
        } catch (e) {
            console.log('PayPal cancel error (continuing to mark canceled in DB):', e.message)
        }
        subscription.canceledAt = new Date()
        await subscription.save()
        return res.status(200).send({
            success: true,
            message: 'Subscription canceled. Access until end of billing period.'
        })
    } catch (e) {
        console.log('Error Message :: ', e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

// Called by frontend after user returns from PayPal approval page.
// Fetches subscription details directly from PayPal and saves to DB.
// This is the reliable path — works locally and in production without needing webhooks.
const confirmSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.body
        if (!subscriptionId) {
            return res.status(400).send({ success: false, message: 'subscriptionId is required' })
        }

        // Check if already saved (idempotent)
        const existing = await Subscription.findOne({ method_subscription_id: subscriptionId }).populate('package')
        if (existing) {
            return res.status(200).send({ success: true, data: existing, message: 'Already confirmed' })
        }

        // Fetch subscription details from PayPal
        const accessToken = await paypalClient.getAccessToken()
        const response = await fetch(`${process.env.PAYPAL_API_URL}/v1/billing/subscriptions/${subscriptionId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`PayPal returned ${response.status} for subscription ${subscriptionId}`)
        }

        const ppSub = await response.json()

        if (!['ACTIVE', 'APPROVED'].includes(ppSub.status)) {
            return res.status(400).send({ success: false, message: `Subscription status is ${ppSub.status}, not active yet.` })
        }

        // Match the package by plan_id
        const pkg = await Package.findOne({ method_plan_id: ppSub.plan_id })
        if (!pkg) {
            throw new Error(`No package found for PayPal plan_id: ${ppSub.plan_id}`)
        }

        const expiry = ppSub.billing_info?.next_billing_time
            || ppSub.billing_info?.last_payment?.time
            || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // fallback: +30 days

        const subscription = new Subscription({
            method_subscription_id: subscriptionId,
            package: pkg._id,
            user: req.decoded.id,
            expiry,
            active: true
        })

        await subscription.save()
        await subscription.populate('package')

        return res.status(200).send({ success: true, data: subscription })
    } catch (e) {
        console.log('confirmSubscription error:', e)
        return res.status(400).send({ success: false, message: e.message })
    }
}

module.exports = {
    getSubscription,
    getCurrentSubscription,
    cancelSubscription,
    confirmSubscription
}