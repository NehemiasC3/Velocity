const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  // Pre-load session storage
  await page.goto('http://localhost:3000/pages/login.html');
  await page.evaluate(() => {
      sessionStorage.setItem('Velocity_Role', 'supervisor');
      sessionStorage.setItem('Velocity_Active_User', '1');
  });

  await page.goto('http://localhost:3000/pages/supervisor.html', { waitUntil: 'networkidle2' });
  
  await browser.close();
})();
