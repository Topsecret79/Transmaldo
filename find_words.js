import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (/flotante|floating|sin coordenadas|no geolocalizado/i.test(line)) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
