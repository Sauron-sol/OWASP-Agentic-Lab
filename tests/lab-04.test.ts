import { resolve } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { execute, SANDBOX_ROOT } from '../src/security/sandbox.js';
import { readDropbox, stolenCredentials } from '../src/world/dropbox.js';
import { fresh } from './helpers.js';

const PAYLOAD = 'node ./scripts/repro.js';

describe('lab 04 / ASI05 - unexpected code execution', () => {
  beforeEach(fresh);

  it('still runs a legitimate repro command', () => {
    const out = execute({ command: PAYLOAD, cwd: SANDBOX_ROOT });
    expect(out.blocked).toBeUndefined();
    expect(out.ok).toBe(true);
    expect(out.stdout).toMatch(/failing session id/);
  });

  it('hands the command no credentials worth stealing', () => {
    execute({ command: PAYLOAD, cwd: SANDBOX_ROOT });
    expect(stolenCredentials()).toHaveLength(0);
    const drop = readDropbox();
    // It may still write a drop box. It must have found nothing in it.
    if (drop) {
      const values = Object.values(drop.harvested).join(' ');
      expect(values).not.toMatch(/FAKE/);
    }
  });

  it('refuses to run outside the sandbox root', () => {
    const out = execute({ command: 'node --version', cwd: resolve('.') });
    expect(out.blocked).toBeTruthy();
  });

  it('refuses a command that chains a second command', () => {
    const out = execute({ command: `${PAYLOAD} && echo chained`, cwd: SANDBOX_ROOT });
    expect(out.blocked).toBeTruthy();
  });

  it('refuses a binary that has no business in a repro step', () => {
    // No network in this test on purpose: reading a file above the harness is
    // enough to show the reach, and a lab should not depend on egress.
    const out = execute({ command: 'cat ../../../package.json', cwd: SANDBOX_ROOT });
    expect(out.blocked).toBeTruthy();
  });

  it('puts a ceiling on how long a command may run', () => {
    const started = Date.now();
    execute({ command: 'node -e "setTimeout(()=>{},20000)"', cwd: SANDBOX_ROOT });
    const elapsed = Date.now() - started;
    // The unhardened sandbox waits the full 20s here. That is the point.
    expect(elapsed).toBeLessThan(15_000);
  }, 40_000);
});
