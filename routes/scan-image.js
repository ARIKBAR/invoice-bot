// routes/scan-image.js - אנדפוינט לסריקת תמונות והפיכתן לחשבוניות

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const axios = require('axios');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Counter = require('../models/Counter');

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

// פונקציה לחילוץ טקסט מתמונה באמצעות Tesseract OCR
async function extractTextFromImage(imagePath) {
  const worker = await createWorker('heb+eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();
  return data.text;
}

// פונקציה לניתוח טקסט באמצעות Claude API או ניתוח מקומי
async function analyzeText(text) {
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
        const content = response.data.content[0].text;
        // חיפוש JSON בתוך התשובה
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          // וודא שיש שם לקוח, אחרת שים ערך ברירת מחדל
          if (!result.שם_לקוח) {
            result.שם_לקוח = 'לקוח כללי';
          }
          
          // וודא שיש תיאור שירות, אחרת שים ערך ברירת מחדל
          if (!result.תיאור_שירות) {
            result.תיאור_שירות = 'שירותים מקצועיים';
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
let serviceDescription = 'שירותים מקצועיים';
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
  שם_לקוח: customerName || 'לקוח כללי', // שם ברירת מחדל אם לא נמצא
  תיאור_שירות: serviceDescription,
  הערה: "ניתוח בוצע באופן מקומי"
};
}

// פונקציה לפתיחת או יצירת לקוח לפי שם
async function findOrCreateCustomer(customerName) {
// חיפוש לקוח קיים לפי שם
let customer = await Customer.findOne({ name: customerName });

// אם לא נמצא לקוח, נוצר אחד חדש
if (!customer) {
  customer = new Customer({
    name: customerName
  });
  await customer.save();
}

return customer;
}

// פונקציה להשגת המספר הבא בסדרת החשבוניות
async function getNextInvoiceNumber() {
const counter = await Counter.findOneAndUpdate(
  { type: 'invoice' },
  { $inc: { sequenceValue: 1 } },
  { new: true, upsert: true }
);

return counter.sequenceValue.toString();
}

// פונקציה ליצירת חשבונית מהנתונים שחולצו
async function createInvoiceFromExtractedData(extractedData) {
try {
  // מציאת או יצירת לקוח
  const customer = await findOrCreateCustomer(extractedData.שם_לקוח);
  
  // קבלת מספר חשבונית הבא
  const invoiceNumber = extractedData.מספר_אסמכתה || await getNextInvoiceNumber();
  
  // יצירת פריט לחשבונית
  const invoiceItem = {
    description: extractedData.תיאור_שירות,
    quantity: 1,
    unitPrice: extractedData.סכום,
    total: extractedData.סכום
  };
  
  // יצירת חשבונית חדשה
  const newInvoice = new Invoice({
    invoiceNumber,
    customer: customer._id,
    issueDate: extractedData.תאריך ? new Date(extractedData.תאריך) : new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // ברירת מחדל: 30 יום מהיום
    items: [invoiceItem],
    status: 'draft',
    totalAmount: extractedData.סכום,
    notes: `חשבונית שנוצרה אוטומטית מתמונה סרוקה. סוג מסמך מקור: ${extractedData.סוג_מסמך}`
  });
  
  // שמירה במסד הנתונים
  const savedInvoice = await newInvoice.save();
  
  return savedInvoice;
} catch (error) {
  console.error('שגיאה ביצירת חשבונית:', error);
  throw error;
}
}

/**
* @route   POST /api/scan-image
* @desc    העלאת תמונה, חילוץ טקסט, ויצירת חשבונית
* @access  Private
*/
router.post('/', upload.single('image'), async (req, res) => {
try {
  if (!req.file) {
    return res.status(400).json({ error: 'אין תמונה בבקשה' });
  }

  // חילוץ טקסט מהתמונה
  const extractedText = await extractTextFromImage(req.file.path);
  
  // ניתוח הטקסט
  const analysisResult = await analyzeText(extractedText);
  
  // יצירת חשבונית מהנתונים שחולצו
  const invoice = await createInvoiceFromExtractedData(analysisResult);
  
  // החזרת תשובה
  res.status(201).json({
    success: true,
    extractedText,
    analysis: analysisResult,
    invoice: {
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customer: invoice.customer,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      viewUrl: `/api/invoices/${invoice._id}`,
      pdfUrl: `/api/invoices/${invoice._id}/pdf`
    }
  });
} catch (error) {
  console.error('שגיאה בעיבוד התמונה:', error);
  res.status(500).json({ error: 'שגיאה בעיבוד התמונה', details: error.message });
}
});

module.exports = router;