#!/usr/bin/env node
/**
 * Validate QA test plan against test-plan.schema.json
 *
 * Uso:
 *   kg-cli validate test-plan runs/test-plan-login.json
 *   kg-cli validate test-plan runs/test-plan-login.md
 *   echo '{...}' | kg-cli validate test-plan -
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('./validate-plan');

const SCHEMA_FILE = path.join(__dirname, 'schemas', 'test-plan.schema.json');

function extractJson(raw, target) {
  if (target.endsWith('.md') || /^\s*#/.test(raw)) {
    const m = raw.match(/```json\s*([\s\S]+?)```/);
    if (!m) {
      throw new Error('No se encontró bloque ```json en el archivo .md');
    }
    return m[1];
  }
  return raw;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Uso: kg-cli validate test-plan <ruta.{json,md}|->');
    process.exit(2);
  }

  let raw;
  if (target === '-') {
    raw = fs.readFileSync(0, 'utf-8');
  } else if (!fs.existsSync(target)) {
    console.error(`Archivo no existe: ${target}`);
    process.exit(2);
  } else {
    raw = fs.readFileSync(target, 'utf-8');
  }

  let plan;
  try {
    plan = JSON.parse(extractJson(raw, target));
  } catch (e) {
    console.error(`JSON inválido: ${e.message}`);
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf-8'));
  const errors = validate(plan, schema);

  if (errors.length === 0) {
    console.log('✓ Test plan válido contra el schema.');
    console.log(`  module: ${plan.module}`);
    console.log(`  status: ${plan.status}`);
    console.log(`  scenarios: ${(plan.scenarios || []).length}`);
    console.log(`  bloqueantes: ${(plan.blockers || []).length}`);
    if (plan.status !== 'approved') {
      console.log('  ⚠ status != approved — no invocar qa-generator-agent hasta G1.');
    }
    if ((plan.blockers || []).some(b => b.severity === 'critical')) {
      console.log('  ✗ Hay bloqueantes CRITICAL.');
      process.exit(1);
    }
    process.exit(0);
  }

  console.error('✗ Test plan inválido:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { main };
