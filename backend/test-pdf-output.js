// Test script to verify corrected PDF coordinates with sample data
// Run with: node test-pdf-output.js
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

const PDF_FIELDS = {
  coverClientName: { page: 0, x: 72, y: 617, size: 14 },
  coverDate: { page: 0, x: 459, y: 732, size: 12 },
  partiesDate: { page: 1, x: 372, y: 677, size: 11 },
  businessName: { page: 1, x: 312, y: 502, size: 11 },
  businessAddress: { page: 1, x: 120, y: 478, size: 11 },
  businessEIN: { page: 1, x: 168, y: 455, size: 11 },
  signerName: { page: 1, x: 263, y: 432, size: 11 },
  signerAddress: { page: 1, x: 120, y: 410, size: 11 },
  sigRecipientName: { page: 6, x: 110, y: 598, size: 11 },
  sigSignerName: { page: 6, x: 355, y: 598, size: 11 },
  sigDate: { page: 6, x: 345, y: 575, size: 11 },
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

const EXHIBIT_A = {
  page: 7,
  startY: 653,
  rowSpacing: 25,
  maxRows: 6,
  columns: { name: 72, position: 195, rate: 310, startDate: 380, notes: 450 },
  size: 10,
};

async function testPdf() {
  const templatePath = './public/agreements/weekly-agreement.pdf';
  const pdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const drawText = (fieldKey, text) => {
    if (!text) return;
    const field = PDF_FIELDS[fieldKey];
    if (field.page >= pages.length) return;
    pages[field.page].drawText(text, {
      x: field.x, y: field.y, size: field.size, font, color: rgb(0, 0, 0),
    });
  };

  // Page 0 - Cover: white-out placeholders
  pages[0].drawRectangle({ x: 66, y: 604, width: 210, height: 30, color: rgb(1, 1, 1) });
  pages[0].drawRectangle({ x: 438, y: 724, width: 135, height: 22, color: rgb(1, 1, 1) });

  drawText('coverClientName', 'Acme Corporation Inc.');
  drawText('coverDate', 'February 17, 2026');

  // Page 1 - Parties
  drawText('partiesDate', 'February 17, 2026');
  drawText('businessName', 'Acme Corporation Inc.');
  drawText('businessAddress', '123 Main Street, Suite 400, New York, NY 10001');
  drawText('businessEIN', '12-3456789');
  drawText('signerName', 'John Q. Smith');
  drawText('signerAddress', '456 Oak Avenue, Brooklyn, NY 11201');

  // Page 6 - Signatures
  drawText('sigRecipientName', 'Acme Corporation Inc.');
  drawText('sigSignerName', 'John Q. Smith');
  drawText('sigDate', 'February 17, 2026');

  // Page 7 - Exhibit A (Employee Names)
  const employees = [
    { name: 'Maria Santos', position: 'Virtual Assistant', hourlyRate: '$15.00', startDate: '01/15/2026' },
    { name: 'Carlos Rivera', position: 'Customer Support', hourlyRate: '$18.50', startDate: '02/01/2026' },
    { name: 'Ana Lopez', position: 'Data Entry', hourlyRate: '$14.00', startDate: '02/10/2026' },
  ];
  const exhibitPage = pages[EXHIBIT_A.page];
  const cols = EXHIBIT_A.columns;
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const y = EXHIBIT_A.startY - i * EXHIBIT_A.rowSpacing;
    const sz = EXHIBIT_A.size;
    exhibitPage.drawText(emp.name, { x: cols.name, y, size: sz, font, color: rgb(0, 0, 0) });
    exhibitPage.drawText(emp.position, { x: cols.position, y, size: sz, font, color: rgb(0, 0, 0) });
    exhibitPage.drawText(emp.hourlyRate, { x: cols.rate, y, size: sz, font, color: rgb(0, 0, 0) });
    exhibitPage.drawText(emp.startDate, { x: cols.startDate, y, size: sz, font, color: rgb(0, 0, 0) });
  }

  // Page 8 - Exhibit B (Credit Card)
  drawText('ccCardholderName', 'John Q. Smith');
  drawText('ccBillingAddress', '456 Oak Avenue');
  drawText('ccCityStateZip', 'Brooklyn, NY 11201');
  drawText('ccCardNumber', '4111 1111 1111 1234');
  drawText('ccExpiration', '12/28');
  drawText('ccCVV', '123');

  // Card type check (Visa)
  pages[8].drawText('X', { x: 142, y: 549, size: 10, font, color: rgb(0, 0, 0) });

  // ACH
  drawText('achAccountHolder', 'Acme Corporation Inc.');
  drawText('achBankName', 'Chase Bank');
  drawText('achRoutingNumber', '021000021');
  drawText('achAccountNumber', '123456789012');

  // Account type check (Checking)
  pages[8].drawText('X', { x: 174, y: 313, size: 10, font, color: rgb(0, 0, 0) });

  // Consent
  drawText('consentSignerName', 'John Q. Smith');
  drawText('consentDate', 'February 17, 2026');

  const outputBytes = await pdfDoc.save();
  fs.writeFileSync('./test-agreement-output.pdf', outputBytes);
  console.log('Test PDF saved to backend/test-agreement-output.pdf');
}

testPdf().catch(console.error);
