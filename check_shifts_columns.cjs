const { createClient } = require('@supabase/supabase-js');

const defaultUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
const defaultKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

const supabase = createClient(defaultUrl, defaultKey);

async function main() {
  try {
    console.log("Fetching one shift from database...");
    const { data, error } = await supabase.from('delivery_shifts').select('*').limit(1);
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Columns in delivery_shifts:", data.length > 0 ? Object.keys(data[0]) : "No shifts found");
    }
  } catch (e) {
    console.error("Exception:", e);
  }
}

main().then(() => fs.unlinkSync('./check_shifts_columns.cjs')).catch(console.error);
