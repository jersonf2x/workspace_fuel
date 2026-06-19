#!/usr/bin/env node
/**
 * MFE Indexer — escanea apps Angular del monorepo MFE y genera MFE-Graph nodes.
 * Input:  frontend/MFE_user_experience-flypass_mfe_web/apps/
 * Output: { remotes: MFERemote[] }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./_config');

const cfg = loadConfig();
const WORKSPACE = cfg.paths.root;

function resolveWorkspacePath(input) {
  if (!input) return null;
  return path.isAbsolute(input) ? input : path.join(WORKSPACE, input);
}

const MFE_ROOT = resolveWorkspacePath(cfg.frontend.mfeRoot);
// Soporta varios directorios de MFEs (ej. apps/ + packages/). `mfeAppsDirs`
// (array) tiene prioridad; `mfeAppsDir` (string) se mantiene por compat.
const APPS_DIRS = (
  Array.isArray(cfg.frontend.mfeAppsDirs) && cfg.frontend.mfeAppsDirs.length
    ? cfg.frontend.mfeAppsDirs
    : cfg.frontend.mfeAppsDir
      ? [cfg.frontend.mfeAppsDir]
      : MFE_ROOT ? [path.join(MFE_ROOT, 'apps')] : []
).map(resolveWorkspacePath);

// ── Helpers ────────────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

function findFiles(dir, pattern, excludes = []) {
  const results = [];
  if (!dir || !fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.cache', 'coverage'].includes(entry.name)) {
        results.push(...findFiles(full, pattern, excludes));
      }
    } else if (pattern.test(entry.name) && !excludes.some(e => full.includes(e))) {
      results.push(full);
    }
  }
  return results;
}

function extractClassName(content) {
  const m = content.match(/export\s+class\s+(\w+)/);
  return m ? m[1] : null;
}

function extractDecorator(content, decorator) {
  const re = new RegExp(`@${decorator}\\s*\\([^)]*\\)`, 's');
  return re.test(content);
}

function extractComponentClassName(content) {
  return (
    extractClassName(content) ||
    content.match(/@Component\s*[\(\{][\s\S]*?export\s+class\s+(\w+)/)?.[1] ||
    content.match(/export\s+class\s+(\w+)[\s\S]*?@Component\s*[\(\{]/)?.[1]
  );
}

function indexComponents(appDir) {
  const components = [];
  const seenFiles = new Set();
  const presentationDir = path.join(appDir, 'src/presentation');
  const excludePatterns = [
    '.spec.',
    'mock',
    '.facade.',
    '.service.',
    '.routes.',
    '.module.',
    '.pipe.',
    '.directive.',
    '.guard.',
    '.resolver.',
    '.interceptor.',
  ];

  const addComponent = (file, content) => {
    if (seenFiles.has(file)) return;
    const cls = extractComponentClassName(content);
    if (!cls) return;
    seenFiles.add(file);
    components.push({
      name: cls,
      onPush: content.includes('ChangeDetectionStrategy.OnPush') || /\bonPush\s*:\s*true\b/.test(content),
      file: path.relative(MFE_ROOT, file),
    });
  };

  for (const file of findFiles(presentationDir, /\.component\.ts$/, excludePatterns)) {
    addComponent(file, readFile(file));
  }

  for (const file of findFiles(presentationDir, /\.ts$/, excludePatterns)) {
    const content = readFile(file);
    if (/@Component\s*[\(\{]/.test(content)) {
      addComponent(file, content);
    }
  }

  return components;
}

// ── Remote name desde module-federation.config.ts ─────────────────────────

function extractRemoteName(appDir) {
  const cfgFile = path.join(appDir, 'module-federation.config.ts');
  const content = readFile(cfgFile);
  const m = content.match(/name\s*:\s*['"]([^'"]+)['"]/);
  return m ? m[1] : path.basename(appDir);
}

function extractExposes(appDir) {
  const cfgFile = path.join(appDir, 'module-federation.config.ts');
  const content = readFile(cfgFile);
  const exposes = {};
  const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  let inExposes = false;
  for (const line of content.split('\n')) {
    if (line.includes('exposes')) { inExposes = true; continue; }
    if (inExposes && line.includes('}')) { inExposes = false; continue; }
    if (inExposes) {
      while ((m = re.exec(line)) !== null) {
        exposes[m[1]] = m[2];
      }
    }
  }
  return exposes;
}

// ── BFF endpoints desde datasources ───────────────────────────────────────

function indexDatasources(appDir) {
  const datasources = [];
  const files = findFiles(path.join(appDir, 'src/data'), /\.api\.datasource\.ts$/, ['.spec.']);
  for (const file of files) {
    const content = readFile(file);
    const className = extractClassName(content);
    const endpoints = [];
    // Extraer PATH_URL constants
    const pathRe = /(?:PATH_URL|PATH|URL)\s*=\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = pathRe.exec(content)) !== null) endpoints.push(m[1]);
    // Extraer llamadas http.get/post/put/delete con paths literales
    const httpRe = /this\.http\.(get|post|put|delete|patch)<[^>]*>\(`[^`]*\$\{[^}]+\}([^`]*)`/g;
    while ((m = httpRe.exec(content)) !== null) {
      if (m[2] && m[2].trim()) endpoints.push(m[2].trim());
    }
    if (className || endpoints.length > 0) {
      datasources.push({
        className: className || path.basename(file, '.ts'),
        file: path.relative(MFE_ROOT, file),
        endpoints: [...new Set(endpoints)]
      });
    }
  }
  return datasources;
}

// ── Domain: entities, use-cases, repositories ─────────────────────────────

function indexDomain(appDir) {
  const entities = [];
  const useCases = [];

  const entityFiles = findFiles(path.join(appDir, 'src/domain'), /\.entity\.ts$/, ['.spec.', 'mock']);
  for (const f of entityFiles) {
    const content = readFile(f);
    // Entidades usan interface, type o class
    const nameMatch =
      content.match(/export\s+interface\s+(\w+)/) ||
      content.match(/export\s+type\s+(\w+)\s*=/) ||
      content.match(/export\s+class\s+(\w+)/);
    if (nameMatch) {
      const fields = [...content.matchAll(/(\w+)[\?]?\s*:\s*([^;\n]+)/g)]
        .slice(0, 8)
        .map(m => ({ name: m[1].trim(), type: m[2].trim() }));
      entities.push({ name: nameMatch[1], fields, file: path.relative(MFE_ROOT, f) });
    }
  }

  const ucFiles = findFiles(path.join(appDir, 'src/domain'), /\.usecase\.ts$|use-case\.ts$/, ['.spec.', 'mock']);
  for (const f of ucFiles) {
    const content = readFile(f);
    const cls = extractClassName(content) ||
      content.match(/export\s+class\s+(\w+)/)?.[1];
    const execMethod = content.match(/(?:execute|call|run)\s*\(([^)]*)\)/)?.[0] || null;
    if (cls) useCases.push({ name: cls, execMethod, file: path.relative(MFE_ROOT, f) });
  }

  return { entities, useCases };
}

// ── Presentation: facades, state services, components ─────────────────────

function indexPresentation(appDir) {
  const facades = [];
  const services = [];

  // Facades
  const facadeFiles = findFiles(path.join(appDir, 'src/presentation'), /\.facade\.ts$/, ['.spec.', 'mock']);
  for (const f of facadeFiles) {
    const content = readFile(f);
    const cls = extractClassName(content);
    const usesSignal = content.includes('signal(');
    const usesFlux = content.includes('BehaviorSubject') || content.includes('Store') || content.includes('@ngrx');
    if (cls) facades.push({
      name: cls,
      stateModel: usesSignal ? 'signals' : usesFlux ? 'flux' : 'unknown',
      file: path.relative(MFE_ROOT, f)
    });
  }

  // State services
  const stateFiles = findFiles(path.join(appDir, 'src/presentation'), /\.service\.ts$/, ['.spec.', 'mock']);
  for (const f of stateFiles) {
    const content = readFile(f);
    const cls = extractClassName(content);
    if (cls) services.push({ name: cls, file: path.relative(MFE_ROOT, f) });
  }

  // Components — *.component.ts (clásico) o @Component en .ts flat (Angular standalone).
  const components = indexComponents(appDir);

  return { facades, services, components };
}

// ── Routes ─────────────────────────────────────────────────────────────────

function indexRoutes(appDir) {
  const routes = [];
  const routeFiles = findFiles(path.join(appDir, 'src'), /\.routes\.ts$|remote-routes\.ts$/, ['.spec.']);
  for (const f of routeFiles) {
    const content = readFile(f);
    const pathRe = /path\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = pathRe.exec(content)) !== null) {
      if (m[1] !== '') routes.push({ path: m[1], file: path.relative(MFE_ROOT, f) });
    }
  }
  return routes;
}

// ── Main ───────────────────────────────────────────────────────────────────

function indexMFE() {
  const result = { remotes: [] };

  if (!APPS_DIRS.length) return result;

  for (const appsDir of APPS_DIRS) {
    if (!appsDir || !fs.existsSync(appsDir)) {
      console.warn('[mfe-indexer] APPS_DIR not found:', appsDir);
      continue;
    }

    const apps = fs.readdirSync(appsDir).filter(a =>
      fs.statSync(path.join(appsDir, a)).isDirectory() &&
      // un MFE/lib real tiene src/ o project.json — evita carpetas sueltas
      (fs.existsSync(path.join(appsDir, a, 'src')) || fs.existsSync(path.join(appsDir, a, 'project.json')))
    );

    for (const app of apps) {
      const appDir = path.join(appsDir, app);
      const remoteName = extractRemoteName(appDir);
      if (result.remotes.some(r => r.id === remoteName)) continue;
      const exposes = extractExposes(appDir);
      const isHost = remoteName.includes('host');

      const remote = {
        id: remoteName,
        dir: MFE_ROOT ? path.relative(MFE_ROOT, appDir) : appDir,
        isHost,
        exposes,
        datasources: indexDatasources(appDir),
        domain: indexDomain(appDir),
        presentation: indexPresentation(appDir),
        routes: indexRoutes(appDir)
      };

      result.remotes.push(remote);
      console.error(`[mfe-indexer] ${remoteName}: ${remote.domain.entities.length} entities, ${remote.presentation.facades.length} facades, ${remote.presentation.components.length} components`);
    }
  }

  return result;
}

module.exports = { indexMFE };

if (require.main === module) {
  console.log(JSON.stringify(indexMFE(), null, 2));
}
