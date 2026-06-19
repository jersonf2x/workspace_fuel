#!/usr/bin/env node
/**
 * Probe Anthropic API — verifica auth y crédito SIN gastar (apenas).
 *
 * Hace 2 llamadas:
 *   1. POST /v1/messages/count_tokens — gratis. Detecta 401/403 (key mala).
 *   2. POST /v1/messages con max_tokens=1 — gasto mínimo (~1 token output).
 *      Detecta 429 credit_balance_too_low.
 *
 * Lee ANTHROPIC_API_KEY desde .env en raíz o env var.
 *
 * Uso:  node graph-builder/claude-probe.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const API_BASE = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-opus-4-5'; // alias estable opus 4.x

// ── env loader sin dotenv ────────────────────────────────────────────────

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      let value = m[2];
      // strip surrounding quotes y trailing whitespace
      value = value.replace(/^["']|["']$/g, '').trim();
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  });
}

loadEnv(ENV_FILE);

// ── helpers ──────────────────────────────────────────────────────────────

function maskKey(k) {
  if (!k) return '(missing)';
  if (k.length < 16) return k.slice(0, 4) + '…';
  return k.slice(0, 10) + '…' + k.slice(-4);
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

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;

  console.log('\n' + '═'.repeat(56));
  console.log('🔬 Anthropic API probe');
  console.log('═'.repeat(56));
  console.log(`  .env path:    ${path.relative(ROOT, ENV_FILE)}`);
  console.log(`  Key cargada:  ${maskKey(key)}`);
  console.log(`  Modelo:       ${MODEL}`);
  console.log('─'.repeat(56));

  if (!key) {
    console.error('\n✗ No hay ANTHROPIC_API_KEY en el env ni en .env');
    console.error('  Edita .env y agrega: ANTHROPIC_API_KEY=sk-ant-…\n');
    process.exit(1);
  }

  // ── Step 1: count_tokens (gratis) — valida auth ──
  console.log('\n[1/2] POST /v1/messages/count_tokens (gratis, valida key)');
  const r1 = await call('/v1/messages/count_tokens', {
    model: MODEL,
    messages: [{ role: 'user', content: 'hola' }],
  }, key);

  console.log(`      status: ${r1.status}   latency: ${r1.latency}ms`);
  if (r1.status === 200) {
    console.log(`      ✓ key válida. input_tokens=${r1.payload?.input_tokens}`);
  } else if (r1.status === 401 || r1.status === 403) {
    console.error(`      ✗ AUTH FALLA: ${r1.payload?.error?.type} — ${r1.payload?.error?.message}`);
    console.error('      Revisa que la key esté completa y activa en console.anthropic.com\n');
    process.exit(1);
  } else {
    console.error(`      ⚠ status inesperado: ${JSON.stringify(r1.payload)}\n`);
  }

  // ── Step 2: /v1/messages max_tokens=1 — valida crédito ──
  console.log('\n[2/2] POST /v1/messages (max_tokens=1, valida crédito)');
  const r2 = await call('/v1/messages', {
    model: MODEL,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'hi' }],
  }, key);

  console.log(`      status: ${r2.status}   latency: ${r2.latency}ms`);

  if (r2.status === 200) {
    const usage = r2.payload?.usage || {};
    const cost = ((usage.input_tokens || 0) * 0.000015) + ((usage.output_tokens || 0) * 0.000075);
    console.log(`      ✓ crédito OK.`);
    console.log(`      input_tokens:  ${usage.input_tokens}`);
    console.log(`      output_tokens: ${usage.output_tokens}`);
    console.log(`      costo probe:   $${cost.toFixed(6)} (orden mag opus 4)`);
  } else if (r2.status === 429) {
    console.error(`      ✗ CRÉDITO INSUFICIENTE: ${r2.payload?.error?.type} — ${r2.payload?.error?.message}`);
    console.error('      Ve a https://console.anthropic.com/settings/billing para recargar.\n');
    process.exit(2);
  } else if (r2.status === 400 && /model/i.test(r2.payload?.error?.message || '')) {
    console.error(`      ✗ Modelo "${MODEL}" no aceptado por API: ${r2.payload?.error?.message}`);
    console.error('      Probá con: claude-opus-4-5, claude-sonnet-4-5, claude-3-5-sonnet-latest\n');
    process.exit(3);
  } else {
    console.error(`      ⚠ status inesperado: ${JSON.stringify(r2.payload)}\n`);
    process.exit(4);
  }

  console.log('\n' + '═'.repeat(56));
  console.log('✅ Listo para correr scripts F (queryWithGraph real).');
  console.log('═'.repeat(56) + '\n');
}

main().catch(err => {
  console.error('\n✗ Error de red o runtime:', err.message, '\n');
  process.exit(99);
});
