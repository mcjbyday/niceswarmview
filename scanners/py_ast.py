#!/usr/bin/env python3
"""Python module scanner for swarmview snapshots.

Reads a JSON list of relative .py paths on stdin, resolves them under ROOT
(argv[1]), and prints one JSON object per module: members (classes with
bases, top-level functions), imports resolved to project module ids where
possible, foreign imports otherwise, line count. One node per module, the
uml-viewer convention. Uses the standard library ast only.
"""
import ast
import json
import os
import sys

root = sys.argv[1]
files = json.load(sys.stdin)
ids = {os.path.splitext(f)[0] for f in files}          # "pkg/sub/module"
packages = {os.path.dirname(f) for f in files if f.endswith("__init__.py")}


def resolve(dotted, level, from_file):
    """Return (project_module_id or None, foreign_name or None)."""
    if level:
        base = os.path.dirname(from_file)
        for _ in range(level - 1):
            base = os.path.dirname(base)
        parts = [base] + ([dotted.replace(".", "/")] if dotted else [])
        cand = "/".join(p for p in parts if p)
    else:
        cand = dotted.replace(".", "/")
    if cand in ids:
        return cand, None
    if cand in packages:
        return cand + "/__init__", None
    return None, (dotted.split(".")[0] if dotted else None)


out = []
for rel in files:
    path = os.path.join(root, rel)
    try:
        src = open(path, encoding="utf-8", errors="replace").read()
        tree = ast.parse(src)
    except Exception as exc:  # syntax error: still record the module
        out.append({"id": os.path.splitext(rel)[0], "path": rel, "lang": "python",
                    "lines": src.count("\n") + 1 if "src" in dir() else 0,
                    "members": [], "imports": [], "foreign": [], "error": str(exc)})
        continue
    members, imports, foreign = [], set(), set()
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            bases = [ast.unparse(b) if hasattr(ast, "unparse") else "" for b in node.bases]
            methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and not n.name.startswith("_")]
            members.append({"kind": "class", "name": node.name, "line": node.lineno,
                            "bases": bases, "methods": methods, "public": not node.name.startswith("_")})
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            members.append({"kind": "function", "name": node.name, "line": node.lineno,
                            "public": not node.name.startswith("_"),
                            "args": [a.arg for a in node.args.args]})
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                mid, fname = resolve(a.name, 0, rel)
                (imports.add(mid) if mid else foreign.add(fname))
        elif isinstance(node, ast.ImportFrom):
            mid, fname = resolve(node.module or "", node.level or 0, rel)
            if mid:
                imports.add(mid)
                # from pkg import submodule: resolve each name as a module too
                for a in node.names:
                    sub = mid[:-9] + "/" + a.name if mid.endswith("/__init__") else mid + "/" + a.name
                    if sub in ids:
                        imports.add(sub)
            elif fname:
                foreign.add(fname)
    me = os.path.splitext(rel)[0]
    imports.discard(me)
    out.append({"id": me, "path": rel, "lang": "python", "lines": src.count("\n") + 1,
                "members": members, "imports": sorted(imports), "foreign": sorted(foreign)})
json.dump(out, sys.stdout)
