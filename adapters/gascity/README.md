# Gas City adapter

The reference backend. Gas City runs a city (`city.toml`, `.gc/`) over rigs
(git repositories registered in the city), with work tracked as beads and
Dolt as the versioned store under them.

- `index.mjs`: `listWorkItems(projectPath)` runs `bd list --all --json` in
  the rig and maps `gc.work_commit`, `gc.work_branch`, `gc.work_verification`,
  `gc.work_outcome`, `metadata.design` and the "Shift note:" paragraph of the
  bead notes onto the adapter shape; `listProjects(workspacePath)` runs
  `gc rig list --json`; `workItemIdPattern` matches bead ids such as `ab-123`
  in commit subjects.
- `on-work-item-closed.sh`: the push side. Register it as an exec order in
  the city so every closed bead with a work commit gets a snapshot and a
  delta:

```toml
# <city>/orders/niceswarmview-snapshot.toml
[order]
description = "niceswarmview: snapshot and delta each closed bead with a work commit"
trigger = "event"
on = "bead.closed"
exec = "/path/to/niceswarmview/adapters/gascity/on-work-item-closed.sh"
```

Orders run with a minimal environment: set `NICESWARMVIEW_TOOL_PATH` to the
folder holding `gc`, `bd`, `jq` and `node` if it is not `/usr/local/bin`.
The script logs to `<city>/.gc/runtime/niceswarmview.log` and is idempotent.

Run it by hand with `GC_CITY=<city> adapters/gascity/on-work-item-closed.sh`.
