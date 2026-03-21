import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function sendOTPEmail(to: string, otp: string) {
  return transporter.sendMail({
    from: `"Chat App" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Password Reset Code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:30px;text-align:center">
        <h2 style="color:#4f46e5">Password Reset</h2>
        <p style="color:#6b7280">Your verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a2e;margin:20px 0;padding:16px;background:#f3f4f6;border-radius:10px">${otp}</div>
        <p style="color:#9ca3af;font-size:13px">This code expires in 10 minutes. Do not share it.</p>
      </div>
    `
  });
}

export { sendOTPEmail };
