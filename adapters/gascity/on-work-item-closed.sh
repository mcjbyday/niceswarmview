#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2026 Michael Jacobs
# Gas City hook (order exec on bead.closed): snapshot and delta every closed
# bead that carries a work commit and has no delta yet. Runs in the
# controller's minimal environment: PATH is set here (NICESWARMVIEW_TOOL_PATH
# names the folder holding gc, bd, jq and node), output goes to
# <city>/.gc/runtime/niceswarmview.log, and rig commands run with the city
# store's GC_* / BEADS_* variables cleared so bd reads the rig's own store.
# No model calls. Idempotent: a bead with an existing delta file is skipped.
#   orders/niceswarmview-snapshot.toml: trigger = "event", on = "bead.closed"
#   manual: GC_CITY=<city> adapters/gascity/on-work-item-closed.sh
set -u
export PATH="${NICESWARMVIEW_TOOL_PATH:-/usr/local/bin}:/usr/bin:/bin:${PATH:-}"
SELF="$(cd "$(dirname "$0")/../.." && pwd)"
CITY="${GC_CITY:-$(pwd)}"
CITY_NAME="$(basename "$CITY")"
LOG="$CITY/.gc/runtime/niceswarmview.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "$(date -u +%FT%TZ) run city=$CITY_NAME"
clean() { env $(env | grep -E '^(GC_|BEADS_)' | cut -d= -f1 | sed 's/^/-u /') "$@"; }
cd "$CITY" || exit 1
gc rig list --json 2>/dev/null | jq -r '.rigs[] | select(.hq|not) | "\(.name)\t\(.path)\t\(.default_branch // "main")"' |
  while IFS=$'\t' read -r name path branch; do
    [ -d "$path/.git" ] || continue
    clean bash -c "cd \"$path\" && bd list --all --json" 2>/dev/null |
      jq -r '(if type=="array" then . else .issues end) // [] | .[] | select(.status=="closed" and .metadata["gc.work_commit"] != null) | "\(.id)\t\(.metadata["gc.work_commit"])"' |
      while IFS=$'\t' read -r bead commit; do
        out="$SELF/local_data/$CITY_NAME/$name/deltas/$bead.json"
        [ -e "$out" ] && continue
        git -C "$path" cat-file -e "$commit^{commit}" 2>/dev/null || { git -C "$path" fetch -q origin 2>/dev/null; git -C "$path" cat-file -e "$commit^{commit}" 2>/dev/null || { echo "skip $name $bead: commit $commit not in repo"; continue; }; }
        # Base: the newest earlier snapshot that is an ancestor of the work
        # commit, else the commit's first parent.
        base=""
        for s in $(ls -t "$SELF/local_data/$CITY_NAME/$name/snapshots/" 2>/dev/null | sed 's/\.json$//'); do
          [ "$s" = "$commit" ] && continue
          if git -C "$path" merge-base --is-ancestor "$s" "$commit" 2>/dev/null; then base="$s"; break; fi
        done
        [ -n "$base" ] || base="$commit^"
        if clean node "$SELF/core/delta.mjs" --adapter gascity --workspace "$CITY_NAME" --project "$path" --name "$name" --base "$base" --head "$commit" --id "$bead" --item "$bead"; then
          echo "delta $name $bead ($base..$commit)"
        else
          echo "FAILED $name $bead" >&2
        fi
      done
  done
