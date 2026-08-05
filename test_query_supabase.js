import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
const defaultKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

const supabase = createClient(defaultUrl, defaultKey);

async function checkTickets() {
  console.log('Querying tickets created by drivers...');
  const { data, error } = await supabase
    .from('delivery_tickets')
    .select('id, customer_name, address, lat, lng, created_at, status, furgo_id, date, created_by')
    .not('created_by', 'eq', 'admin');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} tickets created by drivers.`);
  data.forEach(t => {
    console.log(`- ID: ${t.id}, Date: ${t.date}, Furgo: ${t.furgo_id}, Customer: ${t.customer_name}, Addr: ${t.address}, Lat/Lng: ${t.lat}/${t.lng}, Creator: ${t.created_by}`);
  });
}

checkTickets();
