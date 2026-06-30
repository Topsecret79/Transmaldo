const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disk-cache-size=0']
  });
  const page = await browser.newPage();
  
  // Disable caching!
  await page.setCacheEnabled(false);
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.toString()}`);
  });

  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  console.log("Navigating to https://mydeliveryteam.es/ ...");
  try {
    await page.goto('https://mydeliveryteam.es/', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    console.log("Page loaded successfully.");
  } catch (err) {
    console.error("Navigation error:", err.message);
  }

  await browser.close();
})();
