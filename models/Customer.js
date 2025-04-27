// models/Customer.js - מודל עבור לקוחות

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  ownerId: {
    type: String,
    required: true
  },  
  name: {
    type: String,
    required: [true, 'שם הלקוח הוא שדה חובה'],
    trim: true
  },
  email: {
    type: String,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'נא להזין כתובת אימייל תקינה'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', CustomerSchema);
