/**
 * PDF Generation Script
 *
 * Converts HTML presentations to PDF using Puppeteer.
 * Reads from frontend/public/presentations/*.html
 * Outputs to frontend/public/presentations/pdfs/*.pdf
 *
 * Usage: npm run generate-pdfs (from project root)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Presentations to convert
const presentations = [
  'Strategic_Plan_2026-2028.html',
  'Funding_Strategy_Visual.html',
  'Website_Registration_Flow.html'
];

const inputDir = path.join(__dirname, 'frontend', 'public', 'presentations');
const outputDir = path.join(inputDir, 'pdfs');

async function convertToPdf() {
  console.log('Starting PDF generation...\n');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}\n`);
  }

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const htmlFile of presentations) {
      const inputPath = path.join(inputDir, htmlFile);
      const pdfFileName = htmlFile.replace('.html', '.pdf');
      const outputPath = path.join(outputDir, pdfFileName);

      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        console.log(`⚠️  Skipping ${htmlFile} - file not found`);
        continue;
      }

      console.log(`Converting: ${htmlFile}`);

      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 800
      });

      // Load the HTML file
      const fileUrl = `file://${inputPath}`;
      await page.goto(fileUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait a bit for any animations/fonts to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
        scale: 0.55, // Scale down to fit on one page
        pageRanges: '1', // Only output page 1
        preferCSSPageSize: false,
        displayHeaderFooter: false
      });

      await page.close();
      console.log(`✅ Generated: ${pdfFileName}`);
    }

    console.log('\n🎉 PDF generation complete!');

  } catch (error) {
    console.error('\n❌ Error during PDF generation:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
convertToPdf().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
