const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Catch console errors
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[PAGE ERROR]', msg.text());
    });
    
    // Catch uncaught exceptions
    page.on('pageerror', error => {
      console.log('[PAGE EXCEPTION]', error.message);
    });

    await page.goto('http://localhost:3001/dashboard?view=alpha-calls', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if next-error-overlay exists
    const errorOverlay = await page.evaluate(() => {
      return !!document.querySelector('nextjs-portal');
    });
    
    if (errorOverlay) {
       console.log("Error overlay detected!");
       // We can't easily read inside the shadow DOM of nextjs-portal here without more complex queries,
       // but the pageerror event should catch it.
    }
    
    await browser.close();
  } catch (err) {
    console.error("Puppeteer script failed:", err);
  }
})();
