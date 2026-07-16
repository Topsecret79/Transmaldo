const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './src/db.js';
const dbContent = fs.readFileSync(envPath, 'utf8');

// Extract supabase url and key from db.js defaults
const urlMatch = dbContent.match(/const defaultUrl = '([^']+)';/);
const keyMatch = dbContent.match(/const defaultKey = '([^']+)';/);

if (!urlMatch || !keyMatch) {
  console.error("Could not find default Supabase url/key");
  process.exit(1);
}

const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

console.log("Subscribing to realtime postgres_changes...");
const channel = supabase
  .channel('test-realtime-sync')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
    console.log("REALTIME EVENT RECEIVED!");
    console.log("Table:", payload.table);
    console.log("EventType:", payload.eventType);
    console.log("New record:", payload.new);
    console.log("Old record:", payload.old);
    console.log("Full payload:", JSON.stringify(payload, null, 2));
  })
  .subscribe((status) => {
    console.log("Subscription status:", status);
  });

// Keep running for 30 seconds
setTimeout(() => {
  console.log("Test finished.");
  process.exit(0);
}, 30000);
