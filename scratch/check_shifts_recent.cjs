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
  console.log("Fetching all shifts...");
  const { data: shifts, error } = await supabase.from('delivery_shifts').select('*');
  if (error) {
    console.error("Error fetching shifts:", error);
    return;
  }
  
  console.log(`Found ${shifts.length} shifts in delivery_shifts table.`);
  
  const { data: settings, error: settingsErr } = await supabase.from('delivery_settings').select('*');
  if (settingsErr) {
     console.error("Error fetching settings:", settingsErr);
     return;
  }
  
  // Sort shifts by date descending
  shifts.sort((a,b) => b.date.localeCompare(a.date));
  
  // Show the top 15 shifts
  for (const s of shifts.slice(0, 15)) {
    const metaSetting = settings.find(set => set.key === `shift_meta_${s.id}`);
    let meta = {};
    if (metaSetting) {
      try {
        meta = JSON.parse(metaSetting.value);
      } catch (e) {}
    }
    console.log(`ID: ${s.id} | Date: ${s.date} | Furgo: ${s.furgo_id} | Driver: ${meta.customDriver || ''} | Helper: ${meta.helper || ''} | Helper2: ${meta.helper2 || ''} | Matr: ${meta.matricula || ''} | Status: ${s.status}`);
  }
})();
