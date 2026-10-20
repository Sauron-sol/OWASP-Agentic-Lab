/**
 * REFERENCE SOLUTION - lab 04, ASI05 Unexpected Code Execution.
 * Drop-in replacement for src/security/sandbox.ts.
 *
 * Read the note at the bottom. This file is the cheap 80% that runs in-process.
 * The rest of the answer is not TypeScript.
 */
import { execSync } from 'node:child_process';
import { resolve, sep } from 'node:path';

export interface ExecRequest {
  command: string;
  cwd: string;
}

export interface ExecOutcome {
  ok: boolean;
  stdout: string;
  stderr: string;
  blocked?: string;
}

export const SANDBOX_ROOT = resolve(process.cwd(), 'src/world/attacker-harness');

/** What a repro step is plausibly allowed to invoke. */
const ALLOWED_BINARIES = new Set(['node', 'npm', 'npx', 'git']);

/** Anything that lets one command become two, or reach the filesystem sideways. */
const SHELL_METACHARACTERS = /[;&|`$<>\n\r]|\$\(|&&|\|\|/;

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * A deliberately small environment. Nothing is inherited: every variable the
 * child gets is here because a repro step genuinely needs it.
 */
function sandboxEnv(cwd: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: cwd,
    TMPDIR: cwd,
    LANG: process.env.LANG ?? 'C.UTF-8',
    NODE_ENV: 'test',
    // Marker so a payload's own output makes it obvious which env it got.
    LAB_SANDBOX: '1',
  };
}

function blocked(reason: string): ExecOutcome {
  return { ok: false, stdout: '', stderr: '', blocked: reason };
}

export function execute(req: ExecRequest): ExecOutcome {
  const cwd = resolve(req.cwd);
  if (cwd !== SANDBOX_ROOT && !cwd.startsWith(SANDBOX_ROOT + sep)) {
    return blocked(`working directory ${cwd} is outside the sandbox root`);
  }

  const command = req.command.trim();
  if (!command) return blocked('empty command');
  if (SHELL_METACHARACTERS.test(command)) {
    return blocked('command contains shell metacharacters; one command per call');
  }

  const binary = command.split(/\s+/)[0] ?? '';
  if (!ALLOWED_BINARIES.has(binary)) {
    return blocked(`${binary} is not on the sandbox allowlist (${[...ALLOWED_BINARIES].join(', ')})`);
  }

  try {
    const stdout = execSync(command, {
      cwd,
      env: sandboxEnv(cwd),
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? 'failed' };
  }
}

/**
 * What this still does not stop, and where the rest of the control belongs:
 *
 *  - Network egress. The allowlisted `node` can open a socket and post anything
 *    it can read to anywhere. An in-process allowlist cannot fix that; a network
 *    policy on the container can (default-deny egress, explicit allowlist).
 *  - Filesystem reach. The child still runs as this user. Real isolation is a
 *    container or VM with only the checkout mounted, read-only where possible.
 *  - Resource exhaustion. A timeout is not a cgroup. Cap CPU and memory outside
 *    the process.
 *  - Persistence. Nothing here stops a payload writing to a shared volume that a
 *    later task will read. Sandboxes should be per-task and thrown away.
 *
 * The in-process version is worth having because it is cheap and catches the
 * common case. It is not the boundary. The boundary is the container.
 */
