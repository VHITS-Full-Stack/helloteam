/**
 * Email Service Placeholder
 *
 * This is a placeholder for email functionality. In production, integrate with:
 * - SendGrid (https://sendgrid.com)
 * - AWS SES (https://aws.amazon.com/ses/)
 * - Mailgun (https://www.mailgun.com)
 * - Nodemailer with SMTP
 *
 * Example integration with Nodemailer:
 * ```
 * npm install nodemailer
 * npm install @types/nodemailer -D
 * ```
 */

import { config } from '../config';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email
 * Currently logs to console in development, would send actual email in production
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailResult> => {
  const { to, subject, html, text } = options;

  if (config.env === 'development') {
    console.log('====================================');
    console.log('📧 EMAIL SERVICE (Development Mode)');
    console.log('====================================');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('------------------------------------');
    console.log('HTML Content:');
    console.log(html);
    if (text) {
      console.log('------------------------------------');
      console.log('Text Content:');
      console.log(text);
    }
    console.log('====================================');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }

  // TODO: Implement actual email sending in production
  // Example with Nodemailer:
  //
  // const transporter = nodemailer.createTransporter({
  //   host: config.email.host,
  //   port: config.email.port,
  //   secure: config.email.secure,
  //   auth: {
  //     user: config.email.user,
  //     pass: config.email.pass,
  //   },
  // });
  //
  // const info = await transporter.sendMail({
  //   from: config.email.from,
  //   to,
  //   subject,
  //   text,
  //   html,
  // });
  //
  // return { success: true, messageId: info.messageId };

  console.warn('Email service not configured for production');
  return {
    success: false,
    error: 'Email service not configured',
  };
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  userName?: string
): Promise<EmailResult> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #4b5563; line-height: 1.6;">
            This link will expire in 1 hour for security reasons.
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hello Team. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password.

Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} Hello Team. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Hello Team',
    html,
    text,
  });
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  email: string,
  userName: string,
  temporaryPassword?: string
): Promise<EmailResult> => {
  const loginUrl = `${config.frontendUrl}/login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Hello Team</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to Hello Team!</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            Your account has been created successfully. You can now access the Hello Team Workforce Hub.
          </p>
          ${temporaryPassword ? `
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-weight: 600;">Your temporary password:</p>
            <p style="color: #92400e; margin: 8px 0 0 0; font-family: monospace; font-size: 16px;">${temporaryPassword}</p>
            <p style="color: #92400e; margin: 8px 0 0 0; font-size: 12px;">Please change this password after your first login.</p>
          </div>
          ` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          <p style="color: #4b5563; line-height: 1.6;">
            If you have any questions, please contact your administrator or our support team.
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hello Team. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Hello Team!

Hi ${userName},

Your account has been created successfully. You can now access the Hello Team Workforce Hub.

${temporaryPassword ? `Your temporary password: ${temporaryPassword}\nPlease change this password after your first login.\n` : ''}
Login at: ${loginUrl}

If you have any questions, please contact your administrator or our support team.

© ${new Date().getFullYear()} Hello Team. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Welcome to Hello Team',
    html,
    text,
  });
};

/**
 * Send notification email
 */
export const sendNotificationEmail = async (
  email: string,
  subject: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): Promise<EmailResult> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            ${message}
          </p>
          ${actionUrl && actionText ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              ${actionText}
            </a>
          </div>
          ` : ''}
        </div>
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hello Team. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${subject} - Hello Team`,
    html,
    text: message,
  });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
};
