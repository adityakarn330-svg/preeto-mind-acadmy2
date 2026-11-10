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
      Authorization: 'Bearer ' + SB_KEY,
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

module.exports = { configured, sb, readBody, isAdmin, sleep };
