// models/Counter.js - מודל לניהול מספרי חשבוניות אוטומטיים

const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  sequenceValue: {
    type: Number,
    default: 4000 // מספר התחלתי
  }
});

module.exports = mongoose.model('Counter', CounterSchema);