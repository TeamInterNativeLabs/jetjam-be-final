const mongoose = require('mongoose')
const { encryptData } = require('../helpers/encryption')
const { ENUM_ROLES, ROLES } = require('../utils')

const userSchema = mongoose.Schema({
    first_name: {
        type: String,
        required: true
    },
    last_name: {    
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
    },
    device_ids: {
        type: Array
    },
    role: {
        type: String,
        enum: ENUM_ROLES,
        default: ROLES.USER
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    }
}, { timestamps: true })

userSchema.pre('save', (async function (next) {
    if (this.isModified('password')) {
        let encryptedPassword = await encryptData(this.password)
        this.password = encryptedPassword
        return next()
    }

    return next()

}))

userSchema.pre('findOneAndUpdate', (async function (next) {
    if (this._update.password) {
        let encryptedPassword = await encryptData(this._update.password)
        this._update.password = encryptedPassword
        return next()
    }

    return next()

}))

userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema)