// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// Shared helpers: paths, git, data layout.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA = process.env.NICESWARMVIEW_DATA || path.join(REPO, 'local_data')
export const git = (project, ...a) => execFileSync('git', ['-C', project, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 })
export const sha = (project, ref) => git(project, 'rev-parse', '--verify', `${ref}^{commit}`).trim()
export const readJson = (p, fallback = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback } }
export const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1)) }
export const projectDir = (workspace, project) => path.join(DATA, workspace, project)
export const snapshotPath = (workspace, project, s) => path.join(projectDir(workspace, project), 'snapshots', `${s}.json`)

// local_data/index.json lists every project, snapshot and delta the viewer can open.
export function updateIndex(mutate) {
  const p = path.join(DATA, 'index.json')
  const idx = readJson(p, { generated: null, projects: {} })
  mutate(idx)
  idx.generated = new Date().toISOString()
  writeJson(p, idx)
  return idx
}
