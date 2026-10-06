// Shared helpers: paths, git, data layout.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA = process.env.SWARMVIEW_DATA || path.join(REPO, 'local_data')
export const git = (rig, ...a) => execFileSync('git', ['-C', rig, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 })
export const sha = (rig, ref) => git(rig, 'rev-parse', '--verify', `${ref}^{commit}`).trim()
export const readJson = (p, fallback = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback } }
export const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1)) }
export const rigDir = (city, rig) => path.join(DATA, city, rig)
export const snapshotPath = (city, rig, s) => path.join(rigDir(city, rig), 'snapshots', `${s}.json`)

// local_data/index.json lists every rig, snapshot and delta the viewer can open.
export function updateIndex(mutate) {
  const p = path.join(DATA, 'index.json')
  const idx = readJson(p, { generated: null, rigs: {} })
  mutate(idx)
  idx.generated = new Date().toISOString()
  writeJson(p, idx)
  return idx
}

// Beads of a rig, read through bd in the rig folder with the city store env
// cleared (an order's environment points bd at the city store otherwise).
export function beads(rig) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GC_|BEADS_)/.test(k)))
  try {
    const raw = JSON.parse(execFileSync('bd', ['list', '--all', '--json'], { cwd: rig, encoding: 'utf8', env, maxBuffer: 64 << 20 }) || '[]')
    return Array.isArray(raw) ? raw : raw.issues || []
  } catch { return [] }
}
