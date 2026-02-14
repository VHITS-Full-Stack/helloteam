import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

// PDF field coordinates for US Letter (612x792 points, bottom-left origin)
const PDF_FIELDS = {
  // Page 0 (Cover)
  coverClientName: { page: 0, x: 72, y: 595, size: 14 },
  coverDate: { page: 0, x: 430, y: 720, size: 11 },
  // Page 1 (Parties)
  businessName: { page: 1, x: 250, y: 485, size: 10 },
  businessAddress: { page: 1, x: 250, y: 465, size: 10 },
  businessEIN: { page: 1, x: 250, y: 445, size: 10 },
  signerName: { page: 1, x: 250, y: 425, size: 10 },
  signerAddress: { page: 1, x: 250, y: 405, size: 10 },
  signerSSN: { page: 1, x: 215, y: 365, size: 10 },
  partiesDate: { page: 1, x: 430, y: 505, size: 10 },
  // Page 6 (Signatures)
  sigRecipientName: { page: 6, x: 72, y: 565, size: 10 },
  sigSignerName: { page: 6, x: 72, y: 540, size: 10 },
  sigDate: { page: 6, x: 300, y: 540, size: 10 },
  // Page 8 (Exhibit B - Payment)
  ccCardholderName: { page: 8, x: 200, y: 610, size: 9 },
  ccBillingAddress: { page: 8, x: 200, y: 595, size: 9 },
  ccCityStateZip: { page: 8, x: 200, y: 580, size: 9 },
  ccCardNumber: { page: 8, x: 200, y: 550, size: 9 },
  ccExpiration: { page: 8, x: 200, y: 535, size: 9 },
  ccCVV: { page: 8, x: 350, y: 535, size: 9 },
  achAccountHolder: { page: 8, x: 300, y: 375, size: 9 },
  achBankName: { page: 8, x: 300, y: 360, size: 9 },
  achRoutingNumber: { page: 8, x: 300, y: 345, size: 9 },
  achAccountNumber: { page: 8, x: 300, y: 330, size: 9 },
  consentSignerName: { page: 8, x: 200, y: 270, size: 9 },
  consentDate: { page: 8, x: 400, y: 270, size: 9 },
};

// GET /api/onboarding/agreement - Returns agreement details & status
export const getAgreement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user.userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        onboardingStatus: client.onboardingStatus,
        agreementType: client.agreementType,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        agreement: client.agreement
          ? {
              signedAt: client.agreement.signedAt,
              signedByName: client.agreement.signedByName,
              // Business info
              businessName: client.agreement.businessName,
              businessAddress: client.agreement.businessAddress,
              businessEIN: client.agreement.businessEIN,
              signerName: client.agreement.signerName,
              signerAddress: client.agreement.signerAddress,
              signerSSN: client.agreement.signerSSN,
              // Payment info
              paymentMethod: client.agreement.paymentMethod,
              ccCardholderName: client.agreement.ccCardholderName,
              ccBillingAddress: client.agreement.ccBillingAddress,
              ccCityStateZip: client.agreement.ccCityStateZip,
              ccCardType: client.agreement.ccCardType,
              ccCardNumber: client.agreement.ccCardNumber,
              ccExpiration: client.agreement.ccExpiration,
              achAccountHolder: client.agreement.achAccountHolder,
              achBankName: client.agreement.achBankName,
              achRoutingNumber: client.agreement.achRoutingNumber,
              achAccountNumber: client.agreement.achAccountNumber,
              achAccountType: client.agreement.achAccountType,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get agreement error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agreement details' });
  }
};

// GET /api/onboarding/agreement/pdf - Streams the correct PDF file
export const getAgreementPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user.userId },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const fileName =
      client.agreementType === 'WEEKLY_ACH'
        ? 'weekly-ach-agreement.pdf'
        : 'monthly-ach-agreement.pdf';

    const filePath = path.join(__dirname, '../../public/agreements', fileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Agreement PDF not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Get agreement PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agreement PDF' });
  }
};

// Helper: get template PDF path for a client
function getTemplatePath(agreementType: string | null): string {
  const fileName = agreementType === 'WEEKLY_ACH'
    ? 'weekly-ach-agreement.pdf'
    : 'monthly-ach-agreement.pdf';
  return path.join(__dirname, '../../public/agreements', fileName);
}

// Helper: fill PDF with business/payment data
async function fillPdfWithData(
  pdfBytes: Buffer,
  data: {
    businessName?: string | null;
    businessAddress?: string | null;
    businessEIN?: string | null;
    signerName?: string | null;
    signerAddress?: string | null;
    signerSSN?: string | null;
    paymentMethod?: string | null;
    ccCardholderName?: string | null;
    ccBillingAddress?: string | null;
    ccCityStateZip?: string | null;
    ccCardType?: string | null;
    ccCardNumber?: string | null;
    ccExpiration?: string | null;
    ccCVV?: string | null;
    achAccountHolder?: string | null;
    achBankName?: string | null;
    achRoutingNumber?: string | null;
    achAccountNumber?: string | null;
    achAccountType?: string | null;
    companyName?: string;
  }
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const drawText = (fieldKey: keyof typeof PDF_FIELDS, text: string | null | undefined) => {
    if (!text) return;
    const field = PDF_FIELDS[fieldKey];
    if (field.page >= pages.length) return;
    pages[field.page].drawText(text, {
      x: field.x,
      y: field.y,
      size: field.size,
      font,
      color: rgb(0, 0, 0),
    });
  };

  // Page 0 - Cover
  drawText('coverClientName', data.companyName || data.businessName);
  drawText('coverDate', today);

  // Page 1 - Parties
  drawText('businessName', data.businessName);
  drawText('businessAddress', data.businessAddress);
  drawText('businessEIN', data.businessEIN);
  drawText('signerName', data.signerName);
  drawText('signerAddress', data.signerAddress);
  drawText('signerSSN', data.signerSSN);
  drawText('partiesDate', today);

  // Page 6 - Signatures
  drawText('sigRecipientName', data.businessName);
  drawText('sigSignerName', data.signerName);
  drawText('sigDate', today);

  // Page 8 - Exhibit B (Payment)
  const pm = data.paymentMethod;
  if (pm === 'credit_card' || pm === 'both') {
    drawText('ccCardholderName', data.ccCardholderName);
    drawText('ccBillingAddress', data.ccBillingAddress);
    drawText('ccCityStateZip', data.ccCityStateZip);
    drawText('ccCardNumber', data.ccCardNumber);
    drawText('ccExpiration', data.ccExpiration);
    drawText('ccCVV', data.ccCVV);

    // Card type checkmark
    if (data.ccCardType) {
      const cardTypePositions: Record<string, number> = {
        'Visa': 200,
        'MasterCard': 260,
        'American Express': 340,
        'Discover': 440,
      };
      const xPos = cardTypePositions[data.ccCardType];
      if (xPos && PDF_FIELDS.ccCardholderName.page < pages.length) {
        pages[PDF_FIELDS.ccCardholderName.page].drawText('X', {
          x: xPos,
          y: 565,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  if (pm === 'ach' || pm === 'both') {
    drawText('achAccountHolder', data.achAccountHolder);
    drawText('achBankName', data.achBankName);
    drawText('achRoutingNumber', data.achRoutingNumber);
    drawText('achAccountNumber', data.achAccountNumber);

    // Account type checkmark
    if (data.achAccountType) {
      const accountTypePositions: Record<string, number> = {
        'Checking': 300,
        'Savings': 380,
      };
      const xPos = accountTypePositions[data.achAccountType];
      if (xPos && PDF_FIELDS.achAccountHolder.page < pages.length) {
        pages[PDF_FIELDS.achAccountHolder.page].drawText('X', {
          x: xPos,
          y: 315,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  // Consent line
  drawText('consentSignerName', data.signerName);
  drawText('consentDate', today);

  return pdfDoc;
}

// POST /api/onboarding/agreement/details - Save business + payment data (draft)
export const saveAgreementDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const {
      businessName, businessAddress, businessEIN,
      signerName, signerAddress, signerSSN,
      paymentMethod,
      ccCardholderName, ccBillingAddress, ccCityStateZip, ccCardType,
      ccCardNumber, ccExpiration, ccCVV,
      achAccountHolder, achBankName, achRoutingNumber, achAccountNumber, achAccountType,
    } = req.body;

    // Validate required fields
    if (!businessName?.trim()) {
      res.status(400).json({ success: false, error: 'Business name is required' });
      return;
    }
    if (!businessAddress?.trim()) {
      res.status(400).json({ success: false, error: 'Business address is required' });
      return;
    }
    if (!signerName?.trim()) {
      res.status(400).json({ success: false, error: 'Signer name is required' });
      return;
    }

    // If payment method provided, validate it
    if (paymentMethod) {
      if (!['credit_card', 'ach', 'both'].includes(paymentMethod)) {
        res.status(400).json({ success: false, error: 'Invalid payment method' });
        return;
      }
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user.userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    if (client.onboardingStatus === 'COMPLETED') {
      res.status(400).json({ success: false, error: 'Agreement already signed' });
      return;
    }

    const updateData: any = {
      businessName: businessName?.trim(),
      businessAddress: businessAddress?.trim(),
      businessEIN: businessEIN?.trim() || null,
      signerName: signerName?.trim(),
      signerAddress: signerAddress?.trim() || null,
      signerSSN: signerSSN?.trim() || null,
    };

    // Only update payment fields if paymentMethod is provided
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      updateData.ccCardholderName = ccCardholderName?.trim() || null;
      updateData.ccBillingAddress = ccBillingAddress?.trim() || null;
      updateData.ccCityStateZip = ccCityStateZip?.trim() || null;
      updateData.ccCardType = ccCardType || null;
      updateData.ccCardNumber = ccCardNumber?.trim() || null;
      updateData.ccExpiration = ccExpiration?.trim() || null;
      updateData.ccCVV = ccCVV?.trim() || null;
      updateData.achAccountHolder = achAccountHolder?.trim() || null;
      updateData.achBankName = achBankName?.trim() || null;
      updateData.achRoutingNumber = achRoutingNumber?.trim() || null;
      updateData.achAccountNumber = achAccountNumber?.trim() || null;
      updateData.achAccountType = achAccountType || null;
    }

    // Upsert into ClientAgreement
    if (client.agreement) {
      await prisma.clientAgreement.update({
        where: { id: client.agreement.id },
        data: updateData,
      });
    } else {
      await prisma.clientAgreement.create({
        data: {
          clientId: client.id,
          agreementType: client.agreementType || 'WEEKLY_ACH',
          ...updateData,
        },
      });
    }

    res.json({ success: true, message: 'Agreement details saved' });
  } catch (error) {
    console.error('Save agreement details error:', error);
    res.status(500).json({ success: false, error: 'Failed to save agreement details' });
  }
};

// GET /api/onboarding/agreement/preview - Generate pre-filled PDF
export const getAgreementPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user.userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const templatePath = getTemplatePath(client.agreementType);
    if (!fs.existsSync(templatePath)) {
      res.status(404).json({ success: false, error: 'Agreement template PDF not found' });
      return;
    }

    const templateBytes = fs.readFileSync(templatePath);
    const agreement = client.agreement;

    const pdfDoc = await fillPdfWithData(templateBytes, {
      businessName: agreement?.businessName,
      businessAddress: agreement?.businessAddress,
      businessEIN: agreement?.businessEIN,
      signerName: agreement?.signerName,
      signerAddress: agreement?.signerAddress,
      signerSSN: agreement?.signerSSN,
      paymentMethod: agreement?.paymentMethod,
      ccCardholderName: agreement?.ccCardholderName,
      ccBillingAddress: agreement?.ccBillingAddress,
      ccCityStateZip: agreement?.ccCityStateZip,
      ccCardType: agreement?.ccCardType,
      ccCardNumber: agreement?.ccCardNumber,
      ccExpiration: agreement?.ccExpiration,
      ccCVV: agreement?.ccCVV,
      achAccountHolder: agreement?.achAccountHolder,
      achBankName: agreement?.achBankName,
      achRoutingNumber: agreement?.achRoutingNumber,
      achAccountNumber: agreement?.achAccountNumber,
      achAccountType: agreement?.achAccountType,
      companyName: client.companyName,
    });

    const pdfOutputBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="agreement-preview.pdf"');
    res.send(Buffer.from(pdfOutputBytes));
  } catch (error) {
    console.error('Get agreement preview error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate agreement preview' });
  }
};

// POST /api/onboarding/agreement/sign - Accept and sign the agreement
export const signAgreement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { signedByName, signatureImage } = req.body;

    if (!signedByName || signedByName.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Please enter your full name to sign the agreement' });
      return;
    }

    // Validate signatureImage if provided
    if (signatureImage) {
      if (typeof signatureImage !== 'string' || !signatureImage.startsWith('data:image/')) {
        res.status(400).json({ success: false, error: 'Invalid signature image format' });
        return;
      }
      // ~500KB base64 limit
      if (signatureImage.length > 700000) {
        res.status(400).json({ success: false, error: 'Signature image is too large (max 500KB)' });
        return;
      }
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user.userId },
      include: { agreement: true },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    if (client.onboardingStatus === 'COMPLETED') {
      res.status(400).json({ success: false, error: 'Agreement already signed' });
      return;
    }

    // Verify that business details have been saved
    if (!client.agreement?.businessName) {
      res.status(400).json({ success: false, error: 'Please complete the business information step first' });
      return;
    }

    const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';

    // Generate signed PDF with embedded signature
    let signedPdfBase64: string | null = null;
    try {
      const templatePath = getTemplatePath(client.agreementType);
      if (fs.existsSync(templatePath)) {
        const templateBytes = fs.readFileSync(templatePath);
        const agreement = client.agreement;

        const pdfDoc = await fillPdfWithData(templateBytes, {
          businessName: agreement?.businessName,
          businessAddress: agreement?.businessAddress,
          businessEIN: agreement?.businessEIN,
          signerName: agreement?.signerName,
          signerAddress: agreement?.signerAddress,
          signerSSN: agreement?.signerSSN,
          paymentMethod: agreement?.paymentMethod,
          ccCardholderName: agreement?.ccCardholderName,
          ccBillingAddress: agreement?.ccBillingAddress,
          ccCityStateZip: agreement?.ccCityStateZip,
          ccCardType: agreement?.ccCardType,
          ccCardNumber: agreement?.ccCardNumber,
          ccExpiration: agreement?.ccExpiration,
          ccCVV: agreement?.ccCVV,
          achAccountHolder: agreement?.achAccountHolder,
          achBankName: agreement?.achBankName,
          achRoutingNumber: agreement?.achRoutingNumber,
          achAccountNumber: agreement?.achAccountNumber,
          achAccountType: agreement?.achAccountType,
          companyName: client.companyName,
        });

        // Embed signature image on page 6 (signatures) and page 8 (Exhibit B)
        if (signatureImage) {
          const pages = pdfDoc.getPages();
          const base64Data = signatureImage.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
          const sigBytes = Buffer.from(base64Data, 'base64');

          let embeddedImage;
          if (signatureImage.includes('image/png')) {
            embeddedImage = await pdfDoc.embedPng(sigBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(sigBytes);
          }

          const sigWidth = 150;
          const sigHeight = (embeddedImage.height / embeddedImage.width) * sigWidth;

          // Page 6 - Signature area
          if (pages.length > 6) {
            pages[6].drawImage(embeddedImage, {
              x: 72,
              y: 480,
              width: sigWidth,
              height: sigHeight,
            });
          }

          // Page 8 - Exhibit B consent signature
          if (pages.length > 8) {
            pages[8].drawImage(embeddedImage, {
              x: 72,
              y: 220,
              width: sigWidth * 0.8,
              height: sigHeight * 0.8,
            });
          }
        }

        const pdfOutputBytes = await pdfDoc.save();
        signedPdfBase64 = Buffer.from(pdfOutputBytes).toString('base64');
      }
    } catch (pdfError) {
      console.error('PDF generation error (non-fatal):', pdfError);
      // Continue with signing even if PDF generation fails
    }

    // Update agreement and client status in a transaction
    await prisma.$transaction(async (tx) => {
      // Update or create the agreement record
      if (client.agreement) {
        await tx.clientAgreement.update({
          where: { id: client.agreement.id },
          data: {
            signedAt: new Date(),
            signedByName: signedByName.trim(),
            signedByIP: clientIp,
            ...(signatureImage && { signatureImage }),
            ...(signedPdfBase64 && { signedPdfData: signedPdfBase64 }),
          },
        });
      } else {
        await tx.clientAgreement.create({
          data: {
            clientId: client.id,
            agreementType: client.agreementType || 'WEEKLY_ACH',
            signedAt: new Date(),
            signedByName: signedByName.trim(),
            signedByIP: clientIp,
            ...(signatureImage && { signatureImage }),
            ...(signedPdfBase64 && { signedPdfData: signedPdfBase64 }),
          },
        });
      }

      // Update client onboarding status
      await tx.client.update({
        where: { id: client.id },
        data: { onboardingStatus: 'COMPLETED' },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CREATE',
          entityType: 'ClientAgreement',
          entityId: client.id,
          description: `Client agreement signed by ${signedByName.trim()}`,
          ipAddress: clientIp,
          metadata: {
            agreementType: client.agreementType,
            signedByName: signedByName.trim(),
          },
        },
      });
    });

    res.json({
      success: true,
      message: 'Agreement signed successfully. Your portal is now unlocked.',
    });
  } catch (error) {
    console.error('Sign agreement error:', error);
    res.status(500).json({ success: false, error: 'Failed to sign agreement' });
  }
};
