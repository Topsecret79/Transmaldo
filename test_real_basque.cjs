(async () => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=es&q=${encodeURIComponent('Askatasunaren Hiribidea, Donostia')}`;
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'es,ca,eu,gl,en;q=0.9',
        'User-Agent': 'MyDeliveryTeamApp/1.0 (contact@mydeliveryteam.es)'
      }
    });
    if (res.ok) {
      const data = await res.json();
      console.log("Results found:");
      data.forEach((d, i) => {
        console.log(`  ${i+1}. ${d.display_name}`);
      });
    } else {
      console.log(`Response not OK: ${res.status} ${res.statusText}`);
    }
  } catch (e) {
    console.error(e);
  }
})();
