import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('updateTicketStatus')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
