#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const execFileAsync = promisify(execFile);

function printHelp() {
  console.log(`Usage: node tools/stop-sdkwork-workspace-processes.mjs --workspace <path> [--dry-run]

Stops development processes attributable to one SDKWork repository. Process selection
uses the repository path in the executable path or command line and never matches a
generic executable name alone.
`);
}

export function parseStopWorkspaceArgs(argv) {
  const settings = { dryRun: false, help: false, workspaceRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      settings.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      settings.help = true;
      continue;
    }
    if (arg === '--workspace') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--workspace requires a path');
      }
      settings.workspaceRoot = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unsupported stop option: ${arg}`);
  }
  return settings;
}

function normalizePath(value) {
  return path.resolve(String(value ?? '')).replaceAll('\\', '/').toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function pathIsInsideWorkspace(workspaceRoot, candidate) {
  if (!candidate) return false;
  const root = normalizePath(workspaceRoot);
  const resolved = normalizePath(candidate);
  return resolved === root || resolved.startsWith(`${root}/`);
}

export function commandLineReferencesWorkspace(workspaceRoot, commandLine) {
  if (!commandLine) return false;
  const root = normalizePath(workspaceRoot);
  const normalizedCommandLine = String(commandLine).replaceAll('\\', '/').toLowerCase();
  const pattern = new RegExp(`(?:^|["'\\s=])${escapeRegex(root)}(?=$|["'\\s/])`, 'u');
  return pattern.test(normalizedCommandLine);
}

function processMatchesWorkspace(workspaceRoot, processInfo) {
  return pathIsInsideWorkspace(workspaceRoot, processInfo.ExecutablePath ?? processInfo.executablePath)
    || commandLineReferencesWorkspace(workspaceRoot, processInfo.CommandLine ?? processInfo.commandLine);
}

export function selectWorkspaceProcessRoots(processes, { workspaceRoot, currentPid = process.pid } = {}) {
  const selected = new Map();
  for (const processInfo of processes) {
    const processId = Number(processInfo.Id ?? processInfo.pid);
    if (!Number.isInteger(processId) || processId === Number(currentPid)) continue;
    if (processMatchesWorkspace(workspaceRoot, processInfo)) selected.set(processId, processInfo);
  }
  return [...selected.values()]
    .filter((processInfo) => !selected.has(Number(processInfo.ParentProcessId ?? processInfo.ppid)))
    .sort((left, right) => Number(left.Id ?? left.pid) - Number(right.Id ?? right.pid));
}

async function listWindowsProcesses() {
  const script = [
    'Get-CimInstance Win32_Process |',
    'Select-Object Id,ParentProcessId,Name,ExecutablePath,CommandLine |',
    'ConvertTo-Json -Compress',
  ].join(' ');
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script,
  ], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function listUnixProcesses() {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,comm=,args='], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/u);
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), executablePath: match[3], commandLine: match[4] }] : [];
  });
}

async function terminateProcessTree(processId, { platform }) {
  if (platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(processId), '/T', '/F'], { windowsHide: true });
    return;
  }
  process.kill(processId, 'SIGTERM');
}

export async function stopWorkspaceProcesses({
  workspaceRoot,
  dryRun = false,
  platform = process.platform,
  currentPid = process.pid,
  listProcesses = platform === 'win32' ? listWindowsProcesses : listUnixProcesses,
  terminateProcess = (processId) => terminateProcessTree(processId, { platform }),
} = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot ?? process.cwd());
  if (!existsSync(resolvedWorkspaceRoot)) {
    throw new Error(`workspace path does not exist: ${resolvedWorkspaceRoot}`);
  }
  const roots = selectWorkspaceProcessRoots(await listProcesses(), {
    workspaceRoot: resolvedWorkspaceRoot,
    currentPid,
  });
  if (roots.length === 0) {
    console.log(`[sdkwork-stop] no processes found for ${resolvedWorkspaceRoot}`);
    return roots;
  }
  for (const processInfo of roots) {
    const processId = Number(processInfo.Id ?? processInfo.pid);
    const name = processInfo.Name ?? path.basename(processInfo.executablePath ?? 'process');
    if (dryRun) {
      console.log(`[sdkwork-stop] would stop PID ${processId} (${name}) for ${resolvedWorkspaceRoot}`);
      continue;
    }
    console.error(`[sdkwork-stop] stop PID ${processId} (${name}) for ${resolvedWorkspaceRoot}`);
    await terminateProcess(processId);
  }
  return roots;
}

async function main() {
  const settings = parseStopWorkspaceArgs(process.argv.slice(2));
  if (settings.help) {
    printHelp();
    return;
  }
  await stopWorkspaceProcesses(settings);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(`[sdkwork-stop] ${error.message}`);
    process.exit(1);
  });
}
