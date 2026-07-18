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
  console.log("Fetching delivery_employees_list...");
  const { data, error } = await supabase.from('delivery_settings').select('*').eq('key', 'delivery_employees_list').maybeSingle();
  if (error) {
    console.error("Error:", error);
    return;
  }
  if (data) {
    const list = JSON.parse(data.value);
    console.log("Employees List in Supabase:");
    list.forEach(emp => {
      console.log(`Name: ${emp.name} | Role: ${emp.role} | Active: ${emp.active}`);
    });
  } else {
    console.log("No delivery_employees_list found in Supabase.");
  }
})();
