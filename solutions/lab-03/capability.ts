/**
 * REFERENCE SOLUTION - lab 03, ASI03 Identity and Privilege Abuse.
 * Drop-in replacement for src/security/capability.ts.
 */
import type { Decision, Task, ToolCall } from '../../src/types.js';

export interface Capability {
  agent: string;
  onBehalfOf: string;
  taskId: string;
  tools: string[];
  scope: { repo?: string; issues?: string[]; environment?: string };
  issuedAt: number;
  expiresAt: number;
}

export const AMBIENT_TOKEN: Capability = {
  agent: 'engineering-bot',
  onBehalfOf: 'unknown',
  taskId: '*',
  tools: ['*'],
  scope: {},
  issuedAt: 0,
  expiresAt: Number.POSITIVE_INFINITY,
};

/** Nothing needs authority for longer than this, whatever the task says. */
const MAX_LIFETIME_MS = 5 * 60_000;

export function mintCapability(task: Task, call: ToolCall, agent = 'triage-agent'): Capability {
  const now = Date.now();
  return {
    agent,
    onBehalfOf: task.operator,
    taskId: task.id,
    // Only the tool being called, and only if the task was granted it at all.
    tools: task.allowedTools.includes(call.tool) ? [call.tool] : [],
    scope: {
      repo: task.scope.repo,
      issues: task.scope.issues,
      environment: task.scope.environment,
    },
    issuedAt: now,
    expiresAt: Math.min(task.expiresAt, now + MAX_LIFETIME_MS),
  };
}

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI03' };
}

export function assertAuthority(
  cap: Capability,
  task: Task,
  call: ToolCall,
  now: number = Date.now(),
): Decision {
  if (cap.tools.includes('*') || cap.taskId === '*') {
    return deny('wildcard authority presented; an agent-wide credential cannot authorise a task action');
  }
  if (isRevoked(cap.taskId) || isRevoked(task.id)) {
    return deny(`authority for task ${cap.taskId} has been revoked`);
  }
  if (now > cap.expiresAt) {
    return deny(`capability expired at ${new Date(cap.expiresAt).toISOString()}`);
  }
  if (cap.taskId !== task.id) {
    return deny(`capability was issued for task ${cap.taskId}, this is task ${task.id}`);
  }
  if (!cap.tools.includes(call.tool)) {
    return deny(`capability covers [${cap.tools.join(', ') || 'nothing'}], not ${call.tool}`);
  }
  if (call.args.repo && cap.scope.repo && call.args.repo !== cap.scope.repo) {
    return deny(`capability is scoped to ${cap.scope.repo}, not ${call.args.repo}`);
  }
  if (call.args.number && cap.scope.issues && !cap.scope.issues.includes(call.args.number)) {
    return deny(`capability does not cover issue #${call.args.number}`);
  }
  if (call.args.environment && cap.scope.environment && call.args.environment !== cap.scope.environment) {
    return deny(`capability is scoped to ${cap.scope.environment}, not ${call.args.environment}`);
  }
  return { allow: true };
}

const revoked = new Set<string>();

export function revoke(taskId: string): void {
  revoked.add(taskId);
}

export function isRevoked(taskId: string): boolean {
  return revoked.has(taskId);
}

export function clearRevocations(): void {
  revoked.clear();
}
