// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// Gas City adapter: the reference backend. Work items are beads read with the
// bd CLI; projects are the rigs of a city read with the gc CLI. This is the
// only module that knows bead metadata keys or the closing-note convention.
import { execFileSync } from 'node:child_process'

const ID = /\b([a-z]{2,3}-[a-z0-9]{3,})\b/g

// The closing note is the "Shift note:" paragraph a worker appends to the
// bead at close; the first paragraph after the marker is the note.
export const closingNote = (notes = '') => { const m = String(notes).match(/Shift note:\s*([\s\S]*?)(?:\n\s*\n|$)/); return m ? m[1].trim() : null }

export function createAdapter({ exec = execFileSync } = {}) {
  // bd and gc read the city store when GC_* / BEADS_* are set (as they are
  // inside a city order), so they are cleared for per-rig reads.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GC_|BEADS_)/.test(k)))
  return {
    workItemIdPattern: ID,
    listWorkItems(projectPath) {
      let issues = []
      try {
        const raw = JSON.parse(exec('bd', ['list', '--all', '--json'], { cwd: projectPath, encoding: 'utf8', env, maxBuffer: 64 << 20 }) || '[]')
        issues = Array.isArray(raw) ? raw : raw.issues || []
      } catch { return [] }
      return issues.map((b) => ({
        id: b.id, title: b.title, status: b.status, type: b.issue_type ?? null, labels: b.labels || [], closedAt: b.closed_at ?? null,
        workCommit: b.metadata?.['gc.work_commit'] || null, workBranch: b.metadata?.['gc.work_branch'] || null,
        verification: b.metadata?.['gc.work_verification'] || null, outcome: b.metadata?.['gc.work_outcome'] || null,
        note: closingNote(b.notes), design: b.metadata?.design || null,
      }))
    },
    listProjects(workspacePath) {
      try {
        const raw = JSON.parse(exec('gc', ['rig', 'list', '--json'], { cwd: workspacePath, encoding: 'utf8', env, maxBuffer: 16 << 20 }) || '{}')
        return (raw.rigs || []).filter((r) => !r.hq).map((r) => ({ name: r.name, path: r.path, defaultBranch: r.default_branch || 'main' }))
      } catch { return [] }
    },
  }
}
