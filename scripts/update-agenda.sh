#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "${SCRIPT_SOURCE%/*}" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENDA_PATH="${REPO_ROOT}/data/agenda.json"
SIDE_EVENTS_PATH="${REPO_ROOT}/data/side-events.json"
DEPLOY=0

usage() {
  printf '%s\n' \
    'Usage: bash scripts/update-agenda.sh [--deploy] [--help]' \
    '' \
    'Fetch the latest official WebX Agenda and Luma side events.' \
    'Regenerate data/agenda.json and data/side-events.json.' \
    'Host requirements: bash and docker compose. Node/npm run inside Docker.' \
    '' \
    'Options:' \
    '  --deploy  Rebuild and restart the Docker app service after refreshing Agenda and side events data.' \
    '  --help    Show this help.'
}

agenda_summary() {
  local label="$1"

  if [[ ! -f "${AGENDA_PATH}" ]]; then
    echo "${label}: data/agenda.json not found"
    return
  fi

  docker compose run --rm --build --no-deps --entrypoint node agenda-refresh -e '
const fs = require("fs");
const agendaPath = "/app/data/agenda.json";
const label = process.argv[1];
const agenda = JSON.parse(fs.readFileSync(agendaPath, "utf8"));
console.log(`${label}: ${agenda.lastUpdated || "unknown"} / ${Array.isArray(agenda.sessions) ? agenda.sessions.length : 0} sessions`);
' "${label}"
}

side_events_summary() {
  local label="$1"

  if [[ ! -f "${SIDE_EVENTS_PATH}" ]]; then
    echo "${label}: data/side-events.json not found"
    return
  fi

  docker compose run --rm --build --no-deps --entrypoint node agenda-refresh -e '
const fs = require("fs");
const sideEventsPath = "/app/data/side-events.json";
const label = process.argv[1];
const sideEvents = JSON.parse(fs.readFileSync(sideEventsPath, "utf8"));
console.log(`${label}: ${sideEvents.lastUpdated || "unknown"} / ${Array.isArray(sideEvents.events) ? sideEvents.events.length : 0} side events`);
' "${label}"
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

agenda_summary "Agenda before"
side_events_summary "Side events before"
docker compose run --rm --build agenda-refresh npm run agenda:refresh
docker compose run --rm --build agenda-refresh npm run side-events:refresh
agenda_summary "Agenda after"
side_events_summary "Side events after"

if [[ "${DEPLOY}" -eq 1 ]]; then
  docker compose up -d --build app
fi
