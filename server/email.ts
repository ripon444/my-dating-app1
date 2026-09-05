import nodemailer, { type Transporter } from 'nodemailer';

// SMTP Configuration
// Configured to support support@ovemeetly.com / support@lovemeetly.com
const smtpHost = process.env.SMTP_HOST || 'mail.lovemeetly.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER || 'support@ovemeetly.com';
const smtpPass = process.env.SMTP_PASS || 'Tanvir@123456789';
const smtpFrom = process.env.SMTP_FROM || `"Lovemeetly Support" <${smtpUser}>`;

let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        // Allow self-signed or custom domain certificates if needed
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  code?: string;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  otpCode: string,
  userName?: string
): Promise<SendMailResult> {
  const mailer = getEmailTransporter();
  const displayName = userName ? userName : 'Valued Member';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Lovemeetly Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #121012;
      color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 540px;
      margin: 30px auto;
      background-color: #1c1917;
      border: 1px solid #292524;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #e11d48, #be185d);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 0;
    }
    .text {
      font-size: 14px;
      color: #a8a29e;
      line-height: 1.6;
    }
    .otp-box {
      background-color: #292524;
      border: 1px dashed #f43f5e;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      color: #fb7185;
      letter-spacing: 6px;
      font-family: monospace;
      display: inline-block;
    }
    .expiry {
      font-size: 12px;
      color: #78716c;
      margin-top: 8px;
    }
    .footer {
      border-top: 1px solid #292524;
      padding: 20px 28px;
      font-size: 11px;
      color: #78716c;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">Lovemeetly</h1>
      <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Secure Password Reset</p>
    </div>
    <div class="content">
      <h2 class="greeting">Hello, ${displayName}!</h2>
      <p class="text">
        We received a request to reset the password for your Lovemeetly account (<strong>${toEmail}</strong>).
      </p>
      <p class="text">
        Use the 6-digit verification code below to complete your password reset:
      </p>
      <div class="otp-box">
        <div class="otp-code">${otpCode}</div>
        <div class="expiry">This code will expire in <strong>15 minutes</strong>.</div>
      </div>
      <p class="text" style="font-size: 12px; color: #a8a29e;">
        If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Lovemeetly. All rights reserved.<br/>
      Sent from support@lovemeetly.com • Authentic Worldwide Connections
    </div>
  </div>
</body>
</html>
  `;

  try {
    const info = await mailer.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `${otpCode} is your Lovemeetly password reset code`,
      text: `Your Lovemeetly password reset code is: ${otpCode}. It expires in 15 minutes.`,
      html: htmlContent,
    });

    console.log(`[SMTP Mail] Password reset email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      code: otpCode,
    };
  } catch (err: any) {
    console.error(`[SMTP Mail] Failed to send email to ${toEmail}:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to dispatch email via SMTP server.',
      code: otpCode,
    };
  }
}
