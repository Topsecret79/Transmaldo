const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './src/db.js';
const dbContent = fs.readFileSync(envPath, 'utf8');

const urlMatch = dbContent.match(/const defaultUrl = '([^']+)';/);
const keyMatch = dbContent.match(/const defaultKey = '([^']+)';/);

if (!urlMatch || !keyMatch) {
  console.error("Could not find default Supabase url/key");
  process.exit(1);
}

const url = urlMatch[1];
const key = keyMatch[1];
const supabase = createClient(url, key);

(async () => {
  console.log("Fetching recent settings...");
  const { data, error } = await supabase.from('delivery_settings').select('*');
  if (error) {
    console.error("Error fetching settings:", error);
    return;
  }
  
  const shiftMetas = data.filter(s => s.key && s.key.startsWith('shift_meta_'));
  console.log(`Found ${shiftMetas.length} shift metadata rows in Supabase.`);
  
  // Show the last 5 shift metas
  shiftMetas.slice(-10).forEach(m => {
    console.log(`Key: ${m.key} | Value: ${m.value}`);
  });
})();
