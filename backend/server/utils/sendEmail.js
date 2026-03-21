const nodemailer = require('nodemailer');

const sendEmailSMTP = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === 'true',
        connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 10000),
        greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 10000),
        socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT || 15000),
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Auth System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    });
};

const sendEmailAPI = async (to, subject, html) => {
    // If you are using Brevo's API Key
    const apiKey = process.env.BREVO_API_KEY || process.env.EMAIL_PASS;
    const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    // Extract actual email if formatted like "Name <email@domain.com>"
    const senderEmail = sender.includes('<') ? sender.match(/<([^>]+)>/)[1] : sender;
    const senderName = sender.includes('<') ? sender.split('<')[0].trim() : "Auth System";

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: senderName.replace(/"/g, ''), email: senderEmail },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Brevo API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
};

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 */
const sendEmail = async (to, subject, html) => {
    if (process.env.USE_EMAIL_API === 'true') {
        await sendEmailAPI(to, subject, html);
    } else {
        await sendEmailSMTP(to, subject, html);
    }
};

module.exports = sendEmail;
