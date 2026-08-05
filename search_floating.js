import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('flotant') || line.toLowerCase().includes('sin ubicaci') || line.toLowerCase().includes('sin coord')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
