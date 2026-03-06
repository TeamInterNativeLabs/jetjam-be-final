const { getUserCurrentSubscription, cancelPayPalSubscription } = require('../helpers/paypal')
const Subscription = require('../models/subscription.model')
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
            $or: [{ _id: subId }, { method_subscription_id: subId }],
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

module.exports = {
    getSubscription,
    getCurrentSubscription,
    cancelSubscription
}