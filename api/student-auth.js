const { configured, sb, readBody } = require('./_lib');
const { verifyPassword, tokenFor, cookieHeader, currentStudent, requireSession } = require('./student-lib');
const attempts = new Map();
function clientKey(req, studentId) { return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0] + ':' + studentId.toLowerCase(); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ error: 'Database is not configured.' });
  if (req.method === 'POST') {
    const body = readBody(req);
    if (body.action === 'logout') {
      res.setHeader('Set-Cookie', cookieHeader('', true));
      return res.status(200).json({ ok: true });
    }
    if (!requireSession(req, res)) return;
    const studentId = String(body.student_id || '').trim().slice(0, 80);
    const password = String(body.password || '');
    if (!studentId || !password) return res.status(400).json({ error: 'Enter your Student ID and password.' });
    const key = clientKey(req, studentId), now = Date.now(), recent = attempts.get(key);
    if (recent && recent.until > now && recent.count >= 5) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    try {
      const rows = await sb('students?student_id=eq.' + encodeURIComponent(studentId) + '&select=id,student_id,full_name,password_hash,password_salt,status');
      const student = rows && rows[0];
      if (!student || student.status !== 'Active' || !verifyPassword(password, student.password_salt, student.password_hash)) {
        const old = attempts.get(key); attempts.set(key, { count: (old && old.until > now ? old.count : 0) + 1, until: now + 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Student ID or password is incorrect.' });
      }
      attempts.delete(key);
      res.setHeader('Set-Cookie', cookieHeader(tokenFor(student)));
      return res.status(200).json({ ok: true, student: { student_id: student.student_id, full_name: student.full_name } });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Could not sign in right now.' });
    }
  }
  if (req.method === 'GET') {
    if (!requireSession(req, res)) return;
    try {
      const student = await currentStudent(req);
      if (!student) return res.status(401).json({ error: 'Not signed in.' });
      return res.status(200).json({ ok: true, student });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Could not check the session.' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
