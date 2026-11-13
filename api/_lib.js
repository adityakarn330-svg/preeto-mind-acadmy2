// Shared helpers for the PreetoMind Academy API (Vercel serverless functions, no dependencies).
const crypto = require('crypto');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function configured() { return Boolean(SB_URL && SB_KEY); }

async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      // New-format keys (sb_secret_...) are not JWTs: send them on the apikey header only.
      ...(SB_KEY.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + SB_KEY }),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error('Database error ' + r.status + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }

function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return false;
  const h = req.headers['authorization'] || '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : '';
  return crypto.timingSafeEqual(sha(given), sha(pw));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const util = require('util');
const scrypt = util.promisify(crypto.scrypt);

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(String(pw), salt, 32);
  return salt.toString('hex') + ':' + h.toString('hex');
}
async function verifyPassword(pw, stored) {
  try {
    const [s, h] = String(stored).split(':');
    const d = await scrypt(String(pw), Buffer.from(s, 'hex'), 32);
    const e = Buffer.from(h, 'hex');
    return d.length === e.length && crypto.timingSafeEqual(d, e);
  } catch (e) { return false; }
}

function tokenSecret() { return process.env.PORTAL_SECRET || process.env.ADMIN_PASSWORD || ''; }
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(t) {
  try {
    const [body, sig] = String(t).split('.');
    const good = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig || ''), b = Buffer.from(good);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp && p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

module.exports = { configured, sb, readBody, isAdmin, sleep, hashPassword, verifyPassword, signToken, verifyToken, tokenSecret };
