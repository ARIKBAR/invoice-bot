// routes/invoices-by-owner.js - שליפת קבלות לפי ownerId עם חיפוש לפי תאריך ושם לקוח + pagination 4000 תווים

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

    const invoices = await Invoice.find(filter)
      .populate('customer')
      .sort({ issueDate: -1 });

    let filteredInvoices = invoices;

    if (search) {
      const lower = search.toLowerCase();
      filteredInvoices = invoices.filter(inv => {
        const name = inv.customer?.name || '';
        return (
          name.toLowerCase().includes(lower) ||
          inv.invoiceNumber?.toString().includes(search)
        );
      });
    }

    if (!filteredInvoices.length) {
      return res.json({ message: 'לא נמצאו קבלות.' });
    }

    const page = parseInt(req.body.page) || 1;
    const maxChars = 2500;

    const formattedBlocks = filteredInvoices.map(inv => (
      `📄 קבלה מס' ${inv.invoiceNumber}\n` +
      `👤 לקוח: ${inv.customer?.name || 'ללא שם'}\n` +
      `📅 תאריך: ${new Date(inv.issueDate).toLocaleDateString('he-IL')}\n` +
      `💰 סכום: ₪${inv.totalAmount.toFixed(2)}\n` +
      `📎 לצפייה: https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}\n` +
      `⬇️ הורדה: https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}/image/download`
    ));

    let chunks = [], current = '';
    for (const block of formattedBlocks) {
      const candidate = current + (current ? '\n──────────────\n' : '') + block;
      if (candidate.length > maxChars) {
        chunks.push(current);
        current = block;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);

    const totalPages = chunks.length;
    const selected = chunks[page - 1] || 'לא נמצאו תוצאות לעמוד זה.';

    res.json({
      result: selected,
      currentPage: page,
      totalPages,
      hasMore: page < totalPages
    });
  } catch (err) {
    console.error('שגיאה בשליפת קבלות לפי ownerId:', err);
    res.status(500).json({ error: 'שגיאה בשרת', details: err.message });
  }
});

module.exports = router;
