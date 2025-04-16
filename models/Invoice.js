// models/Invoice.js - מודל עבור חשבוניות

const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'הכמות לא יכולה להיות שלילית']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'המחיר לא יכול להיות שלילי']
  },
  total: {
    type: Number,
    required: true
  }
});

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'מספר חשבונית הוא שדה חובה'],
    unique: true,
    trim: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'לקוח הוא שדה חובה']
  },

  ownerId: {
    type: String,
    required: false // אופציונלי אם תרצה
  },
  htmlFileName: {
    type: String
  },
  
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 30); // ברירת מחדל: 30 יום מתאריך ההנפקה
      return date;
    }
  },
  items: [InvoiceItemSchema],
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'הסכום הכולל לא יכול להיות שלילי']
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', InvoiceSchema);