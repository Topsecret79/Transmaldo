const fs = require('fs');

const path = './src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// Regex to find:
// </div>
// </div>
// </div></div>
// </div>
// );
const regex = /<\/div>\s*<\/div>\s*<\/div><\/div>\s*<\/div>\s*\);/;

if (regex.test(content)) {
  content = content.replace(regex, '</div>\n                        </div>\n                      </div>\n                    );');
  // Match CRLF / LF line endings
  const usesCRLF = content.includes('\r\n');
  if (usesCRLF) {
    content = content.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n');
  }
  console.log("Successfully fixed closing tags using regex!");
} else {
  console.error("Regex did not match closing tags block in App.jsx!");
}

fs.writeFileSync(path, content, 'utf8');
