import twilio from 'twilio';
import { config } from '../config';

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;

  const { accountSid, authToken } = config.sms;
  if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  }

  return null;
}

export const sendSMS = async (to: string, message: string): Promise<SMSResult> => {
  const client = getClient();

  if (!client || !config.sms.fromNumber) {
    // No Twilio credentials configured — log to console
    console.log('================================================');
    console.log(`📱 SMS (not sent — Twilio not configured)`);
    console.log(`   To: ${to}`);
    console.log(`   Message: ${message}`);
    console.log('================================================');
    return { success: true, messageId: 'not-configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.sms.fromNumber,
      to,
    });

    console.log(`📱 SMS sent to ${to} — SID: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (err: any) {
    console.error(`📱 SMS failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

export default { sendSMS };
