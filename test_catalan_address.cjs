const { geocodeAddress } = require('./src/db.js');

(async () => {
  console.log("Testing Catalan address geocoding...");
  // Catalan address with abbreviation and regional language
  const address1 = "c/ de Mallorca, 250, Barcelona";
  const result1 = await geocodeAddress(address1);
  console.log(`Query: "${address1}"`);
  if (result1) {
    console.log(`🟢 SUCCESS: Found coords for "${address1}":`, result1.lat, result1.lng, `DisplayName: "${result1.displayName}"`);
  } else {
    console.log(`🔴 FAILED: Could not geocode "${address1}"`);
  }

  console.log("\nTesting Basque address geocoding...");
  // Basque address
  const address2 = "Mallorkako Kalea, Donostia";
  const result2 = await geocodeAddress(address2);
  console.log(`Query: "${address2}"`);
  if (result2) {
    console.log(`🟢 SUCCESS: Found coords for "${address2}":`, result2.lat, result2.lng, `DisplayName: "${result2.displayName}"`);
  } else {
    console.log(`🔴 FAILED: Could not geocode "${address2}"`);
  }
})();
