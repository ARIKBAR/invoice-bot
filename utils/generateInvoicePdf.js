// utils/generateInvoicePdf.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateInvoicePdf(invoiceUrl, outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new', // או true לפי גרסה
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(invoiceUrl, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true
  });

  await browser.close();
}

module.exports = generateInvoicePdf;
