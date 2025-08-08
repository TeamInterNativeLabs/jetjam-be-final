const Genre = require('../models/genre.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createGenre = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let genre = new Genre(body)

        await genre.save()

        return res.status(200).send({
            success: true,
            message: "Genre Successfully Saved",
            data: genre
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getGenre = (async (req, res) => {
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

        let genres = await Genre.find(filter, projection, options).sort(sort)

        let total = await Genre.countDocuments(filter)

        res.status(200).send({
            success: true,
            total,
            data: genres
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getGenreById = (async (req, res) => {
    try {

        let id = req.params.id

        let genre = await Genre.findById(id)

        res.status(200).send({
            success: true,
            data: genre
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getGenreStats = (async (_, res) => {
    try {

        let data = await Genre.aggregate(
            [
                {
                    $lookup: {
                        from: "albums",
                        localField: "_id",
                        foreignField: "genre",
                        as: "albums"
                    }
                },
                {
                    $addFields: {
                        albums: {
                            $size: '$albums'
                        },
                    }
                },
                {
                    $match: {
                        albums: { $gt: 0 }
                    }
                }
            ]
        )

        return res.status(200).send({
            success: true,
            data
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
    createGenre,
    getGenre,
    getGenreById,
    getGenreStats
}