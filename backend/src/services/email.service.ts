import nodemailer from 'nodemailer';
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

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (config.email.user && config.email.pass) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
    return transporter;
  }

  return null;
}

/**
 * Send an email
 * Uses Nodemailer if configured, falls back to console logging in development
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailResult> => {
  const { to, subject, html, text } = options;

  const mailer = getTransporter();

  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from: config.email.from,
        to,
        subject,
        text,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('Email send error:', err);
      return { success: false, error: err.message };
    }
  }

  // Fallback: log to console in development
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

/**
 * Send time entry approval notification email
 */
export const sendTimeApprovalEmail = async (
  email: string,
  employeeName: string,
  approved: boolean,
  date: string,
  hours: number,
  reason?: string
): Promise<EmailResult> => {
  const status = approved ? 'Approved' : 'Rejected';
  const statusColor = approved ? '#10b981' : '#ef4444';
  const actionUrl = `${config.frontendUrl}/employee/time-records`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Time Entry ${status}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Time Entry ${status}</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Hi ${employeeName},
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            Your time entry has been <span style="color: ${statusColor}; font-weight: 600;">${status.toLowerCase()}</span>.
          </p>
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0 0 8px 0;"><strong>Hours:</strong> ${hours}</p>
            <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${status}</span></p>
            ${reason ? `<p style="margin: 8px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              View Time Records
            </a>
          </div>
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
    subject: `Time Entry ${status} - Hello Team`,
    html,
    text: `Hi ${employeeName}, Your time entry for ${date} (${hours} hours) has been ${status.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
  });
};

/**
 * Send overtime request notification email
 */
export const sendOvertimeRequestEmail = async (
  email: string,
  clientName: string,
  employeeName: string,
  hours: number,
  date: string,
  reason: string
): Promise<EmailResult> => {
  const actionUrl = `${config.frontendUrl}/client/approvals?tab=overtime`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Overtime Request</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">New Overtime Request</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Hi ${clientName},
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            ${employeeName} has submitted an overtime request that requires your approval.
          </p>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Employee:</strong> ${employeeName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0 0 8px 0;"><strong>Hours Requested:</strong> ${hours}</p>
            <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Review Request
            </a>
          </div>
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
    subject: `Overtime Request from ${employeeName} - Hello Team`,
    html,
    text: `Hi ${clientName}, ${employeeName} has submitted an overtime request for ${date} (${hours} hours). Reason: ${reason}. Please review at: ${actionUrl}`,
  });
};

/**
 * Send payroll deadline reminder email
 */
export const sendPayrollReminderEmail = async (
  email: string,
  clientName: string,
  daysRemaining: number,
  pendingCount: number,
  cutoffDate: string
): Promise<EmailResult> => {
  const actionUrl = `${config.frontendUrl}/client/approvals`;
  const urgency = daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'warning' : 'info';
  const urgencyColor = urgency === 'urgent' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#2563eb';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payroll Deadline Reminder</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: ${urgencyColor}; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Payroll Deadline ${urgency === 'urgent' ? 'Today!' : 'Approaching'}</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Hi ${clientName},
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            ${daysRemaining === 0
              ? 'The payroll cutoff is <strong>today</strong>!'
              : daysRemaining === 1
                ? 'The payroll cutoff is <strong>tomorrow</strong>!'
                : `The payroll cutoff is in <strong>${daysRemaining} days</strong>.`
            }
          </p>
          <div style="background-color: ${urgency === 'urgent' ? '#fef2f2' : urgency === 'warning' ? '#fef3c7' : '#eff6ff'}; border: 1px solid ${urgencyColor}; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Cutoff Date:</strong> ${cutoffDate}</p>
            <p style="margin: 0 0 8px 0;"><strong>Pending Approvals:</strong> ${pendingCount} time entries</p>
            ${pendingCount > 0 ? `<p style="margin: 0; color: ${urgencyColor}; font-weight: 600;">Please review and approve pending time entries before the cutoff.</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" style="background-color: ${urgencyColor}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Review Pending Approvals
            </a>
          </div>
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
    subject: `${urgency === 'urgent' ? 'URGENT: ' : ''}Payroll Deadline ${daysRemaining === 0 ? 'Today' : `in ${daysRemaining} days`} - Hello Team`,
    html,
    text: `Hi ${clientName}, The payroll cutoff is ${daysRemaining === 0 ? 'today' : `in ${daysRemaining} days`} (${cutoffDate}). You have ${pendingCount} pending time entries to review.`,
  });
};

/**
 * Send client onboarding email with credentials and instructions to sign agreement
 */
export const sendClientOnboardingEmail = async (
  email: string,
  companyName: string,
  contactPerson: string,
  password: string,
  agreementType: string
): Promise<EmailResult> => {
  const loginUrl = `${config.frontendUrl}/login`;
  const agreementLabel = agreementType === 'WEEKLY_ACH' ? 'Weekly ACH' : 'Monthly ACH';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Hello Team - Action Required</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Hello Team</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to Hello Team, ${contactPerson}!</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Your account for <strong>${companyName}</strong> has been created. Before you can access your client portal, you'll need to review and sign your <strong>${agreementLabel} Service Agreement</strong>.
          </p>
          <div style="background-color: #eff6ff; border: 1px solid #2563eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="color: #1e40af; margin: 0 0 8px 0; font-weight: 600;">Your Login Credentials:</p>
            <p style="color: #1e40af; margin: 4px 0;"><strong>Email:</strong> ${email}</p>
            <p style="color: #1e40af; margin: 4px 0;"><strong>Password:</strong> ${password}</p>
            <p style="color: #1e40af; margin: 8px 0 0 0; font-size: 12px;">Please change your password after your first login.</p>
          </div>
          <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="color: #166534; margin: 0; font-weight: 600;">Steps to get started:</p>
            <ol style="color: #166534; margin: 8px 0 0 0; padding-left: 20px;">
              <li>Log in with the credentials above</li>
              <li>Review the ${agreementLabel} Service Agreement</li>
              <li>Type your full name and click "I Accept" to sign</li>
              <li>Your client portal will be unlocked immediately</li>
            </ol>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Log In & Sign Agreement
            </a>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} Hello Team. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Hello Team, ${contactPerson}!

Your account for ${companyName} has been created.

Your Login Credentials:
Email: ${email}
Password: ${password}

Before you can access your client portal, please:
1. Log in at: ${loginUrl}
2. Review the ${agreementLabel} Service Agreement
3. Type your full name and click "I Accept" to sign
4. Your client portal will be unlocked immediately

Please change your password after your first login.

© ${new Date().getFullYear()} Hello Team. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Welcome to Hello Team - Agreement Signing Required',
    html,
    text,
  });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  sendTimeApprovalEmail,
  sendOvertimeRequestEmail,
  sendPayrollReminderEmail,
  sendClientOnboardingEmail,
};
