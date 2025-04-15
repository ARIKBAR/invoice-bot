// models/Product.js - מודל עבור מוצרים/שירותים

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'שם המוצר/שירות הוא שדה חובה'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'מחיר הוא שדה חובה'],
    min: [0, 'המחיר לא יכול להיות שלילי']
  },
  unit: {
    type: String,
    default: 'יחידה',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);