// models/Counter.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 4000 } // מתחיל מ-4000
});

module.exports = mongoose.model('Counter', counterSchema);
