// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// Build the two-commit fixture repository for tests (examples/setup-fixture.sh).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niceswarmview-fixture-'))
  execFileSync('bash', [path.join(REPO, 'examples/setup-fixture.sh'), dir], { encoding: 'utf8' })
  const shaB = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const shaA = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim()
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'niceswarmview-data-'))
  return { dir, shaA, shaB, data }
}

export function run(script, args, env = {}) {
  return execFileSync('node', [path.join(REPO, script), ...args], { encoding: 'utf8', env: { ...process.env, ...env } })
}
