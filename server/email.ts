import nodemailer, { type Transporter } from 'nodemailer';

// SMTP Configuration
const smtpHost = process.env.SMTP_HOST || 'smtp-prod.mailrcld.com';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER || 'tanvirahmadkst@gmail.com';
const smtpPass = process.env.SMTP_PASS || '78c303f694908d72536674ff97a2ab95';
const smtpFrom = process.env.SMTP_FROM || '"Lovemeetly Security" <support@lovemeetly.com>';

// Base Public URL for assets (Logo must be an absolute HTTPS URL)
const getAppBaseUrl = (): string => {
  const envUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://lovemeetly.com';
  return envUrl.replace(/\/+$/, '');
};

let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter {
  if (!transporter) {
    const isPort465 = smtpPort === 465;
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isPort465, // false for 587 / STARTTLS
      requireTLS: !isPort465, // Enforces STARTTLS on port 587
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
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
}

// -----------------------------------------------------------------------------
// Lovemeetly Master Branded Email Template Builder
// Compatible with Gmail, Apple Mail, Outlook, Yahoo, and Mobile Email Clients
// -----------------------------------------------------------------------------
export interface BaseEmailTemplateOptions {
  subject: string;
  preheader: string;
  badgeText?: string;
  heading: string;
  subheading?: string;
  contentHtml: string;
  footerNote?: string;
  actionButton?: {
    text: string;
    url: string;
  };
}

export function buildLovemeetlyEmailHtml(options: BaseEmailTemplateOptions): string {
  const appBaseUrl = getAppBaseUrl();
  const logoUrl = `${appBaseUrl}/logo.png`;
  const currentYear = new Date().getFullYear();
  const badge = options.badgeText || 'LOVEMEETLY SECURITY';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>${escapeHtml(options.subject)}</title>
  <style type="text/css">
    /* Client-specific Resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0b0910; }

    /* iOS Blue Links & Dark Mode */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Mobile Responsive Styles */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 !important; }
      .card-content { padding: 28px 20px !important; }
      .header-pad { padding: 32px 18px 24px 18px !important; }
      .otp-code-text { font-size: 28px !important; letter-spacing: 6px !important; }
      .heading-title { font-size: 20px !important; }
    }
  </style>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0b0910; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text (Invisible in body, visible in inbox preview) -->
  <div style="display: none; font-size: 1px; color: #0b0910; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(options.preheader)}
  </div>

  <!-- Background Wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0910; min-width: 100%;">
    <tr>
      <td align="center" style="padding: 30px 12px 40px 12px;">
        
        <!-- Main Email Container (580px max) -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          
          <!-- BRAND HEADER: Centered Logo & Wordmark -->
          <tr>
            <td align="center" class="header-pad" style="padding: 20px 24px 28px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${appBaseUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${logoUrl}" alt="Lovemeetly" width="60" height="60" style="display: block; width: 60px; height: 60px; border-radius: 16px; border: 2px solid #f43f5e; box-shadow: 0 8px 24px rgba(225, 29, 72, 0.4); object-fit: cover; background-color: #1a1622;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 4px;">
                    <a href="${appBaseUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Georgia, serif; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        Lovemeet<span style="color: #f43f5e; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 900;">ly</span>
                      </span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="display: inline-block; font-size: 9px; font-weight: 700; color: #fda4af; text-transform: uppercase; letter-spacing: 2px; padding: 3px 10px; background-color: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.28); border-radius: 20px;">
                      AUTHENTIC WORLDWIDE CONNECTIONS
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CARD CONTENT -->
          <tr>
            <td>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #171320; border: 1px solid #2a2236; border-radius: 20px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6); overflow: hidden;">
                
                <!-- Decorative Top Gradient Accent Line -->
                <tr>
                  <td height="4" style="height: 4px; background: linear-gradient(90deg, #e11d48 0%, #ec4899 50%, #f43f5e 100%); line-height: 4px; font-size: 4px; mso-line-height-rule: exactly;">&nbsp;</td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td class="card-content" style="padding: 38px 34px 34px 34px;">
                    
                    <!-- Category Badge -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
                      <tr>
                        <td style="background-color: rgba(225, 29, 72, 0.14); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 6px; padding: 4px 10px;">
                          <span style="font-size: 11px; font-weight: 700; color: #fb7185; text-transform: uppercase; letter-spacing: 1px;">
                            ${escapeHtml(badge)}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Headline -->
                    <h1 class="heading-title" style="margin: 0 0 10px 0; font-size: 23px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px; line-height: 1.3;">
                      ${options.heading}
                    </h1>

                    <!-- Subheading if any -->
                    ${options.subheading ? `
                    <p style="margin: 0 0 22px 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                      ${options.subheading}
                    </p>
                    ` : ''}

                    <!-- Injected Dynamic Content (e.g., OTP Code, Greetings, Messages) -->
                    ${options.contentHtml}

                    <!-- Optional Action Button -->
                    ${options.actionButton ? `
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 10px 0;">
                      <tr>
                        <td align="center">
                          <a href="${options.actionButton.url}" target="_blank" style="display: inline-block; padding: 14px 34px; background: linear-gradient(135deg, #e11d48 0%, #ec4899 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 6px 20px rgba(225, 29, 72, 0.45); letter-spacing: 0.3px;">
                            ${escapeHtml(options.actionButton.text)}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Optional Footer Note inside Card -->
                    ${options.footerNote ? `
                    <div style="margin-top: 26px; padding-top: 20px; border-top: 1px solid #261e33; font-size: 12px; color: #887d99; line-height: 1.6;">
                      ${options.footerNote}
                    </div>
                    ` : ''}

                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER: Security Information, Links, Copyright -->
          <tr>
            <td align="center" style="padding: 30px 20px 20px 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${appBaseUrl}" target="_blank" style="color: #fda4af; text-decoration: none; font-size: 12px; font-weight: 600; margin: 0 8px;">Website</a>
                    <span style="color: #4b4458;">•</span>
                    <a href="${appBaseUrl}/#help" target="_blank" style="color: #fda4af; text-decoration: none; font-size: 12px; font-weight: 600; margin: 0 8px;">Help Center</a>
                    <span style="color: #4b4458;">•</span>
                    <a href="${appBaseUrl}/#privacy" target="_blank" style="color: #fda4af; text-decoration: none; font-size: 12px; font-weight: 600; margin: 0 8px;">Privacy Policy</a>
                    <span style="color: #4b4458;">•</span>
                    <a href="${appBaseUrl}/#terms" target="_blank" style="color: #fda4af; text-decoration: none; font-size: 12px; font-weight: 600; margin: 0 8px;">Terms</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; color: #716782; line-height: 1.6; padding-bottom: 8px;">
                    This is an automated transactional message sent to you regarding your Lovemeetly account.<br />
                    Please do not reply to this email directly.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; color: #584f68;">
                    &copy; ${currentYear} Lovemeetly. All rights reserved. • Global Dating Platform
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Transactional Template 1: Password Reset Email
// -----------------------------------------------------------------------------
export async function sendPasswordResetEmail(
  toEmail: string,
  otpCode: string,
  userName?: string
): Promise<SendMailResult> {
  const mailer = getEmailTransporter();
  const displayName = userName?.trim() ? userName.trim() : 'Valued Member';
  const cleanEmail = toEmail.trim().toLowerCase();

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e0e6; line-height: 1.6;">
      Hello <strong style="color: #ffffff;">${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #b3acc0; line-height: 1.6;">
      We received a request to reset the password for your Lovemeetly account associated with <strong style="color: #fda4af;">${escapeHtml(cleanEmail)}</strong>.
    </p>
    <p style="margin: 0 0 14px 0; font-size: 13px; color: #948b specification; color: #9c93ac; line-height: 1.5;">
      Please enter the following 6-digit verification code in the Forgot Password window:
    </p>

    <!-- OTP DISPLAY BOX -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, rgba(35, 27, 49, 0.95), rgba(24, 19, 34, 0.95)); border: 2px dashed #f43f5e; border-radius: 16px; padding: 26px 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);">
          <div style="font-size: 11px; font-weight: 700; color: #fda4af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
            ONE-TIME VERIFICATION CODE
          </div>
          <div class="otp-code-text" style="font-family: 'SF Mono', 'Roboto Mono', Monaco, Consolas, monospace; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: 8px; text-shadow: 0 2px 14px rgba(244, 63, 94, 0.6); padding: 4px 0;">
            ${otpCode}
          </div>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
            <tr>
              <td style="background-color: rgba(244, 63, 94, 0.15); border-radius: 12px; padding: 4px 12px;">
                <span style="font-size: 11px; font-weight: 600; color: #fb7185;">
                  ⏱ Valid for 15 minutes
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(225, 29, 72, 0.08); border-left: 3px solid #f43f5e; border-radius: 0 8px 8px 0; margin: 18px 0 6px 0; padding: 12px 16px;">
      <tr>
        <td style="font-size: 12px; color: #d1c8de; line-height: 1.5;">
          <strong style="color: #fda4af;">Security Notice:</strong> Never share this code with anyone. Lovemeetly staff will never ask for your verification code or password.
        </td>
      </tr>
    </table>
  `;

  const footerNote = `
    If you did not initiate this password reset request, please ignore this email. Your current password remains safe and unchanged. If you suspect unauthorized activity, please update your credentials immediately.
  `;

  const html = buildLovemeetlyEmailHtml({
    subject: `${otpCode} is your Lovemeetly verification code`,
    preheader: `Use verification code ${otpCode} to reset your Lovemeetly account password. Valid for 15 minutes.`,
    badgeText: 'PASSWORD RESET VERIFICATION',
    heading: 'Reset Your Password',
    subheading: 'Enter this 6-digit code to securely regain access to your account.',
    contentHtml,
    footerNote,
  });

  const plainText = `Hello ${displayName},\n\nWe received a request to reset your Lovemeetly password.\n\nYour 6-digit verification code is:\n${otpCode}\n\nThis code is valid for 15 minutes. Never share this code with anyone.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nLovemeetly Security Team\nhttps://lovemeetly.com`;

  try {
    const info = await mailer.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject: `${otpCode} is your Lovemeetly password reset code`,
      text: plainText,
      html,
    });

    console.log(`[SMTP Mail] Branded password reset email dispatched to ${cleanEmail}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error(`[SMTP Mail] Failed to send password reset email to ${cleanEmail}:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to dispatch email via SMTP server.',
    };
  }
}

// -----------------------------------------------------------------------------
// Transactional Template 2: Email Verification (Sign up / Email change)
// -----------------------------------------------------------------------------
export async function sendEmailVerificationEmail(
  toEmail: string,
  otpCode: string,
  userName?: string
): Promise<SendMailResult> {
  const mailer = getEmailTransporter();
  const displayName = userName?.trim() ? userName.trim() : 'New Member';
  const cleanEmail = toEmail.trim().toLowerCase();

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e0e6; line-height: 1.6;">
      Welcome to Lovemeetly, <strong style="color: #ffffff;">${escapeHtml(displayName)}</strong>!
    </p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #b3acc0; line-height: 1.6;">
      We're excited to have you join our global community of authentic connections. Please verify your email address to activate your profile:
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, rgba(35, 27, 49, 0.95), rgba(24, 19, 34, 0.95)); border: 2px dashed #f43f5e; border-radius: 16px; padding: 26px 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);">
          <div style="font-size: 11px; font-weight: 700; color: #fda4af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
            ACCOUNT ACTIVATION CODE
          </div>
          <div class="otp-code-text" style="font-family: 'SF Mono', 'Roboto Mono', Monaco, Consolas, monospace; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: 8px; text-shadow: 0 2px 14px rgba(244, 63, 94, 0.6); padding: 4px 0;">
            ${otpCode}
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #fb7185;">
            ⏱ Valid for 24 hours
          </div>
        </td>
      </tr>
    </table>
  `;

  const html = buildLovemeetlyEmailHtml({
    subject: `Welcome to Lovemeetly! Verify your email (${otpCode})`,
    preheader: `Use verification code ${otpCode} to confirm your email and get started on Lovemeetly.`,
    badgeText: 'EMAIL VERIFICATION',
    heading: 'Confirm Your Email Address',
    subheading: 'Complete your registration to discover meaningful global matches.',
    contentHtml,
    footerNote: 'If you did not sign up for a Lovemeetly account, please ignore this email.',
  });

  try {
    const info = await mailer.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject: `Welcome to Lovemeetly! Verify your email (${otpCode})`,
      text: `Your Lovemeetly email verification code is: ${otpCode}.`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// -----------------------------------------------------------------------------
// Transactional Template 3: Welcome Email
// -----------------------------------------------------------------------------
export async function sendWelcomeEmail(
  toEmail: string,
  userName: string
): Promise<SendMailResult> {
  const mailer = getEmailTransporter();
  const appBaseUrl = getAppBaseUrl();
  const cleanEmail = toEmail.trim().toLowerCase();

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e0e6; line-height: 1.6;">
      Dear <strong style="color: #ffffff;">${escapeHtml(userName)}</strong>,
    </p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #b3acc0; line-height: 1.6;">
      Welcome to <strong>Lovemeetly</strong> — the premier dating and social discovery platform designed to connect people across borders through genuine, verified profiles.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #201a2d; border-radius: 12px; margin: 18px 0; padding: 18px;">
      <tr>
        <td>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">✨ Next steps to get the most out of Lovemeetly:</div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #b3acc0; line-height: 1.7;">
            <li>Complete your profile details, bio, and hobbies</li>
            <li>Add clear, attractive photos to boost your visibility</li>
            <li>Explore Discovery to find verified matches worldwide</li>
          </ul>
        </td>
      </tr>
    </table>
  `;

  const html = buildLovemeetlyEmailHtml({
    subject: 'Welcome to Lovemeetly! Your journey begins now',
    preheader: 'Welcome to Lovemeetly! Start connecting with authentic matches around the globe.',
    badgeText: 'WELCOME ABOARD',
    heading: 'Welcome to Lovemeetly',
    subheading: 'Your passport to genuine global connections and dating.',
    contentHtml,
    actionButton: {
      text: 'Explore Your Matches Now',
      url: appBaseUrl,
    },
  });

  try {
    const info = await mailer.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject: 'Welcome to Lovemeetly! Your journey begins now',
      text: `Welcome to Lovemeetly, ${userName}! Explore your matches now at ${appBaseUrl}`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// -----------------------------------------------------------------------------
// Transactional Template 4: Generic / Notification Email (Match, Like, Message)
// -----------------------------------------------------------------------------
export async function sendNotificationEmail(
  toEmail: string,
  userName: string,
  title: string,
  message: string,
  actionText?: string,
  actionUrl?: string
): Promise<SendMailResult> {
  const mailer = getEmailTransporter();
  const appBaseUrl = getAppBaseUrl();
  const cleanEmail = toEmail.trim().toLowerCase();

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e0e6; line-height: 1.6;">
      Hello <strong style="color: #ffffff;">${escapeHtml(userName)}</strong>,
    </p>
    <div style="background-color: #201a2d; border-left: 3px solid #f43f5e; border-radius: 0 12px 12px 0; padding: 18px 20px; margin: 20px 0; font-size: 14px; color: #d4cde0; line-height: 1.6;">
      ${escapeHtml(message)}
    </div>
  `;

  const html = buildLovemeetlyEmailHtml({
    subject: `[Lovemeetly] ${title}`,
    preheader: message.substring(0, 100),
    badgeText: 'NEW NOTIFICATION',
    heading: title,
    contentHtml,
    actionButton: actionText && actionUrl ? {
      text: actionText,
      url: actionUrl.startsWith('http') ? actionUrl : `${appBaseUrl}${actionUrl}`,
    } : undefined,
  });

  try {
    const info = await mailer.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject: `[Lovemeetly] ${title}`,
      text: `${title}\n\n${message}\n\nView on Lovemeetly: ${appBaseUrl}`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// Helper utility to prevent HTML injection in emails
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
