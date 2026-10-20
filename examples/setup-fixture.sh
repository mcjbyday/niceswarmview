#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2026 Michael Jacobs
# Create a throwaway git repository from examples/fixture-project with two
# commits and print its path. Commit 1: the tree without Card.js. Commit 2:
# Card.js added and imported by App.js, subject "(ab-123)" so the memory
# adapter's example work item joins to it.
# Usage: examples/setup-fixture.sh [target-dir]
set -eu
SRC="$(cd "$(dirname "$0")/fixture-project" && pwd)"
DIR="${1:-$(mktemp -d "${TMPDIR:-/tmp}/niceswarmview-fixture.XXXXXX")}"
mkdir -p "$DIR"
cp -R "$SRC"/. "$DIR"/
cd "$DIR"
git init -q -b main
git -c user.name=fixture -c user.email=fixture@example.invalid add -A
git rm -q --cached src/components/Card.js
mv src/components/Card.js /tmp/niceswarmview-card.$$
sed -i.bak "/components\/Card/d" src/App.js && rm -f src/App.js.bak
git -c user.name=fixture -c user.email=fixture@example.invalid commit -q -m "Initial fixture tree"
mv /tmp/niceswarmview-card.$$ src/components/Card.js
python3 - <<'PY'
import re
p='src/App.js'; t=open(p).read()
t=t.replace("import Top from './components/Top'\n","import Top from './components/Top'\nimport Card from './components/Card'\n")
t=t.replace("return <Top items={projects} open={open} onToggle={() => setOpen(!open)} />","return <><Top items={projects} open={open} onToggle={() => setOpen(!open)} />{projects.map((p) => <Card key={p.id} title={p.title} />)}</>")
open(p,'w').write(t)
PY
git -c user.name=fixture -c user.email=fixture@example.invalid add -A
git -c user.name=fixture -c user.email=fixture@example.invalid commit -q -m "Add Card component and render one per project (ab-123)"
echo "$DIR"
