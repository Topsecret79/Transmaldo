import fs from 'fs';
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('mapInstanceRef')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
