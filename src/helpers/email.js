const nodemailer = require('nodemailer')
const dotenv = require('dotenv')

dotenv.config();

const transport = nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_FORMAIL,
        pass: process.env.EMAILPASSWORD_FORMAIL
    }
});

const sendMail = (async (from, to, subject, text) => {
    await transport.verify();

    const mailOptions = { from, to, subject, text };
    return transport.sendMail(mailOptions);
})

module.exports = { sendMail }