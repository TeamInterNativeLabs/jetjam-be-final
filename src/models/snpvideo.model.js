const mongoose = require('mongoose')

const snpvideoSchema = mongoose.Schema({
    thumbnail: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

module.exports = mongoose.model('Snpvideo', snpvideoSchema)