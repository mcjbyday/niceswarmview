// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// Work-tracker adapters. Core never talks to a tracker directly; it asks the
// adapter named by --adapter or NICESWARMVIEW_ADAPTER (default: none).
//
// An adapter module exports createAdapter(opts) returning:
//   listWorkItems(projectPath) -> [{ id, title, status, type, labels, closedAt,
//                                    workCommit, workBranch, verification, outcome, note, design }]
//   listProjects(workspacePath) -> [{ name, path, defaultBranch }]
//   workItemIdPattern            -> RegExp (global, one capture group) or null
// Push notifications (a work item closed) are the adapter's own hook script
// calling core/delta.mjs; see adapters/gascity/on-work-item-closed.sh.

export async function loadAdapter(name = process.env.NICESWARMVIEW_ADAPTER || 'none', opts = {}) {
  const mod = await import(new URL(`../adapters/${name}/index.mjs`, import.meta.url))
  const adapter = mod.createAdapter(opts)
  assertAdapter(adapter, name)
  return adapter
}

export function assertAdapter(adapter, name = 'adapter') {
  for (const fn of ['listWorkItems', 'listProjects']) if (typeof adapter[fn] !== 'function') throw new Error(`${name}: missing ${fn}()`)
  if (adapter.workItemIdPattern != null && !(adapter.workItemIdPattern instanceof RegExp)) throw new Error(`${name}: workItemIdPattern must be a RegExp or null`)
  if (adapter.workItemIdPattern && !adapter.workItemIdPattern.global) throw new Error(`${name}: workItemIdPattern must carry the g flag`)
  return adapter
}

export const WORK_ITEM_FIELDS = ['id', 'title', 'status', 'type', 'labels', 'closedAt', 'workCommit', 'workBranch', 'verification', 'outcome', 'note', 'design']
