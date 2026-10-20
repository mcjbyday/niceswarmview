# Layer policy: roadmap

The viewer draws the folder tree as the package tree and never invents
layers, following uml-viewer. A policy file per project would add what code
cannot state: the intended layer order and the dependency rule (a lower
layer never imports a higher one). Nothing here is implemented yet.

| step | what it adds |
|---|---|
| policy file `policy/<project>.json` with `levels` (ordered folder prefixes) | dependency-rule violations drawn red |
| `omitEdges`, `edgeKinds` overrides | hide known-acceptable edges, retype parsed ones |
| proposals: named groupings that do not exist in source | what-if layering before a refactor |
| violations as a delta facet | a wave that introduces a violation shows it as a raised flag |
| policy lint callable from a hook | a work item cannot close while it adds a violation |

Format sketch for the example project, mirroring uml-viewer's policy in JSON:

```json
{ "project": "fixture-project",
  "levels": [["pkg"], ["src/data"], ["src/components"], ["src"]],
  "omitEdges": [["src/App", "src/data/projects"]],
  "edgeKinds": { "pkg/impl -> pkg/base": "inheritance" } }
```
