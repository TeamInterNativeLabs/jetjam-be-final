const { isProtected, credentials } = require('./src/configs/ssl')
const express = require('express')
const instance = isProtected ? require('https') : require('http')
const cookieParser = require("cookie-parser")
const cors = require('cors')
const path = require('path')
const logger = require('morgan')
const dotenv = require('dotenv')
const cron = require('node-cron')
const routes = require('./src/routes')
const { connectDatabase } = require('./src/configs/dbConnection')
const { makeFolders } = require('./src/helpers/image')

const Subscription = require("./src/models/subscription.model")
const Package = require("./src/models/package.model")

dotenv.config()

const
    PORT = parseInt(process.env.PORT),
    dbName = process.env.APP_NAME,
    connectionString = process.env.DB_CONNECTION_STRING

if (!connectionString || !dbName) {
    console.log("Connection String or Database Name not provided!")
    process.exit(1)
}

if (!PORT) {
    console.log("Port is not defined!")
    process.exit(1)
}

let app = express()

app.post('/webhook/paypal', express.json(), async (req, res) => {
    const webhookEvent = req.body;
    console.log('[WEBHOOK] PayPal event received:', webhookEvent.event_type)

    try {
        switch (webhookEvent.event_type) {
            case 'BILLING.SUBSCRIPTION.ACTIVATED': {
                const pkg = await Package.findOne({ method_plan_id: webhookEvent?.resource?.plan_id })
                if (pkg) {
                    const existing = await Subscription.findOne({ method_subscription_id: webhookEvent?.resource?.id })
                    if (!existing) {
                        const payload = {
                            user: webhookEvent?.resource?.custom_id,
                            package: pkg?._id,
                            method_subscription_id: webhookEvent?.resource?.id,
                            expiry: webhookEvent?.resource?.billing_info?.next_billing_time,
                            active: true
                        }
                        const subscription = new Subscription(payload)
                        await subscription.save()
                        console.log('[WEBHOOK] Subscription activated and saved:', webhookEvent?.resource?.id)
                    }
                }
                break
            }
            case 'BILLING.SUBSCRIPTION.CANCELLED': {
                await Subscription.findOneAndUpdate(
                    { method_subscription_id: webhookEvent?.resource?.id },
                    { canceledAt: new Date() }
                )
                console.log('[WEBHOOK] Subscription cancelled:', webhookEvent?.resource?.id)
                break
            }
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
                // Mark as inactive on payment failure
                await Subscription.findOneAndUpdate(
                    { method_subscription_id: webhookEvent?.resource?.id },
                    { active: false }
                )
                console.log('[WEBHOOK] Subscription suspended/payment failed:', webhookEvent?.resource?.id)
                break
            }
            case 'BILLING.SUBSCRIPTION.RENEWED': {
                // Update expiry on renewal
                const newExpiry = webhookEvent?.resource?.billing_info?.next_billing_time
                if (newExpiry) {
                    await Subscription.findOneAndUpdate(
                        { method_subscription_id: webhookEvent?.resource?.id },
                        { expiry: newExpiry, active: true, canceledAt: null }
                    )
                    console.log('[WEBHOOK] Subscription renewed, new expiry:', newExpiry)
                }
                break
            }
            case 'BILLING.SUBSCRIPTION.CREATED':
                console.log('[WEBHOOK] Subscription created:', webhookEvent?.resource?.id)
                break
            case 'BILLING.SUBSCRIPTION.EXPIRED': {
                // Mark as inactive when subscription expires
                await Subscription.findOneAndUpdate(
                    { method_subscription_id: webhookEvent?.resource?.id },
                    { active: false }
                )
                console.log('[WEBHOOK] Subscription expired:', webhookEvent?.resource?.id)
                break
            }
            case 'BILLING.SUBSCRIPTION.RE_ACTIVATED': {
                // Re-activate subscription
                const reactivatedExpiry = webhookEvent?.resource?.billing_info?.next_billing_time
                await Subscription.findOneAndUpdate(
                    { method_subscription_id: webhookEvent?.resource?.id },
                    { active: true, canceledAt: null, ...(reactivatedExpiry ? { expiry: reactivatedExpiry } : {}) }
                )
                console.log('[WEBHOOK] Subscription re-activated:', webhookEvent?.resource?.id)
                break
            }
            case 'PAYMENT.SALE.COMPLETED':
                console.log('[WEBHOOK] Payment completed for subscription:', webhookEvent?.resource?.billing_agreement_id)
                break
            default:
                console.log('[WEBHOOK] Unhandled event type:', webhookEvent.event_type)
        }
    } catch (e) {
        console.log('[WEBHOOK] Error processing event:', e.message)
    }

    return res.status(200).send('Webhook received')
});

app.use(logger('dev'))
app.use(express.json({ limit: "350mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors())

// Serve uploaded images first so GET /uploads/images/xxx.jpg works
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(`/${process.env.APP_NAME}/v1/api`, routes)

let server = instance.createServer(credentials, app)

const serverHandler = async () => {
    try {
        console.log(`Server started 🚀 Running on port ${PORT}.`)
        makeFolders()
        await connectDatabase(dbName, connectionString)

        // Run every day at midnight — expire subscriptions whose billing period has ended
        cron.schedule('0 0 * * *', async () => {
            try {
                const now = new Date()
                const result = await Subscription.updateMany(
                    { active: true, expiry: { $lt: now } },
                    { $set: { active: false } }
                )
                if (result.modifiedCount > 0) {
                    console.log(`[CRON] Expired ${result.modifiedCount} subscription(s)`)
                }
            } catch (e) {
                console.log('[CRON] Error expiring subscriptions:', e.message)
            }
        })
        console.log('[CRON] Subscription expiry job scheduled (daily at midnight)')
    } catch (e) {
        console.log("Error while connecting server :: ", e)
    }
}

server.listen(PORT, serverHandler)