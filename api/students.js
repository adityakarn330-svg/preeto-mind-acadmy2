// Admin-only: batches, students and weekly reports. Same password as the admin dashboard.
const crypto = require('crypto');
const { configured, sb, readBody, isAdmin, sleep, hashPassword } = require('./_lib');

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Za-z0-9-]{3,20}$/;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function genPassword() { let o = ''; for (let i = 0; i < 9; i++) o += ALPHA[crypto.randomInt(ALPHA.length)]; return o; }
function pct(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('BAD:Marks and attendance must be between 0 and 100.');
  return Math.round(n * 100) / 100;
}
const bad = (m) => new Error('BAD:' + m);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD is not set on Vercel.' });
  if (!isAdmin(req)) { await sleep(700); return res.status(401).json({ error: 'Wrong password' }); }
  if (!configured()) return res.status(503).json({ error: 'Supabase is not connected yet.' });
  const b = readBody(req);
  try {
    switch (b.action) {
      case 'overview': {
        const batches = await sb('batches?order=name.asc&select=*');
        const students = await sb('students?order=created_at.desc&select=id,student_code,name,batch_id,active,created_at');
        return res.status(200).json({ batches, students });
      }
      case 'batch_save': {
        const name = String(b.name || '').trim().slice(0, 80);
        if (!name) throw bad('Please enter a batch name.');
        const row = { name, description: String(b.description || '').trim().slice(0, 400) };
        const out = b.id
          ? (UUID.test(b.id) ? await sb('batches?id=eq.' + b.id, { method: 'PATCH', body: JSON.stringify(row) }) : (() => { throw bad('Bad id'); })())
          : await sb('batches', { method: 'POST', body: JSON.stringify(row) });
        return res.status(200).json({ batch: out && out[0] });
      }
      case 'batch_delete': {
        if (!UUID.test(b.id || '')) throw bad('Bad id');
        await sb('batches?id=eq.' + b.id, { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
      case 'student_save': {
        const name = String(b.name || '').trim().slice(0, 100);
        if (!name) throw bad("Please enter the student's name.");
        if (b.batch_id && !UUID.test(b.batch_id)) throw bad('Bad batch');
        const row = { name, batch_id: b.batch_id || null };
        if (typeof b.active === 'boolean') row.active = b.active;
        let plain = null;
        if (b.generate_password) plain = genPassword();
        else if (b.password) { if (String(b.password).length < 8) throw bad('Password must be at least 8 characters.'); plain = String(b.password); }
        if (plain) row.password_hash = await hashPassword(plain);
        if (b.id) {
          if (!UUID.test(b.id)) throw bad('Bad id');
          if (b.student_code) { if (!CODE.test(b.student_code)) throw bad('Student ID: 3-20 letters, numbers or dashes.'); row.student_code = String(b.student_code).toUpperCase(); }
          const out = await sb('students?id=eq.' + b.id, { method: 'PATCH', body: JSON.stringify(row) });
          const s = out && out[0]; if (s) delete s.password_hash;
          return res.status(200).json({ student: s, password: b.generate_password ? plain : undefined });
        }
        if (!plain) { plain = genPassword(); row.password_hash = await hashPassword(plain); }
        let code = String(b.student_code || '').trim().toUpperCase();
        if (code && !CODE.test(code)) throw bad('Student ID: 3-20 letters, numbers or dashes.');
        for (let i = 0; i < 6; i++) {
          const c = code || 'PMA-' + String(crypto.randomInt(10000)).padStart(4, '0');
          try {
            const out = await sb('students', { method: 'POST', body: JSON.stringify({ ...row, student_code: c }) });
            const s = out && out[0]; if (s) delete s.password_hash;
            return res.status(200).json({ student: s, password: plain });
          } catch (e) {
            if (/duplicate|23505/i.test(e.message)) { if (code) throw bad('That Student ID is already used.'); continue; }
            throw e;
          }
        }
        throw bad('Could not create an ID. Try again.');
      }
      case 'student_delete': {
        if (!UUID.test(b.id || '')) throw bad('Bad id');
        await sb('students?id=eq.' + b.id, { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
      case 'reports_for': {
        if (!UUID.test(b.batch_id || '') || !DATE.test(b.week_start || '')) throw bad('Choose a batch and a week.');
        const st = await sb('students?batch_id=eq.' + b.batch_id + '&active=eq.true&order=name.asc&select=id,student_code,name');
        let reps = [];
        if (st.length) reps = await sb('reports?week_start=eq.' + b.week_start + '&student_id=in.(' + st.map((x) => x.id).join(',') + ')&select=student_id,score,attendance,remarks');
        const by = {}; reps.forEach((r) => { by[r.student_id] = r; });
        return res.status(200).json({ rows: st.map((x) => ({ ...x, score: by[x.id] ? by[x.id].score : null, attendance: by[x.id] ? by[x.id].attendance : null, remarks: by[x.id] ? by[x.id].remarks : '' })) });
      }
      case 'reports_save': {
        if (!DATE.test(b.week_start || '')) throw bad('Choose a week.');
        const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 300).map((r) => {
          if (!UUID.test(r.student_id || '')) throw bad('Bad student');
          return { student_id: r.student_id, week_start: b.week_start, score: pct(r.score), attendance: pct(r.attendance), remarks: String(r.remarks || '').slice(0, 500) };
        }).filter((r) => r.score !== null || r.attendance !== null || r.remarks);
        if (!rows.length) throw bad('Nothing to save. Enter at least one mark, attendance or remark.');
        await sb('reports?on_conflict=student_id,week_start', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        return res.status(200).json({ ok: true, saved: rows.length });
      }
      default: return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    if (e.message.startsWith('BAD:')) return res.status(400).json({ error: e.message.slice(4) });
    console.error(e.message);
    return res.status(500).json({ error: 'Database problem. Did you run db/portal.sql in Supabase?' });
  }
};
