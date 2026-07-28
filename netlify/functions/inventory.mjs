import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore('props-inventory');

  try {
    if (req.method === 'GET') {
      const data = await store.get('items', { type: 'json' });
      return new Response(JSON.stringify({ items: data || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }
      if (!Array.isArray(body.items)) {
        return new Response(JSON.stringify({ error: 'items must be an array' }), { status: 400 });
      }
      await store.setJSON('items', body.items);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal error', message: err.message }), { status: 500 });
  }
};

export const config = {
  path: '/api/inventory'
};
