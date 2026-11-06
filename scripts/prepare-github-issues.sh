#!/bin/sh
# Default is a local dry run. --apply creates real GitHub issues and can
# create duplicates if run more than once. No automatic assignees or labels.
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
mode=dry
repo=""

usage() {
  echo 'Usage: prepare-github-issues.sh [--apply OWNER/REPO]' >&2
  exit 2
}

if [ "${1:-}" = "--apply" ]; then
  [ "$#" -eq 2 ] || usage
  mode=apply
  repo=$2
  case "$repo" in
    */*) owner=${repo%%/*}; name=${repo#*/} ;;
    *) usage ;;
  esac
  case "$owner" in ''|*[!A-Za-z0-9_.-]*) usage ;; esac
  case "$name" in ''|*[!A-Za-z0-9_.-]*) usage ;; esac
  command -v gh >/dev/null || { echo 'Install GitHub CLI (gh) first.' >&2; exit 1; }
elif [ "$#" -ne 0 ]; then
  usage
fi

issue_title() {
  file=$1
  heading_count=$(grep -c '^# 🎯 مهمة رقم: ' "$file" || true)
  title_count=$(grep -c '^\*\*العنوان:\*\*' "$file" || true)
  if [ "$heading_count" -ne 1 ] || [ "$title_count" -ne 1 ]; then
    echo "Invalid task heading or title in $file" >&2
    return 1
  fi
  id=$(sed -n 's/^# 🎯 مهمة رقم: \([^[:space:]]*\)[[:space:]]*$/\1/p' "$file")
  subject=$(sed -n 's/^\*\*العنوان:\*\*[[:space:]]*//p' "$file" | sed 's/[[:space:]]*$//')
  base=${file##*/}
  base=${base%.md}
  case "$id" in P[1-5]-[0-9][0-9]) ;; *) echo "Invalid task ID in $file" >&2; return 1 ;; esac
  if [ "$id" != "$base" ] || [ -z "$subject" ]; then
    echo "Task ID or title does not match filename in $file" >&2
    return 1
  fi
  printf '[%s] %s\n' "$id" "$subject"
}

# Validate every task before any remote creation; fail if the directory is empty.
count=0
for f in "$ROOT"/planning/issues/*.md; do
  [ -f "$f" ] || continue
  title=$(issue_title "$f") || exit 1
  count=$((count + 1))
  if [ "$mode" = dry ]; then
    printf '%s\n' "DRY RUN: $title"
  fi
done
[ "$count" -gt 0 ] || { echo 'No task Markdown files found.' >&2; exit 1; }

if [ "$mode" = dry ]; then
  echo 'No issues were created. --apply creates real issues and may duplicate them on repeated runs.'
else
  gh auth status >/dev/null
  for f in "$ROOT"/planning/issues/*.md; do
    [ -f "$f" ] || continue
    title=$(issue_title "$f") || exit 1
    if ! gh issue create --repo "$repo" --title "$title" --body-file "$f"; then
      echo 'Creation stopped; earlier issues may already exist. Check GitHub before retrying.' >&2
      exit 1
    fi
  done
fi
