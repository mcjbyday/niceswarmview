# Third-party components

niceswarmview bundles no third-party code and declares no package
dependencies: the Node modules used are built in (`node:child_process`,
`node:fs`, `node:os`, `node:path`, `node:url`, `node:test`, `node:assert`),
and the Python scanner uses only the standard library (`ast`, `json`, `os`,
`sys`). No code was copied from another project; the module-per-node and
policy conventions follow the design of uml-viewer without reusing its code.

Tools invoked at runtime, each installed and licensed separately by the user:

| tool | used by | license |
|---|---|---|
| Node.js 20 or newer | everything under `core/`, `bin/`, `adapters/` | MIT (Node.js license) |
| Python 3 | `core/scanners/py_ast.py`, `bin/serve.sh` | PSF License |
| git | `core/snapshot.mjs`, `core/delta.mjs` | GPL-2.0-only (invoked as a separate program, not linked or bundled) |
| gh (GitHub CLI), optional | `core/forge/github.mjs` pull-request lookup | MIT |
| bd (beads) and gc (Gas City), optional | `adapters/gascity/` only | MIT |
| jq, optional | `adapters/gascity/on-work-item-closed.sh` | MIT |

Invoking git as a subprocess does not make this project a derivative work of
git; the project ships none of git's code.
