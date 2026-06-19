#!/usr/bin/env node
/**
 * Preflight QA — chequeos antes de analyzer/generator
 *
 * Uso:
 *   kg-cli preflight qa
 *   kg-cli preflight qa --module login
 *   kg-cli preflight qa --json
 *
 * Exit: 0 ok/warnings, 1 errores bloqueantes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig } = require('./_config');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

function checkAdb(out) {
  const devices = run('adb devices');
  if (!devices) {
    out.errors.push('adb no disponible en PATH.');
    return;
  }
  const lines = devices.split('\n').filter(l => l.trim() && !l.startsWith('List'));
  const connected = lines.filter(l => l.includes('device') && !l.includes('offline'));
  if (connected.length === 0) {
    out.warnings.push('Ningún dispositivo adb conectado (requerido para apk-to-locators).');
  } else {
    out.info.adbDevices = connected.length;
  }
}

function checkDataUser(dataPath, out) {
  if (!fs.existsSync(dataPath)) {
    out.errors.push(`No existe ${dataPath}. Copia templates/qa/data_user.template.json.`);
    return;
  }
  try {
    JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    out.info.dataUser = path.relative(process.cwd(), dataPath);
  } catch (e) {
    out.errors.push(`data_user.json inválido: ${e.message}`);
  }
}

function checkGradle(root, out) {
  const gradlew = path.join(root, 'gradlew');
  if (!fs.existsSync(gradlew)) {
    out.warnings.push('No hay ./gradlew en la raíz — arnés Gradle no podrá ejecutarse aquí.');
  } else {
    out.info.gradle = true;
  }
}

function checkEnvCredentials(out) {
  if (!process.env.DOCUMENT) {
    out.warnings.push('DOCUMENT no definido (export DOCUMENT=... para escenarios positivos).');
  }
  if (!process.env.PASSWORD) {
    out.warnings.push('PASSWORD no definido (export PASSWORD=...).');
  }
}

function checkQaGraph(graphPath, out) {
  if (!fs.existsSync(graphPath)) {
    out.warnings.push(`Sin ${graphPath}. Tras generar features: ./tools/kg-cli index qa`);
    return;
  }
  try {
    const g = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    out.info.qaCoverage = g.summary || {};
  } catch (e) {
    out.warnings.push(`Grafo QA ilegible: ${e.message}`);
  }
}

function checkModuleFeatures(featuresDir, moduleName, out) {
  if (!moduleName) return;
  const featureDir = path.join(featuresDir, moduleName);
  const featureFile = path.join(featuresDir, moduleName, `${moduleName}.feature`);
  if (!fs.existsSync(featureDir) && !fs.existsSync(featureFile)) {
    out.info.moduleFeatures = 'nuevo (sin carpeta aún)';
  }
}

function preflightQa(opts = {}) {
  const cfg = loadConfig();
  const qa = cfg.qa || {};
  const root = cfg.paths.root;
  const dataPath = path.join(root, qa.dataJsonPath || 'src/test/resources/data/data_user.json');
  const featuresDir = path.join(root, qa.featuresDir || 'src/test/resources/features');
  const graphPath = path.join(root, qa.coverageGraph || 'graph/qa-coverage-graph.json');

  const out = { ok: true, errors: [], warnings: [], info: { module: opts.module || null } };

  checkDataUser(dataPath, out);
  checkAdb(out);
  checkGradle(root, out);
  checkEnvCredentials(out);
  checkQaGraph(graphPath, out);
  checkModuleFeatures(featuresDir, opts.module, out);

  if (out.errors.length) out.ok = false;
  return out;
}

function printHuman(r) {
  const tag = r.ok ? '✓' : '✗';
  console.log(`\n${tag} Preflight QA`);
  if (r.info.module) console.log(`  módulo: ${r.info.module}`);
  Object.entries(r.info).forEach(([k, v]) => {
    if (k === 'module') return;
    console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  });
  r.errors.forEach(e => console.log(`  ✗ ${e}`));
  r.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const moduleIdx = args.indexOf('--module');
  const module = moduleIdx >= 0 ? args[moduleIdx + 1] : null;

  const result = preflightQa({ module });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { preflightQa };
