const { removeImage } = require('../helpers/image')
const SnpVideo = require('../models/snpvideo.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createSnpVideo = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let snpvideo = new SnpVideo(body)

        await snpvideo.save()

        return res.status(200).send({
            success: true,
            message: "Snp Video Successfully Saved",
            data: snpvideo
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getSnpVideo = (async (req, res) => {
    try {

        let { page, rowsPerPage, search, from, to, sortBy } = req.query

        let options = paginationHandler(page, rowsPerPage)

        let filter = {}
        let sort = { fullName: 1 }
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let snpvideos = await SnpVideo.find(filter, projection, options).sort(sort)

        let total = await SnpVideo.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: snpvideos
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getSnpVideoById = (async (req, res) => {
    try {

        let { id } = req.params

        let snpvideo = await SnpVideo.findById(id)

        return res.status(200).send({
            success: true,
            data: snpvideo
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteSnpVideo = (async (req, res) => {
    try {

        let { params } = req

        let snp = await SnpVideo.findById(params?.id)

        if (!snp) {
            throw new Error("Video not found")
        }

        removeImage(snp?.url)
        removeImage(snp?.thumbnail)
        await SnpVideo.findByIdAndDelete(snp._id)

        return res.status(200).send({
            success: true,
            message: "Snp Video Successfully Deleted",
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
    createSnpVideo,
    getSnpVideo,
    getSnpVideoById,
    deleteSnpVideo
}