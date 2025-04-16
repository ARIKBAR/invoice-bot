// routes/invoices-by-owner.js - שליפת קבלות לפי ownerId

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

router.post('/api/invoices-by-owner', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

  try {
    const invoices = await Invoice.find({ ownerId }).sort({ issueDate: -1 });
    if (!invoices.length) return res.json({ message: 'לא נמצאו קבלות.' });

    const formatted = invoices.map(inv => (
      `📄 קבלה מס' ${inv.invoiceNumber}\n` +
      `📅 תאריך: ${new Date(inv.issueDate).toLocaleDateString('he-IL')}\n` +
      `💰 סכום: ₪${inv.totalAmount.toFixed(2)}\n` +
      `📎 לצפייה: https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}`
    )).join('\n──────────────\n');

    res.json({ result: formatted });
  } catch (err) {
    console.error('שגיאה בשליפת קבלות לפי ownerId:', err);
    res.status(500).json({ error: 'שגיאה בשרת', details: err.message });
  }
});

module.exports = router;
