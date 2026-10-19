# Vendored design references

Checked 2026-10-19. The three pre-existing reference folders are included in
the public Git tree. An earlier statement that they were excluded was stale.
All 93 original files match the corresponding upstream Git blobs and working
bytes at the revisions below; the local folders and their contents are preserved.

| Local folder | Pinned upstream source | Files | Upstream terms |
| --- | --- | ---: | --- |
| `.agents/skills/impeccable` | [Impeccable snapshot](https://github.com/pbakaus/impeccable/tree/b7cac88a2e614e977cc6bcc89564d4af64323016/.agents/skills/impeccable), labeled 4.6.0 | 62 | [Apache-2.0](vendor-licenses/impeccable-LICENSE.txt), [original NOTICE](vendor-licenses/impeccable-NOTICE-md.txt) |
| `.agents/skills/design-taste-frontend` | [Taste Skill v2 snapshot](https://github.com/Leonxlnx/taste-skill/tree/9da1763c950baed17a69158a5f4c76f8f85bf49b/skills/taste-skill), retained under its install name | 29 | [MIT](vendor-licenses/design-taste-frontend-LICENSE.txt) |
| `.agents/skills/animate` | [Animate snapshot](https://github.com/emilkowalski/skills/tree/2d228630ba1446365f614a108cb8252f1feda202/skills/animate) | 2 | [MIT](vendor-licenses/animate-LICENSE.txt) |

The Impeccable snapshot follows its 4.6.0 release; it is not claimed to be the
release tag's identical tree. The original import paths and applicability notes
remain in [.agents/skills/README.md](../.agents/skills/README.md). The Impeccable
NOTICE also preserves its platform-design-skills attribution. Original Commit
Zero material retains [AGPL-3.0](../LICENSE); upstream material keeps its own terms.

## Verify before using or updating a reference

```sh
npm run skills:verify
```

The offline command compares every source file and retained license/notice with
[the identity ledger](../shared/vendored-skills.json): path, size, SHA-256 and Git
blob ID. It rejects missing/changed files, unrecorded files, duplicate entries,
outside paths and redirected parents. The full Node gate includes those checks.
It downloads and executes nothing. The ledger records a primary-source byte
comparison; the offline check verifies local identity against that record.
Neither command qualifies a launcher, browser script, downloaded engine or model.

Use the relevant reference as guidance within `DESIGN.md` and the active task's
permissions. The application does not import these tools. In this mission only
the applicable written guidance was used; no vendored executable, engine or
multi-agent workflow was started. Keep these references optional for installation.

For an intentional update, pin the selected upstream revision, compare every
retained file, obtain that revision's original license/notice bytes, and update
the ledger with the reviewed files. Run `skills:verify`, the focused tooling
suite and the frozen full/browser gates before publication. A newly passing
checksum does not itself establish executable behavior or tool permissions.
