#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./_config');

const cfg = loadConfig();
const ROOT = cfg.paths.root;

const ROOTS = {
  backend: cfg.generic?.backendRoots || ['lambdas', 'shared', 'schemas', 'utils', 'src', 'backend', 'services', 'modules', 'lib', 'server'],
  frontend: cfg.generic?.frontendRoots || ['frontend/src', 'src', 'app'],
  infrastructure: cfg.generic?.infrastructureRoots || ['infrastructure', 'infra'],
  companion: cfg.generic?.companionRoots || ['companion_apps', 'scripts'],
};

const SKIP_DIRS = new Set([
  '.git',
  '.claude',
  '.specify',
  '.venv',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'graph',
  'runs',
  'tools',
  'target',
  '.mvn',
  'generated',
  'generated-sources',
  '.angular',
  'storybook-static',
]);

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir, predicate, limit = 500) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length && out.length < limit) {
    const current = stack.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
      } else if (predicate(full)) {
        out.push(full);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

function filesFromRoots(roots, predicate, limit = 500) {
  const out = [];
  for (const root of roots) {
    const abs = path.join(ROOT, root);
    for (const file of walk(abs, predicate, limit - out.length)) {
      out.push(file);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function matchAll(content, regex, mapper) {
  const out = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    out.push(mapper(match));
  }
  return [...new Set(out.filter(Boolean))];
}

function matchAllRaw(content, regex, mapper) {
  const out = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = mapper(match);
    if (value) out.push(value);
  }
  return out;
}

function inferPythonPackage(file) {
  const relative = rel(file);
  const parts = relative.split('/');
  if (parts[0] === 'lambdas' && parts.length >= 3) return parts.slice(0, 3).join('/');
  return parts.slice(0, Math.max(1, parts.length - 1)).join('/');
}

function indexBackend() {
  const files = filesFromRoots([...ROOTS.backend, ...ROOTS.companion], (file) => file.endsWith('.py'), 800);
  const handlers = [];
  const services = [];
  const schemas = [];
  const sharedModules = [];

  for (const file of files) {
    const content = read(file);
    const relative = rel(file);
    const imports = matchAll(content, /(?:from|import)\s+([a-zA-Z_][\w.]*)/g, (m) => m[1])
      .filter((name) => /^(shared|schemas|utils|lambdas|src|modules|scripts)\b/.test(name))
      .slice(0, 12);

    if (/def\s+lambda_handler\s*\(/.test(content)) {
      handlers.push({
        id: `lambda:${inferPythonPackage(file)}`,
        file: relative,
        service: content.match(/Logger\(service=["']([^"']+)["']\)/)?.[1] || null,
        routes: matchAll(content, /["'](\/[a-zA-Z0-9_/{}/.-]+)["']/g, (m) => m[1]).slice(0, 20),
        imports,
      });
      continue;
    }

    const classes = matchAll(content, /^class\s+([A-Za-z_]\w*)/gm, (m) => m[1]);
    if (
      classes.some((name) => /(Service|Worker|Repository|Client|Processor|Classifier|Router|Engine)$/.test(name)) ||
      /(^|[_-])service\.py$/.test(relative) ||
      /boto3|DynamoDB|IoT|S3|Lambda|openai|pandas|PyQt5|QThread|DataFrame|classify_batch|checkpoint|rule_engine/.test(content)
    ) {
      services.push({
        id: `service:${relative}`,
        file: relative,
        classes,
        methods: matchAll(content, /^ {4}def\s+([A-Za-z_]\w*)\s*\(/gm, (m) => m[1]).slice(0, 24),
        aws: matchAll(content, /\b(dynamodb|iot-data|lambda|s3|events)\b/g, (m) => m[1]).slice(0, 12),
        imports,
      });
      continue;
    }

    if (relative.startsWith('schemas/')) {
      schemas.push({
        id: `schema:${relative}`,
        file: relative,
        models: classes,
        enums: matchAll(content, /^class\s+([A-Za-z_]\w*)\(StrEnum\)/gm, (m) => m[1]),
      });
      continue;
    }

    if (
      relative.startsWith('shared/') ||
      relative.startsWith('utils/') ||
      relative.startsWith('src/') ||
      relative.startsWith('scripts/')
    ) {
      sharedModules.push({
        id: `module:${relative}`,
        file: relative,
        functions: matchAll(content, /^def\s+([A-Za-z_]\w*)\s*\(/gm, (m) => m[1]).slice(0, 20),
        classes,
      });
    }
  }

  return { handlers, services, schemas, sharedModules };
}

// ── Java (Spring Boot / hexagonal) ─────────────────────────────────────────

const JAVA_HTTP_MAPPINGS = {
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  DeleteMapping: 'DELETE',
  PatchMapping: 'PATCH',
};

function extractMappingPath(args) {
  if (!args) return '';
  const m =
    args.match(/(?:value|path)\s*=\s*"([^"]*)"/) ||
    args.match(/^\s*"([^"]*)"/);
  return m ? m[1] : '';
}

function joinRoute(base, sub) {
  const full = `${base || ''}${sub && !sub.startsWith('/') && sub ? '/' : ''}${sub || ''}`;
  return full || '/';
}

function extractJavaEndpoints(content) {
  const classKeywordIdx = content.search(/\b(?:class|interface)\s+\w+/);
  let basePath = '';
  const endpoints = [];

  const re = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(\(([^)]*)\))?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const [, annotation, , args] = m;
    const p = extractMappingPath(args || '');
    if (annotation === 'RequestMapping') {
      if (classKeywordIdx !== -1 && m.index < classKeywordIdx) {
        basePath = p;
        continue;
      }
      const methodMatch = (args || '').match(/RequestMethod\.([A-Z]+)/);
      endpoints.push({ method: methodMatch ? methodMatch[1] : 'ANY', path: p });
    } else {
      endpoints.push({ method: JAVA_HTTP_MAPPINGS[annotation], path: p });
    }
  }

  return endpoints.map((e) => `${e.method} ${joinRoute(basePath, e.path)}`);
}

function extractKafka(content) {
  const consumes = [];
  const listenerRe = /@KafkaListener\s*\(([^)]*)\)/g;
  let m;
  while ((m = listenerRe.exec(content)) !== null) {
    const topicsArg = m[1].match(/topics\s*=\s*(\{[^}]*\}|"[^"]*(?:\$\{[^}]+\}[^"]*)?")/);
    if (!topicsArg) continue;
    const topics = [
      ...topicsArg[1].matchAll(/"((?:\$\{[^}]+\})|[^"]+)"/g),
    ].map((t) => t[1]);
    consumes.push(...topics);
  }
  const produces = matchAll(content, /kafkaTemplate(?:<[^>]*>)?\s*\.send\s*\(\s*([\w.]+|"[^"]+")/g, (x) => x[1].replace(/"/g, ''));
  return { consumes: [...new Set(consumes)], produces };
}

function inferJavaModule(pkg) {
  // co.com.flypass.fpe.product.… → fpe.product ; co.com.flypass.legal.… → legal
  const parts = (pkg || '').split('.');
  const idx = parts.indexOf('flypass');
  if (idx !== -1) {
    const tail = parts.slice(idx + 1);
    return tail.slice(0, tail[0] === 'fpe' ? 2 : 1).join('.') || pkg;
  }
  return parts.slice(0, 4).join('.');
}

function inferJavaLayer(pkg, name, annotations, content) {
  if (annotations.includes('RestController') || annotations.includes('Controller')) return 'controller';
  if (/@KafkaListener/.test(content)) return 'kafka_consumer';
  if (/\.domain\.usecase/.test(pkg) || /UseCase$/.test(name)) return 'use_case';
  if (/\.domain\.model\.ports/.test(pkg) || /Port$/.test(name)) return 'port';
  if (/\.domain\b/.test(pkg)) return 'domain_model';
  if (/drivenadapters/.test(pkg) || /(Adapter|Client)$/.test(name)) return 'driven_adapter';
  if (/entrypoints/.test(pkg)) return 'entrypoint';
  if (/Repository$/.test(name) || /extends\s+(?:Crud|ListCrud|Paging)Repository/.test(content)) return 'repository';
  if (annotations.includes('Configuration') || /Properties$/.test(name)) return 'config';
  if (annotations.includes('Service') || annotations.includes('Component')) return 'service';
  return 'class';
}

function indexJavaBackend() {
  const files = filesFromRoots(ROOTS.backend, (file) => file.endsWith('.java'), 3000)
    .filter((file) => !/src[\/]test[\/]/.test(rel(file)));
  const controllers = [];
  const classes = [];

  for (const file of files) {
    const content = read(file);
    const relative = rel(file);
    const repo = relative.split('/')[0];
    const pkg = content.match(/^package\s+([\w.]+)\s*;/m)?.[1] || '';
    const nameMatch = content.match(/(?:public\s+)?(?:final\s+|abstract\s+|sealed\s+)*(class|interface|record|enum)\s+(\w+)/);
    if (!nameMatch) continue;
    const [, kind, name] = nameMatch;
    const annotations = matchAll(content, /^@(\w+)/gm, (m) => m[1]);
    const layer = inferJavaLayer(pkg, name, annotations, content);
    const fqcn = pkg ? `${pkg}.${name}` : name;
    const imports = matchAll(content, /^import\s+(?:static\s+)?([\w.]+)\s*;/gm, (m) => m[1])
      .filter((imp) => /^co\.com\./.test(imp))
      .slice(0, 20);

    if (layer === 'controller') {
      controllers.push({
        id: `controller:${relative}`,
        file: relative,
        repo,
        module: inferJavaModule(pkg),
        class: name,
        fqcn,
        routes: extractJavaEndpoints(content),
        imports,
      });
      continue;
    }

    const kafka = extractKafka(content);
    classes.push({
      id: `java:${relative}`,
      file: relative,
      repo,
      module: inferJavaModule(pkg),
      class: name,
      kind,
      fqcn,
      layer,
      kafka: (kafka.consumes.length || kafka.produces.length) ? kafka : undefined,
      imports,
    });
  }

  return { controllers, classes };
}

function buildJavaEdges(java) {
  const edges = [];
  const byFqcn = new Map();
  [...java.controllers, ...java.classes].forEach((node) => {
    if (node.fqcn) byFqcn.set(node.fqcn, node.id);
  });

  for (const node of [...java.controllers, ...java.classes]) {
    for (const imp of node.imports || []) {
      const targetId = byFqcn.get(imp);
      if (targetId && targetId !== node.id) {
        edges.push({ type: 'java_imports', from: node.id, to: targetId, file: node.file });
      }
    }
  }
  return edges;
}

function indexFrontend() {
  const files = filesFromRoots(ROOTS.frontend, (file) => /\.(tsx|ts|jsx|js)$/.test(file), 500);
  const components = [];
  const apiClients = [];
  const routes = [];

  for (const file of files) {
    const content = read(file);
    const relative = rel(file);
    const componentNames = matchAll(
      content,
      /(?:export\s+default\s+function|export\s+function|function)\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
      (m) => m[1],
    );
    const exportedFunctions = matchAll(content, /export\s+(?:async\s+)?function\s+([A-Za-z_]\w*)\s*\(/g, (m) => m[1]);
    const routePaths = matchAll(content, /<Route\s+path=["']([^"']+)["']/g, (m) => m[1]);
    const endpoints = matchAll(content, /request<[^>]+>\(["`]([^"`]+)["`]/g, (m) => m[1])
      .concat(matchAll(content, /fetch\([^`'"]*[`'"]([^`'"]+)[`'"]/g, (m) => m[1]))
      .slice(0, 40);

    if (componentNames.length || /React|jsx|tsx|useQuery|useMutation/.test(content)) {
      components.push({
        id: `component:${relative}`,
        file: relative,
        names: componentNames,
        usesQuery: /useQuery|useMutation|@tanstack\/react-query/.test(content),
        importsApi: /from ["']\.\/api["']|from ["']\.\.\/api["']/.test(content),
      });
    }
    if (routePaths.length) {
      routes.push({ file: relative, paths: routePaths });
    }
    if (endpoints.length || exportedFunctions.length && relative.endsWith('api.ts')) {
      apiClients.push({ file: relative, functions: exportedFunctions, endpoints });
    }
  }

  return { components, apiClients, routes };
}

function indexInfrastructure() {
  const files = filesFromRoots(ROOTS.infrastructure, (file) => /\.(ya?ml|json)$/.test(file), 300);
  const resources = [];

  for (const file of files) {
    const content = read(file);
    const relative = rel(file);
    const types = matchAllRaw(content, /Type:\s+(AWS::[A-Za-z0-9:]+)/g, (m) => m[1]);
    if (types.length) {
      resources.push({
        file: relative,
        resourceTypes: [...new Set(types)].sort(),
        counts: types.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
      });
    }
  }

  return { resources };
}

function pythonImportAliases(relative) {
  if (!relative.endsWith('.py')) return [];
  const withoutExt = relative
    .replace(/\.py$/, '')
    .replace(/\/__init__$/, '');
  const dotted = withoutExt.split('/').join('.');
  const aliases = new Set([dotted]);
  for (const root of ROOTS.backend.concat(ROOTS.companion)) {
    const prefix = `${root}.`;
    if (dotted.startsWith(prefix)) {
      aliases.add(dotted.slice(prefix.length));
    }
  }
  return [...aliases].filter(Boolean);
}

function buildImportIndex(backend) {
  const index = new Map();
  const nodes = [
    ...backend.handlers,
    ...backend.services,
    ...backend.schemas,
    ...backend.sharedModules,
  ];

  for (const node of nodes) {
    for (const alias of pythonImportAliases(node.file)) {
      if (!index.has(alias)) index.set(alias, node.id);
    }
  }
  return index;
}

function buildEdges(backend, frontend, infrastructure) {
  const edges = [];
  const importIndex = buildImportIndex(backend);
  const resolveImport = (imported, fallbackPrefix) => (
    importIndex.get(imported) || `${fallbackPrefix}:${imported}`
  );

  for (const handler of backend.handlers) {
    const siblingService = handler.file.replace(/handler\.py$/, 'service.py');
    if (backend.services.some((svc) => svc.file === siblingService)) {
      edges.push({
        type: 'lambda_uses_service',
        from: handler.id,
        to: `service:${siblingService}`,
        file: handler.file,
      });
    }
  }

  for (const service of backend.services) {
    for (const imported of service.imports || []) {
      if (imported.startsWith('schemas.')) {
        edges.push({ type: 'service_uses_schema', from: service.id, to: resolveImport(imported, 'schema'), file: service.file });
      }
      if (imported.startsWith('shared.')) {
        edges.push({ type: 'service_uses_shared', from: service.id, to: resolveImport(imported, 'module'), file: service.file });
      }
      if (imported.startsWith('utils.') || imported.startsWith('modules.') || imported.startsWith('src.') || imported.startsWith('scripts.')) {
        edges.push({ type: 'service_uses_shared', from: service.id, to: resolveImport(imported, 'module'), file: service.file });
      }
    }
  }

  for (const client of frontend.apiClients) {
    for (const endpoint of client.endpoints || []) {
      edges.push({ type: 'frontend_calls_endpoint', from: `frontend:${client.file}`, to: endpoint, file: client.file });
    }
  }

  for (const resource of infrastructure.resources) {
    for (const type of resource.resourceTypes) {
      if (type === 'AWS::Lambda::Function') {
        edges.push({ type: 'infra_declares_lambda', from: `infra:${resource.file}`, to: 'backend:lambdas', file: resource.file });
      }
      if (type.startsWith('AWS::ApiGateway::')) {
        edges.push({ type: 'infra_declares_api', from: `infra:${resource.file}`, to: 'frontend/api-or-backend/http', file: resource.file });
      }
      if (type === 'AWS::IoT::TopicRule') {
        edges.push({ type: 'infra_declares_iot_rule', from: `infra:${resource.file}`, to: 'backend:iot', file: resource.file });
      }
      if (type === 'AWS::DynamoDB::Table') {
        edges.push({ type: 'infra_declares_table', from: `infra:${resource.file}`, to: 'backend:dynamodb', file: resource.file });
      }
    }
  }

  return edges;
}

function buildNodes(backend, frontend, infrastructure) {
  return [
    ...backend.handlers.map((handler) => ({
      id: handler.id,
      type: 'backend_handler',
      file: handler.file,
      service: handler.service,
      routes: handler.routes || [],
    })),
    ...backend.services.map((service) => ({
      id: service.id,
      type: 'backend_service',
      file: service.file,
      classes: service.classes || [],
      methods: service.methods || [],
    })),
    ...backend.schemas.map((schema) => ({
      id: schema.id,
      type: 'backend_schema',
      file: schema.file,
      models: schema.models || [],
    })),
    ...backend.sharedModules.map((module) => ({
      id: module.id,
      type: 'shared_module',
      file: module.file,
      functions: module.functions || [],
      classes: module.classes || [],
    })),
    ...frontend.components.map((component) => ({
      id: component.id,
      type: 'frontend_component',
      file: component.file,
      names: component.names || [],
    })),
    ...frontend.apiClients.map((client) => ({
      id: `frontend:${client.file}`,
      type: 'frontend_api_client',
      file: client.file,
      functions: client.functions || [],
      endpoints: client.endpoints || [],
    })),
    ...frontend.routes.flatMap((routeFile) => (routeFile.paths || []).map((routePath) => ({
      id: `route:${routeFile.file}:${routePath}`,
      type: 'frontend_route',
      file: routeFile.file,
      path: routePath,
    }))),
    ...infrastructure.resources.map((resource) => ({
      id: `infra:${resource.file}`,
      type: 'infra_resource',
      file: resource.file,
      resourceTypes: resource.resourceTypes || [],
      counts: resource.counts || {},
    })),
  ];
}

function buildJavaNodes(java) {
  const SERVICE_LAYERS = new Set(['service', 'use_case', 'driven_adapter', 'repository', 'kafka_consumer', 'entrypoint']);
  return [
    ...java.controllers.map((controller) => ({
      id: controller.id,
      type: 'backend_controller',
      file: controller.file,
      repo: controller.repo,
      module: controller.module,
      class: controller.class,
      routes: controller.routes || [],
    })),
    ...java.classes
      .filter((cls) => cls.layer !== 'class')
      .map((cls) => ({
        id: cls.id,
        type: SERVICE_LAYERS.has(cls.layer) ? 'backend_service' : `java_${cls.layer}`,
        layer: cls.layer,
        file: cls.file,
        repo: cls.repo,
        module: cls.module,
        class: cls.class,
        ...(cls.kafka ? { kafka: cls.kafka } : {}),
      })),
  ];
}

function indexGenericCode() {
  const backend = indexBackend();
  const java = indexJavaBackend();
  const frontend = indexFrontend();
  const infrastructure = indexInfrastructure();
  const nodes = [...buildNodes(backend, frontend, infrastructure), ...buildJavaNodes(java)];
  const edges = [...buildEdges(backend, frontend, infrastructure), ...buildJavaEdges(java)];
  const javaServiceCount = java.classes.filter((cls) => cls.layer !== 'class' && cls.layer !== 'domain_model' && cls.layer !== 'port' && cls.layer !== 'config').length;
  const summary = {
    genericNodes: nodes.length,
    backendHandlers: backend.handlers.length + java.controllers.length,
    backendControllers: java.controllers.length,
    backendEndpoints: java.controllers.reduce((acc, c) => acc + (c.routes || []).length, 0),
    backendServices: backend.services.length + javaServiceCount,
    backendSchemas: backend.schemas.length,
    javaClasses: java.classes.length,
    kafkaConsumers: java.classes.filter((cls) => cls.kafka?.consumes?.length).length,
    sharedModules: backend.sharedModules.length,
    frontendComponents: frontend.components.length,
    frontendApiClients: frontend.apiClients.length,
    frontendRoutes: frontend.routes.reduce((acc, item) => acc + item.paths.length, 0),
    infraResources: infrastructure.resources.reduce((acc, item) => (
      acc + Object.values(item.counts).reduce((sum, count) => sum + count, 0)
    ), 0),
    genericEdges: edges.length,
  };

  return { summary, backend, java, frontend, infrastructure, nodes, edges };
}

module.exports = { indexGenericCode };

if (require.main === module) {
  process.stdout.write(JSON.stringify(indexGenericCode(), null, 2));
}
