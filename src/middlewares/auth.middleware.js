const { verifyToken } = require('../helpers/token')
const Subscription = require('../models/subscription.model')

module.exports = {
    AuthVerifier: async (req, res, next) => {
        try {

            var token = req.get('Authorization')

            if (!token) return res.status(401).send({ message: 'No token provided' })

            token = token.split(" ")[1]

            if (token) {

                var decoded = await verifyToken(token)

                if (decoded) {
                    req.decoded = decoded
                    next();
                }

            } else {
                throw new Error()
            }

        }
        catch (e) {
            console.log("Error Message :: ", e)
            return res.status(500).send({ message: 'Failed to authenticate token.' })
        }
    },
    ByPass: async (req, res, next) => {
        try {

            var token = req.get('Authorization')
            req.access_to = []

            if (token) {

                token = token.split(" ")[1]
                let decoded = await verifyToken(token)
                let subscription = await Subscription.findOne({ user: decoded.id, active: true }).populate("package")

                if (decoded) {
                    req.decoded = decoded
                }

                if (subscription) {
                    // Allow access if active AND (not canceled OR not yet expired)
                    const now = new Date()
                    const accessValid = subscription.active && (
                        !subscription.canceledAt || new Date(subscription.expiry) > now
                    )
                    if (accessValid) {
                        req.access_to = subscription.package.genre
                    }
                    // If expired after cancel, flip active off so future queries are clean
                    if (subscription.canceledAt && new Date(subscription.expiry) <= now && subscription.active) {
                        subscription.active = false
                        subscription.save().catch(() => {})
                    }
                }

            }

            next();

        }
        catch (e) {
            console.log("Error Message :: ", e)
            return res.status(500).send({ message: 'Failed to authenticate token.' })
        }
    }
};
