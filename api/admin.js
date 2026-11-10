// Password-protected endpoint used by the admin dashboard.
const { configured, sb, readBody, isAdmin, sleep } = require('./_lib');

const STATUSES = ['New', 'Contacted', 'Demo', 'Admitted', 'Closed'];
const UUID = /^[0-9a-f-]{36}$/i;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD is not set on Vercel.' });
  if (!isAdmin(req)) { await sleep(700); return res.status(401).json({ error: 'Wrong password' }); }
  if (!configured()) return res.status(503).json({ error: 'Supabase is not connected yet (SUPABASE_URL / SUPABASE_SERVICE_KEY).' });

  const b = readBody(req);
  try {
    if (b.action === 'list') {
      const rows = await sb('submissions?order=created_at.desc&limit=500&select=*');
      return res.status(200).json({ items: rows || [] });
    }
    if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'Bad id' });
    if (b.action === 'update') {
      const patch = {};
      if (typeof b.status === 'string' && STATUSES.includes(b.status)) patch.status = b.status;
      if (typeof b.published === 'boolean') patch.published = b.published;
      if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 3000);
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' });
      const out = await sb('submissions?id=eq.' + b.id, { method: 'PATCH', body: JSON.stringify(patch) });
      return res.status(200).json({ item: out && out[0] });
    }
    if (b.action === 'delete') {
      await sb('submissions?id=eq.' + b.id, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: 'Database problem. Check the Supabase settings.' });
  }
};
