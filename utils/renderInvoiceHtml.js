function renderInvoiceHtml(invoiceData, businessData) {
    return `<!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>חשבונית/קבלה ${invoiceData.referenceNumber}</title>
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
          align-items: center;
          margin-bottom: 10px;
        }
        .header .info {
          text-align: right;
        }
        .header img {
          height: 60px;
          max-width: 120px;
          object-fit: contain;
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
          <div class="bold" style="font-size: 20px; font-weight: bold;">${businessData.businessName}</div>
          <div class="contact-line"><span class="material-icons-outlined">email</span>${businessData.email}</div>
          <div class="contact-line"><span class="material-icons-outlined">location_on</span>${businessData.address}</div>
          <div class="contact-line"><span class="material-icons-outlined">phone</span>${businessData.phone}</div>
          <div class="contact-line"><span class="material-icons-outlined">badge</span>עוסק פטור: ${businessData.taxId}</div>
        </div>
        <img src="${businessData.logoUrl}" alt="Logo">
      </div>
  
      <div class="invoice-title">חשבונית/קבלה מס' ${invoiceData.referenceNumber}</div>
      <div class="meta-line">
        <div>תאריך: ${invoiceData.issueDate}</div>
        <div>חתום דיגיטלית</div>
      </div>
  
      <div class="section">
        <h3>לכבוד</h3>
        <div class="line">${invoiceData.customerName}</div>
        ${invoiceData.customerIdNumber ? `<div class="line">מספר מזהה: ${invoiceData.customerIdNumber}</div>` : ''}
      </div>
  
      <div class="section">
        <h3>פרטי השירות</h3>
        <div class="details-row">
          <div class="line">${invoiceData.serviceDescription}</div>
          <div class="amount">₪${invoiceData.amount}</div>
        </div>
      </div>
  
      <div class="section">
        <h3>אמצעי תשלום</h3>
        <div class="line">${invoiceData.paymentMethod}</div>
      </div>
  
      <div class="footer">
        מסמך זה הופק באופן אוטומטי על ידי מערכת Invoice Bot
      </div>
    </body>
    </html>`;
  }
  
  module.exports = renderInvoiceHtml;
  