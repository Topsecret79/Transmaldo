const http = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log("Fetching live page index...");
    const html = await fetchUrl('https://mydeliveryteam.es/');
    console.log("Index HTML loaded. Searching for assets...");
    
    const matches = html.match(/src="([^"]+\.js)"/);
    if (!matches) {
      console.log("No main JS asset found in HTML.");
      console.log(html.substring(0, 500));
      return;
    }
    
    const jsUrl = 'https://mydeliveryteam.es/' + matches[1].replace(/^\.\//, '');
    console.log("Found main JS URL:", jsUrl);
    
    console.log("Fetching JS content...");
    const jsContent = await fetchUrl(jsUrl);
    console.log(`JS loaded: ${jsContent.length} bytes.`);
    
    const hasHelper2 = jsContent.includes('helper2');
    console.log("Does the live JS contain 'helper2'? ", hasHelper2);
    
    const occurrences = (jsContent.match(/helper2/g) || []).length;
    console.log("Number of 'helper2' occurrences in live JS:", occurrences);
    
  } catch (e) {
    console.error("Error fetching live files:", e);
  }
})();
