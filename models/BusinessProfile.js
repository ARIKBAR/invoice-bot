const mongoose = require('mongoose');

const BusinessProfileSchema = new mongoose.Schema({
  ownerId: {
    type: String, // מזהה מהוואטסאפ או מזהה ייחודי אחר
    required: true,
    unique: true
  },
  businessName: { type: String, required: true },
  taxId: { type: String },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  logoUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('BusinessProfile', BusinessProfileSchema);
