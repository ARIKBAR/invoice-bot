const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

/**
 * @route   POST /api/invoices-by-owner
 * @desc    מחזיר את כל הקבלות שנוצרו על ידי משתמש מסוים לפי ownerId (מספר טלפון)
 */
router.post('/api/invoices-by-owner', async (req, res) => {
  const { ownerId } = req.body;

  if (!ownerId) {
    return res.status(400).json({ error: 'ownerId is required' });
  }

  try {
    const invoices = await Invoice.find({ ownerId }).sort({ issueDate: -1 });

    if (!invoices.length) {
      return res.json({ message: 'לא נמצאו קבלות.' });
    }

    const formatted = invoices.map(inv => {
      return (
        `📄 קבלה מס' ${inv.invoiceNumber}\n` +
        `📅 תאריך: ${new Date(inv.issueDate).toLocaleDateString('he-IL')}\n` +
        `💰 סכום: ₪${inv.totalAmount.toFixed(2)}\n` +
        `📎 קובץ PDF:\nhttps://invoice-bot-kcz5.onrender.com/api/invoices/${inv._id}/pdf\n`
      );
    }).join('\n──────────────\n');

    res.json({ result: formatted });
  } catch (err) {
    console.error('שגיאה בשליפת הקבלות:', err);
    res.status(500).json({ error: 'שגיאה בשליפת הקבלות', details: err.message });
  }
});

module.exports = router;
