import { getStore } from '@netlify/blobs';

async function applyBlobUpdate(store, key, mutate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const currentValue = existing ? existing.data : null;
    const nextValue = mutate(currentValue);

    const writeOpts = existing && existing.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true };
    const result = await store.setJSON(key, nextValue, writeOpts);

    if (!result || result.modified !== false) {
      return nextValue;
    }
  }
  throw new Error(`Could not save changes to "${key}" due to concurrent updates. Please try again.`);
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

      if (url.searchParams.get('backups') === 'list') {
        const backupStore = getStore('props-inventory-backups');
        const { blobs } = await backupStore.list({ prefix: 'backup-' });
        const dates = blobs.map((b) => b.key.replace('backup-', '')).sort().reverse();
        return new Response(JSON.stringify({ dates }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }
        });
      }

      if (url.searchParams.get('brands') === 'list') {
        const brands = await store.get('brands', { type: 'json', consistency: 'strong' });
        return new Response(JSON.stringify({ brands: Array.isArray(brands) ? brands : [] }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }
        });
      }

      const backupDate = url.searchParams.get('backup');
      if (backupDate) {
        const backupStore = getStore('props-inventory-backups');
        const backup = await backupStore.get(`backup-${backupDate}`, { type: 'json' });
        return new Response(JSON.stringify({ backup: backup || null }), {
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

      if (body.addBrand) {
        const name = String(body.addBrand).trim();
        if (name) {
          await applyBlobUpdate(store, 'brands', (brands) => {
            const list = Array.isArray(brands) ? brands.slice() : [];
            if (!list.some((b) => b.toLowerCase() === name.toLowerCase())) {
              list.push(name);
            }
            return list;
          });
        }
      }

      if (body.renameBrand && body.renameBrand.from && body.renameBrand.to) {
        const from = String(body.renameBrand.from);
        const to = String(body.renameBrand.to);

        await applyBlobUpdate(store, 'brands', (brands) => {
          const list = Array.isArray(brands) ? brands.slice() : [];
          const idx = list.findIndex((b) => b.toLowerCase() === from.toLowerCase());
          if (idx >= 0) list[idx] = to;
          else if (!list.some((b) => b.toLowerCase() === to.toLowerCase())) list.push(to);
          return [...new Set(list)];
        });

        await applyBlobUpdate(store, 'items', (items) => {
          const next = Array.isArray(items) ? items : [];
          return next.map((it) =>
            it.brand && it.brand.toLowerCase() === from.toLowerCase()
              ? { ...it, brand: to }
              : it
          );
        });
      }

      if (body.migrate) {
        const m = body.migrate;
        await applyBlobUpdate(store, 'items', (items) => {
          const next = Array.isArray(items) ? items : [];
          return next.map((it) => {
            let updated = it;
            if (m.availability) {
              if (updated.availability === 'Disponibile') updated = { ...updated, availability: 'AVAILABLE' };
              if (['Non disponibile', 'In uso', 'Esaurito'].includes(updated.availability)) {
                updated = { ...updated, availability: 'MISSING' };
              }
            }
            if (m.defaultBrand && !updated.brand) {
              updated = { ...updated, brand: m.defaultBrand };
            }
            return updated;
          });
        });
      }

      if (body.upsertItem || body.deleteItemId || Array.isArray(body.items)) {
        await applyBlobUpdate(store, 'items', (items) => {
          let next = Array.isArray(items) ? items : [];

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

          if (Array.isArray(body.items)) {
            next = body.items;
          }

          return next;
        });
      }

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
