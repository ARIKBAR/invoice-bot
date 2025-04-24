// routes/customers.js - נתיבים לניהול לקוחות

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

/**
 * @route   GET /api/customers
 * @desc    קבלת רשימת כל הלקוחות
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // כמות לקוחות לדף
    const skip = (page - 1) * limit;

    const total = await Customer.countDocuments();
    const customers = await Customer.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const customerNames = customers.map(c => c.name);
    const customerNamesComma = customerNames.join(', ');
    customerNamesComma.push('לקוח לא ברשימה');
    customerNames.push('לקוח לא ברשימה');



    res.json({
      customers,       // כל הנתונים של הלקוחות בעמוד הנוכחי
      customerNames,   // רק השמות – עבור תצוגה בבחירה
      customerNamesComma, // שמות הלקוחות בפורמט מופרד בפסיקים
      hasMore: skip + limit < total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalResults: total
    });
  } catch (err) {
    console.error('שגיאה בשליפת לקוחות:', err);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});



router.get('/by-name/:name', async (req, res) => {
  try {
    const customer = await Customer.findOne({ name: req.params.name });
    if (!customer) return res.status(404).json({ error: 'לקוח לא נמצא' });

    res.json(customer);
  } catch (err) {
    console.error('שגיאה בשליפת לקוח לפי שם:', err);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    קבלת לקוח לפי מזהה
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    
    res.json(customer);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   POST /api/customers
 * @desc    יצירת לקוח חדש
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    // בדיקת תקינות בסיסית
    if (!req.body.name) {
      return res.status(400).json({ error: 'שם הלקוח הוא שדה חובה' });
    }
    
    // יצירת לקוח חדש
    const newCustomer = new Customer({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      taxId: req.body.taxId,
      notes: req.body.notes
    });
    
    // שמירה במסד הנתונים
    const customer = await newCustomer.save();
    
    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

// בדיקה אם לקוח עם אותו שם קיים
router.post('/check-name-exists', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'שם הלקוח הוא שדה חובה' });

  const existing = await Customer.findOne({ name: name.trim() });
  if (existing) {
    return res.json({ exists: true, message: 'כבר קיים לקוח בשם זה' });
  } else {
    return res.json({ exists: false });
  }
});


/**
 * @route   PUT /api/customers/:id
 * @desc    עדכון לקוח קיים
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    // בניית אובייקט העדכון
    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.taxId !== undefined) updateData.taxId = req.body.taxId;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    
    // עדכון במסד הנתונים
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    
    res.json(customer);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    מחיקת לקוח
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    
    await customer.deleteOne();
    
    res.json({ message: 'לקוח נמחק בהצלחה', id: req.params.id });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

module.exports = router;