// utils/generateInvoiceHTML.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function generateInvoiceHTML(invoiceData, businessData) {
  const uniqueId = uuidv4().slice(0, 6);
  const filename = `invoice-${invoiceData.referenceNumber}-${uniqueId}.html`;
  const outputDir = path.join(__dirname, '../public/invoices');
  const filepath = path.join(outputDir, filename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>חשבונית/קבלה ${invoiceData.referenceNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Assistant', sans-serif;
      direction: rtl;
      background: #f7f8fa;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 40px auto;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #ccc;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    header img {
      height: 60px;
      object-fit: contain;
    }
    .business-info {
      text-align: right;
      font-size: 14px;
      line-height: 1.6;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .value {
      margin-bottom: 4px;
    }
    .amount {
      font-size: 20px;
      font-weight: bold;
      color: #2e7d32;
      margin-top: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #777;
    }
  </style>
</head>
<body>

<header>
  <div class="business-info">
    <div class="bold">${businessData.businessName}</div>
    <div>עוסק פטור: ${businessData.taxId}</div>
    <div>${businessData.address}</div>
    <div>${businessData.phone} | ${businessData.email}</div>
  </div>
  <img src="${businessData.logoUrl}" alt="Logo">
</header>

<div class="section">
  <div class="section-title">פרטי לקוח</div>
  <div class="value">שם: ${invoiceData.customerName}</div>
  <div class="value">מספר מזהה: ${invoiceData.customerIdNumber || ''}</div>
</div>

<div class="section">
  <div class="section-title">פרטי חשבונית</div>
  <div class="value">תאריך: ${invoiceData.issueDate}</div>
  <div class="value">מספר קבלה: ${invoiceData.referenceNumber}</div>
  <div class="value">תיאור השירות: ${invoiceData.serviceDescription}</div>
  <div class="value">אמצעי תשלום: ${invoiceData.paymentMethod}</div>
  <div class="amount">סה"כ לתשלום: ₪${invoiceData.amount}</div>
</div>

<div class="footer">חתום דיגיטלית | הקבלה הופקה אוטומטית ע"י מערכת Invoice Bot</div>

</body>
</html>`;

  fs.writeFileSync(filepath, html, 'utf-8');
  return filename;
}

module.exports = generateInvoiceHTML;
