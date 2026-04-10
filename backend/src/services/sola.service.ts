import axios from 'axios';

const SOLA_GATEWAY_URL = 'https://x1.cardknox.com/gatewayjson';
const SOFTWARE_NAME = 'HelloTeam';
const SOFTWARE_VERSION = '1.0.0';
const API_VERSION = '5.0.0';

interface SolaBaseRequest {
  xKey: string;
  xVersion: string;
  xSoftwareName: string;
  xSoftwareVersion: string;
  xCommand: string;
  xAmount: string;
  [key: string]: string | undefined;
}

export interface SolaResponse {
  xResult: 'A' | 'D' | 'E'; // Approved, Declined, Error
  xStatus: string;
  xError: string;
  xErrorCode: string;
  xRefNum: string;
  xAuthCode: string;
  xAuthAmount: string;
  xToken: string;
  xMaskedCardNumber: string;
  xCardType: string;
  xBatch: string;
  xDate: string;
  xExp: string;
  xAvsResultCode: string;
  xCvvResultCode: string;
  [key: string]: string;
}

const buildBaseRequest = (command: string, amount: number, invoiceNumber?: string): SolaBaseRequest => ({
  xKey: process.env.SOLA_API_KEY || '',
  xVersion: API_VERSION,
  xSoftwareName: SOFTWARE_NAME,
  xSoftwareVersion: SOFTWARE_VERSION,
  xCommand: command,
  xAmount: amount.toFixed(2),
  ...(invoiceNumber ? { xInvoice: invoiceNumber } : {}),
});

async function callSola(data: Record<string, string | undefined>): Promise<SolaResponse> {
  const cleanData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== '') {
      cleanData[key] = value;
    }
  }

  console.log(`[Sola] Sending ${cleanData.xCommand} for $${cleanData.xAmount} (invoice: ${cleanData.xInvoice || 'N/A'})`);

  const response = await axios.post<SolaResponse>(SOLA_GATEWAY_URL, cleanData, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  console.log(`[Sola] Response: xResult=${response.data.xResult}, xRefNum=${response.data.xRefNum}, xError=${response.data.xError || 'none'}`);

  return response.data;
}

/**
 * Process a credit card sale using a stored Sola token
 */
export async function processCreditCardSale(params: {
  amount: number;
  token: string;
  invoiceNumber?: string;
  name?: string;
  street?: string;
  zip?: string;
}): Promise<SolaResponse> {
  const request = {
    ...buildBaseRequest('cc:sale', params.amount, params.invoiceNumber),
    xToken: params.token,
    xName: params.name,
    xStreet: params.street,
    xZip: params.zip,
  };
  return callSola(request);
}

/**
 * Process a credit card sale using raw card details (for first-time payment before token exists)
 */
export async function processCreditCardSaleWithCard(params: {
  amount: number;
  cardNumber: string;
  exp: string; // MMYY format
  cvv?: string;
  invoiceNumber?: string;
  name?: string;
  street?: string;
  zip?: string;
}): Promise<SolaResponse> {
  const request = {
    ...buildBaseRequest('cc:sale', params.amount, params.invoiceNumber),
    xCardNum: params.cardNumber,
    xExp: params.exp,
    xCVV: params.cvv,
    xName: params.name,
    xStreet: params.street,
    xZip: params.zip,
  };
  return callSola(request);
}

/**
 * Tokenize a credit card without charging (cc:save)
 */
export async function tokenizeCreditCard(params: {
  cardNumber: string;
  exp: string;
  name?: string;
  street?: string;
  zip?: string;
}): Promise<SolaResponse> {
  const request: Record<string, string | undefined> = {
    xKey: SOLA_API_KEY,
    xVersion: API_VERSION,
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: 'cc:save',
    xCardNum: params.cardNumber,
    xExp: params.exp,
    xName: params.name,
    xStreet: params.street,
    xZip: params.zip,
  };
  return callSola(request);
}

/**
 * Process an ACH/check sale using a stored token
 */
export async function processAchSale(params: {
  amount: number;
  token: string;
  invoiceNumber?: string;
  name?: string;
}): Promise<SolaResponse> {
  const request = {
    ...buildBaseRequest('check:sale', params.amount, params.invoiceNumber),
    xToken: params.token,
    xName: params.name,
  };
  return callSola(request);
}

/**
 * Process an ACH/check sale using raw account details
 */
export async function processAchSaleWithAccount(params: {
  amount: number;
  routingNumber: string;
  accountNumber: string;
  invoiceNumber?: string;
  name?: string;
}): Promise<SolaResponse> {
  const request = {
    ...buildBaseRequest('check:sale', params.amount, params.invoiceNumber),
    xRoutingNumber: params.routingNumber,
    xAccountNumber: params.accountNumber,
    xName: params.name,
  };
  return callSola(request);
}

/**
 * Tokenize an ACH account without charging (check:save)
 */
export async function tokenizeAchAccount(params: {
  routingNumber: string;
  accountNumber: string;
  name?: string;
}): Promise<SolaResponse> {
  const request: Record<string, string | undefined> = {
    xKey: SOLA_API_KEY,
    xVersion: API_VERSION,
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: 'check:save',
    xRoutingNumber: params.routingNumber,
    xAccountNumber: params.accountNumber,
    xName: params.name,
  };
  return callSola(request);
}

/**
 * Void a transaction (before batch settlement)
 */
export async function voidTransaction(refNum: string): Promise<SolaResponse> {
  const request: Record<string, string | undefined> = {
    xKey: SOLA_API_KEY,
    xVersion: API_VERSION,
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: 'cc:void',
    xRefNum: refNum,
  };
  return callSola(request);
}

/**
 * Refund a transaction
 */
export async function refundTransaction(refNum: string, amount: number): Promise<SolaResponse> {
  const request: Record<string, string | undefined> = {
    xKey: SOLA_API_KEY,
    xVersion: API_VERSION,
    xSoftwareName: SOFTWARE_NAME,
    xSoftwareVersion: SOFTWARE_VERSION,
    xCommand: 'cc:refund',
    xRefNum: refNum,
    xAmount: amount.toFixed(2),
  };
  return callSola(request);
}
