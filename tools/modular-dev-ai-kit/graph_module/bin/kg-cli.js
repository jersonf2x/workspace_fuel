#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PKG_ROOT = path.resolve(__dirname, '..');
const LIB = path.join(PKG_ROOT, 'lib');
const SCRIPTS = path.join(PKG_ROOT, 'scripts');
const PKG = require(path.join(PKG_ROOT, 'package.json'));

const SCHEMA_VERSION = '0.4.0';

function usage() {
  console.log(`kg-cli ${PKG.version}  —  Semantic Graph Kit / knowledge graph engine

USAGE
  kg-cli <command> [args...]

COMMANDS
  init                          Initialize graph/ + copy schemas in cwd
  index specs                   Build graph/specs-graph.json from specs/*.md (padre + repos hijos)
  index code                    Build graph/flypass-graph.json (MFE/Shell + generic repo graph)
  index mfe                     Build MFE slice only
  index shell                   Build Shell slice only
  index i18n                    Build i18n key registry (MFE + Shell) → graph/i18n-registry.json
  index qa                      Build graph/qa-coverage-graph.json (features + data_user + results)
  preflight <SPEC-ID> [--json] [--all]
                                Preflight checks for a spec (or --all)
  preflight qa [--module <name>] [--json]
                                Preflight QA (adb, data_user, gradle, grafo)
  query flows [<flow-key>] [--json]
                                Business flows of the domain (defined in context spec)
  query flow-order [--json]     Topological order of specs in current flow
  query spec-slice <SPEC-ID> [--tokens] [--raw-cmp]
                                1-hop slice for a spec (context packet candidate)
  query qa-coverage [--by-screen] [--json]
                                Cobertura QA desde qa-coverage-graph.json
  generate implement-prompt <SPEC-ID> [--json]
                                Generate the @implement message prefilled with spec data
  validate plan <file>          Validate a plan macro against the schema
  validate test-plan <file>     Validate QA test plan JSON (G1)
  probe                         Claude/MCP handshake probe
  schema [name]                 Print JSON Schema (specs-graph | flypass-graph | context-packet | plan-macro | i18n-registry | test-plan | qa-coverage-graph)
  version                       Print kg-cli + schema version

EXAMPLES
  kg-cli init
  kg-cli index specs
  kg-cli index i18n
  kg-cli query flows
  kg-cli preflight SPEC-FL2-24307
  kg-cli query spec-slice FPE-0006 --tokens
  kg-cli generate implement-prompt SPEC-FL2-24307
  kg-cli validate plan plan.json
`);
}

function runNode(scriptPath, args, opts = {}) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: opts.cwd || process.cwd(),
  });
  process.exit(r.status == null ? 1 : r.status);
}

function runBash(scriptPath, args, opts = {}) {
  const r = spawnSync('bash', [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: opts.cwd || process.cwd(),
  });
  process.exit(r.status == null ? 1 : r.status);
}

function cmdInit() {
  const cwd = process.cwd();
  const dirs = ['graph', 'specs', 'runs'];
  dirs.forEach((d) => {
    const p = path.join(cwd, d);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, '.gitkeep'), '');
    }
  });
  const schemaDest = path.join(cwd, 'graph', '.schemas');
  fs.mkdirSync(schemaDest, { recursive: true });
  const srcSchemas = path.join(LIB, 'schemas');
  if (fs.existsSync(srcSchemas)) {
    fs.readdirSync(srcSchemas).forEach((f) => {
      fs.copyFileSync(path.join(srcSchemas, f), path.join(schemaDest, f));
    });
  }
  console.log('kg-cli init: graph/, specs/, runs/ ready. Schemas copied to graph/.schemas/.');
  process.exit(0);
}

function cmdSchema(name) {
  const srcSchemas = path.join(LIB, 'schemas');
  if (!name) {
    fs.readdirSync(srcSchemas).forEach((f) => console.log(f));
    process.exit(0);
  }
  const file = path.join(srcSchemas, `${name}.schema.json`);
  if (!fs.existsSync(file)) {
    console.error(`Unknown schema: ${name}. Available: ${fs.readdirSync(srcSchemas).join(', ')}`);
    process.exit(2);
  }
  process.stdout.write(fs.readFileSync(file, 'utf-8'));
  process.exit(0);
}

function cmdVersion() {
  console.log(JSON.stringify({ kg_cli: PKG.version, schema: SCHEMA_VERSION, node: process.version }));
  process.exit(0);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    usage();
    process.exit(0);
  }
  const [cmd, sub, ...rest] = argv;

  switch (cmd) {
    case 'version':
    case '--version':
    case '-v':
      return cmdVersion();
    case 'init':
      return cmdInit();
    case 'schema':
      return cmdSchema(sub);
    case 'probe':
      return runNode(path.join(LIB, 'claude-probe.js'), [sub, ...rest].filter(Boolean));
    case 'index': {
      const tail = rest;
      switch (sub) {
        case 'specs':
          return runNode(path.join(LIB, 'spec-indexer.js'), tail);
        case 'code':
          return runBash(path.join(SCRIPTS, 'build-graph.sh'), tail);
        case 'mfe':
          return runNode(path.join(LIB, 'mfe-indexer.js'), tail);
        case 'shell':
          return runNode(path.join(LIB, 'shell-indexer.js'), tail);
        case 'i18n':
          return runNode(path.join(LIB, 'i18n-indexer.js'), tail);
        case 'qa':
          return runNode(path.join(LIB, 'qa-indexer.js'), tail);
        default:
          console.error(`Unknown subcommand: index ${sub}`);
          process.exit(2);
      }
      return;
    }
    case 'generate': {
      const tail = rest;
      switch (sub) {
        case 'implement-prompt':
          return runNode(path.join(LIB, 'generate-implement-prompt.js'), tail);
        default:
          console.error(`Unknown subcommand: generate ${sub}`);
          process.exit(2);
      }
      return;
    }
    case 'validate': {
      const tail = rest;
      switch (sub) {
        case 'plan':
          return runNode(path.join(LIB, 'validate-plan.js'), tail);
        case 'test-plan':
          return runNode(path.join(LIB, 'validate-test-plan.js'), tail);
        default:
          console.error(`Unknown subcommand: validate ${sub}`);
          process.exit(2);
      }
      return;
    }
    case 'preflight':
      if (sub === 'qa') {
        return runNode(path.join(LIB, 'qa-preflight.js'), rest);
      }
      return runNode(path.join(LIB, 'preflight.js'), [sub, ...rest].filter(Boolean));
    case 'query': {
      const tail = rest;
      switch (sub) {
        case 'flows':
          return runNode(path.join(LIB, 'query-flows.js'), tail);
        case 'flow-order':
          return runNode(path.join(LIB, 'query-flow-order.js'), tail);
        case 'spec-slice':
          return runNode(path.join(LIB, 'query-spec-graph.js'), tail);
        case 'qa-coverage':
          return runNode(path.join(LIB, 'query-qa-coverage.js'), tail);
        default:
          console.error(`Unknown subcommand: query ${sub}`);
          process.exit(2);
      }
      return;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(2);
  }
}

main();
