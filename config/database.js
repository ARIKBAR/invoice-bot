// config/database.js - קובץ להגדרת חיבור למונגו

const mongoose = require('mongoose');
require('dotenv').config();

// URL חיבור למונגו - מתוך משתנה סביבה או ברירת מחדל
const MONGODB_URI = process.env.MONGODB_URI 

// פונקציה להתחברות למסד הנתונים
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    // יציאה מהתהליך במקרה של כישלון בחיבור
    process.exit(1);
  }
};

module.exports = connectDB;