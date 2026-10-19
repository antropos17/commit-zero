# Docker runner: unqualified contract

At the initial 2026-10-19 capability check, `docker info` could not connect to the
engine, the service read reported stopped, and WSL enumeration returned access
denied. The final 14:02 UTC read still could not reach a daemon from this environment.
`npm run sandbox:doctor` reports `docker-daemon-unavailable`,
`containerExecuted: false`, and `isolationVerified: false`. No image was pulled,
container run, generated code executed, filesystem denial observed, or container
cleanup exercised. Commit Zero's product code runner remains unavailable.

`scripts/sandbox-contract.mjs` is a source-tested **argument plan**, not an
execution adapter. It requires a digest-pinned Linux image; a staging input and
artifact directory inside one chosen root; read-only input and writable output;
no network; a read-only root filesystem; dropped capabilities; no new privileges;
an unprivileged UID; a 512 MiB memory/swap limit, one CPU, 64 processes, and a
small temporary filesystem. Its 30-second timeout and abort/cleanup procedure
are requirements for a future runner, not currently enforced runtime behavior.
`tests/sandbox-contract.test.mjs` checks the planned arguments and rejects
outside, identical, delimiter-containing, and mutable-tag mounts. These tests
cannot validate Docker isolation, symlink resolution, artifact capture or actual
resource limits. A temporary host directory or Node child process is not a
security sandbox.

## Activation path

1. Enable a trusted Linux Docker daemon and rerun `npm run sandbox:doctor`.
   `daemon-reachable-runtime-unqualified` is still only a prerequisite.
2. Select and review an image license and digest. Verify the digest locally;
   do not pull a floating tag during a user task.
3. Add a runner that resolves and checks real paths (including symlinks), stages
   only explicit input, uses the planned argument array without a shell, tracks
   the exact container ID, bounds stdout/stderr and artifacts, and removes the
   container on abort, deadline or process failure.
4. Run harmless fixtures in that runtime: a passing task, denied host-file read,
   denied network request, memory and process limits, timeout, cancellation,
   symlink escape attempt, artifact allowlist and cleanup. Record daemon/OS/image
   IDs and receipts. Do not enable a product capability until all pass.

The plan follows Docker's documented [container execution](https://docs.docker.com/engine/containers/run/),
[resource controls](https://docs.docker.com/engine/containers/resource_constraints/),
[security model](https://docs.docker.com/engine/security/), and
[none network driver](https://docs.docker.com/engine/network/drivers/none/),
accessed 2026-10-19. These sources informed the reversible argument contract;
they do not prove the present host supports or enforces it.
