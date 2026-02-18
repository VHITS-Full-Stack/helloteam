import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  session: {
    timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  email: {
    host: process.env.MAIL_HOST || 'smtp.mailgun.org',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_ENCRYPTION === 'ssl',
    user: process.env.MAIL_USERNAME || '',
    pass: process.env.MAIL_PASSWORD || '',
    from: `${process.env.MAIL_FROM_NAME || 'Hello Team Notifications'} <${process.env.MAIL_FROM_ADDRESS || 'notifications@thehelloteam.com'}>`,
  },

  sms: {
    messagingAuth: process.env.BANDWIDTH_MESSAGING_AUTH || '',
    applicationId: process.env.BANDWIDTH_APPLICATION_ID || '',
    fromNumber: process.env.BANDWIDTH_FROM_NUMBER || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};
