const mongoose = require('mongoose')

const packageSchema = mongoose.Schema({
    method_product_id: {
        type: String,
        required: true
    },
    method_plan_id: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    genre: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Genre',
        required: true
    }],
    features: [{
        type: String,
        required: true
    }],
    duration: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model('Package', packageSchema)