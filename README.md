# Agent Team

A Claude Code plugin that runs a **multi-agent software team coordinated entirely
through GitHub issues, PRs, and labels**. Each role — project manager, developer,
tester, release manager — is a one-shot agent spawned on a GitHub label
transition. There is no shared state other than GitHub; agents read live state, do
one unit of work, and write a single label transition.

```
PM ──issue (status:backlog)──▶ Developer ──PR (needs-test)──▶ Tester ──(ready-for-merge)──▶ Release ──merged──▶ issue closed
                                            ▲   │ changes-requested / blocked by #N
                                            └───┘
```

## How it works

GitHub pushes `issues`/`pull_request` events to a **webhook relay** (smee.io by
default). The dispatcher (`agent-team-dispatch`) holds the relay's SSE stream open
and, on each label transition, spawns a headless `claude -p` agent that loads the
matching role skill. Triggers are label transitions (not raw activity), so with a
single GitHub account no role can re-trigger itself. See
[`skills/agent-team/PROTOCOL.md`](skills/agent-team/PROTOCOL.md) for the full
state machine, the *no-silent-drops* rule, and blocking/prioritization.

## Requirements

`git`, `node` (≥18), and the GitHub CLI `gh` (authenticated) on `PATH`.

## Install

```bash
/plugin marketplace add haumacher/agent-team
/plugin install agent-team@agent-team
```

## Set up a repo

From within the target repository:

```bash
/agent-team-setup
```

This creates a relay channel, registers the webhook (`issues` + `pull_request`),
creates the label vocabulary, detects your build/test commands, and writes
`.agent-team.json`.

## Run the team

```bash
agent-team-dispatch          # LIVE: agents push/open/merge. Set DRY_RUN=1 to preview.
```

Then file an issue labeled `status:backlog` (or `/agent-team:role-pm <description>`)
and watch it flow through the team. Each agent's step-by-step log is written under
`$TMPDIR/agent-team-logs/`; the dispatcher prints a `tail -f` path per agent.

Just want PR notifications? `agent-team-watch opened` blocks until the next PR.

## Configuration (`.agent-team.json`)

| Key | Meaning |
|-----|---------|
| `repo` | `owner/name` (optional; falls back to `gh repo view`) |
| `channel` | webhook relay URL the dispatcher listens on |
| `webhookId` | GitHub hook id (for teardown) |
| `build` / `test` | commands the developer/tester run (empty = skip) |

## Caveats

- **smee.io is dev-grade and unauthenticated** — fine for getting started; for
  durable, secured delivery put a Hookdeck/Webhook Relay URL in `channel`.
- **Live mode performs real Git/GitHub actions** (push, open, merge) with
  permissions bypassed. Preview with `DRY_RUN=1` first.
- Run **one dispatcher per channel**; the relay only delivers events while the
  dispatcher is connected (no backfill).

## Teardown

```bash
gh api -X DELETE repos/$(agent-team-config repo)/hooks/$(agent-team-config webhookId)
```
