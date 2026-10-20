# Capabilities

One JSON file per project, named `<project>.json`, written by a person. It is
the top layer of the viewer: user-facing capabilities grouped in layers, each
listing the module ids (path without extension) that implement it. The viewer
shows unmapped source modules so the file can be completed over time.

```json
{ "project": "<name>", "title": "...", "summary": "...", "status": "draft",
  "layers": [ { "id": "...", "title": "...", "description": "...",
                "items": [ { "id": "...", "title": "...", "modules": ["src/App"], "status": "optional" } ] } ] }
```

`fixture-project.json` is the example for `examples/fixture-project`.
