# Agent team coordination protocol

A multi-agent software team coordinated entirely through GitHub issues, PRs, and
labels. There is **no shared state other than GitHub** — every agent reads the
live state, does one unit of work, and writes a label transition. Agents are
**one-shot**: spawned per event by the dispatcher (`agent-team-dispatch`), they
act once and exit.

## Project configuration

Per-project settings live in `.agent-team.json` (created by `/agent-team:setup`).
Resolve them from any role with the bundled helper (it is on `PATH`):

- Repo slug: `$(agent-team-config repo)` — falls back to `gh repo view` if unset.
- Build command: `$(agent-team-config build)` (may be empty → skip the build step).
- Test command: `$(agent-team-config test)` (may be empty → skip the test step).

Never hardcode a repo, channel, or build tool — always resolve via the helper so
the same skills work in any project.

## Single GitHub account

All agents authenticate as the same account (the user's `gh` auth). Roles are
distinguished by **comment prefixes**, and triggers are driven by **label
transitions** (never raw activity), so no role can re-trigger itself.

Comment prefixes (always start agent comments with these):
- `🧭 **PM:**` · `🛠️ **Developer:**` · `🧪 **Tester:**` · `🚀 **Release:**`

## Label state machine

Issue:  `status:backlog` → `status:in-progress` → (closed by merged PR)
PR:     `status:needs-test` → `status:ready-for-merge` → (merged)
                ↘ `status:changes-requested` → (dev) → `status:needs-test`
                ↘ `status:needs-rebase` → (dev) → `status:ready-for-merge`
                ↘ `status:blocked` (depends on another issue) → (auto) → `status:needs-test`

`blocked:needs-human` — **last resort only**: a decision no agent can make, or
repeated automated failure. Not for "this isn't my problem."

## Core principle: no silent drops

A busy team that lets problems vanish ships garbage. **Every problem an agent
notices — a failing build, a bug, a regression, an unmet criterion — must end up
as an open, tracked issue.** When you discover a problem outside your current unit
of work:

1. **Search the tracker:** `gh issue list --repo "$(agent-team-config repo)" --state all --search "<keywords>"`.
2. **Reconcile reality with the tracker:**
   - An **open** issue already tracks it → reference it (`#N`). Done.
   - A **closed** issue claims it is fixed but it is NOT → **reopen** it
     (`gh issue reopen N`) with a comment showing the evidence.
   - **No** issue exists → **file one now** (`status:backlog` + a priority), with
     your role prefix and the evidence.
   Never merely mention a problem in a comment and move on. "It existed before /
   not my problem" is not an acceptable resolution — *filing or reopening the
   issue* is the resolution.
3. Decide blocking vs non-blocking (below) and act. Escalate `blocked:needs-human`
   only if neither passing nor filing resolves it.

## Blocking and work ordering

A problem is **blocking** for a PR if it prevents verifying that PR's acceptance
criteria or makes the change non-functional. A failure that reproduces
**identically on the base branch** is *pre-existing and regression-free* — by
itself it is **not** blocking (but it still must be a tracked open issue).

- **Non-blocking** → proceed/pass, citing the tracked issue (`see #N`).
- **Blocking** →
  - On the PR: remove its current `status:*`, add `status:blocked`, comment
    `Blocked by #N`. (Use this, not `changes-requested`, when the developer
    cannot fix it — it's a dependency, not their bug.)
  - On the blocking issue: raise it to `priority:p0` — it now gates other work.

**Priority labels order the backlog:** `priority:p0` (blocker, clear first) >
`priority:p1` > `priority:p2` (default). A developer picking up backlog work
**always takes the highest priority available**, so blockers are cleared before
the work that depends on them. The **dependency** mechanism (`status:blocked` +
`Blocked by #N` + unblock-on-close) is what guarantees correct ordering.

**Unblocking:** when issue #N closes, every PR commenting `Blocked by #N` returns
from `status:blocked` to `status:needs-test`. The dispatcher's `issues.closed`
route performs this automatically.

## Routing table (what the dispatcher spawns)

| Event (action)         | Condition                  | Role                     |
|------------------------|----------------------------|--------------------------|
| issues (labeled)       | `status:backlog`           | developer (Mode A)       |
| pull_request (labeled) | `status:needs-test`        | tester                   |
| pull_request (labeled) | `status:changes-requested` | developer (Mode B)       |
| pull_request (labeled) | `status:ready-for-merge`   | release                  |
| pull_request (labeled) | `status:needs-rebase`      | developer (Mode C)       |
| issues (closed)        | any                        | unblock (re-arm blocked PRs) |

The dispatcher dedups by delivery id and ignores `blocked:needs-human` items.
Every spawned agent **re-reads live state first** and no-ops if the world moved.

## Invariants every role must uphold

1. **Idempotent:** re-running on the same item must not double-act.
2. **One transition out:** remove the label you consumed, add exactly one next
   `status:*`. Never leave an item in two `status:*` states.
3. **Link issue↔PR:** PR body must contain `Closes #<issue>`.
4. **No silent drops:** every problem you see becomes a tracked open issue.
5. **Escalate only as last resort:** `blocked:needs-human` is for undecidable or
   repeatedly-failing cases, not for deflecting work.
6. **Isolation:** dev/tester check out into a dedicated worktree under
   `$SCRATCH/wt-<branch>`, never the shared working copy.
7. **Reuse, don't duplicate:** before opening a PR (or filing an issue), check
   whether one already exists for this work and adopt it into the pipeline (label
   it `status:needs-test`) instead of creating a competing copy.

## Required labels

Created by `/agent-team:setup`: `status:{backlog,in-progress,needs-test,
changes-requested,ready-for-merge,needs-rebase,blocked}`,
`priority:{p0,p1,p2}`, `blocked:needs-human`.
