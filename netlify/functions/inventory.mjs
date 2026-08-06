import { getStore } from '@netlify/blobs';

// Reads the current items list, applies `mutate`, and writes it back using an
// ETag-conditional write. If another request wrote in between, it retries
// with fresh data instead of silently overwriting the other change.
async function applyItemsUpdate(store, mutate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await store.getWithMetadata('items', { type: 'json', consistency: 'strong' });
    const currentItems = existing && Array.isArray(existing.data) ? existing.data : [];
    const nextItems = mutate(currentItems);

    const writeOpts = existing && existing.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true };
    const result = await store.setJSON('items', nextItems, writeOpts);

    if (!result || result.modified !== false) {
      return nextItems;
    }
    // Someone else wrote in between — loop and retry with fresh data.
  }
  throw new Error('Could not save changes due to concurrent updates. Please try again.');
}

export default async (req) => {
  const store = getStore('props-inventory');
  const photoStore = getStore('props-inventory-photos');
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const photoId = url.searchParams.get('photo');
      if (photoId) {
        const photo = await photoStore.get(photoId, { type: 'text', consistency: 'strong' });
        return new Response(JSON.stringify({ photo: photo || null }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }
        });
      }
      const data = await store.get('items', { type: 'json', consistency: 'strong' });
      return new Response(JSON.stringify({ items: data || [] }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      await applyItemsUpdate(store, (items) => {
        let next = items;

        if (body.upsertItem && body.upsertItem.id) {
          const idx = next.findIndex(it => it.id === body.upsertItem.id);
          if (idx >= 0) {
            next = next.slice();
            next[idx] = body.upsertItem;
          } else {
            next = next.concat([body.upsertItem]);
          }
        }

        if (body.deleteItemId) {
          next = next.filter(it => it.id !== body.deleteItemId);
        }

        // Backward-compat / bulk replace (used rarely, e.g. full re-sync)
        if (Array.isArray(body.items)) {
          next = body.items;
        }

        return next;
      });

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
