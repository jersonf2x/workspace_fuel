#!/usr/bin/env node
/**
 * qa-indexer.js — Indexador de cobertura QA para kg-cli
 *
 * Comando: kg-cli index qa
 * Output:  graph/qa-coverage-graph.json
 *
 * Cruza: features/*.feature + data_user.json + resultados Serenity JSON
 * Produce: grafo con nodos screen/scenario/result y edges de trazabilidad
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RISK_MAP = {
  login: 'high',
  wallet: 'high',
  payment: 'high',
  password_recovery: 'medium',
  passwordrecovery: 'medium',
  home: 'medium',
  profile: 'low',
};

function findFeatureFiles(featuresDir) {
  if (!fs.existsSync(featuresDir)) return [];
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.feature')) results.push(full);
    }
  }
  walk(featuresDir);
  return results;
}

function parseFeatureFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const moduleName = path.basename(path.dirname(filePath));
  const scenarios = [];
  let currentTags = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@')) {
      currentTags = trimmed.split(/\s+/).map(t => t.replace('@', ''));
    } else if (trimmed.startsWith('Scenario:')) {
      const scenarioName = trimmed.replace('Scenario:', '').trim();
      const testType = currentTags.find(t => ['Positive', 'Negative', 'EdgeCase'].includes(t))
        ? currentTags.find(t => ['Positive', 'Negative', 'EdgeCase'].includes(t)).toLowerCase().replace('edgecase', 'edge')
        : 'positive';
      scenarios.push({ scenarioName, tags: currentTags.slice(), testType, module: moduleName });
      currentTags = [];
    } else if (trimmed && !trimmed.startsWith('@') && !trimmed.startsWith('Feature:') && !trimmed.startsWith('Background:')) {
      // reset tags si hay linea no-tag entre scenarios
    }
  }
  return { moduleName, featureFile: filePath, scenarios };
}

function loadDataJson(dataJsonPath) {
  if (!fs.existsSync(dataJsonPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function findFigmaNodeId(dataJson, moduleName, scenarioName) {
  const mod = dataJson[moduleName];
  if (!mod || !mod.scenarios) return null;
  const scenario = mod.scenarios.find(s => s.scenarioName === scenarioName);
  if (!scenario || !scenario.examples || !scenario.examples[0]) return null;
  return scenario.examples[0]._figmaNodeId || null;
}

function hasData(dataJson, moduleName, scenarioName) {
  const mod = dataJson[moduleName];
  if (!mod || !mod.scenarios) return false;
  const scenario = mod.scenarios.find(s => s.scenarioName === scenarioName);
  return !!(scenario && scenario.examples && scenario.examples.length > 0);
}

function loadSerenityResults(targetDir) {
  const resultsDir = path.join(targetDir, 'site', 'serenity');
  const resultsFile = path.join(targetDir, 'cucumber-reports', 'report.json');
  const results = {};

  if (fs.existsSync(resultsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      for (const feature of data) {
        for (const element of (feature.elements || [])) {
          const passed = element.steps && element.steps.every(s => s.result && s.result.status === 'passed');
          results[element.name] = {
            status: passed ? 'passed' : 'failed',
            duration: element.steps ? element.steps.reduce((acc, s) => acc + (s.result ? s.result.duration || 0 : 0), 0) : 0,
          };
        }
      }
    } catch (e) {
      // resultados no disponibles
    }
  }

  return results;
}

function buildGraph(cfg) {
  const featuresDir = cfg.featuresDir || 'src/test/resources/features';
  const dataJsonPath = cfg.dataJsonPath || 'src/test/resources/data/data_user.json';
  const targetDir = cfg.targetDir || 'target';

  const dataJson = loadDataJson(dataJsonPath);
  const serenityResults = loadSerenityResults(targetDir);
  const featureFiles = findFeatureFiles(featuresDir);

  const nodes = [];
  const edges = [];
  const screenIndex = {};
  let nodeIdCounter = 1;

  const newId = () => `qa-node-${nodeIdCounter++}`;

  for (const featureFile of featureFiles) {
    const { moduleName, scenarios } = parseFeatureFile(featureFile);

    // Nodo de pantalla (uno por modulo)
    if (!screenIndex[moduleName]) {
      const screenId = newId();
      const figmaNodeId = scenarios[0] ? findFigmaNodeId(dataJson, moduleName, scenarios[0].scenarioName) : null;
      screenIndex[moduleName] = screenId;
      nodes.push({
        id: screenId,
        type: 'screen',
        name: moduleName,
        figmaNodeId,
        module: moduleName,
        riskLevel: RISK_MAP[moduleName.toLowerCase()] || 'low',
        coveragePercent: 0,
      });
    }

    const screenId = screenIndex[moduleName];
    let coveredCount = 0;

    for (const scenario of scenarios) {
      const scenarioId = newId();
      const figmaNodeId = findFigmaNodeId(dataJson, moduleName, scenario.scenarioName);
      const hasTestData = hasData(dataJson, moduleName, scenario.scenarioName);

      nodes.push({
        id: scenarioId,
        type: 'scenario',
        scenarioName: scenario.scenarioName,
        module: moduleName,
        featureFile: path.relative(process.cwd(), featureFile),
        testType: scenario.testType,
        tags: scenario.tags,
        hasData: hasTestData,
        figmaNodeId,
      });

      edges.push({ from: screenId, to: scenarioId, type: 'screen_to_scenario' });

      // Resultado de ejecucion si existe
      const result = serenityResults[scenario.scenarioName];
      if (result) {
        const resultId = newId();
        nodes.push({
          id: resultId,
          type: 'result',
          status: result.status,
          executedAt: new Date().toISOString(),
          environment: process.env.SERENITY_ENV || 'unknown',
          duration: result.duration,
        });
        edges.push({ from: scenarioId, to: resultId, type: 'scenario_to_result' });
        if (result.status === 'passed') coveredCount++;
      }

      if (!hasTestData) {
        const dataGapId = newId();
        nodes.push({
          id: dataGapId,
          type: 'result',
          status: 'pending',
          errorMessage: 'Sin datos en data_user.json',
        });
        edges.push({ from: scenarioId, to: dataGapId, type: 'scenario_to_data' });
      }
    }

    // Actualizar cobertura de la pantalla
    const screen = nodes.find(n => n.id === screenId);
    if (screen && scenarios.length > 0) {
      screen.coveragePercent = Math.round((coveredCount / scenarios.length) * 100);
    }
  }

  // Summary
  const scenarioNodes = nodes.filter(n => n.type === 'scenario');
  const resultNodes = nodes.filter(n => n.type === 'result');
  const screenNodes = nodes.filter(n => n.type === 'screen');

  const summary = {
    totalScreens: screenNodes.length,
    totalScenarios: scenarioNodes.length,
    scenariosWithData: scenarioNodes.filter(n => n.hasData).length,
    scenariosWithoutData: scenarioNodes.filter(n => !n.hasData).length,
    passedScenarios: resultNodes.filter(n => n.status === 'passed').length,
    failedScenarios: resultNodes.filter(n => n.status === 'failed').length,
    averageCoveragePercent: screenNodes.length > 0
      ? Math.round(screenNodes.reduce((acc, n) => acc + (n.coveragePercent || 0), 0) / screenNodes.length)
      : 0,
    criticalPathCoverage: (() => {
      const critical = screenNodes.filter(n => n.riskLevel === 'high');
      if (!critical.length) return 0;
      return Math.round(critical.reduce((acc, n) => acc + (n.coveragePercent || 0), 0) / critical.length);
    })(),
  };

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    summary,
  };
}

function indexQa(cfg = {}) {
  const graph = buildGraph(cfg);
  const outDir = cfg.graphDir || 'graph';
  const outPath = path.join(outDir, 'qa-coverage-graph.json');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

  return {
    path: outPath,
    summary: graph.summary,
    warnings: graph.nodes
      .filter(n => n.type === 'scenario' && !n.hasData)
      .map(n => `Scenario sin datos: "${n.scenarioName}" (${n.module})`),
  };
}

function main() {
  const { loadConfig } = require('./_config');
  const cfg = loadConfig();
  const json = process.argv.includes('--json');
  const result = indexQa({
    featuresDir: cfg.paths.qaFeaturesDir,
    dataJsonPath: cfg.paths.qaDataJson,
    targetDir: cfg.paths.qaTargetDir,
    graphDir: cfg.paths.graphDir,
  });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`✓ QA graph: ${result.path}`);
    console.log(`  pantallas: ${result.summary.totalScreens} | scenarios: ${result.summary.totalScenarios} | sin datos: ${result.summary.scenariosWithoutData}`);
    if (result.warnings.length) {
      console.log('  advertencias:');
      result.warnings.slice(0, 10).forEach(w => console.log(`    ⚠ ${w}`));
      if (result.warnings.length > 10) console.log(`    … +${result.warnings.length - 10} más`);
    }
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { indexQa, buildGraph };
