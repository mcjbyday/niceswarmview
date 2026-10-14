#!/usr/bin/env node
// snapshot.mjs: scan one rig at one git ref into a model snapshot.
//
//   node bin/snapshot.mjs --city <name> --rig <path> [--ref main] [--name <rig-name>]
//
// Output: local_data/<city>/<rig>/snapshots/<sha>.json with one node per
// module (JavaScript, TypeScript, Python), typed edges, member lists and a
// metrics block per module joined from the rig's own quality reports when the
// ref holds them (coverage.json, crap.json, mutation-stats.json plus
// files-mutated.txt under quality/<pass>/). No model calls, deterministic,
// safe to re-run: the same sha overwrites the same file.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO, git, sha, readJson, writeJson, snapshotPath, updateIndex } from './lib.mjs'
import { scanJs, isJs } from '../scanners/js.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []).filter((e) => e.length))
const rig = path.resolve(args.rig || '.')
const city = args.city || 'default'
const name = args.name || path.basename(rig)
const ref = args.ref || 'HEAD'
const commit = sha(rig, ref)

const SKIP = /(^|\/)(node_modules|\.venv|venv|dist|build|__pycache__|\.git|worktrees|\.gc|mutants|coverage|htmlcov)(\/|$)/
const TEST = /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.py$|conftest\.py$/

// Export the tree at the ref into a temp dir so scanners read real files.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarmview-'))
execFileSync('bash', ['-c', `git -C "${rig}" archive --format=tar ${commit} | tar -x -C "${tmp}"`])
const all = git(rig, 'ls-tree', '-r', '--name-only', commit).trim().split('\n').filter((f) => f && !SKIP.test(f))
const pyFiles = all.filter((f) => f.endsWith('.py'))
const jsFiles = all.filter(isJs)
const apexFiles = all.filter((f) => /\.(cls|trigger)$/.test(f))

let modules = []
if (pyFiles.length) {
  const out = execFileSync('python3', [path.join(REPO, 'scanners/py_ast.py'), tmp], { input: JSON.stringify(pyFiles), encoding: 'utf8', maxBuffer: 64 << 20 })
  modules.push(...JSON.parse(out))
}
if (jsFiles.length) modules.push(...scanJs(tmp, jsFiles))
// Apex: placeholder nodes until a scanner exists (roadmap bead).
for (const f of apexFiles) modules.push({ id: f.replace(/\.[^.]+$/, ''), path: f, lang: 'apex', lines: fs.readFileSync(path.join(tmp, f), 'utf8').split('\n').length, members: [], imports: [], foreign: [], unscanned: true })

for (const m of modules) {
  m.folder = path.dirname(m.path)
  m.role = TEST.test(m.path) ? 'test' : 'source'
}
const byId = new Map(modules.map((m) => [m.id, m]))
const edges = []
for (const m of modules) for (const t of m.imports) if (byId.has(t)) {
  const target = byId.get(t)
  const bases = new Set((m.members || []).flatMap((x) => x.bases || []).map((b) => b.split('.').pop()))
  const kind = [...(target.members || [])].some((x) => bases.has(x.name)) ? 'inheritance' : 'dependency'
  edges.push({ from: m.id, to: t, kind })
}
const fanIn = {}
for (const e of edges) fanIn[e.to] = (fanIn[e.to] || 0) + 1
for (const m of modules) { m.fanIn = fanIn[m.id] || 0; m.fanOut = m.imports.filter((t) => byId.has(t)).length }

// ---- metrics join (Python rigs with a quality/<pass>/ folder at this ref) ----
const metricsNote = {}
const qdirs = all.filter((f) => /^quality\/[^/]+\/coverage\.json$/.test(f)).map((f) => path.dirname(f)).sort()
if (qdirs.length) {
  const q = qdirs[qdirs.length - 1]
  const cov = readJson(path.join(tmp, q, 'coverage.json'), {})
  const crap = readJson(path.join(tmp, q, 'crap.json'), [])
  const mut = readJson(path.join(tmp, q, 'mutation-stats.json'), null)
  let mutated = []
  try { mutated = fs.readFileSync(path.join(tmp, q, 'files-mutated.txt'), 'utf8').split('\n').filter(Boolean) } catch {}
  metricsNote.source = q
  metricsNote.coverageTimestamp = cov.meta?.timestamp || null
  for (const m of modules) {
    const c = cov.files?.[m.path]?.summary
    const rows = crap.filter((r) => r.file === m.path)
    const metrics = {}
    if (c) metrics.coverage = { lines: c.percent_covered, branches: c.percent_branches_covered, statements: c.num_statements }
    if (rows.length) metrics.crap = { max: Math.max(...rows.map((r) => r.crap)), ccMax: Math.max(...rows.map((r) => r.complexity)), over30: rows.filter((r) => r.crap > 30).map((r) => r.function), functions: rows.length }
    if (mut && mutated.includes(m.path)) metrics.mutation = { scope: 'rig', killed: mut.killed, survived: mut.survived, total: mut.total }
    if (Object.keys(metrics).length) {
      // grade 1..10 like uml-viewer: average of normalized coverage and mutation kill rate; crap only lowers it
      const parts = []
      if (metrics.coverage) parts.push(metrics.coverage.lines / 100)
      if (metrics.mutation && metrics.mutation.total) parts.push(metrics.mutation.killed / metrics.mutation.total)
      let g = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
      if (g != null && metrics.crap?.over30?.length) g = Math.min(g, 0.5)
      metrics.grade = g == null ? null : Math.max(1, Math.round(g * 10))
      m.metrics = metrics
    }
  }
}
// JS rigs: istanbul summary if present, either at coverage/ (c8 default) or
// committed under quality/<pass>/ next to crap.json (example, 2026-10-14).
const qsum = all.filter((f) => /^quality\/[^/]+\/coverage-summary\.json$/.test(f)).sort()
const istanbul = readJson(path.join(tmp, 'coverage/coverage-summary.json'), null) || (qsum.length ? readJson(path.join(tmp, qsum[qsum.length - 1]), null) : null)
if (istanbul && qsum.length && !metricsNote.source) metricsNote.source = path.dirname(qsum[qsum.length - 1])
if (istanbul) for (const m of modules) {
  const k = Object.keys(istanbul).find((p) => p.endsWith('/' + m.path))
  if (k) m.metrics = { coverage: { lines: istanbul[k].lines.pct, branches: istanbul[k].branches.pct }, grade: Math.max(1, Math.round(istanbul[k].lines.pct / 10)) }
}

// ---- thresholds: where a module may need to become more modular ----
const T = { fanIn: 6, lines: 400, ccMax: 10, fanOut: 8 }
for (const m of modules) {
  const flags = []
  if (m.fanIn > T.fanIn) flags.push(`fan-in ${m.fanIn} > ${T.fanIn}`)
  if (m.fanOut > T.fanOut) flags.push(`fan-out ${m.fanOut} > ${T.fanOut}`)
  if (m.lines > T.lines) flags.push(`${m.lines} lines > ${T.lines}`)
  if (m.metrics?.crap?.ccMax > T.ccMax) flags.push(`complexity ${m.metrics.crap.ccMax} > ${T.ccMax}`)
  if (flags.length) m.flags = flags
}

fs.rmSync(tmp, { recursive: true, force: true })
const meta = git(rig, 'log', '-1', '--format=%H%n%an%n%aI%n%s', commit).trim().split('\n')
// Remote as an https URL, for GitHub compare and commit links in the viewer.
let remote = null
try { remote = git(rig, 'remote', 'get-url', 'origin').trim().replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '') } catch {}
const snapshot = { city, rig: name, rigPath: rig, remote, ref, sha: commit, author: meta[1], date: meta[2], subject: meta[3],
  generated: new Date().toISOString(), thresholds: T, metricsNote,
  counts: { modules: modules.length, source: modules.filter((m) => m.role === 'source').length, tests: modules.filter((m) => m.role === 'test').length, edges: edges.length, flagged: modules.filter((m) => m.flags).length, withMetrics: modules.filter((m) => m.metrics).length },
  modules: modules.sort((a, b) => a.id.localeCompare(b.id)), edges }
const out = snapshotPath(city, name, commit)
writeJson(out, snapshot)
updateIndex((idx) => {
  const r = (idx.rigs[`${city}/${name}`] ||= { city, rig: name, rigPath: rig, snapshots: {}, deltas: {} })
  r.rigPath = rig
  r.remote = remote
  r.snapshots[commit] = { sha: commit, ref, date: meta[2], subject: meta[3], counts: snapshot.counts }
})
console.log(`${city}/${name} ${commit.slice(0, 7)} ${ref}: ${snapshot.counts.modules} modules (${snapshot.counts.tests} tests), ${snapshot.counts.edges} edges, ${snapshot.counts.withMetrics} with metrics, ${snapshot.counts.flagged} flagged -> ${path.relative(REPO, out)}`)
