// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Michael Jacobs
// Forge lookups that are generic to any git host, not to any work tracker.
import { execFileSync } from 'node:child_process'

// GitHub pull requests that contain a commit, best effort through the gh CLI.
// Returns [] when the remote is not GitHub, gh is absent, or the call fails.
export function pullRequestsForCommit(remote, sha) {
  if (!remote || !/github\.com\//.test(remote)) return []
  try {
    const repo = remote.replace(/^https:\/\/github\.com\//, '')
    const out = execFileSync('gh', ['api', `repos/${repo}/commits/${sha}/pulls`, '--jq', '.[] | {number, title, html_url, state}'], { encoding: 'utf8', timeout: 15000 })
    return out.trim().split('\n').filter(Boolean).map((l) => { const p = JSON.parse(l); return { number: p.number, title: p.title, url: p.html_url, state: p.state } })
  } catch { return [] }
}
