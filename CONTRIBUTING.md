# Contributing

Thank you for considering a contribution.

## License of contributions

By submitting a contribution you agree that it is licensed under the
Apache License, Version 2.0, on the terms of Section 5 of that license
(inbound = outbound). There is no contributor license agreement.

## Sign-off

Every commit must carry a Developer Certificate of Origin sign-off
(https://developercertificate.org/): commit with `git commit -s`, which adds
`Signed-off-by: Your Name <your@email>` using your git identity.

## Before opening a pull request

```bash
npm test          # node --test tests/*.test.mjs
reuse lint        # license and copyright headers
```

New source files start with the two SPDX lines used throughout the tree.
Code under `core/` and `viewer/` must not name any work tracker; the guard
test enforces that. A new tracker goes under `adapters/<name>/` and must
pass `tests/adapter-contract.mjs`.
