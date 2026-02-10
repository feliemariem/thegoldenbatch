/**
 * PDF Generation Script
 *
 * Converts ALL HTML presentations to PDF using Puppeteer.
 * Automatically discovers all .html files in frontend/public/presentations/
 * Outputs to frontend/public/presentations/pdfs/*.pdf
 *
 * Usage: npm run generate-pdfs (from project root)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const inputDir = path.join(__dirname, 'frontend', 'public', 'presentations');
const outputDir = path.join(inputDir, 'pdfs');

async function convertToPdf() {
  console.log('Starting PDF generation...\n');

  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  // Automatically discover all HTML files in the presentations folder
  const allFiles = fs.readdirSync(inputDir);
  const htmlFiles = allFiles.filter(file => file.endsWith('.html'));

  if (htmlFiles.length === 0) {
    console.log('⚠️  No HTML files found in presentations folder');
    return;
  }

  console.log(`Found ${htmlFiles.length} HTML file(s) to convert:\n`);
  htmlFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');

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

  let successCount = 0;
  let failCount = 0;

  try {
    for (const htmlFile of htmlFiles) {
      const inputPath = path.join(inputDir, htmlFile);
      const pdfFileName = htmlFile.replace('.html', '.pdf');
      const outputPath = path.join(outputDir, pdfFileName);

      console.log(`Converting: ${htmlFile}`);

      try {
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
        successCount++;
      } catch (fileError) {
        console.error(`❌ Failed to convert ${htmlFile}: ${fileError.message}`);
        failCount++;
      }
    }

    console.log(`\n🎉 PDF generation complete!`);
    console.log(`   ✅ Success: ${successCount}`);
    if (failCount > 0) {
      console.log(`   ❌ Failed: ${failCount}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during PDF generation:', error.message);
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
