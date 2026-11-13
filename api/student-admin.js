const { configured, sb, readBody, isAdmin } = require('./_lib');
const { makePasswordHash } = require('./student-lib');
const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES = ['Active','Paused','Completed','Inactive'];

function auth(req, res) {
  if (!process.env.ADMIN_PASSWORD) { res.status(503).json({ error: 'ADMIN_PASSWORD is not set on Vercel.' }); return false; }
  if (!isAdmin(req)) { res.status(401).json({ error: 'Wrong password' }); return false; }
  if (!configured()) { res.status(503).json({ error: 'Supabase is not connected.' }); return false; }
  return true;
}
function clean(v, n = 3000) { return String(v == null ? '' : v).trim().slice(0, n); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function date(v) { const x = clean(v, 20); return !x || /^\d{4}-\d{2}-\d{2}$/.test(x) ? (x || null) : null; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!auth(req, res)) return;
  const b = readBody(req);
  try {
    if (b.action === 'list') {
      const [batches, students, reports] = await Promise.all([
        sb('batches?order=created_at.desc&limit=200&select=id,name,description,subjects,start_date,end_date,status,created_at'),
        sb('students?order=created_at.desc&select=id,student_id,full_name,email,phone,batch_id,payment_method,payment_reference,paid_amount,paid_at,status,joined_at,created_at'),
        sb('weekly_reports?order=week_start.desc&limit=1000&select=id,student_id,week_start,week_end,attendance,score,topics,assignments,remarks,strengths,improvement_areas,created_at')
      ]);
      return res.status(200).json({ batches: batches || [], students: students || [], reports: reports || [] });
    }
    if (b.action === 'create_batch') {
      if (!clean(b.name, 160)) return res.status(400).json({ error: 'Batch name is required.' });
      const start = date(b.start_date), end = date(b.end_date); if ((b.start_date && !start) || (b.end_date && !end)) return res.status(400).json({ error: 'Use valid dates.' });
      const out = await sb('batches', { method: 'POST', body: JSON.stringify({ name: clean(b.name, 160), description: clean(b.description), subjects: clean(b.subjects, 1000), start_date: start, end_date: end, status: 'Active' }) });
      return res.status(200).json({ item: out && out[0] });
    }
    if (b.action === 'create_student') {
      const studentId = clean(b.student_id, 80), password = String(b.password || '');
      if (!studentId || !clean(b.full_name, 160) || password.length < 8) return res.status(400).json({ error: 'Name, Student ID, and a password of at least 8 characters are required.' });
      if (b.batch_id && !UUID.test(b.batch_id)) return res.status(400).json({ error: 'Invalid batch.' });
      const amount = b.paid_amount === '' ? null : num(b.paid_amount), paidAt = date(b.paid_at); if (amount !== null && (amount < 0 || amount > 100000000)) return res.status(400).json({ error: 'Enter a valid non-negative payment amount.' }); if (b.paid_at && !paidAt) return res.status(400).json({ error: 'Use a valid paid date.' });
      const ph = makePasswordHash(password);
      const out = await sb('students', { method: 'POST', body: JSON.stringify({ student_id: studentId, full_name: clean(b.full_name, 160), email: clean(b.email, 200), phone: clean(b.phone, 40), batch_id: b.batch_id || null, password_hash: ph.hash, password_salt: ph.salt, payment_method: ['UPI','Bank Transfer','Other'].includes(b.payment_method) ? b.payment_method : 'Other', payment_reference: clean(b.payment_reference, 200), paid_amount: amount, paid_at: paidAt, status: 'Active' }) });
      return res.status(200).json({ item: out && out[0], message: 'Student created. Give the Student ID and password to the student securely.' });
    }
    if (b.action === 'update_student') {
      if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'Invalid student.' });
      const patch = {};
      if (b.batch_id !== undefined) { if (b.batch_id && !UUID.test(b.batch_id)) return res.status(400).json({ error: 'Invalid batch.' }); patch.batch_id = b.batch_id || null; }
      if (typeof b.status === 'string' && STATUSES.includes(b.status)) patch.status = b.status;
      if (b.email !== undefined) patch.email = clean(b.email, 200);
      if (b.phone !== undefined) patch.phone = clean(b.phone, 40);
      if (b.password) { if (String(b.password).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' }); const ph = makePasswordHash(String(b.password)); patch.password_hash = ph.hash; patch.password_salt = ph.salt; }
      patch.updated_at = new Date().toISOString();
      const out = await sb('students?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', body: JSON.stringify(patch) });
      return res.status(200).json({ item: out && out[0] });
    }
    if (b.action === 'create_report') {
      if (!UUID.test(b.student_id || '')) return res.status(400).json({ error: 'Select a student.' });
      const start = date(b.week_start), end = date(b.week_end), attendance = num(b.attendance), score = num(b.score); if (!start || (b.week_end && !end) || (end && end < start)) return res.status(400).json({ error: 'Use valid report dates.' }); if (attendance === null || attendance < 0 || attendance > 100 || score === null || score < 0 || score > 100) return res.status(400).json({ error: 'Attendance and score must be between 0 and 100.' });
      const out = await sb('weekly_reports', { method: 'POST', body: JSON.stringify({ student_id: b.student_id, week_start: start, week_end: end, attendance, score, topics: clean(b.topics), assignments: clean(b.assignments), remarks: clean(b.remarks), strengths: clean(b.strengths), improvement_areas: clean(b.improvement_areas) }) });
      return res.status(200).json({ item: out && out[0] });
    }
    if (b.action === 'delete_report') {
      if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'Invalid report.' });
      await sb('weekly_reports?id=eq.' + encodeURIComponent(b.id), { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e.message);
    const duplicate = String(e.message).includes('409') || String(e.message).includes('23505');
    return res.status(duplicate ? 409 : 500).json({ error: duplicate ? 'That Student ID or weekly report already exists.' : 'Database problem. Check the student portal SQL migration.' });
  }
};
