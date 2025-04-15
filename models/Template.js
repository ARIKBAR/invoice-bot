// models/Template.js - מודל עבור תבניות חשבוניות

const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'שם התבנית הוא שדה חובה'],
    trim: true
  },
  htmlTemplate: {
    type: String,
    required: [true, 'תוכן HTML הוא שדה חובה']
  },
  cssStyle: {
    type: String
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Template', TemplateSchema);