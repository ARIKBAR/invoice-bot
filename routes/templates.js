// routes/templates.js - נתיבים לניהול תבניות חשבוניות

const express = require('express');
const router = express.Router();
const Template = require('../models/Template');

/**
 * @route   GET /api/templates
 * @desc    קבלת רשימת כל התבניות
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find().sort({ name: 1 });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   GET /api/templates/default
 * @desc    קבלת התבנית המוגדרת כברירת מחדל
 * @access  Private
 */
router.get('/default', async (req, res) => {
  try {
    const defaultTemplate = await Template.findOne({ isDefault: true });
    
    if (!defaultTemplate) {
      return res.status(404).json({ error: 'לא נמצאה תבנית ברירת מחדל' });
    }
    
    res.json(defaultTemplate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   GET /api/templates/:id
 * @desc    קבלת תבנית לפי מזהה
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    res.json(template);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   POST /api/templates
 * @desc    יצירת תבנית חדשה
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    // בדיקת תקינות בסיסית
    if (!req.body.name) {
      return res.status(400).json({ error: 'שם התבנית הוא שדה חובה' });
    }
    
    if (!req.body.htmlTemplate) {
      return res.status(400).json({ error: 'תוכן HTML הוא שדה חובה' });
    }
    
    // יצירת תבנית חדשה
    const newTemplate = new Template({
      name: req.body.name,
      htmlTemplate: req.body.htmlTemplate,
      cssStyle: req.body.cssStyle || '',
      isDefault: req.body.isDefault || false
    });
    
    // אם התבנית מוגדרת כברירת מחדל, צריך לבטל את ההגדרה בתבניות קיימות
    if (newTemplate.isDefault) {
      await Template.updateMany({ isDefault: true }, { isDefault: false });
    }
    
    // שמירה במסד הנתונים
    const template = await newTemplate.save();
    
    res.status(201).json(template);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   PUT /api/templates/:id
 * @desc    עדכון תבנית קיימת
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    // בניית אובייקט העדכון
    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.htmlTemplate) updateData.htmlTemplate = req.body.htmlTemplate;
    if (req.body.cssStyle !== undefined) updateData.cssStyle = req.body.cssStyle;
    if (req.body.isDefault !== undefined) updateData.isDefault = req.body.isDefault;
    
    // אם מעדכנים לברירת מחדל, צריך לבטל את ההגדרה בתבניות אחרות
    if (updateData.isDefault) {
      await Template.updateMany(
        { _id: { $ne: req.params.id }, isDefault: true },
        { isDefault: false }
      );
    }
    
    // עדכון במסד הנתונים
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    res.json(template);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'שגיאת ולידציה', details: err.message });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   DELETE /api/templates/:id
 * @desc    מחיקת תבנית
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    // בדיקה אם זו תבנית ברירת מחדל
    if (template.isDefault) {
      return res.status(400).json({ error: 'לא ניתן למחוק תבנית המוגדרת כברירת מחדל' });
    }
    
    await template.deleteOne();
    
    res.json({ message: 'תבנית נמחקה בהצלחה', id: req.params.id });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

/**
 * @route   POST /api/templates/:id/set-default
 * @desc    הגדרת תבנית כברירת מחדל
 * @access  Private
 */
router.post('/:id/set-default', async (req, res) => {
  try {
    // בדיקה שהתבנית קיימת
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    // ביטול הגדרת ברירת מחדל בתבניות אחרות
    await Template.updateMany({ isDefault: true }, { isDefault: false });
    
    // הגדרת התבנית הנוכחית כברירת מחדל
    template.isDefault = true;
    await template.save();
    
    res.json({ 
      message: 'התבנית הוגדרה בהצלחה כברירת מחדל',
      template
    });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    res.status(500).json({ error: 'שגיאת שרת', details: err.message });
  }
});

module.exports = router;