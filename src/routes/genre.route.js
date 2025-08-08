const express = require('express')
const router = express.Router()

const genreController = require('../controllers/genre.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, genreController.createGenre)

router.get('/get', AuthVerifier, genreController.getGenre)

router.get('/get/:id', AuthVerifier, genreController.getGenreById)

router.get('/stats', genreController.getGenreStats)

module.exports = router