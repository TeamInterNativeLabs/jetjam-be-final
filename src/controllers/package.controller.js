const User = require('../models/user.model')
const Package = require('../models/package.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils');
const paypalClient = require('../configs/paypal');

async function getFetch() {
    return (await import('node-fetch')).default;
}

const createPackage = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        const accessToken = await paypalClient.getAccessToken();

        const product_url = 'https://api-m.sandbox.paypal.com/v1/catalogs/products';
        const product_payload = {
            name: body?.title,
            type: 'SERVICE'
        };

        const product_response = await fetch(product_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(product_payload)
        });

        const product_result = await product_response.json();

        const plan_url = 'https://api-m.sandbox.paypal.com/v1/billing/plans';
        const plan_payload = {
            product_id: product_result.id,
            name: body?.title,
            billing_cycles: [
                {
                    frequency: {
                        interval_unit: body?.duration?.toUpperCase(),
                        interval_count: 1,
                    },
                    tenure_type: 'REGULAR',
                    sequence: 1,
                    total_cycles: 0,
                    pricing_scheme: {
                        fixed_price: {
                            value: body?.price,
                            currency_code: 'USD',
                        },
                    },
                },
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: {
                    value: '0',
                    currency_code: 'USD',
                },
                setup_fee_failure_action: 'CONTINUE',
                payment_failure_threshold: 3,
            },
        };

        const plan_response = await fetch(plan_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(plan_payload)
        });

        const plan_result = await plan_response.json();

        let package = new Package({ ...body, method_product_id: product_result.id, method_plan_id: plan_result.id })

        await package.save()

        return res.status(200).send({
            success: true,
            message: "Package Successfully Saved",
            data: package
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPackage = (async (req, res) => {
    try {

        let { page, rowsPerPage, search, from, to, sortBy } = req.query

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

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let packages = await Package.find(filter, projection, options).sort(sort)

        let total = await Package.countDocuments(filter)

        res.status(200).send({
            success: true,
            total,
            data: packages
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPackageById = (async (req, res) => {
    try {

        let id = req.params.id

        let package = await Package.findById(id).populate("genre")

        res.status(200).send({
            success: true,
            data: package
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const subscribe = (async (req, res) => {
    try {

        let { params, decoded } = req

        let package = await Package.findById(params.id)

        if (!package) {
            throw new Error("Invalid Package")
        }

        const fetch = await getFetch()
        const user = await User.findById(decoded.id)

        const accessToken = await paypalClient.getAccessToken();

        const url = 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions';
        const payload = {
            plan_id: package?.method_plan_id,
            subscriber: {
                name: {
                    given_name: user?.first_name,
                    surname: user?.last_name,
                },
                email_address: user?.email,
            },
            application_context: {
                brand_name: 'Jet Jams LLC',
                locale: 'en-US',
                user_action: 'SUBSCRIBE_NOW',
                return_url: 'https://jetjams.ssdevserver.tech/return',
                cancel_url: 'https://jetjams.ssdevserver.tech/cancel',
            },
            custom_id: user._id
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const subscriptionResult = await response.json();

        if (!subscriptionResult || !subscriptionResult?.links) {
            throw new Error("Error while making subscription")
        }

        const link = subscriptionResult.links.filter(item => item.rel === "approve")

        return res.status(200).send({
            success: true,
            data: { ...subscriptionResult, link: link?.[0]?.href }
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
    createPackage,
    getPackage,
    getPackageById,
    subscribe
}