#!/usr/bin/env bash
set -euo pipefail
ATLAS_PG_BIN="${ATLAS_PG_BIN:-/usr/lib/postgresql/16/bin}"
if [[ ! -x "$ATLAS_PG_BIN/initdb" ]]; then
  echo 'PostgreSQL 16 binaries are required. Set ATLAS_PG_BIN to their directory.' >&2
  exit 1
fi
ATLAS_TEST_DB_DIR="$(mktemp -d /tmp/atlas-db-test.XXXXXX)"
"$ATLAS_PG_BIN/initdb" -D "$ATLAS_TEST_DB_DIR/data" -A trust --no-locale -U atlas_test > "$ATLAS_TEST_DB_DIR/init.log"
trap '"$ATLAS_PG_BIN/pg_ctl" -D "$ATLAS_TEST_DB_DIR/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$ATLAS_PG_BIN/pg_ctl" -D "$ATLAS_TEST_DB_DIR/data" -l "$ATLAS_TEST_DB_DIR/server.log" -o "-h '' -k $ATLAS_TEST_DB_DIR -p 55439" -w start > /dev/null
"$ATLAS_PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$ATLAS_TEST_DB_DIR" -p 55439 -U atlas_test -d postgres \
  -f supabase/tests/bootstrap.sql \
  -f supabase/migrations/20261017000100_atlas_schema.sql \
  -f supabase/migrations/20261017000200_import_wim_data.sql \
  -f supabase/migrations/20261020000100_remove_saved_views.sql \
  -f supabase/migrations/20261030000100_administration.sql \
  -f supabase/tests/isolation.sql \
  -f supabase/tests/administration.sql
