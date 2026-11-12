const crypto = require('crypto');
const { sb } = require('./_lib');

const COOKIE = 'pm_student_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() { return process.env.STUDENT_SESSION_SECRET || ''; }
function b64(v) { return Buffer.from(v).toString('base64url'); }
function unb64(v) { return Buffer.from(v, 'base64url').toString('utf8'); }
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }

function passwordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: passwordHash(password, salt) };
}
function verifyPassword(password, salt, expected) {
  const actual = Buffer.from(passwordHash(password, salt), 'hex');
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}
function tokenFor(student) {
  const payload = b64(JSON.stringify({ sid: student.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  return payload + '.' + sign(payload);
}
function cookieHeader(token, clear = false) {
  return `${COOKIE}=${clear ? '' : token}; Path=/; Max-Age=${clear ? 0 : MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed cookie */ }
    }
  });
  return out;
}
function studentIdFromRequest(req) {
  if (!secret()) return null;
  const token = cookies(req)[COOKIE] || '';
  const [payload, given] = token.split('.');
  if (!payload || !given) return null;
  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(given);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const data = JSON.parse(unb64(payload));
    if (!data.sid || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.sid;
  } catch { return null; }
}
async function currentStudent(req) {
  const id = studentIdFromRequest(req);
  if (!id) return null;
  const rows = await sb('students?id=eq.' + encodeURIComponent(id) + '&select=id,student_id,full_name,email,phone,batch_id,status,joined_at');
  const student = rows && rows[0];
  return student && student.status === 'Active' ? student : null;
}
function requireSession(req, res) {
  if (!secret()) { res.status(503).json({ error: 'STUDENT_SESSION_SECRET is not configured on Vercel.' }); return false; }
  return true;
}
module.exports = { COOKIE, MAX_AGE, makePasswordHash, verifyPassword, tokenFor, cookieHeader, currentStudent, requireSession };
