const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const BusinessProfile = require('../models/BusinessProfile');
const renderInvoiceHtml = require('../utils/renderInvoiceHtml');
const generateInvoiceImageFromHtml = require('../utils/generateInvoiceImageFromHtml');

router.get('/invoice/:id/image', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

    const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });

    const invoiceData = {
      referenceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toLocaleDateString('he-IL'),
      serviceDescription: invoice.items[0]?.description || '',
      amount: invoice.totalAmount,
      paymentMethod: invoice.paymentMethod || 'כללי',
      customerName: invoice.customer?.name || '',
      customerIdNumber: invoice.customer?.idNumber || '',
    };

    const businessData = {
      businessName: business?.businessName || '',
      address: business?.address || '',
      email: business?.email || '',
      phone: business?.phone || '',
      taxId: business?.taxId || '',
      logoUrl: business?.logoUrl || ''
    };

    const html = renderInvoiceHtml(invoiceData, businessData);
    const imageUrl = await generateInvoiceImageFromHtml(html);

    res.json({ imageUrl });
  } catch (err) {
    console.error('שגיאה ביצירת תמונה:', err);
    res.status(500).json({ error: 'שגיאה ביצירת תמונה', details: err.message });
  }
});

module.exports = router;
