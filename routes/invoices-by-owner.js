// routes/invoices-by-owner.js - שליפת קבלות לפי ownerId עם חיפוש לפי תאריך ושם לקוח

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

    const formatted = filteredInvoices.map(inv => (
      `📄 קבלה מס' ${inv.invoiceNumber}\n` +
      `👤 לקוח: ${inv.customer?.name || 'ללא שם'}\n` +
      `📅 תאריך: ${new Date(inv.issueDate).toLocaleDateString('he-IL')}\n` +
      `💰 סכום: ₪${inv.totalAmount.toFixed(2)}\n` +
      `📎 לצפייה: https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}\n` +
      `⬇️ הורדה: https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}/image/download`
    )).join('\n──────────────\n');
    
    const objectified = filteredInvoices.map(inv => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.name || '',
      issueDate: new Date(inv.issueDate).toLocaleDateString('he-IL'),
      totalAmount: inv.totalAmount,
      viewUrl: `https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}`,
      downloadUrl: `https://invoice-bot-kcz5.onrender.com/invoice/${inv._id}/image/download`
    }));
    
    res.json({
      result: formatted,
      invoices: objectified
    });
    
  } catch (err) {
    console.error('שגיאה בשליפת קבלות לפי ownerId:', err);
    res.status(500).json({ error: 'שגיאה בשרת', details: err.message });
  }
});

module.exports = router;
