# Shared by the git hooks. The real denylist names employers, products and people, so it stays
# git-ignored (_scripts/config/denylist.txt); the example ships with generic patterns only.
# One extended regex per line, matched case-insensitively. Blank lines and # comments are skipped.
# The example list would match itself.
DENYLIST_EXCLUDE=(':(exclude)_scripts/config/denylist.example.txt')

scan_denylist() {
  local label=$1 list=_scripts/config/denylist.txt patterns hits
  [ -f "$list" ] || list=_scripts/config/denylist.example.txt
  patterns=$(grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$list" || true)
  [ -n "$patterns" ] || return 0
  hits=$(grep -n -i -E -f <(printf '%s\n' "$patterns") || true)
  if [ -n "$hits" ]; then
    echo "denylist match in $label ($list):" >&2
    printf '%s\n' "$hits" | head -20 >&2
    return 1
  fi
}
