const mongoose = require('mongoose')

const albumPurchaseSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaidAlbum',
        required: true
    },
    paypal_order_id: {
        type: String,
        required: true
    },
    amount_paid: {
        type: Number,
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model('AlbumPurchase', albumPurchaseSchema)
