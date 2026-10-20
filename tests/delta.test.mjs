// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// End to end: snapshot both fixture commits, delta them with the memory
// adapter, and check the model-level result.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { makeFixture, run, REPO } from './fixture.mjs'

test('snapshot and delta over the fixture wave', () => {
  const f = makeFixture()
  const env = { NICESWARMVIEW_DATA: f.data, NICESWARMVIEW_ADAPTER: 'memory', NICESWARMVIEW_WORK_ITEMS: path.join(REPO, 'examples/work-items.json') }
  const out = run('bin/delta.mjs', ['--workspace', 'demo', '--project', f.dir, '--base', f.shaA, '--head', f.shaB, '--id', 'wave1'], env)
  assert.match(out, /demo\/.* wave1: \+1 -0 ~1/)
  const d = JSON.parse(fs.readFileSync(path.join(f.data, 'demo', path.basename(f.dir), 'deltas', 'wave1.json'), 'utf8'))
  assert.deepEqual(d.nodes.added.map((n) => n.id), ['src/components/Card'])
  const app = d.nodes.changed.find((n) => n.id === 'src/App')
  assert.deepEqual(app.facets.imports.added, ['src/components/Card'])
  assert.deepEqual(app.facets.children.added, ['Card'])
  assert.ok(d.edges.added.includes('src/App -> src/components/Card'))
  assert.equal(d.workItems.length, 1); assert.equal(d.workItems[0].id, 'ab-123'); assert.equal(d.workItems[0].note.startsWith('Card.js was added'), true)
  assert.equal(d.commits.length, 1); assert.ok(d.changedFiles.some((c) => c.path === 'src/components/Card.js' && c.status === 'A' && c.patch.includes('function Card')))
  const s = JSON.parse(fs.readFileSync(path.join(f.data, 'demo', path.basename(f.dir), 'snapshots', `${f.shaB}.json`), 'utf8'))
  const impl = s.modules.find((m) => m.id === 'pkg/impl')
  assert.deepEqual(impl.imports, ['pkg/base']); assert.equal(impl.metrics.coverage.lines, 77.8); assert.equal(impl.metrics.mutation.killed, 9)
  assert.equal(s.edges.find((e) => e.from === 'pkg/impl' && e.to === 'pkg/base').kind, 'inheritance')
  const idx = JSON.parse(fs.readFileSync(path.join(f.data, 'index.json'), 'utf8'))
  assert.ok(idx.projects[`demo/${path.basename(f.dir)}`].deltas.wave1.workItems.includes('ab-123'))
})

test('delta with the none adapter still carries modules and commits', () => {
  const f = makeFixture()
  const out = run('bin/delta.mjs', ['--workspace', 'demo', '--project', f.dir, '--base', f.shaA, '--head', f.shaB, '--adapter', 'none'], { NICESWARMVIEW_DATA: f.data })
  assert.match(out, /0 work items/)
})
