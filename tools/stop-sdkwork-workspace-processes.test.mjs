import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commandLineReferencesWorkspace,
  parseStopWorkspaceArgs,
  selectWorkspaceProcessRoots,
  stopWorkspaceProcesses,
} from './stop-sdkwork-workspace-processes.mjs';

const workspaceRoot = 'E:/sdkwork-space/sdkwork-im';

test('parses the workspace stop command options', () => {
  assert.deepEqual(parseStopWorkspaceArgs(['--workspace', workspaceRoot, '--dry-run']), {
    workspaceRoot: 'E:\\sdkwork-space\\sdkwork-im', dryRun: true, help: false,
  });
});

test('does not confuse a workspace path with a similarly named sibling', () => {
  assert.equal(commandLineReferencesWorkspace(workspaceRoot, 'node E:/sdkwork-space/sdkwork-im/scripts/dev.mjs'), true);
  assert.equal(commandLineReferencesWorkspace(workspaceRoot, 'node E:/sdkwork-space/sdkwork-image/scripts/dev.mjs'), false);
});

test('selects only workspace process-tree roots and excludes the stopper itself', () => {
  const selected = selectWorkspaceProcessRoots([
    { Id: 101, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/scripts/dev.mjs' },
    { Id: 102, ParentProcessId: 101, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/node_modules/vite/bin/vite.js' },
    { Id: 103, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-image/scripts/dev.mjs' },
    { Id: 104, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/sdkwork-specs/tools/stop-sdkwork-workspace-processes.mjs' },
  ], { workspaceRoot, currentPid: 104 });
  assert.deepEqual(selected.map((processInfo) => processInfo.Id), [101]);
});

test('selects Windows CIM processes by ProcessId', () => {
  const selected = selectWorkspaceProcessRoots([
    {
      ProcessId: 111,
      ParentProcessId: 1,
      Name: 'cargo.exe',
      CommandLine: 'cargo run --manifest-path E:/sdkwork-space/sdkwork-im/Cargo.toml',
    },
    {
      ProcessId: 112,
      ParentProcessId: 111,
      Name: 'sdkwork-api-im-standalone-gateway.exe',
      ExecutablePath: 'E:/sdkwork-space/sdkwork-im/target/debug/sdkwork-api-im-standalone-gateway.exe',
    },
    {
      ProcessId: 113,
      ParentProcessId: 1,
      Name: 'wps.exe',
      ExecutablePath: 'C:/Program Files/WPS Office/wps.exe',
      CommandLine: 'wps.exe /file=E:/sdkwork-space/sdkwork-im/docs/review.zip',
    },
  ], { workspaceRoot, currentPid: 999 });

  assert.deepEqual(selected.map((processInfo) => processInfo.ProcessId), [111]);
});

test('terminates only selected workspace process-tree roots', async () => {
  const terminated = [];
  await stopWorkspaceProcesses({
    workspaceRoot,
    currentPid: 999,
    listProcesses: async () => [
      { Id: 201, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/scripts/dev.mjs' },
      { Id: 202, ParentProcessId: 201, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/node_modules/vite/bin/vite.js' },
      { Id: 203, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-image/scripts/dev.mjs' },
    ],
    terminateProcess: async (processId) => terminated.push(processId),
  });

  assert.deepEqual(terminated, [201]);
});

test('attempts every selected process tree before reporting termination failures', async () => {
  const attempted = [];
  await assert.rejects(
    stopWorkspaceProcesses({
      workspaceRoot,
      currentPid: 999,
      listProcesses: async () => [
        { Id: 301, ParentProcessId: 1, Name: 'node.exe', CommandLine: 'node E:/sdkwork-space/sdkwork-im/scripts/dev.mjs' },
        { Id: 302, ParentProcessId: 1, Name: 'cargo.exe', CommandLine: 'cargo run --manifest-path E:/sdkwork-space/sdkwork-im/Cargo.toml' },
      ],
      terminateProcess: async (processId) => {
        attempted.push(processId);
        if (processId === 301) throw new Error('already exiting');
      },
    }),
    /failed to stop 1 process tree/u,
  );

  assert.deepEqual(attempted, [301, 302]);
});
