// server.js - קובץ לשרת Express שמטפל בבקשות API

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { createWorker } = require('tesseract.js');
const FormData = require('form-data');
const cors = require('cors');
const dotenv = require('dotenv');

// טעינת משתני הסביבה מקובץ .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// הוספת תמיכה ב-CORS
app.use(cors());
// הוספת תמיכה ב-JSON בגוף הבקשה
app.use(express.json());

// הוספת תמיכה בקבצים סטטיים
app.use(express.static('public'));

// הגדרת אחסון זמני לתמונות שמועלות
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// פונקציה לטיפול בשגיאות Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'שגיאה בהעלאת הקובץ', details: err.message });
  }
  next(err);
};

// מסלול API לעיבוד תמונה מקובץ מקומי
app.post('/api/scan-image', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'אין תמונה בבקשה' });
    }

    // קריאה לפונקציה שסורקת תמונה ומחלצת טקסט
    const extractedText = await extractTextFromImage(req.file.path);
    
    // שליחת הטקסט ל-Claude API לניתוח
    const analysisResult = await analyzeWithClaude(extractedText);
    
    // יצירת קובץ PDF ו-HTML מהתוצאות
    const result = await createPDFFromResults(analysisResult, req.file.path);
    
    // החזרת תשובה עם ה-JSON וקישורים ל-PDF ו-HTML
    res.json({
      success: true,
      extractedText,
      analysis: analysisResult,
      pdfUrl: `/download/${result.pdfPath.split('/').pop()}`,
      htmlUrl: `/${result.htmlFilename}`
    });
  } catch (error) {
    console.error('שגיאה בעיבוד התמונה:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד התמונה', details: error.message });
  }
});

// מסלול API לעיבוד תמונה מ-URL
app.post('/api/scan-image-url', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'חסרה כתובת URL של תמונה' });
    }

    let imageBuffer;
    
    // טיפול מיוחד בקישורים מגוגל דרייב
    if (imageUrl.includes('drive.google.com')) {
      // מחלץ את מזהה הקובץ מה-URL של גוגל דרייב
      const fileId = imageUrl.match(/[-\w]{25,}/);
      if (!fileId || !fileId[0]) {
        return res.status(400).json({ error: 'לא ניתן לחלץ את מזהה הקובץ מכתובת גוגל דרייב' });
      }
      
      // יוצר קישור הורדה ישיר
      const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId[0]}`;
      
      // מוריד את התמונה
      const response = await axios({
        method: 'get',
        url: directDownloadUrl,
        responseType: 'arraybuffer'
      });
      
      imageBuffer = response.data;
    } else {
      // הורדה רגילה לכל URL אחר
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'arraybuffer'
      });
      
      imageBuffer = response.data;
    }

    // שמירת התמונה בתיקייה זמנית
    const timestamp = Date.now();
    const imgPath = path.join('uploads', `image-${timestamp}.jpg`);
    fs.writeFileSync(imgPath, imageBuffer);

    // קריאה לפונקציה שסורקת תמונה ומחלצת טקסט
    const extractedText = await extractTextFromImage(imgPath);
    
    // שליחת הטקסט ל-Claude API לניתוח
    const analysisResult = await analyzeWithClaude(extractedText);
    
    // יצירת קובץ PDF ו-HTML מהתוצאות
    const result = await createPDFFromResults(analysisResult, imgPath);
    
    // החזרת תשובה עם ה-JSON וקישורים ל-PDF ו-HTML
    res.json({
      success: true,
      extractedText,
      analysis: analysisResult,
      pdfUrl: `/download/${result.pdfPath.split('/').pop()}`,
      htmlUrl: `/${result.htmlFilename}`
    });
  } catch (error) {
    console.error('שגיאה בעיבוד התמונה מ-URL:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד התמונה מ-URL', details: error.message });
  }
});

// מסלול להורדת קבצי PDF
app.get('/download/:filename', (req, res) => {
  const filePath = `pdfs/${req.params.filename}`;
  res.download(filePath);
});

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
      // תוספת נתונים רלוונטיים נוספים
      תיאור_שירות: invoiceData.serviceDescription || 'חבילה מותאמת ניהול סושיאל'
    };
    
    // יצירת קובץ PDF
    const pdfPath = await createInvoicePDF(data);
    
    // יצירת קובץ HTML
    const htmlFilename = generateInvoiceHTML(data);
    
    // החזרת תשובה עם ה-JSON וקישור ל-PDF
    res.json({
      success: true,
      invoiceData: data,
      pdfUrl: `/download/${pdfPath.split('/').pop()}`,
      htmlUrl: `/${htmlFilename}`
    });
  } catch (error) {
    console.error('שגיאה ביצירת חשבונית:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חשבונית', details: error.message });
  }
});

// פונקציה לחילוץ טקסט מתמונה באמצעות Tesseract OCR
async function extractTextFromImage(imagePath) {
  const worker = await createWorker('heb+eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();
  return data.text;
}

// פונקציה לניתוח מקומי של הטקסט ללא שימוש ב-API חיצוני
function analyzeTextLocally(text) {
  // חיפוש תאריכים בפורמט נפוץ
  const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/g;
  const dates = [];
  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    dates.push(match[0]);
  }
  
  // חיפוש סכומי כסף
  const moneyRegex = /(\d{1,3}(,\d{3})*(\.\d{1,2})?)/g;
  const amounts = [];
  while ((match = moneyRegex.exec(text)) !== null) {
    if (!isNaN(match[0].replace(',', ''))) {
      amounts.push(match[0]);
    }
  }
  
  // חיפוש מספרי חשבון וכדומה
  const accountRegex = /(\d{4,})/g;
  const accounts = [];
  while ((match = accountRegex.exec(text)) !== null) {
    if (match[0].length >= 4 && match[0].length <= 20) {
      accounts.push(match[0]);
    }
  }
  
  // חיפוש שם לקוח/מקבל
  let customerName = '';
  // חיפוש שמות נפוצים לשדות עם שמות
  const nameLabels = ['שם חשבון מחויב', 'שם מחויב', 'שם בעל החשבון', 'שם לקוח', 'לכבוד'];
  
  for (const label of nameLabels) {
    const labelIndex = text.indexOf(label);
    if (labelIndex !== -1) {
      // מצא טקסט אחרי התווית עד סוף השורה
      const afterLabel = text.substring(labelIndex + label.length).trim();
      const endOfLine = afterLabel.indexOf('\n');
      if (endOfLine !== -1) {
        customerName = afterLabel.substring(0, endOfLine).trim();
      } else {
        customerName = afterLabel.trim();
      }
      // אם מצאנו משהו שנראה כמו שם, צא מהלולאה
      if (customerName && customerName.length > 2 && !/^\d+$/.test(customerName)) {
        break;
      }
    }
  }
  
  // ניסיון לזהות את סוג המסמך ולחלץ מידע רלוונטי
  let documentType = "לא ידוע";
  if (text.includes("חשבונית") || text.includes("חשבון") || text.includes("קבלה")) {
    documentType = "חשבונית/קבלה";
  } else if (text.includes("העברה") || text.includes("תשלום")) {
    documentType = "אישור העברה בנקאית";
  } else if (text.includes("תעודת זהות") || text.includes("ת.ז")) {
    documentType = "תעודת זהות";
  }
  
  // ניסיון לחלץ סכום
  let amount = 0;
  if (amounts.length > 0) {
    // חיפוש סכום שמתאים לפורמט כסף
    for (const amountStr of amounts) {
      const cleanAmount = amountStr.replace(/,/g, '');
      if (!isNaN(cleanAmount)) {
        amount = parseFloat(cleanAmount);
        if (amount > 0) {
          break;
        }
      }
    }
  }
  
  // ניסיון לחלץ תאריך
  let valueDate = '';
  if (dates.length > 0) {
    valueDate = dates[0]; // לוקח את התאריך הראשון שנמצא
  }
  
  // ניסיון לחלץ מספר אסמכתה
  let referenceNumber = '';
  const refRegex = /אסמכת[אה]: *(\d+)/i;
  const refMatch = text.match(refRegex);
  if (refMatch && refMatch[1]) {
    referenceNumber = refMatch[1];
  }
  
  // חיפוש שורה עם תיאור שירות או מטרת העברה
  let serviceDescription = 'חבילה מותאמת ניהול סושיאל';
  if (text.includes('מטרת העברה')) {
    const purposeIndex = text.indexOf('מטרת העברה');
    if (purposeIndex !== -1) {
      const afterPurpose = text.substring(purposeIndex + 'מטרת העברה'.length).trim();
      const endOfPurpose = afterPurpose.indexOf('\n');
      if (endOfPurpose !== -1) {
        const purpose = afterPurpose.substring(0, endOfPurpose).trim();
        if (purpose && purpose.length > 1) {
          serviceDescription = purpose;
        }
      }
    }
  }
  
  // החזרת תוצאה מובנית בעברית
  return {
    סוג_מסמך: documentType,
    טקסט_מחולץ: text,
    תאריך: valueDate,
    סכום: amount,
    מספר_אסמכתה: referenceNumber,
    שם_לקוח: customerName || 'רבקה ביטון', // שם ברירת מחדל אם לא נמצא
    תיאור_שירות: serviceDescription,
    הערה: "ניתוח בוצע באופן מקומי"
  };
}

// פונקציה לניתוח הטקסט באמצעות Claude API
async function analyzeWithClaude(text) {
  try {
    // בדיקה שיש מפתח API מוגדר
    if (!process.env.CLAUDE_API_KEY) {
      console.error('מפתח API של Claude לא מוגדר בקובץ .env');
      // במקרה שאין מפתח API, נחזיר ניתוח בסיסי ללא שימוש ב-API
      return analyzeTextLocally(text);
    }
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `אנא נתח את הטקסט הבא שהופק מתמונה והחזר לי תוצאה מובנית ב-JSON:
          
          ${text}
          
          הניתוח צריך להיות בעברית עם שדות בעברית. שים לב במיוחד לפרטים הבאים:
          סוג_מסמך: (סוג המסמך, כגון "אישור העברה בנקאית", "חשבונית/קבלה")
          תאריך: (תאריך העסקה, יום ערך, תאריך הנפקה)
          סכום: (הסכום בשקלים, כמספר ללא סימן מטבע)
          מספר_אסמכתה: (מספר אסמכתה או מספר חשבונית) 
          שם_לקוח: (שם הלקוח או שם החשבון המחויב)
          תיאור_שירות: (תיאור השירות או מטרת ההעברה)`
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    // חילוץ התוכן מתשובת ה-API
    if (response.data.content && response.data.content.length > 0) {
      try {
        // ניסיון לחלץ JSON מהתשובה
        const content = response.data.content[0].text;
        // חיפוש JSON בתוך התשובה - רבות מהתשובות מכילות הסברים סביב ה-JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          // וודא שיש שם לקוח, אחרת שים ערך ברירת מחדל
          if (!result.שם_לקוח) {
            result.שם_לקוח = 'רבקה ביטון';
          }
          
          // וודא שיש תיאור שירות, אחרת שים ערך ברירת מחדל
          if (!result.תיאור_שירות) {
            result.תיאור_שירות = 'חבילה מותאמת ניהול סושיאל';
          }
          
          return result;
        }
        return { שגיאה: "לא ניתן לחלץ JSON מתשובת Claude", תוכן_גולמי: content };
      } catch (parseError) {
        console.error('שגיאה בפענוח JSON מתשובת Claude:', parseError);
        return { שגיאה: "שגיאה בפענוח JSON", הודעה: parseError.message };
      }
    } else {
      return { שגיאה: "אין תוכן בתשובה מ-Claude" };
    }
  } catch (error) {
    console.error('שגיאה בניתוח עם Claude:', error);
    
    // במקרה של שגיאה, ננסה לנתח מקומית
    return analyzeTextLocally(text);
  }
}

// יצירת קבצי PDF ו-HTML מהתוצאות
async function createPDFFromResults(results, imagePath) {
  // יצירת HTML במקביל ל-PDF
  const htmlFilename = generateInvoiceHTML(results);
  
  // בדיקה אם מדובר בהעברה בנקאית או חשבונית
  if (results.סוג_מסמך === "אישור העברה בנקאית" || 
      (results.מספר_אסמכתה && results.שם_לקוח)) {
    // שימוש בפונקציה החדשה ליצירת חשבונית/קבלה
    const pdfPath = await createInvoicePDF(results, imagePath);
    return {
      pdfPath,
      htmlFilename
    };
  }
  
  // אחרת, יצירת PDF רגיל של ניתוח כרגיל
  // וודא שתיקיית PDF קיימת
  if (!fs.existsSync('pdfs')) {
    fs.mkdirSync('pdfs');
  }

  const pdfPath = `pdfs/analysis-${Date.now()}.pdf`;
  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream(pdfPath);
  
  doc.pipe(writeStream);
  
  // כותרת
  doc.fontSize(25).text('ניתוח תמונה', { align: 'right' });
  doc.moveDown();
  
  // הוספת התמונה המקורית
  doc.image(imagePath, {
    fit: [500, 300],
    align: 'center'
  });
  doc.moveDown();
  
  // הוספת תוצאות הניתוח
  doc.fontSize(14).text('תוצאות הניתוח:', { align: 'right' });
  doc.moveDown();
  
  // הוספת הנתונים המובנים
  Object.entries(results).forEach(([key, value]) => {
    doc.fontSize(12).text(`${key}: ${value}`, { align: 'right' });
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve({
      pdfPath,
      htmlFilename
    }));
    writeStream.on('error', reject);
  });
}

// פונקציה ליצירת חשבונית HTML
function generateInvoiceHTML(extractedData) {
  // יצירת שם קובץ ייחודי
  const timestamp = Date.now();
  const invoiceNumber = extractedData.מספר_אסמכתה || Math.floor(Math.random() * 90000) + 10000;
  const filename = `invoice-${invoiceNumber}-${timestamp}.html`;
  
  // הכנת הנתונים לתצוגה
  const invoiceDate = extractedData.תאריך || new Date().toLocaleDateString('he-IL');
  const customerName = extractedData.שם_לקוח || 'רבקה ביטון';
  const serviceDescription = extractedData.תיאור_שירות || 'חבילה מותאמת ניהול סושיאל';
  const amount = typeof extractedData.סכום === 'number' 
    ? extractedData.סכום.toLocaleString() 
    : (extractedData.סכום || '1,200');
  
  // יצירת תוכן ה-HTML
  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>חשבונית/קבלה ${invoiceNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;700&display=swap');
        
        body {
            font-family: 'Rubik', Arial, sans-serif;
            margin: 0;
            padding: 0;
            direction: rtl;
            box-sizing: border-box;
            background-color: #f9f9f9;
        }
        
        .invoice-container {
            max-width: 800px;
            margin: 20px auto;
            padding: 40px;
            background-color: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .logo-placeholder {
            width: 150px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #777;
            font-size: 14px;
        }
        
        .title {
            font-size: 28px;
            font-weight: bold;
            text-align: center;
            margin-top: 10px;
            margin-bottom: 20px;
        }
        
        .contact-info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #555;
            margin-bottom: 20px;
        }
        
        .divider {
            height: 1px;
            background-color: #ddd;
            margin: 20px 0;
        }
        
        .invoice-header {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            margin-bottom: 20px;
        }
        
        .invoice-header .invoice-number {
            font-size: 18px;
            font-weight: bold;
            color: #2a5885;
        }
        
        .customer-info {
            margin-top: 30px;
            margin-bottom: 30px;
        }
        
        .customer-info h3 {
            margin-bottom: 5px;
            font-weight: normal;
        }
        
        .customer-name {
            font-size: 18px;
            font-weight: bold;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        th {
            text-align: right;
            padding: 10px 5px;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
        }
        
        td {
            padding: 15px 5px;
            border-bottom: 1px solid #ddd;
        }
        
        .amount-column {
            text-align: left;
        }
        
        .total-row td {
            font-size: 18px;
            font-weight: bold;
            padding-top: 20px;
        }
        
        .payment-methods {
            margin-top: 30px;
        }
        
        .payment-methods h3 {
            margin-bottom: 10px;
            font-weight: bold;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
        }
        
        .payment-method-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
        }
        
        .digital-signature {
            color: #2a5885;
            margin-top: 5px;
            font-size: 12px;
        }
        
        /* כפתור הדפסה */
        .print-button {
            display: block;
            margin: 20px auto;
            padding: 10px 20px;
            background-color: #2a5885;
            color: white;
            border: none;
            border-radius: 4px;
            font-family: 'Rubik', Arial, sans-serif;
            font-size: 16px;
            cursor: pointer;
        }
        
        .print-button:hover {
            background-color: #1e3f60;
        }
        
        /* עיצוב ההדפסה */
        @media print {
            body {
                background-color: white;
            }
            
            .invoice-container {
                box-shadow: none;
                padding: 0;
                margin: 0;
            }
            
            .print-button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="logo-placeholder">SHIRA LIBERMAN</div>
            <h1 class="title">Shira Liberman social media</h1>
        </div>
        
        <div class="contact-info">
            <div>shira.socialmedia55@gmail.com</div>
            <div>עוסק פטור: 212535025</div>
            <div>צבעוני 5/24 אשדוד</div>
            <div>0534779823</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="invoice-header">
            <div class="invoice-number">חשבון/קבלה ${invoiceNumber}</div>
            <div class="date">${invoiceDate}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="customer-info">
            <h3>לכבוד:</h3>
            <div class="customer-name">${customerName}</div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>מוצר/שירות</th>
                    <th class="amount-column">סה"כ</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${serviceDescription}</td>
                    <td class="amount-column">${amount} ₪</td>
                </tr>
                <tr class="total-row">
                    <td>סה"כ</td>
                    <td class="amount-column">${amount} ₪</td>
                </tr>
            </tbody>
        </table>
        
        <div class="payment-methods">
            <h3>אמצעי תשלום</h3>
            <div class="payment-method-row">
                <div>כללי</div>
                <div>${amount} ₪</div>
           </div>
        </div>
        
        <div class="digital-signature">
            <p>חשבונית דיגיטלית</p>
        </div>
    </div>
    
    <button class="print-button" onclick="window.print()">הדפס חשבונית</button>
</body>
</html>`;

  // וודא שתיקיית public קיימת
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }
  
  // שמירת הקובץ
  const filePath = path.join('public', filename);
  fs.writeFileSync(filePath, htmlContent);
  
  return filename;
}

// פונקציה ליצירת חשבונית PDF מהנתונים שחולצו
async function createInvoicePDF(extractedData, imagePath = null) {
  // וודא שתיקיית PDF קיימת
  if (!fs.existsSync('pdfs')) {
    fs.mkdirSync('pdfs');
  }

  const pdfPath = `pdfs/invoice-${Date.now()}.pdf`;
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: 'חשבונית/קבלה',
      Author: 'מערכת סריקת מסמכים',
    }
  });
  
  // הגדרת כיוון הכתיבה מימין לשמאל
  doc.font('Helvetica');
  doc.text('', 0, 0); // טריק להגדרת כיוון הכתיבה
  
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);
  
  // מספר חשבונית
  const invoiceNumber = extractedData.מספר_אסמכתה || Math.floor(Math.random() * 90000) + 10000;
  
  // תאריך
  let invoiceDate = extractedData.תאריך || new Date().toLocaleDateString('he-IL');
  if (invoiceDate.length <= 8) { // אם התאריך בפורמט קצר כמו 09/03/25
    // הוסף 20 לשנה אם היא דו-ספרתית
    const parts = invoiceDate.split('/');
    if (parts.length === 3 && parts[2].length === 2) {
      parts[2] = '20' + parts[2];
      invoiceDate = parts.join('/');
    }
  }
  
  // שם הספק
  const supplierName = 'Shira Liberman social media';
  const supplierEmail = 'shira.socialmedia55@gmail.com';
  const supplierPhone = '0534779823';
  const supplierAddress = 'צבעוני 5/24 אשדוד';
  const supplierTaxId = '212535025';
  
  // שם הלקוח
  const customerName = extractedData.שם_לקוח || 'רבקה ביטון';
  
  // סכום
  const amount = typeof extractedData.סכום === 'number' 
    ? extractedData.סכום 
    : (parseFloat(String(extractedData.סכום).replace(/,/g, '')) || 1200);
  
  // תיאור השירות
  const serviceDescription = extractedData.תיאור_שירות || 'חבילה מותאמת ניהול סושיאל';
  
  // ------ יצירת המסמך ------
  
  // לוגו וכותרת
  doc.fontSize(24).text(supplierName, { align: 'center' });
  
  // פרטי עסק
  doc.moveDown(0.5);
  doc.fontSize(10);
  let y = doc.y;
  doc.text(supplierEmail, 300, y, { align: 'left' });
  doc.text('עוסק פטור: ' + supplierTaxId, 150, y, { align: 'right' });
  
  y += 20;
  doc.text(supplierAddress, 300, y, { align: 'left' });
  doc.text(supplierPhone, 150, y, { align: 'right' });
  
  // קו הפרדה
  y += 40;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // כותרת חשבונית
  y += 20;
  doc.fontSize(16).text('חשבון/קבלה ' + invoiceNumber, 400, y, { align: 'right' });
  doc.text(invoiceDate, 150, y, { align: 'left' });
  
  // קו הפרדה
  y += 30;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // פרטי לקוח
  y += 20;
  doc.fontSize(12).text('לכבוד:', 500, y, { align: 'right' });
  doc.fontSize(14).text(customerName, 400, y + 20, { align: 'right' });
  
  // טבלת שירותים
  y += 60;
  // כותרות
  doc.fontSize(12);
  doc.text('מוצר/שירות', 500, y, { align: 'right' });
  doc.text('סה"כ', 100, y, { align: 'right' });
  
  // קו הפרדה
  y += 20;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // שירות
  y += 20;
  doc.text(serviceDescription, 500, y, { align: 'right' });
  doc.text(amount.toLocaleString() + ' ₪', 100, y, { align: 'right' });
  
  // קו הפרדה
  y += 30;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // סיכום
  y += 20;
  doc.fontSize(14);
  doc.text('סה"כ', 500, y, { align: 'right' });
  doc.text(amount.toLocaleString() + ' ₪', 100, y, { align: 'right' });
  
  // קו הפרדה
  y += 30;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // אמצעי תשלום
  y += 20;
  doc.fontSize(12);
  doc.text('אמצעי תשלום', 500, y, { align: 'right' });
  
  // קו הפרדה
  y += 20;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  
  // פרטי תשלום
  y += 20;
  doc.text('כללי', 500, y, { align: 'right' });
  doc.text(amount.toLocaleString() + ' ₪', 100, y, { align: 'right' });
  
  // הוספת התמונה המקורית כנספח אם קיימת
  if (imagePath && fs.existsSync(imagePath)) {
    doc.addPage();
    doc.fontSize(16).text('נספח - תמונת המסמך המקורי', { align: 'center' });
    doc.moveDown();
    
    try {
      // גודל דף למקסימום כמעט
      const pageWidth = doc.page.width - 100;
      const pageHeight = doc.page.height - 150;
      
      doc.image(imagePath, {
        fit: [pageWidth, pageHeight],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      console.error('שגיאה בהוספת התמונה לקובץ PDF:', error);
      doc.text('לא ניתן היה להוסיף את התמונה המקורית', { align: 'center' });
    }
  }
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(pdfPath));
    writeStream.on('error', reject);
  });
}

// יצירת תיקיות נדרשות אם הן לא קיימות
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('pdfs')) {
  fs.mkdirSync('pdfs');
}
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// הוספת דף בדיקה פשוט
const testHtmlPath = path.join('public', 'test.html');
if (!fs.existsSync(testHtmlPath)) {
  const testHtml = `<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>בדיקת מערכת סריקת תמונות</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            direction: rtl;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, button {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
            margin-top: 10px;
        }
        button:hover {
            background-color: #45a049;
        }
        .tab {
            overflow: hidden;
            border: 1px solid #ccc;
            background-color: #f1f1f1;
            border-radius: 4px 4px 0 0;
        }
        .tab button {
            background-color: inherit;
            float: right;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 14px 16px;
            transition: 0.3s;
            width: auto;
            margin: 0;
        }
        .tab button:hover {
            background-color: #ddd;
        }
        .tab button.active {
            background-color: white;
            border-bottom: 2px solid #4CAF50;
        }
        .tabcontent {
            display: none;
            padding: 20px;
            border: 1px solid #ccc;
            border-top: none;
            border-radius: 0 0 4px 4px;
        }
        #result {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 4px;
            display: none;
        }
        pre {
            white-space: pre-wrap;
            overflow-x: auto;
            background-color: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>בדיקת מערכת סריקת תמונות</h1>
        
        <div class="tab">
            <button class="tablinks active" onclick="openTab(event, 'FileUpload')">העלאת קובץ</button>
            <button class="tablinks" onclick="openTab(event, 'UrlUpload')">העלאה מ-URL</button>
        </div>
        
        <div id="FileUpload" class="tabcontent" style="display: block;">
            <form id="file-form">
                <div class="form-group">
                    <label for="image">בחר תמונה להעלאה:</label>
                    <input type="file" id="image" name="image" accept="image/*" required>
                </div>
                <button type="submit">סרוק תמונה</button>
            </form>
        </div>
        
        <div id="UrlUpload" class="tabcontent">
            <form id="url-form">
                <div class="form-group">
                    <label for="imageUrl">הזן כתובת URL של תמונה:</label>
                    <input type="url" id="imageUrl" name="imageUrl" placeholder="https://example.com/image.jpg" required>
                </div>
                <button type="submit">סרוק תמונה מ-URL</button>
            </form>
        </div>
        
        <div id="result">
            <h2>תוצאות:</h2>
            <pre id="json-result"></pre>
            <div id="links-result"></div>
        </div>
    </div>
    
    <script>
        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }
        
        document.getElementById('file-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            var fileInput = document.getElementById('image');
            var file = fileInput.files[0];
            
            if (!file) {
                alert('אנא בחר קובץ תמונה');
                return;
            }
            
            var formData = new FormData();
            formData.append('image', file);
            
            fetch('/api/scan-image', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => displayResult(data))
            .catch(error => {
                console.error('שגיאה:', error);
                alert('אירעה שגיאה בעיבוד התמונה');
            });
        });
        
        document.getElementById('url-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            var urlInput = document.getElementById('imageUrl');
            var url = urlInput.value;
            
            if (!url) {
                alert('אנא הזן כתובת URL תקינה');
                return;
            }
            
            fetch('/api/scan-image-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageUrl: url })
            })
            .then(response => response.json())
            .then(data => displayResult(data))
            .catch(error => {
                console.error('שגיאה:', error);
                alert('אירעה שגיאה בעיבוד התמונה מה-URL');
            });
        });
        
        function displayResult(data) {
            document.getElementById('result').style.display = 'block';
            document.getElementById('json-result').textContent = JSON.stringify(data, null, 2);
            
            var linksHtml = '';
            if (data.htmlUrl) {
                linksHtml += \`<p><a href="\${data.htmlUrl}" target="_blank">פתח חשבונית HTML</a></p>\`;
            }
            if (data.pdfUrl) {
                linksHtml += \`<p><a href="\${data.pdfUrl}" target="_blank">הורד קובץ PDF</a></p>\`;
            }
            
            document.getElementById('links-result').innerHTML = linksHtml;
        }
    </script>
</body>
</html>`;
  
  fs.writeFileSync(testHtmlPath, testHtml);
}

app.listen(port, () => {
  console.log(`השרת פועל בפורט ${port}`);
  console.log(`פתח את http://localhost:${port}/test.html בדפדפן לבדיקת המערכת`);
});