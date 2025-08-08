const express = require('express')
const router = express.Router()

const userRoutes = require('./user.route')
const authRoutes = require('./authentication.route')
const feedbackRoutes = require('./feedback.route')
const genreRoutes = require('./genre.route')
const albumRoutes = require('./album.route')
const generalRoutes = require('./general.route')
const packageRoutes = require('./package.route')
const subscriptionRoutes = require('./subscription.route')
const snpvideoRoutes = require('./snpvideo.route')

router.use('/user', userRoutes)

router.use('/auth', authRoutes)

router.use('/feedback', feedbackRoutes)

router.use('/genre', genreRoutes)

router.use('/album', albumRoutes)

router.use('/general', generalRoutes)

router.use('/package', packageRoutes)

router.use('/subscription', subscriptionRoutes)

router.use('/snp-video', snpvideoRoutes)

module.exports = router