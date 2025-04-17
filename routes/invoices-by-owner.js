// routes/invoices-by-owner.js - שליפת קבלות לפי ownerId עם תמיכה ב-pagination ופורמט מובנה

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

router.post('/api/invoices-by-owner', async (req, res) => {
  const { ownerId } = req.body;
  const skip = parseInt(req.query.skip) || 0;
  const limit = 10;

  if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

  try {
    const invoices = await Invoice.find({ ownerId })
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit);

    if (!invoices.length) {
      return res.json({ invoices: [], hasMore: false });
    }

    const formatted = invoices.map(inv => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: new Date(inv.issueDate).toLocaleDateString('he-IL'),
      totalAmount: inv.totalAmount,
      viewUrl: `https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}`
    }));

    const totalCount = await Invoice.countDocuments({ ownerId });
    const hasMore = skip + limit < totalCount;

    res.json({ invoices: formatted, hasMore });
  } catch (err) {
    console.error('שגיאה בשליפת קבלות לפי ownerId:', err);
    res.status(500).json({ error: 'שגיאה בשרת', details: err.message });
  }
});

module.exports = router;
