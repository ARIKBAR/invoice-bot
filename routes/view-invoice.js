// routes/view-invoice.js

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const BusinessProfile = require('../models/BusinessProfile');
const renderInvoiceHtml = require('../utils/renderInvoiceHtml');

router.get('/invoice/:id', async (req, res) => {
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
      invoiceId: invoice._id.toString()  // עבור כפתור הורדה עתידי
    };

    const businessData = {
      businessName: business?.businessName || '',
      address: business?.address || '',
      email: business?.email || '',
      phone: business?.phone || '',
      taxId: business?.taxId || '',
      logoUrl: business?.logoUrl || ''
    };

    res.send(renderInvoiceHtml(invoiceData, businessData));
  } catch (err) {
    console.error('שגיאה בהצגת חשבונית:', err);
    res.status(500).send('שגיאה בשרת');
  }
});

module.exports = router;
