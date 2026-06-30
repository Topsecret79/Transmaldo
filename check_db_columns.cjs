const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

(async () => {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://mydeliveryteam.es/');
  const keys = await page.evaluate(() => {
    return {
      url: localStorage.getItem('supabase_url'),
      key: localStorage.getItem('supabase_key')
    };
  });
  await browser.close();

  if (!keys.url || !keys.key) {
    console.log("Supabase credentials not found in browser local storage.");
    return;
  }

  console.log(`Connecting to Supabase at: ${keys.url}`);
  const supabase = createClient(keys.url, keys.key);
  const { data, error } = await supabase.from('delivery_tickets').select('*').limit(1);
  if (error) {
    console.error("Error fetching ticket columns:", error);
  } else {
    console.log("Columns in delivery_tickets table:");
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log("No tickets found to read columns.");
    }
  }
  fs.unlinkSync('./check_db_columns.cjs');
})();
