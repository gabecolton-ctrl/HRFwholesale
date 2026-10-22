#!/usr/bin/env bash
# Runs the migration twice (must be re-runnable) and the rule tests on a fresh local Postgres.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PSQL="psql -h ${PGHOST:-/var/lib/postgresql/hrftest} -p ${PGPORT:-54329} -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "drop database if exists hrf_test" -c "create database hrf_test"
$PSQL -d hrf_test -f "$HERE/supabase_stub.sql"
$PSQL -d hrf_test -f "$HERE/../migrations/0001_phase1.sql"
$PSQL -d hrf_test -f "$HERE/../migrations/0001_phase1.sql"
$PSQL -d hrf_test -f "$HERE/../migrations/0002_phase2.sql"
$PSQL -d hrf_test -f "$HERE/../migrations/0002_phase2.sql"
$PSQL -d hrf_test -f "$HERE/rules_test.sql"
$PSQL -d hrf_test -f "$HERE/phase2_test.sql"
