// // routes/view-invoice.js

// const express = require('express');
// const router = express.Router();
// const Invoice = require('../models/Invoice');
// const Customer = require('../models/Customer');
// const BusinessProfile = require('../models/BusinessProfile');

// router.get('/invoice/:id', async (req, res) => {
//   try {
//     const invoice = await Invoice.findById(req.params.id).populate('customer');
//     if (!invoice) return res.status(404).send('חשבונית לא נמצאה');

//     const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });

//     res.send(`
//       <!DOCTYPE html>
//       <html lang="he" dir="rtl">
//       <head>
//         <meta charset="UTF-8" />
//         <title>חשבונית מס</title>
//         <style>
//           body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; }
//           .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
//           .logo img { height: 70px; }
//           .business-info { text-align: right; }
//           .section-title { font-weight: bold; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
//           .details, .totals { margin-top: 10px; }
//           .details div, .totals div { margin-bottom: 6px; }
//           .highlight { font-size: 1.2em; color: #0275d8; font-weight: bold; }
//           .download-btn { margin-top: 40px; padding: 10px 20px; background-color: #0275d8; color: white; text-decoration: none; border-radius: 5px; display: inline-block; }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <div class="logo">
//             ${business?.logoUrl ? `<img src="${business.logoUrl}" alt="לוגו">` : ''}
//           </div>
//           <div class="business-info">
//             <div><strong>${business?.businessName || ''}</strong></div>
//             <div>${business?.address || ''}</div>
//             <div>${business?.phone || ''}</div>
//             <div>${business?.email || ''}</div>
//             <div>ח.פ ${business?.taxId || ''}</div>
//           </div>
//         </div>

//         <div class="section-title">פרטי לקוח</div>
//         <div class="details">
//           <div>שם: ${invoice.customer.name}</div>
//         </div>

//         <div class="section-title">פרטי השירות</div>
//         <div class="details">
//           <div>${invoice.items[0].description}</div>
//         </div>

//         <div class="section-title">סכום לתשלום</div>
//         <div class="totals">
//           <div class="highlight">₪${invoice.totalAmount.toFixed(2)}</div>
//         </div>

//         <a href="/api/invoices/${invoice._id}/pdf" class="download-btn">הורד כ-PDF</a>
//       </body>
//       </html>
//     `);
//   } catch (err) {
//     console.error('שגיאה בהצגת חשבונית:', err);
//     res.status(500).send('שגיאה בשרת');
//   }
// });

// module.exports = router;
