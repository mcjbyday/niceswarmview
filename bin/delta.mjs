#!/usr/bin/env node
// delta.mjs: the model-level change between two snapshots of one rig, joined
// to the beads whose work commits fall in the range.
//
//   node bin/delta.mjs --city <name> --rig <path> --base <ref> --head <ref> [--id <label>] [--bead <id>]
//
// Writes local_data/<city>/<rig>/deltas/<base7>..<head7>.json (or <id>.json)
// and registers it in local_data/index.json. Snapshots missing for either
// ref are generated first. Nodes: added, removed, renamed (same members,
// new path), changed with facets (members, imports, importers, children,
// hooks, routes, metrics, flags). Edges: added, removed. Beads: id, title,
// status, verification, shift note (the "Shift note:" paragraph a worker
// appends at close), commits in range.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { REPO, git, sha, readJson, writeJson, snapshotPath, updateIndex, beads } from './lib.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []).filter((e) => e.length))
const rig = path.resolve(args.rig || '.'), city = args.city || 'default', name = args.name || path.basename(rig)
const baseSha = sha(rig, args.base), headSha = sha(rig, args.head)
for (const [ref, s] of [[args.base, baseSha], [args.head, headSha]]) if (!fs.existsSync(snapshotPath(city, name, s)))
  execFileSync('node', [path.join(REPO, 'bin/snapshot.mjs'), '--city', city, '--rig', rig, '--ref', ref, '--name', name], { stdio: 'inherit' })
const A = readJson(snapshotPath(city, name, baseSha)), B = readJson(snapshotPath(city, name, headSha))
const am = new Map(A.modules.map((m) => [m.id, m])), bm = new Map(B.modules.map((m) => [m.id, m]))
const names = (m) => (m.members || []).map((x) => x.name).sort()
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const diffSet = (x = [], y = []) => ({ added: y.filter((v) => !x.includes(v)), removed: x.filter((v) => !y.includes(v)) })

const removedIds = [...am.keys()].filter((id) => !bm.has(id)), addedIds = [...bm.keys()].filter((id) => !am.has(id))
const renamed = []
for (const r of removedIds) for (const a of addedIds) if (names(am.get(r)).length && same(names(am.get(r)), names(bm.get(a))) && !renamed.some((x) => x.to === a)) renamed.push({ from: r, to: a })
const renamedFrom = new Set(renamed.map((r) => r.from)), renamedTo = new Set(renamed.map((r) => r.to))

// ---- beads and commits in range ----
const commits = git(rig, 'log', '--format=%H%x09%h%x09%an%x09%aI%x09%s', `${baseSha}..${headSha}`).trim().split('\n').filter(Boolean)
  .map((l) => { const [full, short, author, date, subject] = l.split('\t'); return { sha: full, short, author, date, subject } })
const inRange = new Set(commits.map((c) => c.sha))
// Modules each commit touched, so the viewer can say which bead touched a node.
for (const c of commits) {
  const rows = git(rig, 'show', '--format=', '--name-status', '-M', c.sha).trim().split('\n').filter(Boolean).map((l) => { const [st, a, b] = l.split('\t'); return { status: st[0], path: b || a, from: b ? a : null } })
  c.files = rows
  const files = rows.map((r) => r.path)
  c.modules = files.map((f) => f.replace(/\.[^.]+$/, '')).filter((m) => bm.has(m) || am.has(m))
}
// Every file the wave changed, base..head, with its unified diff embedded so
// the viewer can show code-level changes without leaving the page. Each
// patch is capped; the GitHub compare link covers the rest.
const PATCH_CAP = 24000
const changedFiles = git(rig, 'diff', '--name-status', '-M', baseSha, headSha).trim().split('\n').filter(Boolean).map((l) => {
  const [st, a, b] = l.split('\t'); const file = b || a
  let patch = ''
  try { patch = git(rig, 'diff', '--no-color', '-M', baseSha, headSha, '--', file) } catch {}
  const binary = /^Binary files/m.test(patch)
  return { status: st[0], path: file, from: b ? a : null, module: bm.has(file.replace(/\.[^.]+$/, '')) || am.has(file.replace(/\.[^.]+$/, '')) ? file.replace(/\.[^.]+$/, '') : null,
    binary, truncated: patch.length > PATCH_CAP, patch: binary ? '' : patch.slice(0, PATCH_CAP) }
})
// GitHub pull requests that contain the head commit, best effort through gh.
let remote = B.remote || A.remote || null
let pulls = []
if (remote && /github\.com\//.test(remote)) {
  try {
    const repo = remote.replace(/^https:\/\/github\.com\//, '')
    const out = execFileSync('gh', ['api', `repos/${repo}/commits/${headSha}/pulls`, '--jq', '.[] | {number, title, html_url, state}'], { encoding: 'utf8', timeout: 15000 })
    pulls = out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  } catch {}
}
const compareUrl = remote ? `${remote}/compare/${baseSha}...${headSha}` : null
// Bead ids named in commit subjects, e.g. "feat: ... (ab-123)", join even when
// the recorded work commit differs (rebased or squashed before merge).
const idsInSubjects = new Set(commits.flatMap((c) => [...c.subject.matchAll(/\b([a-z]{2,3}-[a-z0-9]{3,})\b/g)].map((m) => m[1])))
// A head ref on the default branch would match every bead that ever worked
// on main, so the branch join only applies to feature branches.
const headBranch = /^(main|master|origin\/(main|master))$/.test(args.head) ? null : args.head
const nodes = { added: [], removed: [], renamed, changed: [] }
for (const id of addedIds) if (!renamedTo.has(id)) { const m = bm.get(id); nodes.added.push({ id, path: m.path, lang: m.lang, role: m.role, lines: m.lines, members: names(m), imports: m.imports, flags: m.flags || [] }) }
for (const id of removedIds) if (!renamedFrom.has(id)) { const m = am.get(id); nodes.removed.push({ id, path: m.path, lang: m.lang, role: m.role, lines: m.lines, members: names(m) }) }
const importersOf = (S, id) => S.edges.filter((e) => e.to === id).map((e) => e.from).sort()
for (const id of bm.keys()) {
  const a = am.get(id) || (renamedTo.has(id) ? am.get(renamed.find((r) => r.to === id).from) : null)
  if (!a) continue
  const b = bm.get(id)
  const facets = {}
  for (const k of ['members', 'imports', 'children', 'hooks', 'routes', 'foreign']) {
    const d = diffSet(k === 'members' ? names(a) : a[k], k === 'members' ? names(b) : b[k])
    if (d.added.length || d.removed.length) facets[k] = d
  }
  const imp = diffSet(importersOf(A, a.id), importersOf(B, id)); if (imp.added.length || imp.removed.length) facets.importers = imp
  const fl = diffSet(a.flags || [], b.flags || []); if (fl.added.length || fl.removed.length) facets.flags = fl
  if (a.metrics || b.metrics) {
    const g = { before: a.metrics?.grade ?? null, after: b.metrics?.grade ?? null, coverageBefore: a.metrics?.coverage?.lines ?? null, coverageAfter: b.metrics?.coverage?.lines ?? null }
    if (g.before !== g.after || g.coverageBefore !== g.coverageAfter) facets.metrics = g
  }
  const textChanged = (() => { try { return git(rig, 'diff', '--quiet', baseSha, headSha, '--', b.path), false } catch { return true } })()
  const structural = Object.keys(facets).some((k) => !['metrics', 'flags'].includes(k))
  if (Object.keys(facets).length || textChanged) nodes.changed.push({ id, path: b.path, lines: { before: a.lines, after: b.lines }, structural, measured: !!facets.metrics, facets, commits: commits.filter((c) => c.modules.includes(id)).map((c) => c.short) })
}
const key = (e) => `${e.from} -> ${e.to}`
const ea = new Set(A.edges.map(key)), eb = new Set(B.edges.map(key))
const edges = { added: [...eb].filter((e) => !ea.has(e)), removed: [...ea].filter((e) => !eb.has(e)) }

const shiftNote = (notes = '') => { const m = notes.match(/Shift note:\s*([\s\S]*?)(?:\n\s*\n|$)/); return m ? m[1].trim() : null }
const beadRows = beads(rig).filter((b) => inRange.has(b.metadata?.['gc.work_commit']) || idsInSubjects.has(b.id) || (args.bead && b.id === args.bead) || (headBranch && b.metadata?.['gc.work_branch'] === headBranch))
  .map((b) => ({ id: b.id, title: b.title, status: b.status, type: b.issue_type, labels: b.labels || [], closedAt: b.closed_at, commit: b.metadata?.['gc.work_commit'] || null, branch: b.metadata?.['gc.work_branch'] || null,
    verification: b.metadata?.['gc.work_verification'] || null, outcome: b.metadata?.['gc.work_outcome'] || null, shiftNote: shiftNote(b.notes), design: b.metadata?.design || null }))

const id = args.id || `${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}`
const delta = { city, rig: name, rigPath: rig, remote, compareUrl, pulls, changedFiles, id, base: { ref: args.base, sha: baseSha, date: A.date }, head: { ref: args.head, sha: headSha, date: B.date }, generated: new Date().toISOString(),
  counts: { added: nodes.added.length, removed: nodes.removed.length, renamed: renamed.length, changed: nodes.changed.length, structural: nodes.changed.filter((c) => c.structural).length, edgesAdded: edges.added.length, edgesRemoved: edges.removed.length, commits: commits.length, beads: beadRows.length,
    flagsRaised: nodes.changed.flatMap((c) => c.facets.flags?.added || []).length + nodes.added.flatMap((n) => n.flags).length },
  labels: [...new Set(beadRows.flatMap((b) => b.labels))], nodes, edges, commits, beads: beadRows }
const out = path.join(path.dirname(snapshotPath(city, name, headSha)), '..', 'deltas', `${id}.json`)
writeJson(out, delta)
updateIndex((idx) => { const r = (idx.rigs[`${city}/${name}`] ||= { city, rig: name, rigPath: rig, snapshots: {}, deltas: {} }); r.deltas[id] = { id, base: delta.base, head: delta.head, counts: delta.counts, labels: delta.labels, beads: beadRows.map((b) => b.id), generated: delta.generated } })
console.log(`${city}/${name} ${id}: +${delta.counts.added} -${delta.counts.removed} ~${delta.counts.changed} (${delta.counts.structural} structural), edges +${delta.counts.edgesAdded} -${delta.counts.edgesRemoved}, ${delta.counts.commits} commits, ${delta.counts.beads} beads, ${delta.counts.flagsRaised} flags raised -> ${path.relative(REPO, out)}`)
