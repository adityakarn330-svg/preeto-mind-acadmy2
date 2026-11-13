// Student-facing: log in with Student ID + password, then read ONLY your own reports.
const { configured, sb, readBody, sleep, verifyPassword, signToken, verifyToken, tokenSecret } = require('./_lib');

const UUID = /^[0-9a-f-]{36}$/i;
const DUMMY = '00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
const fails = new Map(); // best-effort throttle (per server instance)
const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

function throttled(key) {
  const now = Date.now(), f = (fails.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  fails.set(key, f);
  return f.length >= 6;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured() || !tokenSecret()) return res.status(503).json({ error: 'The student portal is not set up yet.' });
  const b = readBody(req);
  try {
    if (b.action === 'login') {
      const code = String(b.student_code || '').trim().toUpperCase().slice(0, 30);
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const keys = ['c:' + code, 'i:' + ip];
      if (keys.some(throttled)) return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes and try again.' });
      const rows = /^[A-Z0-9-]{3,20}$/.test(code) ? await sb('students?student_code=eq.' + code + '&active=eq.true&select=id,password_hash') : [];
      const s = rows && rows[0];
      const ok = await verifyPassword(String(b.password || ''), s ? s.password_hash : DUMMY);
      if (!s || !ok) {
        keys.forEach((k) => fails.set(k, [...(fails.get(k) || []), Date.now()]));
        await sleep(600);
        return res.status(401).json({ error: 'Student ID or password is not correct.' });
      }
      return res.status(200).json({ token: signToken({ sid: s.id, exp: Date.now() + 12 * 3600 * 1000 }) });
    }
    if (b.action === 'me') {
      const h = req.headers['authorization'] || '';
      const p = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
      if (!p || !UUID.test(p.sid || '')) return res.status(401).json({ error: 'Please log in again.' });
      const rows = await sb('students?id=eq.' + p.sid + '&active=eq.true&select=id,student_code,name,batch_id');
      const s = rows && rows[0];
      if (!s) return res.status(401).json({ error: 'Please log in again.' });
      let batch = null, peers = [];
      if (s.batch_id) {
        const bb = await sb('batches?id=eq.' + s.batch_id + '&select=name,description');
        batch = bb && bb[0] ? bb[0] : null;
        peers = await sb('students?batch_id=eq.' + s.batch_id + '&select=id');
      }
      const mine = await sb('reports?student_id=eq.' + s.id + '&order=week_start.asc&select=week_start,score,attendance,remarks');
      let all = [];
      if (peers.length >= 3) all = await sb('reports?student_id=in.(' + peers.map((x) => x.id).join(',') + ')&select=week_start,score,attendance');
      const reports = mine.map((r) => {
        const w = all.filter((x) => x.week_start === r.week_start);
        const sc = w.filter((x) => x.score !== null).map((x) => Number(x.score));
        const at = w.filter((x) => x.attendance !== null).map((x) => Number(x.attendance));
        return { week_start: r.week_start, score: r.score === null ? null : Number(r.score), attendance: r.attendance === null ? null : Number(r.attendance), remarks: r.remarks || '',
          batch_avg_score: sc.length >= 3 ? avg(sc) : null, batch_avg_attendance: at.length >= 3 ? avg(at) : null };
      });
      return res.status(200).json({ student: { name: s.name, code: s.student_code }, batch, reports });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};
