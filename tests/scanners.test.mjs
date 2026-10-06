// Scanner tests: run with `node --test tests/` (add --experimental-test-coverage for coverage).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { scanJs } from '../scanners/js.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'swarmview-test-'))
const write = (root, rel, src) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), src) }

test('js scanner: components, default export, local imports, assets, children, hooks, routes', () => {
  const root = tmp()
  write(root, 'src/App.js', `import React, { useState } from 'react'\nimport Top from './components/Top'\nimport logo from './logo.png'\nexport default function App() { const [v] = useState(0); return <Top /> }\n`)
  write(root, 'src/components/Top.js', `function Top() { return <a href="#home">x</a> }\nexport default Top\n`)
  const [app, top] = scanJs(root, ['src/App.js', 'src/components/Top.js'])
  assert.equal(app.id, 'src/App')
  assert.deepEqual(app.imports, ['src/components/Top'])
  assert.deepEqual(app.foreign, ['react'])
  assert.deepEqual(app.assets, ['./logo.png'])
  assert.equal(app.defaultExport, 'App')
  assert.equal(app.members[0].kind, 'component')
  assert.deepEqual(app.children, ['Top'])
  assert.deepEqual(app.hooks, ['useState'])
  assert.deepEqual(top.routes, ['home'])
})

test('python scanner: classes with bases, functions, relative and absolute imports resolved to module ids', () => {
  const root = tmp()
  write(root, 'pkg/__init__.py', '')
  write(root, 'pkg/base.py', 'class Base:\n    def run(self): pass\n')
  write(root, 'pkg/impl.py', 'from .base import Base\nimport pkg.base\nimport json\n\nclass Impl(Base):\n    pass\n\ndef helper(x):\n    return x\n')
  const out = JSON.parse(execFileSync('python3', [path.join(REPO, 'scanners/py_ast.py'), root], { input: JSON.stringify(['pkg/__init__.py', 'pkg/base.py', 'pkg/impl.py']), encoding: 'utf8' }))
  const impl = out.find((m) => m.id === 'pkg/impl')
  assert.deepEqual(impl.imports, ['pkg/base'])
  assert.deepEqual(impl.foreign, ['json'])
  assert.deepEqual(impl.members.map((m) => [m.kind, m.name]), [['class', 'Impl'], ['function', 'helper']])
  assert.deepEqual(impl.members[0].bases, ['Base'])
})
