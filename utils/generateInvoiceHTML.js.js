// utils/generateInvoiceHTML.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * יוצר קובץ HTML של קבלה בפורמט SUMIT
 * @param {{ referenceNumber, issueDate, customerName, customerIdNumber, serviceDescription, amount, paymentMethod }} invoiceData
 * @param {{ businessName, taxId, email, phone, address, logoUrl }} businessData
 * @returns {string} שם הקובץ
 */
function generateInvoiceHTML(invoiceData, businessData) {
  const uniqueId = uuidv4().slice(0, 6);
  const filename = `invoice-${invoiceData.referenceNumber}-${uniqueId}.html`;
  const outputDir = path.join(__dirname, '../public/invoices');
  const filepath = path.join(outputDir, filename);

  // ודא שהתיקייה קיימת
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>חשבונית/קבלה ${invoiceData.referenceNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      direction: rtl;
      max-width: 800px;
      margin: 40px auto;
      padding: 40px;
      background: #fff;
      color: #000;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    header img {
      height: 70px;
    }
    .business-info {
      text-align: right;
    }
    .line {
      border-top: 2px solid #000;
      margin: 20px 0;
    }
    .section {
      margin-bottom: 20px;
    }
    .bold { font-weight: bold; }
    .amount { font-size: 1.2em; }
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
  <div class="bold">לכבוד:</div>
  <div>${invoiceData.customerName}</div>
  <div>מספר מזהה: ${invoiceData.customerIdNumber || ''}</div>
</div>

<div class="section">
  <div>תאריך: ${invoiceData.issueDate}</div>
  <div>מספר קבלה: ${invoiceData.referenceNumber}</div>
  <div class="line"></div>
  <div>תיאור השירות: ${invoiceData.serviceDescription}</div>
  <div class="amount">סכום: ₪${invoiceData.amount}</div>
  <div>אמצעי תשלום: ${invoiceData.paymentMethod}</div>
</div>

<div class="line"></div>
<div>חתום דיגיטלית</div>

</body>
</html>`;

  fs.writeFileSync(filepath, html, 'utf-8');
  return filename;
}

module.exports = generateInvoiceHTML;
