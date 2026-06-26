---
name: watch-for-prs
description: Wait for a new pull request to be opened on the configured repo and get notified the instant it happens — real push via a GitHub webhook → smee.io relay, no polling. Use when asked to watch/monitor for new PRs, be alerted when a PR is opened, or "keep an eye out" for incoming pull requests.
---

# Watch for new PRs (push, not polling)

Real blocking "wait for the next PR" without holding a socket across turns:

```
GitHub (pull_request)  ──POST──▶  smee relay  ──SSE push──▶  agent-team-watch (blocks) ──exit──▶ wakes you
```

Prerequisite: `/agent-team-setup` has provisioned the webhook + smee channel and
written `.agent-team.json`. Then run the bundled watcher as a **background**
command and let it block:

```bash
agent-team-watch opened
```

When a PR with that action arrives it prints a one-line JSON summary
(`{number,action,title,author,url}`) and exits 0 — waking you. On wake:
1. Read the printed summary (or run `gh pr view <n>`).
2. Report the PR number, title, author, URL.
3. Restart the watcher if continuous watching is wanted.

The arg is the `pull_request` action to wait for (`opened` default; also
`reopened`, `synchronize`, `closed`, …). The watcher auto-reconnects if the relay
drops an idle connection.

## Caveat
smee.io channels are unauthenticated — fine for PR-open notices on a public repo,
but don't route secrets. For durable delivery use a Hookdeck/Webhook Relay channel
URL in `.agent-team.json` instead.
