import { Agent } from '../src/agent/agent.js';
import { clearRevocations } from '../src/security/capability.js';
import { clearDropbox } from '../src/world/dropbox.js';
import { resetWorld } from '../src/world/state.js';
import type { Task, ToolCall } from '../src/types.js';

export function fresh(): void {
  resetWorld();
  clearRevocations();
  clearDropbox();
}

export function agent(mounted: string[], opts: { useMemory?: boolean } = {}): Agent {
  return new Agent({ mounted, verbose: false, useMemory: opts.useMemory ?? false });
}

export function call(tool: string, args: Record<string, string> = {}, causedBy: ToolCall['causedBy'] = 'operator'): ToolCall {
  return { tool, args, causedBy };
}

/** Was anything the agent did actually driven by content we did not write? */
export function allowedCallsFromUntrusted(audit: { causedBy: string; decision: { allow: boolean } }[]): number {
  const untrusted = ['github-issue', 'shell', 'peer-agent', 'tool-description', 'agent-memory'];
  return audit.filter((a) => untrusted.includes(a.causedBy) && a.decision.allow).length;
}

export const MINUTE = 60_000;

export function taskWith(overrides: Partial<Task> & { id?: string }): Task {
  return {
    id: 'task-test',
    goal: 'Investigate issue 482 in bytemonk/checkout and summarise it.',
    operator: 'himalay',
    allowedTools: ['read_issue', 'search_docs'],
    scope: { repo: 'bytemonk/checkout', issues: ['482'], environment: 'staging' },
    expiresAt: Date.now() + 10 * MINUTE,
    ...overrides,
  };
}
