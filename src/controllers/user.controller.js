const mongoose = require('mongoose')
const User = require('../models/user.model')
const Subscription = require('../models/subscription.model')
const { removeImage } = require('../helpers/image')
const { comparePassword } = require('../helpers/encryption')
const {
    paginationHandler,
    objectValidator,
    getSearchQuery,
    getDateRangeQuery,
    ERRORS,
    ROLES,
} = require('../utils')

const createUser = (async (req, res) => {
    try {

        let body = req.body

        let { email } = body

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let userExist = await User.findOne({ email }, { _id: 1 })

        if (userExist) {
            throw new Error(ERRORS.USER_EXIST)
        }

        let user = new User(req.body)

        await user.save()

        return res.status(200).send({
            success: true,
            message: "User Successfully Saved"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getUser = (async (req, res) => {
    try {

        let { page, rowsPerPage, role, search, from, to, sortBy } = req.query

        let options = paginationHandler(page, rowsPerPage)

        let filter = {}
        let sort = { fullName: 1 }

        if (role && role !== 'undefined') {
            filter = { ...filter, role }
        }

        if (search) {
            filter = {
                ...filter,
                $or: [
                    { first_name: getSearchQuery(search) },
                    { last_name: getSearchQuery(search) },
                    { email: getSearchQuery(search) }
                ]
            }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let projection = {
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            picture: 1,
            active: 1,
            createdAt: 1
        }

        let users = await User.find(filter, projection, options).sort(sort).lean()

        let total = await User.countDocuments(filter)

        if (users?.length && req.decoded?.role === ROLES.ADMIN) {
            const now = new Date()
            for (const user of users) {
                const sub = await Subscription.findOne({ user: user._id })
                    .sort({ createdAt: -1 })
                    .populate('package')
                    .lean()
                user.subscription = sub ? {
                    plan: sub.package?.title,
                    price: sub.package?.price,
                    active: sub.active,
                    createdAt: sub.createdAt,
                    expiry: sub.expiry,
                    canceledAt: sub.canceledAt,
                } : null
            }
        }

        return res.status(200).send({
            success: true,
            total,
            data: users
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getUserById = (async (req, res) => {
    try {

        let { id } = req.params
        let _id = new mongoose.Types.ObjectId(id);

        let user = await User.findById(_id)

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const updateUser = (async (req, res) => {
    try {

        let userId = null
        let { picture } = req.body

        let { id } = req.params

        if (id) {
            userId = id
        } else if (req.decoded.id) {
            userId = req.decoded.id
        }

        let projection = { __v: 0, password: 0 }
        // let populate = {}

        // if (picture) {
        //     let user = await User.findById(userId, { picture: 1 }).populate(populate).lean()
        //     if (user?.picture?.path) {
        //         removeImage(user.picture.path)
        //     }
        // }

        let user = await User.findByIdAndUpdate(userId, req.body, { projection, new: true }).lean()

        // user.picture = user?.picture?.path

        const now = new Date();

        const subscription = await Subscription.findOne({
            user: userId,
            expiry: { $gte: now },
            active: true,
        }).populate('package');

        user.subscription = subscription

        return res.status(200).send({
            success: true,
            message: "User Successfully Updated",
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteUser = (async (req, res) => {
    try {

        let id = req.params.id

        await User.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "User Successfully Deleted"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const changePassword = (async (req, res) => {
    try {

        let { id } = req.decoded
        let { current_password, new_password } = req.body

        if (!current_password || !new_password) {
            throw new Error("Current Password or New Password is not provided")
        }

        let user = await User.findById(id)

        let validPassword = await comparePassword(current_password, user.password)

        if (!validPassword) {
            throw new Error("Current Password doesn't match")
        }

        await User.findOneAndUpdate({ _id: id }, { password: new_password })

        return res.status(200).send({
            success: true,
            message: "Password reset successfully"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getMyProfile = (async (req, res) => {
    try {

        let id = req.decoded.id

        let projection = {
            password: 0,
            __v: 0
        }

        let user = await User.findById(id, projection).lean()

        const now = new Date()
        const subscription = await Subscription.findOne({
            user: id,
            expiry: { $gte: now },
            active: true,
        }).populate('package')

        user = user ? { ...user, subscription } : user

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createUser,
    getUser,
    getUserById,
    updateUser,
    deleteUser,
    changePassword,
    getMyProfile,
}