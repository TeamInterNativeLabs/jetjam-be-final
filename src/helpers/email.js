const nodemailer = require('nodemailer')
const dotenv = require('dotenv')

dotenv.config();

const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_FORMAIL,
        pass: process.env.EMAILPASSWORD_FORMAIL
    }
});

const sendMail = (async (from, to, subject, text) => {

    try {

        let verified = await transport.verify();

        if (verified) {

            let mailOptions = {
                from,
                to,
                subject,
                text
            };

            return transport.sendMail(mailOptions);

        }

    } catch (e) {
        console.log("Error Message :: ", e)
    }

})

module.exports = { sendMail }