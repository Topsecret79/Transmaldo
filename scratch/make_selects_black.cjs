const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetStyle = "style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--panel-border)' }}";
const replacementStyle = "style={{ margin: 0, padding: '6px 10px', fontSize: '0.8rem', background: '#ffffff', color: '#000000', border: '1px solid var(--panel-border)' }}";

if (content.includes(targetStyle)) {
  // Replace all occurrences of targetStyle with replacementStyle
  content = content.split(targetStyle).join(replacementStyle);
  console.log("Successfully replaced style instances!");
} else {
  console.error("Could not find the targetStyle in App.jsx!");
}

fs.writeFileSync(path, content, 'utf8');
