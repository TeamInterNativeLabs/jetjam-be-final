const mongoose = require('mongoose')

const albumPurchaseSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null
    },
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaidAlbum',
        required: true
    },
    paypal_order_id: {
        type: String,
        required: true,
        unique: true
    },
    amount_paid: {
        type: Number,
        required: true
    },
    // Payer info from PayPal — stored for guest purchases
    payer_email: {
        type: String,
        default: null
    },
    payer_name: {
        type: String,
        default: null
    },
    payer_address: {
        type: String,
        default: null
    },
    // Secure token for lifetime download without login
    download_token: {
        type: String,
        required: true,
        unique: true
    }
}, { timestamps: true })

module.exports = mongoose.model('AlbumPurchase', albumPurchaseSchema)
