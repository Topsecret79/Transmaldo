const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// Find the duplicate select
const target = '<span>Ayudante:</span>\r\n                                 <select\r\n                                   <select\r\n                                     className="form-input"';
const targetLF = '<span>Ayudante:</span>\n                                 <select\n                                   <select\n                                     className="form-input"';

if (content.includes(target)) {
  content = content.replace(target, '<span>Ayudante:</span>\r\n                                 <select\r\n                                   className="form-input"');
  console.log("CRLF match replaced successfully!");
} else if (content.includes(targetLF)) {
  content = content.replace(targetLF, '<span>Ayudante:</span>\n                                 <select\n                                   className="form-input"');
  console.log("LF match replaced successfully!");
} else {
  // Let's do a generic regex replace
  const regex = /<span>Ayudante:<\/span>\s*<select\s*<select\s*className="form-input"/;
  if (regex.test(content)) {
    content = content.replace(regex, '<span>Ayudante:</span>\n                                 <select\n                                   className="form-input"');
    console.log("Regex match replaced successfully!");
  } else {
    console.error("Could not find the duplicate select target in App.jsx!");
  }
}

fs.writeFileSync(path, content, 'utf8');
