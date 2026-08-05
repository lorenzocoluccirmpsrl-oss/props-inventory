import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore('props-inventory');
  const photoStore = getStore('props-inventory-photos');
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const photoId = url.searchParams.get('photo');
      if (photoId) {
        const photo = await photoStore.get(photoId, { type: 'text' });
        return new Response(JSON.stringify({ photo: photo || null }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
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

      const current = await store.get('items', { type: 'json' });
      let items = Array.isArray(current) ? current : [];

      if (body.upsertItem && body.upsertItem.id) {
        const idx = items.findIndex(it => it.id === body.upsertItem.id);
        if (idx >= 0) {
          items[idx] = body.upsertItem;
        } else {
          items.push(body.upsertItem);
        }
      }

      if (body.deleteItemId) {
        items = items.filter(it => it.id !== body.deleteItemId);
      }

      // Backward-compat / bulk replace (used rarely, e.g. full re-sync)
      if (Array.isArray(body.items)) {
        items = body.items;
      }

      await store.setJSON('items', items);

      if (body.photoUpdates && typeof body.photoUpdates === 'object') {
        for (const [id, dataUrl] of Object.entries(body.photoUpdates)) {
          if (dataUrl) {
            await photoStore.set(id, dataUrl);
          } else {
            await photoStore.delete(id).catch(() => {});
          }
        }
      }

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
