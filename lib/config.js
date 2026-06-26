// Shared config resolution for the agent-team plugin.
// Per-project config lives in `.agent-team.json` (written by /agent-team:setup),
// resolved relative to the project the user launched Claude Code in.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function configPath() {
  if (process.env.AGENT_TEAM_CONFIG) return process.env.AGENT_TEAM_CONFIG;
  const base = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.join(base, '.agent-team.json');
}

function load() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch { return {}; }
}

// Repo slug "owner/name": explicit config wins, else derive from gh.
function repo(cfg = load()) {
  if (cfg.repo) return cfg.repo;
  try {
    return execSync('gh repo view --json nameWithOwner -q .nameWithOwner',
      { encoding: 'utf8' }).trim();
  } catch { return ''; }
}

module.exports = { configPath, load, repo };
