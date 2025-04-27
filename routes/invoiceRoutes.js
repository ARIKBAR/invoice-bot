const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BusinessProfile = require('../models/BusinessProfile');
const generateInvoiceHTML = require('../utils/generateInvoiceHTML');

// צפייה בחשבונית ב-HTML
router.get('/invoice/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

    const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });
    if (!business) return res.status(404).send('פרטי עסק לא נמצאו');

    const html = generateInvoiceHTML(invoice, business);
    res.send(html);
  } catch (err) {
    console.error('שגיאה בצפייה בחשבונית:', err);
    res.status(500).send('שגיאה בשרת');
  }
});

// הורדת חשבונית כ-PDF
router.get('/invoice/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

    const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });
    if (!business) return res.status(404).send('פרטי עסק לא נמצאו');

    const html = renderInvoiceHtml(invoice, business);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('שגיאה בהפקת PDF:', err);
    res.status(500).send('שגיאה בשרת');
  }
});

module.exports = router;
