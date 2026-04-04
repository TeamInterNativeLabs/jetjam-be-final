const { getUserCurrentSubscription } = require('../helpers/paypal')
const Subscription = require('../models/subscription.model')
const { paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const getSubscription = (async (req, res) => {
    try {

        let { page, rowsPerPage, search, from, to, sortBy, active } = req.query

        let options = paginationHandler(page, rowsPerPage)

        let filter = {}
        let sort = { fullName: 1 }
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (req.query.hasOwnProperty('active')) {
            filter.active = active
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
            total,
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

module.exports = {
    getSubscription,
    getCurrentSubscription
}