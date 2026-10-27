#!/usr/bin/env bash
# Turn an existing vault into a clone of this repo without touching its notes.
#
#   _scripts/tools/attach-vault.sh <vault> [repo-url]
#
# The vault keeps every file it already has. Tracked framework files that are missing
# are checked out; tracked files that differ are left as local modifications and listed.
# A vault without a personal/ org gets a sparse checkout that leaves out the personal/
# placeholder, so the folder never appears there and personal-only flows stay disabled.
# The leak-guard hooks are enabled. Copy the private denylist to
# _scripts/config/denylist.txt yourself; it is git-ignored and never pushed.
set -euo pipefail
vault=${1:?usage: attach-vault.sh <vault> [repo-url]}
vault=$(cd "$vault" && pwd)
url=${2:-$(git -C "$(dirname "$0")/../.." remote get-url origin)}
[ -d "$vault/.obsidian" ] || { echo "Not an Obsidian vault: $vault" >&2; exit 1; }
[ -e "$vault/.git" ] && { echo "Already a repository: $vault" >&2; exit 1; }

tmp="$vault/.git-attach-tmp"
git clone --quiet --no-checkout "$url" "$tmp"
mv "$tmp/.git" "$vault/.git"
rmdir "$tmp"
cd "$vault"
git reset --quiet # index from HEAD, working tree untouched

if [ ! -d personal ]; then
  git config core.sparseCheckout true
  printf '/*\n!/personal/\n' > .git/info/sparse-checkout
  git sparse-checkout reapply
fi
git config core.hooksPath _scripts/git-hooks

git ls-files --deleted -z | while IFS= read -r -d '' file; do git checkout -- "$file"; done
modified=$(git ls-files --modified)
[ -z "$modified" ] || printf 'Local modifications kept (review with git diff):\n%s\n' "$modified"
echo "Attached $vault to $url at $(git rev-parse --short HEAD)."
