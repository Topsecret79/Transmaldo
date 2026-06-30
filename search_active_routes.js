const fs = require('fs');
const content = fs.readFileSync('./src/App.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('activeRoutes') || line.includes('setActiveRoutes') || line.includes('currentRouteId') || line.includes('setCurrentRouteId')) {
    console.log(`[L${idx + 1}] ${line.trim()}`);
  }
});
fs.unlinkSync('./search_active_routes.js');
