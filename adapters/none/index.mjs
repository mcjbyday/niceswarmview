// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// No tracker: deltas still carry modules, edges, commits and changed files.
export function createAdapter() {
  return { workItemIdPattern: null, listWorkItems() { return [] }, listProjects() { return [] } }
}
