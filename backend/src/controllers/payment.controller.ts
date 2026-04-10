import { Request, Response } from 'express';
import prisma from '../config/database';
import {
  processCreditCardSale,
  processCreditCardSaleWithCard,
  processAchSale,
  processAchSaleWithAccount,
  tokenizeCreditCard,
  tokenizeAchAccount,
  voidTransaction,
  refundTransaction,
  type SolaResponse,
} from '../services/sola.service';
import { createNotification } from './notification.controller';

/**
 * Process payment for an invoice (Client Portal)
 * POST /client-portal/invoices/:invoiceId/pay
 */
export const processInvoicePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const userId = (req as any).user?.userId;

    // Get the client
    const client = await prisma.client.findFirst({
      where: { userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Get the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId as string, clientId: client.id },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (!['SENT', 'OVERDUE'].includes(invoice.status)) {
      res.status(400).json({ success: false, error: 'Invoice is not payable' });
      return;
    }

    const agreement = client.agreement;
    if (!agreement) {
      res.status(400).json({ success: false, error: 'No payment method on file. Please add a payment method first.' });
      return;
    }

    const amount = Number(invoice.total);
    if (amount <= 0) {
      res.status(400).json({ success: false, error: 'Invalid invoice amount' });
      return;
    }

    // Create pending payment record
    const paymentMethod = agreement.paymentMethod || 'credit_card';
    const primaryMethod = paymentMethod === 'both' ? 'credit_card' : paymentMethod;

    console.log(`[Payment] Client: ${client.companyName}, method: ${primaryMethod}, hasCardToken: ${!!agreement.solaCardToken}, hasRawCard: ${!!(agreement.ccCardNumber && agreement.ccExpiration)}, hasAchToken: ${!!agreement.solaAchToken}, hasRawAch: ${!!(agreement.achRoutingNumber && agreement.achAccountNumber)}`);

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        clientId: client.id,
        amount,
        currency: invoice.currency,
        status: 'PROCESSING',
        paymentMethod: primaryMethod,
        processedBy: userId,
      },
    });

    let solaResponse: SolaResponse;

    try {
      if (primaryMethod === 'credit_card') {
        solaResponse = await processCardPayment(agreement, amount, invoice.invoiceNumber);
      } else {
        solaResponse = await processAchPayment(agreement, amount, invoice.invoiceNumber);
      }
    } catch (apiError: any) {
      // Network/timeout error calling Sola
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'ERROR',
          solaError: apiError.message || 'Failed to connect to payment processor',
          processedAt: new Date(),
        },
      });
      res.status(502).json({ success: false, error: 'Payment processor unavailable. Please try again.' });
      return;
    }

    // Update payment record with Sola response
    const isApproved = solaResponse.xResult === 'A';
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isApproved ? 'APPROVED' : solaResponse.xResult === 'D' ? 'DECLINED' : 'ERROR',
        solaRefNum: solaResponse.xRefNum || null,
        solaAuthCode: solaResponse.xAuthCode || null,
        solaAuthAmount: solaResponse.xAuthAmount ? parseFloat(solaResponse.xAuthAmount) : null,
        solaMaskedCard: solaResponse.xMaskedCardNumber || null,
        solaCardType: solaResponse.xCardType || null,
        solaToken: solaResponse.xToken || null,
        solaBatch: solaResponse.xBatch || null,
        solaError: solaResponse.xError || null,
        solaErrorCode: solaResponse.xErrorCode || null,
        solaResult: solaResponse.xResult,
        solaDate: solaResponse.xDate || null,
        processedAt: new Date(),
      },
    });

    if (isApproved) {
      // Update invoice status to PAID
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          clientPaidAt: new Date(),
          clientPaidBy: userId,
        },
      });

      // Store/update the token for future payments
      if (solaResponse.xToken) {
        if (primaryMethod === 'credit_card') {
          await prisma.clientAgreement.update({
            where: { clientId: client.id },
            data: {
              solaCardToken: solaResponse.xToken,
              solaCardLastFour: solaResponse.xMaskedCardNumber?.replace(/\*/g, '') || null,
              solaCardType: solaResponse.xCardType || null,
            },
          });
        } else {
          await prisma.clientAgreement.update({
            where: { clientId: client.id },
            data: { solaAchToken: solaResponse.xToken },
          });
        }
      }

      // Send notification to admin
      try {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await createNotification(
            admin.id,
            'INVOICE_PAID' as any,
            'Invoice Payment Received',
            `${client.companyName} paid invoice ${invoice.invoiceNumber} — $${amount.toFixed(2)}`,
            { invoiceId: invoice.id, paymentId: payment.id, amount },
            '/admin/invoices'
          );
        }
      } catch (notifErr) {
        console.error('[Payment] Failed to send payment notification:', notifErr);
      }

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          refNum: solaResponse.xRefNum,
          authCode: solaResponse.xAuthCode,
          amount: solaResponse.xAuthAmount,
          maskedCard: solaResponse.xMaskedCardNumber,
          message: 'Payment approved successfully',
        },
      });
    } else {
      // Payment declined or error
      res.status(400).json({
        success: false,
        error: solaResponse.xError || 'Payment was declined. Please try again or use a different payment method.',
        data: {
          paymentId: payment.id,
          result: solaResponse.xResult,
          errorCode: solaResponse.xErrorCode,
        },
      });
    }
  } catch (error: any) {
    console.error('[Payment] processInvoicePayment error:', error);
    res.status(500).json({ success: false, error: 'Payment processing failed. Please try again.' });
  }
};

/**
 * Get payment history for the client (Client Portal)
 * GET /client-portal/payments
 */
export const getClientPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const client = await prisma.client.findFirst({ where: { userId } });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const payments = await prisma.payment.findMany({
      where: { clientId: client.id },
      include: {
        invoice: { select: { invoiceNumber: true, periodStart: true, periodEnd: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[Payment] getClientPayments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment history' });
  }
};

/**
 * Get iFields key for frontend (Client Portal)
 * GET /client-portal/payment-config
 */
export const getPaymentConfig = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: {
      iFieldsKey: process.env.SOLA_IFIELDS_KEY || '',
      environment: process.env.SOLA_ENVIRONMENT || 'sandbox',
      gatewayUrl: 'https://x1.cardknox.com',
    },
  });
};

/**
 * Tokenize a new payment method via Sola (Client Portal)
 * POST /client-portal/payment-method/tokenize
 */
export const tokenizePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { paymentMethod, cardNumber, exp, cvv, name, street, zip, routingNumber, accountNumber } = req.body;

    const client = await prisma.client.findFirst({
      where: { userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    if (!client.agreement) {
      res.status(400).json({ success: false, error: 'No agreement found for client' });
      return;
    }

    let solaResponse: SolaResponse;

    if (paymentMethod === 'credit_card') {
      if (!cardNumber || !exp) {
        res.status(400).json({ success: false, error: 'Card number and expiration are required' });
        return;
      }
      solaResponse = await tokenizeCreditCard({ cardNumber, exp, name, street, zip });
    } else if (paymentMethod === 'ach') {
      if (!routingNumber || !accountNumber) {
        res.status(400).json({ success: false, error: 'Routing and account numbers are required' });
        return;
      }
      solaResponse = await tokenizeAchAccount({ routingNumber, accountNumber, name });
    } else {
      res.status(400).json({ success: false, error: 'Invalid payment method' });
      return;
    }

    if (solaResponse.xResult !== 'A') {
      res.status(400).json({ success: false, error: solaResponse.xError || 'Failed to tokenize payment method' });
      return;
    }

    // Save token to agreement
    if (paymentMethod === 'credit_card') {
      await prisma.clientAgreement.update({
        where: { clientId: client.id },
        data: {
          solaCardToken: solaResponse.xToken,
          solaCardLastFour: solaResponse.xMaskedCardNumber?.replace(/\*/g, '') || cardNumber.slice(-4),
          solaCardType: solaResponse.xCardType || null,
          ccCardNumber: `****${cardNumber.slice(-4)}`, // Replace full number with masked
          ccExpiration: exp,
          ccCardholderName: name || client.agreement.ccCardholderName,
          paymentMethod: client.agreement.paymentMethod === 'ach' ? 'both' : 'credit_card',
        },
      });
    } else {
      await prisma.clientAgreement.update({
        where: { clientId: client.id },
        data: {
          solaAchToken: solaResponse.xToken,
          achAccountNumber: `****${accountNumber.slice(-4)}`, // Replace with masked
          paymentMethod: client.agreement.paymentMethod === 'credit_card' ? 'both' : 'ach',
        },
      });
    }

    res.json({
      success: true,
      data: {
        token: solaResponse.xToken,
        maskedCard: solaResponse.xMaskedCardNumber,
        cardType: solaResponse.xCardType,
        message: 'Payment method tokenized and saved successfully',
      },
    });
  } catch (error: any) {
    console.error('[Payment] tokenizePaymentMethod error:', error);
    res.status(500).json({ success: false, error: 'Failed to save payment method' });
  }
};

// --- Admin endpoints ---

/**
 * Get all payments (Admin)
 * GET /admin/payments
 */
export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, status, page = '1', limit = '25' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { invoiceNumber: true, periodStart: true, periodEnd: true } },
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ success: true, data: { payments, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (error: any) {
    console.error('[Payment] getAllPayments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
};

/**
 * Refund a payment (Admin)
 * POST /admin/payments/:paymentId/refund
 */
export const refundPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body; // Optional partial refund amount

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId as string },
      include: { invoice: true },
    });

    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    if (payment.status !== 'APPROVED') {
      res.status(400).json({ success: false, error: 'Only approved payments can be refunded' });
      return;
    }

    if (!payment.solaRefNum) {
      res.status(400).json({ success: false, error: 'No transaction reference found' });
      return;
    }

    const refundAmount = amount ? parseFloat(amount) : Number(payment.amount);
    const solaResponse = await refundTransaction(payment.solaRefNum, refundAmount);

    if (solaResponse.xResult === 'A') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });

      // Revert invoice status
      if (payment.invoiceId) {
        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: 'SENT', clientPaidAt: null, clientPaidBy: null },
        });
      }

      res.json({ success: true, data: { refNum: solaResponse.xRefNum, message: 'Refund processed successfully' } });
    } else {
      res.status(400).json({ success: false, error: solaResponse.xError || 'Refund failed' });
    }
  } catch (error: any) {
    console.error('[Payment] refundPayment error:', error);
    res.status(500).json({ success: false, error: 'Refund processing failed' });
  }
};

/**
 * Void a payment (Admin)
 * POST /admin/payments/:paymentId/void
 */
export const voidPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId as string } });

    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    if (payment.status !== 'APPROVED') {
      res.status(400).json({ success: false, error: 'Only approved payments can be voided' });
      return;
    }

    if (!payment.solaRefNum) {
      res.status(400).json({ success: false, error: 'No transaction reference found' });
      return;
    }

    const solaResponse = await voidTransaction(payment.solaRefNum);

    if (solaResponse.xResult === 'A') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'VOIDED' },
      });

      if (payment.invoiceId) {
        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: 'SENT', clientPaidAt: null, clientPaidBy: null },
        });
      }

      res.json({ success: true, data: { message: 'Payment voided successfully' } });
    } else {
      res.status(400).json({ success: false, error: solaResponse.xError || 'Void failed' });
    }
  } catch (error: any) {
    console.error('[Payment] voidPayment error:', error);
    res.status(500).json({ success: false, error: 'Void processing failed' });
  }
};

// --- Helper functions ---

async function processCardPayment(agreement: any, amount: number, invoiceNumber: string): Promise<SolaResponse> {
  // Prefer token-based payment
  if (agreement.solaCardToken) {
    return processCreditCardSale({
      amount,
      token: agreement.solaCardToken,
      invoiceNumber,
      name: agreement.ccCardholderName || undefined,
      street: agreement.ccBillingAddress || undefined,
      zip: agreement.ccZip || undefined,
    });
  }

  // Fallback: use raw card details (first-time payment)
  if (agreement.ccCardNumber && agreement.ccExpiration) {
    const exp = agreement.ccExpiration.replace('/', ''); // MM/YY -> MMYY
    return processCreditCardSaleWithCard({
      amount,
      cardNumber: agreement.ccCardNumber,
      exp,
      cvv: agreement.ccCVV || undefined,
      invoiceNumber,
      name: agreement.ccCardholderName || undefined,
      street: agreement.ccBillingAddress || undefined,
      zip: agreement.ccZip || undefined,
    });
  }

  throw new Error('No credit card details or token on file');
}

async function processAchPayment(agreement: any, amount: number, invoiceNumber: string): Promise<SolaResponse> {
  // Prefer token-based payment
  if (agreement.solaAchToken) {
    return processAchSale({
      amount,
      token: agreement.solaAchToken,
      invoiceNumber,
      name: agreement.achAccountHolder || undefined,
    });
  }

  // Fallback: use raw account details
  if (agreement.achRoutingNumber && agreement.achAccountNumber) {
    return processAchSaleWithAccount({
      amount,
      routingNumber: agreement.achRoutingNumber,
      accountNumber: agreement.achAccountNumber,
      invoiceNumber,
      name: agreement.achAccountHolder || undefined,
    });
  }

  throw new Error('No ACH details or token on file');
}
