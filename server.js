// server.js - קובץ השרת המרכזי

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// יצירת יישום express
const app = express();

// התחברות למסד הנתונים
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// שימוש בתיקיית public לקבצים סטטיים
app.use(express.static(path.join(__dirname, 'public')));

// הגדרת נתיבים
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/stats', require('./routes/stats'));

// שימוש בשרת קיים להעלאת תמונות וחילוץ מידע
app.use('/api/scan-image', require('./routes/scan-image'));
// app.use('/api/scan-image-url', require('./routes/scan-image-url'));

// מסלול ליצירת חשבונית מנתונים ידניים
app.post('/api/generate-invoice', async (req, res) => {
  try {
    const invoiceData = req.body;

    if (!invoiceData) {
      return res.status(400).json({ error: 'חסרים נתונים ליצירת החשבונית' });
    }

    // יצירת הנתונים הבסיסיים לחשבונית אם לא סופקו
    const data = {
      מספר_אסמכתה: invoiceData.referenceNumber || Math.floor(Math.random() * 90000) + 10000,
      תאריך: invoiceData.valueDate || new Date().toLocaleDateString('he-IL'),
      סכום: invoiceData.amount || 1200,
      שם_לקוח: invoiceData.customerName || 'רבקה ביטון',
      תיאור_שירות: invoiceData.serviceDescription || 'חבילה מותאמת ניהול סושיאל'
    };

    // יצירת קובץ HTML
    const htmlFilename = generateInvoiceHTML(data);

    // החזרת תשובה עם ה-JSON וקישור ל-HTML
    res.json({
      success: true,
      invoiceData: data,
      htmlUrl: `/${htmlFilename}`
    });
  } catch (error) {
    console.error('שגיאה ביצירת חשבונית:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חשבונית', details: error.message });
  }
});

// פונקציה ליצירת חשבונית HTML
function generateInvoiceHTML(extractedData) {
  const timestamp = Date.now();
  const invoiceNumber = extractedData.מספר_אסמכתה || Math.floor(Math.random() * 90000) + 10000;
  const filename = `invoice-${invoiceNumber}-${timestamp}.html`;

  const invoiceDate = extractedData.תאריך || new Date().toLocaleDateString('he-IL');
  const customerName = extractedData.שם_לקוח || 'רבקה ביטון';
  const serviceDescription = extractedData.תיאור_שירות || 'חבילה מותאמת ניהול סושיאל';
  const amount = typeof extractedData.סכום === 'number' 
    ? extractedData.סכום.toLocaleString() 
    : (extractedData.סכום || '1,200');

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>חשבונית/קבלה ${invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .container { max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; }
        .header { text-align: center; margin-bottom: 20px; }
        .details { margin-bottom: 20px; }
        .details div { margin-bottom: 5px; }
        .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        .total { font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>חשבונית/קבלה</h1>
            <h2>מספר: ${invoiceNumber}</h2>
        </div>
        <div class="details">
            <div>תאריך: ${invoiceDate}</div>
            <div>לקוח: ${customerName}</div>
        </div>
        <table class="items">
            <thead>
                <tr>
                    <th>תיאור</th>
                    <th>סכום</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${serviceDescription}</td>
                    <td>${amount} ₪</td>
                </tr>
            </tbody>
        </table>
        <div class="total">סה"כ: ${amount} ₪</div>
    </div>
</body>
</html>`;

  const filePath = path.join('public', filename);
  fs.writeFileSync(filePath, htmlContent);

  return filename;
}

// נתיב ראשי לבדיקת פעילות השרת
app.get('/', (req, res) => {
  res.json({ message: 'מערכת חשבוניות API פעילה' });
});

// נתיב לטיפול בבקשות לא תקינות
app.use((req, res) => {
  res.status(404).json({ error: 'נתיב לא נמצא' });
});

// הגדרת פורט והפעלת השרת
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`השרת פועל בפורט ${PORT}`));