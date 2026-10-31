#!/usr/bin/env bash
# A tenant's encrypted backup (F15.5, docs/runbooks/yedek-ve-geri-yukleme.md).
#
#   backup.sh --db <database> --recipients <file> --out <dir> [--files <dir>]
#
# Writes into <dir>, named <database>-<UTC time>:
#   .dump.age        the database (pg_dump custom format), encrypted to the
#                    recipients' age public keys while it is read: the
#                    plain dump never touches the disk
#   .files.tar.age   with --files: that directory, the same way
#   .manifest.json   in the clear, no personal data: what was taken, when,
#                    each encrypted file's sha256 and every table's row count
#                    (restore.sh checks the restored copy against them)
#
# Postgres is reached the usual libpq way (PGHOST, PGPORT, PGUSER,
# PGPASSFILE); PG_EXEC, if set, runs pg_dump and psql through a prefix, as
# `docker exec -i -e PGUSER=postgres <container>` does in development.
# Only public keys are needed here: the key that opens a backup is never
# on the machine that makes one.
set -euo pipefail

usage() {
  echo "usage: $0 --db <database> --recipients <file> --out <dir> [--files <dir>]" >&2
  exit 2
}

db="" recipients="" out="" files=""
while [ $# -gt 0 ]; do
  case "$1" in
    --db) db="${2:-}"; shift 2 ;;
    --recipients) recipients="${2:-}"; shift 2 ;;
    --out) out="${2:-}"; shift 2 ;;
    --files) files="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$db" ] && [ -n "$recipients" ] && [ -n "$out" ] || usage
[ -r "$recipients" ] || { echo "recipients file not readable: $recipients" >&2; exit 2; }
grep -q '^age1' "$recipients" || { echo "no age public key (age1...) in $recipients" >&2; exit 2; }
if grep -q 'AGE-SECRET-KEY' "$recipients"; then
  echo "$recipients holds a secret key; only public keys belong on this machine" >&2
  exit 2
fi
[ -z "$files" ] || [ -d "$files" ] || { echo "not a directory: $files" >&2; exit 2; }
command -v age > /dev/null || { echo "age is not installed" >&2; exit 2; }

# PG_EXEC is split into words on purpose: a command and its arguments
# shellcheck disable=SC2086
pg() { if [ -n "${PG_EXEC:-}" ]; then ${PG_EXEC} "$@"; else "$@"; fi; }

umask 077
mkdir -p "$out"
name="$db-$(date -u +%Y%m%dT%H%M%SZ)"
taken_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
started=$(date -u +%s)

# A backup that failed halfway is no backup: nothing of it is left behind
discard() { rm -f "$out/$name.dump.age" "$out/$name.files.tar.age" "$out/$name.manifest.json"; }
trap 'discard; exit 1' ERR INT TERM

# Row counts first: a quiet database's counts match the dump exactly; a
# busy one's may differ by what was written meanwhile (restore.sh warns)
counts=$(pg psql -X -At -v ON_ERROR_STOP=1 -d "$db" -c "
  select coalesce(json_object_agg(table_name, rows order by table_name), '{}')
  from (
    select table_name,
      (xpath('/row/c/text()', query_to_xml(
        format('select count(*) as c from %I.%I', table_schema, table_name),
        false, true, '')))[1]::text::bigint as rows
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  ) t")
server=$(pg psql -X -At -d "$db" -c "show server_version")

pg pg_dump --format=custom --no-owner --no-acl --dbname="$db" \
  | age --encrypt --recipients-file "$recipients" --output "$out/$name.dump.age"

if [ -n "$files" ]; then
  tar -C "$files" -cf - . \
    | age --encrypt --recipients-file "$recipients" --output "$out/$name.files.tar.age"
fi

sha() {
  if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}
size() { wc -c < "$1" | tr -d ' '; }
dump_entry="{\"file\": \"$name.dump.age\", \"sha256\": \"$(sha "$out/$name.dump.age")\", \"bytes\": $(size "$out/$name.dump.age")}"
files_entry="null"
if [ -n "$files" ]; then
  files_entry="{\"file\": \"$name.files.tar.age\", \"sha256\": \"$(sha "$out/$name.files.tar.age")\", \"bytes\": $(size "$out/$name.files.tar.age")}"
fi

cat > "$out/$name.manifest.json" <<JSON
{
  "database": "$db",
  "taken_at": "$taken_at",
  "seconds": $(( $(date -u +%s) - started )),
  "postgres": "$server",
  "dump": $dump_entry,
  "files": $files_entry,
  "rows": $counts
}
JSON

echo "$out/$name.manifest.json"
