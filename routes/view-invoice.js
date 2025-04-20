// routes/view-invoice.js

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BusinessProfile = require('../models/BusinessProfile');
const renderInvoiceHtml = require('../utils/renderInvoiceHtml');


router.get('/invoice/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

    const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });

    res.send(renderInvoiceHtml(invoiceData, businessData));
;
  } catch (err) {
    console.error('שגיאה בהצגת חשבונית:', err);
    res.status(500).send('שגיאה בשרת');
  }
});

module.exports = router;
