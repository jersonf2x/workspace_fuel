#!/usr/bin/env node
/**
 * Validate plan macro against the JSON Schema.
 *
 * Uso:
 *   kg-cli validate plan <ruta-al-plan.json>
 *   kg-cli validate plan <ruta-al-plan.md>      (extrae el bloque ```json` y valida)
 *   echo '{...}' | kg-cli validate plan -       (lee de stdin)
 *
 * Sin dependencias: hace validación manual contra los campos required del schema.
 * No es validación JSON Schema completa pero cubre el 90% del valor (campos obligatorios).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, 'schemas', 'plan-macro.schema.json');

function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.error('Uso: kg-cli validate plan <ruta-al-plan.{json,md}|->');
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

  // Si parece markdown, extraer primer ```json```
  let json;
  if (target.endsWith('.md') || /^\s*#/.test(raw)) {
    const m = raw.match(/```json\s*([\s\S]+?)```/);
    if (!m) {
      console.error('No se encontró bloque ```json en el archivo .md');
      process.exit(1);
    }
    json = m[1];
  } else {
    json = raw;
  }

  let plan;
  try {
    plan = JSON.parse(json);
  } catch (e) {
    console.error(`JSON inválido: ${e.message}`);
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf-8'));
  const errors = validate(plan, schema);

  if (errors.length === 0) {
    console.log('✓ Plan macro válido contra el schema.');
    console.log(`  mode: ${plan.mode}`);
    console.log(`  HU/flujo: ${plan.hu_id_or_flow}`);
    console.log(`  archivos a tocar: ${(plan.files_to_touch || []).length}`);
    console.log(`  tests planeados: ${(plan.tests_planned || []).length}`);
    console.log(`  bloqueantes: ${(plan.blockers || []).length}`);
    if ((plan.blockers || []).some(b => b.severity === 'critical')) {
      console.log('  ⚠ Hay bloqueantes CRITICAL — el agente NO debe implementar.');
      process.exit(1);
    }
    process.exit(0);
  }

  console.error('✗ Plan macro inválido:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

function validate(obj, schema, prefix = '') {
  const errors = [];

  // Required fields
  for (const req of schema.required || []) {
    if (!(req in obj)) {
      errors.push(`Falta campo obligatorio: ${prefix}${req}`);
    }
  }

  // Enum check on mode and others
  for (const [field, def] of Object.entries(schema.properties || {})) {
    if (!(field in obj)) continue;
    const value = obj[field];

    if (def.enum && !def.enum.includes(value)) {
      errors.push(`Valor inválido en ${prefix}${field}: "${value}" — esperado uno de [${def.enum.join(', ')}]`);
    }

    if (def.const !== undefined && value !== def.const) {
      errors.push(`Valor inválido en ${prefix}${field}: "${value}" — debe ser "${def.const}"`);
    }

    if (def.type === 'array' && !Array.isArray(value)) {
      errors.push(`Campo ${prefix}${field} debe ser array`);
    }

    if (def.type === 'array' && def.items?.required && Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item !== 'object' || item === null) return;
        for (const req of def.items.required) {
          if (!(req in item)) {
            errors.push(`Falta ${prefix}${field}[${i}].${req}`);
          }
        }
      });
    }
  }

  return errors;
}

if (require.main === module) {
  main();
}

module.exports = { validate, main };
