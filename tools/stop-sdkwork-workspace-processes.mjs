#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const execFileAsync = promisify(execFile);
const WORKSPACE_COMMAND_RUNTIME_NAMES = new Set([
  'bash', 'bash.exe', 'bun', 'bun.exe', 'cargo', 'cargo.exe', 'cmd.exe', 'dart', 'dart.exe',
  'deno', 'deno.exe', 'dotnet', 'dotnet.exe', 'flutter', 'flutter.bat', 'go', 'go.exe',
  'gradle', 'gradle.bat', 'gradlew', 'gradlew.bat', 'java', 'java.exe', 'mvn', 'mvn.cmd',
  'mvnw', 'mvnw.cmd', 'node', 'node.exe', 'npm', 'npm.cmd', 'npx', 'npx.cmd', 'pnpm',
  'pnpm.cmd', 'powershell.exe', 'pwsh', 'pwsh.exe', 'python', 'python.exe', 'python3',
  'python3.exe', 'sh', 'sh.exe', 'uv', 'uv.exe', 'yarn', 'yarn.cmd',
]);

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
  const executablePath = processInfo.ExecutablePath ?? processInfo.executablePath;
  if (pathIsInsideWorkspace(workspaceRoot, executablePath)) return true;
  const processName = path.basename(String(
    processInfo.Name ?? processInfo.name ?? executablePath ?? '',
  )).toLowerCase();
  return WORKSPACE_COMMAND_RUNTIME_NAMES.has(processName)
    && commandLineReferencesWorkspace(workspaceRoot, processInfo.CommandLine ?? processInfo.commandLine);
}

function processIdOf(processInfo) {
  return Number(processInfo.Id ?? processInfo.ProcessId ?? processInfo.pid);
}

export function selectWorkspaceProcessRoots(processes, { workspaceRoot, currentPid = process.pid } = {}) {
  const selected = new Map();
  for (const processInfo of processes) {
    const processId = processIdOf(processInfo);
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
    'Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine |',
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
  const failures = [];
  for (const processInfo of roots) {
    const processId = processIdOf(processInfo);
    const name = processInfo.Name ?? path.basename(processInfo.executablePath ?? 'process');
    if (dryRun) {
      console.log(`[sdkwork-stop] would stop PID ${processId} (${name}) for ${resolvedWorkspaceRoot}`);
      continue;
    }
    console.error(`[sdkwork-stop] stop PID ${processId} (${name}) for ${resolvedWorkspaceRoot}`);
    try {
      await terminateProcess(processId);
    } catch (error) {
      failures.push({ error, name, processId });
      console.error(`[sdkwork-stop] failed PID ${processId} (${name}): ${error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`failed to stop ${failures.length} process tree(s) for ${resolvedWorkspaceRoot}`);
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
