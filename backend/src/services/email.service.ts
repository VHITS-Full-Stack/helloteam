import nodemailer from 'nodemailer';
import { config } from '../config';
import {
  colors,
  styles,
  emailLayout,
  buttonHtml,
  infoBoxHtml,
  detailBoxHtml,
} from './email.styles';

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
let etherealReady = false;

async function getTransporter(): Promise<nodemailer.Transporter> {
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

  // Fallback: create Ethereal test account (free fake SMTP)
  if (!etherealReady) {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    etherealReady = true;
    console.log('================================================');
    console.log('📧 Using Ethereal Email (test/dev mode)');
    console.log(`   User: ${testAccount.user}`);
    console.log(`   Pass: ${testAccount.pass}`);
    console.log('   View emails at: https://ethereal.email/login');
    console.log('================================================');
  }

  return transporter!;
}

/**
 * Send an email
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailResult> => {
  const { to, subject, html, text } = options;

  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Email sent to ${to} — Preview: ${previewUrl}`);
    } else {
      console.log(`📧 Email sent to ${to} — MessageId: ${info.messageId}`);
    }

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('Email send error:', err);
    return { success: false, error: err.message };
  }
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

  const content = `
    <h2 style="${styles.h2}">Reset Your Password</h2>
    <p style="${styles.paragraph}">
      Hi${userName ? ` ${userName}` : ''},
    </p>
    <p style="${styles.paragraph}">
      We received a request to reset your password. Click the button below to create a new password:
    </p>
    ${buttonHtml(resetUrl, 'Reset Password')}
    <p style="${styles.paragraph}">
      This link will expire in 1 hour for security reasons.
    </p>
    <p style="${styles.paragraph}">
      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    <hr style="${styles.hr}">
    <p style="color: ${colors.muted}; font-size: 12px; line-height: 1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="${styles.link}">${resetUrl}</a>
    </p>
  `;

  const html = emailLayout('Reset Your Password', content);

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

  const content = `
    <h2 style="${styles.h2}">Welcome to Hello Team!</h2>
    <p style="${styles.paragraph}">
      Hi ${userName},
    </p>
    <p style="${styles.paragraph}">
      Your account has been created successfully. You can now access the Hello Team Workforce Hub.
    </p>
    ${temporaryPassword ? `
    ${infoBoxHtml(`
      <p style="${styles.infoBoxText(colors.warningText)}; margin: 0; font-weight: 600;">Your temporary password:</p>
      <p style="${styles.infoBoxText(colors.warningText)}; margin: 8px 0 0 0; font-family: monospace; font-size: 16px;">${temporaryPassword}</p>
      <p style="${styles.infoBoxText(colors.warningText)}; margin: 8px 0 0 0; font-size: 12px;">Please change this password after your first login.</p>
    `, colors.warningBg, colors.warning)}
    ` : ''}
    ${buttonHtml(loginUrl, 'Login to Your Account')}
    <p style="${styles.paragraph}">
      If you have any questions, please contact your administrator or our support team.
    </p>
  `;

  const html = emailLayout('Welcome to Hello Team', content);

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
  const content = `
    <h2 style="${styles.h2}">${subject}</h2>
    <p style="${styles.paragraph}">
      ${message}
    </p>
    ${actionUrl && actionText ? buttonHtml(actionUrl, actionText) : ''}
  `;

  const html = emailLayout(subject, content);

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
  const statusColor = approved ? colors.success : colors.danger;
  const actionUrl = `${config.frontendUrl}/employee/time-records`;

  const content = `
    <h2 style="${styles.h2}">Time Entry ${status}</h2>
    <p style="${styles.paragraph}">
      Hi ${employeeName},
    </p>
    <p style="${styles.paragraph}">
      Your time entry has been <span style="color: ${statusColor}; font-weight: 600;">${status.toLowerCase()}</span>.
    </p>
    ${detailBoxHtml(`
      <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 0 0 8px 0;"><strong>Hours:</strong> ${hours}</p>
      <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${status}</span></p>
      ${reason ? `<p style="margin: 8px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
    `)}
    ${buttonHtml(actionUrl, 'View Time Records')}
  `;

  const html = emailLayout(`Time Entry ${status}`, content);

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
  const actionUrl = `${config.frontendUrl}/client/approvals?type=overtime`;

  const content = `
    <h2 style="${styles.h2}">New Overtime Request</h2>
    <p style="${styles.paragraph}">
      Hi ${clientName},
    </p>
    <p style="${styles.paragraph}">
      ${employeeName} has submitted an overtime request that requires your approval.
    </p>
    ${infoBoxHtml(`
      <p style="margin: 0 0 8px 0;"><strong>Employee:</strong> ${employeeName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 0 0 8px 0;"><strong>Hours Requested:</strong> ${hours}</p>
      <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
    `, colors.warningBg, colors.warning)}
    ${buttonHtml(actionUrl, 'Review Request')}
  `;

  const html = emailLayout('Overtime Request', content);

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
  const urgencyColor = urgency === 'urgent' ? colors.danger : urgency === 'warning' ? colors.warning : colors.primary;
  const urgencyBg = urgency === 'urgent' ? colors.dangerBg : urgency === 'warning' ? colors.warningBg : colors.primaryLight;

  const content = `
    <h2 style="${styles.h2}">Payroll Deadline ${urgency === 'urgent' ? 'Today!' : 'Approaching'}</h2>
    <p style="${styles.paragraph}">
      Hi ${clientName},
    </p>
    <p style="${styles.paragraph}">
      ${daysRemaining === 0
        ? 'The payroll cutoff is <strong>today</strong>!'
        : daysRemaining === 1
          ? 'The payroll cutoff is <strong>tomorrow</strong>!'
          : `The payroll cutoff is in <strong>${daysRemaining} days</strong>.`
      }
    </p>
    ${infoBoxHtml(`
      <p style="margin: 0 0 8px 0;"><strong>Cutoff Date:</strong> ${cutoffDate}</p>
      <p style="margin: 0 0 8px 0;"><strong>Pending Approvals:</strong> ${pendingCount} time entries</p>
      ${pendingCount > 0 ? `<p style="margin: 0; color: ${urgencyColor}; font-weight: 600;">Please review and approve pending time entries before the cutoff.</p>` : ''}
    `, urgencyBg, urgencyColor)}
    ${buttonHtml(actionUrl, 'Review Pending Approvals', urgencyColor)}
  `;

  const html = emailLayout('Payroll Deadline Reminder', content, urgencyColor);

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
  const agreementLabel = agreementType === 'WEEKLY' ? 'Weekly' : agreementType === 'BI_WEEKLY' ? 'Bi-Weekly' : 'Monthly';

  const content = `
    <h2 style="${styles.h2}">Welcome to Hello Team, ${contactPerson}!</h2>
    <p style="${styles.paragraph}">
      Your account for <strong>${companyName}</strong> has been created. Before you can access your client portal, you'll need to review and sign your <strong>${agreementLabel} Service Agreement</strong>.
    </p>
    ${infoBoxHtml(`
      <p style="${styles.infoBoxText()}; margin: 0 0 8px 0; font-weight: 600;">Your Login Credentials:</p>
      <p style="${styles.infoBoxText()}; margin: 4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="${styles.infoBoxText()}; margin: 4px 0;"><strong>Password:</strong> ${password}</p>
      <p style="${styles.infoBoxText()}; margin: 8px 0 0 0; font-size: 12px;">Please change your password after your first login.</p>
    `)}
    ${infoBoxHtml(`
      <p style="color: ${colors.successText}; margin: 0; font-weight: 600;">Steps to get started:</p>
      <ol style="color: ${colors.successText}; margin: 8px 0 0 0; padding-left: 20px;">
        <li>Log in with the credentials above</li>
        <li>Review the ${agreementLabel} Service Agreement</li>
        <li>Type your full name and click "I Accept" to sign</li>
        <li>Your client portal will be unlocked immediately</li>
      </ol>
    `, colors.successBg, colors.success)}
    ${buttonHtml(loginUrl, 'Log In & Sign Agreement')}
  `;

  const html = emailLayout('Welcome to Hello Team - Action Required', content);

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

/**
 * Send employee onboarding email with credentials and instructions
 */
export const sendEmployeeOnboardingEmail = async (
  email: string,
  name: string,
  password: string
): Promise<EmailResult> => {
  const loginUrl = `${config.frontendUrl}/login`;

  const content = `
    <h2 style="${styles.h2}">Welcome to the team, ${name}!</h2>
    <p style="${styles.paragraph}">
      Your employee account has been created. Before you can access your portal, you'll need to complete a quick onboarding process.
    </p>
    ${infoBoxHtml(`
      <p style="${styles.infoBoxText()}; margin: 0 0 8px 0; font-weight: 600;">Your Login Credentials:</p>
      <p style="${styles.infoBoxText()}; margin: 4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="${styles.infoBoxText()}; margin: 4px 0;"><strong>Password:</strong> ${password}</p>
      <p style="${styles.infoBoxText()}; margin: 8px 0 0 0; font-size: 12px;">Please change your password after your first login.</p>
    `)}
    ${infoBoxHtml(`
      <p style="color: ${colors.successText}; margin: 0; font-weight: 600;">Steps to complete onboarding:</p>
      <ol style="color: ${colors.successText}; margin: 8px 0 0 0; padding-left: 20px;">
        <li>Log in with the credentials above</li>
        <li>Enter your personal information (phone, address, email)</li>
        <li>Add 3 emergency contacts</li>
        <li>Upload a government-issued ID</li>
      </ol>
    `, colors.successBg, colors.success)}
    ${buttonHtml(loginUrl, 'Log In & Complete Onboarding')}
  `;

  const html = emailLayout('Welcome to Hello Team - Complete Your Onboarding', content);

  const text = `
Welcome to the team, ${name}!

Your employee account has been created.

Your Login Credentials:
Email: ${email}
Password: ${password}

Before you can access your portal, please complete onboarding:
1. Log in at: ${loginUrl}
2. Enter your personal information (phone, address, email)
3. Add 3 emergency contacts
4. Upload a government-issued ID

Please change your password after your first login.

© ${new Date().getFullYear()} Hello Team. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Welcome to Hello Team - Complete Your Onboarding',
    html,
    text,
  });
};

/**
 * Send notification to client that an employee worked overtime
 */
export const sendOTWorkedEmail = async (
  email: string,
  clientName: string,
  employeeName: string,
  date: string,
  overtimeHours: string,
  totalHours: string
): Promise<EmailResult> => {
  const actionUrl = `${config.frontendUrl}/client/approvals?type=overtime`;

  const content = `
    <h2 style="${styles.h2}">Employee Worked Overtime</h2>
    <p style="${styles.paragraph}">
      Hi ${clientName},
    </p>
    <p style="${styles.paragraph}">
      <strong>${employeeName}</strong> worked overtime today. Please approve or deny the overtime hours.
    </p>
    ${infoBoxHtml(`
      <p style="margin: 0 0 8px 0;"><strong>Employee:</strong> ${employeeName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 0 0 8px 0;"><strong>Total Hours:</strong> ${totalHours}</p>
      <p style="margin: 0; color: ${colors.warningText}; font-weight: 600;"><strong>Overtime:</strong> ${overtimeHours}</p>
    `, colors.warningBg, colors.warning)}
    ${buttonHtml(actionUrl, 'Approve / Deny', colors.warning)}
  `;

  const html = emailLayout('Employee Worked Overtime', content, colors.warning);

  return sendEmail({
    to: email,
    subject: `${employeeName} worked overtime on ${date} — Approve or Deny`,
    html,
    text: `Hi ${clientName}, ${employeeName} worked overtime on ${date}. Total: ${totalHours}, Overtime: ${overtimeHours}. Please approve or deny at: ${actionUrl}`,
  });
};

/**
 * Send billing cycle reminder for unapproved OT hours
 */
export const sendOTBillingReminderEmail = async (
  email: string,
  clientName: string,
  daysUntilEnd: number,
  unapprovedCount: number,
  unapprovedHours: string
): Promise<EmailResult> => {
  const actionUrl = `${config.frontendUrl}/client/approvals?type=overtime`;

  const content = `
    <h2 style="${styles.h2}">Billing Cycle Ending in ${daysUntilEnd} Day${daysUntilEnd !== 1 ? 's' : ''}</h2>
    <p style="${styles.paragraph}">
      Hi ${clientName},
    </p>
    <p style="${styles.paragraph}">
      You have <strong>${unapprovedCount}</strong> unapproved overtime entr${unapprovedCount === 1 ? 'y' : 'ies'} totaling <strong>${unapprovedHours}</strong>. Unapproved hours won't appear on this billing cycle's invoice.
    </p>
    ${infoBoxHtml(`
      <p style="margin: 0 0 8px 0; color: ${colors.dangerText};"><strong>Unapproved OT Entries:</strong> ${unapprovedCount}</p>
      <p style="margin: 0 0 8px 0; color: ${colors.dangerText};"><strong>Total Unapproved Hours:</strong> ${unapprovedHours}</p>
      <p style="margin: 0; color: ${colors.dangerText}; font-weight: 600;">Billing cycle ends in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}.</p>
    `, colors.dangerBg, colors.danger)}
    ${buttonHtml(actionUrl, 'Review Unapproved Overtime', colors.danger)}
  `;

  const html = emailLayout('Unapproved Overtime Hours', content, colors.danger);

  return sendEmail({
    to: email,
    subject: `Action Required: Unapproved overtime hours — billing cycle ends in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}`,
    html,
    text: `Hi ${clientName}, You have ${unapprovedCount} unapproved overtime entries (${unapprovedHours}). Unapproved hours won't appear on this billing cycle's invoice. Billing cycle ends in ${daysUntilEnd} days. Review at: ${actionUrl}`,
  });
};

/**
 * Send aggressive daily reminder to client about pending unapproved overtime.
 * Urgent tone — employees won't get paid until resolved.
 */
export const sendAggressiveOTReminderEmail = async (
  email: string,
  clientName: string,
  unapprovedCount: number,
  unapprovedHours: string,
  employeeNames: string[]
): Promise<EmailResult> => {
  const actionUrl = `${config.frontendUrl}/client/time-records`;
  const employeeList = employeeNames.slice(0, 5).join(', ') + (employeeNames.length > 5 ? ` and ${employeeNames.length - 5} more` : '');

  const content = `
    <h2 style="${styles.h2}; color: ${colors.danger};">URGENT: Unapproved Overtime Requires Your Action</h2>
    <p style="${styles.paragraph}">
      Hi ${clientName},
    </p>
    <p style="${styles.paragraph}">
      Your employees have worked overtime that has <strong>not been approved or denied</strong>. We cannot pay your employees for these hours until you take action.
    </p>
    ${infoBoxHtml(`
      <p style="margin: 0 0 8px 0; color: ${colors.dangerText}; font-weight: 700; font-size: 16px;">Pending Overtime Summary</p>
      <p style="margin: 0 0 8px 0; color: ${colors.dangerText};"><strong>Unapproved Entries:</strong> ${unapprovedCount}</p>
      <p style="margin: 0 0 8px 0; color: ${colors.dangerText};"><strong>Total Hours:</strong> ${unapprovedHours}</p>
      <p style="margin: 0; color: ${colors.dangerText};"><strong>Employees:</strong> ${employeeList}</p>
    `, colors.dangerBg, colors.danger)}
    <p style="${styles.paragraph}; font-weight: 600; color: ${colors.dangerText};">
      Employees will NOT get paid for these hours until you approve or deny them. Please take action now.
    </p>
    ${buttonHtml(actionUrl, 'Review & Approve Now', colors.danger)}
    <p style="${styles.paragraph}; color: ${colors.muted}; font-size: 13px;">
      You will continue to receive daily reminders until all overtime entries are resolved.
    </p>
  `;

  const html = emailLayout('URGENT: Unapproved Overtime', content, colors.danger);

  return sendEmail({
    to: email,
    subject: `URGENT: ${unapprovedCount} unapproved overtime entries — employees cannot be paid`,
    html,
    text: `URGENT: Hi ${clientName}, You have ${unapprovedCount} unapproved overtime entries (${unapprovedHours}) for: ${employeeList}. We cannot pay your employees for these hours until you approve or deny. Please log in to review: ${actionUrl}`,
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
  sendEmployeeOnboardingEmail,
  sendOTWorkedEmail,
  sendOTBillingReminderEmail,
  sendAggressiveOTReminderEmail,
};
