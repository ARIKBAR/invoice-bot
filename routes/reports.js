// routes/reports.js - יצירת דוחות אקסל ודוחות כספיים

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BusinessProfile = require('../models/BusinessProfile');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// עיבוד תאריך נוח
function formatDate(date) {
  return new Date(date).toLocaleDateString('he-IL');
}

/**
 * @route   GET /api/reports/export-xlsx
 * @desc    יצירת קובץ אקסל של כלל הקבלות
 */
router.get('/export-xlsx', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

    const invoices = await Invoice.find({ ownerId }).populate('customer');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('דוח קבלות');

    sheet.columns = [
      { header: 'מספר קבלה', key: 'invoiceNumber', width: 15 },
      { header: 'לקוח', key: 'customerName', width: 25 },
      { header: 'תאריך', key: 'issueDate', width: 15 },
      { header: 'סכום', key: 'totalAmount', width: 15 },
      { header: 'סטטוס', key: 'status', width: 15 }
    ];

    invoices.forEach(inv => {
      sheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer?.name || 'ללא שם',
        issueDate: formatDate(inv.issueDate),
        totalAmount: inv.totalAmount,
        status: inv.status
      });
    });

    const exportsDir = path.join(__dirname, '../public/exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, `all-invoices-${Date.now()}.xlsx`);

    await workbook.xlsx.writeFile(filePath);

    res.json({
      success: true,
      downloadUrl: `/exports/${path.basename(filePath)}`
    });
  } catch (err) {
    console.error('שגיאה ביצירת דוח אקסל:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   GET /api/reports/summary
 * @desc    סיכום הכנסות לפי שנה וחודש
 */
router.get('/summary', async (req, res) => {
  try {
    const { ownerId, year, customerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

    const match = { ownerId };
    if (year) {
      match.issueDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      };
    }
    if (customerId) {
      match.customer = customerId;
    }

    const incomeSummary = await Invoice.aggregate([
      { $match: match },
      { $group: {
          _id: { month: { $month: '$issueDate' }, year: { $year: '$issueDate' } },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: incomeSummary
    });
  } catch (err) {
    console.error('שגיאה בשליפת מאזן:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

module.exports = router;
