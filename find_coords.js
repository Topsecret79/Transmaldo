import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (/no geocod|sin geol|sin coord|coordenadas nulas|coordenadas vac/i.test(line)) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
