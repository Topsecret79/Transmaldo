const fs = require('fs');
const path = require('path');

async function main() {
  const targetSupabaseUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
  const targetSupabaseKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

  try {
    const res = await fetch(`${targetSupabaseUrl}/rest/v1/delivery_settings?key=like.fleet_%25`, {
      headers: {
        'apikey': targetSupabaseKey,
        'Authorization': `Bearer ${targetSupabaseKey}`
      }
    });
    const rows = await res.json();
    console.log("Total settings keys found:", rows.length);
    for (const r of rows) {
      console.log(`Key: ${r.key}`);
      try {
        const val = JSON.parse(r.value);
        console.log(`  Count: ${Array.isArray(val) ? val.length : 'object'}`);
        if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            if (item.plate === '7282LHD' || item.plate === '7282 LHD') {
              console.log(`    [Match in ${r.key}]`, JSON.stringify(item));
            }
          });
        }
      } catch (e) {
        console.log("  (error parsing json value)");
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
