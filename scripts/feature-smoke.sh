#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-"http://localhost:5000"}
# Smoke tests use the passwordless demo-login endpoint so no secrets live in
# this script. Override LOGIN_EMAIL/LOGIN_PASSWORD to fall back to a real login
# against a non-demo account (e.g., in CI against a test user).
LOGIN_EMAIL=${LOGIN_EMAIL:-""}
LOGIN_PASSWORD=${LOGIN_PASSWORD:-""}
CURL_OPTS=(--silent --show-error --fail)

function header() {
  echo "\n== $1 =="
}

function login() {
  local response
  if [[ -n "${LOGIN_EMAIL}" && -n "${LOGIN_PASSWORD}" ]]; then
    header "Logging in as ${LOGIN_EMAIL}"
    response=$(curl "${CURL_OPTS[@]}" -X POST "${API_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}")
  else
    header "Logging in via demo-login (passwordless)"
    response=$(curl "${CURL_OPTS[@]}" -X POST "${API_URL}/api/auth/demo-login" \
      -H "Content-Type: application/json" \
      -d "{}")
  fi
  token=$(echo "$response" | jq -r '.data.accessToken // .token // empty')
  if [[ -z "${token}" ]]; then
    echo "Login failed; no token returned" >&2
    exit 1
  fi
  echo "Token acquired"
}

function fetch_first_project() {
  header "Fetching first project"
  local response
  response=$(curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/projects?limit=1")
  project_id=$(echo "$response" | jq -r '.data.projects[0].id // empty')
  if [[ -z "$project_id" ]]; then
    echo "No projects available for smoke checks" >&2
    exit 1
  fi
  echo "Using project ${project_id}"
}

function check_project_types() {
  header "Checking project types"
  curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/projects/types" | jq '{projectTypes: .data.projectTypes}'
}

function check_magic_markers() {
  header "Listing magic markers"
  curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/projects/${project_id}/magic-markers" | jq '{count: (.data.magicMarkers | length), sample: (.data.magicMarkers[0])}'
}

function check_audio_notes() {
  header "Listing audio notes"
  curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/notes/audio" | jq '{count: (.data.notes | length), sample: (.data.notes[0] | {id, pattern_name, transcript})}'
}

function check_chart_symbols() {
  header "Fetching chart symbol library"
  curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/charts/symbols" | jq '{count: (.data.symbols | length), sample: (.data.symbols[0] | {name, category, description})}'
}

function check_export_head() {
  header "Checking pattern export availability"
  local pattern_id
  pattern_id=$(curl "${CURL_OPTS[@]}" -H "Authorization: Bearer ${token}" "${API_URL}/api/patterns?limit=1" | jq -r '.data.patterns[0].id // empty')
  if [[ -z "$pattern_id" ]]; then
    echo "No patterns available; skipping export check" && return
  fi
  # Use HEAD to avoid downloading full PDF
  curl --silent --fail -I -H "Authorization: Bearer ${token}" "${API_URL}/api/patterns/${pattern_id}/export" | head -n 5
}

login
fetch_first_project
check_project_types
check_magic_markers
check_audio_notes
check_chart_symbols
check_export_head

echo "\nSmoke checks completed."
