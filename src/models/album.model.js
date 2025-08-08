const mongoose = require('mongoose')

const albumSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    genre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Genre',
        required: true
    },
    bpm: {
        type: Number,
        required: true
    },
    length: {
        type: Number,
        required: true
    },
    tracks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Track',
        required: true
    }],
    file: {
        type: String,
        required: true
    },
    new: {
        type: Boolean,
        default: true
    },
    suggested: {
        type: Boolean,
        default: false
    },
    trending: {
        type: Boolean,
        default: false
    },
    free: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

module.exports = mongoose.model('Album', albumSchema)