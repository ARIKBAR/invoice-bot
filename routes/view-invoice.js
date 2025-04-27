// routes/view-invoice.js

const axios = require('axios');
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

    res.send(`
    <!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>חשבונית/קבלה ${invoice.invoiceNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Assistant', sans-serif;
      background: #fff;
      color: #111;
      margin: 0;
      padding: 40px;
      max-width: 800px;
      margin: auto;
      border: 1px solid #eee;
    }
   .header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.header .info {
  width: 60%;
  max-width: 60%;
  text-align: right;
}

.header .logo {
  width: 40%;
  max-width: 40%;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.header img {
  width: 120px;
  height: 60px;
  object-fit: contain;
  object-position: center;
  display: block;
}


@media (max-width: 600px) {
  .header {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
  }
  .header .info,
  .header .logo {
    width: 50%;
  }
  .header .logo {
    justify-content: flex-end;
  }
  .header .info {
    text-align: right;
  }
}


      
    .contact-line {
      font-size: 14px;
      color: #444;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
    }
    .contact-line .material-icons-outlined {
      font-size: 16px;
      margin-left: 6px;
      color: #666;
    }
    .invoice-title {
      text-align: right;
      font-size: 24px;
      font-weight: bold;
      margin-top: 20px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .meta-line {
      font-size: 14px;
      color: #444;
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      border-bottom: 1px solid #eee;
      padding-bottom: 6px;
    }
    .section {
      margin-top: 30px;
    }
    .section h3 {
      font-size: 16px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .line {
      font-size: 15px;
      margin-bottom: 8px;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .amount {
      font-size: 18px;
      font-weight: bold;
      color: #039be5;
      white-space: nowrap;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #888;
      margin-top: 50px;
    }
  </style>
</head>
<body>
 <div class="header">
  <div class="info">
    <div class="bold" style="font-size: 20px; font-weight: bold;">${business.businessName}</div>
    <div class="contact-line"><span class="material-icons-outlined">email</span>${business.email}</div>
    <div class="contact-line"><span class="material-icons-outlined">location_on</span>${business.address}</div>
    <div class="contact-line"><span class="material-icons-outlined">phone</span>${business.phone}</div>
    <div class="contact-line"><span class="material-icons-outlined">badge</span>עוסק פטור: ${business.taxId}</div>
  </div>
  <div class="logo">
    <img src="${business.logoUrl}" alt="Logo">
  </div>
</div>


  <div class="invoice-title">חשבונית/קבלה מס' ${invoice.invoiceNumber}</div>
  <div class="meta-line">
<div>תאריך: ${new Date(invoice.issueDate).toLocaleDateString('he-IL')}</div>
    <div>חתום דיגיטלית</div>
  </div>

  <div class="section">
    <h3>לכבוד</h3>
    <div class="line">${invoice.customer.name}</div>
    ${invoice.customer.idNumber ? `<div class="line">מספר מזהה: ${invoice.customer.idNumber}</div>` : ''}
  </div>

  <div class="section">
    <h3>פרטי השירות</h3>
    <div class="details-row">
      <div class="line">${invoice.items[0].description}</div>
      <div class="amount">₪${invoice.totalAmount}</div>
    </div>
  </div>

  <div class="section">
    <h3>אמצעי תשלום</h3>
<div class="line">${invoice.paymentMethod || 'כללי'}</div>
  </div>

  <div class="footer">
    מסמך זה הופק אוטומטית על ידי מערכת Invoice Bot
  </div>

</body>
</html>
    `);
  } catch (err) {
    console.error('שגיאה בהצגת חשבונית:', err);
    res.status(500).send('שגיאה בשרת');
  }
});


router.get('/invoice/:id/image/download', async (req, res) => {
    try {
      const invoiceId = req.params.id;
  
      // שליפת החשבונית עם לקוח
      const invoice = await Invoice.findById(invoiceId).populate('customer');
      if (!invoice) return res.status(404).json({ error: 'חשבונית לא נמצאה' });
  
      const business = await BusinessProfile.findOne({ ownerId: invoice.ownerId });
  
      // בניית הנתונים להצגת החשבונית
      const invoiceData = {
        customerName: invoice.customer?.name || '',
        customerIdNumber: invoice.customer?.idNumber || '',
        serviceDescription: invoice.items[0]?.description || '',
        amount: invoice.totalAmount,
        paymentMethod: invoice.paymentMethod || 'כללי',
        issueDate: invoice.issueDate.toLocaleDateString('he-IL'),
        referenceNumber: invoice.invoiceNumber
      };
  
      const businessData = {
        businessName: business?.businessName || '',
        address: business?.address || '',
        email: business?.email || '',
        phone: business?.phone || '',
        taxId: business?.taxId || '',
        logoUrl: business?.logoUrl || ''
      };
  
      const html = renderInvoiceHtml(invoiceData, businessData);
  
      // פרמטרים לבקשת HTML → תמונה
      const params = new URLSearchParams({
        html,
        selector: 'body',
        transparent: 'true',
        device_scale: '2',
        width: '',
        height: ''
      });
  
      // יצירת תמונה דרך htmlcsstoimage
      const hctiResponse = await axios.post(
        'https://hcti.io/v1/image',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: process.env.HTMLCSSTOIMAGE_USER,
            password: process.env.HTMLCSSTOIMAGE_API_KEY
          }
        }
      );
  
      const imageUrl = hctiResponse.data.url;
  
      // הורדת התמונה ללקוח
      const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
  
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.png`);
      imageResponse.data.pipe(res);
  
    } catch (err) {
      console.error('שגיאה בהורדת תמונה:', err);
      res.status(500).json({ error: 'שגיאה בהורדת התמונה', details: err.message });
    }
  });
  
  module.exports = router;