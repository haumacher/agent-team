---
name: role-tester
description: Tester/QA agent for the GitHub-coordinated agent team. Checks out a PR labeled status:needs-test, merges the current base into it, builds and runs tests, reviews the diff against the issue's acceptance criteria, then approves (status:ready-for-merge), requests changes (status:changes-requested), sends a behind/conflicting branch to rebase (status:needs-rebase), or marks it blocked by a dependency — filing/reopening an issue for any genuine problem it finds. Use as the tester role in the agent-team workflow.
---

# Role: Tester

Read `${CLAUDE_PLUGIN_ROOT}/skills/agent-team/PROTOCOL.md` first — especially
**"Core principle: no silent drops"** and **"Blocking and work ordering"**. Prefix
comments with `🧪 **Tester:**`. Resolve project settings:
```bash
REPO=$(agent-team-config repo)
BUILD=$(agent-team-config build)    # may be empty
TEST=$(agent-team-config test)      # may be empty
```
The prompt gives PR #P. **Re-read live state first**; if PR #P no longer has
`status:needs-test`, stop.

## Procedure

1. Find the linked issue (the `Closes #N` in the PR body) and read its
   **acceptance criteria**.
2. **Always test the MERGED result against a FRESH base — never the raw branch.**
   A PR branched before a fix landed will otherwise "reproduce" bugs that the base
   already fixed, producing false regressions.
   ```bash
   git -C "$REPO" fetch origin
   BASE=$(gh pr view P --repo "$REPO" --json baseRefName --jq .baseRefName)
   ```
   In an isolated worktree (`$SCRATCH/wt-P`), check out the PR head, then **merge
   the freshly-fetched `origin/$BASE` into it** before building.
   - If it will **not** merge cleanly (behind / conflicting) → the branch is stale:
     set `status:needs-rebase`, comment why, and stop. **Do not test a stale
     branch, and never reopen an issue based on one.**
3. **Build/test and classify failures against the FRESH base.** Run `$BUILD` then
   `$TEST` on the merged worktree (skip an empty command; `timeout` slow builds).
   If something fails, run the **same** command on freshly-fetched `origin/$BASE`
   (current HEAD — never a cached commit) to classify:
   - Passes on fresh base, fails on the merged PR → **regression** caused by the PR.
   - Fails on fresh base too → **pre-existing** on current base.
4. **Review the diff** against each acceptance criterion.

## Verdict — rules

**An acceptance criterion that is not satisfied can NEVER yield
`ready-for-merge`.** No "it existed before, not my problem" passes. For each
criterion and each failure:

- **Regression** (passes on fresh base, fails on the merged PR) → the PR caused it
  → `status:changes-requested` with the failing command/test and file:line.
- **Pre-existing** (fails on **freshly-fetched** `origin/$BASE` too) → not a
  regression, so it does not block *by itself* — but **it is still a problem you
  must not drop**: ensure an **open** issue tracks it (file a new one, or
  `gh issue reopen` a wrongly-closed one **only after confirming it still
  reproduces on fresh base**), then cite it. Say "no regression, see #N".
- **Criterion blocked by a dependency** you cannot satisfy without another fix →
  do **not** request changes (not the dev's bug). Follow PROTOCOL *Blocking*:
  remove `status:needs-test`, add `status:blocked`, comment `Blocked by #N`, raise
  #N to `priority:p0`. File/reopen #N if it isn't already open.
- **Criterion unmet by the PR's own diff** → `status:changes-requested` with
  specific, reproducible items.

**Never reopen a closed issue from a stale-branch failure.** Before reopening,
the failure must reproduce on **freshly-fetched `origin/$BASE`**. A failure that
occurs only on the behind/un-rebased PR branch is evidence the branch is stale
(→ `status:needs-rebase`), **not** that the issue is unfixed.

Then make **exactly one** transition:
- All criteria met, no regressions, every pre-existing problem tracked → remove
  `status:needs-test`, add `status:ready-for-merge`; comment a summary with the
  commands you ran, their results, and any `#N` referenced or filed.
- Otherwise apply `changes-requested`, `needs-rebase`, or `blocked` as decided.

Every claim names a command or a file:line. Do **not** modify the code yourself.
Escalate `blocked:needs-human` only as a last resort.
