const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `  const handleUpdateDriverShiftField = (field, value) => {
    const shiftId = \`\${currentUser.id}_\${targetDate}\`;`;

const replacementStr = `  const handleUpdateDriverShiftField = (field, value) => {
    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const shiftId = \`\${currentUser.id}_\${targetDate}\`;`;

const targetStrCRLF = targetStr.replace(/\n/g, '\r\n');
const replacementStrCRLF = replacementStr.replace(/\n/g, '\r\n');

if (content.includes(targetStrCRLF)) {
  content = content.replace(targetStrCRLF, replacementStrCRLF);
  console.log("Successfully fixed targetDate with CRLF!");
} else if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log("Successfully fixed targetDate with LF!");
} else {
  console.error("Could not find handleUpdateDriverShiftField target string in App.jsx!");
}

fs.writeFileSync(path, content, 'utf8');
