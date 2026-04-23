import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

// Reliable date formatting — avoids toLocaleDateString locale inconsistencies
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Long-form date for agreement text: "February 17, 2026" */
function formatAgreementDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Compact date for tables (Exhibit A): "02/17/2026" */
function formatCompactDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

// PDF field coordinates for US Letter (612x792 points, bottom-left origin)
// Coordinates calibrated against template grid overlay (Feb 2026)
const PDF_FIELDS = {
  // Page 0 (Cover) — over yellow placeholder text
  coverClientName: { page: 0, x: 72, y: 609, size: 14 },
  coverEmployeeNames: { page: 0, x: 72, y: 590, size: 11 },
  coverDate: { page: 0, x: 438, y: 734, size: 12 },
  // Page 1 (Parties) — text on white-outed yellow highlights (x aligned to rect start + 2, y = rect.y + 4)
  partiesDate: { page: 1, x: 380, y: 664, size: 11 },
  businessName: { page: 1, x: 258, y: 497, size: 11 },
  businessAddress: { page: 1, x: 120, y: 472, size: 11 },
  businessEIN: { page: 1, x: 146, y: 447, size: 11 },
  signerName: { page: 1, x: 210, y: 422, size: 11 },
  signerAddress: { page: 1, x: 120, y: 397, size: 11 },
  // Page 6 (Signatures) — Names row at pdf y≈592, Sig/Date row at pdf y≈567
  sigRecipientName: { page: 6, x: 115, y: 592, size: 10 },
  sigSignerName: { page: 6, x: 366, y: 592, size: 10 },
  sigDate: { page: 6, x: 360, y: 567, size: 10 },
  // Page 8 (Exhibit B - Payment)
  ccCardholderName: { page: 8, x: 175, y: 618, size: 10 },
  ccBillingAddress: { page: 8, x: 165, y: 593, size: 10 },
  ccCityStateZip: { page: 8, x: 155, y: 570, size: 10 },
  ccCardNumber: { page: 8, x: 162, y: 522, size: 10 },
  ccExpiration: { page: 8, x: 220, y: 498, size: 10 },
  ccCVV: { page: 8, x: 360, y: 498, size: 10 },
  achAccountHolder: { page: 8, x: 200, y: 400, size: 10 },
  achBankName: { page: 8, x: 72, y: 377, size: 10 },
  achRoutingNumber: { page: 8, x: 72, y: 355, size: 10 },
  achAccountNumber: { page: 8, x: 72, y: 332, size: 10 },
  consentSignerName: { page: 8, x: 210, y: 225, size: 10 },
  consentDate: { page: 8, x: 415, y: 200, size: 10 },
};

// Exhibit A (Page 7) — Personnel & Rates table
const EXHIBIT_A = {
  page: 7,
  startY: 653,
  rowSpacing: 25,
  maxRows: 6,
  columns: { name: 72, position: 195, rate: 310, startDate: 380, notes: 450 },
  size: 10,
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
      include: {
        agreement: true,
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: { firstName: true, lastName: true, profilePhoto: true }
            }
          }
        }
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Map employees to a simpler format
    const assignedEmployees = (client.employees || []).map(ce => ({
      name: `${ce.employee.firstName} ${ce.employee.lastName}`,
      profilePhoto: ce.employee.profilePhoto
    }));

    res.json({
      success: true,
      data: {
        onboardingStatus: client.onboardingStatus,
        agreementType: client.agreementType,
        companyName: client.companyName,
        address: client.address,
        contactPerson: client.contactPerson,
        assignedEmployees,
        agreement: client.agreement
          ? {
              signedAt: client.agreement.signedAt,
              signedByName: client.agreement.signedByName,
              // Business info
              businessName: client.agreement.businessName,
              businessAddress: client.agreement.businessAddress,
              businessCity: client.agreement.businessCity,
              businessState: client.agreement.businessState,
              businessZip: client.agreement.businessZip,
              businessEIN: client.agreement.businessEIN,
              signerName: client.agreement.signerName,
              signerAddress: client.agreement.signerAddress,
              // Payment info
              paymentMethod: client.agreement.paymentMethod,
              ccCardholderName: client.agreement.ccCardholderName,
              ccBillingAddress: client.agreement.ccBillingAddress,
              ccCityStateZip: client.agreement.ccCityStateZip,
              ccCity: client.agreement.ccCity,
              ccState: client.agreement.ccState,
              ccZip: client.agreement.ccZip,
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
      client.agreementType === 'MONTHLY'
        ? 'monthly-agreement.pdf'
        : 'weekly-agreement.pdf';

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
  const fileName = agreementType === 'MONTHLY'
    ? 'monthly-agreement.pdf'
    : 'weekly-agreement.pdf';
  return path.join(__dirname, '../../public/agreements', fileName);
}

// Employee data for Exhibit A
type EmployeeForPdf = {
  name: string;
  position?: string;
  hourlyRate?: string;
  startDate?: string;
  notes?: string;
};

// Helper: fill PDF with business/payment/employee data
async function fillPdfWithData(
  pdfBytes: Buffer,
  data: {
    businessName?: string | null;
    businessAddress?: string | null;
    businessCity?: string | null;
    businessState?: string | null;
    businessZip?: string | null;
    businessEIN?: string | null;
    signerName?: string | null;
    signerAddress?: string | null;
    paymentMethod?: string | null;
    ccCardholderName?: string | null;
    ccBillingAddress?: string | null;
    ccCityStateZip?: string | null;
    ccCity?: string | null;
    ccState?: string | null;
    ccZip?: string | null;
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
    employees?: EmployeeForPdf[];
  }
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const boldFont = font;
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const today = formatAgreementDate(new Date());

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

  // Page 0 - Cover: white-out yellow placeholders then draw values
  if (pages.length > 0) {
    // Cover "Insert Client Name" placeholder (yellow highlight)
    pages[0].drawRectangle({ x: 70, y: 605, width: 108, height: 18, color: rgb(1, 1, 1) });
    // Cover "Insert Date" placeholder (yellow highlight)
    pages[0].drawRectangle({ x: 436, y: 730, width: 65, height: 18, color: rgb(1, 1, 1) });
  }
  drawText('coverClientName', data.companyName || data.businessName);
  // Employee names on cover page
  if (data.employees && data.employees.length > 0) {
    const names = data.employees.map((e) => e.name).join(', ');
    drawText('coverEmployeeNames', names);
  }
  drawText('coverDate', today);

  // Page 1 - Parties: white-out yellow highlighted placeholder areas
  // Coordinates extracted from PDF content stream (CTM: 0.75 scale, y-flipped from top)
  if (pages.length > 1) {
    const p1 = pages[1];
    // Date after "entered into as of"
    p1.drawRectangle({ x: 378, y: 660, width: 102, height: 18, color: rgb(1, 1, 1) });
    // "Recipient (Business Entity): Name:"
    p1.drawRectangle({ x: 256, y: 493, width: 136, height: 18, color: rgb(1, 1, 1) });
    // "Address:"
    p1.drawRectangle({ x: 118, y: 468, width: 224, height: 18, color: rgb(1, 1, 1) });
    // "Business EIN:"
    p1.drawRectangle({ x: 144, y: 443, width: 120, height: 18, color: rgb(1, 1, 1) });
    // "Signer (Individual) Name:"
    p1.drawRectangle({ x: 208, y: 418, width: 192, height: 18, color: rgb(1, 1, 1) });
    // "Signer Address:"
    p1.drawRectangle({ x: 118, y: 393, width: 224, height: 18, color: rgb(1, 1, 1) });
    // "Social Security Number:"
    p1.drawRectangle({ x: 195, y: 368, width: 142, height: 18, color: rgb(1, 1, 1) });
  }
  drawText('partiesDate', today);
  drawText('businessName', data.businessName);
  // Combine street + city/state/zip for PDF display
  const fullBusinessAddr = [data.businessAddress, [data.businessCity, data.businessState, data.businessZip].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  drawText('businessAddress', fullBusinessAddr || data.businessAddress);
  drawText('businessEIN', data.businessEIN);
  drawText('signerName', data.signerName);
  drawText('signerAddress', data.signerAddress);

  // Page 6 - Signatures
  drawText('sigRecipientName', data.businessName);
  drawText('sigSignerName', data.signerName);
  drawText('sigDate', today);

  // Page 7 - Exhibit A (Personnel & Rates)
  if (EXHIBIT_A.page < pages.length) {
    const exhibitPage = pages[EXHIBIT_A.page];
    const cols = EXHIBIT_A.columns;
    const employeeCount = data.employees ? Math.min(data.employees.length, EXHIBIT_A.maxRows) : 0;

    // White-out unused empty rows (underlines, "$" signs, etc.)
    // Table rows: 653, 628, 600, 572, 544, 516 (pdf y). "Additional Personnel" text at ~487.
    if (employeeCount < EXHIBIT_A.maxRows) {
      const firstEmptyY = EXHIBIT_A.startY - employeeCount * EXHIBIT_A.rowSpacing;
      // Cover from first empty row top down to just above "Additional Personnel" text (pdf y≈487)
      exhibitPage.drawRectangle({
        x: 66,
        y: 500,
        width: 484,
        height: firstEmptyY - 500 + 15,
        color: rgb(1, 1, 1),
      });
    }

    for (let i = 0; i < employeeCount; i++) {
      const emp = data.employees![i];
      const y = EXHIBIT_A.startY - i * EXHIBIT_A.rowSpacing;
      const sz = EXHIBIT_A.size;

      if (emp.name) {
        exhibitPage.drawText(emp.name, { x: cols.name, y, size: sz, font, color: rgb(0, 0, 0) });
      }
      if (emp.position) {
        exhibitPage.drawText(emp.position, { x: cols.position, y, size: sz, font, color: rgb(0, 0, 0) });
      }
      if (emp.hourlyRate) {
        exhibitPage.drawText(emp.hourlyRate, { x: cols.rate, y, size: sz, font, color: rgb(0, 0, 0) });
      }
      if (emp.startDate) {
        exhibitPage.drawText(emp.startDate, { x: cols.startDate, y, size: sz, font, color: rgb(0, 0, 0) });
      }
      if (emp.notes) {
        exhibitPage.drawText(emp.notes, { x: cols.notes, y, size: sz, font, color: rgb(0, 0, 0) });
      }
    }
  }

  // Page 8 - Exhibit B (Payment)
  const pm = data.paymentMethod;
  const paymentPage = PDF_FIELDS.ccCardholderName.page < pages.length ? pages[PDF_FIELDS.ccCardholderName.page] : null;

  // White-out unused payment section
  if (paymentPage && pm === 'credit_card') {
    // Hide ACH section (Section 2): from "SECTION 2" header down to just above Section 3 header (pdf y=291)
    paymentPage.drawRectangle({ x: 66, y: 296, width: 484, height: 184, color: rgb(1, 1, 1) });
  } else if (paymentPage && pm === 'ach') {
    // Hide Credit Card section (Section 1): from "SECTION 1" header down to "Cardholder Signature"
    paymentPage.drawRectangle({ x: 66, y: 490, width: 484, height: 220, color: rgb(1, 1, 1) });
  }

  if (pm === 'credit_card' || pm === 'both') {
    const ccPage = pages[PDF_FIELDS.ccCardholderName.page];
    const sz = 10;
    const shift = 26; // Extra space needed for 2 additional city/state/zip rows

    drawText('ccCardholderName', data.ccCardholderName);
    drawText('ccBillingAddress', data.ccBillingAddress);

    // White-out from "City, State, ZIP:" line down through "Cardholder Signature" to redraw shifted
    ccPage.drawRectangle({ x: 66, y: 440, width: 484, height: 135, color: rgb(1, 1, 1) });

    const lx = 72;          // Left align with other labels
    const valX = 155;       // Value start (after label)
    const lineEnd = 540;    // Right end of underline
    const lineColor = rgb(0, 0, 0);

    // Helper: draw bold label + regular underlined value on one row
    const drawField = (label: string, value: string | undefined, y: number, valOffset = valX) => {
      ccPage.drawText(label, { x: lx, y, size: sz, font: boldFont, color: lineColor });
      if (value) {
        ccPage.drawText(value, { x: valOffset, y, size: sz, font: regularFont, color: lineColor });
      }
      // Underline under value area
      ccPage.drawLine({ start: { x: valOffset, y: y - 3 }, end: { x: lineEnd, y: y - 3 }, thickness: 0.5, color: lineColor });
    };

    // City, State, ZIP on 3 separate rows
    const cityY = PDF_FIELDS.ccCityStateZip.y; // 570
    drawField('City:', data.ccCity, cityY);
    drawField('State:', data.ccState, cityY - 16);
    drawField('ZIP:', data.ccZip, cityY - 32);

    // Redraw remaining fields shifted down
    drawField('Card Type:', data.ccCardType, cityY - 52);
    drawField('Card Number:', data.ccCardNumber, cityY - 68, 170);

    // Expiration and CVV on same row
    const expY = cityY - 84;
    ccPage.drawText('Expiration:', { x: lx, y: expY, size: sz, font: boldFont, color: lineColor });
    if (data.ccExpiration) {
      ccPage.drawText(data.ccExpiration, { x: 145, y: expY, size: sz, font: regularFont, color: lineColor });
    }
    ccPage.drawLine({ start: { x: 145, y: expY - 3 }, end: { x: 250, y: expY - 3 }, thickness: 0.5, color: lineColor });
    ccPage.drawText('CVV:', { x: 270, y: expY, size: sz, font: boldFont, color: lineColor });
    if (data.ccCVV) {
      ccPage.drawText(data.ccCVV, { x: 300, y: expY, size: sz, font: regularFont, color: lineColor });
    }
    ccPage.drawLine({ start: { x: 300, y: expY - 3 }, end: { x: 400, y: expY - 3 }, thickness: 0.5, color: lineColor });
  }

  if (pm === 'ach' || pm === 'both') {
    drawText('achAccountHolder', data.achAccountHolder);
    drawText('achBankName', data.achBankName);
    drawText('achRoutingNumber', data.achRoutingNumber);
    drawText('achAccountNumber', data.achAccountNumber);

    // Account type checkmark (X inside ☐)
    if (data.achAccountType) {
      const accountTypePositions: Record<string, number> = {
        'Checking': 174,
        'Savings': 292,
      };
      const xPos = accountTypePositions[data.achAccountType];
      if (xPos && PDF_FIELDS.achAccountHolder.page < pages.length) {
        pages[PDF_FIELDS.achAccountHolder.page].drawText('X', {
          x: xPos,
          y: 313,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  // Consent line (Section 3)
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
      businessName, businessAddress, businessCity, businessState, businessZip, businessEIN,
      signerName, signerAddress,
      paymentMethod,
      ccCardholderName, ccBillingAddress, ccCityStateZip, ccCity, ccState, ccZip, ccCardType,
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

    if (client.onboardingStatus === 'SIGNED' || client.onboardingStatus === 'COMPLETED') {
      res.status(400).json({ success: false, error: 'Agreement already signed' });
      return;
    }

    const updateData: any = {
      businessName: businessName?.trim(),
      businessAddress: businessAddress?.trim(),
      businessCity: businessCity?.trim() || null,
      businessState: businessState?.trim() || null,
      businessZip: businessZip?.trim() || null,
      businessEIN: businessEIN?.trim() || null,
      signerName: signerName?.trim(),
      signerAddress: signerAddress?.trim() || null,
    };

    // Only update payment fields if paymentMethod is provided
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      updateData.ccCardholderName = ccCardholderName?.trim() || null;
      updateData.ccBillingAddress = ccBillingAddress?.trim() || null;
      updateData.ccCityStateZip = ccCityStateZip?.trim() || null;
      updateData.ccCity = ccCity?.trim() || null;
      updateData.ccState = ccState?.trim() || null;
      updateData.ccZip = ccZip?.trim() || null;
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
          agreementType: client.agreementType || 'WEEKLY',
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

/**
 * Update payment method for an already-onboarded client.
 * POST /api/client-portal/payment-method
 */
export const updatePaymentMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const {
      paymentMethod,
      ccCardholderName, ccBillingAddress, ccCity, ccState, ccZip, ccCardType,
      ccCardNumber, ccExpiration, ccCVV,
      achAccountHolder, achBankName, achRoutingNumber, achAccountNumber, achAccountType,
    } = req.body;

    if (!paymentMethod || !['credit_card', 'ach'].includes(paymentMethod)) {
      res.status(400).json({ success: false, error: 'Valid payment method (credit_card or ach) is required' });
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

    if (!client.agreement) {
      res.status(400).json({ success: false, error: 'No agreement found. Please complete onboarding first.' });
      return;
    }

    // Determine the new combined payment method
    const existingMethod = client.agreement.paymentMethod;
    let newMethod = paymentMethod;
    if (existingMethod && existingMethod !== paymentMethod) {
      newMethod = 'both';
    }

    const updateData: any = { paymentMethod: newMethod };

    if (paymentMethod === 'credit_card') {
      if (!ccCardholderName?.trim() || !ccCardNumber?.trim() || !ccExpiration?.trim()) {
        res.status(400).json({ success: false, error: 'Card details are required' });
        return;
      }
      updateData.ccCardholderName = ccCardholderName.trim();
      updateData.ccBillingAddress = ccBillingAddress?.trim() || null;
      updateData.ccCity = ccCity?.trim() || null;
      updateData.ccState = ccState?.trim() || null;
      updateData.ccZip = ccZip?.trim() || null;
      updateData.ccCardType = ccCardType || null;
      updateData.ccCardNumber = ccCardNumber.trim();
      updateData.ccExpiration = ccExpiration.trim();
      updateData.ccCVV = ccCVV?.trim() || null;
    } else {
      if (!achAccountHolder?.trim() || !achBankName?.trim() || !achRoutingNumber?.trim() || !achAccountNumber?.trim()) {
        res.status(400).json({ success: false, error: 'Bank account details are required' });
        return;
      }
      updateData.achAccountHolder = achAccountHolder.trim();
      updateData.achBankName = achBankName.trim();
      updateData.achRoutingNumber = achRoutingNumber.trim();
      updateData.achAccountNumber = achAccountNumber.trim();
      updateData.achAccountType = achAccountType || 'Checking';
    }

    await prisma.clientAgreement.update({
      where: { id: client.agreement.id },
      data: updateData,
    });

    res.json({ success: true, message: 'Payment method added successfully' });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment method' });
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
      include: {
        agreement: true,
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: { firstName: true, lastName: true, billingRate: true, hireDate: true },
            },
          },
        },
      },
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

    // Build employee list for Exhibit A
    const employees: EmployeeForPdf[] = (client.employees || []).map((ce) => ({
      name: `${ce.employee.firstName} ${ce.employee.lastName}`,
      hourlyRate: ce.hourlyRate
        ? `$${Number(ce.hourlyRate).toFixed(2)}`
        : ce.employee.billingRate
          ? `$${Number(ce.employee.billingRate).toFixed(2)}`
          : '',
      startDate: ce.assignedAt
        ? formatCompactDate(new Date(ce.assignedAt))
        : '',
    }));

    const pdfDoc = await fillPdfWithData(templateBytes, {
      businessName: agreement?.businessName,
      businessAddress: agreement?.businessAddress,
      businessCity: agreement?.businessCity,
      businessState: agreement?.businessState,
      businessZip: agreement?.businessZip,
      businessEIN: agreement?.businessEIN,
      signerName: agreement?.signerName,
      signerAddress: agreement?.signerAddress,
      paymentMethod: agreement?.paymentMethod,
      ccCardholderName: agreement?.ccCardholderName,
      ccBillingAddress: agreement?.ccBillingAddress,
      ccCityStateZip: agreement?.ccCityStateZip,
      ccCity: agreement?.ccCity,
      ccState: agreement?.ccState,
      ccZip: agreement?.ccZip,
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
      employees,
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
      include: {
        agreement: true,
        employees: {
          where: { isActive: true },
          include: {
            employee: {
              select: { firstName: true, lastName: true, billingRate: true, hireDate: true },
            },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    if (client.onboardingStatus === 'SIGNED' || client.onboardingStatus === 'COMPLETED') {
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

        // Build employee list for Exhibit A
        const employees: EmployeeForPdf[] = (client.employees || []).map((ce) => ({
          name: `${ce.employee.firstName} ${ce.employee.lastName}`,
          hourlyRate: ce.hourlyRate
            ? `$${Number(ce.hourlyRate).toFixed(2)}`
            : ce.employee.billingRate
              ? `$${Number(ce.employee.billingRate).toFixed(2)}`
              : '',
          startDate: ce.assignedAt
            ? new Date(ce.assignedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
            : '',
        }));

        const pdfDoc = await fillPdfWithData(templateBytes, {
          businessName: agreement?.businessName,
          businessAddress: agreement?.businessAddress,
          businessEIN: agreement?.businessEIN,
          signerName: agreement?.signerName,
          signerAddress: agreement?.signerAddress,
          paymentMethod: agreement?.paymentMethod,
          ccCardholderName: agreement?.ccCardholderName,
          ccBillingAddress: agreement?.ccBillingAddress,
          ccCityStateZip: agreement?.ccCityStateZip,
          ccCity: agreement?.ccCity,
          ccState: agreement?.ccState,
          ccZip: agreement?.ccZip,
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
          employees,
        });

        // Embed signature image on page 6 (signatures) and page 8 (Exhibit B consent)
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

          // Page 6 - Recipient signature area (on "Signature: ____" line at y≈575)
          if (pages.length > 6) {
            pages[6].drawImage(embeddedImage, {
              x: 72,
              y: 548,
              width: sigWidth,
              height: sigHeight,
            });
          }

          // Page 8 - Exhibit B consent signature (on "Signature: ____" line at y≈200)
          if (pages.length > 8) {
            pages[8].drawImage(embeddedImage, {
              x: 72,
              y: 175,
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
            agreementType: client.agreementType || 'WEEKLY',
            signedAt: new Date(),
            signedByName: signedByName.trim(),
            signedByIP: clientIp,
            ...(signatureImage && { signatureImage }),
            ...(signedPdfBase64 && { signedPdfData: signedPdfBase64 }),
          },
        });
      }

      // Update client onboarding status to SIGNED — portal remains locked until Best Practices step
      await tx.client.update({
        where: { id: client.id },
        data: { onboardingStatus: 'SIGNED' },
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
      message: 'Agreement signed successfully.',
    });
  } catch (error) {
    console.error('Sign agreement error:', error);
    res.status(500).json({ success: false, error: 'Failed to sign agreement' });
  }
};

// POST /api/onboarding/complete - Final step: mark onboarding as fully COMPLETED
export const completeOnboarding = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    if (client.onboardingStatus === 'COMPLETED') {
      res.json({ success: true, message: 'Already completed' });
      return;
    }

    if (client.onboardingStatus !== 'SIGNED') {
      res.status(400).json({ success: false, error: 'Please complete the agreement signing step first' });
      return;
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { onboardingStatus: 'COMPLETED' },
    });

    res.json({ success: true, message: 'Onboarding complete. Your portal is now unlocked.' });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
};
