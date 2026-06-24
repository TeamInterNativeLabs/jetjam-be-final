const { getUserCurrentSubscription, cancelPayPalSubscription } = require('../helpers/paypal')
const Subscription = require('../models/subscription.model')
const Package = require('../models/package.model')
const User = require('../models/user.model')
const paypalClient = require('../configs/paypal')
const mongoose = require('mongoose')
const { paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils')
const { sendMail } = require('../helpers/email')

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

        // Mark all previous subscriptions for this user as inactive
        // so only the new one shows as Active in history
        await Subscription.updateMany(
            {
                user: req.decoded.id,
                _id: { $ne: subscription._id },
                active: true
            },
            { $set: { active: false } }
        )

        await subscription.populate('package')

        // Send subscription confirmation email
        try {
            const user = await User.findById(req.decoded.id)
            if (user && user.email) {
                const pkg = subscription.package
                const isDeferred = ppSub.start_time && new Date(ppSub.start_time) > new Date()
                
                let emailText = `Hi ${user.first_name || user.email},\n\n`
                
                if (isDeferred) {
                    emailText += `Your JetJams subscription has been reactivated.\n\n`
                    emailText += `Since you still have access until ${new Date(ppSub.start_time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, your new subscription will begin on that date. You will not be charged until then.\n\n`
                    emailText += `Your new billing cycle:\n`
                    emailText += `- Start date: ${new Date(ppSub.start_time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n`
                    emailText += `- Price: $${pkg.price}/month\n`
                    emailText += `- Next billing: ${new Date(subscription.expiry).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`
                } else {
                    emailText += `Your JetJams subscription is now active!\n\n`
                    emailText += `Plan: ${pkg.title}\n`
                    emailText += `Price: $${pkg.price}/month\n`
                    emailText += `Next billing date: ${new Date(subscription.expiry).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`
                }
                
                emailText += `Manage your subscription: ${process.env.SITE_URL || 'https://www.jetjams.net'}/subscription-logs\n\n`
                emailText += `Thanks,\nJetJams Team`

                await sendMail(
                    'JetJams <johnnyo@jetjams.net>',
                    user.email,
                    isDeferred ? 'Subscription Reactivation Confirmed' : 'Subscription Activated - Welcome to JetJams!',
                    emailText
                )
            }
        } catch (emailError) {
            console.log('Failed to send subscription confirmation email:', emailError)
            // Don't fail the request if email fails
        }

        return res.status(200).send({ success: true, data: subscription })
    } catch (e) {
        console.log('confirmSubscription error:', e)
        return res.status(400).send({ success: false, message: e.message })
    }
}

// PayPal webhook handler for subscription events
const handleWebhook = async (req, res) => {
    try {
        const event = req.body
        const eventType = event.event_type

        console.log(`[PayPal Webhook] Received: ${eventType}`)

        // Handle different subscription events
        switch (eventType) {
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                await handleSubscriptionActivated(event)
                break
            
            case 'PAYMENT.SALE.COMPLETED':
                await handlePaymentCompleted(event)
                break
            
            case 'BILLING.SUBSCRIPTION.CANCELLED':
                await handleSubscriptionCancelled(event)
                break
            
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
            case 'BILLING.SUBSCRIPTION.EXPIRED':
                await handleSubscriptionExpired(event)
                break
            
            default:
                console.log(`[PayPal Webhook] Unhandled event type: ${eventType}`)
        }

        // Always return 200 to acknowledge receipt
        return res.status(200).send({ success: true })
    } catch (e) {
        console.log('[PayPal Webhook] Error:', e)
        // Still return 200 to prevent PayPal retries
        return res.status(200).send({ success: false, message: e.message })
    }
}

// Handle subscription activation (including deferred subscriptions)
async function handleSubscriptionActivated(event) {
    try {
        const subscriptionId = event.resource?.id
        if (!subscriptionId) return

        const subscription = await Subscription.findOne({ 
            method_subscription_id: subscriptionId 
        }).populate('package user')

        if (!subscription) {
            console.log(`[Webhook] Subscription not found: ${subscriptionId}`)
            return
        }

        // If this is a deferred subscription being activated, send email
        const startTime = event.resource?.start_time
        if (startTime && new Date(startTime) > subscription.createdAt) {
            const user = subscription.user
            const pkg = subscription.package

            if (user && user.email) {
                const emailText = `Hi ${user.first_name || user.email},\n\n` +
                    `Your JetJams subscription has been activated and charged.\n\n` +
                    `Plan: ${pkg.title}\n` +
                    `Amount charged: $${pkg.price}\n` +
                    `Next billing date: ${new Date(subscription.expiry).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n` +
                    `Manage your subscription: ${process.env.SITE_URL || 'https://www.jetjams.net'}/subscription-logs\n\n` +
                    `Thanks,\nJetJams Team`

                await sendMail(
                    'JetJams <johnnyo@jetjams.net>',
                    user.email,
                    'Payment Successful - JetJams Subscription Renewed',
                    emailText
                )
            }
        }

        console.log(`[Webhook] Subscription activated: ${subscriptionId}`)
    } catch (e) {
        console.log('[Webhook] handleSubscriptionActivated error:', e)
    }
}

// Handle payment completion (recurring billing)
async function handlePaymentCompleted(event) {
    try {
        const subscriptionId = event.resource?.billing_agreement_id
        if (!subscriptionId) return

        const subscription = await Subscription.findOne({ 
            method_subscription_id: subscriptionId 
        }).populate('package user')

        if (!subscription) {
            console.log(`[Webhook] Subscription not found for payment: ${subscriptionId}`)
            return
        }

        // Update expiry to next billing cycle (add 30 days)
        const currentExpiry = new Date(subscription.expiry)
        const newExpiry = new Date(currentExpiry)
        newExpiry.setDate(newExpiry.getDate() + 30)
        
        subscription.expiry = newExpiry
        subscription.active = true
        await subscription.save()

        // Send payment receipt email
        const user = subscription.user
        const pkg = subscription.package
        const amountPaid = event.resource?.amount?.total || pkg.price

        if (user && user.email) {
            const emailText = `Hi ${user.first_name || user.email},\n\n` +
                `Your JetJams subscription payment was successful.\n\n` +
                `Amount charged: $${amountPaid}\n` +
                `Next billing date: ${newExpiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n` +
                `Payment method: PayPal\n\n` +
                `Manage your subscription: ${process.env.SITE_URL || 'https://www.jetjams.net'}/subscription-logs\n\n` +
                `Thanks,\nJetJams Team`

            await sendMail(
                'JetJams <johnnyo@jetjams.net>',
                user.email,
                'Payment Received - JetJams Subscription',
                emailText
            )
        }

        console.log(`[Webhook] Payment completed for subscription: ${subscriptionId}, new expiry: ${newExpiry}`)
    } catch (e) {
        console.log('[Webhook] handlePaymentCompleted error:', e)
    }
}

// Handle subscription cancellation
async function handleSubscriptionCancelled(event) {
    try {
        const subscriptionId = event.resource?.id
        if (!subscriptionId) return

        const subscription = await Subscription.findOne({ 
            method_subscription_id: subscriptionId 
        })

        if (!subscription) {
            console.log(`[Webhook] Subscription not found: ${subscriptionId}`)
            return
        }

        // Mark as canceled if not already
        if (!subscription.canceledAt) {
            subscription.canceledAt = new Date()
            await subscription.save()
            console.log(`[Webhook] Subscription marked as canceled: ${subscriptionId}`)
        }
    } catch (e) {
        console.log('[Webhook] handleSubscriptionCancelled error:', e)
    }
}

// Handle subscription expiration or suspension
async function handleSubscriptionExpired(event) {
    try {
        const subscriptionId = event.resource?.id
        if (!subscriptionId) return

        const subscription = await Subscription.findOne({ 
            method_subscription_id: subscriptionId 
        })

        if (!subscription) {
            console.log(`[Webhook] Subscription not found: ${subscriptionId}`)
            return
        }

        // Mark as inactive
        subscription.active = false
        await subscription.save()

        console.log(`[Webhook] Subscription marked inactive: ${subscriptionId}`)
    } catch (e) {
        console.log('[Webhook] handleSubscriptionExpired error:', e)
    }
}

module.exports = {
    getSubscription,
    getCurrentSubscription,
    cancelSubscription,
    confirmSubscription,
    handleWebhook
}