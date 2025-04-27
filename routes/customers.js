// routes/customers.js - נתיבים לניהול לקוחות עם ownerId

const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

/**
 * @route   GET /api/customers
 * @desc    קבלת רשימת כל הלקוחות לפי ownerId
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const total = await Customer.countDocuments({ ownerId });
    const customers = await Customer.find({ ownerId })
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const customerNames = customers.map(c => c.name);
    const customerNamesComma = customerNames.join(', ');
    customerNames.push('לקוח לא ברשימה');

    res.json({
      customers,
      customerNames,
      customerNamesComma,
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

/**
 * @route   GET /api/customers/by-name/:name
 * @desc    קבלת לקוח לפי שם ו-ownerId
 * @access  Private
 */
router.get('/by-name/:name', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });

    const customer = await Customer.findOne({ name: req.params.name, ownerId });
    if (!customer) return res.status(404).json({ error: 'לקוח לא נמצא' });

    res.json(customer);
  } catch (err) {
    console.error('שגיאה בשליפת לקוח לפי שם:', err);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    קבלת לקוח לפי מזהה ו-ownerId
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });

    const customer = await Customer.findOne({ _id: req.params.id, ownerId });
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
 * @desc    יצירת לקוח חדש עם ownerId
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });
    if (!req.body.name) return res.status(400).json({ error: 'שם הלקוח הוא שדה חובה' });

    const newCustomer = new Customer({
      ownerId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      taxId: req.body.taxId,
      notes: req.body.notes
    });

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

/**
 * @route   POST /api/customers/check-name-exists
 * @desc    בדיקה אם שם לקוח קיים עבור ownerId
 * @access  Private
 */
router.post('/check-name-exists', async (req, res) => {
  try {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) return res.status(400).json({ error: 'חובה לציין שם ו-ownerId' });

    const existing = await Customer.findOne({ name: name.trim(), ownerId });
    if (existing) {
      return res.json({ exists: true, message: 'כבר קיים לקוח בשם זה' });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error('שגיאה בבדיקת שם לקוח:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   PUT /api/customers/:id
 * @desc    עדכון לקוח קיים לפי ownerId
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });

    const customer = await Customer.findOne({ _id: req.params.id, ownerId });
    if (!customer) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.taxId !== undefined) updateData.taxId = req.body.taxId;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json(updatedCustomer);
  } catch (err) {
    console.error('שגיאה בעדכון לקוח:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    מחיקת לקוח לפי ownerId
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'חובה לציין ownerId' });

    const customer = await Customer.findOne({ _id: req.params.id, ownerId });
    if (!customer) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }

    await customer.deleteOne();

    res.json({ message: 'לקוח נמחק בהצלחה', id: req.params.id });
  } catch (err) {
    console.error('שגיאה במחיקת לקוח:', err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

module.exports = router;
