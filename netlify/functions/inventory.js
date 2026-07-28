const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const store = getStore('props-inventory');

  try {
    if (event.httpMethod === 'GET') {
      const data = await store.get('items', { type: 'json' });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data || [] })
      };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      if (!Array.isArray(body.items)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'items must be an array' }) };
      }
      await store.setJSON('items', body.items);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error', message: err.message })
    };
  }
};
