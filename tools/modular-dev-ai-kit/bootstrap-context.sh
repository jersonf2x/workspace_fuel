#!/usr/bin/env bash
set -uo pipefail

TARGET="."
OUTPUT=""
APPLY=false
SKIP_GRAPH=false
MAX_FILES=18

usage() {
  cat <<'USAGE'
Usage:
  bootstrap-context.sh [--target DIR] [--output FILE] [--apply] [--skip-graph] [--max-files N]

Purpose:
  Discover repo-specific context after modular_dev_ai_kit installation.
  By default it writes a reviewable report and runs kg-cli index code when available.
  It does not rewrite memory or CLAUDE.md unless --apply is passed.

Examples:
  ./tools/bootstrap-context
  ./tools/bootstrap-context --skip-graph
  ./tools/bootstrap-context --apply
  bash kits/modular_dev_ai_kit/tools/bootstrap-context.sh --target /path/to/repo
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --apply)
      APPLY=true
      shift
      ;;
    --skip-graph)
      SKIP_GRAPH=true
      shift
      ;;
    --max-files)
      MAX_FILES="${2:-18}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "Invalid --target: $TARGET" >&2
  exit 2
fi

TARGET="$(cd "$TARGET" && pwd)"
REPO_NAME="$(basename "$TARGET")"
GENERATED_AT="$(date '+%Y-%m-%dT%H:%M:%S%z')"
OUTPUT="${OUTPUT:-docs/ai-development-kit/bootstrap-context-report.md}"
if [[ "$OUTPUT" = /* ]]; then
  OUTPUT_ABS="$OUTPUT"
else
  OUTPUT_ABS="$TARGET/$OUTPUT"
fi

HAS_RG=false
command -v rg >/dev/null 2>&1 && HAS_RG=true

rel() {
  local path="$1"
  path="${path#$TARGET/}"
  printf '%s\n' "$path"
}

add_unique() {
  local array_name="$1"
  local value="$2"
  [[ -z "$value" ]] && return
  eval 'local current=("${'"$array_name"'[@]-}")'
  local item
  for item in "${current[@]}"; do
    [[ "$item" == "$value" ]] && return
  done
  eval "$array_name+=(\"\$value\")"
}

path_exists() {
  [[ -e "$TARGET/$1" ]]
}

find_first_files() {
  local pattern="$1"
  local limit="${2:-$MAX_FILES}"
  find "$TARGET" \
    \( -type d \( -name '.git' -o -name '.venv' -o -name 'venv' -o -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' -o -name 'node_modules' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '.dart_tool' -o -name '.gradle' \) \) -prune \
    -o \( -path "$TARGET/.claude" -o -path "$TARGET/.specify" -o -path "$TARGET/tools/modular-dev-ai-kit" -o -path "$TARGET/docs/ai-development-kit" -o -path "$TARGET/specs/_templates" -o -path "$TARGET/graph/.schemas" \) -prune \
    -o -type f -name "$pattern" -print 2>/dev/null | sort | head -n "$limit"
}

find_first_dirs() {
  local limit="${1:-$MAX_FILES}"
  find "$TARGET" -maxdepth 3 \
    \( -type d \( -name '.git' -o -name '.venv' -o -name 'venv' -o -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' -o -name 'node_modules' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '.dart_tool' -o -name '.gradle' \) \) -prune \
    -o \( -path "$TARGET/.claude" -o -path "$TARGET/.specify" -o -path "$TARGET/tools/modular-dev-ai-kit" -o -path "$TARGET/docs/ai-development-kit" -o -path "$TARGET/specs/_templates" -o -path "$TARGET/graph/.schemas" \) -prune \
    -o -type d -print 2>/dev/null | sort | head -n "$limit"
}

grep_paths() {
  local pattern="$1"
  local glob="${2:-*}"
  local limit="${3:-$MAX_FILES}"
  if [[ "$HAS_RG" == true ]]; then
    (
      cd "$TARGET" || exit 2
      rg -l --hidden \
        --glob "$glob" \
        --glob '!.git/**' \
        --glob '!.venv/**' \
        --glob '!venv/**' \
        --glob '!__pycache__/**' \
        --glob '!.pytest_cache/**' \
        --glob '!.mypy_cache/**' \
        --glob '!.ruff_cache/**' \
        --glob '!node_modules/**' \
        --glob '!dist/**' \
        --glob '!build/**' \
        --glob '!coverage/**' \
        --glob '!graph/**' \
        --glob '!runs/**' \
        --glob '!.claude/**' \
        --glob '!.specify/**' \
        --glob '!tools/modular-dev-ai-kit/**' \
        --glob '!docs/ai-development-kit/**' \
        --glob '!specs/_templates/**' \
        "$pattern" . 2>/dev/null | sed 's#^\./##' | sort | head -n "$limit" | while IFS= read -r rel_path; do
          printf '%s/%s\n' "$TARGET" "$rel_path"
        done
    )
  else
    find_first_files "$glob" "$limit" | while IFS= read -r file; do
      grep -Iq . "$file" 2>/dev/null && grep -Eq "$pattern" "$file" 2>/dev/null && printf '%s\n' "$file"
    done | head -n "$limit"
  fi
}

grep_source_paths() {
  local pattern="$1"
  local glob="${2:-*}"
  local limit="${3:-$MAX_FILES}"
  if [[ "${#SOURCE_ROOTS[@]}" -eq 0 ]]; then
    grep_paths "$pattern" "$glob" "$limit"
    return
  fi
  if [[ "$HAS_RG" == true ]]; then
    (
      cd "$TARGET" || exit 2
      rg -l --hidden \
        --glob "$glob" \
        --glob '!.git/**' \
        --glob '!.venv/**' \
        --glob '!venv/**' \
        --glob '!__pycache__/**' \
        --glob '!.pytest_cache/**' \
        --glob '!.mypy_cache/**' \
        --glob '!.ruff_cache/**' \
        --glob '!node_modules/**' \
        --glob '!dist/**' \
        --glob '!build/**' \
        --glob '!coverage/**' \
        "$pattern" "${SOURCE_ROOTS[@]}" 2>/dev/null | sed 's#^\./##' | sort | head -n "$limit" | while IFS= read -r rel_path; do
          printf '%s/%s\n' "$TARGET" "$rel_path"
        done
    )
  else
    local root
    for root in "${SOURCE_ROOTS[@]}"; do
      [[ -d "$TARGET/$root" ]] || continue
      find "$TARGET/$root" -type f -name "$glob" -print 2>/dev/null | while IFS= read -r file; do
        grep -Iq . "$file" 2>/dev/null && grep -Eq "$pattern" "$file" 2>/dev/null && printf '%s\n' "$file"
      done
    done | sort | head -n "$limit"
  fi
}

grep_backend_paths() {
  local pattern="$1"
  local glob="${2:-*}"
  local limit="${3:-$MAX_FILES}"
  local search_roots=()
  local root
  for root in "${SOURCE_ROOTS[@]}"; do
    case "$root" in
      frontend|client|android|ios)
        continue
        ;;
      *)
        search_roots+=("$root")
        ;;
    esac
  done

  if [[ "${#search_roots[@]}" -eq 0 ]]; then
    if [[ "${#SOURCE_ROOTS[@]}" -eq 0 ]]; then
      grep_paths "$pattern" "$glob" "$limit"
    fi
    return
  fi

  if [[ "$HAS_RG" == true ]]; then
    (
      cd "$TARGET" || exit 2
      for root in "${search_roots[@]}"; do
        [[ -d "$root" ]] || continue
        rg -l --hidden \
          --glob "$glob" \
          --glob '!.git/**' \
          --glob '!.venv/**' \
          --glob '!venv/**' \
          --glob '!__pycache__/**' \
          --glob '!.pytest_cache/**' \
          --glob '!.mypy_cache/**' \
          --glob '!.ruff_cache/**' \
          --glob '!node_modules/**' \
          --glob '!dist/**' \
          --glob '!build/**' \
          --glob '!coverage/**' \
          "$pattern" "$root" 2>/dev/null
      done | sed 's#^\./##' | head -n "$limit" | while IFS= read -r rel_path; do
        printf '%s/%s\n' "$TARGET" "$rel_path"
      done
    )
  else
    for root in "${search_roots[@]}"; do
      [[ -d "$TARGET/$root" ]] || continue
      find "$TARGET/$root" -type f -name "$glob" -print 2>/dev/null | while IFS= read -r file; do
        grep -Iq . "$file" 2>/dev/null && grep -Eq "$pattern" "$file" 2>/dev/null && printf '%s\n' "$file"
      done
    done | sort | head -n "$limit"
  fi
}

STACK=()
COMMANDS=()
SOURCE_ROOTS=()
TEST_ROOTS=()
DOC_ROOTS=()
CONFIG_FILES=()
BACKEND_EVIDENCE=()
FRONTEND_EVIDENCE=()
CONTRACT_EVIDENCE=()
GRAPH_EVIDENCE=()
WARNINGS=()
GRAPH_SUMMARY_JSON=""

detect_path_sets() {
  local p
  for p in src app apps packages services modules backend frontend lib server client android ios lambdas shared schemas utils infrastructure companion_apps scripts test tests e2e cypress docs contracts specs hus graph runs .claude .specify; do
    [[ -d "$TARGET/$p" ]] || continue
    case "$p" in
      src|app|apps|packages|services|modules|backend|frontend|lib|server|client|android|ios|lambdas|shared|schemas|utils|infrastructure|companion_apps|scripts)
        add_unique SOURCE_ROOTS "$p"
        ;;
      test|tests|e2e|cypress)
        add_unique TEST_ROOTS "$p"
        ;;
      docs|contracts|specs|hus|graph|runs|.claude|.specify)
        add_unique DOC_ROOTS "$p"
        ;;
    esac
  done

  for p in package.json pnpm-lock.yaml yarn.lock package-lock.json angular.json nx.json tsconfig.json vite.config.ts vite.config.js next.config.js pubspec.yaml pom.xml build.gradle build.gradle.kts settings.gradle gradlew mvnw pyproject.toml requirements.txt go.mod Dockerfile docker-compose.yml Makefile .github/workflows; do
    [[ -e "$TARGET/$p" ]] && add_unique CONFIG_FILES "$p"
  done
}

detect_stack() {
  local package_json="$TARGET/package.json"
  if [[ -f "$package_json" ]]; then
    add_unique STACK "Node.js / package.json"
    grep -q '"@angular/' "$package_json" 2>/dev/null && add_unique STACK "Angular"
    grep -q '"react"' "$package_json" 2>/dev/null && add_unique STACK "React"
    grep -q '"next"' "$package_json" 2>/dev/null && add_unique STACK "Next.js"
    grep -q '"vue"' "$package_json" 2>/dev/null && add_unique STACK "Vue"
    grep -q '"@nestjs/' "$package_json" 2>/dev/null && add_unique STACK "NestJS"
    grep -q '"express"' "$package_json" 2>/dev/null && add_unique STACK "Express"
    grep -q '"typescript"' "$package_json" 2>/dev/null && add_unique STACK "TypeScript"

    if command -v node >/dev/null 2>&1; then
      while IFS= read -r line; do
        add_unique COMMANDS "$line"
      done < <(PKG="$package_json" node <<'NODE' 2>/dev/null
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.env.PKG, 'utf8'));
const scripts = pkg.scripts || {};
for (const key of ['build', 'test', 'lint', 'start', 'dev', 'typecheck']) {
  if (scripts[key]) console.log(`npm run ${key} # ${scripts[key]}`);
}
NODE
)
    fi
  fi

  while IFS= read -r nested_package_json; do
    [[ "$nested_package_json" == "$package_json" ]] && continue
    local rel_pkg
    local rel_dir
    rel_pkg="$(rel "$nested_package_json")"
    rel_dir="$(dirname "$rel_pkg")"
    add_unique STACK "Node.js / $rel_pkg"
    grep -q '"@angular/' "$nested_package_json" 2>/dev/null && add_unique STACK "Angular / $rel_dir"
    grep -q '"react"' "$nested_package_json" 2>/dev/null && add_unique STACK "React / $rel_dir"
    grep -q '"next"' "$nested_package_json" 2>/dev/null && add_unique STACK "Next.js / $rel_dir"
    grep -q '"vue"' "$nested_package_json" 2>/dev/null && add_unique STACK "Vue / $rel_dir"
    grep -q '"typescript"' "$nested_package_json" 2>/dev/null && add_unique STACK "TypeScript / $rel_dir"

    if command -v node >/dev/null 2>&1; then
      while IFS= read -r line; do
        add_unique COMMANDS "$line"
      done < <(PKG="$nested_package_json" REL_DIR="$rel_dir" node <<'NODE' 2>/dev/null
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.env.PKG, 'utf8'));
const scripts = pkg.scripts || {};
for (const key of ['build', 'test', 'lint', 'start', 'dev', 'typecheck']) {
  if (scripts[key]) console.log(`cd ${process.env.REL_DIR} && npm run ${key} # ${scripts[key]}`);
}
NODE
)
    fi
  done < <(find_first_files 'package.json' 12)

  [[ -f "$TARGET/angular.json" ]] && add_unique STACK "Angular workspace"
  [[ -f "$TARGET/pubspec.yaml" ]] && add_unique STACK "Flutter/Dart"
  [[ -f "$TARGET/pom.xml" ]] && add_unique STACK "Java / Maven"
  [[ -f "$TARGET/build.gradle" || -f "$TARGET/build.gradle.kts" ]] && add_unique STACK "Java/Kotlin / Gradle"
  if [[ -f "$TARGET/pyproject.toml" ]]; then
    local python_req
    python_req="$(awk '/^requires-python[[:space:]]*=/{ line=$0; sub(/^[^=]*=[[:space:]]*/, "", line); gsub(/[ "]/, "", line); print line; exit }' "$TARGET/pyproject.toml" 2>/dev/null || true)"
    if [[ -n "$python_req" ]]; then
      add_unique STACK "Python $python_req / pyproject.toml"
    else
      add_unique STACK "Python / pyproject.toml"
    fi
  elif [[ -f "$TARGET/requirements.txt" ]]; then
    add_unique STACK "Python"
  fi
  [[ -f "$TARGET/go.mod" ]] && add_unique STACK "Go"
  find "$TARGET" -maxdepth 3 -name '*.csproj' -print -quit 2>/dev/null | grep -q . && add_unique STACK ".NET"
  [[ -f "$TARGET/Dockerfile" || -f "$TARGET/docker-compose.yml" ]] && add_unique STACK "Docker"

  [[ -x "$TARGET/mvnw" ]] && add_unique COMMANDS "./mvnw test"
  [[ -x "$TARGET/gradlew" ]] && add_unique COMMANDS "./gradlew test"
  [[ -f "$TARGET/pubspec.yaml" ]] && add_unique COMMANDS "flutter test"
  [[ -f "$TARGET/go.mod" ]] && add_unique COMMANDS "go test ./..."
  [[ -f "$TARGET/pyproject.toml" || -f "$TARGET/requirements.txt" ]] && add_unique COMMANDS "python -m pytest"
  [[ -f "$TARGET/Makefile" ]] && add_unique COMMANDS "make test # verify target names in Makefile"
}

collect_evidence() {
  local file
  while IFS= read -r file; do add_unique BACKEND_EVIDENCE "$(rel "$file")"; done < <(grep_backend_paths 'def lambda_handler|lambda_handler|class .*Service|@RestController|@Controller|Controller|express\(|express.Router|FastAPI|NestFactory|Handler|UseCase|Repository|BaseModel|StrEnum|boto3|AWS::Lambda|AWS::ApiGateway|AWS::IoT|AWS::DynamoDB' '*.{ts,tsx,js,jsx,py,java,kt,go,cs,dart,rb,php,yaml,yml}' "$MAX_FILES")
  while IFS= read -r file; do add_unique FRONTEND_EVIDENCE "$(rel "$file")"; done < <(grep_source_paths '@Component|React.FC|Component|export function [A-Z][A-Za-z0-9_]*|function [A-Z][A-Za-z0-9_]*|class=.*__|StatelessWidget|StatefulWidget|Widget build|templateUrl|styleUrls' '*.{ts,tsx,js,jsx,dart,html,scss,css}' "$MAX_FILES")
  while IFS= read -r file; do add_unique CONTRACT_EVIDENCE "$(rel "$file")"; done < <(find_first_files '*openapi*' "$MAX_FILES")
  while IFS= read -r file; do add_unique CONTRACT_EVIDENCE "$(rel "$file")"; done < <(find_first_files '*asyncapi*' "$MAX_FILES")
  while IFS= read -r file; do add_unique CONTRACT_EVIDENCE "$(rel "$file")"; done < <(find_first_files '*.schema.json' "$MAX_FILES")

  [[ -f "$TARGET/graphify.config.json" ]] && add_unique GRAPH_EVIDENCE "graphify.config.json"
  [[ -d "$TARGET/graph/.schemas" ]] && add_unique GRAPH_EVIDENCE "graph/.schemas/"
  [[ -d "$TARGET/hus" ]] && add_unique GRAPH_EVIDENCE "hus/"
  [[ -d "$TARGET/docs/contracts" ]] && add_unique GRAPH_EVIDENCE "docs/contracts/"
}

print_md_list() {
  local array_name="$1"
  local empty_label="$2"
  eval 'local count=${#'"$array_name"'[@]}'
  if [[ "$count" -eq 0 ]]; then
    printf -- '- %s\n' "$empty_label"
    return
  fi
  eval 'local values=("${'"$array_name"'[@]}")'
  local item
  for item in "${values[@]}"; do
    [[ -z "$item" ]] && continue
    printf -- '- `%s`\n' "$item"
  done
}

print_md_list_limited() {
  local array_name="$1"
  local empty_label="$2"
  local limit="${3:-8}"
  eval 'local count=${#'"$array_name"'[@]}'
  if [[ "$count" -eq 0 ]]; then
    printf -- '- %s\n' "$empty_label"
    return
  fi
  eval 'local values=("${'"$array_name"'[@]}")'
  local item
  local printed=0
  for item in "${values[@]}"; do
    [[ -z "$item" ]] && continue
    printf -- '- `%s`\n' "$item"
    printed=$((printed + 1))
    [[ "$printed" -ge "$limit" ]] && break
  done
  if [[ "$count" -gt "$limit" ]]; then
    printf -- '- ...and %s more. See `%s`.\n' "$((count - limit))" "$OUTPUT"
  fi
}

join_inline() {
  local array_name="$1"
  eval 'local count=${#'"$array_name"'[@]}'
  if [[ "$count" -eq 0 ]]; then
    printf '%s' "not-detected"
    return
  fi
  eval 'local values=("${'"$array_name"'[@]}")'
  local out=""
  local item
  for item in "${values[@]}"; do
    [[ -z "$item" ]] && continue
    if [[ -z "$out" ]]; then out="$item"; else out="$out, $item"; fi
  done
  printf '%s' "${out:-not-detected}"
}

review_value() {
  local value="$1"
  local fallback="$2"
  if [[ -z "$value" || "$value" == *"<"* || "$value" == *"{"* || "$value" == "unknown" ]]; then
    printf '%s' "$fallback"
  else
    printf '%s' "$value"
  fi
}

adoption_frontmatter_value() {
  local key="$1"
  local file="$TARGET/docs/ai-development-kit/adoption.md"
  [[ -f "$file" ]] || return 0
  awk -F': *' -v key="$key" '
    $1 == key {
      value = $2
      gsub(/^["'\''` ]+|["'\''` ]+$/, "", value)
      print value
      exit
    }
  ' "$file" 2>/dev/null || true
}

adoption_table_value() {
  local label="$1"
  local file="$TARGET/docs/ai-development-kit/adoption.md"
  [[ -f "$file" ]] || return 0
  awk -F'|' -v label="$label" '
    index($2, label) {
      value = $3
      gsub(/^[ `]+|[ `]+$/, "", value)
      print value
      exit
    }
  ' "$file" 2>/dev/null || true
}

installed_modules_inline() {
  local modules="core"
  if [[ -d "$TARGET/docs/ai-development-kit/backend" || -d "$TARGET/tools/modular-dev-ai-kit/backend_module" ]]; then
    modules="$modules, backend_module"
  fi
  if [[ -d "$TARGET/docs/ai-development-kit/frontend" || -d "$TARGET/tools/modular-dev-ai-kit/frontend_module" || -d "$TARGET/.claude" ]]; then
    modules="$modules, frontend_module"
  fi
  if [[ -x "$TARGET/tools/kg-cli" || -d "$TARGET/tools/modular-dev-ai-kit/graph_module" ]]; then
    modules="$modules, graph_module"
  fi
  printf '%s' "$modules"
}

repo_type() {
  if [[ "${#BACKEND_EVIDENCE[@]}" -gt 0 && "${#FRONTEND_EVIDENCE[@]}" -gt 0 ]]; then
    printf '%s' "fullstack repo"
  elif [[ "${#BACKEND_EVIDENCE[@]}" -gt 0 ]]; then
    printf '%s' "backend/service repo"
  elif [[ "${#FRONTEND_EVIDENCE[@]}" -gt 0 ]]; then
    printf '%s' "frontend/UI repo"
  else
    printf '%s' "software repo"
  fi
}

sync_graph_config_for_detected_roots() {
  [[ "$APPLY" == true ]] || return
  [[ -f "$TARGET/graphify.config.json" ]] || return
  command -v node >/dev/null 2>&1 || return

  local source_roots_payload=""
  local root
  for root in "${SOURCE_ROOTS[@]}"; do
    source_roots_payload="${source_roots_payload}${root}"$'\n'
  done

  SOURCE_ROOTS_PAYLOAD="$source_roots_payload" TARGET="$TARGET" node <<'NODE' 2>/dev/null || true
const fs = require('fs');
const path = require('path');

const target = process.env.TARGET;
const configPath = path.join(target, 'graphify.config.json');
const sourceRoots = new Set((process.env.SOURCE_ROOTS_PAYLOAD || '').split('\n').filter(Boolean));

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function rootExists(root) {
  return fs.existsSync(path.join(target, root));
}

function hasPython(root, limit = 150) {
  const start = path.join(target, root);
  if (!fs.existsSync(start)) return false;
  const stack = [start];
  let seen = 0;
  while (stack.length && seen < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['__pycache__', 'node_modules', 'dist', 'build'].includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else {
        seen += 1;
        if (entry.name.endsWith('.py')) return true;
      }
    }
  }
  return false;
}

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
cfg.generic = cfg.generic || {};
cfg.frontend = cfg.frontend || {};

const LEGACY_MFE_ROOT = 'frontend/MFE_user_experience-flypass_mfe_web';
const LEGACY_SHELL_ROOT = 'frontend/SHELL_user_experience-flypass_shell_application_mobile';

function isMissingOrLegacyRoot(root, legacyDefault) {
  if (!root) return true;
  if (root === legacyDefault) return true;
  if (/^frontend\/MFE_/.test(root) && !rootExists(root)) return true;
  if (/^frontend\/SHELL_/.test(root) && !rootExists(root)) return true;
  return !rootExists(root);
}

function detectLegacyMfeRoot() {
  const frontendDir = path.join(target, 'frontend');
  if (!fs.existsSync(frontendDir)) return null;
  for (const entry of fs.readdirSync(frontendDir)) {
    if (!entry.startsWith('MFE_')) continue;
    const candidate = path.join('frontend', entry);
    if (rootExists(path.join(candidate, 'apps'))) return candidate;
  }
  return null;
}

if (cfg.domains?.webApp?.path && !cfg.frontend.mfeRoot) {
  cfg.frontend.mfeRoot = cfg.domains.webApp.path;
}

const backendCandidates = [
  'lambdas', 'shared', 'schemas', 'utils',
  'src', 'backend', 'services', 'modules', 'lib', 'server'
];
const companionCandidates = ['companion_apps', 'scripts'];

const currentBackend = Array.isArray(cfg.generic.backendRoots) ? cfg.generic.backendRoots : [];
const currentCompanion = Array.isArray(cfg.generic.companionRoots) ? cfg.generic.companionRoots : [];
const currentFrontendRoots = Array.isArray(cfg.generic.frontendRoots) ? cfg.generic.frontendRoots : [];

const detectedBackend = backendCandidates.filter((root) => (
  rootExists(root) && (sourceRoots.has(root) || hasPython(root))
));
const detectedCompanion = companionCandidates.filter(rootExists);

const nextBackend = unique([...currentBackend, ...detectedBackend]);
const nextCompanion = unique([...currentCompanion, ...detectedCompanion]);

let frontendChanged = false;
const isNxWorkspace = rootExists('nx.json') && rootExists('apps');
const hasFlutter = rootExists('pubspec.yaml') || rootExists('melos.yaml');

if (isNxWorkspace) {
  if (isMissingOrLegacyRoot(cfg.frontend.mfeRoot, LEGACY_MFE_ROOT)) {
    cfg.frontend.mfeRoot = '.';
    cfg.frontend.mfeAppsDir = 'apps';
    frontendChanged = true;
  } else if (cfg.frontend.mfeRoot === '.' && !cfg.frontend.mfeAppsDir) {
    cfg.frontend.mfeAppsDir = 'apps';
    frontendChanged = true;
  }

  const nxFrontendRoots = ['apps'];
  if (rootExists('packages')) nxFrontendRoots.push('packages');
  const nextFrontendRoots = unique([
    ...nxFrontendRoots,
    ...currentFrontendRoots.filter((root) => rootExists(root)),
  ]);
  if (JSON.stringify(nextFrontendRoots) !== JSON.stringify(currentFrontendRoots)) {
    cfg.generic.frontendRoots = nextFrontendRoots;
    frontendChanged = true;
  }
} else {
  const legacyMfe = detectLegacyMfeRoot();
  if (legacyMfe && isMissingOrLegacyRoot(cfg.frontend.mfeRoot, LEGACY_MFE_ROOT)) {
    cfg.frontend.mfeRoot = legacyMfe;
    cfg.frontend.mfeAppsDir = null;
    frontendChanged = true;
  }
}

if (!hasFlutter) {
  const shellRoot = cfg.frontend.shellRoot;
  if (
    shellRoot &&
    (shellRoot === LEGACY_SHELL_ROOT || isMissingOrLegacyRoot(shellRoot, LEGACY_SHELL_ROOT))
  ) {
    cfg.frontend.shellRoot = null;
    cfg.frontend.shellFeaturesDir = null;
    cfg.frontend.shellUiKitDir = null;
    frontendChanged = true;
  }
}

const backendChanged =
  JSON.stringify(nextBackend) !== JSON.stringify(currentBackend) ||
  JSON.stringify(nextCompanion) !== JSON.stringify(currentCompanion);

if (backendChanged) {
  cfg.generic.backendRoots = nextBackend;
  cfg.generic.companionRoots = nextCompanion;
}

if (backendChanged || frontendChanged) {
  fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
}
NODE
}

graph_index_status="skipped"
run_graph_index() {
  if [[ "$SKIP_GRAPH" == true ]]; then
    graph_index_status="skipped by --skip-graph"
    return
  fi
  if [[ ! -x "$TARGET/tools/kg-cli" ]]; then
    graph_index_status="tools/kg-cli not installed"
    add_unique WARNINGS "graph_module not available or tools/kg-cli is not executable"
    return
  fi
  if (cd "$TARGET" && ./tools/kg-cli index code >/tmp/modular-dev-ai-kit-kg-index.$$ 2>&1); then
    graph_index_status="ok"
    rm -f /tmp/modular-dev-ai-kit-kg-index.$$
  else
    graph_index_status="failed; see /tmp/modular-dev-ai-kit-kg-index.$$"
    add_unique WARNINGS "kg-cli index code failed"
  fi
}

inspect_graph_health() {
  [[ -f "$TARGET/graphify.config.json" ]] || return
  command -v node >/dev/null 2>&1 || return

  [[ -f "$TARGET/graph/flypass-graph.json" ]] || return
  local graph_status
  graph_status="$(TARGET="$TARGET" node <<'NODE' 2>/dev/null || true
const fs = require('fs');
const path = require('path');
const graph = JSON.parse(fs.readFileSync(path.join(process.env.TARGET, 'graph/flypass-graph.json'), 'utf8'));
const summary = graph.summary || {};
function count(values) {
  return Array.isArray(values) ? values.length : 0;
}
const genericNodes = Number(summary.genericNodes || 0) || (
  count(graph.generic?.nodes) ||
  count(graph.generic?.backend?.handlers) +
  count(graph.generic?.backend?.services) +
  count(graph.generic?.backend?.schemas) +
  count(graph.generic?.backend?.sharedModules) +
  count(graph.generic?.frontend?.components) +
  count(graph.generic?.frontend?.apiClients) +
  (graph.generic?.frontend?.routes || []).reduce((acc, item) => acc + count(item.paths), 0) +
  count(graph.generic?.infrastructure?.resources)
);
const legacyTotal = ['mfeRemotes', 'shellFeatures', 'uiKitComponents', 'bridgeEvents', 'crossEdges']
  .reduce((acc, key) => acc + Number(summary[key] || 0), 0);
const genericTotal = genericNodes + Number(summary.genericEdges || 0);
console.log(JSON.stringify({ legacyTotal, genericTotal, summary: { ...summary, genericNodes } }));
NODE
)"
  GRAPH_SUMMARY_JSON="$graph_status"
  local generic_total
  generic_total="$(GRAPH_STATUS="$graph_status" node -e 'try { console.log(JSON.parse(process.env.GRAPH_STATUS).genericTotal || 0) } catch { console.log(0) }' 2>/dev/null || echo 0)"
  local legacy_total
  legacy_total="$(GRAPH_STATUS="$graph_status" node -e 'try { console.log(JSON.parse(process.env.GRAPH_STATUS).legacyTotal || 0) } catch { console.log(0) }' 2>/dev/null || echo 0)"
  if [[ "$generic_total" -eq 0 && "$legacy_total" -eq 0 ]]; then
    add_unique WARNINGS "kg-cli index code completed but generated an empty code graph"
  fi

  if [[ "$generic_total" -eq 0 ]]; then
    while IFS= read -r missing_root; do
      [[ -z "$missing_root" ]] && continue
      add_unique WARNINGS "graphify.config.json references missing root: $missing_root"
    done < <(TARGET="$TARGET" node <<'NODE' 2>/dev/null
const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(process.env.TARGET, 'graphify.config.json'), 'utf8'));
const roots = [
  cfg.frontend?.mfeRoot,
  cfg.frontend?.shellRoot,
  cfg.frontend?.mfeAppsDir,
  cfg.frontend?.shellFeaturesDir,
  cfg.frontend?.shellUiKitDir
].filter(Boolean);
for (const root of roots) {
  if (!fs.existsSync(path.join(process.env.TARGET, root))) console.log(root);
}
NODE
)
  fi
}

write_report() {
  mkdir -p "$(dirname "$OUTPUT_ABS")"
  {
    printf '# Bootstrap Context Report\n\n'
    printf '| Field | Value |\n'
    printf '|---|---|\n'
    printf '| Repo | `%s` |\n' "$REPO_NAME"
    printf '| Target | `%s` |\n' "$TARGET"
    printf '| Generated at | `%s` |\n' "$GENERATED_AT"
    printf '| Apply mode | `%s` |\n' "$APPLY"
    printf '| Graph index | `%s` |\n\n' "$graph_index_status"

    printf '## Confirmed By Files\n\n'
    printf '### Stack\n\n'
    print_md_list STACK "No stack marker detected. Inspect manually."
    printf '\n### Commands\n\n'
    print_md_list COMMANDS "No build/test/lint command detected. Inspect README, CI and package managers manually."
    printf '\n### Source Roots\n\n'
    print_md_list SOURCE_ROOTS "No common source root detected."
    printf '\n### Test Roots\n\n'
    print_md_list TEST_ROOTS "No common test root detected."
    printf '\n### Docs And AI Kit Roots\n\n'
    print_md_list DOC_ROOTS "No docs/context root detected."
    printf '\n### Config Files\n\n'
    print_md_list CONFIG_FILES "No known config files detected."

    printf '\n## Module Applicability\n\n'
    printf '| Module | Evidence | Recommendation |\n'
    printf '|---|---|---|\n'
    printf '| `core` | `docs/ai-development-kit/adoption.md`, `.specify/`, `CLAUDE.md` | Keep mandatory. Use this report to complete repo memory. |\n'
    if [[ "${#BACKEND_EVIDENCE[@]}" -gt 0 || -d "$TARGET/docs/ai-development-kit/backend" ]]; then
      printf '| `backend_module` | Backend evidence or installed backend docs found. | Complete contracts, runbooks, ADRs and prereview for backend changes. |\n'
    else
      printf '| `backend_module` | No backend source evidence found by heuristic. | Keep installed only if repo owns APIs, workers, integrations or data products. |\n'
    fi
    if [[ "${#FRONTEND_EVIDENCE[@]}" -gt 0 || -d "$TARGET/docs/ai-development-kit/frontend" ]]; then
      printf '| `frontend_module` | Frontend evidence or installed frontend docs found. | Use HU templates, BEM rules and prereview for UI changes. |\n'
    else
      printf '| `frontend_module` | No frontend source evidence found by heuristic. | Keep installed only if repo owns UI/MFE/mobile shell. |\n'
    fi
    if [[ -x "$TARGET/tools/kg-cli" ]]; then
      printf '| `graph_module` | `tools/kg-cli` is executable. | Use graph/context packets for feature work and context minimization. |\n'
    else
      printf '| `graph_module` | `tools/kg-cli` not found. | Install graph module before graph-based context. |\n'
    fi

    printf '\n## Backend Evidence\n\n'
    print_md_list BACKEND_EVIDENCE "No backend handlers/controllers/adapters detected by heuristic."
    printf '\n## Frontend Evidence\n\n'
    print_md_list FRONTEND_EVIDENCE "No frontend components/widgets detected by heuristic."
    printf '\n## Contract Evidence\n\n'
    print_md_list CONTRACT_EVIDENCE "No OpenAPI/AsyncAPI/schema files detected by heuristic."
    printf '\n## Graph Evidence\n\n'
    print_md_list GRAPH_EVIDENCE "No graph module paths detected."
    if [[ -n "$GRAPH_SUMMARY_JSON" ]]; then
      printf '\n### Code Graph Summary\n\n'
      printf '| Field | Value |\n'
      printf '|---|---:|\n'
      GRAPH_SUMMARY_JSON="$GRAPH_SUMMARY_JSON" node <<'NODE' 2>/dev/null || true
const payload = JSON.parse(process.env.GRAPH_SUMMARY_JSON || '{}');
const s = payload.summary || {};
const rows = [
  ['Generic nodes', s.genericNodes],
  ['Generic edges', s.genericEdges],
  ['Backend services', s.backendServices],
  ['Backend handlers', s.backendHandlers],
  ['Shared modules', s.sharedModules],
  ['Frontend components', s.frontendComponents],
  ['Frontend routes', s.frontendRoutes],
  ['Infrastructure resources', s.infraResources],
  ['Cross edges', s.crossEdges],
];
for (const [label, value] of rows) {
  console.log(`| ${label} | \`${Number(value || 0)}\` |`);
}
NODE
    fi

    printf '\n## Proposed Updates\n\n'
    printf 'The report is safe to review. Run with `--apply` to write generated sections to:\n\n'
    printf -- '- `.specify/memory/domain-context.md`\n'
    printf -- '- `.specify/memory/repo-architecture.md`\n'
    printf -- '- `docs/ai-development-kit/repo-context-pack.md`\n'
    printf -- '- `CLAUDE.md` repo-specific render when it is still templated, otherwise managed bootstrap section\n\n'

    printf '### Proposed Repo Summary\n\n'
    printf -- '- Repo: `%s`\n' "$REPO_NAME"
    printf -- '- Detected stack: `%s`\n' "$(join_inline STACK)"
    printf -- '- Source roots: `%s`\n' "$(join_inline SOURCE_ROOTS)"
    printf -- '- Test roots: `%s`\n' "$(join_inline TEST_ROOTS)"
    printf -- '- Commands: `%s`\n' "$(join_inline COMMANDS)"
    printf -- '- Backend evidence count: `%s`\n' "${#BACKEND_EVIDENCE[@]}"
    printf -- '- Frontend evidence count: `%s`\n' "${#FRONTEND_EVIDENCE[@]}"
    printf -- '- Contract evidence count: `%s`\n' "${#CONTRACT_EVIDENCE[@]}"

    printf '\n## Anti-hallucination Notes\n\n'
    printf -- '- Confirmed facts above are path-based heuristics.\n'
    printf -- '- Inferred ownership, domain and bounded context still require human review.\n'
    printf -- '- Do not treat absence of evidence as absence of capability until repo owners confirm.\n'

    printf '\n## Warnings\n\n'
    print_md_list WARNINGS "No warnings."
  } > "$OUTPUT_ABS"
}

write_generated_file() {
  local rel_path="$1"
  local title="$2"
  local dest="$TARGET/$rel_path"
  mkdir -p "$(dirname "$dest")"
  {
    printf '# %s - %s\n\n' "$title" "$REPO_NAME"
    printf '> Generated by `tools/bootstrap-context` on `%s`. Review before relying on it for delivery decisions.\n\n' "$GENERATED_AT"
    printf '## Confirmed\n\n'
    printf '### Stack\n\n'
    print_md_list STACK "No stack marker detected."
    printf '\n### Source Roots\n\n'
    print_md_list SOURCE_ROOTS "No common source root detected."
    printf '\n### Test Roots\n\n'
    print_md_list TEST_ROOTS "No common test root detected."
    printf '\n### Commands\n\n'
    print_md_list COMMANDS "No command detected."
    printf '\n### Backend Evidence\n\n'
    print_md_list BACKEND_EVIDENCE "No backend evidence detected by heuristic."
    printf '\n### Frontend Evidence\n\n'
    print_md_list FRONTEND_EVIDENCE "No frontend evidence detected by heuristic."
    printf '\n### Contract Evidence\n\n'
    print_md_list CONTRACT_EVIDENCE "No contract evidence detected by heuristic."
    printf '\n## Inferred\n\n'
    printf -- '- Repo type requires owner review.\n'
    printf -- '- Bounded context requires owner review.\n'
    printf -- '- Critical paths require feature-level validation before edits.\n'
    printf '\n## Not Found\n\n'
    if [[ "${#CONTRACT_EVIDENCE[@]}" -eq 0 ]]; then
      printf -- '- API/event contracts were not detected by heuristic.\n'
    fi
    if [[ "${#COMMANDS[@]}" -eq 0 ]]; then
      printf -- '- Build/test/lint commands were not detected by heuristic.\n'
    fi
    printf '\n## Agent Rules\n\n'
    printf -- '- Load this file with `CLAUDE.md` and `docs/ai-development-kit/adoption.md`.\n'
    printf -- '- Prefer confirmed paths over inferred architecture.\n'
    printf -- '- Ask before changing contracts, boundaries or generated context.\n'
  } > "$dest"
}

claude_should_render_full() {
  local file="$1"
  [[ ! -f "$file" ]] && return 0
  grep -Eq '\{repo_name\}|\{primary_responsibility\}|\{build_command\}|Generated by `tools/bootstrap-context --apply`' "$file"
}

write_claude_bootstrap_section() {
  printf '<!-- modular_dev_ai_kit:bootstrap-context:start -->\n'
  printf '## Repo Bootstrap Context\n\n'
  printf -- '- Last bootstrap: `%s`\n' "$GENERATED_AT"
  printf -- '- Report: `%s`\n' "$OUTPUT"
  printf -- '- Detected stack: `%s`\n' "$(join_inline STACK)"
  printf -- '- Source roots: `%s`\n' "$(join_inline SOURCE_ROOTS)"
  printf -- '- Installed AI kit modules: `%s`\n' "$(installed_modules_inline)"
  printf -- '- Kit-first mode: follow installed kit docs, context packs, specs, templates and module checklists before ad hoc process.\n'
  if [[ -x "$TARGET/tools/kg-cli" ]]; then
    printf -- '- Graph-first context: prefer graph/context lookup for dependency, impact and navigation questions before broad repo search; use bounded slices or summaries to optimize tokens.\n'
  fi
  printf -- '- Before feature work, review `.specify/memory/repo-architecture.md`, `docs/ai-development-kit/repo-context-pack.md`, and the relevant installed templates.\n'
  printf '<!-- modular_dev_ai_kit:bootstrap-context:end -->\n'
}

write_generated_claude_md() {
  local file="$TARGET/CLAUDE.md"
  local owner
  local bounded_context
  owner="$(review_value "$(adoption_frontmatter_value owner)" "requires human review")"
  bounded_context="$(review_value "$(adoption_table_value "Bounded context")" "requires human review")"
  mkdir -p "$(dirname "$file")"
  {
    printf '# CLAUDE.md - %s\n\n' "$REPO_NAME"
    printf '> Generated by `tools/bootstrap-context --apply` on `%s`. Keep this file operational and under 200 lines.\n\n' "$GENERATED_AT"

    printf '## Mission\n\n'
    printf '%s is detected as a `%s`. Use confirmed repo files before making architecture or domain assumptions.\n\n' "$REPO_NAME" "$(repo_type)"

    printf '## Ownership\n\n'
    printf -- '- Owner: `%s`\n' "$owner"
    printf -- '- Bounded context: `%s`\n' "$bounded_context"
    printf -- '- Installed AI kit modules: `%s`\n\n' "$(installed_modules_inline)"

    printf '## Non-negotiable Rules\n\n'
    printf -- '- Preserve module and domain boundaries.\n'
    printf -- '- Do not introduce secrets, tokens or sensitive data.\n'
    printf -- '- Keep API, event and schema contracts aligned with code changes.\n'
    printf -- '- Ask before changing cross-domain contracts, architecture or generated context.\n'
    printf -- '- Prefer confirmed paths in this repo over inferred architecture.\n\n'

    printf '## Architecture\n\n'
    printf -- '- Stack: `%s`\n' "$(join_inline STACK)"
    printf -- '- Source roots: `%s`\n' "$(join_inline SOURCE_ROOTS)"
    printf -- '- Test roots: `%s`\n' "$(join_inline TEST_ROOTS)"
    printf -- '- Config files: `%s`\n' "$(join_inline CONFIG_FILES)"
    printf -- '- Architecture context: `.specify/memory/repo-architecture.md`\n'
    printf -- '- Repo context pack: `docs/ai-development-kit/repo-context-pack.md`\n\n'

    printf '## AI Kit Operating Mode\n\n'
    printf -- '- Treat installed AI kit modules as the default workflow for this repo.\n'
    printf -- '- Start from `CLAUDE.md`, `docs/ai-development-kit/adoption.md`, repo memory and context packs before implementation.\n'
    printf -- '- Use installed kit instructions, module docs, templates and checklists instead of inventing a parallel process.\n'
    if [[ -x "$TARGET/tools/kg-cli" ]]; then
      printf -- '- Graph-first context: prefer graph/context lookup for dependency, impact and navigation questions before broad manual search.\n'
      printf -- '- Use bounded graph slices or summaries to reduce token load; fall back to normal search only when graph context is missing, stale or exact text is required.\n'
    fi
    printf -- '- For feature work, use installed Spec Kit templates and preserve traceability from spec to plan, tasks, contracts and evidence.\n\n'

    printf '## Inputs And Outputs\n\n'
    printf '### Contracts\n\n'
    print_md_list_limited CONTRACT_EVIDENCE "No OpenAPI/AsyncAPI/schema files detected by heuristic. Confirm contracts before changing APIs or events." 8
    printf '\n### Backend Evidence\n\n'
    print_md_list_limited BACKEND_EVIDENCE "No backend handlers/controllers/adapters detected by heuristic." 8
    printf '\n### Frontend Evidence\n\n'
    print_md_list_limited FRONTEND_EVIDENCE "No frontend components/widgets detected by heuristic." 8

    printf '\n## Commands\n\n'
    print_md_list_limited COMMANDS "No build/test/lint command detected. Inspect README, CI and package manager files manually." 8

    printf '\n## Module Guidance\n\n'
    if [[ "${#BACKEND_EVIDENCE[@]}" -gt 0 || -d "$TARGET/docs/ai-development-kit/backend" ]]; then
      printf -- '- Backend changes: update contracts, runbooks, ADRs and backend prereview evidence.\n'
    fi
    if [[ "${#FRONTEND_EVIDENCE[@]}" -gt 0 || -d "$TARGET/docs/ai-development-kit/frontend" ]]; then
      printf -- '- Frontend changes: use HU templates, `.claude/` rules, BEM/Figma guidance and frontend prereview.\n'
    fi
    if [[ -x "$TARGET/tools/kg-cli" ]]; then
      printf -- '- Graph changes/context: refresh graph evidence when needed and prefer bounded graph context over loading whole repos.\n'
    fi
    printf -- '- Core workflow: use spec, plan, tasks, templates and evidence before implementation.\n\n'

    printf '## Testing Expectations\n\n'
    printf -- '- Run the detected build/test/lint commands that match the touched surface.\n'
    printf -- '- Add or update unit, integration, contract or UI tests according to the change risk.\n'
    printf -- '- Record skipped validations with reason and owner.\n\n'

    printf '## Security And Observability\n\n'
    printf -- '- Never log sensitive data.\n'
    printf -- '- Use placeholders for credentials and environment-specific values.\n'
    printf -- '- Preserve structured logs, correlation IDs and meaningful metrics on critical paths.\n\n'

    printf '## Spec Kit Workflow\n\n'
    printf 'For feature work, read or create in order:\n\n'
    printf '1. `specs/{feature}/spec.md`\n'
    printf '2. `specs/{feature}/plan.md`\n'
    printf '3. `specs/{feature}/tasks.md`\n'
    printf '4. `specs/{feature}/contracts/`\n\n'
    printf 'Do not implement before spec, plan and tasks exist for non-trivial work.\n\n'

    printf '## Read By Task Type\n\n'
    printf -- '- Feature: spec, plan, tasks, contracts, repo context pack.\n'
    printf -- '- Backend: contracts, runbooks, ADRs, backend module docs.\n'
    printf -- '- Frontend: HU, `.claude/` rules, frontend module docs, graph context.\n'
    printf -- '- Refactor: architecture context, tests, impacted module boundaries.\n'
    printf -- '- PR review: tasks, tests, contracts, DoD and changed graph/context evidence.\n\n'

    printf '## Do Not Do\n\n'
    printf -- '- Do not make unrelated refactors.\n'
    printf -- '- Do not edit unrelated domains or generated contracts without owner review.\n'
    printf -- '- Do not duplicate enterprise wiki content here; link deeper docs instead.\n\n'

    printf '## Deeper Docs\n\n'
    printf -- '- Bootstrap report: `%s`\n' "$OUTPUT"
    printf -- '- Adoption record: `docs/ai-development-kit/adoption.md`\n'
    printf -- '- Installed kit docs and templates: `docs/ai-development-kit/`, `specs/_templates/`\n'
    printf -- '- Domain context: `.specify/memory/domain-context.md`\n'
    printf -- '- Repo architecture: `.specify/memory/repo-architecture.md`\n'
    printf -- '- Architecture doc: `docs/architecture.md`\n'
    printf -- '- ADRs: `docs/adr/`\n'
    printf -- '- Contracts: `docs/contracts/`\n\n'

    write_claude_bootstrap_section
  } > "$file"
}

upsert_claude_section() {
  local file="$TARGET/CLAUDE.md"
  if claude_should_render_full "$file"; then
    write_generated_claude_md
    return
  fi
  local tmp
  tmp="$(mktemp)"
  awk '
    /<!-- modular_dev_ai_kit:bootstrap-context:start -->/ { skip = 1; next }
    /<!-- modular_dev_ai_kit:bootstrap-context:end -->/ { skip = 0; next }
    skip == 0 { print }
  ' "$file" > "$tmp"
  {
    cat "$tmp"
    printf '\n'
    write_claude_bootstrap_section
  } > "$file"
  rm -f "$tmp"
}

apply_updates() {
  write_generated_file ".specify/memory/domain-context.md" "Domain Context Pack"
  write_generated_file ".specify/memory/repo-architecture.md" "Repo Architecture Context"
  write_generated_file "docs/ai-development-kit/repo-context-pack.md" "Repo Context Pack"
  upsert_claude_section
}

detect_path_sets
detect_stack
collect_evidence
sync_graph_config_for_detected_roots
run_graph_index
inspect_graph_health
write_report

if [[ "$APPLY" == true ]]; then
  apply_updates
fi

echo "modular_dev_ai_kit bootstrap-context"
echo "target: $TARGET"
echo "report: $OUTPUT_ABS"
echo "apply: $APPLY"
echo "graph index: $graph_index_status"
echo "stack: $(join_inline STACK)"
echo "source roots: $(join_inline SOURCE_ROOTS)"
echo "commands: $(join_inline COMMANDS)"
echo "backend evidence: ${#BACKEND_EVIDENCE[@]}"
echo "frontend evidence: ${#FRONTEND_EVIDENCE[@]}"
echo "contract evidence: ${#CONTRACT_EVIDENCE[@]}"

if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
  echo ""
  echo "WARNINGS"
  print_md_list WARNINGS "No warnings."
fi

echo ""
echo "NEXT STEPS"
echo "- Review: $OUTPUT"
if [[ "$APPLY" != true ]]; then
  echo "- Optional apply: ./tools/bootstrap-context --apply"
fi
echo "- Ask an LLM to use confirmed paths from the report before editing code."

exit 0
