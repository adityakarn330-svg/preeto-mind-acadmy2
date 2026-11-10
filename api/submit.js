// Public endpoint: saves an enquiry / review / team application so it appears in the admin dashboard.
const { configured, sb, readBody } = require('./_lib');

const TYPES = { enquiry: 'enquiry', review: 'review', team: 'team' };
const REQUIRED = { enquiry: ['student_name', 'parent_mobile'], review: ['name', 'review'], team: ['full_name'] };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!configured()) return res.status(503).json({ ok: false, error: 'Not configured' });

  const body = readBody(req);
  const type = TYPES[body.type];
  if (!type) return res.status(400).json({ ok: false, error: 'Unknown form' });

  const raw = body.data && typeof body.data === 'object' ? body.data : {};
  if (raw._honey) return res.status(200).json({ ok: true }); // bots fill the hidden field: pretend success

  const data = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_') || typeof v !== 'string' || count >= 30) continue;
    const key = k.replace(/[^a-z0-9_]/gi, '').slice(0, 40);
    if (!key) continue;
    data[key] = v.trim().slice(0, 3000);
    count++;
  }
  for (const f of REQUIRED[type]) {
    if (!data[f]) return res.status(400).json({ ok: false, error: 'Missing ' + f });
  }

  try {
    await sb('submissions', {
      method: 'POST',
      body: JSON.stringify({ type, status: 'New', published: false, data }),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ ok: false, error: 'Could not save' });
  }
};
