// routes/invoices-by-owner.js - שליפת קבלות לפי ownerId עם סינון לפי תאריך ושם לקוח

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

function normalizeDate(input) {
  if (!input) return null;
  const clean = input.replace(/[\/.\-\s]/g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const formatted = `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return new Date(formatted);
  }
  return null;
}

router.post('/api/invoices-by-owner', async (req, res) => {
  const { ownerId, search, dateMode, dateInput } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

  try {
    const filter = { ownerId };

    // חיפוש לפי שם לקוח
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // סינון לפי תאריך לפי מצב
    if (dateMode && dateInput) {
      const baseDate = normalizeDate(dateInput);
      if (baseDate) {
        const from = new Date(baseDate);
        const to = new Date(baseDate);

        if (dateMode === 'daily') {
          to.setDate(to.getDate() + 1);
        } else if (dateMode === 'weekly') {
          to.setDate(to.getDate() + 7);
        } else if (dateMode === 'monthly') {
          to.setMonth(to.getMonth() + 1);
        }

        filter.issueDate = { $gte: from, $lt: to };
      }
    }

    const invoices = await Invoice.find(filter).sort({ issueDate: -1 });
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
