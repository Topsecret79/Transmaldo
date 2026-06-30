const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log("Navigating to https://mydeliveryteam.es/ ...");
    await page.goto('https://mydeliveryteam.es/?cache_bust=' + Date.now(), { waitUntil: 'networkidle2' });

    console.log("Logging in as driver (Ruta 150)...");
    await page.type('input[type="text"]', 'Ruta 150');
    await page.type('input[type="password"]', '0150');
    await page.click('button[type="submit"]');

    console.log("Waiting for app load...");
    await new Promise(r => setTimeout(r, 4000));

    // Try to click "Crear Ruta" to open the form if not already open
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Crear Ruta'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // If route creation form opened, type name and submit
    const routeInputSelector = 'input[placeholder*="Ruta Sabadell"]';
    const isPlanRouteShowing = await page.evaluate((sel) => !!document.querySelector(sel), routeInputSelector);
    if (isPlanRouteShowing) {
      await page.type(routeInputSelector, 'Ruta de Prueba');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(b => b.textContent.includes('Empezar') || b.textContent.includes('Añadir Paradas'));
        if (submitBtn) submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 3000));
    }

    const addressInputSelector = 'input[placeholder="Dirección de entrega"]';
    
    console.log("\n--- TEST: Basque address with Mapbox ---");
    console.log("Typing 'Mallorkako Kalea, Donostia'...");
    await page.type(addressInputSelector, 'Mallorkako Kalea, Donostia', { delay: 50 });
    
    console.log("Waiting 4s for Mapbox autocomplete suggestions...");
    await new Promise(r => setTimeout(r, 4000));

    const suggestions = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('ul li')).map(li => li.textContent.trim());
    });
    console.log("Suggestions found:");
    if (suggestions.length > 0) {
      suggestions.forEach((sug, i) => console.log(`  ${i + 1}. ${sug}`));
    } else {
      console.log("  No suggestions found! (Mapbox API might have failed or not loaded yet)");
    }

    console.log("Clicking 'Verificar'...");
    await page.evaluate(() => {
      const verifyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Verificar'));
      if (verifyBtn) verifyBtn.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    const verificationMsg = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const msg = divs.find(d => d.textContent.includes('Verificada como') || d.textContent.includes('Dirección no localizada'));
      return msg ? msg.textContent.trim() : 'No verification text found';
    });
    console.log(`Verification result: "${verificationMsg}"`);

  } catch (e) {
    console.error("Puppeteer error:", e);
  } finally {
    await browser.close();
    fs.unlinkSync('./test_mapbox_browser_suggestions.cjs');
  }
})();
