const fs = require('fs');

async function main() {
  const targetSupabaseUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
  const targetSupabaseKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

  try {
    const res = await fetch(`${targetSupabaseUrl}/rest/v1/delivery_settings?key=in.(fleet_fuel_logs_admin,fleet_daily_logs_admin)`, {
      headers: {
        'apikey': targetSupabaseKey,
        'Authorization': `Bearer ${targetSupabaseKey}`
      }
    });
    const rows = await res.json();
    for (const r of rows) {
      console.log(`=== Key: ${r.key} ===`);
      console.log(JSON.stringify(JSON.parse(r.value), null, 2));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
