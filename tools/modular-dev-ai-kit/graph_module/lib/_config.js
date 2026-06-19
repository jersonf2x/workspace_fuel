'use strict';

/**
 * Configuración del workspace — graphify.config.json en la raíz.
 * Permite instalar el kit en cualquier repo sin hardcodear paths Flypass.
 */

const fs = require('fs');
const path = require('path');

// ROOT detection:
//   1. KG_WORKSPACE_ROOT env var (explicit override)
//   2. Walk up from cwd looking for graphify.config.json
//   3. Fallback to cwd
function detectRoot() {
  if (process.env.KG_WORKSPACE_ROOT) {
    return path.resolve(process.env.KG_WORKSPACE_ROOT);
  }
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'graphify.config.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}
const ROOT = detectRoot();

const DEFAULTS = {
  workspaceName: 'workspace',
  specsDir: 'specs',
  graphDir: 'graph',
  runsDir: 'runs',
  graphs: {
    code: 'graph/project-graph.json',
    specs: 'graph/specs-graph.json',
  },
  specs: {
    repoDirs: [],
    frontendRepos: [],
  },
  domainVocabulary: {
    entities: [],
    conditions: [],
  },
  flow: {
    domain: null,
    parentEpic: null,
  },
  frontend: {
    mfeRoot: '.',
    shellRoot: null,
    mfeAppsDir: 'apps',
    mfeAppsDirs: null,
    shellFeaturesDir: null,
    shellUiKitDir: null,
  },
  generic: {
    backendRoots: ['lambdas', 'shared', 'schemas', 'utils', 'src', 'backend', 'services', 'modules', 'lib', 'server'],
    frontendRoots: ['apps', 'packages', 'src', 'app'],
    infrastructureRoots: ['infrastructure', 'infra'],
    companionRoots: ['companion_apps', 'scripts'],
  },
  mcp: {
    configPath: '.cursor/mcp.json',
  },
  qa: {
    dataJsonPath: 'src/test/resources/data/data_user.json',
    featuresDir: 'src/test/resources/features',
    targetDir: 'target',
    coverageGraph: 'graph/qa-coverage-graph.json',
    defaultRunner: 'LoginRunner',
  },
};

function loadConfig() {
  const configPath = path.join(ROOT, 'graphify.config.json');
  let file = {};
  if (fs.existsSync(configPath)) {
    try {
      file = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn('⚠ graphify.config.json inválido — usando defaults');
    }
  }

  const merged = {
    ...DEFAULTS,
    ...file,
    graphs: { ...DEFAULTS.graphs, ...(file.graphs || {}) },
    specs: { ...DEFAULTS.specs, ...(file.specs || {}) },
    domainVocabulary: { ...DEFAULTS.domainVocabulary, ...(file.domainVocabulary || {}) },
    flow: { ...DEFAULTS.flow, ...(file.flow || {}) },
    frontend: { ...DEFAULTS.frontend, ...(file.frontend || {}) },
    generic: { ...DEFAULTS.generic, ...(file.generic || {}) },
    mcp: { ...DEFAULTS.mcp, ...(file.mcp || {}) },
    qa: { ...DEFAULTS.qa, ...(file.qa || {}) },
  };

  const codeGraphAbs = path.join(ROOT, merged.graphs.code);
  const legacyFlypass = path.join(ROOT, 'graph/flypass-graph.json');
  if (!fs.existsSync(codeGraphAbs) && fs.existsSync(legacyFlypass)) {
    merged.graphs.code = 'graph/flypass-graph.json';
  }

  merged.paths = {
    root: ROOT,
    specsDir: path.join(ROOT, merged.specsDir),
    repoSpecsDirs: (merged.specs.repoDirs || []).map((d) => path.join(ROOT, d)),
    graphDir: path.join(ROOT, merged.graphDir),
    runsDir: path.join(ROOT, merged.runsDir),
    codeGraph: path.join(ROOT, merged.graphs.code),
    specsGraph: path.join(ROOT, merged.graphs.specs),
    mcpConfig: path.join(ROOT, merged.mcp.configPath),
    qaDataJson: path.join(ROOT, merged.qa.dataJsonPath),
    qaFeaturesDir: path.join(ROOT, merged.qa.featuresDir),
    qaCoverageGraph: path.join(ROOT, merged.qa.coverageGraph),
    qaTargetDir: path.join(ROOT, merged.qa.targetDir),
  };

  return merged;
}

/** Lee domain + épico desde specs/README-<flujo>.md */
function readFlowMetaFromReadme(specsDir) {
  if (!fs.existsSync(specsDir)) {
    return { domain: 'default', parent: null, readme: null };
  }
  const readmes = fs.readdirSync(specsDir).filter(f => /^README-.+\.md$/.test(f));
  if (!readmes.length) {
    return { domain: 'default', parent: null, readme: null };
  }
  const readme = readmes[0];
  const content = fs.readFileSync(path.join(specsDir, readme), 'utf-8');
  const domain = readme.replace(/^README-/, '').replace(/\.md$/, '');
  const parentMatch =
    content.match(/\*\*Épico Jira:\*\*\s*\[?(PROJ-\d+|FL2-\d+)/i) ||
    content.match(/\|\s*Épico Jira\s*\|\s*\[?(PROJ-\d+|FL2-\d+)/i) ||
    content.match(/\[?(PROJ-\d+|FL2-\d+)\].*épico/i);
  return {
    domain,
    parent: parentMatch ? parentMatch[1] : null,
    readme,
  };
}

function resolveFlowMeta(cfg) {
  const fromReadme = readFlowMetaFromReadme(cfg.paths.specsDir);
  return {
    domain: cfg.flow.domain || fromReadme.domain,
    parent: cfg.flow.parentEpic || fromReadme.parent,
    readme: fromReadme.readme,
  };
}

module.exports = { loadConfig, readFlowMetaFromReadme, resolveFlowMeta, ROOT, DEFAULTS };
