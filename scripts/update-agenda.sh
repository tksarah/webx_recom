#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "${SCRIPT_SOURCE%/*}" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENDA_PATH="${REPO_ROOT}/data/agenda.json"
DEPLOY=0

usage() {
  printf '%s\n' \
    'Usage: bash scripts/update-agenda.sh [--deploy] [--help]' \
    '' \
    'Fetch the latest official WebX Agenda and regenerate data/agenda.json.' \
    '' \
    'Options:' \
    '  --deploy  Rebuild and restart the Docker app service after refreshing Agenda data.' \
    '  --help    Show this help.'
}

agenda_summary() {
  local label="$1"

  if [[ ! -f "${AGENDA_PATH}" ]]; then
    echo "${label}: data/agenda.json not found"
    return
  fi

  node -e '
const fs = require("fs");
const agendaPath = process.argv[1];
const label = process.argv[2];
const agenda = JSON.parse(fs.readFileSync(agendaPath, "utf8"));
console.log(`${label}: ${agenda.lastUpdated || "unknown"} / ${Array.isArray(agenda.sessions) ? agenda.sessions.length : 0} sessions`);
' "${AGENDA_PATH}" "${label}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy)
      DEPLOY=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "${REPO_ROOT}"

agenda_summary "Before"
npm run agenda:refresh
agenda_summary "After"

if [[ "${DEPLOY}" -eq 1 ]]; then
  docker compose up -d --build app
fi
