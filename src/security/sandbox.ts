/**
 * LAB 04 - ASI05 Unexpected Code Execution
 * ========================================
 * The agent can run commands now. This file decides how expensive its mistakes
 * are allowed to be.
 *
 * Four controls, none of which ask the model to be more careful:
 *   1. Allowlist the SHAPE - one allowed binary, no operators that multiply it.
 *   2. Hand the child a built-from-nothing environment, never the developer's.
 *   3. Contain it: cwd inside the sandbox root, a hard timeout, a capped buffer.
 *   4. Be honest about what this does not stop (labs/lab-04-code-execution/NOTES.md).
 *
 * Read labs/lab-04-code-execution/README.md and run `npm run attack:04` first.
 */
import { execSync } from 'node:child_process';
import { resolve, sep } from 'node:path';

export interface ExecRequest {
  command: string;
  /** Absolute path the command runs in. */
  cwd: string;
}

export interface ExecOutcome {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Set when the sandbox refused to run the command at all. */
  blocked?: string;
}

/** Where untrusted code is permitted to run. Nothing above this path. */
export const SANDBOX_ROOT = resolve(process.cwd(), 'src/world/attacker-harness');

/**
 * What a repro step is plausibly allowed to invoke.
 *
 * `node` runs the repro. `git` clones the reporter's harness.
 *
 * Deliberately absent: `npm` and `npx`. They execute arbitrary lifecycle scripts
 * fetched from the network, so they are their own allowlist problem - re-adding
 * them would need an offline/locked registry and `--ignore-scripts` (README Q1).
 * A denylist of dangerous binaries loses to this: name the few that belong.
 */
const ALLOWED_BINARIES = new Set(['node', 'git']);

/**
 * The operators that turn one command into two, or into a subshell, or that
 * expand a variable or redirect sideways: `;` `|` `&` (and therefore `&&` `||`),
 * backticks, `$`, and a line break. Chained before the allowlist, so a command
 * can only be one simple invocation of an allowed binary.
 *
 * Note that `>` and `<` are on purpose NOT here: a repro step may point its
 * output at a file, and the binary allowlist above is what stops it reading
 * sideways. Keeping them out also keeps an inline `node -e` arrow function
 * from being mistaken for a redirect, so the timeout below still gets to be
 * the control that bounds a long command.
 */
const SHELL_OPERATORS = /[;|&`$\n\r]/;

/** A hung or spinning command cannot hold the agent forever. */
const TIMEOUT_MS = 10_000;

/** A noisy command cannot exhaust memory. */
const MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * A deliberately small environment, built from nothing. Nothing is inherited:
 * every variable the child sees is here because a repro step genuinely needs it.
 * In particular, none of the developer's credentials come along - that is the
 * fix for "a sandbox that inherits the developer's environment".
 */
function sandboxEnv(cwd: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: cwd,
    TMPDIR: cwd,
    LANG: process.env.LANG ?? 'C.UTF-8',
    NODE_ENV: 'test',
  };
}

function blocked(reason: string): ExecOutcome {
  return { ok: false, stdout: '', stderr: '', blocked: reason };
}

export function execute(req: ExecRequest): ExecOutcome {
  const cwd = resolve(req.cwd);
  if (cwd !== SANDBOX_ROOT && !cwd.startsWith(SANDBOX_ROOT + sep)) {
    return blocked(`working directory ${cwd} is outside the sandbox root ${SANDBOX_ROOT}`);
  }

  const command = req.command.trim();
  if (!command) return blocked('empty command');
  if (SHELL_OPERATORS.test(command)) {
    return blocked('command contains shell operators; one simple invocation of an allowed binary, no chaining');
  }

  const binary = command.split(/\s+/)[0] ?? '';
  if (!ALLOWED_BINARIES.has(binary)) {
    return blocked(`binary ${binary} is not on the sandbox allowlist (${[...ALLOWED_BINARIES].join(', ')})`);
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
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean; signal?: NodeJS.Signals };
    if (e.killed || e.signal) {
      return blocked(`command exceeded the ${TIMEOUT_MS}ms budget and was killed`);
    }
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? 'failed' };
  }
}
