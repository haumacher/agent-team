---
description: Provision the agent-team workflow for the current repo — webhook relay, labels, and .agent-team.json config.
allowed-tools: Bash, Read, Write
---

You are setting up the **agent-team** plugin for the current Git repository. Do
these steps in order, reporting what you did. Stop and ask the user only if a step
genuinely fails.

## 1. Identify the repo
```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```
If this fails, the user isn't authenticated to `gh` or isn't in a GitHub repo —
stop and tell them.

## 2. Detect build & test commands
Inspect the project and pick the commands (leave empty if none applies):
- `pom.xml` → build `mvn -q -DskipTests package`, test `mvn -q verify`
- `build.gradle*` → build `./gradlew assemble`, test `./gradlew test`
- `package.json` → build `npm run build --if-present`, test `npm test`
- `Cargo.toml` → build `cargo build`, test `cargo test`
- `go.mod` → build `go build ./...`, test `go test ./...`
Otherwise ask the user for the build/test commands.

## 3. Create a webhook relay channel
```bash
CHANNEL=$(curl -s -o /dev/null -w '%{redirect_url}' https://smee.io/new)
```
(Tell the user they can swap this for a Hookdeck/Webhook Relay URL later for a
durable, authenticated channel.)

## 4. Register the GitHub webhook (issues + pull_request)
```bash
HOOK_ID=$(gh api repos/$REPO/hooks -f name=web -F active=true \
  -f 'events[]=issues' -f 'events[]=pull_request' \
  -f "config[url]=$CHANNEL" -f 'config[content_type]=json' -q '.id')
```

## 5. Create the label vocabulary
Create (with `gh label create … --force`): `status:backlog`,
`status:in-progress`, `status:needs-test`, `status:changes-requested`,
`status:ready-for-merge`, `status:needs-rebase`, `status:blocked`,
`priority:p0`, `priority:p1`, `priority:p2`, `blocked:needs-human`.

## 6. Write `.agent-team.json` at the repo root
```json
{
  "repo": "<REPO>",
  "channel": "<CHANNEL>",
  "webhookId": "<HOOK_ID>",
  "build": "<build cmd or empty>",
  "test": "<test cmd or empty>"
}
```
Also add `.agent-team.json` to `.gitignore` (it contains a per-clone channel URL).

## 7. Report
Print the repo, channel, webhook id, and the detected build/test commands, then
tell the user how to start the team:
```bash
agent-team-dispatch              # LIVE (agents push/open/merge); DRY_RUN=1 to preview
```
and that filing an issue labeled `status:backlog` kicks off the workflow.
