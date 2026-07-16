const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'C:/Users/WINDOWS 11 PRO/.gemini/antigravity/scratch/delivery-app/src/db.js';
const dbContent = fs.readFileSync(envPath, 'utf8');

// Extract supabase url and key
const urlMatch = dbContent.match(/const defaultUrl = '([^']+)';/);
const keyMatch = dbContent.match(/const defaultKey = '([^']+)';/);

const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

(async () => {
  console.log("Checking user_permissions_ settings keys...");
  const { data: settings, error } = await supabase
    .from('delivery_settings')
    .select('*')
    .like('key', 'user_permissions_%');

  if (error) {
    console.error("Select failed:", error);
  } else {
    console.log("Select succeeded! Rows:", JSON.stringify(settings, null, 2));
  }
})();
