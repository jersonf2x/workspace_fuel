#!/usr/bin/env node
/**
 * Shell Indexer — escanea features y packages Flutter y genera Shell-Graph nodes.
 * Input:  frontend/SHELL_user_experience-flypass_shell_application_mobile/
 * Output: { features: ShellFeature[], uiKitComponents: UIKitComponent[], bridgeEvents: BridgeEvent[] }
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

const SHELL_ROOT = resolveWorkspacePath(cfg.frontend.shellRoot);
const FEATURES_DIR = cfg.frontend.shellFeaturesDir
  ? resolveWorkspacePath(cfg.frontend.shellFeaturesDir)
  : (SHELL_ROOT ? path.join(SHELL_ROOT, 'features') : null);
const UI_KIT_DIR = cfg.frontend.shellUiKitDir
  ? resolveWorkspacePath(cfg.frontend.shellUiKitDir)
  : (SHELL_ROOT ? path.join(SHELL_ROOT, 'packages/flypass_app_ui_kit/lib') : null);

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
      if (!['build', '.dart_tool', 'coverage', '.gradle', 'generated'].includes(entry.name)) {
        results.push(...findFiles(full, pattern, excludes));
      }
    } else if (pattern.test(entry.name) && !excludes.some(e => full.includes(e))) {
      results.push(full);
    }
  }
  return results;
}

// ── Cubits ─────────────────────────────────────────────────────────────────

function indexCubits(featureDir) {
  const cubits = [];
  const files = findFiles(featureDir, /\.dart$/, ['_test.dart', '.g.dart']);
  for (const f of files) {
    const content = readFile(f);
    // class XxxCubit extends Cubit<XxxState>
    const m = content.match(/class\s+(\w+Cubit)\s+extends\s+(?:HydratedCubit|Cubit)<(\w+)>/);
    if (m) {
      const states = [...content.matchAll(/class\s+(\w+State)\b/g)].map(s => s[1]);
      const events = [...content.matchAll(/on<(\w+)>/g)].map(e => e[1]);
      cubits.push({
        name: m[1],
        stateType: m[2],
        states,
        events,
        file: path.relative(SHELL_ROOT, f)
      });
    }
  }
  return cubits;
}

// ── Pages (presentación) ───────────────────────────────────────────────────

function indexPages(featureDir) {
  const pages = [];
  const files = findFiles(featureDir, /page\.dart$|_page\.dart$/, ['_test.dart']);
  for (const f of files) {
    const content = readFile(f);
    const m = content.match(/class\s+(\w+Page)\s+extends\s+\w+/);
    if (m) {
      // detectar si tiene InAppWebView (WebView MFE)
      const isWebView = content.includes('InAppWebView') || content.includes('WebView') || content.includes('MicroProductsPage');
      // buscar URL de MFE si existe
      const urlMatch = content.match(/url\s*[=:]\s*['"`]([^'"`]+)['"`]/) ||
                       content.match(/defaultMicrofrontendUrl/) ||
                       content.match(/microProducts\.\w+Url/);
      pages.push({
        name: m[1],
        isWebView: isWebView,
        mfeUrl: urlMatch ? urlMatch[1] : null,
        file: path.relative(SHELL_ROOT, f)
      });
    }
  }
  return pages;
}

// ── Routes ─────────────────────────────────────────────────────────────────

function indexRoutes(featureDir) {
  const routes = [];
  const files = findFiles(path.join(featureDir, 'lib/src/routes'), /\.dart$/, ['_test.dart']);
  for (const f of files) {
    const content = readFile(f);
    // enum F2xRoutes { xxx('/path') }
    const enumRe = /(\w+)\s*\(['"]([^'"]+)['"]\)/g;
    let m;
    while ((m = enumRe.exec(content)) !== null) {
      if (m[2].startsWith('/')) {
        routes.push({ name: m[1], path: m[2], file: path.relative(SHELL_ROOT, f) });
      }
    }
    // GoRoute(path: '/...')
    const goRouteRe = /path\s*:\s*['"]([^'"]+)['"]/g;
    while ((m = goRouteRe.exec(content)) !== null) {
      if (m[1].startsWith('/') && !routes.find(r => r.path === m[1])) {
        routes.push({ name: path.basename(f, '.dart'), path: m[1], file: path.relative(SHELL_ROOT, f) });
      }
    }
  }
  return routes;
}

// ── Bridge events desde micro_products ────────────────────────────────────

function indexBridgeEvents() {
  const events = [];
  const bridgeDir = path.join(FEATURES_DIR, 'micro_products/lib/src');
  const files = findFiles(bridgeDir, /\.dart$/, ['_test.dart', '.g.dart']);

  for (const f of files) {
    const content = readFile(f);
    // native.xxx.yyy patterns
    const evtRe = /['"`](native\.[a-zA-Z.]+)['"`]/g;
    let m;
    while ((m = evtRe.exec(content)) !== null) {
      if (!events.find(e => e.name === m[1])) {
        events.push({
          name: m[1],
          file: path.relative(SHELL_ROOT, f),
          direction: content.includes('send') || content.includes('emit') ? 'produced' : 'consumed'
        });
      }
    }
  }
  return events;
}

// ── UI Kit Components ──────────────────────────────────────────────────────

function indexUIKit() {
  const components = [];
  if (!fs.existsSync(UI_KIT_DIR)) return components;

  const files = findFiles(UI_KIT_DIR, /\.dart$/, ['_test.dart', '.g.dart']);
  for (const f of files) {
    const content = readFile(f);
    // class F2xXxxWidget extends StatelessWidget / StatefulWidget
    const m = content.match(/class\s+(F2x\w+|Flypass\w+)\s+extends\s+(Stateless|Stateful)Widget/);
    if (m) {
      // tokens usados (buscar Color/spacing constants)
      const tokenRefs = [...content.matchAll(/F2xColors\.(\w+)|F2xSpacing\.(\w+)|F2xTypo\.(\w+)/g)]
        .map(t => t[1] || t[2] || t[3]);
      // props del constructor
      const props = [...content.matchAll(/final\s+(\w+[\?]?)\s+(\w+);/g)]
        .slice(0, 6)
        .map(p => `${p[2]}:${p[1]}`);
      components.push({
        name: m[1],
        widgetType: m[2] + 'Widget',
        tokens: [...new Set(tokenRefs)],
        props,
        file: path.relative(SHELL_ROOT, f)
      });
    }
  }
  return components;
}

// ── Native capabilities (from pubspec.yaml) ────────────────────────────────
// Regla: capacidades nativas → SIEMPRE Shell Flutter, NUNCA MFE

const NATIVE_PLUGINS = {
  'connectivity_plus':           { capability: 'connectivity',       description: 'Detección de conectividad / internet' },
  'internet_connection_checker': { capability: 'connectivity',       description: 'Verificación de conexión a internet' },
  'camera':                      { capability: 'camera',             description: 'Acceso a cámara del dispositivo' },
  'image_picker':                { capability: 'camera',             description: 'Selección de imágenes / cámara' },
  'local_auth':                  { capability: 'biometrics',         description: 'Autenticación biométrica (huella / Face ID)' },
  'geolocator':                  { capability: 'gps',                description: 'Localización GPS' },
  'permission_handler':          { capability: 'permissions',        description: 'Gestión de permisos nativos' },
  'flutter_inappwebview':        { capability: 'webview',            description: 'WebView para MFEs embebidos' },
  'nfc_manager':                 { capability: 'nfc',                description: 'Lectura NFC' },
  'flutter_local_notifications': { capability: 'notifications',      description: 'Notificaciones locales' },
  'firebase_messaging':          { capability: 'push_notifications', description: 'Push notifications Firebase' },
  'url_launcher':                { capability: 'url_launcher',       description: 'Abrir URLs externas' },
  'share_plus':                  { capability: 'share',              description: 'Compartir contenido nativo' },
  'in_app_review':               { capability: 'app_review',         description: 'Review nativo App Store / Play Store' },
  'device_info_plus':            { capability: 'device_info',        description: 'Información del dispositivo' },
  'package_info_plus':           { capability: 'app_info',           description: 'Versión y build de la app' },
  'flutter_secure_storage':      { capability: 'secure_storage',     description: 'Almacenamiento seguro (Keychain / Keystore)' },
  'biometric_storage':           { capability: 'biometric_storage',  description: 'Storage protegido con biometría' },
};

function indexNativeCapabilities() {
  const capabilities = [];
  const seen = new Set();
  const pubspecFiles = findFiles(SHELL_ROOT, /^pubspec\.yaml$/, ['build', '.dart_tool']);

  for (const pubspecFile of pubspecFiles) {
    const content = readFile(pubspecFile);
    for (const [plugin, meta] of Object.entries(NATIVE_PLUGINS)) {
      if (content.includes(plugin + ':') && !seen.has(meta.capability)) {
        seen.add(meta.capability);
        capabilities.push({
          capability: meta.capability,
          plugin,
          description: meta.description,
          note: 'always-shell-never-mfe',
          file: path.relative(SHELL_ROOT, pubspecFile)
        });
      }
    }
  }
  return capabilities;
}

// ── Main ───────────────────────────────────────────────────────────────────

function indexShell() {
  const result = {
    features: [],
    uiKitComponents: [],
    nativeCapabilities: [],
    bridgeEvents: []
  };

  if (!FEATURES_DIR) return result;
  if (!fs.existsSync(FEATURES_DIR)) {
    console.warn('[shell-indexer] FEATURES_DIR not found:', FEATURES_DIR);
    return result;
  }

  const featureDirs = fs.readdirSync(FEATURES_DIR).filter(f =>
    fs.statSync(path.join(FEATURES_DIR, f)).isDirectory()
  );

  for (const featureName of featureDirs) {
    const featureDir = path.join(FEATURES_DIR, featureName);
    const cubits = indexCubits(featureDir);
    const pages = indexPages(featureDir);
    const routes = indexRoutes(featureDir);

    result.features.push({
      id: featureName,
      dir: `features/${featureName}`,
      cubits,
      pages,
      routes
    });

    console.error(`[shell-indexer] ${featureName}: ${cubits.length} cubits, ${pages.length} pages, ${routes.length} routes`);
  }

  result.uiKitComponents = indexUIKit();
  result.nativeCapabilities = indexNativeCapabilities();
  result.bridgeEvents = indexBridgeEvents();

  console.error(`[shell-indexer] uiKit: ${result.uiKitComponents.length} components, native: ${result.nativeCapabilities.length} capabilities, bridge: ${result.bridgeEvents.length} events`);
  return result;
}

module.exports = { indexShell };

if (require.main === module) {
  console.log(JSON.stringify(indexShell(), null, 2));
}
