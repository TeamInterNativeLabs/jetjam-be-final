const mongoose = require('mongoose')

const subscriptionSchema = mongoose.Schema({
    method_subscription_id: {
        type: String,
        required: true
    },
    package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiry: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    canceledAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

module.exports = mongoose.model('Subscription', subscriptionSchema)