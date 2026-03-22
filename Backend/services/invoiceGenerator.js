const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

/**
 * Generate a PDF invoice buffer from invoice data.
 * @param {Object} invoiceData - { invoiceNumber, clientName, clientEmail, periodStart, periodEnd, items[], totalAmount, currency }
 * @returns {Promise<Buffer>}
 */
function generatePdf(invoiceData) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const {
      invoiceNumber,
      clientName,
      clientEmail,
      periodStart,
      periodEnd,
      items = [],
      totalAmount,
      currency = 'XAF'
    } = invoiceData;

    const formatDate = (d) => {
      if (!d) return 'N/A';
      if (typeof d === 'string') return d;
      const date = d instanceof Date ? d : new Date(d);
      return isNaN(date.getTime()) ? String(d) : date.toISOString().slice(0, 10);
    };
    const periodStartStr = formatDate(periodStart);
    const periodEndStr = formatDate(periodEnd);

    doc.fontSize(20).text(`FACTURE N° ${invoiceNumber}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Client: ${clientName || 'N/A'}`, { continued: false });
    doc.text(`Email: ${clientEmail || 'N/A'}`);
    doc.text(`Période: ${periodStartStr} au ${periodEndStr}`);
    doc.moveDown(2);

    const tableTop = doc.y;
    const colWidths = { desc: 250, qty: 60, unit: 80, total: 100 };
    doc.font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Heures', 50 + colWidths.desc, tableTop);
    doc.text('Prix par heure', 50 + colWidths.desc + colWidths.qty, tableTop);
    doc.text('Total', 50 + colWidths.desc + colWidths.qty + colWidths.unit, tableTop);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    let y = doc.y + 5;
    for (const item of items) {
      doc.text(String(item.description).slice(0, 40), 50, y);
      doc.text(Number(item.quantity).toFixed(2), 50 + colWidths.desc, y);
      doc.text(`${Number(item.unitPrice).toFixed(2)} ${currency}`, 50 + colWidths.desc + colWidths.qty, y);
      doc.text(`${Number(item.total).toFixed(2)} ${currency}`, 50 + colWidths.desc + colWidths.qty + colWidths.unit, y);
      y += 22;
    }
    doc.y = y + 10;
    doc.font('Helvetica-Bold');
    doc.text(`TOTAL TTC: ${Number(totalAmount).toFixed(2)} ${currency}`, 50, doc.y);
    doc.font('Helvetica');
    doc.moveDown(3);
    doc.fontSize(9).fillColor('gray');
    doc.text('Modalités de paiement: à définir. Merci de votre confiance.', 50, doc.y);
    doc.end();
  });
}

module.exports = { generatePdf };
