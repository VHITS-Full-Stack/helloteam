import axios from 'axios';
import { config } from '../config';

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const BANDWIDTH_API_URL = 'https://messaging.bandwidth.com/api/v2/users/5002369/messages';

export const sendSMS = async (to: string, message: string, tag: string = ''): Promise<SMSResult> => {
  const { messagingAuth, applicationId, fromNumber } = config.sms;

  if (!messagingAuth || !applicationId || !fromNumber) {
    console.log('================================================');
    console.log(`📱 SMS (not sent — Bandwidth not configured)`);
    console.log(`   To: ${to}`);
    console.log(`   Message: ${message}`);
    console.log('================================================');
    return { success: true, messageId: 'not-configured' };
  }

  // Strip dashes and ensure + prefix
  const cleanTo = to.replace(/-/g, '');
  const formattedTo = cleanTo.startsWith('+') ? cleanTo : `+1${cleanTo.replace(/\D/g, '')}`;
  const formattedFrom = fromNumber.startsWith('+') ? fromNumber : `+1${fromNumber}`;

  try {
    const response = await axios({
      method: 'post',
      url: BANDWIDTH_API_URL,
      headers: {
        Authorization: `Basic ${messagingAuth}`,
        'Content-Type': 'application/json',
      },
      data: {
        to: [formattedTo],
        from: formattedFrom,
        text: message,
        applicationId,
        tag,
      },
      timeout: 30000,
    });

    const messageId = response.data?.id || response.data?.messageId || 'sent';
    console.log(`📱 SMS sent to ${to} — ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
    console.error(`📱 SMS failed to ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
};

export default { sendSMS };
