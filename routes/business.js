// routes/business.js

const express = require('express');
const router = express.Router();
const BusinessProfile = require('../models/BusinessProfile');
const { v4: uuidv4 } = require('uuid'); // מחייב להתקין uuid: npm install uuid

/**
 * @route   POST /api/business-profile
 * @desc    יצירת פרופיל עסקי חדש או עדכון קיים - כולל יצירת ownerId אוטומטי אם חסר
 */
router.post('/', async (req, res) => {
  try {
    let {
      ownerId,
      businessName,
      taxId,
      email,
      phone,
      address,
      logoUrl
    } = req.body;

    if (!businessName) {
      return res.status(400).json({ error: 'Missing required field: businessName' });
    }

    // אם לא סופק ownerId — ניצור חדש
    if (!ownerId) {
      ownerId = uuidv4();
    }

    const profile = await BusinessProfile.findOneAndUpdate(
      { ownerId },
      {
        businessName,
        taxId,
        email,
        phone,
        address,
        logoUrl
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, profile, ownerId });
  } catch (err) {
    console.error('Error creating business profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/business-profile/:ownerId
 * @desc    קבלת פרטי עסק לפי מזהה בעלים
 */
router.get('/:ownerId', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;

    const profile = await BusinessProfile.findOne({ ownerId });

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error('Error fetching business profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
