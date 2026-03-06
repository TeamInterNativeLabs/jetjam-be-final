const { isProtected, credentials } = require('./src/configs/ssl')
const express = require('express')
const instance = isProtected ? require('https') : require('http')
const cookieParser = require("cookie-parser")
const cors = require('cors')
const path = require('path')
const logger = require('morgan')
const dotenv = require('dotenv')
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

    switch (webhookEvent.event_type) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
            let package = await Package.findOne({ method_plan_id: webhookEvent?.resource?.plan_id })
            let payload = {
                user: webhookEvent?.resource?.custom_id,
                package: package?._id,
                method_subscription_id: webhookEvent?.resource?.id,
                expiry: webhookEvent?.resource?.billing_info?.next_billing_time
            }
            let subscription = new Subscription(payload)
            await subscription.save()
            break;
        case 'BILLING.SUBSCRIPTION.CREATED':
            console.log('Subscription created:', webhookEvent);
            break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
            console.log('Subscription cancelled:', webhookEvent);
            break;
        case 'PAYMENT.SALE.COMPLETED':
            console.log('Payment completed:', webhookEvent);
            break;
        default:
            console.log('Unhandled event type:', webhookEvent.event_type);
    }

    return res.status(200).send('Webhook received');
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
    } catch (e) {
        console.log("Error while connecting server :: ", e)
    }
}

server.listen(PORT, serverHandler)