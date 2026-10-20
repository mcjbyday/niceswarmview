// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// In-memory adapter: work items and projects passed in, or read from the JSON
// file named by NICESWARMVIEW_WORK_ITEMS ({ workItems: [...], projects: [...] }).
// Used by tests and by anyone whose tracker can export a JSON list.
import fs from 'node:fs'

export function createAdapter({ workItems, projects, pattern } = {}) {
  if (!workItems && process.env.NICESWARMVIEW_WORK_ITEMS) {
    const data = JSON.parse(fs.readFileSync(process.env.NICESWARMVIEW_WORK_ITEMS, 'utf8'))
    workItems = Array.isArray(data) ? data : data.workItems || []
    projects = projects || (Array.isArray(data) ? [] : data.projects || [])
  }
  return {
    workItemIdPattern: pattern === undefined ? /\b([a-z]{2,3}-[a-z0-9]{3,})\b/g : pattern,
    listWorkItems() { return (workItems || []).map((i) => ({ labels: [], ...i })) },
    listProjects() { return projects || [] },
  }
}
