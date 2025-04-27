// // routes/stats.js - נתיבים לסטטיסטיקות וניתוח נתונים

// const express = require('express');
// const router = express.Router();
// const Invoice = require('../models/Invoice');
// const Customer = require('../models/Customer');

// /**
//  * @route   GET /api/stats/dashboard
//  * @desc    סטטיסטיקות לדשבורד ראשי
//  * @access  Private
//  */
// router.get('/dashboard', async (req, res) => {
//   try {
//     // הגדרת טווח תאריכים (ברירת מחדל: החודש הנוכחי)
//     const now = new Date();
//     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//     const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
//     // חישוב סטטיסטיקות
    
//     // 1. ספירת חשבוניות לפי סטטוס
//     const invoicesByStatus = await Invoice.aggregate([
//       { $group: { _id: '$status', count: { $sum: 1 } } }
//     ]);
    
//     // 2. סה"כ הכנסות החודש (חשבוניות ששולמו)
//     const monthlyIncome = await Invoice.aggregate([
//       { 
//         $match: { 
//           status: 'paid',
//           issueDate: { $gte: startOfMonth, $lte: endOfMonth }
//         }
//       },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]);
    
//     // 3. סה"כ חובות פתוחים (חשבוניות שנשלחו אך לא שולמו)
//     const outstandingBalance = await Invoice.aggregate([
//       { 
//         $match: { 
//           status: 'sent',
//           dueDate: { $lt: now } // חשבוניות שעבר זמן התשלום
//         }
//       },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]);
    
//     // 4. חשבוניות שהונפקו לאחרונה
//     const recentInvoices = await Invoice.find()
//       .sort({ issueDate: -1 })
//       .limit(5)
//       .populate('customer', 'name');
    
//     // 5. מספר לקוחות פעילים
//     const activeCustomersCount = await Customer.countDocuments();
    
//     // שליחת הנתונים
//     res.json({
//       invoicesByStatus: invoicesByStatus.reduce((result, item) => {
//         result[item._id] = item.count;
//         return result;
//       }, {}),
//       monthlyIncome: monthlyIncome.length > 0 ? monthlyIncome[0].total : 0,
//       outstandingBalance: outstandingBalance.length > 0 ? outstandingBalance[0].total : 0,
//       recentInvoices: recentInvoices.map(invoice => ({
//         id: invoice._id,
//         invoiceNumber: invoice.invoiceNumber,
//         date: invoice.issueDate,
//         customerName: invoice.customer ? invoice.customer.name : 'לקוח לא מוגדר',
//         amount: invoice.totalAmount,
//         status: invoice.status
//       })),
//       activeCustomersCount
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'שגיאת שרת', details: err.message });
//   }
// });

// /**
//  * @route   GET /api/stats/monthly-income
//  * @desc    הכנסות חודשיות בשנה האחרונה
//  * @access  Private
//  */
// router.get('/monthly-income', async (req, res) => {
//   try {
//     // קביעת התאריך לפני 12 חודשים
//     const oneYearAgo = new Date();
//     oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
//     // הרצת query מורכב למונגו
//     const monthlyIncome = await Invoice.aggregate([
//       {
//         $match: {
//           status: 'paid',
//           issueDate: { $gte: oneYearAgo }
//         }
//       },
//       {
//         $group: {
//           _id: {
//             year: { $year: '$issueDate' },
//             month: { $month: '$issueDate' }
//           },
//           total: { $sum: '$totalAmount' }
//         }
//       },
//       {
//         $sort: { '_id.year': 1, '_id.month': 1 }
//       }
//     ]);
    
//     // עיבוד הנתונים למבנה נוח יותר
//     const processedData = Array(12).fill(0);
    
//     monthlyIncome.forEach(item => {
//       const now = new Date();
//       const currentYear = now.getFullYear();
//       const currentMonth = now.getMonth() + 1;
      
//       // חישוב הפרש חודשים מהחודש הנוכחי
//       const month = item._id.month;
//       const year = item._id.year;
      
//       // חישוב האינדקס במערך התוצאה (0 = החודש הנוכחי, 11 = לפני 11 חודשים)
//       let index = currentMonth - month + (currentYear - year) * 12;
//       index = 11 - index;  // הפוך את הסדר כך ש-0 יהיה הכי ישן ו-11 הכי חדש
      
//       if (index >= 0 && index < 12) {
//         processedData[index] = item.total;
//       }
//     });
    
//     // יצירת תוויות חודשים
//     const labels = [];
//     const now = new Date();
//     for (let i = 0; i < 12; i++) {
//       const d = new Date(now);
//       d.setMonth(d.getMonth() - 11 + i);
//       labels.push(`${d.getMonth() + 1}/${d.getFullYear()}`);
//     }
    
//     res.json({
//       labels,
//       data: processedData
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'שגיאת שרת', details: err.message });
//   }
// });

// /**
//  * @route   GET /api/stats/top-customers
//  * @desc    הלקוחות המובילים לפי היקף הזמנות
//  * @access  Private
//  */
// router.get('/top-customers', async (req, res) => {
//   try {
//     // הגבלת מספר התוצאות
//     const limit = parseInt(req.query.limit) || 5;
    
//     // תקופת הזמן לחישוב (ברירת מחדל: השנה האחרונה)
//     const timeFrame = req.query.timeFrame || 'year';
    
//     let dateFilter = {};
//     const now = new Date();
    
//     if (timeFrame === 'month') {
//       // חודש אחרון
//       const oneMonthAgo = new Date(now);
//       oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
//       dateFilter = { $gte: oneMonthAgo };
//     } else if (timeFrame === 'quarter') {
//       // רבעון אחרון
//       const threeMonthsAgo = new Date(now);
//       threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
//       dateFilter = { $gte: threeMonthsAgo };
//     } else {
//       // שנה אחרונה (ברירת מחדל)
//       const oneYearAgo = new Date(now);
//       oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
//       dateFilter = { $gte: oneYearAgo };
//     }
    
//     // חישוב הלקוחות המובילים
//     const topCustomers = await Invoice.aggregate([
//       {
//         $match: {
//           issueDate: dateFilter,
//           status: { $in: ['paid', 'sent'] } // רק חשבוניות פעילות
//         }
//       },
//       {
//         $group: {
//           _id: '$customer',
//           totalAmount: { $sum: '$totalAmount' },
//           invoiceCount: { $sum: 1 }
//         }
//       },
//       {
//         $sort: { totalAmount: -1 }
//       },
//       {
//         $limit: limit
//       },
//       {
//         $lookup: {
//           from: 'customers',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'customerDetails'
//         }
//       },
//       {
//         $unwind: {
//           path: '$customerDetails',
//           preserveNullAndEmptyArrays: true
//         }
//       }
//     ]);
    
//     // עיבוד התוצאות למבנה נוח יותר
//     const result = topCustomers.map(customer => ({
//       customerId: customer._id,
//       name: customer.customerDetails ? customer.customerDetails.name : 'לקוח לא מוגדר',
//       totalAmount: customer.totalAmount,
//       invoiceCount: customer.invoiceCount
//     }));
    
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'שגיאת שרת', details: err.message });
//   }
// });

// /**
//  * @route   GET /api/stats/unpaid-invoices
//  * @desc    חשבוניות פתוחות שעבר זמן התשלום
//  * @access  Private
//  */
// router.get('/unpaid-invoices', async (req, res) => {
//   try {
//     const now = new Date();
    
//     // חיפוש חשבוניות פתוחות שעבר זמן התשלום
//     const unpaidInvoices = await Invoice.find({
//       status: 'sent',
//       dueDate: { $lt: now }
//     })
//     .sort({ dueDate: 1 }) // מיון לפי תאריך תשלום (הישנות ביותר קודם)
//     .populate('customer', 'name email phone');
    
//     // חישוב כמה ימים עברו מתאריך התשלום
//     const result = unpaidInvoices.map(invoice => {
//       const daysOverdue = Math.floor((now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
      
//       return {
//         id: invoice._id,
//         invoiceNumber: invoice.invoiceNumber,
//         customer: {
//           id: invoice.customer ? invoice.customer._id : null,
//           name: invoice.customer ? invoice.customer.name : 'לקוח לא מוגדר',
//           email: invoice.customer ? invoice.customer.email : null,
//           phone: invoice.customer ? invoice.customer.phone : null
//         },
//         amount: invoice.totalAmount,
//         issueDate: invoice.issueDate,
//         dueDate: invoice.dueDate,
//         daysOverdue
//       };
//     });
    
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'שגיאת שרת', details: err.message });
//   }
// });

// /**
//  * @route   GET /api/stats/income-by-month/:year
//  * @desc    הכנסות לפי חודשים בשנה מסוימת
//  * @access  Private
//  */
// router.get('/income-by-month/:year', async (req, res) => {
//   try {
//     const year = parseInt(req.params.year) || new Date().getFullYear();
    
//     // חישוב הכנסות לפי חודש
//     const incomeByMonth = await Invoice.aggregate([
//       {
//         $match: {
//           status: 'paid',
//           issueDate: {
//             $gte: new Date(`${year}-01-01`),
//             $lte: new Date(`${year}-12-31`)
//           }
//         }
//       },
//       {
//         $group: {
//           _id: { $month: '$issueDate' },
//           totalAmount: { $sum: '$totalAmount' }
//         }
//       },
//       {
//         $sort: { '_id': 1 }
//       }
//     ]);
    
//     // יצירת מערך לכל חודשי השנה (כולל חודשים ללא הכנסות)
//     const monthlyData = Array(12).fill(0);
    
//     incomeByMonth.forEach(item => {
//       monthlyData[item._id - 1] = item.totalAmount;
//     });
    
//     res.json({
//       year,
//       data: monthlyData
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'שגיאת שרת', details: err.message });
//   }
// });

// module.exports = router;
// routes/stats.js - ניתוחים מתקדמים והפקת דוחות כולל HTML ו-Excel

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const BusinessProfile = require('../models/BusinessProfile');
const renderInvoiceHtml = require('../utils/renderInvoiceHtml');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// עיבוד תאריך נוח
function formatDate(date) {
  return new Date(date).toLocaleDateString('he-IL');
}

/**
 * @route   GET /api/stats/monthly-report/:ownerId/:month/:year
 * @desc    דוח חודשי כולל תצוגת HTML + יצירת Excel
 */
router.get('/monthly-report/:ownerId/:month/:year', async (req, res) => {
  try {
    const { ownerId, month, year } = req.params;
    const from = new Date(`${year}-${month}-01`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);

    const business = await BusinessProfile.findOne({ ownerId });
    const invoices = await Invoice.find({
      ownerId,
      issueDate: { $gte: from, $lt: to },
      status: { $in: ['paid', 'sent'] }
    }).populate('customer');

    // סכום כולל
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // HTML דוח
    const htmlRows = invoices.map(inv => `
      <tr>
        <td>${inv.invoiceNumber}</td>
        <td>${inv.customer?.name || 'ללא שם'}</td>
        <td>${formatDate(inv.issueDate)}</td>
        <td>${inv.totalAmount} ₪</td>
        <td>${inv.paymentMethod || 'כללי'}</td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח חודשי ${month}/${year}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h2>דוח קבלות - ${business.businessName}</h2>
      <h3>${month}/${year}</h3>
      <p>סה"כ קבלות: ${invoices.length} | סך כולל: ${totalAmount} ₪</p>
      <table>
        <tr>
          <th>מס'</th>
          <th>לקוח</th>
          <th>תאריך</th>
          <th>סכום</th>
          <th>אמצעי תשלום</th>
        </tr>
        ${htmlRows}
      </table>
    </body>
    </html>
    `;

    // יצירת קובץ Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Report ${month}-${year}`);

    sheet.columns = [
      { header: 'מספר קבלה', key: 'invoiceNumber', width: 15 },
      { header: 'שם לקוח', key: 'customerName', width: 25 },
      { header: 'תאריך', key: 'date', width: 15 },
      { header: 'סכום', key: 'amount', width: 12 },
      { header: 'אמצעי תשלום', key: 'payment', width: 15 },
    ];

    invoices.forEach(inv => {
      sheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer?.name || 'ללא שם',
        date: formatDate(inv.issueDate),
        amount: inv.totalAmount,
        payment: inv.paymentMethod || 'כללי'
      });
    });

    // שמירה זמנית
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filePath = path.join(tempDir, `report-${ownerId}-${month}-${year}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    res.json({
      success: true,
      html,
      excelUrl: `/temp/report-${ownerId}-${month}-${year}.xlsx`,
      summary: {
        total: totalAmount,
        count: invoices.length
      }
    });
  } catch (err) {
    console.error('שגיאה ביצירת דוח חודשי:', err);
    res.status(500).json({ error: 'שגיאה ביצירת דוח חודשי', details: err.message });
  }
});

module.exports = router;
