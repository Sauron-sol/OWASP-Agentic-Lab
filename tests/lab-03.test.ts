import { describe, expect, it, beforeEach } from 'vitest';
import { AMBIENT_TOKEN, assertAuthority, mintCapability } from '../src/security/capability.js';
import { triageTask } from '../src/agent/tasks.js';
import { agent, call, fresh, MINUTE, taskWith } from './helpers.js';

describe('lab 03 / ASI03 - identity and privilege abuse', () => {
  beforeEach(fresh);

  const task = () => taskWith({ id: 'task-A', allowedTools: ['read_issue', 'search_docs'] });
  const readCall = () => call('read_issue', { repo: 'bytemonk/checkout', number: '482' });

  it('mints authority for the task rather than handing over the shared token', () => {
    const t = task();
    const cap = mintCapability(t, readCall());
    expect(cap).not.toBe(AMBIENT_TOKEN);
    expect(cap.tools).not.toContain('*');
    expect(cap.taskId).toBe(t.id);
    expect(cap.onBehalfOf).toBe(t.operator);
    expect(cap.expiresAt).toBeLessThanOrEqual(t.expiresAt);
    expect(cap.expiresAt).toBeGreaterThan(Date.now());
  });

  it('allows the in-scope read it was minted for', () => {
    const t = task();
    expect(assertAuthority(mintCapability(t, readCall()), t, readCall()).allow).toBe(true);
  });

  it('refuses the shared everything-scoped token outright', () => {
    const t = task();
    const d = assertAuthority(AMBIENT_TOKEN, t, readCall());
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.asi).toBe('ASI03');
  });

  it('refuses a capability reused for a different tool', () => {
    const t = task();
    const cap = mintCapability(t, readCall());
    expect(assertAuthority(cap, t, call('get_customer_record', { customer: 'cus_4471' })).allow).toBe(false);
  });

  it('refuses a capability that has expired', () => {
    const t = task();
    const cap = { ...mintCapability(t, readCall()), expiresAt: Date.now() - MINUTE };
    expect(assertAuthority(cap, t, readCall()).allow).toBe(false);
  });

  it('refuses a capability issued for another task', () => {
    const t = task();
    const cap = { ...mintCapability(t, readCall()), taskId: 'task-from-yesterday' };
    expect(assertAuthority(cap, t, readCall()).allow).toBe(false);
  });

  it('refuses a capability pointed outside its resource scope', () => {
    const t = task();
    const cap = mintCapability(t, readCall());
    expect(
      assertAuthority(cap, t, call('read_issue', { repo: 'bytemonk/checkout', number: '601' })).allow,
    ).toBe(false);
  });

  it('end to end: the happy path still runs with per-task authority', async () => {
    const result = await agent(['read_issue', 'search_docs']).run(triageTask(482));
    expect(result.finalText).toMatch(/104/);
    expect(result.audit.every((a) => a.decision.allow)).toBe(true);
  });
});
