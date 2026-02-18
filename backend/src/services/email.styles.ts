// Centralized email branding and layout helpers
// Update colors/fonts here to change all email templates at once

import { config } from '../config';

export const colors = {
  primary: '#478ac9',
  primaryDark: '#1f3f61',
  primaryLight: '#f0f7fc',
  primaryText: '#264f7a',
  secondary: '#3be8e0',
  accent: '#f1c50e',
  heading: '#1f2937',
  body: '#4b5563',
  muted: '#9ca3af',
  border: '#e5e7eb',
  bgPage: '#f5f5f5',
  bgCard: '#ffffff',
  bgFooter: '#f9fafb',
  bgInfoBox: '#f9fafb',
  success: '#22c55e',
  successBg: '#f0fdf4',
  successText: '#166534',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  dangerText: '#991b1b',
  white: '#ffffff',
};

export const fonts = {
  family: "'Roboto', 'Open Sans', sans-serif",
};

// Inline style strings for reuse
export const styles = {
  body: `font-family: ${fonts.family}; background-color: ${colors.bgPage}; margin: 0; padding: 20px;`,
  container: `max-width: 600px; margin: 0 auto; background-color: ${colors.bgCard}; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`,
  header: (bgColor: string = colors.primaryDark) =>
    `background-color: ${bgColor}; padding: 30px; text-align: center;`,
  headerTitle: `color: ${colors.white}; margin: 0; font-size: 24px;`,
  content: `padding: 40px 30px;`,
  h2: `color: ${colors.heading}; margin-top: 0;`,
  paragraph: `color: ${colors.body}; line-height: 1.6;`,
  buttonWrap: `text-align: center; margin: 30px 0;`,
  button: (bgColor: string = colors.primary) =>
    `background-color: ${bgColor}; color: ${colors.white}; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;`,
  footer: `background-color: ${colors.bgFooter}; padding: 20px 30px; text-align: center;`,
  footerText: `color: ${colors.muted}; font-size: 12px; margin: 0;`,
  link: `color: ${colors.primary};`,
  hr: `border: none; border-top: 1px solid ${colors.border}; margin: 30px 0;`,
  infoBox: (bgColor: string = colors.primaryLight, borderColor: string = colors.primary) =>
    `background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 16px; margin: 20px 0;`,
  infoBoxText: (textColor: string = colors.primaryText) =>
    `color: ${textColor};`,
  detailBox: `background-color: ${colors.bgInfoBox}; border-radius: 6px; padding: 16px; margin: 20px 0;`,
};

/**
 * Wrap email content in the standard layout (header + footer)
 */
export const emailLayout = (title: string, content: string, headerColor?: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header(headerColor)}">
      <img src="${config.frontendUrl}/logo.png" alt="Hello Team" style="height: 40px; margin-bottom: 10px;" />
      <h1 style="${styles.headerTitle}">Hello Team</h1>
    </div>
    <div style="${styles.content}">
      ${content}
    </div>
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        &copy; ${new Date().getFullYear()} Hello Team. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Render a CTA button
 */
export const buttonHtml = (href: string, text: string, bgColor?: string): string => `
<div style="${styles.buttonWrap}">
  <a href="${href}" style="${styles.button(bgColor)}">${text}</a>
</div>
`;

/**
 * Render a highlighted info/credential box
 */
export const infoBoxHtml = (content: string, bgColor?: string, borderColor?: string): string => `
<div style="${styles.infoBox(bgColor, borderColor)}">
  ${content}
</div>
`;

/**
 * Render a neutral detail box (gray background, no border)
 */
export const detailBoxHtml = (content: string): string => `
<div style="${styles.detailBox}">
  ${content}
</div>
`;
