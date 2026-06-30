const { createClient } = require('@supabase/supabase-js');

const defaultUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
const defaultKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

const supabase = createClient(defaultUrl, defaultKey);

async function main() {
  try {
    console.log("Fetching users...");
    const { data: users, error: errUsers } = await supabase.from('delivery_users').select('*');
    if (errUsers) {
      console.error("Error fetching users:", errUsers);
    } else {
      console.log(`Found ${users.length} users:`);
      users.forEach(u => {
        console.log(`- ID: ${u.id}, Username: ${u.username}, Label: ${u.label}, Role: ${u.role}`);
      });
    }

    console.log("\nFetching tickets...");
    const { data: tickets, error: errTickets } = await supabase.from('delivery_tickets').select('*');
    if (errTickets) {
      console.error("Error fetching tickets:", errTickets);
    } else {
      console.log(`Found ${tickets.length} tickets.`);
      // Let's filter tickets by username or furgo_id
      const grouped = {};
      tickets.forEach(t => {
        grouped[t.furgo_id] = (grouped[t.furgo_id] || 0) + 1;
      });
      console.log("Tickets count grouped by furgo_id:", grouped);
    }
  } catch (e) {
    console.error("Exception occurred:", e);
  }
}

main().then(() => fs.unlinkSync('./query_supabase.cjs')).catch(console.error);
