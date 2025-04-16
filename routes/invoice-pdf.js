// routes/invoice-pdf.js

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BusinessProfile = require('../models/BusinessProfile');
const renderInvoiceHtml = require('../utils/renderInvoiceHtml');

router.get('/invoice/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

    const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });
    if (!business) return res.status(404).send('פרטי עסק לא נמצאו');

    // הכנת HTML
    const html = renderInvoiceHtml({
      referenceNumber: invoice.invoiceNumber,
      issueDate: new Date(invoice.issueDate).toLocaleDateString('he-IL'),
      customerName: invoice.customer.name,
      customerIdNumber: invoice.customer.idNumber || '',
      serviceDescription: invoice.items[0].description,
      amount: invoice.totalAmount,
      paymentMethod: invoice.notes || '---'
    }, business);

    // הפעלת puppeteer
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    // שליחת PDF להורדה
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('שגיאה בהפקת PDF:', err);
    res.status(500).send('שגיאה בשרת');
  }
});

module.exports = router;
