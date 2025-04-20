const axios = require('axios');
const { URLSearchParams } = require('url');

/**
 * יוצר תמונה מהחשבונית בפורמט HTML בעזרת htmlcsstoimage.com
 * @param {string} html - תוכן HTML של החשבונית
 * @returns {string} קישור להורדת התמונה
 */
async function generateInvoiceImageFromHtml(html) {
  const userId = process.env.HCTI_USER_ID;
  const apiKey = process.env.HCTI_API_KEY;

  if (!userId || !apiKey) throw new Error('Missing HCTI credentials');

  const params = new URLSearchParams({
    html,
    css: '',

    // קובעים שהתמונה תהיה בגודל התוכן (ולא כל הדף)
    selector: 'body',
    width: '',      // ריק = לפי תוכן
    height: '',     // ריק = לפי תוכן

    // מסירים רקע לבן
    transparent: 'true',
    // אפשר גם להוסיף:
    // "device_scale": "2" // רזולוציה גבוהה יותר (אם רוצים)
  });

  const response = await axios.post(
    'https://hcti.io/v1/image',
    params,
    {
      auth: {
        username: userId,
        password: apiKey,
      }
    }
  );

  return response.data.url;
}

module.exports = generateInvoiceImageFromHtml;
