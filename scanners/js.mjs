// JavaScript / TypeScript module scanner for swarmview snapshots.
// One node per module file. Regex based (no AST dependency): good enough to
// orient a review, as uml-viewer's own TypeScript scanner is for layout.
import fs from 'node:fs'
import path from 'node:path'

const EXT = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
export const isJs = (f) => EXT.includes(path.extname(f))

function lineOf(src, index) { return src.slice(0, index).split('\n').length }

export function scanJs(root, files) {
  const ids = new Set(files.map((f) => f.replace(/\.[^.]+$/, '')))
  const resolveLocal = (fromFile, spec) => {
    const base = path.normalize(path.join(path.dirname(fromFile), spec)).replace(/\\/g, '/')
    const candidates = [base.replace(/\.[^./]+$/, ''), base, ...EXT.map((e) => base + e).map((b) => b.replace(/\.[^.]+$/, '')), base + '/index']
    for (const c of candidates) if (ids.has(c)) return c
    return null
  }
  return files.map((rel) => {
    const src = fs.readFileSync(path.join(root, rel), 'utf8')
    const id = rel.replace(/\.[^.]+$/, '')
    const members = []
    const seen = new Set()
    const add = (kind, name, line, extra = {}) => { if (!seen.has(name)) { seen.add(name); members.push({ kind, name, line, ...extra }) } }
    for (const m of src.matchAll(/^(export\s+(default\s+)?)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm))
      add(/^[A-Z]/.test(m[4]) && /\.(jsx|tsx|js)$/.test(rel) && /<[A-Za-z]/.test(src) ? 'component' : 'function', m[4], lineOf(src, m.index), { exported: !!m[1] })
    for (const m of src.matchAll(/^(export\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([\w$.]+))?/gm))
      add('class', m[2], lineOf(src, m.index), { exported: !!m[1], bases: m[3] ? [m[3]] : [] })
    for (const m of src.matchAll(/^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[\w$]+)\s*=>/gm))
      add(/^[A-Z]/.test(m[2]) ? 'component' : 'function', m[2], lineOf(src, m.index), { exported: !!m[1] })
    for (const m of src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm)) add('const', m[1], lineOf(src, m.index), { exported: true })
    for (const m of src.matchAll(/^export\s+(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) add('type', m[1], lineOf(src, m.index), { exported: true })
    const def = src.match(/export\s+default\s+(?:function\s+|class\s+)?([A-Za-z_$][\w$]*)/)
    const imports = new Set(), foreign = new Set(), assets = []
    for (const m of src.matchAll(/(?:import\s+(?:[^'"]*?\s+from\s+)?|require\()\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]
      if (spec.startsWith('.') || spec.startsWith('/')) {
        if (/\.(png|jpe?g|gif|svg|webp|css|scss|json)$/i.test(spec)) { assets.push(spec); continue }
        const r = resolveLocal(rel, spec); if (r && r !== id) imports.add(r)
      } else foreign.add(spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'))
    }
    const children = [...new Set([...src.matchAll(/<([A-Z][\w.]*)[\s/>]/g)].map((m) => m[1]))]
    const hooks = [...new Set([...src.matchAll(/\b(use[A-Z]\w*)\s*\(/g)].map((m) => m[1]))]
    const routes = [...new Set([...src.matchAll(/["'`]#([a-z][\w-]*)["'`]/g)].map((m) => m[1]))]
    const lang = /\.tsx?$/.test(rel) ? 'typescript' : 'javascript'
    return { id, path: rel, lang, lines: src.split('\n').length, members, defaultExport: def ? def[1] : null,
      imports: [...imports].sort(), foreign: [...foreign].sort(), assets, children, hooks, routes }
  })
}
