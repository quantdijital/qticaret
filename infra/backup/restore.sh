#!/usr/bin/env bash
# A tenant's backup back into a database (F15.5, docs/runbooks/yedek-ve-geri-yukleme.md).
#
#   restore.sh --manifest <file> --identity <file> --target-db <database>
#              [--files-to <dir>] [--strict]
#
# 1. Each encrypted file is checked against the manifest's sha256 first.
# 2. The target database is made if missing; one that already holds tables
#    is refused, so a restore never writes over a live shop.
# 3. The dump is decrypted as it is read into pg_restore: the plain dump
#    never touches the disk.
# 4. Every table's rows are counted against the manifest. A missing table
#    fails the restore; a count that differs is a warning (a busy shop was
#    written to while the backup ran), a failure with --strict.
# 5. With --files-to, the files go into that directory (empty or new).
#
# The identity is the age secret key, kept offline (the runbook says where);
# Postgres is reached as backup.sh reaches it (libpq variables, PG_EXEC).
set -euo pipefail

usage() {
  echo "usage: $0 --manifest <file> --identity <file> --target-db <database> [--files-to <dir>] [--strict]" >&2
  exit 2
}

manifest="" identity="" target="" files_to="" strict=0
while [ $# -gt 0 ]; do
  case "$1" in
    --manifest) manifest="${2:-}"; shift 2 ;;
    --identity) identity="${2:-}"; shift 2 ;;
    --target-db) target="${2:-}"; shift 2 ;;
    --files-to) files_to="${2:-}"; shift 2 ;;
    --strict) strict=1; shift ;;
    *) usage ;;
  esac
done
[ -n "$manifest" ] && [ -n "$identity" ] && [ -n "$target" ] || usage
[ -r "$manifest" ] || { echo "manifest not readable: $manifest" >&2; exit 2; }
[ -r "$identity" ] || { echo "identity not readable: $identity" >&2; exit 2; }
# Quoted as an identifier below; anything else is a mistake
[[ "$target" =~ ^[A-Za-z0-9_-]{1,63}$ ]] || { echo "not a database name: $target" >&2; exit 2; }
command -v age > /dev/null || { echo "age is not installed" >&2; exit 2; }

# PG_EXEC is split into words on purpose: a command and its arguments
# shellcheck disable=SC2086
pg() { if [ -n "${PG_EXEC:-}" ]; then ${PG_EXEC} "$@"; else "$@"; fi; }
sha() {
  if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

dir=$(dirname "$manifest")
# The manifest is backup.sh's: one entry per line, in its own layout
entry() { sed -n "s/.*\"$1\": {\"file\": \"\\([^\"]*\\)\", \"sha256\": \"\\([0-9a-f]*\\)\".*/\\$2/p" "$manifest"; }
dump=$(entry dump 1)
[ -n "$dump" ] || { echo "no dump named in $manifest" >&2; exit 2; }
files=$(entry files 1)

check() {
  local file="$1" want="$2"
  [ -r "$dir/$file" ] || { echo "missing: $dir/$file" >&2; exit 1; }
  [ "$(sha "$dir/$file")" = "$want" ] || { echo "sha256 differs, not restoring: $file" >&2; exit 1; }
}
check "$dump" "$(entry dump 2)"
[ -z "$files" ] || check "$files" "$(entry files 2)"
if [ -n "$files_to" ]; then
  [ -n "$files" ] || { echo "this backup holds no files" >&2; exit 2; }
  if [ -d "$files_to" ] && [ -n "$(ls -A "$files_to")" ]; then
    echo "not empty, not restoring files into it: $files_to" >&2
    exit 1
  fi
fi

# The key must open the backup before anything is made: age refuses a
# file not encrypted to it before giving out a byte
opens=$(set +o pipefail; age --decrypt --identity "$identity" "$dir/$dump" 2> /dev/null | head -c 1 | wc -c | tr -d ' ')
[ "$opens" = "1" ] || { echo "this identity does not open $dump" >&2; exit 1; }

started=$(date -u +%s)
exists=$(pg psql -X -At -d postgres -c "select 1 from pg_database where datname = '$target'")
if [ -z "$exists" ]; then
  pg psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database \"$target\""
else
  tables=$(pg psql -X -At -d "$target" -c \
    "select count(*) from information_schema.tables where table_schema = 'public'")
  [ "$tables" = "0" ] || { echo "$target already holds $tables tables; restore into an empty database" >&2; exit 1; }
fi

age --decrypt --identity "$identity" "$dir/$dump" \
  | pg pg_restore --no-owner --no-acl --exit-on-error --dbname="$target"

# The manifest's counts against the restored ones, in the database itself
# (psql reads JSON; no other tool needed)
report=$( {
  printf '%s\n' "\\set manifest '$(tr -d '\n' < "$manifest" | sed "s/'/''/g")'"
  cat <<'SQL'
with wanted as (
  select key as table_name, value::bigint as rows
  from json_each_text((:'manifest')::json -> 'rows')
), restored as (
  select table_name,
    (xpath('/row/c/text()', query_to_xml(
      format('select count(*) as c from %I.%I', table_schema, table_name),
      false, true, '')))[1]::text::bigint as rows
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
)
select case
    when r.table_name is null then 'missing'
    when r.rows <> w.rows then 'differs'
    else 'same' end,
  w.table_name, w.rows, coalesce(r.rows, -1)
from wanted w left join restored r using (table_name)
order by 1, 2;
SQL
} | pg psql -X -At -F ' ' -v ON_ERROR_STOP=1 -d "$target")

missing=$(grep -c '^missing ' <<< "$report" || true)
differs=$(grep -c '^differs ' <<< "$report" || true)
same=$(grep -c '^same ' <<< "$report" || true)
grep -E '^(missing|differs) ' <<< "$report" | sed 's/^/  /' >&2 || true

if [ -n "$files_to" ]; then
  mkdir -p "$files_to"
  age --decrypt --identity "$identity" "$dir/$files" | tar -C "$files_to" -xf -
fi

echo "restored into $target in $(( $(date -u +%s) - started ))s: $same tables match, $differs differ, $missing missing"
if [ "$missing" -gt 0 ] || { [ "$strict" -eq 1 ] && [ "$differs" -gt 0 ]; }; then
  exit 1
fi
