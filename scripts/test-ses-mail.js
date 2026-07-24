// Standalone SES/SMTP connectivity test — bypasses NestJS entirely.
// Usage: node scripts/test-ses-mail.js you@example.com
require('dotenv').config();
const nodemailer = require('nodemailer');

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-ses-mail.js <recipient-email>');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_EMAIL_USERNAME,
    pass: process.env.SMTP_EMAIL_PASSWORD,
  },
  logger: true,
  debug: true,
});

transporter.verify()
  .then(() => console.log('SMTP connection OK, credentials accepted.'))
  .catch((err) => console.error('SMTP verify FAILED:', err));

transporter.sendMail({
  from: process.env.ADMIN_EMAIL,
  to,
  subject: 'Chatbu SES test',
  text: `Test mail sent at ${new Date().toISOString()}`,
})
  .then((info) => {
    console.log('Send OK:', info);
  })
  .catch((err) => {
    console.error('Send FAILED:', err);
  });
