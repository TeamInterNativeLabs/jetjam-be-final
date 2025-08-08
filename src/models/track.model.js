const mongoose = require('mongoose')

const trackSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
    },
    duration: {
        type: Number,
    }
}, { timestamps: true })

module.exports = mongoose.model('Track', trackSchema)