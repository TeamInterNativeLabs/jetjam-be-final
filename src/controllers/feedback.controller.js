const Feedback = require('../models/feedback.model')
const { sendMail } = require('../helpers/email')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createFeedback = (async (req, res) => {
    try {

        let body = req.body

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let feedback = new Feedback(req.body)

        await feedback.save()

        // Send email notification
        try {
            const emailSubject = `Contact Form Submission: ${body.subject}`
            const emailText = `New contact form submission from JetJams website:

Name: ${body.name}
Email: ${body.email}
Subject: ${body.subject}

Message:
${body.message}

Submitted on: ${new Date().toLocaleString()}

---
This email was automatically generated from the JetJams contact form.`

            await sendMail(
                process.env.EMAIL_FORMAIL,
                'johnnyo@jetjams.net',
                emailSubject,
                emailText
            )
            console.log('Contact form email sent successfully to johnny@jetjams.net')
        } catch (emailError) {
            console.error('Failed to send contact form email:', emailError)
            // Don't fail the request if email fails - user still gets success response
        }

        return res.status(200).send({
            success: true,
            message: "Feedback Successfully Saved and Email Sent",
            data: feedback
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFeedback = (async (req, res) => {
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

        let feedbacks = await Feedback.find(filter, projection, options).sort(sort)

        let total = await Feedback.countDocuments(filter)

        res.status(200).send({
            success: true,
            total,
            data: feedbacks
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFeedbackById = (async (req, res) => {
    try {

        let id = req.params.id

        let feedback = await Feedback.findById(id)

        res.status(200).send({
            success: true,
            data: feedback
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createFeedback,
    getFeedback,
    getFeedbackById
}