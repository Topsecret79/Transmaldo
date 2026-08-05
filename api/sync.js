export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { url, key, table, action, queryParams, payload, id } = req.body;

    if (!url || !key || !table || !action) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    };

    let fetchUrl = `${url}/rest/v1/${table}`;
    let method = 'GET';
    let options = { headers };

    if (action === 'select') {
      method = 'GET';
      if (queryParams) {
        fetchUrl += `?${queryParams}`;
      }
    } else if (action === 'insert') {
      method = 'POST';
      headers['Prefer'] = 'return=representation';
      options.body = JSON.stringify(payload);
    } else if (action === 'update') {
      method = 'PATCH';
      fetchUrl += `?id=eq.${id}`;
      options.body = JSON.stringify(payload);
    }

    options.method = method;

    const response = await fetch(fetchUrl, options);
    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: text });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { message: text };
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in proxy sync:', error);
    return res.status(500).json({ error: error.message });
  }
}
