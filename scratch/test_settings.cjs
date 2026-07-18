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
  console.log("Testing delivery_settings upsert...");
  const { data, error } = await supabase.from('delivery_settings').upsert({
    key: 'shift_meta_test_dummy',
    value: JSON.stringify({ helper2: 'Test Helper' })
  });

  if (error) {
    console.error("UPSERT FAILED:", error);
  } else {
    console.log("UPSERT SUCCEEDED!", data);
    const { data: selectData, error: selectErr } = await supabase.from('delivery_settings').select('*').eq('key', 'shift_meta_test_dummy').maybeSingle();
    console.log("SELECT RESULT:", selectData, "ERROR:", selectErr);
    
    // Cleanup
    await supabase.from('delivery_settings').delete().eq('key', 'shift_meta_test_dummy');
  }
})();
