import fs from 'fs';

const content = fs.readFileSync('src/db.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('saveTickets') || line.includes('function saveTickets')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
