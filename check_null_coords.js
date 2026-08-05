import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
const defaultKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

const supabase = createClient(defaultUrl, defaultKey);

async function checkNullTickets() {
  console.log('Querying tickets with null coordinates...');
  const { data, error } = await supabase
    .from('delivery_tickets')
    .select('id, customer_name, address, lat, lng, created_at, status, furgo_id, date, created_by')
    .or('lat.is.null,lng.is.null');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} tickets with null coordinates.`);
  data.forEach(t => {
    console.log(`- ID: ${t.id}, Date: ${t.date}, Furgo: ${t.furgo_id}, Customer: ${t.customer_name}, Addr: ${t.address}, Creator: ${t.created_by}, Status: ${t.status}`);
  });
}

checkNullTickets();
