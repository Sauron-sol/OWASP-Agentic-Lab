/**
 * LAB 03 - ASI03 Identity and Privilege Abuse
 * ===========================================
 * When the downstream system receives this request, who is acting?
 *
 * Read labs/lab-03-identity/README.md. Run `npm run attack:03` first.
 */
import type { Decision, Task, ToolCall } from '../types.js';

/**
 * What the agent presents to a tool as its authority to act.
 *
 * Compare the two shapes in the script:
 *
 *   User: himalay / Agent: triage-agent / Task: investigate #482
 *   Allowed: read issue, search docs / Expires: after task
 *
 * versus
 *
 *   Token: engineering-bot / Scope: everything
 */
export interface Capability {
  /** Which agent is acting. */
  agent: string;
  /** Which human delegated this. */
  onBehalfOf: string;
  /** Which task this authority belongs to. Authority is per-task, not per-agent. */
  taskId: string;
  /** Tool names this capability covers. '*' means everything, which is the bug. */
  tools: string[];
  /** Resources it covers. */
  scope: { repo?: string; issues?: string[]; environment?: string };
  issuedAt: number;
  /** Epoch ms. Authority that outlives its task is how yesterday's approval
   *  deploys tomorrow's code. */
  expiresAt: number;
}

/**
 * The broad, permanent, shared credential in the environment variable. Every
 * team has one. It is the kind of credential an agent was holding when a
 * production database and its backups disappeared in about nine seconds.
 */
export const AMBIENT_TOKEN: Capability = {
  agent: 'engineering-bot',
  onBehalfOf: 'unknown',
  taskId: '*',
  tools: ['*'],
  scope: {},
  issuedAt: 0,
  expiresAt: Number.POSITIVE_INFINITY,
};

/**
 * Nothing needs authority for longer than this, whatever the task's deadline says.
 * A task that runs for six hours gets a stream of short-lived credentials, not one
 * six-hour credential: the agent loop re-mints before every tool call.
 */
const MAX_LIFETIME_MS = 5 * 60_000;

/**
 * Mint authority for THIS task and THIS call instead of handing over the shared
 * token. One capability object per call: it names the agent, the human it acts for,
 * the task, the one tool the call wants (if the task was ever granted it), the
 * task's resource scope, and an expiry no later than the task's own.
 */
export function mintCapability(task: Task, call: ToolCall, agent = 'triage-agent'): Capability {
  const now = Date.now();
  return {
    agent,
    onBehalfOf: task.operator,
    taskId: task.id,
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

/**
 * Called before every tool runs. This is where a presented capability is checked
 * against what is actually being attempted.
 *
 * Checks, in order of how much the presenter can control each fact:
 *   1. wildcard — a credential that covers everything authorises nothing,
 *   2. revoked  — someone already took this authority away (ASI10's kill path),
 *   3. expired  — authority that outlives its task is yesterday's approval,
 *   4. task     — issued for another task, presented for this one,
 *   5. tool     — does not cover the call being made,
 *   6. scope    — right tool, wrong resource.
 *
 * A valid credential is not an authorized action. That sentence is the lab.
 */
export function assertAuthority(
  cap: Capability,
  task: Task,
  call: ToolCall,
  now: number = Date.now(),
): Decision {
  if (cap.tools.includes('*') || cap.taskId === '*') {
    return deny(
      'wildcard authority presented: an agent-wide credential can only prove it is valid, not that this action was authorised',
    );
  }
  if (isRevoked(task.id) || isRevoked(cap.taskId)) {
    return deny(`authority for task ${task.id} was revoked — the grant is gone, wherever it is presented`);
  }
  if (now >= cap.expiresAt) {
    return deny(
      `capability expired at ${new Date(cap.expiresAt).toISOString()} — mint a fresh one for this task instead of reusing it`,
    );
  }
  if (cap.taskId !== task.id) {
    return deny(`capability was issued for task ${cap.taskId}, this run is task ${task.id}`);
  }
  if (!cap.tools.includes(call.tool)) {
    return deny(`capability covers [${cap.tools.join(', ') || 'nothing'}], not ${call.tool}`);
  }
  if (call.args.repo && cap.scope.repo && call.args.repo !== cap.scope.repo) {
    return deny(`capability is scoped to ${cap.scope.repo}, call reaches for ${call.args.repo}`);
  }
  if (call.args.number && cap.scope.issues && !cap.scope.issues.includes(call.args.number)) {
    return deny(`capability does not cover issue #${call.args.number}`);
  }
  if (call.args.environment && cap.scope.environment && call.args.environment !== cap.scope.environment) {
    return deny(`capability is scoped to ${cap.scope.environment}, call reaches for ${call.args.environment}`);
  }
  return { allow: true };
}

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI03' };
}

/** Revocation list. The capstone uses this; ASI10 is the reason it exists. */
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
