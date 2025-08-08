const { normalize } = require("path")
const Genre = require("../models/genre.model")
const User = require("../models/user.model")
const Album = require("../models/album.model")
const { ROLES, BPM, TIMES } = require("../utils")

const getData = (async (req, res) => {
    try {

        let genres = await Genre.find({ active: true })

        return res.status(200).send({
            success: true,
            data: {
                genres,
                bpm: BPM,
                lengths: TIMES
            }
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getDashboard = (async (req, res) => {
    try {

        let users = await User.countDocuments({ active: true, role: ROLES.USER })
        let genres = await Genre.countDocuments({ active: true })
        let albums = await Album.countDocuments({ active: true })

        return res.status(200).send({
            success: true,
            data: {
                users,
                albums,
                genres
            }
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const upload = (async (req, res) => {
    try {

        let { path } = req.file

        path = normalize(path)

        return res.status(200).send({
            success: true,
            data: {
                path
            }
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
    getData,
    upload,
    getDashboard
}