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
  console.log("Checking duplicates...");
  const { data: shifts, error } = await supabase.from('delivery_shifts').select('id');
  if (error) {
     console.error("Error:", error);
     return;
  }
  
  const ids = shifts.map(s => s.id);
  const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
  console.log("Duplicate shift IDs in Supabase:", duplicates);
  
  const { data: settings } = await supabase.from('delivery_settings').select('key');
  const keys = settings.map(s => s.key).filter(k => k.startsWith('shift_meta_'));
  const duplicateKeys = keys.filter((item, index) => keys.indexOf(item) !== index);
  console.log("Duplicate settings keys in Supabase:", duplicateKeys);
})();
