// routes/products.js - נתיבים לניהול מוצרים/שירותים

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

/**
 * @route   GET /api/products
 * @desc    קבלת רשימת כל המוצרים/שירותים
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    // אופציה לסנן רק מוצרים פעילים
    const filter = {};
    if (req.query.activeOnly === 'true') {
      filter.isActive = true;
    }
    
    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    קבלת מוצר/שירות לפי מזהה
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    
    res.json(product);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   POST /api/products
 * @desc    יצירת מוצר/שירות חדש
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    // בדיקת תקינות בסיסית
    if (!req.body.name) {
      return res.status(400).json({ error: 'שם המוצר/שירות הוא שדה חובה' });
    }
    
    if (req.body.price === undefined) {
      return res.status(400).json({ error: 'מחיר הוא שדה חובה' });
    }
    
    // יצירת מוצר/שירות חדש
    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description || '',
      price: req.body.price,
      unit: req.body.unit || 'יחידה',
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });
    
    // שמירה במסד הנתונים
    const product = await newProduct.save();
    
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    עדכון מוצר/שירות קיים
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    // בניית אובייקט העדכון
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.price !== undefined) updateData.price = req.body.price;
    if (req.body.unit !== undefined) updateData.unit = req.body.unit;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    
    // עדכון במסד הנתונים
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    
    res.json(product);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    מחיקת מוצר/שירות (או סימון כלא פעיל)
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    
    // אפשרות לסמן כלא פעיל במקום למחוק לגמרי
    if (req.query.deactivate === 'true') {
      product.isActive = false;
      await product.save();
      return res.json({ message: 'מוצר/שירות סומן כלא פעיל', id: req.params.id });
    }
    
    // מחיקה מלאה
    await product.deleteOne();
    
    res.json({ message: 'מוצר/שירות נמחק בהצלחה', id: req.params.id });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'מוצר/שירות לא נמצא' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

module.exports = router;