// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// core/ and viewer/ must not know any work tracker.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { REPO } from './fixture.mjs'

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])

test('no tracker vocabulary in core or viewer', () => {
  const bad = []
  for (const f of [...walk(path.join(REPO, 'core')), ...walk(path.join(REPO, 'viewer')), ...walk(path.join(REPO, 'bin'))]) {
    const t = fs.readFileSync(f, 'utf8')
    for (const re of [/\bbd\b/, /\bgc\b/, /\bbeads?\b/, /\bdolt\b/, /\bGC_/, /\bBEADS_/, /\brigs?\b/, /\bcity\b/]) if (re.test(t)) bad.push(`${path.relative(REPO, f)}: ${re}`)
  }
  assert.deepEqual(bad, [])
})
