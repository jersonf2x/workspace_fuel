#!/usr/bin/env node
/**
 * i18n indexer — escanea archivos de internacionalización (i18n) en MFE y Shell.
 *
 * Detecta:
 *   - MFE Angular: archivos en `**\/i18n/*.{json,yaml,yml}` o `**\/assets/i18n/*.json`
 *   - Shell Flutter: archivos slang `**\/i18n/*.{i18n.yaml,yaml,json}` o `**\/lib/l10n/*.arb`
 *
 * Output: graph/i18n-registry.json — listado plano de keys por proyecto.
 *
 * Uso:
 *   kg-cli index i18n
 *   kg-cli index i18n --project=mfe
 *   kg-cli index i18n --json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { loadConfig } = require('./_config');

const SCHEMA_VERSION = '0.4.0';

function main() {
  const args = process.argv.slice(2);
  const onlyProject = args.find(a => a.startsWith('--project='))?.split('=')[1];
  const asJson = args.includes('--json');

  const cfg = loadConfig();
  const ROOT = cfg.paths.root;
  const OUT = path.join(cfg.paths.graphDir, 'i18n-registry.json');

  // Detectar proyectos desde graphify.config.json domains
  const domains = cfg.domains || {};
  const projects = [];

  // MFE
  if ((!onlyProject || onlyProject === 'mfe') && domains.webApp?.path) {
    const mfeRoot = path.join(ROOT, domains.webApp.path);
    if (fs.existsSync(mfeRoot)) {
      const p = scanMfe(mfeRoot, domains.webApp.path);
      if (p) projects.push(p);
    }
  }
  // Fallback path típico
  if ((!onlyProject || onlyProject === 'mfe') && projects.length === 0) {
    const fallback = path.join(ROOT, 'frontend/MFE_user_experience-flypass_mfe_web');
    if (fs.existsSync(fallback)) {
      const p = scanMfe(fallback, 'frontend/MFE_user_experience-flypass_mfe_web');
      if (p) projects.push(p);
    }
  }

  // Shell
  if ((!onlyProject || onlyProject === 'shell') && domains.mobileShell?.path) {
    const shellRoot = path.join(ROOT, domains.mobileShell.path);
    if (fs.existsSync(shellRoot)) {
      const p = scanShell(shellRoot, domains.mobileShell.path);
      if (p) projects.push(p);
    }
  }
  if ((!onlyProject || onlyProject === 'shell') && !projects.some(p => p.type === 'shell')) {
    const fallback = path.join(ROOT, 'frontend/SHELL_user_experience-flypass_shell_application_mobile');
    if (fs.existsSync(fallback)) {
      const p = scanShell(fallback, 'frontend/SHELL_user_experience-flypass_shell_application_mobile');
      if (p) projects.push(p);
    }
  }

  const out = {
    _meta: {
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      git_sha: tryGitSha(ROOT),
      indexer: 'i18n-indexer',
      indexer_version: SCHEMA_VERSION,
      stale: false,
    },
    projects,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log(`✓ i18n registry escrito en ${path.relative(ROOT, OUT)}`);
  projects.forEach(p => {
    console.log(`  ${p.name} (${p.type}): ${p.keys.length} keys en ${p.files.length} archivo(s)`);
  });
  if (projects.length === 0) {
    console.log('  ⚠ Sin proyectos detectados. Revisá graphify.config.json o que frontend/ tenga MFE/Shell.');
  }
  process.exit(0);
}

function tryGitSha(root) {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf-8' }).trim();
  } catch (_) {
    return null;
  }
}

function walkFiles(dir, predicate, maxDepth = 8, depth = 0, out = []) {
  if (depth > maxDepth) return out;
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'build' ||
        e.name === '.dart_tool' || e.name === 'dist' || e.name === 'coverage' ||
        e.name === '.next' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, predicate, maxDepth, depth + 1, out);
    } else if (predicate(full, e.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanMfe(root, relRoot) {
  const candidates = walkFiles(root, (full, name) => {
    return (full.includes('/i18n/') || full.includes('/assets/i18n/') || full.includes('/locales/'))
      && /\.(json|ya?ml)$/i.test(name);
  });
  if (candidates.length === 0) return null;

  const keys = new Set();
  const files = [];

  for (const f of candidates) {
    files.push(path.relative(root, f));
    try {
      const content = fs.readFileSync(f, 'utf-8');
      let parsed;
      if (/\.json$/.test(f)) {
        parsed = JSON.parse(content);
      } else {
        parsed = parseYamlLite(content);
      }
      flatten(parsed, '', keys);
    } catch (e) {
      // skip malformed
    }
  }

  return {
    name: path.basename(root),
    type: 'mfe',
    root: relRoot,
    files,
    keys: Array.from(keys).sort(),
    namespaces: Array.from(new Set(Array.from(keys).map(k => k.split('.')[0]))).sort(),
  };
}

function scanShell(root, relRoot) {
  // slang YAML/JSON o ARB
  const candidates = walkFiles(root, (full, name) => {
    if (/\.arb$/i.test(name)) return true;
    if (/\.(i18n\.)?(json|ya?ml)$/i.test(name) && (full.includes('/i18n/') || full.includes('/l10n/'))) return true;
    return false;
  });
  if (candidates.length === 0) return null;

  const keys = new Set();
  const files = [];

  for (const f of candidates) {
    files.push(path.relative(root, f));
    try {
      const content = fs.readFileSync(f, 'utf-8');
      let parsed;
      if (/\.(json|arb)$/i.test(f)) {
        parsed = JSON.parse(content);
        // ARB tiene metadata con prefijo @, filtramos
        if (parsed && typeof parsed === 'object') {
          for (const k of Object.keys(parsed)) {
            if (!k.startsWith('@') && k !== '@@locale') keys.add(k);
          }
        }
      } else {
        parsed = parseYamlLite(content);
        flatten(parsed, '', keys);
      }
    } catch (e) {
      // skip
    }
  }

  return {
    name: path.basename(root),
    type: 'shell',
    root: relRoot,
    files,
    keys: Array.from(keys).sort(),
    namespaces: Array.from(new Set(Array.from(keys).map(k => k.split('.')[0]))).sort(),
  };
}

function flatten(obj, prefix, out) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('@')) continue;
    const val = obj[k];
    const full = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flatten(val, full, out);
    } else {
      out.add(full);
    }
  }
}

// Parser YAML minimal — solo soporta key: value y anidamiento por indent. Suficiente para slang/Angular.
function parseYamlLite(text) {
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  const lines = text.split('\n');
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^(\s*)/)[1].length;
    const line = raw.trim();
    const m = line.match(/^([\w\-.]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;
    if (!value) {
      parent[key] = {};
      stack.push({ obj: parent[key], indent });
    } else {
      parent[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

if (require.main === module) {
  main();
}

module.exports = { main, scanMfe, scanShell };
