#!/usr/bin/env node
/**
 * query-qa-coverage.js — Query de cobertura QA para kg-cli
 *
 * Comando: kg-cli query qa-coverage [--by-screen] [--json]
 * Input:   graph/qa-coverage-graph.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

function queryQaCoverage(cfg = {}) {
  const graphPath = cfg.graphPath || path.join('graph', 'qa-coverage-graph.json');

  if (!fs.existsSync(graphPath)) {
    return {
      ok: false,
      error: `Grafo QA no encontrado en ${graphPath}. Ejecuta: ./tools/kg-cli index qa`,
    };
  }

  let graph;
  try {
    graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  } catch (e) {
    return { ok: false, error: `Error leyendo grafo: ${e.message}` };
  }

  const screenNodes = graph.nodes.filter(n => n.type === 'screen');
  const scenarioNodes = graph.nodes.filter(n => n.type === 'scenario');
  const { summary } = graph;

  if (cfg.byScreen) {
    const byScreen = screenNodes.map(screen => {
      const screenScenarios = graph.edges
        .filter(e => e.from === screen.id && e.type === 'screen_to_scenario')
        .map(e => scenarioNodes.find(n => n.id === e.to))
        .filter(Boolean);

      const withData = screenScenarios.filter(s => s.hasData).length;
      const resultEdges = graph.edges.filter(e =>
        screenScenarios.some(s => s.id === e.from) && e.type === 'scenario_to_result'
      );
      const resultNodes = resultEdges.map(e => graph.nodes.find(n => n.id === e.to)).filter(Boolean);
      const passed = resultNodes.filter(n => n.status === 'passed').length;
      const lastRun = resultNodes
        .filter(n => n.executedAt)
        .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))[0];

      const missingData = screenScenarios.filter(s => !s.hasData).map(s => s.scenarioName);

      return {
        module: screen.name,
        riskLevel: screen.riskLevel,
        figmaNodeId: screen.figmaNodeId,
        totalScenarios: screenScenarios.length,
        withData,
        passed,
        coveragePercent: screen.coveragePercent || 0,
        lastRun: lastRun ? lastRun.executedAt : 'never',
        missingData,
      };
    });

    byScreen.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.riskLevel] || 2) - (order[b.riskLevel] || 2);
    });

    return { ok: true, byScreen, summary };
  }

  return { ok: true, summary, screenCount: screenNodes.length, scenarioCount: scenarioNodes.length };
}

function formatQaCoverageText(result) {
  if (!result.ok) return result.error;

  const lines = ['## Cobertura QA', ''];

  if (result.byScreen) {
    const riskIcon = { high: '🔴', medium: '🟡', low: '🟢' };
    for (const s of result.byScreen) {
      const icon = riskIcon[s.riskLevel] || '⚪';
      const coverage = `${s.coveragePercent}%`.padStart(5);
      const last = s.lastRun === 'never' ? 'sin ejecutar' : s.lastRun.substring(0, 10);
      lines.push(`${icon} ${s.module.padEnd(20)} ${coverage}  ${s.withData}/${s.totalScenarios} con datos  last: ${last}`);
      if (s.missingData.length > 0) {
        for (const m of s.missingData) {
          lines.push(`     ⚠️  sin datos: "${m}"`);
        }
      }
    }
  }

  lines.push('');
  lines.push(`Pantallas: ${result.summary.totalScreens} | Scenarios: ${result.summary.totalScenarios} | Sin datos: ${result.summary.scenariosWithoutData} | Cobertura promedio: ${result.summary.averageCoveragePercent}% | Ruta critica: ${result.summary.criticalPathCoverage}%`);

  return lines.join('\n');
}

function main() {
  const { loadConfig } = require('./_config');
  const cfg = loadConfig();
  const json = process.argv.includes('--json');
  const byScreen = process.argv.includes('--by-screen');
  const result = queryQaCoverage({
    graphPath: cfg.paths.qaCoverageGraph,
    byScreen,
  });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }
  console.log(formatQaCoverageText(result));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { queryQaCoverage, formatQaCoverageText };
