# Upstream maintenance

This repository derives from `pstack` in `https://github.com/cursor/plugins`. The locked source is version `0.14.3` at commit `bdf7aa355337897f167153e05069aca505dae17c`.

The delivered repository contains only the modified Codex version. Do not push a raw upstream branch or snapshot commit. Do not keep an upstream remote in the delivered checkout.

## Provenance files

- [`NOTICE`](./NOTICE) records attribution and the source commit.
- [`upstream.lock.json`](./upstream.lock.json) records the 156 source paths, sizes, and SHA-256 hashes.
- [`compatibility/pstack-map.json`](./compatibility/pstack-map.json) assigns each source path a Codex path, classification, invariant, and validation.
- [`compatibility/report.md`](./compatibility/report.md) is the generated human-readable report.

## Check the locked source

Use a temporary local source checkout. The import helper removes its own temporary clone when you pass a repository URL, and it never writes into the derived tree.

```bash
node scripts/import-upstream.mjs \
  --source https://github.com/cursor/plugins \
  --subdirectory pstack \
  --commit bdf7aa355337897f167153e05069aca505dae17c \
  --verify-lock \
  --dry-run
```

The command must report `Verified 156 files`.

## Review a newer source commit

1. Clone the source repository into a temporary directory and check out the exact candidate commit.
2. Point `scripts/generate-compatibility-report.mjs --upstream-dir` at the candidate `pstack` directory.
3. Review every added, changed, deleted, or renamed path. Record a `refreshDisposition` in `compatibility/pstack-map.json` before adapting code.
4. Port behavior into the Codex tree. Do not copy host-specific installation or runtime claims.
5. Update the source metadata and hashes in `upstream.lock.json` only after review.
6. Regenerate `compatibility/report.md` and run the full release checks.
7. Delete the temporary source checkout. Confirm that the delivered repository has no upstream remote or raw source branch.

To inspect a candidate without changing the committed report, run:

```bash
node scripts/generate-compatibility-report.mjs \
  --check \
  --upstream-dir /absolute/path/to/temporary/plugins/pstack
```

The command exits with blocking findings until every source delta has an explicit disposition. The import helper refuses to overwrite an existing output directory, and the inventory rejects symlinks.

## Regenerate the report

After the lock and compatibility map agree, run:

```bash
node scripts/generate-compatibility-report.mjs
node scripts/generate-compatibility-report.mjs --check
node --test tests/upstream-provenance.test.mjs tests/compatibility-map.test.mjs
```

Review the generated diff. A complete report accounts for every locked path and has no unresolved source delta.
