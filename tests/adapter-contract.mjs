// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// The contract every adapter must meet; run it against each adapter.
import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAdapter, WORK_ITEM_FIELDS } from '../core/adapter.mjs'

export function contract(label, makeAdapter, { projectPath = '/tmp', workspacePath = '/tmp', expectItems = true } = {}) {
  test(`${label}: shape`, async () => {
    const a = assertAdapter(makeAdapter(), label)
    const items = await a.listWorkItems(projectPath)
    assert.ok(Array.isArray(items))
    for (const i of items) {
      assert.equal(typeof i.id, 'string'); assert.equal(typeof i.title, 'string'); assert.equal(typeof i.status, 'string')
      assert.ok(Array.isArray(i.labels))
      assert.ok(i.workCommit == null || /^[0-9a-f]{7,40}$/.test(i.workCommit), `workCommit ${i.workCommit}`)
      for (const k of Object.keys(i)) assert.ok(WORK_ITEM_FIELDS.includes(k), `unexpected field ${k}`)
    }
    if (expectItems) assert.ok(items.length > 0)
    const projects = await a.listProjects(workspacePath)
    assert.ok(Array.isArray(projects))
    for (const p of projects) { assert.equal(typeof p.name, 'string'); assert.equal(typeof p.path, 'string'); assert.equal(typeof p.defaultBranch, 'string') }
    if (a.workItemIdPattern) assert.ok(a.workItemIdPattern.global)
  })
}
