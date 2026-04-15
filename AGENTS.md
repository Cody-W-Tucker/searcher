# Fork Sync Instructions

This repository is a fork with intentional divergence from upstream.

Current fork-specific constraints:

- Do not reintroduce Docker support.
- Do not reintroduce auth/settings password features.
- Prefer `exa`-based search behavior over `searxng`-specific upstream flows.
- Do not merge `upstream/master` directly into `master` unless the user explicitly asks for a full realignment.

## Branch Roles

- `master`: canonical branch for this fork.
- `upstream-sync`: inspection branch that tracks `upstream/master` for comparison and selective adoption.

## Upstream Update Workflow

When reviewing upstream changes, use this workflow:

1. Fetch upstream.
2. Update `upstream-sync` to match `upstream/master`.
3. Compare `master` against `upstream-sync`.
4. Selectively port compatible changes into `master`.
5. Prefer cherry-picking with provenance when a commit applies cleanly.
6. Prefer manual ports when upstream commits mix in fork-incompatible changes.

Recommended commands:

```bash
git fetch upstream --prune
git branch -f upstream-sync upstream/master
git log --oneline master..upstream-sync
git diff --stat master...upstream-sync
```

## Cherry-Pick Policy

Use `git cherry-pick -x <sha>` when:

- the upstream commit is self-contained
- it does not reintroduce removed fork features
- it applies with minimal adaptation

Example:

```bash
git cherry-pick -x <upstream-sha>
```

The `-x` flag preserves provenance by recording the original upstream commit SHA in the new commit message.

## Manual Port Policy

Use a manual port instead of cherry-picking when:

- the upstream commit includes Docker/auth/`searxng` work we do not want
- only part of the upstream commit is relevant
- the local architecture has diverged enough that cherry-pick would be noisy or misleading

When manually porting, reference the upstream source SHA in the commit message.

Recommended commit message format:

```text
port <feature> from upstream

Adapt upstream change for this fork's architecture.
Refs: upstream <sha1>, <sha2>
```

## Merge/Rebase Policy

- Do not merge `upstream/master` into `master` for routine updates.
- Do not routinely rebase `master` onto upstream.
- Treat upstream as a source of changes, not as the branch history this fork must preserve exactly.

If the user explicitly requests a full upstream realignment, stop and confirm scope before doing any merge or rebase work.

## Review Priorities For Upstream Changes

Prefer upstream changes that improve:

- search quality
- scraping robustness
- context handling
- model/provider reliability
- UI or runtime fixes that do not depend on removed fork features

Avoid or scrutinize upstream changes touching:

- Docker files
- auth or admin-password flows
- `searxng`-specific plumbing
- large dependency churn unrelated to desired functionality

## Agent Behavior

When asked to "pull upstream" or "sync from upstream":

- fetch upstream first
- inspect `master...upstream-sync`
- summarize candidate features worth porting
- apply only the smallest compatible changes
- preserve provenance in commits or commit messages

Do not create commits unless the user explicitly asks for a commit.
