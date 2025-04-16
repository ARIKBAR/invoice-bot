// server.js - קובץ השרת המרכזי

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const fs = require('fs');
const path = require('path');
const generateInvoiceHTML = require('./utils/generateInvoiceHTML.js');
const BusinessProfile = require('./models/BusinessProfile');
const Invoice = require('./models/Invoice');

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
app.use('/invoices', express.static(path.join(__dirname, 'public/invoices')));

// הגדרת נתיבים
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/business-profile', require('./routes/business'));
app.use(require('./routes/invoices-by-owner'));
app.use('/api/scan-image', require('./routes/scan-image'));

// מסלול ליצירת חשבונית מנתונים ידניים
app.post('/api/generate-invoice', async (req, res) => {
  try {
    const {
      ownerId,
      customerName,
      customerIdNumber,
      serviceDescription,
      amount,
      paymentMethod,
      valueDate
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
      issueDate: valueDate || new Date().toLocaleDateString('he-IL'),
      referenceNumber: Math.floor(Math.random() * 90000) + 10000
    };

    const filename = generateInvoiceHTML(invoiceData, business);
    const htmlUrl = `/invoices/${filename}`;

    // שמירת הקבלה במסד הנתונים
    const newInvoice = new Invoice({
      invoiceNumber: invoiceData.referenceNumber,
      issueDate: new Date(),
      items: [{
        description: invoiceData.serviceDescription,
        quantity: 1,
        unitPrice: invoiceData.amount,
        total: invoiceData.amount
      }],
      totalAmount: invoiceData.amount,
      status: 'draft',
      notes: '',
      ownerId: ownerId
    });

    await newInvoice.save();

    res.json({
      success: true,
      invoiceData: {
        ...invoiceData,
        htmlUrl
      }
    });
  } catch (err) {
    console.error('שגיאה ביצירת חשבונית:', err);
    res.status(500).json({ error: 'שגיאה ביצירת חשבונית', details: err.message });
  }
});

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


// const express = require('express');
// const app = express();
// const path = require('path');
// const dotenv = require('dotenv');
// dotenv.config();
// const mongoose = require('mongoose');
// const generateInvoiceHTML = require('./utils/generateInvoiceHTML');
// const BusinessProfile = require('./models/BusinessProfile');
// const fs = require('fs');
// const cors = require('cors');
// app.use(cors());

// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true }));
// app.use('/invoices', express.static(path.join(__dirname, 'public/invoices')));

// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log('✅ MongoDB connected')).catch(err => console.error('❌ MongoDB connection error:', err));

// app.get('/', (req, res) => {
//   res.send('🔥 Invoice Bot Server is Running');
// });

// app.use(require('./routes/business'));
// app.use(require('./routes/customers'));
// app.use(require('./routes/invoices'));
// app.use(require('./routes/products'));
// app.use(require('./routes/scan-image'));
// app.use(require('./routes/stats'));
// app.use(require('./routes/templates'));

// app.post('/api/generate-invoice', async (req, res) => {
//   try {
//     const invoiceData = req.body;

//     if (!invoiceData) {
//       return res.status(400).json({ error: 'חסרים נתונים ליצירת החשבונית' });
//     }

//     const data = {
//       referenceNumber: invoiceData.referenceNumber || Math.floor(Math.random() * 90000) + 10000,
//       issueDate: invoiceData.valueDate || new Date().toLocaleDateString('he-IL'),
//       amount: invoiceData.amount || 1200,
//       customerName: invoiceData.customerName || 'לקוח כללי',
//       customerIdNumber: invoiceData.customerIdNumber || '',
//       serviceDescription: invoiceData.serviceDescription || 'שירותים מקצועיים',
//       paymentMethod: invoiceData.paymentMethod || 'העברה בנקאית'
//     };

//     const htmlFilename = generateInvoiceHTML(data, invoiceData.businessProfile || {});

//     const savedInvoice = new (require('./models/Invoice'))({
//       invoiceNumber: data.referenceNumber,
//       issueDate: new Date(),
//       items: [{
//         description: data.serviceDescription,
//         quantity: 1,
//         unitPrice: data.amount,
//         total: data.amount
//       }],
//       totalAmount: data.amount,
//       status: 'draft',
//       notes: '',
//       ownerId: invoiceData.ownerId || null
//     });

//     await savedInvoice.save();

//     res.json({
//       success: true,
//       invoiceData: data,
//       htmlUrl: `/invoices/${htmlFilename}`
//     });
//   } catch (error) {
//     console.error('שגיאה ביצירת חשבונית:', error);
//     res.status(500).json({ error: 'שגיאה ביצירת חשבונית', details: error.message });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
