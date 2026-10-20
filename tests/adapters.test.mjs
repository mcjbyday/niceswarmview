// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createAdapter as memory } from '../adapters/memory/index.mjs'
import { createAdapter as none } from '../adapters/none/index.mjs'
import { createAdapter as gascity, closingNote } from '../adapters/gascity/index.mjs'
import { contract } from './adapter-contract.mjs'
import { REPO } from './fixture.mjs'

const ex = JSON.parse(fs.readFileSync(path.join(REPO, 'examples/work-items.json'), 'utf8'))
contract('memory', () => memory({ workItems: ex.workItems, projects: ex.projects }))
contract('none', () => none(), { expectItems: false })

// Gas City adapter against canned CLI output: no bd or gc on the machine needed.
const canned = { bd: fs.readFileSync(path.join(REPO, 'examples/gascity/bd-list.json'), 'utf8'), gc: fs.readFileSync(path.join(REPO, 'examples/gascity/gc-rig-list.json'), 'utf8') }
const exec = (cmd) => canned[cmd]
contract('gascity (canned)', () => gascity({ exec }))

test('gascity maps bead metadata and the closing note', () => {
  const [a, b] = gascity({ exec }).listWorkItems('/tmp')
  assert.equal(a.id, 'ab-123'); assert.equal(a.workBranch, 'feature-branch'); assert.equal(a.outcome, 'shipped'); assert.equal(a.verification, 'node --test')
  assert.equal(a.note, 'Card.js was added and App.js now imports it. Open App.js first.')
  assert.equal(a.design, 'why a Card and not a list item: reuse')
  assert.equal(b.workCommit, null); assert.equal(b.note, null)
  assert.equal(closingNote('no marker here'), null)
})

test('gascity lists rigs as projects, skipping the hq rig', () => {
  assert.deepEqual(gascity({ exec }).listProjects('/tmp'), [{ name: 'fixture-project', path: '/tmp/niceswarmview-fixture', defaultBranch: 'main' }])
})

test('gascity returns empty lists when the CLIs fail', () => {
  const a = gascity({ exec: () => { throw new Error('not installed') } })
  assert.deepEqual(a.listWorkItems('/tmp'), []); assert.deepEqual(a.listProjects('/tmp'), [])
})
