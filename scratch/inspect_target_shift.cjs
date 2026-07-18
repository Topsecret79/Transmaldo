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
  console.log("Fetching shift_meta_ruta 151_2026-07-18...");
  const { data, error } = await supabase.from('delivery_settings').select('*').eq('key', 'shift_meta_ruta 151_2026-07-18').maybeSingle();
  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log("shift_meta_ruta 151_2026-07-18 row:", data);
  }
})();
