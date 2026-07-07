#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function listWorkspaceRepositoryRoots(workspaceRoot, { prefix = 'sdkwork-' } = {}) {
  if (!fs.existsSync(workspaceRoot)) return [];
  return fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'AGENTS.md')))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

export function collectWorkspaceValidationIssues(workspaceRoot, validateRoot, options = {}) {
  if (!fs.existsSync(workspaceRoot)) {
    return [`workspace root not found: ${workspaceRoot}`];
  }

  const issues = [];
  for (const repoRoot of listWorkspaceRepositoryRoots(workspaceRoot, options)) {
    const repoName = path.basename(repoRoot);
    for (const issue of validateRoot(repoRoot)) {
      issues.push(`${repoName}: ${issue}`);
    }
  }
  return issues;
}
