// Debug script to overlay coordinate grid on PDF template
// Run with: node debug-pdf-coords.js
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function debugPdf() {
  const templatePath = './public/agreements/weekly-agreement.pdf';
  const pdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    console.log(`Page ${i}: ${width}x${height}`);

    // Draw grid lines every 50 points
    for (let x = 0; x <= width; x += 50) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        thickness: 0.25,
        color: rgb(0.7, 0.7, 1),
      });
      page.drawText(`${x}`, { x: x + 1, y: 3, size: 5, font, color: rgb(0, 0, 1) });
    }
    for (let y = 0; y <= height; y += 50) {
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        thickness: 0.25,
        color: rgb(0.7, 0.7, 1),
      });
      page.drawText(`${y}`, { x: 1, y: y + 1, size: 5, font, color: rgb(0, 0, 1) });
    }

    // Also add 10-point tick marks
    for (let x = 0; x <= width; x += 10) {
      if (x % 50 !== 0) {
        page.drawLine({
          start: { x, y: 0 },
          end: { x, y: 3 },
          thickness: 0.15,
          color: rgb(0.8, 0.8, 1),
        });
      }
    }
    for (let y = 0; y <= height; y += 10) {
      if (y % 50 !== 0) {
        page.drawLine({
          start: { x: 0, y },
          end: { x: 3, y },
          thickness: 0.15,
          color: rgb(0.8, 0.8, 1),
        });
      }
    }
  }

  // Now draw red markers at the CURRENT code coordinates
  const CURRENT_FIELDS = {
    coverClientName: { page: 0, x: 72, y: 595, size: 14 },
    coverDate: { page: 0, x: 430, y: 720, size: 11 },
    businessName: { page: 1, x: 250, y: 485, size: 10 },
    businessAddress: { page: 1, x: 250, y: 465, size: 10 },
    businessEIN: { page: 1, x: 250, y: 445, size: 10 },
    signerName: { page: 1, x: 250, y: 425, size: 10 },
    signerAddress: { page: 1, x: 250, y: 405, size: 10 },
    partiesDate: { page: 1, x: 430, y: 505, size: 10 },
    sigRecipientName: { page: 6, x: 72, y: 565, size: 10 },
    sigSignerName: { page: 6, x: 72, y: 540, size: 10 },
    sigDate: { page: 6, x: 300, y: 540, size: 10 },
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

  for (const [name, field] of Object.entries(CURRENT_FIELDS)) {
    if (field.page < pages.length) {
      // Draw red dot and label at current position
      pages[field.page].drawCircle({
        x: field.x,
        y: field.y,
        size: 3,
        color: rgb(1, 0, 0),
      });
      pages[field.page].drawText(name, {
        x: field.x + 5,
        y: field.y - 3,
        size: 6,
        font,
        color: rgb(1, 0, 0),
      });
    }
  }

  const outputBytes = await pdfDoc.save();
  fs.writeFileSync('./debug-agreement-grid.pdf', outputBytes);
  console.log('Debug PDF saved to backend/debug-agreement-grid.pdf');
}

debugPdf().catch(console.error);
