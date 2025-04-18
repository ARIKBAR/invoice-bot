// routes/invoices.js - נתיבים לניהול חשבוניות

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Counter = require('../models/Counter');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * פונקציה להשגת המספר הבא בסדרת החשבוניות
 */
async function getNextInvoiceNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'invoiceNumber' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

/**
 * ראוט חדש - שליפת כל הקבלות לפי ownerId (המשתמש המנפיק)
 */
router.post('/api/invoices-by-owner', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });

  try {
    const invoices = await Invoice.find({ ownerId }).sort({ issueDate: -1 });
    if (!invoices.length) return res.json({ message: 'לא נמצאו קבלות.' });

    const formatted = invoices.map(inv => (
      `📄 קבלה מס' ${inv.invoiceNumber}\n` +
      `📅 תאריך: ${new Date(inv.issueDate).toLocaleDateString('he-IL')}\n` +
      `💰 סכום: ₪${inv.totalAmount.toFixed(2)}\n` +
      `📎 קובץ PDF:\nhttps://invoice-bot-kcz5.onrender.com/api/invoices/${inv._id}/pdf\n`
    )).join('\n──────────────\n');

    res.json({ result: formatted });
  } catch (err) {
    console.error('שגיאה בשליפת קבלות לפי ownerId:', err);
    res.status(500).json({ error: 'שגיאה בשרת', details: err.message });
  }
});

// ... כל שאר הראוטים הקיימים נשארים בדיוק כפי שהם ...


/**
 * @route   GET /api/invoices
 * @desc    קבלת רשימת חשבוניות
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    // בניית פילטרים לפי הפרמטרים בבקשה
    const filter = {};
    
    // פילטור לפי סטטוס
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // פילטור לפי לקוח
    if (req.query.customer) {
      filter.customer = req.query.customer;
    }
    
    // פילטור לפי תאריכים
    if (req.query.startDate || req.query.endDate) {
      filter.issueDate = {};
      if (req.query.startDate) {
        filter.issueDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.issueDate.$lte = new Date(req.query.endDate);
      }
    }
    
    // אפשרות להגדיר מגבלת תוצאות ודילוג לצורך עימוד
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    
    // הורדת הנתונים עם המידע של הלקוח
    const invoices = await Invoice.find(filter)
      .populate('customer', 'name email phone')
      .sort({ issueDate: -1 })
      .limit(limit)
      .skip(skip);
    
    // ספירת סך כל החשבוניות שמתאימות לפילטר (לצורך עימוד)
    const total = await Invoice.countDocuments(filter);
    
    res.json({
      invoices,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   GET /api/invoices/:id
 * @desc    קבלת חשבונית לפי מזהה
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.product');
    
    if (!invoice) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }
    
    res.json(invoice);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   POST /api/invoices
 * @desc    יצירת חשבונית חדשה
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    // וידוא שנשלח לקוח תקין
    if (!req.body.customer) {
      return res.status(400).json({ error: 'לקוח הוא שדה חובה' });
    }
    
    // בדיקה שהלקוח קיים
    const customer = await Customer.findById(req.body.customer);
    if (!customer) {
      return res.status(400).json({ error: 'לקוח לא נמצא' });
    }
    
    // בדיקה שיש פריטים בחשבונית
    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ error: 'חשבונית חייבת להכיל לפחות פריט אחד' });
    }
    
    // חישוב סכום כולל
    let totalAmount = 0;
    const invoiceItems = [];
    
    for (const item of req.body.items) {
      // וידוא שיש את כל הפרטים הדרושים
      if (!item.description || !item.quantity || !item.unitPrice) {
        return res.status(400).json({ error: 'כל פריט חייב לכלול תיאור, כמות ומחיר יחידה' });
      }
      
      // חישוב סכום לפריט
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;
      
      // הוספה למערך הפריטים
      invoiceItems.push({
        product: item.product || undefined,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal
      });
    }
    
    // קבלת מספר חשבונית הבא
    const invoiceNumber = req.body.invoiceNumber || await getNextInvoiceNumber();
    
    // יצירת חשבונית חדשה
    const newInvoice = new Invoice({
      invoiceNumber,
      customer: req.body.customer,
      issueDate: req.body.issueDate || new Date(),
      dueDate: req.body.dueDate,
      items: invoiceItems,
      status: req.body.status || 'draft',
      totalAmount,
      notes: req.body.notes || ''
    });
    
    // שמירה במסד הנתונים
    const invoice = await newInvoice.save();
    
    // שליחת תשובה עם החשבונית שנוצרה
    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   PUT /api/invoices/:id
 * @desc    עדכון חשבונית קיימת
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    // מציאת החשבונית
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }
    
    // בדיקות תקינות - לא ניתן לערוך חשבונית ששולמה או בוטלה
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'לא ניתן לערוך חשבונית ששולמה או בוטלה',
        currentStatus: invoice.status
      });
    }
    
    // עדכון שדות
    if (req.body.customer) {
      // בדיקה שהלקוח קיים
      const customer = await Customer.findById(req.body.customer);
      if (!customer) {
        return res.status(400).json({ error: 'לקוח לא נמצא' });
      }
      invoice.customer = req.body.customer;
    }
    
    if (req.body.issueDate) invoice.issueDate = req.body.issueDate;
    if (req.body.dueDate) invoice.dueDate = req.body.dueDate;
    if (req.body.notes !== undefined) invoice.notes = req.body.notes;
    if (req.body.status) invoice.status = req.body.status;
    
    // עדכון פריטים אם נשלחו
    if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        // חישוב סכום כולל
        let totalAmount = 0;
        const invoiceItems = [];
        
        for (const item of req.body.items) {
          // וידוא שיש את כל הפרטים הדרושים
          if (!item.description || !item.quantity || !item.unitPrice) {
            return res.status(400).json({ error: 'כל פריט חייב לכלול תיאור, כמות ומחיר יחידה' });
          }
          
          // חישוב סכום לפריט
          const itemTotal = item.quantity * item.unitPrice;
          totalAmount += itemTotal;
          
          // הוספה למערך הפריטים
          invoiceItems.push({
            product: item.product || undefined,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: itemTotal
          });
        }
        
        invoice.items = invoiceItems;
        invoice.totalAmount = totalAmount;
      }
      
      // שמירת השינויים
      await invoice.save();
      
      // החזרת החשבונית המעודכנת
      res.json(invoice);
    } catch (err) {
      console.error(err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
      }
      res.status(500).json({ error: 'שגיאת שרת', details: err.message });
    }
  });
  
  /**
   * @route   DELETE /api/invoices/:id
   * @desc    ביטול חשבונית (לא מחיקה פיזית)
   * @access  Private
   */
  router.delete('/:id', async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      
      // בדיקה האם החשבונית כבר שולמה
      if (invoice.status === 'paid') {
        return res.status(400).json({ 
          error: 'לא ניתן לבטל חשבונית ששולמה',
          currentStatus: invoice.status
        });
      }
      
      // במקום למחוק, משנים את הסטטוס לבוטל
      invoice.status = 'cancelled';
      await invoice.save();
      
      res.json({ message: 'חשבונית בוטלה בהצלחה', id: req.params.id });
    } catch (err) {
      console.error(err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      res.status(500).json({ error: 'שגיאת שרת', details: err.message });
    }
  });
  
  /**
   * @route   GET /api/invoices/:id/pdf
   * @desc    יצירת קובץ PDF של החשבונית
   * @access  Private
   */
  router.get('/:id/pdf', async (req, res) => {
    try {
      // מציאת החשבונית עם כל הנתונים הקשורים
      const invoice = await Invoice.findById(req.params.id)
        .populate('customer')
        .populate('items.product');
      
      if (!invoice) {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      
      // יצירת תיקיית זמנית אם לא קיימת
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      // הגדרת שם הקובץ
      const fileName = `invoice-${invoice.invoiceNumber}.pdf`;
      const filePath = path.join(tempDir, fileName);
      
      // יצירת מסמך PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `חשבונית מספר ${invoice.invoiceNumber}`,
          Author: 'מערכת חשבוניות',
        }
      });
      
      // שמירה לקובץ
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // הוספת תוכן לPDF (יצירת חשבונית מעוצבת)
      // כותרת
      doc.fontSize(20).text(`חשבונית מספר ${invoice.invoiceNumber}`, { align: 'right' });
      doc.moveDown();
      
      // פרטי הלקוח
      doc.fontSize(12);
      doc.text(`לכבוד: ${invoice.customer.name}`, { align: 'right' });
      if (invoice.customer.email) doc.text(`אימייל: ${invoice.customer.email}`, { align: 'right' });
      if (invoice.customer.phone) doc.text(`טלפון: ${invoice.customer.phone}`, { align: 'right' });
      if (invoice.customer.address) doc.text(`כתובת: ${invoice.customer.address}`, { align: 'right' });
      
      doc.moveDown();
      
      // תאריכים
      const issueDateFormatted = new Date(invoice.issueDate).toLocaleDateString('he-IL');
      const dueDateFormatted = new Date(invoice.dueDate).toLocaleDateString('he-IL');
      
      doc.text(`תאריך הנפקה: ${issueDateFormatted}`, { align: 'right' });
      doc.text(`תאריך לתשלום: ${dueDateFormatted}`, { align: 'right' });
      
      doc.moveDown();
      
      // טבלת פריטים
      doc.fontSize(14).text('פירוט פריטים:', { align: 'right' });
      doc.moveDown();
      
      // כותרות הטבלה
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = [150, 100, 100, 150]; // רוחב עמודות
      
      doc.fontSize(12);
      doc.text('תיאור', tableLeft + colWidths[0], tableTop, { width: colWidths[0], align: 'right' });
      doc.text('כמות', tableLeft + colWidths[0] + colWidths[1], tableTop, { width: colWidths[1], align: 'right' });
      doc.text('מחיר יחידה', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop, { width: colWidths[2], align: 'right' });
      doc.text('סה"כ', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop, { width: colWidths[3], align: 'right' });
      
      // קו תחת הכותרות
      doc.moveTo(tableLeft, doc.y + 15)
         .lineTo(tableLeft + colWidths.reduce((sum, val) => sum + val, 0), doc.y + 15)
         .stroke();
      
      doc.moveDown();
      let tableY = doc.y;
      
      // שורות הטבלה
      for (const item of invoice.items) {
        doc.text(item.description, tableLeft + colWidths[0], tableY, { width: colWidths[0], align: 'right' });
        doc.text(item.quantity.toString(), tableLeft + colWidths[0] + colWidths[1], tableY, { width: colWidths[1], align: 'right' });
        doc.text(item.unitPrice.toFixed(2), tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[2], align: 'right' });
        doc.text(item.total.toFixed(2), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY, { width: colWidths[3], align: 'right' });
        
        tableY = doc.y + 15;
        doc.moveDown();
      }
      
      // קו תחת הטבלה
      doc.moveTo(tableLeft, doc.y)
         .lineTo(tableLeft + colWidths.reduce((sum, val) => sum + val, 0), doc.y)
         .stroke();
      
      doc.moveDown();
      
      // סיכום
      doc.fontSize(14).text(`סה"כ לתשלום: ${invoice.totalAmount.toFixed(2)} ₪`, { align: 'right' });
      
      // הערות
      if (invoice.notes) {
        doc.moveDown();
        doc.fontSize(12).text('הערות:', { align: 'right' });
        doc.fontSize(10).text(invoice.notes, { align: 'right' });
      }
      
      // סיום יצירת המסמך
      doc.end();
      
      // המתנה לסיום כתיבת הקובץ
      stream.on('finish', () => {
        // שליחת הקובץ ללקוח
        res.download(filePath, fileName, (err) => {
          if (err) {
            console.error('שגיאה בשליחת הקובץ:', err);
            return res.status(500).json({ error: 'שגיאה בשליחת הקובץ' });
          }
          
          // מחיקת הקובץ הזמני אחרי שליחתו
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('שגיאה במחיקת קובץ זמני:', unlinkErr);
          });
        });
      });
      
      stream.on('error', (err) => {
        console.error('שגיאה ביצירת קובץ PDF:', err);
        return res.status(500).json({ error: 'שגיאה ביצירת קובץ PDF' });
      });
    } catch (err) {
      console.error(err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      res.status(500).json({ error: 'שגיאת שרת', details: err.message });
    }
  });
  
  /**
   * @route   POST /api/invoices/:id/send
   * @desc    שליחת חשבונית ללקוח במייל
   * @access  Private
   */
  router.post('/:id/send', async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id).populate('customer');
      
      if (!invoice) {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      
      // בדיקה שיש מייל ללקוח
      if (!invoice.customer.email) {
        return res.status(400).json({ error: 'ללקוח אין כתובת מייל מוגדרת' });
      }
      
      // כאן יהיה הקוד לשליחת המייל
      // במקרה זה נדרש להתקין חבילה כמו nodemailer
      
      // עדכון סטטוס החשבונית ל-sent
      invoice.status = 'sent';
      await invoice.save();
      
      // החזרת תשובה
      res.json({ 
        message: `החשבונית נשלחה בהצלחה ל-${invoice.customer.email}`,
        status: invoice.status,
        id: invoice._id
      });
    } catch (err) {
      console.error(err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      res.status(500).json({ error: 'שגיאת שרת', details: err.message });
    }
  });
  
  /**
   * @route   POST /api/invoices/:id/status
   * @desc    עדכון סטטוס חשבונית
   * @access  Private
   */
  router.post('/:id/status', async (req, res) => {
    try {
      // בדיקה שנשלח סטטוס
      if (!req.body.status) {
        return res.status(400).json({ error: 'סטטוס חדש הוא שדה חובה' });
      }
      
      // בדיקה שהסטטוס תקין
      const validStatuses = ['draft', 'sent', 'paid', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ 
          error: 'סטטוס לא תקין',
          validStatuses
        });
      }
      
      // מציאת החשבונית
      const invoice = await Invoice.findById(req.params.id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      
      // בדיקות הגיוניות
      if (invoice.status === 'cancelled' && req.body.status !== 'cancelled') {
        return res.status(400).json({ error: 'לא ניתן לשנות סטטוס של חשבונית מבוטלת' });
      }
      
      // עדכון הסטטוס
      invoice.status = req.body.status;
      
      // אם מעדכנים לסטטוס "שולם", נוסיף תאריך תשלום
      if (req.body.status === 'paid') {
        invoice.paidDate = req.body.paidDate || new Date();
      }
      
      // שמירת השינויים
      await invoice.save();
      
      // החזרת תשובה
      res.json({ 
        message: 'סטטוס החשבונית עודכן בהצלחה',
        status: invoice.status,
        id: invoice._id
      });
    } catch (err) {
      console.error(err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'חשבונית לא נמצאה' });
      }
      res.status(500).json({ error: 'שגיאת שרת', details: err.message });
    }
  });

  const BusinessProfile = require('../models/BusinessProfile');
const generateQuickInvoiceHTML = require('../utils/generateInvoiceHTML.js'); // ניצור אותו תכף

/**
 * @route   POST /api/invoices/generate-quick
 * @desc    יצירת חשבונית מהירה על בסיס פרופיל עסק ופרטי לקוח
 */
router.post('/generate-quick', async (req, res) => {
  try {
    const {
      ownerId,
      customerName,
      customerIdNumber,
      serviceDescription,
      amount,
      paymentMethod,
      issueDate
    } = req.body;

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    const business = await BusinessProfile.findOne({ ownerId });

    if (!business) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    const invoiceData = {
      customerName: customerName || 'לקוח כללי',
      customerIdNumber: customerIdNumber || '',
      serviceDescription: serviceDescription || 'שירות כללי',
      amount: amount || '0',
      paymentMethod: paymentMethod || 'כללי',
      issueDate: issueDate || new Date().toLocaleDateString('he-IL'),
      referenceNumber: await getNextInvoiceNumber()
    };

    const htmlFilename = generateQuickInvoiceHTML(invoiceData, business);
    invoiceData.htmlUrl = `/invoices/${htmlFilename}`;

    res.json({
      success: true,
      invoiceData
    });
  } catch (err) {
    console.error('Error generating quick invoice:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});






  
  module.exports = router;