const nodemailer = require("nodemailer");
const {
  sendEmail,
  verifyMailConnection
} = require("./server/mailer");
const requiredVariables = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM"
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, text, html }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html
  });
}

async function verifyMailConnection() {
  await transporter.verify();
  console.log("Zoho SMTP connection successful.");
}

module.exports = {
  sendEmail,
  verifyMailConnection
};