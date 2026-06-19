/**
 * Helper compartido — env loader, fetch helper, modelo, pricing.
 * No es ejecutable; lo requieren claude-probe / count-tokens / query.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');

const API_BASE = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-opus-4-5';

// pricing orden mag — opus 4.x (verificar en docs.anthropic.com)
const PRICE_INPUT_PER_TOKEN = 0.000015;   // $15 / 1M
const PRICE_OUTPUT_PER_TOKEN = 0.000075;  // $75 / 1M

function loadEnv(p = ENV_FILE) {
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      let value = m[2].replace(/^["']|["']$/g, '').trim();
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  });
}

function requireKey() {
  loadEnv();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('✗ Falta ANTHROPIC_API_KEY (en env o .env)');
    process.exit(1);
  }
  return key;
}

async function call(endpoint, body, apiKey) {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  });
  const latency = Date.now() - t0;
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { status: res.status, latency, payload };
}

function costOf(inputTokens, outputTokens = 0) {
  return inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;
}

module.exports = {
  ROOT,
  API_VERSION,
  MODEL,
  PRICE_INPUT_PER_TOKEN,
  PRICE_OUTPUT_PER_TOKEN,
  loadEnv,
  requireKey,
  call,
  costOf,
};
